import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

import { getFirebaseServices } from '../firebaseConfig'
import { styles } from '../components/LoginScreen.styles'

const loginImage = require('../assets/images/login-fullscreen.png')

function getFriendlyLoginError(error) {
  const code = error?.code

  if (error?.message?.includes('Faltan variables')) {
    return 'Falta configurar Firebase.'
  }

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password'
  ) {
    return 'Correo o contraseña incorrectos.'
  }

  if (code === 'auth/invalid-email') {
    return 'El correo electrónico no parece válido.'
  }

  if (code === 'auth/network-request-failed') {
    return 'No pudimos conectar. Revisá tu conexión.'
  }

  return 'No pudimos ingresar. Intentá nuevamente.'
}

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length > 0,
    [email, password],
  )

  const handleLogin = async () => {
    if (!canSubmit) {
      setError('Ingresá correo y contraseña.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const { auth, db } = getFirebaseServices()
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      )
      const profileSnap = await getDoc(doc(db, 'users', credential.user.uid))
      const profile = profileSnap.exists() ? profileSnap.data() : null

      router.replace(profile?.onboardingCompleted ? '/home' : '/interests')
    } catch (loginError) {
      setError(getFriendlyLoginError(loginError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View style={styles.screen}>
      <ImageBackground source={loginImage} resizeMode="stretch" style={styles.image}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardLayer}
        >
          <Pressable
            accessibilityLabel="Volver"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backHitArea}
          />

          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={(value) => {
              setError('')
              setEmail(value)
            }}
            placeholder=""
            style={[styles.input, styles.emailInput]}
            textContentType="emailAddress"
            underlineColorAndroid="transparent"
            value={email}
          />

          <TextInput
            autoCapitalize="none"
            autoComplete="password"
            autoCorrect={false}
            onChangeText={(value) => {
              setError('')
              setPassword(value)
            }}
            placeholder=""
            secureTextEntry={!isPasswordVisible}
            style={[styles.input, styles.passwordInput]}
            textContentType="password"
            underlineColorAndroid="transparent"
            value={password}
          />

          <Pressable
            accessibilityLabel={isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            accessibilityRole="button"
            onPress={() => setIsPasswordVisible((value) => !value)}
            style={styles.eyeHitArea}
          />

          <Pressable
            accessibilityLabel="Recuperar contraseña"
            accessibilityRole="button"
            onPress={() => router.push('/forgot-password')}
            style={styles.forgotPasswordHitArea}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            accessibilityLabel="Ingresar"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleLogin}
            style={styles.submitHitArea}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : null}
          </Pressable>

          <Pressable
            accessibilityLabel="Crear cuenta"
            accessibilityRole="button"
            onPress={() => router.replace('/register')}
            style={styles.createAccountHitArea}
          />
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  )
}

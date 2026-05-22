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
import { sendPasswordResetEmail } from 'firebase/auth'

import { getFirebaseServices } from '../firebaseConfig'
import { styles } from '../components/ForgotPasswordScreen.styles'

const forgotPasswordImage = require('../assets/images/forgot-password-fullscreen.png')

function getFriendlyResetError(error) {
  const code = error?.code

  if (error?.message?.includes('Faltan variables')) {
    return 'Falta configurar Firebase.'
  }

  if (code === 'auth/invalid-email') {
    return 'El correo electrónico no parece válido.'
  }

  if (code === 'auth/user-not-found') {
    return 'No encontramos una cuenta con ese correo.'
  }

  if (code === 'auth/network-request-failed') {
    return 'No pudimos conectar. Revisá tu conexión.'
  }

  return 'No pudimos enviar el enlace. Intentá nuevamente.'
}

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const canSubmit = useMemo(() => email.trim().length > 0, [email])

  const handleResetPassword = async () => {
    if (!canSubmit) {
      setError('Ingresá tu correo electrónico.')
      setSuccess('')
      return
    }

    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const { auth } = getFirebaseServices()
      await sendPasswordResetEmail(auth, email.trim())
      setSuccess('Te enviamos el enlace de recuperación.')
    } catch (resetError) {
      setError(getFriendlyResetError(resetError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={forgotPasswordImage}
        resizeMode="stretch"
        style={styles.image}
      >
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
              setSuccess('')
              setEmail(value)
            }}
            placeholder=""
            style={styles.emailInput}
            textContentType="emailAddress"
            underlineColorAndroid="transparent"
            value={email}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}

          <Pressable
            accessibilityLabel="Enviar enlace"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleResetPassword}
            style={styles.submitHitArea}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : null}
          </Pressable>

          <Pressable
            accessibilityLabel="Volver a ingresar"
            accessibilityRole="button"
            onPress={() => router.replace('/login')}
            style={styles.loginHitArea}
          />
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  )
}

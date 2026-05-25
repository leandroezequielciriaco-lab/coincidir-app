import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { makeRedirectUri, ResponseType } from 'expo-auth-session'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { useRouter } from 'expo-router'
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { FontAwesome5 } from '@expo/vector-icons'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getFirebaseServices } from '../firebaseConfig'
import CoincidirLogo from '../components/CoincidirLogo'
import { styles } from '../components/LoginScreen.styles'

WebBrowser.maybeCompleteAuthSession()

const MISSING_GOOGLE_CLIENT_ID = 'missing-google-client-id'
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
const googleRedirectUri = makeRedirectUri({
  scheme: 'coincidirapp',
  path: 'oauthredirect',
})

const googleClientConfig = {
  clientId: googleWebClientId || MISSING_GOOGLE_CLIENT_ID,
  webClientId: googleWebClientId,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  redirectUri: googleRedirectUri,
  responseType: ResponseType.IdToken,
  selectAccount: true,
  usePKCE: false,
}

function getGoogleIdToken(response) {
  return response?.params?.id_token || response?.authentication?.idToken || ''
}

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

function getFriendlyGoogleLoginError(error) {
  const code = error?.code

  if (error?.message?.includes('Faltan variables')) {
    return 'Falta configurar Firebase.'
  }

  if (code === 'auth/account-exists-with-different-credential') {
    return 'Ya existe una cuenta con ese correo usando otro método de ingreso.'
  }

  if (code === 'auth/network-request-failed') {
    return 'No pudimos conectar. Revisá tu conexión e intentá de nuevo.'
  }

  return 'No pudimos ingresar con Google. Intentá nuevamente en unos segundos.'
}

async function saveGoogleProfile(user) {
  const { db } = getFirebaseServices()
  const userRef = doc(db, 'users', user.uid)
  const userSnap = await getDoc(userRef)
  const profile = {
    uid: user.uid,
    fullName: user.displayName || '',
    displayName: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
    provider: 'google',
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  }

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      ...profile,
      createdAt: serverTimestamp(),
    })
    return
  }

  await setDoc(
    userRef,
    {
      provider: 'google',
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [focusedField, setFocusedField] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [googleRequest, , promptGoogleAsync] = Google.useIdTokenAuthRequest(
    googleClientConfig,
  )

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length > 0,
    [email, password],
  )

  useEffect(() => {
    if (googleRequest) {
      console.log('Google request listo')
      console.log('request', {
        clientId: googleRequest.clientId,
        redirectUri: googleRequest.redirectUri,
        responseType: googleRequest.responseType,
        scopes: googleRequest.scopes,
        usePKCE: googleRequest.usePKCE,
      })
      console.log('redirectUri usado', googleRequest.redirectUri)
      console.log('clientId usado', googleRequest.clientId)
      googleRequest
        .makeAuthUrlAsync(Google.discovery)
        .then((authUrl) => {
          console.log('Google auth URL', authUrl)
        })
        .catch((requestError) => {
          console.error('Error login Google', requestError)
        })
    } else {
      console.log('redirectUri usado', googleRedirectUri)
      console.log('clientId usado', googleWebClientId || MISSING_GOOGLE_CLIENT_ID)
    }
  }, [googleRequest])

  const completeGoogleLogin = async (googleResponse) => {
    console.log('response', googleResponse)
    console.log('Respuesta Google', {
      type: googleResponse.type,
      params: googleResponse.params ? Object.keys(googleResponse.params) : [],
      error: googleResponse.error || null,
      errorCode: googleResponse.errorCode || null,
      hasAuthentication: Boolean(googleResponse.authentication),
    })

    if (googleResponse.type === 'cancel' || googleResponse.type === 'dismiss') {
      setIsGoogleSubmitting(false)
      return
    }

    if (googleResponse.type !== 'success') {
      console.error('Error login Google', {
        response: googleResponse,
        redirectUri: googleRequest?.redirectUri || googleRedirectUri,
        clientId: googleRequest?.clientId || googleWebClientId || MISSING_GOOGLE_CLIENT_ID,
      })
      setError('No pudimos completar el ingreso con Google. Revisá la consola para ver el error completo.')
      setIsGoogleSubmitting(false)
      return
    }

    const idToken = getGoogleIdToken(googleResponse)

    if (!idToken) {
      console.error('Error login Google', {
        message: 'Google no devolvió id_token.',
        response: googleResponse,
        redirectUri: googleRequest?.redirectUri || googleRedirectUri,
        clientId: googleRequest?.clientId || googleWebClientId || MISSING_GOOGLE_CLIENT_ID,
      })
      setError('Google no devolvió un token válido. Revisá la configuración del cliente OAuth.')
      setIsGoogleSubmitting(false)
      return
    }

    try {
      console.log('ID token recibido', {
        length: idToken.length,
      })

      const { auth } = getFirebaseServices()
      const credential = GoogleAuthProvider.credential(idToken)

      console.log('Firebase credential creada')

      const { user } = await signInWithCredential(auth, credential)

      console.log('Login Firebase OK', {
        uid: user.uid,
        email: user.email,
      })

      await saveGoogleProfile(user)
      router.replace('/home')
    } catch (googleLoginError) {
      console.error('Error login Google', googleLoginError)
      setError(getFriendlyGoogleLoginError(googleLoginError))
    } finally {
      setIsGoogleSubmitting(false)
    }
  }

  const handleLogin = async () => {
    if (!canSubmit) {
      setError('Ingresá correo y contraseña.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const { auth } = getFirebaseServices()
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      )

      router.replace('/home')
    } catch (loginError) {
      setError(getFriendlyLoginError(loginError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleLogin = async () => {
    if (isSubmitting || isGoogleSubmitting) {
      return
    }

    if (!googleWebClientId) {
      console.error('Error login Google', {
        message: 'Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.',
        redirectUri: googleRedirectUri,
      })
      setError('Falta configurar el Web Client ID de Google.')
      return
    }

    if (!googleRequest) {
      setError('Google Sign-In todavía se está preparando. Intentá nuevamente en unos segundos.')
      return
    }

    setError('')
    setIsGoogleSubmitting(true)

    try {
      console.log('request', {
        clientId: googleRequest.clientId,
        redirectUri: googleRequest.redirectUri,
        responseType: googleRequest.responseType,
        scopes: googleRequest.scopes,
        usePKCE: googleRequest.usePKCE,
      })
      console.log('redirectUri usado', googleRequest.redirectUri)
      console.log('clientId usado', googleRequest.clientId)

      const result = await promptGoogleAsync()

      await completeGoogleLogin(result)
    } catch (googlePromptError) {
      console.error('Error login Google', {
        error: googlePromptError,
        redirectUri: googleRequest?.redirectUri || googleRedirectUri,
        clientId: googleRequest?.clientId || googleWebClientId || MISSING_GOOGLE_CLIENT_ID,
      })
      setError(getFriendlyGoogleLoginError(googlePromptError))
      setIsGoogleSubmitting(false)
    }
  }

  const handleComingSoon = () => {
    Alert.alert('Disponible próximamente')
  }

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardLayer}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + 10, 22),
              paddingBottom: Math.max(insets.bottom + 24, 34),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityLabel="Volver"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backHitArea}
          >
            <ArrowLeft color="#0E5A44" size={33} strokeWidth={2.2} />
          </Pressable>

          <View style={styles.logoWrap}>
            <CoincidirLogo markSize={86} textSize={30} cutoutColor="#FCFAF3" compact />
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>Ingresá a tu cuenta</Text>
            <Text style={styles.subtitle}>Bienvenido de vuelta.</Text>
          </View>

          <View style={styles.formCard}>
            <View style={[styles.inputShell, focusedField === 'email' && styles.inputFocused]}>
              <Mail color="#60706B" size={22} strokeWidth={2.2} />
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onBlur={() => setFocusedField('')}
                onChangeText={(value) => {
                  setError('')
                  setEmail(value)
                }}
                onFocus={() => setFocusedField('email')}
                placeholder="Correo electrónico"
                placeholderTextColor="#7A8790"
                style={styles.input}
                textContentType="emailAddress"
                underlineColorAndroid="transparent"
                value={email}
              />
            </View>

            <View style={[styles.inputShell, focusedField === 'password' && styles.inputFocused]}>
              <LockKeyhole color="#60706B" size={22} strokeWidth={2.2} />
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                autoCorrect={false}
                onBlur={() => setFocusedField('')}
                onChangeText={(value) => {
                  setError('')
                  setPassword(value)
                }}
                onFocus={() => setFocusedField('password')}
                placeholder="Contraseña"
                placeholderTextColor="#7A8790"
                secureTextEntry={!isPasswordVisible}
                style={styles.input}
                textContentType="password"
                underlineColorAndroid="transparent"
                value={password}
              />
              <Pressable
                accessibilityLabel={isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                accessibilityRole="button"
                onPress={() => setIsPasswordVisible((value) => !value)}
                style={styles.iconButton}
              >
                {isPasswordVisible ? (
                  <EyeOff color="#60706B" size={22} strokeWidth={2.2} />
                ) : (
                  <Eye color="#60706B" size={22} strokeWidth={2.2} />
                )}
              </Pressable>
            </View>

            <Pressable
              accessibilityLabel="Recuperar contraseña"
              accessibilityRole="button"
              onPress={() => router.push('/forgot-password')}
              style={styles.forgotPassword}
            >
              <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
            </Pressable>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              accessibilityLabel="Ingresar"
              accessibilityRole="button"
              disabled={isSubmitting || isGoogleSubmitting}
              onPress={handleLogin}
              style={[
                styles.submitButton,
                (isSubmitting || isGoogleSubmitting) && styles.submitButtonDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.submitText}>Ingresar</Text>
                  <ArrowRight color="#FFFFFF" size={30} strokeWidth={2.2} style={styles.submitArrow} />
                </>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>O continuá con</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.socialRow}>
              <Pressable
                accessibilityLabel="Ingresar con Google"
                accessibilityRole="button"
                disabled={isSubmitting || isGoogleSubmitting}
                onPress={handleGoogleLogin}
                style={styles.socialButton}
              >
                {isGoogleSubmitting ? (
                  <ActivityIndicator color="#155C47" />
                ) : (
                  <FontAwesome5 color="#4285F4" name="google" size={25} />
                )}
              </Pressable>

              <Pressable
                accessibilityLabel="Ingresar con Apple"
                accessibilityRole="button"
                disabled={isSubmitting || isGoogleSubmitting}
                onPress={handleComingSoon}
                style={styles.socialButton}
              >
                <FontAwesome5 color="#111111" name="apple" size={28} />
              </Pressable>

              <Pressable
                accessibilityLabel="Ingresar con Facebook"
                accessibilityRole="button"
                disabled={isSubmitting || isGoogleSubmitting}
                onPress={handleComingSoon}
                style={styles.socialButton}
              >
                <FontAwesome5 color="#2E68B8" name="facebook-f" size={25} />
              </Pressable>
            </View>
          </View>

          <Pressable
            accessibilityLabel="Crear cuenta"
            accessibilityRole="button"
            onPress={() => router.replace('/register')}
            style={styles.createAccount}
          >
            <Text style={styles.createAccountText}>¿No tenés cuenta?</Text>
            <Text style={styles.createAccountLink}>Crear cuenta</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

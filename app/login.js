import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

import { getFirebaseServices } from '../firebaseConfig'
import { styles } from '../components/LoginScreen.styles'

WebBrowser.maybeCompleteAuthSession()

const loginImage = require('../assets/images/login-fullscreen.png')
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
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

          <View style={[styles.inputShell, styles.emailInputShell]}>
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
              style={[
                styles.input,
                email.length > 0 && styles.filledInput,
              ]}
              textContentType="emailAddress"
              underlineColorAndroid="transparent"
              value={email}
            />
          </View>

          <View style={[styles.inputShell, styles.passwordInputShell]}>
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
              style={[
                styles.input,
                password.length > 0 && styles.filledInput,
              ]}
              textContentType="password"
              underlineColorAndroid="transparent"
              value={password}
            />
          </View>

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
            disabled={isSubmitting || isGoogleSubmitting}
            onPress={handleLogin}
            style={styles.submitHitArea}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : null}
          </Pressable>

          <Pressable
            accessibilityLabel="Ingresar con Google"
            accessibilityRole="button"
            disabled={isSubmitting || isGoogleSubmitting}
            onPress={handleGoogleLogin}
            style={[styles.socialHitArea, styles.googleHitArea]}
          >
            {isGoogleSubmitting ? <ActivityIndicator color="#155C47" /> : null}
          </Pressable>

          <Pressable
            accessibilityLabel="Ingresar con Apple"
            accessibilityRole="button"
            disabled={isSubmitting || isGoogleSubmitting}
            onPress={handleComingSoon}
            style={[styles.socialHitArea, styles.appleHitArea]}
          />

          <Pressable
            accessibilityLabel="Ingresar con Facebook"
            accessibilityRole="button"
            disabled={isSubmitting || isGoogleSubmitting}
            onPress={handleComingSoon}
            style={[styles.socialHitArea, styles.facebookHitArea]}
          />

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

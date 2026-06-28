import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  getAdditionalUserInfo,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getFirebaseServices } from '../firebaseConfig'
import CoincidirLogo from '../components/CoincidirLogo'
import GoogleLogo from '../components/GoogleLogo'
import { styles } from '../components/LoginScreen.styles'
import { reloadAuthUser } from '../utils/authParticipation'
import { getLegalAcceptanceFields, hasAcceptedCurrentLegal } from '../constants/legal'
import { getGoogleProfileNameRepairFields, readCleanString } from '../utils/userNames'

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
const isWeb = Platform.OS === 'web'
let googleSignInModule = null

function getGoogleSignInModule() {
  if (googleSignInModule) {
    return googleSignInModule
  }

  try {
    const module = require('@react-native-google-signin/google-signin')
    module.GoogleSignin.configure({
      webClientId: googleWebClientId,
      iosClientId: googleIosClientId,
    })
    googleSignInModule = module
    return googleSignInModule
  } catch (moduleError) {
    console.error('Google Sign-In native module no disponible', moduleError)
    return null
  }
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

  if (code === 'auth/popup-blocked') {
    return 'El navegador bloqueó la ventana de Google. Permití popups para COINCIDIR e intentá nuevamente.'
  }

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Cerraste la ventana de Google antes de completar el ingreso.'
  }

  if (code === 'auth/unauthorized-domain') {
    return 'Este dominio no está autorizado en Firebase Authentication. Agregá coincidir.web.app en Authorized domains.'
  }

  if (code === 'auth/account-exists-with-different-credential') {
    return 'Ya existe una cuenta con ese correo usando otro método de ingreso.'
  }

  if (code === 'auth/operation-not-allowed') {
    return 'Google no está habilitado como proveedor de acceso en Firebase Authentication.'
  }

  if (code === 'auth/network-request-failed') {
    return 'No pudimos conectar. Revisá tu conexión e intentá de nuevo.'
  }

  if (code === 'PLAY_SERVICES_NOT_AVAILABLE') {
    return 'Google Play Services no está disponible o necesita actualizarse.'
  }

  return 'No pudimos ingresar con Google. Intentá nuevamente en unos segundos.'
}

async function getGoogleNativeIdToken(GoogleSignin) {
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    })
  }

  const signInResult = await GoogleSignin.signIn()

  if (signInResult.type === 'cancelled') {
    return ''
  }

  if (signInResult.data?.idToken) {
    return signInResult.data.idToken
  }

  const tokens = await GoogleSignin.getTokens()
  return tokens.idToken || ''
}

function readProfileString(profile, field) {
  const value = profile?.[field]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

async function saveGoogleProfile(user, { acceptLegal = false, isNewUser = false } = {}) {
  const { db } = getFirebaseServices()
  const userRef = doc(db, 'users', user.uid)
  const userSnap = await getDoc(userRef)
  const existingProfile = userSnap.exists() ? userSnap.data() : null
  const photoRemoved = existingProfile?.photoRemoved === true
  const googlePhotoURL = user.photoURL || ''
  const existingPhotoURL = readProfileString(existingProfile, 'photoURL')
  const existingAvatarURL =
    readProfileString(existingProfile, 'avatarUrl') ||
    readProfileString(existingProfile, 'avatarURL') ||
    readProfileString(existingProfile, 'imageUrl') ||
    readProfileString(existingProfile, 'photoUrl') ||
    readProfileString(existingProfile, 'avatar')
  const shouldUseGooglePhoto = Boolean(googlePhotoURL && !photoRemoved && !existingPhotoURL && !existingAvatarURL)
  const hasCurrentLegalAcceptance = hasAcceptedCurrentLegal(existingProfile)
  const requiresLegalAcceptance = (!hasCurrentLegalAcceptance || isNewUser) && !acceptLegal
  if (requiresLegalAcceptance) return { requiresLegalAcceptance: true }
  const googleName = readCleanString(user.displayName)
  const nameRepairFields = getGoogleProfileNameRepairFields(existingProfile, user)

  const profile = {
    uid: user.uid,
    fullName: googleName,
    displayName: googleName,
    name: googleName,
    email: user.email || '',
    ...(googlePhotoURL && !photoRemoved ? { avatarUrl: googlePhotoURL, googlePhotoURL, photoURL: googlePhotoURL } : {}),
    provider: 'google',
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    ...(acceptLegal ? getLegalAcceptanceFields(serverTimestamp()) : {}),
  }

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      ...profile,
      createdAt: serverTimestamp(),
    })
    return { requiresLegalAcceptance: false }
  }

  await setDoc(
    userRef,
    {
      uid: user.uid,
      ...nameRepairFields,
      ...(!readProfileString(existingProfile, 'email') && user.email ? { email: user.email } : {}),
      ...(googlePhotoURL && !photoRemoved ? { googlePhotoURL } : {}),
      ...(shouldUseGooglePhoto ? { avatarUrl: googlePhotoURL, photoURL: googlePhotoURL } : {}),
      provider: 'google',
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      ...(acceptLegal ? getLegalAcceptanceFields(serverTimestamp()) : {}),
    },
    { merge: true },
  )
  return { requiresLegalAcceptance: false }
}

export default function LoginScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [focusedField, setFocusedField] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false)

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length > 0,
    [email, password],
  )
  const showLegalRequiredMessage = params.legalRequired === '1'

  const completeGoogleUserLogin = async (user, { isNewUser = false } = {}) => {
    try {
      console.log('Login Firebase OK', {
        uid: user.uid,
        email: user.email,
        acceptLegal: hasAcceptedLegal,
        isNewUser,
      })

      const profileResult = await saveGoogleProfile(user, { acceptLegal: hasAcceptedLegal, isNewUser })
      if (profileResult.requiresLegalAcceptance) {
        setError('Para continuar con Google necesitás aceptar los Términos y Condiciones y la Política de Privacidad.')
        return
      }
      router.replace('/home')
    } catch (googleLoginError) {
      console.error('Error login Google', googleLoginError)
      setError(getFriendlyGoogleLoginError(googleLoginError))
    } finally {
      setIsGoogleSubmitting(false)
    }
  }

  const completeGoogleLogin = async (idToken) => {
    if (!idToken) {
      console.error('Error login Google', {
        message: 'Google no devolvió id_token.',
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

      const userCredential = await signInWithCredential(auth, credential)
      const additionalUserInfo = getAdditionalUserInfo(userCredential)
      const isNewUser = additionalUserInfo?.isNewUser === true
      await completeGoogleUserLogin(userCredential.user, { isNewUser })
    } catch (googleLoginError) {
      console.error('Error login Google', googleLoginError)
      setError(getFriendlyGoogleLoginError(googleLoginError))
      setIsGoogleSubmitting(false)
    }
  }

  const handleGoogleWebLogin = async () => {
    setError('')
    setIsGoogleSubmitting(true)

    try {
      const { auth } = getFirebaseServices()
      auth.languageCode = 'es'

      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })

      const userCredential = await signInWithPopup(auth, provider)
      const additionalUserInfo = getAdditionalUserInfo(userCredential)
      const isNewUser = additionalUserInfo?.isNewUser === true
      await completeGoogleUserLogin(userCredential.user, { isNewUser })
    } catch (googlePopupError) {
      console.error('Error login Google Web', googlePopupError)
      setError(getFriendlyGoogleLoginError(googlePopupError))
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
      const { auth, db } = getFirebaseServices()
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      )
      await reloadAuthUser(credential.user)
      const profileRef = doc(db, 'users', credential.user.uid)
      const profileSnap = await getDoc(profileRef)
      const profile = profileSnap.exists() ? profileSnap.data() : null
      if (!hasAcceptedCurrentLegal(profile)) {
        if (!hasAcceptedLegal) {
          setError('Para continuar necesitás aceptar los Términos y Condiciones y la Política de Privacidad.')
          return
        }
        await setDoc(profileRef, getLegalAcceptanceFields(serverTimestamp()), { merge: true })
      }

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

    if (isWeb) {
      await handleGoogleWebLogin()
      return
    }

    if (!googleWebClientId) {
      console.error('Error login Google', {
        message: 'Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.',
      })
      setError('Falta configurar el Web Client ID de Google.')
      return
    }

    setError('')
    setIsGoogleSubmitting(true)

    try {
      const googleSignIn = getGoogleSignInModule()

      if (!googleSignIn) {
        setError('Google Sign-In no está disponible en este build. Podés ingresar con correo y contraseña.')
        setIsGoogleSubmitting(false)
        return
      }

      const idToken = await getGoogleNativeIdToken(googleSignIn.GoogleSignin)

      if (!idToken) {
        setIsGoogleSubmitting(false)
        return
      }

      await completeGoogleLogin(idToken)
    } catch (googlePromptError) {
      const statusCodes = googleSignInModule?.statusCodes

      if (
        googlePromptError?.code === 'SIGN_IN_CANCELLED' ||
        googlePromptError?.code === statusCodes?.SIGN_IN_CANCELLED
      ) {
        setIsGoogleSubmitting(false)
        return
      }

      console.error('Error login Google', googlePromptError)
      setError(getFriendlyGoogleLoginError(googlePromptError))
      setIsGoogleSubmitting(false)
    }
  }

  const handleBack = () => {
    if (Platform.OS === 'web') {
      router.replace('/onboarding')
      return
    }

    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back()
      return
    }

    router.replace('/onboarding')
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
            isWeb && styles.webScrollContent,
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
            onPress={handleBack}
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

            {showLegalRequiredMessage ? (
              <Text style={styles.infoText}>
                Para continuar, aceptá los Términos y Condiciones y la Política de Privacidad.
              </Text>
            ) : null}

            <View style={styles.legalAcceptanceBox}>
              <Pressable
                accessibilityLabel="Aceptar términos y política de privacidad"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: hasAcceptedLegal }}
                onPress={() => {
                  setError('')
                  setHasAcceptedLegal((value) => !value)
                }}
                style={[styles.legalCheckbox, hasAcceptedLegal && styles.legalCheckboxChecked]}
              >
                {hasAcceptedLegal ? <Check color="#FFFFFF" size={17} strokeWidth={3} /> : null}
              </Pressable>
              <Text style={styles.legalAcceptanceText}>
                He leído y acepto los{' '}
                <Text onPress={() => router.push('/legal/terms')} style={styles.legalLink}>
                  Términos y Condiciones
                </Text>
                {' '}y la{' '}
                <Text onPress={() => router.push('/legal/privacy')} style={styles.legalLink}>
                  Política de Privacidad
                </Text>
                .
              </Text>
            </View>

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

            <Pressable
              accessibilityLabel="Continuar con Google"
              accessibilityRole="button"
              disabled={isSubmitting || isGoogleSubmitting}
              onPress={handleGoogleLogin}
              style={styles.googleButton}
            >
              {isGoogleSubmitting ? (
                <ActivityIndicator color="#155C47" />
              ) : (
                <>
                  <GoogleLogo size={23} />
                  <Text style={styles.googleButtonText}>Continuar con Google</Text>
                </>
              )}
            </Pressable>

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

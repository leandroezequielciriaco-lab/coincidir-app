import { useMemo, useState } from 'react'
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
  useWindowDimensions,
} from 'react-native'
import { makeRedirectUri, ResponseType } from 'expo-auth-session'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { useRouter } from 'expo-router'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Calendar,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MapPin,
  UserRound,
} from 'lucide-react-native'

import CoincidirLogo from './CoincidirLogo'
import GoogleLogo from './GoogleLogo'
import { styles } from './RegisterScreen.styles'
import { getFirebaseServices } from '../firebaseConfig'

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

const INITIAL_FORM = {
  fullName: '',
  email: '',
  password: '',
  birthDate: '',
  city: '',
}

function getGoogleIdToken(response) {
  return response?.params?.id_token || response?.authentication?.idToken || ''
}

function getFriendlyAuthError(error) {
  const code = error?.code

  if (error?.message?.includes('Faltan variables')) {
    return 'Falta configurar Firebase. Revisá las variables EXPO_PUBLIC_FIREBASE_* antes de registrar usuarios.'
  }

  if (code === 'auth/email-already-in-use') {
    return 'Ese correo ya está registrado. Probá ingresar con tu cuenta.'
  }

  if (code === 'auth/invalid-email') {
    return 'El correo electrónico no parece válido.'
  }

  if (code === 'auth/weak-password') {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }

  if (code === 'auth/network-request-failed') {
    return 'No pudimos conectar con Firebase. Revisá tu conexión e intentá de nuevo.'
  }

  return 'No pudimos crear tu cuenta. Intentá nuevamente en unos segundos.'
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

function validateForm(form) {
  if (!form.fullName.trim()) {
    return 'Ingresá tu nombre completo.'
  }

  if (!form.email.trim()) {
    return 'Ingresá tu correo electrónico.'
  }

  if (!form.password) {
    return 'Ingresá una contraseña.'
  }

  if (form.password.length < 6) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }

  if (!form.birthDate.trim()) {
    return 'Ingresá tu fecha de nacimiento.'
  }

  return ''
}

async function saveRegistrationProfile(user, form, fullName) {
  try {
    const { db } = getFirebaseServices()

    await updateProfile(user, {
      displayName: fullName,
    })

    await setDoc(doc(db, 'users', user.uid), {
      fullName,
      email: form.email.trim().toLowerCase(),
      birthDate: form.birthDate.trim(),
      city: form.city.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (profileError) {
    console.warn('Cuenta creada, pero no pudimos guardar el perfil en Firestore.', profileError)
  }
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

function InputIcon({ type }) {
  const iconProps = {
    color: '#576767',
    size: 24,
    strokeWidth: 2.1,
  }

  if (type === 'mail') {
    return <View style={styles.inputIcon}><Mail {...iconProps} /></View>
  }

  if (type === 'lock') {
    return <View style={styles.inputIcon}><LockKeyhole {...iconProps} /></View>
  }

  if (type === 'calendar') {
    return <View style={styles.inputIcon}><Calendar {...iconProps} /></View>
  }

  if (type === 'pin') {
    return <View style={styles.inputIcon}><MapPin {...iconProps} /></View>
  }

  return <View style={styles.inputIcon}><UserRound {...iconProps} /></View>
}

function FormInput({
  autoCapitalize = 'none',
  keyboardType = 'default',
  onChangeText,
  placeholder,
  secureTextEntry = false,
  showPasswordToggle = false,
  type,
  value,
  visiblePassword,
  onTogglePassword,
}) {
  return (
    <View style={styles.inputShell}>
      <InputIcon type={type} />
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7F8788"
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
      {showPasswordToggle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visiblePassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          hitSlop={10}
          onPress={onTogglePassword}
          style={styles.passwordToggle}
        >
          {visiblePassword ? (
            <EyeOff color="#576767" size={22} strokeWidth={2.1} />
          ) : (
            <Eye color="#576767" size={22} strokeWidth={2.1} />
          )}
        </Pressable>
      ) : null}
    </View>
  )
}

export default function RegisterScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [form, setForm] = useState(INITIAL_FORM)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  const [googleRequest, , promptGoogleAsync] = Google.useIdTokenAuthRequest(
    googleClientConfig,
  )

  const logoSizes = useMemo(
    () => ({
      mark: Math.min(Math.max(width * 0.17, 70), 96),
      text: Math.min(Math.max(width * 0.07, 30), 42),
    }),
    [width],
  )

  const updateField = (field) => (value) => {
    setError('')
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async () => {
    const validationError = validateForm(form)

    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const { auth } = getFirebaseServices()

      const credential = await createUserWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password,
      )

      const { user } = credential
      const fullName = form.fullName.trim()

      saveRegistrationProfile(user, form, fullName)

      router.replace('/home')
    } catch (submitError) {
      setError(getFriendlyAuthError(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const completeGoogleRegistration = async (googleResponse) => {
    if (googleResponse.type === 'cancel' || googleResponse.type === 'dismiss') {
      setIsGoogleSubmitting(false)
      return
    }

    if (googleResponse.type !== 'success') {
      setError('No pudimos completar el ingreso con Google. Revisá la consola para ver el error completo.')
      setIsGoogleSubmitting(false)
      return
    }

    const idToken = getGoogleIdToken(googleResponse)

    if (!idToken) {
      setError('Google no devolvió un token válido. Revisá la configuración del cliente OAuth.')
      setIsGoogleSubmitting(false)
      return
    }

    try {
      const { auth } = getFirebaseServices()
      const credential = GoogleAuthProvider.credential(idToken)
      const { user } = await signInWithCredential(auth, credential)

      await saveGoogleProfile(user)
      router.replace('/home')
    } catch (googleLoginError) {
      setError(getFriendlyGoogleLoginError(googleLoginError))
    } finally {
      setIsGoogleSubmitting(false)
    }
  }

  const handleGoogleRegistration = async () => {
    if (isSubmitting || isGoogleSubmitting) {
      return
    }

    if (!googleWebClientId) {
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
      const result = await promptGoogleAsync()
      await completeGoogleRegistration(result)
    } catch (googlePromptError) {
      setError(getFriendlyGoogleLoginError(googlePromptError))
      setIsGoogleSubmitting(false)
    }
  }

  const handleComingSoon = () => {
    Alert.alert('Disponible próximamente')
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.backgroundShape} />
          <View style={styles.backgroundArc} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>

          <View style={styles.content}>
            <CoincidirLogo
              compact
              cutoutColor="#FAF8F1"
              markSize={logoSizes.mark}
              textSize={logoSizes.text}
            />

            <View style={styles.header}>
              <Text style={styles.title}>Creá tu cuenta</Text>
              <Text style={styles.subtitle}>Es rápido y fácil. Empecemos.</Text>
            </View>

            <View style={styles.form}>
              <FormInput
                autoCapitalize="words"
                onChangeText={updateField('fullName')}
                placeholder="Nombre completo"
                type="user"
                value={form.fullName}
              />
              <FormInput
                keyboardType="email-address"
                onChangeText={updateField('email')}
                placeholder="Correo electrónico"
                type="mail"
                value={form.email}
              />
              <FormInput
                onChangeText={updateField('password')}
                onTogglePassword={() => setIsPasswordVisible((value) => !value)}
                placeholder="Contraseña"
                secureTextEntry={!isPasswordVisible}
                showPasswordToggle
                type="lock"
                value={form.password}
                visiblePassword={isPasswordVisible}
              />
              <FormInput
                onChangeText={updateField('birthDate')}
                placeholder="Fecha de nacimiento"
                type="calendar"
                value={form.birthDate}
              />
              <FormInput
                autoCapitalize="words"
                onChangeText={updateField('city')}
                placeholder="Ciudad (opcional)"
                type="pin"
                value={form.city}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting || isGoogleSubmitting}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                  (isSubmitting || isGoogleSubmitting) && styles.primaryButtonDisabled,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Continuar</Text>
                    <Text style={styles.primaryButtonArrow}>→</Text>
                  </>
                )}
              </Pressable>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>O continuar con</Text>
              <View style={styles.divider} />
            </View>

            <Pressable
              accessibilityLabel="Continuar con Google"
              accessibilityRole="button"
              disabled={isSubmitting || isGoogleSubmitting}
              onPress={handleGoogleRegistration}
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

            <View style={styles.socialRow}>
              <Pressable
                accessibilityLabel="Continuar con Apple"
                accessibilityRole="button"
                disabled={isSubmitting || isGoogleSubmitting}
                onPress={handleComingSoon}
                style={styles.socialButton}
              >
                <Text style={styles.appleText}>●</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Continuar con Facebook"
                accessibilityRole="button"
                disabled={isSubmitting || isGoogleSubmitting}
                onPress={handleComingSoon}
                style={styles.socialButton}
              >
                <Text style={styles.facebookText}>f</Text>
              </Pressable>
            </View>

            <Text style={styles.terms}>
              Al continuar, aceptás nuestros{'\n'}
              <Text style={styles.termsStrong}>Términos y Condiciones</Text> y la{' '}
              <Text style={styles.termsStrong}>Política de Privacidad.</Text>
            </Text>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

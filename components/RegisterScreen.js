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
  useWindowDimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { SafeAreaView } from 'react-native-safe-area-context'

import CoincidirLogo from './CoincidirLogo'
import { styles } from './RegisterScreen.styles'
import { getFirebaseServices } from '../firebaseConfig'

const INITIAL_FORM = {
  fullName: '',
  email: '',
  password: '',
  birthDate: '',
  city: '',
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

function InputIcon({ type }) {
  if (type === 'mail') {
    return <Text style={styles.inputIcon}>✉</Text>
  }

  if (type === 'lock') {
    return <Text style={styles.inputIcon}>▣</Text>
  }

  if (type === 'calendar') {
    return <Text style={styles.inputIcon}>□</Text>
  }

  if (type === 'pin') {
    return <Text style={styles.inputIcon}>⌖</Text>
  }

  return <Text style={styles.inputIcon}>○</Text>
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
          <Text style={styles.passwordToggleText}>{visiblePassword ? '◉' : '◎'}</Text>
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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

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
      const { auth, db } = getFirebaseServices()

      const credential = await createUserWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password,
      )

      const { user } = credential
      const fullName = form.fullName.trim()

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

      router.replace('/interests')
    } catch (submitError) {
      setError(getFriendlyAuthError(submitError))
    } finally {
      setIsSubmitting(false)
    }
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
                disabled={isSubmitting}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                  isSubmitting && styles.primaryButtonDisabled,
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

            <View style={styles.socialRow}>
              <Pressable style={styles.socialButton}>
                <Text style={[styles.socialText, styles.googleText]}>G</Text>
              </Pressable>
              <Pressable style={styles.socialButton}>
                <Text style={styles.appleText}>●</Text>
              </Pressable>
              <Pressable style={styles.socialButton}>
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

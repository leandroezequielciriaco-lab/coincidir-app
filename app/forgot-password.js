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
import { useRouter } from 'expo-router'
import { sendPasswordResetEmail } from 'firebase/auth'
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, ShieldCheck } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import CoincidirLogo from '../components/CoincidirLogo'
import { getFirebaseServices } from '../firebaseConfig'
import { styles } from '../components/ForgotPasswordScreen.styles'

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
  const insets = useSafeAreaInsets()
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
          <View style={styles.backgroundShape} />
          <View style={styles.bottomWave} />

          <Pressable
            accessibilityLabel="Volver"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft color="#0E5A44" size={33} strokeWidth={2.2} />
          </Pressable>

          <View style={styles.logoWrap}>
            <CoincidirLogo markSize={86} textSize={27} cutoutColor="#FCFAF3" compact />
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Recuperá tu cuenta</Text>
            <Text style={styles.subtitle}>
              Ingresá tu correo electrónico y te enviaremos un enlace para recuperar tu contraseña.
            </Text>
          </View>

          <View style={styles.illustration}>
            <Mail color="#0E5A44" size={58} strokeWidth={1.9} />
            <View style={styles.illustrationBadge}>
              <LockKeyhole color="#FFFFFF" size={18} strokeWidth={2.4} />
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.inputShell}>
              <Mail color="#60706B" size={22} strokeWidth={2.2} />
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
                placeholder="Correo electrónico"
                placeholderTextColor="#7A8790"
                style={styles.input}
                textContentType="emailAddress"
                underlineColorAndroid="transparent"
                value={email}
              />
            </View>

            {error ? <Text style={[styles.messageText, styles.errorText]}>{error}</Text> : null}
            {success ? <Text style={[styles.messageText, styles.successText]}>{success}</Text> : null}

            <Pressable
              accessibilityLabel="Enviar enlace"
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={handleResetPassword}
              style={[
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.submitText}>Enviar enlace</Text>
                  <ArrowRight color="#FFFFFF" size={30} strokeWidth={2.2} style={styles.submitArrow} />
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.securityCard}>
            <View style={styles.securityIcon}>
              <ShieldCheck color="#FFFFFF" size={23} strokeWidth={2.3} />
            </View>
            <Text style={styles.securityText}>
              Para tu seguridad, el enlace expirará en 30 minutos.
            </Text>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>¿Recordaste tu contraseña?</Text>
            <View style={styles.divider} />
          </View>

          <Pressable
            accessibilityLabel="Volver a ingresar"
            accessibilityRole="button"
            onPress={() => router.replace('/login')}
            style={styles.loginButton}
          >
            <Text style={styles.loginText}>Volver a ingresar</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

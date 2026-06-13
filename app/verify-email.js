import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { signOut } from 'firebase/auth'
import { MailCheck } from 'lucide-react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getFirebaseServices } from '../firebaseConfig'
import CoincidirLogo from '../components/CoincidirLogo'
import {
  canParticipate,
  getEmailVerificationErrorMessage,
  reloadAuthUser,
  resendEmailVerification,
} from '../utils/authParticipation'

export default function VerifyEmailScreen() {
  const router = useRouter()
  const [isReloading, setIsReloading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleResend = async () => {
    if (isResending) return

    setIsResending(true)
    try {
      const { auth } = getFirebaseServices()
      console.log('[VERIFY EMAIL RESEND]', {
        userId: auth.currentUser?.uid ?? null,
        email: auth.currentUser?.email ?? null,
      })
      await resendEmailVerification(auth)
    } catch (error) {
      Alert.alert('No pudimos reenviar el email', getEmailVerificationErrorMessage(error))
    } finally {
      setIsResending(false)
    }
  }

  const handleReload = async () => {
    if (isReloading) return

    setIsReloading(true)
    try {
      const { auth } = getFirebaseServices()
      console.log('[VERIFY EMAIL RELOAD]', {
        userId: auth.currentUser?.uid ?? null,
        email: auth.currentUser?.email ?? null,
      })
      await reloadAuthUser(auth.currentUser)

      if (canParticipate(auth.currentUser)) {
        router.replace('/home')
        return
      }

      Alert.alert('Email pendiente', 'Todav\u00eda no vemos tu email verificado. Revis\u00e1 tu casilla y prob\u00e1 de nuevo.')
    } catch {
      Alert.alert('No pudimos actualizar tu estado', 'Prob\u00e1 nuevamente en unos segundos.')
    } finally {
      setIsReloading(false)
    }
  }

  const handleSignOut = async () => {
    if (isSigningOut) return

    setIsSigningOut(true)
    try {
      const { auth } = getFirebaseServices()
      await signOut(auth)
      router.replace('/login')
    } catch {
      Alert.alert('No pudimos cerrar sesi\u00f3n', 'Intent\u00e1 nuevamente en unos segundos.')
    } finally {
      setIsSigningOut(false)
    }
  }

  const anyLoading = isReloading || isResending || isSigningOut

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.logoWrap}>
          <CoincidirLogo markSize={82} textSize={29} cutoutColor="#FCFAF3" compact />
        </View>

        <View style={styles.panel}>
          <View style={styles.iconCircle}>
            <MailCheck color="#155C47" size={38} strokeWidth={2.2} />
          </View>

          <Text style={styles.title}>Verific\u00e1 tu email para usar COINCIDIR</Text>
          <Text style={styles.subtitle}>
            Te enviamos un correo de verificaci\u00f3n. Revis\u00e1 tu casilla y luego volv\u00e9 a entrar.
          </Text>

          <View style={styles.actions}>
            <VerifyButton
              disabled={anyLoading}
              loading={isResending}
              onPress={handleResend}
              text="Reenviar email de verificaci\u00f3n"
            />
            <VerifyButton
              disabled={anyLoading}
              loading={isReloading}
              onPress={handleReload}
              text="Ya verifiqu\u00e9 mi email"
              variant="secondary"
            />
            <VerifyButton
              disabled={anyLoading}
              loading={isSigningOut}
              onPress={handleSignOut}
              text="Cerrar sesi\u00f3n"
              variant="ghost"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function VerifyButton({ disabled, loading, onPress, text, variant = 'primary' }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'ghost' && styles.ghostButton,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : '#155C47'} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'secondary' && styles.secondaryButtonText,
            variant === 'ghost' && styles.ghostButtonText,
          ]}
        >
          {text}
        </Text>
      )}
    </Pressable>
  )
}

const shadow = Platform.select({
  web: {
    boxShadow: '0 18px 42px rgba(7, 57, 45, 0.10)',
  },
  default: {
    elevation: 4,
    shadowColor: '#07392D',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
  },
})

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FCFAF3',
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 34,
    paddingHorizontal: 24,
    paddingTop: 28,
    ...Platform.select({
      web: {
        alignSelf: 'center',
        maxWidth: 520,
        width: '100%',
      },
      default: {},
    }),
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  panel: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E6E3',
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    ...shadow,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#F1F8ED',
    borderColor: '#D2E9C8',
    borderRadius: 999,
    borderWidth: 1,
    height: 78,
    justifyContent: 'center',
    marginBottom: 18,
    width: 78,
  },
  title: {
    color: '#0E5A44',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 34,
    textAlign: 'center',
  },
  subtitle: {
    color: '#34445F',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 24,
    marginTop: 12,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 28,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#00613F',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 18,
  },
  secondaryButton: {
    backgroundColor: '#F7FBF4',
    borderColor: '#DDEBDD',
    borderWidth: 1,
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 21,
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: '#155C47',
  },
  ghostButtonText: {
    color: '#9B2F2F',
  },
})

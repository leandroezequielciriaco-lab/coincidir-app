import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { ImageBackground, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { styles } from './OnboardingScreen.styles'
import { useGlobalAuth } from '../utils/authContext'

const onboardingImage = require('../assets/images/onboarding-fullscreen.png')
const WEB_MIN_HEIGHT = 620
const WEB_MAX_HEIGHT = 820

function logOnboardingError(error) {
  console.warn('[ONBOARDING ERROR]', error)
}

export default function OnboardingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const { checked: authChecked, user } = useGlobalAuth()
  const isWeb = Platform.OS === 'web'
  const safeLoginStyle = { bottom: Math.max(insets.bottom + 12, 24), top: undefined }
  const webCardHeight = Math.min(Math.max(height - 48, WEB_MIN_HEIGHT), WEB_MAX_HEIGHT)

  useEffect(() => {
    console.log('[ONBOARDING MOUNT]', Platform.OS)
  }, [])

  useEffect(() => {
    if (!authChecked || !user) return

    console.log('[ROUTE GUARD REDIRECT]', { from: 'onboarding', to: '/home' })
    try {
      router.replace('/home')
    } catch (error) {
      logOnboardingError(error)
    }
  }, [authChecked, router, user])

  const navigateToLogin = () => {
    try {
      router.push('/login')
    } catch (error) {
      logOnboardingError(error)
    }
  }

  if (isWeb) {
    return (
      <View style={[styles.screen, styles.webScreen]}>
        <View style={[styles.webCard, { minHeight: webCardHeight }]}>
          <ImageBackground
            onError={(error) => logOnboardingError(error?.nativeEvent?.error ?? error)}
            resizeMode="cover"
            source={onboardingImage}
            style={styles.webImageBackground}
          />

          <View style={styles.webContentLayer}>
            <View style={styles.webTextBlock}>
              <Text style={styles.webEyebrow}>Coincidir</Text>
              <Text style={styles.webTitle}>Conectá. Movete. Coincidí.</Text>
              <Text style={styles.webSubtitle}>
                Encontrá planes, actividades y personas para compartir lo que te gusta.
              </Text>
            </View>

            <View style={styles.webButtonGroup}>
              <Pressable
                accessibilityLabel="Comenzar"
                accessibilityRole="button"
                onPress={navigateToLogin}
                style={({ hovered, pressed }) => [
                  styles.webPrimaryButton,
                  (hovered || pressed) && styles.webPrimaryButtonActive,
                ]}
              >
                <Text style={styles.webPrimaryButtonText}>Comenzar</Text>
              </Pressable>

              <Pressable
                accessibilityLabel="Ingresar con cuenta existente"
                accessibilityRole="button"
                onPress={navigateToLogin}
                style={({ hovered, pressed }) => [
                  styles.webSecondaryButton,
                  (hovered || pressed) && styles.webSecondaryButtonActive,
                ]}
              >
                <Text style={styles.webSecondaryButtonText}>Ingresar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <View style={styles.imageFrame}>
        <ImageBackground
          onError={(error) => logOnboardingError(error?.nativeEvent?.error ?? error)}
          source={onboardingImage}
          resizeMode="stretch"
          style={styles.image}
        >
          <Pressable
            accessibilityLabel="Comenzar"
            accessibilityRole="button"
            onPress={navigateToLogin}
            style={styles.startButtonHitArea}
          />
          <Pressable
            accessibilityLabel="Ingresar con cuenta existente"
            accessibilityRole="button"
            onPress={navigateToLogin}
            style={[styles.loginButtonHitArea, safeLoginStyle]}
          />
        </ImageBackground>
      </View>
    </View>
  )
}

import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { ImageBackground, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { styles } from './OnboardingScreen.styles'
import { useGlobalAuth } from '../utils/authContext'

const onboardingImage = require('../assets/images/onboarding-fullscreen.png')

export default function OnboardingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { checked: authChecked, user } = useGlobalAuth()
  const safeLoginStyle = { bottom: Math.max(insets.bottom + 12, 24), top: undefined }

  useEffect(() => {
    if (!authChecked || !user) return

    console.log('[ROUTE GUARD REDIRECT]', { from: 'onboarding', to: '/home' })
    router.replace('/home')
  }, [authChecked, router, user])

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={onboardingImage}
        resizeMode="stretch"
        style={styles.image}
      >
        <Pressable
          accessibilityLabel="Comenzar"
          accessibilityRole="button"
          onPress={() => router.push('/register')}
          style={styles.startButtonHitArea}
        />
        <Pressable
          accessibilityLabel="Ingresar con cuenta existente"
          accessibilityRole="button"
          onPress={() => router.push('/login')}
          style={[styles.loginButtonHitArea, safeLoginStyle]}
        />
      </ImageBackground>
    </View>
  )
}

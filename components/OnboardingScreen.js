import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { ImageBackground, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { onAuthStateChanged } from 'firebase/auth'

import { styles } from './OnboardingScreen.styles'
import { getFirebaseServices } from '../firebaseConfig'

const onboardingImage = require('../assets/images/onboarding-fullscreen.png')

export default function OnboardingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const safeLoginStyle = { bottom: Math.max(insets.bottom + 12, 24), top: undefined }

  useEffect(() => {
    try {
      console.log('[AUTH RESTORE START]', { screen: 'onboarding' })
      const { auth } = getFirebaseServices()
      return onAuthStateChanged(auth, (user) => {
        console.log(user ? '[AUTH RESTORE USER]' : '[AUTH RESTORE NULL]', {
          screen: 'onboarding',
          uid: user?.uid ?? null,
        })

        if (user) {
          console.log('[ROUTE GUARD REDIRECT]', { from: 'onboarding', to: '/home' })
          router.replace('/home')
        }
      })
    } catch (error) {
      console.error('[AUTH RESTORE ERROR]', error)
      return undefined
    }
  }, [router])

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

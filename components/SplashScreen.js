import { useEffect, useRef } from 'react'
import { Animated, Image, Text, View, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'

import { styles } from './SplashScreen.styles'
import { getFirebaseServices } from '../firebaseConfig'

const SPLASH_LOGO_SOURCE = require('../assets/images/coincidir-splash-logo.png')

const DISPLAY_TIME = 2000
const FADE_DURATION = 700

export default function SplashScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const entrance = useRef(new Animated.Value(0)).current

  const logoWidth = Math.min(Math.max(width * 0.44, 150), 180)

  useEffect(() => {
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: FADE_DURATION,
      useNativeDriver: true,
    })
    let authResolved = false
    let displayResolved = false
    let nextRoute = null
    let unsubscribeAuth

    const finishIfReady = () => {
      if (!authResolved || !displayResolved || !nextRoute) return

      console.log('[ROUTE GUARD REDIRECT]', { from: 'splash', to: nextRoute })
      router.replace(nextRoute)
    }

    const timeout = setTimeout(() => {
      displayResolved = true
      finishIfReady()
    }, DISPLAY_TIME)

    animation.start()

    try {
      console.log('[AUTH RESTORE START]')
      const { auth } = getFirebaseServices()
      unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        authResolved = true
        nextRoute = user ? '/home' : '/onboarding'
        console.log(user ? '[AUTH RESTORE USER]' : '[AUTH RESTORE NULL]', {
          uid: user?.uid ?? null,
        })
        finishIfReady()
      })
    } catch (error) {
      authResolved = true
      nextRoute = '/onboarding'
      console.error('[AUTH RESTORE ERROR]', error)
      finishIfReady()
    }

    return () => {
      clearTimeout(timeout)
      animation.stop()
      if (unsubscribeAuth) unsubscribeAuth()
    }
  }, [entrance, router])

  const animatedStyle = {
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
      {
        scale: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [0.97, 1],
        }),
      },
    ],
  }

  return (
    <View style={styles.screen}>
      <Animated.View
        style={[
          styles.brand,
          animatedStyle,
        ]}
      >
        <Image
          accessibilityLabel="Logo de Coincidir"
          resizeMode="contain"
          source={SPLASH_LOGO_SOURCE}
          style={[styles.logo, { width: logoWidth, height: logoWidth * 0.872 }]}
        />
        <Text style={styles.tagline}>Conectá. Movete. Coincidí.</Text>
      </Animated.View>
    </View>
  )
}

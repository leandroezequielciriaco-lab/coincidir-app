import { useEffect, useRef, useState } from 'react'
import { Animated, Image, Text, View, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'

import { styles } from './SplashScreen.styles'
import { useGlobalAuth } from '../utils/authContext'

const SPLASH_LOGO_SOURCE = require('../assets/images/coincidir-splash-logo.png')

const DISPLAY_TIME = 2000
const FADE_DURATION = 700

export default function SplashScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const entrance = useRef(new Animated.Value(0)).current
  const [displayReady, setDisplayReady] = useState(false)
  const { checked: authChecked, user } = useGlobalAuth()

  const logoWidth = Math.min(Math.max(width * 0.44, 150), 180)

  useEffect(() => {
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: FADE_DURATION,
      useNativeDriver: true,
    })

    const timeout = setTimeout(() => {
      setDisplayReady(true)
    }, DISPLAY_TIME)

    animation.start()

    return () => {
      clearTimeout(timeout)
      animation.stop()
    }
  }, [entrance])

  useEffect(() => {
    if (!displayReady || !authChecked) return

    const nextRoute = user ? '/home' : '/onboarding'
    console.log('[ROUTE GUARD REDIRECT]', { from: 'splash', to: nextRoute })
    router.replace(nextRoute)
  }, [authChecked, displayReady, router, user])

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

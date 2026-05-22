import { useEffect, useRef } from 'react'
import { Animated, View, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'

import CoincidirLogo from './CoincidirLogo'
import { styles } from './SplashScreen.styles'

const DISPLAY_TIME = 2000
const FADE_DURATION = 700

export default function SplashScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const entrance = useRef(new Animated.Value(0)).current

  const cardSize = Math.min(Math.max(width * 0.68, 248), 324)
  const logoSize = Math.min(Math.max(width * 0.19, 74), 104)
  const brandSize = Math.min(Math.max(width * 0.086, 31), 42)

  useEffect(() => {
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: FADE_DURATION,
      useNativeDriver: true,
    })

    const timeout = setTimeout(() => {
      router.replace('/onboarding')
    }, DISPLAY_TIME)

    animation.start()

    return () => {
      clearTimeout(timeout)
      animation.stop()
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
          styles.card,
          animatedStyle,
          {
            width: cardSize,
            minHeight: cardSize,
          },
        ]}
      >
        <CoincidirLogo markSize={logoSize} textSize={brandSize} />
      </Animated.View>
    </View>
  )
}

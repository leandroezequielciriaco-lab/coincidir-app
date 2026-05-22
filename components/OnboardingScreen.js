import { useRouter } from 'expo-router'
import { ImageBackground, Pressable, View } from 'react-native'

import { styles } from './OnboardingScreen.styles'

const onboardingImage = require('../assets/images/onboarding-fullscreen.png')

export default function OnboardingScreen() {
  const router = useRouter()

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
          style={styles.loginButtonHitArea}
        />
      </ImageBackground>
    </View>
  )
}

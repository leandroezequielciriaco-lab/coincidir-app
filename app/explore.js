import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

export default function Explore() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Actividades</Text>
      <Text style={styles.subtitle}>
        Acá vas a poder descubrir encuentros y personas cerca tuyo.
      </Text>

      <Pressable style={styles.button} onPress={() => router.back()}>
        <Text style={styles.buttonText}>Volver</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8F1',
    padding: 28,
  },
  title: {
    color: '#123F38',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 10,
  },
  subtitle: {
    maxWidth: 340,
    color: '#244942',
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 28,
  },
  button: {
    minWidth: 160,
    alignItems: 'center',
    backgroundColor: '#155C47',
    borderRadius: 999,
    paddingHorizontal: 34,
    paddingVertical: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
})

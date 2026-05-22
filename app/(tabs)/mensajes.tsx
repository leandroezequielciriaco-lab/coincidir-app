import { StyleSheet, Text, View } from 'react-native'

export default function MensajesScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Mensajes</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: '#F8F5EF',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#10231F',
    fontSize: 28,
    fontWeight: '900',
  },
})

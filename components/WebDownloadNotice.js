import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native'

const DOWNLOAD_URL = 'https://coincidir.web.app/descargar'

export default function WebDownloadNotice({ visible = true }) {
  if (Platform.OS !== 'web' || !visible) return null

  const openDownload = () => {
    Linking.openURL(DOWNLOAD_URL).catch((error) => {
      console.warn('[WEB DOWNLOAD NOTICE OPEN ERROR]', error)
    })
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.notice}>
        <Text style={styles.text}>
          Estás usando Coincidir desde la web. Para una mejor experiencia en Android,{' '}
          <Text
            accessibilityRole="link"
            onPress={openDownload}
            style={styles.link}
          >
            descargá la app
          </Text>
          .
        </Text>
        <Pressable
          accessibilityLabel="Descargar Coincidir para Android"
          accessibilityRole="link"
          onPress={openDownload}
          style={styles.action}
        >
          <Text style={styles.actionText}>Google Play</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: '#FCFAF3',
    borderBottomColor: '#E5E9E1',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 20,
  },
  notice: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    maxWidth: 980,
    width: '100%',
  },
  text: {
    color: '#334943',
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
    textAlign: 'center',
  },
  link: {
    color: '#0E5A44',
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
  action: {
    alignItems: 'center',
    backgroundColor: '#EEF6EA',
    borderColor: '#D6E7D0',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 12,
  },
  actionText: {
    color: '#0E5A44',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
  },
})

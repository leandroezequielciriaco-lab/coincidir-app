import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ArrowUpCircle, ExternalLink } from 'lucide-react-native'

import { DEFAULT_PLAY_STORE_URL } from '../utils/appUpdate'

function getTitle(updateType) {
  return updateType === 'required'
    ? 'Actualización obligatoria'
    : 'Actualización disponible'
}

function getFallbackMessage(updateType) {
  return updateType === 'required'
    ? 'Para seguir usando COINCIDIR necesitás instalar la última versión.'
    : 'Hay una nueva versión de COINCIDIR disponible.'
}

export function AppUpdateModal({ onLater, updateState }) {
  if (!updateState) return null

  const { config, updateType } = updateState
  const isRequired = updateType === 'required'
  const releaseNotes = config?.releaseNotes ?? []
  const playStoreUrl = config?.playStoreUrl || DEFAULT_PLAY_STORE_URL

  const openStore = () => {
    Linking.openURL(playStoreUrl).catch((error) => {
      if (__DEV__) console.warn('[APP UPDATE OPEN STORE ERROR]', error)
    })
  }
  const requestClose = () => {
    if (!isRequired) onLater?.()
  }

  console.log('[APP UPDATE MODAL] nuevo botón renderizado')

  return (
    <Modal
      animationType="fade"
      onRequestClose={requestClose}
      transparent
      visible
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={releaseNotes.length > 4}
            style={styles.scrollArea}
          >
            <View style={styles.iconWrap}>
              <ArrowUpCircle color="#006A32" size={34} strokeWidth={2.5} />
            </View>
            <Text style={styles.title}>{getTitle(updateType)}</Text>
            <Text style={styles.message}>
              {config?.message || getFallbackMessage(updateType)}
            </Text>

            {releaseNotes.length > 0 ? (
              <View style={styles.notes}>
                {releaseNotes.map((note, index) => (
                  <View key={`${note}:${index}`} style={styles.noteRow}>
                    <View style={styles.noteDot} />
                    <Text style={styles.noteText}>{note}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View
            style={{
              backgroundColor: '#006A32',
              borderRadius: 8,
              marginTop: 30,
              minHeight: 48,
              overflow: 'hidden',
              width: '100%',
            }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={openStore}
              style={({ pressed }) => ({
                alignItems: 'center',
                alignSelf: 'stretch',
                backgroundColor: pressed ? 'rgba(0,0,0,0.12)' : 'transparent',
                flexDirection: 'row',
                gap: 8,
                justifyContent: 'center',
                minHeight: 48,
                paddingHorizontal: 16,
                width: '100%',
              })}
            >
              <ExternalLink color="#FFFFFF" size={18} strokeWidth={2.5} />
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '900',
                  letterSpacing: 0,
                }}
              >
                Actualizar
              </Text>
            </Pressable>
          </View>

          {!isRequired ? (
            <Pressable
              accessibilityRole="button"
              onPress={onLater}
              style={({ pressed }) => [
                styles.laterButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.laterButtonText}>Más tarde</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 18, 14, 0.56)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFCF5',
    borderColor: '#DDE8DE',
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: '88%',
    maxWidth: 420,
    padding: 22,
    width: '100%',
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 2,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: '#EAF6EC',
    borderRadius: 8,
    height: 54,
    justifyContent: 'center',
    marginBottom: 16,
    width: 54,
  },
  title: {
    color: '#183F35',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 10,
  },
  message: {
    color: '#42564E',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 21,
  },
  notes: {
    gap: 10,
    marginTop: 16,
  },
  noteRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 9,
  },
  noteDot: {
    backgroundColor: '#006A32',
    borderRadius: 3,
    height: 6,
    marginTop: 7,
    width: 6,
  },
  noteText: {
    color: '#29483F',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
  },
  laterButton: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  laterButtonText: {
    color: '#4B348A',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  buttonPressed: {
    opacity: 0.82,
  },
})

import { Pressable, StyleSheet, Text, View } from 'react-native'

type LegalDocumentFooterProps = {
  bottomPadding?: number
  disabled?: boolean
  hasReachedEnd: boolean
  onPress: () => void
}

export function LegalDocumentFooter({
  bottomPadding = 48,
  disabled = false,
  hasReachedEnd,
  onPress,
}: LegalDocumentFooterProps) {
  return (
    <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
      <View style={styles.separator} />
      <Pressable
        accessibilityLabel="Entendido"
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          hasReachedEnd ? styles.buttonEnabled : styles.buttonDisabled,
          pressed && hasReachedEnd && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.buttonText, hasReachedEnd ? styles.buttonTextEnabled : styles.buttonTextDisabled]}>
          Entendido
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  footer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  separator: {
    alignSelf: 'stretch',
    backgroundColor: '#E7E7E1',
    height: 1,
    marginBottom: 22,
    marginTop: 2,
  },
  button: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 168,
    paddingHorizontal: 26,
  },
  buttonEnabled: {
    backgroundColor: '#064E3B',
    borderColor: '#064E3B',
  },
  buttonDisabled: {
    backgroundColor: '#F6F3EA',
    borderColor: '#CFE3C2',
  },
  buttonPressed: {
    backgroundColor: '#063C31',
    borderColor: '#063C31',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 22,
  },
  buttonTextEnabled: {
    color: '#064E3B',
  },
  buttonTextDisabled: {
    color: '#FFFFFF',
  },
})

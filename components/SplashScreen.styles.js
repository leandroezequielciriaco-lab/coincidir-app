import { Platform, StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F4F4',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 34,
    paddingVertical: 40,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 34px rgba(13, 47, 54, 0.11)',
      },
      default: {
        shadowColor: '#0D2F36',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.11,
        shadowRadius: 34,
        elevation: 8,
      },
    }),
  },
})

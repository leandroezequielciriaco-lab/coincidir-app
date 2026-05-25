import { Platform, StyleSheet } from 'react-native'

export const logoStyles = StyleSheet.create({
  logo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactLogo: {
    marginBottom: 0,
  },
  logoFrame: {
    alignItems: 'center',
    backgroundColor: '#FCFAF3',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 18px rgba(14, 90, 68, 0.12)',
      },
      default: {
        shadowColor: '#0E5A44',
        shadowOffset: { width: 0, height: 7 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 3,
      },
    }),
  },
  officialLogo: {
    flexShrink: 0,
  },
})

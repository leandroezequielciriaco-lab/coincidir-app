import { StyleSheet } from 'react-native'

export const logoStyles = StyleSheet.create({
  logo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'transparent',
  },
  leftRing: {
    borderColor: 'rgba(115, 207, 174, 0.82)',
    left: 0,
    zIndex: 1,
  },
  rightRing: {
    borderColor: 'rgba(0, 97, 107, 0.9)',
    zIndex: 2,
  },
  cutout: {
    position: 'absolute',
  },
  brand: {
    color: '#005461',
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
})

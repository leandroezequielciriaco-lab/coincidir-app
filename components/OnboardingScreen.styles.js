import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF8F1',
  },
  webScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  imageFrame: {
    flex: 1,
    width: '100%',
  },
  webImageFrame: {
    aspectRatio: 390 / 844,
    borderRadius: 28,
    flex: 0,
    maxHeight: '100%',
    maxWidth: 420,
    overflow: 'hidden',
    width: '100%',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  startButtonHitArea: {
    position: 'absolute',
    left: '13%',
    right: '13%',
    top: '80%',
    height: '7%',
  },
  loginButtonHitArea: {
    position: 'absolute',
    left: '25%',
    right: '25%',
    top: '88%',
    height: '5%',
  },
})

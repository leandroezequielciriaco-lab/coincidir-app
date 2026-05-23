import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF8F1',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  keyboardLayer: {
    flex: 1,
  },
  backHitArea: {
    position: 'absolute',
    left: '5%',
    top: '4%',
    width: '12%',
    height: '6%',
  },
  inputShell: {
    position: 'absolute',
    left: '22%',
    right: '14%',
    height: '5.4%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#123F38',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0,
    includeFontPadding: false,
    paddingHorizontal: 0,
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    textAlignVertical: 'center',
  },
  filledInput: {
    backgroundColor: '#FAF7F4',
  },
  emailInputShell: {
    top: '41.1%',
  },
  passwordInputShell: {
    top: '48.1%',
    right: '21%',
  },
  eyeHitArea: {
    position: 'absolute',
    right: '10%',
    top: '48.1%',
    width: '10%',
    height: '5.4%',
  },
  forgotPasswordHitArea: {
    position: 'absolute',
    right: '10%',
    top: '53.8%',
    width: '40%',
    height: '4%',
  },
  errorText: {
    position: 'absolute',
    left: '11%',
    right: '11%',
    top: '57.2%',
    color: '#B42318',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    textAlign: 'center',
  },
  submitHitArea: {
    position: 'absolute',
    left: '11%',
    right: '10%',
    top: '59.7%',
    height: '7%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialHitArea: {
    position: 'absolute',
    top: '68.7%',
    width: '13.2%',
    height: '6.3%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleHitArea: {
    left: '25.8%',
  },
  appleHitArea: {
    left: '43.1%',
  },
  facebookHitArea: {
    left: '60.4%',
  },
  createAccountHitArea: {
    position: 'absolute',
    left: '23%',
    right: '23%',
    top: '79%',
    height: '5%',
  },
})

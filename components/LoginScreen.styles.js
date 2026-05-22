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
  input: {
    position: 'absolute',
    left: '22%',
    right: '14%',
    color: '#123F38',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0,
    padding: 0,
  },
  emailInput: {
    top: '41.1%',
    height: '5.4%',
  },
  passwordInput: {
    top: '48.1%',
    height: '5.4%',
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
  createAccountHitArea: {
    position: 'absolute',
    left: '23%',
    right: '23%',
    top: '79%',
    height: '5%',
  },
})

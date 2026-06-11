import { Alert } from 'react-native'
import type { Auth, User } from 'firebase/auth'
import { sendEmailVerification } from 'firebase/auth'

export const EMAIL_VERIFICATION_SENT_MESSAGE =
  'Te enviamos un correo de verificación. Confirmá tu email para poder participar en COINCIDIR.'

export const EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  'Para participar en COINCIDIR necesitás verificar tu email. Revisá tu correo y volvé a intentarlo.'

export function isGoogleUser(user: User | null | undefined) {
  return Boolean(user?.providerData?.some((provider) => provider.providerId === 'google.com'))
}

export function isEmailVerifiedUser(user: User | null | undefined) {
  return Boolean(user?.emailVerified)
}

export function canParticipate(user: User | null | undefined) {
  if (!user) return false
  if (isGoogleUser(user)) return true
  return isEmailVerifiedUser(user)
}

export async function reloadAuthUser(user: User | null | undefined) {
  if (!user) return null
  await user.reload()
  return user
}

export function showEmailVerificationRequiredAlert() {
  Alert.alert('Verificá tu email', EMAIL_VERIFICATION_REQUIRED_MESSAGE)
}

export async function requireVerifiedParticipation(auth: Auth) {
  const user = auth.currentUser
  if (!user) return false

  try {
    await reloadAuthUser(user)
  } catch {
    // If reload fails, use the currently available Auth state.
  }

  if (canParticipate(auth.currentUser)) return true

  showEmailVerificationRequiredAlert()
  return false
}

export async function resendEmailVerification(auth: Auth) {
  const user = auth.currentUser
  if (!user) return false

  try {
    await reloadAuthUser(user)
  } catch {
    // Sending the verification email can still work with the current user.
  }

  if (canParticipate(auth.currentUser)) {
    Alert.alert('Email verificado', 'Tu email ya está verificado.')
    return true
  }

  await sendEmailVerification(user)
  Alert.alert('Correo enviado', EMAIL_VERIFICATION_SENT_MESSAGE)
  return true
}

import { Alert } from 'react-native'
import type { Auth, User } from 'firebase/auth'
import { sendEmailVerification } from 'firebase/auth'

type FirebaseAuthLikeError = {
  code?: string
  message?: string
}

export const EMAIL_VERIFICATION_SENT_MESSAGE =
  'Te enviamos un nuevo correo de verificación. Revisá spam o promociones.'

export const EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  'Para participar en COINCIDIR necesitás verificar tu email. Revisá tu correo y volvé a intentarlo.'

export const EMAIL_VERIFICATION_TOO_MANY_REQUESTS_MESSAGE =
  'Firebase bloqueó temporalmente los reenvíos. Probá de nuevo más tarde.'

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

export function getEmailVerificationErrorMessage(error: unknown) {
  const code = (error as FirebaseAuthLikeError)?.code

  if (code === 'auth/too-many-requests') {
    return EMAIL_VERIFICATION_TOO_MANY_REQUESTS_MESSAGE
  }

  return 'No pudimos reenviar el correo. Intentá nuevamente en unos segundos.'
}

export async function resendEmailVerification(auth: Auth) {
  const user = auth.currentUser
  if (!user) return false

  try {
    console.log('[EMAIL VERIFY RESEND START]', {
      userId: user.uid,
      email: user.email ?? null,
    })

    await reloadAuthUser(user)
  } catch (error) {
    const reloadError = error as FirebaseAuthLikeError
    console.warn('[EMAIL VERIFY RESEND ERROR]', {
      userId: user.uid,
      email: user.email ?? null,
      errorCode: reloadError?.code,
      errorMessage: reloadError?.message,
      stage: 'reload',
    })
    // Sending the verification email can still work with the current user.
  }

  if (canParticipate(auth.currentUser)) {
    Alert.alert('Email verificado', 'Tu email ya está verificado.')
    return true
  }

  try {
    const targetUser = auth.currentUser ?? user
    await sendEmailVerification(targetUser)
    console.log('[EMAIL VERIFY RESEND SUCCESS]', {
      userId: targetUser.uid,
      email: targetUser.email ?? null,
    })
    Alert.alert('Correo enviado', EMAIL_VERIFICATION_SENT_MESSAGE)
    return true
  } catch (error) {
    const sendError = error as FirebaseAuthLikeError
    console.warn('[EMAIL VERIFY RESEND ERROR]', {
      userId: auth.currentUser?.uid ?? user.uid,
      email: auth.currentUser?.email ?? user.email ?? null,
      errorCode: sendError?.code,
      errorMessage: sendError?.message,
      stage: 'send',
    })
    throw error
  }
}

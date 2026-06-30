import { Stack, usePathname, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import '../global.css'
import { getFirebaseServices } from '../firebaseConfig'
import { AuthContext } from '../utils/authContext'
import { consumePendingExternalReturnRoute } from '../utils/externalReturnRoute'
import { getJsInstanceId } from '../utils/jsInstance'
import { canParticipate, isGoogleUser, reloadAuthUser } from '../utils/authParticipation'
import { hasAcceptedCurrentLegal } from '../constants/legal'

const PUBLIC_ROUTES = new Set([
  '/',
  '/forgot-password',
  '/delete-account',
  '/child-safety',
  '/legal/privacy',
  '/legal/terms',
  '/login',
  '/onboarding',
  '/register',
  '/verify-email',
])

const EMAIL_VERIFICATION_BLOCKED_EXACT_ROUTES = new Set([
  '/(tabs)',
  '/(tabs)/crear',
  '/(tabs)/explorar',
  '/(tabs)/home',
  '/(tabs)/mensajes',
  '/(tabs)/perfil',
  '/crear',
  '/explorar',
  '/home',
  '/mensajes',
  '/notificaciones',
  '/perfil',
])

const EMAIL_VERIFICATION_BLOCKED_PREFIXES = [
  '/activity/',
  '/chat/',
  '/group/',
]

const ANDROID_NOTIFICATION_CHANNEL_ID = 'coincidir-default'

async function configureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return

  const Notifications = await import('expo-notifications')

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })

  await Notifications.setNotificationChannelAsync(ANDROID_NOTIFICATION_CHANNEL_ID, {
    name: 'COINCIDIR',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  })
}

function requiresEmailVerification(user) {
  if (!user) return false
  if (isGoogleUser(user)) return false

  const usesPasswordProvider = user.providerData?.some((provider) => provider.providerId === 'password')
  return Boolean(usesPasswordProvider && !canParticipate(user))
}

function isEmailVerificationBlockedRoute(pathname) {
  if (EMAIL_VERIFICATION_BLOCKED_EXACT_ROUTES.has(pathname)) return true
  return EMAIL_VERIFICATION_BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export default function RootLayout() {
  const pathname = usePathname()
  const router = useRouter()
  const [authState, setAuthState] = useState({ checked: false, user: null })
  const [legalState, setLegalState] = useState({ checked: true, hasAccepted: false, userId: null })
  const instanceId = getJsInstanceId()
  const externalRouteRestoreAttemptedRef = useRef(false)
  const lastAuthenticatedAtRef = useRef(0)
  const redirectTimerRef = useRef(null)

  useEffect(() => {
    console.log('[ROOT MOUNT]', { instanceId })

    return () => {
      console.log('[ROOT UNMOUNT]', { instanceId })
    }
  }, [instanceId])

  useEffect(() => {
    console.log('[ROUTE CURRENT]', { instanceId, pathname })
  }, [instanceId, pathname])

  useEffect(() => {
    configureAndroidNotificationChannel().catch((error) => {
      if (__DEV__) console.warn('[NOTIFICATION CHANNEL SETUP ERROR]', error)
    })
  }, [])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      console.log('[APPSTATE CHANGE]', { instanceId, state: nextState })
    })

    return () => {
      subscription.remove()
    }
  }, [instanceId])

  useEffect(() => {
    try {
      console.log('[AUTH RESTORE START]', { screen: 'root' })
      const { auth } = getFirebaseServices()
      return onAuthStateChanged(auth, async (user) => {
        if (user) {
          lastAuthenticatedAtRef.current = Date.now()
          try {
            await reloadAuthUser(user)
          } catch (error) {
            if (__DEV__) console.warn('[AUTH RELOAD ERROR]', error)
          }
        }
        console.log(user ? '[AUTH RESTORE USER]' : '[AUTH RESTORE NULL]', {
          screen: 'root',
          uid: user?.uid ?? null,
        })
        console.log(user ? '[AUTH USER]' : '[AUTH NULL]', {
          instanceId,
          screen: 'root',
          uid: user?.uid ?? null,
        })
        setAuthState({ checked: true, user })
      })
    } catch (error) {
      console.error('[AUTH RESTORE ERROR]', error)
      setAuthState({ checked: true, user: null })
      return undefined
    }
  }, [instanceId])

  useEffect(() => {
    if (!authState.checked) {
      setLegalState({ checked: false, hasAccepted: false, userId: null })
      return undefined
    }

    if (!authState.user) {
      setLegalState({ checked: true, hasAccepted: false, userId: null })
      return undefined
    }

    const userId = authState.user.uid
    setLegalState((current) => {
      if (current.userId === userId && current.checked) return current
      return { checked: false, hasAccepted: false, userId }
    })

    try {
      const { db } = getFirebaseServices()
      return onSnapshot(
        doc(db, 'users', userId),
        (profileSnap) => {
          const profile = profileSnap.exists() ? profileSnap.data() : null
          const hasAccepted = hasAcceptedCurrentLegal(profile)

          setLegalState({ checked: true, hasAccepted, userId })
        },
        () => {
          setLegalState({ checked: true, hasAccepted: false, userId })
        },
      )
    } catch {
      setLegalState({ checked: true, hasAccepted: false, userId })
      return undefined
    }
  }, [authState.checked, authState.user, instanceId])

  useEffect(() => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current)
      redirectTimerRef.current = null
    }

    const authLoading = !authState.checked
    const isPublicRoute = PUBLIC_ROUTES.has(pathname)
    const needsEmailVerification = requiresEmailVerification(authState.user)
    const isVerificationBlockedRoute = isEmailVerificationBlockedRoute(pathname)
    const legalLoading = Boolean(
      authState.user &&
      (!legalState.checked || legalState.userId !== authState.user.uid)
    )
    const needsLegalAcceptance = Boolean(
      authState.user &&
      legalState.checked &&
      legalState.userId === authState.user.uid &&
      !legalState.hasAccepted
    )

    console.log('[ROUTE GUARD DECISION]', {
      pathname,
      authLoading,
      userId: authState.user?.uid ?? null,
      isPublicRoute,
      legalLoading,
      needsLegalAcceptance,
      needsEmailVerification,
      isVerificationBlockedRoute,
    })

    if (authLoading) {
      console.log('[ROUTE GUARD REDIRECT BLOCKED AUTH LOADING]', { path: pathname })
      return
    }

    if (authState.user) {
      if (legalLoading) {
        return
      }

      if (needsLegalAcceptance) {
        if (!isPublicRoute) {
          router.replace({ pathname: '/login', params: { legalRequired: '1' } })
          return
        }

        return
      }

      if (needsEmailVerification) {
        if (isVerificationBlockedRoute) {
          console.log('[VERIFY EMAIL GUARD]', {
            from: pathname,
            to: '/verify-email',
            userId: authState.user.uid,
          })
          router.replace('/verify-email')
          return
        }

        console.log('[ROUTE GUARD KEEP CURRENT]', {
          path: pathname,
          reason: 'authenticated_needs_email_verification',
        })
        return
      }

      if (pathname === '/verify-email') {
        console.log('[VERIFY EMAIL GUARD]', {
          from: pathname,
          to: '/home',
          reason: 'verified_or_google',
          userId: authState.user.uid,
        })
        router.replace('/home')
        return
      }

      if (!externalRouteRestoreAttemptedRef.current) {
        externalRouteRestoreAttemptedRef.current = true
        consumePendingExternalReturnRoute()
          .then((pendingRoute) => {
            if (!pendingRoute) return

            console.log('[ROUTE GUARD RESTORE EXTERNAL]', {
              instanceId,
              route: pendingRoute,
            })
            router.replace({
              pathname: pendingRoute.pathname,
              params: pendingRoute.params ?? {},
            })
          })
          .catch((error) => {
            console.error('[ROUTE GUARD RESTORE EXTERNAL ERROR]', error)
          })
      }

      console.log('[ROUTE GUARD KEEP CURRENT]', {
        path: pathname,
        reason: 'authenticated',
      })
      return
    }

    if (pathname === '/') {
      console.log('[ROUTE GUARD REDIRECT]', { from: pathname, to: '/onboarding', reason: 'root_without_user' })
      router.replace('/onboarding')
      return
    }

    if (!isPublicRoute) {
      const elapsedSinceUser = Date.now() - lastAuthenticatedAtRef.current
      const redirectToLogin = () => {
        try {
          const { auth } = getFirebaseServices()
          if (auth.currentUser) {
            console.log('[ROUTE GUARD REDIRECT CANCELLED]', {
              path: pathname,
              reason: 'auth_current_user_restored',
              uid: auth.currentUser.uid,
            })
            setAuthState({ checked: true, user: auth.currentUser })
            return
          }
        } catch (error) {
          console.error('[ROUTE GUARD AUTH CHECK ERROR]', error)
        }

        console.log('[ROUTE GUARD REDIRECT]', { from: pathname, to: '/login' })
        router.replace('/login')
      }

      if (elapsedSinceUser >= 0 && elapsedSinceUser < 1500) {
        console.log('[ROUTE GUARD REDIRECT DELAYED AFTER USER]', {
          path: pathname,
          elapsedSinceUser,
        })
        redirectTimerRef.current = setTimeout(redirectToLogin, 1500 - elapsedSinceUser)
        return
      }

      redirectToLogin()
      return
    }

    console.log('[ROUTE GUARD KEEP CURRENT]', {
      path: pathname,
      reason: 'public_route_without_user',
    })

    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current)
        redirectTimerRef.current = null
      }
    }
  }, [authState.checked, authState.user, instanceId, legalState, pathname, router])

  return (
    <AuthContext.Provider value={authState}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </SafeAreaProvider>
    </AuthContext.Provider>
  )
}

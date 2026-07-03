import { Stack, usePathname, useRouter } from 'expo-router'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import '../global.css'
import { getFirebaseServices } from '../firebaseConfig'
import { AuthContext } from '../utils/authContext'
import { consumePendingExternalReturnRoute } from '../utils/externalReturnRoute'
import { getJsInstanceId } from '../utils/jsInstance'
import { canParticipate, isGoogleUser, reloadAuthUser } from '../utils/authParticipation'
import { getLegalAcceptanceFields, hasAcceptedCurrentLegal } from '../constants/legal'

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
const PUSH_PERMISSION_REQUESTED_KEY_PREFIX = '@coincidir:push-permission-requested:'

function readNotificationDataString(data, key) {
  const value = data?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function getNotificationActivityRoute(response) {
  const data = response?.notification?.request?.content?.data
  const type = readNotificationDataString(data, 'type')
  const chatId = readNotificationDataString(data, 'chatId')
  const chatType = readNotificationDataString(data, 'chatType')

  if (type === 'message' && chatId) {
    return {
      chatId,
      chatType: chatType === 'group' ? 'group' : 'activity',
      key: readNotificationDataString(data, 'notificationId') || `message:${chatId}`,
      type: 'message',
    }
  }

  const activityId = readNotificationDataString(data, 'activityId')
  if (!activityId) return null

  return {
    activityId,
    key: readNotificationDataString(data, 'notificationId') || activityId,
    type: 'activity',
  }
}

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

function getExpoProjectId() {
  return Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId
}

async function hasRequestedAndroidPushPermission(userId) {
  try {
    return await AsyncStorage.getItem(`${PUSH_PERMISSION_REQUESTED_KEY_PREFIX}${userId}`) === '1'
  } catch (error) {
    if (__DEV__) console.warn('[PUSH PERMISSION STORAGE READ ERROR]', error)
    return false
  }
}

async function markAndroidPushPermissionRequested(userId) {
  try {
    await AsyncStorage.setItem(`${PUSH_PERMISSION_REQUESTED_KEY_PREFIX}${userId}`, '1')
  } catch (error) {
    if (__DEV__) console.warn('[PUSH PERMISSION STORAGE WRITE ERROR]', error)
  }
}

async function registerAndroidExpoPushToken(userId) {
  if (Platform.OS !== 'android' || !userId) return

  try {
    await configureAndroidNotificationChannel()

    const Notifications = await import('expo-notifications')
    const permissions = await Notifications.getPermissionsAsync()
    let finalStatus = permissions.status

    if (finalStatus !== 'granted') {
      const alreadyRequested = await hasRequestedAndroidPushPermission(userId)
      if (alreadyRequested || permissions.canAskAgain === false) {
        if (__DEV__) console.warn('[PUSH TOKEN REGISTRATION SKIPPED]', { reason: 'permission-denied' })
        return
      }

      const requestedPermissions = await Notifications.requestPermissionsAsync()
      await markAndroidPushPermissionRequested(userId)
      finalStatus = requestedPermissions.status
    }

    if (finalStatus !== 'granted') {
      if (__DEV__) console.warn('[PUSH TOKEN REGISTRATION SKIPPED]', { reason: 'permission-denied' })
      return
    }

    const projectId = getExpoProjectId()
    if (!projectId) {
      if (__DEV__) console.warn('[PUSH TOKEN REGISTRATION SKIPPED]', { reason: 'missing-expo-project-id' })
      return
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId })
    const expoPushToken = tokenResponse?.data

    if (!expoPushToken) {
      if (__DEV__) console.warn('[PUSH TOKEN REGISTRATION SKIPPED]', { reason: 'missing-token-response' })
      return
    }

    const { db } = getFirebaseServices()
    await setDoc(
      doc(db, 'users', userId),
      {
        pushTokens: {
          expo: expoPushToken,
          platform: 'android',
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true },
    )
  } catch (error) {
    if (__DEV__) console.warn('[PUSH TOKEN REGISTRATION ERROR]', error)
  }
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
  const [legalState, setLegalState] = useState({ checked: false, hasAccepted: false, resolved: false, userId: null })
  const [isAcceptingLegal, setIsAcceptingLegal] = useState(false)
  const [legalAcceptanceError, setLegalAcceptanceError] = useState('')
  const [pendingNotificationRouteVersion, setPendingNotificationRouteVersion] = useState(0)
  const instanceId = getJsInstanceId()
  const externalRouteRestoreAttemptedRef = useRef(false)
  const lastAuthenticatedAtRef = useRef(0)
  const redirectTimerRef = useRef(null)
  const authNullResolutionTimerRef = useRef(null)
  const pushTokenRegistrationAttemptedRef = useRef(new Set())
  const pendingNotificationRouteRef = useRef(null)
  const processedNotificationRouteKeysRef = useRef(new Set())
  const legalLoading = Boolean(
    authState.user &&
    (!legalState.resolved || legalState.userId !== authState.user.uid)
  )
  const needsLegalAcceptance = Boolean(
    authState.user &&
    legalState.resolved &&
    legalState.userId === authState.user.uid &&
    !legalState.hasAccepted
  )
  const isLegalDocumentRoute = pathname === '/legal/terms' || pathname === '/legal/privacy'
  const shouldShowLegalGate = legalState.resolved && !legalLoading && needsLegalAcceptance && !isLegalDocumentRoute

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
    let isMounted = true
    let subscription
    let receivedSubscription

    const queueNotificationRoute = (response) => {
      const data = response?.notification?.request?.content?.data
      if (readNotificationDataString(data, 'type') === 'message') {
        console.log('[NOTIF MESSAGE RESPONSE]', {
          chatId: readNotificationDataString(data, 'chatId') || null,
          chatType: readNotificationDataString(data, 'chatType') || null,
          notificationId: readNotificationDataString(data, 'notificationId') || null,
        })
      }

      const route = getNotificationActivityRoute(response)
      if (!route) return
      if (processedNotificationRouteKeysRef.current.has(route.key)) return

      processedNotificationRouteKeysRef.current.add(route.key)
      pendingNotificationRouteRef.current = route
      setPendingNotificationRouteVersion((current) => current + 1)
    }

    import('expo-notifications')
      .then((Notifications) => {
        if (!isMounted) return

        receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
          const data = notification?.request?.content?.data
          if (readNotificationDataString(data, 'type') !== 'message') return

          console.log('[NOTIF MESSAGE RECEIVED]', {
            chatId: readNotificationDataString(data, 'chatId') || null,
            chatType: readNotificationDataString(data, 'chatType') || null,
            notificationId: readNotificationDataString(data, 'notificationId') || null,
          })
        })

        subscription = Notifications.addNotificationResponseReceivedListener(queueNotificationRoute)

        Notifications.getLastNotificationResponseAsync()
          .then((response) => {
            if (!isMounted || !response) return
            queueNotificationRoute(response)
          })
          .catch((error) => {
            if (__DEV__) console.warn('[NOTIFICATION LAST RESPONSE ERROR]', error)
          })
      })
      .catch((error) => {
        if (__DEV__) console.warn('[NOTIFICATION RESPONSE LISTENER ERROR]', error)
      })

    return () => {
      isMounted = false
      receivedSubscription?.remove()
      subscription?.remove()
    }
  }, [])

  useEffect(() => {
    if (!authState.checked || !authState.user) return

    const userId = authState.user.uid
    if (pushTokenRegistrationAttemptedRef.current.has(userId)) return

    pushTokenRegistrationAttemptedRef.current.add(userId)
    registerAndroidExpoPushToken(userId)
  }, [authState.checked, authState.user])

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
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (authNullResolutionTimerRef.current) {
          clearTimeout(authNullResolutionTimerRef.current)
          authNullResolutionTimerRef.current = null
        }

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
        if (user) {
          setAuthState({ checked: true, user })
          return
        }

        setAuthState((current) => (
          current.user
            ? { checked: false, user: current.user }
            : { checked: true, user: null }
        ))

        authNullResolutionTimerRef.current = setTimeout(() => {
          authNullResolutionTimerRef.current = null
          const restoredUser = auth.currentUser

          if (restoredUser) {
            lastAuthenticatedAtRef.current = Date.now()
            setAuthState({ checked: true, user: restoredUser })
            return
          }

          setAuthState({ checked: true, user: null })
        }, 1500)
      })

      return () => {
        if (authNullResolutionTimerRef.current) {
          clearTimeout(authNullResolutionTimerRef.current)
          authNullResolutionTimerRef.current = null
        }
        unsubscribe()
      }
    } catch (error) {
      console.error('[AUTH RESTORE ERROR]', error)
      setAuthState({ checked: true, user: null })
      return undefined
    }
  }, [instanceId])

  useEffect(() => {
    if (!authState.checked) {
      setLegalState({ checked: false, hasAccepted: false, resolved: false, userId: null })
      return undefined
    }

    if (!authState.user) {
      setLegalState({ checked: true, hasAccepted: false, resolved: true, userId: null })
      return undefined
    }

    const userId = authState.user.uid
    setLegalState({
      checked: false,
      hasAccepted: false,
      resolved: false,
      userId,
    })

    try {
      const { db } = getFirebaseServices()
      return onSnapshot(
        doc(db, 'users', userId),
        { includeMetadataChanges: true },
        (profileSnap) => {
          const profile = profileSnap.exists() ? profileSnap.data() : null
          const hasAccepted = hasAcceptedCurrentLegal(profile)
          const fromCache = profileSnap.metadata.fromCache
          const hasPendingWrites = profileSnap.metadata.hasPendingWrites

          if (fromCache || hasPendingWrites) {
            setLegalState({ checked: false, hasAccepted: false, resolved: false, userId })
            return
          }

          setLegalState({ checked: true, hasAccepted, resolved: true, userId })
        },
        () => {
          setLegalState({ checked: false, hasAccepted: false, resolved: false, userId })
        },
      )
    } catch {
      setLegalState({ checked: false, hasAccepted: false, resolved: false, userId })
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
      (!legalState.resolved || legalState.userId !== authState.user.uid)
    )
    const needsLegalAcceptance = Boolean(
      authState.user &&
      legalState.resolved &&
      legalState.userId === authState.user.uid &&
      !legalState.hasAccepted
    )

    console.log('[ROUTE GUARD DECISION]', {
      pathname,
      authLoading,
      userId: authState.user?.uid ?? null,
      isPublicRoute,
      legalLoading,
      legalResolved: legalState.resolved,
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
        console.log('[ROUTE GUARD KEEP CURRENT]', {
          path: pathname,
          reason: 'authenticated_needs_legal_acceptance',
        })
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

  useEffect(() => {
    const pendingRoute = pendingNotificationRouteRef.current
    if (!pendingRoute) return

    const authLoading = !authState.checked
    const legalLoading = Boolean(
      authState.user &&
      (!legalState.resolved || legalState.userId !== authState.user.uid)
    )
    const needsLegalAcceptance = Boolean(
      authState.user &&
      legalState.resolved &&
      legalState.userId === authState.user.uid &&
      !legalState.hasAccepted
    )
    const needsEmailVerification = requiresEmailVerification(authState.user)

    if (authLoading || legalLoading || !authState.user || needsLegalAcceptance || needsEmailVerification) return

    pendingNotificationRouteRef.current = null
    if (pendingRoute.type === 'message') {
      console.log('[NOTIF OPEN CHAT]', {
        chatId: pendingRoute.chatId,
        chatType: pendingRoute.chatType,
      })
      router.push({
        pathname: '/chat/[chatId]',
        params: { chatId: pendingRoute.chatId, source: pendingRoute.chatType },
      })
      return
    }

    router.push({
      pathname: '/activity/[activityId]',
      params: { activityId: pendingRoute.activityId },
    })
  }, [authState.checked, authState.user, legalState, pathname, pendingNotificationRouteVersion, router])

  const acceptCurrentLegal = async () => {
    if (!authState.user || isAcceptingLegal) return

    setIsAcceptingLegal(true)
    setLegalAcceptanceError('')

    try {
      const { db } = getFirebaseServices()
      await setDoc(
        doc(db, 'users', authState.user.uid),
        getLegalAcceptanceFields(serverTimestamp()),
        { merge: true },
      )
    } catch (error) {
      console.error('[LEGAL ACCEPTANCE ERROR]', error)
      setLegalAcceptanceError('No pudimos guardar tu aceptacion. Intenta nuevamente.')
    } finally {
      setIsAcceptingLegal(false)
    }
  }

  return (
    <AuthContext.Provider value={authState}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
        <Modal animationType="fade" transparent visible={shouldShowLegalGate}>
          <View style={styles.legalGateBackdrop}>
            <View style={styles.legalGateCard}>
              <Text style={styles.legalGateTitle}>Terminos y privacidad</Text>
              <Text style={styles.legalGateBody}>
                Para continuar usando COINCIDIR, acepta los Terminos y Condiciones y la Politica de Privacidad vigentes.
              </Text>

              <View style={styles.legalGateLinks}>
                <Pressable
                  accessibilityLabel="Ver terminos y condiciones"
                  accessibilityRole="button"
                  onPress={() => router.push('/legal/terms')}
                  style={({ pressed }) => [styles.legalGateLink, pressed && styles.legalGatePressed]}
                >
                  <Text style={styles.legalGateLinkText}>Ver terminos</Text>
                </Pressable>

                <Pressable
                  accessibilityLabel="Ver politica de privacidad"
                  accessibilityRole="button"
                  onPress={() => router.push('/legal/privacy')}
                  style={({ pressed }) => [styles.legalGateLink, pressed && styles.legalGatePressed]}
                >
                  <Text style={styles.legalGateLinkText}>Ver privacidad</Text>
                </Pressable>
              </View>

              {legalAcceptanceError ? <Text style={styles.legalGateError}>{legalAcceptanceError}</Text> : null}

              <Pressable
                accessibilityLabel="Aceptar terminos y politica de privacidad"
                accessibilityRole="button"
                disabled={isAcceptingLegal || legalLoading}
                onPress={acceptCurrentLegal}
                style={({ pressed }) => [
                  styles.legalGateButton,
                  (pressed || isAcceptingLegal || legalLoading) && styles.legalGateButtonPressed,
                ]}
              >
                {isAcceptingLegal ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.legalGateButtonText}>Aceptar y continuar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaProvider>
    </AuthContext.Provider>
  )
}

const styles = StyleSheet.create({
  legalGateBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(6, 28, 24, 0.58)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  legalGateCard: {
    backgroundColor: '#FCFAF3',
    borderRadius: 8,
    maxWidth: 420,
    padding: 22,
    width: '100%',
  },
  legalGateTitle: {
    color: '#063C31',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 8,
  },
  legalGateBody: {
    color: '#37534B',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  legalGateLinks: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  legalGateLink: {
    borderColor: '#C9D8C8',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  legalGatePressed: {
    opacity: 0.75,
  },
  legalGateLinkText: {
    color: '#155C47',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  legalGateError: {
    color: '#B3261E',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  legalGateButton: {
    alignItems: 'center',
    backgroundColor: '#155C47',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  legalGateButtonPressed: {
    opacity: 0.82,
  },
  legalGateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
})

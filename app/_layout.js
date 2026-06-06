import { Stack, usePathname, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { onAuthStateChanged } from 'firebase/auth'
import '../global.css'
import { getFirebaseServices } from '../firebaseConfig'
import { consumePendingExternalReturnRoute } from '../utils/externalReturnRoute'
import { getJsInstanceId } from '../utils/jsInstance'

const PUBLIC_ROUTES = new Set([
  '/',
  '/forgot-password',
  '/login',
  '/onboarding',
  '/register',
])

export default function RootLayout() {
  const pathname = usePathname()
  const router = useRouter()
  const [authState, setAuthState] = useState({ checked: false, user: null })
  const instanceId = getJsInstanceId()
  const externalRouteRestoreAttemptedRef = useRef(false)

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
      return onAuthStateChanged(auth, (user) => {
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
      console.log('[ROUTE GUARD REDIRECT BLOCKED AUTH LOADING]', { path: pathname })
      return
    }

    if (authState.user) {
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

    const isPublicRoute = PUBLIC_ROUTES.has(pathname)
    if (!isPublicRoute) {
      console.log('[ROUTE GUARD REDIRECT]', { from: pathname, to: '/login' })
      router.replace('/login')
      return
    }

    console.log('[ROUTE GUARD KEEP CURRENT]', {
      path: pathname,
      reason: 'public_route_without_user',
    })
  }, [authState.checked, authState.user, instanceId, pathname, router])

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </SafeAreaProvider>
  )
}

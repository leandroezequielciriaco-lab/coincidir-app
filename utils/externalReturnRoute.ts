import AsyncStorage from '@react-native-async-storage/async-storage'

const EXTERNAL_RETURN_ROUTE_KEY = 'coincidir:external-return-route'
const MAX_ROUTE_AGE_MS = 10 * 60 * 1000

type PendingExternalReturnRoute = {
  params?: Record<string, string>
  pathname: string
  source: 'camera' | 'gallery' | 'googleMaps'
  timestamp: number
}

export async function savePendingExternalReturnRoute(route: Omit<PendingExternalReturnRoute, 'timestamp'>) {
  const payload: PendingExternalReturnRoute = {
    ...route,
    timestamp: Date.now(),
  }

  await AsyncStorage.setItem(EXTERNAL_RETURN_ROUTE_KEY, JSON.stringify(payload))
}

export async function consumePendingExternalReturnRoute() {
  const value = await AsyncStorage.getItem(EXTERNAL_RETURN_ROUTE_KEY)
  if (!value) return null

  await AsyncStorage.removeItem(EXTERNAL_RETURN_ROUTE_KEY)

  try {
    const route = JSON.parse(value) as PendingExternalReturnRoute
    if (!route?.pathname || Date.now() - route.timestamp > MAX_ROUTE_AGE_MS) return null

    return route
  } catch {
    return null
  }
}

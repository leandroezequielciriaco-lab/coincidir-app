import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'
import * as Application from 'expo-application'
import { doc, getDoc } from 'firebase/firestore'

import { getFirebaseServices } from '../firebaseConfig'

export const DEFAULT_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.leandroezequielciriaco.coincidir'
const FIRESTORE_RETRY_DELAY_MS = 3000

function readString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function warnInvalidRemoteType(field, value, expectedType) {
  if (typeof value === 'undefined') return
  console.warn('[APP UPDATE CONFIG TYPE ERROR]', {
    field,
    receivedType: Array.isArray(value) ? 'array' : typeof value,
    value,
    expectedType,
  })
}

function readRemoteBoolean(data, field, fallback = false) {
  const value = data?.[field]
  if (typeof value === 'boolean') return value

  warnInvalidRemoteType(field, value, 'boolean')
  return fallback
}

function readRemoteNumber(data, field, fallback = 0) {
  const value = data?.[field]
  if (typeof value === 'number' && Number.isFinite(value)) return value

  warnInvalidRemoteType(field, value, 'number')
  return fallback
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function readStringList(value) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => readString(item))
    .filter(Boolean)
}

export function getInstalledAndroidVersionCode() {
  if (Platform.OS !== 'android') return null

  const buildVersion = readString(Application.nativeBuildVersion)
  const parsed = Number.parseInt(buildVersion, 10)

  return Number.isFinite(parsed) ? parsed : null
}

export function compareAppVersion(installedVersionCode, config) {
  if (!config?.enabled || typeof installedVersionCode !== 'number') return null

  const minimumVersionCode = readNumber(config.minimumVersionCode, 0)
  const latestVersionCode = readNumber(config.latestVersionCode, 0)

  if (config.forceUpdate === true && latestVersionCode > 0 && installedVersionCode < latestVersionCode) {
    return 'required'
  }

  if (minimumVersionCode > 0 && installedVersionCode < minimumVersionCode) {
    return 'required'
  }

  if (latestVersionCode > 0 && installedVersionCode < latestVersionCode) {
    return 'recommended'
  }

  return null
}

function getAppUpdateDecisionReason(installedVersionCode, config, updateType) {
  if (Platform.OS !== 'android') return 'platform_not_android'
  if (typeof installedVersionCode !== 'number') return 'missing_installed_version_code'
  if (!config) return 'missing_remote_config'
  if (!config.enabled) return 'remote_updates_disabled'

  const minimumVersionCode = readNumber(config.minimumVersionCode, 0)
  const latestVersionCode = readNumber(config.latestVersionCode, 0)

  if (updateType === 'required') {
    if (config.forceUpdate === true && latestVersionCode > 0 && installedVersionCode < latestVersionCode) {
      return 'force_update_installed_version_below_latest_version_code'
    }

    return 'installed_version_below_minimum_version_code'
  }

  if (updateType === 'recommended') {
    return 'installed_version_below_latest_version_code'
  }

  if (latestVersionCode > 0 && installedVersionCode >= latestVersionCode) {
    return 'installed_version_at_or_above_latest_version_code'
  }

  if (minimumVersionCode <= 0 && latestVersionCode <= 0) {
    return 'remote_version_codes_not_configured'
  }

  return 'no_update_required'
}

function logAppUpdateDecision(installedVersionCode, config, updateType, reason) {
  console.log('[APP UPDATE CHECK]', {
    enabled: config?.enabled ?? null,
    forceUpdate: config?.forceUpdate ?? null,
    installedVersionCode,
    latestVersionCode: config?.latestVersionCode ?? null,
    minimumVersionCode: config?.minimumVersionCode ?? null,
    reason,
    result: updateType,
  })
}

export async function fetchAppUpdateConfig() {
  if (Platform.OS === 'web') return null

  const { db } = getFirebaseServices()
  const snapshot = await getDoc(doc(db, 'appConfig', 'version'))

  if (!snapshot.exists()) return null

  const data = snapshot.data() ?? {}

  return {
    enabled: readRemoteBoolean(data, 'enabled', false),
    forceUpdate: readRemoteBoolean(data, 'forceUpdate', false),
    latestVersionCode: readRemoteNumber(data, 'latestVersionCode', 0),
    message: readString(data.message),
    minimumVersionCode: readRemoteNumber(data, 'minimumVersionCode', 0),
    playStoreUrl: readString(data.playStoreUrl, DEFAULT_PLAY_STORE_URL),
    releaseNotes: readStringList(data.releaseNotes),
  }
}

async function fetchAppUpdateConfigWithRetry(installedVersionCode) {
  try {
    return await fetchAppUpdateConfig()
  } catch (error) {
    logAppUpdateDecision(installedVersionCode, null, null, 'firestore_read_failed_retrying')
    console.warn('[APP UPDATE FIRESTORE ERROR]', { attempt: 1, error })
  }

  await wait(FIRESTORE_RETRY_DELAY_MS)

  try {
    return await fetchAppUpdateConfig()
  } catch (error) {
    logAppUpdateDecision(installedVersionCode, null, null, 'firestore_read_failed_after_retry')
    console.warn('[APP UPDATE FIRESTORE ERROR]', { attempt: 2, error })
    return null
  }
}

export async function resolveAppUpdateState() {
  if (Platform.OS !== 'android') {
    logAppUpdateDecision(null, null, null, 'platform_not_android')
    return null
  }

  try {
    const installedVersionCode = getInstalledAndroidVersionCode()
    if (typeof installedVersionCode !== 'number') {
      logAppUpdateDecision(installedVersionCode, null, null, 'missing_installed_version_code')
      return null
    }

    const config = await fetchAppUpdateConfigWithRetry(installedVersionCode)

    const updateType = compareAppVersion(installedVersionCode, config)
    const reason = getAppUpdateDecisionReason(installedVersionCode, config, updateType)
    logAppUpdateDecision(installedVersionCode, config, updateType, reason)
    if (!updateType) return null

    return {
      config,
      installedVersionCode,
      updateType,
    }
  } catch (error) {
    console.warn('[APP UPDATE CHECK ERROR]', error)
    return null
  }
}

export function useAppUpdateState() {
  const [appUpdateState, setAppUpdateState] = useState(null)
  const [dismissedRecommendedUpdate, setDismissedRecommendedUpdate] = useState(false)
  const appStateRef = useRef(AppState.currentState)
  const isCheckingRef = useRef(false)
  const isMountedRef = useRef(false)
  const pendingCheckReasonRef = useRef(null)
  const checkVersion = useCallback((reason = 'manual') => {
    if (isCheckingRef.current) {
      pendingCheckReasonRef.current = reason
      return
    }

    isCheckingRef.current = true
    console.log('[APP UPDATE CHECK REQUEST]', { reason })

    resolveAppUpdateState()
      .then((nextState) => {
        if (isMountedRef.current) setAppUpdateState(nextState)
      })
      .catch((error) => {
        if (__DEV__) console.warn('[APP UPDATE STATE ERROR]', error)
      })
      .finally(() => {
        isCheckingRef.current = false

        const pendingReason = pendingCheckReasonRef.current
        pendingCheckReasonRef.current = null
        if (isMountedRef.current && pendingReason) {
          checkVersion(pendingReason)
        }
      })
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    checkVersion('mount')

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current
      appStateRef.current = nextState

      if ((previousState === 'background' || previousState === 'inactive') && nextState === 'active') {
        checkVersion('foreground')
      }
    })

    return () => {
      isMountedRef.current = false
      subscription.remove()
    }
  }, [checkVersion])

  const visibleUpdateState = appUpdateState?.updateType === 'required' || !dismissedRecommendedUpdate
    ? appUpdateState
    : null

  return {
    dismissRecommendedUpdate: () => setDismissedRecommendedUpdate(true),
    updateState: visibleUpdateState,
  }
}

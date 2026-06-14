import { Platform } from 'react-native'

export const WEB_APP_VERSION = '2026-06-14.1'

const WEB_VERSION_STORAGE_KEY = 'coincidir:webAppVersion'
const WEB_VERSION_RELOAD_STORAGE_PREFIX = 'coincidir:webVersionReloaded:'

const CREATE_ACTIVITY_TEMP_STORAGE_KEYS = [
  'createActivity:draft',
  'createActivity:activityDraft',
  'createActivity:groupDraft',
  'createActivity:formDraft',
  'createActivity:tempDraft',
  'createActivity:pendingDraft',
]

function canUseWebStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function clearCreateActivityTemporaryState() {
  if (!canUseWebStorage()) return

  CREATE_ACTIVITY_TEMP_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key)
  })

  console.log('[WEB TEMP STATE CLEARED]', {
    keys: CREATE_ACTIVITY_TEMP_STORAGE_KEYS,
    scope: 'createActivity',
  })
}

export function checkWebAppVersion() {
  if (!canUseWebStorage()) return

  try {
    const previousVersion = window.localStorage.getItem(WEB_VERSION_STORAGE_KEY)

    console.log('[WEB VERSION CHECK]', {
      currentVersion: WEB_APP_VERSION,
      previousVersion,
    })

    if (previousVersion === WEB_APP_VERSION) return

    clearCreateActivityTemporaryState()
    window.localStorage.setItem(WEB_VERSION_STORAGE_KEY, WEB_APP_VERSION)

    console.log('[WEB VERSION UPDATED]', {
      currentVersion: WEB_APP_VERSION,
      previousVersion,
    })

    if (!previousVersion) return

    const reloadKey = `${WEB_VERSION_RELOAD_STORAGE_PREFIX}${WEB_APP_VERSION}`
    if (window.sessionStorage.getItem(reloadKey) === '1') return

    window.sessionStorage.setItem(reloadKey, '1')
    window.location.replace(window.location.href)
  } catch (error) {
    console.warn('[WEB VERSION CHECK]', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

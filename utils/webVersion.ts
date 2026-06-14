import { Platform } from 'react-native'

export const WEB_APP_VERSION = '2026-06-14.1'

const WEB_VERSION_STORAGE_KEY = 'coincidir:webAppVersion'
const WEB_VERSION_RELOAD_STORAGE_PREFIX = 'coincidir:webVersionReloaded:'
const CREATE_ACTIVITY_PRESERVED_STORAGE_KEYS = new Set([
  'createActivity:localGroups',
])

const CREATE_ACTIVITY_TEMP_STORAGE_KEYS = [
  'createActivity:draft',
  'createActivity:activityDraft',
  'createActivity:groupDraft',
  'createActivity:formDraft',
  'createActivity:tempDraft',
  'createActivity:pendingDraft',
]

export function canUseWebStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function getCreateActivityTemporaryStorageKeys() {
  if (!canUseWebStorage()) return []

  const keys = new Set(CREATE_ACTIVITY_TEMP_STORAGE_KEYS)

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key) continue
    if (!key.startsWith('createActivity:')) continue
    if (CREATE_ACTIVITY_PRESERVED_STORAGE_KEYS.has(key)) continue

    keys.add(key)
  }

  return Array.from(keys)
}

export function clearCreateActivityTemporaryState() {
  if (!canUseWebStorage()) return []

  const keys = getCreateActivityTemporaryStorageKeys()
  keys.forEach((key) => {
    window.localStorage.removeItem(key)
  })

  console.log('[WEB TEMP STATE CLEARED]', {
    keys,
    scope: 'createActivity',
  })

  return keys
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

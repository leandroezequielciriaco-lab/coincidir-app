export const LOCAL_GROUPS_STORAGE_KEY = 'createActivity:localGroups'

export type LocalGroup = {
  id: string
  name: string
}

const LEGACY_EXAMPLE_GROUP_IDS = new Set([
  'caminatas-activas',
  'running-tandil',
  'yoga-integral',
])

type StoredLocalGroup = LocalGroup & {
  deleted?: boolean
}

export function normalizeLocalGroupName(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function getLocalGroupId(groupName: string) {
  return normalizeLocalGroupName(groupName)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isLegacyExampleGroup(group: Pick<LocalGroup, 'id' | 'name'>) {
  const id = group.id.trim() || getLocalGroupId(group.name)
  return LEGACY_EXAMPLE_GROUP_IDS.has(id)
}

export function toLocalGroup(groupName: string, id = ''): LocalGroup | null {
  const name = groupName.trim()
  if (!name) return null

  const group = {
    id: id.trim() || getLocalGroupId(name),
    name,
  }

  return isLegacyExampleGroup(group) ? null : group
}

export function readStoredLocalGroups(value: string | null) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => {
        if (typeof item === 'string') return toLocalGroup(item)
        if (typeof item === 'object' && item !== null && 'deleted' in item && item.deleted === true) return null
        if (typeof item === 'object' && item !== null && 'name' in item && typeof item.name === 'string') {
          return toLocalGroup(item.name, 'id' in item && typeof item.id === 'string' ? item.id : '')
        }
        return null
      })
      .filter((item): item is LocalGroup => Boolean(item))
  } catch {
    return []
  }
}

export function readDeletedLocalGroupIds(value: string | null) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => {
        if (typeof item === 'object' && item !== null && 'deleted' in item && item.deleted === true && 'id' in item && typeof item.id === 'string') {
          return item.id.trim()
        }
        return ''
      })
      .filter((item): item is string => Boolean(item))
  } catch {
    return []
  }
}

export function mergeLocalGroups(...groups: LocalGroup[][]) {
  const seen = new Set<string>()
  const merged: LocalGroup[] = []

    groups.flat().forEach((group) => {
      const key = group.id || getLocalGroupId(group.name)
    if (!key || seen.has(key) || isLegacyExampleGroup(group)) return
    seen.add(key)
    merged.push({ id: key, name: group.name })
  })

  return merged
}

export function serializeLocalGroups(groups: LocalGroup[], deletedGroupIds: string[] = []) {
  const activeGroups = mergeLocalGroups(groups)
  const activeIds = new Set(activeGroups.map((group) => group.id))
  const deletedGroups: StoredLocalGroup[] = deletedGroupIds
    .filter((id) => id && !activeIds.has(id))
    .map((id) => ({ deleted: true, id, name: id }))

  return JSON.stringify([...activeGroups, ...deletedGroups])
}

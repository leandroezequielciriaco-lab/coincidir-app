import type { LocalGroup } from '../constants/localGroups'

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readRecord(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function getActivityGroupMeta(data: Record<string, unknown>, localGroups: LocalGroup[] = []) {
  const additionalSettings = readRecord(data.additionalSettings)
  const groupColor = readString(data.groupColor, readString(additionalSettings.groupColor))
  const groupId = readString(data.groupId, readString(additionalSettings.groupId))
  const localGroupName = groupId ? localGroups.find((group) => group.id === groupId)?.name ?? '' : ''
  const groupName = readString(data.groupName)
    || readString(additionalSettings.groupName)
    || localGroupName

  return { groupColor, groupId, groupName }
}

export function applyGroupNameToActivity(data: Record<string, unknown>, groupId: string, groupName: string) {
  const additionalSettings = readRecord(data.additionalSettings)
  const activityGroupId = readString(data.groupId, readString(additionalSettings.groupId))

  if (activityGroupId !== groupId) return data

  return {
    ...data,
    groupName,
    additionalSettings: {
      ...additionalSettings,
      groupName,
    },
  }
}

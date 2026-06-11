function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function getGroupOwnerId(group: Record<string, unknown> | null | undefined) {
  if (!group) return ''

  return readString(group.ownerId)
    || readString(group.createdBy)
    || readString(group.creatorId)
    || readString(group.userId)
}

export function normalizeIdCollection(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (typeof item === 'object' && item) {
          const record = item as Record<string, unknown>
          return readString(record.uid, readString(record.id, readString(record.userId)))
        }
        return ''
      })
      .filter(Boolean)
  }

  if (typeof value === 'object' && value) {
    return Object.keys(value).map((id) => id.trim()).filter(Boolean)
  }

  return []
}

export function getGroupMemberIds(group: Record<string, unknown> | null | undefined) {
  if (!group) return []

  const ids = new Set<string>()
  ;[
    group.members,
    group.memberIds,
    group.memberProfiles,
    group.joinedUsers,
  ].forEach((value) => {
    normalizeIdCollection(value).forEach((id) => ids.add(id))
  })

  const ownerId = getGroupOwnerId(group)
  if (ownerId) ids.add(ownerId)

  return Array.from(ids)
}

export function getGroupMemberCount(group: Record<string, unknown> | null | undefined) {
  if (!group) return 0

  const normalizedIds = getGroupMemberIds(group)
  if (normalizedIds.length > 0) return normalizedIds.length

  const memberCount = readNumber(group.memberCount, -1)
  if (memberCount >= 0) return memberCount

  const membersCount = readNumber(group.membersCount, -1)
  if (membersCount >= 0) return membersCount

  return 0
}

export function formatGroupMemberCount(count: number) {
  return count === 1 ? '1 miembro' : `${count} miembros`
}

export function isGroupMember(group: Record<string, unknown> | null | undefined, userId: string | null | undefined) {
  if (!userId) return false
  return getGroupMemberIds(group).includes(userId)
}

export function hasPendingGroupRequest(group: Record<string, unknown> | null | undefined, userId: string | null | undefined) {
  if (!group || !userId) return false
  return normalizeIdCollection(group.membershipRequests).includes(userId)
    || normalizeIdCollection(group.pendingMembers).includes(userId)
}

export function isDeletedGroup(group: Record<string, unknown> | null | undefined) {
  if (!group) return false
  return group.deleted === true || readString(group.status).toLowerCase() === 'deleted'
}

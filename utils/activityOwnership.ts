function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

export function getActivityOwnerId(data: Record<string, unknown>) {
  return readString(data.createdBy)
    || readString(data.organizerId)
    || readString(data.creatorId)
    || readString(data.ownerId)
    || readString(data.userId)
    || readString(data.createdById)
}

export function isOwnActivity(data: Record<string, unknown>, currentUser: string | { uid?: string | null } | null | undefined) {
  const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.uid
  if (!currentUserId) return false

  return getActivityOwnerId(data) === currentUserId
}

import type { ImageSourcePropType } from 'react-native'
import { getCategoryImage } from '../utils/categoryImages'

export type ChatSource = 'activity' | 'group'

export type FirestoreRecord = {
  id: string
  data: Record<string, unknown>
}

export type ChatSummaryData = Record<string, unknown>

type CategoryId = 'outdoor' | 'sports' | 'wellness' | 'groups'

const image = (uri: string): ImageSourcePropType => ({ uri })

function readRemoteImageUrl(value: unknown) {
  const uri = readString(value)
  return /^https?:\/\//i.test(uri) ? uri : ''
}

export function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function normalize(value: unknown) {
  return readString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function getTimestampMillis(value: unknown) {
  return typeof value === 'object' && value && 'toMillis' in value && typeof value.toMillis === 'function'
    ? value.toMillis()
    : 0
}

export function getCategoryId(data: Record<string, unknown>): CategoryId | 'default' {
  const categoryId = readString(data.categoryId)

  if (categoryId === 'outdoor' || categoryId === 'sports' || categoryId === 'wellness' || categoryId === 'groups') {
    return categoryId
  }

  return 'default'
}

export function getChatCollection(source: ChatSource) {
  return source === 'group' ? 'groupChats' : 'activityChats'
}

export function getSourceCollection(source: ChatSource) {
  return source === 'group' ? 'groups' : 'activities'
}

export function getChatTitle(data: Record<string, unknown>, source: ChatSource) {
  return readString(
    data.name,
    readString(data.title, source === 'group' ? 'Grupo sin titulo' : 'Actividad sin titulo'),
  )
}

export function getChatImage(data: Record<string, unknown>, source: ChatSource) {
  const photoURL = readRemoteImageUrl(data.imageUrl) || readRemoteImageUrl(data.photoURL) || readRemoteImageUrl(data.coverUrl)
  if (photoURL) return image(photoURL)
  return getCategoryImage(source === 'group' ? { category: 'Grupales', ...data } : data)
}

function collectMapKeys(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.keys(value)
    : []
}

function collectListIds(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') return item
      if (typeof item === 'object' && item) {
        const record = item as Record<string, unknown>
        return readString(record.uid, readString(record.userId, readString(record.id)))
      }

      return ''
    })
    .filter(Boolean)
}

function hasUserInMap(value: unknown, userId: string) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && userId in value
}

function hasUserInList(value: unknown, userId: string) {
  return collectListIds(value).includes(userId)
}

export function getParticipantIds(data: Record<string, unknown>) {
  const ids = [
    readString(data.createdBy),
    readString(data.createdById),
    readString(data.creatorId),
    readString(data.ownerId),
    readString(data.organizerId),
    readString(data.userId),
    ...collectMapKeys(data.participants),
    ...collectMapKeys(data.confirmedUsers),
    ...collectMapKeys(data.acceptedUsers),
    ...collectMapKeys(data.joinedUsers),
    ...collectMapKeys(data.members),
    ...collectListIds(data.participantIds),
    ...collectListIds(data.joinedUserIds),
    ...collectListIds(data.confirmedUsers),
    ...collectListIds(data.acceptedUsers),
    ...collectListIds(data.participants),
    ...collectListIds(data.attendees),
    ...collectListIds(data.members),
  ].filter(Boolean)

  return Array.from(new Set(ids))
}

export function isUserParticipant(data: Record<string, unknown>, userId: string | null) {
  if (!userId) return false
  if (
    readString(data.createdBy) === userId
    || readString(data.createdById) === userId
    || readString(data.creatorId) === userId
    || readString(data.ownerId) === userId
    || readString(data.organizerId) === userId
    || readString(data.userId) === userId
  ) return true

  return hasUserInMap(data.participants, userId)
    || hasUserInMap(data.confirmedUsers, userId)
    || hasUserInMap(data.acceptedUsers, userId)
    || hasUserInMap(data.joinedUsers, userId)
    || hasUserInMap(data.members, userId)
    || hasUserInList(data.participantIds, userId)
    || hasUserInList(data.joinedUserIds, userId)
    || hasUserInList(data.confirmedUsers, userId)
    || hasUserInList(data.acceptedUsers, userId)
    || hasUserInList(data.participants, userId)
    || hasUserInList(data.attendees, userId)
    || hasUserInList(data.members, userId)
}

export function getParticipantCount(data: Record<string, unknown>, source: ChatSource) {
  const storedCount = readNumber(source === 'group' ? data.membersCount : data.participantsCount, -1)
  if (storedCount >= 0) return storedCount

  const ids = getParticipantIds(data)
  if (ids.length > 0) return ids.length

  return 0
}

export function getUnreadCount(chatData: ChatSummaryData | undefined, userId: string | null) {
  if (!chatData || !userId) return 0

  const unreadBy = chatData.unreadBy
  if (typeof unreadBy !== 'object' || !unreadBy) return 0

  return readNumber((unreadBy as Record<string, unknown>)[userId], 0)
}

export function formatChatTime(value: unknown) {
  const millis = getTimestampMillis(value)
  if (!millis) return ''

  const date = new Date(millis)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()

  if (isToday) {
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer'

  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

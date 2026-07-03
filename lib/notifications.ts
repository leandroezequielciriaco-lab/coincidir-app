import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'

import { getFirebaseServices } from '../firebaseConfig'
import { resolveUserDisplayName } from '../utils/userNames'

export type NotificationType = 'activity_cancelled' | 'activity_update' | 'activity_updated' | 'confirmed' | 'group_join_accepted' | 'group_join_request' | 'interest' | 'invite' | 'joined_activity' | 'message' | 'new_activity_interest' | 'rejected'

export type AppNotification = {
  activityId?: string
  activityTitle?: string
  body: string
  chatId?: string
  chatType?: 'activity' | 'group'
  createdAt: Date | null
  groupId?: string
  groupName?: string
  id: string
  read: boolean
  requesterId?: string
  senderId?: string
  senderName?: string
  title: string
  type: NotificationType
  userId: string
}

export type CreateNotificationInput = {
  activityId?: string
  activityTitle?: string
  body: string
  chatId?: string
  chatType?: 'activity' | 'group'
  groupId?: string
  groupName?: string
  requesterId?: string
  senderId?: string
  senderName?: string
  title: string
  type: NotificationType
  userId: string
}

export type NotifyActivityInterestInput = {
  activityId: string
  activityTitle: string
  interestedUserId: string
  interestedUserName: string
  organizerId: string
}

export type NotifyActivityJoinedInput = {
  activityId: string
  activityTitle: string
  joinedUserId: string
  joinedUserName: string
  organizerId: string
}

export type NotifyActivityConfirmedInput = {
  activityId: string
  activityTitle: string
  confirmedUserId: string
  organizerId?: string
}

export type NotifyActivityRejectedInput = {
  activityId: string
  activityTitle: string
  organizerId?: string
  rejectedUserId: string
}

export type NotifyLinkedActivityUsersInput = {
  activity: Record<string, unknown>
  activityId: string
  activityTitle: string
  organizerId?: string
}

export type NotifyNewActivityInterestInput = {
  activity: Record<string, unknown>
  activityId: string
  activityTitle: string
  creatorId: string
}

type NotificationsState = {
  error: string | null
  isLoading: boolean
  notifications: AppNotification[]
}

type UnreadCountState = {
  error: string | null
  isLoading: boolean
  unreadCount: number
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readNotificationType(value: unknown): NotificationType {
  if (
    value === 'activity_cancelled'
    || value === 'activity_update'
    || value === 'activity_updated'
    || value === 'confirmed'
    || value === 'group_join_accepted'
    || value === 'group_join_request'
    || value === 'interest'
    || value === 'invite'
    || value === 'joined_activity'
    || value === 'message'
    || value === 'new_activity_interest'
    || value === 'rejected'
  ) return value
  return 'activity_update'
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function readDate(value: unknown) {
  if (value instanceof Date) return value
  if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate() as Date
  }

  return null
}

function mapNotification(id: string, data: Record<string, unknown>): AppNotification {
  return {
    activityId: readString(data.activityId) || undefined,
    activityTitle: readString(data.activityTitle) || undefined,
    body: readString(data.body),
    chatId: readString(data.chatId) || undefined,
    chatType: readString(data.chatType) === 'group' ? 'group' : readString(data.chatType) === 'activity' ? 'activity' : undefined,
    createdAt: readDate(data.createdAt),
    groupId: readString(data.groupId) || undefined,
    groupName: readString(data.groupName) || undefined,
    id,
    read: readBoolean(data.read),
    requesterId: readString(data.requesterId) || undefined,
    senderId: readString(data.senderId) || undefined,
    senderName: readString(data.senderName) || undefined,
    title: readString(data.title, 'Notificación'),
    type: readNotificationType(data.type),
    userId: readString(data.userId),
  }
}

function omitUndefinedFields<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}

function readRecord(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function collectUserIdsFromValue(value: unknown) {
  const ids = new Set<string>()

  if (typeof value === 'string' && value.trim()) {
    ids.add(value.trim())
    return ids
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectUserIdsFromValue(item).forEach((id) => ids.add(id))
    })
    return ids
  }

  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    const directId = readString(record.uid)
      || readString(record.userId)
      || readString(record.id)
      || readString(record.userUID)

    if (directId) ids.add(directId)
    if (directId) return ids

    Object.entries(record).forEach(([key, item]) => {
      if (key.trim()) ids.add(key.trim())

      if (typeof item === 'object' && item !== null) {
        const nestedRecord = item as Record<string, unknown>
        const nestedId = readString(nestedRecord.uid)
          || readString(nestedRecord.userId)
          || readString(nestedRecord.id)
          || readString(nestedRecord.userUID)

        if (nestedId) ids.add(nestedId)
      }
    })
  }

  return ids
}

function getLinkedActivityUserIds(activity: Record<string, unknown>, organizerId?: string) {
  const data = readRecord(activity)
  const linkedFields = [
    data.interestedUsers,
    data.invitedUsers,
    data.invitations,
    data.invites,
    data.participants,
    data.joinedUsers,
    data.attendees,
    data.members,
    data.confirmedUsers,
    data.confirmedParticipants,
  ]
  const userIds = new Set<string>()

  linkedFields.forEach((field) => {
    collectUserIdsFromValue(field).forEach((id) => {
      if (id && id !== organizerId) userIds.add(id)
    })
  })

  return Array.from(userIds)
}

export async function createNotification(data: CreateNotificationInput) {
  const { db } = getFirebaseServices()

  return addDoc(collection(db, 'notifications'), omitUndefinedFields({
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  }))
}

function getDeterministicNotificationId({
  activityId,
  senderId,
  type,
  userId,
}: {
  activityId: string
  senderId?: string
  type: NotificationType
  userId: string
}) {
  const clean = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, '_')
  return [type, activityId, senderId || 'system', userId].map(clean).join('_')
}

async function createDeterministicNotification(data: CreateNotificationInput & { activityId: string }) {
  const { db } = getFirebaseServices()
  const notificationId = getDeterministicNotificationId({
    activityId: data.activityId,
    senderId: data.senderId,
    type: data.type,
    userId: data.userId,
  })

  await setDoc(
    doc(db, 'notifications', notificationId),
    omitUndefinedFields({
      ...data,
      read: false,
      createdAt: serverTimestamp(),
    }),
    { merge: false },
  )

  return notificationId
}

export async function notifyActivityInterest({
  activityId,
  activityTitle,
  interestedUserId,
  interestedUserName,
  organizerId,
}: NotifyActivityInterestInput) {
  if (!organizerId || !interestedUserId || organizerId === interestedUserId) return null

  return createDeterministicNotification({
    activityId,
    activityTitle,
    body: `${resolveUserDisplayName({ fallback: 'Usuario', profile: { fullName: interestedUserName } })} quiere sumarse a tu actividad: ${activityTitle}.`,
    senderId: interestedUserId,
    senderName: resolveUserDisplayName({ fallback: 'Usuario', profile: { fullName: interestedUserName } }),
    title: 'Nueva persona interesada',
    type: 'interest',
    userId: organizerId,
  })
}

export async function notifyActivityJoined({
  activityId,
  activityTitle,
  joinedUserId,
  joinedUserName,
  organizerId,
}: NotifyActivityJoinedInput) {
  if (!organizerId || !joinedUserId || organizerId === joinedUserId) return null

  return createDeterministicNotification({
    activityId,
    activityTitle,
    body: `${resolveUserDisplayName({ fallback: 'Usuario', profile: { fullName: joinedUserName } })} se sumó a tu actividad: ${activityTitle}.`,
    senderId: joinedUserId,
    senderName: resolveUserDisplayName({ fallback: 'Usuario', profile: { fullName: joinedUserName } }),
    title: 'Nueva persona en tu actividad',
    type: 'joined_activity',
    userId: organizerId,
  })
}

export async function notifyActivityConfirmed({
  activityId,
  activityTitle,
  confirmedUserId,
  organizerId,
}: NotifyActivityConfirmedInput) {
  if (!activityId || !confirmedUserId) return null

  return createDeterministicNotification({
    activityId,
    body: `Ya estás confirmado en ${activityTitle}.`,
    senderId: organizerId,
    title: 'Te confirmaron en una actividad',
    type: 'confirmed',
    userId: confirmedUserId,
  })
}

export async function notifyActivityRejected({
  activityId,
  activityTitle,
  organizerId,
  rejectedUserId,
}: NotifyActivityRejectedInput) {
  if (!activityId || !rejectedUserId) return null

  return createNotification({
    activityId,
    body: `Tu solicitud para ${activityTitle} no fue aprobada.`,
    senderId: organizerId,
    title: 'Solicitud no aprobada',
    type: 'rejected',
    userId: rejectedUserId,
  })
}

export async function notifyActivityUpdated({
  activity,
  activityId,
  activityTitle,
  organizerId,
}: NotifyLinkedActivityUsersInput) {
  const userIds = getLinkedActivityUserIds(activity, organizerId)
  if (userIds.length === 0) return []

  return Promise.all(userIds.map((userId) => createNotification({
    activityId,
    body: `Se modifico una actividad que te interesa: ${activityTitle}`,
    senderId: organizerId,
    title: 'Actividad modificada',
    type: 'activity_updated',
    userId,
  })))
}

export async function notifyActivityCancelled({
  activity,
  activityId,
  activityTitle,
  organizerId,
}: NotifyLinkedActivityUsersInput) {
  const userIds = getLinkedActivityUserIds(activity, organizerId)
  if (userIds.length === 0) return []

  return Promise.all(userIds.map((userId) => createNotification({
    activityId,
    body: `Se cancelo una actividad que te interesa: ${activityTitle}`,
    senderId: organizerId,
    title: 'Actividad cancelada',
    type: 'activity_cancelled',
    userId,
  })))
}

export async function notifyNewActivityForMatchingInterests({
  activity,
  activityId,
  activityTitle,
  creatorId,
}: NotifyNewActivityInterestInput) {
  const primaryInterest = readString(activity.subcategory)
  const additionalSettings = readRecord(activity.additionalSettings)
  const visibility = readString(activity.visibility, readString(additionalSettings.visibility))
  if (!activityId || !creatorId || !primaryInterest || visibility !== 'public') return []

  const { db } = getFirebaseServices()
  const snapshot = await getDocs(query(
    collection(db, 'users'),
    where('interests', 'array-contains', primaryInterest),
  ))
  const userIds = snapshot.docs
    .map((item) => item.id)
    .filter((userId) => userId && userId !== creatorId)

  if (userIds.length === 0) return []

  return Promise.all(userIds.map((userId) => createDeterministicNotification({
    activityId,
    activityTitle,
    body: 'Se publicÃ³ una actividad que puede interesarte.',
    senderId: creatorId,
    title: 'Nueva actividad que coincide con tus intereses',
    type: 'new_activity_interest',
    userId,
  })))
}

export async function markNotificationAsRead(notificationId: string) {
  const { db } = getFirebaseServices()
  await updateDoc(doc(db, 'notifications', notificationId), { read: true })
}

export async function deleteNotification(notificationId: string) {
  const { db } = getFirebaseServices()
  await deleteDoc(doc(db, 'notifications', notificationId))
}

export async function deletePendingGroupJoinRequestNotifications(filters: {
  groupId: string
  requesterId: string
  userId?: string
}) {
  const { db } = getFirebaseServices()
  const constraints = [
    where('type', '==', 'group_join_request'),
    where('groupId', '==', filters.groupId),
    where('requesterId', '==', filters.requesterId),
  ]

  if (filters.userId) constraints.push(where('userId', '==', filters.userId))

  const snapshot = await getDocs(query(collection(db, 'notifications'), ...constraints))
  await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)))
}

export function useNotifications(userId: string | null): NotificationsState {
  const [state, setState] = useState<NotificationsState>({
    error: null,
    isLoading: Boolean(userId),
    notifications: [],
  })

  useEffect(() => {
    if (!userId) {
      setState({ error: null, isLoading: false, notifications: [] })
      return undefined
    }

    setState((current) => ({ ...current, error: null, isLoading: true }))

    try {
      const { db } = getFirebaseServices()
      // Firestore puede requerir índice compuesto:
      // collection: notifications
      // fields: userId Ascending, createdAt Descending
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
      )

      return onSnapshot(
        notificationsQuery,
        (snapshot) => {
          setState({
            error: null,
            isLoading: false,
            notifications: snapshot.docs.map((item) => mapNotification(item.id, item.data() as Record<string, unknown>)),
          })
        },
        (error) => {
          if (__DEV__) console.warn('notifications-list-error', error)
          setState({ error: 'No pudimos cargar tus notificaciones.', isLoading: false, notifications: [] })
        },
      )
    } catch (error) {
      if (__DEV__) console.warn('notifications-list-setup-error', error)
      setState({ error: 'No pudimos cargar tus notificaciones.', isLoading: false, notifications: [] })
      return undefined
    }
  }, [userId])

  return state
}

export function useUnreadNotificationsCount(userId: string | null): UnreadCountState {
  const [state, setState] = useState<UnreadCountState>({
    error: null,
    isLoading: Boolean(userId),
    unreadCount: 0,
  })

  useEffect(() => {
    if (!userId) {
      setState({ error: null, isLoading: false, unreadCount: 0 })
      return undefined
    }

    setState((current) => ({ ...current, error: null, isLoading: true }))

    try {
      const { db } = getFirebaseServices()
      const unreadQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false),
      )

      return onSnapshot(
        unreadQuery,
        (snapshot) => {
          setState({ error: null, isLoading: false, unreadCount: snapshot.size })
        },
        (error) => {
          if (__DEV__) console.warn('notifications-unread-error', error)
          setState({ error: 'No pudimos cargar el contador.', isLoading: false, unreadCount: 0 })
        },
      )
    } catch (error) {
      if (__DEV__) console.warn('notifications-unread-setup-error', error)
      setState({ error: 'No pudimos cargar el contador.', isLoading: false, unreadCount: 0 })
      return undefined
    }
  }, [userId])

  return state
}

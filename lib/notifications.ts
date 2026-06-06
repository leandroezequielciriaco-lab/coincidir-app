import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

import { getFirebaseServices } from '../firebaseConfig'

export type NotificationType = 'activity_cancelled' | 'activity_update' | 'activity_updated' | 'confirmed' | 'group_join_accepted' | 'group_join_request' | 'interest' | 'invite' | 'message' | 'rejected'

export type AppNotification = {
  activityId?: string
  body: string
  createdAt: Date | null
  id: string
  read: boolean
  senderId?: string
  title: string
  type: NotificationType
  userId: string
}

export type CreateNotificationInput = {
  activityId?: string
  body: string
  senderId?: string
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
    || value === 'message'
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
    body: readString(data.body),
    createdAt: readDate(data.createdAt),
    id,
    read: readBoolean(data.read),
    senderId: readString(data.senderId) || undefined,
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

async function notificationExists(filters: {
  activityId: string
  senderId?: string
  type: NotificationType
  userId: string
}) {
  const { db } = getFirebaseServices()
  const constraints = [
    where('userId', '==', filters.userId),
    where('type', '==', filters.type),
    where('activityId', '==', filters.activityId),
  ]

  if (filters.senderId) constraints.push(where('senderId', '==', filters.senderId))

  const snapshot = await getDocs(query(
    collection(db, 'notifications'),
    ...constraints,
    limit(1),
  ))

  return !snapshot.empty
}

export async function notifyActivityInterest({
  activityId,
  activityTitle,
  interestedUserId,
  interestedUserName,
  organizerId,
}: NotifyActivityInterestInput) {
  if (!organizerId || !interestedUserId || organizerId === interestedUserId) return null

  const exists = await notificationExists({
    activityId,
    senderId: interestedUserId,
    type: 'interest',
    userId: organizerId,
  })

  if (exists) return null

  return createNotification({
    activityId,
    body: `${interestedUserName || 'Alguien'} marcó interés en ${activityTitle}.`,
    senderId: interestedUserId,
    title: 'Nueva persona interesada',
    type: 'interest',
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

  const exists = await notificationExists({
    activityId,
    type: 'confirmed',
    userId: confirmedUserId,
  })

  if (exists) return null

  return createNotification({
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

export async function markNotificationAsRead(notificationId: string) {
  const { db } = getFirebaseServices()
  await updateDoc(doc(db, 'notifications', notificationId), { read: true })
}

export async function deleteNotification(notificationId: string) {
  const { db } = getFirebaseServices()
  await deleteDoc(doc(db, 'notifications', notificationId))
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

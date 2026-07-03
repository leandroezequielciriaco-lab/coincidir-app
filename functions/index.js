const { Expo } = require('expo-server-sdk')
const { initializeApp } = require('firebase-admin/app')
const { FieldValue, getFirestore } = require('firebase-admin/firestore')
const { logger } = require('firebase-functions')
const { onDocumentCreated } = require('firebase-functions/v2/firestore')

initializeApp()

const ANDROID_NOTIFICATION_CHANNEL_ID = 'coincidir-default'
const expo = new Expo()

function readString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}
}

function readArray(value) {
  return Array.isArray(value) ? value : []
}

function omitUndefinedFields(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  )
}

function getDeterministicNotificationId({
  activityId,
  senderId,
  type,
  userId,
}) {
  const clean = (value) => value.replace(/[^A-Za-z0-9_-]/g, '_')
  return [type, activityId, senderId || 'system', userId].map(clean).join('_')
}

function getTimeMinutes(data) {
  const match = readString(data.time, readString(data.startTime, readString(data.hora))).match(/(\d{1,2}):(\d{2})/)
  if (!match) return 0

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0
  return Math.min(23, Math.max(0, hours)) * 60 + Math.min(59, Math.max(0, minutes))
}

function timestampToMillis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }
  if (typeof value === 'object' && value && typeof value.toMillis === 'function') {
    return value.toMillis()
  }
  if (typeof value === 'object' && value && typeof value.seconds === 'number') {
    return value.seconds * 1000
  }
  return Number.NaN
}

function getActivityStartMillis(data) {
  const direct = timestampToMillis(data.startAt ?? data.startsAt ?? data.dateTime ?? data.activityDateTime)
  if (Number.isFinite(direct)) return direct

  const iso = timestampToMillis(data.activityDateISO)
  if (Number.isFinite(iso)) return iso + getTimeMinutes(data) * 60 * 1000

  const activityDate = timestampToMillis(data.activityDate)
  if (Number.isFinite(activityDate)) return activityDate + getTimeMinutes(data) * 60 * 1000

  return Number.NaN
}

function collectUserIdsFromValue(value) {
  const ids = new Set()

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
    const directId = readString(value.uid)
      || readString(value.userId)
      || readString(value.id)
      || readString(value.userUID)

    if (directId) {
      ids.add(directId)
      return ids
    }

    Object.entries(value).forEach(([key, item]) => {
      if (key.trim()) ids.add(key.trim())

      if (typeof item === 'object' && item !== null) {
        const nestedId = readString(item.uid)
          || readString(item.userId)
          || readString(item.id)
          || readString(item.userUID)

        if (nestedId) ids.add(nestedId)
      }
    })
  }

  return ids
}

function getParticipantIds(data) {
  const fields = [
    data.createdBy,
    data.ownerId,
    data.organizerId,
    data.creatorId,
    data.participantIds,
    data.participants,
    data.joinedUsers,
    data.members,
    data.attendees,
    data.confirmedUsers,
    data.confirmedParticipants,
  ]
  const ids = new Set()

  fields.forEach((field) => {
    collectUserIdsFromValue(field).forEach((id) => ids.add(id))
  })

  return Array.from(ids).filter(Boolean)
}

function getChatTitle(data, chatType) {
  return readString(
    data.title,
    readString(data.name, chatType === 'group' ? 'Grupo' : 'Actividad'),
  )
}

function truncateMessageText(value) {
  const text = readString(value)
  if (text.length <= 140) return text
  return `${text.slice(0, 137)}...`
}

async function updatePushStatus(notificationRef, push) {
  await notificationRef.set({ push }, { merge: true })
}

async function createMessageNotifications(event, chatType) {
  const snapshot = event.data
  if (!snapshot) return

  const db = getFirestore()
  const chatId = event.params.chatId
  const messageId = event.params.messageId
  const message = snapshot.data() || {}
  const senderId = readString(message.senderId)
  const senderName = readString(message.senderName, 'Usuario')
  const text = truncateMessageText(message.text)
  const chatCollection = chatType === 'group' ? 'groupChats' : 'activityChats'
  const sourceCollection = chatType === 'group' ? 'groups' : 'activities'

  if (!chatId || !messageId || !senderId || !text) {
    logger.warn('Message notification skipped: missing required fields', {
      chatId,
      chatType,
      hasSenderId: Boolean(senderId),
      hasText: Boolean(text),
      messageId,
    })
    return
  }

  const chatSnapshot = await db.doc(`${chatCollection}/${chatId}`).get()
  const chat = chatSnapshot.exists ? chatSnapshot.data() || {} : {}
  const sourceId = readString(chat.sourceId, chatId)
  const sourceSnapshot = await db.doc(`${sourceCollection}/${sourceId}`).get()
  const source = sourceSnapshot.exists ? sourceSnapshot.data() || {} : {}
  const chatTitle = getChatTitle({ ...source, ...chat }, chatType)
  const participantIds = Array.from(new Set([
    ...readArray(chat.participantIds).map((value) => readString(value)).filter(Boolean),
    ...getParticipantIds(source),
    ...getParticipantIds(chat),
  ])).filter((userId) => userId && userId !== senderId)

  if (participantIds.length === 0) {
    logger.info('Message notifications skipped: no recipients', {
      chatId,
      chatType,
      messageId,
      senderId,
    })
    return
  }

  const batch = db.batch()

  participantIds.forEach((userId) => {
    const notificationId = [
      'message',
      chatType,
      chatId,
      messageId,
      userId,
    ].map((value) => value.replace(/[^A-Za-z0-9_-]/g, '_')).join('_')

    batch.set(db.doc(`notifications/${notificationId}`), omitUndefinedFields({
      activityId: chatType === 'activity' ? sourceId : undefined,
      activityTitle: chatType === 'activity' ? chatTitle : undefined,
      body: `${senderName}: ${text}`,
      chatId,
      chatType,
      createdAt: FieldValue.serverTimestamp(),
      groupId: chatType === 'group' ? sourceId : undefined,
      groupName: chatType === 'group' ? chatTitle : undefined,
      read: false,
      senderId,
      senderName,
      title: `Nuevo mensaje en ${chatTitle}`,
      type: 'message',
      userId,
    }))
  })

  await batch.commit()

  logger.info('[NOTIF MESSAGE SEND]', {
    chatId,
    chatType,
    messageId,
    recipientCount: participantIds.length,
    senderId,
  })
}

exports.createInterestNotificationsOnActivityCreate = onDocumentCreated(
  'activities/{activityId}',
  async (event) => {
    const snapshot = event.data
    if (!snapshot) return

    const activityId = event.params.activityId
    const activity = snapshot.data() || {}
    const additionalSettings = readRecord(activity.additionalSettings)
    const subcategory = readString(activity.subcategory)
    const visibility = readString(activity.visibility, readString(additionalSettings.visibility))
    const creatorId = readString(activity.createdBy, readString(activity.creatorId, readString(activity.ownerId)))
    const activityTitle = readString(activity.name, readString(activity.title, subcategory || 'Nueva actividad'))
    const activityDateISO = readString(activity.activityDateISO)
    const time = readString(activity.time)
    const startsAt = getActivityStartMillis(activity)
    const now = Date.now()

    logger.info('New activity interest notification diagnostics', {
      activityDateISO,
      activityId,
      creatorId,
      isFuture: Number.isFinite(startsAt) ? startsAt > now : false,
      startsAt,
      subcategory,
      time,
      visibility,
    })

    if (!activityId || !creatorId || !subcategory) {
      logger.info('New activity interest notifications skipped: missing required activity fields', {
        activityId,
        creatorId,
        hasSubcategory: Boolean(subcategory),
      })
      return
    }

    if (visibility !== 'public') {
      logger.info('New activity interest notifications skipped: activity is not public', {
        activityId,
        visibility,
      })
      return
    }

    if (!Number.isFinite(startsAt) || startsAt <= now) {
      logger.info('New activity interest notifications skipped: activity is not future', {
        activityDateISO,
        activityId,
        now,
        startsAt,
        time,
      })
      return
    }

    try {
      const db = getFirestore()
      const usersSnapshot = await db.collection('users')
        .where('interests', 'array-contains', subcategory)
        .get()
      const excludedUserIds = []
      const userIds = []

      usersSnapshot.docs.forEach((userSnapshot) => {
        if (userSnapshot.id === creatorId) {
          excludedUserIds.push(userSnapshot.id)
          return
        }

        userIds.push(userSnapshot.id)
      })

      logger.info('New activity interest matching users found', {
        activityId,
        excludedUserIds,
        foundUserCount: usersSnapshot.size,
        notificationUserCount: userIds.length,
        subcategory,
      })

      if (userIds.length === 0) return

      const batchSize = 450

      for (let index = 0; index < userIds.length; index += batchSize) {
        const batch = db.batch()
        const chunk = userIds.slice(index, index + batchSize)

        chunk.forEach((userId) => {
          const notificationId = getDeterministicNotificationId({
            activityId,
            senderId: creatorId,
            type: 'new_activity_interest',
            userId,
          })

          batch.set(db.doc(`notifications/${notificationId}`), omitUndefinedFields({
            activityId,
            activityTitle,
            body: 'Se publico una actividad que puede interesarte.',
            createdAt: FieldValue.serverTimestamp(),
            read: false,
            senderId: creatorId,
            title: 'Nueva actividad que coincide con tus intereses',
            type: 'new_activity_interest',
            userId,
          }))
        })

        await batch.commit()
      }

      logger.info('New activity interest notifications created', {
        activityId,
        notificationCount: userIds.length,
        subcategory,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('New activity interest notification create failed', {
        activityId,
        error: message,
        subcategory,
      })
    }
  },
)

exports.createActivityMessageNotificationsOnMessageCreate = onDocumentCreated(
  'activityChats/{chatId}/messages/{messageId}',
  async (event) => createMessageNotifications(event, 'activity'),
)

exports.createGroupMessageNotificationsOnMessageCreate = onDocumentCreated(
  'groupChats/{chatId}/messages/{messageId}',
  async (event) => createMessageNotifications(event, 'group'),
)

exports.sendPushOnNotificationCreate = onDocumentCreated(
  'notifications/{notificationId}',
  async (event) => {
    const snapshot = event.data
    if (!snapshot) return

    const notificationId = event.params.notificationId
    const notification = snapshot.data() || {}
    const userId = readString(notification.userId)
    const title = readString(notification.title)
    const body = readString(notification.body)

    if (!userId || !title || !body) {
      await updatePushStatus(snapshot.ref, {
        status: 'error',
        sentAt: FieldValue.serverTimestamp(),
        error: 'missing-required-notification-fields',
      })
      logger.warn('Push notification skipped: missing required fields', {
        notificationId,
        hasBody: Boolean(body),
        hasTitle: Boolean(title),
        hasUserId: Boolean(userId),
      })
      return
    }

    try {
      const db = getFirestore()
      const userSnapshot = await db.doc(`users/${userId}`).get()
      const token = readString(userSnapshot.get('pushTokens.expo'))

      if (!token) {
        await updatePushStatus(snapshot.ref, {
          status: 'missing-token',
        })
        logger.info('Push notification skipped: missing Expo push token', {
          notificationId,
          userId,
        })
        return
      }

      if (!Expo.isExpoPushToken(token)) {
        await updatePushStatus(snapshot.ref, {
          status: 'error',
          sentAt: FieldValue.serverTimestamp(),
          error: 'invalid-expo-push-token',
        })
        logger.warn('Push notification skipped: invalid Expo push token', {
          notificationId,
          userId,
        })
        return
      }

      if (readString(notification.type) === 'message') {
        logger.info('[NOTIF MESSAGE SEND]', {
          chatId: readString(notification.chatId) || null,
          chatType: readString(notification.chatType) || null,
          notificationId,
          userId,
        })
      }

      const [ticket] = await expo.sendPushNotificationsAsync([
        {
          to: token,
          title,
          body,
          channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
          data: omitUndefinedFields({
            notificationId,
            type: readString(notification.type) || undefined,
            activityId: readString(notification.activityId) || undefined,
            chatId: readString(notification.chatId) || undefined,
            chatType: readString(notification.chatType) || undefined,
            groupId: readString(notification.groupId) || undefined,
          }),
        },
      ])

      if (ticket?.status === 'ok') {
        await updatePushStatus(snapshot.ref, {
          status: 'sent',
          sentAt: FieldValue.serverTimestamp(),
          ticketId: ticket.id,
        })
        return
      }

      await updatePushStatus(snapshot.ref, {
        status: 'error',
        sentAt: FieldValue.serverTimestamp(),
        error: ticket?.message || 'expo-push-ticket-error',
      })
      logger.warn('Expo push ticket error', {
        notificationId,
        ticket,
        userId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await updatePushStatus(snapshot.ref, {
        status: 'error',
        sentAt: FieldValue.serverTimestamp(),
        error: message,
      })
      logger.error('Push notification send failed', {
        error: message,
        notificationId,
        userId,
      })
    }
  },
)

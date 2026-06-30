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

function omitUndefinedFields(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  )
}

async function updatePushStatus(notificationRef, push) {
  await notificationRef.set({ push }, { merge: true })
}

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

      const [ticket] = await expo.sendPushNotificationsAsync([
        {
          to: token,
          title,
          body,
          sound: 'default',
          channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
          data: omitUndefinedFields({
            notificationId,
            type: readString(notification.type) || undefined,
            activityId: readString(notification.activityId) || undefined,
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

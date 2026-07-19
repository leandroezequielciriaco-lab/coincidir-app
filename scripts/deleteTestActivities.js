/**
 * Maintenance script to delete test activities before launch.
 *
 * 1) Fill ACTIVITY_IDS with the exact Firestore activity document IDs.
 * 2) Run with:
 *    CONFIRM_DELETE_TEST_ACTIVITIES=yes node scripts/deleteTestActivities.js
 *
 * This script only touches:
 * - activities/{activityId}
 * - activityChats/{activityId}
 * - activityChats/{activityId}/messages/{messageId}
 * - notifications/{notificationId} documents matched by activityId, or by
 *   chatId + chatType === "activity" for the same activityId.
 */

// =========================
// ACTIVIDADES A ELIMINAR
// =========================
const ACTIVITY_IDS = [
  // Pegar aquí los IDs de las actividades a eliminar
  // Ejemplo:
  // 'activityId-1',
  // 'activityId-2',
]

const CONFIRMATION_ENV = 'CONFIRM_DELETE_TEST_ACTIVITIES'
const CONFIRMATION_VALUE = 'yes'
const FIRESTORE_BATCH_LIMIT = 450

let admin

try {
  admin = require('firebase-admin')
} catch {
  admin = require('../functions/node_modules/firebase-admin')
}

function getUniqueActivityIds(ids) {
  return Array.from(new Set(
    ids
      .map((id) => (typeof id === 'string' ? id.trim() : ''))
      .filter(Boolean),
  ))
}

function askFinalConfirmation(activityIds) {
  return new Promise((resolve) => {
    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    console.log(`Actividades a eliminar: ${activityIds.length}`)
    console.log('activityId:')
    activityIds.forEach((activityId) => {
      console.log(`- ${activityId}`)
    })
    rl.question('Confirmación final: escribí DELETE para continuar: ', (answer) => {
      rl.close()
      resolve(answer === 'DELETE')
    })
  })
}

function getProjectId() {
  return process.env.FIREBASE_PROJECT_ID
    || process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT
    || undefined
}

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) return

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: getProjectId(),
  })
}

function assertSafeDocumentPath(path) {
  const allowedActivityPath = /^activities\/[^/]+$/
  const allowedActivityChatPath = /^activityChats\/[^/]+$/
  const allowedActivityChatMessagePath = /^activityChats\/[^/]+\/messages\/[^/]+$/
  const allowedNotificationPath = /^notifications\/[^/]+$/

  if (
    allowedActivityPath.test(path)
    || allowedActivityChatPath.test(path)
    || allowedActivityChatMessagePath.test(path)
    || allowedNotificationPath.test(path)
  ) {
    return
  }

  throw new Error(`Ruta no permitida para borrado: ${path}`)
}

async function deleteExistingDocument(ref, summary, counterName) {
  assertSafeDocumentPath(ref.path)

  const snapshot = await ref.get()
  if (!snapshot.exists) {
    console.log(`[NO EXISTE] ${ref.path}`)
    return false
  }

  await ref.delete()
  summary[counterName] += 1
  console.log(`[ELIMINADO] ${ref.path}`)
  return true
}

async function deleteQuerySnapshot(snapshot, summary, counterName) {
  if (snapshot.empty) return 0

  let deleted = 0
  let batch = snapshot.query.firestore.batch()
  let batchCount = 0

  for (const documentSnapshot of snapshot.docs) {
    assertSafeDocumentPath(documentSnapshot.ref.path)
    batch.delete(documentSnapshot.ref)
    batchCount += 1
    deleted += 1
    console.log(`[ELIMINADO] ${documentSnapshot.ref.path}`)

    if (batchCount >= FIRESTORE_BATCH_LIMIT) {
      await batch.commit()
      batch = snapshot.query.firestore.batch()
      batchCount = 0
    }
  }

  if (batchCount > 0) await batch.commit()

  summary[counterName] += deleted
  return deleted
}

async function deleteActivityChatMessages(db, activityId, summary) {
  const messagesRef = db.collection('activityChats').doc(activityId).collection('messages')
  const messagesSnapshot = await messagesRef.get()

  if (messagesSnapshot.empty) {
    console.log(`[NO EXISTE] activityChats/${activityId}/messages/*`)
    return
  }

  await deleteQuerySnapshot(messagesSnapshot, summary, 'chatMessagesDeleted')
}

async function findRelatedNotificationRefs(db, activityId) {
  const refsByPath = new Map()
  const notificationsRef = db.collection('notifications')
  const queries = [
    notificationsRef.where('activityId', '==', activityId),
    notificationsRef.where('chatType', '==', 'activity').where('chatId', '==', activityId),
  ]

  for (const relatedQuery of queries) {
    const snapshot = await relatedQuery.get()
    snapshot.docs.forEach((documentSnapshot) => {
      refsByPath.set(documentSnapshot.ref.path, documentSnapshot.ref)
    })
  }

  return Array.from(refsByPath.values())
}

async function deleteRelatedNotifications(db, activityId, summary) {
  const notificationRefs = await findRelatedNotificationRefs(db, activityId)

  if (notificationRefs.length === 0) {
    console.log(`[NO EXISTE] notifications/* relacionados con activityId=${activityId}`)
    return
  }

  let batch = db.batch()
  let batchCount = 0

  for (const ref of notificationRefs) {
    assertSafeDocumentPath(ref.path)
    batch.delete(ref)
    batchCount += 1
    summary.notificationsDeleted += 1
    console.log(`[ELIMINADO] ${ref.path}`)

    if (batchCount >= FIRESTORE_BATCH_LIMIT) {
      await batch.commit()
      batch = db.batch()
      batchCount = 0
    }
  }

  if (batchCount > 0) await batch.commit()
}

async function deleteOneActivity(db, activityId, summary) {
  console.log(`\n== Limpiando activityId=${activityId} ==`)

  await deleteActivityChatMessages(db, activityId, summary)
  await deleteExistingDocument(
    db.collection('activityChats').doc(activityId),
    summary,
    'chatsDeleted',
  )
  await deleteRelatedNotifications(db, activityId, summary)
  await deleteExistingDocument(
    db.collection('activities').doc(activityId),
    summary,
    'activitiesDeleted',
  )
}

async function main() {
  const activityIds = getUniqueActivityIds(ACTIVITY_IDS)

  if (activityIds.length === 0) {
    console.log('No hay actividades para eliminar.')
    return
  }

  if (process.env[CONFIRMATION_ENV] !== CONFIRMATION_VALUE) {
    throw new Error(
      `Confirmacion requerida: ejecuta con ${CONFIRMATION_ENV}=${CONFIRMATION_VALUE}.`,
    )
  }

  const confirmed = await askFinalConfirmation(activityIds)
  if (!confirmed) {
    console.log('Operación cancelada.')
    return
  }

  initializeFirebaseAdmin()

  const db = admin.firestore()
  const summary = {
    activitiesDeleted: 0,
    chatsDeleted: 0,
    chatMessagesDeleted: 0,
    notificationsDeleted: 0,
    errors: [],
  }

  for (const activityId of activityIds) {
    try {
      await deleteOneActivity(db, activityId, summary)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      summary.errors.push({ activityId, message })
      console.error(`[ERROR] activityId=${activityId}: ${message}`)
    }
  }

  console.log('\n== Resumen ==')
  console.log(`Actividades eliminadas: ${summary.activitiesDeleted}`)
  console.log(`Chats eliminados: ${summary.chatsDeleted}`)
  console.log(`Mensajes de chats eliminados: ${summary.chatMessagesDeleted}`)
  console.log(`Notificaciones eliminadas: ${summary.notificationsDeleted}`)
  console.log(`Errores: ${summary.errors.length}`)

  if (summary.errors.length > 0) {
    summary.errors.forEach((error) => {
      console.log(`- ${error.activityId}: ${error.message}`)
    })
    process.exitCode = 1
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[ERROR] ${message}`)
  process.exitCode = 1
})

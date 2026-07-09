/**
 * Maintenance script to clean launch data while preserving users.
 *
 * This script deletes only Firestore data related to activities and groups:
 * - activities and any subcollections below each activity document
 * - activityChats and any subcollections below each activity chat document
 * - groups and any subcollections below each group document
 * - groupChats and any subcollections below each group chat document
 * - notifications related to activities, groups, activity chats, or group chats
 *
 * It does not delete users, Firebase Auth users, Firebase config, Functions,
 * rules, or Storage files.
 */

const REQUIRED_ENV = 'CONFIRM_CLEAN_LAUNCH_DATA'
const REQUIRED_ENV_VALUE = 'yes'
const FINAL_CONFIRMATION = 'DELETE LAUNCH DATA'
const FIRESTORE_BATCH_LIMIT = 450
const QUERY_IN_LIMIT = 10

let admin

try {
  admin = require('firebase-admin')
} catch {
  admin = require('../functions/node_modules/firebase-admin')
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

function chunk(values, size) {
  const chunks = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

function uniqueRefs(refs) {
  const refsByPath = new Map()
  refs.forEach((ref) => refsByPath.set(ref.path, ref))
  return Array.from(refsByPath.values())
}

function assertAllowedDeletePath(path) {
  const allowedPaths = [
    /^activities\/[^/]+(?:\/.+)?$/,
    /^activityChats\/[^/]+(?:\/.+)?$/,
    /^groups\/[^/]+(?:\/.+)?$/,
    /^groupChats\/[^/]+(?:\/.+)?$/,
    /^notifications\/[^/]+$/,
  ]

  if (allowedPaths.some((pattern) => pattern.test(path))) return
  throw new Error(`Ruta no permitida para borrado: ${path}`)
}

async function getCollectionDocumentRefs(db, collectionName) {
  const snapshot = await db.collection(collectionName).get()
  return snapshot.docs.map((documentSnapshot) => documentSnapshot.ref)
}

async function collectDescendantDocumentRefs(documentRef) {
  const descendants = []
  const subcollections = await documentRef.listCollections()

  for (const subcollection of subcollections) {
    const snapshot = await subcollection.get()

    for (const documentSnapshot of snapshot.docs) {
      const childRef = documentSnapshot.ref
      descendants.push(...await collectDescendantDocumentRefs(childRef))
      descendants.push(childRef)
    }
  }

  return descendants
}

async function collectNotificationRefs(db, {
  activityChatIds,
  activityIds,
  groupChatIds,
  groupIds,
}) {
  const refs = []
  const notifications = db.collection('notifications')

  for (const ids of chunk(activityIds, QUERY_IN_LIMIT)) {
    const snapshot = await notifications.where('activityId', 'in', ids).get()
    snapshot.docs.forEach((documentSnapshot) => refs.push(documentSnapshot.ref))
  }

  for (const ids of chunk(groupIds, QUERY_IN_LIMIT)) {
    const snapshot = await notifications.where('groupId', 'in', ids).get()
    snapshot.docs.forEach((documentSnapshot) => refs.push(documentSnapshot.ref))
  }

  for (const ids of chunk(activityChatIds, QUERY_IN_LIMIT)) {
    const snapshot = await notifications.where('chatId', 'in', ids).get()
    snapshot.docs.forEach((documentSnapshot) => {
      if (documentSnapshot.get('chatType') === 'activity') refs.push(documentSnapshot.ref)
    })
  }

  for (const ids of chunk(groupChatIds, QUERY_IN_LIMIT)) {
    const snapshot = await notifications.where('chatId', 'in', ids).get()
    snapshot.docs.forEach((documentSnapshot) => {
      if (documentSnapshot.get('chatType') === 'group') refs.push(documentSnapshot.ref)
    })
  }

  return uniqueRefs(refs)
}

async function buildDeletionPlan(db) {
  const activityRefs = await getCollectionDocumentRefs(db, 'activities')
  const activityChatRefs = await getCollectionDocumentRefs(db, 'activityChats')
  const groupRefs = await getCollectionDocumentRefs(db, 'groups')
  const groupChatRefs = await getCollectionDocumentRefs(db, 'groupChats')
  const activityIds = activityRefs.map((ref) => ref.id)
  const activityChatIds = activityChatRefs.map((ref) => ref.id)
  const groupIds = groupRefs.map((ref) => ref.id)
  const groupChatIds = groupChatRefs.map((ref) => ref.id)
  const notificationRefs = await collectNotificationRefs(db, {
    activityChatIds,
    activityIds,
    groupChatIds,
    groupIds,
  })
  const descendantRefs = []

  for (const ref of [...activityRefs, ...activityChatRefs, ...groupRefs, ...groupChatRefs]) {
    descendantRefs.push(...await collectDescendantDocumentRefs(ref))
  }

  return {
    activityChatRefs,
    activityRefs,
    descendantRefs: uniqueRefs(descendantRefs),
    groupChatRefs,
    groupRefs,
    notificationRefs,
  }
}

function getPlanTotal(plan) {
  return plan.activityRefs.length
    + plan.activityChatRefs.length
    + plan.groupRefs.length
    + plan.groupChatRefs.length
    + plan.notificationRefs.length
    + plan.descendantRefs.length
}

function printPlanSummary(plan) {
  console.log('\n== Datos que se van a eliminar ==')
  console.log(`Actividades: ${plan.activityRefs.length}`)
  console.log(`Chats de actividades: ${plan.activityChatRefs.length}`)
  console.log(`Grupos: ${plan.groupRefs.length}`)
  console.log(`Chats de grupos: ${plan.groupChatRefs.length}`)
  console.log(`Notificaciones relacionadas: ${plan.notificationRefs.length}`)
  console.log(`Documentos en subcolecciones relacionadas: ${plan.descendantRefs.length}`)
}

function askFinalConfirmation() {
  return new Promise((resolve) => {
    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question(`Confirmación final: escribí ${FINAL_CONFIRMATION} para continuar: `, (answer) => {
      rl.close()
      resolve(answer === FINAL_CONFIRMATION)
    })
  })
}

async function deleteRefs(db, refs, summary) {
  let batch = db.batch()
  let batchCount = 0

  for (const ref of uniqueRefs(refs)) {
    assertAllowedDeletePath(ref.path)
    batch.delete(ref)
    batchCount += 1
    summary.deleted += 1
    console.log(`[ELIMINADO] ${ref.path}`)

    if (batchCount >= FIRESTORE_BATCH_LIMIT) {
      await batch.commit()
      batch = db.batch()
      batchCount = 0
    }
  }

  if (batchCount > 0) await batch.commit()
}

async function main() {
  if (process.env[REQUIRED_ENV] !== REQUIRED_ENV_VALUE) {
    throw new Error(`Confirmación requerida: ejecuta con ${REQUIRED_ENV}=${REQUIRED_ENV_VALUE}.`)
  }

  initializeFirebaseAdmin()

  const db = admin.firestore()
  const plan = await buildDeletionPlan(db)
  const total = getPlanTotal(plan)

  printPlanSummary(plan)

  if (total === 0) {
    console.log('\nNo hay datos de lanzamiento para eliminar.')
    return
  }

  const confirmed = await askFinalConfirmation()
  if (!confirmed) {
    console.log('Operación cancelada.')
    return
  }

  const summary = {
    deleted: 0,
    errors: [],
  }

  try {
    await deleteRefs(db, [
      ...plan.descendantRefs,
      ...plan.notificationRefs,
      ...plan.activityChatRefs,
      ...plan.groupChatRefs,
      ...plan.activityRefs,
      ...plan.groupRefs,
    ], summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    summary.errors.push(message)
    console.error(`[ERROR] ${message}`)
  }

  console.log('\n== Resumen final ==')
  console.log(`Documentos eliminados: ${summary.deleted}`)
  console.log(`Errores: ${summary.errors.length}`)

  summary.errors.forEach((message) => {
    console.log(`- ${message}`)
  })

  if (summary.errors.length > 0) process.exitCode = 1
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[ERROR] ${message}`)
  process.exitCode = 1
})

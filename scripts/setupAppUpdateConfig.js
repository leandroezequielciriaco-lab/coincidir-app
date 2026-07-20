/**
 * Maintenance script to create/update the Android app update config.
 *
 * This script only writes:
 * - appConfig/version
 *
 * It uses set(..., { merge: true }) so unrelated fields in the document are
 * preserved.
 */

const path = require('path')
const fs = require('fs')

const CONFIG_PATH = 'appConfig/version'
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'service-account.json')
const APP_UPDATE_CONFIG = {
  enabled: true,
  latestVersionCode: 19,
  minimumVersionCode: 18,
  forceUpdate: false,
  message: 'Hay una nueva versión de COINCIDIR disponible.',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.leandroezequielciriaco.coincidir',
  releaseNotes: [
    'Mejoras en el inicio de sesión.',
    'Nuevo detalle de actividades.',
    'Mejoras en la gestión de grupos.',
    'Correcciones de estabilidad.',
  ],
}

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

  if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    admin.initializeApp({
      credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
      projectId: getProjectId(),
    })
    return
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: getProjectId(),
  })
}

async function main() {
  initializeFirebaseAdmin()

  const db = admin.firestore()
  const configRef = db.doc(CONFIG_PATH)
  const payload = {
    ...APP_UPDATE_CONFIG,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'Leandro',
  }

  await configRef.set(payload, { merge: true })

  console.log('\n== Configuración de actualización guardada ==')
  console.log(`Documento: ${CONFIG_PATH}`)
  console.log(`enabled: ${APP_UPDATE_CONFIG.enabled}`)
  console.log(`latestVersionCode: ${APP_UPDATE_CONFIG.latestVersionCode}`)
  console.log(`minimumVersionCode: ${APP_UPDATE_CONFIG.minimumVersionCode}`)
  console.log(`forceUpdate: ${APP_UPDATE_CONFIG.forceUpdate}`)
  console.log('updatedAt: serverTimestamp()')
  console.log('updatedBy: Leandro')
  console.log('Los campos existentes no incluidos en este script fueron conservados por merge:true.')
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[ERROR] ${message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await Promise.all(admin.apps.map((app) => app.delete().catch(() => {})))
  })

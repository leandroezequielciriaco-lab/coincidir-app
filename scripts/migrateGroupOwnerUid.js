/**
 * One-off maintenance script to migrate the owner/member UID of one group.
 *
 * Target:
 * - groups/caminatas-activas
 *
 * Dry run:
 *   node scripts/migrateGroupOwnerUid.js --dry-run
 *
 * Apply:
 *   node scripts/migrateGroupOwnerUid.js --apply
 *
 * This script only writes to groups/caminatas-activas. It does not touch
 * activities, groupChats, users, Authentication, or any other group.
 */

const GROUP_ID = 'caminatas-activas'
const OLD_UID = 'FYbEmgZArxa4B9nYcsErRGGvlPk2'
const NEW_UID = 'UnfQYJYokmbgafcdmNjCtYTiuyN2'
const NEW_OWNER_NAME = 'Leandro Ezequiel Ciriaco'
const path = require('path')
const fs = require('fs')
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'service-account.json')

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

function parseArgs(argv) {
  const args = new Set(argv.slice(2))
  const dryRun = args.has('--dry-run')
  const apply = args.has('--apply')

  if (dryRun && apply) {
    throw new Error('Usa solo uno: --dry-run o --apply.')
  }

  if (!dryRun && !apply) {
    throw new Error('Modo requerido: ejecuta con --dry-run o --apply.')
  }

  return { apply, dryRun }
}

function readRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function isPlainRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function getEntryUserId(value) {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''

  const record = value
  return readString(record.uid)
    || readString(record.id)
    || readString(record.userId)
    || readString(record.userUID)
}

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function normalizeMemberArray(value) {
  if (isPlainRecord(value)) return normalizeMemberMap(value)
  if (!Array.isArray(value)) return []

  const entriesById = new Map()

  value.forEach((item) => {
    const currentId = getEntryUserId(item)
    if (!currentId) return

    const nextId = currentId === OLD_UID ? NEW_UID : currentId
    const nextItem = replaceUserIdInEntry(item, nextId)

    if (!entriesById.has(nextId)) {
      entriesById.set(nextId, nextItem)
    }
  })

  if (!entriesById.has(NEW_UID)) entriesById.set(NEW_UID, NEW_UID)
  return Array.from(entriesById.values())
}

function replaceUserIdInEntry(item, nextId) {
  if (typeof item === 'string') return nextId
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item

  const nextItem = { ...item }
  ;['uid', 'id', 'userId', 'userUID'].forEach((field) => {
    if (readString(nextItem[field]) === OLD_UID) nextItem[field] = nextId
  })

  return nextItem
}

function normalizeMemberMap(value) {
  const record = readRecord(value)
  const next = { ...record }

  if (Object.prototype.hasOwnProperty.call(next, OLD_UID)) {
    next[NEW_UID] = next[NEW_UID] ?? next[OLD_UID]
    delete next[OLD_UID]
  }

  next[NEW_UID] = true
  return next
}

function normalizeProfiles(value) {
  const profiles = readRecord(value)
  const oldProfile = readRecord(profiles[OLD_UID])
  const currentNewProfile = readRecord(profiles[NEW_UID])

  const nextProfile = {
    ...oldProfile,
    ...currentNewProfile,
    name: NEW_OWNER_NAME,
    role: 'owner',
  }

  const nextProfiles = {
    ...profiles,
    [NEW_UID]: nextProfile,
  }

  delete nextProfiles[OLD_UID]
  return nextProfiles
}

function removeMapKey(value, key) {
  const record = readRecord(value)
  if (!Object.prototype.hasOwnProperty.call(record, key)) return record

  const next = { ...record }
  delete next[key]
  return next
}

function collectIdsFromValue(value) {
  const ids = new Set()

  if (Array.isArray(value)) {
    value.forEach((item) => {
      const id = getEntryUserId(item)
      if (id) ids.add(id)
    })
    return ids
  }

  if (value && typeof value === 'object') {
    Object.keys(value).forEach((id) => {
      if (id.trim()) ids.add(id.trim())
    })
  }

  return ids
}

function collectCurrentMemberIds(data) {
  const ids = new Set()

  ;[
    data.members,
    data.memberIds,
    data.memberProfiles,
    data.joinedUsers,
  ].forEach((value) => {
    collectIdsFromValue(value).forEach((id) => ids.add(id))
  })

  const ownerId = readString(data.ownerId)
  if (ownerId) ids.add(ownerId)

  return Array.from(ids).sort()
}

function getOldUidLocations(data) {
  const locations = []

  if (readString(data.ownerId) === OLD_UID) locations.push('ownerId')
  if (collectIdsFromValue(data.members).has(OLD_UID)) locations.push('members')
  if (collectIdsFromValue(data.memberIds).has(OLD_UID)) locations.push('memberIds')
  if (collectIdsFromValue(data.joinedUsers).has(OLD_UID)) locations.push('joinedUsers')
  if (collectIdsFromValue(data.memberProfiles).has(OLD_UID)) locations.push('memberProfiles')
  if (collectIdsFromValue(data.membershipRequests).has(OLD_UID)) locations.push('membershipRequests')
  if (collectIdsFromValue(data.pendingMembers).has(OLD_UID)) locations.push('pendingMembers')

  return locations
}

function buildMigration(data) {
  const members = normalizeMemberArray(data.members)
  const memberIds = normalizeMemberArray(data.memberIds)
  const joinedUsers = normalizeMemberMap(data.joinedUsers)
  const memberProfiles = normalizeProfiles(data.memberProfiles)
  const membershipRequests = removeMapKey(data.membershipRequests, OLD_UID)
  const pendingMembers = removeMapKey(data.pendingMembers, OLD_UID)
  const memberIdsForCount = collectCurrentMemberIds({
    ...data,
    joinedUsers,
    memberIds,
    memberProfiles,
    members,
    ownerId: NEW_UID,
  })

  const nextData = {
    joinedUsers,
    memberCount: memberIdsForCount.length,
    memberIds,
    memberProfiles,
    members,
    membersCount: memberIdsForCount.length,
    ownerId: NEW_UID,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  if (isPlainRecord(data.membershipRequests)) nextData.membershipRequests = membershipRequests
  if (isPlainRecord(data.pendingMembers)) nextData.pendingMembers = pendingMembers

  return {
    nextData,
    nextMemberIds: memberIdsForCount,
  }
}

function assertCanMigrate(data) {
  const currentOwnerId = readString(data.ownerId)
  const oldUidLocations = getOldUidLocations(data)

  if (currentOwnerId !== OLD_UID && currentOwnerId !== NEW_UID) {
    throw new Error(`ownerId inesperado: ${currentOwnerId || 'sin ownerId'}.`)
  }

  if (oldUidLocations.length === 0) {
    throw new Error(`El UID anterior no aparece en ninguna estructura del grupo: ${OLD_UID}.`)
  }

  return { currentOwnerId, oldUidLocations }
}

async function readAuthUserSummary(uid) {
  try {
    const user = await admin.auth().getUser(uid)
    return {
      email: user.email || null,
      exists: true,
      uid,
    }
  } catch (error) {
    return {
      email: null,
      error: error && typeof error === 'object' && 'code' in error ? error.code : String(error),
      exists: false,
      uid,
    }
  }
}

async function assertAuthPreconditions() {
  if (OLD_UID === NEW_UID) {
    throw new Error('OLD_UID y NEW_UID no pueden ser iguales.')
  }

  const oldUser = await readAuthUserSummary(OLD_UID)
  const newUser = await readAuthUserSummary(NEW_UID)

  console.log('\n== Firebase Authentication ==')
  console.log(`OLD_UID: ${oldUser.uid} | email: ${oldUser.email || 'sin usuario'} | existe: ${oldUser.exists ? 'si' : 'no'}`)
  console.log(`NEW_UID: ${newUser.uid} | email: ${newUser.email || 'sin usuario'} | existe: ${newUser.exists ? 'si' : 'no'}`)

  if (!newUser.exists) {
    throw new Error(`NEW_UID no existe en Firebase Authentication: ${NEW_UID}.`)
  }

  return { newUser, oldUser }
}

function summarizeState(label, data) {
  const members = collectIdsFromValue(data.members)
  const memberIds = collectIdsFromValue(data.memberIds)
  const joinedUsers = collectIdsFromValue(data.joinedUsers)
  const memberProfiles = collectIdsFromValue(data.memberProfiles)
  const uniqueMembers = collectCurrentMemberIds(data)

  console.log(`\n== ${label} ==`)
  console.log(`ownerId: ${readString(data.ownerId) || 'sin ownerId'}`)
  console.log(`members: ${members.size}`)
  console.log(`memberIds: ${memberIds.size}`)
  console.log(`joinedUsers: ${joinedUsers.size}`)
  console.log(`memberProfiles: ${memberProfiles.size}`)
  console.log(`memberCount: ${typeof data.memberCount === 'number' ? data.memberCount : 'sin valor'}`)
  console.log(`membersCount: ${typeof data.membersCount === 'number' ? data.membersCount : 'sin valor'}`)
  console.log(`miembros unicos reales: ${uniqueMembers.length}`)
  console.log(`contiene UID anterior: ${getOldUidLocations(data).join(', ') || 'no'}`)
  console.log(`contiene UID nuevo: ${uniqueMembers.includes(NEW_UID) ? 'si' : 'no'}`)
}

function printFieldChange(field, beforeValue, afterValue) {
  console.log(`\n${field}:`)
  console.log('ANTES:')
  console.log(JSON.stringify(beforeValue ?? null, null, 2))
  console.log('DESPUES:')
  console.log(JSON.stringify(afterValue ?? null, null, 2))
}

function printPlan(before, nextData, nextMemberIds) {
  console.log('\n== Campos que cambiarian ==')
  ;[
    'ownerId',
    'members',
    'memberIds',
    'joinedUsers',
    'memberProfiles',
    'membershipRequests',
    'pendingMembers',
    'memberCount',
    'membersCount',
  ].forEach((field) => {
    printFieldChange(field, before[field], nextData[field])
  })

  console.log('\n== Conteo ==')
  console.log(`Conteo anterior real: ${collectCurrentMemberIds(before).length}`)
  console.log(`Conteo final real: ${nextMemberIds.length}`)
  console.log(`Miembros finales: ${nextMemberIds.join(', ')}`)
}

function assertPostMigration(data) {
  const oldUidLocations = getOldUidLocations(data)
  const members = collectCurrentMemberIds(data)
  const ownerId = readString(data.ownerId)

  if (oldUidLocations.length > 0) {
    throw new Error(`El UID anterior todavia aparece en: ${oldUidLocations.join(', ')}.`)
  }

  if (ownerId !== NEW_UID) {
    throw new Error(`ownerId final invalido: ${ownerId || 'sin ownerId'}.`)
  }

  if (!members.includes(NEW_UID)) {
    throw new Error('El UID nuevo no figura como miembro final.')
  }
}

async function runDryRun(db) {
  await assertAuthPreconditions()

  const groupRef = db.collection('groups').doc(GROUP_ID)
  const snapshot = await groupRef.get()

  if (!snapshot.exists) {
    throw new Error(`No existe groups/${GROUP_ID}.`)
  }

  const before = snapshot.data() || {}
  const validation = assertCanMigrate(before)
  const migration = buildMigration(before)

  summarizeState('Estado previo', before)
  console.log(`ownerId validado: ${validation.currentOwnerId}`)
  console.log(`UID anterior encontrado en: ${validation.oldUidLocations.join(', ')}`)
  printPlan(before, migration.nextData, migration.nextMemberIds)
  console.log('\nDRY RUN: no se escribio ningun cambio.')
}

async function runApply(db) {
  await assertAuthPreconditions()

  const groupRef = db.collection('groups').doc(GROUP_ID)
  let transactionResult

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(groupRef)

    if (!snapshot.exists) {
      throw new Error(`No existe groups/${GROUP_ID}.`)
    }

    const before = snapshot.data() || {}
    const validation = assertCanMigrate(before)
    const migration = buildMigration(before)

    summarizeState('Estado previo', before)
    console.log(`ownerId validado: ${validation.currentOwnerId}`)
    console.log(`UID anterior encontrado en: ${validation.oldUidLocations.join(', ')}`)
    printPlan(before, migration.nextData, migration.nextMemberIds)

    transaction.update(groupRef, migration.nextData)
    transactionResult = migration
  })

  const afterSnapshot = await groupRef.get()
  const after = afterSnapshot.data() || {}

  assertPostMigration(after)
  summarizeState('Estado final verificado', after)
  console.log(`\nMigracion aplicada en groups/${GROUP_ID}.`)
  console.log(`UID nuevo owner y miembro: ${NEW_UID}`)
  console.log(`Miembros finales: ${transactionResult.nextMemberIds.join(', ')}`)
}

async function main() {
  const { apply, dryRun } = parseArgs(process.argv)

  initializeFirebaseAdmin()

  const db = admin.firestore()

  console.log(`Grupo: groups/${GROUP_ID}`)
  console.log(`UID anterior: ${OLD_UID}`)
  console.log(`UID nuevo: ${NEW_UID}`)
  console.log(`Modo: ${dryRun ? 'dry-run' : 'apply'}`)

  if (dryRun) {
    await runDryRun(db)
    return
  }

  if (apply) {
    await runApply(db)
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[ERROR] ${message}`)
  process.exitCode = 1
})

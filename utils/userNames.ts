type FirebaseUserNameSource = {
  displayName?: string | null
  email?: string | null
  photoURL?: string | null
  uid?: string | null
}

type UserNameProfile = Record<string, unknown> | null | undefined

const GENERATED_NAME_PATTERNS = [
  /^sin nombre$/i,
  /^usuario sin nombre$/i,
  /^usuario\s+[a-z0-9_-]{4,}$/i,
  /^miembro de coincidir$/i,
  /^organizador de coincidir$/i,
  /^anfitrion no disponible$/i,
  /^anfitrión no disponible$/i,
]

export function readCleanString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export function isGeneratedUserName(value: unknown) {
  const cleanValue = readCleanString(value)
  if (!cleanValue) return false
  return GENERATED_NAME_PATTERNS.some((pattern) => pattern.test(cleanValue))
}

export function readStoredUserName(profile: UserNameProfile) {
  if (!profile) return ''

  const candidates = [
    profile.fullName,
    profile.displayName,
    profile.name,
    profile.nombre,
    profile.profileName,
  ]

  for (const candidate of candidates) {
    const name = readCleanString(candidate)
    if (name && !isGeneratedUserName(name)) return name
  }

  return ''
}

export function getEmailLocalPart(email: unknown) {
  const cleanEmail = readCleanString(email)
  const localPart = cleanEmail.split('@')[0]?.trim()
  return localPart || ''
}

export function resolveUserDisplayName({
  email,
  fallback = 'Usuario',
  firebaseUser,
  firstNameOnly = false,
  profile,
}: {
  email?: unknown
  fallback?: string
  firebaseUser?: FirebaseUserNameSource | null
  firstNameOnly?: boolean
  profile?: UserNameProfile
}) {
  const resolved =
    readStoredUserName(profile)
    || readCleanString(firebaseUser?.displayName)
    || getEmailLocalPart(email ?? firebaseUser?.email)
    || fallback

  const safeName = readCleanString(resolved, fallback)
  const finalName = isGeneratedUserName(safeName) ? fallback : safeName

  return firstNameOnly ? finalName.split(/\s+/)[0] || fallback : finalName
}

export function getGoogleProfileNameRepairFields(profile: UserNameProfile, firebaseUser: FirebaseUserNameSource) {
  const googleName = readCleanString(firebaseUser.displayName)
  if (!googleName || readStoredUserName(profile)) return {}

  return {
    displayName: googleName,
    fullName: googleName,
    name: googleName,
  }
}

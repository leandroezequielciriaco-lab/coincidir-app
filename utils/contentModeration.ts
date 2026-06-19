import { Alert, Platform } from 'react-native'

export type ContentValidationReason = 'inappropriate-content' | 'quality'

export type ContentModerationResult = {
  ok: boolean
  reason?: ContentValidationReason
  matchedWord?: string
  field?: string
}

export type ActivityModerationPayload = {
  title?: unknown
  name?: unknown
  description?: unknown
  location?: unknown
  meetingPoint?: unknown
}

export type GroupModerationPayload = {
  name?: unknown
  description?: unknown
}

const CONTENT_MODERATION_ALERT_TITLE = 'Revisá el contenido'
const CONTENT_MODERATION_ALERT_MESSAGE = 'Tu publicación contiene términos que no cumplen las normas de convivencia de COINCIDIR. Modificá el texto para poder continuar.'
const CONTENT_QUALITY_ALERT_TITLE = 'Completá mejor la información'
const CONTENT_QUALITY_ALERT_MESSAGE = 'Agregá un nombre y una descripción más claros para que otras personas entiendan la actividad.'

// Se comparan tokens o frases completas, nunca subcadenas, para no bloquear
// palabras inocentes que contengan accidentalmente un término moderado.
const blockedTerms = [
  // Contenido sexual explícito.
  'coger',
  'cogeme',
  'cogerte',
  'garchar',
  'garchame',
  'garcharte',
  'paja',
  'pornografia',
  'porno',
  'puta',
  'putas',
  'sexo',
  'sexo explicito',
  'sexo oral',
  // Insultos graves.
  'forro',
  'forra',
  'hijo de puta',
  'hija de puta',
  'la concha de tu madre',
  'mierda de persona',
  'pelotudo',
  'pelotuda',
  // Amenazas.
  'te voy a matar',
  'voy a matarte',
  'matarte',
  'amenazo',
  'amenazarte',
  'romperte la cara',
  'te voy a pegar',
  'te voy a cagar a trompadas',
  // Discriminación.
  'discapacitado de mierda',
  'discapacitada de mierda',
  'negro de mierda',
  'negra de mierda',
  'puto de mierda',
  'puta de mierda',
  'sidoso',
  'sidosa',
] as const

const genericNames = new Set(['1234', 'cro', 'hola', 'prueba', 'test'])

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Texto estable para comparar en React Native y Web. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function countRealCharacters(value: unknown): number {
  return normalizeText(readString(value)).replace(/[^a-z0-9]/g, '').length
}

function matchesBlockedTerm(normalizedText: string, normalizedTerm: string): boolean {
  return (` ${normalizedText} `).includes(` ${normalizedTerm} `)
}

function validateSuspiciousContact(text: string): ContentModerationResult {
  const normalized = normalizeText(text)

  if (/(?:https?:\/\/|www\.|wa\.me(?:\/|\b)|bit\.ly(?:\/|\b)|tinyurl\.com(?:\/|\b)|t\.me(?:\/|\b))/i.test(text)) {
    return { ok: false, reason: 'inappropriate-content', matchedWord: 'link' }
  }

  // También detecta ejemplos abreviados como "whatsapp 249...".
  if (/\bwhats?app\b/i.test(normalized) && /\d(?:\D*\d){2,}/.test(text)) {
    return { ok: false, reason: 'inappropriate-content', matchedWord: 'contact' }
  }

  if (/(?:^|\D)(?:\+?\d[\s().-]*){7,}(?:$|\D)/.test(text)) {
    return { ok: false, reason: 'inappropriate-content', matchedWord: 'phone' }
  }

  if (/\b(?:gratis|promo|gana|ganar|dinero)\b(?:\W+\w+){0,6}\W+\b(?:link|whats?app)\b/i.test(normalized)) {
    return { ok: false, reason: 'inappropriate-content', matchedWord: 'spam' }
  }

  return { ok: true }
}

export function validateContent(text: string): ContentModerationResult {
  const contactResult = validateSuspiciousContact(text)
  if (!contactResult.ok) return contactResult

  const normalized = normalizeText(text)
  for (const term of blockedTerms) {
    const normalizedTerm = normalizeText(term)
    if (matchesBlockedTerm(normalized, normalizedTerm)) {
      return {
        ok: false,
        reason: 'inappropriate-content',
        matchedWord: normalizedTerm,
      }
    }
  }

  return { ok: true }
}

function validateModeratedField(field: string, value: unknown): ContentModerationResult {
  if (value === undefined || value === null) return { ok: true }
  const result = validateContent(readString(value))
  return result.ok ? result : { ...result, field }
}

function validateNameQuality(field: string, value: unknown): ContentModerationResult {
  if (value === undefined || value === null) return { ok: true }
  const normalized = normalizeText(readString(value))
  if (countRealCharacters(value) < 4 || genericNames.has(normalized)) {
    return { ok: false, reason: 'quality', field }
  }
  return { ok: true }
}

function validateDescriptionQuality(field: string, value: unknown): ContentModerationResult {
  if (value === undefined || value === null) return { ok: true }
  if (countRealCharacters(value) < 10) {
    return { ok: false, reason: 'quality', field }
  }
  return { ok: true }
}

export function validateActivityPayload(payload: ActivityModerationPayload): ContentModerationResult {
  const title = payload.title ?? payload.name
  const location = payload.location ?? payload.meetingPoint

  // Moderación primero: si hay más de un problema, el mensaje más importante es
  // el de convivencia y nunca se expone al usuario el término encontrado.
  for (const [field, value] of [
    ['title', title],
    ['description', payload.description],
    ['location', location],
  ] as const) {
    const result = validateModeratedField(field, value)
    if (!result.ok) return result
  }

  const titleQuality = validateNameQuality('title', title)
  if (!titleQuality.ok) return titleQuality

  return validateDescriptionQuality('description', payload.description)
}

export function validateGroupPayload(payload: GroupModerationPayload): ContentModerationResult {
  for (const [field, value] of [
    ['name', payload.name],
    ['description', payload.description],
  ] as const) {
    const result = validateModeratedField(field, value)
    if (!result.ok) return result
  }

  return validateNameQuality('name', payload.name)
}

export function showContentValidationAlert(result: ContentModerationResult): void {
  const title = result.reason === 'quality'
    ? CONTENT_QUALITY_ALERT_TITLE
    : CONTENT_MODERATION_ALERT_TITLE
  const message = result.reason === 'quality'
    ? CONTENT_QUALITY_ALERT_MESSAGE
    : CONTENT_MODERATION_ALERT_MESSAGE

  // React Native Web no presenta Alert de forma consistente en todos los
  // navegadores. El proyecto ya usa este fallback para feedback bloqueante.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`)
    return
  }

  Alert.alert(title, message)
}

// Alias conservadores para consumidores externos que todavía usen la API previa.
export const normalizeModerationText = (value: unknown) => normalizeText(readString(value))
export const validateContentModerationText = (value: unknown) => validateContent(readString(value))

import { Alert } from 'react-native'

export type ContentModerationResult = {
  ok: boolean
  reason?: string
  matchedWord?: string
}

type ModerationField = {
  label: string
  value: unknown
}

const CONTENT_MODERATION_ALERT_TITLE = 'Revisá el contenido'
const CONTENT_MODERATION_ALERT_MESSAGE = 'Tu publicación contiene términos que no cumplen las normas de convivencia de COINCIDIR. Modificá el texto para poder continuar.'

// Listas iniciales de moderación básica. Mantener términos completos o frases claras:
// la validación usa tokens normalizados para evitar bloquear coincidencias parciales.
// Para ampliar, agregar términos explícitos y revisar falsos positivos antes de publicar.
const sexualExplicitTerms = [
  'coger',
  'cogeme',
  'cogerte',
  'garchar',
  'garchame',
  'garcharte',
  'porno',
  'pornografia',
  'sexo explicito',
  'sexo oral',
]

const severeInsultTerms = [
  'forro',
  'forra',
  'hijo de puta',
  'hija de puta',
  'la concha de tu madre',
  'mierda de persona',
  'pelotudo',
  'pelotuda',
]

const threatTerms = [
  'te voy a matar',
  'voy a matarte',
  'matarte',
  'amenazo',
  'amenazarte',
  'romperte la cara',
  'te voy a pegar',
  'te voy a cagar a trompadas',
]

const discriminationTerms = [
  'discapacitado de mierda',
  'discapacitada de mierda',
  'negro de mierda',
  'negra de mierda',
  'puto de mierda',
  'puta de mierda',
  'sidoso',
  'sidosa',
]

const singleWordTerms = new Map<string, string>()
const phraseTerms: string[] = []

for (const term of [
  ...sexualExplicitTerms,
  ...severeInsultTerms,
  ...threatTerms,
  ...discriminationTerms,
]) {
  const normalizedTerm = normalizeModerationText(term)
  const tokens = tokenizeModerationText(normalizedTerm)
  if (tokens.length === 1) {
    singleWordTerms.set(tokens[0], normalizedTerm)
  } else if (tokens.length > 1) {
    phraseTerms.push(tokens.join(' '))
  }
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normalizeModerationText(value: unknown) {
  return readString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function tokenizeModerationText(value: string) {
  return value.match(/[a-z0-9]+/g) ?? []
}

function validateSpamSignals(normalizedText: string): ContentModerationResult {
  const compactText = normalizedText.replace(/\s+/g, ' ')

  if (/(?:https?:\/\/|www\.|wa\.me\/|bit\.ly\/|tinyurl\.com\/|t\.me\/)/i.test(compactText)) {
    return { ok: false, reason: 'spam', matchedWord: 'link' }
  }

  if (/\bwhats?app\b(?:\D*\d){7,}/i.test(compactText)) {
    return { ok: false, reason: 'spam', matchedWord: 'whatsapp' }
  }

  if (/\b(?:gratis|promo|gana|ganar|dinero)\b(?:\W+\w+){0,6}\W+\b(?:link|whatsapp)\b/i.test(compactText)) {
    return { ok: false, reason: 'spam', matchedWord: 'spam' }
  }

  return { ok: true }
}

export function validateContentModerationText(value: unknown): ContentModerationResult {
  const normalizedText = normalizeModerationText(value)
  const spamResult = validateSpamSignals(normalizedText)
  if (!spamResult.ok) return spamResult

  const tokens = tokenizeModerationText(normalizedText)
  const tokenSet = new Set(tokens)

  for (const [token, matchedWord] of singleWordTerms) {
    if (tokenSet.has(token)) {
      return { ok: false, reason: 'blocked-term', matchedWord }
    }
  }

  const phraseText = tokens.join(' ')
  for (const phrase of phraseTerms) {
    const phrasePattern = new RegExp(`(?:^|\\s)${escapeRegExp(phrase)}(?:\\s|$)`)
    if (phrasePattern.test(phraseText)) {
      return { ok: false, reason: 'blocked-term', matchedWord: phrase }
    }
  }

  return { ok: true }
}

export function validateContentModerationFields(fields: ModerationField[]): ContentModerationResult {
  for (const field of fields) {
    const result = validateContentModerationText(field.value)
    if (!result.ok) {
      return {
        ...result,
        reason: result.reason ?? field.label,
      }
    }
  }

  return { ok: true }
}

export function showContentModerationAlert() {
  Alert.alert(CONTENT_MODERATION_ALERT_TITLE, CONTENT_MODERATION_ALERT_MESSAGE)
}

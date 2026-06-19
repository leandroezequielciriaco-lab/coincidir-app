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
  // Armas, explosivos y ataques. Se bloquean como palabras o frases completas;
  // la normalización también cubre variantes con y sin tilde.
  'bomba',
  'bombas',
  'explosivo',
  'explosivos',
  'dinamita',
  'granada',
  'granadas',
  'arma',
  'armas',
  'pistola',
  'pistolas',
  'revólver',
  'rifle',
  'escopeta',
  'cuchillo',
  'navaja',
  'machete',
  'tiroteo',
  'disparar',
  'disparos',
  'balas',
  'municiones',
  'atacar con arma',
  'poner una bomba',
  'llevar armas',
  'fabricar bomba',
  'bomba casera',
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

// Las amenazas se detectan por contexto para evitar bloquear usos inocentes de
// palabras aisladas (por ejemplo, "entrenamiento fuerte"). Los verbos más
// inequívocos, como "asesinar", también se bloquean por sí solos.
const severeViolenceVerb = [
  'matar(?:te|lo|la|los|las|le|les)?',
  'asesinar(?:te|lo|la|los|las|le|les)?',
  'golpear(?:te|lo|la|los|las|le|les)?',
  'apunalar(?:te|lo|la|los|las|le|les)?',
  'acuchillar(?:te|lo|la|los|las|le|les)?',
  'degollar(?:te|lo|la|los|las|le|les)?',
  'decapitar(?:te|lo|la|los|las|le|les)?',
  'fusilar(?:te|lo|la|los|las|le|les)?',
  'torturar(?:te|lo|la|los|las|le|les)?',
  'linchar(?:te|lo|la|los|las|le|les)?',
  'balear(?:te|lo|la|los|las|le|les)?',
  'disparar(?:te|lo|la|los|las|le|les)?',
].join('|')

const personOrAuthorityTarget = [
  'alguien',
  'presidentes?',
  'gobernadores?',
  'intendentes?',
  'policias?',
  'maestros?',
  'maestras?',
  'profesores?',
  'profesoras?',
  'personas?',
  'gente',
  'mujeres?',
  'hombres?',
  'ninos?',
  'ninas?',
].join('|')

// Los nombres de colectivos no se bloquean por sí solos: se combinan con
// expresiones de odio, exclusión, violencia o insulto. Esto permite usos
// neutrales y educativos sobre diversidad, inclusión o antirracismo.
const protectedGroupTarget = [
  // Nacionalidades y procedencias frecuentes en la región.
  'argentinos?',
  'argentinas?',
  'bolivianos?',
  'bolivianas?',
  'brasilenos?',
  'brasilenas?',
  'brasileros?',
  'brasileras?',
  'chilenos?',
  'chilenas?',
  'colombianos?',
  'colombianas?',
  'ecuatorianos?',
  'ecuatorianas?',
  'mexicanos?',
  'mexicanas?',
  'paraguayos?',
  'paraguayas?',
  'peruanos?',
  'peruanas?',
  'uruguayos?',
  'uruguayas?',
  'venezolanos?',
  'venezolanas?',
  'extranjeros?',
  'extranjeras?',
  'inmigrantes?',
  'migrantes?',
  'refugiados?',
  'refugiadas?',
  // Etnia, color de piel y pueblos originarios.
  'negros?',
  'negras?',
  'blancos?',
  'blancas?',
  'afrodescendientes?',
  'africanos?',
  'africanas?',
  'asiaticos?',
  'asiaticas?',
  'arabes?',
  'gitanos?',
  'gitanas?',
  'indigenas?',
  'pueblos?\\s+originarios?',
  // Religiones.
  'judios?',
  'judias?',
  'musulmanes?',
  'musulmanas?',
  'cristianos?',
  'cristianas?',
  'catolicos?',
  'catolicas?',
  'evangelicos?',
  'evangelicas?',
  // Discapacidad, género y orientación sexual.
  'personas?\\s+con\\s+discapacidad',
  'discapacitados?',
  'discapacitadas?',
  'mujeres?',
  'hombres?',
  'gays?',
  'lesbianas?',
  'homosexuales?',
  'bisexuales?',
  'transexuales?',
  'transgeneros?',
  'travestis?',
  'personas?\\s+trans',
  'personas?\\s+lgbt(?:qia?)?',
].join('|')

const protectedGroupReference = `(?:(?:a|al|hacia|contra|de)\\s+)?(?:(?:los|las|el|la|un|una|unos|unas)\\s+)?(?:${protectedGroupTarget})`

const hateOrDiscriminationPatterns = [
  // Odio explícito contra un colectivo.
  new RegExp(`\\b(?:odio|odiar|detesto|detestar)\\s+${protectedGroupReference}\\b`),
  // Exclusión o prohibición de ingreso/participación.
  new RegExp(`\\b(?:no\\s+se\\s+(?:aceptan|admiten|permiten)|no\\s+(?:aceptamos|admitimos|permitimos))\\s+${protectedGroupReference}\\b`),
  new RegExp(`\\bprohibid[oa]s?\\s+(?:(?:el\\s+ingreso|la\\s+entrada)\\s+)?${protectedGroupReference}\\b`),
  new RegExp(`\\bfuera\\s+${protectedGroupReference}\\b`),
  // Violencia, eliminación o expulsión dirigida a un colectivo.
  new RegExp(`\\b(?:matar|eliminar|exterminar|expulsar)\\s+${protectedGroupReference}\\b`),
  // Insultos y generalizaciones degradantes evidentes.
  new RegExp(`\\b(?:${protectedGroupTarget})\\s+de\\s+mierda\\b`),
  new RegExp(`\\bmaldit[oa]s?\\s+(?:(?:los|las)\\s+)?(?:${protectedGroupTarget})\\b`),
  new RegExp(`\\btod[oa]s?\\s+(?:los|las)\\s+(?:${protectedGroupTarget})\\s+(?:son|parecen)\\s+(?:\\w+\\s+){0,3}(?:mierda|inferiores?|sucios?|sucias?|criminales?|ladrones?|ladronas?|basura)\\b`),
] as const

const explicitViolencePatterns = [
  // Amenaza o intención directa, incluso si todavía no se menciona el blanco.
  new RegExp(`\\b(?:voy|vamos|quiero|queremos|pienso|pensamos|planeo|planeamos)\\s+(?:a\\s+)?(?:${severeViolenceVerb})\\b`),
  // Construcciones explícitas solicitadas: "matar a/al/el/la...".
  /\bmatar\s+(?:a|al|el|la|los|las)\b/,
  // "Asesinar" es inequívoco aun sin un blanco escrito.
  /\basesinar(?:te|lo|la|los|las|le|les)?\b/,
  // Otros verbos violentos graves se bloquean al estar dirigidos a personas o cargos.
  new RegExp(`\\b(?:${severeViolenceVerb})\\s+(?:(?:a|al|el|la|los|las|un|una)\\s+)?(?:\\w+\\s+){0,2}(?:${personOrAuthorityTarget})\\b`),
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

function matchesExplicitViolence(normalizedText: string): boolean {
  return explicitViolencePatterns.some((pattern) => pattern.test(normalizedText))
}

function matchesHateOrDiscrimination(normalizedText: string): boolean {
  return hateOrDiscriminationPatterns.some((pattern) => pattern.test(normalizedText))
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
  if (matchesHateOrDiscrimination(normalized)) {
    return {
      ok: false,
      reason: 'inappropriate-content',
      matchedWord: 'hate-or-discrimination',
    }
  }

  if (matchesExplicitViolence(normalized)) {
    return {
      ok: false,
      reason: 'inappropriate-content',
      matchedWord: 'explicit-violence',
    }
  }

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

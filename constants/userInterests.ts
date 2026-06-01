import { activityCategories } from './activityCategories'

export type UserInterestLabel = string

export type LegacyInterestAlias = {
  legacy: string
  canonical: UserInterestLabel[]
}

export const canonicalUserInterests = Array.from(
  new Set(activityCategories.flatMap((category) => category.subcategories)),
)

export const legacyInterestAliases: LegacyInterestAlias[] = [
  { legacy: 'Bicicleta', canonical: ['Ciclismo/MTB'] },
  { legacy: 'Kayak/SUP', canonical: ['Kayak', 'Stand Up Paddle'] },
  { legacy: 'Paddle / Tenis', canonical: ['Padel', 'Tenis'] },
  { legacy: 'Fútbol 5', canonical: ['Fútbol'] },
  { legacy: 'Mate', canonical: ['Mateadas'] },
  { legacy: 'Gym', canonical: ['Gimnasio'] },
  { legacy: 'Paddle / SUP', canonical: ['Padel', 'Stand Up Paddle'] },
  { legacy: 'Trekking', canonical: ['Trekking/Senderismo'] },
  { legacy: 'Baile', canonical: ['Tango', 'Salsa', 'Folklore', 'Ritmos'] },
  { legacy: 'Juegos', canonical: ['Juegos de mesa', 'Gaming'] },
  { legacy: 'Clases grupales (Tango, Salsa, Folklore)', canonical: ['Tango', 'Salsa', 'Folklore'] },
]

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function normalizeInterestLabel(value: unknown) {
  return typeof value === 'string'
    ? stripAccents(value).trim().replace(/\s+/g, ' ').toLowerCase()
    : ''
}

const canonicalByNormalizedLabel = new Map(
  canonicalUserInterests.map((interest) => [normalizeInterestLabel(interest), interest]),
)

const legacyAliasesByNormalizedLabel = new Map(
  legacyInterestAliases.map((alias) => [normalizeInterestLabel(alias.legacy), alias.canonical]),
)

export function expandInterest(value: unknown): UserInterestLabel[] {
  const normalized = normalizeInterestLabel(value)
  if (!normalized) return []

  const canonical = canonicalByNormalizedLabel.get(normalized)
  if (canonical) return [canonical]

  const alias = legacyAliasesByNormalizedLabel.get(normalized)
  if (alias) return alias

  return []
}

export function expandUserInterests(values: unknown): UserInterestLabel[] {
  if (!Array.isArray(values)) return []

  const expanded = values.flatMap(expandInterest)
  return Array.from(new Set(expanded))
}

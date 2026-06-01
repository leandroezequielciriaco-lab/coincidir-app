import { activityCategories, findActivityCategory } from '../constants/activityCategories'
import { expandInterest, expandUserInterests, normalizeInterestLabel } from '../constants/userInterests'

type ActivityRecord = Record<string, unknown>

const categoryAliases: Record<string, string[]> = {
  culture: ['cultura', 'arte', 'aprendizaje'],
  groups: ['grupales', 'sociales', 'comunidad', 'grupo'],
  hobbies: ['juegos', 'hobbies'],
  outdoor: ['al aire libre', 'aire libre', 'naturaleza', 'outdoor'],
  private: ['espacios privados', 'privados', 'private'],
  sports: ['deportes', 'sports'],
  training: ['entrenamiento', 'movimiento'],
  wellness: ['bienestar', 'wellness'],
}

const activityAliasRules: { terms: string[]; canonical: string[] }[] = [
  { terms: ['bicicleta', 'bici', 'bike', 'mountain bike', 'mtb', 'ciclismo'], canonical: ['Ciclismo/MTB'] },
  { terms: ['kayak/sup'], canonical: ['Kayak', 'Stand Up Paddle'] },
  { terms: ['sup', 'stand up paddle'], canonical: ['Stand Up Paddle'] },
  { terms: ['paddle / sup'], canonical: ['Padel', 'Stand Up Paddle'] },
  { terms: ['paddle / tenis'], canonical: ['Padel', 'Tenis'] },
  { terms: ['paddle', 'padel'], canonical: ['Padel'] },
  { terms: ['futbol 5', 'futbol'], canonical: ['Futbol'] },
  { terms: ['mate', 'mateada'], canonical: ['Mateadas'] },
  { terms: ['gym'], canonical: ['Gimnasio'] },
  { terms: ['baile', 'danza'], canonical: ['Tango', 'Salsa', 'Folklore', 'Ritmos'] },
  { terms: ['juegos'], canonical: ['Juegos de mesa', 'Gaming'] },
  { terms: ['clases grupales'], canonical: ['Tango', 'Salsa', 'Folklore'] },
  { terms: ['trekking', 'senderismo'], canonical: ['Trekking/Senderismo'] },
]

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function addString(target: string[], value: unknown) {
  const text = readString(value)
  if (text) target.push(text)
}

function addStringList(target: string[], value: unknown) {
  if (Array.isArray(value)) {
    value.forEach((item) => addString(target, item))
    return
  }

  if (typeof value === 'object' && value) {
    Object.entries(value).forEach(([key, item]) => {
      addString(target, key)
      addString(target, item)
    })
    return
  }

  addString(target, value)
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function getTokens(value: string) {
  return normalizeInterestLabel(value).split(/[^a-z0-9]+/).filter(Boolean)
}

function expandActivityTerm(value: unknown) {
  const text = readString(value)
  if (!text) return []

  const expanded = expandInterest(text)
  if (expanded.length > 0) return expanded

  const normalized = normalizeInterestLabel(text)
  const aliases = activityAliasRules.flatMap((rule) =>
    rule.terms.some((term) => normalized.includes(normalizeInterestLabel(term))) ? rule.canonical : [],
  )

  return unique(aliases)
}

export function getActivityRecommendationTerms(activity: ActivityRecord) {
  const terms: string[] = []
  const category = findActivityCategory({
    category: readString(activity.category),
    categoryId: readString(activity.categoryId),
  })

  addString(terms, activity.name)
  addString(terms, activity.title)
  addString(terms, activity.category)
  addString(terms, activity.categoryId)
  addString(terms, activity.subcategory)
  addString(terms, activity.type)
  addString(terms, activity.shortDescription)
  addString(terms, activity.description)
  addString(terms, activity.summary)
  addStringList(terms, activity.tags)
  addStringList(terms, activity.keywords)

  if (category) {
    terms.push(category.id, category.label, ...category.subcategories, ...(category.legacyLabels ?? []))
    terms.push(...(categoryAliases[category.id] ?? []))
  }

  return unique(terms)
}

export function getActivityExpandedInterests(activity: ActivityRecord) {
  const directTerms: string[] = []

  addString(directTerms, activity.category)
  addString(directTerms, activity.categoryId)
  addString(directTerms, activity.subcategory)
  addString(directTerms, activity.type)
  addStringList(directTerms, activity.tags)
  addStringList(directTerms, activity.keywords)

  return unique(directTerms.flatMap(expandActivityTerm))
}

export function getActivityRecommendationScore(activity: ActivityRecord, userInterests: unknown) {
  const expandedUserInterests = expandUserInterests(userInterests)
  if (expandedUserInterests.length === 0) return 0

  const activityInterests = new Set(getActivityExpandedInterests(activity).map(normalizeInterestLabel))
  const searchableText = getActivityRecommendationTerms(activity).map(normalizeInterestLabel).join(' ')

  return expandedUserInterests.reduce((score, interest) => {
    const normalizedInterest = normalizeInterestLabel(interest)
    if (!normalizedInterest) return score
    if (activityInterests.has(normalizedInterest)) return score + 10
    if (searchableText.includes(normalizedInterest)) return score + 4

    const tokens = getTokens(interest)
    if (tokens.length > 0 && tokens.every((token) => searchableText.includes(token))) return score + 3

    return score
  }, 0)
}

export function getRecommendedCategoryTerms(categoryId: string) {
  const category = activityCategories.find((item) => item.id === categoryId)
  if (!category) return []
  return unique([category.id, category.label, ...(category.legacyLabels ?? []), ...(categoryAliases[category.id] ?? [])])
}

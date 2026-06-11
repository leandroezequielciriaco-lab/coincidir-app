export type ActivityVisualStatus = 'upcoming' | 'today' | 'inProgress' | 'finished' | 'cancelled'
export type ActivityQuickCategoryId = 'all' | 'walk' | 'run' | 'bike' | 'wellness' | 'share'

export type ActivityVisualState = {
  backgroundColor: string
  borderColor: string
  color: string
  endedAt: number
  key: ActivityVisualStatus
  label: string
  rank: number
  startsAt: number
}

export const ACTIVITY_RECENT_FINISHED_WINDOW_MS = 24 * 60 * 60 * 1000
const DEFAULT_ACTIVITY_DURATION_MS = 2 * 60 * 60 * 1000

export const activityQuickCategories: { id: ActivityQuickCategoryId; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'walk', label: 'Caminá' },
  { id: 'run', label: 'Corré' },
  { id: 'bike', label: 'Pedaleá' },
  { id: 'wellness', label: 'Bienestar' },
  { id: 'share', label: 'Compartí' },
]

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export function normalizeActivityText(value: unknown) {
  return readString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function timestampToMillis(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }
  if (typeof value === 'object' && value && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis()
  }
  if (typeof value === 'object' && value && 'seconds' in value && typeof value.seconds === 'number') {
    return value.seconds * 1000
  }
  return Number.NaN
}

function getTimeMinutes(data: Record<string, unknown>) {
  const match = readString(data.time, readString(data.startTime, readString(data.hora))).match(/(\d{1,2}):(\d{2})/)
  if (!match) return 0

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0
  return Math.min(23, Math.max(0, hours)) * 60 + Math.min(59, Math.max(0, minutes))
}

function applyTime(baseTime: number, data: Record<string, unknown>) {
  if (!Number.isFinite(baseTime)) return Number.NaN
  const date = new Date(baseTime)
  const minutes = getTimeMinutes(data)
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return date.getTime()
}

function parseDateText(value: unknown, now: number) {
  const raw = readString(value)
  if (!raw) return Number.NaN

  const normalized = normalizeActivityText(raw)
  const today = new Date(now)
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (normalized.includes('hoy')) return todayStart.getTime()
  if (normalized.includes('manana')) return todayStart.getTime() + 24 * 60 * 60 * 1000

  const slashParts = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (slashParts) {
    const yearValue = slashParts[3] ? Number(slashParts[3]) : today.getFullYear()
    const fullYear = yearValue < 100 ? 2000 + yearValue : yearValue
    return new Date(fullYear, Number(slashParts[2]) - 1, Number(slashParts[1])).getTime()
  }

  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function getActivityStartMillis(data: Record<string, unknown>, now = Date.now()) {
  const direct = timestampToMillis(data.startAt ?? data.startsAt ?? data.dateTime ?? data.activityDateTime)
  if (Number.isFinite(direct)) return direct

  const iso = timestampToMillis(data.activityDateISO)
  if (Number.isFinite(iso)) return applyTime(iso, data)

  const activityDate = timestampToMillis(data.activityDate)
  if (Number.isFinite(activityDate)) return applyTime(activityDate, data)

  const textDate = parseDateText(data.date, now)
  if (Number.isFinite(textDate)) return applyTime(textDate, data)

  return Number.NaN
}

function getActivityEndMillis(data: Record<string, unknown>, startsAt: number) {
  const direct = timestampToMillis(data.endAt ?? data.endsAt ?? data.endDateTime)
  if (Number.isFinite(direct)) return direct

  const endTime = readString(data.endTime)
  if (Number.isFinite(startsAt) && endTime) {
    const match = endTime.match(/(\d{1,2}):(\d{2})/)
    if (match) {
      const endDate = new Date(startsAt)
      endDate.setHours(Number(match[1]), Number(match[2]), 0, 0)
      const endMillis = endDate.getTime()
      return endMillis > startsAt ? endMillis : endMillis + 24 * 60 * 60 * 1000
    }
  }

  return Number.isFinite(startsAt) ? startsAt + DEFAULT_ACTIVITY_DURATION_MS : Number.NaN
}

function isSameDay(leftTime: number, rightTime: number) {
  const left = new Date(leftTime)
  const right = new Date(rightTime)
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function isCancelled(data: Record<string, unknown>) {
  const status = normalizeActivityText(data.status)
  return status === 'cancelled' || status === 'canceled' || status === 'cancelada' || data.cancelled === true || data.isCancelled === true
}

export function getActivityVisualState(data: Record<string, unknown>, now = Date.now()): ActivityVisualState {
  const startsAt = getActivityStartMillis(data, now)
  const endedAt = getActivityEndMillis(data, startsAt)

  if (isCancelled(data)) {
    return {
      backgroundColor: '#FFF1F1',
      borderColor: '#F0BBBB',
      color: '#A33A3A',
      endedAt,
      key: 'cancelled',
      label: 'CANCELADA',
      rank: 4,
      startsAt,
    }
  }

  if (!Number.isFinite(startsAt)) {
    return {
      backgroundColor: '#EEF5FF',
      borderColor: '#C9DCF8',
      color: '#2366B5',
      endedAt,
      key: 'upcoming',
      label: 'PRÓXIMA',
      rank: 2,
      startsAt,
    }
  }

  if (now >= startsAt && Number.isFinite(endedAt) && now <= endedAt) {
    return {
      backgroundColor: '#FFF4E5',
      borderColor: '#F5C98C',
      color: '#A85E00',
      endedAt,
      key: 'inProgress',
      label: 'EN CURSO',
      rank: 0,
      startsAt,
    }
  }

  if (now > endedAt) {
    return {
      backgroundColor: '#F0F1F0',
      borderColor: '#D7DAD7',
      color: '#666D69',
      endedAt,
      key: 'finished',
      label: 'FINALIZADA',
      rank: 3,
      startsAt,
    }
  }

  if (isSameDay(startsAt, now)) {
    return {
      backgroundColor: '#EAF8EA',
      borderColor: '#BFE2BF',
      color: '#0E7138',
      endedAt,
      key: 'today',
      label: 'HOY',
      rank: 1,
      startsAt,
    }
  }

  return {
    backgroundColor: '#EEF5FF',
    borderColor: '#C9DCF8',
    color: '#2366B5',
    endedAt,
    key: 'upcoming',
    label: 'PRÓXIMA',
    rank: 2,
    startsAt,
  }
}

function hasUserInMap(value: unknown, userId: string) {
  return typeof value === 'object' && value !== null && userId in value
}

function hasUserInList(value: unknown, userId: string) {
  if (!Array.isArray(value)) return false
  return value.some((item) => {
    if (typeof item === 'string') return item === userId
    if (typeof item === 'object' && item) {
      const record = item as Record<string, unknown>
      return readString(record.uid) === userId || readString(record.userId) === userId || readString(record.id) === userId
    }
    return false
  })
}

export function isUserInvolvedInActivity(data: Record<string, unknown>, userId: string | null | undefined) {
  if (!userId) return false
  const creatorId = readString(data.createdBy)
    || readString(data.organizerId)
    || readString(data.creatorId)
    || readString(data.ownerId)
    || readString(data.userId)
    || readString(data.createdById)

  return creatorId === userId
    || hasUserInMap(data.participants, userId)
    || hasUserInMap(data.joinedUsers, userId)
    || hasUserInMap(data.interestedUsers, userId)
    || hasUserInList(data.participants, userId)
    || hasUserInList(data.attendees, userId)
    || hasUserInList(data.members, userId)
}

export function shouldShowActivityInDiscovery(data: Record<string, unknown>, userId?: string | null, now = Date.now()) {
  const state = getActivityVisualState(data, now)
  if (state.key === 'cancelled') return isUserInvolvedInActivity(data, userId)
  if (state.key !== 'finished') return true
  if (!Number.isFinite(state.endedAt)) return true
  return now - state.endedAt <= ACTIVITY_RECENT_FINISHED_WINDOW_MS
}

export function compareActivitiesForDiscovery(left: Record<string, unknown>, right: Record<string, unknown>, now = Date.now()) {
  const leftState = getActivityVisualState(left, now)
  const rightState = getActivityVisualState(right, now)
  if (leftState.rank !== rightState.rank) return leftState.rank - rightState.rank

  const leftTime = Number.isFinite(leftState.startsAt) ? leftState.startsAt : Number.POSITIVE_INFINITY
  const rightTime = Number.isFinite(rightState.startsAt) ? rightState.startsAt : Number.POSITIVE_INFINITY
  if (leftTime !== rightTime) return leftTime - rightTime
  return 0
}

export function getActivityQuickFilterText(data: Record<string, unknown>) {
  return normalizeActivityText([
    data.categoryId,
    data.category,
    data.categoryLabel,
    data.subcategory,
    data.type,
    data.name,
    data.title,
    data.description,
    data.summary,
  ].filter(Boolean).join(' '))
}

export function matchesActivityQuickCategory(data: Record<string, unknown>, categoryId: ActivityQuickCategoryId) {
  if (categoryId === 'all') return true
  const text = getActivityQuickFilterText(data)
  const termsByCategory: Record<Exclude<ActivityQuickCategoryId, 'all'>, string[]> = {
    bike: ['ciclismo', 'bici', 'bicicleta', 'mtb', 'pedalea', 'pedale'],
    run: ['running', 'trail running', 'correr', 'corre', 'corrida', 'runner'],
    share: ['mateada', 'mate', 'cafe', 'cultura', 'hobbies', 'juegos', 'musica', 'taller', 'talleres', 'social', 'sociales', 'grupo'],
    walk: ['caminata', 'caminar', 'camina', 'trekking', 'senderismo', 'sendero'],
    wellness: ['yoga', 'meditacion', 'meditar', 'pilates', 'sup yoga', 'bienestar'],
  }

  return termsByCategory[categoryId].some((term) => text.includes(term))
}

import { serverTimestamp } from 'firebase/firestore'

import { getActivityStartMillis } from './activityDiscovery'

export type ActivityDuplicationSource = Record<string, unknown>

export type DuplicatedActivityPayload = Record<string, unknown>

const COPY_FIELDS = [
  'name',
  'customName',
  'optionalName',
  'category',
  'categoryId',
  'categoryColor',
  'categoryIcon',
  'subcategory',
  'description',
  'time',
  'location',
  'locationAddress',
  'locationLatitude',
  'locationLongitude',
  'locationPin',
  'city',
  'groupId',
  'groupName',
  'visibility',
  'additionalSettings',
  'maxParticipants',
  'level',
  'environment',
  'cost',
  'price',
  'currency',
  'privacy',
  'quickSettings',
  'imageUrl',
  'photoUrl',
  'photoURL',
  'coverImage',
  'coverUrl',
  'coverURL',
  'image',
  'imageUri',
  'imageURL',
  'thumbnailUrl',
] as const

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function clonePlainValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clonePlainValue)
  if (value instanceof Date) return new Date(value.getTime())
  if (typeof value === 'object' && value !== null && !('toDate' in value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, clonePlainValue(item)]),
    )
  }

  return value
}

export function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function addCalendarDays(value: Date, days: number) {
  const nextDate = startOfLocalDay(value)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

export function formatActivityDate(value: Date) {
  const day = String(value.getDate()).padStart(2, '0')
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const year = value.getFullYear()

  return `${day}/${month}/${year}`
}

export function formatLongActivityDate(value: Date) {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(value)
}

function dateFromUnknown(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return startOfLocalDay(value)
  if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
    const parsed = value.toDate() as Date
    if (!Number.isNaN(parsed.getTime())) return startOfLocalDay(parsed)
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return startOfLocalDay(parsed)
  }

  return null
}

function parseLocalDateText(value: unknown) {
  const raw = readString(value)
  const match = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(raw)
  if (!match) return null

  const today = new Date()
  const yearValue = match[3] ? Number(match[3]) : today.getFullYear()
  const year = yearValue < 100 ? 2000 + yearValue : yearValue
  const month = Number(match[2])
  const day = Number(match[1])
  const parsed = new Date(year, month - 1, day)

  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null
  }

  return startOfLocalDay(parsed)
}

export function getActivitySourceDate(activity: ActivityDuplicationSource) {
  return dateFromUnknown(activity.activityDate)
    ?? dateFromUnknown(activity.activityDateISO)
    ?? dateFromUnknown(activity.startAt)
    ?? dateFromUnknown(activity.startsAt)
    ?? dateFromUnknown(activity.dateTime)
    ?? parseLocalDateText(activity.date)
    ?? (() => {
      const startsAt = getActivityStartMillis(activity)
      return Number.isFinite(startsAt) ? startOfLocalDay(new Date(startsAt)) : null
    })()
}

export function buildDuplicatedActivityPayload(
  activity: ActivityDuplicationSource,
  newDate: Date,
  creatorId: string,
): DuplicatedActivityPayload {
  const activityDate = startOfLocalDay(newDate)
  const payload: DuplicatedActivityPayload = {}

  COPY_FIELDS.forEach((field) => {
    if (activity[field] !== undefined) {
      payload[field] = clonePlainValue(activity[field])
    }
  })

  return {
    ...payload,
    date: formatActivityDate(activityDate),
    activityDate,
    activityDateISO: activityDate.toISOString(),
    interestedUsers: {},
    interestedCount: 0,
    createdBy: creatorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

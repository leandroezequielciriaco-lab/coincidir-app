function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalize(value: unknown) {
  return readString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getPrimaryTitleCandidate(data: Record<string, unknown>) {
  return readString(
    data.activityLabel,
    readString(
      data.selectedActivity,
      readString(
        data.activity,
        readString(
          data.subcategory,
          readString(data.categoryLabel, readString(data.category)),
        ),
      ),
    ),
  )
}

function readRecord(value: unknown) {
  return typeof value === 'object' && value ? value as Record<string, unknown> : {}
}

export function getActivityPrimaryTitle(data: Record<string, unknown>, fallback = 'Actividad sin título') {
  return getPrimaryTitleCandidate(data)
    || readString(data.name, readString(data.title, fallback))
}

export function getActivityCustomName(data: Record<string, unknown>) {
  const additionalSettings = readRecord(data.additionalSettings)
  const explicitCustomName = readString(
    data.customName,
    readString(
      data.optionalName,
      readString(
        data.activityCustomName,
        readString(
          data.customTitle,
          readString(additionalSettings.customName, readString(additionalSettings.optionalName)),
        ),
      ),
    ),
  )
  if (explicitCustomName) return explicitCustomName

  const legacyName = readString(data.name)
  const primaryTitle = getPrimaryTitleCandidate(data)

  if (legacyName && primaryTitle && normalize(legacyName) !== normalize(primaryTitle)) {
    return legacyName
  }

  return ''
}

export function getActivitySubtitle(data: Record<string, unknown>) {
  return getActivityCustomName(data)
}

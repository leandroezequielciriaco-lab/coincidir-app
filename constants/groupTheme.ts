export const defaultGroupColor = '#4B348A'

export const groupTheme = {
  color: defaultGroupColor,
  borderColor: '#DCD2F2',
  backgroundColor: '#F7F3FF',
  chipBackgroundColor: '#F4EEFF',
  chipBorderColor: '#D8C8F0',
  chipTextColor: '#3A256A',
}

export function getGroupTheme(groupColor?: string) {
  return {
    ...groupTheme,
    color: groupColor?.trim() || groupTheme.color,
  }
}

import type { LucideIcon } from 'lucide-react-native'
import type { ImageSourcePropType } from 'react-native'

import type { ActivityVisualState } from '../../utils/activityDiscovery'

export type ThemeTone = 'green' | 'violet'

export type ActivityCardItem = {
  id: string
  recordId: string
  title: string
  subtitle?: string
  customName?: string
  optionalName?: string
  image: ImageSourcePropType
  dateBadge: string
  people: string
  category: string
  dateTime: string
  location: string
  organizer: string
  groupColor?: string
  groupId?: string
  groupImageUrl?: string
  groupName?: string
  iconLabel: string
  cta: string
  action: 'join' | 'interest'
  isCancelled?: boolean
  isOrganizer?: boolean
  visualState?: ActivityVisualState
  Icon: LucideIcon
}

export type PrivateCardItem = {
  id: string
  recordId: string
  title: string
  image: ImageSourcePropType
  capacity: string
  dateTime: string
  place: string
  cta: string
  Icon: LucideIcon
}

export type SuggestionCardItem = {
  id: string
  recordId: string
  source: 'activity' | 'group'
  title: string
  capacity: string
  location: string
  schedule: string
  cta: string
  tone: ThemeTone
  Icon: LucideIcon
}

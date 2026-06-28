import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image as ExpoImage } from 'expo-image'
import {
  ActivityIndicator,
  FlatList,
  ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type ViewStyle,
  useWindowDimensions,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, deleteField, doc, getDoc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import {
  CalendarCheck,
  CalendarDays,
  DollarSign,
  Dumbbell,
  Filter,
  Leaf,
  MapPin,
  Mountain,
  Search,
  SlidersHorizontal,
  Star,
  Sprout,
  UsersRound,
  Waves,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { GroupAvatar } from '../../components/groups/GroupAvatar'
import { ActivityQuickCategoryRow } from '../../components/home/ActivityQuickCategoryRow'
import { PressScale } from '../../components/home/PressScale'
import { activityCategories, type ActivityCategoryId } from '../../constants/activityCategories'
import { getGroupTheme } from '../../constants/groupTheme'
import {
  type LocalGroup,
  LOCAL_GROUPS_STORAGE_KEY,
  readStoredLocalGroups,
} from '../../constants/localGroups'
import { getFirebaseServices } from '../../firebaseConfig'
import { readRemoteGroupPhotoUrl } from '../../lib/groupPhotos'
import { notifyActivityInterest, notifyActivityJoined } from '../../lib/notifications'
import { getActivityRecommendationScore, getActivityRecommendationTerms } from '../../lib/recommendations'
import { getActivityGroupMeta } from '../../utils/activityGroups'
import { isOwnActivity } from '../../utils/activityOwnership'
import { getActivityCustomName, getActivityPrimaryTitle, getActivitySubtitle } from '../../utils/activityTitles'
import { EMAIL_VERIFICATION_REQUIRED_MESSAGE, requireVerifiedParticipation } from '../../utils/authParticipation'
import {
  compareActivitiesForDiscovery,
  getActivityVisualState,
  matchesActivityQuickCategory,
  shouldShowActivityInDiscovery,
  type ActivityQuickCategoryId,
  type ActivityVisualState,
} from '../../utils/activityDiscovery'
import { defaultActivityImage, getCategoryImage } from '../../utils/categoryImages'
import { formatGroupMemberCount, getGroupMemberCount, isDeletedGroup } from '../../utils/groupMembership'
import { resolveUserDisplayName } from '../../utils/userNames'

type RecordItem = {
  id: string
  source: 'activity' | 'group'
  data: Record<string, unknown>
}

type SortMode = 'recommended' | 'recent' | 'popular'
type GroupImageUrlsByKey = Record<string, string>
type QuickFilterItem = {
  id: 'all' | ActivityCategoryId
  label: string
}
type AdvancedFilters = {
  category: string
  date: string
  distance: string
  location: string
  price: string
  sort: SortMode
}

type ExploreCardItem = {
  id: string
  recordId: string
  source: 'activity' | 'group'
  title: string
  subtitle?: string
  customName?: string
  optionalName?: string
  capacity: string
  location: string
  schedule: string
  groupColor?: string
  groupId?: string
  groupImageUrl?: string
  groupName?: string
  cta: string
  image: ImageSourcePropType
  isCancelled?: boolean
  visualState?: ActivityVisualState
  Icon: LucideIcon
  action?: 'interest' | 'join'
  isOrganizer?: boolean
}

type ParticipationState = {
  count: number
  active: boolean
}

const quickCategoryLabels: Record<ActivityCategoryId, string> = {
  culture: 'Cultura',
  groups: 'Sociales',
  hobbies: 'Juegos',
  outdoor: 'Aire libre',
  sports: 'Deportes',
  training: 'Entrenamiento',
  wellness: 'Bienestar',
}

const quickCategoryLegacyTerms: Record<ActivityCategoryId, string[]> = {
  culture: ['Cultura'],
  groups: ['Sociales', 'Grupo', 'Grupales'],
  hobbies: ['Juegos', 'Hobbies'],
  outdoor: ['Aire libre', 'Al aire libre', 'Outdoor'],
  sports: ['Deportes', 'Sports'],
  training: ['Entrenamiento', 'Movimiento'],
  wellness: ['Bienestar', 'Wellness'],
}

const quickFilters: QuickFilterItem[] = [
  { id: 'all', label: 'Todas' },
  ...activityCategories.map((category) => ({
    id: category.id,
    label: quickCategoryLabels[category.id],
  })),
]
const categoryFilters = ['Todas', 'Aire libre', 'Deportes', 'Entrenamiento', 'Bienestar', 'Sociales', 'Cultura', 'Juegos']
const dateFilters = ['Todas', 'Hoy', 'Esta semana']
const priceFilters = ['Todos', 'Gratis', 'Pago']
const locationFilters = ['Todas', 'Tandil', 'Buenos Aires', 'Mar del Plata', 'Córdoba', 'Rosario']
const distanceFilters = ['Sin distancia', '1 km', '5 km', '10 km', '25 km']

const initialAdvancedFilters: AdvancedFilters = {
  category: 'Todas',
  date: 'Todas',
  distance: 'Sin distancia',
  location: 'Todas',
  price: 'Todos',
  sort: 'recommended',
}
const webHorizontalScrollStyle = Platform.OS === 'web'
  ? ({ overflowX: 'auto', overflowY: 'hidden' } as ViewStyle & { overflowX: 'auto'; overflowY: 'hidden' })
  : undefined

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function isCancelled(data: Record<string, unknown>) {
  return readString(data.status) === 'cancelled'
}

function normalize(value: unknown) {
  return readString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getAdditionalSettings(data: Record<string, unknown>) {
  return typeof data.additionalSettings === 'object' && data.additionalSettings
    ? data.additionalSettings as Record<string, unknown>
    : {}
}

function getParticipantCount(data: Record<string, unknown>) {
  const participantsCount = readNumber(data.participantsCount, readNumber(data.membersCount, -1))
  if (participantsCount >= 0) return participantsCount

  const joinedUsers = data.joinedUsers
  if (typeof joinedUsers === 'object' && joinedUsers) return Object.keys(joinedUsers).length

  const participants = data.participants ?? data.members
  if (typeof participants === 'object' && participants) return Object.keys(participants).length
  return Array.isArray(participants) ? participants.length : 0
}

function getInterestedCount(data: Record<string, unknown>) {
  const interestedCount = readNumber(data.interestedCount, -1)
  if (interestedCount >= 0) return interestedCount

  const interestedUsers = data.interestedUsers
  if (typeof interestedUsers === 'object' && interestedUsers) return Object.keys(interestedUsers).length
  return 0
}

function hasUserInMap(value: unknown, userId: string) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && userId in value
}

function hasUserInList(value: unknown, userId: string) {
  return Array.isArray(value) && value.some((item) => item === userId || (typeof item === 'object' && item !== null && 'uid' in item && item.uid === userId))
}

function isUserJoined(data: Record<string, unknown>, userId: string | null) {
  if (!userId) return false

  return hasUserInMap(data.participants, userId)
    || hasUserInMap(data.joinedUsers, userId)
    || hasUserInList(data.participants, userId)
    || hasUserInList(data.attendees, userId)
    || hasUserInList(data.members, userId)
}

function isUserInterested(data: Record<string, unknown>, userId: string | null) {
  return Boolean(userId && hasUserInMap(data.interestedUsers, userId))
}

function getCreatorId(data: Record<string, unknown>) {
  return readString(data.createdBy)
    || readString(data.organizerId)
    || readString(data.creatorId)
    || readString(data.ownerId)
    || readString(data.userId)
    || readString(data.createdById)
}

function requiresInterestAction(data: Record<string, unknown>) {
  const settings = getAdditionalSettings(data)
  const privacy = normalize(settings.privacy)
  const visibility = normalize(readString(data.visibility, readString(settings.visibility)))
  const detail = normalize([
    settings.quickSettings,
    data.quickSettings,
    data.participationMode,
    data.joinMode,
    data.type,
  ].flat().filter(Boolean).join(' '))

  return privacy.includes('aprobacion')
    || visibility.includes('approval')
    || detail.includes('aprobacion')
    || detail.includes('solicitud')
    || detail.includes('coordinar')
    || detail.includes('cerrad')
}

function getParticipationState(
  item: RecordItem,
  userId: string | null,
  optimisticState: Record<string, boolean>,
  type: 'interest' | 'join',
): ParticipationState {
  const persistedActive = type === 'interest'
    ? isUserInterested(item.data, userId)
    : isUserJoined(item.data, userId)
  const key = `${type}:${item.id}`
  const active = key in optimisticState ? optimisticState[key] : persistedActive
  const count = type === 'interest' ? getInterestedCount(item.data) : getParticipantCount(item.data)
  const countDelta = active === persistedActive ? 0 : active ? 1 : -1

  return { active, count: Math.max(0, count + countDelta) }
}

function getCurrentAuthUserId() {
  try {
    const { auth } = getFirebaseServices()
    return auth.currentUser?.uid ?? null
  } catch {
    return null
  }
}

function logWebCtaStep(label: string, action: 'join' | 'interest' | 'open' | undefined, activityId: string, userId: string | null, reason?: string) {
  if (Platform.OS !== 'web') return

  console.log(label, {
    source: 'explorar',
    action: action ?? 'open',
    activityId,
    userId,
    reason,
    platform: Platform.OS,
  })
}

function getMaxParticipants(data: Record<string, unknown>) {
  return Math.max(1, readNumber(getAdditionalSettings(data).maxParticipants, readNumber(data.maxParticipants, 10)))
}

function getGroupMeta(data: Record<string, unknown>, localGroups: LocalGroup[] = []) {
  return getActivityGroupMeta(data, localGroups)
}

function getGroupLookupKey(value: string) {
  return normalize(value)
}

function getGroupImageUrl(groupMeta: { groupId?: string; groupName?: string }, groupImageUrlsByKey: GroupImageUrlsByKey) {
  return groupImageUrlsByKey[groupMeta.groupId ?? '']
    || groupImageUrlsByKey[getGroupLookupKey(groupMeta.groupName ?? '')]
    || ''
}

function getRecordTime(item: RecordItem) {
  const value = item.data.createdAt ?? item.data.updatedAt
  return typeof value === 'object' && value && 'toMillis' in value && typeof value.toMillis === 'function'
    ? value.toMillis()
    : 0
}

function getSearchText(item: RecordItem) {
  const data = item.data
  if (item.source === 'activity') {
    return normalize([item.source, ...getActivityRecommendationTerms(data), data.customName, data.optionalName, data.location, data.city].join(' '))
  }

  return normalize([
    item.source,
    data.name,
    data.title,
    data.categoryId,
    data.category,
    data.categoryLabel,
    data.subcategory,
    data.location,
    data.city,
    data.description,
    data.summary,
  ].filter(Boolean).join(' '))
}

function matchesSearch(item: RecordItem, query: string) {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return true

  const text = getSearchText(item)
  return normalizedQuery.split(/\s+/).filter(Boolean).every((token) => text.includes(token))
}

function matchesDate(item: RecordItem, filter: string) {
  if (filter === 'Todas') return true
  if (item.source === 'activity' && filter === 'Hoy') {
    const state = getActivityVisualState(item.data)
    return state.key === 'today' || state.key === 'inProgress'
  }
  const date = normalize(item.data.date)
  if (filter === 'Hoy') return date.includes('hoy')
  return date.includes('semana') || date.includes('sab') || date.includes('dom') || date.includes('manana')
}

function matchesPrice(item: RecordItem, filter: string) {
  if (filter === 'Todos') return true
  const settings = getAdditionalSettings(item.data)
  const cost = normalize(settings.cost || item.data.cost || 'gratis')

  if (filter === 'Gratis') return cost.includes('gratis')
  return !cost.includes('gratis')
}

function matchesCategory(item: RecordItem, filter: string) {
  if (filter === 'Todas') return true
  const text = getSearchText(item)
  const aliases: Record<string, string[]> = {
    'aire libre': ['aire libre', 'outdoor', 'caminata', 'trekking'],
    bienestar: ['bienestar', 'yoga', 'meditacion'],
    deportes: ['deportes', 'running', 'paddle', 'futbol', 'tenis'],
    entrenamiento: ['entrenamiento', 'movimiento', 'funcional', 'crossfit', 'pilates'],
    sociales: ['sociales', 'grupo', 'grupales', 'mate'],
    cultura: ['cultura', 'arte', 'aprendizaje', 'musica', 'teatro', 'idiomas'],
    juegos: ['juegos', 'hobbies', 'ajedrez', 'gaming'],
  }
  const normalizedFilter = normalize(filter)
  const terms = aliases[normalizedFilter] ?? [normalizedFilter]

  return terms.some((term) => text.includes(term))
}

function matchesCategoryId(item: RecordItem, categoryId: ActivityCategoryId) {
  const category = activityCategories.find((item) => item.id === categoryId)
  if (!category) return false

  const data = item.data
  const recordCategoryId = normalize(data.categoryId)
  if (recordCategoryId === categoryId) return true

  const terms = [
    category.id,
    category.label,
    quickCategoryLabels[category.id],
    ...(category.legacyLabels ?? []),
    ...quickCategoryLegacyTerms[category.id],
  ].map(normalize)
  const legacyCategoryText = normalize([
    data.category,
    data.categoryLabel,
  ].filter(Boolean).join(' '))

  if (terms.some((term) => term && legacyCategoryText.includes(term))) return true

  const text = getSearchText(item)
  return terms.some((term) => term && text.includes(term))
}

function matchesLocation(item: RecordItem, filter: string) {
  if (filter === 'Todas') return true
  return normalize([item.data.city, item.data.location].filter(Boolean).join(' ')).includes(normalize(filter))
}

function matchesQuickFilter(item: RecordItem, filter: QuickFilterItem) {
  if (filter.id === 'all') return true
  return matchesCategoryId(item, filter.id)
}

function sortRecords(items: RecordItem[], sort: SortMode, userInterests: unknown[] = []) {
  return [...items].sort((left, right) => {
    if (left.source === 'activity' && right.source === 'activity') {
      const activityDiff = compareActivitiesForDiscovery(left.data, right.data)
      if (activityDiff !== 0) return activityDiff
    }
    if (left.source !== right.source) {
      if (left.source === 'activity') return -1
      if (right.source === 'activity') return 1
    }

    if (sort === 'popular') {
      const leftCount = left.source === 'group' ? getGroupMemberCount(left.data) : getParticipantCount(left.data)
      const rightCount = right.source === 'group' ? getGroupMemberCount(right.data) : getParticipantCount(right.data)
      return rightCount - leftCount
    }
    if (sort === 'recommended') {
      const scoreDiff =
        getActivityRecommendationScore(right.data, userInterests)
        - getActivityRecommendationScore(left.data, userInterests)

      if (scoreDiff !== 0) return scoreDiff
    }

    return getRecordTime(right) - getRecordTime(left)
  })
}

function getIcon(item: RecordItem): LucideIcon {
  const text = getSearchText(item)
  if (item.source === 'group') return UsersRound
  if (text.includes('yoga') || text.includes('bienestar')) return Leaf
  if (text.includes('paddle') || text.includes('natacion') || text.includes('kayak')) return Waves
  if (text.includes('aire libre') || text.includes('outdoor') || text.includes('trekking')) return Mountain
  if (text.includes('deporte') || text.includes('running') || text.includes('futbol')) return Dumbbell
  return Sprout
}

function getCardImage(item: RecordItem) {
  return getCategoryImage(item.source === 'group' ? { category: 'Grupales', ...item.data } : item.data)
}

function getQuickIcon(filter: QuickFilterItem): LucideIcon {
  if (filter.id === 'outdoor') return Leaf
  if (filter.id === 'sports') return Dumbbell
  if (filter.id === 'training') return CalendarDays
  if (filter.id === 'wellness') return Sprout
  if (filter.id === 'groups') return UsersRound
  if (filter.id === 'culture') return Star
  if (filter.id === 'hobbies') return DollarSign
  return Leaf
}

function mapExploreCard(
  item: RecordItem,
  currentUserId: string | null,
  optimisticJoins: Record<string, boolean>,
  optimisticInterests: Record<string, boolean>,
  localGroups: LocalGroup[] = [],
  groupImageUrlsByKey: GroupImageUrlsByKey = {},
): ExploreCardItem {
  const data = item.data
  const isGroup = item.source === 'group'
  const action = !isGroup && requiresInterestAction(data) ? 'interest' : 'join'
  const participationState = !isGroup
    ? getParticipationState(item, currentUserId, action === 'interest' ? optimisticInterests : optimisticJoins, action)
    : { active: false, count: getParticipantCount(data) }
  const count = participationState.count
  const max = getMaxParticipants(data)
  const cancelled = item.source === 'activity' && isCancelled(data)
  const groupMeta = isGroup ? { groupColor: '', groupId: '', groupName: '' } : getGroupMeta(data, localGroups)
  const organizer = item.source === 'activity' && isOwnActivity(data, currentUserId)
  const title = isGroup
    ? readString(data.name, readString(data.title, 'Grupo sin título'))
    : getActivityPrimaryTitle(data)
  const subtitle = isGroup ? undefined : getActivitySubtitle(data)
  const customName = isGroup ? undefined : getActivityCustomName(data)
  const optionalName = isGroup ? undefined : readString(data.optionalName)

  return {
    id: `${item.source}-${item.id}`,
    recordId: item.id,
    source: item.source,
    title,
    subtitle,
    customName,
    optionalName,
    capacity: isGroup ? formatGroupMemberCount(getGroupMemberCount(data)) : `${count}/${max}`,
    location: readString(data.location, readString(data.city, 'Ubicación a definir')),
    schedule: isGroup
      ? readString(data.schedule, 'Próximo encuentro a definir')
      : `${readString(data.date, 'Fecha a definir')}${readString(data.time) ? ` ${readString(data.time)}` : ''}`,
    groupColor: groupMeta.groupColor,
    groupId: groupMeta.groupId,
    groupImageUrl: isGroup ? readRemoteGroupPhotoUrl(data) : getGroupImageUrl(groupMeta, groupImageUrlsByKey),
    groupName: groupMeta.groupName,
    cta: cancelled
      ? 'Cancelada'
      : isGroup
        ? 'Ver grupo'
        : organizer
          ? 'Tu actividad'
          : action === 'interest'
            ? participationState.active ? '✓ Te interesa' : 'Me interesa'
            : participationState.active ? '✓ Te sumaste' : 'Me sumo',
    image: getCardImage(item),
    isCancelled: cancelled,
    isOrganizer: organizer,
    action: isGroup ? undefined : action,
    visualState: item.source === 'activity' ? getActivityVisualState(data) : undefined,
    Icon: getIcon(item),
  }
}

export default function ExplorarScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [records, setRecords] = useState<RecordItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilterItem>(quickFilters[0])
  const [filters, setFilters] = useState<AdvancedFilters>(initialAdvancedFilters)
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(initialAdvancedFilters)
  const [isFilterVisible, setIsFilterVisible] = useState(false)
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState('')
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [userInterests, setUserInterests] = useState<unknown[]>([])
  const [activeQuickCategory, setActiveQuickCategory] = useState<ActivityQuickCategoryId>('all')
  const [localGroups, setLocalGroups] = useState<LocalGroup[]>([])
  const [optimisticJoins, setOptimisticJoins] = useState<Record<string, boolean>>({})
  const [optimisticInterests, setOptimisticInterests] = useState<Record<string, boolean>>({})
  const [pendingParticipationKeys, setPendingParticipationKeys] = useState<string[]>([])
  const [participationMessage, setParticipationMessage] = useState('')
  const isWeb = Platform.OS === 'web'
  const webCarouselGap = 16
  const webCarouselPeek = 64
  const webCarouselWidth = width >= 900
    ? Math.floor((Math.min(width, 760) - webCarouselGap - webCarouselPeek) / 2)
    : Math.min(320, Math.max(252, width - 104))
  const carouselCardWidth = isWeb ? webCarouselWidth : Math.min(300, Math.max(236, width - 104))
  const carouselSnapInterval = carouselCardWidth + 14

  const loadLocalGroups = useCallback(async () => {
    try {
      const storedValue = await AsyncStorage.getItem(LOCAL_GROUPS_STORAGE_KEY)
      setLocalGroups(readStoredLocalGroups(storedValue))
    } catch (error) {
      if (__DEV__) console.warn('[Explorar] error leyendo grupos locales', error)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadLocalGroups()
    }, [loadLocalGroups]),
  )

  useEffect(() => {
    let mounted = true
    let unsubscribe = () => {}

    try {
      const { auth, db } = getFirebaseServices()
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!mounted) return

        if (!user) {
          setCurrentUserId(null)
          setCurrentUserName('')
          setCurrentUserEmail('')
          setUserInterests([])
          return
        }

        setCurrentUserId(user.uid)
        setCurrentUserEmail(user.email?.trim() ?? '')

        try {
          const profileSnap = await getDoc(doc(db, 'users', user.uid))
          const profile = profileSnap.exists() ? profileSnap.data() : null
          if (mounted) {
            setUserInterests(Array.isArray(profile?.interests) ? profile.interests : [])
            setCurrentUserName(resolveUserDisplayName({
              email: user.email,
              fallback: '',
              firebaseUser: user,
              profile,
            }))
          }
        } catch {
          if (mounted) {
            setCurrentUserName(resolveUserDisplayName({ firebaseUser: user, fallback: '' }))
            setUserInterests([])
          }
        }
      })
    } catch {
      setCurrentUserName('')
      setCurrentUserEmail('')
      setUserInterests([])
    }

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let activities: RecordItem[] = []
    let groups: RecordItem[] = []

    try {
      const { db } = getFirebaseServices()
      const publish = () => {
        setRecords(sortRecords([...activities, ...groups], 'recent'))
        setIsLoading(false)
      }
      const unsubscribeActivities = onSnapshot(collection(db, 'activities'), (snapshot) => {
        activities = snapshot.docs.map((item) => ({ id: item.id, source: 'activity', data: item.data() as Record<string, unknown> }))
        publish()
      }, () => setIsLoading(false))
      const unsubscribeGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
        groups = snapshot.docs
          .map((item) => ({ id: item.id, source: 'group' as const, data: item.data() as Record<string, unknown> }))
          .filter((item) => !isDeletedGroup(item.data))
        publish()
      }, () => setIsLoading(false))

      return () => {
        unsubscribeActivities()
        unsubscribeGroups()
      }
    } catch {
      setIsLoading(false)
      return undefined
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 220)
    return () => clearTimeout(timeout)
  }, [query])

  const filteredRecords = useMemo(() => {
    const filtered = records.filter((item) =>
      matchesSearch(item, debouncedQuery)
      && (activeQuickCategory === 'all' || matchesActivityQuickCategory(item.data, activeQuickCategory))
      && (item.source !== 'activity' || shouldShowActivityInDiscovery(item.data, currentUserId))
      && matchesQuickFilter(item, quickFilter)
      && matchesDate(item, filters.date)
      && matchesPrice(item, filters.price)
      && matchesCategory(item, filters.category)
      && matchesLocation(item, filters.location),
    )

    return sortRecords(filtered, filters.sort, userInterests)
  }, [activeQuickCategory, currentUserId, debouncedQuery, filters, quickFilter, records, userInterests])

  const groupImageUrlsByKey = useMemo(() => {
    const nextImages: GroupImageUrlsByKey = {}

    records.forEach((item) => {
      if (item.source !== 'group') return

      const imageUrl = readRemoteGroupPhotoUrl(item.data)
      if (!imageUrl) return

      nextImages[item.id] = imageUrl
      const nameKey = getGroupLookupKey(readString(item.data.name, readString(item.data.title)))
      if (nameKey) nextImages[nameKey] = imageUrl
    })

    return nextImages
  }, [records])

  const cards = useMemo(
    () => filteredRecords.map((item) => mapExploreCard(item, currentUserId, optimisticJoins, optimisticInterests, localGroups, groupImageUrlsByKey)),
    [currentUserId, filteredRecords, groupImageUrlsByKey, localGroups, optimisticInterests, optimisticJoins],
  )

  const getVisibleCurrentUserName = () => resolveUserDisplayName({
    email: currentUserEmail,
    fallback: 'Usuario',
    profile: currentUserName ? { fullName: currentUserName } : null,
  })

  const toggleActivityParticipation = async (item: ExploreCardItem) => {
    if (!currentUserId) {
      logWebCtaStep('[WEB CTA EARLY RETURN]', item.action, item.recordId, getCurrentAuthUserId(), 'missing_user')
      return
    }
    if (item.source !== 'activity') {
      logWebCtaStep('[WEB CTA EARLY RETURN]', item.action, item.recordId, currentUserId, 'not_activity')
      return
    }
    if (item.isCancelled) {
      logWebCtaStep('[WEB CTA EARLY RETURN]', item.action, item.recordId, currentUserId, 'cancelled')
      return
    }
    if (item.isOrganizer) {
      logWebCtaStep('[WEB CTA EARLY RETURN]', item.action, item.recordId, currentUserId, 'organizer')
      return
    }
    if (!item.action) {
      logWebCtaStep('[WEB CTA EARLY RETURN]', item.action, item.recordId, currentUserId, 'missing_action')
      return
    }

    const record = records.find((recordItem) => recordItem.source === 'activity' && recordItem.id === item.recordId)
    if (!record) {
      logWebCtaStep('[WEB CTA EARLY RETURN]', item.action, item.recordId, currentUserId, 'missing_record')
      return
    }

    const key = `${item.action}:${record.id}`
    if (pendingParticipationKeys.includes(key)) {
      logWebCtaStep('[WEB CTA EARLY RETURN]', item.action, item.recordId, currentUserId, 'pending')
      return
    }

    const { auth } = getFirebaseServices()
    logWebCtaStep('[WEB CTA VERIFIED]', item.action, item.recordId, currentUserId, 'start')
    if (!(await requireVerifiedParticipation(auth))) {
      logWebCtaStep('[WEB CTA EARLY RETURN]', item.action, item.recordId, auth.currentUser?.uid ?? currentUserId, 'verification_failed')
      setParticipationMessage(EMAIL_VERIFICATION_REQUIRED_MESSAGE)
      return
    }
    logWebCtaStep('[WEB CTA VERIFIED]', item.action, item.recordId, auth.currentUser?.uid ?? currentUserId, 'success')

    const optimisticSetter = item.action === 'interest' ? setOptimisticInterests : setOptimisticJoins
    const currentState = getParticipationState(
      record,
      currentUserId,
      item.action === 'interest' ? optimisticInterests : optimisticJoins,
      item.action,
    )
    const nextActive = !currentState.active

    setParticipationMessage('')
    optimisticSetter((current) => ({ ...current, [key]: nextActive }))
    setPendingParticipationKeys((current) => [...current, key])
    logWebCtaStep('[WEB CTA STATE UPDATE]', item.action, item.recordId, currentUserId, nextActive ? 'optimistic_true' : 'optimistic_false')

    try {
      const { db } = getFirebaseServices()
      const targetRef = doc(db, 'activities', record.id)

      logWebCtaStep('[WEB CTA WRITE START]', item.action, item.recordId, currentUserId, 'activities')
      const result = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(targetRef)
        if (!snapshot.exists()) return 'missing_record'

        const data = snapshot.data() as Record<string, unknown>
        if (isOwnActivity(data, currentUserId)) return 'organizer'
        if (isCancelled(data)) return 'cancelled'

        if (item.action === 'interest') {
          const wasInterested = isUserInterested(data, currentUserId)
          const nextCount = Math.max(0, getInterestedCount(data) + (wasInterested ? -1 : 1))
          transaction.update(targetRef, wasInterested
            ? {
              [`interestedUsers.${currentUserId}`]: deleteField(),
              interestedCount: nextCount,
              updatedAt: serverTimestamp(),
            }
            : {
              [`interestedUsers.${currentUserId}`]: {
                interestedAt: serverTimestamp(),
                name: getVisibleCurrentUserName(),
                status: 'interested',
                uid: currentUserId,
              },
              interestedCount: nextCount,
              updatedAt: serverTimestamp(),
            })
          return wasInterested ? 'uninterested' : {
            organizerId: getCreatorId(data),
            status: 'interested',
            title: readString(data.name, readString(data.title, 'tu actividad')),
          }
        }

        const wasJoined = isUserJoined(data, currentUserId)
        const nextCount = Math.max(0, getParticipantCount(data) + (wasJoined ? -1 : 1))
        transaction.update(targetRef, wasJoined
          ? {
            [`joinedUsers.${currentUserId}`]: deleteField(),
            [`participants.${currentUserId}`]: deleteField(),
            participantsCount: nextCount,
            updatedAt: serverTimestamp(),
          }
          : {
            [`joinedUsers.${currentUserId}`]: true,
            [`participants.${currentUserId}`]: {
              joinedAt: serverTimestamp(),
              name: getVisibleCurrentUserName(),
              status: 'joined',
              uid: currentUserId,
            },
            participantsCount: nextCount,
            updatedAt: serverTimestamp(),
          })
        return wasJoined ? 'left' : {
          organizerId: getCreatorId(data),
          status: 'joined',
          title: readString(data.name, readString(data.title, 'tu actividad')),
        }
      })

      if (result === 'missing_record') {
        logWebCtaStep('[WEB CTA EARLY RETURN]', item.action, item.recordId, currentUserId, 'missing_record_in_transaction')
      }
      if (result === 'organizer') {
        logWebCtaStep('[WEB CTA EARLY RETURN]', item.action, item.recordId, currentUserId, 'organizer_in_transaction')
      }
      if (result === 'cancelled') {
        logWebCtaStep('[WEB CTA EARLY RETURN]', item.action, item.recordId, currentUserId, 'cancelled_in_transaction')
      }
      logWebCtaStep('[WEB CTA WRITE SUCCESS]', item.action, item.recordId, currentUserId, String(result ?? 'no_result'))

      if (typeof result === 'object' && result.status === 'interested') {
        notifyActivityInterest({
          activityId: item.recordId,
          activityTitle: result.title,
          interestedUserId: currentUserId,
          interestedUserName: getVisibleCurrentUserName(),
          organizerId: result.organizerId,
        }).catch((error) => {
          if (__DEV__) console.warn('explore-interest-notification-create-error', error)
        })
      }

      if (typeof result === 'object' && result.status === 'joined') {
        notifyActivityJoined({
          activityId: item.recordId,
          activityTitle: result.title,
          joinedUserId: currentUserId,
          joinedUserName: getVisibleCurrentUserName(),
          organizerId: result.organizerId,
        }).catch((error) => {
          if (__DEV__) console.warn('explore-joined-notification-create-error', error)
        })
      }
    } catch (error) {
      if (Platform.OS === 'web') {
        const ctaError = error as { code?: string; message?: string }
        console.warn('[WEB CTA ERROR]', {
          source: 'explorar',
          action: item.action,
          activityId: item.recordId,
          userId: getCurrentAuthUserId(),
          platform: Platform.OS,
          errorCode: ctaError?.code,
          errorMessage: ctaError?.message,
        })
      }
      setParticipationMessage(
        item.action === 'interest'
          ? 'No pudimos registrar tu interés. Intentá nuevamente.'
          : 'No pudimos actualizar tu participación. Intentá nuevamente.',
      )
      logWebCtaStep('[WEB CTA STATE UPDATE]', item.action, item.recordId, getCurrentAuthUserId(), 'rollback')
      optimisticSetter((current) => ({ ...current, [key]: currentState.active }))
    } finally {
      setPendingParticipationKeys((current) => current.filter((pendingKey) => pendingKey !== key))
    }
  }

  const openFilters = () => {
    setDraftFilters(filters)
    setIsFilterVisible(true)
  }

  const applyFilters = () => {
    setFilters(draftFilters)
    setIsFilterVisible(false)
  }

  const resetFilters = () => {
    setDraftFilters(initialAdvancedFilters)
    setFilters(initialAdvancedFilters)
    setQuickFilter(quickFilters[0])
    setQuery('')
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.content, Platform.OS === 'web' && styles.webContent]} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Explorar</Text>
            <Text style={styles.subtitle}>Descubrí actividades, grupos y lugares 🌿</Text>
          </View>
          <PressScale accessibilityLabel="Abrir filtros" accessibilityRole="button" onPress={openFilters} style={styles.filterButton} scaleTo={0.94}>
            <SlidersHorizontal color="#063C31" size={24} strokeWidth={2.2} />
          </PressScale>
        </View>

        <View style={styles.searchCard}>
          <Search color="#05372D" size={22} strokeWidth={2.1} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Buscar actividades, grupos o lugares..."
            placeholderTextColor="#85858B"
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>

        <View style={styles.activityQuickBlock}>
          <ActivityQuickCategoryRow activeId={activeQuickCategory} onChange={setActiveQuickCategory} />
        </View>

        <FlatList
          contentContainerStyle={styles.quickList}
          data={quickFilters}
          horizontal
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PressScale onPress={() => setQuickFilter(item)} scaleTo={0.96} style={[styles.quickChip, quickFilter.id === item.id && styles.quickChipActive]}>
              {(() => {
                const QuickIcon = getQuickIcon(item)
                return <QuickIcon color={quickFilter.id === item.id ? '#006A32' : '#063C31'} size={20} strokeWidth={2.3} />
              })()}
              <Text style={[styles.quickChipText, quickFilter.id === item.id && styles.quickChipTextActive]}>{item.label}</Text>
            </PressScale>
          )}
          showsHorizontalScrollIndicator={false}
        />

        <ExploreBanner />

        {participationMessage ? (
          <Text accessibilityRole="alert" style={styles.participationMessage}>{participationMessage}</Text>
        ) : null}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Sprout color="#006A32" size={24} strokeWidth={2.4} />
            <Text style={styles.sectionTitle}>Destacados para vos</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>Ver todo</Text>
          </Pressable>
        </View>
        <Text style={styles.carouselHint}>Deslizá para ver más</Text>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#17803C" />
          </View>
        ) : cards.length === 0 ? (
          <EmptyResults onReset={resetFilters} />
        ) : (
          <FlatList
            contentContainerStyle={[styles.resultsList, isWeb && styles.webResultsList]}
            data={cards}
            decelerationRate="fast"
            horizontal
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={(event) => {
              setActiveCardIndex(Math.round(event.nativeEvent.contentOffset.x / carouselSnapInterval))
            }}
            renderItem={({ item }) => (
              <ExploreCard
                cardWidth={carouselCardWidth}
                item={item}
                onCtaPress={() => {
                  console.log('[WEB CTA PRESS]', {
                    source: 'explorar',
                    action: item.action ?? 'open',
                    activityId: item.recordId,
                    userId: getCurrentAuthUserId(),
                    platform: Platform.OS,
                  })

                  void toggleActivityParticipation(item)
                }}
                onPress={() => router.push(
                  item.source === 'activity'
                    ? { pathname: '/activity/[activityId]', params: { activityId: item.recordId } }
                    : { pathname: '/group/[groupId]', params: { groupId: item.recordId } },
                )}
              />
            )}
            showsHorizontalScrollIndicator={isWeb}
            snapToAlignment="start"
            snapToInterval={isWeb ? undefined : carouselSnapInterval}
            style={webHorizontalScrollStyle}
          />
        )}
        {!isWeb && !isLoading && cards.length > 1 ? (
          <View style={styles.carouselDots}>
            {cards.slice(0, 5).map((item, index) => (
              <View key={item.id} style={[styles.carouselDot, index === Math.min(activeCardIndex, 4) && styles.carouselDotActive]} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <FilterSheet
        draft={draftFilters}
        onApply={applyFilters}
        onChange={setDraftFilters}
        onClose={() => setIsFilterVisible(false)}
        onReset={resetFilters}
        resultCount={filteredRecords.length}
        visible={isFilterVisible}
      />
    </SafeAreaView>
  )
}

function EmptyResults({ onReset }: { onReset: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Filter color="#17803C" size={38} strokeWidth={2.2} />
      </View>
      <Text style={styles.emptyTitle}>No encontramos resultados</Text>
      <Text style={styles.emptySubtitle}>Probá ajustando los filtros o buscando otra actividad.</Text>
      <PressScale onPress={onReset} scaleTo={0.97} style={styles.resetButton}>
        <Text style={styles.resetButtonText}>Limpiar filtros</Text>
      </PressScale>
    </View>
  )
}

function ExploreBanner() {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerCopy}>
        <Text style={styles.bannerTitle}>Conectá con lo que te hace bien</Text>
        <Text style={styles.bannerText}>Actividades, grupos y experiencias para todos los estilos.</Text>
      </View>
      <View style={styles.bannerArt}>
        <View style={styles.sun} />
        <Leaf color="#73A86E" size={54} strokeWidth={1.7} />
        <Sprout color="#17803C" size={66} strokeWidth={1.8} />
      </View>
    </View>
  )
}

function ExploreCard({ cardWidth, item, onCtaPress, onPress }: { cardWidth: number; item: ExploreCardItem; onCtaPress?: () => void; onPress: () => void }) {
  const fallbackImage = getCategoryImage({ category: item.source === 'group' ? 'Grupales' : undefined, title: item.title, type: item.source }, defaultActivityImage)
  const [imageSource, setImageSource] = useState(item.image || defaultActivityImage)
  const [hasImageError, setHasImageError] = useState(false)
  const isGroupActivity = Boolean(item.groupId || item.groupName)
  const groupColors = getGroupTheme(item.groupColor)
  const isWeb = Platform.OS === 'web'

  useEffect(() => {
    setImageSource(item.image || defaultActivityImage)
    setHasImageError(false)
  }, [item.image])

  return (
    <View
      style={[
        styles.exploreCard,
        { width: cardWidth },
        isGroupActivity && { borderColor: groupColors.borderColor },
      ]}
    >
      {isWeb ? (
        <View
          accessibilityRole="button"
          onResponderRelease={onPress}
          onStartShouldSetResponder={() => true}
        >
          <ExploreCardContent
            fallbackImage={fallbackImage}
            groupColors={groupColors}
            hasImageError={hasImageError}
            imageSource={imageSource}
            item={item}
            setHasImageError={setHasImageError}
            setImageSource={setImageSource}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => pressed && styles.cardPressed}
        >
          <ExploreCardContent
            fallbackImage={fallbackImage}
            groupColors={groupColors}
            hasImageError={hasImageError}
            imageSource={imageSource}
            item={item}
            setHasImageError={setHasImageError}
            setImageSource={setImageSource}
          />
        </Pressable>
      )}
      <View style={styles.cardFooter}>
        <View style={styles.capacityBadge}>
          <UsersRound color="#006A32" size={16} strokeWidth={2.3} />
          <Text style={styles.capacityText}>{item.capacity}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={Boolean(item.isCancelled || item.isOrganizer || item.source === 'group')}
          onPress={(event) => {
            if (Platform.OS !== 'web') event.stopPropagation()
            onCtaPress?.()
          }}
          style={({ pressed }) => [
            styles.cardCta,
              item.isCancelled && styles.cardCtaDisabled,
              item.isOrganizer && styles.cardCtaDisabled,
              item.source === 'group' && styles.cardCtaDisabled,
              pressed && styles.cardPressed,
            ]}
        >
          <Text style={[styles.cardCtaText, item.isCancelled && styles.cardCtaTextDisabled]}>{item.cta}</Text>
        </Pressable>
      </View>
    </View>
  )
}

function ExploreCardContent({
  fallbackImage,
  groupColors,
  hasImageError,
  imageSource,
  item,
  setHasImageError,
  setImageSource,
}: {
  fallbackImage: ImageSourcePropType
  groupColors: ReturnType<typeof getGroupTheme>
  hasImageError: boolean
  imageSource: ImageSourcePropType
  item: ExploreCardItem
  setHasImageError: (value: boolean) => void
  setImageSource: (value: ImageSourcePropType) => void
}) {
  const subtitle = item.subtitle?.trim() || item.customName?.trim() || ''

  return (
    <>
      <View style={styles.cardImageWrap}>
        <ExpoImage contentFit="cover" source={fallbackImage} style={styles.cardImage} />
        {!hasImageError ? (
          <ExpoImage
            contentFit="cover"
            onError={() => {
              if (__DEV__) console.log('[CARD IMAGE ERROR]', { title: item.title, source: item.source, groupId: item.groupId })
              setHasImageError(true)
              setImageSource(fallbackImage)
            }}
            source={imageSource || fallbackImage}
            style={[styles.cardImage, StyleSheet.absoluteFillObject]}
          />
        ) : null}
        {item.visualState ? (
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: item.visualState.backgroundColor,
                borderColor: item.visualState.borderColor,
              },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: item.visualState.color }]}>{item.visualState.label}</Text>
          </View>
        ) : null}
        <View style={styles.cardIcon}>
          {item.source === 'group' ? (
            <GroupAvatar groupName={item.title} imageUrl={item.groupImageUrl} size={58} />
          ) : (
            <item.Icon color="#17803C" size={31} strokeWidth={2.2} />
          )}
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleBlock}>
          <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.activityCardSubtitle}>{subtitle}</Text>
          ) : null}
        </View>
        <View style={styles.cardMetaRow}>
          <MapPin color="#0E5A44" size={16} strokeWidth={2.2} />
          <Text numberOfLines={2} style={styles.cardMeta}>{item.location}</Text>
        </View>
        <View style={styles.cardMetaRow}>
          <CalendarCheck color="#0E5A44" size={16} strokeWidth={2.2} />
          <Text numberOfLines={1} style={styles.cardMeta}>{item.schedule}</Text>
        </View>
        {item.groupName ? (
          <View style={styles.groupIndicator}>
            <GroupAvatar groupName={item.groupName} imageUrl={item.groupImageUrl} size={18} />
            <Text numberOfLines={1} style={[styles.groupIndicatorText, { color: groupColors.chipTextColor }]}>{item.groupName}</Text>
          </View>
        ) : null}
      </View>
    </>
  )
}

type FilterSheetProps = {
  draft: AdvancedFilters
  onApply: () => void
  onChange: (filters: AdvancedFilters) => void
  onClose: () => void
  onReset: () => void
  resultCount: number
  visible: boolean
}

function FilterSheet({ draft, onApply, onChange, onClose, onReset, resultCount, visible }: FilterSheetProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filtros</Text>
            <PressScale onPress={onReset} scaleTo={0.96} style={styles.clearButton}>
              <Text style={styles.clearText}>Limpiar</Text>
            </PressScale>
          </View>

          <FilterGroup label="Cuándo" options={dateFilters} value={draft.date} onChange={(date) => onChange({ ...draft, date })} />
          <FilterGroup label="Precio" options={priceFilters} value={draft.price} onChange={(price) => onChange({ ...draft, price })} />
          <FilterGroup label="Categoría" options={categoryFilters} value={draft.category} onChange={(category) => onChange({ ...draft, category })} />
          <FilterGroup label="Ubicación" options={locationFilters} value={draft.location} onChange={(location) => onChange({ ...draft, location })} />
          <FilterGroup label="Distancia" options={distanceFilters} value={draft.distance} onChange={(distance) => onChange({ ...draft, distance })} />
          <FilterGroup
            label="Ordenar por"
            options={['recommended', 'recent', 'popular']}
            value={draft.sort}
            labels={{ popular: 'Populares', recent: 'Recientes', recommended: 'Recomendados' }}
            onChange={(sort) => onChange({ ...draft, sort: sort as SortMode })}
          />

          <PressScale onPress={onApply} scaleTo={0.97} style={styles.applyButton}>
            <Text style={styles.applyButtonText}>Ver resultados ({resultCount})</Text>
          </PressScale>
        </View>
      </View>
    </Modal>
  )
}

type FilterGroupProps = {
  label: string
  labels?: Record<string, string>
  onChange: (value: string) => void
  options: string[]
  value: string
}

function FilterGroup({ label, labels, onChange, options, value }: FilterGroupProps) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterChips}>
        {options.map((option) => {
          const active = value === option
          return (
            <PressScale key={option} onPress={() => onChange(option)} scaleTo={0.96} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {labels?.[option] ?? option}
              </Text>
            </PressScale>
          )
        })}
      </View>
    </View>
  )
}

const shadow = Platform.select({
  web: {
    boxShadow: '0 14px 26px rgba(7, 57, 45, 0.10)',
  },
  default: {
    elevation: 3,
    shadowColor: '#07392D',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
})

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FAFAF8',
    flex: 1,
  },
  content: {
    paddingBottom: 128,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  webContent: {
    alignSelf: 'center',
    maxWidth: 760,
    width: '100%',
  },
  participationMessage: {
    color: '#8A3A32',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 19,
    marginBottom: 10,
    marginTop: 2,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    color: '#071D19',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#40534D',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 22,
    marginTop: 3,
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1DD',
    borderRadius: 999,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
    ...shadow,
  },
  searchCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1DD',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 60,
    marginTop: 20,
    paddingHorizontal: 20,
    ...shadow,
  },
  searchInput: {
    color: '#10231F',
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    padding: 0,
  },
  quickList: {
    gap: 10,
    paddingBottom: 6,
    paddingTop: 12,
  },
  activityQuickBlock: {
    marginTop: 18,
  },
  quickChip: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1DD',
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    minHeight: 62,
    justifyContent: 'center',
    paddingHorizontal: 14,
    minWidth: 78,
    ...shadow,
  },
  quickChipActive: {
    backgroundColor: '#DFF2DD',
    borderColor: '#DFF2DD',
  },
  quickChipText: {
    color: '#10231F',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  quickChipTextActive: {
    color: '#006A32',
  },
  banner: {
    backgroundColor: '#EFF8EC',
    borderRadius: 24,
    flexDirection: 'row',
    marginTop: 14,
    minHeight: 154,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  bannerCopy: {
    flex: 1.1,
    justifyContent: 'center',
    zIndex: 2,
  },
  bannerTitle: {
    color: '#063C31',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 30,
  },
  bannerText: {
    color: '#193F37',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 23,
    marginTop: 12,
  },
  bannerArt: {
    alignItems: 'center',
    bottom: -8,
    flex: 0.9,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  sun: {
    backgroundColor: '#F6DD82',
    borderRadius: 999,
    height: 58,
    opacity: 0.7,
    position: 'absolute',
    right: 16,
    top: 22,
    width: 58,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    color: '#063C31',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  seeAllButton: {
    backgroundColor: '#F0F5E9',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  seeAllText: {
    color: '#006A32',
    fontSize: 13,
    fontWeight: '900',
  },
  carouselHint: {
    color: '#66736E',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: -4,
  },
  resultsList: {
    gap: 14,
    paddingBottom: 8,
    paddingRight: 28,
    paddingTop: 14,
  },
  webResultsList: {
    gap: 16,
    paddingBottom: 12,
    paddingRight: 64,
  },
  exploreCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 2,
    minHeight: 292,
    overflow: 'hidden',
    position: 'relative',
    ...shadow,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardImageWrap: {
    backgroundColor: '#EFF6E9',
    height: 128,
    position: 'relative',
    width: '100%',
  },
  cardImage: {
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: '#F7FAF5',
    borderColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 2,
    height: 58,
    justifyContent: 'center',
    left: 14,
    position: 'absolute',
    top: 84,
    width: 58,
  },
  statusBadge: {
    backgroundColor: '#FFF2CC',
    borderColor: '#F5C84B',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  statusBadgeText: {
    color: '#7A4A00',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  cardBody: {
    flex: 1,
    padding: 14,
    paddingTop: 18,
  },
  cardTitle: {
    color: '#063C31',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 22,
  },
  cardTitleBlock: {
    flexDirection: 'column',
    minWidth: 0,
  },
  cardCustomName: {
    color: '#40534D',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 2,
  },
  activityCardSubtitle: {
    color: '#40534D',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 2,
  },
  cardMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  cardMeta: {
    color: '#596A65',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
  },
  groupIndicator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 4,
    maxWidth: '100%',
  },
  groupIndicatorText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 12,
  },
  cardFooter: {
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    position: 'relative',
    zIndex: 10,
  },
  capacityBadge: {
    alignItems: 'center',
    backgroundColor: '#F0F5E9',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: 32,
    paddingHorizontal: 12,
  },
  capacityText: {
    color: '#006A32',
    fontSize: 13,
    fontWeight: '900',
  },
  cardCta: {
    alignItems: 'center',
    backgroundColor: '#F0F5E9',
    borderRadius: 999,
    alignSelf: 'stretch',
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    position: 'relative',
    zIndex: 11,
  },
  cardCtaDisabled: {
    backgroundColor: '#ECEBE7',
  },
  cardCtaText: {
    color: '#006A32',
    fontSize: 13,
    fontWeight: '900',
  },
  cardCtaTextDisabled: {
    color: '#7A817D',
  },
  carouselDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 4,
  },
  carouselDot: {
    backgroundColor: '#DCE8E1',
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  carouselDotActive: {
    backgroundColor: '#006A32',
    width: 18,
  },
  centerState: {
    alignItems: 'center',
    minHeight: 180,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    minHeight: 240,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#EFF6E9',
    borderColor: '#D7E8CC',
    borderRadius: 999,
    borderWidth: 1,
    height: 84,
    justifyContent: 'center',
    marginBottom: 16,
    width: 84,
  },
  emptyTitle: {
    color: '#063C31',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#596A65',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  resetButton: {
    alignItems: 'center',
    borderColor: '#6C3DE5',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 44,
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  resetButtonText: {
    color: '#4B348A',
    fontSize: 14,
    fontWeight: '900',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(7, 22, 18, 0.34)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '88%',
    paddingBottom: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#E6E2ED',
    borderRadius: 999,
    height: 5,
    marginBottom: 16,
    width: 48,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetTitle: {
    color: '#071D19',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
  },
  clearButton: {
    justifyContent: 'center',
    minHeight: 38,
  },
  clearText: {
    color: '#4B348A',
    fontSize: 14,
    fontWeight: '900',
  },
  filterGroup: {
    marginTop: 15,
  },
  filterLabel: {
    color: '#10231F',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 10,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1DD',
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  filterChipActive: {
    backgroundColor: '#006A32',
    borderColor: '#006A32',
  },
  filterChipText: {
    color: '#10231F',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  applyButton: {
    alignItems: 'center',
    backgroundColor: '#6C3DE5',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    marginTop: 22,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
})

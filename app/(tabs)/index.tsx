import { useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import {
  FlatList,
  ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Bell,
  Bike,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Heart,
  Leaf,
  MapPin,
  Mountain,
  PersonStanding,
  Search,
  Settings,
  Spade,
  Sprout,
  UsersRound,
  Waves,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'

import CoincidirLogo from '../../components/CoincidirLogo'
import { InviteFriendsSheet, type InviteShareTarget } from '../../components/InviteFriendsSheet'
import { ActivityCard, PrivateCard, SuggestionCard } from '../../components/home/HomeCards'
import { CategoryButton } from '../../components/home/CategoryButton'
import { PressScale } from '../../components/home/PressScale'
import type {
  ActivityCardItem,
  PrivateCardItem,
  SuggestionCardItem,
  ThemeTone,
} from '../../components/home/types'
import { getFirebaseServices } from '../../firebaseConfig'

const image = (uri: string): ImageSourcePropType => ({ uri })

type CategoryId = 'outdoor' | 'sports' | 'wellness' | 'groups' | 'private'

const DEFAULT_CITY = 'Tandil'
const SELECTED_CITY_STORAGE_KEY = 'home:selectedCity'
const cityOptions = ['Tandil', 'Buenos Aires', 'Mar del Plata', 'Córdoba', 'Rosario']

const categories: { label: string; tone?: ThemeTone; Icon: LucideIcon }[] = [
  { label: 'Todas', Icon: Sprout },
  { label: 'Al aire libre', Icon: Mountain },
  { label: 'Deportes', Icon: Dumbbell },
  { label: 'Bienestar', Icon: Leaf },
  { label: 'Grupales', Icon: UsersRound },
  { label: 'Espacios privados', tone: 'violet', Icon: CalendarDays },
]

type CreatedRecord = {
  id: string
  data: Record<string, unknown>
}

type JoinableCollection = 'activities' | 'groups'
type JoinState = {
  count: number
  joined: boolean
}

const defaultImagesByCategory: Record<CategoryId | 'default', ImageSourcePropType> = {
  outdoor: image('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80'),
  sports: image('https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80'),
  wellness: image('https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=80'),
  groups: image('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80'),
  private: image('https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=900&q=80'),
  default: image('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80'),
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalize(value: unknown) {
  return readString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getCategoryId(data: Record<string, unknown>): CategoryId | 'default' {
  const categoryId = readString(data.categoryId)

  if (categoryId === 'outdoor' || categoryId === 'sports' || categoryId === 'wellness' || categoryId === 'groups' || categoryId === 'private') {
    return categoryId
  }

  return 'default'
}

function getAdditionalSettings(data: Record<string, unknown>) {
  return typeof data.additionalSettings === 'object' && data.additionalSettings
    ? data.additionalSettings as Record<string, unknown>
    : {}
}

function getParticipantCount(data: Record<string, unknown>) {
  const participantsCount = readNumber(data.participantsCount, -1)
  if (participantsCount >= 0) return participantsCount

  const participants = data.participants ?? data.attendees ?? data.members
  if (typeof participants === 'object' && participants) {
    return Object.keys(participants).length
  }

  const joinedUsers = data.joinedUsers
  if (typeof joinedUsers === 'object' && joinedUsers) {
    return Object.keys(joinedUsers).length
  }

  return Array.isArray(participants) ? participants.length : 0
}

function getMaxParticipants(data: Record<string, unknown>) {
  const additionalSettings = getAdditionalSettings(data)
  return Math.max(1, readNumber(additionalSettings.maxParticipants, 10))
}

function formatDateBadge(date: string) {
  const normalizedDate = normalize(date)

  if (normalizedDate.includes('hoy')) return 'HOY'
  if (normalizedDate.includes('manana') || normalizedDate.includes('ma')) return 'MANANA'
  if (normalizedDate.includes('sab')) return 'SAB'
  if (normalizedDate.includes('dom')) return 'DOM'

  return date ? date.toUpperCase().slice(0, 8) : 'FECHA'
}

function formatSchedule(data: Record<string, unknown>) {
  const date = readString(data.date, 'Fecha a definir')
  const time = readString(data.time)
  const location = readString(data.location, 'Ubicacion a definir')
  return `${date}${time ? ` ${time}` : ''} - ${location}`
}

function getIcon(data: Record<string, unknown>): LucideIcon {
  const categoryId = getCategoryId(data)
  const detail = `${normalize(data.subcategory)} ${normalize(data.name)}`

  if (detail.includes('bici') || detail.includes('ciclismo') || detail.includes('bike')) return Bike
  if (detail.includes('kayak') || detail.includes('natacion') || detail.includes('paddle')) return Waves
  if (detail.includes('yoga') || detail.includes('meditacion') || categoryId === 'wellness') return Leaf
  if (detail.includes('escalada') || categoryId === 'outdoor') return Mountain
  if (categoryId === 'groups') return UsersRound
  if (categoryId === 'private') return Spade
  if (categoryId === 'sports') return Dumbbell

  return PersonStanding
}

function getRecordTime(record: CreatedRecord) {
  const value = record.data.createdAt ?? record.data.updatedAt
  return typeof value === 'object' && value && 'toMillis' in value && typeof value.toMillis === 'function'
    ? value.toMillis()
    : 0
}

function getJoinKey(collectionName: JoinableCollection, id: string) {
  return `${collectionName}:${id}`
}

function hasUserInMap(value: unknown, userId: string) {
  return typeof value === 'object' && value !== null && userId in value
}

function hasUserInList(value: unknown, userId: string) {
  if (!Array.isArray(value)) return false

  return value.some((item) => {
    if (typeof item === 'string') return item === userId
    if (typeof item === 'object' && item) {
      return readString((item as Record<string, unknown>).uid) === userId
        || readString((item as Record<string, unknown>).userId) === userId
        || readString((item as Record<string, unknown>).id) === userId
    }

    return false
  })
}

function isUserJoined(data: Record<string, unknown>, userId: string | null) {
  if (!userId) return false

  return hasUserInMap(data.participants, userId)
    || hasUserInMap(data.joinedUsers, userId)
    || hasUserInList(data.participants, userId)
    || hasUserInList(data.attendees, userId)
    || hasUserInList(data.members, userId)
}

function getJoinState(
  record: CreatedRecord,
  collectionName: JoinableCollection,
  userId: string | null,
  optimisticJoins: Record<string, boolean>,
): JoinState {
  const persistedJoined = isUserJoined(record.data, userId)
  const key = getJoinKey(collectionName, record.id)
  const joined = key in optimisticJoins ? optimisticJoins[key] : persistedJoined
  const countDelta = joined === persistedJoined ? 0 : joined ? 1 : -1

  return {
    count: Math.max(0, getParticipantCount(record.data) + countDelta),
    joined,
  }
}

function getJoinCta(joined: boolean) {
  return joined ? '✓ Te sumaste' : 'Me sumo'
}

function mapActivityCard(record: CreatedRecord, joinState: JoinState): ActivityCardItem {
  const { data } = record
  const categoryId = getCategoryId(data)
  const category = readString(data.category, 'Encuentro')

  return {
    id: record.id,
    recordId: record.id,
    title: readString(data.name, 'Encuentro sin titulo'),
    image: defaultImagesByCategory[categoryId],
    dateBadge: formatDateBadge(readString(data.date)),
    people: String(joinState.count),
    category,
    dateTime: formatSchedule(data),
    iconLabel: category,
    cta: getJoinCta(joinState.joined),
    Icon: getIcon(data),
  }
}

function mapPrivateCard(record: CreatedRecord, joinState: JoinState): PrivateCardItem {
  const { data } = record
  const time = readString(data.time)

  return {
    id: record.id,
    recordId: record.id,
    title: readString(data.name, 'Actividad sin titulo'),
    image: defaultImagesByCategory.private,
    capacity: `${joinState.count}/${getMaxParticipants(data)}`,
    dateTime: `${readString(data.date, 'Fecha a definir')}${time ? ` ${time}` : ''}`,
    place: readString(data.location, 'Ubicacion a definir'),
    cta: 'Ver detalle',
    Icon: getIcon(data),
  }
}

function mapSuggestionCard(record: CreatedRecord, source: 'activity' | 'group', joinState: JoinState): SuggestionCardItem {
  const { data } = record
  const categoryId = getCategoryId(data)
  const isViolet = categoryId === 'private' || source === 'group'

  return {
    id: `${source}-${record.id}`,
    recordId: record.id,
    source,
    title: readString(data.name, source === 'group' ? 'Grupo sin titulo' : 'Encuentro sin titulo'),
    capacity: `${joinState.count}/${getMaxParticipants(data)}`,
    location: readString(data.location, 'Ubicacion a definir'),
    schedule: source === 'group' ? readString(data.schedule, 'Proxima salida a definir') : formatSchedule(data),
    cta: source === 'group' ? 'Ver grupo' : 'Ver encuentro',
    tone: isViolet ? 'violet' : 'green',
    Icon: source === 'group' ? UsersRound : getIcon(data),
  }
}

function getRecordCity(data: Record<string, unknown>) {
  return readString(data.city) || readString(data.locationCity) || readString(data.town)
}

function matchesSelectedCity(record: CreatedRecord, selectedCity: string) {
  const recordCity = getRecordCity(record.data)
  const location = readString(record.data.location)
  const normalizedCity = normalize(selectedCity)

  if (recordCity) return normalize(recordCity) === normalizedCity
  return normalize(location).includes(normalizedCity)
}

function getSearchableRecordText(record: CreatedRecord, source: 'activity' | 'group') {
  const { data } = record
  const searchableParts = [
    source === 'group' ? 'grupo' : 'actividad',
    data.name,
    data.title,
    data.category,
    data.subcategory,
    data.shortDescription,
    data.description,
    data.summary,
  ]

  return normalize(searchableParts.filter(Boolean).join(' '))
}

function filterRecordsBySearch(records: CreatedRecord[], query: string, source: 'activity' | 'group') {
  const normalizedQuery = normalize(query)

  if (!normalizedQuery) return records

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  return records.filter((record) => {
    const searchableText = getSearchableRecordText(record, source)
    return tokens.every((token) => searchableText.includes(token))
  })
}

function getCategoryFilterText(record: CreatedRecord) {
  const { data } = record
  const categoryId = getCategoryId(data)
  const aliasesByCategory: Record<CategoryId | 'default', string[]> = {
    outdoor: ['al aire libre', 'outdoor'],
    sports: ['deportes', 'sports'],
    wellness: ['bienestar', 'wellness'],
    groups: ['grupales', 'sociales', 'groups', 'grupo'],
    private: ['espacios privados', 'privados', 'private'],
    default: [],
  }
  const filterParts = [
    categoryId,
    data.categoryId,
    data.category,
    data.subcategory,
    data.type,
    ...aliasesByCategory[categoryId],
  ]

  return normalize(filterParts.filter(Boolean).join(' '))
}

function filterRecordsByCategory(records: CreatedRecord[], category: string) {
  const normalizedCategory = normalize(category)

  if (!normalizedCategory || normalizedCategory === 'todas') return records

  return records.filter((record) => getCategoryFilterText(record).includes(normalizedCategory))
}

function getList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function getRecommendationTerms(interests: string[]) {
  const aliases: Record<string, string[]> = {
    bicicleta: ['bicicleta', 'bici', 'ciclismo', 'bike'],
    caminatas: ['caminatas', 'caminata', 'trekking', 'senderismo'],
    'clases grupales (tango, salsa, folklore)': ['clases grupales', 'tango', 'salsa', 'folklore'],
    'encuentros grupales': ['encuentros grupales', 'grupales', 'grupo', 'sociales'],
    'futbol 5': ['futbol', 'futbol 5', 'deportes'],
    gimnasio: ['gimnasio', 'fitness', 'funcional'],
    'kayak/sup': ['kayak', 'sup', 'stand up paddle'],
    mateadas: ['mateadas', 'mate', 'sociales'],
    'paddle / tenis': ['paddle', 'padel', 'tenis'],
  }

  return Array.from(new Set(interests.flatMap((interest) => {
    const normalizedInterest = normalize(interest)
    const splitTerms = normalizedInterest
      .split(/[\/,()]/)
      .map((item) => item.trim())
      .filter(Boolean)

    return [normalizedInterest, ...splitTerms, ...(aliases[normalizedInterest] ?? [])]
      .map((item) => normalize(item))
      .filter(Boolean)
  })))
}

function getRecommendationText(record: CreatedRecord, source: 'activity' | 'group') {
  const { data } = record
  return normalize([
    source === 'group' ? 'grupo' : 'actividad',
    data.name,
    data.title,
    data.categoryId,
    data.category,
    data.subcategory,
    data.type,
    data.shortDescription,
    data.description,
    data.summary,
  ].filter(Boolean).join(' '))
}

function getRecommendedRecords(records: CreatedRecord[], interests: string[], source: 'activity' | 'group') {
  const terms = getRecommendationTerms(interests)
  if (terms.length === 0) return []

  return records.filter((record) => {
    const text = getRecommendationText(record, source)
    return terms.some((term) => text.includes(term))
  })
}

export default function HomeScreen() {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState('Todas')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userInterests, setUserInterests] = useState<string[]>([])
  const [userName, setUserName] = useState<string | null>(null)
  const [createdActivities, setCreatedActivities] = useState<CreatedRecord[]>([])
  const [createdGroups, setCreatedGroups] = useState<CreatedRecord[]>([])
  const [optimisticJoins, setOptimisticJoins] = useState<Record<string, boolean>>({})
  const [pendingJoinKeys, setPendingJoinKeys] = useState<string[]>([])
  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY)
  const [isCitySelectorVisible, setIsCitySelectorVisible] = useState(false)
  const [isInviteVisible, setIsInviteVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const { width } = useWindowDimensions()
  const horizontalInset = width >= 430 ? 28 : 20

  useEffect(() => {
    let mounted = true

    AsyncStorage.getItem(SELECTED_CITY_STORAGE_KEY)
      .then((savedCity) => {
        if (mounted && savedCity && cityOptions.includes(savedCity)) {
          setSelectedCity(savedCity)
        }
      })
      .catch(() => {
        if (mounted) setSelectedCity(DEFAULT_CITY)
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let unsubscribe = () => {}

    try {
      const { auth, db } = getFirebaseServices()
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!mounted) return

        if (!user) {
          setCurrentUserId(null)
          setUserInterests([])
          setUserName(null)
          return
        }

        setCurrentUserId(user.uid)

        const authName = user.displayName?.trim()

        try {
          const profileSnap = await getDoc(doc(db, 'users', user.uid))
          const profile = profileSnap.exists() ? profileSnap.data() : null
          const profileInterests = getList(profile?.interests)
          const profileName =
            typeof profile?.fullName === 'string'
              ? profile.fullName
              : typeof profile?.name === 'string'
                ? profile.name
                : typeof profile?.displayName === 'string'
                  ? profile.displayName
                  : typeof profile?.nombre === 'string'
                    ? profile.nombre
                    : ''

          if (mounted) {
            const cleanName = profileName.trim()
            setUserInterests(profileInterests)
            setUserName(cleanName ? cleanName.split(' ')[0] : authName ? authName.split(' ')[0] : null)
          }
        } catch {
          if (mounted) {
            setUserInterests([])
            setUserName(authName ? authName.split(' ')[0] : null)
          }
        }
      })
    } catch {
      setUserName(null)
    }

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let unsubscribeActivities = () => {}
    let unsubscribeGroups = () => {}

    try {
      const { db } = getFirebaseServices()

      unsubscribeActivities = onSnapshot(
        collection(db, 'activities'),
        (snapshot) => {
          const records = snapshot.docs
            .map((item) => ({ id: item.id, data: item.data() as Record<string, unknown> }))
            .sort((left, right) => getRecordTime(right) - getRecordTime(left))

          setCreatedActivities(records)
        },
        () => setCreatedActivities([]),
      )

      unsubscribeGroups = onSnapshot(
        collection(db, 'groups'),
        (snapshot) => {
          const records = snapshot.docs
            .map((item) => ({ id: item.id, data: item.data() as Record<string, unknown> }))
            .sort((left, right) => getRecordTime(right) - getRecordTime(left))

          setCreatedGroups(records)
        },
        () => setCreatedGroups([]),
      )
    } catch {
      setCreatedActivities([])
      setCreatedGroups([])
    }

    return () => {
      unsubscribeActivities()
      unsubscribeGroups()
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 220)

    return () => clearTimeout(timeout)
  }, [searchQuery])

  const greeting = useMemo(() => (userName ? `¡Hola, ${userName}! 👋` : '¡Hola! 👋'), [userName])
  const cityActivities = useMemo(
    () => createdActivities.filter((item) => matchesSelectedCity(item, selectedCity)),
    [createdActivities, selectedCity],
  )
  const cityGroups = useMemo(
    () => createdGroups.filter((item) => matchesSelectedCity(item, selectedCity)),
    [createdGroups, selectedCity],
  )
  const searchedActivities = useMemo(
    () => filterRecordsBySearch(cityActivities, debouncedSearchQuery, 'activity'),
    [cityActivities, debouncedSearchQuery],
  )
  const searchedGroups = useMemo(
    () => filterRecordsBySearch(cityGroups, debouncedSearchQuery, 'group'),
    [cityGroups, debouncedSearchQuery],
  )
  const filteredActivities = useMemo(
    () => filterRecordsByCategory(searchedActivities, activeCategory),
    [activeCategory, searchedActivities],
  )
  const filteredGroups = useMemo(
    () => filterRecordsByCategory(searchedGroups, activeCategory),
    [activeCategory, searchedGroups],
  )
  const recommendedActivities = useMemo(
    () => getRecommendedRecords(filteredActivities, userInterests, 'activity'),
    [filteredActivities, userInterests],
  )
  const recommendedGroups = useMemo(
    () => getRecommendedRecords(filteredGroups, userInterests, 'group'),
    [filteredGroups, userInterests],
  )
  const selectCity = async (city: string) => {
    setSelectedCity(city)
    setIsCitySelectorVisible(false)

    try {
      await AsyncStorage.setItem(SELECTED_CITY_STORAGE_KEY, city)
    } catch {
      // The selector still works in-memory if local persistence is unavailable.
    }
  }
  const toggleJoin = async (record: CreatedRecord, collectionName: JoinableCollection) => {
    if (!currentUserId) return

    const key = getJoinKey(collectionName, record.id)
    if (pendingJoinKeys.includes(key)) return

    const nextJoined = !getJoinState(record, collectionName, currentUserId, optimisticJoins).joined

    setOptimisticJoins((current) => ({ ...current, [key]: nextJoined }))
    setPendingJoinKeys((current) => [...current, key])

    try {
      const { db } = getFirebaseServices()
      const targetRef = doc(db, collectionName, record.id)

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(targetRef)
        if (!snapshot.exists()) return

        const data = snapshot.data() as Record<string, unknown>
        const wasJoined = isUserJoined(data, currentUserId)
        const currentCount = getParticipantCount(data)
        const nextCount = Math.max(0, currentCount + (wasJoined ? -1 : 1))

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
              status: 'joined',
              uid: currentUserId,
            },
            participantsCount: nextCount,
            updatedAt: serverTimestamp(),
          })
      })
    } catch {
      setOptimisticJoins((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
    } finally {
      setPendingJoinKeys((current) => current.filter((item) => item !== key))
    }
  }
  const nearbyMeetups = useMemo(
    () =>
      filteredActivities
        .filter((item) => getCategoryId(item.data) !== 'private')
        .map((item) => mapActivityCard(item, getJoinState(item, 'activities', currentUserId, optimisticJoins))),
    [currentUserId, filteredActivities, optimisticJoins],
  )
  const privateSpaces = useMemo(
    () =>
      filteredActivities
        .filter((item) => getCategoryId(item.data) === 'private')
        .map((item) => mapPrivateCard(item, getJoinState(item, 'activities', currentUserId, optimisticJoins))),
    [currentUserId, filteredActivities, optimisticJoins],
  )
  const suggestions = useMemo(
    () => [
      ...recommendedActivities.map((item) => mapSuggestionCard(item, 'activity', getJoinState(item, 'activities', currentUserId, optimisticJoins))),
      ...recommendedGroups.map((item) => mapSuggestionCard(item, 'group', getJoinState(item, 'groups', currentUserId, optimisticJoins))),
    ],
    [currentUserId, optimisticJoins, recommendedActivities, recommendedGroups],
  )
  const hasSearch = debouncedSearchQuery.trim().length > 0
  const hasCategoryFilter = activeCategory !== 'Todas'
  const hasVisibleResults = nearbyMeetups.length + privateSpaces.length + suggestions.length > 0
  const activityRecordsById = useMemo(
    () => new Map(filteredActivities.map((item) => [item.id, item])),
    [filteredActivities],
  )
  const inviteTarget = useMemo<InviteShareTarget>(() => {
    const record = recommendedActivities[0] ?? filteredActivities[0]

    if (!record) return { type: 'app' }

    return {
      dateTime: formatSchedule(record.data),
      id: record.id,
      location: readString(record.data.location),
      title: readString(record.data.name, 'Actividad de COINCIDIR'),
      type: 'activity',
    }
  }, [filteredActivities, recommendedActivities])
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <CoincidirLogo markSize={74} textSize={25} cutoutColor="#FAFAF8" compact />
          <View style={styles.greetingBlock}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.greeting}>
              {greeting}
            </Text>
            <Text style={styles.prompt}>¿Qué vamos a hacer hoy?</Text>
          </View>
          <View style={styles.headerActions}>
            <PressScale style={styles.iconButton} scaleTo={0.94}>
              <Bell color="#05372D" size={30} strokeWidth={2.2} />
              <View style={styles.notificationDot} />
            </PressScale>
            <PressScale style={styles.iconButton} scaleTo={0.94}>
              <Settings color="#05372D" size={31} strokeWidth={2.2} />
            </PressScale>
          </View>
        </View>

        <View style={styles.searchCard}>
          <PressScale
            accessibilityLabel="Seleccionar ciudad"
            accessibilityRole="button"
            onPress={() => setIsCitySelectorVisible(true)}
            style={styles.locationSelector}
            scaleTo={0.98}
          >
            <MapPin color="#05372D" size={26} strokeWidth={2.1} />
            <Text style={styles.locationText}>{selectedCity}</Text>
            <ChevronDown color="#05372D" size={20} strokeWidth={2.4} />
          </PressScale>
          <View style={styles.searchDivider} />
          <View style={styles.inputWrap}>
            <Search color="#05372D" size={27} strokeWidth={2.1} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={setSearchQuery}
              placeholder="Buscar actividades o grupos"
              placeholderTextColor="#85858B"
              returnKeyType="search"
              style={styles.searchInput}
              value={searchQuery}
            />
          </View>
        </View>

        <Modal
          animationType="fade"
          onRequestClose={() => setIsCitySelectorVisible(false)}
          transparent
          visible={isCitySelectorVisible}
        >
          <Pressable style={styles.cityModalBackdrop} onPress={() => setIsCitySelectorVisible(false)}>
            <Pressable accessibilityRole="menu" style={styles.cityModalCard}>
              <Text style={styles.cityModalTitle}>Elegí una ciudad</Text>
              {cityOptions.map((city) => {
                const selected = city === selectedCity

                return (
                  <Pressable
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    key={city}
                    onPress={() => selectCity(city)}
                    style={[styles.cityOption, selected && styles.cityOptionSelected]}
                  >
                    <MapPin color={selected ? '#006A32' : '#05372D'} size={20} strokeWidth={2.1} />
                    <Text style={[styles.cityOptionText, selected && styles.cityOptionTextSelected]}>
                      {city}
                    </Text>
                  </Pressable>
                )
              })}
            </Pressable>
          </Pressable>
        </Modal>

        <FlatList
          contentContainerStyle={styles.categoryList}
          data={categories}
          horizontal
          keyExtractor={(item) => item.label}
          renderItem={({ item }) => (
            <CategoryButton
              Icon={item.Icon}
              active={activeCategory === item.label}
              label={item.label}
              onPress={() => setActiveCategory(item.label)}
              tone={item.tone}
            />
          )}
          showsHorizontalScrollIndicator={false}
        />

        {(hasSearch || hasCategoryFilter) && !hasVisibleResults ? (
          <EmptyState
            subtitle={hasSearch ? 'Probá con otra búsqueda' : undefined}
            title={hasSearch ? 'No encontramos actividades' : 'No hay actividades en esta categoría'}
          />
        ) : (
          <>
            <Section
              accent="green"
              data={nearbyMeetups}
              renderItem={({ item }) => (
                <ActivityCard
                  item={item}
                  onPress={() => {
                    const record = activityRecordsById.get(item.recordId)
                    if (record) toggleJoin(record, 'activities')
                  }}
                />
              )}
              title="Encuentros cerca de vos"
            />

            <Section
              accent="violet"
              data={privateSpaces}
              renderItem={({ item }) => (
                <PrivateCard
                  item={item}
                  onPress={() => router.push({
                    pathname: '/activity/[activityId]',
                    params: { activityId: item.recordId },
                  })}
                />
              )}
              title="Actividades en espacios privados"
            />

            <Section
              accent="green"
              data={suggestions}
              emptySubtitle="Cuando haya actividades y grupos relacionados con tus gustos, van a aparecer acá."
              emptyTitle="Todavía no tenemos propuestas para vos"
              renderItem={({ item }) => (
                <SuggestionCard
                  item={item}
                  onPress={() => router.push(
                    item.source === 'activity'
                      ? {
                        pathname: '/activity/[activityId]',
                        params: { activityId: item.recordId },
                      }
                      : {
                        pathname: '/group/[groupId]',
                        params: { groupId: item.recordId },
                      },
                  )}
                />
              )}
              subtitle="(encuentros y grupos)"
              title="Propuestas que pueden interesarte"
            />
          </>
        )}

        <View style={styles.inviteBand}>
          <View style={styles.heartCircle}>
            <Heart color="#17803C" size={31} strokeWidth={2} />
          </View>
          <Text style={styles.inviteText}>
            Cuanto más uses Coincidir,{'\n'}mejores coincidencias vas a encontrar.
          </Text>
          <PressScale onPress={() => setIsInviteVisible(true)} style={styles.inviteButton} scaleTo={0.96}>
            <UsersRound color="#FFFFFF" size={20} strokeWidth={2.4} />
            <Text style={styles.inviteButtonText}>Invitar amigos</Text>
          </PressScale>
        </View>
        <InviteFriendsSheet
          onClose={() => setIsInviteVisible(false)}
          target={inviteTarget}
          visible={isInviteVisible}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

type SectionProps<T> = {
  title: string
  subtitle?: string
  accent: ThemeTone
  data: T[]
  emptySubtitle?: string
  emptyTitle?: string
  renderItem: ({ item }: { item: T }) => ReactElement
}

function Section<T extends { id: string }>({
  title,
  subtitle,
  accent,
  data,
  emptySubtitle,
  emptyTitle,
  renderItem,
}: SectionProps<T>) {
  const color = accent === 'violet' ? '#39206C' : '#006A32'

  if (data.length === 0 && !emptyTitle) return null

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleWrap}>
          <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        <PressScale style={styles.seeAll} scaleTo={0.96}>
          <Text style={[styles.seeAllText, { color }]}>Ver todo</Text>
          <ChevronRight color={color} size={21} strokeWidth={2.5} />
        </PressScale>
      </View>
      {data.length === 0 ? (
        <EmptyState subtitle={emptySubtitle} title={emptyTitle ?? ''} />
      ) : (
        <FlatList
          data={data}
          horizontal
          initialNumToRender={3}
          keyExtractor={(item) => item.id}
          maxToRenderPerBatch={4}
          renderItem={renderItem}
          showsHorizontalScrollIndicator={false}
          windowSize={4}
        />
      )}
    </View>
  )
}

type EmptyStateProps = {
  title: string
  subtitle?: string
}

function EmptyState({ title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.emptySearchState}>
      <View style={styles.emptySearchIcon}>
        <Sprout color="#17803C" size={32} strokeWidth={2.2} />
      </View>
      <Text style={styles.emptySearchTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySearchSubtitle}>{subtitle}</Text> : null}
    </View>
  )
}

const softShadow = Platform.select({
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
  scrollContent: {
    paddingBottom: 116,
    paddingTop: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 15,
  },
  greetingBlock: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    color: '#00613A',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 31,
  },
  prompt: {
    color: '#10231F',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 24,
    marginTop: 1,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
  },
  iconButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    position: 'relative',
    width: 42,
  },
  notificationDot: {
    backgroundColor: '#218B35',
    borderColor: '#FAFAF8',
    borderRadius: 999,
    borderWidth: 2,
    height: 11,
    position: 'absolute',
    right: 6,
    top: 4,
    width: 11,
  },
  searchCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1DD',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    height: 78,
    marginTop: 26,
    paddingHorizontal: 19,
    ...softShadow,
  },
  locationSelector: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minWidth: 150,
  },
  locationText: {
    color: '#10231F',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
  },
  searchDivider: {
    backgroundColor: '#E5E5E0',
    height: 40,
    marginHorizontal: 19,
    width: 1,
  },
  inputWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 18,
    minWidth: 0,
  },
  searchInput: {
    color: '#10231F',
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 0,
    minWidth: 0,
    padding: 0,
  },
  cityModalBackdrop: {
    backgroundColor: 'rgba(7, 57, 45, 0.22)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 18,
  },
  cityModalCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1DD',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    ...softShadow,
  },
  cityModalTitle: {
    color: '#063C31',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  cityOption: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  cityOptionSelected: {
    backgroundColor: '#F0F5E9',
  },
  cityOptionText: {
    color: '#10231F',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  cityOptionTextSelected: {
    color: '#006A32',
    fontWeight: '900',
  },
  categoryList: {
    gap: 16,
    paddingBottom: 2,
    paddingTop: 28,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  sectionTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 27,
  },
  sectionSubtitle: {
    color: '#10231F',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 20,
  },
  emptySearchState: {
    alignItems: 'center',
    marginTop: 34,
    paddingHorizontal: 24,
    paddingVertical: 30,
  },
  emptySearchIcon: {
    alignItems: 'center',
    backgroundColor: '#F0F5E9',
    borderColor: '#D7E8CC',
    borderRadius: 999,
    borderWidth: 1,
    height: 68,
    justifyContent: 'center',
    marginBottom: 14,
    width: 68,
  },
  emptySearchTitle: {
    color: '#063C31',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 23,
    textAlign: 'center',
  },
  emptySearchSubtitle: {
    color: '#56645F',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: 5,
    textAlign: 'center',
  },
  seeAll: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 32,
    paddingLeft: 8,
  },
  seeAllText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  inviteBand: {
    alignItems: 'center',
    backgroundColor: '#F2F5ED',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 18,
    marginTop: 22,
    minHeight: 88,
    paddingHorizontal: 20,
    ...softShadow,
  },
  heartCircle: {
    alignItems: 'center',
    backgroundColor: '#F0F8EC',
    borderColor: '#B7DC9D',
    borderRadius: 999,
    borderWidth: 1,
    height: 59,
    justifyContent: 'center',
    width: 59,
  },
  inviteText: {
    color: '#063C31',
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 22,
  },
  inviteButton: {
    alignItems: 'center',
    backgroundColor: '#006A32',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
})

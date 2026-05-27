import { useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import type { Href } from 'expo-router'
import {
  Alert,
  FlatList,
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
import { ActivityCard } from '../../components/home/HomeCards'
import { CategoryButton } from '../../components/home/CategoryButton'
import { PressScale } from '../../components/home/PressScale'
import type {
  ActivityCardItem,
  ThemeTone,
} from '../../components/home/types'
import { getFirebaseServices } from '../../firebaseConfig'
import { notifyActivityInterest, useUnreadNotificationsCount } from '../../lib/notifications'
import { getCategoryImage } from '../../utils/categoryImages'

type CategoryId = 'outdoor' | 'sports' | 'wellness' | 'groups' | 'private'

const DEFAULT_CITY = 'Tandil'
const NOTIFICATIONS_ROUTE = '/notificaciones' as Href
const SETTINGS_ROUTE = '/ajustes' as Href
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
type InterestState = {
  count: number
  interested: boolean
}

type UserNamesById = Record<string, string>

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

function getInterestedCount(data: Record<string, unknown>) {
  const interestedCount = readNumber(data.interestedCount, -1)
  if (interestedCount >= 0) return interestedCount

  const interestedUsers = data.interestedUsers
  if (typeof interestedUsers === 'object' && interestedUsers) {
    return Object.keys(interestedUsers).length
  }

  return 0
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
  return `${date}${time ? ` ${time}` : ''}`
}

function getRecordLocation(data: Record<string, unknown>) {
  return readString(data.location, readString(data.city, 'Ubicacion a definir'))
}

function getUserDisplayName(data: Record<string, unknown>) {
  return readString(
    data.fullName,
    readString(
      data.displayName,
      readString(
        data.name,
        readString(data.nombre),
      ),
    ),
  )
}

function getOrganizerName(data: Record<string, unknown>, userNamesById: UserNamesById = {}) {
  const creatorId = readString(data.createdBy) || readString(data.createdById) || readString(data.ownerId) || readString(data.userId)

  return readString(
    data.organizerName,
    readString(
      data.hostName,
      readString(
        data.createdByName,
        readString(
          data.ownerName,
          creatorId && userNamesById[creatorId] ? userNamesById[creatorId] : 'Organizador de Coincidir',
        ),
      ),
    ),
  )
}

function getCreatorId(data: Record<string, unknown>) {
  return readString(data.createdBy)
    || readString(data.createdById)
    || readString(data.creatorId)
    || readString(data.ownerId)
    || readString(data.userId)
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

function getActivityTime(record: CreatedRecord) {
  const isoDate = readString(record.data.activityDateISO)
  const parsedIsoDate = isoDate ? Date.parse(isoDate) : Number.NaN

  if (Number.isFinite(parsedIsoDate)) return parsedIsoDate

  const activityDate = record.data.activityDate
  if (typeof activityDate === 'object' && activityDate && 'toMillis' in activityDate && typeof activityDate.toMillis === 'function') {
    return activityDate.toMillis()
  }

  return getRecordTime(record)
}

function getJoinKey(collectionName: JoinableCollection, id: string) {
  return `${collectionName}:${id}`
}

function getInterestKey(id: string) {
  return `activities:${id}`
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

function isUserInterested(data: Record<string, unknown>, userId: string | null) {
  if (!userId) return false

  return hasUserInMap(data.interestedUsers, userId)
}

function requiresInterestAction(data: Record<string, unknown>) {
  const categoryId = getCategoryId(data)
  const additionalSettings = getAdditionalSettings(data)
  const privacy = normalize(additionalSettings.privacy)
  const cost = normalize(additionalSettings.cost)
  const detail = `${normalize(data.category)} ${normalize(data.subcategory)} ${normalize(data.type)} ${normalize(data.description)}`

  return categoryId === 'private'
    || privacy.includes('privada')
    || privacy.includes('aprobacion')
    || cost === 'pago'
    || cost === 'a la gorra'
    || detail.includes('aprobacion')
    || detail.includes('coordinar')
    || detail.includes('coordinacion')
    || detail.includes('cerrad')
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

function getInterestState(
  record: CreatedRecord,
  userId: string | null,
  optimisticInterests: Record<string, boolean>,
): InterestState {
  const persistedInterested = isUserInterested(record.data, userId)
  const key = getInterestKey(record.id)
  const interested = key in optimisticInterests ? optimisticInterests[key] : persistedInterested
  const countDelta = interested === persistedInterested ? 0 : interested ? 1 : -1

  return {
    count: Math.max(0, getInterestedCount(record.data) + countDelta),
    interested,
  }
}

function getJoinCta(joined: boolean) {
  return joined ? '✓ Te sumaste' : 'Me sumo'
}

function getInterestCta(interested: boolean) {
  return interested ? '✓ Te interesa' : 'Me interesa'
}

function mapActivityCard(
  record: CreatedRecord,
  joinState: JoinState,
  interestState: InterestState,
  userNamesById: UserNamesById,
): ActivityCardItem {
  const { data } = record
  const category = readString(data.category, 'Encuentro')
  const maxParticipants = getMaxParticipants(data)
  const action = requiresInterestAction(data) ? 'interest' : 'join'

  return {
    id: record.id,
    recordId: record.id,
    title: readString(data.name, 'Encuentro sin titulo'),
    image: getCategoryImage(data),
    dateBadge: formatDateBadge(readString(data.date)),
    people: maxParticipants > 0 ? `${joinState.count}/${maxParticipants}` : String(joinState.count),
    category,
    dateTime: formatSchedule(data),
    location: getRecordLocation(data),
    organizer: getOrganizerName(data, userNamesById),
    iconLabel: category,
    cta: action === 'interest' ? getInterestCta(interestState.interested) : getJoinCta(joinState.joined),
    action,
    Icon: getIcon(data),
  }
}

function getRecordCity(data: Record<string, unknown>) {
  return readString(data.city) || readString(data.locationCity) || readString(data.town)
}

function matchesSelectedCity(record: CreatedRecord, selectedCity: string) {
  const recordCity = getRecordCity(record.data)
  const normalizedCity = normalize(selectedCity)

  if (recordCity) return normalize(recordCity) === normalizedCity
  return true
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

export default function HomeScreen() {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState('Todas')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userNamesById, setUserNamesById] = useState<UserNamesById>({})
  const [createdActivities, setCreatedActivities] = useState<CreatedRecord[]>([])
  const [optimisticJoins, setOptimisticJoins] = useState<Record<string, boolean>>({})
  const [optimisticInterests, setOptimisticInterests] = useState<Record<string, boolean>>({})
  const [pendingJoinKeys, setPendingJoinKeys] = useState<string[]>([])
  const [pendingInterestKeys, setPendingInterestKeys] = useState<string[]>([])
  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY)
  const [isCitySelectorVisible, setIsCitySelectorVisible] = useState(false)
  const [isCitySearchVisible, setIsCitySearchVisible] = useState(false)
  const [citySearchQuery, setCitySearchQuery] = useState('')
  const [isInviteVisible, setIsInviteVisible] = useState(false)
  const [shareTarget, setShareTarget] = useState<InviteShareTarget>({ type: 'app' })
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const { unreadCount } = useUnreadNotificationsCount(currentUserId)
  const { width } = useWindowDimensions()
  const horizontalInset = width >= 430 ? 28 : 20

  useEffect(() => {
    let mounted = true

    AsyncStorage.getItem(SELECTED_CITY_STORAGE_KEY)
      .then((savedCity) => {
        if (mounted && typeof savedCity === 'string' && savedCity.trim()) {
          setSelectedCity(savedCity.trim())
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
          setUserName(null)
          return
        }

        setCurrentUserId(user.uid)

        const authName = user.displayName?.trim()

        try {
          const profileSnap = await getDoc(doc(db, 'users', user.uid))
          const profile = profileSnap.exists() ? profileSnap.data() : null
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
            setUserName(cleanName ? cleanName.split(' ')[0] : authName ? authName.split(' ')[0] : null)
          }
        } catch {
          if (mounted) {
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
    let unsubscribeUsers = () => {}

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

      unsubscribeUsers = onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          const nextNames: UserNamesById = {}

          snapshot.docs.forEach((item) => {
            const name = getUserDisplayName(item.data() as Record<string, unknown>)
            if (name) nextNames[item.id] = name
          })

          setUserNamesById(nextNames)
        },
        () => setUserNamesById({}),
      )
    } catch {
      setCreatedActivities([])
      setUserNamesById({})
    }

    return () => {
      unsubscribeActivities()
      unsubscribeUsers()
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
  const searchedActivities = useMemo(
    () => filterRecordsBySearch(cityActivities, debouncedSearchQuery, 'activity'),
    [cityActivities, debouncedSearchQuery],
  )
  const filteredActivities = useMemo(
    () => filterRecordsByCategory(searchedActivities, activeCategory),
    [activeCategory, searchedActivities],
  )
  const selectCity = async (city: string) => {
    const nextCity = city.trim()
    if (!nextCity) return

    setSelectedCity(nextCity)
    setIsCitySelectorVisible(false)
    setIsCitySearchVisible(false)
    setCitySearchQuery('')

    try {
      await AsyncStorage.setItem(SELECTED_CITY_STORAGE_KEY, nextCity)
    } catch {
      // The selector still works in-memory if local persistence is unavailable.
    }
  }
  const useCurrentLocation = () => {
    Alert.alert('Usar mi ubicación actual', 'Próximamente vamos a pedir permiso para detectar tu ciudad.')
  }
  const openCitySearch = () => {
    setIsCitySearchVisible(true)
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
  const toggleInterest = async (record: CreatedRecord) => {
    if (!currentUserId) return

    const key = getInterestKey(record.id)
    if (pendingInterestKeys.includes(key)) return

    const nextInterested = !getInterestState(record, currentUserId, optimisticInterests).interested

    setOptimisticInterests((current) => ({ ...current, [key]: nextInterested }))
    setPendingInterestKeys((current) => [...current, key])

    try {
      const { db } = getFirebaseServices()
      const targetRef = doc(db, 'activities', record.id)

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(targetRef)
        if (!snapshot.exists()) return

        const data = snapshot.data() as Record<string, unknown>
        const wasInterested = isUserInterested(data, currentUserId)
        const currentCount = getInterestedCount(data)
        const nextCount = Math.max(0, currentCount + (wasInterested ? -1 : 1))

        transaction.update(targetRef, wasInterested
          ? {
            [`interestedUsers.${currentUserId}`]: deleteField(),
            interestedCount: nextCount,
            updatedAt: serverTimestamp(),
          }
          : {
            [`interestedUsers.${currentUserId}`]: {
              interestedAt: serverTimestamp(),
              status: 'interested',
              uid: currentUserId,
              name: userName ?? '',
            },
            interestedCount: nextCount,
            updatedAt: serverTimestamp(),
          })
      })

      if (nextInterested) {
        Alert.alert('Te interesa', 'Le avisamos al organizador para que pueda contactarte.')

        const creatorId = getCreatorId(record.data)
        notifyActivityInterest({
          activityId: record.id,
          activityTitle: readString(record.data.name, 'tu actividad'),
          interestedUserId: currentUserId,
          interestedUserName: userName || 'Alguien',
          organizerId: creatorId,
        }).catch((error) => {
          if (__DEV__) console.warn('home-interest-notification-create-error', error)
        })
      }
    } catch {
      setOptimisticInterests((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
    } finally {
      setPendingInterestKeys((current) => current.filter((item) => item !== key))
    }
  }
  const nearbyMeetups = useMemo(
    () =>
      filteredActivities
        .filter((item) => getCategoryId(item.data) !== 'private')
        .sort((left, right) => getActivityTime(left) - getActivityTime(right))
        .map((item) => mapActivityCard(
          item,
          getJoinState(item, 'activities', currentUserId, optimisticJoins),
          getInterestState(item, currentUserId, optimisticInterests),
          userNamesById,
        )),
    [currentUserId, filteredActivities, optimisticInterests, optimisticJoins, userNamesById],
  )
  const privateSpaces = useMemo(
    () =>
      filteredActivities
        .filter((item) => getCategoryId(item.data) === 'private')
        .sort((left, right) => getActivityTime(left) - getActivityTime(right))
        .map((item) => mapActivityCard(
          item,
          getJoinState(item, 'activities', currentUserId, optimisticJoins),
          getInterestState(item, currentUserId, optimisticInterests),
          userNamesById,
        )),
    [currentUserId, filteredActivities, optimisticInterests, optimisticJoins, userNamesById],
  )
  const hasSearch = debouncedSearchQuery.trim().length > 0
  const hasCategoryFilter = activeCategory !== 'Todas'
  const hasVisibleResults = nearbyMeetups.length + privateSpaces.length > 0
  const activityRecordsById = useMemo(
    () => new Map(filteredActivities.map((item) => [item.id, item])),
    [filteredActivities],
  )
  const openAppInvite = () => {
    setShareTarget({ type: 'app' })
    setIsInviteVisible(true)
  }

  const openActivityShare = (item: ActivityCardItem) => {
    setShareTarget({
      dateTime: item.dateTime,
      id: item.recordId,
      location: item.location,
      title: item.title,
      type: 'activity',
    })
    setIsInviteVisible(true)
  }
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <CoincidirLogo markSize={50} textSize={17} cutoutColor="#FAFAF8" compact />
          <View style={styles.greetingBlock}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.greeting}>
              {greeting}
            </Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.prompt}>¿Qué vamos a hacer hoy?</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.betaBadge}>
              <Text style={styles.betaBadgeText}>BETA</Text>
            </View>
            <PressScale
              accessibilityLabel="Abrir notificaciones"
              accessibilityRole="button"
              onPress={() => router.push(NOTIFICATIONS_ROUTE)}
              style={styles.iconButton}
              scaleTo={0.94}
            >
              <Bell color="#05372D" size={27} strokeWidth={2.2} />
              {unreadCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
            </PressScale>
            <PressScale
              accessibilityLabel="Abrir ajustes"
              accessibilityRole="button"
              onPress={() => router.push(SETTINGS_ROUTE)}
              style={styles.iconButton}
              scaleTo={0.94}
            >
              <Settings color="#05372D" size={28} strokeWidth={2.2} />
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
            <MapPin color="#05372D" size={23} strokeWidth={2.1} />
            <Text style={styles.locationText}>{selectedCity}</Text>
            <ChevronDown color="#05372D" size={18} strokeWidth={2.4} />
          </PressScale>
          <View style={styles.searchDivider} />
          <View style={styles.inputWrap}>
            <Search color="#05372D" size={24} strokeWidth={2.1} />
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
              <Pressable
                accessibilityRole="menuitem"
                onPress={useCurrentLocation}
                style={styles.cityActionOption}
              >
                <MapPin color="#006A32" size={21} strokeWidth={2.2} />
                <Text numberOfLines={1} style={styles.cityActionText}>Usar mi ubicación actual</Text>
              </Pressable>
              <Text style={styles.cityModalSectionTitle}>Ciudades populares</Text>
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
                    <Text numberOfLines={1} style={[styles.cityOptionText, selected && styles.cityOptionTextSelected]}>
                      {city}
                    </Text>
                  </Pressable>
                )
              })}
              <Pressable
                accessibilityRole="menuitem"
                onPress={openCitySearch}
                style={styles.citySearchTrigger}
              >
                <Search color="#05372D" size={20} strokeWidth={2.1} />
                <Text numberOfLines={1} style={styles.citySearchTriggerText}>Buscar otra ciudad</Text>
              </Pressable>
              {isCitySearchVisible ? (
                <View style={styles.citySearchBox}>
                  <View style={styles.citySearchInputWrap}>
                    <Search color="#05372D" size={19} strokeWidth={2.1} />
                    <TextInput
                      autoCapitalize="words"
                      autoCorrect={false}
                      onChangeText={setCitySearchQuery}
                      placeholder="Escribí una ciudad"
                      placeholderTextColor="#85858B"
                      returnKeyType="done"
                      style={styles.citySearchInput}
                      value={citySearchQuery}
                    />
                  </View>
                  {citySearchQuery.trim() ? (
                    <Pressable
                      accessibilityRole="menuitem"
                      onPress={() => selectCity(citySearchQuery)}
                      style={styles.cityCustomOption}
                    >
                      <MapPin color="#006A32" size={20} strokeWidth={2.1} />
                      <Text numberOfLines={1} style={styles.cityCustomOptionText}>
                        Usar “{citySearchQuery.trim()}”
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
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
                  onSharePress={() => openActivityShare(item)}
                  onPress={() => router.push({
                    pathname: '/activity/[activityId]',
                    params: { activityId: item.recordId },
                  })}
                  onCtaPress={() => {
                    const record = activityRecordsById.get(item.recordId)
                    if (!record) return
                    if (item.action === 'interest') {
                      toggleInterest(record)
                    } else {
                      toggleJoin(record, 'activities')
                    }
                  }}
                />
              )}
              subtitle={`En ${selectedCity} y actividades sin ciudad definida`}
              title="Encuentros cerca de vos"
              variant="vertical"
            />

            <Section
              accent="violet"
              data={privateSpaces}
              renderItem={({ item }) => (
                <ActivityCard
                  item={item}
                  onSharePress={() => openActivityShare(item)}
                  onPress={() => router.push({
                    pathname: '/activity/[activityId]',
                    params: { activityId: item.recordId },
                  })}
                  onCtaPress={() => {
                    const record = activityRecordsById.get(item.recordId)
                    if (!record) return
                    if (item.action === 'interest') {
                      toggleInterest(record)
                    } else {
                      toggleJoin(record, 'activities')
                    }
                  }}
                />
              )}
              title="Actividades en espacios privados"
              variant="vertical"
            />
          </>
        )}

        <View style={styles.inviteBand}>
          <View style={styles.inviteContentRow}>
            <View style={styles.heartCircle}>
              <Heart color="#17803C" size={31} strokeWidth={2} />
            </View>
            <Text style={styles.inviteText}>
              Comparte la app con tus amigos para que se sumen a COINCIDIR y descubran actividades y grupos.
            </Text>
          </View>
          <PressScale onPress={openAppInvite} style={styles.inviteButton} scaleTo={0.96}>
            <UsersRound color="#00613F" size={20} strokeWidth={2.4} />
            <Text style={styles.inviteButtonText}>Invitar amigos a COINCIDIR</Text>
          </PressScale>
        </View>
        <InviteFriendsSheet
          onClose={() => setIsInviteVisible(false)}
          target={shareTarget}
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
  variant?: 'horizontal' | 'vertical'
}

function Section<T extends { id: string }>({
  title,
  subtitle,
  accent,
  data,
  emptySubtitle,
  emptyTitle,
  renderItem,
  variant = 'horizontal',
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
      ) : variant === 'vertical' ? (
        <View style={styles.verticalFeed}>
          {data.map((item) => (
            <View key={item.id} style={styles.verticalFeedItem}>
              {renderItem({ item })}
            </View>
          ))}
        </View>
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
    paddingBottom: 138,
    paddingTop: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  greetingBlock: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    color: '#00613A',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 25,
  },
  prompt: {
    color: '#10231F',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: 3,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  betaBadge: {
    alignItems: 'center',
    backgroundColor: '#18955D',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 10,
  },
  betaBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 12,
  },
  iconButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    position: 'relative',
    width: 38,
  },
  notificationBadge: {
    alignItems: 'center',
    backgroundColor: '#E84C3D',
    borderColor: '#FAFAF8',
    borderRadius: 999,
    borderWidth: 2,
    height: 19,
    justifyContent: 'center',
    minWidth: 19,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 1,
    top: 1,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 11,
  },
  searchCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1DD',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    height: 66,
    marginTop: 22,
    paddingHorizontal: 16,
    ...softShadow,
  },
  locationSelector: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    minWidth: 122,
  },
  locationText: {
    color: '#10231F',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  searchDivider: {
    backgroundColor: '#E5E5E0',
    height: 34,
    marginHorizontal: 14,
    width: 1,
  },
  inputWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  searchInput: {
    color: '#10231F',
    flex: 1,
    fontSize: 15,
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
  cityModalSectionTitle: {
    color: '#596A65',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 6,
    marginTop: 12,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
  },
  cityActionOption: {
    alignItems: 'center',
    backgroundColor: '#F0F5E9',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  cityActionText: {
    color: '#006A32',
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
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
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  cityOptionTextSelected: {
    color: '#006A32',
    fontWeight: '900',
  },
  citySearchTrigger: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  citySearchTriggerText: {
    color: '#10231F',
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  citySearchBox: {
    backgroundColor: '#FAFAF8',
    borderColor: '#E1E1DD',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    padding: 10,
  },
  citySearchInputWrap: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1DD',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  citySearchInput: {
    color: '#10231F',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    minWidth: 0,
    padding: 0,
  },
  cityCustomOption: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  cityCustomOptionText: {
    color: '#006A32',
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  categoryList: {
    gap: 14,
    paddingBottom: 2,
    paddingTop: 24,
  },
  section: {
    marginTop: 26,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  sectionTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 26,
  },
  sectionSubtitle: {
    color: '#10231F',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 20,
  },
  verticalFeed: {
    width: '100%',
  },
  verticalFeedItem: {
    alignSelf: 'stretch',
    width: '100%',
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
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  inviteBand: {
    alignItems: 'stretch',
    backgroundColor: '#F2F5ED',
    borderRadius: 20,
    gap: 14,
    marginTop: 22,
    minHeight: 132,
    paddingHorizontal: 20,
    paddingVertical: 18,
    ...softShadow,
  },
  inviteContentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
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
    backgroundColor: '#FFFFFF',
    borderColor: '#B7DC9D',
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    height: 50,
    justifyContent: 'center',
    maxWidth: 320,
    paddingHorizontal: 20,
    alignSelf: 'center',
    width: '100%',
    shadowColor: '#0E5A44',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  inviteButtonText: {
    color: '#00613F',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
})

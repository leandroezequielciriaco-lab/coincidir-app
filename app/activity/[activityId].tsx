import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  DollarSign,
  Dumbbell,
  Leaf,
  Lock,
  MapPin,
  Mountain,
  PauseCircle,
  Pencil,
  Trash2,
  UsersRound,
  Waves,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { GroupAvatar } from '../../components/groups/GroupAvatar'
import { PressScale } from '../../components/home/PressScale'
import { InviteFriendsSheet, type InviteShareTarget } from '../../components/InviteFriendsSheet'
import { getGroupTheme, groupTheme } from '../../constants/groupTheme'
import {
  type LocalGroup,
  LOCAL_GROUPS_STORAGE_KEY,
  readStoredLocalGroups,
} from '../../constants/localGroups'
import { getFirebaseServices } from '../../firebaseConfig'
import { readRemoteGroupPhotoUrl } from '../../lib/groupPhotos'
import { notifyActivityCancelled, notifyActivityConfirmed, notifyActivityInterest, notifyActivityJoined, notifyActivityRejected } from '../../lib/notifications'
import { getActivityGroupMeta } from '../../utils/activityGroups'
import { getActivityCustomName, getActivityPrimaryTitle } from '../../utils/activityTitles'
import { requireVerifiedParticipation } from '../../utils/authParticipation'
import { getActivityVisualState } from '../../utils/activityDiscovery'
import { getCategoryImage } from '../../utils/categoryImages'
import { savePendingExternalReturnRoute } from '../../utils/externalReturnRoute'
import { getJsInstanceId } from '../../utils/jsInstance'
import { resolveUserDisplayName, readStoredUserName } from '../../utils/userNames'

type ActivityData = Record<string, unknown>
type CategoryId = 'outdoor' | 'sports' | 'wellness' | 'groups'
type OrganizerProfile = {
  name: string
  photoURL: string
  subtitle: string
}
type InterestedUser = {
  name: string
  phone: string
  uid: string
}
type ConfirmedParticipant = {
  name: string
  uid: string
}
type InterestedAction = 'confirm' | 'reject'
type UserNamesById = Record<string, string>

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error) {
    const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : ''
    const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : ''
    return [code, message].filter(Boolean).join(' - ') || 'Error desconocido'
  }

  return typeof error === 'string' && error.trim() ? error : 'Error desconocido'
}

function showActivityDeleteError(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`)
    return
  }

  Alert.alert(title, message)
}

function showActivityCancelError(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`)
    return
  }

  Alert.alert(title, message)
}

function normalize(value: unknown) {
  return readString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getCategoryId(data: ActivityData): CategoryId | 'default' {
  const categoryId = readString(data.categoryId)

  if (categoryId === 'outdoor' || categoryId === 'sports' || categoryId === 'wellness' || categoryId === 'groups') {
    return categoryId
  }

  return 'default'
}

function getAdditionalSettings(data: ActivityData) {
  return typeof data.additionalSettings === 'object' && data.additionalSettings
    ? data.additionalSettings as ActivityData
    : {}
}

function getParticipantCount(data: ActivityData) {
  const participantsCount = readNumber(data.participantsCount, -1)
  if (participantsCount >= 0) return participantsCount

  const participants = data.participants ?? data.attendees ?? data.members
  if (typeof participants === 'object' && participants) return Object.keys(participants).length

  const joinedUsers = data.joinedUsers
  if (typeof joinedUsers === 'object' && joinedUsers) return Object.keys(joinedUsers).length

  return Array.isArray(participants) ? participants.length : 0
}

function getParticipantName(uid: string, value: unknown, userNamesById: UserNamesById = {}) {
  if (typeof value === 'object' && value) {
    const record = value as ActivityData
    return readStoredUserName(record) || userNamesById[uid] || 'Usuario'
  }

  return userNamesById[uid] || 'Usuario'
}

function getConfirmedParticipants(data: ActivityData, userNamesById: UserNamesById = {}): ConfirmedParticipant[] {
  const participants = data.participants ?? data.attendees ?? data.members

  if (typeof participants === 'object' && participants && !Array.isArray(participants)) {
    return Object.entries(participants as Record<string, unknown>)
      .map(([uid, value]) => ({
        name: getParticipantName(uid, value, userNamesById),
        uid,
      }))
  }

  if (Array.isArray(participants)) {
    return participants
      .map((item, index) => {
        if (typeof item === 'string') {
          return { name: userNamesById[item] || 'Usuario', uid: item }
        }

        if (typeof item === 'object' && item) {
          const record = item as ActivityData
          const uid = readString(record.uid, readString(record.userId, readString(record.id, `participant-${index}`)))
          return { name: getParticipantName(uid, record, userNamesById), uid }
        }

        return null
      })
      .filter((item): item is ConfirmedParticipant => Boolean(item))
  }

  const joinedUsers = data.joinedUsers
  if (typeof joinedUsers === 'object' && joinedUsers && !Array.isArray(joinedUsers)) {
    return Object.entries(joinedUsers as Record<string, unknown>)
      .map(([uid, value]) => ({
        name: getParticipantName(uid, value, userNamesById),
        uid,
      }))
  }

  return []
}

function getInterestedCount(data: ActivityData) {
  const interestedCount = readNumber(data.interestedCount, -1)
  if (interestedCount >= 0) return interestedCount

  const interestedUsers = data.interestedUsers
  if (typeof interestedUsers === 'object' && interestedUsers) return Object.keys(interestedUsers).length

  return 0
}

function getMaxParticipants(data: ActivityData) {
  const additionalSettings = getAdditionalSettings(data)
  return Math.max(1, readNumber(additionalSettings.maxParticipants, 10))
}

function hasUserInMap(value: unknown, userId: string) {
  return typeof value === 'object' && value !== null && userId in value
}

function hasUserInList(value: unknown, userId: string) {
  if (!Array.isArray(value)) return false

  return value.some((item) => {
    if (typeof item === 'string') return item === userId
    if (typeof item === 'object' && item) {
      const record = item as ActivityData
      return readString(record.uid) === userId
        || readString(record.userId) === userId
        || readString(record.id) === userId
    }

    return false
  })
}

function isUserJoined(data: ActivityData, userId: string | null) {
  if (!userId) return false

  return hasUserInMap(data.participants, userId)
    || hasUserInMap(data.joinedUsers, userId)
    || hasUserInList(data.participants, userId)
    || hasUserInList(data.attendees, userId)
    || hasUserInList(data.members, userId)
}

function isUserInterested(data: ActivityData, userId: string | null) {
  if (!userId) return false

  return hasUserInMap(data.interestedUsers, userId)
}

function getPhone(value: ActivityData) {
  return readString(value.phone)
    || readString(value.phoneNumber)
    || readString(value.telephone)
    || readString(value.mobile)
    || readString(value.whatsapp)
    || readString(value.whatsApp)
}

function getInterestedUsers(data: ActivityData, userNamesById: UserNamesById = {}): InterestedUser[] {
  const interestedUsers = data.interestedUsers
  if (typeof interestedUsers !== 'object' || !interestedUsers || Array.isArray(interestedUsers)) return []

  return Object.entries(interestedUsers as Record<string, unknown>)
    .map(([uid, value]) => {
      if (typeof value === 'object' && value) {
        const record = value as ActivityData
        return {
          name: readStoredUserName(record) || userNamesById[uid] || 'Usuario',
          phone: getPhone(record),
          uid,
        }
      }

      return {
        name: userNamesById[uid] || 'Usuario',
        phone: '',
        uid,
      }
    })
}

function requiresInterestAction(data: ActivityData) {
  const additionalSettings = getAdditionalSettings(data)
  const privacy = normalize(additionalSettings.privacy)
  const visibility = normalize(readString(data.visibility, readString(additionalSettings.visibility)))
  const cost = normalize(additionalSettings.cost)
  const detail = `${normalize(data.category)} ${normalize(data.subcategory)} ${normalize(data.type)} ${normalize(data.description)}`

  return visibility === 'group'
    || privacy.includes('grupo')
    || privacy.includes('privada')
    || privacy.includes('aprobacion')
    || cost === 'pago'
    || cost === 'a la gorra'
    || detail.includes('aprobacion')
    || detail.includes('coordinar')
    || detail.includes('coordinacion')
    || detail.includes('cerrad')
}

function getGroupMeta(data: ActivityData, localGroups: LocalGroup[] = []) {
  const groupMeta = getActivityGroupMeta(data, localGroups)

  if (__DEV__ && (groupMeta.groupId || groupMeta.groupName)) {
    console.log('[DetalleActividad] nombre final de grupo', {
      groupId: groupMeta.groupId,
      groupName: groupMeta.groupName,
    })
  }

  return groupMeta
}

function getIcon(data: ActivityData): LucideIcon {
  const categoryId = getCategoryId(data)
  const detail = `${normalize(data.subcategory)} ${normalize(data.name)}`

  if (detail.includes('kayak') || detail.includes('natacion') || detail.includes('paddle') || detail.includes('padel')) return Waves
  if (detail.includes('yoga') || detail.includes('meditacion') || categoryId === 'wellness') return Leaf
  if (detail.includes('escalada') || categoryId === 'outdoor') return Mountain
  if (categoryId === 'sports') return Dumbbell

  return UsersRound
}

function getPriceLabel(data: ActivityData) {
  const additionalSettings = getAdditionalSettings(data)
  const cost = readString(additionalSettings.cost, readString(data.cost, 'Gratis'))
  const price = readString(additionalSettings.price, readString(data.price))
  const currency = readString(additionalSettings.currency, readString(data.currency, 'ARS'))

  if (cost === 'Gratis' || !price) return 'Gratis'
  return `${currency} ${price} por persona`
}

function getOrganizerName(data: ActivityData) {
  return readString(data.organizerName)
    || readString(data.createdByName)
    || readString(data.hostName)
    || readString(data.ownerName)
    || 'Usuario'
}

function getCreatorId(data: ActivityData) {
  return readString(data.createdBy)
    || readString(data.organizerId)
    || readString(data.creatorId)
    || readString(data.ownerId)
    || readString(data.userId)
    || readString(data.createdById)
}

function getLocationDisplayName(data: ActivityData) {
  return readString(data.locationName)
    || readString(data.placeName)
    || readString(data.venueName)
    || readString(data.location)
    || 'Ubicación a definir'
}

function getLocationAddress(data: ActivityData, displayName: string) {
  const address = readString(
    data.locationAddress,
    readString(data.address, readString(data.fullAddress, readString(data.formattedAddress))),
  )

  return address && normalize(address) !== normalize(displayName) ? address : ''
}

function shortenAddress(value: string) {
  const cleanValue = value.trim().replace(/\s+/g, ' ')
  if (!cleanValue) return 'Ubicación a definir'

  const parts = cleanValue
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length <= 2) return cleanValue

  const provinceIndex = parts.findIndex((part) => normalize(part).includes('buenos aires'))
  const cityIndex = parts.findIndex((part) => normalize(part) === 'tandil')

  if (cityIndex > 0) return `${parts[0]}, ${parts[cityIndex]}`
  if (cityIndex >= 0 && provinceIndex >= 0 && cityIndex !== provinceIndex) return `${parts[cityIndex]}, Buenos Aires`
  if (provinceIndex > 0) return `${parts[provinceIndex - 1]}, Buenos Aires`

  return `${parts[0]}, ${parts[parts.length - 1]}`
}

function getLocationSummary(data: ActivityData) {
  const displayName = getLocationDisplayName(data)
  const address = getLocationAddress(data, displayName)
  return shortenAddress(address || displayName)
}

function getLocationCoordinate(data: ActivityData, field: 'latitude' | 'longitude') {
  const directField = field === 'latitude' ? data.locationLatitude : data.locationLongitude
  const directValue = readNumber(directField, Number.NaN)
  if (Number.isFinite(directValue)) return directValue

  const pin = data.locationPin
  if (typeof pin === 'object' && pin) {
    const value = readNumber((pin as Record<string, unknown>)[field], Number.NaN)
    if (Number.isFinite(value)) return value
  }

  return null
}

function getInterestedCountLabel(count: number) {
  return count === 1 ? '1 persona interesada' : `${count} personas interesadas`
}

function getOrganizerProfile(data: ActivityData | null, profile: ActivityData | null): OrganizerProfile {
  return {
    name: resolveUserDisplayName({ fallback: data ? getOrganizerName(data) : 'Usuario', profile }),
    photoURL: readString(profile?.photoURL, readString(profile?.avatarURL, readString(profile?.avatar))),
    subtitle: readString(profile?.organizerSubtitle, 'Organiza actividades en Coincidir'),
  }
}

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 'C'

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}

export default function ActivityDetailScreen() {
  const router = useRouter()
  const { activityId } = useLocalSearchParams<{ activityId?: string }>()
  const instanceId = getJsInstanceId()
  const safeBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/home')
    }
  }, [router])
  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [isMarkingInterest, setIsMarkingInterest] = useState(false)
  const [isInviteVisible, setIsInviteVisible] = useState(false)
  const [optimisticJoined, setOptimisticJoined] = useState<boolean | null>(null)
  const [optimisticInterested, setOptimisticInterested] = useState<boolean | null>(null)
  const [organizerProfile, setOrganizerProfile] = useState<ActivityData | null>(null)
  const [associatedGroupPhotoUrl, setAssociatedGroupPhotoUrl] = useState('')
  const [currentUserName, setCurrentUserName] = useState('')
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [userNamesById, setUserNamesById] = useState<UserNamesById>({})
  const [pendingInterestedActions, setPendingInterestedActions] = useState<string[]>([])
  const [isDeletingActivity, setIsDeletingActivity] = useState(false)
  const [isCancellingActivity, setIsCancellingActivity] = useState(false)
  const [localGroups, setLocalGroups] = useState<LocalGroup[]>([])
  const [isOpeningLocation, setIsOpeningLocation] = useState(false)
  const openedExternalMapsRef = useRef(false)

  const loadLocalGroups = useCallback(async () => {
    try {
      const storedValue = await AsyncStorage.getItem(LOCAL_GROUPS_STORAGE_KEY)
      const storedGroups = readStoredLocalGroups(storedValue)
      setLocalGroups(storedGroups)
    } catch (error) {
      if (__DEV__) console.warn('[DetalleActividad] error leyendo grupos locales', error)
    }
  }, [])

  useEffect(() => {
    console.log('[DETAIL MOUNT]', { activityId, instanceId })

    return () => {
      console.log('[DETAIL UNMOUNT]', { activityId, instanceId })
    }
  }, [activityId, instanceId])

  useEffect(() => {
    console.log('[ROUTE CURRENT]', {
      activityId,
      instanceId,
      pathname: '/activity/[activityId]',
    })
  }, [activityId, instanceId])

  useFocusEffect(
    useCallback(() => {
      void loadLocalGroups()
    }, [loadLocalGroups]),
  )

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      console.log('[APPSTATE CHANGE]', {
        activityId,
        instanceId,
        screen: 'activityDetail',
        state: nextState,
      })

      if (nextState === 'active' && openedExternalMapsRef.current) {
        console.log('[MAPS EXTERNAL RETURN]', { activityId, instanceId })
        openedExternalMapsRef.current = false
      }
    })

    return () => {
      subscription.remove()
    }
  }, [activityId, instanceId])

  useEffect(() => {
    try {
      const { auth } = getFirebaseServices()
      return onAuthStateChanged(auth, (user) => {
        console.log(user ? '[AUTH USER]' : '[AUTH NULL]', {
          activityId,
          instanceId,
          screen: 'activityDetail',
          uid: user?.uid ?? null,
        })
        setCurrentUserId(user?.uid ?? null)
        setCurrentUserName(resolveUserDisplayName({ firebaseUser: user, fallback: '' }))
        setCurrentUserEmail(user?.email?.trim() ?? '')
      })
    } catch {
      setCurrentUserId(null)
      setCurrentUserName('')
      return undefined
    }
  }, [activityId, instanceId])

  useEffect(() => {
    try {
      const { db } = getFirebaseServices()
      return onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          const nextNames: UserNamesById = {}
          snapshot.docs.forEach((item) => {
            const name = readStoredUserName(item.data() as ActivityData)
            if (name) nextNames[item.id] = name
          })
          setUserNamesById(nextNames)
        },
        () => setUserNamesById({}),
      )
    } catch {
      setUserNamesById({})
      return undefined
    }
  }, [])

  useEffect(() => {
    if (!activityId) {
      setIsLoading(false)
      return undefined
    }

    try {
      const { db } = getFirebaseServices()
      return onSnapshot(
        doc(db, 'activities', activityId),
        (snapshot) => {
          const data = snapshot.exists() ? snapshot.data() as ActivityData : null
          setActivity(data)
          setIsLoading(false)
          setOptimisticJoined(null)
          setOptimisticInterested(null)
        },
        () => {
          setActivity(null)
          setIsLoading(false)
        },
      )
    } catch {
      setActivity(null)
      setIsLoading(false)
      return undefined
    }
  }, [activityId])

  const creatorId = activity ? getCreatorId(activity) : ''
  const isOrganizer = Boolean(currentUserId && creatorId === currentUserId)

  useEffect(() => {
    if (!creatorId) {
      setOrganizerProfile(null)
      return undefined
    }

    try {
      const { db } = getFirebaseServices()
      return onSnapshot(
        doc(db, 'users', creatorId),
        (snapshot) => setOrganizerProfile(snapshot.exists() ? snapshot.data() as ActivityData : null),
        () => setOrganizerProfile(null),
      )
    } catch {
      setOrganizerProfile(null)
      return undefined
    }
  }, [creatorId])

  const activityGroupMeta = useMemo(() => getGroupMeta(activity ?? {}, localGroups), [activity, localGroups])

  useEffect(() => {
    if (!activityGroupMeta.groupId && !activityGroupMeta.groupName) {
      setAssociatedGroupPhotoUrl('')
      return undefined
    }

    try {
      const { db } = getFirebaseServices()
      if (!activityGroupMeta.groupId) {
        const targetName = normalize(activityGroupMeta.groupName)

        return onSnapshot(
          collection(db, 'groups'),
          (snapshot) => {
            const match = snapshot.docs.find((item) => {
              const data = item.data() as ActivityData
              return normalize(readString(data.name, readString(data.title))) === targetName
            })

            setAssociatedGroupPhotoUrl(match ? readRemoteGroupPhotoUrl(match.data() as ActivityData) : '')
          },
          () => setAssociatedGroupPhotoUrl(''),
        )
      }

      return onSnapshot(
        doc(db, 'groups', activityGroupMeta.groupId),
        (snapshot) => setAssociatedGroupPhotoUrl(snapshot.exists() ? readRemoteGroupPhotoUrl(snapshot.data() as ActivityData) : ''),
        () => setAssociatedGroupPhotoUrl(''),
      )
    } catch {
      setAssociatedGroupPhotoUrl('')
      return undefined
    }
  }, [activityGroupMeta.groupId, activityGroupMeta.groupName])

  const detail = useMemo(() => {
    const data = activity ?? {}
    const participantCount = getParticipantCount(data)
    const interestedCount = getInterestedCount(data)
    const maxParticipants = getMaxParticipants(data)
    const persistedJoined = isUserJoined(data, currentUserId)
    const persistedInterested = isUserInterested(data, currentUserId)
    const joined = optimisticJoined ?? persistedJoined
    const interested = optimisticInterested ?? persistedInterested
    const optimisticCount = participantCount + (optimisticJoined === null || optimisticJoined === persistedJoined ? 0 : optimisticJoined ? 1 : -1)
    const safeCount = Math.max(0, optimisticCount)
    const optimisticInterestCount = interestedCount + (optimisticInterested === null || optimisticInterested === persistedInterested ? 0 : optimisticInterested ? 1 : -1)
    const safeInterestedCount = Math.max(0, optimisticInterestCount)
    const action = requiresInterestAction(data) ? 'interest' : 'join'
    const isFull = safeCount >= maxParticipants && !joined
    const status = readString(data.status)
    const isCancelled = status === 'cancelled'
    const locationDisplayName = getLocationDisplayName(data)
    const locationAddress = getLocationAddress(data, locationDisplayName)
    const locationLatitude = getLocationCoordinate(data, 'latitude')
    const locationLongitude = getLocationCoordinate(data, 'longitude')
    const groupMeta = activityGroupMeta
    const additionalSettings = getAdditionalSettings(data)
    const visibility = normalize(readString(data.visibility, readString(additionalSettings.visibility)))
    const isGroupActivity = visibility === 'group' || Boolean(groupMeta.groupId || groupMeta.groupName)
    return {
      action,
      category: readString(data.category, 'Espacio privado'),
      date: readString(data.date, 'Fecha a definir'),
      description: readString(data.description, 'Sin descripción por ahora.'),
      Icon: getIcon(data),
      image: getCategoryImage(data),
      groupColor: groupMeta.groupColor,
      groupId: groupMeta.groupId,
      groupImageUrl: associatedGroupPhotoUrl,
      isGroupActivity,
      groupName: groupMeta.groupName,
      interested,
      interestedCount: safeInterestedCount,
      interestedUsers: getInterestedUsers(data, userNamesById),
      isCancelled,
      isFull,
      joined,
      location: getLocationSummary(data),
      locationAddress,
      locationLatitude,
      locationLongitude,
      maxParticipants,
      organizer: getOrganizerProfile(activity, organizerProfile),
      participantCount: safeCount,
      participants: getConfirmedParticipants(data, userNamesById),
      price: getPriceLabel(data),
      subcategory: readString(data.subcategory),
      time: readString(data.time, 'Horario a definir'),
      title: getActivityPrimaryTitle(data),
      customName: getActivityCustomName(data),
      visualState: getActivityVisualState(data),
    }
  }, [activity, activityGroupMeta, associatedGroupPhotoUrl, currentUserId, optimisticInterested, optimisticJoined, organizerProfile, userNamesById])

  useEffect(() => {
    if (detail.isCancelled && isInviteVisible) setIsInviteVisible(false)
  }, [detail.isCancelled, isInviteVisible])

  const setInterestedActionPending = (userId: string, action: InterestedAction, pending: boolean) => {
    const key = `${action}:${userId}`
    setPendingInterestedActions((current) => {
      if (pending) return current.includes(key) ? current : [...current, key]
      return current.filter((item) => item !== key)
    })
  }

  const isInterestedActionPending = (userId: string, action: InterestedAction) => {
    return pendingInterestedActions.includes(`${action}:${userId}`)
  }

  const getVisibleCurrentUserName = () => resolveUserDisplayName({
    email: currentUserEmail,
    fallback: 'Usuario',
    profile: currentUserId ? { fullName: currentUserName } : null,
  })

  const toggleJoin = async () => {
    if (!activityId || !activity || !currentUserId || detail.isCancelled || detail.isFull || isJoining) return

    const { auth } = getFirebaseServices()
    if (!(await requireVerifiedParticipation(auth))) return

    const nextJoined = !detail.joined
    setOptimisticJoined(nextJoined)
    setIsJoining(true)

    try {
      const { db } = getFirebaseServices()
      const targetRef = doc(db, 'activities', activityId)

      const result = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(targetRef)
        if (!snapshot.exists()) return 'missing'

        const data = snapshot.data() as ActivityData
        if (readString(data.status) === 'cancelled') return 'cancelled'

        const wasJoined = isUserJoined(data, currentUserId)
        const currentCount = getParticipantCount(data)
        const maxParticipants = getMaxParticipants(data)

        if (!wasJoined && currentCount >= maxParticipants) return 'full'

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
          title: readString(data.name, 'tu actividad'),
        }
      })

      if (typeof result === 'object' && result.status === 'joined') {
        notifyActivityJoined({
          activityId,
          activityTitle: result.title,
          joinedUserId: currentUserId,
          joinedUserName: getVisibleCurrentUserName(),
          organizerId: result.organizerId,
        }).catch((error) => {
          if (__DEV__) console.warn('joined-notification-create-error', error)
        })
      }
    } catch {
      setOptimisticJoined(null)
    } finally {
      setIsJoining(false)
    }
  }

  const toggleInterest = async () => {
    if (!activityId || !activity || !currentUserId || isOrganizer || detail.isCancelled || isMarkingInterest) return

    const { auth } = getFirebaseServices()
    if (!(await requireVerifiedParticipation(auth))) return

    const nextInterested = !detail.interested
    setOptimisticInterested(nextInterested)
    setIsMarkingInterest(true)

    try {
      const { db } = getFirebaseServices()
      const targetRef = doc(db, 'activities', activityId)

      const result = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(targetRef)
        if (!snapshot.exists()) return 'missing'

        const data = snapshot.data() as ActivityData
        if (readString(data.status) === 'cancelled') return 'cancelled'

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
          title: readString(data.name, 'tu actividad'),
        }
      })

      if (typeof result === 'object' && result.status === 'interested') {
        notifyActivityInterest({
          activityId,
          activityTitle: result.title,
          interestedUserId: currentUserId,
          interestedUserName: getVisibleCurrentUserName(),
          organizerId: result.organizerId,
        }).catch((error) => {
          if (__DEV__) console.warn('interest-notification-create-error', error)
        })
      }
    } catch {
      setOptimisticInterested(null)
    } finally {
      setIsMarkingInterest(false)
    }
  }

  const confirmInterestedUser = (user: InterestedUser) => {
    if (!activityId || !activity || detail.isCancelled || isInterestedActionPending(user.uid, 'confirm')) return

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(`Confirmar participante\n\n¿Confirmar a ${user.name} como participante?`)
      if (confirmed) void confirmInterestedUserNow(user)
      return
    }

    Alert.alert(
      'Confirmar participante',
      `¿Confirmar a ${user.name} como participante?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            void confirmInterestedUserNow(user)
          },
        },
      ],
    )
  }

  const confirmInterestedUserNow = async (user: InterestedUser) => {
    if (!activityId || !activity || detail.isCancelled || isInterestedActionPending(user.uid, 'confirm')) return

    setInterestedActionPending(user.uid, 'confirm', true)
    try {
      const { auth, db } = getFirebaseServices()
      if (!(await requireVerifiedParticipation(auth))) return
      const targetRef = doc(db, 'activities', activityId)

      const result = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(targetRef)
        if (!snapshot.exists()) return 'missing'

        const data = snapshot.data() as ActivityData
        if (readString(data.status) === 'cancelled') return 'cancelled'

        const wasJoined = isUserJoined(data, user.uid)
        const wasInterested = isUserInterested(data, user.uid)
        const currentCount = getParticipantCount(data)
        const maxParticipants = getMaxParticipants(data)
        const currentInterestedCount = getInterestedCount(data)
        const nextInterestedCount = Math.max(0, currentInterestedCount - (wasInterested ? 1 : 0))

        if (!wasJoined && currentCount >= maxParticipants) return 'full'

        transaction.update(targetRef, wasJoined
          ? {
            [`interestedUsers.${user.uid}`]: deleteField(),
            interestedCount: nextInterestedCount,
            updatedAt: serverTimestamp(),
          }
          : {
            [`joinedUsers.${user.uid}`]: true,
            [`participants.${user.uid}`]: {
              confirmedAt: serverTimestamp(),
              joinedAt: serverTimestamp(),
              name: user.name,
              status: 'joined',
              uid: user.uid,
            },
            [`interestedUsers.${user.uid}`]: deleteField(),
            interestedCount: nextInterestedCount,
            participantsCount: currentCount + 1,
            updatedAt: serverTimestamp(),
          })

        return wasJoined ? 'already-confirmed' : 'confirmed'
      })

      if (result === 'full') {
        Alert.alert('Sin cupos', 'No hay cupos disponibles para confirmar a esta persona.')
        return
      }

      if (result === 'already-confirmed') {
        Alert.alert('Participante confirmado', `${user.name} ya estaba confirmado como participante.`)
        return
      }

      if (result === 'missing') {
        Alert.alert('Actividad no disponible', 'No encontramos esta actividad para confirmar a la persona.')
        return
      }

      if (result === 'cancelled') {
        Alert.alert('Actividad cancelada', 'No podés confirmar participantes en una actividad cancelada.')
        return
      }

      Alert.alert('Participante confirmado', `${user.name} fue agregado a la actividad.`)

      notifyActivityConfirmed({
        activityId,
        activityTitle: detail.title,
        confirmedUserId: user.uid,
        organizerId: currentUserId ?? undefined,
      }).catch((error) => {
        if (__DEV__) console.warn('confirmation-notification-create-error', error)
      })
    } catch {
      Alert.alert('No pudimos confirmar', 'Intentá nuevamente en unos segundos.')
    } finally {
      setInterestedActionPending(user.uid, 'confirm', false)
    }
  }

  const rejectInterestedUser = (user: InterestedUser) => {
    if (!activityId || !activity || detail.isCancelled || isInterestedActionPending(user.uid, 'reject')) return

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm('Rechazar solicitud\n\n¿Rechazar esta solicitud?')
      if (confirmed) void rejectInterestedUserNow(user)
      return
    }

    Alert.alert(
      'Rechazar solicitud',
      '¿Rechazar esta solicitud?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: () => {
            void rejectInterestedUserNow(user)
          },
        },
      ],
    )
  }

  const rejectInterestedUserNow = async (user: InterestedUser) => {
    if (!activityId || !activity || detail.isCancelled || isInterestedActionPending(user.uid, 'reject')) return

    setInterestedActionPending(user.uid, 'reject', true)
    try {
      const { db } = getFirebaseServices()
      const targetRef = doc(db, 'activities', activityId)

      const result = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(targetRef)
        if (!snapshot.exists()) return 'missing'

        const data = snapshot.data() as ActivityData
        if (readString(data.status) === 'cancelled') return 'cancelled'

        const wasInterested = isUserInterested(data, user.uid)
        const currentInterestedCount = getInterestedCount(data)
        const nextInterestedCount = Math.max(0, currentInterestedCount - (wasInterested ? 1 : 0))

        if (!wasInterested) return 'not-interested'

        transaction.update(targetRef, {
          [`interestedUsers.${user.uid}`]: deleteField(),
          interestedCount: nextInterestedCount,
          updatedAt: serverTimestamp(),
        })

        return 'rejected'
      })

      if (result === 'missing') {
        Alert.alert('Actividad no disponible', 'No encontramos esta actividad para rechazar la solicitud.')
        return
      }

      if (result === 'cancelled') {
        Alert.alert('Actividad cancelada', 'No podés rechazar solicitudes en una actividad cancelada.')
        return
      }

      if (result === 'not-interested') {
        Alert.alert('Solicitud no disponible', `${user.name} ya no figura como interesado.`)
        return
      }

      Alert.alert('Solicitud rechazada', `${user.name} fue quitado de personas interesadas.`)

      notifyActivityRejected({
        activityId,
        activityTitle: detail.title,
        organizerId: currentUserId ?? undefined,
        rejectedUserId: user.uid,
      }).catch((error) => {
        if (__DEV__) console.warn('rejection-notification-create-error', error)
      })
    } catch {
      Alert.alert('No pudimos rechazar', 'Intentá nuevamente en unos segundos.')
    } finally {
      setInterestedActionPending(user.uid, 'reject', false)
    }
  }

  const cancelActivityNow = async () => {
    if (!activityId || !currentUserId || isCancellingActivity) return

    console.log('[WEB CANCEL ACTIVITY START]', {
      activityId,
      currentUserId,
      platform: Platform.OS,
    })
    setIsCancellingActivity(true)
    try {
      const { db } = getFirebaseServices()
      const targetRef = doc(db, 'activities', activityId)
      const snapshot = await getDoc(targetRef)

      if (!snapshot.exists()) {
        const message = 'No encontramos esta actividad para cancelarla.'
        console.warn('[WEB CANCEL ACTIVITY ERROR]', {
          activityId,
          currentUserId,
          message,
          platform: Platform.OS,
        })
        showActivityCancelError('Actividad no disponible', message)
        return
      }

      const latestActivity = snapshot.data() as ActivityData
      if (getCreatorId(latestActivity) !== currentUserId) {
        const latestCreatorId = getCreatorId(latestActivity)
        const ownerDetails = {
          createdBy: readString(latestActivity.createdBy),
          creatorId: readString(latestActivity.creatorId),
          ownerId: readString(latestActivity.ownerId),
          userId: readString(latestActivity.userId),
        }
        const message = `Solo quien organiza la actividad puede cancelarla. Usuario actual: ${currentUserId}. Owner detectado: ${latestCreatorId || 'sin owner'}.`
        console.warn('[WEB CANCEL ACTIVITY ERROR]', {
          activityId,
          currentUserId,
          detectedOwnerId: latestCreatorId,
          ownerDetails,
          platform: Platform.OS,
          reason: 'owner_mismatch',
        })
        if (Platform.OS === 'web') {
          showActivityCancelError('No podes cancelar esta actividad', message)
          return
        }
        Alert.alert('No podés cancelar esta actividad', 'Solo quien organiza la actividad puede cancelarla.')
        return
      }

      if (readString(latestActivity.status) === 'cancelled') {
        Alert.alert('Actividad ya cancelada', 'Esta actividad ya figura como cancelada.')
        return
      }

      await updateDoc(targetRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      console.log('[WEB CANCEL ACTIVITY SUCCESS]', {
        activityId,
        currentUserId,
        platform: Platform.OS,
      })
      notifyActivityCancelled({
        activity: latestActivity,
        activityId,
        activityTitle: readString(latestActivity.name, detail.title),
        organizerId: currentUserId,
      }).catch((error) => {
        if (__DEV__) console.warn('activity-cancelled-notification-create-error', error)
      })
      Alert.alert('Actividad cancelada', 'La actividad quedó cancelada, pero no se borró.')
    } catch (error) {
      const message = getErrorMessage(error)
      console.error('[WEB CANCEL ACTIVITY ERROR]', {
        activityId,
        currentUserId,
        error: message,
        platform: Platform.OS,
      })
      if (Platform.OS === 'web') {
        showActivityCancelError('No pudimos cancelar', message)
        return
      }
      Alert.alert('No pudimos cancelar', 'Intentá nuevamente en unos segundos.')
    } finally {
      setIsCancellingActivity(false)
    }
  }

  const confirmCancelActivity = () => {
    if (!isOrganizer || isCancellingActivity) return

    console.log('[WEB CANCEL ACTIVITY PRESS]', {
      activityId,
      currentUserId,
      creatorId,
      platform: Platform.OS,
    })

    if (detail.isCancelled) {
      Alert.alert('Actividad ya cancelada', 'Esta actividad ya figura como cancelada.')
      return
    }

    const hasPeople = detail.interestedCount > 0 || detail.participantCount > 0
    const message = hasPeople
      ? 'Esta actividad tiene personas interesadas, participantes o confirmadas. Si la cancelas, quedara marcada como cancelada y ya no se podran sumar ni gestionar invitaciones, pero no se borrara.'
      : 'La actividad quedara marcada como cancelada y ya no se podran sumar personas, pero no se borrara.'

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(`Cancelar actividad\n\n${message}`)
      console.log('[WEB CANCEL ACTIVITY CONFIRM]', {
        activityId,
        confirmed,
        currentUserId,
        platform: Platform.OS,
      })
      if (confirmed) void cancelActivityNow()
      return
    }

    Alert.alert(
      'Cancelar actividad',
      hasPeople
        ? 'Esta actividad tiene personas interesadas, participantes o confirmadas. Si la cancelás, quedará marcada como cancelada y ya no se podrán sumar ni gestionar invitaciones, pero no se borrará.'
        : 'La actividad quedará marcada como cancelada y ya no se podrán sumar personas, pero no se borrará.',
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Cancelar actividad',
          style: 'destructive',
          onPress: () => {
            void cancelActivityNow()
          },
        },
      ],
    )
  }

  const deleteActivityNow = async () => {
    if (!activityId || !currentUserId || isDeletingActivity) return

    console.log('[WEB DELETE ACTIVITY START]', {
      activityId,
      currentUserId,
      platform: Platform.OS,
    })
    setIsDeletingActivity(true)
    try {
      const { db } = getFirebaseServices()
      const targetRef = doc(db, 'activities', activityId)
      const snapshot = await getDoc(targetRef)

      if (!snapshot.exists()) {
        const message = 'No encontramos esta actividad para eliminarla.'
        console.warn('[WEB DELETE ACTIVITY ERROR]', {
          activityId,
          currentUserId,
          message,
          platform: Platform.OS,
        })
        showActivityDeleteError('Actividad no disponible', message)
        return
      }

      const latestActivity = snapshot.data() as ActivityData
      const latestCreatorId = getCreatorId(latestActivity)
      if (latestCreatorId !== currentUserId) {
        const ownerDetails = {
          createdBy: readString(latestActivity.createdBy),
          createdById: readString(latestActivity.createdById),
          creatorId: readString(latestActivity.creatorId),
          organizerId: readString(latestActivity.organizerId),
          ownerId: readString(latestActivity.ownerId),
          userId: readString(latestActivity.userId),
        }
        const message = `Solo quien organiza la actividad puede eliminarla. Usuario actual: ${currentUserId}. Owner detectado: ${latestCreatorId || 'sin owner'}.`
        console.warn('[WEB DELETE ACTIVITY ERROR]', {
          activityId,
          currentUserId,
          detectedOwnerId: latestCreatorId,
          ownerDetails,
          platform: Platform.OS,
          reason: 'owner_mismatch',
        })
        if (Platform.OS === 'web') {
          showActivityDeleteError('No podes eliminar esta actividad', message)
          return
        }
        Alert.alert('No podés eliminar esta actividad', 'Solo quien organiza la actividad puede eliminarla.')
        return
      }

      await deleteDoc(targetRef)
      console.log('[WEB DELETE ACTIVITY SUCCESS]', {
        activityId,
        currentUserId,
        platform: Platform.OS,
      })
      router.replace('/home')
    } catch (error) {
      const message = getErrorMessage(error)
      console.error('[WEB DELETE ACTIVITY ERROR]', {
        activityId,
        currentUserId,
        error: message,
        platform: Platform.OS,
      })
      if (Platform.OS === 'web') {
        showActivityDeleteError('No pudimos eliminar', message)
        return
      }
      Alert.alert('No pudimos eliminar', 'Intentá nuevamente en unos segundos.')
    } finally {
      setIsDeletingActivity(false)
    }
  }

  const confirmDeleteActivity = () => {
    if (!isOrganizer || isDeletingActivity) return

    console.log('[WEB DELETE ACTIVITY PRESS]', {
      activityId,
      currentUserId,
      creatorId,
      platform: Platform.OS,
    })
    const hasPeople = detail.interestedCount > 0 || detail.participantCount > 0
    const message = hasPeople
      ? 'Esta actividad tiene personas interesadas o confirmadas. Si la eliminas, dejara de estar disponible para todos. Esta accion no se puede deshacer.'
      : 'Esta accion no se puede deshacer.'

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(`Eliminar actividad\n\n${message}`)
      console.log('[WEB DELETE ACTIVITY CONFIRM]', {
        activityId,
        confirmed,
        currentUserId,
        platform: Platform.OS,
      })
      if (confirmed) void deleteActivityNow()
      return
    }

    Alert.alert(
      'Eliminar actividad',
      hasPeople
        ? 'Esta actividad tiene personas interesadas o confirmadas. Si la eliminás, dejará de estar disponible para todos. Esta acción no se puede deshacer.'
        : 'Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void deleteActivityNow()
          },
        },
      ],
    )
  }

  const editActivity = () => {
    if (!isOrganizer || !activityId) return

    router.push({
      pathname: '/(tabs)/crear',
      params: { mode: 'edit', activityId },
    })
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color="#4B348A" />
        </View>
      </SafeAreaView>
    )
  }

  if (!activity) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.missingTitle}>No encontramos la actividad</Text>
          <PressScale onPress={safeBack} style={styles.secondaryButton} scaleTo={0.97}>
            <Text style={styles.secondaryButtonText}>Volver</Text>
          </PressScale>
        </View>
      </SafeAreaView>
    )
  }

  const availablePlaces = Math.max(0, detail.maxParticipants - detail.participantCount)
  const groupColors = getGroupTheme(detail.groupColor)
  const isFinished = detail.visualState?.key === 'finished'
  const isPrimaryActionDisabled = detail.isCancelled
    || isFinished
    || isOrganizer
    || (detail.action === 'join' ? detail.isFull || isJoining : isMarkingInterest)
  const primaryActionLabel = detail.isCancelled
    ? 'Actividad cancelada'
    : isOrganizer
      ? 'Tu actividad'
      : isFinished
        ? 'Actividad finalizada'
        : detail.action === 'interest'
          ? detail.interested ? 'Te interesa' : 'Me interesa'
          : detail.isFull ? 'Actividad completa' : detail.joined ? 'Te sumaste' : 'Me sumo'
  const isPrimaryActionMuted = isPrimaryActionDisabled || detail.joined || detail.interested
  const canOpenActivityChat = Boolean(activityId && currentUserId && (isOrganizer || detail.joined))
  const inviteTarget: InviteShareTarget = {
    dateTime: `${detail.date} ${detail.time}`,
    id: activityId,
    location: detail.location,
    title: detail.title,
    type: 'activity',
  }

  const openActivityChat = () => {
    if (!activityId || !canOpenActivityChat) return

    router.push({
      pathname: '/chat/[chatId]',
      params: { chatId: activityId, source: 'activity' },
    })
  }

  const openActivityLocation = async () => {
    if (isOpeningLocation) {
      return
    }

    const hasCoordinates = typeof detail.locationLatitude === 'number'
      && Number.isFinite(detail.locationLatitude)
      && typeof detail.locationLongitude === 'number'
      && Number.isFinite(detail.locationLongitude)

    if (!hasCoordinates) {
      Alert.alert('Ubicación no disponible', 'Esta actividad todavía no tiene una ubicación para abrir en Maps.')
      return
    }

    const lat = detail.locationLatitude
    const lng = detail.locationLongitude
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

    console.log('[MAPS EXTERNAL OPEN]', { activityId, lat, lng, url })
    setIsOpeningLocation(true)
    setTimeout(() => {
      setIsOpeningLocation(false)
    }, 1000)

    try {
      if (activityId) {
        await savePendingExternalReturnRoute({
          params: { activityId },
          pathname: '/activity/[activityId]',
          source: 'googleMaps',
        })
      }
      openedExternalMapsRef.current = true
      await Linking.openURL(url)
      console.log('[MAPS EXTERNAL OPEN OK]', { activityId })
    } catch (error) {
      openedExternalMapsRef.current = false
      console.error('[ACTIVITY LOCATION OPEN ERROR]', error)
      Alert.alert('No pudimos abrir Maps', 'Intentá nuevamente en unos segundos.')
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <PressScale accessibilityLabel="Volver" accessibilityRole="button" onPress={safeBack} style={styles.iconButton} scaleTo={0.94}>
            <ArrowLeft color="#063C31" size={26} strokeWidth={2.4} />
          </PressScale>
          <Text style={styles.headerTitle}>Detalle de actividad</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.heroWrap}>
          <Image source={detail.image} style={styles.heroImage} />
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{detail.participantCount}/{detail.maxParticipants}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.activityIcon}>
              <detail.Icon color="#4B348A" size={28} strokeWidth={2.2} />
            </View>
            <View style={styles.titleCopy}>
              {detail.visualState ? (
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: detail.visualState.backgroundColor,
                      borderColor: detail.visualState.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: detail.visualState.color }]}>{detail.visualState.label}</Text>
                </View>
              ) : null}
              <Text style={styles.title}>{detail.title}</Text>
              {detail.customName ? (
                <Text style={styles.customName}>{detail.customName}</Text>
              ) : null}
            </View>
          </View>

          <InfoRow Icon={CalendarDays} label={detail.date} />
          <InfoRow Icon={Clock3} label={detail.time} />
          <InfoRow Icon={MapPin} label={detail.location} onPress={openActivityLocation} secondary="Tocar para abrir en Maps" disabled={isOpeningLocation} />
          <InfoRow Icon={UsersRound} label={`${detail.participantCount} de ${detail.maxParticipants} participantes`} />

          {detail.groupName ? (
            <View style={[styles.groupActivityCard, { backgroundColor: groupColors.backgroundColor, borderColor: groupColors.borderColor }]}>
              <Text style={styles.groupActivityEyebrow}>Actividad de grupo</Text>
              <View style={styles.groupActivityRow}>
                <GroupAvatar groupName={detail.groupName} imageUrl={detail.groupImageUrl} size={32} />
                <Text numberOfLines={1} style={[styles.groupActivityName, { color: groupColors.chipTextColor }]}>{detail.groupName}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.capacityTrack}>
            <View style={[styles.capacityFill, { width: `${Math.min(100, (detail.participantCount / detail.maxParticipants) * 100)}%` }]} />
          </View>
          <Text style={[styles.availableText, detail.isFull && styles.fullText]}>
            {detail.isFull ? 'Actividad completa' : `${availablePlaces} lugares disponibles`}
          </Text>

          {detail.subcategory ? <InfoRow Icon={Lock} label={detail.subcategory} /> : null}
          <InfoRow Icon={DollarSign} label={detail.price} />

          <Text style={styles.description}>{detail.description}</Text>

          {canOpenActivityChat ? (
            <Pressable
              accessibilityLabel="Ir al chat"
              accessibilityRole="button"
              onPress={openActivityChat}
              style={{
                alignItems: 'center',
                backgroundColor: '#6C3DE5',
                borderColor: '#6C3DE5',
                borderRadius: 16,
                borderWidth: 2,
                justifyContent: 'center',
                marginVertical: 12,
                minHeight: 56,
                width: '100%',
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 18,
                  fontWeight: '700',
                }}
              >
                Ir al chat
              </Text>
            </Pressable>
          ) : null}

          {Platform.OS !== 'web' ? (
            <Pressable
              accessibilityLabel={primaryActionLabel}
              accessibilityRole="button"
              disabled={isPrimaryActionDisabled}
              onPress={detail.action === 'interest' ? toggleInterest : toggleJoin}
              style={{
                alignItems: 'center',
                backgroundColor: '#0F8A3B',
                borderColor: '#0F8A3B',
                borderRadius: 16,
                borderWidth: 2,
                justifyContent: 'center',
                marginVertical: 12,
                minHeight: 56,
                opacity: isPrimaryActionDisabled ? 0.9 : 1,
                width: '100%',
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 17,
                  fontWeight: '700',
                  textAlign: 'center',
                }}
              >
                {primaryActionLabel}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel={primaryActionLabel}
              accessibilityRole="button"
              disabled={isPrimaryActionDisabled}
              onPress={detail.action === 'interest' ? toggleInterest : toggleJoin}
              style={({ pressed }) => [
                styles.primaryButton,
                detail.action === 'interest' && styles.primaryButtonInterest,
                isPrimaryActionMuted && styles.primaryButtonMuted,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={[
                styles.primaryButtonText,
                detail.action === 'interest' && styles.primaryButtonTextInterest,
                isPrimaryActionMuted && styles.primaryButtonTextMuted,
              ]}>
                {primaryActionLabel}
              </Text>
            </Pressable>
          )}

          <View style={styles.organizerCard}>
            <Text style={styles.organizerEyebrow}>Organizado por</Text>
            <View style={styles.organizerRow}>
              <View style={styles.avatar}>
                {detail.organizer.photoURL ? (
                  <Image source={{ uri: detail.organizer.photoURL }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{getInitials(detail.organizer.name)}</Text>
                )}
              </View>
              <View style={styles.organizerCopy}>
                <Text numberOfLines={1} style={styles.organizerName}>{detail.organizer.name}</Text>
                <Text numberOfLines={1} style={styles.organizerSubtitle}>{detail.organizer.subtitle}</Text>
              </View>
            </View>
          </View>

          {isOrganizer ? (
            <View style={styles.ownerActionsCard}>
              <Text style={styles.organizerEyebrow}>Gestionar actividad</Text>
              <View style={styles.ownerActionsList}>
                <PressScale
                  accessibilityLabel="Editar actividad"
                  accessibilityRole="button"
                  onPress={editActivity}
                  scaleTo={0.97}
                  style={styles.editActivityButton}
                >
                  <Pencil color="#155C47" size={18} strokeWidth={2.8} />
                  <Text style={styles.editActivityText}>Editar actividad</Text>
                </PressScale>
                <PressScale
                  accessibilityLabel="Cancelar actividad"
                  accessibilityRole="button"
                  disabled={detail.isCancelled || isCancellingActivity}
                  onPress={confirmCancelActivity}
                  scaleTo={0.97}
                  style={[
                    styles.cancelActivityButton,
                    (detail.isCancelled || isCancellingActivity) && styles.cancelActivityButtonDisabled,
                  ]}
                >
                  {isCancellingActivity ? (
                    <ActivityIndicator color="#8A4B00" size="small" />
                  ) : (
                    <>
                      <PauseCircle color="#8A4B00" size={18} strokeWidth={2.8} />
                      <Text style={styles.cancelActivityText}>
                        {detail.isCancelled ? 'Actividad cancelada' : 'Cancelar actividad'}
                      </Text>
                    </>
                  )}
                </PressScale>
                <PressScale
                  accessibilityLabel="Eliminar actividad"
                  accessibilityRole="button"
                  disabled={isDeletingActivity}
                  onPress={confirmDeleteActivity}
                  scaleTo={0.97}
                  style={[styles.deleteActivityButton, isDeletingActivity && styles.deleteActivityButtonDisabled]}
                >
                  {isDeletingActivity ? (
                    <ActivityIndicator color="#B42318" size="small" />
                  ) : (
                    <>
                      <Trash2 color="#B42318" size={18} strokeWidth={2.8} />
                      <Text style={styles.deleteActivityText}>Eliminar actividad</Text>
                    </>
                  )}
                </PressScale>
              </View>
            </View>
          ) : null}

          {isOrganizer && detail.participants.length > 0 ? (
            <View style={styles.confirmedCard}>
              <Text style={styles.organizerEyebrow}>Participantes confirmados ({detail.participants.length})</Text>
              <View style={styles.confirmedList}>
                {detail.participants.slice(0, 8).map((participant) => (
                  <View key={participant.uid} style={styles.confirmedItem}>
                    <Check color="#17803C" size={15} strokeWidth={2.6} />
                    <Text numberOfLines={1} style={styles.confirmedName}>{participant.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {isOrganizer && detail.action === 'interest' && !detail.isGroupActivity ? (
            <View style={styles.interestedCard}>
              <Text style={styles.organizerEyebrow}>Personas interesadas</Text>
              <Text style={styles.interestedCount}>{getInterestedCountLabel(detail.interestedCount)}</Text>
              <View style={styles.interestedList}>
                {detail.interestedUsers.length > 0 ? detail.interestedUsers.slice(0, 5).map((user) => (
                  <View key={user.uid} style={styles.interestedItem}>
                    <Text numberOfLines={1} style={styles.interestedName}>{user.name}</Text>
                    <Text style={styles.interestedSubtitle}>Quiere participar en esta actividad</Text>
                    <View style={styles.interestedActions}>
                      {Platform.OS === 'web' ? (
                        <View style={styles.interestedPrimaryActions}>
                          <Pressable
                            accessibilityLabel={`Rechazar a ${user.name}`}
                            accessibilityRole="button"
                            disabled={detail.isCancelled || isInterestedActionPending(user.uid, 'reject')}
                            onPress={() => {
                              rejectInterestedUser(user)
                            }}
                            style={({ pressed }) => [
                              styles.rejectAction,
                              pressed && styles.interestedActionPressed,
                              detail.isCancelled && styles.interestedActionDisabled,
                            ]}
                          >
                            {isInterestedActionPending(user.uid, 'reject') ? (
                              <ActivityIndicator color="#B42318" size="small" />
                            ) : (
                              <Text style={styles.rejectActionText}>Rechazar</Text>
                            )}
                          </Pressable>
                          <Pressable
                            accessibilityLabel={`Aceptar a ${user.name}`}
                            accessibilityRole="button"
                            disabled={detail.isCancelled || isInterestedActionPending(user.uid, 'confirm')}
                            onPress={() => {
                              confirmInterestedUser(user)
                            }}
                            style={({ pressed }) => [
                              styles.confirmAction,
                              pressed && styles.interestedActionPressed,
                              detail.isCancelled && styles.interestedActionDisabled,
                            ]}
                          >
                            {isInterestedActionPending(user.uid, 'confirm') ? (
                              <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                              <Text style={styles.confirmActionText}>Aceptar</Text>
                            )}
                          </Pressable>
                        </View>
                      ) : Platform.OS === 'android' ? (
                        <View style={styles.androidInterestedActions}>
                          <Pressable
                            accessibilityLabel={`Rechazar a ${user.name}`}
                            accessibilityRole="button"
                            disabled={detail.isCancelled || isInterestedActionPending(user.uid, 'reject')}
                            onPress={() => rejectInterestedUser(user)}
                            style={({ pressed }) => [
                              styles.androidRejectAction,
                              pressed && styles.androidInterestedActionPressed,
                              detail.isCancelled && styles.androidInterestedActionDisabled,
                            ]}
                          >
                            {isInterestedActionPending(user.uid, 'reject') ? (
                              <ActivityIndicator color="#B42318" size="small" />
                            ) : (
                              <Text style={styles.androidRejectActionText}>Rechazar</Text>
                            )}
                          </Pressable>
                          <Pressable
                            accessibilityLabel={`Aceptar a ${user.name}`}
                            accessibilityRole="button"
                            disabled={detail.isCancelled || isInterestedActionPending(user.uid, 'confirm')}
                            onPress={() => confirmInterestedUser(user)}
                            style={({ pressed }) => ({
                              alignItems: 'center',
                              justifyContent: 'center',
                              minHeight: 48,
                              opacity: detail.isCancelled ? 0.5 : pressed ? 0.88 : 1,
                              paddingHorizontal: 16,
                              paddingVertical: 12,
                              width: '100%',
                            })}
                          >
                            {isInterestedActionPending(user.uid, 'confirm') ? (
                              <ActivityIndicator color="#000000" size="small" />
                            ) : (
                              <Text style={{ color: '#000000', fontSize: 18, fontWeight: '900', letterSpacing: 0 }}>Aceptar</Text>
                            )}
                          </Pressable>
                        </View>
                      ) : (
                        <View style={styles.interestedPrimaryActions}>
                          <Pressable
                            accessibilityLabel={`Rechazar a ${user.name}`}
                            accessibilityRole="button"
                            disabled={detail.isCancelled || isInterestedActionPending(user.uid, 'reject')}
                            onPress={() => rejectInterestedUser(user)}
                            style={({ pressed }) => [
                              styles.rejectAction,
                              pressed && styles.interestedActionPressed,
                              detail.isCancelled && styles.interestedActionDisabled,
                            ]}
                          >
                            {isInterestedActionPending(user.uid, 'reject') ? (
                              <ActivityIndicator color="#B42318" size="small" />
                            ) : (
                              <Text style={styles.rejectActionText}>Rechazar</Text>
                            )}
                          </Pressable>
                          <Pressable
                            accessibilityLabel={`Aceptar a ${user.name}`}
                            accessibilityRole="button"
                            disabled={detail.isCancelled || isInterestedActionPending(user.uid, 'confirm')}
                            onPress={() => confirmInterestedUser(user)}
                            style={({ pressed }) => [
                              styles.confirmAction,
                              pressed && styles.interestedActionPressed,
                              detail.isCancelled && styles.interestedActionDisabled,
                            ]}
                          >
                            {isInterestedActionPending(user.uid, 'confirm') ? (
                              <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                              <Text style={styles.confirmActionText}>Aceptar</Text>
                            )}
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                )) : (
                  <Text style={styles.interestedEmpty}>Todavía no hay interesados.</Text>
                )}
              </View>
            </View>
          ) : null}

          <PressScale
            disabled={detail.isCancelled}
            onPress={() => setIsInviteVisible(true)}
            scaleTo={0.97}
            style={[styles.inviteButton, detail.isCancelled && styles.inviteButtonDisabled]}
          >
            <UsersRound color="#FFFFFF" size={20} strokeWidth={2.4} />
            <Text style={styles.inviteButtonText}>Invitar amigos</Text>
          </PressScale>
        </View>
      </ScrollView>
      <InviteFriendsSheet
        onClose={() => setIsInviteVisible(false)}
        target={inviteTarget}
        visible={isInviteVisible}
      />
    </SafeAreaView>
  )
}

type InfoRowProps = {
  Icon: LucideIcon
  label: string
  onPress?: () => void
  secondary?: string
  disabled?: boolean
}

function InfoRow({ Icon, label, onPress, secondary, disabled = false }: InfoRowProps) {
  const content = (
    <>
      <Icon color="#4B348A" size={20} strokeWidth={2.2} />
      <View style={styles.infoCopy}>
        <Text style={styles.infoText}>{label}</Text>
        {secondary ? <Text numberOfLines={1} style={styles.infoSecondary}>{secondary}</Text> : null}
      </View>
    </>
  )

  if (onPress) {
    return (
      <Pressable
        accessibilityHint={secondary}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.infoRow, styles.infoRowPressable, pressed && styles.infoRowPressed, disabled && styles.infoRowDisabled]}
      >
        {content}
      </Pressable>
    )
  }

  return (
    <View style={styles.infoRow}>
      {content}
    </View>
  )
}

const shadow = Platform.select({
  web: {
    boxShadow: '0 16px 34px rgba(7, 57, 45, 0.10)',
  },
  default: {
    elevation: 4,
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
    paddingBottom: 34,
    ...Platform.select({
      web: {
        alignItems: 'center',
        paddingHorizontal: 24,
      },
      default: {},
    }),
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    ...Platform.select({
      web: {
        maxWidth: 960,
        width: '100%',
      },
      default: {},
    }),
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerTitle: {
    color: '#063C31',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  heroWrap: {
    height: 210,
    position: 'relative',
    ...Platform.select({
      web: {
        borderRadius: 18,
        height: 240,
        maxWidth: 960,
        overflow: 'hidden',
        width: '100%',
      },
      default: {},
    }),
  },
  heroImage: {
    height: '100%',
    width: '100%',
  },
  heroBadge: {
    backgroundColor: 'rgba(7, 57, 45, 0.86)',
    borderRadius: 999,
    bottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: 'absolute',
    right: 16,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginTop: -18,
    padding: 20,
    ...shadow,
    ...Platform.select({
      web: {
        borderBottomLeftRadius: 22,
        borderBottomRightRadius: 22,
        marginTop: -10,
        maxWidth: 960,
        paddingTop: 18,
        width: '100%',
      },
      default: {},
    }),
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  activityIcon: {
    alignItems: 'center',
    backgroundColor: '#F4EEF9',
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF2CC',
    borderColor: '#F5C84B',
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    color: '#7A4A00',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  title: {
    color: '#071D19',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 27,
  },
  subtitle: {
    color: '#40534D',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 3,
  },
  customName: {
    color: '#40534D',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: 3,
  },
  locationAddress: {
    color: '#65736F',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
    marginTop: 3,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  infoRowPressable: {
    backgroundColor: '#F6F2FE',
    borderColor: '#E7DDF8',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoRowPressed: {
    opacity: 0.76,
  },
  infoRowDisabled: {
    opacity: 0.7,
  },
  infoCopy: {
    flex: 1,
    minWidth: 0,
  },
  infoText: {
    color: '#163B34',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
  },
  infoSecondary: {
    color: '#65736F',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
    marginTop: 2,
  },
  groupActivityCard: {
    backgroundColor: groupTheme.backgroundColor,
    borderColor: groupTheme.borderColor,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  groupActivityEyebrow: {
    color: groupTheme.color,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  groupActivityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  groupActivityName: {
    color: groupTheme.chipTextColor,
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 22,
  },
  capacityTrack: {
    backgroundColor: '#E6E2ED',
    borderRadius: 999,
    height: 6,
    marginBottom: 8,
    overflow: 'hidden',
  },
  capacityFill: {
    backgroundColor: '#6C3DE5',
    borderRadius: 999,
    height: '100%',
  },
  availableText: {
    color: '#16823A',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 18,
  },
  fullText: {
    color: '#A33232',
  },
  description: {
    color: '#193F37',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 22,
    marginTop: 4,
  },
  organizerCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 20,
    padding: 16,
    ...shadow,
  },
  ownerActionsCard: {
    backgroundColor: '#FFF8F8',
    borderColor: '#F4C7C2',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  ownerActionsList: {
    gap: 10,
    marginTop: 12,
  },
  organizerEyebrow: {
    color: '#39206C',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 13,
    textTransform: 'uppercase',
  },
  organizerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#EFF6E9',
    borderColor: '#D7E8CC',
    borderRadius: 999,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 58,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarInitials: {
    color: '#17803C',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  organizerCopy: {
    flex: 1,
    minWidth: 0,
  },
  organizerName: {
    color: '#071D19',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 22,
  },
  organizerSubtitle: {
    color: '#596A65',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
    marginTop: 4,
  },
  interestedCard: {
    backgroundColor: '#F7FAF5',
    borderColor: '#D7E8CC',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  confirmedCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7E8CC',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
    ...shadow,
  },
  confirmedList: {
    gap: 8,
  },
  confirmedItem: {
    alignItems: 'center',
    backgroundColor: '#F7FAF5',
    borderColor: '#DDEAD7',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  confirmedName: {
    color: '#163B34',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  interestedCount: {
    color: '#063C31',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  interestedList: {
    gap: 7,
    marginTop: 12,
  },
  interestedItem: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDEAD7',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  interestedName: {
    color: '#163B34',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 20,
  },
  interestedSubtitle: {
    color: '#5F6E68',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
    marginTop: 3,
  },
  interestedEmpty: {
    color: '#596A65',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
  interestedActions: {
    borderColor: '#EDF3EA',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  interestedPrimaryActions: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 8,
  },
  androidInterestedActions: {
    alignItems: 'stretch',
    gap: 8,
    width: '100%',
  },
  androidConfirmAction: {
    alignItems: 'center',
    backgroundColor: '#17803C',
    borderColor: '#17803C',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
  androidConfirmActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  androidRejectAction: {
    alignItems: 'center',
    backgroundColor: '#FFF5F4',
    borderColor: '#F4C7C2',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
  androidRejectActionText: {
    color: '#B42318',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  androidInterestedActionPressed: {
    opacity: 0.88,
  },
  androidInterestedActionDisabled: {
    opacity: 0.5,
  },
  confirmAction: {
    alignItems: 'center',
    backgroundColor: '#17803C',
    borderColor: '#17803C',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  confirmActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  rejectAction: {
    alignItems: 'center',
    backgroundColor: '#FFF5F4',
    borderColor: '#F4C7C2',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  interestedActionPressed: {
    opacity: 0.88,
  },
  interestedActionDisabled: {
    opacity: 0.5,
  },
  rejectActionText: {
    color: '#B42318',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EAF7EC',
    borderColor: '#006A32',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  primaryButtonInterest: {
    backgroundColor: '#F4EEF9',
    borderColor: '#4B348A',
  },
  primaryButtonMuted: {
    backgroundColor: '#ECEBE7',
    borderColor: '#D8D6D1',
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    color: '#006A32',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  primaryButtonTextInterest: {
    color: '#4B348A',
  },
  primaryButtonTextMuted: {
    color: '#7A817D',
  },
  inviteButton: {
    alignItems: 'center',
    backgroundColor: '#4B348A',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    height: 52,
    justifyContent: 'center',
    marginTop: 12,
  },
  inviteButtonDisabled: {
    opacity: 0.5,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  deleteActivityButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#F4C7C2',
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  editActivityButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#B8DCCB',
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  cancelActivityButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#F5C84B',
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  cancelActivityButtonDisabled: {
    opacity: 0.62,
  },
  deleteActivityButtonDisabled: {
    opacity: 0.62,
  },
  deleteActivityText: {
    color: '#B42318',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  editActivityText: {
    color: '#155C47',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  cancelActivityText: {
    color: '#8A4B00',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  missingTitle: {
    color: '#063C31',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 16,
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#6C3DE5',
    borderRadius: 14,
    borderWidth: 1.5,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  secondaryButtonText: {
    color: '#4B348A',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
})

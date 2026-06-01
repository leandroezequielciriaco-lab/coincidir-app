import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import {
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
  Pencil,
  Spade,
  UsersRound,
  Waves,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { PressScale } from '../../components/home/PressScale'
import { InviteFriendsSheet, type InviteShareTarget } from '../../components/InviteFriendsSheet'
import { getFirebaseServices } from '../../firebaseConfig'
import { notifyActivityCancelled, notifyActivityConfirmed, notifyActivityInterest } from '../../lib/notifications'
import { getCategoryImage } from '../../utils/categoryImages'

type ActivityData = Record<string, unknown>
type CategoryId = 'outdoor' | 'sports' | 'wellness' | 'groups' | 'private'
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
type InterestedAction = 'confirm' | 'invite' | 'write'

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

function getCategoryId(data: ActivityData): CategoryId | 'default' {
  const categoryId = readString(data.categoryId)

  if (categoryId === 'outdoor' || categoryId === 'sports' || categoryId === 'wellness' || categoryId === 'groups' || categoryId === 'private') {
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

function getInterestedUsers(data: ActivityData): InterestedUser[] {
  const interestedUsers = data.interestedUsers
  if (typeof interestedUsers !== 'object' || !interestedUsers || Array.isArray(interestedUsers)) return []

  return Object.entries(interestedUsers as Record<string, unknown>)
    .map(([uid, value]) => {
      if (typeof value === 'object' && value) {
        const record = value as ActivityData
        return {
          name: readString(record.name, readString(record.displayName, readString(record.fullName, `Usuario ${uid.slice(0, 6)}`))),
          phone: getPhone(record),
          uid,
        }
      }

      return {
        name: `Usuario ${uid.slice(0, 6)}`,
        phone: '',
        uid,
      }
    })
}

function getInviteMessage(user: InterestedUser, detail: {
  date: string
  location: string
  maxParticipants: number
  participantCount: number
  price: string
  time: string
  title: string
}) {
  const availablePlaces = Math.max(0, detail.maxParticipants - detail.participantCount)

  return [
    `Hola ${user.name}! Te invito a sumarte a ${detail.title} en COINCIDIR.`,
    `📅 ${detail.date} ${detail.time}`,
    `📍 ${detail.location}`,
    detail.price ? `💰 ${detail.price}` : '',
    `Quedan ${availablePlaces} lugares.`,
  ].filter(Boolean).join('\n')
}

function getWhatsappMessage(user: InterestedUser, title: string) {
  return `Hola ${user.name}, vi que te interesa la actividad ${title} en COINCIDIR. ¿Querés que coordinemos?`
}

function normalizePhoneForUrl(phone: string) {
  const trimmed = phone.trim()
  const prefix = trimmed.startsWith('+') ? '+' : ''
  const digits = trimmed.replace(/\D/g, '')
  return digits ? `${prefix}${digits}` : ''
}

function getSmsUrl(phone: string, message: string) {
  const separator = Platform.OS === 'ios' ? '&' : '?'
  return `sms:${encodeURIComponent(phone)}${separator}body=${encodeURIComponent(message)}`
}

function requiresInterestAction(data: ActivityData) {
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

function getIcon(data: ActivityData): LucideIcon {
  const categoryId = getCategoryId(data)
  const detail = `${normalize(data.subcategory)} ${normalize(data.name)}`

  if (detail.includes('kayak') || detail.includes('natacion') || detail.includes('paddle') || detail.includes('padel')) return Waves
  if (detail.includes('yoga') || detail.includes('meditacion') || categoryId === 'wellness') return Leaf
  if (detail.includes('escalada') || categoryId === 'outdoor') return Mountain
  if (categoryId === 'private') return Spade
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
    || 'Miembro de Coincidir'
}

function getCreatorId(data: ActivityData) {
  return readString(data.createdBy)
    || readString(data.creatorId)
    || readString(data.ownerId)
    || readString(data.userId)
}

function getOrganizerProfile(data: ActivityData | null, profile: ActivityData | null): OrganizerProfile {
  return {
    name: readString(
      profile?.fullName,
      readString(profile?.displayName, readString(profile?.name, data ? getOrganizerName(data) : 'Miembro de Coincidir')),
    ),
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
  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [isMarkingInterest, setIsMarkingInterest] = useState(false)
  const [isInviteVisible, setIsInviteVisible] = useState(false)
  const [optimisticJoined, setOptimisticJoined] = useState<boolean | null>(null)
  const [optimisticInterested, setOptimisticInterested] = useState<boolean | null>(null)
  const [organizerProfile, setOrganizerProfile] = useState<ActivityData | null>(null)
  const [currentUserName, setCurrentUserName] = useState('')
  const [pendingInterestedActions, setPendingInterestedActions] = useState<string[]>([])
  const [isDeletingActivity, setIsDeletingActivity] = useState(false)
  const [isCancellingActivity, setIsCancellingActivity] = useState(false)

  useEffect(() => {
    try {
      const { auth } = getFirebaseServices()
      return onAuthStateChanged(auth, (user) => {
        setCurrentUserId(user?.uid ?? null)
        setCurrentUserName(user?.displayName?.trim() ?? '')
      })
    } catch {
      setCurrentUserId(null)
      setCurrentUserName('')
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
          setActivity(snapshot.exists() ? snapshot.data() as ActivityData : null)
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
    return {
      action,
      category: readString(data.category, 'Espacio privado'),
      date: readString(data.date, 'Fecha a definir'),
      description: readString(data.description, 'Sin descripción por ahora.'),
      Icon: getIcon(data),
      image: getCategoryImage(data),
      interested,
      interestedCount: safeInterestedCount,
      interestedUsers: getInterestedUsers(data),
      isCancelled,
      isFull,
      joined,
      location: readString(data.location, 'Ubicación a definir'),
      maxParticipants,
      organizer: getOrganizerProfile(activity, organizerProfile),
      participantCount: safeCount,
      price: getPriceLabel(data),
      subcategory: readString(data.subcategory),
      time: readString(data.time, 'Horario a definir'),
      title: readString(data.name, 'Actividad sin título'),
    }
  }, [activity, currentUserId, optimisticInterested, optimisticJoined, organizerProfile])

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

  const toggleJoin = async () => {
    if (!activityId || !activity || !currentUserId || detail.isCancelled || detail.isFull || isJoining) return

    const nextJoined = !detail.joined
    setOptimisticJoined(nextJoined)
    setIsJoining(true)

    try {
      const { db } = getFirebaseServices()
      const targetRef = doc(db, 'activities', activityId)

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(targetRef)
        if (!snapshot.exists()) return

        const data = snapshot.data() as ActivityData
        if (readString(data.status) === 'cancelled') return

        const wasJoined = isUserJoined(data, currentUserId)
        const currentCount = getParticipantCount(data)
        const maxParticipants = getMaxParticipants(data)

        if (!wasJoined && currentCount >= maxParticipants) return

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
      setOptimisticJoined(null)
    } finally {
      setIsJoining(false)
    }
  }

  const toggleInterest = async () => {
    if (!activityId || !activity || !currentUserId || detail.isCancelled || isMarkingInterest) return

    const nextInterested = !detail.interested
    setOptimisticInterested(nextInterested)
    setIsMarkingInterest(true)

    try {
      const { db } = getFirebaseServices()
      const targetRef = doc(db, 'activities', activityId)

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(targetRef)
        if (!snapshot.exists()) return

        const data = snapshot.data() as ActivityData
        if (readString(data.status) === 'cancelled') return

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
              name: currentUserName,
              status: 'interested',
              uid: currentUserId,
            },
            interestedCount: nextCount,
            updatedAt: serverTimestamp(),
          })
      })

      if (nextInterested) {
        notifyActivityInterest({
          activityId,
          activityTitle: detail.title,
          interestedUserId: currentUserId,
          interestedUserName: currentUserName || 'Alguien',
          organizerId: creatorId,
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

  const getInterestedUserWithProfile = async (user: InterestedUser) => {
    if (user.phone) return user

    try {
      const { db } = getFirebaseServices()
      const snapshot = await getDoc(doc(db, 'users', user.uid))
      if (!snapshot.exists()) return user

      const profile = snapshot.data() as ActivityData
      return {
        ...user,
        name: readString(profile.fullName, readString(profile.displayName, readString(profile.name, user.name))),
        phone: getPhone(profile),
      }
    } catch {
      return user
    }
  }

  const writeInterestedUser = async (user: InterestedUser) => {
    if (detail.isCancelled || isInterestedActionPending(user.uid, 'write')) return

    setInterestedActionPending(user.uid, 'write', true)
    try {
      const targetUser = await getInterestedUserWithProfile(user)
      const phone = normalizePhoneForUrl(targetUser.phone)

      if (!phone) {
        Alert.alert(
          'Teléfono no disponible',
          'Todavía no hay teléfono disponible. Vas a poder contactar desde la app cuando exista mensajería interna.',
        )
        return
      }

      const message = getWhatsappMessage(targetUser, detail.title)
      const whatsappUrl = `whatsapp://send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}`
      const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl)

      if (canOpenWhatsApp) {
        await Linking.openURL(whatsappUrl)
        return
      }

      const smsUrl = getSmsUrl(phone, message)
      const canOpenSms = await Linking.canOpenURL(smsUrl)
      if (canOpenSms) {
        await Linking.openURL(smsUrl)
        return
      }

      await Share.share({ message })
    } catch {
      Alert.alert('No pudimos abrir el mensaje', 'Intentá nuevamente en unos segundos.')
    } finally {
      setInterestedActionPending(user.uid, 'write', false)
    }
  }

  const inviteInterestedUser = async (user: InterestedUser) => {
    if (detail.isCancelled || isInterestedActionPending(user.uid, 'invite')) return

    setInterestedActionPending(user.uid, 'invite', true)
    try {
      const message = getInviteMessage(user, detail)
      await Share.share({ message })
    } catch {
      Alert.alert('No pudimos compartir la invitación', 'Intentá nuevamente en unos segundos.')
    } finally {
      setInterestedActionPending(user.uid, 'invite', false)
    }
  }

  const confirmInterestedUser = (user: InterestedUser) => {
    if (!activityId || !activity || detail.isCancelled || isInterestedActionPending(user.uid, 'confirm')) return

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
      const { db } = getFirebaseServices()
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

  const cancelActivityNow = async () => {
    if (!activityId || !currentUserId || isCancellingActivity) return

    setIsCancellingActivity(true)
    try {
      const { db } = getFirebaseServices()
      const targetRef = doc(db, 'activities', activityId)
      const snapshot = await getDoc(targetRef)

      if (!snapshot.exists()) {
        Alert.alert('Actividad no disponible', 'No encontramos esta actividad para cancelarla.')
        return
      }

      const latestActivity = snapshot.data() as ActivityData
      if (getCreatorId(latestActivity) !== currentUserId) {
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
      notifyActivityCancelled({
        activity: latestActivity,
        activityId,
        activityTitle: readString(latestActivity.name, detail.title),
        organizerId: currentUserId,
      }).catch((error) => {
        if (__DEV__) console.warn('activity-cancelled-notification-create-error', error)
      })
      Alert.alert('Actividad cancelada', 'La actividad quedó cancelada, pero no se borró.')
    } catch {
      Alert.alert('No pudimos cancelar', 'Intentá nuevamente en unos segundos.')
    } finally {
      setIsCancellingActivity(false)
    }
  }

  const confirmCancelActivity = () => {
    if (!isOrganizer || isCancellingActivity) return

    if (detail.isCancelled) {
      Alert.alert('Actividad ya cancelada', 'Esta actividad ya figura como cancelada.')
      return
    }

    const hasPeople = detail.interestedCount > 0 || detail.participantCount > 0
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

    setIsDeletingActivity(true)
    try {
      const { db } = getFirebaseServices()
      const targetRef = doc(db, 'activities', activityId)
      const snapshot = await getDoc(targetRef)

      if (!snapshot.exists()) {
        Alert.alert('Actividad no disponible', 'No encontramos esta actividad para eliminarla.')
        return
      }

      const latestActivity = snapshot.data() as ActivityData
      if (getCreatorId(latestActivity) !== currentUserId) {
        Alert.alert('No podés eliminar esta actividad', 'Solo quien organiza la actividad puede eliminarla.')
        return
      }

      await deleteDoc(targetRef)
      router.replace('/home')
    } catch {
      Alert.alert('No pudimos eliminar', 'Intentá nuevamente en unos segundos.')
    } finally {
      setIsDeletingActivity(false)
    }
  }

  const confirmDeleteActivity = () => {
    if (!isOrganizer || isDeletingActivity) return

    const hasPeople = detail.interestedCount > 0 || detail.participantCount > 0
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
          <PressScale onPress={() => router.back()} style={styles.secondaryButton} scaleTo={0.97}>
            <Text style={styles.secondaryButtonText}>Volver</Text>
          </PressScale>
        </View>
      </SafeAreaView>
    )
  }

  const availablePlaces = Math.max(0, detail.maxParticipants - detail.participantCount)
  const inviteTarget: InviteShareTarget = {
    dateTime: `${detail.date} ${detail.time}`,
    id: activityId,
    location: detail.location,
    title: detail.title,
    type: 'activity',
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <PressScale accessibilityLabel="Volver" accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton} scaleTo={0.94}>
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
              {detail.isCancelled ? (
                <View style={styles.cancelledBadge}>
                  <Text style={styles.cancelledBadgeText}>Actividad cancelada</Text>
                </View>
              ) : null}
              <Text style={styles.title}>{detail.title}</Text>
              <Text style={styles.subtitle}>{detail.location}</Text>
            </View>
          </View>

          <InfoRow Icon={CalendarDays} label={detail.date} />
          <InfoRow Icon={Clock3} label={detail.time} />
          <InfoRow Icon={MapPin} label={detail.location} />
          <InfoRow Icon={UsersRound} label={`${detail.participantCount}/${detail.maxParticipants} lugares ocupados`} />

          <View style={styles.capacityTrack}>
            <View style={[styles.capacityFill, { width: `${Math.min(100, (detail.participantCount / detail.maxParticipants) * 100)}%` }]} />
          </View>
          <Text style={[styles.availableText, detail.isFull && styles.fullText]}>
            {detail.isFull ? 'Actividad completa' : `${availablePlaces} lugares disponibles`}
          </Text>

          {detail.subcategory ? <InfoRow Icon={Lock} label={detail.subcategory} /> : null}
          <InfoRow Icon={DollarSign} label={detail.price} />

          <Text style={styles.description}>{detail.description}</Text>

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
                    <Text style={styles.cancelActivityText}>
                      {detail.isCancelled ? 'Actividad cancelada' : 'Cancelar actividad'}
                    </Text>
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
                    <Text style={styles.deleteActivityText}>Eliminar actividad</Text>
                  )}
                </PressScale>
              </View>
            </View>
          ) : null}

          {isOrganizer && detail.action === 'interest' ? (
            <View style={styles.interestedCard}>
              <Text style={styles.organizerEyebrow}>Personas interesadas</Text>
              <Text style={styles.interestedCount}>{detail.interestedCount} interesados</Text>
              <View style={styles.interestedList}>
                {detail.interestedUsers.length > 0 ? detail.interestedUsers.slice(0, 5).map((user) => (
                  <View key={user.uid} style={styles.interestedItem}>
                    <Text numberOfLines={1} style={styles.interestedName}>{user.name}</Text>
                    <View style={styles.interestedActions}>
                      <PressScale
                        accessibilityLabel={`Escribir a ${user.name}`}
                        accessibilityRole="button"
                        disabled={detail.isCancelled || isInterestedActionPending(user.uid, 'write')}
                        onPress={() => void writeInterestedUser(user)}
                        scaleTo={0.97}
                        style={[styles.futureAction, detail.isCancelled && styles.futureActionDisabled]}
                      >
                        {isInterestedActionPending(user.uid, 'write') ? (
                          <ActivityIndicator color="#006A32" size="small" />
                        ) : (
                          <Text style={styles.futureActionText}>Escribir</Text>
                        )}
                      </PressScale>
                      <PressScale
                        accessibilityLabel={`Invitar a ${user.name}`}
                        accessibilityRole="button"
                        disabled={detail.isCancelled || isInterestedActionPending(user.uid, 'invite')}
                        onPress={() => void inviteInterestedUser(user)}
                        scaleTo={0.97}
                        style={[styles.futureAction, detail.isCancelled && styles.futureActionDisabled]}
                      >
                        {isInterestedActionPending(user.uid, 'invite') ? (
                          <ActivityIndicator color="#006A32" size="small" />
                        ) : (
                          <Text style={styles.futureActionText}>Invitar</Text>
                        )}
                      </PressScale>
                      <PressScale
                        accessibilityLabel={`Confirmar a ${user.name}`}
                        accessibilityRole="button"
                        disabled={detail.isCancelled || isInterestedActionPending(user.uid, 'confirm')}
                        onPress={() => confirmInterestedUser(user)}
                        scaleTo={0.97}
                        style={[styles.futureAction, detail.isCancelled && styles.futureActionDisabled]}
                      >
                        {isInterestedActionPending(user.uid, 'confirm') ? (
                          <ActivityIndicator color="#006A32" size="small" />
                        ) : (
                          <Text style={styles.futureActionText}>Confirmar</Text>
                        )}
                      </PressScale>
                    </View>
                  </View>
                )) : (
                  <Text style={styles.interestedEmpty}>Todavía no hay interesados.</Text>
                )}
              </View>
            </View>
          ) : null}

          <PressScale
            accessibilityLabel={
              detail.isCancelled
                ? 'Actividad cancelada'
                : detail.action === 'interest'
                ? detail.interested ? 'Te interesa' : 'Me interesa'
                : detail.joined ? 'Te sumaste' : detail.isFull ? 'Actividad completa' : 'Me sumo'
            }
            accessibilityRole="button"
            disabled={detail.isCancelled || (detail.action === 'join' ? detail.isFull || isJoining : isMarkingInterest)}
            onPress={detail.action === 'interest' ? toggleInterest : toggleJoin}
            scaleTo={0.97}
            style={[
              styles.primaryButton,
              (detail.joined || detail.interested) && styles.joinedButton,
              (detail.isCancelled || (detail.action === 'join' && detail.isFull)) && styles.disabledButton,
            ]}
          >
            {detail.joined || detail.interested ? <Check color="#17803C" size={20} strokeWidth={2.5} /> : null}
            <Text style={[
              styles.primaryButtonText,
              (detail.joined || detail.interested) && styles.joinedButtonText,
              (detail.isCancelled || (detail.action === 'join' && detail.isFull)) && styles.disabledButtonText,
            ]}>
              {detail.isCancelled
                ? 'Actividad cancelada'
                : detail.action === 'interest'
                ? detail.interested ? 'Te interesa' : 'Me interesa'
                : detail.isFull ? 'Actividad completa' : detail.joined ? 'Te sumaste' : 'Me sumo'}
            </Text>
          </PressScale>

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
}

function InfoRow({ Icon, label }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Icon color="#4B348A" size={20} strokeWidth={2.2} />
      <Text style={styles.infoText}>{label}</Text>
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
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
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
  cancelledBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF2CC',
    borderColor: '#F5C84B',
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cancelledBadgeText: {
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
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  infoText: {
    color: '#163B34',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
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
    gap: 10,
  },
  interestedName: {
    color: '#163B34',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  interestedEmpty: {
    color: '#596A65',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
  interestedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  futureAction: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE8E1',
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 34,
    minWidth: 86,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  futureActionDisabled: {
    opacity: 0.5,
  },
  futureActionText: {
    color: '#006A32',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#6C3DE5',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    height: 52,
    justifyContent: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  joinedButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#17803C',
    borderWidth: 1.5,
  },
  joinedButtonText: {
    color: '#17803C',
  },
  disabledButton: {
    backgroundColor: '#ECEBE7',
  },
  disabledButtonText: {
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

import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import {
  deleteField,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
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
  Spade,
  UsersRound,
  Waves,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { PressScale } from '../../components/home/PressScale'
import { InviteFriendsSheet, type InviteShareTarget } from '../../components/InviteFriendsSheet'
import { getFirebaseServices } from '../../firebaseConfig'

type ActivityData = Record<string, unknown>
type CategoryId = 'outdoor' | 'sports' | 'wellness' | 'groups' | 'private'
type OrganizerProfile = {
  name: string
  photoURL: string
  subtitle: string
}

const image = (uri: string): ImageSourcePropType => ({ uri })

const defaultImagesByCategory: Record<CategoryId | 'default', ImageSourcePropType> = {
  outdoor: image('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1100&q=80'),
  sports: image('https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1100&q=80'),
  wellness: image('https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1100&q=80'),
  groups: image('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1100&q=80'),
  private: image('https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1100&q=80'),
  default: image('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1100&q=80'),
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
  const [isInviteVisible, setIsInviteVisible] = useState(false)
  const [optimisticJoined, setOptimisticJoined] = useState<boolean | null>(null)
  const [organizerProfile, setOrganizerProfile] = useState<ActivityData | null>(null)

  useEffect(() => {
    try {
      const { auth } = getFirebaseServices()
      return onAuthStateChanged(auth, (user) => setCurrentUserId(user?.uid ?? null))
    } catch {
      setCurrentUserId(null)
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
    const maxParticipants = getMaxParticipants(data)
    const persistedJoined = isUserJoined(data, currentUserId)
    const joined = optimisticJoined ?? persistedJoined
    const optimisticCount = participantCount + (optimisticJoined === null || optimisticJoined === persistedJoined ? 0 : optimisticJoined ? 1 : -1)
    const safeCount = Math.max(0, optimisticCount)
    const isFull = safeCount >= maxParticipants && !joined
    const categoryId = getCategoryId(data)

    return {
      category: readString(data.category, 'Espacio privado'),
      date: readString(data.date, 'Fecha a definir'),
      description: readString(data.description, 'Sin descripción por ahora.'),
      Icon: getIcon(data),
      image: defaultImagesByCategory[categoryId],
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
  }, [activity, currentUserId, optimisticJoined, organizerProfile])

  const toggleJoin = async () => {
    if (!activityId || !activity || !currentUserId || detail.isFull || isJoining) return

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

          <PressScale
            accessibilityLabel={detail.joined ? 'Te sumaste' : detail.isFull ? 'Actividad completa' : 'Me sumo'}
            accessibilityRole="button"
            disabled={detail.isFull || isJoining}
            onPress={toggleJoin}
            scaleTo={0.97}
            style={[
              styles.primaryButton,
              detail.joined && styles.joinedButton,
              detail.isFull && styles.disabledButton,
            ]}
          >
            {detail.joined ? <Check color="#17803C" size={20} strokeWidth={2.5} /> : null}
            <Text style={[
              styles.primaryButtonText,
              detail.joined && styles.joinedButtonText,
              detail.isFull && styles.disabledButtonText,
            ]}>
              {detail.isFull ? 'Actividad completa' : detail.joined ? 'Te sumaste' : 'Me sumo'}
            </Text>
          </PressScale>

          <PressScale onPress={() => setIsInviteVisible(true)} scaleTo={0.97} style={styles.inviteButton}>
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
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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

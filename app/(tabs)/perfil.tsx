import * as ImagePicker from 'expo-image-picker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { onAuthStateChanged, updateProfile } from 'firebase/auth'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import type { LucideIcon } from 'lucide-react-native'
import {
  Bike,
  BookOpen,
  CalendarDays,
  Camera,
  Car,
  Check,
  ChefHat,
  ChevronRight,
  Circle,
  CircleDot,
  Coffee,
  DollarSign,
  Dumbbell,
  Film,
  Footprints,
  Gamepad2,
  Globe2,
  HandHeart,
  Heart,
  Image as ImageIcon,
  Laptop,
  LockKeyhole,
  MapPin,
  Mic,
  Mountain,
  Music,
  Palette,
  PawPrint,
  Pencil,
  Plane,
  Rocket,
  Scissors,
  Star,
  Trees,
  Trophy,
  Tv,
  UserRound,
  UsersRound,
  Waves,
  Wine,
} from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PressScale } from '../../components/home/PressScale'
import { getGroupTheme } from '../../constants/groupTheme'
import {
  type LocalGroup,
  getLocalGroupId,
  LOCAL_GROUPS_STORAGE_KEY,
  mergeLocalGroups,
  readDeletedLocalGroupIds,
  readStoredLocalGroups,
  serializeLocalGroups,
  toLocalGroup,
} from '../../constants/localGroups'
import { canonicalUserInterests, expandUserInterests } from '../../constants/userInterests'
import { getFirebaseServices } from '../../firebaseConfig'
import { applyGroupNameToActivity, getActivityGroupMeta } from '../../utils/activityGroups'
import { isOwnActivity } from '../../utils/activityOwnership'
import { defaultActivityImage, getCategoryImage } from '../../utils/categoryImages'

type FirestoreRecord = {
  id: string
  data: Record<string, unknown>
}

type UserProfile = {
  bio: string
  fullName: string
  interests: string[]
  location: string
  photoURL: string
}

type FirebaseStorageLikeError = {
  code?: string
  customData?: {
    serverResponse?: string
  }
  message?: string
  serverResponse?: string
  status_?: number
}

const DEFAULT_BIO = 'Siempre listo para nuevos planes.'
const DEFAULT_LOCATION = 'Tandil'
const editableInterests = canonicalUserInterests

function normalize(value: unknown) {
  return readString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getInterestIcon(label: string): LucideIcon {
  const value = normalize(label)

  if (value.includes('deporte')) return Trophy
  if (value.includes('yoga')) return Heart
  if (value.includes('running')) return Footprints
  if (value.includes('gym') || value.includes('gimnasio')) return Dumbbell
  if (value.includes('ciclismo')) return Bike
  if (value.includes('paddle') || value.includes('tenis')) return Trophy
  if (value.includes('sup') || value.includes('surf')) return Waves
  if (value.includes('caminata')) return Mountain
  if (value.includes('trekking')) return Mountain
  if (value.includes('aire')) return Trees
  if (value.includes('mate')) return Coffee
  if (value.includes('café')) return Coffee
  if (value.includes('música')) return Music
  if (value.includes('cine')) return Film
  if (value.includes('naturaleza')) return Trees
  if (value.includes('viajes')) return Plane
  if (value.includes('lectura')) return BookOpen
  if (value.includes('juegos')) return Gamepad2
  if (value.includes('mascotas')) return PawPrint
  if (value.includes('tecnología')) return Laptop
  if (value.includes('arte')) return Palette
  if (value.includes('fotografia')) return Camera
  if (value.includes('idiomas')) return Globe2
  if (value.includes('meditacion')) return Heart
  if (value.includes('cocina')) return ChefHat
  if (value.includes('streaming') || value.includes('series')) return Tv
  if (value.includes('gaming')) return Gamepad2
  if (value.includes('voluntariado')) return HandHeart
  if (value.includes('emprendimientos')) return Rocket
  if (value.includes('baile')) return Footprints
  if (value.includes('vino')) return Wine
  if (value.includes('finanzas')) return DollarSign
  if (value.includes('autos')) return Car
  if (value.includes('podcasts')) return Mic
  if (value.includes('eventos')) return CalendarDays
  if (value.includes('manualidades')) return Scissors
  if (value.includes('futbol')) return Circle
  if (value.includes('fútbol')) return Circle
  if (value.includes('escalada')) return Mountain
  if (value.includes('nataci')) return Waves

  return CircleDot
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

type ProfileGroup = LocalGroup & {
  activityCount: number
  source: 'activity' | 'local'
}

function isCancelled(data: Record<string, unknown>) {
  return readString(data.status) === 'cancelled'
}

function readList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function logAvatarUploadError(error: unknown) {
  if (!__DEV__) return

  const firebaseError = error as FirebaseStorageLikeError

  console.error('Avatar upload error', error)
  console.error('Avatar upload error code', firebaseError?.code)
  console.error('Avatar upload error message', firebaseError?.message)
  console.error('Avatar upload error customData', firebaseError?.customData)
  console.error('Avatar upload error serverResponse', firebaseError?.serverResponse ?? firebaseError?.customData?.serverResponse)

  try {
    console.error('Avatar upload error JSON', JSON.stringify(error, null, 2))
  } catch (jsonError) {
    console.error('Avatar upload error JSON stringify failed', jsonError)
  }
}

function getAvatarUploadErrorMessage(error: unknown) {
  const firebaseError = error as FirebaseStorageLikeError

  if (firebaseError?.code === 'storage/unauthorized') {
    return 'No tenés permisos para subir la foto. Revisá que estés logueado y que las reglas de Firebase Storage permitan escribir avatares.'
  }

  if (firebaseError?.code === 'storage/bucket-not-found' || firebaseError?.code === 'storage/unknown') {
    return 'No pudimos subir la foto a Firebase Storage. Revisá que Storage esté habilitado, que el bucket sea correcto y que las reglas permitan escritura autenticada.'
  }

  if (firebaseError?.message) return firebaseError.message

  return 'La foto quedó en vista previa. Podés volver a tocar Guardar para reintentar.'
}

function getParticipantCount(data: Record<string, unknown>) {
  const participantsCount = typeof data.participantsCount === 'number' ? data.participantsCount : -1
  if (participantsCount >= 0) return participantsCount

  const joinedUsers = data.joinedUsers
  if (typeof joinedUsers === 'object' && joinedUsers) return Object.keys(joinedUsers).length

  const participants = data.participants ?? data.members
  if (typeof participants === 'object' && participants) return Object.keys(participants).length
  return Array.isArray(participants) ? participants.length : 0
}

function getRecordTime(record: FirestoreRecord) {
  const value = record.data.createdAt ?? record.data.updatedAt
  return typeof value === 'object' && value && 'toMillis' in value && typeof value.toMillis === 'function'
    ? value.toMillis()
    : 0
}

function isJoined(record: FirestoreRecord, userId: string | null) {
  if (!userId) return false
  const joinedUsers = record.data.joinedUsers
  const participants = record.data.participants

  if (typeof joinedUsers === 'object' && joinedUsers && userId in joinedUsers) return true
  if (typeof participants === 'object' && participants && userId in participants) return true

  return false
}

function buildProfile(data: Record<string, unknown> | null, authName?: string | null, authPhotoURL?: string | null): UserProfile {
  return {
    bio: readString(data?.bio, DEFAULT_BIO),
    fullName: readString(data?.fullName, readString(data?.displayName, readString(data?.name, authName ?? 'Mi perfil'))),
    interests: readList(data?.interests),
    location: readString(data?.location, readString(data?.city, DEFAULT_LOCATION)),
    photoURL: readString(
      data?.photoURL,
      readString(
        data?.avatarUrl,
        readString(
          data?.avatarURL,
          readString(data?.imageUrl, readString(data?.photoUrl, readString(data?.googlePhotoURL, authPhotoURL ?? ''))),
        ),
      ),
    ),
  }
}

export default function PerfilScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ edit?: string }>()
  const [userId, setUserId] = useState<string | null>(null)
  const [authName, setAuthName] = useState<string | null>(null)
  const [authPhotoURL, setAuthPhotoURL] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile>(buildProfile(null))
  const [activities, setActivities] = useState<FirestoreRecord[]>([])
  const [groups, setGroups] = useState<FirestoreRecord[]>([])
  const [localGroups, setLocalGroups] = useState<LocalGroup[]>([])
  const [deletedLocalGroupIds, setDeletedLocalGroupIds] = useState<string[]>([])
  const [editingGroup, setEditingGroup] = useState<ProfileGroup | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [optimisticInterests, setOptimisticInterests] = useState<string[] | null>(null)
  const [pendingInterest, setPendingInterest] = useState<string | null>(null)
  const [showAllProfileInterests, setShowAllProfileInterests] = useState(false)

  useEffect(() => {
    if (params.edit === '1') {
      setIsEditing(true)
      router.setParams({ edit: undefined })
    }
  }, [params.edit, router])

  useEffect(() => {
    try {
      const { auth } = getFirebaseServices()
      return onAuthStateChanged(auth, (user) => {
        setUserId(user?.uid ?? null)
        setAuthName(user?.displayName ?? null)
        setAuthPhotoURL(user?.photoURL ?? null)
        if (!user) setIsLoading(false)
      })
    } catch {
      setIsLoading(false)
      return undefined
    }
  }, [])

  useEffect(() => {
    if (!userId) return undefined

    try {
      const { db } = getFirebaseServices()
      return onSnapshot(
        doc(db, 'users', userId),
        (snapshot) => {
          setProfile(buildProfile(snapshot.exists() ? snapshot.data() : null, authName, authPhotoURL))
          setOptimisticInterests(null)
          setIsLoading(false)
        },
        () => setIsLoading(false),
      )
    } catch {
      setIsLoading(false)
      return undefined
    }
  }, [authName, authPhotoURL, userId])

  useEffect(() => {
    try {
      const { db } = getFirebaseServices()
      const unsubscribeActivities = onSnapshot(collection(db, 'activities'), (snapshot) => {
        setActivities(snapshot.docs
          .map((item) => ({ id: item.id, data: item.data() as Record<string, unknown> }))
          .sort((left, right) => getRecordTime(right) - getRecordTime(left)))
      })
      const unsubscribeGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
        setGroups(snapshot.docs
          .map((item) => ({ id: item.id, data: item.data() as Record<string, unknown> }))
          .sort((left, right) => getRecordTime(right) - getRecordTime(left)))
      })

      return () => {
        unsubscribeActivities()
        unsubscribeGroups()
      }
    } catch {
      return undefined
    }
  }, [])

  const loadLocalGroups = useCallback(async () => {
    try {
      const storedValue = await AsyncStorage.getItem(LOCAL_GROUPS_STORAGE_KEY)
      const storedGroups = readStoredLocalGroups(storedValue)
      const storedDeletedGroupIds = readDeletedLocalGroupIds(storedValue)
      setLocalGroups(storedGroups)
      setDeletedLocalGroupIds(storedDeletedGroupIds)

      if (__DEV__) {
        console.log('[Perfil] grupos leidos de AsyncStorage', {
          count: storedGroups.length,
          deletedGroupIds: storedDeletedGroupIds,
          groups: storedGroups,
          key: LOCAL_GROUPS_STORAGE_KEY,
        })
      }
    } catch (error) {
      if (__DEV__) console.warn('[Perfil] error leyendo grupos locales', error)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadLocalGroups()
    }, [loadLocalGroups]),
  )

  const createdActivities = useMemo(
    () => activities.filter((item) => isOwnActivity(item.data, userId)),
    [activities, userId],
  )
  const joinedActivities = useMemo(
    () => activities.filter((item) => isJoined(item, userId) && !isOwnActivity(item.data, userId)),
    [activities, userId],
  )
  const activityDerivedGroups = useMemo(() => {
    const derived = createdActivities
      .map((item) => {
        const groupMeta = getActivityGroupMeta(item.data, localGroups)
        const groupName = groupMeta.groupName
        if (!groupMeta.groupId && !groupName) return null

        return {
          id: groupMeta.groupId || getLocalGroupId(groupName),
          name: groupName || groupMeta.groupId,
        }
      })
      .filter((item): item is LocalGroup => Boolean(item?.id && item.name))

    if (__DEV__) {
      console.log('[Perfil] grupos derivados desde actividades', {
        count: derived.length,
        groups: derived,
      })
    }

    return derived
  }, [createdActivities, localGroups])
  const firestoreProfileGroups = useMemo(() => {
    const derived = groups
      .filter((item) => isOwnActivity(item.data, userId) || isJoined(item, userId))
      .map((item) => toLocalGroup(
        readString(item.data.name, readString(item.data.title, 'Grupo sin título')),
        item.id,
      ))
      .filter((item): item is LocalGroup => Boolean(item))

    return derived
  }, [groups, userId])
  const myGroups = useMemo<ProfileGroup[]>(() => {
    const deletedIds = new Set(deletedLocalGroupIds)
    const merged = mergeLocalGroups(localGroups, activityDerivedGroups, firestoreProfileGroups)
      .filter((group) => !deletedIds.has(group.id))
    const groupsWithCounts = merged.map((group) => {
      const activityCount = activities.filter((activity) => {
        if (!isOwnActivity(activity.data, userId)) return false
        const groupMeta = getActivityGroupMeta(activity.data, localGroups)
        const activityGroupId = groupMeta.groupId || getLocalGroupId(groupMeta.groupName)
        return activityGroupId === group.id
      }).length

      return {
        ...group,
        activityCount,
        source: localGroups.some((localGroup) => localGroup.id === group.id) ? 'local' as const : 'activity' as const,
      }
    })

    if (__DEV__) {
      console.log('[Perfil] grupos finales deduplicados', {
        count: groupsWithCounts.length,
        groups: groupsWithCounts,
      })
      console.log('[Perfil] contador final de grupos', { count: groupsWithCounts.length })
    }

    return groupsWithCounts
  }, [activities, activityDerivedGroups, deletedLocalGroupIds, firestoreProfileGroups, localGroups, userId])
  const stats = useMemo(() => [
    { label: 'Actividades', value: String(createdActivities.length + joinedActivities.length), Icon: CalendarDays, color: '#5A35D6' },
    { label: 'Grupos', value: String(myGroups.length), Icon: UsersRound, color: '#17803C' },
    { label: 'Participaciones', value: String(createdActivities.length + joinedActivities.length + myGroups.length), Icon: Star, color: '#F2A900' },
  ], [createdActivities.length, joinedActivities.length, myGroups.length])

  useEffect(() => {
    if (!__DEV__) return

    const ownActivities = activities
      .filter((item) => isOwnActivity(item.data, userId))
      .map((item) => ({
        activityId: item.id,
        status: 'Tu actividad',
        title: readString(item.data.name, readString(item.data.title, 'Actividad sin título')),
      }))

    console.log('[Perfil] actividades propias detectadas', {
      count: ownActivities.length,
      activities: ownActivities,
    })
  }, [activities, userId])

  const saveProfileGroups = useCallback(async (nextGroups: LocalGroup[], nextDeletedIds = deletedLocalGroupIds) => {
    const dedupedGroups = mergeLocalGroups(nextGroups)
    setLocalGroups(dedupedGroups)
    setDeletedLocalGroupIds(nextDeletedIds)
    await AsyncStorage.setItem(LOCAL_GROUPS_STORAGE_KEY, serializeLocalGroups(dedupedGroups, nextDeletedIds))
  }, [deletedLocalGroupIds])

  const renameProfileGroup = async (group: ProfileGroup, nextName: string) => {
    const cleanName = nextName.trim()
    if (!cleanName) {
      Alert.alert('Nombre requerido', 'Ingresá un nombre para el grupo.')
      return
    }

    try {
      const currentGroups = localGroups.some((item) => item.id === group.id)
        ? localGroups
        : [...localGroups, { id: group.id, name: group.name }]
      const nextGroups = currentGroups.map((item) => item.id === group.id ? { ...item, name: cleanName } : item)
      await saveProfileGroups(nextGroups, deletedLocalGroupIds.filter((id) => id !== group.id))
      const matchingActivities = activities.filter((activity) => {
        const groupMeta = getActivityGroupMeta(activity.data, localGroups)
        return groupMeta.groupId === group.id
      })
      setActivities((current) => current.map((activity) => ({
        ...activity,
        data: applyGroupNameToActivity(activity.data, group.id, cleanName),
      })))
      if (__DEV__) {
        console.log('[Perfil] grupo editado', {
          groupId: group.id,
          nextName: cleanName,
          previousName: group.name,
        })
        console.log('[Perfil] actividades encontradas con groupId', {
          activityIds: matchingActivities.map((activity) => activity.id),
          count: matchingActivities.length,
          groupId: group.id,
        })
        console.log('[Perfil] actividades actualizadas localmente', {
          count: matchingActivities.length,
          groupId: group.id,
          groupName: cleanName,
        })
      }
      setEditingGroup(null)
    } catch {
      Alert.alert('No pudimos guardar', 'Intentá renombrar el grupo nuevamente.')
    }
  }

  const deleteProfileGroup = (group: ProfileGroup) => {
    Alert.alert(
      'Eliminar grupo',
      `Vamos a quitar "${group.name}" de tus grupos locales. Las actividades existentes no se borran.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const nextDeletedIds = Array.from(new Set([...deletedLocalGroupIds, group.id]))
            saveProfileGroups(localGroups.filter((item) => item.id !== group.id), nextDeletedIds)
              .catch(() => Alert.alert('No pudimos eliminar', 'Intentá eliminar el grupo nuevamente.'))
          },
        },
      ],
    )
  }
  const selectedInterests = optimisticInterests ?? expandUserInterests(profile.interests)
  const visibleProfileInterestOptions = showAllProfileInterests
    ? editableInterests
    : selectedInterests.length > 0
      ? selectedInterests.slice(0, 8)
      : editableInterests.slice(0, 8)

  const toggleProfileInterest = async (interest: string) => {
    if (!userId || pendingInterest) return

    const previousInterests = selectedInterests
    const nextInterests = previousInterests.includes(interest)
      ? previousInterests.filter((item) => item !== interest)
      : [...previousInterests, interest]

    setOptimisticInterests(nextInterests)
    setPendingInterest(interest)

    try {
      const { db } = getFirebaseServices()
      await setDoc(doc(db, 'users', userId), {
        interests: nextInterests,
        updatedAt: serverTimestamp(),
      }, { merge: true })
    } catch {
      setOptimisticInterests(previousInterests)
      Alert.alert('No pudimos guardar', 'Intentá cambiar tus intereses nuevamente en unos segundos.')
    } finally {
      setPendingInterest(null)
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color="#17803C" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>Mi perfil</Text>
        </View>

        <View style={styles.profileHeader}>
          <View style={styles.avatarStage}>
            <View style={styles.avatar}>
              {profile.photoURL ? (
                <Image resizeMode="cover" source={{ uri: profile.photoURL }} style={styles.avatarImage} />
              ) : (
                <UserRound color="#4B348A" size={46} strokeWidth={2.1} />
              )}
            </View>
          </View>
          <PressScale onPress={() => setIsEditing(true)} scaleTo={0.96} style={styles.editPhotoChip}>
            <Pencil color="#4B348A" size={13} strokeWidth={2.4} />
            <Text style={styles.editPhotoChipText}>Tocá para editar foto</Text>
          </PressScale>
          <Text numberOfLines={2} style={styles.name}>{profile.fullName}</Text>
          <View style={styles.locationRow}>
            <MapPin color="#17803C" size={16} strokeWidth={2.3} />
            <Text style={styles.location}>{profile.location}</Text>
          </View>
          <Text style={styles.bio}>{profile.bio}</Text>

          <View style={styles.statsRow}>
            {stats.map((item) => (
              <View key={item.label} style={styles.statItem}>
                <item.Icon color={item.color} size={25} strokeWidth={2.2} />
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <PressScale onPress={() => setIsEditing(true)} scaleTo={0.97} style={styles.editProfileButton}>
            <Pencil color="#FFFFFF" size={18} strokeWidth={2.4} />
            <Text style={styles.editProfileText}>Editar perfil</Text>
          </PressScale>
        </View>

        <ProfileSection
  subtitle={showAllProfileInterests ? 'Listo' : 'Tocá para editar'}
  title="Mis intereses"
  TitleIcon={Pencil}
  onSubtitlePress={() =>
    setShowAllProfileInterests((prev) => !prev)
  }
>
          <View style={styles.interestsCard}>
            {visibleProfileInterestOptions.length > 0 ? (
              <View style={styles.chipWrap}>
                {visibleProfileInterestOptions.map((interest) => (
                  <InterestChip
                    key={interest}
                    label={interest}
                    loading={pendingInterest === interest}
                    onPress={() => void toggleProfileInterest(interest)}
                    selected={selectedInterests.includes(interest)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.interestsEmptyContent}>
                <View style={styles.emptyIcon}>
                  <Heart color="#8FA59A" size={18} strokeWidth={2.1} />
                </View>
                <Text style={styles.emptyText}>Agregá tus intereses para mejorar tus coincidencias.</Text>
              </View>
            )}
            {selectedInterests.length === 0 ? (
              <Text style={styles.interestsHint}>Elegí al menos un interés para mejorar tus coincidencias.</Text>
            ) : null}
          </View>
        </ProfileSection>

        <ProfileListSection
          emptyText="Cuando crees actividades, van a aparecer acá."
          currentUserId={userId}
          items={createdActivities}
          localGroups={localGroups}
          onPress={(item) => router.push({ pathname: '/activity/[activityId]', params: { activityId: item.id } })}
          title="Actividades creadas"
        />

        <ProfileListSection
          emptyText="Cuando te sumes a una actividad, la vas a ver acá."
          currentUserId={userId}
          items={joinedActivities}
          localGroups={localGroups}
          onPress={(item) => router.push({ pathname: '/activity/[activityId]', params: { activityId: item.id } })}
          title="Me sumé a"
        />

        <ProfileGroupsSection
          groups={myGroups}
          onDelete={deleteProfileGroup}
          onEdit={setEditingGroup}
        />
      </ScrollView>

      <EditProfileModal
        onClose={() => setIsEditing(false)}
        profile={profile}
        userId={userId}
        visible={isEditing}
      />
      <EditGroupModal
        group={editingGroup}
        onClose={() => setEditingGroup(null)}
        onSave={renameProfileGroup}
      />
    </SafeAreaView>
  )
}

type ProfileSectionProps = {
  children: React.ReactNode
  subtitle?: string
  title: string
  TitleIcon?: LucideIcon
  onSubtitlePress?: () => void
}

function ProfileSection({ children, subtitle, title, TitleIcon, onSubtitlePress, }: ProfileSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Pressable
  style={styles.sectionHint}
  onPress={onSubtitlePress}
>
            {TitleIcon ? <TitleIcon color="#4B348A" size={13} strokeWidth={2.4} /> : null}
            <Text style={styles.sectionHintText}>{subtitle}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  )
}

function InterestChip({ label, loading = false, selected = false, onPress }: { label: string; loading?: boolean; selected?: boolean; onPress?: () => void }) {
  const Icon = getInterestIcon(label)
  const interactive = Boolean(onPress)

  return (
    <PressScale
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityState={interactive ? { selected } : undefined}
      disabled={loading}
      onPress={onPress}
      scaleTo={interactive ? 0.96 : 1}
      style={[styles.chip, !interactive && styles.chipCompact, selected && styles.chipSelected]}
    >
      {loading ? (
        <View style={styles.chipCheck}>
          <ActivityIndicator color="#FFFFFF" size="small" />
        </View>
      ) : selected ? (
        <View style={styles.chipCheck}>
          <Check color="#FFFFFF" size={12} strokeWidth={3} />
        </View>
      ) : null}
      <View style={[styles.chipIcon, !interactive && styles.chipIconCompact, selected && styles.chipIconSelected]}>
        <Icon color={selected ? '#006A32' : '#17803C'} size={interactive ? 21 : 18} strokeWidth={2.15} />
      </View>
      <Text style={[styles.chipText, !interactive && styles.chipTextCompact, selected && styles.chipTextSelected]}>{label}</Text>
    </PressScale>
  )
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <View style={styles.emptyBlock}>
      <View style={styles.emptyIcon}>
        <Heart color="#8FA59A" size={18} strokeWidth={2.1} />
      </View>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  )
}

type ProfileListSectionProps = {
  currentUserId?: string | null
  emptyText: string
  items: FirestoreRecord[]
  localGroups?: LocalGroup[]
  onPress: (item: FirestoreRecord) => void
  title: string
  variant?: 'activity' | 'group'
}

function ProfileListSection({ currentUserId = null, emptyText, items, localGroups = [], onPress, title, variant = 'activity' }: ProfileListSectionProps) {
  return (
    <ProfileSection title={title}>
      {items.length === 0 ? (
        <EmptyBlock text={emptyText} />
      ) : (
        <View style={styles.list}>
          {items.slice(0, 4).map((item) => (
            <ProfileRow currentUserId={currentUserId} item={item} key={item.id} localGroups={localGroups} onPress={() => onPress(item)} variant={variant} />
          ))}
        </View>
      )}
    </ProfileSection>
  )
}

type ProfileGroupsSectionProps = {
  groups: ProfileGroup[]
  onDelete: (group: ProfileGroup) => void
  onEdit: (group: ProfileGroup) => void
}

function ProfileGroupsSection({ groups, onDelete, onEdit }: ProfileGroupsSectionProps) {
  const groupColors = getGroupTheme()

  return (
    <ProfileSection title="Mis grupos">
      {groups.length === 0 ? (
        <EmptyBlock text="Tus grupos creados o donde participes van a aparecer acá." />
      ) : (
        <View style={styles.list}>
          {groups.map((group) => (
            <View key={group.id} style={[styles.profileGroupRow, { borderColor: groupColors.borderColor }]}>
              <View style={[styles.profileGroupIcon, { backgroundColor: groupColors.backgroundColor, borderColor: groupColors.borderColor }]}>
                <UsersRound color={groupColors.color} size={18} strokeWidth={2.3} />
              </View>
              <View style={styles.profileGroupCopy}>
                <Text ellipsizeMode="tail" numberOfLines={1} style={[styles.profileGroupName, { color: groupColors.chipTextColor }]}>{group.name}</Text>
                <Text style={styles.profileGroupMeta}>
                  {group.activityCount === 1 ? '1 actividad asociada' : `${group.activityCount} actividades asociadas`}
                </Text>
              </View>
              <View style={styles.profileGroupActions}>
                <Pressable accessibilityRole="button" onPress={() => onEdit(group)} style={styles.profileGroupAction}>
                  <Pencil color={groupColors.color} size={14} strokeWidth={2.4} />
                  <Text style={[styles.profileGroupActionText, { color: groupColors.color }]}>Editar</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => onDelete(group)} style={styles.profileGroupAction}>
                  <Text style={styles.profileGroupDeleteText}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </ProfileSection>
  )
}

function EditGroupModal({
  group,
  onClose,
  onSave,
}: {
  group: ProfileGroup | null
  onClose: () => void
  onSave: (group: ProfileGroup, nextName: string) => void
}) {
  const [draftName, setDraftName] = useState('')

  useEffect(() => {
    setDraftName(group?.name ?? '')
  }, [group])

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(group)}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.groupEditModal}>
          <Text style={styles.groupEditTitle}>Editar grupo</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={setDraftName}
            placeholder="Nombre del grupo"
            placeholderTextColor="#8A9691"
            style={styles.groupEditInput}
            underlineColorAndroid="transparent"
            value={draftName}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (group) void onSave(group, draftName)
            }}
            style={styles.groupEditPrimary}
          >
            <Text style={styles.groupEditPrimaryText}>Guardar</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.groupEditSecondary}>
            <Text style={styles.groupEditSecondaryText}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function ProfileRow({ currentUserId, item, localGroups = [], onPress, variant }: { currentUserId?: string | null; item: FirestoreRecord; localGroups?: LocalGroup[]; onPress: () => void; variant: 'activity' | 'group' }) {
  const title = readString(item.data.name, readString(item.data.title, variant === 'group' ? 'Grupo sin título' : 'Actividad sin título'))
  const location = readString(item.data.location, variant === 'group' ? 'Grupo de amigos' : 'Ubicación a definir')
  const date = readString(item.data.date, readString(item.data.schedule, variant === 'group' ? 'Próximo encuentro' : 'Fecha a definir'))
  const participants = getParticipantCount(item.data)
  const cancelled = variant === 'activity' && isCancelled(item.data)
  const ownActivity = variant === 'activity' && isOwnActivity(item.data, currentUserId)
  const groupMeta = variant === 'activity' ? getActivityGroupMeta(item.data, localGroups) : { groupColor: '', groupId: '', groupName: '' }
  const isGroupActivity = Boolean(groupMeta.groupId || groupMeta.groupName)
  const groupColors = getGroupTheme(groupMeta.groupColor)
  const iconColor = variant === 'group' ? '#4B348A' : '#006A32'
  const [imageSource, setImageSource] = useState(getCategoryImage(item.data))

  useEffect(() => {
    setImageSource(getCategoryImage(item.data))
  }, [item.data])

  return (
    <PressScale
      onPress={onPress}
      scaleTo={0.98}
      style={[
        styles.profileRow,
        isGroupActivity && { borderColor: groupColors.borderColor },
      ]}
    >
      <View style={[styles.rowThumb, variant === 'group' && styles.rowThumbGroup]}>
        {variant === 'group' ? (
          <UsersRound color={iconColor} size={21} strokeWidth={2.2} />
        ) : (
          <>
            <Image
              onError={() => setImageSource(defaultActivityImage)}
              source={imageSource}
              style={styles.rowThumbImage}
            />
            <View style={styles.rowThumbIcon}>
              <CalendarDays color="#006A32" size={13} strokeWidth={2.4} />
            </View>
          </>
        )}
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.rowTitleLine}>
          <Text ellipsizeMode="tail" numberOfLines={1} style={styles.rowTitle}>{title}</Text>
          {cancelled ? (
            <View style={styles.rowCancelledBadge}>
              <Text style={styles.rowCancelledBadgeText}>Cancelada</Text>
            </View>
          ) : null}
          {ownActivity ? (
            <View style={styles.rowOwnBadge}>
              <Text style={styles.rowOwnBadgeText}>Tu actividad</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rowLocation}>
          <MapPin color="#73827C" size={13} strokeWidth={2.1} />
          <Text ellipsizeMode="tail" numberOfLines={1} style={styles.rowMeta}>{location}</Text>
        </View>
        {groupMeta.groupName ? (
          <View style={styles.rowGroupIndicator}>
            <UsersRound color={groupColors.color} size={11} strokeWidth={2.4} />
            <Text ellipsizeMode="tail" numberOfLines={1} style={[styles.rowGroupIndicatorText, { color: groupColors.chipTextColor }]}>
              {groupMeta.groupName}
            </Text>
          </View>
        ) : null}
        <View style={styles.rowBadgeLine}>
          <View style={styles.rowBadge}>
            <CalendarDays color="#17803C" size={12} strokeWidth={2.2} />
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.rowBadgeText}>{date}</Text>
          </View>
          <View style={styles.rowBadge}>
            <UsersRound color="#17803C" size={12} strokeWidth={2.2} />
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.rowBadgeText}>
              {variant === 'group' ? `${participants} miembros` : `${participants} participantes`}
            </Text>
          </View>
        </View>
      </View>
      <ChevronRight color="#9AA6A1" size={19} strokeWidth={2.2} />
    </PressScale>
  )
}

type EditProfileModalProps = {
  onClose: () => void
  profile: UserProfile
  userId: string | null
  visible: boolean
}

function EditProfileModal({ onClose, profile, userId, visible }: EditProfileModalProps) {
  const [draft, setDraft] = useState(profile)
  const [isSaving, setIsSaving] = useState(false)
  const [isPickingPhoto, setIsPickingPhoto] = useState(false)
  const [isPhotoOptionsVisible, setIsPhotoOptionsVisible] = useState(false)
  const [selectedPhotoAsset, setSelectedPhotoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null)

  useEffect(() => {
    if (visible) {
      setDraft(profile)
      setSelectedPhotoAsset(null)
      setIsPhotoOptionsVisible(false)
    }
  }, [profile, visible])

  useEffect(() => {
    if (!visible) return

    let mounted = true

    ImagePicker.getPendingResultAsync()
      .then((pendingResult) => {
        if (!mounted || !pendingResult || 'code' in pendingResult || pendingResult.canceled || !pendingResult.assets?.[0]) return

        const asset = pendingResult.assets[0]
        setSelectedPhotoAsset(asset)
        setDraft((current) => ({ ...current, photoURL: asset.uri }))
      })
      .catch(() => {
        // Android can restore picker results after Activity recreation; there may simply be no result.
      })

    return () => {
      mounted = false
    }
  }, [visible])

  const photoPickerOptions: ImagePicker.ImagePickerOptions = {
    allowsEditing: false,
    base64: false,
    exif: false,
    mediaTypes: ['images'],
    quality: 0.6,
  }

  const waitForNativePicker = () => new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, 250)
    })
  })

  const openAppSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert('Permiso necesario', 'Activa los permisos desde la configuracion de Android.')
    })
  }

  const ensureMediaLibraryPermission = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false)

    if (permission.granted) return true

    Alert.alert(
      'Permiso necesario',
      'Necesitamos acceso a tus fotos para elegir una imagen de perfil.',
      permission.canAskAgain
        ? [{ text: 'Entendido' }]
        : [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir ajustes', onPress: openAppSettings },
        ],
    )

    return false
  }

  const applyPickedPhoto = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return

    const asset = result.assets?.[0]

    if (!asset?.uri) {
      Alert.alert('No pudimos cargar la foto', 'La imagen seleccionada no tiene un archivo válido.')
      return
    }

    setSelectedPhotoAsset(asset)
    setDraft((current) => ({ ...current, photoURL: asset.uri }))
  }

  const getBlobFromUri = async (uri: string, timeoutMs = 20000) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(uri, { signal: controller.signal })
      if (!response.ok) throw new Error(`profile-photo-fetch-failed:${response.status}`)

      const blob = await response.blob()
      if (blob.size <= 0) throw new Error('profile-photo-empty-blob')

      return blob
    } finally {
      clearTimeout(timeoutId)
    }
  }

  const uploadProfilePhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.uri) throw new Error('profile-photo-missing-uri')

    const { auth, storage } = getFirebaseServices()
    const currentUser = auth.currentUser
    const authUid = currentUser?.uid

    if (!authUid) throw new Error('profile-photo-auth-required')
    if (userId && authUid !== userId && __DEV__) {
      console.warn('profile-photo-auth-user-mismatch-ignored', { authUid, userId })
    }

    const contentType = asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg'
    let blob: Blob | null = null

    try {
      blob = await getBlobFromUri(asset.uri)

      if (blob.size <= 0) throw new Error('profile-photo-empty-blob')

      const uploadBlob = blob.type?.startsWith('image/')
        ? blob
        : new Blob([blob], { type: contentType })
      const uploadPath = `avatars/${authUid}/profile.jpg`
      const storageRef = ref(storage, uploadPath)

      if (__DEV__) {
        console.log('avatar upload uid check', {
          authUid,
          pathUserId: userId,
          path: uploadPath,
        })
      }

      await Promise.race([
        uploadBytes(storageRef, uploadBlob, {
          cacheControl: 'public,max-age=3600',
          contentType: uploadBlob.type || contentType,
          customMetadata: {
            owner: authUid,
          },
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('profile-photo-upload-timeout')), 30000)
        }),
      ])

      return getDownloadURL(storageRef)
    } finally {
      const close = (blob as Blob & { close?: () => void } | null)?.close
      if (typeof close === 'function') close.call(blob)
    }
  }

  const choosePhotoFromLibrary = async () => {
    if (isPickingPhoto) return
    setIsPhotoOptionsVisible(false)
    setIsPickingPhoto(true)

    try {
      const hasPermission = await ensureMediaLibraryPermission()
      if (!hasPermission) return

      await waitForNativePicker()
      const result = await ImagePicker.launchImageLibraryAsync(photoPickerOptions)
      applyPickedPhoto(result)
    } catch (error) {
      if (__DEV__) console.warn('profile-image-library-error', error)
      Alert.alert('No pudimos abrir la galería', 'Revisá los permisos de fotos e intentá nuevamente.')
    } finally {
      setIsPickingPhoto(false)
    }
  }

  const openPhotoOptions = () => {
    if (!isSaving) setIsPhotoOptionsVisible(true)
  }

  const save = async () => {
    if (isSaving) return

    setIsSaving(true)
    try {
      const { auth, db } = getFirebaseServices()
      const authUid = auth.currentUser?.uid

      if (!authUid) {
        Alert.alert('Sesión requerida', 'Iniciá sesión nuevamente para guardar tu foto de perfil.')
        return
      }
      if (userId && authUid !== userId && __DEV__) {
        console.warn('profile-save-auth-user-mismatch-ignored', { authUid, userId })
      }

      let savedPhotoURL = draft.photoURL.trim()
      let uploadFailed = false

      if (selectedPhotoAsset) {
        try {
          savedPhotoURL = await uploadProfilePhoto(selectedPhotoAsset)
          await updateProfile(auth.currentUser, { photoURL: savedPhotoURL })
        } catch (uploadError) {
          uploadFailed = true
          logAvatarUploadError(uploadError)
          if (__DEV__) console.warn('profile-photo-upload-fallback-local-uri', uploadError)
          savedPhotoURL = selectedPhotoAsset.uri || savedPhotoURL
        }
      }

      await setDoc(doc(db, 'users', authUid), {
        avatarUrl: savedPhotoURL,
        bio: draft.bio.trim(),
        fullName: draft.fullName.trim(),
        imageUrl: savedPhotoURL,
        location: draft.location.trim(),
        photoURL: savedPhotoURL,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setDraft((current) => ({ ...current, photoURL: savedPhotoURL }))
      setSelectedPhotoAsset(null)
      if (uploadFailed) {
        Alert.alert('Foto actualizada', 'La foto se actualizó en este dispositivo, pero no se pudo guardar online todavía.')
      }
      onClose()
    } catch (error) {
      logAvatarUploadError(error)
      if (__DEV__) console.warn('profile-save-error', error)
      Alert.alert('No pudimos guardar', getAvatarUploadErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.editContent} showsVerticalScrollIndicator={false}>
          <View style={styles.editHeader}>
            <PressScale onPress={onClose} style={styles.editHeaderButton} scaleTo={0.94}>
              <Text style={styles.cancelEditText}>Cancelar</Text>
            </PressScale>
            <Text style={styles.editTitle}>Editar perfil</Text>
            <PressScale disabled={isSaving} onPress={save} style={[styles.editHeaderButton, isSaving && styles.editHeaderButtonDisabled]} scaleTo={0.94}>
              <Text style={styles.saveEditText}>{isSaving ? 'Guardando' : 'Guardar'}</Text>
            </PressScale>
          </View>

          <View style={styles.editHero}>
            <View style={styles.editAvatarStage}>
              <PressScale
                accessibilityLabel="Cambiar foto de perfil"
                accessibilityRole="button"
                onPress={openPhotoOptions}
                scaleTo={0.96}
                style={styles.editAvatar}
              >
                {draft.photoURL ? (
                  <Image resizeMode="cover" source={{ uri: draft.photoURL }} style={styles.editAvatarImage} />
                ) : (
                  <UserRound color="#4B348A" size={58} strokeWidth={2.1} />
                )}
                {isPickingPhoto || (isSaving && selectedPhotoAsset) ? (
                  <View style={styles.photoUploadingOverlay}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                ) : null}
              </PressScale>
              <PressScale
                accessibilityLabel="Cambiar foto de perfil"
                accessibilityRole="button"
                onPress={openPhotoOptions}
                scaleTo={0.92}
                style={styles.cameraBadge}
              >
                <Camera color="#FFFFFF" size={20} strokeWidth={2.5} />
              </PressScale>
            </View>
            <PressScale onPress={openPhotoOptions} scaleTo={0.96} style={styles.changePhotoButton}>
              <Text style={styles.changePhotoButtonText}>📷 Cambiar foto</Text>
            </PressScale>
            <Text numberOfLines={1} style={styles.editHeroName}>{draft.fullName}</Text>
            <View style={styles.editHeroLocation}>
              <MapPin color="#6A746F" size={16} strokeWidth={2.2} />
              <Text numberOfLines={1} style={styles.editHeroLocationText}>{draft.location}</Text>
            </View>
          </View>

          <EditProfileField Icon={UserRound} label="Nombre" value={draft.fullName} onChangeText={(fullName) => setDraft((current) => ({ ...current, fullName }))} />
          <EditProfileField Icon={MapPin} label="Ubicación" value={draft.location} onChangeText={(location) => setDraft((current) => ({ ...current, location }))} />
          <EditProfileField Icon={Pencil} label="Bio" multiline maxLength={150} showCount value={draft.bio} onChangeText={(bio) => setDraft((current) => ({ ...current, bio }))} />

          <View style={styles.privacyCard}>
            <View style={styles.privacyIcon}>
              <LockKeyhole color="#4B348A" size={23} strokeWidth={2.2} />
            </View>
            <View style={styles.privacyCopy}>
              <Text style={styles.privacyTitle}>Tu información es privada</Text>
              <Text style={styles.privacyText}>Solo las personas con las que hacés match pueden verla.</Text>
            </View>
          </View>
        </ScrollView>
        <Modal
          animationType="fade"
          onRequestClose={() => setIsPhotoOptionsVisible(false)}
          transparent
          visible={isPhotoOptionsVisible}
        >
          <Pressable style={styles.photoSheetBackdrop} onPress={() => setIsPhotoOptionsVisible(false)}>
            <Pressable accessibilityRole="menu" style={styles.photoSheet}>
              <View style={styles.photoSheetHandle} />
              <Text style={styles.photoSheetTitle}>Foto de perfil</Text>
              <Pressable accessibilityRole="menuitem" onPress={choosePhotoFromLibrary} style={styles.photoSheetOption}>
                <View style={styles.photoSheetIcon}>
                  <ImageIcon color="#4B348A" size={22} strokeWidth={2.4} />
                </View>
                <Text style={styles.photoSheetOptionText}>Elegir de la galería</Text>
              </Pressable>
              <Pressable accessibilityRole="menuitem" onPress={() => setIsPhotoOptionsVisible(false)} style={styles.photoSheetCancel}>
                <Text style={styles.photoSheetCancelText}>Cancelar</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </Modal>
  )
}

function EditProfileField({
  Icon,
  label,
  maxLength,
  multiline,
  onChangeText,
  showCount,
  value,
}: {
  Icon: LucideIcon
  label: string
  maxLength?: number
  multiline?: boolean
  onChangeText: (value: string) => void
  showCount?: boolean
  value: string
}) {
  return (
    <View style={[styles.editFieldCard, multiline && styles.editBioCard]}>
      <View style={styles.editFieldIcon}>
        <Icon color="#4B348A" size={25} strokeWidth={2.2} />
      </View>
      <View style={styles.editFieldCopy}>
        <Text style={styles.editFieldLabel}>{label}</Text>
      <TextInput
          maxLength={maxLength}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholderTextColor="#8B9692"
          style={[styles.editFieldInput, multiline && styles.editBioInput]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
        {showCount ? <Text style={styles.editFieldCount}>{value.length}/{maxLength ?? 150}</Text> : null}
      </View>
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

const cardShadow = Platform.select({
  web: {
    boxShadow: '0 10px 24px rgba(7, 57, 45, 0.07)',
  },
  default: {
    elevation: 2,
    shadowColor: '#07392D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
})

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FAFAF8',
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 154,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  screenTitle: {
    color: '#071D19',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    ...shadow,
  },
  avatarStage: {
    alignItems: 'center',
    height: 108,
    justifyContent: 'center',
    position: 'relative',
    width: 108,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#F4EEF9',
    borderColor: '#FFFFFF',
    borderWidth: 3,
    borderRadius: 999,
    height: 96,
    justifyContent: 'center',
    position: 'relative',
    width: 96,
    overflow: 'hidden',
  },
  avatarImage: {
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  avatarInitials: {
    color: '#4B348A',
    fontSize: 16,
    fontWeight: '900',
  },
  editPhotoChip: {
    alignItems: 'center',
    backgroundColor: '#F4EEF9',
    borderColor: '#E6DDF7',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    marginTop: 10,
    minHeight: 26,
    paddingHorizontal: 9,
  },
  editPhotoChipText: {
    color: '#4B348A',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  editAvatarButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E6E2ED',
    borderRadius: 999,
    borderWidth: 2,
    bottom: 6,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    width: 34,
    zIndex: 3,
  },
  name: {
    color: '#071D19',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 29,
    marginTop: 12,
    maxWidth: '100%',
    textAlign: 'center',
  },
  locationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
  },
  location: {
    color: '#40534D',
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'center',
  },
  bio: {
    color: '#193F37',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center',
  },
  statsRow: {
    borderTopColor: '#ECEBE7',
    borderTopWidth: 1,
    flexDirection: 'row',
    marginTop: 18,
    paddingTop: 18,
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#071D19',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4,
  },
  statLabel: {
    color: '#596A65',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  editProfileButton: {
    alignItems: 'center',
    backgroundColor: '#006A32',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 20,
  },
  editProfileText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  section: {
    marginTop: 26,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#39206C',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 23,
  },
  sectionHint: {
    alignItems: 'center',
    backgroundColor: '#F4EEF9',
    borderColor: '#E6DDF7',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 26,
    paddingHorizontal: 9,
  },
  sectionHintText: {
    color: '#4B348A',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  chipWrap: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 11,
    justifyContent: 'center',
  },
  interestsCard: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 72,
    padding: 14,
  },
  interestsEmptyContent: {
    alignItems: 'center',
    gap: 7,
    justifyContent: 'center',
    minHeight: 44,
  },
  interestsHint: {
    color: '#596A65',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 10,
    textAlign: 'center',
  },
  profileShowAllInterestsButton: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 36,
    paddingHorizontal: 14,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: '#FAFCF8',
    borderColor: '#DDE7DD',
    borderRadius: 18,
    borderWidth: 1.3,
    flexBasis: '30%',
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 92,
    minWidth: 96,
    paddingHorizontal: 10,
    paddingVertical: 12,
    position: 'relative',
  },
  chipSelected: {
    backgroundColor: '#EAF7E7',
    borderColor: '#17803C',
    borderWidth: 1.8,
  },
  chipCompact: {
    borderRadius: 16,
    flexBasis: 'auto',
    flexDirection: 'row',
    flexGrow: 0,
    minHeight: 46,
    minWidth: 0,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  chipIcon: {
    alignItems: 'center',
    backgroundColor: '#EFF6E9',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  chipIconSelected: {
    backgroundColor: '#D6EED5',
  },
  chipIconCompact: {
    height: 30,
    width: 30,
  },
  chipText: {
    color: '#10231F',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
    textAlign: 'center',
  },
  chipTextSelected: {
    color: '#063C31',
    fontWeight: '900',
  },
  chipTextCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  chipCheck: {
    alignItems: 'center',
    backgroundColor: '#17803C',
    borderColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 24,
    zIndex: 2,
  },
  emptyBlock: {
    alignItems: 'center',
    backgroundColor: '#F7FAF5',
    borderColor: '#E3ECE4',
    borderRadius: 14,
    borderWidth: 1,
    gap: 7,
    minHeight: 76,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE8E1',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  emptyText: {
    color: '#596A65',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  list: {
    gap: 10,
  },
  profileGroupRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...cardShadow,
  },
  profileGroupIcon: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  profileGroupCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileGroupName: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  profileGroupMeta: {
    color: '#5F6E68',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 3,
  },
  profileGroupActions: {
    alignItems: 'flex-end',
    gap: 4,
  },
  profileGroupAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 24,
  },
  profileGroupActionText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  profileGroupDeleteText: {
    color: '#9A3B3B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  profileRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 98,
    paddingHorizontal: 12,
    paddingVertical: 11,
    ...cardShadow,
  },
  rowThumb: {
    alignItems: 'center',
    backgroundColor: '#EFF6E9',
    borderRadius: 16,
    height: 76,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 76,
  },
  rowThumbGroup: {
    backgroundColor: '#F4EEF9',
    borderRadius: 16,
  },
  rowThumbImage: {
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  rowThumbIcon: {
    alignItems: 'center',
    backgroundColor: '#F7FAF5',
    borderColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 2,
    bottom: 6,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    width: 28,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  rowTitle: {
    color: '#071D19',
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  rowCancelledBadge: {
    backgroundColor: '#FFF2CC',
    borderColor: '#F5C84B',
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rowCancelledBadgeText: {
    color: '#7A4A00',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
  rowOwnBadge: {
    backgroundColor: '#F4EEF9',
    borderColor: '#E6DDF7',
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  rowOwnBadgeText: {
    color: '#4B348A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
  rowLocation: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 4,
  },
  rowMeta: {
    color: '#5F6E68',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  rowGroupIndicator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 3,
    maxWidth: '100%',
  },
  rowGroupIndicatorText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 12,
  },
  rowBadgeLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 8,
  },
  rowBadge: {
    alignItems: 'center',
    backgroundColor: '#F0F5E9',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    maxWidth: '100%',
    minHeight: 24,
    paddingHorizontal: 8,
  },
  rowBadgeText: {
    color: '#17803C',
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  editContent: {
    paddingBottom: 44,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  editHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  editHeaderButton: {
    minWidth: 76,
    minHeight: 38,
    justifyContent: 'center',
  },
  editHeaderButtonDisabled: {
    opacity: 0.55,
  },
  cancelEditText: {
    color: '#596A65',
    fontSize: 14,
    fontWeight: '900',
  },
  saveEditText: {
    color: '#4B348A',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  editTitle: {
    color: '#071D19',
    fontSize: 22,
    fontWeight: '900',
  },
  editHero: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 4,
  },
  editAvatarStage: {
    alignItems: 'center',
    height: 148,
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
    width: 148,
  },
  editAvatar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F4EEF9',
    borderColor: '#DCCFF4',
    borderWidth: 2,
    borderRadius: 999,
    height: 128,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 128,
    shadowColor: '#4B348A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  editAvatarImage: {
    borderRadius: 999,
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  editHeroName: {
    color: '#071D19',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 31,
    maxWidth: '100%',
    textAlign: 'center',
  },
  editHeroLocation: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 6,
  },
  editHeroLocationText: {
    color: '#6A746F',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
  photoUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(7, 29, 25, 0.34)',
    borderRadius: 999,
    justifyContent: 'center',
  },
  cameraBadge: {
    alignItems: 'center',
    backgroundColor: '#006A32',
    borderColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 3,
    bottom: 8,
    height: 46,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    width: 46,
    shadowColor: '#07392D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 5,
  },
  changePhotoButton: {
    alignItems: 'center',
    backgroundColor: '#EFF6E9',
    borderColor: '#D7E8CC',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 13,
    minHeight: 34,
    paddingHorizontal: 14,
  },
  changePhotoButtonText: {
    color: '#006A32',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  photoSheetBackdrop: {
    backgroundColor: 'rgba(7, 29, 25, 0.34)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 18,
  },
  photoSheet: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E0F2',
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    ...cardShadow,
  },
  photoSheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#D9CBF3',
    borderRadius: 999,
    height: 4,
    marginBottom: 14,
    width: 44,
  },
  photoSheetTitle: {
    color: '#071D19',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 10,
  },
  photoSheetOption: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 8,
  },
  photoSheetIcon: {
    alignItems: 'center',
    backgroundColor: '#F4EEF9',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  photoSheetOptionText: {
    color: '#071D19',
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  photoSheetCancel: {
    alignItems: 'center',
    backgroundColor: '#F7F4FA',
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 46,
  },
  photoSheetCancelText: {
    color: '#4B348A',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  editFieldCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E8E2',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    minHeight: 82,
    marginBottom: 14,
    paddingHorizontal: 17,
    paddingVertical: 14,
    ...cardShadow,
  },
  editBioCard: {
    alignItems: 'flex-start',
    minHeight: 140,
    paddingVertical: 17,
  },
  editFieldIcon: {
    alignItems: 'center',
    backgroundColor: '#F7F3FB',
    borderColor: '#EEE6F8',
    borderRadius: 999,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  editFieldCopy: {
    flex: 1,
    minWidth: 0,
  },
  editFieldLabel: {
    color: '#6D7671',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  editFieldInput: {
    color: '#071D19',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    minHeight: 30,
    padding: 0,
  },
  editBioInput: {
    fontWeight: '700',
    lineHeight: 23,
    minHeight: 74,
    paddingTop: 2,
  },
  editFieldCount: {
    alignSelf: 'flex-end',
    color: '#6A746F',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  field: {
    marginBottom: 15,
  },
  fieldLabel: {
    color: '#10231F',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1DD',
    borderRadius: 14,
    borderWidth: 1,
    color: '#10231F',
    fontSize: 15,
    fontWeight: '600',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  multilineInput: {
    minHeight: 104,
    paddingTop: 13,
  },
  showAllInterestsText: {
    color: '#4B348A',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  showAllIcon: {
    transform: [{ rotate: '90deg' }],
  },
  showLessIcon: {
    transform: [{ rotate: '-90deg' }],
  },
  privacyCard: {
    alignItems: 'center',
    backgroundColor: '#F7F2FB',
    borderColor: '#E6DDF7',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  privacyIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E6DDF7',
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  privacyCopy: {
    flex: 1,
    minWidth: 0,
  },
  privacyTitle: {
    color: '#4B348A',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  privacyText: {
    color: '#596A65',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 16,
    marginTop: 2,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  groupEditModal: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCD2F2',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    width: '100%',
    ...cardShadow,
  },
  groupEditTitle: {
    color: '#3A256A',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 12,
    textAlign: 'center',
  },
  groupEditInput: {
    backgroundColor: '#FCFAF8',
    borderColor: '#E4E7E2',
    borderRadius: 14,
    borderWidth: 1,
    color: '#071D19',
    fontSize: 15,
    fontWeight: '800',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  groupEditPrimary: {
    alignItems: 'center',
    backgroundColor: '#4B348A',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 50,
  },
  groupEditPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  groupEditSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  groupEditSecondaryText: {
    color: '#4B348A',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
})


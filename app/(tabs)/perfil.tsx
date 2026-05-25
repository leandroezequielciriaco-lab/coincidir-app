import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import {
  CalendarDays,
  Camera,
  ChevronRight,
  Circle,
  CircleDot,
  Coffee,
  Dumbbell,
  Footprints,
  Heart,
  MapPin,
  Mountain,
  Pencil,
  Star,
  Trees,
  Trophy,
  UserRound,
  UsersRound,
  Waves,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { PressScale } from '../../components/home/PressScale'
import { getFirebaseServices } from '../../firebaseConfig'

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

const DEFAULT_BIO = 'Siempre listo para nuevos planes.'
const DEFAULT_LOCATION = 'Tandil'
const editableInterests = [
  'Yoga',
  'Running',
  'Paddle / Tenis',
  'Caminatas',
  'Aire libre',
  'Mateadas',
  'Fútbol 5',
  'Escalada',
  'Natación',
]

function getInterestIcon(label: string): LucideIcon {
  const value = label.toLowerCase()

  if (value.includes('yoga')) return Dumbbell
  if (value.includes('running')) return Footprints
  if (value.includes('paddle') || value.includes('tenis')) return Trophy
  if (value.includes('caminata')) return Mountain
  if (value.includes('aire')) return Trees
  if (value.includes('mate')) return Coffee
  if (value.includes('fútbol') || value.includes('fÃºtbol')) return Circle
  if (value.includes('escalada')) return Mountain
  if (value.includes('nataci')) return Waves

  return CircleDot
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
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

function buildProfile(data: Record<string, unknown> | null, authName?: string | null): UserProfile {
  return {
    bio: readString(data?.bio, DEFAULT_BIO),
    fullName: readString(data?.fullName, readString(data?.displayName, readString(data?.name, authName ?? 'Mi perfil'))),
    interests: readList(data?.interests),
    location: readString(data?.location, readString(data?.city, DEFAULT_LOCATION)),
    photoURL: readString(data?.photoURL),
  }
}

export default function PerfilScreen() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [authName, setAuthName] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile>(buildProfile(null))
  const [activities, setActivities] = useState<FirestoreRecord[]>([])
  const [groups, setGroups] = useState<FirestoreRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    try {
      const { auth } = getFirebaseServices()
      return onAuthStateChanged(auth, (user) => {
        setUserId(user?.uid ?? null)
        setAuthName(user?.displayName ?? null)
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
          setProfile(buildProfile(snapshot.exists() ? snapshot.data() : null, authName))
          setIsLoading(false)
        },
        () => setIsLoading(false),
      )
    } catch {
      setIsLoading(false)
      return undefined
    }
  }, [authName, userId])

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

  const createdActivities = useMemo(
    () => activities.filter((item) => readString(item.data.createdBy) === userId),
    [activities, userId],
  )
  const joinedActivities = useMemo(
    () => activities.filter((item) => isJoined(item, userId) && readString(item.data.createdBy) !== userId),
    [activities, userId],
  )
  const myGroups = useMemo(
    () => groups.filter((item) => readString(item.data.createdBy) === userId || isJoined(item, userId)),
    [groups, userId],
  )
  const stats = useMemo(() => [
    { label: 'Actividades', value: String(createdActivities.length + joinedActivities.length), Icon: CalendarDays, color: '#5A35D6' },
    { label: 'Grupos', value: String(myGroups.length), Icon: UsersRound, color: '#17803C' },
    { label: 'Coincidencias', value: String(createdActivities.length + joinedActivities.length + myGroups.length), Icon: Star, color: '#F2A900' },
  ], [createdActivities.length, joinedActivities.length, myGroups.length])

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
          <View style={styles.avatar}>
            {profile.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={styles.avatarImage} />
            ) : (
              <UserRound color="#4B348A" size={46} strokeWidth={2.1} />
            )}
            <PressScale onPress={() => setIsEditing(true)} scaleTo={0.94} style={styles.editAvatarButton}>
              <Pencil color="#4B348A" size={16} strokeWidth={2.4} />
            </PressScale>
          </View>
          <Text style={styles.name}>{profile.fullName}</Text>
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

        <ProfileSection title="Mis intereses">
          {profile.interests.length > 0 ? (
            <View style={styles.chipWrap}>
              {profile.interests.map((interest) => <InterestChip key={interest} label={interest} />)}
            </View>
          ) : (
            <EmptyBlock text="Agregá tus gustos para mejorar tus coincidencias." />
          )}
        </ProfileSection>

        <ProfileListSection
          emptyText="Cuando crees actividades, van a aparecer acá."
          items={createdActivities}
          onPress={(item) => router.push({ pathname: '/activity/[activityId]', params: { activityId: item.id } })}
          title="Actividades creadas"
        />

        <ProfileListSection
          emptyText="Cuando te sumes a una actividad, la vas a ver acá."
          items={joinedActivities}
          onPress={(item) => router.push({ pathname: '/activity/[activityId]', params: { activityId: item.id } })}
          title="Me sumé a"
        />

        <ProfileListSection
          emptyText="Tus grupos creados o donde participes van a aparecer acá."
          items={myGroups}
          onPress={(item) => router.push({ pathname: '/group/[groupId]', params: { groupId: item.id } })}
          title="Mis grupos"
          variant="group"
        />
      </ScrollView>

      <EditProfileModal
        onClose={() => setIsEditing(false)}
        profile={profile}
        userId={userId}
        visible={isEditing}
      />
    </SafeAreaView>
  )
}

type ProfileSectionProps = {
  children: React.ReactNode
  title: string
}

function ProfileSection({ children, title }: ProfileSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

function InterestChip({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const Icon = getInterestIcon(label)

  return (
    <PressScale onPress={onPress} scaleTo={0.97} style={[styles.chip, selected && styles.chipSelected]}>
      <Icon color={selected ? '#FFFFFF' : '#006A32'} size={15} strokeWidth={2.1} />
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </PressScale>
  )
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <View style={styles.emptyBlock}>
      <Heart color="#B7C8BF" size={25} strokeWidth={2.1} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  )
}

type ProfileListSectionProps = {
  emptyText: string
  items: FirestoreRecord[]
  onPress: (item: FirestoreRecord) => void
  title: string
  variant?: 'activity' | 'group'
}

function ProfileListSection({ emptyText, items, onPress, title, variant = 'activity' }: ProfileListSectionProps) {
  return (
    <ProfileSection title={title}>
      {items.length === 0 ? (
        <EmptyBlock text={emptyText} />
      ) : (
        <View style={styles.list}>
          {items.slice(0, 4).map((item) => (
            <ProfileRow item={item} key={item.id} onPress={() => onPress(item)} variant={variant} />
          ))}
        </View>
      )}
    </ProfileSection>
  )
}

function ProfileRow({ item, onPress, variant }: { item: FirestoreRecord; onPress: () => void; variant: 'activity' | 'group' }) {
  const title = readString(item.data.name, readString(item.data.title, variant === 'group' ? 'Grupo sin título' : 'Actividad sin título'))
  const location = readString(item.data.location, variant === 'group' ? 'Grupo de amigos' : 'Ubicación a definir')
  const date = readString(item.data.date, readString(item.data.schedule))
  const participants = getParticipantCount(item.data)

  return (
    <PressScale onPress={onPress} scaleTo={0.98} style={styles.profileRow}>
      <View style={[styles.rowThumb, variant === 'group' && styles.rowThumbGroup]}>
        {variant === 'group' ? <UsersRound color="#4B348A" size={25} strokeWidth={2.2} /> : <CalendarDays color="#006A32" size={24} strokeWidth={2.2} />}
      </View>
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.rowMeta}>{location}</Text>
        <Text numberOfLines={1} style={styles.rowHint}>
          {variant === 'group' ? `${participants} miembros` : `${date}${participants ? ` · ${participants} participantes` : ''}`}
        </Text>
      </View>
      <ChevronRight color="#40534D" size={20} strokeWidth={2.2} />
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
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  useEffect(() => {
    if (visible) setDraft(profile)
  }, [profile, visible])

  const toggleInterest = (interest: string) => {
    setDraft((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
    }))
  }

  const uploadProfilePhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!userId || isUploadingPhoto) return

    setDraft((current) => ({ ...current, photoURL: asset.uri }))
    setIsUploadingPhoto(true)

    try {
      const { db, storage } = getFirebaseServices()
      const response = await fetch(asset.uri)
      const blob = await response.blob()
      const extension = asset.fileName?.split('.').pop() || asset.mimeType?.split('/').pop() || 'jpg'
      const cleanExtension = extension.replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
      const storageRef = ref(storage, `users/${userId}/profile-photo-${Date.now()}.${cleanExtension}`)

      await uploadBytes(storageRef, blob, {
        contentType: asset.mimeType || 'image/jpeg',
      })

      const photoURL = await getDownloadURL(storageRef)
      setDraft((current) => ({ ...current, photoURL }))
      await setDoc(doc(db, 'users', userId), {
        photoURL,
        updatedAt: serverTimestamp(),
      }, { merge: true })
    } catch {
      Alert.alert('No pudimos actualizar la foto', 'Probá de nuevo en unos segundos.')
      setDraft((current) => ({ ...current, photoURL: profile.photoURL }))
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const choosePhotoFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tus fotos para elegir una imagen de perfil.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.86,
    })

    if (!result.canceled && result.assets[0]) {
      await uploadProfilePhoto(result.assets[0])
    }
  }

  const takeProfilePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()

    if (!permission.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a la cámara para tomar tu foto de perfil.')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.86,
    })

    if (!result.canceled && result.assets[0]) {
      await uploadProfilePhoto(result.assets[0])
    }
  }

  const openPhotoOptions = () => {
    Alert.alert('Foto de perfil', 'Elegí cómo querés actualizar tu foto.', [
      { text: 'Tomar foto con cámara', onPress: takeProfilePhoto },
      { text: 'Elegir foto desde galería', onPress: choosePhotoFromLibrary },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  const save = async () => {
    if (!userId || isSaving) return

    setIsSaving(true)
    try {
      const { db } = getFirebaseServices()
      await setDoc(doc(db, 'users', userId), {
        bio: draft.bio.trim(),
        fullName: draft.fullName.trim(),
        interests: draft.interests,
        location: draft.location.trim(),
        photoURL: draft.photoURL.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true })
      onClose()
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
            <PressScale onPress={save} style={styles.editHeaderButton} scaleTo={0.94}>
              <Text style={styles.saveEditText}>{isSaving ? 'Guardando' : 'Guardar'}</Text>
            </PressScale>
          </View>

          <PressScale onPress={openPhotoOptions} scaleTo={0.96} style={styles.editAvatar}>
            {draft.photoURL ? (
              <Image source={{ uri: draft.photoURL }} style={styles.editAvatarImage} />
            ) : (
              <UserRound color="#4B348A" size={48} strokeWidth={2.1} />
            )}
            {isUploadingPhoto ? (
              <View style={styles.photoUploadingOverlay}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
            <View style={styles.cameraBadge}>
              <Camera color="#FFFFFF" size={17} strokeWidth={2.4} />
            </View>
          </PressScale>

          <Field label="Foto" value={draft.photoURL} onChangeText={(photoURL) => setDraft((current) => ({ ...current, photoURL }))} placeholder="URL de foto (opcional)" />
          <Field label="Nombre" value={draft.fullName} onChangeText={(fullName) => setDraft((current) => ({ ...current, fullName }))} />
          <Field label="Ubicación" value={draft.location} onChangeText={(location) => setDraft((current) => ({ ...current, location }))} />
          <Field label="Bio" multiline value={draft.bio} onChangeText={(bio) => setDraft((current) => ({ ...current, bio }))} />

          <Text style={styles.editSectionTitle}>Intereses</Text>
          <View style={styles.chipWrap}>
            {editableInterests.map((interest) => (
              <InterestChip
                key={interest}
                label={interest}
                onPress={() => toggleInterest(interest)}
                selected={draft.interests.includes(interest)}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function Field({
  label,
  multiline,
  onChangeText,
  placeholder,
  value,
}: {
  label: string
  multiline?: boolean
  onChangeText: (value: string) => void
  placeholder?: string
  value: string
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8B9692"
        style={[styles.input, multiline && styles.multilineInput]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
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
    paddingBottom: 118,
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
  avatar: {
    alignItems: 'center',
    backgroundColor: '#F4EEF9',
    borderRadius: 999,
    height: 96,
    justifyContent: 'center',
    position: 'relative',
    width: 96,
    overflow: 'hidden',
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarInitials: {
    color: '#4B348A',
    fontSize: 16,
    fontWeight: '900',
  },
  editAvatarButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E6E2ED',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 0,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 32,
  },
  name: {
    color: '#071D19',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 12,
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
    marginTop: 22,
  },
  sectionTitle: {
    color: '#39206C',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E5DF',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  chipSelected: {
    backgroundColor: '#6C3DE5',
    borderColor: '#6C3DE5',
  },
  chipText: {
    color: '#10231F',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  emptyBlock: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    minHeight: 92,
    justifyContent: 'center',
    padding: 16,
  },
  emptyText: {
    color: '#596A65',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  list: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  profileRow: {
    alignItems: 'center',
    borderBottomColor: '#EFEEE9',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 82,
    paddingHorizontal: 12,
  },
  rowThumb: {
    alignItems: 'center',
    backgroundColor: '#EFF6E9',
    borderRadius: 14,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  rowThumbGroup: {
    backgroundColor: '#F4EEF9',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: '#071D19',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  rowMeta: {
    color: '#40534D',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  rowHint: {
    color: '#17803C',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 5,
  },
  editContent: {
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 12,
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
    fontSize: 18,
    fontWeight: '900',
  },
  editAvatar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F4EEF9',
    borderRadius: 999,
    height: 108,
    justifyContent: 'center',
    marginBottom: 22,
    position: 'relative',
    width: 108,
    overflow: 'hidden',
  },
  editAvatarImage: {
    height: '100%',
    width: '100%',
  },
  photoUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(7, 29, 25, 0.34)',
    justifyContent: 'center',
  },
  cameraBadge: {
    alignItems: 'center',
    backgroundColor: '#6C3DE5',
    borderColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 3,
    bottom: 3,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 3,
    width: 36,
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
  editSectionTitle: {
    color: '#39206C',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 12,
    marginTop: 6,
  },
})

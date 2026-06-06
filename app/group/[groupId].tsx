import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, deleteField, doc, getDoc, increment, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Sprout,
  UserRound,
  UsersRound,
} from 'lucide-react-native'

import { PressScale } from '../../components/home/PressScale'
import { getLocalGroupId } from '../../constants/localGroups'
import { getFirebaseServices } from '../../firebaseConfig'
import { getActivityGroupMeta } from '../../utils/activityGroups'
import { getCategoryImage } from '../../utils/categoryImages'

type GroupData = Record<string, unknown>
type ActivityRecord = {
  id: string
  data: Record<string, unknown>
}
type PendingRequest = {
  id: string
  name: string
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function getRecordTime(record: ActivityRecord) {
  const value = record.data.createdAt ?? record.data.updatedAt
  return typeof value === 'object' && value && 'toMillis' in value && typeof value.toMillis === 'function'
    ? value.toMillis()
    : 0
}

function getActivityStartTime(data: Record<string, unknown>) {
  const timestamp = data.startAt ?? data.startsAt ?? data.dateTime
  if (typeof timestamp === 'object' && timestamp && 'toMillis' in timestamp && typeof timestamp.toMillis === 'function') {
    return timestamp.toMillis()
  }

  const rawDate = readString(data.date, readString(data.day))
  const rawTime = readString(data.time, readString(data.hour))
  const normalized = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    ? rawDate.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, '$3-$2-$1')
    : rawDate
  const parsed = Date.parse(`${normalized}${rawTime ? `T${rawTime}` : ''}`)

  return Number.isFinite(parsed) ? parsed : getRecordTime({ id: '', data })
}

function getOwnerId(data: GroupData) {
  return readString(data.createdBy)
    || readString(data.creatorId)
    || readString(data.ownerId)
    || readString(data.organizerId)
    || readString(data.userId)
    || readString(data.createdById)
}

function getMemberCount(data: GroupData) {
  const membersCount = readNumber(data.membersCount, -1)
  if (membersCount >= 0) return getOwnerId(data) ? Math.max(membersCount, 1) : membersCount

  const members = data.members ?? data.joinedUsers ?? data.participants
  const count = typeof members === 'object' && members
    ? Object.keys(members).length
    : Array.isArray(members) ? members.length : 0

  return getOwnerId(data) ? Math.max(count, 1) : count
}

function hasUserInValue(value: unknown, userId: string | null) {
  if (!userId) return false
  if (typeof value === 'object' && value) return userId in value
  return Array.isArray(value) ? value.includes(userId) : false
}

function isGroupOwner(data: GroupData, userId: string | null) {
  if (!userId) return false
  return getOwnerId(data) === userId
}

function isGroupMember(data: GroupData, userId: string | null) {
  if (isGroupOwner(data, userId)) return true
  return hasUserInValue(data.members, userId)
    || hasUserInValue(data.joinedUsers, userId)
    || hasUserInValue(data.participants, userId)
}

function getPendingRequests(data: GroupData) {
  const requests = data.membershipRequests ?? data.pendingMembers
  if (!requests || typeof requests !== 'object' || Array.isArray(requests)) return []

  return Object.entries(requests).map(([id, value]) => {
    const requestData = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    return {
      id,
      name: readString(requestData.name, readString(requestData.displayName, 'Usuario sin nombre')),
    }
  })
}

function hasPendingRequest(data: GroupData, userId: string | null) {
  if (!userId) return false
  return hasUserInValue(data.membershipRequests, userId) || hasUserInValue(data.pendingMembers, userId)
}

export default function GroupDetailScreen() {
  const router = useRouter()
  const { groupId, groupName } = useLocalSearchParams<{ groupId?: string; groupName?: string }>()
  const [group, setGroup] = useState<GroupData | null>(null)
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('Participante')
  const [hostName, setHostName] = useState('Anfitrión no disponible')
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [pendingRequestAction, setPendingRequestAction] = useState<string | null>(null)
  const [isEditingGroup, setIsEditingGroup] = useState(false)
  const [draftGroupName, setDraftGroupName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftLocation, setDraftLocation] = useState('')

  useEffect(() => {
    try {
      const { auth } = getFirebaseServices()
      return onAuthStateChanged(auth, (user) => {
        setUserId(user?.uid ?? null)
        setUserName(user?.displayName?.trim() || user?.email?.split('@')[0]?.trim() || 'Participante')
      })
    } catch {
      setUserId(null)
      return undefined
    }
  }, [])

  useEffect(() => {
    if (!groupId) {
      setIsLoading(false)
      return undefined
    }

    try {
      const { db } = getFirebaseServices()
      return onSnapshot(
        doc(db, 'groups', groupId),
        (snapshot) => {
          setGroup(snapshot.exists() ? snapshot.data() as GroupData : null)
          setIsLoading(false)
        },
        () => {
          setGroup(null)
          setIsLoading(false)
        },
      )
    } catch {
      setGroup(null)
      setIsLoading(false)
      return undefined
    }
  }, [groupId])

  useEffect(() => {
    try {
      const { db } = getFirebaseServices()
      return onSnapshot(collection(db, 'activities'), (snapshot) => {
        setActivities(snapshot.docs
          .map((item) => ({ id: item.id, data: item.data() as Record<string, unknown> }))
          .sort((left, right) => getRecordTime(right) - getRecordTime(left)))
      }, () => setActivities([]))
    } catch {
      setActivities([])
      return undefined
    }
  }, [])

  const detail = useMemo(() => {
    const data = group ?? {}
    const fallbackTitle = readString(groupName, 'Grupo sin título')

    return {
      category: readString(data.category, 'Grupo'),
      description: readString(data.description, readString(data.summary, 'Comunidad para organizar actividades compartidas.')),
      location: readString(data.location, 'Ubicación a definir'),
      members: getMemberCount(data),
      baseLocation: readString(data.locationName, readString(data.location, 'Ubicación a definir')),
      ownerId: getOwnerId(data),
      nextDate: readString(data.date, readString(data.schedule, 'Próximo encuentro a definir')),
      organizer: readString(data.organizerName, readString(data.createdByName, 'Organizador de Coincidir')),
      title: readString(data.name, readString(data.title, fallbackTitle)),
    }
  }, [group, groupName])

  useEffect(() => {
    let mounted = true
    const data = group ?? {}
    const localHostName = readString(data.displayName, readString(data.profileName, readString(data.organizerName, readString(data.createdByName, readString(data.creatorName)))))
    const ownerId = getOwnerId(data)

    if (localHostName) {
      setHostName(localHostName)
      return undefined
    }

    if (!ownerId) {
      setHostName('Anfitrión no disponible')
      return undefined
    }

    try {
      const { db } = getFirebaseServices()
      getDoc(doc(db, 'users', ownerId))
        .then((snapshot) => {
          if (!mounted) return
          const userData = snapshot.exists() ? snapshot.data() as Record<string, unknown> : null
          setHostName(readString(userData?.displayName, readString(userData?.profileName, readString(userData?.fullName, readString(userData?.name, 'Anfitrión no disponible')))))
        })
        .catch(() => {
          if (mounted) setHostName('Anfitrión no disponible')
        })
    } catch {
      setHostName('Anfitrión no disponible')
    }

    return () => {
      mounted = false
    }
  }, [group])

  useEffect(() => {
    if (!isEditingGroup) return

    setDraftGroupName(detail.title)
    setDraftDescription(detail.description)
    setDraftLocation(detail.baseLocation === 'Ubicación a definir' ? '' : detail.baseLocation)
  }, [detail.baseLocation, detail.description, detail.title, isEditingGroup])

  const isOwner = useMemo(() => isGroupOwner(group ?? {}, userId), [group, userId])
  const isMember = useMemo(() => isGroupMember(group ?? {}, userId), [group, userId])
  const groupActivities = useMemo(() => {
    const targetId = readString(groupId)
    const targetName = detail.title
    const targetSlug = getLocalGroupId(targetName)

    const now = Date.now()

    return activities
      .filter((activity) => {
        const meta = getActivityGroupMeta(activity.data)
        const activityGroupId = meta.groupId || getLocalGroupId(meta.groupName)
        const activityGroupName = meta.groupName

        return Boolean(
          (targetId && activityGroupId === targetId)
          || (targetSlug && activityGroupId === targetSlug)
          || (targetName && activityGroupName === targetName),
        )
      })
      .sort((left, right) => {
        const leftTime = getActivityStartTime(left.data)
        const rightTime = getActivityStartTime(right.data)
        const leftFuture = leftTime >= now
        const rightFuture = rightTime >= now

        if (leftFuture !== rightFuture) return leftFuture ? -1 : 1
        return leftFuture ? leftTime - rightTime : rightTime - leftTime
      })
  }, [activities, detail.title, groupId])

  const nextActivity = useMemo(() => {
    const now = Date.now()
    return groupActivities.find((activity) => getActivityStartTime(activity.data) >= now) ?? null
  }, [groupActivities])
  const pendingRequests = useMemo(() => getPendingRequests(group ?? {}), [group])
  const hasRequestedJoin = useMemo(() => hasPendingRequest(group ?? {}, userId), [group, userId])

  const requestJoinGroup = async () => {
    if (!groupId || !userId || !group || isOwner || isMember || hasRequestedJoin || isJoining) return

    setIsJoining(true)
    try {
      const { db } = getFirebaseServices()
      await updateDoc(doc(db, 'groups', groupId), {
        [`membershipRequests.${userId}`]: {
          name: userName,
          requestedAt: serverTimestamp(),
          status: 'pending',
        },
        updatedAt: serverTimestamp(),
      })
    } catch {
      Alert.alert('No pudimos enviar la solicitud', 'Intentá solicitar sumarte nuevamente en unos segundos.')
    } finally {
      setIsJoining(false)
    }
  }

  const acceptRequest = async (request: PendingRequest) => {
    if (!groupId || !isOwner || pendingRequestAction) return

    setPendingRequestAction(`accept:${request.id}`)
    try {
      const { db } = getFirebaseServices()
      await updateDoc(doc(db, 'groups', groupId), {
        [`joinedUsers.${request.id}`]: true,
        [`members.${request.id}`]: {
          joinedAt: serverTimestamp(),
          name: request.name,
          role: 'member',
        },
        [`membershipRequests.${request.id}`]: deleteField(),
        [`pendingMembers.${request.id}`]: deleteField(),
        membersCount: increment(1),
        updatedAt: serverTimestamp(),
      })
    } catch {
      Alert.alert('No pudimos aceptar', 'Intentá aceptar la solicitud nuevamente.')
    } finally {
      setPendingRequestAction(null)
    }
  }

  const rejectRequest = async (request: PendingRequest) => {
    if (!groupId || !isOwner || pendingRequestAction) return

    setPendingRequestAction(`reject:${request.id}`)
    try {
      const { db } = getFirebaseServices()
      await updateDoc(doc(db, 'groups', groupId), {
        [`membershipRequests.${request.id}`]: deleteField(),
        [`pendingMembers.${request.id}`]: deleteField(),
        updatedAt: serverTimestamp(),
      })
    } catch {
      Alert.alert('No pudimos rechazar', 'Intentá rechazar la solicitud nuevamente.')
    } finally {
      setPendingRequestAction(null)
    }
  }

  const saveGroupEdits = async () => {
    if (!groupId || !isOwner) return

    const cleanName = draftGroupName.trim()
    if (!cleanName) {
      Alert.alert('Nombre requerido', 'Ingresá un nombre para el grupo.')
      return
    }

    try {
      const { db } = getFirebaseServices()
      await updateDoc(doc(db, 'groups', groupId), {
        description: draftDescription.trim(),
        locationName: draftLocation.trim(),
        name: cleanName,
        updatedAt: serverTimestamp(),
      })
      setIsEditingGroup(false)
    } catch {
      Alert.alert('No pudimos guardar', 'Intentá editar el grupo nuevamente.')
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color="#006A32" />
        </View>
      </SafeAreaView>
    )
  }

  if (!group && !readString(groupName)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.missingTitle}>No encontramos el grupo</Text>
          <PressScale onPress={() => router.back()} style={styles.secondaryButton} scaleTo={0.97}>
            <Text style={styles.secondaryButtonText}>Volver</Text>
          </PressScale>
        </View>
      </SafeAreaView>
    )
  }

  const joinButtonText = hasRequestedJoin
    ? 'Solicitud enviada'
    : isMember
      ? 'Ya sos miembro'
      : 'Solicitar sumarme'
  const nextActivityTitle = nextActivity
    ? readString(nextActivity.data.name, readString(nextActivity.data.title, 'Actividad sin título'))
    : ''
  const nextActivityDate = nextActivity
    ? `${readString(nextActivity.data.date, 'Fecha a definir')}${readString(nextActivity.data.time) ? ` · ${readString(nextActivity.data.time)}` : ''}`
    : ''

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <PressScale accessibilityLabel="Volver" accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton} scaleTo={0.94}>
            <ArrowLeft color="#063C31" size={26} strokeWidth={2.4} />
          </PressScale>
          <Text style={styles.headerTitle}>Detalle de grupo</Text>
          <View style={styles.iconButton} />
        </View>

        <Image source={getCategoryImage({ category: 'Grupales', ...(group ?? {}) })} style={styles.heroImage} />

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.groupIcon}>
              <UsersRound color="#006A32" size={30} strokeWidth={2.2} />
            </View>
            <View style={styles.titleCopy}>
              <Text style={styles.title}>{detail.title}</Text>
              <Text style={styles.subtitle}>{detail.category}</Text>
            </View>
          </View>

          <InfoRow Icon={MapPin} label={detail.baseLocation} />
          <InfoRow Icon={CalendarDays} label={nextActivity ? `Próximo encuentro: ${nextActivityTitle}` : 'Sin encuentros próximos'} secondary={nextActivityDate} />
          <InfoRow Icon={UsersRound} label={`${detail.members} miembros`} />
          <InfoRow Icon={CalendarDays} label={`${groupActivities.length} actividades asociadas`} />
          <InfoRow Icon={UserRound} label={`Anfitrión: ${hostName}`} />

          <Text style={styles.description}>{detail.description}</Text>

          {isOwner ? (
            <PressScale onPress={() => setIsEditingGroup((current) => !current)} style={styles.editGroupButton} scaleTo={0.97}>
              <Text style={styles.editGroupButtonText}>{isEditingGroup ? 'Cerrar edición' : 'Editar grupo'}</Text>
            </PressScale>
          ) : null}

          {isOwner && isEditingGroup ? (
            <View style={styles.editGroupCard}>
              <TextInput
                onChangeText={setDraftGroupName}
                placeholder="Nombre del grupo"
                placeholderTextColor="#8A9691"
                style={styles.editGroupInput}
                value={draftGroupName}
              />
              <TextInput
                multiline
                onChangeText={setDraftDescription}
                placeholder="Descripción"
                placeholderTextColor="#8A9691"
                style={[styles.editGroupInput, styles.editGroupTextArea]}
                value={draftDescription}
              />
              <TextInput
                onChangeText={setDraftLocation}
                placeholder="Ubicación base"
                placeholderTextColor="#8A9691"
                style={styles.editGroupInput}
                value={draftLocation}
              />
              <PressScale onPress={saveGroupEdits} style={styles.editGroupSaveButton} scaleTo={0.97}>
                <Text style={styles.editGroupSaveText}>Guardar cambios</Text>
              </PressScale>
            </View>
          ) : null}

          <View style={[styles.memberStatus, isOwner ? styles.memberStatusOwner : isMember ? styles.memberStatusJoined : styles.memberStatusOpen]}>
            <UsersRound color={isOwner || isMember ? '#006A32' : '#4B348A'} size={17} strokeWidth={2.3} />
            <Text style={[styles.memberStatusText, isOwner || isMember ? styles.memberStatusTextJoined : styles.memberStatusTextOpen]}>
              {isOwner ? 'Sos anfitrión' : isMember ? 'Ya sos miembro' : hasRequestedJoin ? 'Solicitud enviada' : 'No sos miembro'}
            </Text>
          </View>

          {!isOwner ? (
            <PressScale
              disabled={!userId || isMember || hasRequestedJoin || isJoining}
              onPress={requestJoinGroup}
              style={[styles.primaryButton, (!userId || isMember || hasRequestedJoin) && styles.primaryButtonDisabled]}
              scaleTo={0.97}
            >
              {isJoining ? <ActivityIndicator color="#FFFFFF" /> : <Sprout color="#FFFFFF" size={20} strokeWidth={2.3} />}
              <Text style={styles.primaryButtonText}>{joinButtonText}</Text>
            </PressScale>
          ) : null}

          {isOwner && pendingRequests.length > 0 ? (
            <View style={styles.requestsBlock}>
              <Text style={styles.requestsTitle}>Solicitudes pendientes</Text>
              {pendingRequests.map((request) => (
                <View key={request.id} style={styles.requestRow}>
                  <Text numberOfLines={1} style={styles.requestName}>{request.name}</Text>
                  <View style={styles.requestActions}>
                    <PressScale disabled={Boolean(pendingRequestAction)} onPress={() => rejectRequest(request)} scaleTo={0.97} style={styles.rejectRequestButton}>
                      <Text style={styles.rejectRequestText}>Rechazar</Text>
                    </PressScale>
                    <PressScale disabled={Boolean(pendingRequestAction)} onPress={() => acceptRequest(request)} scaleTo={0.97} style={styles.acceptRequestButton}>
                      <Text style={styles.acceptRequestText}>Aceptar</Text>
                    </PressScale>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.groupActivitiesBlock}>
            <Text style={styles.groupActivitiesTitle}>Actividades del grupo</Text>
            {groupActivities.length > 0 ? (
              <View style={styles.groupActivitiesList}>
                {groupActivities.map((activity) => (
                  <PressScale
                    accessibilityRole="button"
                    key={activity.id}
                    onPress={() => router.push({ pathname: '/activity/[activityId]', params: { activityId: activity.id } })}
                    scaleTo={0.985}
                    style={styles.groupActivityItem}
                  >
                    <Text numberOfLines={1} style={styles.groupActivityTitle}>
                      {readString(activity.data.name, readString(activity.data.title, 'Actividad sin título'))}
                    </Text>
                    <Text numberOfLines={1} style={styles.groupActivityMeta}>
                      {readString(activity.data.date, 'Fecha a definir')}
                    </Text>
                  </PressScale>
                ))}
              </View>
            ) : (
              <Text style={styles.groupActivitiesEmpty}>Este grupo todavía no tiene actividades asociadas.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

type InfoRowProps = {
  Icon: typeof MapPin
  label: string
  secondary?: string
}

function InfoRow({ Icon, label, secondary }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Icon color="#006A32" size={20} strokeWidth={2.2} />
      <View style={styles.infoCopy}>
        <Text style={styles.infoText}>{label}</Text>
        {secondary ? <Text style={styles.infoSecondary}>{secondary}</Text> : null}
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
  heroImage: {
    height: 210,
    width: '100%',
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
  groupIcon: {
    alignItems: 'center',
    backgroundColor: '#EFF6E9',
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  titleCopy: {
    flex: 1,
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
    color: '#596A65',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 2,
  },
  description: {
    color: '#193F37',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 22,
    marginTop: 4,
  },
  editGroupButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F5F0FF',
    borderColor: '#D9CBF6',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 42,
    paddingHorizontal: 16,
  },
  editGroupButtonText: {
    color: '#4B348A',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  editGroupCard: {
    backgroundColor: '#FAFAF8',
    borderColor: '#E7E7E1',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginTop: 12,
    padding: 12,
  },
  editGroupInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE6DE',
    borderRadius: 12,
    borderWidth: 1,
    color: '#071D19',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  editGroupTextArea: {
    minHeight: 86,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  editGroupSaveButton: {
    alignItems: 'center',
    backgroundColor: '#006A32',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
  },
  editGroupSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  memberStatus: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  memberStatusJoined: {
    backgroundColor: '#EFF8F0',
    borderColor: '#B7DC9D',
  },
  memberStatusOpen: {
    backgroundColor: '#F5F0FF',
    borderColor: '#D9CBF6',
  },
  memberStatusOwner: {
    backgroundColor: '#EFF8F0',
    borderColor: '#B7DC9D',
  },
  memberStatusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
  },
  memberStatusTextJoined: {
    color: '#006A32',
  },
  memberStatusTextOpen: {
    color: '#4B348A',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#006A32',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    height: 52,
    justifyContent: 'center',
    marginTop: 22,
  },
  primaryButtonDisabled: {
    backgroundColor: '#7CA68B',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  requestsBlock: {
    backgroundColor: '#F8FAF6',
    borderColor: '#DDEAD7',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginTop: 18,
    padding: 14,
  },
  requestsTitle: {
    color: '#063C31',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  requestRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  requestName: {
    color: '#071D19',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rejectRequestButton: {
    alignItems: 'center',
    borderColor: '#D95454',
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  rejectRequestText: {
    color: '#B63232',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  acceptRequestButton: {
    alignItems: 'center',
    backgroundColor: '#006A32',
    borderRadius: 10,
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  acceptRequestText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  groupActivitiesBlock: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 20,
    padding: 16,
    ...shadow,
  },
  groupActivitiesTitle: {
    color: '#063C31',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  groupActivitiesList: {
    gap: 10,
  },
  groupActivityItem: {
    backgroundColor: '#F8FAF6',
    borderColor: '#DDEAD7',
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  groupActivityTitle: {
    color: '#071D19',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 20,
  },
  groupActivityMeta: {
    color: '#596A65',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 2,
  },
  groupActivitiesEmpty: {
    color: '#596A65',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
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
    borderColor: '#006A32',
    borderRadius: 14,
    borderWidth: 1.5,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  secondaryButtonText: {
    color: '#006A32',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
})

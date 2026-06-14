import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import { arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, increment, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Image as ImageIcon,
  MapPin,
  Sprout,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react-native'

import { PressScale } from '../../components/home/PressScale'
import { GroupAvatar } from '../../components/groups/GroupAvatar'
import { getLocalGroupId } from '../../constants/localGroups'
import { getFirebaseServices } from '../../firebaseConfig'
import { readRemoteGroupPhotoUrl, uploadGroupPhoto } from '../../lib/groupPhotos'
import { createNotification, deletePendingGroupJoinRequestNotifications } from '../../lib/notifications'
import { getActivityGroupMeta } from '../../utils/activityGroups'
import { requireVerifiedParticipation } from '../../utils/authParticipation'
import { getCategoryImage } from '../../utils/categoryImages'
import {
  formatGroupMemberCount,
  getGroupMemberCount,
  getGroupMemberIds,
  getGroupOwnerId,
  hasPendingGroupRequest,
  isGroupMember as isGroupMemberByData,
} from '../../utils/groupMembership'

type GroupData = Record<string, unknown>
type ActivityRecord = {
  id: string
  data: Record<string, unknown>
}
type PendingRequest = {
  id: string
  name: string
}

const groupPhotoPickerOptions: ImagePicker.ImagePickerOptions = {
  allowsEditing: true,
  aspect: [16, 9],
  mediaTypes: ['images'],
  quality: 0.85,
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
  return getGroupOwnerId(data)
}

function isGroupOwner(data: GroupData, userId: string | null) {
  if (!userId) return false
  return getOwnerId(data) === userId
}

function isGroupMember(data: GroupData, userId: string | null) {
  return isGroupMemberByData(data, userId)
}

function getPendingRequests(data: GroupData) {
  const requests = data.membershipRequests ?? data.pendingMembers
  if (!requests || typeof requests !== 'object' || Array.isArray(requests)) return []
  const memberIds = new Set(getGroupMemberIds(data))

  return Object.entries(requests).map(([id, value]) => {
    const requestData = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    return {
      id,
      name: readString(requestData.name, readString(requestData.displayName, 'Usuario sin nombre')),
    }
  }).filter((request) => !memberIds.has(request.id))
}

function hasPendingRequest(data: GroupData, userId: string | null) {
  return hasPendingGroupRequest(data, userId)
}

function showGroupRequestFeedback(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT)
    return
  }

  Alert.alert(message)
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error) {
    const data = error as { code?: unknown; message?: unknown }
    const code = typeof data.code === 'string' ? data.code : ''
    const message = typeof data.message === 'string' ? data.message : ''
    return [code, message].filter(Boolean).join(': ') || String(error)
  }

  return String(error)
}

export default function GroupDetailScreen() {
  const router = useRouter()
  const { groupId, groupName } = useLocalSearchParams<{ groupId?: string; groupName?: string }>()
  const safeBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/home')
    }
  }, [router])
  const [group, setGroup] = useState<GroupData | null>(null)
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('Participante')
  const [hostName, setHostName] = useState('Anfitrión no disponible')
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [isCancelingJoinRequest, setIsCancelingJoinRequest] = useState(false)
  const [isLeavingGroup, setIsLeavingGroup] = useState(false)
  const [isDeletingGroup, setIsDeletingGroup] = useState(false)
  const [pendingRequestAction, setPendingRequestAction] = useState<string | null>(null)
  const [isEditingGroup, setIsEditingGroup] = useState(false)
  const [draftGroupName, setDraftGroupName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftLocation, setDraftLocation] = useState('')
  const [draftGroupPhotoAsset, setDraftGroupPhotoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [draftGroupPhotoPreviewUri, setDraftGroupPhotoPreviewUri] = useState('')
  const [isRemovingGroupPhoto, setIsRemovingGroupPhoto] = useState(false)
  const [isSavingGroupEdits, setIsSavingGroupEdits] = useState(false)
  const [deleteGroupError, setDeleteGroupError] = useState('')

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
      members: getGroupMemberCount(data),
      baseLocation: readString(data.locationName, readString(data.address, readString(data.location, 'Ubicación a definir'))),
      ownerId: getOwnerId(data),
      nextDate: readString(data.date, readString(data.schedule, 'Próximo encuentro a definir')),
      organizer: readString(data.ownerName, readString(data.organizerName, readString(data.createdByName, 'Organizador de Coincidir'))),
      photoUrl: readRemoteGroupPhotoUrl(data),
      title: readString(data.name, readString(data.title, fallbackTitle)),
    }
  }, [group, groupName])

  useEffect(() => {
    let mounted = true
    const data = group ?? {}
    const localHostName = readString(data.ownerName, readString(data.displayName, readString(data.profileName, readString(data.organizerName, readString(data.createdByName, readString(data.creatorName))))))
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
    setDraftGroupPhotoAsset(null)
    setDraftGroupPhotoPreviewUri(detail.photoUrl)
    setIsRemovingGroupPhoto(false)
  }, [detail.baseLocation, detail.description, detail.photoUrl, detail.title, isEditingGroup])

  const isLegacyLocalGroup = !group && Boolean(readString(groupName))
  const isOwner = useMemo(() => isGroupOwner(group ?? {}, userId), [group, userId])
  const isMember = useMemo(() => isOwner || isGroupMember(group ?? {}, userId), [group, isOwner, userId])

  useEffect(() => {
    if (!__DEV__) return

    const data = group ?? {}
    console.log('[GROUP MEMBERSHIP DEBUG]', {
      currentUserId: userId,
      currentUserUid: userId,
      groupId,
      groupName: readString(data.name, readString(data.title, groupName ?? '')),
      isMember,
      isOwner,
      joinedUsers: data.joinedUsers,
      memberIds: data.memberIds,
      members: data.members,
      memberProfiles: data.memberProfiles,
      normalizedMemberIds: getGroupMemberIds(data),
      ownerId: getOwnerId(data),
      legacyOwnerCandidates: {
        createdBy: data.createdBy,
        createdById: data.createdById,
        creatorId: data.creatorId,
        organizerId: data.organizerId,
        userId: data.userId,
      },
      participants: data.participants,
    })
  }, [group, groupId, groupName, isMember, isOwner, userId])

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
      const { auth, db } = getFirebaseServices()
      if (!(await requireVerifiedParticipation(auth))) return
      await updateDoc(doc(db, 'groups', groupId), {
        [`membershipRequests.${userId}`]: {
          name: userName,
          requestedAt: serverTimestamp(),
          status: 'pending',
        },
        updatedAt: serverTimestamp(),
      })
      if (detail.ownerId) {
        await createNotification({
          body: `${userName} quiere sumarse al grupo ${detail.title}.`,
          groupId,
          groupName: detail.title,
          requesterId: userId,
          senderId: userId,
          title: 'Nueva solicitud de grupo',
          type: 'group_join_request',
          userId: detail.ownerId,
        })
      }
    } catch {
      Alert.alert('No pudimos enviar la solicitud', 'Intentá solicitar sumarte nuevamente en unos segundos.')
    } finally {
      setIsJoining(false)
    }
  }

  const cancelJoinRequest = async () => {
    if (!groupId || !userId || !group || isOwner || isMember || !hasRequestedJoin || isCancelingJoinRequest) return

    if (Platform.OS === 'web') {
      console.log('[WEB GROUP REQUEST CANCEL START]', { groupId, userId })
    }
    setIsCancelingJoinRequest(true)
    try {
      const { db } = getFirebaseServices()
      await updateDoc(doc(db, 'groups', groupId), {
        [`membershipRequests.${userId}`]: deleteField(),
        [`pendingMembers.${userId}`]: deleteField(),
        updatedAt: serverTimestamp(),
      })

      await deletePendingGroupJoinRequestNotifications({
        groupId,
        requesterId: userId,
        userId: detail.ownerId || undefined,
      })
      if (Platform.OS === 'web') {
        console.log('[WEB GROUP REQUEST CANCEL SUCCESS]', { groupId, userId })
      } else {
        showGroupRequestFeedback('Solicitud cancelada')
      }
    } catch (error) {
      if (Platform.OS === 'web') {
        console.log('[WEB GROUP REQUEST CANCEL ERROR]', { groupId, userId, error: getErrorMessage(error) })
      } else {
        Alert.alert('No pudimos cancelar la solicitud', 'Intentá cancelar tu solicitud nuevamente en unos segundos.')
      }
    } finally {
      setIsCancelingJoinRequest(false)
    }
  }

  const leaveGroup = async () => {
    if (!groupId || !userId || !group || isOwner || !isMember || isLeavingGroup) return

    setIsLeavingGroup(true)
    try {
      const { db } = getFirebaseServices()
      const groupData = group ?? {}
      const updates: Record<string, unknown> = {
        [`joinedUsers.${userId}`]: deleteField(),
        [`memberProfiles.${userId}`]: deleteField(),
        [`membershipRequests.${userId}`]: deleteField(),
        [`pendingMembers.${userId}`]: deleteField(),
        updatedAt: serverTimestamp(),
      }

      if (Array.isArray(groupData.memberIds)) {
        updates.memberIds = arrayRemove(userId)
      } else if (groupData.memberIds && typeof groupData.memberIds === 'object') {
        updates[`memberIds.${userId}`] = deleteField()
      }

      if (Array.isArray(groupData.members)) {
        updates.members = arrayRemove(userId)
      } else if (groupData.members && typeof groupData.members === 'object') {
        updates[`members.${userId}`] = deleteField()
      }

      if (readNumber(groupData.memberCount, -1) > 0) updates.memberCount = increment(-1)
      if (readNumber(groupData.membersCount, -1) > 0) updates.membersCount = increment(-1)

      await updateDoc(doc(db, 'groups', groupId), updates)
      showGroupRequestFeedback('Saliste del grupo')
    } catch {
      Alert.alert('No pudimos actualizar el grupo', 'Intentá dejar el grupo nuevamente en unos segundos.')
    } finally {
      setIsLeavingGroup(false)
    }
  }

  const confirmLeaveGroup = () => {
    if (isOwner || !isMember || isLeavingGroup) return

    Alert.alert(
      '¿Querés dejar este grupo?',
      'Vas a dejar de figurar como miembro y podrás pedir sumarte nuevamente más adelante.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Dejar grupo',
          style: 'destructive',
          onPress: () => {
            void leaveGroup()
          },
        },
      ],
    )
  }

  const confirmCancelJoinRequest = () => {
    if (Platform.OS === 'web') {
      console.log('[WEB GROUP REQUEST CANCEL PRESS]', { groupId, userId })
    }
    if (isOwner || isMember || !hasRequestedJoin || isCancelingJoinRequest) return

    if (Platform.OS === 'web') {
      void cancelJoinRequest()
      return
    }

    Alert.alert(
      '¿Querés cancelar tu solicitud para unirte a este grupo?',
      undefined,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancelar solicitud',
          style: 'destructive',
          onPress: () => {
            void cancelJoinRequest()
          },
        },
      ],
    )
  }

  const acceptRequest = async (request: PendingRequest) => {
    if (!groupId || !isOwner || pendingRequestAction) return

    setPendingRequestAction(`accept:${request.id}`)
    try {
      const { auth, db } = getFirebaseServices()
      if (!(await requireVerifiedParticipation(auth))) return
      await updateDoc(doc(db, 'groups', groupId), {
        [`joinedUsers.${request.id}`]: true,
        [`memberProfiles.${request.id}`]: {
          joinedAt: serverTimestamp(),
          name: request.name,
          role: 'member',
        },
        [`membershipRequests.${request.id}`]: deleteField(),
        [`pendingMembers.${request.id}`]: deleteField(),
        memberIds: arrayUnion(request.id),
        members: arrayUnion(request.id),
        memberCount: increment(1),
        membersCount: increment(1),
        updatedAt: serverTimestamp(),
      })
      await createNotification({
        body: `Ya sos miembro de ${detail.title}.`,
        groupId,
        groupName: detail.title,
        senderId: userId ?? undefined,
        title: 'Te aceptaron en un grupo',
        type: 'group_join_accepted',
        userId: request.id,
      })
      showGroupRequestFeedback('Miembro agregado correctamente')
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
      showGroupRequestFeedback('Solicitud rechazada')
    } catch {
      Alert.alert('No pudimos rechazar', 'Intentá rechazar la solicitud nuevamente.')
    } finally {
      setPendingRequestAction(null)
    }
  }

  const chooseGroupPhotoFromLibrary = async () => {
    if (!isOwner || isSavingGroupEdits) return

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false)
      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos para elegir una imagen del grupo.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync(groupPhotoPickerOptions)
      if (result.canceled) return

      const asset = result.assets?.[0]
      if (!asset?.uri) {
        Alert.alert('No pudimos cargar la foto', 'La imagen seleccionada no tiene un archivo válido.')
        return
      }

      setDraftGroupPhotoAsset(asset)
      setDraftGroupPhotoPreviewUri(asset.uri)
      setIsRemovingGroupPhoto(false)
    } catch (error) {
      if (__DEV__) console.warn('[GroupDetail] group photo picker error', error)
      Alert.alert('No pudimos abrir la galería', 'Revisá los permisos de fotos e intentá nuevamente.')
    }
  }

  const removeDraftGroupPhoto = () => {
    setDraftGroupPhotoAsset(null)
    setDraftGroupPhotoPreviewUri('')
    setIsRemovingGroupPhoto(Boolean(detail.photoUrl))
  }

  const saveGroupEdits = async () => {
    if (!groupId || !isOwner || isSavingGroupEdits) return

    const cleanName = draftGroupName.trim()
    if (!cleanName) {
      Alert.alert('Nombre requerido', 'Ingresá un nombre para el grupo.')
      return
    }

    setIsSavingGroupEdits(true)
    try {
      const { auth, db } = getFirebaseServices()
      if (!(await requireVerifiedParticipation(auth))) return
      const payload: Record<string, unknown> = {
        description: draftDescription.trim(),
        locationName: draftLocation.trim(),
        name: cleanName,
        updatedAt: serverTimestamp(),
      }

      if (draftGroupPhotoAsset) {
        const remotePhotoUrl = await uploadGroupPhoto(groupId, draftGroupPhotoAsset)
        payload.imageUrl = remotePhotoUrl
        payload.photoURL = remotePhotoUrl
      } else if (isRemovingGroupPhoto) {
        payload.imageUrl = deleteField()
        payload.photoURL = deleteField()
        payload.photoUrl = deleteField()
        payload.coverUrl = deleteField()
        payload.coverURL = deleteField()
        payload.coverImage = deleteField()
      }

      await updateDoc(doc(db, 'groups', groupId), payload)
      setDraftGroupPhotoAsset(null)
      setIsRemovingGroupPhoto(false)
      setIsEditingGroup(false)
    } catch (error) {
      if (__DEV__) console.warn('[GroupDetail] error saving group edits', error)
      Alert.alert('No pudimos guardar', 'Intentá editar el grupo nuevamente.')
    } finally {
      setIsSavingGroupEdits(false)
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
          <PressScale onPress={safeBack} style={styles.secondaryButton} scaleTo={0.97}>
            <Text style={styles.secondaryButtonText}>Volver</Text>
          </PressScale>
        </View>
      </SafeAreaView>
    )
  }

  const nextActivityTitle = nextActivity
    ? readString(nextActivity.data.name, readString(nextActivity.data.title, 'Actividad sin título'))
    : ''
  const nextActivityDate = nextActivity
    ? `${readString(nextActivity.data.date, 'Fecha a definir')}${readString(nextActivity.data.time) ? ` · ${readString(nextActivity.data.time)}` : ''}`
    : ''

  const displayedMemberCount = isOwner ? Math.max(detail.members, 1) : detail.members
  const displayedMemberText = formatGroupMemberCount(displayedMemberCount)
  const displayHostName = isLegacyLocalGroup ? 'Anfitrión no disponible' : hostName
  const membershipStatusText = isOwner
    ? 'Organizador'
    : isMember
      ? 'Miembro'
      : hasRequestedJoin
        ? 'Solicitud enviada'
        : 'No sos miembro'
  const heroSource = detail.photoUrl
    ? { uri: detail.photoUrl }
    : getCategoryImage({ category: 'Grupales', ...(group ?? {}) })
  const createGroupActivity = () => {
    router.push({
      pathname: '/(tabs)/crear',
      params: {
        groupId: groupId || getLocalGroupId(detail.title),
        groupName: detail.title,
        groupContext: '1',
        kind: 'group',
      },
    })
  }
  const deleteGroupNow = async () => {
    if (!groupId || !userId || isDeletingGroup) return

    if (Platform.OS === 'web') {
      console.log('[WEB DELETE GROUP START]', { groupId, userId })
    }
    setDeleteGroupError('')
    setIsDeletingGroup(true)
    try {
      const { db } = getFirebaseServices()
      const groupRef = doc(db, 'groups', groupId)
      const snapshot = await getDoc(groupRef)

      if (!snapshot.exists()) {
        if (Platform.OS === 'web') {
          const errorMessage = 'Grupo no disponible: No encontramos este grupo.'
          console.log('[WEB DELETE GROUP ERROR]', { groupId, userId, error: errorMessage })
          setDeleteGroupError(errorMessage)
          return
        }
        Alert.alert('Grupo no disponible', 'No encontramos este grupo.')
        router.replace('/home')
        return
      }

      const latestGroup = snapshot.data() as GroupData
      const latestOwnerId = getOwnerId(latestGroup)
      if (__DEV__) {
        console.log('[GROUP DELETE OWNERSHIP DEBUG]', {
          currentUserUid: userId,
          groupId,
          members: latestGroup.members,
          name: readString(latestGroup.name, readString(latestGroup.title)),
          ownerId: latestOwnerId,
        })
      }

      if (latestOwnerId !== userId) {
        if (Platform.OS === 'web') {
          console.log('[WEB DELETE GROUP ERROR]', { groupId, userId, error: `ownerId=${latestOwnerId || 'sin ownerId'}, currentUser=${userId}` })
          setDeleteGroupError(`No podés eliminar este grupo: ownerId=${latestOwnerId || 'sin ownerId'}, currentUser=${userId}`)
          return
        }
        Alert.alert('No podés eliminar este grupo', 'Solo el organizador puede eliminarlo.')
        return
      }

      await Promise.all(groupActivities.map((activity) => updateDoc(doc(db, 'activities', activity.id), {
        groupId: deleteField(),
        groupName: deleteField(),
        visibility: 'public',
        'additionalSettings.groupId': deleteField(),
        'additionalSettings.groupName': deleteField(),
        'additionalSettings.visibility': 'public',
        'additionalSettings.privacy': 'Pública',
        updatedAt: serverTimestamp(),
      })))

      await deleteDoc(groupRef)

      if (Platform.OS === 'web') {
        console.log('[WEB DELETE GROUP SUCCESS]', { groupId, userId })
        router.canGoBack() ? router.back() : router.replace('/home')
        return
      }
      Alert.alert('Grupo eliminado', 'El grupo fue eliminado correctamente.', [
        { text: 'OK', onPress: () => (router.canGoBack() ? router.back() : router.replace('/home')) },
      ])
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      if (Platform.OS === 'web') {
        console.log('[WEB DELETE GROUP ERROR]', { groupId, userId, error: errorMessage })
        setDeleteGroupError(errorMessage)
        return
      }
      Alert.alert('No pudimos eliminar el grupo', 'Intentá nuevamente en unos segundos.')
    } finally {
      setIsDeletingGroup(false)
    }
  }

  const confirmDeleteGroup = () => {
    if (Platform.OS === 'web') {
      console.log('[WEB DELETE GROUP PRESS]', { groupId, userId })
    }
    if (!isOwner || isDeletingGroup) return

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined'
        ? window.confirm('¿Eliminar grupo? Esta acción eliminará el grupo y no se puede deshacer.')
        : false

      if (confirmed) {
        console.log('[WEB DELETE GROUP CONFIRM]', { groupId, userId })
        void deleteGroupNow()
      }
      return
    }

    Alert.alert(
      '¿Eliminar grupo?',
      'Esta acción eliminará el grupo y no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void deleteGroupNow()
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={Platform.OS === 'web' ? styles.webGroupContainer : undefined}>
          <View style={styles.topBar}>
            <PressScale accessibilityLabel="Volver" accessibilityRole="button" onPress={safeBack} style={styles.iconButton} scaleTo={0.94}>
              <ArrowLeft color="#063C31" size={26} strokeWidth={2.4} />
            </PressScale>
            <Text style={styles.headerTitle}>Detalle de grupo</Text>
            <View style={styles.iconButton} />
          </View>

          <Image source={heroSource} style={styles.heroImage} />

          <View style={styles.content}>
          <View style={styles.titleRow}>
            <GroupAvatar groupName={detail.title} imageUrl={detail.photoUrl} size={66} />
            <View style={styles.titleCopy}>
              <Text style={styles.title}>{detail.title}</Text>
              <View style={styles.titleMembersRow}>
                <UsersRound color="#17803C" size={16} strokeWidth={2.4} />
                <Text style={styles.titleMembersText}>{displayedMemberText}</Text>
              </View>
              <Text style={styles.subtitle}>{detail.category}</Text>
            </View>
          </View>

          <InfoRow Icon={MapPin} label={detail.baseLocation} />
          <InfoRow Icon={CalendarDays} label={nextActivity ? `Próximo encuentro: ${nextActivityTitle}` : 'Sin encuentros próximos'} secondary={nextActivityDate} />
          <InfoRow Icon={CalendarDays} label={`${groupActivities.length} actividades asociadas`} />
          <InfoRow Icon={UserRound} label={`Anfitrión: ${displayHostName}`} />

          <Text style={styles.description}>{detail.description}</Text>

          {isOwner ? (
            <View style={styles.ownerActions}>
              <PressScale onPress={() => setIsEditingGroup((current) => !current)} style={styles.editGroupButton} scaleTo={0.97}>
                <Text style={styles.editGroupButtonText}>{isEditingGroup ? 'Cerrar edición' : 'Editar grupo'}</Text>
              </PressScale>
              <PressScale onPress={createGroupActivity} style={styles.editGroupButton} scaleTo={0.97}>
                <Text style={styles.editGroupButtonText}>Crear actividad para este grupo</Text>
              </PressScale>
              <View style={styles.editGroupButton}>
                <Text style={styles.editGroupButtonText}>Gestionar solicitudes ({pendingRequests.length})</Text>
              </View>
              <PressScale
                disabled={isDeletingGroup}
                onPress={confirmDeleteGroup}
                style={[styles.editGroupButton, styles.deleteGroupButton]}
                scaleTo={0.97}
              >
                {isDeletingGroup ? (
                  <ActivityIndicator color="#B42318" size="small" />
                ) : (
                  <>
                    <Trash2 color="#B42318" size={17} strokeWidth={2.4} />
                    <Text style={styles.deleteGroupButtonText}>Eliminar grupo</Text>
                  </>
                )}
              </PressScale>
            </View>
          ) : null}

          {deleteGroupError ? (
            <Text accessibilityRole="alert" style={styles.deleteGroupError}>{deleteGroupError}</Text>
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
              <PressScale
                accessibilityRole="button"
                disabled={isSavingGroupEdits}
                onPress={chooseGroupPhotoFromLibrary}
                style={styles.groupPhotoPicker}
                scaleTo={0.985}
              >
                {draftGroupPhotoPreviewUri ? (
                  <>
                    <Image resizeMode="cover" source={{ uri: draftGroupPhotoPreviewUri }} style={styles.groupPhotoPreview} />
                    <View style={styles.groupPhotoChangeChip}>
                      <ImageIcon color="#4B348A" size={17} strokeWidth={2.4} />
                      <Text style={styles.groupPhotoActionText}>Cambiar foto</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.groupPhotoPickerContent}>
                    <View style={styles.groupPhotoIcon}>
                      <ImageIcon color="#4B348A" size={23} strokeWidth={2.4} />
                    </View>
                    <Text style={styles.groupPhotoTitle}>Foto del grupo</Text>
                    <Text style={styles.groupPhotoActionText}>Elegir de la galería</Text>
                  </View>
                )}
              </PressScale>
              {draftGroupPhotoPreviewUri ? (
                <PressScale
                  accessibilityRole="button"
                  disabled={isSavingGroupEdits}
                  onPress={removeDraftGroupPhoto}
                  style={styles.groupPhotoRemoveButton}
                  scaleTo={0.97}
                >
                  <Trash2 color="#B42318" size={17} strokeWidth={2.4} />
                  <Text style={styles.groupPhotoRemoveText}>Eliminar foto</Text>
                </PressScale>
              ) : null}
              <PressScale
                disabled={isSavingGroupEdits}
                onPress={saveGroupEdits}
                style={[styles.editGroupSaveButton, isSavingGroupEdits && styles.editGroupSaveButtonDisabled]}
                scaleTo={0.97}
              >
                {isSavingGroupEdits ? <ActivityIndicator color="#3B5F4A" /> : <Text style={styles.editGroupSaveText}>Guardar cambios</Text>}
              </PressScale>
            </View>
          ) : null}

          <View style={[styles.memberStatus, isOwner ? styles.memberStatusOwner : isMember ? styles.memberStatusJoined : styles.memberStatusOpen]}>
            <UsersRound color={isOwner || isMember ? '#006A32' : '#4B348A'} size={17} strokeWidth={2.3} />
            <Text style={[styles.memberStatusText, isOwner || isMember ? styles.memberStatusTextJoined : styles.memberStatusTextOpen]}>
              {membershipStatusText}
            </Text>
          </View>

          {!isOwner && !isMember && !hasRequestedJoin ? (
            <PressScale
              accessibilityLabel="Ser miembro"
              accessibilityRole="button"
              disabled={!userId || isJoining}
              onPress={requestJoinGroup}
              style={[styles.primaryButton, (!userId || isJoining) && styles.primaryButtonDisabled]}
              scaleTo={0.97}
            >
              {isJoining ? <ActivityIndicator color="#006A32" /> : <Sprout color="#006A32" size={20} strokeWidth={2.3} />}
              <Text style={styles.primaryButtonText}>+ Ser miembro</Text>
            </PressScale>
          ) : null}

          {!isOwner && !isMember && hasRequestedJoin ? (
            <>
              <Text style={styles.membershipPendingText}>El organizador todavía no aprobó tu solicitud.</Text>
              <PressScale
                accessibilityLabel="Cancelar solicitud"
                accessibilityRole="button"
                disabled={isCancelingJoinRequest}
                onPress={confirmCancelJoinRequest}
                style={[styles.cancelRequestButton, styles.webInteractiveButton, isCancelingJoinRequest && styles.primaryButtonDisabled]}
                scaleTo={0.97}
              >
                {isCancelingJoinRequest ? <ActivityIndicator color="#B63232" /> : <X color="#B63232" size={20} strokeWidth={2.6} />}
                <Text style={styles.cancelRequestButtonText}>Cancelar solicitud</Text>
              </PressScale>
            </>
          ) : null}

          {!isOwner && isMember ? (
            <PressScale
              accessibilityLabel="Dejar grupo"
              accessibilityRole="button"
              disabled={isLeavingGroup}
              onPress={confirmLeaveGroup}
              style={[styles.leaveGroupButton, isLeavingGroup && styles.primaryButtonDisabled]}
              scaleTo={0.97}
            >
              {isLeavingGroup ? <ActivityIndicator color="#B63232" /> : <X color="#B63232" size={20} strokeWidth={2.6} />}
              <Text style={styles.leaveGroupButtonText}>Dejar grupo</Text>
            </PressScale>
          ) : null}

          {isOwner && pendingRequests.length > 0 ? (
            <View style={styles.requestsBlock}>
              <Text style={styles.requestsTitle}>Solicitudes para unirse</Text>
              {pendingRequests.map((request) => (
                <View key={request.id} style={styles.requestRow}>
                  <View style={styles.requestCopy}>
                    <Text style={styles.requestName}>{request.name}</Text>
                    <Text style={styles.requestSubtitle}>Quiere sumarse al grupo</Text>
                  </View>
                  <View style={styles.requestActions}>
                    <Pressable
                      accessibilityLabel={`Aceptar solicitud de ${request.name}`}
                      accessibilityRole="button"
                      disabled={Boolean(pendingRequestAction)}
                      onPress={() => acceptRequest(request)}
                      style={({ pressed }) => [
                        styles.requestButton,
                        styles.acceptRequestButton,
                        pressed && styles.requestButtonPressed,
                        Boolean(pendingRequestAction) && styles.requestButtonDisabled,
                      ]}
                    >
                      {pendingRequestAction === `accept:${request.id}` ? (
                        <ActivityIndicator color="#006A32" />
                      ) : (
                        <>
                          <Check color="#006A32" size={17} strokeWidth={2.8} />
                          <Text style={styles.acceptRequestText}>Aceptar</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Rechazar solicitud de ${request.name}`}
                      accessibilityRole="button"
                      disabled={Boolean(pendingRequestAction)}
                      onPress={() => rejectRequest(request)}
                      style={({ pressed }) => [
                        styles.requestButton,
                        styles.rejectRequestButton,
                        pressed && styles.requestButtonPressed,
                        Boolean(pendingRequestAction) && styles.requestButtonDisabled,
                      ]}
                    >
                      {pendingRequestAction === `reject:${request.id}` ? (
                        <ActivityIndicator color="#B63232" />
                      ) : (
                        <>
                          <X color="#B63232" size={17} strokeWidth={2.8} />
                          <Text style={styles.rejectRequestText}>Rechazar</Text>
                        </>
                      )}
                    </Pressable>
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
  webGroupContainer: {
    alignSelf: 'center',
    maxWidth: 950,
    width: '100%',
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
  titleMembersRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  titleMembersText: {
    color: '#2F6B58',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
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
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 42,
    paddingHorizontal: 16,
  },
  ownerActions: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  editGroupButtonText: {
    color: '#4B348A',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  deleteGroupButton: {
    backgroundColor: '#FFF4F4',
    borderColor: '#F2B8B5',
  },
  deleteGroupButtonText: {
    color: '#B42318',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  deleteGroupError: {
    color: '#B42318',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
    marginTop: 10,
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
  groupPhotoPicker: {
    alignItems: 'center',
    backgroundColor: '#F7F3FF',
    borderColor: '#E2D4FA',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 150,
    overflow: 'hidden',
  },
  groupPhotoPreview: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
    width: '100%',
  },
  groupPhotoPickerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  groupPhotoChangeChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: 'rgba(217,200,244,0.9)',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 12,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    right: 12,
  },
  groupPhotoIcon: {
    alignItems: 'center',
    backgroundColor: '#EFE7FA',
    borderColor: '#D9C8F4',
    borderRadius: 999,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  groupPhotoTitle: {
    color: '#193F37',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
    marginTop: 8,
  },
  groupPhotoActionText: {
    color: '#4B348A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 3,
  },
  groupPhotoRemoveButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 2,
  },
  groupPhotoRemoveText: {
    color: '#B42318',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
  },
  editGroupSaveButton: {
    alignItems: 'center',
    backgroundColor: '#006A32',
    borderColor: '#005229',
    borderWidth: 1,
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    marginTop: 2,
    width: '100%',
  },
  editGroupSaveButtonDisabled: {
    backgroundColor: '#E8F1EA',
    borderColor: '#B9D2C0',
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
    backgroundColor: '#EAF7E7',
    borderColor: '#B7DC9D',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 52,
    justifyContent: 'center',
    marginTop: 22,
  },
  primaryButtonDisabled: {
    opacity: 0.62,
  },
  primaryButtonText: {
    color: '#006A32',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  membershipPendingText: {
    color: '#596A65',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: -2,
  },
  cancelRequestButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FFF4F4',
    borderColor: '#D95454',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  webInteractiveButton: Platform.select({
    web: {
      pointerEvents: 'auto',
      position: 'relative',
      zIndex: 20,
    },
    default: {},
  }),
  cancelRequestButtonText: {
    color: '#B63232',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  leaveGroupButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FFF4F4',
    borderColor: '#D95454',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  leaveGroupButtonText: {
    color: '#B63232',
    fontSize: 15,
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
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  requestCopy: {
    minWidth: 0,
  },
  requestName: {
    color: '#071D19',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 19,
  },
  requestSubtitle: {
    color: '#596A65',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  requestButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexBasis: 0,
    flexDirection: 'row',
    flexGrow: 1,
    flex: 1,
    gap: 7,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 128,
    paddingHorizontal: 12,
  },
  requestButtonDisabled: {
    opacity: 0.58,
  },
  requestButtonPressed: {
    opacity: 0.84,
  },
  rejectRequestButton: {
    backgroundColor: '#FFF4F4',
    borderColor: '#D95454',
  },
  rejectRequestText: {
    color: '#B63232',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  acceptRequestButton: {
    backgroundColor: '#EEF8F0',
    borderColor: '#006A32',
  },
  acceptRequestText: {
    color: '#006A32',
    fontSize: 13,
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

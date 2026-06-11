import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  type GestureResponderEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Dumbbell,
  Globe2,
  Heart,
  Image as ImageIcon,
  Leaf,
  Lightbulb,
  LockKeyhole,
  MapPin,
  Minus,
  PawPrint,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  Trash2,
  UsersRound,
  WalletCards,
  Zap,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps'

import CoincidirLogo from '../../components/CoincidirLogo'
import {
  activityCategories as categories,
  findActivityCategory,
  type ActivityCategory as Category,
  type ActivityCategoryId as CategoryId,
} from '../../constants/activityCategories'
import { legacyInterestAliases, normalizeInterestLabel } from '../../constants/userInterests'
import {
  getLocalGroupId,
} from '../../constants/localGroups'
import { getFirebaseServices } from '../../firebaseConfig'
import { uploadGroupPhoto } from '../../lib/groupPhotos'
import { notifyActivityUpdated } from '../../lib/notifications'
import { requireVerifiedParticipation } from '../../utils/authParticipation'
import { formatGroupMemberCount, getGroupMemberCount } from '../../utils/groupMembership'

type PickerMode = 'category' | 'subcategory' | 'date' | 'time' | 'currency' | null
type CreateStep = 1 | 2 | 3 | 4 | 5
const allActivitySteps: CreateStep[] = [1, 2, 3, 4, 5]
const groupContextActivitySteps: CreateStep[] = [1, 3, 4, 5]
type CreateFlowMode = 'activity' | 'choice' | 'group' | 'groupCreated'
type ActivityKind = 'group' | 'individual'

type AvailableGroup = {
  id: string
  memberCount?: number
  name: string
}

type ActivitySearchOption = {
  category: Category
  id: string
  keywords: string[]
  searchText: string
  subcategory: string
}

type LocationSelection = {
  address: string
  latitude: number
  longitude: number
}

type ActivityData = Record<string, unknown>

type ActivityFormPayload = {
  name: string
  category: string
  categoryId: CategoryId
  categoryColor: string
  categoryIcon: string
  subcategory: string
  description: string
  date: string
  activityDate: Date
  activityDateISO: string
  time: string
  location: string
  locationAddress: string
  locationLatitude: number
  locationLongitude: number
  locationPin: LocationSelection
  city: string
  groupId: string
  groupName: string
  visibility: 'approval' | 'group' | 'public'
  additionalSettings: {
    groupId: string
    groupName: string
    privacy: string
    visibility: 'approval' | 'group' | 'public'
    maxParticipants: number
    level: string
    environment: string
    cost: string
    price: string
    currency: string
    quickSettings: string[]
  }
}

const hasGoogleMapsKey = Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim())
const canUseNativeMap = Platform.OS !== 'android' || hasGoogleMapsKey
const shouldShowMapConfigNotice = Platform.OS === 'android' && !hasGoogleMapsKey
const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined
const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const monthNames = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function getCategoryIcon(categoryId: CategoryId) {
  if (categoryId === 'outdoor') return Leaf
  if (categoryId === 'sports') return Dumbbell
  if (categoryId === 'training') return Dumbbell
  if (categoryId === 'wellness') return Sparkles
  if (categoryId === 'groups') return UsersRound
  if (categoryId === 'culture') return Star
  if (categoryId === 'hobbies') return Zap

  return LockKeyhole
}

const currencyOptions = ['ARS', 'USD', 'UYU', 'BRL', 'EUR']
const initialLocationRegion: Region = {
  latitude: -37.3217,
  longitude: -59.1332,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
}

const privacyDetails = [
  { label: 'Pública', description: 'Cualquiera puede verla y sumarse', Icon: Globe2 },
  { label: 'Con aprobación', description: 'Debo aprobar participantes', Icon: ShieldCheck },
]

const activityKindDetails = [
  {
    description: 'La actividad no pertenece a ningún grupo.',
    Icon: Sparkles,
    label: 'Actividad individual',
    value: 'individual' as const,
  },
  {
    description: 'La actividad pertenece a uno de tus grupos.',
    Icon: UsersRound,
    label: 'Actividad de grupo',
    value: 'group' as const,
  },
]

const levelDetails = [
  { label: 'Principiante', description: 'Ideal para empezar', Icon: Star },
  { label: 'Intermedio', description: 'Algo de experiencia', Icon: Sparkles },
  { label: 'Avanzado', description: 'Nivel alto', Icon: BarChart3 },
  { label: 'Todos los niveles', description: 'Para cualquiera', Icon: UsersRound },
]

const environmentDetails = [
  { label: 'Tranquilo', description: 'Relajado y sin presión', color: '#168A37', backgroundColor: '#F2FAF3', Icon: Leaf },
  { label: 'Social', description: 'Enfocado en conectar', color: '#F07A00', backgroundColor: '#FFF7EC', Icon: UsersRound },
  { label: 'Deportivo', description: 'Activo y con energía', color: '#2563EB', backgroundColor: '#F0F5FF', Icon: Dumbbell },
  { label: 'Familiar', description: 'Apto para todas las edades', color: '#7A22C7', backgroundColor: '#F8F0FF', Icon: Heart },
  { label: 'Relax', description: 'Bienestar y desconexión', color: '#E6378A', backgroundColor: '#FFF0F6', Icon: Sparkles },
]

const costDetails = [
  { label: 'Gratis', description: 'Sin costo', Icon: BadgeDollarSign },
  { label: 'A la gorra', description: 'Cada uno aporta lo que quiere', Icon: WalletCards },
  { label: 'Pago', description: 'Se requiere un pago para participar', Icon: Tag },
]

const quickDetails = [
  { label: 'Mascotas permitidas', shortLabel: 'Mascotas', description: 'Permitidas', Icon: PawPrint },
  { label: 'Lluvia se suspende', shortLabel: 'Lluvia', description: 'Se suspende', Icon: CloudRain },
  { label: 'Tengo lugar en auto', shortLabel: 'Tengo lugar', description: 'en auto', Icon: Car },
  { label: 'Punto de encuentro', shortLabel: 'Punto de', description: 'encuentro', Icon: MapPin },
]

function formatDate(value: Date) {
  const day = String(value.getDate()).padStart(2, '0')
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const year = value.getFullYear()

  return `${day}/${month}/${year}`
}

function generateTimeOptions(startHour: number, endHour: number, intervalMinutes: number) {
  const options: string[] = []
  const startMinutes = startHour * 60
  const endMinutes = endHour * 60

  for (let minutes = startMinutes; minutes <= endMinutes; minutes += intervalMinutes) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, '0')
    const minute = String(minutes % 60).padStart(2, '0')

    options.push(`${hour}:${minute}`)
  }

  return options
}

const timeOptions = generateTimeOptions(6, 23, 30)

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function addDays(value: Date, days: number) {
  const nextDate = new Date(value)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function isSameDay(left: Date, right: Date) {
  return startOfDay(left).getTime() === startOfDay(right).getTime()
}

function getDateLabel(value: Date) {
  const today = startOfDay(new Date())

  if (isSameDay(value, today)) return 'Hoy'
  if (isSameDay(value, addDays(today, 1))) return 'Mañana'
  if (isSameDay(value, addDays(today, 2))) return 'Pasado mañana'

  return formatDate(value)
}

function getCalendarMonthTitle(value: Date) {
  return `${monthNames[value.getMonth()]} ${value.getFullYear()}`
}

function getCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7
  const days: (Date | null)[] = Array.from({ length: leadingEmptyDays }, () => null)

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day))
  }

  while (days.length % 7 !== 0) {
    days.push(null)
  }

  return days
}

function formatCoordinateAddress(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

const groupPhotoPickerOptions: ImagePicker.ImagePickerOptions = {
  allowsEditing: true,
  aspect: [16, 9],
  mediaTypes: ['images'],
  quality: 0.85,
}

function normalize(value: unknown) {
  return readString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getActivitySearchKeywords(category: Category, subcategory: string) {
  const aliases = legacyInterestAliases
    .filter((alias) => alias.canonical.includes(subcategory))
    .map((alias) => alias.legacy)

  return Array.from(new Set([
    subcategory,
    category.label,
    category.id,
    ...(category.legacyLabels ?? []),
    ...aliases,
    ...subcategory.split(/[\/,]/).map((item) => item.trim()),
  ].filter(Boolean)))
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readRecord(value: unknown): ActivityData {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as ActivityData : {}
}

function getVisibilityFromPrivacy(value: string): 'approval' | 'group' | 'public' {
  const normalized = normalize(value)
  if (normalized.includes('grupo') || normalized === 'group') return 'group'
  if (normalized.includes('aprobacion') || normalized === 'approval') return 'approval'
  return 'public'
}

function getCreatorId(data: ActivityData) {
  return readString(data.createdBy)
    || readString(data.creatorId)
    || readString(data.ownerId)
    || readString(data.userId)
}

function readDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
    const parsed = value.toDate() as Date
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  return null
}

function getAddressFromGeocode(place: Location.LocationGeocodedAddress) {
  return [
    place.name,
    place.street,
    place.city || place.district,
    place.region,
  ].filter(Boolean).join(', ')
}

function getSaveError(error: unknown, isEditMode: boolean) {
  if (error instanceof Error && error.message.includes('Faltan variables')) {
    return 'Falta configurar Firebase.'
  }

  if (typeof error === 'object' && error && 'code' in error) {
    const code = String(error.code)

    if (code === 'auth/no-current-user') return 'No encontramos una sesión activa.'
    if (code === 'permission-denied') return isEditMode
      ? 'No tenemos permiso para editar la actividad.'
      : 'No tenemos permiso para crear la actividad.'
    if (code === 'unavailable' || code === 'deadline-exceeded') return 'No pudimos conectar con Firestore.'
  }

  return isEditMode ? 'No pudimos guardar los cambios.' : 'No pudimos crear la actividad.'
}

function includesUser(value: unknown, userId: string) {
  if (Array.isArray(value)) return value.includes(userId)
  if (typeof value === 'object' && value) return userId in value
  return false
}

function isActiveFirestoreGroup(id: string, data: ActivityData) {
  if (!id.trim()) return false
  if (data.deleted === true) return false
  if (readString(data.status).toLowerCase() === 'deleted') return false
  return true
}

function isUserFirestoreGroup(data: ActivityData, userId: string) {
  if (readString(data.ownerId) === userId) return true
  if (readString(data.createdBy) === userId) return true
  if (readString(data.creatorId) === userId) return true
  if (readString(data.userId) === userId) return true

  return [
    data.joinedUsers,
    data.participants,
    data.members,
    data.memberProfiles,
    data.memberIds,
  ].some((value) => includesUser(value, userId))
}

function getFirestoreGroupName(data: ActivityData) {
  return readString(data.name, readString(data.title))
}

function mergeAvailableGroups(...groupLists: AvailableGroup[][]) {
  const groupsById = new Map<string, AvailableGroup>()

  groupLists.flat().forEach((group) => {
    const id = group.id.trim()
    const name = group.name.trim()
    if (!id || !name || groupsById.has(id)) return
    groupsById.set(id, { id, memberCount: group.memberCount, name })
  })

  return Array.from(groupsById.values()).sort((left, right) => left.name.localeCompare(right.name))
}

export default function CrearScreen() {
  const router = useRouter()
  const { activityId, groupContext, groupId: preselectedGroupId, groupName: preselectedGroupName, kind, mode } = useLocalSearchParams<{ activityId?: string; groupContext?: string; groupId?: string; groupName?: string; kind?: string; mode?: string }>()
  const insets = useSafeAreaInsets()
  const isEditMode = mode === 'edit'
  const isGroupContext = !isEditMode && groupContext === '1' && kind === 'group' && Boolean(readString(preselectedGroupId))
  const safeBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/home')
    }
  }, [router])
  const [flowMode, setFlowMode] = useState<CreateFlowMode>(isEditMode || isGroupContext ? 'activity' : 'choice')
  const [activityKind, setActivityKind] = useState<ActivityKind>('individual')
  const [groupDraftName, setGroupDraftName] = useState('')
  const [groupDraftDescription, setGroupDraftDescription] = useState('')
  const [groupDraftLocation, setGroupDraftLocation] = useState('')
  const [groupPhotoAsset, setGroupPhotoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [groupPhotoPreviewUri, setGroupPhotoPreviewUri] = useState('')
  const [createdGroupId, setCreatedGroupId] = useState('')
  const [createdGroupName, setCreatedGroupName] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [subcategory, setSubcategory] = useState('')
  const [activitySearchQuery, setActivitySearchQuery] = useState('')
  const [selectedActivitySearchLabel, setSelectedActivitySearchLabel] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(startOfDay(new Date()))
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<LocationSelection | null>(null)
  const [mapRegion, setMapRegion] = useState<Region>(initialLocationRegion)
  const [draftPin, setDraftPin] = useState({
    latitude: initialLocationRegion.latitude,
    longitude: initialLocationRegion.longitude,
  })
  const [pickerMode, setPickerMode] = useState<PickerMode>(null)
  const [isLoadingEditActivity, setIsLoadingEditActivity] = useState(isEditMode)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [currentStep, setCurrentStep] = useState<CreateStep>(1)
  const [isAdditionalVisible, setIsAdditionalVisible] = useState(false)
  const [isLocationPickerVisible, setIsLocationPickerVisible] = useState(false)
  const [isResolvingLocation, setIsResolvingLocation] = useState(false)
  const [fallbackMapSize, setFallbackMapSize] = useState({ width: 1, height: 1 })
  const [privacy, setPrivacy] = useState('Pública')
  const [currentUserId, setCurrentUserId] = useState('')
  const [availableGroups, setAvailableGroups] = useState<AvailableGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [isCreateGroupVisible, setIsCreateGroupVisible] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [maxParticipants, setMaxParticipants] = useState(10)
  const [level, setLevel] = useState('Principiante')
  const [environment, setEnvironment] = useState('Tranquilo')
  const [cost, setCost] = useState('Gratis')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('ARS')
  const [quickSettings, setQuickSettings] = useState(['Mascotas permitidas'])
  const visibleActivitySteps = isGroupContext ? groupContextActivitySteps : allActivitySteps
  const currentVisibleStepIndex = Math.max(visibleActivitySteps.indexOf(currentStep), 0)
  const firstVisibleStep = visibleActivitySteps[0]
  const lastVisibleStep = visibleActivitySteps[visibleActivitySteps.length - 1]

  const subcategoryOptions = useMemo(
    () => category?.subcategories ?? [],
    [category],
  )
  const activitySearchOptions = useMemo<ActivitySearchOption[]>(
    () => categories.flatMap((item) =>
      item.subcategories.map((itemSubcategory) => {
        const keywords = getActivitySearchKeywords(item, itemSubcategory)

        return {
          category: item,
          id: `${item.id}:${itemSubcategory}`,
          keywords,
          searchText: keywords.map(normalizeInterestLabel).join(' '),
          subcategory: itemSubcategory,
        }
      }),
    ),
    [],
  )
  const activitySearchResults = useMemo(() => {
    const query = normalizeInterestLabel(activitySearchQuery)
    if (query.length < 2) return []

    return activitySearchOptions
      .filter((option) => option.searchText.includes(query))
      .slice(0, 10)
  }, [activitySearchOptions, activitySearchQuery])

  const pickerTitle = useMemo(() => {
    if (pickerMode === 'category') return 'Elegí una categoría'
    if (pickerMode === 'subcategory') return 'Elegí una subcategoría'
    if (pickerMode === 'date') return 'Elegí una fecha'
    if (pickerMode === 'time') return 'Elegí una hora'
    if (pickerMode === 'currency') return 'Elegí una moneda'
    return ''
  }, [pickerMode])

  const calendarDays = useMemo(
    () => getCalendarDays(calendarMonth),
    [calendarMonth],
  )

  useEffect(() => {
    try {
      const { auth } = getFirebaseServices()
      return onAuthStateChanged(auth, (user) => {
        setCurrentUserId(user?.uid ?? '')
      })
    } catch {
      setCurrentUserId('')
      return undefined
    }
  }, [])

  useEffect(() => {
    if (!currentUserId) {
      setAvailableGroups([])
      setSelectedGroup('')
      setSelectedGroupId('')
      return undefined
    }

    try {
      const { db } = getFirebaseServices()

      return onSnapshot(collection(db, 'groups'), (snapshot) => {
        const nextGroups = snapshot.docs
          .map((item) => {
            const data = item.data() as ActivityData
            return {
              data,
              id: item.id,
              memberCount: getGroupMemberCount(data),
              name: getFirestoreGroupName(data),
            }
          })
          .filter((group) => isActiveFirestoreGroup(group.id, group.data))
          .filter((group) => isUserFirestoreGroup(group.data, currentUserId))
          .filter((group) => Boolean(group.name))
          .map(({ id, memberCount, name }) => ({ id, memberCount, name }))
          .sort((left, right) => left.name.localeCompare(right.name))

        setAvailableGroups(nextGroups)

        if (__DEV__) {
          console.log('[CrearActividad] grupos Firestore vigentes', {
            count: nextGroups.length,
            groups: nextGroups,
          })
        }
      })
    } catch (error) {
      if (__DEV__) console.warn('[CrearActividad] error cargando grupos Firestore', error)
      return undefined
    }
  }, [currentUserId])

  useEffect(() => {
    if (activityKind !== 'group') return
    if (isGroupContext && selectedGroupId && availableGroups.length === 0) return

    const selectedAvailableGroup = availableGroups.find((group) => group.id === selectedGroupId)
      ?? availableGroups.find((group) => group.name === selectedGroup)
      ?? availableGroups[0]

    setSelectedGroup(selectedAvailableGroup?.name ?? '')
    setSelectedGroupId(selectedAvailableGroup?.id ?? '')
  }, [activityKind, availableGroups, isGroupContext, selectedGroup, selectedGroupId])

  useEffect(() => {
    const cleanGroupName = readString(preselectedGroupName)
    if (isEditMode || kind !== 'group' || !cleanGroupName) return

    const groupCategory = findActivityCategory({ categoryId: 'groups' }) ?? categories[0] ?? null
    const cleanGroupId = readString(preselectedGroupId)
    if (!cleanGroupId) return
    setFlowMode('activity')
    setActivityKind('group')
    setSelectedGroup(cleanGroupName)
    setSelectedGroupId(cleanGroupId)
    setName((current) => isGroupContext ? current : cleanGroupName)
    setCategory(groupCategory)
    setSubcategory(groupCategory?.subcategories[0] ?? '')
    setActivitySearchQuery('')
    setSelectedActivitySearchLabel('')
    setPrivacy('Pública')
    setCurrentStep(isGroupContext ? 1 : 3)
    setMessage('')
  }, [isEditMode, isGroupContext, kind, preselectedGroupId, preselectedGroupName])

  useEffect(() => {
    if (!isEditMode) {
      setIsLoadingEditActivity(false)
      return
    }

    if (!activityId) {
      Alert.alert('No pudimos editar', 'Falta identificar la actividad.', [
        { text: 'OK', onPress: () => router.replace('/home') },
      ])
      setIsLoadingEditActivity(false)
      return
    }

    let isMounted = true

    const loadActivityForEdit = async () => {
      setIsLoadingEditActivity(true)
      setMessage('')

      try {
        const { auth, db } = getFirebaseServices()
        const user = auth.currentUser

        if (!user) {
          Alert.alert('No pudimos editar', 'Necesitás iniciar sesión para editar esta actividad.', [
            { text: 'OK', onPress: () => router.replace('/home') },
          ])
          return
        }

        const snapshot = await getDoc(doc(db, 'activities', activityId))

        if (!snapshot.exists()) {
          Alert.alert('Actividad no disponible', 'No encontramos esta actividad para editarla.', [
            { text: 'OK', onPress: () => router.replace('/home') },
          ])
          return
        }

        const data = snapshot.data() as ActivityData

        if (getCreatorId(data) !== user.uid) {
          Alert.alert('No podés editar esta actividad', 'Solo quien organiza la actividad puede editarla.', [
            { text: 'OK', onPress: () => router.replace('/home') },
          ])
          return
        }

        if (!isMounted) return

        const existingCategory = findActivityCategory({
          category: readString(data.category),
          categoryId: readString(data.categoryId),
        })
        const existingDate = readDate(data.activityDate) ?? readDate(data.activityDateISO)
        const locationPin = readRecord(data.locationPin)
        const locationLatitude = readNumber(data.locationLatitude, readNumber(locationPin.latitude, initialLocationRegion.latitude))
        const locationLongitude = readNumber(data.locationLongitude, readNumber(locationPin.longitude, initialLocationRegion.longitude))
        const locationAddress = readString(
          data.locationAddress,
          readString(locationPin.address, readString(data.location)),
        )
        const additionalSettings = readRecord(data.additionalSettings)
        const existingCost = readString(additionalSettings.cost, readString(data.cost, 'Gratis'))
        const existingCurrency = readString(additionalSettings.currency, readString(data.currency, 'ARS'))
        const existingQuickSettings = Array.isArray(additionalSettings.quickSettings)
          ? additionalSettings.quickSettings.filter((item): item is string => typeof item === 'string')
          : []

        setName(readString(data.name))
        setCategory(existingCategory)
        setSubcategory(readString(data.subcategory))
        setActivitySearchQuery('')
        setSelectedActivitySearchLabel('')
        setDescription(readString(data.description))
        setSelectedDate(existingDate)
        setDate(readString(data.date, existingDate ? getDateLabel(existingDate) : ''))
        setCalendarMonth(existingDate ? new Date(existingDate.getFullYear(), existingDate.getMonth(), 1) : startOfDay(new Date()))
        setTime(readString(data.time))
        setLocation(readString(data.location, locationAddress))
        setSelectedLocation({
          address: locationAddress,
          latitude: locationLatitude,
          longitude: locationLongitude,
        })
        setMapRegion({
          latitude: locationLatitude,
          longitude: locationLongitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        })
        setDraftPin({
          latitude: locationLatitude,
          longitude: locationLongitude,
        })
        setPrivacy(readString(additionalSettings.privacy, readString(data.privacy, 'Pública')))
        const existingGroupName = readString(additionalSettings.groupName, readString(data.groupName))
        if (existingGroupName) {
          setActivityKind('group')
          setSelectedGroup(existingGroupName)
          setSelectedGroupId(readString(additionalSettings.groupId, readString(data.groupId)))
        } else {
          setActivityKind('individual')
        }
        setMaxParticipants(readNumber(additionalSettings.maxParticipants, readNumber(data.maxParticipants, 10)))
        setLevel(readString(additionalSettings.level, readString(data.level, 'Principiante')))
        setEnvironment(readString(additionalSettings.environment, readString(data.environment, 'Tranquilo')))
        setCost(existingCost)
        setPrice(readString(additionalSettings.price, readString(data.price)))
        setCurrency(existingCost === 'Gratis' ? 'ARS' : existingCurrency)
        setQuickSettings(existingQuickSettings)
      } catch {
        Alert.alert('No pudimos editar', 'Intentá nuevamente en unos segundos.', [
          { text: 'OK', onPress: () => router.replace('/home') },
        ])
      } finally {
        if (isMounted) setIsLoadingEditActivity(false)
      }
    }

    void loadActivityForEdit()

    return () => {
      isMounted = false
    }
  }, [activityId, isEditMode, router])

  const openLocationPicker = async () => {
    setMessage('')
    setIsLocationPickerVisible(true)

    if (selectedLocation) {
      const region = {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }

      setMapRegion(region)
      setDraftPin({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      })
      return
    }

    const permission = await Location.requestForegroundPermissionsAsync()

    if (permission.status !== 'granted') {
      setMessage('Podés seleccionar la ubicación manualmente en el mapa.')
      setMapRegion(initialLocationRegion)
      setDraftPin({
        latitude: initialLocationRegion.latitude,
        longitude: initialLocationRegion.longitude,
      })
      return
    }

    const currentLocation = await Location.getCurrentPositionAsync({})
    const region = {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }

    setMapRegion(region)
    setDraftPin({
      latitude: region.latitude,
      longitude: region.longitude,
    })
  }

  const updateDraftPin = (event: {
    nativeEvent: {
      coordinate: {
        latitude: number
        longitude: number
      }
    }
  }) => {
    const coordinate = event.nativeEvent.coordinate
    setDraftPin({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    })
    setMapRegion((value) => ({
      ...value,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    }))
  }

  const confirmLocation = async () => {
    setIsResolvingLocation(true)

    try {
      const [geocode] = await Location.reverseGeocodeAsync(draftPin)
      const address = geocode
        ? getAddressFromGeocode(geocode)
        : formatCoordinateAddress(draftPin.latitude, draftPin.longitude)
      const resolvedAddress = address || formatCoordinateAddress(draftPin.latitude, draftPin.longitude)

      setSelectedLocation({
        address: resolvedAddress,
        latitude: draftPin.latitude,
        longitude: draftPin.longitude,
      })
      setLocation(resolvedAddress)
      setIsLocationPickerVisible(false)
      setMessage('')
    } catch {
      const fallbackAddress = formatCoordinateAddress(draftPin.latitude, draftPin.longitude)

      setSelectedLocation({
        address: fallbackAddress,
        latitude: draftPin.latitude,
        longitude: draftPin.longitude,
      })
      setLocation(fallbackAddress)
      setIsLocationPickerVisible(false)
      setMessage('')
    } finally {
      setIsResolvingLocation(false)
    }
  }

  const buildActivityPayload = (): ActivityFormPayload | null => {
    if (!category || !selectedDate || !selectedLocation) return null
    const visibility = activityKind === 'group' ? 'group' : getVisibilityFromPrivacy(privacy)
    const groupName = activityKind === 'group' ? selectedGroup : ''
    const groupId = groupName ? selectedGroupId : ''

    const payload: ActivityFormPayload = {
      name: name.trim(),
      category: category.label,
      categoryId: category.id,
      categoryColor: category.color,
      categoryIcon: category.icon,
      subcategory,
      description: description.trim(),
      date,
      activityDate: selectedDate,
      activityDateISO: selectedDate.toISOString(),
      time,
      location,
      locationAddress: selectedLocation.address,
      locationLatitude: selectedLocation.latitude,
      locationLongitude: selectedLocation.longitude,
      locationPin: {
        address: selectedLocation.address,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      },
      city: getCityFromLocation(location),
      groupId,
      groupName,
      visibility,
      additionalSettings: {
        groupId,
        groupName,
        privacy: activityKind === 'group' ? 'Grupo' : privacy,
        visibility,
        maxParticipants,
        level,
        environment,
        cost,
        price: cost === 'Gratis' ? '' : price.trim(),
        currency: cost === 'Gratis' ? '' : currency,
        quickSettings,
      },
    }

    if (__DEV__) {
      console.log('[CrearActividad] payload grupo', {
        groupId: payload.groupId,
        groupName: payload.groupName,
        visibility: payload.visibility,
      })
    }

    return payload
  }

  const saveActivity = async () => {
    if (!name.trim() || !category || !subcategory || !description.trim() || !selectedDate || !time || !selectedLocation) {
      setMessage(isEditMode ? 'Completá todos los campos para guardar los cambios.' : 'Completá todos los campos para crear la actividad.')
      return
    }

    if (activityKind === 'group' && (!selectedGroup || !selectedGroupId)) {
      setMessage('Seleccioná un grupo para publicar la actividad.')
      return
    }

    if (cost === 'Pago' && !price.trim()) {
      setMessage('Ingresá el precio de la actividad.')
      return
    }

    setIsSaving(true)
    setMessage('')

    try {
      const { auth, db } = getFirebaseServices()
      const user = auth.currentUser

      if (!user) {
        const authError = new Error('No current user') as Error & { code: string }
        authError.code = 'auth/no-current-user'
        throw authError
      }

      if (!(await requireVerifiedParticipation(auth))) return

      const payload = buildActivityPayload()
      if (!payload) return

      if (isEditMode) {
        if (!activityId) {
          Alert.alert('No pudimos editar', 'Falta identificar la actividad.', [
            { text: 'OK', onPress: () => router.replace('/home') },
          ])
          return
        }

        const targetRef = doc(db, 'activities', activityId)
        const snapshot = await getDoc(targetRef)

        if (!snapshot.exists()) {
          Alert.alert('Actividad no disponible', 'No encontramos esta actividad para editarla.', [
            { text: 'OK', onPress: () => router.replace('/home') },
          ])
          return
        }

        const latestActivity = snapshot.data() as ActivityData
        if (getCreatorId(latestActivity) !== user.uid) {
          Alert.alert('No podés editar esta actividad', 'Solo quien organiza la actividad puede editarla.', [
            { text: 'OK', onPress: () => router.replace('/home') },
          ])
          return
        }

        await updateDoc(targetRef, {
          ...payload,
          updatedAt: serverTimestamp(),
        })

        if (__DEV__) {
          console.log('[CrearActividad] actividad actualizada con grupo', {
            activityId,
            groupId: payload.groupId,
            groupName: payload.groupName,
            visibility: payload.visibility,
          })
        }

        notifyActivityUpdated({
          activity: latestActivity,
          activityId,
          activityTitle: payload.name,
          organizerId: user.uid,
        }).catch((error) => {
          if (__DEV__) console.warn('activity-updated-notification-create-error', error)
        })

        router.dismissTo({
          pathname: '/activity/[activityId]',
          params: { activityId },
        })
        return
      }

      const createdRef = await addDoc(collection(db, 'activities'), {
        ...payload,
        interestedUsers: {},
        interestedCount: 0,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      if (__DEV__) {
        console.log('[CrearActividad] actividad creada con grupo', {
          activityId: createdRef.id,
          groupId: payload.groupId,
          groupName: payload.groupName,
          visibility: payload.visibility,
        })
      }

      router.replace('/home')
    } catch (error) {
      setMessage(getSaveError(error, isEditMode))
    } finally {
      setIsSaving(false)
    }
  }

  const selectOption = (value: string | Category) => {
    if (pickerMode === 'category' && typeof value !== 'string') {
      setCategory(value)
      setSubcategory('')
      setActivitySearchQuery('')
      setSelectedActivitySearchLabel('')
    }

    if (pickerMode === 'subcategory' && typeof value === 'string') {
      setSubcategory(value)
      setActivitySearchQuery('')
      setSelectedActivitySearchLabel('')
    }
    if (pickerMode === 'time' && typeof value === 'string') setTime(value)
    if (pickerMode === 'currency' && typeof value === 'string') setCurrency(value)

    setPickerMode(null)
    setMessage('')
  }

  const changeActivitySearchQuery = (value: string) => {
    setActivitySearchQuery(value)
    if (selectedActivitySearchLabel && value !== selectedActivitySearchLabel) {
      setSelectedActivitySearchLabel('')
    }
  }

  const selectActivitySearchResult = (option: ActivitySearchOption) => {
    setCategory(option.category)
    setSubcategory(option.subcategory)
    setActivitySearchQuery(option.subcategory)
    setSelectedActivitySearchLabel(option.subcategory)
    setPickerMode(null)
    setMessage('')
  }

  const toggleQuickSetting = (option: string) => {
    setQuickSettings((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option],
    )
  }

  const getCityFromLocation = (value: string) => {
    if (value === 'Costanera Norte' || value === 'Palermo' || value === 'Villa Devoto') {
      return 'Buenos Aires'
    }

    return 'Tandil'
  }

  const setCostOption = (option: string) => {
    setCost(option)
    if (option === 'Gratis') {
      setPrice('')
      setCurrency('ARS')
    }
  }

  const openCreateGroup = () => {
    setNewGroupName('')
    setIsCreateGroupVisible(true)
  }

  const selectFirestoreGroup = (group: AvailableGroup) => {
    setSelectedGroup(group.name)
    setSelectedGroupId(group.id)
    if (__DEV__) {
      console.log('[CrearActividad] grupo seleccionado', { groupId: group.id, groupName: group.name })
    }
  }

  const closeCreateGroup = () => {
    setNewGroupName('')
    setIsCreateGroupVisible(false)
  }

  const prepareGroupActivity = (groupName: string, groupId = '') => {
    const groupCategory = findActivityCategory({ categoryId: 'groups' }) ?? categories[0] ?? null

    setActivityKind('group')
    setSelectedGroup(groupName)
    setSelectedGroupId(groupId)
    setName(groupName)
    setCategory(groupCategory)
    setSubcategory(groupCategory?.subcategories[0] ?? '')
    setActivitySearchQuery('')
    setSelectedActivitySearchLabel('')
    setPrivacy('Pública')
    setCurrentStep(3)
    setFlowMode('activity')
    setMessage('')
  }

  const startCreateActivity = () => {
    setFlowMode('activity')
    setCurrentStep(1)
    setActivitySearchQuery('')
    setSelectedActivitySearchLabel('')
    setMessage('')
  }

  const startCreateGroup = () => {
    setGroupDraftName('')
    setGroupDraftDescription('')
    setGroupDraftLocation('')
    setGroupPhotoAsset(null)
    setGroupPhotoPreviewUri('')
    setCreatedGroupId('')
    setCreatedGroupName('')
    setMessage('')
    setFlowMode('group')
  }

  const chooseGroupPhotoFromLibrary = async () => {
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

      setGroupPhotoAsset(asset)
      setGroupPhotoPreviewUri(asset.uri)
    } catch (error) {
      if (__DEV__) console.warn('[CrearActividad] group photo picker error', error)
      Alert.alert('No pudimos abrir la galería', 'Revisá los permisos de fotos e intentá nuevamente.')
    }
  }

  const removeGroupPhoto = () => {
    setGroupPhotoAsset(null)
    setGroupPhotoPreviewUri('')
  }

  const createStandaloneGroup = async () => {
    const cleanName = groupDraftName.trim()
    if (!cleanName) {
      setMessage('Ingresá un nombre para el grupo.')
      return
    }

    const { auth, db } = getFirebaseServices()
    const user = auth.currentUser
    if (!user) {
      setMessage('Necesitás iniciar sesión para crear un grupo.')
      return
    }
    if (!(await requireVerifiedParticipation(auth))) return

    const cleanLocation = groupDraftLocation.trim()
    const createdGroupId = getLocalGroupId(cleanName)
    let remoteGroupPhotoUrl = ''

    if (groupPhotoAsset) {
      try {
        remoteGroupPhotoUrl = await uploadGroupPhoto(createdGroupId, groupPhotoAsset)
        if (__DEV__) {
          console.log('[GROUP IMAGE UPLOAD OK]', {
            groupId: createdGroupId,
            url: remoteGroupPhotoUrl,
          })
        }
      } catch (error) {
        console.error('[GROUP IMAGE UPLOAD ERROR]', error)
      }
    }

    setSelectedGroup(cleanName)
    setSelectedGroupId(createdGroupId)
    setCreatedGroupId(createdGroupId)
    setCreatedGroupName(cleanName)
    setMessage('')

    try {
      await setDoc(doc(db, 'groups', createdGroupId), {
        address: cleanLocation,
        category: 'Grupo',
        createdAt: serverTimestamp(),
        description: groupDraftDescription.trim(),
        imageUrl: remoteGroupPhotoUrl,
        photoURL: remoteGroupPhotoUrl,
        locationName: cleanLocation,
        memberIds: [user.uid],
        memberCount: 1,
        members: [user.uid],
        memberProfiles: {
          [user.uid]: {
            joinedAt: serverTimestamp(),
            name: user.displayName?.trim() || user.email?.split('@')[0]?.trim() || 'Organizador',
            role: 'owner',
          },
        },
        membersCount: 1,
        name: cleanName,
        ownerId: user.uid,
        ownerName: user.displayName?.trim() || user.email?.split('@')[0]?.trim() || 'Organizador',
        deleted: false,
        status: 'active',
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setAvailableGroups((current) => mergeAvailableGroups(current, [{ id: createdGroupId, memberCount: 1, name: cleanName }]))
      if (__DEV__) {
        console.log('[GROUP CREATE OWNERSHIP DEBUG]', {
          currentUserUid: user.uid,
          groupId: createdGroupId,
          members: [user.uid],
          name: cleanName,
          ownerId: user.uid,
        })
      }
    } catch (error) {
      if (__DEV__) console.warn('[CrearActividad] error creando grupo Firestore', error)
      setMessage('No pudimos guardar el grupo. Intentá nuevamente.')
      return
    }

    setFlowMode('groupCreated')
  }

  const openCreatedGroup = () => {
    const groupName = createdGroupName.trim()
    if (!groupName) {
      router.replace('/home')
      return
    }

    router.replace({
      pathname: '/group/[groupId]',
      params: {
        groupId: createdGroupId || getLocalGroupId(groupName),
        groupName,
      },
    })
  }

  const createLocalGroup = async () => {
    const cleanName = newGroupName.trim()
    if (!cleanName) {
      setMessage('Ingresá un nombre para el grupo.')
      return
    }

    const { auth, db } = getFirebaseServices()
    const user = auth.currentUser
    if (!user) {
      setMessage('Necesitás iniciar sesión para crear un grupo.')
      return
    }
    if (!(await requireVerifiedParticipation(auth))) return

    const createdGroupId = getLocalGroupId(cleanName)

    try {
      await setDoc(doc(db, 'groups', createdGroupId), {
        category: 'Grupo',
        createdAt: serverTimestamp(),
        deleted: false,
        memberCount: 1,
        memberIds: [user.uid],
        members: [user.uid],
        memberProfiles: {
          [user.uid]: {
            joinedAt: serverTimestamp(),
            name: user.displayName?.trim() || user.email?.split('@')[0]?.trim() || 'Organizador',
            role: 'owner',
          },
        },
        membersCount: 1,
        name: cleanName,
        ownerId: user.uid,
        ownerName: user.displayName?.trim() || user.email?.split('@')[0]?.trim() || 'Organizador',
        status: 'active',
        updatedAt: serverTimestamp(),
      }, { merge: true })

      setAvailableGroups((current) => mergeAvailableGroups(current, [{ id: createdGroupId, memberCount: 1, name: cleanName }]))
      setSelectedGroup(cleanName)
      setSelectedGroupId(createdGroupId)
      setIsCreateGroupVisible(false)
      setNewGroupName('')
      setMessage('')

      if (__DEV__) {
        console.log('[CrearActividad] grupo creado', {
          groupId: createdGroupId,
          groupName: cleanName,
        })
      }
    } catch (error) {
      if (__DEV__) console.warn('[CrearActividad] error creando grupo Firestore', error)
      setMessage('No pudimos guardar el grupo. Intentá nuevamente.')
    }
  }

  const validateCurrentStep = () => {
    if (currentStep === 1 && (!name.trim() || !category || !subcategory)) {
      setMessage('Ingresá nombre, categoría y subcategoría para continuar.')
      return false
    }

    if (currentStep === 2 && activityKind === 'group' && !isGroupContext && (!selectedGroup || !selectedGroupId)) {
      setMessage('Seleccioná un grupo para continuar.')
      return false
    }

    if (currentStep === 3 && !description.trim()) {
      setMessage('Agregá una descripción para continuar.')
      return false
    }

    if (currentStep === 4 && (!selectedDate || !time || !selectedLocation)) {
      setMessage('Seleccioná fecha, hora y ubicación para continuar.')
      return false
    }

    setMessage('')
    return true
  }

  const goToNextStep = () => {
    if (!validateCurrentStep()) return
    setCurrentStep((step) => {
      const currentIndex = visibleActivitySteps.indexOf(step)
      return visibleActivitySteps[Math.min(currentIndex + 1, visibleActivitySteps.length - 1)] ?? lastVisibleStep
    })
  }

  const goToPreviousStep = () => {
    setPickerMode(null)
    setMessage('')
    setCurrentStep((step) => {
      const currentIndex = visibleActivitySteps.indexOf(step)
      return visibleActivitySteps[Math.max(currentIndex - 1, 0)] ?? firstVisibleStep
    })
  }

  const returnToCreateActivity = () => {
    setPickerMode(null)
    setIsAdditionalVisible(false)
  }

  const openDatePicker = () => {
    const baseDate = selectedDate ?? startOfDay(new Date())
    setCalendarMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1))
    setPickerMode('date')
  }

  const selectCalendarDate = (value: Date) => {
    const normalizedDate = startOfDay(value)
    setSelectedDate(normalizedDate)
    setDate(getDateLabel(normalizedDate))
    setPickerMode(null)
    setMessage('')
  }

  const moveCalendarMonth = (offset: number) => {
    setCalendarMonth((value) => new Date(value.getFullYear(), value.getMonth() + offset, 1))
  }

  const moveFallbackPin = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent
    const width = Math.max(fallbackMapSize.width, 1)
    const height = Math.max(fallbackMapSize.height, 1)
    const longitudeOffset = ((locationX / width) - 0.5) * mapRegion.longitudeDelta
    const latitudeOffset = (0.5 - (locationY / height)) * mapRegion.latitudeDelta
    const nextPin = {
      latitude: mapRegion.latitude + latitudeOffset,
      longitude: mapRegion.longitude + longitudeOffset,
    }

    setDraftPin(nextPin)
    setMapRegion((value) => ({
      ...value,
      latitude: nextPin.latitude,
      longitude: nextPin.longitude,
    }))
  }

  const safeAdditionalScrollStyle = {
    paddingBottom: Math.max(insets.bottom + 28, 38),
    paddingTop: Math.max(insets.top + 18, 28),
  }
  const previewLocation = selectedLocation ?? {
    address: 'Tandil',
    latitude: initialLocationRegion.latitude,
    longitude: initialLocationRegion.longitude,
  }

  useEffect(() => {
    console.log('[CREATE MAP CONFIG]', {
      canUseNativeMap,
      hasGoogleMapsKey,
      platform: Platform.OS,
      provider: mapProvider ?? 'default',
    })
  }, [])

  useEffect(() => {
    if (!isLocationPickerVisible) return

    if (canUseNativeMap) {
      console.log('[CREATE MAP RENDER]', {
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
        provider: mapProvider ?? 'default',
        target: 'locationPicker',
      })
    } else {
      console.error('[CREATE MAP ERROR]', {
        hasGoogleMapsKey,
        platform: Platform.OS,
        reason: 'native_map_disabled',
      })
    }
  }, [isLocationPickerVisible, mapRegion.latitude, mapRegion.longitude])

  useEffect(() => {
    if (canUseNativeMap) {
      console.log('[CREATE MAP RENDER]', {
        latitude: previewLocation.latitude,
        longitude: previewLocation.longitude,
        provider: mapProvider ?? 'default',
        target: 'createPreview',
      })
    } else {
      console.error('[CREATE MAP ERROR]', {
        hasGoogleMapsKey,
        platform: Platform.OS,
        reason: 'preview_native_map_disabled',
      })
    }
  }, [previewLocation.latitude, previewLocation.longitude])

  const renderAdditionalSettings = () => (
    <>
      <AdditionalSection Icon={UsersRound} title="Cupos máximos">
        <View style={styles.participantsCard}>
          <Text style={styles.participantsLabel}>Cupos máximos (opcional)</Text>
          <View style={styles.participantsRow}>
            <View style={styles.participantsStepper}>
              <Pressable accessibilityLabel="Restar cupo" accessibilityRole="button" onPress={() => setMaxParticipants((value) => Math.max(2, value - 1))} style={styles.stepperButton}>
                <Minus color="#0E5A44" size={24} strokeWidth={2.5} />
              </Pressable>
              <Text style={styles.stepperValue}>{maxParticipants}</Text>
              <Pressable accessibilityLabel="Sumar cupo" accessibilityRole="button" onPress={() => setMaxParticipants((value) => Math.min(99, value + 1))} style={styles.stepperButton}>
                <Plus color="#0E5A44" size={24} strokeWidth={2.5} />
              </Pressable>
            </View>
            <Text style={styles.participantsHelp}>Incluyéndote a vos</Text>
          </View>
          <Text style={styles.participantsNote}>Podés cambiarlo más adelante.</Text>
        </View>
      </AdditionalSection>

      <AdditionalSection Icon={BarChart3} title="Nivel de la actividad">
        <View style={styles.levelGrid}>
          {levelDetails.map((item) => (
            <AdditionalChoiceCard active={level === item.label} description={item.description} Icon={item.Icon} key={item.label} label={item.label} onPress={() => setLevel(item.label)} />
          ))}
        </View>
      </AdditionalSection>

      <AdditionalSection Icon={Leaf} title="Tipo de ambiente">
        <View style={styles.environmentGrid}>
          {environmentDetails.map((item) => (
            <EnvironmentCard active={environment === item.label} backgroundColor={item.backgroundColor} color={item.color} description={item.description} Icon={item.Icon} key={item.label} label={item.label} onPress={() => setEnvironment(item.label)} />
          ))}
        </View>
      </AdditionalSection>

      <AdditionalSection Icon={Tag} title="Costo de la actividad">
        <View style={styles.additionalGrid}>
          {costDetails.map((item) => (
            <AdditionalChoiceCard active={cost === item.label} description={item.description} Icon={item.Icon} key={item.label} label={item.label} onPress={() => setCostOption(item.label)} />
          ))}
        </View>

        <View style={styles.priceRow}>
          <View style={styles.priceField}>
            <Text style={styles.priceLabel}>Precio (opcional)</Text>
            <TextInput
              editable={cost !== 'Gratis'}
              keyboardType="numeric"
              onChangeText={setPrice}
              placeholder="Ej: $2500"
              placeholderTextColor="#7A8790"
              style={[styles.priceInput, cost === 'Gratis' && styles.additionalDisabledInput]}
              underlineColorAndroid="transparent"
              value={price}
            />
          </View>
          <View style={styles.currencyField}>
            <Text style={styles.priceLabel}>Moneda</Text>
            <Pressable accessibilityLabel="Seleccionar moneda" accessibilityRole="button" disabled={cost === 'Gratis'} onPress={() => setPickerMode('currency')} style={[styles.currencyButton, cost === 'Gratis' && styles.additionalDisabledInput]}>
              <Text style={styles.currencyButtonText}>{currency}</Text>
              <ChevronDown color="#0E5A44" size={20} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>
      </AdditionalSection>

      <AdditionalSection Icon={Zap} title="Mascotas, lluvia, lugar y punto de encuentro">
        <View style={styles.quickGrid}>
          {quickDetails.map((item) => (
            <QuickCard active={quickSettings.includes(item.label)} description={item.description} Icon={item.Icon} key={item.label} label={item.shortLabel} onPress={() => toggleQuickSetting(item.label)} />
          ))}
        </View>
      </AdditionalSection>

      <View style={styles.additionalTip}>
        <Lightbulb color="#0E5A44" size={22} strokeWidth={2.2} />
        <Text style={styles.additionalTipText}>Podés agregar más detalles en la descripción de tu actividad.</Text>
      </View>
    </>
  )

  if (isLoadingEditActivity) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <View style={styles.createLoadingState}>
          <ActivityIndicator color="#0E5A44" />
        </View>
      </SafeAreaView>
    )
  }

  if (flowMode === 'choice') {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.createScrollContent,
            { paddingTop: Math.max(insets.top + 18, 28), paddingBottom: Math.max(insets.bottom + 120, 150) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.createHeader}>
            <Pressable accessibilityLabel="Volver" accessibilityRole="button" onPress={safeBack} style={styles.createBackButton}>
              <ArrowLeft color="#0E5A44" size={33} strokeWidth={2.2} />
            </Pressable>
            <View style={styles.createLogo}>
              <CoincidirLogo compact markSize={48} textSize={18} />
            </View>
          </View>

          <View style={styles.createTitleRow}>
            <View style={styles.additionalTitleIcon}>
              <Plus color="#0E5A44" size={25} strokeWidth={2.4} />
            </View>
            <Text style={styles.createScreenTitle}>¿Qué querés crear?</Text>
          </View>
          <Text style={styles.createSubtitle}>Elegí la opción que mejor se adapte a lo que tenés en mente.</Text>

          <View style={styles.createChoiceStack}>
            <Pressable accessibilityRole="button" onPress={startCreateActivity} style={styles.createChoiceCard}>
              <View style={styles.createChoiceIcon}>
                <Sparkles color="#0E5A44" size={27} strokeWidth={2.4} />
              </View>
              <View style={styles.createChoiceCopy}>
                <Text style={styles.createChoiceTitle}>Actividad</Text>
                <Text style={styles.createChoiceDescription}>Organizá un encuentro puntual con fecha, hora y lugar.</Text>
                <Text style={styles.createChoiceExamples}>Ejemplos: caminata, salida en bici, partido, mateada.</Text>
              </View>
              <ChevronRight color="#0E5A44" size={24} strokeWidth={2.4} />
            </Pressable>

            <Pressable accessibilityRole="button" onPress={startCreateGroup} style={[styles.createChoiceCard, styles.createChoiceCardGroup]}>
              <View style={[styles.createChoiceIcon, styles.createChoiceIconGroup]}>
                <UsersRound color="#4B348A" size={27} strokeWidth={2.4} />
              </View>
              <View style={styles.createChoiceCopy}>
                <Text style={styles.createChoiceTitle}>Grupo</Text>
                <Text style={styles.createChoiceDescription}>Creá una comunidad para reunir personas con un interés en común.</Text>
                <Text style={styles.createChoiceExamples}>Ejemplos: Running Tandil, Yoga Integral, Grupo de motos.</Text>
              </View>
              <ChevronRight color="#4B348A" size={24} strokeWidth={2.4} />
            </Pressable>

            <View style={styles.createChoiceTip}>
              <Lightbulb color="#0E5A44" size={20} strokeWidth={2.3} />
              <Text style={styles.createChoiceTipText}>Podés crear un grupo y luego agregarle actividades, o crear actividades sin necesidad de tener un grupo.</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  if (flowMode === 'group') {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.createScrollContent,
            { paddingTop: Math.max(insets.top + 18, 28), paddingBottom: Math.max(insets.bottom + 120, 150) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.createHeader}>
            <Pressable accessibilityLabel="Volver" accessibilityRole="button" onPress={() => setFlowMode('choice')} style={styles.createBackButton}>
              <ArrowLeft color="#0E5A44" size={33} strokeWidth={2.2} />
            </Pressable>
            <View style={styles.createLogo}>
              <CoincidirLogo compact markSize={48} textSize={18} />
            </View>
          </View>

          <View style={styles.createTitleRow}>
            <View style={styles.additionalTitleIcon}>
              <UsersRound color="#0E5A44" size={25} strokeWidth={2.4} />
            </View>
            <Text style={styles.createScreenTitle}>Crear grupo</Text>
          </View>
          <Text style={styles.createSubtitle}>Creá una comunidad estable para organizar actividades.</Text>

          <View style={styles.createCard}>
            <Text style={styles.createFieldLabel}>Nombre</Text>
            <TextInput
              maxLength={60}
              onChangeText={setGroupDraftName}
              placeholder="Ej: Club de lectura"
              placeholderTextColor="#7A8790"
              style={styles.createTextInput}
              underlineColorAndroid="transparent"
              value={groupDraftName}
            />

            <Text style={styles.createFieldLabel}>Descripción</Text>
            <TextInput
              maxLength={300}
              multiline
              onChangeText={setGroupDraftDescription}
              placeholder="Contá qué tipo de comunidad querés crear."
              placeholderTextColor="#7A8790"
              style={[styles.createTextInput, styles.createDescriptionInput]}
              textAlignVertical="top"
              underlineColorAndroid="transparent"
              value={groupDraftDescription}
            />

            <Text style={styles.createFieldLabel}>Ubicación / Dirección</Text>
            <TextInput
              maxLength={90}
              onChangeText={setGroupDraftLocation}
              placeholder="Ej: Tandil centro"
              placeholderTextColor="#7A8790"
              style={styles.createTextInput}
              underlineColorAndroid="transparent"
              value={groupDraftLocation}
            />

            <Text style={styles.createFieldLabel}>Foto</Text>
            <Pressable
              accessibilityRole="button"
              onPress={chooseGroupPhotoFromLibrary}
              style={[styles.groupPhotoPicker, groupPhotoPreviewUri && styles.groupPhotoPickerWithImage]}
            >
              {groupPhotoPreviewUri ? (
                <Image resizeMode="cover" source={{ uri: groupPhotoPreviewUri }} style={styles.groupPhotoPreview} />
              ) : (
                <View style={styles.groupPhotoPickerContent}>
                  <View style={styles.groupPhotoIcon}>
                    <ImageIcon color="#4B348A" size={24} strokeWidth={2.4} />
                  </View>
                  <Text style={styles.groupPhotoTitle}>Agregar foto del grupo</Text>
                  <Text style={styles.groupPhotoActionText}>Elegir de la galería</Text>
                </View>
              )}
            </Pressable>
            {groupPhotoPreviewUri ? (
              <View style={styles.groupPhotoActions}>
                <Pressable accessibilityRole="button" onPress={chooseGroupPhotoFromLibrary} style={styles.groupPhotoChangeButton}>
                  <ImageIcon color="#4B348A" size={17} strokeWidth={2.4} />
                  <Text style={styles.groupPhotoChangeText}>Cambiar foto</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={removeGroupPhoto} style={styles.groupPhotoRemoveButton}>
                  <Trash2 color="#B42318" size={17} strokeWidth={2.4} />
                  <Text style={styles.groupPhotoRemoveText}>Eliminar foto</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {message ? <Text style={styles.createMessageText}>{message}</Text> : null}

          <Pressable accessibilityRole="button" onPress={createStandaloneGroup} style={styles.createSubmitButton}>
            <Text style={styles.createSubmitText}>Crear grupo</Text>
            <ArrowRight color="#FFFFFF" size={32} strokeWidth={2.2} style={styles.createSubmitArrow} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    )
  }

  if (flowMode === 'groupCreated') {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.groupCreatedScrollContent,
            { paddingTop: Math.max(insets.top + 18, 28), paddingBottom: Math.max(insets.bottom + 72, 96) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.createHeader}>
            <Pressable accessibilityLabel="Volver" accessibilityRole="button" onPress={() => setFlowMode('choice')} style={styles.createBackButton}>
              <ArrowLeft color="#0E5A44" size={33} strokeWidth={2.2} />
            </Pressable>
            <View style={styles.createBackButton} />
          </View>

          <View style={styles.groupCreatedTitleRow}>
            <View style={styles.additionalTitleIcon}>
              <UsersRound color="#0E5A44" size={25} strokeWidth={2.4} />
            </View>
            <Text style={styles.createScreenTitle}>Grupo creado con éxito</Text>
          </View>

          <View style={styles.groupCreatedCard}>
            <View style={styles.groupCreatedIcon}>
              <UsersRound color="#0E5A44" size={34} strokeWidth={2.3} />
            </View>
            <Text numberOfLines={2} style={styles.groupCreatedName}>{createdGroupName || 'Tu grupo'}</Text>
            <Text style={styles.groupCreatedCopy}>Ya está listo para recibir miembros y actividades.</Text>
            <Text style={styles.groupCreatedStats}>0 miembros · 0 actividades</Text>
          </View>

          <View style={styles.groupCreatedActions}>
            <Pressable accessibilityRole="button" onPress={() => prepareGroupActivity(createdGroupName, createdGroupId)} style={styles.createSubmitButton}>
              <Text style={styles.createSubmitText}>Crear primera actividad</Text>
              <ArrowRight color="#FFFFFF" size={32} strokeWidth={2.2} style={styles.createSubmitArrow} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={openCreatedGroup} style={styles.createSecondaryButton}>
              <UsersRound color="#0E5A44" size={22} strokeWidth={2.3} />
              <Text style={styles.createSecondaryText}>Ir al grupo</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.createScrollContent,
          { paddingTop: Math.max(insets.top + 18, 28), paddingBottom: Math.max(insets.bottom + 120, 150) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.createHeader}>
          <Pressable accessibilityLabel="Volver" accessibilityRole="button" onPress={isEditMode ? safeBack : () => setFlowMode('choice')} style={styles.createBackButton}>
            <ArrowLeft color="#0E5A44" size={33} strokeWidth={2.2} />
          </Pressable>
          <View style={styles.createLogo}>
            <CoincidirLogo compact markSize={48} textSize={18} />
          </View>
        </View>

        <View style={styles.createTitleRow}>
          <View style={styles.additionalTitleIcon}>
            {currentStep === 2 ? (
              activityKind === 'group'
                ? <UsersRound color="#0E5A44" size={25} strokeWidth={2.4} />
                : <ShieldCheck color="#0E5A44" size={25} strokeWidth={2.4} />
            ) : null}
            {currentStep === 4 ? <MapPin color="#0E5A44" size={25} strokeWidth={2.4} /> : null}
            {currentStep === 5 ? <SlidersHorizontal color="#0E5A44" size={25} strokeWidth={2.4} /> : null}
            {currentStep !== 2 && currentStep !== 4 && currentStep !== 5 ? <Sparkles color="#0E5A44" size={25} strokeWidth={2.4} /> : null}
          </View>
          <Text style={styles.createScreenTitle}>
            {currentStep === 1 ? 'Información básica' : null}
            {currentStep === 2 ? (activityKind === 'group' ? 'Elegí un grupo' : 'Visibilidad') : null}
            {currentStep === 3 ? 'Descripción' : null}
            {currentStep === 4 ? '¿Cuándo y dónde?' : null}
            {currentStep === 5 ? 'Ajustes adicionales (opcionales)' : null}
          </Text>
        </View>
        <Text style={styles.createSubtitle}>
          {currentStep === 1 ? (isGroupContext ? 'Completá los datos principales de la actividad.' : 'Completá los datos principales y el tipo de actividad.') : null}
          {currentStep === 2 ? (activityKind === 'group' ? 'Seleccioná el grupo al que pertenece esta actividad.' : 'Elegí el nivel de visibilidad de tu actividad.') : null}
          {currentStep === 3 ? 'Contá más detalles sobre tu actividad.' : null}
          {currentStep === 4 ? 'Elegí la fecha, hora y el lugar del encuentro.' : null}
          {currentStep === 5 ? 'Completá los detalles opcionales para que otros sepan qué esperar.' : null}
        </Text>

        {isGroupContext ? (
          <View style={styles.groupContextChip}>
            <UsersRound color="#4B348A" size={18} strokeWidth={2.4} />
            <Text numberOfLines={2} style={styles.groupContextChipText}>Actividad del grupo: {selectedGroup || readString(preselectedGroupName, 'Grupo')}</Text>
          </View>
        ) : null}

        <View style={styles.createStepPills}>
          {visibleActivitySteps.map((step, index) => (
            <View key={step} style={[styles.createStepPill, currentStep === step && styles.createStepPillActive, index < currentVisibleStepIndex && styles.createStepPillDone]}>
              <Text style={[styles.createStepPillText, currentStep === step && styles.createStepPillTextActive, index < currentVisibleStepIndex && styles.createStepPillTextDone]}>{index + 1}</Text>
            </View>
          ))}
        </View>

        {currentStep === 1 ? <View style={styles.createCard}>
          <Text style={styles.createFieldLabel}>Nombre de la actividad</Text>
          <TextInput
            maxLength={70}
            onChangeText={setName}
            placeholder="Ej: Caminata al atardecer"
            placeholderTextColor="#7A8790"
            style={styles.createTextInput}
            underlineColorAndroid="transparent"
            value={name}
          />

          <Text style={styles.createFieldLabel}>¿Qué actividad querés crear?</Text>
          <View style={styles.activitySearchField}>
            <Search color="#0E5A44" size={20} strokeWidth={2.4} />
            <TextInput
              onChangeText={changeActivitySearchQuery}
              placeholder="Buscar actividad: ajedrez, ciclismo, yoga..."
              placeholderTextColor="#7A8790"
              style={styles.activitySearchInput}
              underlineColorAndroid="transparent"
              value={activitySearchQuery}
            />
          </View>
          {activitySearchResults.length > 0 ? (
            <View style={styles.activitySearchResults}>
              {activitySearchResults.map((item) => {
                const CategoryIcon = getCategoryIcon(item.category.id)

                return (
                  <Pressable
                    accessibilityLabel={`Seleccionar ${item.subcategory}`}
                    accessibilityRole="button"
                    key={item.id}
                    onPress={() => selectActivitySearchResult(item)}
                    style={styles.activitySearchResult}
                  >
                    <View style={[styles.activitySearchIcon, { backgroundColor: item.category.backgroundColor }]}>
                      <CategoryIcon color={item.category.color} size={18} strokeWidth={2.4} />
                    </View>
                    <View style={styles.activitySearchCopy}>
                      <Text numberOfLines={1} style={styles.activitySearchTitle}>{item.subcategory}</Text>
                      <Text numberOfLines={1} style={styles.activitySearchCategory}>{item.category.label}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          ) : null}

          <View style={styles.createTwoColumnRow}>
            <View style={styles.createColumn}>
              <Text style={styles.createFieldLabel}>Categoría</Text>
              <Pressable accessibilityLabel="Seleccionar categoría" accessibilityRole="button" onPress={() => setPickerMode('category')} style={styles.createSelectField}>
                {category ? (
                  <View style={[styles.selectedPill, { backgroundColor: category.backgroundColor }]}>
                    {(() => {
                      const CategoryIcon = getCategoryIcon(category.id)

                      return <CategoryIcon color={category.color} size={17} strokeWidth={2.3} />
                    })()}
                    <Text numberOfLines={1} style={[styles.selectedText, { color: category.color }]}>{category.label}</Text>
                  </View>
                ) : (
                  <Text style={styles.createPlaceholder}>Elegir</Text>
                )}
                <ChevronDown color="#0E5A44" size={20} strokeWidth={2.4} />
              </Pressable>
            </View>
            <View style={styles.createColumn}>
              <Text style={styles.createFieldLabel}>Subcategoría</Text>
              <Pressable
                accessibilityLabel="Seleccionar subcategoría"
                accessibilityRole="button"
                onPress={() => setPickerMode(category ? 'subcategory' : 'category')}
                style={styles.createSelectField}
              >
                <Text numberOfLines={1} style={subcategory ? styles.createSelectText : styles.createPlaceholder}>
                  {subcategory || 'Elegir'}
                </Text>
                <ChevronDown color="#0E5A44" size={20} strokeWidth={2.4} />
              </Pressable>
            </View>
          </View>
          {!isGroupContext ? (
            <View style={styles.groupPickerBlock}>
              <Text style={styles.createFieldLabel}>Tipo de actividad</Text>
              <View style={styles.additionalGrid}>
                {activityKindDetails.map((item) => (
                  <AdditionalChoiceCard
                    active={activityKind === item.value}
                    description={item.description}
                    Icon={item.Icon}
                    key={item.value}
                    label={item.label}
                    onPress={() => setActivityKind(item.value)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View> : null}

        {currentStep === 2 ? (
          <View style={styles.createCard}>
            {activityKind === 'individual' ? (
              <View style={styles.additionalGrid}>
                {privacyDetails.map((item) => (
                  <AdditionalChoiceCard active={privacy === item.label} description={item.description} Icon={item.Icon} key={item.label} label={item.label} onPress={() => setPrivacy(item.label)} />
                ))}
              </View>
            ) : (
              <View style={styles.groupPickerBlock}>
                <Text style={styles.createFieldLabel}>Elegí un grupo</Text>
                {availableGroups.map((group) => (
                  <Pressable accessibilityRole="button" key={group.id} onPress={() => selectFirestoreGroup(group)} style={[styles.groupOptionCard, selectedGroupId === group.id && styles.groupOptionCardActive]}>
                    <UsersRound color={selectedGroupId === group.id ? '#0E5A44' : '#7A8790'} size={21} strokeWidth={2.2} />
                    <View style={styles.groupOptionCopy}>
                      <Text style={[styles.groupOptionText, selectedGroupId === group.id && styles.groupOptionTextActive]}>{group.name}</Text>
                      <View style={styles.groupOptionMembersRow}>
                        <UsersRound color={selectedGroupId === group.id ? '#0E5A44' : '#7A8790'} size={14} strokeWidth={2.3} />
                        <Text style={[styles.groupOptionMembersText, selectedGroupId === group.id && styles.groupOptionTextActive]}>
                          {formatGroupMemberCount(group.memberCount ?? 0)}
                        </Text>
                      </View>
                    </View>
                    {selectedGroupId === group.id ? <View style={styles.additionalCheck}><Text style={styles.additionalCheckText}>✓</Text></View> : null}
                  </Pressable>
                ))}
                <Pressable accessibilityRole="button" onPress={openCreateGroup} style={[styles.groupOptionCard, styles.groupCreateCard]}>
                  <Plus color="#0E5A44" size={21} strokeWidth={2.5} />
                  <Text style={[styles.groupOptionText, styles.groupCreateText]}>Crear grupo</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {currentStep === 3 ? (
          <View style={styles.createCard}>
            <Text style={styles.createFieldLabel}>Descripción de la actividad</Text>
            <TextInput
              maxLength={300}
              multiline
              onChangeText={setDescription}
              placeholder="Contá qué van a hacer, qué llevar y cómo encontrarse."
              placeholderTextColor="#7A8790"
              style={[styles.createTextInput, styles.createDescriptionInput]}
              textAlignVertical="top"
              underlineColorAndroid="transparent"
              value={description}
            />
            <Text style={styles.createCounterText}>{description.length}/300</Text>
          </View>
        ) : null}

        {currentStep === 4 ? <View style={styles.createCard}>
          <Text style={styles.createSectionTitle}>¿Cuándo y dónde?</Text>
          <View style={styles.createTwoColumnRow}>
            <View style={styles.createColumn}>
              <Text style={styles.createFieldLabel}>Fecha</Text>
              <Pressable accessibilityLabel="Seleccionar fecha" accessibilityRole="button" onPress={openDatePicker} style={styles.createSelectField}>
                <Text style={date ? styles.createSelectText : styles.createPlaceholder}>{date || 'Elegir'}</Text>
                <ChevronDown color="#0E5A44" size={20} strokeWidth={2.4} />
              </Pressable>
            </View>
            <View style={styles.createColumn}>
              <Text style={styles.createFieldLabel}>Hora</Text>
              <Pressable accessibilityLabel="Seleccionar hora" accessibilityRole="button" onPress={() => setPickerMode('time')} style={styles.createSelectField}>
                <Text style={time ? styles.createSelectText : styles.createPlaceholder}>{time || 'Elegir'}</Text>
                <ChevronDown color="#0E5A44" size={20} strokeWidth={2.4} />
              </Pressable>
            </View>
          </View>
        </View> : null}

        {currentStep === 4 ? <View style={styles.createCard}>
          <View style={styles.createSectionHeader}>
            <MapPin color="#0E5A44" size={25} strokeWidth={2.2} />
            <Text style={styles.createSectionTitle}>Ubicación</Text>
          </View>
          <Pressable
            accessibilityLabel="Seleccionar ubicación en el mapa"
            accessibilityRole="button"
            onPress={openLocationPicker}
            style={styles.createMapCard}
          >
            {canUseNativeMap ? (
              <MapView
                mapType="standard"
                provider={mapProvider}
                region={{
                  latitude: previewLocation.latitude,
                  longitude: previewLocation.longitude,
                  latitudeDelta: 0.018,
                  longitudeDelta: 0.018,
                }}
                scrollEnabled={false}
                style={styles.createMapPreview}
                toolbarEnabled={false}
                zoomEnabled={false}
              >
                <Marker
                  coordinate={{
                    latitude: previewLocation.latitude,
                    longitude: previewLocation.longitude,
                  }}
                  pinColor="#0E5A44"
                />
              </MapView>
            ) : selectedLocation ? (
              <View style={styles.createMapFallbackPreview}>
                <FallbackMapArtwork />
                <MapPin color="#0E5A44" size={34} strokeWidth={2.1} />
                <Text style={styles.createMapEmptyText}>{formatCoordinateAddress(selectedLocation.latitude, selectedLocation.longitude)}</Text>
              </View>
            ) : (
              <View style={styles.createMapEmpty}>
                <MapPin color="#0E5A44" size={34} strokeWidth={2.1} />
                <Text style={styles.createMapEmptyText}>Seleccionar en el mapa</Text>
              </View>
            )}
            {selectedLocation && shouldShowMapConfigNotice ? <MapConfigNotice compact /> : null}
          </Pressable>
          <Pressable accessibilityLabel="Seleccionar ubicación" accessibilityRole="button" onPress={openLocationPicker} style={styles.createLocationField}>
            <Text numberOfLines={2} style={location ? styles.createSelectText : styles.createPlaceholder}>
              {location || 'Tocá para definir el punto de encuentro'}
            </Text>
            <MapPin color="#0E5A44" size={21} strokeWidth={2.2} />
          </Pressable>
        </View> : null}

        {currentStep === 5 ? renderAdditionalSettings() : null}

        {message ? <Text style={styles.createMessageText}>{message}</Text> : null}

        {currentStep !== firstVisibleStep ? (
          <Pressable accessibilityLabel="Volver al paso anterior" accessibilityRole="button" onPress={goToPreviousStep} style={styles.createSecondaryButton}>
            <ChevronLeft color="#0E5A44" size={24} strokeWidth={2.4} />
            <Text style={styles.createSecondaryText}>Atrás</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityLabel={currentStep === lastVisibleStep ? (isEditMode ? 'Guardar cambios' : 'Publicar actividad') : 'Continuar'}
          accessibilityRole="button"
          disabled={isSaving}
          onPress={currentStep === lastVisibleStep ? saveActivity : goToNextStep}
          style={[styles.createSubmitButton, isSaving && styles.createSubmitButtonDisabled]}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.createSubmitText}>{currentStep === lastVisibleStep ? (isEditMode ? 'Guardar cambios' : 'Publicar actividad') : 'Continuar'}</Text>
              <ArrowRight color="#FFFFFF" size={32} strokeWidth={2.2} style={styles.createSubmitArrow} />
            </>
          )}
        </Pressable>
        <Modal animationType="slide" visible={isLocationPickerVisible} onRequestClose={() => setIsLocationPickerVisible(false)}>
          <SafeAreaView edges={['top', 'bottom']} style={styles.locationPickerScreen}>
            <View style={styles.locationPickerHeader}>
              <Pressable
                accessibilityLabel="Cerrar selector de ubicación"
                accessibilityRole="button"
                onPress={() => setIsLocationPickerVisible(false)}
                style={styles.locationPickerBack}
              >
                <Text style={styles.locationPickerBackText}>←</Text>
              </Pressable>
              <View style={styles.locationPickerCopy}>
                <Text style={styles.locationPickerTitle}>Elegí la ubicación</Text>
                <Text style={styles.locationPickerSubtitle}>Tocá el mapa o arrastrá el pin.</Text>
              </View>
            </View>

            <View style={styles.locationPickerMapFrame}>
              {canUseNativeMap ? (
                <MapView
                  loadingEnabled
                  mapType="standard"
                  moveOnMarkerPress={false}
                  onLongPress={updateDraftPin}
                  onPress={updateDraftPin}
                  onRegionChangeComplete={setMapRegion}
                  provider={mapProvider}
                  region={mapRegion}
                  showsCompass
                  showsMyLocationButton
                  style={styles.locationPickerMap}
                  toolbarEnabled={false}
                >
                  <Marker
                    coordinate={draftPin}
                    draggable
                    onDragEnd={(event) => {
                      setDraftPin(event.nativeEvent.coordinate)
                      setMapRegion((value) => ({
                        ...value,
                        latitude: event.nativeEvent.coordinate.latitude,
                        longitude: event.nativeEvent.coordinate.longitude,
                      }))
                    }}
                    pinColor="#0E5A44"
                  />
                </MapView>
              ) : (
                <Pressable
                  accessibilityLabel="Selector alternativo de ubicación"
                  accessibilityRole="button"
                  onLayout={(event) => setFallbackMapSize(event.nativeEvent.layout)}
                  onPress={moveFallbackPin}
                  style={styles.locationFallbackMap}
                >
                  <FallbackMapArtwork />
                  <Text style={styles.mapFallbackText}>Tocá el área para ajustar el punto.</Text>
                </Pressable>
              )}
              <View pointerEvents="none" style={styles.locationCenterPin}>
                <MapPin color="#00613F" fill="#00613F" size={38} strokeWidth={2.2} />
              </View>
              {shouldShowMapConfigNotice ? <MapConfigNotice /> : null}
            </View>

            <View style={[styles.locationPickerFooter, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
              <Text numberOfLines={2} style={styles.locationPickerHint}>
                Pin: {formatCoordinateAddress(draftPin.latitude, draftPin.longitude)}
              </Text>
              <Pressable
                accessibilityLabel="Confirmar ubicación"
                accessibilityRole="button"
                disabled={isResolvingLocation}
                onPress={confirmLocation}
                style={styles.confirmLocationButton}
              >
                {isResolvingLocation ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmLocationText}>Confirmar ubicación</Text>
                )}
              </Pressable>
            </View>
          </SafeAreaView>
        </Modal>

        <Modal animationType="fade" transparent visible={isCreateGroupVisible} onRequestClose={closeCreateGroup}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
            style={styles.groupModalAvoidingView}
          >
            <Pressable style={styles.modalBackdrop} onPress={closeCreateGroup}>
              <Pressable style={[styles.groupModalCard, { paddingBottom: Math.max(insets.bottom + 24, 36) }]}>
                <Text style={styles.modalTitle}>Crear grupo</Text>
                <TextInput
                  autoCapitalize="words"
                  autoFocus
                  maxLength={60}
                  onChangeText={setNewGroupName}
                  onSubmitEditing={createLocalGroup}
                  placeholder="Ej: Club de lectura"
                  placeholderTextColor="#7A8790"
                  returnKeyType="done"
                  style={styles.createTextInput}
                  underlineColorAndroid="transparent"
                  value={newGroupName}
                />
                <Pressable accessibilityRole="button" onPress={createLocalGroup} style={styles.groupModalPrimaryButton}>
                  <Text style={styles.groupModalPrimaryText}>Crear grupo</Text>
                  <Plus color="#FFFFFF" size={22} strokeWidth={2.5} />
                </Pressable>
                <Pressable accessibilityRole="button" onPress={closeCreateGroup} style={styles.groupModalSecondaryButton}>
                  <Text style={styles.groupModalSecondaryText}>Cancelar</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        <Modal animationType="fade" transparent visible={pickerMode !== null} onRequestClose={() => setPickerMode(null)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPickerMode(null)}>
            <Pressable style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom + 18, 30) }]}>
              <Text style={styles.modalTitle}>{pickerTitle}</Text>
              <ScrollView contentContainerStyle={styles.modalOptionsContent} showsVerticalScrollIndicator={false}>
                {pickerMode === 'category'
                  ? categories.map((item) => (
                    <Pressable key={item.id} onPress={() => selectOption(item)} style={[styles.optionRow, { backgroundColor: item.backgroundColor }]}>
                      <View style={styles.categoryOptionRow}>
                        {(() => {
                          const CategoryIcon = getCategoryIcon(item.id)

                          return <CategoryIcon color={item.color} size={21} strokeWidth={2.3} />
                        })()}
                        <Text style={[styles.optionText, { color: item.color }]}>{item.label}</Text>
                      </View>
                    </Pressable>
                  ))
                  : null}
                {pickerMode === 'subcategory'
                  ? subcategoryOptions.map((item) => (
                    <Pressable key={item} onPress={() => selectOption(item)} style={styles.optionRow}>
                      <Text style={styles.optionText}>{item}</Text>
                    </Pressable>
                  ))
                  : null}
                {pickerMode === 'date' ? (
                  <View style={styles.calendarPicker}>
                    <View style={styles.calendarHeader}>
                      <Pressable
                        accessibilityLabel="Mes anterior"
                        accessibilityRole="button"
                        onPress={() => moveCalendarMonth(-1)}
                        style={styles.calendarNavButton}
                      >
                        <ChevronLeft color="#0E5A44" size={24} strokeWidth={2.4} />
                      </Pressable>
                      <Text style={styles.calendarMonthTitle}>{getCalendarMonthTitle(calendarMonth)}</Text>
                      <Pressable
                        accessibilityLabel="Mes siguiente"
                        accessibilityRole="button"
                        onPress={() => moveCalendarMonth(1)}
                        style={styles.calendarNavButton}
                      >
                        <ChevronRight color="#0E5A44" size={24} strokeWidth={2.4} />
                      </Pressable>
                    </View>

                    <View style={styles.calendarWeekRow}>
                      {weekDays.map((item, index) => (
                        <Text key={`${item}-${index}`} style={styles.calendarWeekText}>{item}</Text>
                      ))}
                    </View>

                    <View style={styles.calendarGrid}>
                      {calendarDays.map((item, index) => {
                        const isSelected = item && selectedDate ? isSameDay(item, selectedDate) : false
                        const isToday = item ? isSameDay(item, new Date()) : false

                        return (
                          <Pressable
                            accessibilityLabel={item ? `Elegir ${formatDate(item)}` : undefined}
                            accessibilityRole={item ? 'button' : undefined}
                            disabled={!item}
                            key={item ? item.toISOString() : `empty-${index}`}
                            onPress={() => item && selectCalendarDate(item)}
                            style={[
                              styles.calendarDay,
                              isToday && styles.calendarDayToday,
                              isSelected && styles.calendarDaySelected,
                            ]}
                          >
                            {item ? (
                              <Text style={[
                                styles.calendarDayText,
                                isSelected && styles.calendarDayTextSelected,
                              ]}
                              >
                                {item.getDate()}
                              </Text>
                            ) : null}
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>
                ) : null}
                {pickerMode === 'time'
                  ? timeOptions.map((item) => (
                    <Pressable key={item} onPress={() => selectOption(item)} style={styles.optionRow}>
                      <Text style={styles.optionText}>{item}</Text>
                    </Pressable>
                  ))
                  : null}
                {pickerMode === 'currency'
                  ? currencyOptions.map((item) => (
                    <Pressable key={item} onPress={() => selectOption(item)} style={styles.optionRow}>
                      <Text style={styles.optionText}>{item}</Text>
                    </Pressable>
                  ))
                  : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>

      {isAdditionalVisible ? (
        <View style={styles.additionalScreen}>
          <ScrollView
            bounces={false}
            contentContainerStyle={[styles.additionalScrollContent, safeAdditionalScrollStyle]}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.additionalHeader}>
              <Pressable
                accessibilityLabel="Volver a crear actividad"
                accessibilityRole="button"
                onPress={returnToCreateActivity}
                style={styles.additionalBackButton}
              >
                <ArrowLeft color="#0E5A44" size={33} strokeWidth={2.2} />
              </Pressable>
              <View style={styles.additionalLogo}>
                <CoincidirLogo compact markSize={48} textSize={18} />
              </View>
            </View>

            <View style={styles.additionalTitleRow}>
              <View style={styles.additionalTitleIcon}>
                <SlidersHorizontal color="#0E5A44" size={25} strokeWidth={2.4} />
              </View>
              <Text style={styles.additionalScreenTitle}>Ajustes adicionales</Text>
            </View>
            <Text style={styles.additionalSubtitle}>Completá los detalles para que otros sepan qué esperar.</Text>

            <AdditionalSection Icon={LockKeyhole} title="Privacidad">
              <View style={styles.additionalGrid}>
                {privacyDetails.map((item) => (
                  <AdditionalChoiceCard
                    active={privacy === item.label}
                    description={item.description}
                    Icon={item.Icon}
                    key={item.label}
                    label={item.label}
                    onPress={() => setPrivacy(item.label)}
                  />
                ))}
              </View>
            </AdditionalSection>

            <AdditionalSection Icon={UsersRound} title="Participantes">
              <View style={styles.participantsCard}>
                <Text style={styles.participantsLabel}>Cupos máximos (opcional)</Text>
                <View style={styles.participantsRow}>
                  <View style={styles.participantsStepper}>
                    <Pressable
                      accessibilityLabel="Restar cupo"
                      accessibilityRole="button"
                      onPress={() => setMaxParticipants((value) => Math.max(2, value - 1))}
                      style={styles.stepperButton}
                    >
                      <Minus color="#0E5A44" size={24} strokeWidth={2.5} />
                    </Pressable>
                    <Text style={styles.stepperValue}>{maxParticipants}</Text>
                    <Pressable
                      accessibilityLabel="Sumar cupo"
                      accessibilityRole="button"
                      onPress={() => setMaxParticipants((value) => Math.min(99, value + 1))}
                      style={styles.stepperButton}
                    >
                      <Plus color="#0E5A44" size={24} strokeWidth={2.5} />
                    </Pressable>
                  </View>
                  <Text style={styles.participantsHelp}>Incluyéndote a vos</Text>
                </View>
                <Text style={styles.participantsNote}>Podés cambiarlo más adelante.</Text>
              </View>
            </AdditionalSection>

            <AdditionalSection Icon={BarChart3} title="Nivel de la actividad">
              <View style={styles.levelGrid}>
                {levelDetails.map((item) => (
                  <AdditionalChoiceCard
                    active={level === item.label}
                    description={item.description}
                    Icon={item.Icon}
                    key={item.label}
                    label={item.label}
                    onPress={() => setLevel(item.label)}
                  />
                ))}
              </View>
            </AdditionalSection>

            <AdditionalSection Icon={Leaf} title="Tipo de ambiente">
              <View style={styles.environmentGrid}>
                {environmentDetails.map((item) => (
                  <EnvironmentCard
                    active={environment === item.label}
                    backgroundColor={item.backgroundColor}
                    color={item.color}
                    description={item.description}
                    Icon={item.Icon}
                    key={item.label}
                    label={item.label}
                    onPress={() => setEnvironment(item.label)}
                  />
                ))}
              </View>
            </AdditionalSection>

            <AdditionalSection Icon={Tag} title="Costo de la actividad">
              <View style={styles.additionalGrid}>
                {costDetails.map((item) => (
                  <AdditionalChoiceCard
                    active={cost === item.label}
                    description={item.description}
                    Icon={item.Icon}
                    key={item.label}
                    label={item.label}
                    onPress={() => setCostOption(item.label)}
                  />
                ))}
              </View>

              <View style={styles.priceRow}>
                <View style={styles.priceField}>
                  <Text style={styles.priceLabel}>Precio (opcional)</Text>
                  <TextInput
                    editable={cost !== 'Gratis'}
                    keyboardType="numeric"
                    onChangeText={setPrice}
                    placeholder="Ej: $2500"
                    placeholderTextColor="#7A8790"
                    style={[
                      styles.priceInput,
                      cost === 'Gratis' && styles.additionalDisabledInput,
                    ]}
                    underlineColorAndroid="transparent"
                    value={price}
                  />
                </View>
                <View style={styles.currencyField}>
                  <Text style={styles.priceLabel}>Moneda</Text>
                  <Pressable
                    accessibilityLabel="Seleccionar moneda"
                    accessibilityRole="button"
                    disabled={cost === 'Gratis'}
                    onPress={() => setPickerMode('currency')}
                    style={[
                      styles.currencyButton,
                      cost === 'Gratis' && styles.additionalDisabledInput,
                    ]}
                  >
                    <Text style={styles.currencyButtonText}>{currency}</Text>
                    <ChevronDown color="#0E5A44" size={20} strokeWidth={2.4} />
                  </Pressable>
                </View>
              </View>
            </AdditionalSection>

            <AdditionalSection Icon={Zap} title="Ajustes rápidos">
              <View style={styles.quickGrid}>
                {quickDetails.map((item) => (
                  <QuickCard
                    active={quickSettings.includes(item.label)}
                    description={item.description}
                    Icon={item.Icon}
                    key={item.label}
                    label={item.shortLabel}
                    onPress={() => toggleQuickSetting(item.label)}
                  />
                ))}
              </View>
            </AdditionalSection>

            <View style={styles.additionalTip}>
              <Lightbulb color="#0E5A44" size={22} strokeWidth={2.2} />
              <Text style={styles.additionalTipText}>Podés agregar más detalles en la descripción de tu actividad.</Text>
            </View>

            <Pressable
              accessibilityLabel="Continuar"
              accessibilityRole="button"
              onPress={returnToCreateActivity}
              style={styles.additionalContinueButton}
            >
              <Text style={styles.additionalContinueText}>Continuar</Text>
              <ArrowRight color="#FFFFFF" size={34} strokeWidth={2.2} style={styles.additionalContinueArrow} />
            </Pressable>
          </ScrollView>
        </View>
      ) : null}
    </SafeAreaView>
  )
}

type AdditionalSectionProps = {
  children: ReactNode
  Icon: LucideIcon
  title: string
}

function AdditionalSection({ children, Icon, title }: AdditionalSectionProps) {
  return (
    <View style={styles.additionalSection}>
      <View style={styles.additionalSectionHeader}>
        <Icon color="#0E5A44" size={25} strokeWidth={2.2} />
        <Text style={styles.additionalSectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  )
}

type AdditionalChoiceCardProps = {
  active: boolean
  description: string
  Icon: LucideIcon
  label: string
  onPress: () => void
}

function AdditionalChoiceCard({ active, description, Icon, label, onPress }: AdditionalChoiceCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.additionalChoiceCard,
        active && styles.additionalChoiceCardActive,
      ]}
    >
      <Icon color="#0E5A44" size={31} strokeWidth={2.1} />
      <View style={styles.additionalChoiceCopy}>
        <Text style={styles.additionalChoiceTitle}>{label}</Text>
        <Text style={styles.additionalChoiceDescription}>{description}</Text>
      </View>
      {active ? <View style={styles.additionalCheck}><Text style={styles.additionalCheckText}>✓</Text></View> : null}
    </Pressable>
  )
}

type EnvironmentCardProps = AdditionalChoiceCardProps & {
  backgroundColor: string
  color: string
}

function EnvironmentCard({ active, backgroundColor, color, description, Icon, label, onPress }: EnvironmentCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.environmentCard,
        { backgroundColor, borderColor: active ? color : '#E2E6E3' },
      ]}
    >
      <Icon color={color} size={32} strokeWidth={2.2} />
      <Text style={[styles.environmentTitle, { color }]}>{label}</Text>
      <Text style={styles.environmentDescription}>{description}</Text>
      {active ? <View style={[styles.additionalCheck, styles.environmentCheck]}><Text style={styles.additionalCheckText}>✓</Text></View> : null}
    </Pressable>
  )
}

type QuickCardProps = {
  active: boolean
  description: string
  Icon: LucideIcon
  label: string
  onPress: () => void
}

function QuickCard({ active, description, Icon, label, onPress }: QuickCardProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[styles.quickCard, active && styles.additionalChoiceCardActive]}
    >
      <Icon color="#0E5A44" size={28} strokeWidth={2.2} />
      <View style={styles.quickCopy}>
        <Text style={styles.quickTitle}>{label}</Text>
        <Text style={styles.quickDescription}>{description}</Text>
      </View>
      {active ? <View style={styles.quickCheck}><Text style={styles.additionalCheckText}>✓</Text></View> : null}
    </Pressable>
  )
}

function FallbackMapArtwork() {
  return (
    <View pointerEvents="none" style={styles.fallbackMapArtwork}>
      <View style={[styles.fallbackMapRoad, styles.fallbackMapRoadOne]} />
      <View style={[styles.fallbackMapRoad, styles.fallbackMapRoadTwo]} />
      <View style={[styles.fallbackMapRoad, styles.fallbackMapRoadThree]} />
      <View style={[styles.fallbackMapRoad, styles.fallbackMapRoadFour]} />
      <View style={styles.fallbackMapPark}>
        <Text style={styles.fallbackMapParkText}>Zona del encuentro</Text>
      </View>
    </View>
  )
}

type MapConfigNoticeProps = {
  compact?: boolean
}

function MapConfigNotice({ compact = false }: MapConfigNoticeProps) {
  return (
    <View pointerEvents="none" style={[styles.mapConfigNotice, compact && styles.mapConfigNoticeCompact]}>
      <Text style={[styles.mapFallbackTitle, compact && styles.mapFallbackTitleCompact]}>
        Google Maps requiere API key en Android
      </Text>
      {!compact ? (
        <Text style={styles.mapFallbackText}>
          Agregá EXPO_PUBLIC_GOOGLE_MAPS_API_KEY y reconstruí la Development Build.
          Mientras tanto podés tocar el plano para mover el punto.
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FCFAF3' },
  scrollContent: { flexGrow: 1 },
  createLoadingState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  createScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  groupCreatedScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
  },
  createHeader: {
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBackButton: {
    position: 'absolute',
    left: 0,
    top: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createLogo: {
    alignItems: 'center',
  },
  createTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  groupCreatedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  createScreenTitle: {
    color: '#0E5A44',
    fontSize: 31,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: 0,
  },
  createSubtitle: {
    color: '#34445F',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
    marginBottom: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  groupContextChip: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F3EEFF',
    borderColor: '#D8C7F5',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  groupContextChipText: {
    color: '#3A256A',
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
  },
  createStepPills: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 18,
  },
  createStepPill: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DED9',
    borderWidth: 1,
  },
  createStepPillActive: {
    backgroundColor: '#0E5A44',
    borderColor: '#0E5A44',
  },
  createStepPillDone: {
    backgroundColor: '#E9F4D9',
    borderColor: '#98C870',
  },
  createStepPillText: {
    color: '#63706A',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
  },
  createStepPillTextActive: {
    color: '#FFFFFF',
  },
  createStepPillTextDone: {
    color: '#0E5A44',
  },
  createCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E6E3',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0E5A44',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  createChoiceStack: {
    gap: 14,
    marginTop: 4,
  },
  createChoiceCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE8E1',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 132,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#0E5A44',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  createChoiceCardGroup: {
    borderColor: '#E2D9F3',
  },
  createChoiceCopy: {
    flex: 1,
    minWidth: 0,
  },
  createChoiceDescription: {
    color: '#34445F',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: 5,
  },
  createChoiceExamples: {
    color: '#6A756F',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 19,
    marginTop: 6,
  },
  createChoiceIcon: {
    alignItems: 'center',
    backgroundColor: '#EAF6E8',
    borderColor: '#CFE8CA',
    borderRadius: 999,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  createChoiceIconGroup: {
    backgroundColor: '#F3EEFF',
    borderColor: '#DFD2F6',
  },
  createChoiceTitle: {
    color: '#0E5A44',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 24,
  },
  createChoiceTip: {
    alignItems: 'flex-start',
    backgroundColor: '#F3F8EF',
    borderColor: '#D9EAD2',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  createChoiceTipText: {
    color: '#2F5148',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 20,
  },
  groupCreatedCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E6E3',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 18,
    paddingHorizontal: 18,
    paddingVertical: 24,
    shadowColor: '#0E5A44',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  groupCreatedIcon: {
    alignItems: 'center',
    backgroundColor: '#E9F4D9',
    borderColor: '#C9E2B5',
    borderRadius: 999,
    borderWidth: 1,
    height: 70,
    justifyContent: 'center',
    marginBottom: 14,
    width: 70,
  },
  groupCreatedName: {
    color: '#0E5A44',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
    marginBottom: 8,
    textAlign: 'center',
  },
  groupCreatedCopy: {
    color: '#34445F',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 14,
    textAlign: 'center',
  },
  groupCreatedStats: {
    backgroundColor: '#F4F8F1',
    borderColor: '#DDE8D3',
    borderRadius: 999,
    borderWidth: 1,
    color: '#0E5A44',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 8,
    textAlign: 'center',
  },
  groupCreatedActions: {
    gap: 10,
  },
  createFieldLabel: {
    color: '#34445F',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginBottom: 7,
  },
  createTextInput: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E6E3',
    backgroundColor: '#FCFAF8',
    color: '#123F38',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    includeFontPadding: false,
    paddingHorizontal: 14,
    paddingVertical: 0,
    textAlignVertical: 'center',
    marginBottom: 14,
  },
  activitySearchField: {
    alignItems: 'center',
    backgroundColor: '#FCFAF8',
    borderColor: '#E2E6E3',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  activitySearchInput: {
    color: '#123F38',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 20,
    minHeight: 52,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  activitySearchResults: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E6E3',
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginBottom: 14,
    padding: 8,
  },
  activitySearchResult: {
    alignItems: 'center',
    backgroundColor: '#FCFAF8',
    borderColor: '#EDF0EC',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activitySearchIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  activitySearchCopy: {
    flex: 1,
    minWidth: 0,
  },
  activitySearchTitle: {
    color: '#123F38',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 19,
  },
  activitySearchCategory: {
    color: '#5B6E66',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 16,
    marginTop: 2,
  },
  createDescriptionInput: {
    minHeight: 116,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: 'top',
  },
  createCounterText: {
    alignSelf: 'flex-end',
    color: '#34445F',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: -8,
  },
  groupPickerBlock: {
    marginTop: 18,
  },
  groupOptionCard: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E6E3',
    backgroundColor: '#FCFAF8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  groupOptionCardActive: {
    borderColor: '#168A37',
    backgroundColor: '#F2FAF3',
  },
  groupOptionCopy: {
    flex: 1,
    minWidth: 0,
  },
  groupOptionMembersRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 4,
  },
  groupOptionMembersText: {
    color: '#6A756F',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 16,
  },
  groupOptionText: {
    color: '#34445F',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  groupOptionTextActive: {
    color: '#0E5A44',
  },
  groupCreateCard: {
    borderStyle: 'dashed',
    borderColor: '#98C870',
    backgroundColor: '#F7FBF2',
  },
  groupCreateText: {
    color: '#0E5A44',
  },
  createTwoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  createColumn: {
    flex: 1,
  },
  createSelectField: {
    alignItems: 'center',
    backgroundColor: '#FCFAF8',
    borderColor: '#E2E6E3',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  createSelectText: {
    flex: 1,
    color: '#0E5A44',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    marginRight: 8,
  },
  createPlaceholder: {
    flex: 1,
    color: '#7A8790',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginRight: 8,
  },
  createSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createSectionTitle: {
    color: '#0E5A44',
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 12,
  },
  createMapCard: {
    height: 220,
    minHeight: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E6E3',
    backgroundColor: '#F1F8EF',
    overflow: 'hidden',
    marginBottom: 12,
  },
  createMapPreview: {
    width: '100%',
    height: '100%',
  },
  createMapEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createMapFallbackPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  createMapEmptyText: {
    color: '#0E5A44',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
    marginTop: 8,
  },
  groupPhotoPicker: {
    alignItems: 'center',
    backgroundColor: '#F7F3FF',
    borderColor: '#E2D4FA',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 172,
    overflow: 'hidden',
    width: '100%',
  },
  groupPhotoPickerWithImage: {
    aspectRatio: 16 / 9,
    backgroundColor: '#F0F4EF',
    minHeight: 0,
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
    paddingVertical: 18,
  },
  groupPhotoIcon: {
    alignItems: 'center',
    backgroundColor: '#EFE7FA',
    borderColor: '#D9C8F4',
    borderRadius: 999,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  groupPhotoTitle: {
    color: '#193F37',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  groupPhotoActionText: {
    color: '#4B348A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'center',
  },
  groupPhotoActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  groupPhotoChangeButton: {
    alignItems: 'center',
    backgroundColor: '#F5F0FF',
    borderColor: '#D9CBF6',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  groupPhotoChangeText: {
    color: '#4B348A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
  },
  groupPhotoRemoveButton: {
    alignItems: 'center',
    backgroundColor: '#FFF4F4',
    borderColor: '#F2B8B5',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  groupPhotoRemoveText: {
    color: '#B42318',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
  },
  mapConfigNotice: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFE4CE',
    backgroundColor: 'rgba(248,252,246,0.94)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  mapConfigNoticeCompact: {
    top: 10,
    left: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mapFallbackTitle: {
    color: '#0E5A44',
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
    textAlign: 'center',
  },
  mapFallbackTitleCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  mapFallbackText: {
    color: '#34445F',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  fallbackMapArtwork: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EEF4E7',
    overflow: 'hidden',
  },
  fallbackMapRoad: {
    position: 'absolute',
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: '#DDE4D8',
    borderWidth: 1,
  },
  fallbackMapRoadOne: {
    left: -36,
    right: -20,
    top: '24%',
    transform: [{ rotate: '-18deg' }],
  },
  fallbackMapRoadTwo: {
    left: -20,
    right: -48,
    top: '58%',
    transform: [{ rotate: '16deg' }],
  },
  fallbackMapRoadThree: {
    left: '22%',
    width: 18,
    top: -20,
    bottom: -20,
    height: '118%',
    transform: [{ rotate: '10deg' }],
  },
  fallbackMapRoadFour: {
    right: '18%',
    width: 18,
    top: -20,
    bottom: -20,
    height: '118%',
    transform: [{ rotate: '-12deg' }],
  },
  fallbackMapPark: {
    position: 'absolute',
    left: 22,
    top: 26,
    minWidth: 118,
    minHeight: 66,
    borderRadius: 16,
    backgroundColor: '#D9EDC5',
    borderColor: '#B9D99A',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  fallbackMapParkText: {
    color: '#2F6E3D',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  createLocationField: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E6E3',
    backgroundColor: '#FCFAF8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  createAdditionalCard: {
    minHeight: 82,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D7E7D7',
    backgroundColor: '#F1F8EF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  createAdditionalCopy: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  createAdditionalSubtitle: {
    color: '#34445F',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  createMessageText: {
    color: '#B42318',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  createSubmitButton: {
    minHeight: 66,
    borderRadius: 20,
    backgroundColor: '#00613F',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    shadowColor: '#00613F',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  createSubmitButtonDisabled: {
    opacity: 0.72,
  },
  createSecondaryButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#B8C8BF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  createSecondaryText: {
    color: '#0E5A44',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  createSubmitText: {
    color: '#FFFFFF',
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: 0,
  },
  createSubmitArrow: {
    position: 'absolute',
    right: 24,
  },
  image: { flex: 1, minHeight: '100%', width: '100%' },
  backHitArea: { position: 'absolute', left: '4%', top: '2%', height: '6%', width: '12%' },
  input: {
    flex: 1,
    height: '100%',
    color: '#123F38',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 0,
    includeFontPadding: false,
    paddingHorizontal: 0,
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    textAlignVertical: 'center',
  },
  nameInputShell: {
    position: 'absolute',
    left: '13%',
    right: '7%',
    top: '24%',
    height: '2.8%',
    justifyContent: 'center',
  },
  categoryHitArea: { position: 'absolute', left: '3.5%', top: '28.5%', width: '46%', height: '4.5%', justifyContent: 'flex-end', paddingLeft: '10%', paddingBottom: 4 },
  subcategoryHitArea: { position: 'absolute', right: '3.7%', top: '28.5%', width: '46%', height: '4.5%', justifyContent: 'flex-end', paddingLeft: '9%', paddingRight: '8%', paddingBottom: 8 },
  subcategoryPlaceholderPatch: { position: 'absolute', left: '60%', top: '29.2%', width: '22%', height: '2.4%', backgroundColor: '#FFFFFF', justifyContent: 'center' },
  placeholderPatchText: { color: '#34445F', fontSize: 18, fontWeight: '500', letterSpacing: 0 },
  descriptionInputShell: {
    position: 'absolute',
    left: '13%',
    right: '12%',
    top: '37.9%',
    height: '5.5%',
  },
  descriptionInput: {
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  counterText: { position: 'absolute', right: '7%', top: '41.3%', color: '#34445F', fontSize: 16, lineHeight: 20, fontWeight: '600' },
  dateHitArea: { position: 'absolute', left: '3.7%', top: '49.2%', width: '46%', height: '4.9%', justifyContent: 'flex-end', paddingLeft: '13%', paddingBottom: 9 },
  timeHitArea: { position: 'absolute', right: '3.7%', top: '49.2%', width: '46%', height: '4.9%', justifyContent: 'flex-end', paddingLeft: '13%', paddingBottom: 9 },
  mapHitArea: { position: 'absolute', left: '5%', right: '5%', top: '58.2%', height: '12.2%' },
  mapPreview: {
    position: 'absolute',
    left: '5%',
    right: '5%',
    top: '58.2%',
    height: '12.2%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapPreviewMap: {
    flex: 1,
  },
  locationHitArea: { position: 'absolute', left: '5%', right: '5%', top: '70.1%', height: '4.7%', justifyContent: 'center', alignItems: 'center' },
  additionalTitlePatch: { position: 'absolute', left: '9%', top: '77.3%', width: '45%', height: '3%', backgroundColor: '#FCFAF8', justifyContent: 'center' },
  additionalTitle: { color: '#0E5A44', fontSize: 18, fontWeight: '900', letterSpacing: 0 },
  additionalHitArea: { position: 'absolute', left: '3.5%', right: '3.5%', top: '80.7%', height: '5.8%' },
  messageText: { position: 'absolute', left: '8%', right: '8%', top: '88.2%', color: '#B42318', fontSize: 13, lineHeight: 17, fontWeight: '800', textAlign: 'center' },
  createHitArea: { position: 'absolute', left: '3.5%', right: '3.5%', top: '92%', height: '5.8%', alignItems: 'center', justifyContent: 'center' },
  additionalScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FCFAF3',
    elevation: 20,
    zIndex: 20,
  },
  additionalScrollContent: {
    flexGrow: 1,
    paddingBottom: 72,
    paddingHorizontal: 16,
    paddingTop: 28,
  },
  additionalHeader: {
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  additionalBackButton: {
    position: 'absolute',
    left: 0,
    top: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  additionalLogo: {
    alignItems: 'center',
  },
  additionalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  additionalTitleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#EFF7EB',
  },
  additionalScreenTitle: {
    color: '#0E5A44',
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '900',
    letterSpacing: 0,
  },
  additionalSubtitle: {
    color: '#34445F',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
    marginBottom: 26,
    marginTop: 8,
    textAlign: 'center',
  },
  additionalSection: {
    marginBottom: 26,
  },
  additionalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  additionalSectionTitle: {
    color: '#0E5A44',
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: 0,
    marginLeft: 12,
  },
  additionalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  additionalChoiceCard: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 116,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E6E3',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  additionalChoiceCardActive: {
    borderColor: '#70B97A',
    backgroundColor: '#F1FAF0',
  },
  additionalChoiceCopy: {
    marginTop: 10,
  },
  additionalChoiceTitle: {
    color: '#14211D',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
    letterSpacing: 0,
  },
  additionalChoiceDescription: {
    color: '#34445F',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginTop: 3,
  },
  additionalCheck: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#168A37',
  },
  additionalCheckText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '900',
  },
  participantsCard: {
    minHeight: 136,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E6E3',
    backgroundColor: '#FFFFFF',
    padding: 18,
  },
  participantsLabel: {
    color: '#34445F',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  participantsStepper: {
    width: 188,
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E6E3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  stepperButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    color: '#168A37',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  participantsHelp: {
    flex: 1,
    color: '#34445F',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginLeft: 14,
  },
  participantsNote: {
    color: '#34445F',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 10,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  environmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  environmentCard: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 128,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 13,
  },
  environmentTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 8,
    textAlign: 'center',
  },
  environmentDescription: {
    color: '#34445F',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  environmentCheck: {
    right: 8,
    top: 8,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  priceField: {
    flex: 1.4,
  },
  currencyField: {
    flex: 0.9,
  },
  priceLabel: {
    color: '#34445F',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  priceInput: {
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E6E3',
    backgroundColor: '#FFFFFF',
    color: '#123F38',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    paddingHorizontal: 14,
    paddingVertical: 0,
  },
  currencyButton: {
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E6E3',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  currencyButtonText: {
    color: '#0E5A44',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 82,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E6E3',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quickCopy: {
    flex: 1,
    marginLeft: 10,
  },
  quickTitle: {
    color: '#0E5A44',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  quickDescription: {
    color: '#34445F',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  quickCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#168A37',
  },
  additionalTip: {
    minHeight: 58,
    borderRadius: 13,
    backgroundColor: '#F1F8EF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  additionalTipText: {
    flex: 1,
    color: '#0E5A44',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    marginLeft: 12,
  },
  additionalContinueButton: {
    minHeight: 70,
    borderRadius: 20,
    backgroundColor: '#00613F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  additionalContinueText: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  additionalContinueArrow: {
    position: 'absolute',
    right: 28,
  },
  additionalBackHitArea: { position: 'absolute', left: '4%', top: '2%', height: '6%', width: '12%' },
  additionalOptionHitArea: { position: 'absolute', alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 6, paddingRight: 7 },
  additionalSelectedBadge: { width: 18, height: 18, borderRadius: 999, backgroundColor: '#188A2D', borderColor: '#FFFFFF', borderWidth: 2 },
  privacyOne: { left: '4%', top: '18.2%', width: '30%', height: '7.5%' },
  privacyTwo: { left: '36.5%', top: '18.2%', width: '27%', height: '7.5%' },
  privacyThree: { left: '65.5%', top: '18.2%', width: '28.5%', height: '7.5%' },
  participantsMinusHitArea: { position: 'absolute', left: '7%', top: '33.7%', width: '8%', height: '4%' },
  participantsPlusHitArea: { position: 'absolute', left: '29%', top: '33.7%', width: '8%', height: '4%' },
  participantsText: { position: 'absolute', left: '18%', top: '34.15%', width: '6%', color: '#0E7A28', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  levelOne: { left: '4%', top: '43.2%', width: '20.5%', height: '7.5%' },
  levelTwo: { left: '26.7%', top: '43.2%', width: '21.5%', height: '7.5%' },
  levelThree: { left: '50.2%', top: '43.2%', width: '20.2%', height: '7.5%' },
  levelFour: { left: '72.3%', top: '43.2%', width: '22%', height: '7.5%' },
  environmentOne: { left: '4%', top: '55.7%', width: '16%', height: '9%' },
  environmentTwo: { left: '22%', top: '55.7%', width: '16%', height: '9%' },
  environmentThree: { left: '40.1%', top: '55.7%', width: '16%', height: '9%' },
  environmentFour: { left: '58.2%', top: '55.7%', width: '17%', height: '9%' },
  environmentFive: { left: '76.8%', top: '55.7%', width: '17%', height: '9%' },
  costOne: { left: '4%', top: '69.1%', width: '28.6%', height: '7.4%' },
  costTwo: { left: '34.7%', top: '69.1%', width: '28.6%', height: '7.4%' },
  costThree: { left: '65.5%', top: '69.1%', width: '28.6%', height: '7.4%' },
  additionalPriceInput: { position: 'absolute', left: '38.8%', top: '78.2%', width: '29.8%', height: '4.2%', color: '#123F38', fontSize: 16, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 0 },
  additionalDisabledInput: { opacity: 0.3 },
  currencyHitArea: { position: 'absolute', left: '71%', top: '78.2%', width: '19.5%', height: '4.2%', justifyContent: 'center', paddingLeft: 12 },
  currencyText: { color: '#0E5A44', fontSize: 16, fontWeight: '900' },
  quickOne: { left: '4%', top: '86.9%', width: '22%', height: '5.4%' },
  quickTwo: { left: '28%', top: '86.9%', width: '20.5%', height: '5.4%' },
  quickThree: { left: '50.2%', top: '86.9%', width: '20.5%', height: '5.4%' },
  quickFour: { left: '72.4%', top: '86.9%', width: '22%', height: '5.4%' },
  additionalContinueHitArea: { position: 'absolute', left: '4%', right: '4%', top: '96%', height: '4.8%' },
  selectedPill: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    flexShrink: 1,
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectedText: { flexShrink: 1, fontSize: 14, lineHeight: 18, fontWeight: '900' },
  selectedFieldText: { color: '#0E5A44', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  locationText: { color: '#0E5A44', fontSize: 18, lineHeight: 22, fontWeight: '900', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '82%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20 },
  modalTitle: { color: '#0E5A44', fontSize: 20, fontWeight: '900', marginBottom: 14, textAlign: 'center' },
  modalOptionsContent: { paddingBottom: 18 },
  optionRow: { borderRadius: 16, marginBottom: 10, paddingHorizontal: 16, paddingVertical: 14 },
  optionText: { color: '#123F38', fontSize: 17, fontWeight: '800' },
  groupModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  groupModalAvoidingView: {
    flex: 1,
  },
  groupModalPrimaryButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: '#00613F',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  groupModalPrimaryText: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  groupModalSecondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  groupModalSecondaryText: {
    color: '#0E5A44',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  categoryOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calendarPicker: {
    paddingBottom: 4,
  },
  calendarHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarNavButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthTitle: {
    color: '#0E5A44',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekText: {
    flex: 1,
    color: '#6D7975',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  calendarDayToday: {
    backgroundColor: '#EFF7EB',
  },
  calendarDaySelected: {
    backgroundColor: '#00613F',
  },
  calendarDayText: {
    color: '#123F38',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
  },
  locationPickerScreen: {
    backgroundColor: '#FCFAF3',
    flex: 1,
  },
  locationPickerHeader: {
    alignItems: 'center',
    backgroundColor: '#FCFAF3',
    flexDirection: 'row',
    minHeight: 76,
    paddingBottom: 12,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  locationPickerBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  locationPickerBackText: {
    color: '#0E5A44',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '500',
  },
  locationPickerCopy: {
    flex: 1,
  },
  locationPickerTitle: {
    color: '#0E5A44',
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: 0,
  },
  locationPickerSubtitle: {
    color: '#34445F',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 3,
  },
  locationPickerMap: {
    width: '100%',
    height: '100%',
  },
  locationPickerMapFrame: {
    backgroundColor: '#E7E2D8',
    borderRadius: 22,
    height: 340,
    marginHorizontal: 18,
    minHeight: 260,
    overflow: 'hidden',
  },
  locationCenterPin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -19,
    marginTop: -38,
  },
  locationFallbackMap: {
    alignItems: 'center',
    backgroundColor: '#EEF4E7',
    flex: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: 20,
    width: '100%',
  },
  locationPickerFooter: {
    backgroundColor: '#FCFAF3',
    borderTopColor: '#E6E0D6',
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  locationPickerHint: {
    color: '#34445F',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmLocationButton: {
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: '#00613F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLocationText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
})

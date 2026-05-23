import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Car,
  ChevronDown,
  CloudRain,
  Dumbbell,
  Globe2,
  Heart,
  Leaf,
  Lightbulb,
  LockKeyhole,
  MapPin,
  Minus,
  PawPrint,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  UsersRound,
  WalletCards,
  Zap,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import MapView, { Marker, type Region } from 'react-native-maps'

import { getFirebaseServices } from '../../firebaseConfig'

const createActivityImage = require('../../assets/images/create-activity-fullscreen.png')
const additionalSettingsImage = require('../../assets/images/additional-settings-fullscreen.png')

type CategoryId = 'outdoor' | 'sports' | 'wellness' | 'groups' | 'private'
type PickerMode = 'category' | 'subcategory' | 'date' | 'time' | 'currency' | null

type Category = {
  id: CategoryId
  label: string
  icon: string
  color: string
  backgroundColor: string
  subcategories: string[]
}

type LocationSelection = {
  address: string
  latitude: number
  longitude: number
}

const categories: Category[] = [
  {
    id: 'outdoor',
    label: 'Al aire libre',
    icon: '🌿',
    color: '#0E5A44',
    backgroundColor: '#E9F4D9',
    subcategories: [
      'Caminatas',
      'Trekking',
      'Running',
      'Kayak',
      'Stand Up Paddle',
      'Pesca',
      'Camping',
      'Mountain Bike',
      'Avistaje',
      'Picnic',
      'Paseos',
      'Escalada outdoor',
    ],
  },
  {
    id: 'sports',
    label: 'Deportes',
    icon: '⚽',
    color: '#16823A',
    backgroundColor: '#DDF2D8',
    subcategories: [
      'Fútbol',
      'Paddle',
      'Tenis',
      'Básquet',
      'Hockey',
      'Natación',
      'Crossfit',
      'Calistenia',
      'Funcional',
      'Ciclismo',
      'Vóley',
    ],
  },
  {
    id: 'wellness',
    label: 'Bienestar',
    icon: '🧘',
    color: '#2F8D5A',
    backgroundColor: '#EAF7E4',
    subcategories: [
      'Yoga',
      'Meditación',
      'SupYoga',
      'Respiración',
      'Relax',
      'Mindfulness',
      'Stretching',
      'Tai Chi',
      'Sound Healing',
      'Terapias holísticas',
    ],
  },
  {
    id: 'groups',
    label: 'Grupales',
    icon: '👥',
    color: '#2A9B37',
    backgroundColor: '#E2F4DD',
    subcategories: [
      'Mateadas',
      'Juegos de mesa',
      'Charlas',
      'Networking',
      'Voluntariado',
      'Clubes',
      'Idiomas',
      'Intercambio cultural',
      'After office',
      'Salidas grupales',
    ],
  },
  {
    id: 'private',
    label: 'Espacios privados',
    icon: '🏠',
    color: '#543D78',
    backgroundColor: '#F2ECF8',
    subcategories: [
      'Escalada indoor',
      'Gimnasio',
      'Canchas privadas',
      'Pool',
      'Bowling',
      'Sala de ensayo',
      'Workshops',
      'Coworking',
      'Cocina',
      'Arte',
    ],
  },
]

const dateOptions = ['Hoy', 'Mañana', 'Pasado mañana', 'Próxima semana']
const currencyOptions = ['ARS', 'USD', 'UYU', 'BRL', 'EUR']
const initialLocationRegion: Region = {
  latitude: -34.4251,
  longitude: -58.5797,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
}

const additionalOptions = {
  privacy: ['Pública', 'Privada', 'Con aprobación'],
  level: ['Principiante', 'Intermedio', 'Avanzado', 'Todos los niveles'],
  environment: ['Tranquilo', 'Social', 'Deportivo', 'Familiar', 'Relax'],
  cost: ['Gratis', 'A la gorra', 'Pago'],
  quick: ['Mascotas permitidas', 'Lluvia se suspende', 'Tengo lugar en auto', 'Punto de encuentro'],
}

const privacyDetails = [
  { label: 'Pública', description: 'Cualquiera puede ver y sumarse', Icon: Globe2 },
  { label: 'Privada', description: 'Solo personas invitadas', Icon: LockKeyhole },
  { label: 'Con aprobación', description: 'Debo aprobar participantes', Icon: ShieldCheck },
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

const timeOptions = generateTimeOptions(8, 22, 30)

function getQuickDateValue(option: string) {
  const dateValue = new Date()

  if (option === 'Mañana') {
    dateValue.setDate(dateValue.getDate() + 1)
  }

  if (option === 'Pasado mañana') {
    dateValue.setDate(dateValue.getDate() + 2)
  }

  if (option === 'Próxima semana') {
    dateValue.setDate(dateValue.getDate() + 7)
  }

  return formatDate(dateValue)
}

function formatCoordinateAddress(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}

function getAddressFromGeocode(place: Location.LocationGeocodedAddress) {
  return [
    place.name,
    place.street,
    place.city || place.district,
    place.region,
  ].filter(Boolean).join(', ')
}

function getCreateError(error: unknown) {
  if (error instanceof Error && error.message.includes('Faltan variables')) {
    return 'Falta configurar Firebase.'
  }

  if (typeof error === 'object' && error && 'code' in error) {
    const code = String(error.code)

    if (code === 'auth/no-current-user') return 'No encontramos una sesión activa.'
    if (code === 'permission-denied') return 'No tenemos permiso para crear la actividad.'
    if (code === 'unavailable' || code === 'deadline-exceeded') return 'No pudimos conectar con Firestore.'
  }

  return 'No pudimos crear la actividad.'
}

export default function CrearScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [subcategory, setSubcategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<LocationSelection | null>(null)
  const [mapRegion, setMapRegion] = useState<Region>(initialLocationRegion)
  const [draftPin, setDraftPin] = useState({
    latitude: initialLocationRegion.latitude,
    longitude: initialLocationRegion.longitude,
  })
  const [pickerMode, setPickerMode] = useState<PickerMode>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [isAdditionalVisible, setIsAdditionalVisible] = useState(false)
  const [isLocationPickerVisible, setIsLocationPickerVisible] = useState(false)
  const [isResolvingLocation, setIsResolvingLocation] = useState(false)
  const [privacy, setPrivacy] = useState('Pública')
  const [maxParticipants, setMaxParticipants] = useState(10)
  const [level, setLevel] = useState('Principiante')
  const [environment, setEnvironment] = useState('Tranquilo')
  const [cost, setCost] = useState('Gratis')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('ARS')
  const [quickSettings, setQuickSettings] = useState(['Mascotas permitidas'])

  const subcategoryOptions = useMemo(
    () => category?.subcategories ?? [],
    [category],
  )

  const pickerTitle = useMemo(() => {
    if (pickerMode === 'category') return 'Elegí una categoría'
    if (pickerMode === 'subcategory') return 'Elegí una subcategoría'
    if (pickerMode === 'date') return 'Elegí una fecha'
    if (pickerMode === 'time') return 'Elegí una hora'
    if (pickerMode === 'currency') return 'Elegí una moneda'
    return ''
  }, [pickerMode])

  const openGoogleMaps = async () => {
    const query = encodeURIComponent(selectedLocation
      ? `${selectedLocation.latitude},${selectedLocation.longitude}`
      : (location || 'Parque Sarmiento Buenos Aires'))

    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`)
  }

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

  const createActivity = async () => {
    if (!name.trim() || !category || !subcategory || !description.trim() || !date || !time || !selectedLocation) {
      setMessage('Completá todos los campos para crear la actividad.')
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

      await addDoc(collection(db, 'activities'), {
        name: name.trim(),
        category: category.label,
        categoryId: category.id,
        categoryColor: category.color,
        categoryIcon: category.icon,
        subcategory,
        description: description.trim(),
        date,
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
        additionalSettings: {
          privacy,
          maxParticipants,
          level,
          environment,
          cost,
          price: cost === 'Gratis' ? '' : price.trim(),
          currency: cost === 'Gratis' ? '' : currency,
          quickSettings,
        },
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      router.replace('/home')
    } catch (error) {
      setMessage(getCreateError(error))
    } finally {
      setIsSaving(false)
    }
  }

  const selectOption = (value: string | Category) => {
    if (pickerMode === 'category' && typeof value !== 'string') {
      setCategory(value)
      setSubcategory('')
    }

    if (pickerMode === 'subcategory' && typeof value === 'string') setSubcategory(value)
    if (pickerMode === 'date' && typeof value === 'string') setDate(getQuickDateValue(value))
    if (pickerMode === 'time' && typeof value === 'string') setTime(value)
    if (pickerMode === 'currency' && typeof value === 'string') setCurrency(value)

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

  const returnToCreateActivity = () => {
    setPickerMode(null)
    setIsAdditionalVisible(false)
  }

  const safeBackStyle = { top: Math.max(insets.top + 8, 18) }
  const safeCreateStyle = { bottom: Math.max(insets.bottom + 12, 18), top: undefined }
  const safeAdditionalScrollStyle = {
    paddingBottom: Math.max(insets.bottom + 28, 38),
    paddingTop: Math.max(insets.top + 18, 28),
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ImageBackground source={createActivityImage} resizeMode="stretch" style={styles.image}>
        <Pressable accessibilityLabel="Volver" accessibilityRole="button" onPress={() => router.back()} style={[styles.backHitArea, safeBackStyle]} />

        <View style={styles.nameInputShell}>
          <TextInput
            maxLength={70}
            onChangeText={setName}
            placeholder=""
            style={styles.input}
            underlineColorAndroid="transparent"
            value={name}
          />
        </View>

        <Pressable accessibilityLabel="Seleccionar categoría" accessibilityRole="button" onPress={() => setPickerMode('category')} style={styles.categoryHitArea}>
          {category ? (
            <View style={[styles.selectedPill, { backgroundColor: category.backgroundColor }]}>
              <Text style={[styles.selectedText, { color: category.color }]}>{category.icon} {category.label}</Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          accessibilityLabel="Seleccionar subcategoría"
          accessibilityRole="button"
          onPress={() => setPickerMode(category ? 'subcategory' : 'category')}
          style={styles.subcategoryHitArea}
        >
          {subcategory ? <Text numberOfLines={1} style={styles.selectedFieldText}>{subcategory}</Text> : null}
        </Pressable>
        {!subcategory ? (
          <View pointerEvents="none" style={styles.subcategoryPlaceholderPatch}>
            <Text style={styles.placeholderPatchText}>Subcategoría</Text>
          </View>
        ) : null}

        <View style={styles.descriptionInputShell}>
          <TextInput
            maxLength={300}
            multiline
            onChangeText={setDescription}
            placeholder=""
            style={[styles.input, styles.descriptionInput]}
            textAlignVertical="top"
            underlineColorAndroid="transparent"
            value={description}
          />
        </View>
        <Text style={styles.counterText}>{description.length}/300</Text>

        <Pressable accessibilityLabel="Seleccionar fecha" accessibilityRole="button" onPress={() => setPickerMode('date')} style={styles.dateHitArea}>
          {date ? <Text style={styles.selectedFieldText}>{date}</Text> : null}
        </Pressable>

        <Pressable accessibilityLabel="Seleccionar hora" accessibilityRole="button" onPress={() => setPickerMode('time')} style={styles.timeHitArea}>
          {time ? <Text style={styles.selectedFieldText}>{time}</Text> : null}
        </Pressable>

        {selectedLocation ? (
          <View pointerEvents="none" style={styles.mapPreview}>
            <MapView
              initialRegion={{
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                latitudeDelta: 0.018,
                longitudeDelta: 0.018,
              }}
              scrollEnabled={false}
              style={styles.mapPreviewMap}
              zoomEnabled={false}
            >
              <Marker
                coordinate={{
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude,
                }}
                pinColor="#0E5A44"
              />
            </MapView>
          </View>
        ) : null}

        <Pressable
          accessibilityLabel={selectedLocation ? 'Abrir Google Maps' : 'Seleccionar ubicación en el mapa'}
          accessibilityRole="button"
          onPress={selectedLocation ? openGoogleMaps : openLocationPicker}
          style={styles.mapHitArea}
        />

        <Pressable accessibilityLabel="Seleccionar ubicación" accessibilityRole="button" onPress={openLocationPicker} style={styles.locationHitArea}>
          {location ? <Text style={styles.locationText}>{location}</Text> : null}
        </Pressable>

        <View pointerEvents="none" style={styles.additionalTitlePatch}>
          <Text style={styles.additionalTitle}>Ajustes adicionales</Text>
        </View>

        <Pressable
          accessibilityLabel="Abrir ajustes adicionales"
          accessibilityRole="button"
          onPress={() => setIsAdditionalVisible(true)}
          style={styles.additionalHitArea}
        />

        {message ? <Text style={styles.messageText}>{message}</Text> : null}

        <Pressable accessibilityLabel="Crear actividad" accessibilityRole="button" disabled={isSaving} onPress={createActivity} style={[styles.createHitArea, safeCreateStyle]}>
          {isSaving ? <ActivityIndicator color="#FFFFFF" /> : null}
        </Pressable>

        {isAdditionalVisible ? (
          <View style={styles.additionalScreen}>
            <ScrollView
              contentContainerStyle={[styles.additionalScrollContent, safeAdditionalScrollStyle]}
              keyboardShouldPersistTaps="handled"
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
                  <Text style={styles.additionalLogoText}>OC</Text>
                  <Text style={styles.additionalLogoBrand}>coincidir</Text>
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

        {false && isAdditionalVisible ? (
          <View style={styles.additionalScreen}>
            <ImageBackground
              source={additionalSettingsImage}
              resizeMode="stretch"
              style={styles.image}
            >
              <Pressable
                accessibilityLabel="Volver a crear actividad"
                accessibilityRole="button"
                onPress={returnToCreateActivity}
                style={styles.additionalBackHitArea}
              />

              {additionalOptions.privacy.map((option, index) => (
                <Pressable
                  accessibilityLabel={`Privacidad ${option}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: privacy === option }}
                  key={option}
                  onPress={() => setPrivacy(option)}
                  style={[
                    styles.additionalOptionHitArea,
                    index === 0 && styles.privacyOne,
                    index === 1 && styles.privacyTwo,
                    index === 2 && styles.privacyThree,
                  ]}
                >
                  {privacy === option ? <View style={styles.additionalSelectedBadge} /> : null}
                </Pressable>
              ))}

              <Pressable
                accessibilityLabel="Restar cupo"
                accessibilityRole="button"
                onPress={() => setMaxParticipants((value) => Math.max(2, value - 1))}
                style={styles.participantsMinusHitArea}
              />
              <Text style={styles.participantsText}>{maxParticipants}</Text>
              <Pressable
                accessibilityLabel="Sumar cupo"
                accessibilityRole="button"
                onPress={() => setMaxParticipants((value) => Math.min(99, value + 1))}
                style={styles.participantsPlusHitArea}
              />

              {additionalOptions.level.map((option, index) => (
                <Pressable
                  accessibilityLabel={`Nivel ${option}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: level === option }}
                  key={option}
                  onPress={() => setLevel(option)}
                  style={[
                    styles.additionalOptionHitArea,
                    index === 0 && styles.levelOne,
                    index === 1 && styles.levelTwo,
                    index === 2 && styles.levelThree,
                    index === 3 && styles.levelFour,
                  ]}
                >
                  {level === option ? <View style={styles.additionalSelectedBadge} /> : null}
                </Pressable>
              ))}

              {additionalOptions.environment.map((option, index) => (
                <Pressable
                  accessibilityLabel={`Ambiente ${option}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: environment === option }}
                  key={option}
                  onPress={() => setEnvironment(option)}
                  style={[
                    styles.additionalOptionHitArea,
                    index === 0 && styles.environmentOne,
                    index === 1 && styles.environmentTwo,
                    index === 2 && styles.environmentThree,
                    index === 3 && styles.environmentFour,
                    index === 4 && styles.environmentFive,
                  ]}
                >
                  {environment === option ? <View style={styles.additionalSelectedBadge} /> : null}
                </Pressable>
              ))}

              {additionalOptions.cost.map((option, index) => (
                <Pressable
                  accessibilityLabel={`Costo ${option}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: cost === option }}
                  key={option}
                  onPress={() => setCostOption(option)}
                  style={[
                    styles.additionalOptionHitArea,
                    index === 0 && styles.costOne,
                    index === 1 && styles.costTwo,
                    index === 2 && styles.costThree,
                  ]}
                >
                  {cost === option ? <View style={styles.additionalSelectedBadge} /> : null}
                </Pressable>
              ))}

              <TextInput
                editable={cost !== 'Gratis'}
                keyboardType="numeric"
                onChangeText={setPrice}
                placeholder=""
                style={[
                  styles.additionalPriceInput,
                  cost === 'Gratis' && styles.additionalDisabledInput,
                ]}
                underlineColorAndroid="transparent"
                value={price}
              />
              <Pressable
                accessibilityLabel="Seleccionar moneda"
                accessibilityRole="button"
                disabled={cost === 'Gratis'}
                onPress={() => setPickerMode('currency')}
                style={styles.currencyHitArea}
              >
                {cost !== 'Gratis' ? <Text style={styles.currencyText}>{currency}</Text> : null}
              </Pressable>

              {additionalOptions.quick.map((option, index) => (
                <Pressable
                  accessibilityLabel={`Ajuste rápido ${option}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: quickSettings.includes(option) }}
                  key={option}
                  onPress={() => toggleQuickSetting(option)}
                  style={[
                    styles.additionalOptionHitArea,
                    index === 0 && styles.quickOne,
                    index === 1 && styles.quickTwo,
                    index === 2 && styles.quickThree,
                    index === 3 && styles.quickFour,
                  ]}
                >
                  {quickSettings.includes(option) ? <View style={styles.additionalSelectedBadge} /> : null}
                </Pressable>
              ))}

              <Pressable
                accessibilityLabel="Continuar"
                accessibilityRole="button"
                onPress={returnToCreateActivity}
                style={styles.additionalContinueHitArea}
              />
            </ImageBackground>
          </View>
        ) : null}

        <Modal animationType="slide" visible={isLocationPickerVisible} onRequestClose={() => setIsLocationPickerVisible(false)}>
          <View style={styles.locationPickerScreen}>
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

            <MapView
              onLongPress={updateDraftPin}
              onPress={updateDraftPin}
              onRegionChangeComplete={setMapRegion}
              region={mapRegion}
              style={styles.locationPickerMap}
            >
              <Marker
                coordinate={draftPin}
                draggable
                onDragEnd={(event) => setDraftPin(event.nativeEvent.coordinate)}
                pinColor="#0E5A44"
              />
            </MapView>

            <View style={styles.locationPickerFooter}>
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
          </View>
        </Modal>

        <Modal animationType="fade" transparent visible={pickerMode !== null} onRequestClose={() => setPickerMode(null)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPickerMode(null)}>
            <Pressable style={styles.modalCard}>
              <Text style={styles.modalTitle}>{pickerTitle}</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {pickerMode === 'category'
                  ? categories.map((item) => (
                    <Pressable key={item.id} onPress={() => selectOption(item)} style={[styles.optionRow, { backgroundColor: item.backgroundColor }]}>
                      <Text style={[styles.optionText, { color: item.color }]}>{item.icon} {item.label}</Text>
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
                {pickerMode === 'date'
                  ? dateOptions.map((item) => (
                    <Pressable key={item} onPress={() => selectOption(item)} style={styles.optionRow}>
                      <Text style={styles.optionText}>{item}</Text>
                    </Pressable>
                  ))
                  : null}
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
        </ImageBackground>
      </ScrollView>
    </View>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FCFAF3' },
  scrollContent: { flexGrow: 1 },
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
  additionalScreen: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FCFAF3', zIndex: 20 },
  additionalScrollContent: {
    paddingBottom: 34,
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
  additionalLogoText: {
    color: '#0E5A44',
    fontSize: 42,
    lineHeight: 45,
    fontWeight: '900',
    letterSpacing: 0,
  },
  additionalLogoBrand: {
    color: '#0E5A44',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: 0,
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
  selectedPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  selectedText: { fontSize: 14, lineHeight: 18, fontWeight: '900' },
  selectedFieldText: { color: '#0E5A44', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  locationText: { color: '#0E5A44', fontSize: 18, lineHeight: 22, fontWeight: '900', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '62%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { color: '#0E5A44', fontSize: 20, fontWeight: '900', marginBottom: 14, textAlign: 'center' },
  optionRow: { borderRadius: 16, marginBottom: 10, paddingHorizontal: 16, paddingVertical: 14 },
  optionText: { color: '#123F38', fontSize: 17, fontWeight: '800' },
  locationPickerScreen: {
    flex: 1,
    backgroundColor: '#FCFAF3',
  },
  locationPickerHeader: {
    minHeight: 112,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCFAF3',
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
    flex: 1,
  },
  locationPickerFooter: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    backgroundColor: '#FCFAF3',
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

import { useMemo, useState } from 'react'
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
import { useRouter } from 'expo-router'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'

import { getFirebaseServices } from '../../firebaseConfig'

const createActivityImage = require('../../assets/images/create-activity-fullscreen.png')
const additionalSettingsImage = require('../../assets/images/additional-settings-fullscreen.png')

type CategoryId = 'outdoor' | 'sports' | 'wellness' | 'groups' | 'private'
type PickerMode = 'category' | 'subcategory' | 'date' | 'time' | 'location' | 'currency' | null

type Category = {
  id: CategoryId
  label: string
  icon: string
  color: string
  backgroundColor: string
  subcategories: string[]
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

const dateOptions = ['Hoy', 'Mañana', 'Sábado', 'Domingo', 'Próxima semana']
const timeOptions = ['08:00', '09:00', '10:00', '12:00', '16:00', '18:00', '19:00', '20:00', '21:00']
const locationOptions = ['Parque Sarmiento', 'Costanera Norte', 'Palermo', 'Tigre', 'Villa Devoto']
const currencyOptions = ['ARS', 'USD', 'UYU', 'BRL', 'EUR']

const additionalOptions = {
  privacy: ['Pública', 'Privada', 'Con aprobación'],
  level: ['Principiante', 'Intermedio', 'Avanzado', 'Todos los niveles'],
  environment: ['Tranquilo', 'Social', 'Deportivo', 'Familiar', 'Relax'],
  cost: ['Gratis', 'A la gorra', 'Pago'],
  quick: ['Mascotas permitidas', 'Lluvia se suspende', 'Tengo lugar en auto', 'Punto de encuentro'],
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
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [subcategory, setSubcategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [pickerMode, setPickerMode] = useState<PickerMode>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [isAdditionalVisible, setIsAdditionalVisible] = useState(false)
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
    if (pickerMode === 'location') return 'Elegí una ubicación'
    if (pickerMode === 'currency') return 'Elegí una moneda'
    return ''
  }, [pickerMode])

  const openGoogleMaps = async () => {
    const query = encodeURIComponent(location || 'Parque Sarmiento Buenos Aires')
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`)
  }

  const createActivity = async () => {
    if (!name.trim() || !category || !subcategory || !description.trim() || !date || !time || !location) {
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
    if (pickerMode === 'date' && typeof value === 'string') setDate(value)
    if (pickerMode === 'time' && typeof value === 'string') setTime(value)
    if (pickerMode === 'location' && typeof value === 'string') setLocation(value)
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

  return (
    <View style={styles.screen}>
      <ImageBackground source={createActivityImage} resizeMode="stretch" style={styles.image}>
        <Pressable accessibilityLabel="Volver" accessibilityRole="button" onPress={() => router.back()} style={styles.backHitArea} />

        <TextInput
          maxLength={70}
          onChangeText={setName}
          placeholder=""
          style={[styles.input, styles.nameInput]}
          underlineColorAndroid="transparent"
          value={name}
        />

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
        <Text style={styles.counterText}>{description.length}/300</Text>

        <Pressable accessibilityLabel="Seleccionar fecha" accessibilityRole="button" onPress={() => setPickerMode('date')} style={styles.dateHitArea}>
          {date ? <Text style={styles.selectedFieldText}>{date}</Text> : null}
        </Pressable>

        <Pressable accessibilityLabel="Seleccionar hora" accessibilityRole="button" onPress={() => setPickerMode('time')} style={styles.timeHitArea}>
          {time ? <Text style={styles.selectedFieldText}>{time}</Text> : null}
        </Pressable>

        <Pressable accessibilityLabel="Abrir Google Maps" accessibilityRole="button" onPress={openGoogleMaps} style={styles.mapHitArea} />

        <Pressable accessibilityLabel="Seleccionar ubicación" accessibilityRole="button" onPress={() => setPickerMode('location')} style={styles.locationHitArea}>
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

        <Pressable accessibilityLabel="Crear actividad" accessibilityRole="button" disabled={isSaving} onPress={createActivity} style={styles.createHitArea}>
          {isSaving ? <ActivityIndicator color="#FFFFFF" /> : null}
        </Pressable>

        {isAdditionalVisible ? (
          <View style={styles.additionalScreen}>
            <ImageBackground
              source={additionalSettingsImage}
              resizeMode="stretch"
              style={styles.image}
            >
              <Pressable
                accessibilityLabel="Volver a crear actividad"
                accessibilityRole="button"
                onPress={() => setIsAdditionalVisible(false)}
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
                onPress={() => setIsAdditionalVisible(false)}
                style={styles.additionalContinueHitArea}
              />
            </ImageBackground>
          </View>
        ) : null}

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
                {pickerMode === 'location'
                  ? locationOptions.map((item) => (
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
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FCFAF3' },
  image: { flex: 1, height: '100%', width: '100%' },
  backHitArea: { position: 'absolute', left: '4%', top: '2%', height: '6%', width: '12%' },
  input: { position: 'absolute', color: '#123F38', fontSize: 17, fontWeight: '600', letterSpacing: 0, padding: 0 },
  nameInput: { left: '13%', right: '7%', top: '22.8%', height: '4.8%' },
  categoryHitArea: { position: 'absolute', left: '3.5%', top: '29.8%', width: '46%', height: '5.5%', justifyContent: 'center', paddingLeft: '10%' },
  subcategoryHitArea: { position: 'absolute', right: '3.7%', top: '29.8%', width: '46%', height: '5.5%', justifyContent: 'center', paddingLeft: '9%', paddingRight: '8%' },
  subcategoryPlaceholderPatch: { position: 'absolute', left: '60%', top: '31.4%', width: '22%', height: '2.4%', backgroundColor: '#FFFFFF', justifyContent: 'center' },
  placeholderPatchText: { color: '#34445F', fontSize: 18, fontWeight: '500', letterSpacing: 0 },
  descriptionInput: { left: '13%', right: '7%', top: '37.5%', height: '9.7%', lineHeight: 22 },
  counterText: { position: 'absolute', right: '7%', top: '45.4%', color: '#34445F', fontSize: 16, fontWeight: '600' },
  dateHitArea: { position: 'absolute', left: '3.7%', top: '53.5%', width: '46%', height: '6%', justifyContent: 'center', paddingLeft: '13%' },
  timeHitArea: { position: 'absolute', right: '3.7%', top: '53.5%', width: '46%', height: '6%', justifyContent: 'center', paddingLeft: '13%' },
  mapHitArea: { position: 'absolute', left: '5%', right: '5%', top: '62.8%', height: '8.2%' },
  locationHitArea: { position: 'absolute', left: '5%', right: '5%', top: '72.2%', height: '4.7%', justifyContent: 'center', alignItems: 'center' },
  additionalTitlePatch: { position: 'absolute', left: '9%', top: '80.8%', width: '45%', height: '3%', backgroundColor: '#FCFAF8', justifyContent: 'center' },
  additionalTitle: { color: '#0E5A44', fontSize: 18, fontWeight: '900', letterSpacing: 0 },
  additionalHitArea: { position: 'absolute', left: '3.5%', right: '3.5%', top: '83.8%', height: '5.8%' },
  messageText: { position: 'absolute', left: '8%', right: '8%', top: '90.3%', color: '#B42318', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  createHitArea: { position: 'absolute', left: '3.5%', right: '3.5%', top: '93.1%', height: '5.8%', alignItems: 'center', justifyContent: 'center' },
  additionalScreen: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FCFAF3', zIndex: 20 },
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
  selectedPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  selectedText: { fontSize: 14, fontWeight: '900' },
  selectedFieldText: { color: '#0E5A44', fontSize: 15, fontWeight: '900' },
  locationText: { color: '#0E5A44', fontSize: 18, fontWeight: '900', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '62%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { color: '#0E5A44', fontSize: 20, fontWeight: '900', marginBottom: 14, textAlign: 'center' },
  optionRow: { borderRadius: 16, marginBottom: 10, paddingHorizontal: 16, paddingVertical: 14 },
  optionText: { color: '#123F38', fontSize: 17, fontWeight: '800' },
})

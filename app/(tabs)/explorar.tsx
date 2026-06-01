import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore'
import {
  CalendarCheck,
  CalendarDays,
  DollarSign,
  Dumbbell,
  Filter,
  Leaf,
  MapPin,
  Mountain,
  Search,
  SlidersHorizontal,
  Star,
  Sprout,
  UsersRound,
  Waves,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { PressScale } from '../../components/home/PressScale'
import { getFirebaseServices } from '../../firebaseConfig'
import { getActivityRecommendationScore, getActivityRecommendationTerms } from '../../lib/recommendations'
import { defaultActivityImage, getCategoryImage } from '../../utils/categoryImages'

type RecordItem = {
  id: string
  source: 'activity' | 'group'
  data: Record<string, unknown>
}

type SortMode = 'recommended' | 'recent' | 'popular'
type AdvancedFilters = {
  category: string
  date: string
  distance: string
  location: string
  price: string
  sort: SortMode
}

type ExploreCardItem = {
  id: string
  recordId: string
  source: 'activity' | 'group'
  title: string
  capacity: string
  location: string
  schedule: string
  cta: string
  image: ImageSourcePropType
  isCancelled?: boolean
  Icon: LucideIcon
}

const quickFilters = ['Todas', 'Hoy', 'Esta semana', 'Gratis', 'Aire libre', 'Yoga', 'Running', 'Sociales']
const categoryFilters = ['Todas', 'Aire libre', 'Deportes', 'Bienestar', 'Sociales', 'Espacios privados']
const dateFilters = ['Todas', 'Hoy', 'Esta semana']
const priceFilters = ['Todos', 'Gratis', 'Pago']
const locationFilters = ['Todas', 'Tandil', 'Buenos Aires', 'Mar del Plata', 'Córdoba', 'Rosario']
const distanceFilters = ['Sin distancia', '1 km', '5 km', '10 km', '25 km']

const initialAdvancedFilters: AdvancedFilters = {
  category: 'Todas',
  date: 'Todas',
  distance: 'Sin distancia',
  location: 'Todas',
  price: 'Todos',
  sort: 'recent',
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function isCancelled(data: Record<string, unknown>) {
  return readString(data.status) === 'cancelled'
}

function normalize(value: unknown) {
  return readString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getAdditionalSettings(data: Record<string, unknown>) {
  return typeof data.additionalSettings === 'object' && data.additionalSettings
    ? data.additionalSettings as Record<string, unknown>
    : {}
}

function getParticipantCount(data: Record<string, unknown>) {
  const participantsCount = readNumber(data.participantsCount, -1)
  if (participantsCount >= 0) return participantsCount

  const joinedUsers = data.joinedUsers
  if (typeof joinedUsers === 'object' && joinedUsers) return Object.keys(joinedUsers).length

  const participants = data.participants ?? data.members
  if (typeof participants === 'object' && participants) return Object.keys(participants).length
  return Array.isArray(participants) ? participants.length : 0
}

function getMaxParticipants(data: Record<string, unknown>) {
  return Math.max(1, readNumber(getAdditionalSettings(data).maxParticipants, readNumber(data.maxParticipants, 10)))
}

function getRecordTime(item: RecordItem) {
  const value = item.data.createdAt ?? item.data.updatedAt
  return typeof value === 'object' && value && 'toMillis' in value && typeof value.toMillis === 'function'
    ? value.toMillis()
    : 0
}

function getSearchText(item: RecordItem) {
  const data = item.data
  if (item.source === 'activity') {
    return normalize([item.source, ...getActivityRecommendationTerms(data), data.location, data.city].join(' '))
  }

  return normalize([
    item.source,
    data.name,
    data.title,
    data.categoryId,
    data.category,
    data.subcategory,
    data.location,
    data.city,
    data.description,
    data.summary,
  ].filter(Boolean).join(' '))
}

function matchesSearch(item: RecordItem, query: string) {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return true

  const text = getSearchText(item)
  return normalizedQuery.split(/\s+/).filter(Boolean).every((token) => text.includes(token))
}

function matchesDate(item: RecordItem, filter: string) {
  if (filter === 'Todas') return true
  const date = normalize(item.data.date)
  if (filter === 'Hoy') return date.includes('hoy')
  return date.includes('semana') || date.includes('sab') || date.includes('dom') || date.includes('manana')
}

function matchesPrice(item: RecordItem, filter: string) {
  if (filter === 'Todos') return true
  const settings = getAdditionalSettings(item.data)
  const cost = normalize(settings.cost || item.data.cost || 'gratis')

  if (filter === 'Gratis') return cost.includes('gratis')
  return !cost.includes('gratis')
}

function matchesCategory(item: RecordItem, filter: string) {
  if (filter === 'Todas') return true
  const text = getSearchText(item)
  const aliases: Record<string, string[]> = {
    'aire libre': ['aire libre', 'outdoor', 'caminata', 'trekking'],
    bienestar: ['bienestar', 'yoga', 'meditacion'],
    deportes: ['deportes', 'running', 'paddle', 'futbol', 'tenis'],
    sociales: ['sociales', 'grupo', 'grupales', 'mate'],
    'espacios privados': ['private', 'espacios privados', 'privados'],
  }
  const normalizedFilter = normalize(filter)
  const terms = aliases[normalizedFilter] ?? [normalizedFilter]

  return terms.some((term) => text.includes(term))
}

function matchesLocation(item: RecordItem, filter: string) {
  if (filter === 'Todas') return true
  return normalize([item.data.city, item.data.location].filter(Boolean).join(' ')).includes(normalize(filter))
}

function matchesQuickFilter(item: RecordItem, filter: string) {
  if (filter === 'Todas') return true
  if (filter === 'Hoy' || filter === 'Esta semana') return matchesDate(item, filter)
  if (filter === 'Gratis') return matchesPrice(item, 'Gratis')
  return matchesCategory(item, filter)
}

function sortRecords(items: RecordItem[], sort: SortMode, userInterests: unknown[] = []) {
  return [...items].sort((left, right) => {
    if (sort === 'popular') return getParticipantCount(right.data) - getParticipantCount(left.data)
    if (sort === 'recommended') {
      const scoreDiff =
        getActivityRecommendationScore(right.data, userInterests)
        - getActivityRecommendationScore(left.data, userInterests)

      if (scoreDiff !== 0) return scoreDiff
    }

    return getRecordTime(right) - getRecordTime(left)
  })
}

function getIcon(item: RecordItem): LucideIcon {
  const text = getSearchText(item)
  if (item.source === 'group') return UsersRound
  if (text.includes('yoga') || text.includes('bienestar')) return Leaf
  if (text.includes('paddle') || text.includes('natacion') || text.includes('kayak')) return Waves
  if (text.includes('aire libre') || text.includes('outdoor') || text.includes('trekking')) return Mountain
  if (text.includes('deporte') || text.includes('running') || text.includes('futbol')) return Dumbbell
  return Sprout
}

function getCardImage(item: RecordItem) {
  return getCategoryImage(item.source === 'group' ? { category: 'Grupales', ...item.data } : item.data)
}

function getQuickIcon(label: string): LucideIcon {
  if (label === 'Hoy') return CalendarDays
  if (label === 'Esta semana') return Star
  if (label === 'Gratis') return DollarSign
  if (label === 'Aire libre') return Leaf
  if (label === 'Yoga') return Sprout
  if (label === 'Running') return Dumbbell
  if (label === 'Sociales') return UsersRound
  return Leaf
}

function mapExploreCard(item: RecordItem): ExploreCardItem {
  const data = item.data
  const count = getParticipantCount(data)
  const max = getMaxParticipants(data)
  const isGroup = item.source === 'group'
  const cancelled = item.source === 'activity' && isCancelled(data)

  return {
    id: `${item.source}-${item.id}`,
    recordId: item.id,
    source: item.source,
    title: readString(data.name, readString(data.title, isGroup ? 'Grupo sin título' : 'Actividad sin título')),
    capacity: `${count}/${max}`,
    location: readString(data.location, readString(data.city, 'Ubicación a definir')),
    schedule: isGroup
      ? readString(data.schedule, 'Próximo encuentro a definir')
      : `${readString(data.date, 'Fecha a definir')}${readString(data.time) ? ` ${readString(data.time)}` : ''}`,
    cta: cancelled ? 'Cancelada' : isGroup ? 'Ver grupo' : 'Ver encuentro',
    image: getCardImage(item),
    isCancelled: cancelled,
    Icon: getIcon(item),
  }
}

export default function ExplorarScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [records, setRecords] = useState<RecordItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [quickFilter, setQuickFilter] = useState('Todas')
  const [filters, setFilters] = useState<AdvancedFilters>(initialAdvancedFilters)
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(initialAdvancedFilters)
  const [isFilterVisible, setIsFilterVisible] = useState(false)
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [userInterests, setUserInterests] = useState<unknown[]>([])
  const carouselCardWidth = Math.min(300, Math.max(236, width - 104))
  const carouselSnapInterval = carouselCardWidth + 14

  useEffect(() => {
    let mounted = true
    let unsubscribe = () => {}

    try {
      const { auth, db } = getFirebaseServices()
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!mounted) return

        if (!user) {
          setUserInterests([])
          return
        }

        try {
          const profileSnap = await getDoc(doc(db, 'users', user.uid))
          const profile = profileSnap.exists() ? profileSnap.data() : null
          if (mounted) setUserInterests(Array.isArray(profile?.interests) ? profile.interests : [])
        } catch {
          if (mounted) setUserInterests([])
        }
      })
    } catch {
      setUserInterests([])
    }

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let activities: RecordItem[] = []
    let groups: RecordItem[] = []

    try {
      const { db } = getFirebaseServices()
      const publish = () => {
        setRecords(sortRecords([...activities, ...groups], 'recent'))
        setIsLoading(false)
      }
      const unsubscribeActivities = onSnapshot(collection(db, 'activities'), (snapshot) => {
        activities = snapshot.docs.map((item) => ({ id: item.id, source: 'activity', data: item.data() as Record<string, unknown> }))
        publish()
      }, () => setIsLoading(false))
      const unsubscribeGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
        groups = snapshot.docs.map((item) => ({ id: item.id, source: 'group', data: item.data() as Record<string, unknown> }))
        publish()
      }, () => setIsLoading(false))

      return () => {
        unsubscribeActivities()
        unsubscribeGroups()
      }
    } catch {
      setIsLoading(false)
      return undefined
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 220)
    return () => clearTimeout(timeout)
  }, [query])

  const filteredRecords = useMemo(() => {
    const filtered = records.filter((item) =>
      matchesSearch(item, debouncedQuery)
      && matchesQuickFilter(item, quickFilter)
      && matchesDate(item, filters.date)
      && matchesPrice(item, filters.price)
      && matchesCategory(item, filters.category)
      && matchesLocation(item, filters.location),
    )

    return sortRecords(filtered, filters.sort, userInterests)
  }, [debouncedQuery, filters, quickFilter, records, userInterests])

  const cards = useMemo(() => filteredRecords.map(mapExploreCard), [filteredRecords])

  const openFilters = () => {
    setDraftFilters(filters)
    setIsFilterVisible(true)
  }

  const applyFilters = () => {
    setFilters(draftFilters)
    setIsFilterVisible(false)
  }

  const resetFilters = () => {
    setDraftFilters(initialAdvancedFilters)
    setFilters(initialAdvancedFilters)
    setQuickFilter('Todas')
    setQuery('')
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Explorar</Text>
            <Text style={styles.subtitle}>Descubrí actividades, grupos y lugares 🌿</Text>
          </View>
          <PressScale accessibilityLabel="Abrir filtros" accessibilityRole="button" onPress={openFilters} style={styles.filterButton} scaleTo={0.94}>
            <SlidersHorizontal color="#063C31" size={24} strokeWidth={2.2} />
          </PressScale>
        </View>

        <View style={styles.searchCard}>
          <Search color="#05372D" size={22} strokeWidth={2.1} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Buscar actividades, grupos o lugares..."
            placeholderTextColor="#85858B"
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>

        <FlatList
          contentContainerStyle={styles.quickList}
          data={quickFilters}
          horizontal
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <PressScale onPress={() => setQuickFilter(item)} scaleTo={0.96} style={[styles.quickChip, quickFilter === item && styles.quickChipActive]}>
              {(() => {
                const QuickIcon = getQuickIcon(item)
                return <QuickIcon color={quickFilter === item ? '#006A32' : '#063C31'} size={20} strokeWidth={2.3} />
              })()}
              <Text style={[styles.quickChipText, quickFilter === item && styles.quickChipTextActive]}>{item}</Text>
            </PressScale>
          )}
          showsHorizontalScrollIndicator={false}
        />

        <ExploreBanner />

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Sprout color="#006A32" size={24} strokeWidth={2.4} />
            <Text style={styles.sectionTitle}>Destacados para vos</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>Ver todo</Text>
          </Pressable>
        </View>
        <Text style={styles.carouselHint}>Deslizá para ver más</Text>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#17803C" />
          </View>
        ) : cards.length === 0 ? (
          <EmptyResults onReset={resetFilters} />
        ) : (
          <FlatList
            contentContainerStyle={styles.resultsList}
            data={cards}
            decelerationRate="fast"
            horizontal
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={(event) => {
              setActiveCardIndex(Math.round(event.nativeEvent.contentOffset.x / carouselSnapInterval))
            }}
            renderItem={({ item }) => (
              <ExploreCard
                cardWidth={carouselCardWidth}
                item={item}
                onPress={() => router.push(
                  item.source === 'activity'
                    ? { pathname: '/activity/[activityId]', params: { activityId: item.recordId } }
                    : { pathname: '/group/[groupId]', params: { groupId: item.recordId } },
                )}
              />
            )}
            showsHorizontalScrollIndicator={false}
            snapToAlignment="start"
            snapToInterval={carouselSnapInterval}
          />
        )}
        {!isLoading && cards.length > 1 ? (
          <View style={styles.carouselDots}>
            {cards.slice(0, 5).map((item, index) => (
              <View key={item.id} style={[styles.carouselDot, index === Math.min(activeCardIndex, 4) && styles.carouselDotActive]} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <FilterSheet
        draft={draftFilters}
        onApply={applyFilters}
        onChange={setDraftFilters}
        onClose={() => setIsFilterVisible(false)}
        onReset={resetFilters}
        resultCount={filteredRecords.length}
        visible={isFilterVisible}
      />
    </SafeAreaView>
  )
}

function EmptyResults({ onReset }: { onReset: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Filter color="#17803C" size={38} strokeWidth={2.2} />
      </View>
      <Text style={styles.emptyTitle}>No encontramos resultados</Text>
      <Text style={styles.emptySubtitle}>Probá ajustando los filtros o buscando otra actividad.</Text>
      <PressScale onPress={onReset} scaleTo={0.97} style={styles.resetButton}>
        <Text style={styles.resetButtonText}>Limpiar filtros</Text>
      </PressScale>
    </View>
  )
}

function ExploreBanner() {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerCopy}>
        <Text style={styles.bannerTitle}>Conectá con lo que te hace bien</Text>
        <Text style={styles.bannerText}>Actividades, grupos y experiencias para todos los estilos.</Text>
      </View>
      <View style={styles.bannerArt}>
        <View style={styles.sun} />
        <Leaf color="#73A86E" size={54} strokeWidth={1.7} />
        <Sprout color="#17803C" size={66} strokeWidth={1.8} />
      </View>
    </View>
  )
}

function ExploreCard({ cardWidth, item, onPress }: { cardWidth: number; item: ExploreCardItem; onPress: () => void }) {
  const [imageSource, setImageSource] = useState(item.image || defaultActivityImage)

  useEffect(() => {
    setImageSource(item.image || defaultActivityImage)
  }, [item.image])

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.exploreCard, { width: cardWidth }, pressed && styles.cardPressed]}>
      <View style={styles.cardImageWrap}>
        <Image
          onError={() => setImageSource(defaultActivityImage)}
          source={imageSource}
          style={styles.cardImage}
        />
        {item.isCancelled ? (
          <View style={styles.cancelledBadge}>
            <Text style={styles.cancelledBadgeText}>Cancelada</Text>
          </View>
        ) : null}
        <View style={styles.cardIcon}>
          <item.Icon color="#17803C" size={31} strokeWidth={2.2} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
        <View style={styles.cardMetaRow}>
          <MapPin color="#0E5A44" size={16} strokeWidth={2.2} />
          <Text numberOfLines={2} style={styles.cardMeta}>{item.location}</Text>
        </View>
        <View style={styles.cardMetaRow}>
          <CalendarCheck color="#0E5A44" size={16} strokeWidth={2.2} />
          <Text numberOfLines={1} style={styles.cardMeta}>{item.schedule}</Text>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.capacityBadge}>
            <UsersRound color="#006A32" size={16} strokeWidth={2.3} />
            <Text style={styles.capacityText}>{item.capacity}</Text>
          </View>
          <View style={[styles.cardCta, item.isCancelled && styles.cardCtaDisabled]}>
            <Text style={[styles.cardCtaText, item.isCancelled && styles.cardCtaTextDisabled]}>{item.cta}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  )
}

type FilterSheetProps = {
  draft: AdvancedFilters
  onApply: () => void
  onChange: (filters: AdvancedFilters) => void
  onClose: () => void
  onReset: () => void
  resultCount: number
  visible: boolean
}

function FilterSheet({ draft, onApply, onChange, onClose, onReset, resultCount, visible }: FilterSheetProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filtros</Text>
            <PressScale onPress={onReset} scaleTo={0.96} style={styles.clearButton}>
              <Text style={styles.clearText}>Limpiar</Text>
            </PressScale>
          </View>

          <FilterGroup label="Cuándo" options={dateFilters} value={draft.date} onChange={(date) => onChange({ ...draft, date })} />
          <FilterGroup label="Precio" options={priceFilters} value={draft.price} onChange={(price) => onChange({ ...draft, price })} />
          <FilterGroup label="Categoría" options={categoryFilters} value={draft.category} onChange={(category) => onChange({ ...draft, category })} />
          <FilterGroup label="Ubicación" options={locationFilters} value={draft.location} onChange={(location) => onChange({ ...draft, location })} />
          <FilterGroup label="Distancia" options={distanceFilters} value={draft.distance} onChange={(distance) => onChange({ ...draft, distance })} />
          <FilterGroup
            label="Ordenar por"
            options={['recommended', 'recent', 'popular']}
            value={draft.sort}
            labels={{ popular: 'Populares', recent: 'Recientes', recommended: 'Recomendados' }}
            onChange={(sort) => onChange({ ...draft, sort: sort as SortMode })}
          />

          <PressScale onPress={onApply} scaleTo={0.97} style={styles.applyButton}>
            <Text style={styles.applyButtonText}>Ver resultados ({resultCount})</Text>
          </PressScale>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

type FilterGroupProps = {
  label: string
  labels?: Record<string, string>
  onChange: (value: string) => void
  options: string[]
  value: string
}

function FilterGroup({ label, labels, onChange, options, value }: FilterGroupProps) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterChips}>
        {options.map((option) => {
          const active = value === option
          return (
            <PressScale key={option} onPress={() => onChange(option)} scaleTo={0.96} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {labels?.[option] ?? option}
              </Text>
            </PressScale>
          )
        })}
      </View>
    </View>
  )
}

const shadow = Platform.select({
  web: {
    boxShadow: '0 14px 26px rgba(7, 57, 45, 0.10)',
  },
  default: {
    elevation: 3,
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
  content: {
    paddingBottom: 128,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    color: '#071D19',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#40534D',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 22,
    marginTop: 3,
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1DD',
    borderRadius: 999,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
    ...shadow,
  },
  searchCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1DD',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 60,
    marginTop: 20,
    paddingHorizontal: 20,
    ...shadow,
  },
  searchInput: {
    color: '#10231F',
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    padding: 0,
  },
  quickList: {
    gap: 10,
    paddingBottom: 6,
    paddingTop: 18,
  },
  quickChip: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1DD',
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    minHeight: 62,
    justifyContent: 'center',
    paddingHorizontal: 14,
    minWidth: 78,
    ...shadow,
  },
  quickChipActive: {
    backgroundColor: '#DFF2DD',
    borderColor: '#DFF2DD',
  },
  quickChipText: {
    color: '#10231F',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  quickChipTextActive: {
    color: '#006A32',
  },
  banner: {
    backgroundColor: '#EFF8EC',
    borderRadius: 24,
    flexDirection: 'row',
    marginTop: 14,
    minHeight: 154,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  bannerCopy: {
    flex: 1.1,
    justifyContent: 'center',
    zIndex: 2,
  },
  bannerTitle: {
    color: '#063C31',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 30,
  },
  bannerText: {
    color: '#193F37',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 23,
    marginTop: 12,
  },
  bannerArt: {
    alignItems: 'center',
    bottom: -8,
    flex: 0.9,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  sun: {
    backgroundColor: '#F6DD82',
    borderRadius: 999,
    height: 58,
    opacity: 0.7,
    position: 'absolute',
    right: 16,
    top: 22,
    width: 58,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    color: '#063C31',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  seeAllButton: {
    backgroundColor: '#F0F5E9',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  seeAllText: {
    color: '#006A32',
    fontSize: 13,
    fontWeight: '900',
  },
  carouselHint: {
    color: '#66736E',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: -4,
  },
  resultsList: {
    gap: 14,
    paddingBottom: 8,
    paddingRight: 28,
    paddingTop: 14,
  },
  exploreCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 2,
    minHeight: 292,
    overflow: 'hidden',
    ...shadow,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardImageWrap: {
    backgroundColor: '#EFF6E9',
    height: 128,
    position: 'relative',
    width: '100%',
  },
  cardImage: {
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: '#F7FAF5',
    borderColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 2,
    height: 58,
    justifyContent: 'center',
    left: 14,
    position: 'absolute',
    top: 84,
    width: 58,
  },
  cancelledBadge: {
    backgroundColor: '#FFF2CC',
    borderColor: '#F5C84B',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  cancelledBadgeText: {
    color: '#7A4A00',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  cardBody: {
    flex: 1,
    padding: 14,
    paddingTop: 18,
  },
  cardTitle: {
    color: '#063C31',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 22,
  },
  cardMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  cardMeta: {
    color: '#596A65',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
  },
  cardFooter: {
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  capacityBadge: {
    alignItems: 'center',
    backgroundColor: '#F0F5E9',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: 32,
    paddingHorizontal: 12,
  },
  capacityText: {
    color: '#006A32',
    fontSize: 13,
    fontWeight: '900',
  },
  cardCta: {
    alignItems: 'center',
    backgroundColor: '#F0F5E9',
    borderRadius: 999,
    alignSelf: 'stretch',
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cardCtaDisabled: {
    backgroundColor: '#ECEBE7',
  },
  cardCtaText: {
    color: '#006A32',
    fontSize: 13,
    fontWeight: '900',
  },
  cardCtaTextDisabled: {
    color: '#7A817D',
  },
  carouselDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 4,
  },
  carouselDot: {
    backgroundColor: '#DCE8E1',
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  carouselDotActive: {
    backgroundColor: '#006A32',
    width: 18,
  },
  centerState: {
    alignItems: 'center',
    minHeight: 180,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    minHeight: 240,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#EFF6E9',
    borderColor: '#D7E8CC',
    borderRadius: 999,
    borderWidth: 1,
    height: 84,
    justifyContent: 'center',
    marginBottom: 16,
    width: 84,
  },
  emptyTitle: {
    color: '#063C31',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#596A65',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  resetButton: {
    alignItems: 'center',
    borderColor: '#6C3DE5',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 44,
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  resetButtonText: {
    color: '#4B348A',
    fontSize: 14,
    fontWeight: '900',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(7, 22, 18, 0.34)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '88%',
    paddingBottom: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#E6E2ED',
    borderRadius: 999,
    height: 5,
    marginBottom: 16,
    width: 48,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetTitle: {
    color: '#071D19',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
  },
  clearButton: {
    justifyContent: 'center',
    minHeight: 38,
  },
  clearText: {
    color: '#4B348A',
    fontSize: 14,
    fontWeight: '900',
  },
  filterGroup: {
    marginTop: 15,
  },
  filterLabel: {
    color: '#10231F',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 10,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1DD',
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  filterChipActive: {
    backgroundColor: '#006A32',
    borderColor: '#006A32',
  },
  filterChipText: {
    color: '#10231F',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  applyButton: {
    alignItems: 'center',
    backgroundColor: '#6C3DE5',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    marginTop: 22,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
})

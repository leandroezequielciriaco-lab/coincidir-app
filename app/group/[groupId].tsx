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
import { doc, onSnapshot } from 'firebase/firestore'
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Sprout,
  UserRound,
  UsersRound,
} from 'lucide-react-native'

import { PressScale } from '../../components/home/PressScale'
import { getFirebaseServices } from '../../firebaseConfig'

type GroupData = Record<string, unknown>

const image = (uri: string): ImageSourcePropType => ({ uri })
const groupImage = image('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1100&q=80')

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function getMemberCount(data: GroupData) {
  const membersCount = readNumber(data.membersCount, -1)
  if (membersCount >= 0) return membersCount

  const members = data.members ?? data.joinedUsers ?? data.participants
  if (typeof members === 'object' && members) return Object.keys(members).length
  return Array.isArray(members) ? members.length : 0
}

export default function GroupDetailScreen() {
  const router = useRouter()
  const { groupId } = useLocalSearchParams<{ groupId?: string }>()
  const [group, setGroup] = useState<GroupData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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

  const detail = useMemo(() => {
    const data = group ?? {}

    return {
      category: readString(data.category, 'Grupo'),
      description: readString(data.description, readString(data.summary, 'Sin descripción por ahora.')),
      location: readString(data.location, 'Ubicación a definir'),
      members: getMemberCount(data),
      nextDate: readString(data.date, readString(data.schedule, 'Próximo encuentro a definir')),
      organizer: readString(data.organizerName, readString(data.createdByName, 'Organizador de Coincidir')),
      title: readString(data.name, readString(data.title, 'Grupo sin título')),
    }
  }, [group])

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color="#006A32" />
        </View>
      </SafeAreaView>
    )
  }

  if (!group) {
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

        <Image source={groupImage} style={styles.heroImage} />

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

          <InfoRow Icon={MapPin} label={detail.location} />
          <InfoRow Icon={CalendarDays} label={detail.nextDate} />
          <InfoRow Icon={UsersRound} label={`${detail.members} miembros`} />
          <InfoRow Icon={UserRound} label={detail.organizer} />

          <Text style={styles.description}>{detail.description}</Text>

          <PressScale style={styles.primaryButton} scaleTo={0.97}>
            <Sprout color="#FFFFFF" size={20} strokeWidth={2.3} />
            <Text style={styles.primaryButtonText}>Ver grupo</Text>
          </PressScale>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

type InfoRowProps = {
  Icon: typeof MapPin
  label: string
}

function InfoRow({ Icon, label }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Icon color="#006A32" size={20} strokeWidth={2.2} />
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
  infoText: {
    color: '#163B34',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
  },
  description: {
    color: '#193F37',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 22,
    marginTop: 4,
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
  primaryButtonText: {
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

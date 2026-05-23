import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import type { Href } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot } from 'firebase/firestore'
import {
  Camera,
  MessageCircle,
  MessagesSquare,
  Plus,
  Reply,
  Search,
  SmilePlus,
  Sparkles,
  UsersRound,
} from 'lucide-react-native'

import { PressScale } from '../../components/home/PressScale'
import { getFirebaseServices } from '../../firebaseConfig'
import {
  type ChatSource,
  type ChatSummaryData,
  type FirestoreRecord,
  formatChatTime,
  getChatImage,
  getChatTitle,
  getParticipantCount,
  getTimestampMillis,
  getUnreadCount,
  isUserParticipant,
  normalize,
  readString,
} from '../../lib/chat'

type ChatListItem = {
  chatData?: ChatSummaryData
  id: string
  participantCount: number
  source: ChatSource
  sourceData: Record<string, unknown>
  title: string
  unreadCount: number
}

const upcomingItems = [
  { title: 'Chats privados', description: 'Conversar en privado con otros participantes.', Icon: UsersRound, tone: 'violet' },
  { title: 'Compartir fotos', description: 'Compartir momentos de tus actividades.', Icon: Camera, tone: 'green' },
  { title: 'Responder mensajes', description: 'Responder mensajes especificos de tus companeros.', Icon: Reply, tone: 'violet' },
  { title: 'Reacciones', description: 'Reaccionar a mensajes facilmente.', Icon: SmilePlus, tone: 'green' },
  { title: 'Coordinacion avanzada', description: 'Encuestas, recordatorios y mas herramientas.', Icon: Sparkles, tone: 'violet' },
]

function getRecordTime(record: FirestoreRecord) {
  return getTimestampMillis(record.data.updatedAt ?? record.data.createdAt)
}

function getChatSearchText(item: ChatListItem) {
  return normalize([
    item.title,
    item.source,
    item.sourceData.category,
    item.sourceData.subcategory,
    item.sourceData.description,
    item.chatData?.lastMessageText,
    item.chatData?.lastMessageSenderName,
  ].filter(Boolean).join(' '))
}

export default function MensajesScreen() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [activities, setActivities] = useState<FirestoreRecord[]>([])
  const [groups, setGroups] = useState<FirestoreRecord[]>([])
  const [activityChats, setActivityChats] = useState<Record<string, ChatSummaryData>>({})
  const [groupChats, setGroupChats] = useState<Record<string, ChatSummaryData>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    try {
      const { auth } = getFirebaseServices()
      return onAuthStateChanged(auth, (user) => {
        setUserId(user?.uid ?? null)
        setIsLoading(false)
      })
    } catch {
      setIsLoading(false)
      return undefined
    }
  }, [])

  useEffect(() => {
    let unsubscribeActivities = () => {}
    let unsubscribeGroups = () => {}
    let unsubscribeActivityChats = () => {}
    let unsubscribeGroupChats = () => {}

    try {
      const { db } = getFirebaseServices()

      unsubscribeActivities = onSnapshot(collection(db, 'activities'), (snapshot) => {
        setActivities(snapshot.docs
          .map((item) => ({ id: item.id, data: item.data() as Record<string, unknown> }))
          .sort((left, right) => getRecordTime(right) - getRecordTime(left)))
      }, () => setActivities([]))

      unsubscribeGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
        setGroups(snapshot.docs
          .map((item) => ({ id: item.id, data: item.data() as Record<string, unknown> }))
          .sort((left, right) => getRecordTime(right) - getRecordTime(left)))
      }, () => setGroups([]))

      unsubscribeActivityChats = onSnapshot(collection(db, 'activityChats'), (snapshot) => {
        setActivityChats(Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data() as ChatSummaryData])))
      }, () => setActivityChats({}))

      unsubscribeGroupChats = onSnapshot(collection(db, 'groupChats'), (snapshot) => {
        setGroupChats(Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data() as ChatSummaryData])))
      }, () => setGroupChats({}))
    } catch {
      setActivities([])
      setGroups([])
      setActivityChats({})
      setGroupChats({})
    }

    return () => {
      unsubscribeActivities()
      unsubscribeGroups()
      unsubscribeActivityChats()
      unsubscribeGroupChats()
    }
  }, [])

  const chats = useMemo(() => {
    const activityItems: ChatListItem[] = activities
      .filter((item) => isUserParticipant(item.data, userId))
      .map((item) => ({
        chatData: activityChats[item.id],
        id: item.id,
        participantCount: getParticipantCount(item.data, 'activity'),
        source: 'activity',
        sourceData: item.data,
        title: getChatTitle(item.data, 'activity'),
        unreadCount: getUnreadCount(activityChats[item.id], userId),
      }))

    const groupItems: ChatListItem[] = groups
      .filter((item) => isUserParticipant(item.data, userId))
      .map((item) => ({
        chatData: groupChats[item.id],
        id: item.id,
        participantCount: getParticipantCount(item.data, 'group'),
        source: 'group',
        sourceData: item.data,
        title: getChatTitle(item.data, 'group'),
        unreadCount: getUnreadCount(groupChats[item.id], userId),
      }))

    return [...activityItems, ...groupItems]
      .filter((item) => getChatSearchText(item).includes(normalize(searchQuery)))
      .sort((left, right) => {
        const leftTime = getTimestampMillis(left.chatData?.lastMessageAt) || getTimestampMillis(left.sourceData.updatedAt ?? left.sourceData.createdAt)
        const rightTime = getTimestampMillis(right.chatData?.lastMessageAt) || getTimestampMillis(right.sourceData.updatedAt ?? right.sourceData.createdAt)
        return rightTime - leftTime
      })
  }, [activities, activityChats, groups, groupChats, searchQuery, userId])

  const openChat = (item: ChatListItem) => {
    router.push({
      pathname: '/chat/[chatId]',
      params: { chatId: item.id, source: item.source },
    } as unknown as Href)
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

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList
        ListEmptyComponent={<EmptyState onExplore={() => router.push('/explorar')} />}
        ListFooterComponent={<UpcomingBlock />}
        ListHeaderComponent={(
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View>
                <Text style={styles.title}>Mensajes</Text>
                <Text style={styles.subtitle}>Chats de tus actividades</Text>
              </View>
              <View style={styles.headerIcon}>
                <Plus color="#FFFFFF" size={24} strokeWidth={2.7} />
              </View>
            </View>

            <View style={styles.searchBox}>
              <Search color="#718178" size={20} strokeWidth={2.2} />
              <TextInput
                onChangeText={setSearchQuery}
                placeholder="Buscar actividad o mensaje"
                placeholderTextColor="#718178"
                style={styles.searchInput}
                value={searchQuery}
              />
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        data={chats}
        keyExtractor={(item) => `${item.source}:${item.id}`}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <ChatRow item={item} onPress={() => openChat(item)} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  )
}

function ChatRow({ item, onPress }: { item: ChatListItem; onPress: () => void }) {
  const lastSender = readString(item.chatData?.lastMessageSenderName)
  const lastMessage = readString(item.chatData?.lastMessageText, 'Todavia no hay mensajes. Se el primero en coordinar.')
  const preview = lastSender ? `${lastSender}: ${lastMessage}` : lastMessage
  const time = formatChatTime(item.chatData?.lastMessageAt)

  return (
    <PressScale accessibilityRole="button" onPress={onPress} scaleTo={0.985} style={styles.chatCard}>
      <Image source={getChatImage(item.sourceData, item.source)} style={styles.chatImage} />
      <View style={styles.chatCopy}>
        <View style={styles.chatTopLine}>
          <Text numberOfLines={1} style={styles.chatTitle}>{item.title}</Text>
          <Text style={styles.chatTime}>{time}</Text>
        </View>
        <Text style={styles.chatParticipants}>
          {item.participantCount} {item.source === 'group' ? 'miembros' : 'participantes'}
        </Text>
        <Text numberOfLines={1} style={styles.chatPreview}>{preview}</Text>
      </View>
      {item.unreadCount > 0 ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{Math.min(item.unreadCount, 9)}</Text>
        </View>
      ) : null}
    </PressScale>
  )
}

function EmptyState({ onExplore }: { onExplore: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIllustration}>
        <MessageCircle color="#B99BEA" size={56} strokeWidth={1.8} />
        <View style={styles.emptyBubble}>
          <MessagesSquare color="#FFFFFF" size={38} strokeWidth={2.1} />
        </View>
      </View>
      <Text style={styles.emptyTitle}>Todavia no tenes chats</Text>
      <Text style={styles.emptyText}>Sumate a una actividad para empezar a conversar con otros participantes.</Text>
      <PressScale onPress={onExplore} scaleTo={0.97} style={styles.exploreButton}>
        <Text style={styles.exploreText}>Explorar actividades</Text>
        <Search color="#FFFFFF" size={18} strokeWidth={2.4} />
      </PressScale>
    </View>
  )
}

function UpcomingBlock() {
  return (
    <View style={styles.upcomingBlock}>
      <View style={styles.upcomingHero}>
        <View style={styles.upcomingBubble}>
          <MessagesSquare color="#FFFFFF" size={46} strokeWidth={2.1} />
        </View>
        <Text style={styles.upcomingTitle}>Proximamente</Text>
        <Text style={styles.upcomingSubtitle}>Estamos trabajando en nuevas funciones para coordinar mejor.</Text>
      </View>

      {upcomingItems.map((item) => (
        <View key={item.title} style={styles.upcomingItem}>
          <View style={[styles.upcomingIcon, item.tone === 'green' ? styles.upcomingIconGreen : styles.upcomingIconViolet]}>
            <item.Icon color={item.tone === 'green' ? '#28A760' : '#8C4BD6'} size={24} strokeWidth={2.2} />
          </View>
          <View style={styles.upcomingCopy}>
            <Text style={styles.upcomingItemTitle}>{item.title}</Text>
            <Text style={styles.upcomingItemText}>{item.description}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

const shadow = Platform.select({
  web: {
    boxShadow: '0 12px 28px rgba(7, 57, 45, 0.08)',
  },
  default: {
    elevation: 3,
    shadowColor: '#07392D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
  },
})

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FAFAF8',
    flex: 1,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 118,
    paddingHorizontal: 18,
  },
  header: {
    paddingBottom: 16,
    paddingTop: 10,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: '#071D19',
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 37,
  },
  subtitle: {
    color: '#34445F',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 2,
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: '#8C4BD6',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
    ...shadow,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#F0ECE7',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    height: 48,
    marginTop: 24,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: '#163B34',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    height: '100%',
    letterSpacing: 0,
    marginLeft: 10,
  },
  chatCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#F0ECE7',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    minHeight: 92,
    padding: 10,
    ...shadow,
  },
  chatImage: {
    borderRadius: 26,
    height: 58,
    width: 58,
  },
  chatCopy: {
    flex: 1,
    marginLeft: 12,
  },
  chatTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  chatTitle: {
    color: '#071D19',
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 20,
    marginRight: 10,
  },
  chatTime: {
    color: '#5D6964',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  chatParticipants: {
    color: '#5B6962',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 3,
  },
  chatPreview: {
    color: '#263A34',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
    marginTop: 7,
  },
  unreadBadge: {
    alignItems: 'center',
    backgroundColor: '#8C4BD6',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    marginLeft: 8,
    minWidth: 24,
    paddingHorizontal: 7,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  emptyState: {
    alignItems: 'center',
    paddingBottom: 26,
    paddingHorizontal: 18,
    paddingTop: 58,
  },
  emptyIllustration: {
    alignItems: 'center',
    height: 142,
    justifyContent: 'center',
    width: 180,
  },
  emptyBubble: {
    alignItems: 'center',
    backgroundColor: '#3FB876',
    borderRadius: 22,
    height: 74,
    justifyContent: 'center',
    marginLeft: 58,
    marginTop: -24,
    width: 86,
  },
  emptyTitle: {
    color: '#071D19',
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 29,
    textAlign: 'center',
  },
  emptyText: {
    color: '#34445F',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 310,
    textAlign: 'center',
  },
  exploreButton: {
    alignItems: 'center',
    backgroundColor: '#35AE69',
    borderRadius: 22,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 22,
  },
  exploreText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  upcomingBlock: {
    marginTop: 18,
    paddingBottom: 22,
  },
  upcomingHero: {
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  upcomingBubble: {
    alignItems: 'center',
    backgroundColor: '#8C4BD6',
    borderRadius: 24,
    height: 78,
    justifyContent: 'center',
    width: 96,
  },
  upcomingTitle: {
    color: '#071D19',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 30,
    marginTop: 16,
  },
  upcomingSubtitle: {
    color: '#34445F',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  upcomingItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#F0ECE7',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    minHeight: 78,
    padding: 13,
    ...shadow,
  },
  upcomingIcon: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  upcomingIconGreen: {
    backgroundColor: '#DDF8E7',
  },
  upcomingIconViolet: {
    backgroundColor: '#F0E3FF',
  },
  upcomingCopy: {
    flex: 1,
    marginLeft: 13,
  },
  upcomingItemTitle: {
    color: '#071D19',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  upcomingItemText: {
    color: '#34445F',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 18,
    marginTop: 3,
  },
})

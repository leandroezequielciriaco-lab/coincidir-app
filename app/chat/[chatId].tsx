import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { ArrowLeft, Info, Send, UsersRound } from 'lucide-react-native'

import { PressScale } from '../../components/home/PressScale'
import { getFirebaseServices } from '../../firebaseConfig'
import {
  type ChatSource,
  formatChatTime,
  getChatCollection,
  getChatImage,
  getChatTitle,
  getParticipantCount,
  getParticipantIds,
  getSourceCollection,
  isUserParticipant,
  readString,
} from '../../lib/chat'

type ChatMessage = {
  createdAt?: unknown
  id: string
  senderId: string
  senderName: string
  text: string
}

function getUserName(user: { displayName?: string | null; email?: string | null } | null) {
  const displayName = user?.displayName?.trim()
  if (displayName) return displayName

  const emailName = user?.email?.split('@')[0]?.trim()
  return emailName || 'Participante'
}

function isChatSource(value: unknown): value is ChatSource {
  return value === 'activity' || value === 'group'
}

export default function ChatScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const listRef = useRef<FlatList<ChatMessage>>(null)
  const { chatId, source } = useLocalSearchParams<{ chatId?: string; source?: string }>()
  const chatSource: ChatSource = isChatSource(source) ? source : 'activity'
  const [userId, setUserId] = useState<string | null>(null)
  const [senderName, setSenderName] = useState('Participante')
  const [sourceData, setSourceData] = useState<Record<string, unknown> | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    try {
      const { auth } = getFirebaseServices()
      return onAuthStateChanged(auth, (user) => {
        setUserId(user?.uid ?? null)
        setSenderName(getUserName(user))
      })
    } catch {
      setUserId(null)
      return undefined
    }
  }, [])

  useEffect(() => {
    if (!chatId) {
      setIsLoading(false)
      return undefined
    }

    const { db } = getFirebaseServices()
    const sourceRef = doc(db, getSourceCollection(chatSource), chatId)

    return onSnapshot(
      sourceRef,
      (snapshot) => {
        setSourceData(snapshot.exists() ? snapshot.data() as Record<string, unknown> : null)
        setIsLoading(false)
      },
      () => {
        setSourceData(null)
        setIsLoading(false)
      },
    )
  }, [chatId, chatSource])

  useEffect(() => {
    if (!chatId) return undefined

    const { db } = getFirebaseServices()
    const messagesQuery = query(
      collection(db, getChatCollection(chatSource), chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(80),
    )

    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        setMessages(snapshot.docs.map((item) => {
          const data = item.data() as Record<string, unknown>
          return {
            createdAt: data.createdAt,
            id: item.id,
            senderId: readString(data.senderId),
            senderName: readString(data.senderName, 'Participante'),
            text: readString(data.text),
          }
        }))

        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
      },
      () => setMessages([]),
    )
  }, [chatId, chatSource])

  const canAccess = useMemo(
    () => Boolean(sourceData && isUserParticipant(sourceData, userId)),
    [sourceData, userId],
  )

  const detail = useMemo(() => {
    const data = sourceData ?? {}
    return {
      image: getChatImage(data, chatSource),
      participantCount: getParticipantCount(data, chatSource),
      title: getChatTitle(data, chatSource),
    }
  }, [chatSource, sourceData])

  useEffect(() => {
    if (!chatId || !userId || !canAccess) return

    const { db } = getFirebaseServices()
    setDoc(doc(db, getChatCollection(chatSource), chatId), {
      lastReadBy: {
        [userId]: serverTimestamp(),
      },
      source: chatSource,
      sourceId: chatId,
      unreadBy: {
        [userId]: 0,
      },
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch(() => {})
  }, [canAccess, chatId, chatSource, messages.length, userId])

  const sendMessage = async () => {
    const cleanText = text.trim()
    if (!chatId || !sourceData || !userId || !canAccess || !cleanText || isSending) return

    setIsSending(true)
    setText('')

    try {
      const { db } = getFirebaseServices()
      const chatCollection = getChatCollection(chatSource)
      const participantIds = Array.from(new Set([...getParticipantIds(sourceData), userId]))
      const unreadBy = participantIds.reduce<Record<string, unknown>>((updates, participantId) => {
        updates[participantId] = participantId === userId ? 0 : increment(1)
        return updates
      }, {})

      await addDoc(collection(db, chatCollection, chatId, 'messages'), {
        createdAt: serverTimestamp(),
        senderId: userId,
        senderName,
        text: cleanText,
      })

      await setDoc(doc(db, chatCollection, chatId), {
        lastReadBy: {
          [userId]: serverTimestamp(),
        },
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: userId,
        lastMessageSenderName: senderName,
        lastMessageText: cleanText,
        participantIds,
        participantsCount: detail.participantCount,
        source: chatSource,
        sourceCollection: getSourceCollection(chatSource),
        sourceId: chatId,
        title: detail.title,
        unreadBy,
        updatedAt: serverTimestamp(),
      }, { merge: true })
    } catch {
      setText(cleanText)
    } finally {
      setIsSending(false)
    }
  }

  const composerSafeStyle = {
    paddingBottom: Math.max(insets.bottom + 8, Platform.OS === 'ios' ? 16 : 12),
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

  if (!sourceData || !canAccess) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <PressScale accessibilityLabel="Volver" accessibilityRole="button" onPress={() => router.back()} scaleTo={0.94} style={styles.iconButton}>
            <ArrowLeft color="#063C31" size={26} strokeWidth={2.4} />
          </PressScale>
          <Text style={styles.headerTitle}>Mensajes</Text>
          <View style={styles.iconButton} />
        </View>
        <View style={styles.centerState}>
          <View style={styles.lockIcon}>
            <UsersRound color="#8C4BD6" size={42} strokeWidth={2} />
          </View>
          <Text style={styles.blockedTitle}>No podes entrar a este chat</Text>
          <Text style={styles.blockedText}>Los chats estan disponibles solo para creadores, participantes o miembros.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0} style={styles.keyboardView}>
        <View style={styles.topBar}>
          <PressScale accessibilityLabel="Volver" accessibilityRole="button" onPress={() => router.back()} scaleTo={0.94} style={styles.iconButton}>
            <ArrowLeft color="#8C4BD6" size={27} strokeWidth={2.5} />
          </PressScale>
          <Image source={detail.image} style={styles.headerImage} />
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.chatTitle}>{detail.title}</Text>
            <Text style={styles.chatSubtitle}>{detail.participantCount} {chatSource === 'group' ? 'miembros' : 'participantes'}</Text>
          </View>
          <View style={styles.iconButton}>
            <Info color="#8C4BD6" size={24} strokeWidth={2.2} />
          </View>
        </View>

        <FlatList
          ListEmptyComponent={<ConversationEmpty />}
          contentContainerStyle={styles.messagesContent}
          data={messages}
          keyExtractor={(item) => item.id}
          ref={listRef}
          renderItem={({ item }) => <MessageBubble isMine={item.senderId === userId} message={item} />}
          showsVerticalScrollIndicator={false}
        />

        <View style={[styles.composer, composerSafeStyle]}>
          <TextInput
            multiline
            onChangeText={setText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#718178"
            style={styles.input}
            value={text}
          />
          <PressScale
            accessibilityLabel="Enviar mensaje"
            accessibilityRole="button"
            disabled={!text.trim() || isSending}
            onPress={sendMessage}
            scaleTo={0.94}
            style={[styles.sendButton, (!text.trim() || isSending) && styles.sendButtonDisabled]}
          >
            {isSending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Send color="#FFFFFF" size={22} strokeWidth={2.4} />}
          </PressScale>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function ConversationEmpty() {
  return (
    <View style={styles.conversationEmpty}>
      <Text style={styles.dayBadge}>Hoy</Text>
      <Text style={styles.conversationEmptyTitle}>Todavia no hay mensajes</Text>
      <Text style={styles.conversationEmptyText}>Rompe el hielo con un mensaje corto para coordinar la actividad.</Text>
    </View>
  )
}

function MessageBubble({ isMine, message }: { isMine: boolean; message: ChatMessage }) {
  return (
    <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
      <View style={[styles.messageBubble, isMine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
        {!isMine ? <Text style={styles.senderName}>{message.senderName}</Text> : null}
        <Text style={styles.messageText}>{message.text}</Text>
        <Text style={[styles.messageTime, isMine && styles.messageTimeMine]}>{formatChatTime(message.createdAt)}</Text>
      </View>
    </View>
  )
}

const shadow = Platform.select({
  web: {
    boxShadow: '0 14px 32px rgba(7, 57, 45, 0.08)',
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
  keyboardView: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    borderBottomColor: '#EFE9DF',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerImage: {
    borderRadius: 24,
    height: 48,
    width: 48,
  },
  headerCopy: {
    flex: 1,
    marginLeft: 11,
  },
  headerTitle: {
    color: '#063C31',
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  chatTitle: {
    color: '#071D19',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 21,
  },
  chatSubtitle: {
    color: '#5B6962',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 2,
  },
  messagesContent: {
    flexGrow: 1,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  dayBadge: {
    alignSelf: 'center',
    backgroundColor: '#F1F0EE',
    borderRadius: 14,
    color: '#5B6962',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 18,
    overflow: 'hidden',
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  messageRow: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  messageRowMine: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    borderRadius: 17,
    maxWidth: '82%',
    minWidth: 96,
    paddingHorizontal: 14,
    paddingVertical: 11,
    ...shadow,
  },
  messageBubbleOther: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F0ECE7',
    borderTopLeftRadius: 6,
    borderWidth: 1,
  },
  messageBubbleMine: {
    backgroundColor: '#DCF8E7',
    borderTopRightRadius: 6,
  },
  senderName: {
    color: '#8C4BD6',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 5,
  },
  messageText: {
    color: '#071D19',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 22,
  },
  messageTime: {
    alignSelf: 'flex-end',
    color: '#6B756F',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 6,
  },
  messageTimeMine: {
    color: '#557467',
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: '#FAFAF8',
    borderTopColor: '#EFE9DF',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E2DA',
    borderRadius: 23,
    borderWidth: 1,
    color: '#163B34',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    maxHeight: 110,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#8C4BD6',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  lockIcon: {
    alignItems: 'center',
    backgroundColor: '#F0E3FF',
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    marginBottom: 18,
    width: 68,
  },
  blockedTitle: {
    color: '#071D19',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 28,
    textAlign: 'center',
  },
  blockedText: {
    color: '#34445F',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 22,
    marginTop: 9,
    maxWidth: 310,
    textAlign: 'center',
  },
  conversationEmpty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  conversationEmptyTitle: {
    color: '#071D19',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 26,
    textAlign: 'center',
  },
  conversationEmptyText: {
    color: '#34445F',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
})

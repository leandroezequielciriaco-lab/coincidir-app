import { Tabs } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot } from 'firebase/firestore'
import {
  Compass,
  Home,
  MessageCircle,
  Plus,
  UserRound,
} from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getFirebaseServices } from '../../firebaseConfig'
import { type ChatSummaryData, getUnreadCount } from '../../lib/chat'

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const [userId, setUserId] = useState<string | null>(null)
  const [activityUnreadCount, setActivityUnreadCount] = useState(0)
  const [groupUnreadCount, setGroupUnreadCount] = useState(0)
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 18 : 10)
  const unreadMessagesCount = userId ? activityUnreadCount + groupUnreadCount : 0
  const unreadMessagesBadge = unreadMessagesCount > 0
    ? unreadMessagesCount > 9 ? '9+' : unreadMessagesCount
    : undefined
  const tabBarStyle = {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#EFE9DF',
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: 66 + bottomInset,
    paddingBottom: bottomInset,
    paddingTop: 8,
    position: 'absolute' as const,
    shadowColor: '#07392D',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 12,
  }

  useEffect(() => {
    try {
      const { auth } = getFirebaseServices()
      return onAuthStateChanged(auth, (user) => setUserId(user?.uid ?? null))
    } catch {
      setUserId(null)
      return undefined
    }
  }, [])

  useEffect(() => {
    setActivityUnreadCount(0)
    setGroupUnreadCount(0)

    if (!userId) return undefined

    let unsubscribeActivityChats = () => {}
    let unsubscribeGroupChats = () => {}

    try {
      const { db } = getFirebaseServices()

      unsubscribeActivityChats = onSnapshot(collection(db, 'activityChats'), (snapshot) => {
        const activityUnread = snapshot.docs.reduce((total, item) => (
          total + getUnreadCount(item.data() as ChatSummaryData, userId)
        ), 0)
        setActivityUnreadCount(activityUnread)
      }, () => setActivityUnreadCount(0))

      unsubscribeGroupChats = onSnapshot(collection(db, 'groupChats'), (snapshot) => {
        const groupUnread = snapshot.docs.reduce((total, item) => (
          total + getUnreadCount(item.data() as ChatSummaryData, userId)
        ), 0)
        setGroupUnreadCount(groupUnread)
      }, () => setGroupUnreadCount(0))
    } catch {
      setActivityUnreadCount(0)
      setGroupUnreadCount(0)
    }

    return () => {
      unsubscribeActivityChats()
      unsubscribeGroupChats()
    }
  }, [userId])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#155C47',
        tabBarInactiveTintColor: '#7A817D',
        tabBarIconStyle: {
          marginTop: 1,
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '900',
          letterSpacing: 0,
          marginTop: 1,
        },
        tabBarStyle,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="explorar"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, size }) => (
            <Compass color={color} size={size} strokeWidth={2.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="crear"
        options={{
          title: 'Crear',
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                alignItems: 'center',
                backgroundColor: '#16823A',
                borderColor: '#FFFFFF',
                borderRadius: 999,
                borderWidth: 4,
                height: 58,
                justifyContent: 'center',
                marginTop: -24,
                width: 58,
                shadowColor: '#16823A',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: focused ? 0.26 : 0.18,
                shadowRadius: 14,
                elevation: 6,
              }}
            >
              <Plus color="#FFFFFF" size={24} strokeWidth={3} />
            </View>
          ),
          tabBarLabelStyle: {
            color: '#155C47',
            fontSize: 11,
            fontWeight: '900',
            letterSpacing: 0,
          },
          tabBarStyle: {
            display: 'none',
          },
        }}
      />
      <Tabs.Screen
        name="mensajes"
        options={{
          title: 'Mensajes',
          tabBarIcon: ({ color, size }) => (
            <View style={styles.messagesIconWrap}>
              <MessageCircle color={color} size={size} strokeWidth={2.5} />
              {unreadMessagesBadge ? (
                <View style={styles.messagesBadge}>
                  <Text style={styles.messagesBadgeText}>{unreadMessagesBadge}</Text>
                </View>
              ) : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Mi Perfil',
          tabBarIcon: ({ color, size }) => (
            <UserRound color={color} size={size} strokeWidth={2.5} />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  messagesIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 34,
    overflow: 'visible',
  },
  messagesBadge: {
    alignItems: 'center',
    backgroundColor: '#D92D20',
    borderColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1.5,
    minHeight: 16,
    minWidth: 16,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -6,
    top: -5,
  },
  messagesBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 13,
    textAlign: 'center',
  },
})

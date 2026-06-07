import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { Href } from 'expo-router'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { onAuthStateChanged } from 'firebase/auth'
import {
  Bell,
  CalendarClock,
  CircleAlert,
  CheckCircle2,
  ChevronLeft,
  Compass,
  Mail,
  MessageCircle,
  Trash2,
  UserRound,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { PressScale } from '../components/home/PressScale'
import { getFirebaseServices } from '../firebaseConfig'
import {
  deleteNotification,
  markNotificationAsRead,
  useNotifications,
  type AppNotification,
  type NotificationType,
} from '../lib/notifications'

const EXPLORE_ROUTE = '/explorar' as Href

type NotificationTone = {
  Icon: LucideIcon
  accent: string
  background: string
  border: string
  cardBackground: string
}

function getNotificationTone(type: NotificationType): NotificationTone {
  if (type === 'interest') {
    return {
      Icon: UserRound,
      accent: '#0E7A3A',
      background: '#DFF4D9',
      border: '#C6EBC1',
      cardBackground: '#FBFEF9',
    }
  }

  if (type === 'message') {
    return {
      Icon: MessageCircle,
      accent: '#5A32C8',
      background: '#EDE3FF',
      border: '#DED0F7',
      cardBackground: '#FDFBFF',
    }
  }

  if (type === 'activity_update' || type === 'activity_updated') {
    return {
      Icon: CalendarClock,
      accent: '#B55400',
      background: '#FFE8BF',
      border: '#F9D49A',
      cardBackground: '#FFFCF7',
    }
  }

  if (type === 'activity_cancelled') {
    return {
      Icon: CircleAlert,
      accent: '#B42318',
      background: '#FFE0DC',
      border: '#F4C5BE',
      cardBackground: '#FFFBFA',
    }
  }

  if (type === 'rejected') {
    return {
      Icon: CircleAlert,
      accent: '#8A3A32',
      background: '#F1E7E5',
      border: '#E4D2CF',
      cardBackground: '#FFFBFA',
    }
  }

  if (type === 'confirmed') {
    return {
      Icon: CheckCircle2,
      accent: '#0E7A3A',
      background: '#DFF4D9',
      border: '#C6EBC1',
      cardBackground: '#FBFEF9',
    }
  }

  return {
    Icon: Mail,
    accent: '#0E5A44',
    background: '#E8F3EA',
    border: '#D3E6D4',
    cardBackground: '#FBFEF9',
  }
}

function trimSentence(value: string) {
  return value.trim().replace(/\s+\./g, '.')
}

function getActivityName(notification: AppNotification) {
  const body = notification.body.trim()
  const fromColon = body.match(/:\s*(.+?)\.?$/)
  if (fromColon?.[1]) return trimSentence(fromColon[1])

  if (notification.type === 'interest') {
    const match = body.match(/\binter\S*\s+en\s+(.+?)\.?$/i)
    if (match?.[1]) return trimSentence(match[1])
  }

  if (notification.type === 'confirmed') {
    const match = body.match(/\bconfirmad[oa] en\s+(.+?)\.?$/i)
    if (match?.[1]) return trimSentence(match[1])
  }

  if (notification.type === 'rejected') {
    const match = body.match(/\bsolicitud para\s+(.+?)\s+no fue aprobada\.?$/i)
    if (match?.[1]) return trimSentence(match[1])
  }

  return ''
}

function getNotificationBody(notification: AppNotification, activityName: string) {
  if (!activityName) return notification.body

  if (notification.type === 'interest') {
    return trimSentence(notification.body.replace(new RegExp(`\\s+en\\s+${escapeRegExp(activityName)}\\.?$`, 'i'), ' en tu actividad.'))
  }

  if (notification.type === 'confirmed') return 'Ya estás confirmado en la actividad.'
  if (notification.type === 'rejected') return 'Tu solicitud no fue aprobada.'
  if (notification.type === 'activity_update' || notification.type === 'activity_updated') return 'La actividad cambió de horario o detalles.'
  if (notification.type === 'activity_cancelled') return 'Se canceló una actividad que te interesa.'

  return notification.body
}

function getNotificationActionLabel(notification: AppNotification) {
  if (notification.groupId) return 'Ver grupo'
  if (notification.activityId) return 'Ver actividad'
  return ''
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getRelativeTime(date: Date | null) {
  if (!date) return 'Recién'

  const diffMs = Math.max(0, Date.now() - date.getTime())
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Recién'
  if (minutes < 60) return `Hace ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `Hace ${days} d`

  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `Hace ${weeks} sem`

  const months = Math.floor(days / 30)
  return `Hace ${months} mes${months === 1 ? '' : 'es'}`
}

export default function NotificacionesScreen() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [deletedNotificationIds, setDeletedNotificationIds] = useState<string[]>([])
  const { error, isLoading, notifications } = useNotifications(userId)
  const visibleNotifications = notifications.filter((notification) => !deletedNotificationIds.includes(notification.id))

  useEffect(() => {
    try {
      const { auth } = getFirebaseServices()
      return onAuthStateChanged(auth, (user) => setUserId(user?.uid ?? null))
    } catch {
      setUserId(null)
      return undefined
    }
  }, [])

  const openNotification = async (notification: AppNotification) => {
    try {
      if (!notification.read) await markNotificationAsRead(notification.id)
    } catch (error) {
      if (__DEV__) console.warn('notification-mark-read-error', error)
    }

    if (notification.groupId) {
      router.push({
        pathname: '/group/[groupId]',
        params: {
          groupId: notification.groupId,
          ...(notification.groupName ? { groupName: notification.groupName } : {}),
        },
      })
      return
    }

    if (notification.activityId) {
      router.push({
        pathname: '/activity/[activityId]',
        params: { activityId: notification.activityId },
      })
    }
  }

  const confirmDeleteNotification = (notification: AppNotification) => {
    Alert.alert(
      'Eliminar notificación',
      '¿Querés eliminar esta notificación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void removeNotification(notification)
          },
        },
      ],
    )
  }

  const removeNotification = async (notification: AppNotification) => {
    setDeletedNotificationIds((current) => (
      current.includes(notification.id) ? current : [...current, notification.id]
    ))

    try {
      await deleteNotification(notification.id)
    } catch (error) {
      setDeletedNotificationIds((current) => current.filter((id) => id !== notification.id))
      if (__DEV__) console.warn('notification-delete-error', error)
      Alert.alert('No se pudo eliminar la notificación.')
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <PressScale
            accessibilityLabel="Volver al inicio"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backButton}
            scaleTo={0.94}
          >
            <ChevronLeft color="#063C31" size={27} strokeWidth={2.5} />
          </PressScale>
          <Text style={styles.title}>Notificaciones</Text>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator color="#4B348A" />
            <Text style={styles.centerText}>Cargando notificaciones...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerCard}>
            <View style={styles.iconCircleSmall}>
              <Bell color="#17803C" size={26} strokeWidth={2.1} />
            </View>
            <Text style={styles.emptyTitle}>No pudimos cargar tus notificaciones</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
          </View>
        ) : visibleNotifications.length > 0 ? (
          <View style={styles.notificationList}>
            {visibleNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onDelete={() => confirmDeleteNotification(notification)}
                onPress={() => void openNotification(notification)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.iconCircle}>
              <Bell color="#17803C" size={36} strokeWidth={2.1} />
            </View>
            <Text style={styles.emptyTitle}>No tenés notificaciones todavía</Text>
            <Text style={styles.emptySubtitle}>
              Acá vas a ver invitaciones, cambios en actividades y novedades cerca tuyo.
            </Text>
            <PressScale
              accessibilityLabel="Explorar actividades"
              accessibilityRole="button"
              onPress={() => router.push(EXPLORE_ROUTE)}
              scaleTo={0.97}
              style={styles.exploreButton}
            >
              <Compass color="#FFFFFF" size={19} strokeWidth={2.4} />
              <Text style={styles.exploreButtonText}>Explorar actividades</Text>
            </PressScale>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function NotificationCard({
  notification,
  onDelete,
  onPress,
}: {
  notification: AppNotification
  onDelete: () => void
  onPress: () => void
}) {
  const tone = getNotificationTone(notification.type)
  const Icon = tone.Icon
  const activityName = getActivityName(notification)
  const body = getNotificationBody(notification, activityName)
  const actionLabel = getNotificationActionLabel(notification)
  const destinationName = notification.groupName || activityName

  return (
    <PressScale
      accessibilityLabel={notification.title}
      accessibilityRole="button"
      onPress={onPress}
      scaleTo={0.98}
      style={[
        styles.notificationCard,
        { backgroundColor: tone.cardBackground, borderColor: tone.border },
        !notification.read && styles.notificationCardUnread,
      ]}
    >
      <View style={[styles.notificationIcon, { backgroundColor: tone.background }]}>
        <Icon color={tone.accent} size={28} strokeWidth={2.2} />
      </View>
      <View style={styles.notificationCopy}>
        <View style={styles.notificationHeaderRow}>
          <View style={styles.notificationTitleWrap}>
            <View style={styles.notificationTitleRow}>
              <Text numberOfLines={2} style={styles.notificationTitle}>{notification.title}</Text>
              {!notification.read ? <View style={[styles.unreadDot, { backgroundColor: tone.accent }]} /> : null}
            </View>
            {destinationName ? (
              <Text numberOfLines={1} style={[styles.activityName, { color: tone.accent }]}>
                {destinationName}
              </Text>
            ) : null}
          </View>
          <View style={styles.notificationRightActions}>
            <Text style={styles.notificationTime}>{getRelativeTime(notification.createdAt)}</Text>
            <Pressable
              accessibilityLabel="Eliminar notificación"
              accessibilityRole="button"
              hitSlop={10}
              onPress={(event) => {
                event.stopPropagation()
                onDelete()
              }}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
            >
              <Trash2 color="#8A3A32" size={18} strokeWidth={2.3} />
            </Pressable>
          </View>
        </View>
        <Text numberOfLines={2} style={styles.notificationBody}>{body}</Text>
        {actionLabel ? (
          <View style={styles.viewActivityRow}>
            <Text style={styles.viewActivityText}>{actionLabel}</Text>
            <Text style={styles.viewActivityArrow}>→</Text>
          </View>
        ) : null}
      </View>
    </PressScale>
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
  content: {
    paddingBottom: 34,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1DD',
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
    ...shadow,
  },
  title: {
    color: '#071D19',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
  },
  headerSpacer: {
    width: 44,
  },
  centerCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 30,
    ...shadow,
  },
  centerText: {
    color: '#56645F',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 34,
    ...shadow,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#F0F8EC',
    borderColor: '#B7DC9D',
    borderRadius: 999,
    borderWidth: 1,
    height: 82,
    justifyContent: 'center',
    marginBottom: 18,
    width: 82,
  },
  iconCircleSmall: {
    alignItems: 'center',
    backgroundColor: '#F0F8EC',
    borderColor: '#B7DC9D',
    borderRadius: 999,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  emptyTitle: {
    color: '#063C31',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 25,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#56645F',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  exploreButton: {
    alignItems: 'center',
    backgroundColor: '#006A32',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  notificationList: {
    gap: 16,
  },
  notificationCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    minHeight: 132,
    paddingHorizontal: 18,
    paddingVertical: 18,
    ...shadow,
  },
  notificationCardUnread: {
    borderWidth: 1.3,
  },
  notificationIcon: {
    alignItems: 'center',
    backgroundColor: '#F4EEF9',
    borderRadius: 999,
    height: 64,
    justifyContent: 'center',
    marginTop: 4,
    width: 64,
  },
  notificationCopy: {
    flex: 1,
    minWidth: 0,
  },
  notificationHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  notificationTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  notificationTitle: {
    color: '#071D19',
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 23,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 21,
    marginTop: 5,
  },
  unreadDot: {
    backgroundColor: '#17803C',
    borderRadius: 999,
    height: 8,
    marginTop: 7,
    width: 8,
  },
  notificationBody: {
    color: '#1D2B28',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 21,
    marginTop: 7,
  },
  notificationTime: {
    color: '#56645F',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
  },
  notificationRightActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#FFF5F4',
    borderColor: '#F4C7C2',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  deleteButtonPressed: {
    opacity: 0.72,
  },
  viewActivityRow: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 7,
    marginTop: 16,
  },
  viewActivityText: {
    color: '#006A32',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  viewActivityArrow: {
    color: '#006A32',
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 24,
  },
})

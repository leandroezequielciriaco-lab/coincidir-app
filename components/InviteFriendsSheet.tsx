import { useMemo, useState } from 'react'
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import {
  ChevronRight,
  Copy,
  MessageCircle,
  Rocket,
  Send,
  UsersRound,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import Svg, { Circle, Rect } from 'react-native-svg'

import { PressScale } from './home/PressScale'

export type InviteShareTarget = {
  id?: string
  title?: string
  dateTime?: string
  location?: string
  type: 'activity' | 'app' | 'group'
}

type InviteFriendsSheetProps = {
  onClose: () => void
  target?: InviteShareTarget | null
  visible: boolean
}

const APP_LINK = 'https://coincidir.app'
const APP_DEEP_LINK = 'coincidirapp://'

function getTargetPath(target?: InviteShareTarget | null) {
  if (!target?.id) return ''
  if (target.type === 'group') return `/group/${target.id}`
  if (target.type === 'activity') return `/activity/${target.id}`
  return ''
}

function getShareLink(target?: InviteShareTarget | null) {
  const path = getTargetPath(target)
  return `${APP_LINK}${path}`
}

function getDeepLink(target?: InviteShareTarget | null) {
  const path = getTargetPath(target)
  return `${APP_DEEP_LINK}${path.replace(/^\//, '')}`
}

function getShareMessage(target?: InviteShareTarget | null) {
  const title = target?.title?.trim()
  const dateTime = target?.dateTime?.trim()
  const location = target?.location?.trim()
  const link = getShareLink(target)

  if (target?.type === 'activity' && title) {
    return [
      `¡Me sumé a ${title} en COINCIDIR!`,
      '',
      dateTime ? `📅 ${dateTime}` : '',
      location ? `📍 ${location}` : '',
      '',
      '¿Te venís conmigo?',
      '',
      `Te dejo el link para que veas la actividad: ${link}`,
    ].filter(Boolean).join('\n')
  }

  if (target?.type === 'group' && title) {
    return [
      `Encontré el grupo ${title} en COINCIDIR.`,
      location ? `📍 ${location}` : '',
      '¿Te sumás?',
      '',
      `Link: ${link}`,
    ].filter(Boolean).join('\n')
  }

  return [
    'Estoy usando COINCIDIR para encontrar actividades, encuentros y planes cerca mío 🙌',
    '',
    'Sumate y descubrí actividades para compartir con otras personas.',
    '',
    APP_LINK,
  ].join('\n')
}

async function shareWithWhatsApp(message: string) {
  const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`
  const canOpen = await Linking.canOpenURL(whatsappUrl)

  if (canOpen) {
    await Linking.openURL(whatsappUrl)
    return
  }

  await Share.share({ message })
}

async function shareWithTelegram(message: string, link: string) {
  const telegramUrl = `tg://msg_url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`

  try {
    await Linking.openURL(telegramUrl)
  } catch {
    await Share.share({ message })
  }
}

async function shareWithInstagram(message: string) {
  const instagramShareUrl = `instagram://sharesheet?text=${encodeURIComponent(message)}`
  const instagramAppUrl = 'instagram://app'

  try {
    await Linking.openURL(instagramShareUrl)
    return
  } catch {
    const canOpenInstagram = await Linking.canOpenURL(instagramAppUrl)

    if (canOpenInstagram) {
      await Clipboard.setStringAsync(message)
      await Linking.openURL(instagramAppUrl)
      return
    }

    await Share.share({ message })
  }
}

export function InviteFriendsSheet({ onClose, target, visible }: InviteFriendsSheetProps) {
  const [feedback, setFeedback] = useState('')
  const shareMessage = useMemo(() => getShareMessage(target), [target])
  const shareLink = useMemo(() => getShareLink(target), [target])
  const deepLink = useMemo(() => getDeepLink(target), [target])
  const hasActivityTarget = target?.type === 'activity' && Boolean(target.id)

  const closeWithFeedback = (message: string) => {
    setFeedback(message)
    setTimeout(() => setFeedback(''), 1800)
  }

  const copyLink = async () => {
    await Clipboard.setStringAsync(shareLink)
    closeWithFeedback('Link copiado')
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable accessibilityRole="menu" style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerIcon}>
            <UsersRound color="#4B348A" size={30} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>¿Con quién querés coincidir?</Text>
          <Text style={styles.subtitle}>
            {hasActivityTarget ? 'Compartí esta actividad específica con tus amigos.' : 'Invitá amigos a usar COINCIDIR.'}
          </Text>

          <InviteOption
            Icon={MessageCircle}
            color="#0FA958"
            description="Invitá a tus amigos a sumarse."
            label="WhatsApp"
            onPress={() => shareWithWhatsApp(shareMessage)}
          />
          <InviteOption
            Icon={Copy}
            color="#5A35D6"
            description={`Copia el link ${deepLink ? 'y dejalo listo para abrir la app.' : 'y envialo como quieras.'}`}
            label="Copiar enlace"
            onPress={copyLink}
          />
          <InviteOption
            Icon={Send}
            color="#229ED9"
            description="Compartí el mensaje por Telegram."
            label="Telegram"
            onPress={() => shareWithTelegram(shareMessage, shareLink)}
          />
          <InviteOption
            Icon={InstagramIcon}
            color="#E4405F"
            description="Abrí Instagram con el mensaje listo para pegar."
            label="Instagram"
            onPress={() => shareWithInstagram(shareMessage)}
          />
          <InviteOption
            Icon={Rocket}
            color="#F2A900"
            description="Invitá a tus amigos a descubrir COINCIDIR."
            label="Más opciones"
            onPress={() => Share.share({ message: shareMessage })}
          />

          {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

          <PressScale onPress={onClose} scaleTo={0.97} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </PressScale>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

type InviteOptionProps = {
  Icon: LucideIcon | typeof InstagramIcon
  color: string
  description: string
  label: string
  onPress: () => void
}

function InviteOption({ Icon, color, label, onPress }: InviteOptionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
    >
      <View style={[styles.optionIcon, { backgroundColor: `${color}18` }]}>
        <Icon color={color} size={23} strokeWidth={2.3} />
      </View>
      <Text numberOfLines={1} style={styles.optionTitle}>{label}</Text>
      <View style={styles.optionArrow}>
        <ChevronRight color="#10231F" size={20} strokeWidth={2.3} />
      </View>
    </Pressable>
  )
}

function InstagramIcon({ color, size = 24, strokeWidth = 2.3 }: { color: string; size?: number; strokeWidth?: number }) {
  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <Rect height="17" rx="5" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} width="17" x="3.5" y="3.5" />
      <Circle cx="12" cy="12" r="3.8" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Circle cx="17.2" cy="6.8" fill={color} r="1.2" />
    </Svg>
  )
}

const shadow = Platform.select({
  web: {
    boxShadow: '0 18px 34px rgba(7, 57, 45, 0.16)',
  },
  default: {
    elevation: 8,
    shadowColor: '#07392D',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
})

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(7, 22, 18, 0.34)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 10,
    ...shadow,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#E6E2ED',
    borderRadius: 999,
    height: 5,
    marginBottom: 16,
    width: 48,
  },
  headerIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F4EEF9',
    borderRadius: 999,
    height: 62,
    justifyContent: 'center',
    marginBottom: 12,
    width: 62,
  },
  title: {
    color: '#071D19',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  subtitle: {
    color: '#53635E',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
    marginBottom: 16,
    marginTop: 4,
    textAlign: 'center',
  },
  option: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E5EE',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'relative',
    width: '100%',
  },
  optionPressed: {
    opacity: 0.82,
  },
  optionIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    marginRight: 12,
    width: 42,
  },
  optionTitle: {
    color: '#073B35',
    fontSize: 17,
    fontWeight: '900',
    left: 66,
    letterSpacing: 0,
    lineHeight: 22,
    position: 'absolute',
    right: 44,
    textAlign: 'left',
    textAlignVertical: 'center',
    top: 24,
    zIndex: 2,
  },
  optionArrow: {
    alignItems: 'center',
    flexShrink: 0,
    height: 32,
    justifyContent: 'center',
    marginLeft: 'auto',
    width: 24,
    zIndex: 3,
  },
  feedback: {
    color: '#17803C',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 4,
    textAlign: 'center',
  },
  cancelButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelText: {
    color: '#4B348A',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
})

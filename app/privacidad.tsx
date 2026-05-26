import { useEffect, useState } from 'react'
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import type { Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { deleteUser, signOut } from 'firebase/auth'
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Eye,
  LockKeyhole,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Trash2,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { PressScale } from '../components/home/PressScale'
import { getFirebaseServices } from '../firebaseConfig'

const LOGIN_ROUTE = '/login' as Href
const PRIVACY_SETTINGS_STORAGE_KEY = 'privacy:settings'
const LOCAL_KEYS_TO_CLEAR_ON_DELETE = [
  PRIVACY_SETTINGS_STORAGE_KEY,
  'home:selectedCity',
]

type PrivacySettings = {
  approximateLocation: boolean
  publicProfile: boolean
  allowMessages: boolean
  receiveNotifications: boolean
}

type PrivacyOption = {
  key: keyof PrivacySettings
  label: string
  Icon: LucideIcon
}

const defaultSettings: PrivacySettings = {
  allowMessages: true,
  approximateLocation: true,
  publicProfile: true,
  receiveNotifications: true,
}

const privacyOptions: PrivacyOption[] = [
  { key: 'approximateLocation', label: 'Compartir ubicación aproximada', Icon: MapPin },
  { key: 'publicProfile', label: 'Mostrar perfil públicamente', Icon: Eye },
  { key: 'allowMessages', label: 'Permitir mensajes', Icon: MessageCircle },
  { key: 'receiveNotifications', label: 'Recibir notificaciones', Icon: Bell },
]

function getErrorCode(error: unknown) {
  return typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code)
    : ''
}

export default function PrivacidadScreen() {
  const router = useRouter()
  const [settings, setSettings] = useState<PrivacySettings>(defaultSettings)

  useEffect(() => {
    let mounted = true

    AsyncStorage.getItem(PRIVACY_SETTINGS_STORAGE_KEY)
      .then((savedSettings) => {
        if (!mounted || !savedSettings) return

        const parsed = JSON.parse(savedSettings) as Partial<PrivacySettings>
        setSettings({ ...defaultSettings, ...parsed })
      })
      .catch(() => {
        if (mounted) setSettings(defaultSettings)
      })

    return () => {
      mounted = false
    }
  }, [])

  const saveSettings = async (nextSettings: PrivacySettings) => {
    setSettings(nextSettings)

    try {
      await AsyncStorage.setItem(PRIVACY_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings))
    } catch {
      Alert.alert('No pudimos guardar el cambio', 'Probá nuevamente en unos segundos.')
    }
  }

  const toggleSetting = (key: keyof PrivacySettings) => {
    const nextSettings = {
      ...settings,
      [key]: !settings[key],
    }

    void saveSettings(nextSettings)
  }

  const showComingSoon = () => {
    Alert.alert('Próximamente')
  }

  const goToLogin = () => {
    router.replace(LOGIN_ROUTE)
  }

  const deleteAccount = async () => {
    try {
      const { auth } = getFirebaseServices()
      const { currentUser } = auth

      if (!currentUser) {
        await signOut(auth)
        goToLogin()
        return
      }

      await deleteUser(currentUser)
      await AsyncStorage.multiRemove(LOCAL_KEYS_TO_CLEAR_ON_DELETE)
      goToLogin()
    } catch (error) {
      const { auth } = getFirebaseServices()

      if (getErrorCode(error) === 'auth/requires-recent-login') {
        Alert.alert('Por seguridad, iniciá sesión nuevamente antes de eliminar tu cuenta.')
        await signOut(auth)
        goToLogin()
        return
      }

      Alert.alert('No pudimos eliminar la cuenta. Intentá nuevamente.')
    }
  }

  const confirmDeleteAccount = () => {
    Alert.alert(
      '¿Querés eliminar tu cuenta?',
      'Esta acción cerrará tu sesión y eliminará tu usuario de Firebase Authentication.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          onPress: () => {
            void deleteAccount()
          },
          style: 'destructive',
          text: 'Eliminar cuenta',
        },
      ],
    )
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <PressScale
            accessibilityLabel="Volver a ajustes"
            accessibilityRole="button"
            onPress={() => router.back()}
            scaleTo={0.94}
            style={styles.backButton}
          >
            <ChevronLeft color="#063C31" size={27} strokeWidth={2.5} />
          </PressScale>
          <Text style={styles.title}>Privacidad</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <ShieldCheck color="#17803C" size={34} strokeWidth={2.1} />
          </View>
          <Text style={styles.cardTitle}>Privacidad y seguridad</Text>
          <Text style={styles.cardText}>
            Configurá cómo querés compartir tu información durante la beta. Estos ajustes quedan guardados en este dispositivo.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          {privacyOptions.map((option) => (
            <PrivacyRow
              Icon={option.Icon}
              key={option.key}
              label={option.label}
              onValueChange={() => toggleSetting(option.key)}
              value={settings[option.key]}
            />
          ))}
        </View>

        <View style={styles.legalCard}>
          <LegalRow Icon={LockKeyhole} label="Política de privacidad" onPress={showComingSoon} />
          <LegalRow Icon={ShieldCheck} label="Términos y condiciones" onPress={showComingSoon} />
          <LegalRow destructive Icon={Trash2} isLast label="Eliminar mi cuenta" onPress={confirmDeleteAccount} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function PrivacyRow({
  Icon,
  label,
  onValueChange,
  value,
}: {
  Icon: LucideIcon
  label: string
  onValueChange: () => void
  value: boolean
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.rowIcon}>
        <Icon color="#063C31" size={21} strokeWidth={2.2} />
      </View>
      <Text numberOfLines={2} style={styles.rowLabel}>{label}</Text>
      <Switch
        onValueChange={onValueChange}
        thumbColor={value ? '#FFFFFF' : '#FFFFFF'}
        trackColor={{ false: '#D8DED9', true: '#17803C' }}
        value={value}
      />
    </View>
  )
}

function LegalRow({
  destructive,
  Icon,
  isLast,
  label,
  onPress,
}: {
  destructive?: boolean
  Icon: LucideIcon
  isLast?: boolean
  label: string
  onPress: () => void
}) {
  const color = destructive ? '#B42318' : '#063C31'

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.legalRow, isLast && styles.legalRowLast, pressed && styles.rowPressed]}
    >
      <View style={[styles.legalIcon, destructive && styles.rowIconDestructive]}>
        <Icon color={color} size={21} strokeWidth={2.2} />
      </View>
      <Text numberOfLines={1} style={[styles.legalLabel, destructive && styles.destructiveText]}>{label}</Text>
      <ChevronRight color={color} size={20} strokeWidth={2.2} style={styles.legalChevron} />
    </Pressable>
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
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    ...shadow,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#F0F8EC',
    borderColor: '#B7DC9D',
    borderRadius: 999,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    marginBottom: 14,
    width: 72,
  },
  cardTitle: {
    color: '#063C31',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  cardText: {
    color: '#56645F',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    overflow: 'hidden',
    ...shadow,
  },
  legalCard: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    overflow: 'hidden',
    ...shadow,
  },
  settingRow: {
    alignItems: 'center',
    borderBottomColor: '#EFEEE9',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 70,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  legalRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderBottomColor: '#EFEEE9',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
  legalRowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    opacity: 0.82,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: '#EFF6E9',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  rowIconDestructive: {
    backgroundColor: '#FFF2F0',
  },
  legalIcon: {
    alignItems: 'center',
    backgroundColor: '#EFF6E9',
    borderRadius: 14,
    flexShrink: 0,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  legalLabel: {
    color: '#071D19',
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 20,
    minWidth: 0,
  },
  legalChevron: {
    flexShrink: 0,
    marginLeft: 'auto',
  },
  rowLabel: {
    color: '#071D19',
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 20,
  },
  destructiveText: {
    color: '#B42318',
  },
})

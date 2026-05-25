import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import type { Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { signOut } from 'firebase/auth'
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  LockKeyhole,
  LogOut,
  Settings,
  UserRound,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { PressScale } from '../components/home/PressScale'
import { getFirebaseServices } from '../firebaseConfig'

const LOGIN_ROUTE = '/login' as Href

const settingsItems: { label: string; Icon: LucideIcon; destructive?: boolean; route?: Href }[] = [
  { label: 'Mi cuenta', Icon: UserRound, route: '/mi-cuenta' as Href },
  { label: 'Notificaciones', Icon: Bell, route: '/notificaciones' as Href },
  { label: 'Privacidad', Icon: LockKeyhole, route: '/privacidad' as Href },
  { label: 'Ayuda', Icon: CircleHelp, route: '/ayuda' as Href },
  { label: 'Cerrar sesión', Icon: LogOut, destructive: true },
]

export default function AjustesScreen() {
  const router = useRouter()

  const handlePress = async (item: typeof settingsItems[number]) => {
    if (item.route) {
      router.push(item.route)
      return
    }

    if (item.destructive) {
      try {
        const { auth } = getFirebaseServices()
        await signOut(auth)
        router.replace(LOGIN_ROUTE)
      } catch {
        Alert.alert('No pudimos cerrar sesión', 'Probá de nuevo en unos segundos.')
      }
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
          <Text style={styles.title}>Ajustes</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Settings color="#17803C" size={32} strokeWidth={2.1} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Preferencias de COINCIDIR</Text>
            <Text style={styles.heroSubtitle}>Gestioná tu cuenta y cómo querés usar la app.</Text>
          </View>
        </View>

        <View style={styles.list}>
          {settingsItems.map((item) => (
            <SettingsRow
              Icon={item.Icon}
              destructive={item.destructive}
              key={item.label}
              label={item.label}
              onPress={() => handlePress(item)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function SettingsRow({
  destructive,
  Icon,
  label,
  onPress,
}: {
  destructive?: boolean
  Icon: LucideIcon
  label: string
  onPress: () => void
}) {
  const color = destructive ? '#B42318' : '#063C31'

  return (
    <View style={styles.rowWrap}>
      <PressScale accessibilityRole="button" onPress={onPress} scaleTo={0.98} style={styles.row}>
        <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
          <Icon color={color} size={22} strokeWidth={2.2} />
        </View>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
        <ChevronRight color={destructive ? '#B42318' : '#40534D'} size={20} strokeWidth={2.2} />
      </PressScale>
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
  heroCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 15,
    marginBottom: 18,
    padding: 18,
    ...shadow,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#F0F8EC',
    borderColor: '#B7DC9D',
    borderRadius: 999,
    borderWidth: 1,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    color: '#063C31',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 23,
  },
  heroSubtitle: {
    color: '#56645F',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: 4,
  },
  list: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadow,
  },
  rowWrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
  row: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderBottomColor: '#EFEEE9',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 14,
    width: '100%',
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
  rowLabel: {
    color: '#071D19',
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  rowLabelDestructive: {
    color: '#B42318',
  },
})

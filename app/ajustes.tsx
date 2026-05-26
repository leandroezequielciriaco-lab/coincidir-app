import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
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

const settingsItems: { label: string; subtitle: string; Icon: LucideIcon; destructive?: boolean; route?: Href }[] = [
  { label: 'Mi cuenta', subtitle: 'Editá tus datos personales', Icon: UserRound, route: '/mi-cuenta' as Href },
  { label: 'Notificaciones', subtitle: 'Elegí qué avisos recibir', Icon: Bell, route: '/notificaciones' as Href },
  { label: 'Privacidad', subtitle: 'Controlá tu seguridad y visibilidad', Icon: LockKeyhole, route: '/privacidad' as Href },
  { label: 'Ayuda', subtitle: 'Preguntas frecuentes y soporte', Icon: CircleHelp, route: '/ayuda' as Href },
  { label: 'Cerrar sesión', subtitle: 'Salir de tu cuenta', Icon: LogOut, destructive: true },
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
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Ajustes</Text>
            <Text style={styles.versionText}>COINCIDIR Beta v0.1</Text>
          </View>
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
          {settingsItems.map((item, index) => (
            <SettingsRow
              Icon={item.Icon}
              destructive={item.destructive}
              isLast={index === settingsItems.length - 1}
              key={item.label}
              label={item.label}
              onPress={() => handlePress(item)}
              subtitle={item.subtitle}
            />
          ))}
        </View>
        <Text style={styles.betaText}>COINCIDIR Beta</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function SettingsRow({
  destructive,
  Icon,
  isLast,
  label,
  onPress,
  subtitle,
}: {
  destructive?: boolean
  Icon: LucideIcon
  isLast: boolean
  label: string
  onPress: () => void
  subtitle: string
}) {
  const color = destructive ? '#B42318' : '#063C31'

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isLast && styles.rowLast,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
        <Icon color={color} size={20} strokeWidth={2.2} />
      </View>
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
        <Text numberOfLines={1} style={[styles.rowSubtitle, destructive && styles.rowSubtitleDestructive]}>{subtitle}</Text>
      </View>
      <View style={styles.rowChevron}>
        <ChevronRight color={destructive ? '#B42318' : '#8A9691'} size={19} strokeWidth={2.2} />
      </View>
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
  titleBlock: {
    alignItems: 'center',
    flex: 1,
  },
  versionText: {
    color: '#66736E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
    marginTop: 2,
    opacity: 0.58,
    textAlign: 'center',
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
    paddingVertical: 4,
    ...shadow,
  },
  row: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderBottomColor: '#EFEEE9',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
  },
  rowCopy: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 12,
    minWidth: 0,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: '#F8FAF6',
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: '#EFF6E9',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  rowIconDestructive: {
    backgroundColor: '#FFF2F0',
  },
  rowChevron: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    marginLeft: 10,
    width: 22,
  },
  rowLabel: {
    color: '#071D19',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 19,
  },
  rowLabelDestructive: {
    color: '#B42318',
  },
  rowSubtitle: {
    color: '#66736E',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 16,
    marginTop: 2,
  },
  rowSubtitleDestructive: {
    color: '#A64B43',
  },
  betaText: {
    color: '#8A9691',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 18,
    textAlign: 'center',
  },
})

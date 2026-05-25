import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Bell, ChevronLeft } from 'lucide-react-native'

import { PressScale } from '../components/home/PressScale'

export default function NotificacionesScreen() {
  const router = useRouter()

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

        <View style={styles.emptyCard}>
          <View style={styles.iconCircle}>
            <Bell color="#17803C" size={36} strokeWidth={2.1} />
          </View>
          <Text style={styles.emptyTitle}>No tenés notificaciones todavía</Text>
          <Text style={styles.emptySubtitle}>
            Acá vas a ver invitaciones, cambios en actividades y novedades cerca tuyo.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
})

import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  UserRound,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { PressScale } from '../components/home/PressScale'
import { getFirebaseServices } from '../firebaseConfig'

type AccountData = {
  city: string
  email: string
  name: string
  photoURL: string
}

const fallbackAccount: AccountData = {
  city: 'Ciudad no configurada',
  email: 'Email no disponible',
  name: 'Sin nombre',
  photoURL: '',
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function buildAccountData(
  profile: Record<string, unknown> | null,
  authUser: { displayName: string | null; email: string | null; photoURL: string | null } | null,
): AccountData {
  return {
    city: readString(profile?.city, readString(profile?.location, fallbackAccount.city)),
    email: readString(profile?.email, readString(authUser?.email, fallbackAccount.email)),
    name: readString(
      profile?.fullName,
      readString(profile?.displayName, readString(profile?.name, readString(authUser?.displayName, fallbackAccount.name))),
    ),
    photoURL: readString(profile?.photoURL, readString(authUser?.photoURL)),
  }
}

export default function MiCuentaScreen() {
  const router = useRouter()
  const [account, setAccount] = useState<AccountData>(fallbackAccount)
  const [isLoading, setIsLoading] = useState(true)
  const [isSendingPasswordEmail, setIsSendingPasswordEmail] = useState(false)

  useEffect(() => {
    let mounted = true

    try {
      const { auth, db } = getFirebaseServices()
      return onAuthStateChanged(auth, async (user) => {
        if (!mounted) return

        if (!user) {
          setAccount(fallbackAccount)
          setIsLoading(false)
          return
        }

        try {
          const profileSnap = await getDoc(doc(db, 'users', user.uid))
          const profile = profileSnap.exists() ? profileSnap.data() : null

          if (mounted) setAccount(buildAccountData(profile, user))
        } catch {
          if (mounted) setAccount(buildAccountData(null, user))
        } finally {
          if (mounted) setIsLoading(false)
        }
      })
    } catch {
      setAccount(fallbackAccount)
      setIsLoading(false)
      return undefined
    }
  }, [])

  const editProfile = () => {
    Alert.alert('Editar perfil', 'Próximamente vas a poder editar estos datos desde Mi cuenta.')
  }

  const changePassword = async () => {
    if (account.email === fallbackAccount.email || isSendingPasswordEmail) {
      Alert.alert('Email no disponible', 'Necesitamos un email asociado a tu cuenta para cambiar la contraseña.')
      return
    }

    setIsSendingPasswordEmail(true)
    try {
      const { auth } = getFirebaseServices()
      await sendPasswordResetEmail(auth, account.email)
      Alert.alert('Revisá tu email', 'Te enviamos un enlace para cambiar tu contraseña.')
    } catch {
      Alert.alert('No pudimos enviar el email', 'Intentá nuevamente en unos segundos.')
    } finally {
      setIsSendingPasswordEmail(false)
    }
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
          <Text style={styles.title}>Mi cuenta</Text>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#17803C" />
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                {account.photoURL ? (
                  <Image source={{ uri: account.photoURL }} style={styles.avatarImage} />
                ) : (
                  <UserRound color="#17803C" size={42} strokeWidth={2.1} />
                )}
              </View>
              <Text numberOfLines={2} style={styles.name}>{account.name}</Text>
              <InfoRow Icon={Mail} label="Email" value={account.email} />
              <InfoRow Icon={MapPin} label="Ciudad" value={account.city} />
            </View>

            <View style={styles.actionsCard}>
              <ActionRow Icon={Pencil} label="Editar perfil" onPress={editProfile} />
              <ActionRow
                Icon={KeyRound}
                label={isSendingPasswordEmail ? 'Enviando email...' : 'Cambiar contraseña'}
                onPress={changePassword}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function InfoRow({ Icon, label, value }: { Icon: LucideIcon; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.rowIcon}>
        <Icon color="#17803C" size={20} strokeWidth={2.2} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text numberOfLines={2} style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  )
}

function ActionRow({ Icon, label, onPress }: { Icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
    >
      <View style={styles.rowIcon}>
        <Icon color="#063C31" size={20} strokeWidth={2.2} />
      </View>
      <Text numberOfLines={1} style={styles.actionLabel}>{label}</Text>
      <ChevronRight color="#40534D" size={20} strokeWidth={2.2} />
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
  loadingCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 140,
    justifyContent: 'center',
    ...shadow,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    ...shadow,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#F0F8EC',
    borderColor: '#B7DC9D',
    borderRadius: 999,
    borderWidth: 1,
    height: 96,
    justifyContent: 'center',
    marginBottom: 14,
    overflow: 'hidden',
    width: 96,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  name: {
    color: '#063C31',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 27,
    marginBottom: 18,
    textAlign: 'center',
  },
  infoRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FAFAF8',
    borderColor: '#ECEBE7',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: '#EFF6E9',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  infoCopy: {
    flex: 1,
    minWidth: 0,
  },
  infoLabel: {
    color: '#596A65',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 2,
  },
  infoValue: {
    color: '#071D19',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 20,
  },
  actionsCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    overflow: 'hidden',
    ...shadow,
  },
  actionRow: {
    alignItems: 'center',
    borderBottomColor: '#EFEEE9',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 14,
  },
  rowPressed: {
    opacity: 0.82,
  },
  actionLabel: {
    color: '#071D19',
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
})

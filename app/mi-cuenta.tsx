import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth'
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
}

type PasswordDraft = {
  confirmPassword: string
  currentPassword: string
  newPassword: string
}

const fallbackAccount: AccountData = {
  city: 'Ciudad no configurada',
  email: 'Email no disponible',
  name: 'Sin nombre',
}

const emptyPasswordDraft: PasswordDraft = {
  confirmPassword: '',
  currentPassword: '',
  newPassword: '',
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function buildAccountData(
  profile: Record<string, unknown> | null,
  authUser: { displayName: string | null; email: string | null } | null,
): AccountData {
  return {
    city: readString(profile?.city, readString(profile?.location, fallbackAccount.city)),
    email: readString(profile?.email, readString(authUser?.email, fallbackAccount.email)),
    name: readString(
      profile?.fullName,
      readString(profile?.displayName, readString(profile?.name, readString(authUser?.displayName, fallbackAccount.name))),
    ),
  }
}

export default function MiCuentaScreen() {
  const router = useRouter()
  const [account, setAccount] = useState<AccountData>(fallbackAccount)
  const [isLoading, setIsLoading] = useState(true)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft>(emptyPasswordDraft)
  const [passwordError, setPasswordError] = useState('')

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

  const openProfileEditor = () => {
    router.push({ pathname: '/(tabs)/perfil', params: { edit: '1' } })
  }

  const openPasswordModal = () => {
    setPasswordDraft(emptyPasswordDraft)
    setPasswordError('')
    setIsChangingPassword(true)
  }

  const updatePasswordDraft = (field: keyof PasswordDraft) => (value: string) => {
    setPasswordDraft((current) => ({ ...current, [field]: value }))
    if (passwordError) setPasswordError('')
  }

  const cancelPasswordChange = () => {
    if (isUpdatingPassword) return

    setPasswordDraft(emptyPasswordDraft)
    setPasswordError('')
    setIsChangingPassword(false)
  }

  const savePassword = async () => {
    if (isUpdatingPassword) return

    const currentPassword = passwordDraft.currentPassword
    const newPassword = passwordDraft.newPassword
    const confirmPassword = passwordDraft.confirmPassword

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Completa todos los campos para cambiar tu contrasena.')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('La nueva contrasena debe tener al menos 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Las nuevas contrasenas no coinciden.')
      return
    }

    setIsUpdatingPassword(true)
    try {
      const { auth } = getFirebaseServices()
      const user = auth.currentUser

      if (!user?.email) {
        setPasswordError('Necesitamos un email asociado a tu cuenta para cambiar la contrasena.')
        return
      }

      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPassword)

      setPasswordDraft(emptyPasswordDraft)
      setPasswordError('')
      setIsChangingPassword(false)
      Alert.alert('Contrasena actualizada', 'Tu contrasena se cambio correctamente.')
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''

      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
        setPasswordError('La contrasena actual es incorrecta.')
        return
      }

      if (code === 'auth/weak-password') {
        setPasswordError('La nueva contrasena es demasiado debil.')
        return
      }

      setPasswordError('No pudimos actualizar la contrasena. Intenta nuevamente.')
    } finally {
      setIsUpdatingPassword(false)
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
              <View style={styles.accountIcon}>
                <UserRound color="#17803C" size={32} strokeWidth={2.1} />
              </View>
              <Text numberOfLines={2} style={styles.name}>{account.name}</Text>
              <InfoRow Icon={Mail} label="Email" value={account.email} />
              <InfoRow Icon={MapPin} label="Ciudad" value={account.city} />
            </View>

            <View style={styles.actionsCard}>
              <ActionRow Icon={Pencil} label="Editar perfil social" onPress={openProfileEditor} />
              <ActionRow Icon={KeyRound} label="Cambiar contrasena" onPress={openPasswordModal} />
            </View>
          </>
        )}
      </ScrollView>

      <ChangePasswordModal
        draft={passwordDraft}
        error={passwordError}
        isSaving={isUpdatingPassword}
        onCancel={cancelPasswordChange}
        onChange={updatePasswordDraft}
        onSave={savePassword}
        visible={isChangingPassword}
      />
    </SafeAreaView>
  )
}

function ChangePasswordModal({
  draft,
  error,
  isSaving,
  onCancel,
  onChange,
  onSave,
  visible,
}: {
  draft: PasswordDraft
  error: string
  isSaving: boolean
  onCancel: () => void
  onChange: (field: keyof PasswordDraft) => (value: string) => void
  onSave: () => void
  visible: boolean
}) {
  return (
    <Modal animationType="slide" onRequestClose={onCancel} visible={visible}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <PressScale
              accessibilityLabel="Cancelar cambio de contrasena"
              accessibilityRole="button"
              onPress={onCancel}
              scaleTo={0.94}
              style={styles.backButton}
            >
              <ChevronLeft color="#063C31" size={27} strokeWidth={2.5} />
            </PressScale>
            <Text style={styles.title}>Cambiar contrasena</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.editCard}>
            <View style={styles.passwordIcon}>
              <KeyRound color="#17803C" size={34} strokeWidth={2.1} />
            </View>
            <Text style={styles.passwordTitle}>Actualiza tu contrasena</Text>
            <Text style={styles.passwordSubtitle}>
              Confirma tu contrasena actual y elegi una nueva para mantener tu cuenta segura.
            </Text>

            <EditField
              label="Contrasena actual"
              onChangeText={onChange('currentPassword')}
              placeholder="Ingresa tu contrasena actual"
              secureTextEntry
              value={draft.currentPassword}
            />
            <EditField
              label="Nueva contrasena"
              onChangeText={onChange('newPassword')}
              placeholder="Minimo 6 caracteres"
              secureTextEntry
              value={draft.newPassword}
            />
            <EditField
              label="Confirmar nueva contrasena"
              onChangeText={onChange('confirmPassword')}
              placeholder="Repeti la nueva contrasena"
              secureTextEntry
              value={draft.confirmPassword}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onSave}
              style={({ pressed }) => [styles.saveButton, pressed && styles.rowPressed, isSaving && styles.saveButtonDisabled]}
            >
              {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Guardar</Text>}
            </Pressable>

            <Pressable accessibilityRole="button" disabled={isSaving} onPress={onCancel} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function EditField({
  label,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  value,
}: {
  label: string
  onChangeText: (value: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  value: string
}) {
  return (
    <View style={styles.editField}>
      <Text style={styles.editFieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8B9692"
        secureTextEntry={secureTextEntry}
        style={styles.editInput}
        value={value}
      />
    </View>
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
      <View style={styles.actionContent}>
        <View style={styles.rowIcon}>
          <Icon color="#063C31" size={20} strokeWidth={2.2} />
        </View>
        <Text numberOfLines={1} style={styles.actionLabel}>{label}</Text>
        <ChevronRight color="#8A9691" size={20} strokeWidth={2.2} />
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
  editContent: {
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
  accountIcon: {
    alignItems: 'center',
    backgroundColor: '#F0F8EC',
    borderColor: '#B7DC9D',
    borderRadius: 999,
    borderWidth: 1,
    height: 76,
    justifyContent: 'center',
    marginBottom: 14,
    width: 76,
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
    borderBottomColor: '#EFEEE9',
    borderBottomWidth: 1,
    minHeight: 68,
  },
  actionContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 14,
    width: '100%',
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
  editCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    ...shadow,
  },
  passwordIcon: {
    alignItems: 'center',
    backgroundColor: '#F0F8EC',
    borderColor: '#B7DC9D',
    borderRadius: 999,
    borderWidth: 1,
    height: 76,
    justifyContent: 'center',
    marginBottom: 14,
    width: 76,
  },
  passwordTitle: {
    color: '#063C31',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 26,
    marginBottom: 7,
    textAlign: 'center',
  },
  passwordSubtitle: {
    color: '#596A65',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
    marginBottom: 18,
    textAlign: 'center',
  },
  editField: {
    alignSelf: 'stretch',
    marginBottom: 14,
  },
  editFieldLabel: {
    color: '#10231F',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: '#FAFAF8',
    borderColor: '#E1E1DD',
    borderRadius: 14,
    borderWidth: 1,
    color: '#10231F',
    fontSize: 15,
    fontWeight: '700',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  errorText: {
    alignSelf: 'stretch',
    color: '#B42318',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
    marginBottom: 12,
    marginTop: -2,
  },
  saveButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#17803C',
    borderRadius: 999,
    height: 50,
    justifyContent: 'center',
    marginTop: 4,
  },
  saveButtonDisabled: {
    opacity: 0.72,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  cancelButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#596A65',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
})

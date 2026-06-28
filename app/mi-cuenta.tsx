import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
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
  GoogleAuthProvider,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signOut,
  updatePassword,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import {
  AlertTriangle,
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
import { requireVerifiedParticipation } from '../utils/authParticipation'
import { resolveUserDisplayName } from '../utils/userNames'

const LOGIN_ROUTE = '/login'
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID

type GoogleSigninApi = {
  configure: (config: { iosClientId?: string; webClientId?: string }) => void
  getTokens: () => Promise<{ idToken?: string }>
  hasPlayServices: (options: { showPlayServicesUpdateDialog: boolean }) => Promise<boolean>
  signIn: () => Promise<{ data?: { idToken?: string }; type?: string } | unknown>
  signOut: () => Promise<unknown>
}

type GoogleSigninModule = {
  GoogleSignin?: GoogleSigninApi
}

type AccountData = {
  city: string
  email: string
  name: string
  photoURL: string
}

type PasswordDraft = {
  confirmPassword: string
  currentPassword: string
  newPassword: string
}

type DeleteProviderId = 'google.com' | 'password' | ''

const fallbackAccount: AccountData = {
  city: 'Ciudad no configurada',
  email: 'Email no disponible',
  name: 'Usuario',
  photoURL: '',
}

const emptyPasswordDraft: PasswordDraft = {
  confirmPassword: '',
  currentPassword: '',
  newPassword: '',
}

function logDeleteAccount(message: string, payload?: Record<string, unknown>, warn = false) {
  if (!__DEV__) return

  if (warn) {
    console.warn(message, payload ?? {})
    return
  }

  console.log(message, payload ?? {})
}

function getAccountErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error) {
    const data = error as { code?: unknown; message?: unknown }
    const code = typeof data.code === 'string' ? data.code : ''
    const message = typeof data.message === 'string' ? data.message : ''
    return [code, message].filter(Boolean).join(': ') || String(error)
  }

  return String(error)
}

function getGoogleSignInModule() {
  try {
    // Loaded lazily so Expo Go can evaluate this route without RNGoogleSignin.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-google-signin/google-signin') as GoogleSigninModule
  } catch (error) {
    if (__DEV__) console.warn('Google Sign-In native module no disponible en Mi cuenta', error)
    return null
  }
}

async function getGoogleIdTokenForReauth() {
  const googleSignInModule = getGoogleSignInModule()
  const GoogleSignin = googleSignInModule?.GoogleSignin

  if (!GoogleSignin) {
    throw new Error('google-signin-development-build-required')
  }

  GoogleSignin.configure({
    iosClientId: googleIosClientId,
    webClientId: googleWebClientId,
  })

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  }

  await GoogleSignin.signOut().catch(() => {})
  const signInResult = await GoogleSignin.signIn()
  if (
    typeof signInResult === 'object' &&
    signInResult &&
    'type' in signInResult &&
    signInResult.type === 'cancelled'
  ) {
    throw new Error('google-signin-cancelled')
  }

  if (
    typeof signInResult === 'object' &&
    signInResult &&
    'data' in signInResult &&
    signInResult.data &&
    typeof signInResult.data === 'object' &&
    'idToken' in signInResult.data &&
    typeof signInResult.data.idToken === 'string'
  ) {
    return signInResult.data.idToken
  }

  const tokens = await GoogleSignin.getTokens()
  return tokens.idToken
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function buildAccountData(
  profile: Record<string, unknown> | null,
  authUser: { displayName: string | null; email: string | null; photoURL: string | null } | null,
): AccountData {
  if (profile?.photoRemoved === true) {
    return {
      city: readString(profile?.city, readString(profile?.location, fallbackAccount.city)),
      email: readString(profile?.email, readString(authUser?.email, fallbackAccount.email)),
      name: resolveUserDisplayName({ email: authUser?.email, fallback: fallbackAccount.name, firebaseUser: authUser, profile }),
      photoURL: '',
    }
  }

  return {
    city: readString(profile?.city, readString(profile?.location, fallbackAccount.city)),
    email: readString(profile?.email, readString(authUser?.email, fallbackAccount.email)),
    name: resolveUserDisplayName({ email: authUser?.email, fallback: fallbackAccount.name, firebaseUser: authUser, profile }),
    photoURL: readString(
      profile?.photoURL,
      readString(
        profile?.avatarUrl,
        readString(
          profile?.avatarURL,
          readString(profile?.imageUrl, readString(profile?.photoUrl, readString(profile?.googlePhotoURL, authUser?.photoURL ?? ''))),
        ),
      ),
    ),
  }
}

function getAuthProviderId(user: { providerData?: { providerId?: string }[] } | null | undefined): DeleteProviderId {
  const providers = user?.providerData ?? []

  if (providers.some((provider) => provider.providerId === 'password')) return 'password'
  if (providers.some((provider) => provider.providerId === 'google.com')) return 'google.com'

  return ''
}

export default function MiCuentaScreen() {
  const router = useRouter()
  const [account, setAccount] = useState<AccountData>(fallbackAccount)
  const [isLoading, setIsLoading] = useState(true)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false)
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft>(emptyPasswordDraft)
  const [passwordError, setPasswordError] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteProviderId, setDeleteProviderId] = useState<DeleteProviderId>('')

  useEffect(() => {
    let mounted = true

    try {
      const { auth, db } = getFirebaseServices()
      return onAuthStateChanged(auth, async (user) => {
        if (!mounted) return

        if (!user) {
          setAccount(fallbackAccount)
          setDeleteProviderId('')
          setIsLoading(false)
          return
        }

        setDeleteProviderId(getAuthProviderId(user))

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

  const openDeleteModal = () => {
    setDeletePassword('')
    setDeleteError('')
    setIsDeleteModalVisible(true)
  }

  const cancelDeleteAccount = () => {
    if (isDeletingAccount) return
    setDeletePassword('')
    setDeleteError('')
    setIsDeleteModalVisible(false)
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

      if (!(await requireVerifiedParticipation(auth))) return

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

  const deleteAccount = async () => {
    if (isDeletingAccount) return

    setDeleteError('')
    setIsDeletingAccount(true)
    let deleteStage: 'start' | 'reauth' | 'firestore' | 'auth-delete' = 'start'

    try {
      // TODO: Centralizar este flujo con app/privacidad.tsx para que ambos caminos borren Auth y Firestore igual.
      const { auth, db } = getFirebaseServices()
      const user = auth.currentUser
      const providerId = getAuthProviderId(user) || deleteProviderId
      const logPayload = { providerId, uid: user?.uid ?? null }
      logDeleteAccount('[DELETE ACCOUNT START]', logPayload)
      logDeleteAccount('[DELETE ACCOUNT PROVIDER]', logPayload)

      if (!user) {
        logDeleteAccount('[DELETE ACCOUNT ERROR]', { ...logPayload, error: 'missing-current-user' }, true)
        setDeleteError('Necesitamos que vuelvas a iniciar sesión para eliminar la cuenta.')
        return
      }

      if (providerId === 'password') {
        if (!user.email || !deletePassword) {
          logDeleteAccount('[DELETE ACCOUNT ERROR]', { ...logPayload, error: 'missing-password-or-email' }, true)
          setDeleteError('Ingresá tu contraseña actual para confirmar.')
          return
        }

        deleteStage = 'reauth'
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, deletePassword))
        logDeleteAccount('[DELETE ACCOUNT REAUTH OK]', logPayload)
      } else if (providerId === 'google.com') {
        if (!googleWebClientId) {
          logDeleteAccount('[DELETE ACCOUNT ERROR]', { ...logPayload, error: 'missing-google-web-client-id' }, true)
          setDeleteError('Falta configurar Google para confirmar la eliminación.')
          return
        }

        deleteStage = 'reauth'
        if (Platform.OS === 'web') {
          const provider = new GoogleAuthProvider()
          provider.setCustomParameters({ prompt: 'select_account' })
          await reauthenticateWithPopup(user, provider)
        } else {
          const idToken = await getGoogleIdTokenForReauth()
          if (!idToken) {
            logDeleteAccount('[DELETE ACCOUNT ERROR]', { ...logPayload, error: 'missing-google-id-token' }, true)
            setDeleteError('Google no devolvió un token válido. No se eliminó nada.')
            return
          }

          await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken))
        }
        logDeleteAccount('[DELETE ACCOUNT REAUTH OK]', logPayload)
      } else {
        logDeleteAccount('[DELETE ACCOUNT ERROR]', { ...logPayload, error: 'unknown-provider' }, true)
        setDeleteError('No pudimos detectar el método de ingreso de esta cuenta.')
        return
      }

      deleteStage = 'firestore'
      await setDoc(doc(db, 'users', user.uid), {
        deletedAt: serverTimestamp(),
        isDeleted: true,
        status: 'deleted',
        updatedAt: serverTimestamp(),
      }, { merge: true })
      logDeleteAccount('[DELETE ACCOUNT FIRESTORE MARK OK]', logPayload)

      deleteStage = 'auth-delete'
      await deleteUser(user)
      logDeleteAccount('[DELETE ACCOUNT AUTH DELETE OK]', logPayload)
      Alert.alert('Cuenta eliminada', 'Tu cuenta fue eliminada correctamente.')
      await signOut(auth).catch(() => {})
      router.replace(LOGIN_ROUTE)
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
      const normalizedCode = code.toLowerCase()
      const message = error instanceof Error ? error.message : ''
      logDeleteAccount('[DELETE ACCOUNT ERROR]', { code, error: getAccountErrorMessage(error), stage: deleteStage }, true)

      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
        setDeleteError('La reautenticación falló. No se eliminó nada.')
        return
      }

      if (code === 'auth/requires-recent-login') {
        setDeleteError('Necesitamos confirmar tu identidad otra vez antes de eliminar la cuenta.')
        return
      }

      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        normalizedCode.includes('sign_in_cancelled') ||
        normalizedCode.includes('cancelled') ||
        normalizedCode.includes('cancel')
      ) {
        setDeleteError('Cancelaste la confirmación con Google. No se eliminó nada.')
        return
      }

      if (message === 'google-signin-cancelled') {
        setDeleteError('Cancelaste la confirmaciÃ³n con Google. No se eliminÃ³ nada.')
        return
      }

      if (message === 'google-signin-development-build-required' || message.includes('RNGoogleSignin')) {
        setDeleteError('Google Sign-In requiere development build.')
        return
      }

      if (deleteStage === 'reauth') {
        setDeleteError('No pudimos confirmar tu identidad con Google. No se eliminó nada.')
        return
      }

      if (deleteStage === 'firestore') {
        setDeleteError('Confirmamos tu identidad, pero no pudimos marcar tu perfil como eliminado. No se eliminó la cuenta.')
        return
      }

      if (deleteStage === 'auth-delete') {
        setDeleteError('Marcamos tu perfil como eliminado, pero no pudimos eliminar el usuario de Firebase Authentication. Intentá nuevamente.')
        return
      }

      setDeleteError('No pudimos eliminar la cuenta. Intentá nuevamente en unos segundos.')
    } finally {
      setIsDeletingAccount(false)
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
                {account.photoURL ? (
                  <Image resizeMode="cover" source={{ uri: account.photoURL }} style={styles.accountImage} />
                ) : (
                  <UserRound color="#17803C" size={32} strokeWidth={2.1} />
                )}
              </View>
              <Text numberOfLines={2} style={styles.name}>{account.name}</Text>
              <InfoRow Icon={Mail} label="Email" value={account.email} />
              <InfoRow Icon={MapPin} label="Ciudad" value={account.city} />
            </View>

            <View style={styles.actionsCard}>
              <ActionRow Icon={Pencil} label="Editar perfil social" onPress={openProfileEditor} />
              <ActionRow Icon={KeyRound} label="Cambiar contrasena" onPress={openPasswordModal} />
            </View>

            <View style={styles.dangerCard}>
              <Text style={styles.dangerTitle}>Zona sensible</Text>
              <ActionRow Icon={AlertTriangle} destructive label="Eliminar cuenta" onPress={openDeleteModal} />
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
      <DeleteAccountModal
        error={deleteError}
        providerId={deleteProviderId}
        isSaving={isDeletingAccount}
        onCancel={cancelDeleteAccount}
        onChangePassword={(value) => {
          setDeletePassword(value)
          if (deleteError) setDeleteError('')
        }}
        onConfirm={() => {
          void deleteAccount()
        }}
        password={deletePassword}
        visible={isDeleteModalVisible}
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

function DeleteAccountModal({
  error,
  isSaving,
  onCancel,
  onChangePassword,
  onConfirm,
  password,
  providerId,
  visible,
}: {
  error: string
  isSaving: boolean
  onCancel: () => void
  onChangePassword: (value: string) => void
  onConfirm: () => void
  password: string
  providerId: DeleteProviderId
  visible: boolean
}) {
  const isPasswordProvider = providerId === 'password'
  const isGoogleProvider = providerId === 'google.com'
  const confirmLabel = isGoogleProvider ? 'Continuar con Google' : 'Eliminar cuenta'
  const passwordIsEmpty = isPasswordProvider && password.trim().length === 0
  const isConfirmDisabled = isSaving || passwordIsEmpty

  return (
    <Modal animationType="slide" onRequestClose={onCancel} visible={visible}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <PressScale
              accessibilityLabel="Cancelar eliminación de cuenta"
              accessibilityRole="button"
              onPress={onCancel}
              scaleTo={0.94}
              style={styles.backButton}
            >
              <ChevronLeft color="#063C31" size={27} strokeWidth={2.5} />
            </PressScale>
            <Text style={styles.title}>Eliminar cuenta</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.editCard}>
            <View style={styles.dangerIcon}>
              <AlertTriangle color="#B42318" size={34} strokeWidth={2.1} />
            </View>
            <Text style={styles.passwordTitle}>Eliminar cuenta de forma permanente</Text>
            <Text style={styles.passwordSubtitle}>
              Esta acción elimina el acceso a COINCIDIR y marca tu perfil como eliminado. Antes de continuar, confirmá tu identidad.
            </Text>

            {isPasswordProvider ? (
              <EditField
                label="Contraseña actual"
                onChangeText={onChangePassword}
                placeholder="Ingresá tu contraseña"
                secureTextEntry
                value={password}
              />
            ) : null}

            {isGoogleProvider ? (
              <Text style={styles.googleDeleteHint}>
                Confirmar con Google: no necesitás ingresar contraseña. Te vamos a pedir que confirmes tu identidad con Google antes de eliminar la cuenta.
              </Text>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {Platform.OS === 'android' ? (
              <Pressable
                accessibilityRole="button"
                disabled={isConfirmDisabled}
                onPress={onConfirm}
                style={{
                  alignItems: 'center',
                  backgroundColor: '#B42318',
                  borderRadius: 16,
                  elevation: 4,
                  justifyContent: 'center',
                  marginBottom: 12,
                  marginTop: 24,
                  minHeight: 56,
                  opacity: isConfirmDisabled ? 0.55 : 1,
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  width: '100%',
                }}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 16,
                      fontWeight: '800',
                      textAlign: 'center',
                    }}
                  >
                    {confirmLabel}
                  </Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={isConfirmDisabled}
                onPress={onConfirm}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && !isConfirmDisabled && styles.deleteButtonPressed,
                  isConfirmDisabled && styles.saveButtonDisabled,
                ]}
              >
                {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.deleteButtonText}>{confirmLabel}</Text>}
              </Pressable>
            )}

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

function ActionRow({ destructive = false, Icon, label, onPress }: { destructive?: boolean; Icon: LucideIcon; label: string; onPress: () => void }) {
  const color = destructive ? '#B42318' : '#063C31'

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
    >
      <View style={styles.actionContent}>
        <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
          <Icon color={color} size={20} strokeWidth={2.2} />
        </View>
        <Text numberOfLines={1} style={[styles.actionLabel, destructive && styles.actionLabelDestructive]}>{label}</Text>
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
    ...Platform.select({
      web: {
        alignSelf: 'center',
        maxWidth: 760,
        paddingHorizontal: 24,
        width: '100%',
      },
      default: {},
    }),
  },
  editContent: {
    paddingBottom: 34,
    paddingHorizontal: 20,
    paddingTop: 14,
    ...Platform.select({
      web: {
        alignSelf: 'center',
        maxWidth: 720,
        paddingHorizontal: 24,
        width: '100%',
      },
      default: {},
    }),
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
    paddingHorizontal: 22,
    paddingVertical: 24,
    ...shadow,
  },
  accountIcon: {
    alignItems: 'center',
    backgroundColor: '#F0F8EC',
    borderColor: '#B7DC9D',
    borderRadius: 999,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    width: 88,
  },
  accountImage: {
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  name: {
    color: '#063C31',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 27,
    marginBottom: 20,
    maxWidth: '100%',
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
  rowIconDestructive: {
    backgroundColor: '#FFF2F0',
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
    flexShrink: 1,
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
  dangerCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F6C8C2',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    overflow: 'hidden',
    paddingTop: 14,
    ...shadow,
  },
  dangerTitle: {
    color: '#8F1D14',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 4,
    paddingHorizontal: 16,
    textTransform: 'uppercase',
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
  actionLabelDestructive: {
    color: '#B42318',
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
  dangerIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF2F0',
    borderColor: '#F6C8C2',
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
  googleDeleteHint: {
    alignSelf: 'stretch',
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderRadius: 14,
    borderWidth: 1,
    color: '#7C2D12',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: 'center',
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
  deleteButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#B42318',
    borderRadius: 999,
    minHeight: 58,
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: '100%',
  },
  deleteButtonPressed: {
    backgroundColor: '#8F1D14',
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
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
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

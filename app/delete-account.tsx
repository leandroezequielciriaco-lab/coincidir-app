import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Mail, ShieldCheck, Trash2 } from 'lucide-react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const SUPPORT_EMAIL = 'appcoincidir@gmail.com'
const MAILTO_URL = `mailto:${SUPPORT_EMAIL}?subject=Eliminar%20cuenta%20COINCIDIR`

export default function DeleteAccountScreen() {
  const openSupportEmail = () => {
    void Linking.openURL(MAILTO_URL)
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Trash2 color="#17803C" size={34} strokeWidth={2.1} />
          </View>
          <Text style={styles.title}>Eliminar cuenta - COINCIDIR</Text>
          <Text style={styles.subtitle}>
            Instrucciones para solicitar o completar la eliminación de una cuenta de usuario.
          </Text>
        </View>

        <View style={styles.document}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Desde la aplicación</Text>
            <Text style={styles.paragraph}>
              Los usuarios pueden eliminar su cuenta directamente desde la aplicación:
            </Text>
            <View style={styles.pathBox}>
              <Text style={styles.pathText}>Perfil → Mi Cuenta → Eliminar cuenta</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Qué sucede al eliminar la cuenta</Text>
            <Text style={styles.paragraph}>
              Al eliminar la cuenta se eliminan los datos asociados al perfil del usuario y el acceso a la aplicación.
            </Text>
            <Text style={styles.paragraph}>
              Algunos registros técnicos o copias de seguridad pueden conservarse temporalmente por motivos de seguridad y recuperación durante un plazo máximo de 30 días.
            </Text>
          </View>

          <View style={[styles.section, styles.lastSection]}>
            <Text style={styles.sectionTitle}>Asistencia</Text>
            <Text style={styles.paragraph}>
              Si el usuario tiene inconvenientes para eliminar la cuenta desde la aplicación, puede solicitar asistencia escribiendo a:
            </Text>

            <Pressable
              accessibilityLabel={`Enviar correo a ${SUPPORT_EMAIL}`}
              accessibilityRole="link"
              onPress={openSupportEmail}
              style={({ pressed }) => [styles.mailButton, pressed && styles.pressed]}
            >
              <Mail color="#063C31" size={20} strokeWidth={2.2} />
              <Text style={styles.mailText}>{SUPPORT_EMAIL}</Text>
            </Pressable>

            <View style={styles.subjectBox}>
              <ShieldCheck color="#17803C" size={20} strokeWidth={2.1} />
              <View style={styles.subjectTextGroup}>
                <Text style={styles.subjectLabel}>Asunto</Text>
                <Text style={styles.subjectText}>Eliminar cuenta COINCIDIR</Text>
              </View>
            </View>
          </View>
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
    backgroundColor: '#F6F3EA',
    flex: 1,
  },
  content: {
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 28,
    ...Platform.select({
      web: {
        alignSelf: 'center',
        maxWidth: 860,
        paddingHorizontal: 24,
        width: '100%',
      },
      default: {},
    }),
  },
  hero: {
    alignItems: 'center',
    paddingBottom: 22,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#E9F6E4',
    borderColor: '#B7DC9D',
    borderRadius: 999,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    marginBottom: 14,
    width: 72,
  },
  title: {
    color: '#063C31',
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 35,
    textAlign: 'center',
  },
  subtitle: {
    color: '#596A65',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 560,
    textAlign: 'center',
  },
  document: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    ...shadow,
  },
  section: {
    borderBottomColor: '#EFEEE9',
    borderBottomWidth: 1,
    marginBottom: 18,
    paddingBottom: 18,
  },
  lastSection: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  sectionTitle: {
    color: '#063C31',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 24,
    marginBottom: 8,
  },
  paragraph: {
    color: '#314641',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 23,
    marginBottom: 10,
  },
  pathBox: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F8EC',
    borderColor: '#B7DC9D',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pathText: {
    color: '#063C31',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 21,
  },
  mailButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6E9',
    borderColor: '#B7DC9D',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.76,
  },
  mailText: {
    color: '#063C31',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 20,
  },
  subjectBox: {
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    borderColor: '#E7E7E1',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    padding: 14,
  },
  subjectTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  subjectLabel: {
    color: '#596A65',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  subjectText: {
    color: '#071D19',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: 2,
  },
})

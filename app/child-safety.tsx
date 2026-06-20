import { Stack, useRouter } from 'expo-router'
import Head from 'expo-router/head'
import { ChevronLeft, Mail, ShieldCheck } from 'lucide-react-native'
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const CONTACT_EMAIL = 'appcoincidir@gmail.com'

const sections = [
  {
    title: '1. Política contra la explotación y el abuso sexual infantil (CSAE)',
    body: [
      'COINCIDIR mantiene una política de tolerancia cero frente a cualquier forma de explotación y abuso sexual infantil (CSAE), incluido el material de abuso sexual infantil (CSAM).',
      'Está prohibido utilizar COINCIDIR para crear, publicar, solicitar, almacenar, compartir, promocionar o facilitar contenido o conductas que exploten, sexualicen o pongan en riesgo a niñas, niños o adolescentes.',
      'COINCIDIR está destinada a personas mayores de 18 años. La protección de menores se aplica a todo el contenido y a todas las interacciones vinculadas con la plataforma.',
    ],
  },
  {
    title: '2. Contenido y conductas prohibidas',
    body: [
      'Se prohíben expresamente:',
      '• Imágenes, videos, audios, textos, enlaces o representaciones de abuso sexual infantil, reales o generados digitalmente.',
      '• La sexualización de menores o los comentarios sexuales dirigidos a menores.',
      '• El grooming, la captación, la manipulación o el contacto con fines sexuales.',
      '• La sextorsión, las amenazas o el intercambio no consentido de contenido íntimo que involucre a menores.',
      '• La trata, explotación, oferta, solicitud o facilitación de encuentros sexuales con menores.',
      '• Cualquier intento de ocultar, normalizar, promover o facilitar estas conductas.',
    ],
  },
  {
    title: '3. Sistema de denuncias',
    body: [
      `Cualquier persona puede denunciar contenido, perfiles o conductas sospechosas escribiendo a ${CONTACT_EMAIL}.`,
      'La denuncia debe incluir, cuando sea posible y sin reenviar material ilegal: el nombre del perfil, una descripción del hecho, la fecha aproximada y cualquier dato que permita localizar el contenido.',
      'Si una niña, niño o adolescente está en peligro inmediato, contactá primero a los servicios de emergencia o a la autoridad competente de tu jurisdicción.',
    ],
  },
  {
    title: '4. Medidas de moderación y respuesta',
    body: [
      'COINCIDIR aplica controles preventivos sobre contenido publicado y revisa las denuncias relacionadas con seguridad infantil con carácter prioritario.',
      'Ante una infracción o un riesgo razonable, COINCIDIR puede retirar o bloquear contenido, restringir o suspender cuentas y preservar la información necesaria para la investigación.',
      'Cuando corresponda, COINCIDIR colaborará con las autoridades competentes y realizará los reportes exigidos por la legislación aplicable. No se notificará previamente a una persona denunciada cuando hacerlo pueda aumentar el riesgo o interferir con una investigación.',
    ],
  },
  {
    title: '5. Contacto',
    body: [
      `Responsable de seguridad infantil de COINCIDIR: ${CONTACT_EMAIL}`,
      'Este canal está disponible para usuarios, autoridades y organizaciones de protección infantil.',
    ],
  },
] as const

export default function ChildSafetyScreen() {
  const router = useRouter()

  const goBack = () => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace('/legal/privacy')
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Estándares de seguridad infantil | COINCIDIR' }} />
      <Head>
        <title>Estándares de seguridad infantil | COINCIDIR</title>
        <meta
          content="Política de COINCIDIR contra la explotación y el abuso sexual infantil, sistema de denuncias y medidas de moderación."
          name="description"
        />
      </Head>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Volver"
            accessibilityRole="button"
            onPress={goBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ChevronLeft color="#063C31" size={27} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <ShieldCheck color="#17803C" size={34} strokeWidth={2.1} />
          </View>
          <Text style={styles.eyebrow}>COINCIDIR</Text>
          <Text style={styles.title}>Estándares de seguridad infantil</Text>
          <Text style={styles.updated}>Última actualización: Junio 2026</Text>
        </View>

        <View style={styles.document}>
          <Text style={styles.intro}>
            Estos estándares explican cómo COINCIDIR previene y responde ante la explotación y el abuso sexual infantil.
          </Text>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.body.map((paragraph) => (
                <Text key={paragraph} style={[styles.paragraph, paragraph.startsWith('•') && styles.bullet]}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <Pressable
          accessibilityHint="Abre tu aplicación de correo"
          accessibilityLabel={`Enviar correo a ${CONTACT_EMAIL}`}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=Denuncia%20de%20seguridad%20infantil%20-%20COINCIDIR`)}
          style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}
        >
          <Mail color="#FFFFFF" size={21} strokeWidth={2.2} />
          <View style={styles.contactCopy}>
            <Text style={styles.contactLabel}>Canal de denuncias</Text>
            <Text style={styles.contactEmail}>{CONTACT_EMAIL}</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#F6F3EA', flex: 1 },
  content: {
    paddingBottom: 40,
    paddingHorizontal: 20,
    ...Platform.select({
      web: { alignSelf: 'center', maxWidth: 860, paddingHorizontal: 24, width: '100%' },
      default: {},
    }),
  },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  backButton: {
    alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E8DD', borderRadius: 18,
    borderWidth: 1, height: 48, justifyContent: 'center', width: 48,
  },
  pressed: { opacity: 0.76 },
  headerSpacer: { height: 48, width: 48 },
  hero: { alignItems: 'center', paddingBottom: 22, paddingTop: 18 },
  iconCircle: {
    alignItems: 'center', backgroundColor: '#E9F6E4', borderColor: '#B7DC9D', borderRadius: 999,
    borderWidth: 1, height: 72, justifyContent: 'center', marginBottom: 13, width: 72,
  },
  eyebrow: { color: '#17803C', fontSize: 12, fontWeight: '900', letterSpacing: 1.4, marginBottom: 5 },
  title: { color: '#063C31', fontSize: 29, fontWeight: '900', lineHeight: 35, textAlign: 'center' },
  updated: { color: '#596A65', fontSize: 14, fontWeight: '800', lineHeight: 20, marginTop: 8, textAlign: 'center' },
  document: { backgroundColor: '#FFFFFF', borderColor: '#E7E7E1', borderRadius: 18, borderWidth: 1, padding: 18 },
  intro: { color: '#314641', fontSize: 16, fontWeight: '700', lineHeight: 24, marginBottom: 21 },
  section: { marginBottom: 20 },
  sectionTitle: { color: '#063C31', fontSize: 18, fontWeight: '900', lineHeight: 24, marginBottom: 8 },
  paragraph: { color: '#314641', fontSize: 15, fontWeight: '600', lineHeight: 23, marginBottom: 8 },
  bullet: { paddingLeft: 8 },
  contactButton: {
    alignItems: 'center', alignSelf: 'stretch', backgroundColor: '#17803C', borderRadius: 18,
    flexDirection: 'row', gap: 12, marginTop: 16, minHeight: 68, paddingHorizontal: 18, paddingVertical: 12,
  },
  contactCopy: { flex: 1 },
  contactLabel: { color: '#DFF3E2', fontSize: 12, fontWeight: '800', lineHeight: 17 },
  contactEmail: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', lineHeight: 21 },
})

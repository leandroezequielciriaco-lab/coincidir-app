import { useRouter } from 'expo-router'
import { ChevronLeft, ShieldCheck } from 'lucide-react-native'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  legalLastUpdated,
  legalPrivacySections,
  legalPrivacyTitle,
} from '../../constants/legal'

export default function PrivacyPolicyScreen() {
  const router = useRouter()

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Volver"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ChevronLeft color="#063C31" size={27} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <ShieldCheck color="#17803C" size={32} strokeWidth={2.1} />
          </View>
          <Text style={styles.title}>{legalPrivacyTitle}</Text>
          <Text style={styles.updated}>{legalLastUpdated}</Text>
        </View>

        <View style={styles.document}>
          {legalPrivacySections.map((section, index) => (
            <View key={`${section.title}-${index}`} style={styles.section}>
              {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
              {section.body.map((paragraph, paragraphIndex) => (
                <Text
                  key={`${section.title}-${paragraphIndex}`}
                  style={[styles.paragraph, paragraph.startsWith('•') && styles.bullet]}
                >
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F6F3EA',
    flex: 1,
  },
  content: {
    paddingBottom: 36,
    paddingHorizontal: 20,
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8DD',
    borderRadius: 18,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  pressed: {
    opacity: 0.76,
  },
  headerSpacer: {
    height: 48,
    width: 48,
  },
  hero: {
    alignItems: 'center',
    paddingBottom: 20,
    paddingTop: 18,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#E9F6E4',
    borderColor: '#B7DC9D',
    borderRadius: 999,
    borderWidth: 1,
    height: 70,
    justifyContent: 'center',
    marginBottom: 14,
    width: 70,
  },
  title: {
    color: '#063C31',
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 35,
    textAlign: 'center',
  },
  updated: {
    color: '#596A65',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  document: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  section: {
    marginBottom: 18,
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
    marginBottom: 8,
  },
  bullet: {
    paddingLeft: 8,
  },
})

import { useState } from 'react'
import { ActivityIndicator, ImageBackground, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { serverTimestamp, setDoc, doc } from 'firebase/firestore'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getFirebaseServices } from '../firebaseConfig'
import { canonicalUserInterests } from '../constants/userInterests'
import { styles } from './InterestsScreen.styles'
import { requireVerifiedParticipation } from '../utils/authParticipation'

const interestsImage = require('../assets/images/interests-fullscreen.png')

const interestHitStyles = [
  'outdoorOne',
  'outdoorTwo',
  'outdoorThree',
  'outdoorFour',
  'outdoorFive',
  'outdoorSix',
  'outdoorSeven',
  'outdoorEight',
  'outdoorNine',
  'indoorOne',
  'indoorTwo',
  'indoorThree',
  'indoorFour',
  'indoorFive',
  'indoorSix',
]

const allActivities = interestHitStyles.map((hitStyle, index) => ({
  hitStyle,
  label: canonicalUserInterests[index],
})).filter((activity) => Boolean(activity.label))

export const outdoorActivities = allActivities.slice(0, 9)
export const indoorActivities = allActivities.slice(9)

function getFriendlySaveError(error) {
  if (error?.message?.includes('Faltan variables')) {
    return 'Falta configurar Firebase.'
  }

  if (error?.code === 'auth/no-current-user') {
    return 'No encontramos una sesión activa.'
  }

  if (error?.code === 'permission-denied') {
    return 'No tenemos permiso para guardar tus preferencias.'
  }

  if (error?.code === 'unavailable' || error?.code === 'deadline-exceeded') {
    return 'No pudimos conectar con Firestore.'
  }

  return 'No pudimos guardar tus actividades.'
}

export default function InterestsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [selectedInterests, setSelectedInterests] = useState(
    outdoorActivities.map((activity) => activity.label),
  )
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const toggleInterest = (interest) => {
    setError('')
    setSelectedInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    )
  }

  const saveInterests = async () => {
    if (selectedInterests.length === 0) {
      setError('Elegí al menos una actividad para continuar.')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const { auth, db } = getFirebaseServices()
      const user = auth.currentUser

      if (!user) {
        const authError = new Error('No current user')
        authError.code = 'auth/no-current-user'
        throw authError
      }

      if (!(await requireVerifiedParticipation(auth))) return

      await setDoc(
        doc(db, 'users', user.uid),
        {
          interests: selectedInterests,
          onboardingCompleted: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      router.replace('/home')
    } catch (saveError) {
      setError(getFriendlySaveError(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const skipInterests = async () => {
    setIsSaving(true)
    setError('')

    try {
      const { auth, db } = getFirebaseServices()
      const user = auth.currentUser

      if (user) {
        if (!(await requireVerifiedParticipation(auth))) return
        await setDoc(
          doc(db, 'users', user.uid),
          {
            interests: selectedInterests,
            onboardingCompleted: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
      }

      router.replace('/home')
    } catch (saveError) {
      setError(getFriendlySaveError(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const safeBackStyle = { top: Math.max(insets.top + 6, 16) }
  const safeContinueStyle = { bottom: Math.max(insets.bottom + 34, 50), top: undefined }
  const safeSkipStyle = { bottom: Math.max(insets.bottom + 8, 20), top: undefined }

  return (
    <View style={styles.screen}>
      <ImageBackground source={interestsImage} resizeMode="stretch" style={styles.image}>
        <Pressable
          accessibilityLabel="Volver"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={[styles.backHitArea, safeBackStyle]}
        />

        {allActivities.map((activity) => {
          const selected = selectedInterests.includes(activity.label)

          return (
            <Pressable
              accessibilityLabel={activity.label}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              key={activity.label}
              onPress={() => toggleInterest(activity.label)}
              style={[styles.activityHitArea, styles[activity.hitStyle]]}
            >
              {selected ? <View style={styles.selectedBadge} /> : null}
            </Pressable>
          )
        })}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          accessibilityLabel="Continuar"
          accessibilityRole="button"
          disabled={isSaving}
          onPress={saveInterests}
          style={[styles.continueHitArea, safeContinueStyle]}
        >
          {isSaving ? <ActivityIndicator color="#FFFFFF" /> : null}
        </Pressable>

        <Pressable
          accessibilityLabel="Podés elegir después"
          accessibilityRole="button"
          disabled={isSaving}
          onPress={skipInterests}
          style={[styles.skipHitArea, safeSkipStyle]}
        />
      </ImageBackground>
    </View>
  )
}

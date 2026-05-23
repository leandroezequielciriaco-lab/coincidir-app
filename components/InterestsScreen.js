import { useState } from 'react'
import { ActivityIndicator, ImageBackground, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { serverTimestamp, setDoc, doc } from 'firebase/firestore'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getFirebaseServices } from '../firebaseConfig'
import { styles } from './InterestsScreen.styles'

const interestsImage = require('../assets/images/interests-fullscreen.png')

export const outdoorActivities = [
  { label: 'Caminatas', hitStyle: 'outdoorOne' },
  { label: 'Yoga', hitStyle: 'outdoorTwo' },
  { label: 'Running', hitStyle: 'outdoorThree' },
  { label: 'Bicicleta', hitStyle: 'outdoorFour' },
  { label: 'Kayak/SUP', hitStyle: 'outdoorFive' },
  { label: 'Pesca', hitStyle: 'outdoorSix' },
  { label: 'Mateadas', hitStyle: 'outdoorSeven' },
  { label: 'Encuentros grupales', hitStyle: 'outdoorEight' },
  { label: 'Calistenia', hitStyle: 'outdoorNine' },
]

export const indoorActivities = [
  { label: 'Paddle / Tenis', hitStyle: 'indoorOne' },
  { label: 'Natación', hitStyle: 'indoorTwo' },
  { label: 'Escalada', hitStyle: 'indoorThree' },
  { label: 'Fútbol 5', hitStyle: 'indoorFour' },
  { label: 'Gimnasio', hitStyle: 'indoorFive' },
  { label: 'Clases grupales (Tango, Salsa, Folklore)', hitStyle: 'indoorSix' },
]

const allActivities = [...outdoorActivities, ...indoorActivities]

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

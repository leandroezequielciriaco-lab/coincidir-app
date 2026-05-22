import { getApp, getApps, initializeApp } from 'firebase/app'
import { Auth, getAuth } from 'firebase/auth'
import { Firestore, getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
}

const missingFirebaseKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

export function assertFirebaseConfig() {
  if (missingFirebaseKeys.length > 0) {
    throw new Error(
      `Faltan variables de entorno de Firebase: ${missingFirebaseKeys.join(', ')}`,
    )
  }
}

export function getFirebaseServices(): { auth: Auth; db: Firestore } {
  assertFirebaseConfig()

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

  return {
    auth: getAuth(app),
    db: getFirestore(app),
  }
}

import { getApp, getApps, initializeApp } from 'firebase/app'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  Auth,
  getAuth,
  initializeAuth,
} from 'firebase/auth'
// Expo/Metro resolves Firebase Auth's React Native entrypoint at runtime; TS uses the web declarations.
// @ts-expect-error getReactNativePersistence is exported by the React Native build of firebase/auth.
import { getReactNativePersistence } from 'firebase/auth'
import { Firestore, getFirestore } from 'firebase/firestore'
import { FirebaseStorage, getStorage } from 'firebase/storage'

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

let cachedAuth: Auth | null = null

function normalizeStorageBucket(bucket?: string) {
  return bucket?.trim().replace(/^gs:\/\//, '').replace(/\/$/, '') ?? ''
}

export function assertFirebaseConfig() {
  if (missingFirebaseKeys.length > 0) {
    throw new Error(
      `Faltan variables de entorno de Firebase: ${missingFirebaseKeys.join(', ')}`,
    )
  }
}

function getConfiguredAuth(app: ReturnType<typeof initializeApp>) {
  if (cachedAuth) return cachedAuth

  try {
    cachedAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    })
  } catch (error) {
    cachedAuth = getAuth(app)
    if (__DEV__) console.warn('firebase-auth-initialize-fallback', error)
  }

  return cachedAuth
}

export function getFirebaseServices(): { auth: Auth; db: Firestore; storage: FirebaseStorage } {
  assertFirebaseConfig()

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  const storageBucket = normalizeStorageBucket(firebaseConfig.storageBucket)

  if (!storageBucket) {
    throw new Error('Firebase Storage no está configurado: falta EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET.')
  }

  return {
    auth: getConfiguredAuth(app),
    db: getFirestore(app),
    storage: getStorage(app, `gs://${storageBucket}`),
  }
}

export function getFirebaseStorageBucketCandidates(): Array<{ bucket: string; storage: FirebaseStorage }> {
  assertFirebaseConfig()

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  const primaryBucket = normalizeStorageBucket(firebaseConfig.storageBucket)
  const legacyBucket = firebaseConfig.projectId ? `${firebaseConfig.projectId}.appspot.com` : ''
  const buckets = [primaryBucket, legacyBucket].filter((bucket, index, list): bucket is string => Boolean(bucket) && list.indexOf(bucket) === index)

  if (buckets.length === 0) {
    throw new Error('Firebase Storage no esta configurado: falta EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET.')
  }

  return buckets.map((bucket) => ({
    bucket,
    storage: getStorage(app, `gs://${bucket}`),
  }))
}

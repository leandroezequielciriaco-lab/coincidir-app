import { getApp, getApps, initializeApp } from 'firebase/app'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import {
  Auth,
  getAuth,
  initializeAuth,
  Persistence,
} from 'firebase/auth'
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

type ReactNativeAuthModule = typeof import('firebase/auth') & {
  getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence
}

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

  if (__DEV__) console.log('[AUTH INIT]', Platform.OS)

  if (Platform.OS === 'web') {
    if (__DEV__) console.log('[AUTH MODE]', 'web')
    cachedAuth = getAuth(app)
    return cachedAuth
  }

  if (__DEV__) console.log('[AUTH MODE]', 'native')

  try {
    if (__DEV__) console.log('[AUTH RESTORE START]', { source: 'initializeAuth' })
    const { getReactNativePersistence } = require('firebase/auth') as ReactNativeAuthModule

    if (typeof getReactNativePersistence !== 'function') {
      throw new TypeError('getReactNativePersistence is not available in this Firebase Auth build')
    }

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

  if (__DEV__) console.log('Firebase storage bucket config', firebaseConfig.storageBucket)

  return {
    auth: getConfiguredAuth(app),
    db: getFirestore(app),
    storage: getStorage(app, `gs://${storageBucket}`),
  }
}

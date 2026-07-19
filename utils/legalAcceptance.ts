import { doc, serverTimestamp, setDoc } from 'firebase/firestore'

import { getFirebaseServices } from '../firebaseConfig'
import { getLegalAcceptanceFields } from '../constants/legal'

export async function saveCurrentLegalAcceptance(uid: string) {
  if (!uid) {
    throw new Error('missing-user-id-for-legal-acceptance')
  }

  try {
    const { db } = getFirebaseServices()
    await setDoc(
      doc(db, 'users', uid),
      getLegalAcceptanceFields(serverTimestamp()),
      { merge: true },
    )
  } catch (error) {
    console.error('[LEGAL ACCEPTANCE SAVE ERROR]', { uid, error })
    throw error
  }
}

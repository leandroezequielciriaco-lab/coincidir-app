import type * as ImagePicker from 'expo-image-picker'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'

import { getFirebaseServices } from '../firebaseConfig'

export function readRemoteGroupPhotoUrl(data: Record<string, unknown> | null | undefined) {
  const candidates = [
    data?.imageUrl,
    data?.photoURL,
    data?.photoUrl,
    data?.coverUrl,
    data?.coverURL,
    data?.coverImage,
  ]

  return candidates
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => /^https?:\/\//i.test(value)) ?? ''
}

async function getBlobFromUri(uri: string, timeoutMs = 20000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(uri, { signal: controller.signal })
    if (!response.ok) throw new Error(`group-photo-fetch-failed:${response.status}`)

    const blob = await response.blob()
    if (blob.size <= 0) throw new Error('group-photo-empty-blob')

    return blob
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function uploadGroupPhoto(groupId: string, asset: ImagePicker.ImagePickerAsset) {
  if (!groupId) throw new Error('group-photo-missing-group-id')
  if (!asset.uri) throw new Error('group-photo-missing-uri')

  const { auth, storage } = getFirebaseServices()
  const authUid = auth.currentUser?.uid
  if (!authUid) throw new Error('group-photo-auth-required')

  const contentType = asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg'
  let blob: Blob | null = null

  try {
    blob = await getBlobFromUri(asset.uri)
    const uploadBlob = blob.type?.startsWith('image/')
      ? blob
      : new Blob([blob], { type: contentType })
    const storageRef = ref(storage, `groups/${groupId}/cover.jpg`)

    await Promise.race([
      uploadBytes(storageRef, uploadBlob, {
        cacheControl: 'public,max-age=3600',
        contentType: uploadBlob.type || contentType,
        customMetadata: {
          groupId,
          owner: authUid,
        },
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('group-photo-upload-timeout')), 30000)
      }),
    ])

    return getDownloadURL(storageRef)
  } finally {
    const close = (blob as Blob & { close?: () => void } | null)?.close
    if (typeof close === 'function') close.call(blob)
  }
}

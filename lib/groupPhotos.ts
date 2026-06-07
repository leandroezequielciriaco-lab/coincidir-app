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

function getBlobFromUriWithXhr(uri: string, timeoutMs = 20000) {
  return new Promise<Blob>((resolve, reject) => {
    const request = new XMLHttpRequest()

    request.responseType = 'blob'
    request.timeout = timeoutMs
    request.onload = () => {
      const blob = request.response as Blob | null
      if (!blob || blob.size <= 0) {
        reject(new Error('group-photo-empty-xhr-blob'))
        return
      }

      resolve(blob)
    }
    request.onerror = () => reject(new Error('group-photo-xhr-failed'))
    request.ontimeout = () => reject(new Error('group-photo-xhr-timeout'))
    request.open('GET', uri)
    request.send()
  })
}

async function readGroupPhotoBlob(uri: string) {
  try {
    return await getBlobFromUri(uri)
  } catch (error) {
    if (__DEV__) console.warn('[GROUP IMAGE FETCH FALLBACK]', error)
    return getBlobFromUriWithXhr(uri)
  }
}

export async function uploadGroupPhoto(groupId: string, asset: ImagePicker.ImagePickerAsset) {
  if (!groupId) throw new Error('group-photo-missing-group-id')
  if (!asset.uri) throw new Error('group-photo-missing-uri')

  const { auth, storage } = getFirebaseServices()
  const authUid = auth.currentUser?.uid
  if (!authUid) throw new Error('group-photo-auth-required')

  const contentType = asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg'
  const storagePath = `groups/${authUid}/${groupId}/cover.jpg`
  let blob: Blob | null = null

  try {
    blob = await readGroupPhotoBlob(asset.uri)
    const uploadBlob = blob.type?.startsWith('image/')
      ? blob
      : new Blob([blob], { type: contentType })
    const storageRef = ref(storage, storagePath)

    if (__DEV__) {
      console.log('[GROUP PHOTO AUTH]', auth.currentUser?.uid)
      console.log('[GROUP PHOTO BUCKET]', storage.app.options.storageBucket)
      console.log('[GROUP PHOTO PATH]', storagePath)
      console.log('[GROUP PHOTO UPLOAD START]')
    }

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

    const downloadURL = await getDownloadURL(storageRef)
    if (!/^https?:\/\//i.test(downloadURL)) throw new Error('group-photo-invalid-download-url')

    if (__DEV__) console.log('[GROUP IMAGE UPLOAD OK]', downloadURL)

    return downloadURL
  } catch (error) {
    console.error('[GROUP IMAGE UPLOAD ERROR]', error)
    throw error
  } finally {
    const close = (blob as Blob & { close?: () => void } | null)?.close
    if (typeof close === 'function') close.call(blob)
  }
}

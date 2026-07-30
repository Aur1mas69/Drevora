/**
 * Native Android offline media storage — Capacitor Filesystem Directory.Data.
 * Web/PWA builds resolve `@/lib/offlineMedia/offlineMediaStorage` to the IndexedDB adapter.
 */

import { Directory, Filesystem } from '@capacitor/filesystem'
import {
  buildOfflineCheckMediaDir,
  buildOfflinePhotoPath,
  buildOfflineSignaturePath,
  extensionForMime,
  OFFLINE_VEHICLE_CHECK_MEDIA_ROOT,
  OfflineMediaStorageError,
  toOfflineMediaStorageError,
  type OfflineMediaWriteResult,
} from '@/lib/offlineMedia/paths'

export {
  OFFLINE_VEHICLE_CHECK_MEDIA_ROOT,
  OfflineMediaStorageError,
  buildOfflineCheckMediaDir,
  buildOfflinePhotoPath,
  buildOfflineSignaturePath,
  type OfflineMediaWriteResult,
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function ensureOfflineMediaDirectory(relativeDir: string): Promise<void> {
  try {
    await Filesystem.mkdir({
      path: relativeDir,
      directory: Directory.Data,
      recursive: true,
    })
  } catch {
    // Directory may already exist.
  }
}

export async function writeOfflineMediaFile(input: {
  relativePath: string
  data: ArrayBuffer | Uint8Array
  mimeType: string
}): Promise<OfflineMediaWriteResult> {
  try {
    const directoryPath = input.relativePath.includes('/')
      ? input.relativePath.slice(0, input.relativePath.lastIndexOf('/'))
      : OFFLINE_VEHICLE_CHECK_MEDIA_ROOT
    await ensureOfflineMediaDirectory(directoryPath)

    const bytes =
      input.data instanceof Uint8Array ? input.data : new Uint8Array(input.data)
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    const base64 = arrayBufferToBase64(copy.buffer)

    await Filesystem.writeFile({
      path: input.relativePath,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    })

    return {
      path: input.relativePath,
      mimeType: input.mimeType || 'image/jpeg',
      byteLength: bytes.byteLength,
    }
  } catch (error) {
    throw toOfflineMediaStorageError(error)
  }
}

export async function writeOfflineMediaFromFile(input: {
  relativePath: string
  file: File
}): Promise<OfflineMediaWriteResult> {
  try {
    const buffer = await input.file.arrayBuffer()
    return writeOfflineMediaFile({
      relativePath: input.relativePath,
      data: buffer,
      mimeType: input.file.type || 'image/jpeg',
    })
  } catch (error) {
    throw toOfflineMediaStorageError(error)
  }
}

export async function readOfflineMediaAsFile(input: {
  relativePath: string
  mimeType?: string | null
  fileName?: string
}): Promise<File> {
  try {
    const result = await Filesystem.readFile({
      path: input.relativePath,
      directory: Directory.Data,
    })

    const raw = typeof result.data === 'string' ? result.data : ''
    if (!raw) {
      throw new OfflineMediaStorageError(
        'Local offline photo or signature is missing. Complete the Vehicle Check again offline.',
        'missing',
      )
    }

    const bytes = base64ToUint8Array(raw)
    const mimeType = input.mimeType?.trim() || 'image/jpeg'
    const fileName =
      input.fileName?.trim() ||
      input.relativePath.split('/').pop() ||
      `offline-media.${extensionForMime(mimeType)}`

    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    return new File([copy], fileName, { type: mimeType })
  } catch (error) {
    throw toOfflineMediaStorageError(error)
  }
}

export async function deleteOfflineMediaFile(relativePath: string): Promise<void> {
  const trimmed = relativePath.trim()
  if (!trimmed) return
  try {
    await Filesystem.deleteFile({
      path: trimmed,
      directory: Directory.Data,
    })
  } catch {
    // Missing files are fine during cleanup.
  }
}

export async function deleteOfflineMediaDirectory(relativeDir: string): Promise<void> {
  const trimmed = relativeDir.trim()
  if (!trimmed) return
  try {
    await Filesystem.rmdir({
      path: trimmed,
      directory: Directory.Data,
      recursive: true,
    })
  } catch {
    // Missing dirs are fine during cleanup.
  }
}

export async function listOfflineMediaDirectories(
  relativeRoot = OFFLINE_VEHICLE_CHECK_MEDIA_ROOT,
): Promise<string[]> {
  try {
    const listing = await Filesystem.readdir({
      path: relativeRoot,
      directory: Directory.Data,
    })
    return (listing.files ?? [])
      .filter((entry) => entry.type === 'directory' || !entry.type)
      .map((entry) => entry.name)
      .filter((name) => typeof name === 'string' && name.length > 0)
  } catch {
    return []
  }
}

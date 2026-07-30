/**
 * Web/PWA offline media storage — IndexedDB Blob/File records.
 * Native builds resolve `@/lib/offlineMedia/offlineMediaStorage` to the Filesystem adapter.
 *
 * Never stores media in localStorage. Never base64-encodes media into queue metadata.
 */

import {
  buildOfflineCheckMediaDir,
  buildOfflinePhotoPath,
  buildOfflineSignaturePath,
  extensionForMime,
  OFFLINE_VEHICLE_CHECK_MEDIA_ROOT,
  OfflineMediaStorageError,
  queueItemIdFromMediaPath,
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

/** IndexedDB database name for offline Vehicle Check media. */
export const OFFLINE_MEDIA_IDB_NAME = 'drevora-offline-vehicle-check-media'
/** Object store: key = logical media path, value = Blob + metadata. */
export const OFFLINE_MEDIA_IDB_STORE = 'media'
const OFFLINE_MEDIA_IDB_VERSION = 1

type OfflineMediaIdbRecord = {
  key: string
  blob: Blob
  mimeType: string
  queueItemId: string
  createdAt: string
  fileName: string
}

function openMediaDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new OfflineMediaStorageError(
        'Offline photo storage is not available in this browser.',
        'unavailable',
      ),
    )
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_MEDIA_IDB_NAME, OFFLINE_MEDIA_IDB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(OFFLINE_MEDIA_IDB_STORE)) {
        const store = db.createObjectStore(OFFLINE_MEDIA_IDB_STORE, { keyPath: 'key' })
        store.createIndex('queueItemId', 'queueItemId', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        toOfflineMediaStorageError(
          request.error ?? new Error('Unable to open offline media storage.'),
        ),
      )
    request.onblocked = () =>
      reject(
        new OfflineMediaStorageError(
          'Offline media storage is blocked by another tab. Close other DREVORA tabs and try again.',
          'unavailable',
        ),
      )
  })
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(toOfflineMediaStorageError(request.error))
  })
}

function idbTransactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () =>
      reject(toOfflineMediaStorageError(tx.error ?? new Error('Offline media write aborted.')))
    tx.onerror = () =>
      reject(toOfflineMediaStorageError(tx.error ?? new Error('Offline media write failed.')))
  })
}

export async function ensureOfflineMediaDirectory(_relativeDir: string): Promise<void> {
  // IndexedDB is key-based; directories are logical only.
  await openMediaDb().then((db) => db.close())
}

export async function writeOfflineMediaFile(input: {
  relativePath: string
  data: ArrayBuffer | Uint8Array
  mimeType: string
}): Promise<OfflineMediaWriteResult> {
  try {
    const bytes =
      input.data instanceof Uint8Array ? input.data : new Uint8Array(input.data)
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    const mimeType = input.mimeType || 'image/jpeg'
    const blob = new Blob([copy], { type: mimeType })
    const queueItemId = queueItemIdFromMediaPath(input.relativePath) || 'unknown'
    const record: OfflineMediaIdbRecord = {
      key: input.relativePath,
      blob,
      mimeType,
      queueItemId,
      createdAt: new Date().toISOString(),
      fileName: input.relativePath.split('/').pop() || `offline-media.${extensionForMime(mimeType)}`,
    }

    const db = await openMediaDb()
    try {
      const tx = db.transaction(OFFLINE_MEDIA_IDB_STORE, 'readwrite')
      tx.objectStore(OFFLINE_MEDIA_IDB_STORE).put(record)
      await idbTransactionDone(tx)
    } finally {
      db.close()
    }

    return {
      path: input.relativePath,
      mimeType,
      byteLength: copy.byteLength,
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
    const mimeType = input.file.type || 'image/jpeg'
    const queueItemId = queueItemIdFromMediaPath(input.relativePath) || 'unknown'
    const record: OfflineMediaIdbRecord = {
      key: input.relativePath,
      blob: input.file,
      mimeType,
      queueItemId,
      createdAt: new Date().toISOString(),
      fileName: input.file.name || input.relativePath.split('/').pop() || 'offline-media.jpg',
    }

    const db = await openMediaDb()
    try {
      const tx = db.transaction(OFFLINE_MEDIA_IDB_STORE, 'readwrite')
      tx.objectStore(OFFLINE_MEDIA_IDB_STORE).put(record)
      await idbTransactionDone(tx)
    } finally {
      db.close()
    }

    return {
      path: input.relativePath,
      mimeType,
      byteLength: input.file.size,
    }
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
    const db = await openMediaDb()
    try {
      const tx = db.transaction(OFFLINE_MEDIA_IDB_STORE, 'readonly')
      const record = await idbRequest<OfflineMediaIdbRecord | undefined>(
        tx.objectStore(OFFLINE_MEDIA_IDB_STORE).get(input.relativePath),
      )
      await idbTransactionDone(tx)

      if (!record?.blob) {
        throw new OfflineMediaStorageError(
          'Local offline photo or signature is missing. Complete the Vehicle Check again offline.',
          'missing',
        )
      }

      const mimeType = input.mimeType?.trim() || record.mimeType || 'image/jpeg'
      const fileName =
        input.fileName?.trim() ||
        record.fileName ||
        input.relativePath.split('/').pop() ||
        `offline-media.${extensionForMime(mimeType)}`

      return new File([record.blob], fileName, {
        type: mimeType,
        lastModified: Date.parse(record.createdAt) || Date.now(),
      })
    } finally {
      db.close()
    }
  } catch (error) {
    throw toOfflineMediaStorageError(error)
  }
}

export async function deleteOfflineMediaFile(relativePath: string): Promise<void> {
  const trimmed = relativePath.trim()
  if (!trimmed) return
  try {
    const db = await openMediaDb()
    try {
      const tx = db.transaction(OFFLINE_MEDIA_IDB_STORE, 'readwrite')
      tx.objectStore(OFFLINE_MEDIA_IDB_STORE).delete(trimmed)
      await idbTransactionDone(tx)
    } finally {
      db.close()
    }
  } catch {
    // Missing keys are fine during cleanup.
  }
}

export async function deleteOfflineMediaDirectory(relativeDir: string): Promise<void> {
  const prefix = relativeDir.trim().replace(/\/+$/, '')
  if (!prefix) return

  try {
    const db = await openMediaDb()
    try {
      const tx = db.transaction(OFFLINE_MEDIA_IDB_STORE, 'readwrite')
      const store = tx.objectStore(OFFLINE_MEDIA_IDB_STORE)
      const queueItemId = queueItemIdFromMediaPath(prefix)
      if (queueItemId && prefix === buildOfflineCheckMediaDir(queueItemId)) {
        const index = store.index('queueItemId')
        const keys = await idbRequest<IDBValidKey[]>(index.getAllKeys(queueItemId))
        for (const key of keys) {
          store.delete(key)
        }
      } else {
        const keys = await idbRequest<IDBValidKey[]>(store.getAllKeys())
        for (const key of keys) {
          const keyStr = String(key)
          if (keyStr === prefix || keyStr.startsWith(`${prefix}/`)) {
            store.delete(key)
          }
        }
      }
      await idbTransactionDone(tx)
    } finally {
      db.close()
    }
  } catch {
    // Missing dirs/keys are fine during cleanup.
  }
}

export async function listOfflineMediaDirectories(
  relativeRoot = OFFLINE_VEHICLE_CHECK_MEDIA_ROOT,
): Promise<string[]> {
  try {
    const db = await openMediaDb()
    try {
      const tx = db.transaction(OFFLINE_MEDIA_IDB_STORE, 'readonly')
      const keys = await idbRequest<IDBValidKey[]>(
        tx.objectStore(OFFLINE_MEDIA_IDB_STORE).getAllKeys(),
      )
      await idbTransactionDone(tx)

      const dirs = new Set<string>()
      const rootPrefix = `${relativeRoot}/`
      for (const key of keys) {
        const keyStr = String(key)
        if (!keyStr.startsWith(rootPrefix)) continue
        const rest = keyStr.slice(rootPrefix.length)
        const queueItemId = rest.split('/')[0]
        if (queueItemId) dirs.add(queueItemId)
      }
      return [...dirs]
    } finally {
      db.close()
    }
  } catch {
    return []
  }
}

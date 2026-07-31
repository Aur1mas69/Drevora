/**
 * Web/PWA storage for Worker offline bootstrap JSON — IndexedDB.
 * Native builds resolve this module to Preferences.
 */

import {
  WORKER_OFFLINE_BOOTSTRAP_STORAGE_KEY,
} from '@/lib/workerOfflineBootstrap/types'

const IDB_NAME = 'drevora-worker-offline-bootstrap'
const IDB_STORE = 'bootstrap'
const IDB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Unable to open bootstrap storage'))
  })
}

export async function readBootstrapJson(): Promise<string | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const request = tx.objectStore(IDB_STORE).get(
        WORKER_OFFLINE_BOOTSTRAP_STORAGE_KEY,
      )
      request.onsuccess = () => {
        const value = request.result
        resolve(typeof value === 'string' ? value : null)
      }
      request.onerror = () => reject(request.error)
      tx.oncomplete = () => db.close()
    })
  } catch {
    return null
  }
}

export async function writeBootstrapJson(value: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, WORKER_OFFLINE_BOOTSTRAP_STORAGE_KEY)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error ?? new Error('Unable to write bootstrap storage'))
  })
}

export async function clearBootstrapJson(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(WORKER_OFFLINE_BOOTSTRAP_STORAGE_KEY)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // ignore
  }
}

export async function touchBootstrapHeartbeat(_note: string): Promise<void> {
  // Web/PWA: no Preferences heartbeat — IndexedDB write path is enough.
}

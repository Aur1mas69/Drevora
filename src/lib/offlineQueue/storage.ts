import {
  parseQueueItemsJson,
  storageKey,
} from '@/lib/offlineQueue/storageCommon'
import type { OfflineQueueItem } from '@/lib/offlineQueue/types'

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * Web/PWA offline queue persistence — isolated localStorage fallback.
 * Native builds resolve `@/lib/offlineQueue/storage` to `storage.native.ts`.
 */
export async function readQueueItems<TPayload>(
  module: string,
): Promise<OfflineQueueItem<TPayload>[]> {
  if (!canUseLocalStorage()) return []

  try {
    return parseQueueItemsJson<TPayload>(window.localStorage.getItem(storageKey(module)))
  } catch {
    return []
  }
}

export async function writeQueueItems<TPayload>(
  module: string,
  items: OfflineQueueItem<TPayload>[],
): Promise<void> {
  if (!canUseLocalStorage()) return

  try {
    window.localStorage.setItem(storageKey(module), JSON.stringify(items))
  } catch {
    // Quota / private mode — callers treat as best-effort local persistence.
  }
}

export async function clearQueueModule(module: string): Promise<void> {
  if (!canUseLocalStorage()) return

  try {
    window.localStorage.removeItem(storageKey(module))
  } catch {
    // ignore
  }
}

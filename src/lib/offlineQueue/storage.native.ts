import { Preferences } from '@capacitor/preferences'
import {
  parseQueueItemsJson,
  storageKey,
} from '@/lib/offlineQueue/storageCommon'
import type { OfflineQueueItem } from '@/lib/offlineQueue/types'

/**
 * Native Android offline queue persistence via official Capacitor Preferences.
 * Durable across process restarts; no WebView localStorage; no photo/signature blobs.
 */
export async function readQueueItems<TPayload>(
  module: string,
): Promise<OfflineQueueItem<TPayload>[]> {
  try {
    const result = await Preferences.get({ key: storageKey(module) })
    return parseQueueItemsJson<TPayload>(result.value)
  } catch {
    return []
  }
}

export async function writeQueueItems<TPayload>(
  module: string,
  items: OfflineQueueItem<TPayload>[],
): Promise<void> {
  try {
    await Preferences.set({
      key: storageKey(module),
      value: JSON.stringify(items),
    })
  } catch {
    // Best-effort; callers must not assume remote sync.
  }
}

export async function clearQueueModule(module: string): Promise<void> {
  try {
    await Preferences.remove({ key: storageKey(module) })
  } catch {
    // ignore
  }
}

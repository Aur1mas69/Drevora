import type { OfflineQueueItem } from '@/lib/offlineQueue/types'

export const STORAGE_KEY_PREFIX = 'drevora_offline_queue_v1'

export function storageKey(module: string): string {
  return `${STORAGE_KEY_PREFIX}:${module}`
}

export function isQueueItemShape(value: unknown): value is OfflineQueueItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.module === 'string' &&
    typeof item.status === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string' &&
    typeof item.attempts === 'number' &&
    'payload' in item
  )
}

export function parseQueueItemsJson<TPayload>(raw: string | null): OfflineQueueItem<TPayload>[] {
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isQueueItemShape) as OfflineQueueItem<TPayload>[]
  } catch {
    return []
  }
}

import {
  readQueueItems,
  writeQueueItems,
} from '@/lib/offlineQueue/storage'
import type {
  OfflineQueueEnqueueInput,
  OfflineQueueItem,
  OfflineQueueStatus,
} from '@/lib/offlineQueue/types'

function nowIso(): string {
  return new Date().toISOString()
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `offline_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Reusable offline queue service.
 * Stores items per module key; does not talk to Supabase.
 */
export async function enqueueOfflineItem<TPayload>(
  input: OfflineQueueEnqueueInput<TPayload>,
): Promise<OfflineQueueItem<TPayload>> {
  const timestamp = nowIso()
  const item: OfflineQueueItem<TPayload> = {
    id: input.id?.trim() || createId(),
    module: input.module,
    status: 'pending',
    payload: input.payload,
    createdAt: timestamp,
    updatedAt: timestamp,
    attempts: 0,
    lastError: null,
  }

  const existing = await readQueueItems<TPayload>(input.module)
  await writeQueueItems(input.module, [...existing, item])
  return item
}

export async function listOfflineItems<TPayload>(
  module: string,
  statuses?: OfflineQueueStatus[],
): Promise<OfflineQueueItem<TPayload>[]> {
  const items = await readQueueItems<TPayload>(module)
  if (!statuses || statuses.length === 0) return items
  const allowed = new Set(statuses)
  return items.filter((item) => allowed.has(item.status))
}

export async function getOfflineItem<TPayload>(
  module: string,
  id: string,
): Promise<OfflineQueueItem<TPayload> | null> {
  const items = await readQueueItems<TPayload>(module)
  return items.find((item) => item.id === id) ?? null
}

export async function updateOfflineItemStatus(
  module: string,
  id: string,
  status: OfflineQueueStatus,
  options?: { lastError?: string | null; bumpAttempts?: boolean },
): Promise<OfflineQueueItem | null> {
  const items = await readQueueItems(module)
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) return null

  const current = items[index]
  const next: OfflineQueueItem = {
    ...current,
    status,
    updatedAt: nowIso(),
    attempts: options?.bumpAttempts ? current.attempts + 1 : current.attempts,
    lastError:
      options && 'lastError' in options ? (options.lastError ?? null) : current.lastError,
  }

  const nextItems = [...items]
  nextItems[index] = next
  await writeQueueItems(module, nextItems)
  return next
}

export async function removeOfflineItem(module: string, id: string): Promise<boolean> {
  const items = await readQueueItems(module)
  const next = items.filter((item) => item.id !== id)
  if (next.length === items.length) return false
  await writeQueueItems(module, next)
  return true
}

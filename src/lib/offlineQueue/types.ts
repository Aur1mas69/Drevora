/**
 * Shared offline queue types for device-local pending work.
 * Module-agnostic so Vehicle Checks, and later other features, can reuse the same queue.
 */

export type OfflineQueueStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export type OfflineQueueItem<TPayload = unknown> = {
  id: string
  /** Logical module key, e.g. "vehicle-checks". */
  module: string
  status: OfflineQueueStatus
  payload: TPayload
  createdAt: string
  updatedAt: string
  attempts: number
  lastError: string | null
}

export type OfflineQueueEnqueueInput<TPayload> = {
  module: string
  payload: TPayload
  id?: string
}

import {
  enqueueOfflineItem,
  listOfflineItems,
  offlineSyncManager,
  removeOfflineItem,
  type OfflineQueueItem,
} from '@/lib/offlineQueue'
import type { VehicleCheckLocationCapture } from '@/lib/vehicleCheckLocation'
import type {
  VehicleCheckOdometerUnit,
  VehicleCheckItemResult,
} from '@/lib/vehicleCheckTypes'

/** Module key for the reusable offline queue. */
export const OFFLINE_VEHICLE_CHECKS_MODULE = 'vehicle-checks'

/**
 * JSON-serializable Vehicle Check payload for offline queue storage.
 * Intentionally separate from CreateVehicleCheckInput (which includes File objects).
 * Photo/signature binary handling will be added when sync is implemented.
 */
export type OfflineVehicleCheckItemPayload = {
  category: string
  itemName: string
  result: VehicleCheckItemResult
  comment?: string | null
}

export type OfflineVehicleCheckPayload = {
  companyId: string
  vehicleId: string
  workerId: string
  inspectionDate: string
  odometer: number
  odometerUnit?: VehicleCheckOdometerUnit
  notes?: string | null
  inspectionStartedAt: string
  items: OfflineVehicleCheckItemPayload[]
  startedLocation?: VehicleCheckLocationCapture | null
  completedLocation?: VehicleCheckLocationCapture | null
}

export type OfflineVehicleCheckQueueItem = OfflineQueueItem<OfflineVehicleCheckPayload>

export type SaveOfflineVehicleCheckInput = OfflineVehicleCheckPayload & {
  /** Optional stable id; generated when omitted. */
  id?: string
}

/**
 * Persist a completed Vehicle Check locally for later sync.
 * Does not call Supabase and does not alter online save paths.
 * Does not store photos or signatures.
 */
export async function saveOfflineCheck(
  input: SaveOfflineVehicleCheckInput,
): Promise<OfflineVehicleCheckQueueItem> {
  const { id, ...payload } = input
  return enqueueOfflineItem<OfflineVehicleCheckPayload>({
    module: OFFLINE_VEHICLE_CHECKS_MODULE,
    id,
    payload,
  })
}

/**
 * Return locally queued Vehicle Checks that still need syncing
 * (pending, syncing, or failed). Synced items are excluded.
 */
export async function getPendingChecks(): Promise<OfflineVehicleCheckQueueItem[]> {
  return listOfflineItems<OfflineVehicleCheckPayload>(OFFLINE_VEHICLE_CHECKS_MODULE, [
    'pending',
    'syncing',
    'failed',
  ])
}

/**
 * Remove a queued Vehicle Check from local storage (e.g. after confirmed sync).
 */
export async function removePendingCheck(id: string): Promise<boolean> {
  return removeOfflineItem(OFFLINE_VEHICLE_CHECKS_MODULE, id)
}

/**
 * Skeleton hook for future Vehicle Check upload wiring.
 * Currently registers no uploader — syncModule will skip/no-op upload.
 */
export function ensureOfflineVehicleChecksSyncRegistered(): void {
  // Intentionally empty until upload logic is implemented.
  void offlineSyncManager
}

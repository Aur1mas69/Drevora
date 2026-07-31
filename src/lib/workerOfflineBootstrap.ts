/**
 * Shared Offline Worker Bootstrap Cache — business logic only.
 * Platform storage: Preferences (native, split keys) / IndexedDB (web) via `./storage`.
 * Never stores auth tokens.
 */

import {
  clearBootstrapJson,
  readBootstrapJson,
  touchBootstrapHeartbeat,
  writeBootstrapJson,
} from '@/lib/workerOfflineBootstrap/storage'
import {
  normalizeBootstrapVehicleType,
  WORKER_OFFLINE_BOOTSTRAP_FETCH_TIMEOUT_MS,
  WORKER_OFFLINE_BOOTSTRAP_VERSION,
  type WorkerOfflineBootstrapCache,
} from '@/lib/workerOfflineBootstrap/types'
import type { VehicleCheckTemplateItem } from '@/lib/vehicleCheckTemplateTypes'
import type { Driver } from '@/services/driversService'
import { fetchTemplateItemsByVehicleType } from '@/services/vehicleCheckTemplatesService'
import type { Vehicle } from '@/services/vehiclesService'
import { readNativeOfflineMembershipSnapshot } from '@/lib/nativeOfflineMembership'
import { getOnlineStatus } from '@/lib/networkStatus'

export {
  OFFLINE_VEHICLE_CHECKS_NOT_PREPARED_MESSAGE,
  WORKER_OFFLINE_BOOTSTRAP_FETCH_TIMEOUT_MS,
  WORKER_OFFLINE_BOOTSTRAP_STORAGE_KEY,
  WORKER_OFFLINE_BOOTSTRAP_TPL_INDEX_KEY,
  WORKER_OFFLINE_BOOTSTRAP_TPL_KEY_PREFIX,
  WORKER_OFFLINE_BOOTSTRAP_VERSION,
  normalizeBootstrapVehicleType,
  type WorkerOfflineBootstrapCache,
} from '@/lib/workerOfflineBootstrap/types'

export { touchBootstrapHeartbeat } from '@/lib/workerOfflineBootstrap/storage'

function isDriverShape(value: unknown): value is Driver {
  if (!value || typeof value !== 'object') return false
  const row = value as Driver
  return (
    typeof row.id === 'string' &&
    typeof row.email === 'string' &&
    typeof row.firstName === 'string' &&
    typeof row.lastName === 'string'
  )
}

function isVehicleShape(value: unknown): value is Vehicle {
  if (!value || typeof value !== 'object') return false
  const row = value as Vehicle
  return typeof row.id === 'string' && typeof row.registration === 'string'
}

function isTemplateItemShape(value: unknown): value is VehicleCheckTemplateItem {
  if (!value || typeof value !== 'object') return false
  const row = value as VehicleCheckTemplateItem
  return (
    typeof row.id === 'string' &&
    typeof row.label === 'string' &&
    typeof row.section === 'string'
  )
}

function isBootstrapCache(value: unknown): value is WorkerOfflineBootstrapCache {
  if (!value || typeof value !== 'object') return false
  const row = value as WorkerOfflineBootstrapCache
  if (row.version !== WORKER_OFFLINE_BOOTSTRAP_VERSION) return false
  if (typeof row.userId !== 'string' || typeof row.companyId !== 'string') return false
  if (typeof row.savedAt !== 'string') return false
  if (!isDriverShape(row.worker)) return false
  if (!Array.isArray(row.vehicles) || !row.vehicles.every(isVehicleShape)) return false
  if (
    !row.templateItemsByVehicleType ||
    typeof row.templateItemsByVehicleType !== 'object'
  ) {
    return false
  }
  for (const items of Object.values(row.templateItemsByVehicleType)) {
    if (!Array.isArray(items) || !items.every(isTemplateItemShape)) return false
  }
  return true
}

/**
 * Drop availability history (often huge) — not required for Home / Vehicle Checks.
 * Keeps Preferences / IndexedDB payloads within Capacitor bridge limits on Android.
 */
function compactVehicleForCache(vehicle: Vehicle): Vehicle {
  return {
    ...vehicle,
    availabilityRecords: [],
  }
}

function compactTemplateItem(
  item: VehicleCheckTemplateItem,
): VehicleCheckTemplateItem {
  return {
    id: item.id,
    templateId: item.templateId,
    section: item.section,
    label: item.label,
    description: item.description,
    sortOrder: item.sortOrder,
    isRequired: item.isRequired,
    allowNotes: item.allowNotes,
    allowPhoto: item.allowPhoto,
    failOnDefect: item.failOnDefect,
    isActive: item.isActive,
    isCustom: item.isCustom,
    createdAt: item.createdAt,
  }
}

/** Strip accidental token-like fields and oversized vehicle availability blobs. */
function sanitizeCache(
  cache: WorkerOfflineBootstrapCache,
): WorkerOfflineBootstrapCache {
  const templateItemsByVehicleType: Record<string, VehicleCheckTemplateItem[]> = {}
  for (const [vehicleType, items] of Object.entries(cache.templateItemsByVehicleType)) {
    templateItemsByVehicleType[vehicleType] = items.map(compactTemplateItem)
  }

  return {
    version: WORKER_OFFLINE_BOOTSTRAP_VERSION,
    userId: cache.userId,
    companyId: cache.companyId,
    savedAt: cache.savedAt,
    worker: cache.worker,
    vehicles: cache.vehicles.map(compactVehicleForCache),
    templateItemsByVehicleType,
  }
}

export async function readWorkerOfflineBootstrap(
  userId: string,
  companyId?: string | null,
): Promise<WorkerOfflineBootstrapCache | null> {
  if (!userId.trim()) return null

  try {
    const raw = await readBootstrapJson()
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isBootstrapCache(parsed)) return null
    if (parsed.userId !== userId) return null
    if (companyId && parsed.companyId !== companyId) return null
    return sanitizeCache(parsed)
  } catch {
    return null
  }
}

export async function hasWorkerOfflineBootstrap(
  userId: string,
  companyId?: string | null,
): Promise<boolean> {
  const cache = await readWorkerOfflineBootstrap(userId, companyId)
  return cache != null
}

export async function saveWorkerOfflineBootstrap(
  cache: WorkerOfflineBootstrapCache,
): Promise<void> {
  if (!cache.userId.trim() || !cache.companyId.trim()) return
  if (!isDriverShape(cache.worker)) return

  const sanitized = sanitizeCache(cache)
  await touchBootstrapHeartbeat(`save:${sanitized.vehicles.length}`)
  await writeBootstrapJson(JSON.stringify(sanitized))
}

export async function clearWorkerOfflineBootstrap(): Promise<void> {
  await clearBootstrapJson()
}

export function getCachedTemplateItemsForVehicleType(
  cache: WorkerOfflineBootstrapCache | null | undefined,
  vehicleType: string | null | undefined,
): VehicleCheckTemplateItem[] | null {
  if (!cache) return null
  const key = normalizeBootstrapVehicleType(vehicleType)
  if (!key) return null
  const items = cache.templateItemsByVehicleType[key]
  return Array.isArray(items) ? items : null
}

/**
 * After a successful online Worker shell load, persist the minimum offline set.
 * Writes worker + vehicles to storage immediately, then enriches templates with
 * bounded fetches so a hung template request cannot leave Preferences empty.
 */
export async function warmWorkerOfflineBootstrap(params: {
  userId: string
  companyId: string
  worker: Driver
  vehicles: Vehicle[]
  /** When true, skip Network check (caller already confirmed a live fetch). */
  skipOnlineCheck?: boolean
}): Promise<void> {
  let { userId, companyId, worker, vehicles, skipOnlineCheck } = params
  if (!userId.trim() || !isDriverShape(worker)) return

  if (!companyId.trim()) {
    const snap = await readNativeOfflineMembershipSnapshot(userId)
    companyId = snap?.companyId?.trim() || ''
  }
  if (!companyId.trim()) return

  if (!skipOnlineCheck) {
    const online = await getOnlineStatus()
    if (!online) return
  }

  await touchBootstrapHeartbeat(`warm:${vehicles.length}`)
  const typeKeys = [
    ...new Set(
      vehicles
        .map((vehicle) => normalizeBootstrapVehicleType(vehicle.vehicleType))
        .filter((value): value is string => value != null),
    ),
  ]

  // Persist shell data first — Home offline restore must not wait on templates.
  const baseCache: WorkerOfflineBootstrapCache = {
    version: WORKER_OFFLINE_BOOTSTRAP_VERSION,
    userId,
    companyId,
    savedAt: new Date().toISOString(),
    worker,
    vehicles,
    templateItemsByVehicleType: Object.fromEntries(typeKeys.map((key) => [key, []])),
  }

  try {
    await saveWorkerOfflineBootstrap(baseCache)
  } catch {
    await saveWorkerOfflineBootstrap({
      ...baseCache,
      templateItemsByVehicleType: {},
    })
  }

  if (typeKeys.length === 0) return

  const templateItemsByVehicleType: Record<string, VehicleCheckTemplateItem[]> = {
    ...baseCache.templateItemsByVehicleType,
  }

  await Promise.all(
    typeKeys.map(async (vehicleType) => {
      try {
        templateItemsByVehicleType[vehicleType] = await new Promise<
          VehicleCheckTemplateItem[]
        >((resolve, reject) => {
          const timer = window.setTimeout(() => {
            reject(new Error('TEMPLATE_FETCH_TIMEOUT'))
          }, WORKER_OFFLINE_BOOTSTRAP_FETCH_TIMEOUT_MS)
          void fetchTemplateItemsByVehicleType(vehicleType).then(
            (items) => {
              window.clearTimeout(timer)
              resolve(items)
            },
            (error: unknown) => {
              window.clearTimeout(timer)
              reject(error)
            },
          )
        })
      } catch {
        templateItemsByVehicleType[vehicleType] = []
      }
    }),
  )

  try {
    await saveWorkerOfflineBootstrap({
      ...baseCache,
      savedAt: new Date().toISOString(),
      templateItemsByVehicleType,
    })
  } catch {
    // Shell cache from the first write remains — DVSA merge still works offline.
  }
}

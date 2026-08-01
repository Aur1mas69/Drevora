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
import { getOnlineStatus } from '@/lib/networkStatus'
import type { Driver } from '@/services/driversService'
import { fetchTemplateItemsByVehicleType } from '@/services/vehicleCheckTemplatesService'
import { fetchVehicles, type Vehicle } from '@/services/vehiclesService'
import { readNativeOfflineMembershipSnapshot } from '@/lib/nativeOfflineMembership'

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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('VEHICLES_FETCH_TIMEOUT'))
    }, ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

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

  // Harden empty-fleet writes: never replace a prepared vehicle list with [].
  // Shell updates (Worker profile only) must preserve cached registrations so
  // offline Vehicle Checks keep showing the assigned/default vehicle.
  let cacheToWrite = cache
  if (cache.vehicles.length === 0) {
    const existing = await readWorkerOfflineBootstrap(cache.userId, cache.companyId)
    if (existing && existing.vehicles.length > 0) {
      const incomingTemplates = cache.templateItemsByVehicleType
      const incomingHasTemplates = Object.values(incomingTemplates).some(
        (items) => Array.isArray(items) && items.length > 0,
      )
      cacheToWrite = {
        ...cache,
        vehicles: existing.vehicles,
        templateItemsByVehicleType: incomingHasTemplates
          ? incomingTemplates
          : existing.templateItemsByVehicleType,
      }
    }
  }

  const sanitized = sanitizeCache(cacheToWrite)
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

  // Never clobber a prepared fleet with an empty shell warm — Web/PWA IndexedDB
  // was left with vehicles:[] when Home warm was cancelled mid-flight, which then
  // looked like "company has no vehicles" on Vehicle Check.
  let vehiclesForCache = vehicles
  if (vehicles.length === 0) {
    const existing = await readWorkerOfflineBootstrap(userId, companyId)
    if (existing && existing.vehicles.length > 0) {
      vehiclesForCache = existing.vehicles
    }
  }

  await touchBootstrapHeartbeat(`warm:${vehiclesForCache.length}`)
  const typeKeys = [
    ...new Set(
      vehiclesForCache
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
    vehicles: vehiclesForCache,
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

export type WorkerCompanyFleetLoadResult = {
  vehicles: Vehicle[]
  /** True when the returned fleet came from bootstrap cache, not live Supabase. */
  fromCache: boolean
  /** True when a live Supabase fetch was attempted. */
  liveAttempted: boolean
  /**
   * True when live fetch failed and no non-empty cache was available.
   * Callers must not treat this as “company has zero vehicles”.
   */
  reconnecting: boolean
}

/**
 * Shared Worker fleet loader (Web/PWA IndexedDB + Native Preferences).
 *
 * - Online: fetch active company vehicles from Supabase first, then refresh bootstrap.
 * - Offline with a prepared cache: return cached vehicles (no live call).
 * - Offline / false-offline with an empty cache: still attempt live once so a
 *   stale service-worker / empty IndexedDB warm cannot skip Supabase.
 * - Retryable live failures: fall back to a non-empty cache only.
 */
export async function loadWorkerCompanyFleet(params: {
  userId: string
  companyId: string | null | undefined
  worker: Driver
}): Promise<WorkerCompanyFleetLoadResult> {
  const userId = params.userId.trim()
  const companyId = params.companyId?.trim() || null
  if (!userId || !isDriverShape(params.worker)) {
    return {
      vehicles: [],
      fromCache: false,
      liveAttempted: false,
      reconnecting: false,
    }
  }

  async function readCachedVehicles(): Promise<Vehicle[]> {
    const cache = await readWorkerOfflineBootstrap(userId, companyId)
    if (!(cache && cache.vehicles.length > 0)) return []
    return cache.vehicles
  }

  async function fetchLiveAndWarm(): Promise<Vehicle[]> {
    const rows = await withTimeout(
      fetchVehicles(),
      WORKER_OFFLINE_BOOTSTRAP_FETCH_TIMEOUT_MS,
    )
    await warmWorkerOfflineBootstrap({
      userId,
      companyId: companyId ?? '',
      worker: params.worker,
      vehicles: rows,
      skipOnlineCheck: true,
    })
    return rows
  }

  const browserOnline = await getOnlineStatus()

  if (!browserOnline) {
    const cached = await readCachedVehicles()
    if (cached.length > 0) {
      return {
        vehicles: cached,
        fromCache: true,
        liveAttempted: false,
        reconnecting: false,
      }
    }

    // Empty cache is not proof the company has no vehicles — probe live in case
    // navigator/SW reported offline incorrectly (common on Web/PWA).
    try {
      const rows = await fetchLiveAndWarm()
      return {
        vehicles: rows,
        fromCache: false,
        liveAttempted: true,
        reconnecting: false,
      }
    } catch {
      return {
        vehicles: [],
        fromCache: false,
        liveAttempted: true,
        // Reported offline with nothing cached — unprepared, not a reconnect flap.
        reconnecting: false,
      }
    }
  }

  try {
    const rows = await fetchLiveAndWarm()
    return {
      vehicles: rows,
      fromCache: false,
      liveAttempted: true,
      reconnecting: false,
    }
  } catch {
    const cached = await readCachedVehicles()
    if (cached.length > 0) {
      return {
        vehicles: cached,
        fromCache: true,
        liveAttempted: true,
        reconnecting: false,
      }
    }

    return {
      vehicles: [],
      fromCache: false,
      liveAttempted: true,
      // Empty cache after a live miss is temporary until connectivity/membership
      // settles — never present it as a confirmed empty company fleet.
      reconnecting: true,
    }
  }
}

import type { Driver } from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'
import type { VehicleCheckTemplateItem } from '@/lib/vehicleCheckTemplateTypes'

export const WORKER_OFFLINE_BOOTSTRAP_VERSION = 1 as const

/** Root Preferences / IndexedDB key for Worker offline bootstrap meta + worker + vehicles. */
export const WORKER_OFFLINE_BOOTSTRAP_STORAGE_KEY =
  'drevora:worker-offline-bootstrap-v1'

/** Native Preferences only: JSON array of vehicle-type keys for split template entries. */
export const WORKER_OFFLINE_BOOTSTRAP_TPL_INDEX_KEY =
  'drevora:worker-offline-bootstrap-v1:tpl-index'

/** Native Preferences only: prefix for per-type template JSON (`…:tpl:<vehicleType>`). */
export const WORKER_OFFLINE_BOOTSTRAP_TPL_KEY_PREFIX =
  'drevora:worker-offline-bootstrap-v1:tpl:'

/** Live Worker/fleet fetch timeout before falling back to bootstrap cache. */
export const WORKER_OFFLINE_BOOTSTRAP_FETCH_TIMEOUT_MS = 8_000

/** Shown on Worker Home / Vehicle Checks when offline with no prepared cache. */
export const OFFLINE_VEHICLE_CHECKS_NOT_PREPARED_MESSAGE =
  'Connect to the internet once to prepare offline Vehicle Checks.'

/**
 * Minimum Worker shell + Vehicle Check data for offline cold start.
 * Never includes auth tokens, passwords, or media blobs.
 */
export type WorkerOfflineBootstrapCache = {
  version: typeof WORKER_OFFLINE_BOOTSTRAP_VERSION
  userId: string
  companyId: string
  savedAt: string
  worker: Driver
  vehicles: Vehicle[]
  /** Checklist template items keyed by trimmed vehicle type. */
  templateItemsByVehicleType: Record<string, VehicleCheckTemplateItem[]>
}

export function normalizeBootstrapVehicleType(
  vehicleType: string | null | undefined,
): string | null {
  const trimmed = vehicleType?.trim()
  return trimmed ? trimmed : null
}

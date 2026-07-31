import type { Vehicle } from '@/services/vehiclesService'

export function normalizeRegistrationForSearch(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

export function vehicleMatchesRegistrationQuery(vehicle: Vehicle, query: string): boolean {
  const normalizedQuery = normalizeRegistrationForSearch(query)
  if (!normalizedQuery) return true

  return normalizeRegistrationForSearch(vehicle.registration).includes(normalizedQuery)
}

/** Registration-first Worker search; also matches fleet / make / model. */
export function vehicleMatchesWorkerVehicleQuery(vehicle: Vehicle, query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return true
  if (vehicleMatchesRegistrationQuery(vehicle, trimmed)) return true

  const lower = trimmed.toLowerCase()
  const fleet = vehicle.fleetNumber?.toLowerCase() ?? ''
  const make = vehicle.make?.toLowerCase() ?? ''
  const model = vehicle.model?.toLowerCase() ?? ''
  return fleet.includes(lower) || make.includes(lower) || model.includes(lower)
}

export function findVehicleByRegistrationQuery(
  vehicles: Vehicle[],
  query: string,
): Vehicle | null {
  const normalizedQuery = normalizeRegistrationForSearch(query)
  if (!normalizedQuery) return null

  return (
    vehicles.find(
      (vehicle) => normalizeRegistrationForSearch(vehicle.registration) === normalizedQuery,
    ) ?? null
  )
}

/**
 * Resolve an initial Worker vehicle from preferred ids (URL → default → remembered).
 * Returns only a vehicle that exists in the provided active/cached company fleet.
 * Never invents a vehicle from free text.
 */
export function resolvePreferredWorkerVehicle(
  vehicles: Vehicle[],
  preferredIds: Array<string | null | undefined>,
): Vehicle | null {
  if (vehicles.length === 0) return null

  for (const candidate of preferredIds) {
    const id = candidate?.trim()
    if (!id) continue
    const match = vehicles.find((vehicle) => vehicle.id === id)
    if (match) return match
  }

  return null
}

/** True when selectedId points at a vehicle still present in the fleet. */
export function isVehicleInFleet(
  vehicles: Vehicle[],
  selectedId: string | null | undefined,
): boolean {
  const id = selectedId?.trim()
  if (!id) return false
  return vehicles.some((vehicle) => vehicle.id === id)
}

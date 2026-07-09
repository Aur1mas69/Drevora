import type { Vehicle } from '@/services/vehiclesService'

export function normalizeRegistrationForSearch(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

export function vehicleMatchesRegistrationQuery(vehicle: Vehicle, query: string): boolean {
  const normalizedQuery = normalizeRegistrationForSearch(query)
  if (!normalizedQuery) return true

  return normalizeRegistrationForSearch(vehicle.registration).includes(normalizedQuery)
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

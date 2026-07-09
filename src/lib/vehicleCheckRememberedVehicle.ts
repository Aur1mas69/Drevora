const REMEMBERED_VEHICLE_STORAGE_KEY = 'drevora_vehicle_check_remembered_vehicle_id'

export function getRememberedVehicleCheckId(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const value = window.localStorage.getItem(REMEMBERED_VEHICLE_STORAGE_KEY)?.trim()
    return value || null
  } catch {
    return null
  }
}

export function setRememberedVehicleCheckId(vehicleId: string | null): void {
  if (typeof window === 'undefined') return

  try {
    if (!vehicleId) {
      window.localStorage.removeItem(REMEMBERED_VEHICLE_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(REMEMBERED_VEHICLE_STORAGE_KEY, vehicleId)
  } catch {
    // Ignore storage failures on this device.
  }
}

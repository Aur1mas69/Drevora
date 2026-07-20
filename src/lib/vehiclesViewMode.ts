export type VehiclesViewMode = 'grid' | 'list'

export const VEHICLES_VIEW_MODE_STORAGE_KEY = 'drevora-vehicles-view-mode'

const DEFAULT_VEHICLES_VIEW_MODE: VehiclesViewMode = 'grid'

export function parseVehiclesViewMode(
  value: string | null | undefined,
): VehiclesViewMode {
  if (value === 'grid' || value === 'list') {
    return value
  }
  return DEFAULT_VEHICLES_VIEW_MODE
}

export function readVehiclesViewMode(): VehiclesViewMode {
  if (typeof window === 'undefined') {
    return DEFAULT_VEHICLES_VIEW_MODE
  }

  try {
    return parseVehiclesViewMode(
      window.localStorage.getItem(VEHICLES_VIEW_MODE_STORAGE_KEY),
    )
  } catch {
    return DEFAULT_VEHICLES_VIEW_MODE
  }
}

export function writeVehiclesViewMode(mode: VehiclesViewMode): void {
  if (typeof window === 'undefined') return
  if (mode !== 'grid' && mode !== 'list') return

  try {
    window.localStorage.setItem(VEHICLES_VIEW_MODE_STORAGE_KEY, mode)
  } catch {
    // Ignore quota / private-mode failures; in-memory state still works.
  }
}

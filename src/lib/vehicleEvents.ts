export const VEHICLES_UPDATED_EVENT = 'drevora:vehicles-updated'

export function notifyVehiclesUpdated(): void {
  window.dispatchEvent(new CustomEvent(VEHICLES_UPDATED_EVENT))
}

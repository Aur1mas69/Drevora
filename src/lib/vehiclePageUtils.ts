import { getDaysUntilDate, todayString } from '@/lib/vehicleAvailability'
import { getDriverName } from '@/lib/vehicleForm'
import type { Driver } from '@/services/driversService'
import {
  getVehicleStatusForDate,
  type Vehicle,
} from '@/services/vehiclesService'

export type DocumentFilter = 'All' | 'Valid' | 'Expiring Soon' | 'Expired'

export type FleetSummaryStats = {
  available: number
  offRoad: number
  maintenanceDue: number
  motExpiringSoon: number
  insuranceExpiringSoon: number
}

export function getDocumentStatus(
  expiry: string | null,
  warningDays = 30,
): 'valid' | 'warning' | 'expired' | 'missing' {
  if (!expiry) return 'missing'

  const days = getDaysUntilDate(expiry)
  if (days < 0) return 'expired'
  if (days <= warningDays) return 'warning'
  return 'valid'
}

export function matchesDocumentFilter(
  expiry: string | null,
  filter: DocumentFilter,
): boolean {
  if (filter === 'All') return true

  const status = getDocumentStatus(expiry)
  if (filter === 'Valid') return status === 'valid'
  if (filter === 'Expiring Soon') return status === 'warning'
  return status === 'expired'
}

export function computeFleetSummaryStats(vehicles: Vehicle[]): FleetSummaryStats {
  let available = 0
  let offRoad = 0
  let maintenanceDue = 0
  let motExpiringSoon = 0
  let insuranceExpiringSoon = 0

  for (const vehicle of vehicles) {
    const status = getVehicleStatusForDate(vehicle)

    if (status === 'Available') available += 1
    if (status === 'Off Road' || status === 'Out of Service') offRoad += 1
    if (status === 'Maintenance' || status === 'Workshop') maintenanceDue += 1
    if (getDocumentStatus(vehicle.motExpiry) === 'warning') motExpiringSoon += 1
    if (getDocumentStatus(vehicle.insuranceExpiry) === 'warning') {
      insuranceExpiringSoon += 1
    }
  }

  return {
    available,
    offRoad,
    maintenanceDue,
    motExpiringSoon,
    insuranceExpiringSoon,
  }
}

export function getDriverLabel(
  vehicle: Vehicle,
  drivers: Driver[],
): string {
  const driver = drivers.find((item) => item.id === vehicle.currentDriverId)
  return driver ? getDriverName(driver) : 'Unassigned'
}

export function vehicleMatchesSearch(
  vehicle: Vehicle,
  query: string,
  drivers: Driver[],
): boolean {
  if (!query) return true

  const driverName = getDriverLabel(vehicle, drivers)
  return [
    vehicle.registration,
    vehicle.fleetNumber ?? '',
    vehicle.trailerNumber ?? '',
    vehicle.make,
    vehicle.model,
    vehicle.vin ?? '',
    driverName,
  ].some((value) => value.toLowerCase().includes(query))
}

export function exportVehiclesToCsv(
  vehicles: Vehicle[],
  drivers: Driver[],
): void {
  const headers = [
    'Registration',
    'Fleet #',
    'Make',
    'Model',
    'Assigned Driver',
    'Status',
    'MOT Expiry',
    'Insurance Expiry',
  ]

  const rows = vehicles.map((vehicle) => [
    vehicle.registration,
    vehicle.fleetNumber ?? '',
    vehicle.make,
    vehicle.model,
    getDriverLabel(vehicle, drivers),
    getVehicleStatusForDate(vehicle),
    vehicle.motExpiry ?? '',
    vehicle.insuranceExpiry ?? '',
  ])

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
    )
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `drevora-vehicles-${todayString()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

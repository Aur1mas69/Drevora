import {
  buildVehicleCardComplianceEvents,
  type VehicleCardComplianceEventType,
} from '@/lib/vehicleCardNextEvent'
import { getDaysUntilDate, todayString } from '@/lib/vehicleAvailability'
import type { Vehicle } from '@/services/vehiclesService'

export type FleetComplianceAlertType =
  | VehicleCardComplianceEventType
  | 'service'

export type FleetComplianceAlertBucket = 'overdue' | 'within_7' | 'within_30'

export type FleetComplianceAlert = {
  id: string
  vehicleId: string
  registration: string
  type: FleetComplianceAlertType
  /** Short type label for the row (e.g. "MOT expired", "Insurance"). */
  typeLabel: string
  dueDate: string
  daysUntilDue: number
  bucket: FleetComplianceAlertBucket
  timingText: string
  path: string
}

export type FleetComplianceAlertsSummary = {
  overdueCount: number
  within7Count: number
  within30Count: number
  topAlerts: FleetComplianceAlert[]
}

function resolveBucket(daysUntilDue: number): FleetComplianceAlertBucket | null {
  if (daysUntilDue < 0) return 'overdue'
  if (daysUntilDue <= 7) return 'within_7'
  if (daysUntilDue <= 30) return 'within_30'
  return null
}

export function formatFleetComplianceAlertTiming(daysUntilDue: number): string {
  if (daysUntilDue < 0) {
    const overdue = Math.abs(daysUntilDue)
    return `Expired ${overdue} day${overdue === 1 ? '' : 's'} ago`
  }
  if (daysUntilDue === 0) return 'Due today'
  if (daysUntilDue === 1) return 'Due tomorrow'
  return `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`
}

function typeLabelForAlert(
  type: FleetComplianceAlertType,
  baseLabel: string,
  bucket: FleetComplianceAlertBucket,
): string {
  if (bucket === 'overdue') {
    if (type === 'mot') return 'MOT expired'
    if (type === 'tachograph') return 'Tachograph expired'
    if (type === 'insurance') return 'Insurance expired'
    if (type === 'road_tax') return 'Road tax expired'
    if (type === 'service') return 'Service overdue'
  }
  if (type === 'tachograph') return 'Tachograph calibration'
  if (type === 'road_tax') return 'Road Tax'
  if (type === 'service') return 'Service due'
  return baseLabel
}

function collectServiceAlerts(
  vehicle: Vehicle,
  today: string,
): FleetComplianceAlert[] {
  const alerts: FleetComplianceAlert[] = []

  for (const record of vehicle.availabilityRecords) {
    if (record.reason !== 'Service') continue
    const dueDate = record.startDate?.trim() || ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) continue

    // Finished service windows are not active alerts.
    if (record.endDate && record.endDate < today) continue

    const daysUntilDue = getDaysUntilDate(dueDate, today)
    if (!Number.isFinite(daysUntilDue)) continue

    const bucket = resolveBucket(daysUntilDue)
    if (!bucket) continue

    alerts.push({
      id: `${vehicle.id}-service-${record.id}`,
      vehicleId: vehicle.id,
      registration: vehicle.registration,
      type: 'service',
      typeLabel: typeLabelForAlert('service', 'Service', bucket),
      dueDate,
      daysUntilDue,
      bucket,
      timingText: formatFleetComplianceAlertTiming(daysUntilDue),
      path: `/vehicles/${vehicle.id}`,
    })
  }

  return alerts
}

function compareAlerts(a: FleetComplianceAlert, b: FleetComplianceAlert): number {
  // Overdue first, then by severity (more overdue = smaller daysUntilDue).
  if (a.bucket === 'overdue' && b.bucket !== 'overdue') return -1
  if (b.bucket === 'overdue' && a.bucket !== 'overdue') return 1
  if (a.bucket === 'overdue' && b.bucket === 'overdue') {
    if (a.daysUntilDue !== b.daysUntilDue) return a.daysUntilDue - b.daysUntilDue
    return a.registration.localeCompare(b.registration)
  }

  // Upcoming: nearest due date first.
  if (a.daysUntilDue !== b.daysUntilDue) return a.daysUntilDue - b.daysUntilDue
  return a.registration.localeCompare(b.registration)
}

/**
 * Fleet-wide compliance alerts for the Admin Dashboard.
 * Document dates reuse buildVehicleCardComplianceEvents (same MOT/insurance/road tax/tacho logic).
 * Service due comes from existing availability records with reason "Service".
 */
export function buildFleetComplianceAlertsSummary(
  vehicles: Vehicle[],
  today = todayString(),
): FleetComplianceAlertsSummary {
  const alerts: FleetComplianceAlert[] = []

  for (const vehicle of vehicles) {
    if (vehicle.archivedAt) continue

    for (const event of buildVehicleCardComplianceEvents(vehicle, today)) {
      const bucket = resolveBucket(event.daysUntilDue)
      if (!bucket) continue

      alerts.push({
        id: `${vehicle.id}-${event.type}-${event.dueDate}`,
        vehicleId: vehicle.id,
        registration: vehicle.registration,
        type: event.type,
        typeLabel: typeLabelForAlert(event.type, event.label, bucket),
        dueDate: event.dueDate,
        daysUntilDue: event.daysUntilDue,
        bucket,
        timingText: formatFleetComplianceAlertTiming(event.daysUntilDue),
        path: `/vehicles/${vehicle.id}`,
      })
    }

    alerts.push(...collectServiceAlerts(vehicle, today))
  }

  alerts.sort(compareAlerts)

  return {
    overdueCount: alerts.filter((alert) => alert.bucket === 'overdue').length,
    within7Count: alerts.filter((alert) => alert.bucket === 'within_7').length,
    within30Count: alerts.filter((alert) => alert.bucket === 'within_30').length,
    topAlerts: alerts.slice(0, 3),
  }
}

export const emptyFleetComplianceAlertsSummary: FleetComplianceAlertsSummary = {
  overdueCount: 0,
  within7Count: 0,
  within30Count: 0,
  topAlerts: [],
}

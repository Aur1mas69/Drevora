import { formatShortDate, getDaysUntilDate, todayString } from '@/lib/vehicleAvailability'
import type { Vehicle } from '@/services/vehiclesService'

/** Matches Vehicles page document warning window (`getDocumentStatus` default). */
export const VEHICLE_CARD_DUE_SOON_DAYS = 30

export type VehicleCardComplianceEventType =
  | 'mot'
  | 'tachograph'
  | 'insurance'
  | 'road_tax'

export type VehicleCardEventUrgency = 'overdue' | 'due_soon' | 'upcoming'

export type VehicleCardComplianceEvent = {
  type: VehicleCardComplianceEventType
  label: string
  dueDate: string
  daysUntilDue: number
  urgency: VehicleCardEventUrgency
}

export type VehicleCardNextEventResult = {
  nearest: VehicleCardComplianceEvent | null
  additionalCount: number
}

const COMPLIANCE_FIELDS: Array<{
  type: VehicleCardComplianceEventType
  label: string
  getDate: (vehicle: Vehicle) => string | null
}> = [
  { type: 'mot', label: 'MOT', getDate: (vehicle) => vehicle.motExpiry },
  {
    type: 'tachograph',
    label: 'Tacho calibration',
    getDate: (vehicle) => vehicle.tachographExpiry,
  },
  {
    type: 'insurance',
    label: 'Insurance',
    getDate: (vehicle) => vehicle.insuranceExpiry,
  },
  {
    type: 'road_tax',
    label: 'Road tax',
    getDate: (vehicle) => vehicle.roadTaxExpiry,
  },
]

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime())
}

function resolveUrgency(daysUntilDue: number): VehicleCardEventUrgency {
  if (daysUntilDue < 0) return 'overdue'
  if (daysUntilDue <= VEHICLE_CARD_DUE_SOON_DAYS) return 'due_soon'
  return 'upcoming'
}

/**
 * Build sorted compliance events from verified Vehicle expiry fields.
 * Ignores empty/invalid dates. Does not invent dates.
 */
export function buildVehicleCardComplianceEvents(
  vehicle: Vehicle,
  today = todayString(),
): VehicleCardComplianceEvent[] {
  const events: VehicleCardComplianceEvent[] = []

  for (const field of COMPLIANCE_FIELDS) {
    const raw = field.getDate(vehicle)?.trim() || ''
    if (!raw || !isValidDateString(raw)) continue

    const daysUntilDue = getDaysUntilDate(raw, today)
    if (!Number.isFinite(daysUntilDue)) continue

    events.push({
      type: field.type,
      label: field.label,
      dueDate: raw,
      daysUntilDue,
      urgency: resolveUrgency(daysUntilDue),
    })
  }

  return events.sort((a, b) => {
    const byDate = a.dueDate.localeCompare(b.dueDate)
    if (byDate !== 0) return byDate
    return a.label.localeCompare(b.label)
  })
}

export function getVehicleCardNextEvent(
  vehicle: Vehicle,
  today = todayString(),
): VehicleCardNextEventResult {
  const events = buildVehicleCardComplianceEvents(vehicle, today)
  if (events.length === 0) {
    return { nearest: null, additionalCount: 0 }
  }

  return {
    nearest: events[0],
    additionalCount: Math.max(0, events.length - 1),
  }
}

export function formatVehicleCardEventTiming(
  event: VehicleCardComplianceEvent,
): string {
  if (event.daysUntilDue < 0) {
    const overdue = Math.abs(event.daysUntilDue)
    return `Overdue by ${overdue} day${overdue === 1 ? '' : 's'}`
  }
  if (event.daysUntilDue === 0) {
    return 'Due today'
  }
  return `Due in ${event.daysUntilDue} day${event.daysUntilDue === 1 ? '' : 's'}`
}

export function formatVehicleCardEventDate(dueDate: string): string {
  return formatShortDate(dueDate)
}

import type {
  Vehicle,
  VehicleAvailability,
  VehicleStatus,
} from '@/services/vehiclesService'
import { todayString } from '@/lib/vehicleAvailability'

export type CalendarView = 'Day' | 'Week' | 'Month' | 'Year'

export type PlanningEventKind =
  | 'availability'
  | 'mot'
  | 'insurance'
  | 'road_tax'
  | 'tachograph'

export type PlanningEvent = {
  id: string
  vehicleId: string
  vehicleRegistration: string
  kind: PlanningEventKind
  label: string
  status: VehicleStatus | null
  startDate: string
  endDate: string | null
  reason: string | null
  notes: string | null
  availabilityRecord: VehicleAvailability | null
}

export const planningEventColorMap: Record<string, string> = {
  Available: 'bg-emerald-500',
  Assigned: 'bg-blue-500',
  Workshop: 'bg-yellow-400',
  Maintenance: 'bg-orange-500',
  'Out of Service': 'bg-red-600',
  'Off Road': 'bg-slate-950',
  Reserved: 'bg-purple-500',
  MOT: 'bg-amber-500',
  Insurance: 'bg-blue-500',
  'Road Tax': 'bg-slate-500',
  'Tachograph Calibration': 'bg-purple-600',
  Service: 'bg-orange-500',
}

const documentEventLabels: Record<
  Exclude<PlanningEventKind, 'availability'>,
  string
> = {
  mot: 'MOT',
  insurance: 'Insurance',
  road_tax: 'Road Tax',
  tachograph: 'Tachograph Calibration',
}

function getAvailabilityEventLabel(record: VehicleAvailability): string {
  if (record.reason === 'Service') return 'Service'
  return record.status
}

function eventOverlapsDateRange(
  event: PlanningEvent,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  if (event.endDate) {
    return event.startDate <= rangeEnd && event.endDate >= rangeStart
  }

  if (event.kind === 'availability') {
    return event.startDate <= rangeEnd
  }

  return event.startDate >= rangeStart && event.startDate <= rangeEnd
}

export function buildDocumentPlanningEvents(vehicle: Vehicle): PlanningEvent[] {
  const documents: Array<{
    kind: Exclude<PlanningEventKind, 'availability'>
    date: string | null
  }> = [
    { kind: 'mot', date: vehicle.motExpiry },
    { kind: 'insurance', date: vehicle.insuranceExpiry },
    { kind: 'road_tax', date: vehicle.roadTaxExpiry },
    { kind: 'tachograph', date: vehicle.tachographExpiry },
  ]

  return documents
    .filter((document): document is { kind: Exclude<PlanningEventKind, 'availability'>; date: string } =>
      Boolean(document.date),
    )
    .map((document) => ({
      id: `${vehicle.id}-${document.kind}-${document.date}`,
      vehicleId: vehicle.id,
      vehicleRegistration: vehicle.registration,
      kind: document.kind,
      label: documentEventLabels[document.kind],
      status: null,
      startDate: document.date,
      endDate: null,
      reason: 'Document expiry',
      notes: null,
      availabilityRecord: null,
    }))
}

export function buildAvailabilityPlanningEvents(
  vehicle: Vehicle,
): PlanningEvent[] {
  return vehicle.availabilityRecords.map((record) => ({
    id: record.id,
    vehicleId: vehicle.id,
    vehicleRegistration: vehicle.registration,
    kind: 'availability' as const,
    label: getAvailabilityEventLabel(record),
    status: record.status,
    startDate: record.startDate,
    endDate: record.endDate,
    reason: record.reason,
    notes: record.notes,
    availabilityRecord: record,
  }))
}

export function buildVehiclePlanningEvents(vehicle: Vehicle): PlanningEvent[] {
  return [
    ...buildDocumentPlanningEvents(vehicle),
    ...buildAvailabilityPlanningEvents(vehicle),
  ].sort((firstEvent, secondEvent) =>
    firstEvent.startDate.localeCompare(secondEvent.startDate),
  )
}

export function buildFleetAvailabilityPlanningEvents(
  vehicles: Vehicle[],
): PlanningEvent[] {
  return vehicles
    .flatMap((vehicle) => buildAvailabilityPlanningEvents(vehicle))
    .sort((firstEvent, secondEvent) =>
      firstEvent.startDate.localeCompare(secondEvent.startDate),
    )
}

export function buildFleetPlanningEvents(vehicles: Vehicle[]): PlanningEvent[] {
  return vehicles
    .flatMap((vehicle) => buildVehiclePlanningEvents(vehicle))
    .sort((firstEvent, secondEvent) =>
      firstEvent.startDate.localeCompare(secondEvent.startDate),
    )
}

export function getNextPlanningEvent(
  vehicle: Vehicle,
  today = todayString(),
): PlanningEvent | null {
  const upcomingEvents = buildVehiclePlanningEvents(vehicle)
    .filter((event) => event.startDate > today)
    .sort((firstEvent, secondEvent) =>
      firstEvent.startDate.localeCompare(secondEvent.startDate),
    )

  return upcomingEvents[0] ?? null
}

export function getEventsForDate(
  events: PlanningEvent[],
  date: string,
): PlanningEvent[] {
  return events
    .filter((event) => eventOverlapsDateRange(event, date, date))
    .sort((firstEvent, secondEvent) =>
      firstEvent.startDate.localeCompare(secondEvent.startDate),
    )
}

export function getEventsForMonth(
  events: PlanningEvent[],
  year: number,
  month: number,
): PlanningEvent[] {
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  return events
    .filter((event) => eventOverlapsDateRange(event, monthStart, monthEnd))
    .sort((firstEvent, secondEvent) =>
      firstEvent.startDate.localeCompare(secondEvent.startDate),
    )
}

export function getMonthDates(year: number, month: number): Date[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, index) => {
    return new Date(year, month, index + 1)
  })
}

export function getWeekDates(focusDate: Date): Date[] {
  const start = new Date(focusDate)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + mondayOffset)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatMonthYear(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month, 1))
}

export function formatMonthLabel(month: number): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(
    new Date(2026, month, 1),
  )
}

export function formatEventShortDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T00:00:00`))
}

export function getPlanningEventColor(event: PlanningEvent): string {
  return planningEventColorMap[event.label] ?? 'bg-slate-500'
}

export function isPlanningEventEditable(event: PlanningEvent): boolean {
  return event.kind === 'availability' && event.availabilityRecord !== null
}

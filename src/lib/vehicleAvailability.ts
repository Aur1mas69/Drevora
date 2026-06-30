import type {
  Vehicle,
  VehicleAvailability,
  VehicleStatus,
} from '@/services/vehiclesService'
import { getVehicleStatusForDate } from '@/services/vehiclesService'

export type TimelineEntry = {
  id: string
  date: string
  kind: 'event' | 'return' | 'baseline'
  status: VehicleStatus
  label: string
  reason: string | null
  notes: string | null
  recordId: string | null
}

export function todayString(): string {
  const today = new Date()
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
}

export function formatShortDate(value: string | null): string {
  if (!value) return 'Not set'

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export function formatCalendarShortDate(value: string | null): string {
  if (!value) return 'Not set'

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T00:00:00`))
}

export function getDaysUntilDate(value: string, today = todayString()): number {
  const todayDate = new Date(`${today}T00:00:00`)
  const targetDate = new Date(`${value}T00:00:00`)
  return Math.ceil((targetDate.getTime() - todayDate.getTime()) / 86_400_000)
}

export function formatStartsInText(daysUntil: number): string {
  if (daysUntil <= 0) return 'Starts today'
  if (daysUntil === 1) return 'Tomorrow'
  return `Starts in ${daysUntil} days`
}

export function getReturnLabel(status: VehicleStatus): string {
  if (status === 'Workshop') return 'Returned'
  if (status === 'Maintenance') return 'Available'
  return 'Returned to Service'
}

export function calculateEventDuration(
  startDate: string,
  endDate: string | null,
): string {
  if (!endDate) return 'Ongoing'

  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const days = Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1

  if (days <= 1) return '1 day'
  return `${days} days`
}

export function getAvailabilityRecordForDate(
  vehicle: Vehicle,
  date: string,
): VehicleAvailability | null {
  const matchingRecords = vehicle.availabilityRecords
    .filter(
      (record) =>
        record.startDate <= date && (!record.endDate || record.endDate >= date),
    )
    .sort((firstRecord, secondRecord) =>
      secondRecord.startDate.localeCompare(firstRecord.startDate),
    )

  return matchingRecords[0] ?? null
}

export function getNextScheduledEvent(
  records: VehicleAvailability[],
  today = todayString(),
): VehicleAvailability | null {
  const futureRecords = records
    .filter((record) => record.startDate > today)
    .sort((firstRecord, secondRecord) =>
      firstRecord.startDate.localeCompare(secondRecord.startDate),
    )

  return futureRecords[0] ?? null
}

export function buildTimelineEntries(vehicle: Vehicle): TimelineEntry[] {
  const today = todayString()
  const entries: TimelineEntry[] = []

  for (const record of vehicle.availabilityRecords) {
    entries.push({
      id: `${record.id}-start`,
      date: record.startDate,
      kind: 'event',
      status: record.status,
      label: record.status,
      reason: record.reason,
      notes: record.notes,
      recordId: record.id,
    })

    if (record.endDate) {
      entries.push({
        id: `${record.id}-end`,
        date: record.endDate,
        kind: 'return',
        status: 'Available',
        label: getReturnLabel(record.status),
        reason: null,
        notes: null,
        recordId: record.id,
      })
    }
  }

  const documentEvents = [
  { date: vehicle.motExpiry, label: 'MOT' },
  { date: vehicle.insuranceExpiry, label: 'Insurance' },
  { date: vehicle.roadTaxExpiry, label: 'Road Tax' },
  { date: vehicle.tachographExpiry, label: 'Tachograph Calibration' },
  ].filter((item): item is { date: string; label: string } => Boolean(item.date))

  for (const document of documentEvents) {
    entries.push({
      id: `${vehicle.id}-${document.label}-${document.date}`,
      date: document.date,
      kind: 'event',
      status: 'Maintenance',
      label: document.label,
      reason: 'Document expiry',
      notes: null,
      recordId: null,
    })
  }

  const currentStatus = getVehicleStatusForDate(vehicle, today)
  entries.push({
    id: `${vehicle.id}-today`,
    date: today,
    kind: 'baseline',
    status: currentStatus,
    label: currentStatus,
    reason: null,
    notes: null,
    recordId: null,
  })

  const upcoming = entries
    .filter((entry) => entry.date > today)
    .sort((firstEntry, secondEntry) =>
      firstEntry.date.localeCompare(secondEntry.date),
    )

  const history = entries
    .filter((entry) => entry.date <= today)
    .sort((firstEntry, secondEntry) =>
      secondEntry.date.localeCompare(firstEntry.date),
    )

  return [...upcoming, ...history]
}

export function getFirstNotesLine(notes: string | null): string {
  if (!notes) return 'No notes'
  const firstLine = notes.split('\n')[0]?.trim()
  return firstLine || 'No notes'
}

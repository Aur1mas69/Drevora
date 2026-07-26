export const VEHICLE_ARCHIVE_REASONS = [
  'Sold',
  'Returned to lease',
  'Written off',
  'Other',
] as const

export type VehicleArchiveReason = (typeof VEHICLE_ARCHIVE_REASONS)[number]

export function isVehicleArchiveReason(value: string): value is VehicleArchiveReason {
  return (VEHICLE_ARCHIVE_REASONS as readonly string[]).includes(value)
}

export function todayIsoDateUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isFutureIsoDate(value: string, todayIso = todayIsoDateUtc()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return true
  return value > todayIso
}

export type TyreStatus = 'good' | 'attention' | 'critical' | 'dirty' | 'not_checked'

export type TyrePosition =
  | 'Left'
  | 'Right'
  | 'Outer Left'
  | 'Inner Left'
  | 'Inner Right'
  | 'Outer Right'

export type TyreUnit = 'vehicle' | 'trailer'

export type TyrePositionKey = {
  unit: TyreUnit
  axleNumber: number
  position: TyrePosition
}

export type TyreMeasurement = TyrePositionKey & {
  id: string
  axleLabel: string
  treadDepthMm: number | null
  status: TyreStatus
}

export type TyreCheckSummaryCounts = {
  good: number
  attention: number
  critical: number
  dirty: number
  notChecked: number
}

export type SavedTyreCheck = {
  id: string
  checkedAt: string
  vehicleId: string
  vehicleLabel: string
  trailerId: string | null
  trailerLabel: string | null
  checkedBy: string
  truckAxleCount: number
  trailerAxleCount: number | null
  summaryLabel: string
  notes: string
  photoCount: number
  measurements: TyreMeasurement[]
}

/** Stored parent overall_result values (DB CHECK / compute function). */
export type TyreCheckOverallResult = 'incomplete' | 'pass' | 'attention' | 'fail'

/**
 * Result filter for the Tyre Checks history table.
 * - pass → Passed
 * - fail → Defects found (critical tread and/or defect flags per DB compute)
 * - attention → Attention overall result
 */
export type TyreCheckResultFilter = 'all' | 'pass' | 'fail' | 'attention'

/**
 * Defect-focused history filters using stored count columns (no invented data).
 * Applied as count > 0 on the matching tyre_checks column.
 */
export type TyreCheckDefectFocusFilter =
  | 'all'
  | 'critical'
  | 'attention'
  | 'dirty'
  | 'has_defect'

export type TyreCheckAdminSection = 'overview' | 'configuration' | 'history'

export type TyreCheckListItem = {
  id: string
  createdAt: string
  submittedAt: string | null
  inspectedAt: string
  vehicleId: string
  vehicleRegistration: string
  vehicleMake: string | null
  vehicleModel: string | null
  trailerVehicleId: string | null
  trailerRegistration: string | null
  trailerNumber: string | null
  workerId: string
  workerName: string
  workerEmail: string | null
  truckAxleCount: number
  trailerAxleCount: number | null
  overallResult: TyreCheckOverallResult
  goodCount: number
  attentionCount: number
  criticalCount: number
  dirtyCount: number
  defectCount: number
  notCheckedCount: number
  summaryLabel: string
  notes: string | null
  status: 'draft' | 'in_progress' | 'submitted'
}

export type TyreCheckAdminOverviewStats = {
  completedToday: number
  notCheckedToday: number
  attention: number
  critical: number
  dirty: number
  openDefects: number
  totalActiveVehicles: number
  needsAttention: TyreCheckListItem[]
}

export type TyreChecksQuery = {
  search?: string
  dateFrom?: string
  dateTo?: string
  result?: TyreCheckResultFilter
  defectFocus?: TyreCheckDefectFocusFilter
  vehicleId?: string | 'all'
  workerId?: string | 'all'
  trailerVehicleId?: string | 'all'
  page?: number
  pageSize?: number
  sortDir?: 'asc' | 'desc'
}

export type TyreChecksPageResult = {
  items: TyreCheckListItem[]
  totalCount: number
  page: number
  pageSize: number
}

export const TYRE_CHECK_PAGE_SIZE_OPTIONS = [25, 50, 100] as const
export const DEFAULT_TYRE_CHECK_PAGE_SIZE = 25

/** Display label aligned with the history table Result column. */
export function formatTyreCheckResultLabel(result: TyreCheckOverallResult): string {
  switch (result) {
    case 'pass':
      return 'Passed'
    case 'fail':
      return 'Defects found'
    case 'attention':
      return 'Attention'
    case 'incomplete':
      return 'Incomplete'
  }
}

/** Maximum combined Truck + Trailer axles for one tyre check. */
export const MAX_COMBINED_TYRE_AXLES = 6

export const DEFAULT_TRUCK_AXLE_COUNT = 3
export const DEFAULT_TRAILER_AXLE_COUNT = 3

export function treadDepthToStatus(depthMm: number | null, dirty: boolean): TyreStatus {
  if (dirty) return 'dirty'
  if (depthMm == null || Number.isNaN(depthMm)) return 'not_checked'
  if (depthMm < 2) return 'critical'
  if (depthMm < 3) return 'attention'
  return 'good'
}

export function tyreStatusLabel(status: TyreStatus): string {
  switch (status) {
    case 'good':
      return 'Good'
    case 'attention':
      return 'Attention'
    case 'critical':
      return 'Critical'
    case 'dirty':
      return 'Dirty'
    case 'not_checked':
      return 'Not Checked'
  }
}

/** Baby-blue DREVORA status colours for tyre tiles (light + Admin dark). */
export function tyreStatusClasses(status: TyreStatus): {
  tile: string
  badge: string
  dot: string
} {
  switch (status) {
    case 'good':
      return {
        tile:
          'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/45',
        badge:
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-1 dark:ring-emerald-900/60',
        dot: 'bg-emerald-500',
      }
    case 'attention':
      return {
        tile:
          'border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/45',
        badge:
          'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-1 dark:ring-amber-900/60',
        dot: 'bg-amber-500',
      }
    case 'critical':
      return {
        tile: 'border-rose-200 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/45',
        badge:
          'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-1 dark:ring-rose-900/60',
        dot: 'bg-rose-500',
      }
    case 'dirty':
      return {
        tile:
          'border-yellow-200 bg-yellow-50 dark:border-yellow-800/55 dark:bg-yellow-950/40',
        badge:
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/45 dark:text-yellow-300 dark:ring-1 dark:ring-yellow-900/55',
        dot: 'bg-yellow-400',
      }
    case 'not_checked':
      return {
        tile: 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-800/60',
        badge:
          'bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-1 dark:ring-white/10',
        dot: 'bg-slate-400',
      }
  }
}

function axleLabel(unit: TyreUnit, axleNumber: number): string {
  if (unit === 'trailer') {
    return `Trailer Axle ${axleNumber}`
  }
  if (axleNumber === 1) return 'Steer Axle 1'
  return `Drive Axle ${axleNumber}`
}

function positionsForAxle(unit: TyreUnit, axleNumber: number): TyrePosition[] {
  if (unit === 'vehicle' && axleNumber === 1) {
    return ['Left', 'Right']
  }
  return ['Outer Left', 'Inner Left', 'Inner Right', 'Outer Right']
}

function clampAxleCount(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Allowed Truck axle values for the current Trailer selection. */
export function truckAxleOptions(trailerAxleCount: number | null): number[] {
  if (trailerAxleCount == null) {
    return [1, 2, 3, 4, 5, 6]
  }
  const maxTruck = MAX_COMBINED_TYRE_AXLES - trailerAxleCount
  return Array.from({ length: maxTruck }, (_, index) => index + 1)
}

/** Allowed Trailer axle values for the current Truck selection. */
export function trailerAxleOptions(truckAxleCount: number): number[] {
  const maxTrailer = MAX_COMBINED_TYRE_AXLES - truckAxleCount
  if (maxTrailer < 1) return []
  return Array.from({ length: maxTrailer }, (_, index) => index + 1)
}

/**
 * Shared client validation for Truck / Trailer axle counts.
 * Returns an error message, or null when valid.
 */
export function validateTyreAxleCounts(
  truckAxleCount: number,
  trailerAxleCount: number | null,
): string | null {
  if (!Number.isInteger(truckAxleCount) || truckAxleCount < 1) {
    return 'Truck and Trailer can have a maximum of 6 axles combined.'
  }

  if (trailerAxleCount == null) {
    if (truckAxleCount > MAX_COMBINED_TYRE_AXLES) {
      return 'Truck and Trailer can have a maximum of 6 axles combined.'
    }
    return null
  }

  if (
    !Number.isInteger(trailerAxleCount) ||
    trailerAxleCount < 1 ||
    truckAxleCount + trailerAxleCount > MAX_COMBINED_TYRE_AXLES
  ) {
    return 'Truck and Trailer can have a maximum of 6 axles combined.'
  }

  return null
}

export function formatAxleCountLabel(
  truckAxleCount: number,
  trailerAxleCount: number | null,
): string {
  if (trailerAxleCount == null) return String(truckAxleCount)
  return `${truckAxleCount} + ${trailerAxleCount}`
}

export function totalAxleCount(
  truckAxleCount: number,
  trailerAxleCount: number | null,
): number {
  return truckAxleCount + (trailerAxleCount ?? 0)
}

/**
 * Build the active Truck (+ optional Trailer) tyre layout.
 * Truck and Trailer axle counts are independent; Trailer numbering restarts at 1
 * but tyre ids remain unique via unit + axle + position.
 */
export function buildTyreLayout(
  truckAxleCount: number,
  trailerAxleCount: number | null,
): TyreMeasurement[] {
  const truckAxles = clampAxleCount(
    truckAxleCount,
    1,
    trailerAxleCount == null ? MAX_COMBINED_TYRE_AXLES : MAX_COMBINED_TYRE_AXLES - 1,
  )
  const rows: TyreMeasurement[] = []

  for (let axleNumber = 1; axleNumber <= truckAxles; axleNumber += 1) {
    for (const position of positionsForAxle('vehicle', axleNumber)) {
      rows.push({
        id: `vehicle-${axleNumber}-${position}`,
        unit: 'vehicle',
        axleNumber,
        axleLabel: axleLabel('vehicle', axleNumber),
        position,
        treadDepthMm: null,
        status: 'not_checked',
      })
    }
  }

  if (trailerAxleCount != null) {
    const trailerAxles = clampAxleCount(
      trailerAxleCount,
      1,
      MAX_COMBINED_TYRE_AXLES - truckAxles,
    )
    for (let axleNumber = 1; axleNumber <= trailerAxles; axleNumber += 1) {
      for (const position of positionsForAxle('trailer', axleNumber)) {
        rows.push({
          id: `trailer-${axleNumber}-${position}`,
          unit: 'trailer',
          axleNumber,
          axleLabel: axleLabel('trailer', axleNumber),
          position,
          treadDepthMm: null,
          status: 'not_checked',
        })
      }
    }
  }

  return rows
}

export function summarizeTyreMeasurements(
  measurements: TyreMeasurement[],
): TyreCheckSummaryCounts {
  const counts: TyreCheckSummaryCounts = {
    good: 0,
    attention: 0,
    critical: 0,
    dirty: 0,
    notChecked: 0,
  }

  for (const tyre of measurements) {
    switch (tyre.status) {
      case 'good':
        counts.good += 1
        break
      case 'attention':
        counts.attention += 1
        break
      case 'critical':
        counts.critical += 1
        break
      case 'dirty':
        counts.dirty += 1
        break
      case 'not_checked':
        counts.notChecked += 1
        break
    }
  }

  return counts
}

export function formatTyreSummaryLabel(counts: TyreCheckSummaryCounts): string {
  const parts: string[] = []
  if (counts.critical > 0) parts.push(`${counts.critical} critical`)
  if (counts.attention > 0) parts.push(`${counts.attention} attention`)
  if (counts.dirty > 0) parts.push(`${counts.dirty} dirty`)
  if (counts.good > 0) parts.push(`${counts.good} good`)
  if (parts.length === 0) return `${counts.notChecked} not checked`
  if (counts.notChecked > 0) parts.push(`${counts.notChecked} unchecked`)
  return parts.join(' · ')
}

export function attentionTyres(measurements: TyreMeasurement[]): TyreMeasurement[] {
  return measurements.filter(
    (tyre) =>
      tyre.status === 'critical' ||
      tyre.status === 'attention' ||
      tyre.status === 'dirty',
  )
}

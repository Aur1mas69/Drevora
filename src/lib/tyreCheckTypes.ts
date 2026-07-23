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
  /** Present when loaded from / saved to tyre_check_items. */
  dbItemId?: string | null
  isDirty?: boolean
  hasDefect?: boolean
  defectNotes?: string
  notes?: string
}

export type WorkerTyreCheckDraft = {
  checkId: string
  vehicleId: string
  trailerVehicleId: string | null
  truckAxleCount: number
  trailerAxleCount: number | null
  workerId: string
  odometer: number
  odometerUnit: 'miles' | 'km'
  inspectionStartedAt: string
  status: 'draft' | 'in_progress' | 'submitted'
  items: TyreMeasurement[]
  goodCount: number
  attentionCount: number
  criticalCount: number
  dirtyCount: number
  defectCount: number
  notCheckedCount: number
  overallResult: TyreCheckOverallResult
  durationSeconds: number | null
  submittedAt: string | null
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

/**
 * Aligns with DB `drevora_tyre_tread_status`:
 * not_checked | good (>=6.0) | attention (4.0–5.9) | critical (<4.0).
 * Dirty is a separate flag — when `dirty` is true the UI may prefer Dirty over tread colour.
 */
export function treadDepthToStatus(depthMm: number | null, dirty: boolean): TyreStatus {
  if (depthMm == null || Number.isNaN(depthMm)) return 'not_checked'
  if (dirty) return 'dirty'
  if (depthMm >= 6) return 'good'
  if (depthMm >= 4) return 'attention'
  return 'critical'
}

/** Pure tread band (ignores dirty) — matches generated DB tread_status. */
export function treadDepthBand(depthMm: number | null): Exclude<TyreStatus, 'dirty'> {
  if (depthMm == null || Number.isNaN(depthMm)) return 'not_checked'
  if (depthMm >= 6) return 'good'
  if (depthMm >= 4) return 'attention'
  return 'critical'
}

/**
 * Accept tread depths allowed by DB:
 * null, exact 1.6, or multiples of 0.5 mm within 0–30.
 */
export function parseTyreTreadDepthMm(
  raw: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: null }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: 'Enter a valid tread depth in millimetres.' }
  }
  if (parsed < 0 || parsed > 30) {
    return { ok: false, error: 'Tread depth must be between 0 and 30 mm.' }
  }
  if (parsed === 1.6) return { ok: true, value: 1.6 }

  const stepped = Math.round(parsed * 2) / 2
  if (Math.abs(parsed - stepped) > 1e-9) {
    return { ok: false, error: 'Use 0.5 mm steps (for example 7.5), or exact 1.6 mm.' }
  }
  return { ok: true, value: stepped }
}

export type TyreDbPosition =
  | 'left'
  | 'right'
  | 'outer_left'
  | 'inner_left'
  | 'inner_right'
  | 'outer_right'

export type TyreAxleType = 'steer' | 'drive' | 'trailer'

export function tyrePositionToDb(position: TyrePosition): TyreDbPosition {
  switch (position) {
    case 'Left':
      return 'left'
    case 'Right':
      return 'right'
    case 'Outer Left':
      return 'outer_left'
    case 'Inner Left':
      return 'inner_left'
    case 'Inner Right':
      return 'inner_right'
    case 'Outer Right':
      return 'outer_right'
  }
}

export function tyrePositionFromDb(value: string): TyrePosition {
  switch (value) {
    case 'left':
      return 'Left'
    case 'right':
      return 'Right'
    case 'outer_left':
      return 'Outer Left'
    case 'inner_left':
      return 'Inner Left'
    case 'inner_right':
      return 'Inner Right'
    case 'outer_right':
      return 'Outer Right'
    default:
      return 'Left'
  }
}

export function tyreAxleTypeFor(unit: TyreUnit, axleNumber: number): TyreAxleType {
  if (unit === 'trailer') return 'trailer'
  if (axleNumber === 1) return 'steer'
  return 'drive'
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

/** Outdoor-readable status colours for tyre tiles (Worker + Admin). */
export function tyreStatusClasses(status: TyreStatus): {
  tile: string
  badge: string
  dot: string
} {
  switch (status) {
    case 'good':
      return {
        tile:
          'border-emerald-700 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-600',
        badge:
          'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white ring-1 ring-emerald-900/40',
        dot: 'bg-emerald-700 dark:bg-emerald-300',
      }
    case 'attention':
      return {
        tile:
          'border-amber-700 bg-amber-500 text-amber-950 dark:border-amber-400 dark:bg-amber-500',
        badge:
          'bg-amber-500 text-amber-950 dark:bg-amber-400 dark:text-amber-950 ring-1 ring-amber-900/40',
        dot: 'bg-amber-700 dark:bg-amber-200',
      }
    case 'critical':
      return {
        tile: 'border-red-800 bg-red-600 text-white dark:border-red-400 dark:bg-red-600',
        badge:
          'bg-red-600 text-white dark:bg-red-500 dark:text-white ring-1 ring-red-950/40',
        dot: 'bg-red-800 dark:bg-red-300',
      }
    case 'dirty':
      return {
        tile:
          'border-yellow-700 bg-yellow-400 text-yellow-950 dark:border-yellow-300 dark:bg-yellow-400',
        badge:
          'bg-yellow-400 text-yellow-950 dark:bg-yellow-300 dark:text-yellow-950 ring-1 ring-yellow-900/40',
        dot: 'bg-yellow-600 dark:bg-yellow-200',
      }
    case 'not_checked':
      return {
        tile: 'border-slate-500 bg-slate-200 text-slate-800 dark:border-slate-400 dark:bg-slate-700 dark:text-slate-100',
        badge:
          'bg-slate-300 text-slate-900 dark:bg-slate-600 dark:text-slate-100 ring-1 ring-slate-500/40',
        dot: 'bg-slate-500 dark:bg-slate-300',
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

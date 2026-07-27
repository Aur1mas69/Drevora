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

/** Colour intensity for tyre status tiles/badges/dots. */
export type TyreStatusPalette = 'vivid' | 'pastel'

/** Outdoor-readable status colours for tyre tiles (Worker mobile — always vivid). */
function tyreStatusClassesVivid(status: TyreStatus): {
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

/** Softer semantic colours for Admin Configuration / History (readable, still on-brand). */
function tyreStatusClassesPastel(status: TyreStatus): {
  tile: string
  badge: string
  dot: string
} {
  switch (status) {
    case 'good':
      return {
        tile:
          'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-200',
        badge:
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 ring-1 ring-emerald-200 dark:ring-emerald-800/60',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
      }
    case 'attention':
      return {
        tile:
          'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200',
        badge:
          'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 ring-1 ring-amber-200 dark:ring-amber-800/60',
        dot: 'bg-amber-500 dark:bg-amber-400',
      }
    case 'critical':
      return {
        tile:
          'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-200',
        badge:
          'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200 ring-1 ring-rose-200 dark:ring-rose-800/60',
        dot: 'bg-rose-500 dark:bg-rose-400',
      }
    case 'dirty':
      return {
        tile:
          'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800/50 dark:bg-yellow-950/30 dark:text-yellow-200',
        badge:
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 ring-1 ring-yellow-200 dark:ring-yellow-800/60',
        dot: 'bg-yellow-400 dark:bg-yellow-300',
      }
    case 'not_checked':
      return {
        tile:
          'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-slate-800/40 dark:text-slate-300',
        badge:
          'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-white/10',
        dot: 'bg-slate-400 dark:bg-slate-400',
      }
  }
}

/**
 * Semantic status colours for tyre tiles/badges/dots.
 * palette 'vivid' (default) is outdoor-readable for Worker mobile.
 * palette 'pastel' is the softer tone used on Admin Configuration / History.
 */
export function tyreStatusClasses(
  status: TyreStatus,
  palette: TyreStatusPalette = 'vivid',
): {
  tile: string
  badge: string
  dot: string
} {
  return palette === 'pastel' ? tyreStatusClassesPastel(status) : tyreStatusClassesVivid(status)
}

/** Per-axle wheel layout. Single = 2 tyres; Dual = 4 tyres. */
export type AxleWheelLayout = 'single' | 'dual'

const SINGLE_AXLE_POSITIONS: readonly TyrePosition[] = ['Left', 'Right']

const DUAL_AXLE_POSITIONS: readonly TyrePosition[] = [
  'Outer Left',
  'Inner Left',
  'Inner Right',
  'Outer Right',
]

/** Canonical left-to-right / outer-to-inner display order. */
const TYRE_POSITION_SORT_ORDER: Record<TyrePosition, number> = {
  'Outer Left': 0,
  Left: 1,
  'Inner Left': 2,
  'Inner Right': 3,
  Right: 4,
  'Outer Right': 5,
}

function clampAxleCount(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function compareTyrePositions(a: TyrePosition, b: TyrePosition): number {
  return TYRE_POSITION_SORT_ORDER[a] - TYRE_POSITION_SORT_ORDER[b]
}

/** True when the tyre sits on the vehicle's left side (near or outer/inner left). */
function isLeftSideTyrePosition(position: TyrePosition): boolean {
  return (
    position === 'Left' ||
    position === 'Outer Left' ||
    position === 'Inner Left'
  )
}

/**
 * Within one axle on the left side: outer first, then inner.
 * Single-tyre `Left` shares the outer slot.
 */
const LEFT_SIDE_WALK_ORDER: Record<TyrePosition, number> = {
  'Outer Left': 0,
  Left: 0,
  'Inner Left': 1,
  'Inner Right': 2,
  Right: 2,
  'Outer Right': 2,
}

/**
 * Within one axle on the right side (rear → front walk): outer first, then inner.
 * Single-tyre `Right` shares the outer slot.
 */
const RIGHT_SIDE_WALK_ORDER: Record<TyrePosition, number> = {
  'Outer Right': 0,
  Right: 0,
  'Inner Right': 1,
  'Inner Left': 2,
  Left: 2,
  'Outer Left': 2,
}

/**
 * Compare tyres for a physical clockwise walkaround:
 * front-left → left side front-to-rear (incl. trailer left) →
 * cross behind → right side rear-to-front → finish front-right.
 * Duals: outer tyre before inner at each position.
 *
 * Does not change tyre IDs — only visit sequence for Worker Next/Previous.
 */
export function compareTyresForClockwiseWalk(
  a: Pick<TyreMeasurement, 'unit' | 'axleNumber' | 'position'>,
  b: Pick<TyreMeasurement, 'unit' | 'axleNumber' | 'position'>,
): number {
  const aLeft = isLeftSideTyrePosition(a.position)
  const bLeft = isLeftSideTyrePosition(b.position)
  if (aLeft !== bLeft) return aLeft ? -1 : 1

  if (aLeft) {
    // Left side: vehicle before trailer, axles ascending (front → rear).
    if (a.unit !== b.unit) return a.unit === 'vehicle' ? -1 : 1
    if (a.axleNumber !== b.axleNumber) return a.axleNumber - b.axleNumber
    return LEFT_SIDE_WALK_ORDER[a.position] - LEFT_SIDE_WALK_ORDER[b.position]
  }

  // Right side: trailer before vehicle, axles descending (rear → front).
  if (a.unit !== b.unit) return a.unit === 'trailer' ? -1 : 1
  if (a.axleNumber !== b.axleNumber) return b.axleNumber - a.axleNumber
  return RIGHT_SIDE_WALK_ORDER[a.position] - RIGHT_SIDE_WALK_ORDER[b.position]
}

/** Stable copy sorted into the Worker clockwise walkaround sequence. */
export function sortTyresForClockwiseWalk<T extends Pick<TyreMeasurement, 'unit' | 'axleNumber' | 'position'>>(
  tyres: readonly T[],
): T[] {
  return tyres.slice().sort(compareTyresForClockwiseWalk)
}

export function positionsForWheelLayout(layout: AxleWheelLayout): TyrePosition[] {
  return layout === 'single' ? [...SINGLE_AXLE_POSITIONS] : [...DUAL_AXLE_POSITIONS]
}

/** Persisted default per-axle Single/Dual layout for one Vehicle (vehicle_tyre_layouts). */
export type VehicleTyreLayout = {
  vehicleId: string
  axleCount: number
  axleLayouts: AxleWheelLayout[]
}

/**
 * Resize a per-axle layout array to `targetCount`, keeping existing choices
 * for retained axles and filling any newly added axles from `fallback`.
 * Used when a Worker/Admin changes the axle count after loading a saved
 * (or fallback) layout, so earlier axle choices are never silently discarded.
 */
export function resizeAxleWheelLayouts(
  current: readonly AxleWheelLayout[],
  targetCount: number,
  fallback: (count: number) => AxleWheelLayout[],
): AxleWheelLayout[] {
  const count = clampAxleCount(targetCount, 1, MAX_COMBINED_TYRE_AXLES)
  if (count <= current.length) return current.slice(0, count)
  const filled = fallback(count)
  return [...current, ...filled.slice(current.length)]
}

/**
 * FALLBACK truck per-axle wheel layouts until Admin configuration is persisted.
 *
 * Default UK rigid/tractor assumption:
 * - first truck axle (steer) = single
 * - remaining truck drive axles = dual
 *
 * Replace this helper when vehicle/type axle layouts are stored in Supabase.
 * Do not infer trailer layouts from this function.
 */
export function resolveFallbackTruckAxleWheelLayouts(
  truckAxleCount: number,
): AxleWheelLayout[] {
  const count = clampAxleCount(truckAxleCount, 1, MAX_COMBINED_TYRE_AXLES)
  return Array.from({ length: count }, (_, index) =>
    index === 0 ? 'single' : 'dual',
  )
}

/**
 * FALLBACK trailer per-axle wheel layouts until Admin configuration is persisted.
 * Trailer defaults stay separate from the truck layout and are not guessed from it.
 * Current safe default: every trailer axle is dual.
 */
export function resolveFallbackTrailerAxleWheelLayouts(
  trailerAxleCount: number,
): AxleWheelLayout[] {
  const count = clampAxleCount(trailerAxleCount, 1, MAX_COMBINED_TYRE_AXLES)
  return Array.from({ length: count }, () => 'dual' as AxleWheelLayout)
}

export function tyreLayoutPositionKey(
  unit: TyreUnit,
  axleNumber: number,
  position: TyrePosition,
): string {
  return `${unit}:${axleNumber}:${tyrePositionToDb(position)}`
}

/** Expected tyre position keys for the resolved fallback layout. */
export function expectedTyreLayoutKeys(
  truckAxleCount: number,
  trailerAxleCount: number | null,
): Set<string> {
  const keys = new Set<string>()
  const truckLayouts = resolveFallbackTruckAxleWheelLayouts(truckAxleCount)
  truckLayouts.forEach((layout, index) => {
    const axleNumber = index + 1
    for (const position of positionsForWheelLayout(layout)) {
      keys.add(tyreLayoutPositionKey('vehicle', axleNumber, position))
    }
  })

  if (trailerAxleCount != null) {
    const trailerLayouts = resolveFallbackTrailerAxleWheelLayouts(trailerAxleCount)
    trailerLayouts.forEach((layout, index) => {
      const axleNumber = index + 1
      for (const position of positionsForWheelLayout(layout)) {
        keys.add(tyreLayoutPositionKey('trailer', axleNumber, position))
      }
    })
  }

  return keys
}

/**
 * Items whose axle number falls outside the parent's current axle counts
 * (e.g. a stale row left over from an axle count change on an editable
 * draft). Single/Dual is a free per-axle choice recorded directly on each
 * item, so this only checks axle-number bounds — it never second-guesses a
 * Worker's chosen position set for an in-bounds axle.
 * Used to correct editable draft / in_progress checks only.
 */
export function findExtraneousTyreMeasurements(
  items: TyreMeasurement[],
  truckAxleCount: number,
  trailerAxleCount: number | null,
): TyreMeasurement[] {
  return items.filter((item) => {
    if (item.unit === 'vehicle') return item.axleNumber > truckAxleCount
    return trailerAxleCount == null || item.axleNumber > trailerAxleCount
  })
}

/**
 * Derive a human-readable per-axle Single/Dual summary directly from a
 * check's own recorded tyre_check_items positions (2 rows = Single, 4 rows
 * = Dual). This reads only the historical measurements of one check, never
 * the Vehicle's current saved default, so it stays accurate for old checks
 * even after later Vehicle configuration edits.
 */
export function summarizeAxleLayoutFromMeasurements(measurements: TyreMeasurement[]): string {
  const axleCounts = new Map<string, { unit: TyreUnit; axleNumber: number; count: number }>()
  for (const item of measurements) {
    const key = `${item.unit}:${item.axleNumber}`
    const existing = axleCounts.get(key)
    if (existing) {
      existing.count += 1
    } else {
      axleCounts.set(key, { unit: item.unit, axleNumber: item.axleNumber, count: 1 })
    }
  }

  const sorted = [...axleCounts.values()].sort((a, b) => {
    if (a.unit !== b.unit) return a.unit === 'vehicle' ? -1 : 1
    return a.axleNumber - b.axleNumber
  })

  const describe = (axle: { axleNumber: number; count: number }) =>
    `Axle ${axle.axleNumber} ${axle.count >= 4 ? 'Dual' : 'Single'}`

  const truckParts = sorted.filter((axle) => axle.unit === 'vehicle').map(describe)
  const trailerParts = sorted.filter((axle) => axle.unit === 'trailer').map(describe)

  const parts: string[] = []
  if (truckParts.length > 0) parts.push(`Truck: ${truckParts.join(', ')}`)
  if (trailerParts.length > 0) parts.push(`Trailer: ${trailerParts.join(', ')}`)
  return parts.join(' · ') || 'No axle layout recorded'
}

function axleLabel(unit: TyreUnit, axleNumber: number): string {
  if (unit === 'trailer') {
    return `Trailer Axle ${axleNumber}`
  }
  if (axleNumber === 1) return 'Steer Axle 1'
  return `Drive Axle ${axleNumber}`
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
 *
 * Each axle uses its own wheel layout: `overrides.truckAxleLayouts` /
 * `overrides.trailerAxleLayouts` when provided and matching the resolved
 * axle count (the Worker/Admin's chosen or saved-default layout), otherwise
 * the fallback resolvers (first truck axle single, remaining truck axles
 * dual; trailer axles dual). Truck and Trailer counts are independent;
 * Trailer numbering restarts at 1.
 */
export function buildTyreLayout(
  truckAxleCount: number,
  trailerAxleCount: number | null,
  overrides?: {
    truckAxleLayouts?: readonly AxleWheelLayout[]
    trailerAxleLayouts?: readonly AxleWheelLayout[]
  },
): TyreMeasurement[] {
  const truckAxles = clampAxleCount(
    truckAxleCount,
    1,
    trailerAxleCount == null ? MAX_COMBINED_TYRE_AXLES : MAX_COMBINED_TYRE_AXLES - 1,
  )
  const rows: TyreMeasurement[] = []
  const truckLayouts =
    overrides?.truckAxleLayouts && overrides.truckAxleLayouts.length === truckAxles
      ? overrides.truckAxleLayouts
      : resolveFallbackTruckAxleWheelLayouts(truckAxles)

  truckLayouts.forEach((layout, index) => {
    const axleNumber = index + 1
    for (const position of positionsForWheelLayout(layout)) {
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
  })

  if (trailerAxleCount != null) {
    const trailerAxles = clampAxleCount(
      trailerAxleCount,
      1,
      MAX_COMBINED_TYRE_AXLES - truckAxles,
    )
    const trailerLayouts =
      overrides?.trailerAxleLayouts && overrides.trailerAxleLayouts.length === trailerAxles
        ? overrides.trailerAxleLayouts
        : resolveFallbackTrailerAxleWheelLayouts(trailerAxles)
    trailerLayouts.forEach((layout, index) => {
      const axleNumber = index + 1
      for (const position of positionsForWheelLayout(layout)) {
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
    })
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

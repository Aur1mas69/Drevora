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
  axleCount: number
  summaryLabel: string
  notes: string
  photoCount: number
  measurements: TyreMeasurement[]
}

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

/** Baby-blue DREVORA status colours for tyre tiles. */
export function tyreStatusClasses(status: TyreStatus): {
  tile: string
  badge: string
  dot: string
} {
  switch (status) {
    case 'good':
      return {
        tile: 'border-emerald-200 bg-emerald-50',
        badge: 'bg-emerald-100 text-emerald-800',
        dot: 'bg-emerald-500',
      }
    case 'attention':
      return {
        tile: 'border-amber-200 bg-amber-50',
        badge: 'bg-amber-100 text-amber-800',
        dot: 'bg-amber-500',
      }
    case 'critical':
      return {
        tile: 'border-rose-200 bg-rose-50',
        badge: 'bg-rose-100 text-rose-800',
        dot: 'bg-rose-500',
      }
    case 'dirty':
      return {
        tile: 'border-yellow-200 bg-yellow-50',
        badge: 'bg-yellow-100 text-yellow-800',
        dot: 'bg-yellow-400',
      }
    case 'not_checked':
      return {
        tile: 'border-slate-200 bg-slate-50',
        badge: 'bg-slate-100 text-slate-600',
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

export function buildTyreLayout(axleCount: number, includeTrailer: boolean): TyreMeasurement[] {
  const clamped = Math.min(6, Math.max(1, Math.round(axleCount)))
  const rows: TyreMeasurement[] = []

  for (let axleNumber = 1; axleNumber <= clamped; axleNumber += 1) {
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

  if (includeTrailer) {
    for (let axleNumber = 1; axleNumber <= clamped; axleNumber += 1) {
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

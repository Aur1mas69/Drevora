import { buildVehicleCardComplianceEvents } from '@/lib/vehicleCardNextEvent'
import {
  getVehicleStatusForDate,
  todayString,
} from '@/lib/vehicleAvailability'
import type { Vehicle, VehicleStatus } from '@/services/vehiclesService'

/**
 * MVP blocking compliance for dashboard Fleet Status.
 * Same expiry semantics as Fleet Compliance Alerts overdue bucket
 * (`daysUntilDue < 0` via buildVehicleCardComplianceEvents / getDaysUntilDate).
 * Tachograph is alerted but does not block Available for MVP.
 */
export const FLEET_STATUS_BLOCKING_COMPLIANCE_TYPES = [
  'mot',
  'insurance',
  'road_tax',
] as const

export type FleetStatusBlockingComplianceType =
  (typeof FLEET_STATUS_BLOCKING_COMPLIANCE_TYPES)[number]

/** Exclusive headline buckets for Admin Dashboard Fleet Status. */
export type DashboardFleetStatusBucket =
  | 'available'
  | 'off_road'
  | 'maintenance_due'
  | 'other'
  | 'excluded'

export type BlockingComplianceExpiry = {
  type: FleetStatusBlockingComplianceType
  label: string
  dueDate: string
  daysUntilDue: number
}

export type VehicleDashboardFleetStatus = {
  /** Manual / availability operational status for the day (unchanged in DB). */
  operationalStatus: VehicleStatus
  blockingExpiries: BlockingComplianceExpiry[]
  complianceBlocked: boolean
  bucket: DashboardFleetStatusBucket
  /** Present when complianceBlocked; e.g. "Compliance blocked — MOT expired". */
  complianceBlockedReason: string | null
}

export type DashboardFleetStatusCounts = {
  available: number
  offRoad: number
  maintenanceDue: number
  /** Off-road row helper; includes compliance-blocked summary when relevant. */
  offRoadHelper: string
}

const BLOCKING_TYPE_SET = new Set<string>(FLEET_STATUS_BLOCKING_COMPLIANCE_TYPES)

const BLOCKING_DISPLAY_LABEL: Record<FleetStatusBlockingComplianceType, string> = {
  mot: 'MOT',
  insurance: 'Insurance',
  road_tax: 'Tax',
}

const STATUSES_NOT_AVAILABLE: VehicleStatus[] = [
  'Off Road',
  'Maintenance',
  'Workshop',
  'Out of Service',
  'Reserved',
  'Assigned',
]

const DEFAULT_OFF_ROAD_HELPER = 'Needs attention'

function isBlockingType(
  type: string,
): type is FleetStatusBlockingComplianceType {
  return BLOCKING_TYPE_SET.has(type)
}

/**
 * Operational status for a calendar day — same resolution as previous Fleet Status
 * (availability override, else base/manual status). Does not mutate stored status.
 */
export function getOperationalStatusToday(
  vehicle: Vehicle,
  today: string,
): VehicleStatus {
  return getVehicleStatusForDate(vehicle, today)
}

/**
 * Blocking expired MOT / insurance / road tax for a vehicle.
 * Reuses buildVehicleCardComplianceEvents so overdue matches Compliance Alerts.
 */
export function getBlockingComplianceExpiries(
  vehicle: Vehicle,
  today = todayString(),
): BlockingComplianceExpiry[] {
  return buildVehicleCardComplianceEvents(vehicle, today)
    .filter(
      (event): event is typeof event & { type: FleetStatusBlockingComplianceType } =>
        isBlockingType(event.type) && event.daysUntilDue < 0,
    )
    .map((event) => ({
      type: event.type,
      label: BLOCKING_DISPLAY_LABEL[event.type],
      dueDate: event.dueDate,
      daysUntilDue: event.daysUntilDue,
    }))
}

export function formatComplianceBlockedReason(
  expiries: BlockingComplianceExpiry[],
): string | null {
  if (expiries.length === 0) return null

  const labels = FLEET_STATUS_BLOCKING_COMPLIANCE_TYPES.filter((type) =>
    expiries.some((item) => item.type === type),
  ).map((type) => BLOCKING_DISPLAY_LABEL[type])

  if (labels.length === 1) {
    return `Compliance blocked — ${labels[0]} expired`
  }

  return `Compliance blocked — ${labels.join(', ')} expired`
}

/**
 * Effective Fleet Status precedence (exclusive; no double-count across headlines):
 * 1. archived → excluded
 * 2. manual Off Road / Out of Service OR any blocking compliance expiry → off_road
 * 3. manual Maintenance → maintenance_due
 * 4. other unavailable (Workshop / Reserved / Assigned) → other (not in headlines)
 * 5. else → available
 *
 * Stored `vehicles.status` is never written; renewed compliance restores Available
 * when manual/operational status still permits normal use.
 */
export function resolveVehicleDashboardFleetStatus(
  vehicle: Vehicle,
  today = todayString(),
): VehicleDashboardFleetStatus {
  if (vehicle.archivedAt) {
    const operationalStatus = getOperationalStatusToday(vehicle, today)
    return {
      operationalStatus,
      blockingExpiries: [],
      complianceBlocked: false,
      bucket: 'excluded',
      complianceBlockedReason: null,
    }
  }

  const operationalStatus = getOperationalStatusToday(vehicle, today)
  const blockingExpiries = getBlockingComplianceExpiries(vehicle, today)
  const complianceBlocked = blockingExpiries.length > 0
  const complianceBlockedReason = formatComplianceBlockedReason(blockingExpiries)

  const manualOffRoad =
    operationalStatus === 'Off Road' || operationalStatus === 'Out of Service'

  if (manualOffRoad || complianceBlocked) {
    return {
      operationalStatus,
      blockingExpiries,
      complianceBlocked,
      bucket: 'off_road',
      complianceBlockedReason,
    }
  }

  if (operationalStatus === 'Maintenance') {
    return {
      operationalStatus,
      blockingExpiries,
      complianceBlocked: false,
      bucket: 'maintenance_due',
      complianceBlockedReason: null,
    }
  }

  if (STATUSES_NOT_AVAILABLE.includes(operationalStatus)) {
    return {
      operationalStatus,
      blockingExpiries,
      complianceBlocked: false,
      bucket: 'other',
      complianceBlockedReason: null,
    }
  }

  return {
    operationalStatus,
    blockingExpiries,
    complianceBlocked: false,
    bucket: 'available',
    complianceBlockedReason: null,
  }
}

function formatFleetOffRoadHelper(
  complianceBlockedTypeCounts: Map<FleetStatusBlockingComplianceType, number>,
): string {
  const labels = FLEET_STATUS_BLOCKING_COMPLIANCE_TYPES.filter(
    (type) => (complianceBlockedTypeCounts.get(type) ?? 0) > 0,
  ).map((type) => BLOCKING_DISPLAY_LABEL[type])

  if (labels.length === 0) return DEFAULT_OFF_ROAD_HELPER
  if (labels.length === 1) {
    return `Compliance blocked — ${labels[0]} expired`
  }
  return `Compliance blocked — ${labels.join(', ')} expired`
}

/**
 * Headline Fleet Status totals. Each active vehicle appears in at most one of
 * available / offRoad / maintenanceDue.
 */
export function countDashboardFleetStatus(
  vehicles: Vehicle[],
  today = todayString(),
): DashboardFleetStatusCounts {
  let available = 0
  let offRoad = 0
  let maintenanceDue = 0
  const complianceBlockedTypeCounts = new Map<
    FleetStatusBlockingComplianceType,
    number
  >()

  for (const vehicle of vehicles) {
    const resolved = resolveVehicleDashboardFleetStatus(vehicle, today)

    if (resolved.bucket === 'available') {
      available += 1
      continue
    }

    if (resolved.bucket === 'off_road') {
      offRoad += 1
      if (resolved.complianceBlocked) {
        for (const expiry of resolved.blockingExpiries) {
          complianceBlockedTypeCounts.set(
            expiry.type,
            (complianceBlockedTypeCounts.get(expiry.type) ?? 0) + 1,
          )
        }
      }
      continue
    }

    if (resolved.bucket === 'maintenance_due') {
      maintenanceDue += 1
    }
  }

  return {
    available,
    offRoad,
    maintenanceDue,
    offRoadHelper: formatFleetOffRoadHelper(complianceBlockedTypeCounts),
  }
}

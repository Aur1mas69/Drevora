import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import {
  getAvailabilityRecordForDate,
  todayString,
} from '@/lib/vehicleAvailability'
import {
  getVehicleStatusForDate,
  type Vehicle,
  type VehicleAvailability,
  type VehicleStatus,
} from '@/services/vehiclesService'

const EXPIRING_SOON_DAYS = 30
const UPCOMING_ALERTS_DAYS = 7

const UNAVAILABLE_STATUSES: VehicleStatus[] = [
  'Off Road',
  'Maintenance',
  'Workshop',
  'Out of Service',
  'Reserved',
  'Assigned',
]

export type DashboardRecentActivity =
  | {
      type: 'worker'
      id: string
      title: string
      createdAt: string
    }
  | {
      type: 'vehicle'
      id: string
      title: string
      createdAt: string
    }
  | {
      type: 'availability'
      id: string
      title: string
      createdAt: string
      vehicleId: string
    }

export type DashboardAvailabilityAlerts = {
  offRoadToday: number
  maintenanceToday: number
  outOfServiceToday: number
  goingOffRoadSoon: number
  documentsExpiringSoon: number
}

export type DashboardStats = {
  workers: number
  workingToday: number
  vehicles: number
  availableVehicles: number
  offRoadOrOutOfService: number
  complianceAlerts: number
  availabilityAlerts: DashboardAvailabilityAlerts
  recentActivity: DashboardRecentActivity[]
}

type DriverComplianceRow = {
  role: string | null
  driving_licence_expiry: string | null
  cpc_expiry: string | null
  driver_card_expiry: string | null
}

type VehicleDocumentRow = {
  id: string
  insurance_expiry: string | null
  mot_expiry: string | null
  road_tax_expiry: string | null
  tachograph_expiry: string | null
}

type VehicleRow = {
  id: string
  created_at: string
  registration: string
  make: string
  model: string
  status: string | null
  insurance_expiry: string | null
  mot_expiry: string | null
  road_tax_expiry: string | null
  tachograph_expiry: string | null
}

type AvailabilityRow = {
  id: string
  created_at: string
  vehicle_id: string
  status: string
  start_date: string
  end_date: string | null
  reason: string | null
}

export const emptyDashboardStats: DashboardStats = {
  workers: 0,
  workingToday: 0,
  vehicles: 0,
  availableVehicles: 0,
  offRoadOrOutOfService: 0,
  complianceAlerts: 0,
  availabilityAlerts: {
    offRoadToday: 0,
    maintenanceToday: 0,
    outOfServiceToday: 0,
    goingOffRoadSoon: 0,
    documentsExpiringSoon: 0,
  },
  recentActivity: [],
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + days)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getEffectiveStatusToday(vehicle: Vehicle, today: string): VehicleStatus {
  const activeRecord = getAvailabilityRecordForDate(vehicle, today)
  if (activeRecord) {
    return activeRecord.status
  }

  return getVehicleStatusForDate(vehicle, today)
}

function getDaysRemaining(value: string): number | null {
  const expiryDate = new Date(`${value}T00:00:00`)
  if (Number.isNaN(expiryDate.getTime())) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Math.ceil((expiryDate.getTime() - today.getTime()) / 86_400_000)
}

function isExpiredOrExpiringSoon(value: string | null): boolean {
  if (!value) return false

  const daysRemaining = getDaysRemaining(value)
  if (daysRemaining === null) return false

  return daysRemaining <= EXPIRING_SOON_DAYS
}

function isExpiringSoonOnly(value: string | null): boolean {
  if (!value) return false

  const daysRemaining = getDaysRemaining(value)
  if (daysRemaining === null) return false

  return daysRemaining >= 0 && daysRemaining <= EXPIRING_SOON_DAYS
}

function isVehicleStatus(value: string | null): value is VehicleStatus {
  return (
    value === 'Available' ||
    value === 'Assigned' ||
    value === 'Workshop' ||
    value === 'Maintenance' ||
    value === 'Out of Service' ||
    value === 'Off Road' ||
    value === 'Reserved'
  )
}

function mapAvailabilityRow(row: AvailabilityRow): VehicleAvailability {
  return {
    id: row.id,
    createdAt: row.created_at,
    vehicleId: row.vehicle_id,
    status: isVehicleStatus(row.status) ? row.status : 'Available',
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    notes: null,
  }
}

function buildDashboardVehicle(
  row: VehicleRow,
  availabilityRecords: VehicleAvailability[],
): Vehicle {
  const baseStatus = isVehicleStatus(row.status) ? row.status : 'Available'

  return {
    id: row.id,
    createdAt: row.created_at,
    registration: row.registration,
    fleetNumber: null,
    make: row.make,
    model: row.model,
    year: null,
    vin: null,
    currentOdometer: null,
    vehicleType: null,
    baseStatus,
    status: baseStatus,
    availabilityStatus: baseStatus,
    currentDriverId: null,
    insuranceExpiry: row.insurance_expiry,
    motExpiry: row.mot_expiry,
    roadTaxExpiry: row.road_tax_expiry,
    tachographExpiry: row.tachograph_expiry,
    offRoadReason: null,
    offRoadStartDate: null,
    offRoadExpectedReturnDate: null,
    offRoadStart: null,
    offRoadReturn: null,
    offRoadNotes: null,
    notes: null,
    availabilityRecords: availabilityRecords.filter(
      (record) => record.vehicleId === row.id,
    ),
  }
}

async function countTableRows(
  table: 'drivers' | 'vehicles',
  filter?: { column: string; value: string },
): Promise<number> {
  try {
    let query = requireSupabase().from(table).select('id', { count: 'exact', head: true })

    if (filter) {
      query = query.eq(filter.column, filter.value)
    }

    const { count, error, data } = await query

    logSupabaseQuery({
      service: 'dashboardService.countTableRows',
      table,
      data: data as unknown[] | null,
      error,
      count,
    })

    if (error) return 0

    return count ?? 0
  } catch (error) {
    console.error('[dashboardService.countTableRows] unexpected error:', error)
    return 0
  }
}

async function fetchDriverComplianceRows(): Promise<DriverComplianceRow[]> {
  try {
    const { data, error } = await requireSupabase()
      .from('drivers')
      .select('role, driving_licence_expiry, cpc_expiry, driver_card_expiry')

    if (error) return []
    return (data ?? []) as DriverComplianceRow[]
  } catch {
    return []
  }
}

async function fetchVehicleDocumentRows(): Promise<VehicleDocumentRow[]> {
  try {
    const { data, error } = await requireSupabase()
      .from('vehicles')
      .select('id, insurance_expiry, mot_expiry, road_tax_expiry, tachograph_expiry')

    if (error) return []
    return (data ?? []) as VehicleDocumentRow[]
  } catch {
    return []
  }
}

async function fetchDashboardVehicles(): Promise<Vehicle[]> {
  try {
    const [vehicleResult, availabilityResult] = await Promise.all([
      requireSupabase()
        .from('vehicles')
        .select(
          'id, created_at, registration, make, model, status, insurance_expiry, mot_expiry, road_tax_expiry, tachograph_expiry',
        )
        .order('created_at', { ascending: false }),
      requireSupabase()
        .from('vehicle_availability')
        .select('id, created_at, vehicle_id, status, start_date, end_date, reason')
        .order('start_date', { ascending: false }),
    ])

    logSupabaseQuery({
      service: 'dashboardService.fetchDashboardVehicles',
      table: 'vehicles',
      data: vehicleResult.data,
      error: vehicleResult.error,
    })

    logSupabaseQuery({
      service: 'dashboardService.fetchDashboardVehicles',
      table: 'vehicle_availability',
      data: availabilityResult.data,
      error: availabilityResult.error,
    })

    if (vehicleResult.error) return []

    const availabilityRecords = availabilityResult.error
      ? []
      : (availabilityResult.data ?? []).map((row) =>
          mapAvailabilityRow(row as AvailabilityRow),
        )

    return (vehicleResult.data ?? []).map((row) =>
      buildDashboardVehicle(row as VehicleRow, availabilityRecords),
    )
  } catch {
    return []
  }
}

async function fetchRecentWorkers(): Promise<DashboardRecentActivity[]> {
  try {
    const { data, error } = await requireSupabase()
      .from('drivers')
      .select('id, first_name, last_name, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) return []

    return (data ?? []).map((driver) => ({
      type: 'worker' as const,
      id: driver.id,
      title: `${driver.first_name} ${driver.last_name}`.trim(),
      createdAt: driver.created_at,
    }))
  } catch {
    return []
  }
}

async function fetchRecentAvailabilityEvents(
  vehicleRegistrations: Map<string, string>,
): Promise<DashboardRecentActivity[]> {
  try {
    const { data, error } = await requireSupabase()
      .from('vehicle_availability')
      .select('id, created_at, vehicle_id, status, start_date, reason')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) return []

    return (data ?? []).map((record) => {
      const registration =
        vehicleRegistrations.get(record.vehicle_id) ?? 'Vehicle'
      const status = isVehicleStatus(record.status) ? record.status : 'Event'

      return {
        type: 'availability' as const,
        id: record.id,
        vehicleId: record.vehicle_id,
        title: `${registration} — ${status}`,
        createdAt: record.created_at,
      }
    })
  } catch {
    return []
  }
}

function countDriverComplianceAlerts(rows: DriverComplianceRow[]): number {
  return rows.reduce((total, driver) => {
    const requiresDriverDocs = driver.role === 'Driver'
    let alerts = 0

    if (requiresDriverDocs) {
      if (isExpiredOrExpiringSoon(driver.driving_licence_expiry)) alerts += 1
      if (isExpiredOrExpiringSoon(driver.cpc_expiry)) alerts += 1
      if (isExpiredOrExpiringSoon(driver.driver_card_expiry)) alerts += 1
    }

    return total + alerts
  }, 0)
}

function countVehicleComplianceAlerts(rows: VehicleDocumentRow[]): number {
  return rows.reduce((total, vehicle) => {
    const documents = [
      vehicle.mot_expiry,
      vehicle.insurance_expiry,
      vehicle.road_tax_expiry,
      vehicle.tachograph_expiry,
    ]

    return total + documents.filter(isExpiredOrExpiringSoon).length
  }, 0)
}

function countVehicleDocumentsExpiringSoon(rows: VehicleDocumentRow[]): number {
  const vehiclesWithAlerts = new Set<string>()

  for (const vehicle of rows) {
    const documents = [
      vehicle.mot_expiry,
      vehicle.insurance_expiry,
      vehicle.road_tax_expiry,
      vehicle.tachograph_expiry,
    ]

    if (documents.some(isExpiringSoonOnly)) {
      vehiclesWithAlerts.add(vehicle.id)
    }
  }

  return vehiclesWithAlerts.size
}

function countVehicleStatusesToday(vehicles: Vehicle[]): {
  availableVehicles: number
  offRoadOrOutOfService: number
  offRoadToday: number
  maintenanceToday: number
  outOfServiceToday: number
} {
  const today = todayString()
  let availableVehicles = 0
  let offRoadToday = 0
  let maintenanceToday = 0
  let outOfServiceToday = 0

  for (const vehicle of vehicles) {
    const status = getEffectiveStatusToday(vehicle, today)

    if (!UNAVAILABLE_STATUSES.includes(status)) {
      availableVehicles += 1
    }

    if (status === 'Off Road') {
      offRoadToday += 1
    }

    if (status === 'Maintenance') {
      maintenanceToday += 1
    }

    if (status === 'Out of Service') {
      outOfServiceToday += 1
    }
  }

  return {
    availableVehicles,
    offRoadToday,
    maintenanceToday,
    outOfServiceToday,
    offRoadOrOutOfService: offRoadToday + outOfServiceToday,
  }
}

function countUpcomingAvailabilityEvents(
  vehicles: Vehicle[],
  days = UPCOMING_ALERTS_DAYS,
): number {
  const today = todayString()
  const horizon = addDays(today, days)
  const vehiclesWithUpcomingEvents = new Set<string>()

  for (const vehicle of vehicles) {
    const hasUpcomingEvent = vehicle.availabilityRecords.some(
      (record) => record.startDate > today && record.startDate <= horizon,
    )

    if (hasUpcomingEvent) {
      vehiclesWithUpcomingEvents.add(vehicle.id)
    }
  }

  return vehiclesWithUpcomingEvents.size
}

function mergeRecentActivity(
  workers: DashboardRecentActivity[],
  availabilityEvents: DashboardRecentActivity[],
): DashboardRecentActivity[] {
  return [...workers, ...availabilityEvents]
    .sort(
      (firstActivity, secondActivity) =>
        new Date(secondActivity.createdAt).getTime() -
        new Date(firstActivity.createdAt).getTime(),
    )
    .slice(0, 8)
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    console.log('[dashboardService.fetchDashboardStats] loading dashboard counts')

    const [
      workers,
      workingToday,
      driverComplianceRows,
      vehicleDocumentRows,
      dashboardVehicles,
      recentWorkers,
    ] = await Promise.all([
      countTableRows('drivers'),
      countTableRows('drivers', { column: 'status', value: 'Working' }),
      fetchDriverComplianceRows(),
      fetchVehicleDocumentRows(),
      fetchDashboardVehicles(),
      fetchRecentWorkers(),
    ])

    const vehicleRegistrations = new Map(
      dashboardVehicles.map((vehicle) => [vehicle.id, vehicle.registration]),
    )
    const recentAvailabilityEvents = await fetchRecentAvailabilityEvents(
      vehicleRegistrations,
    )

    const vehicleStatusCounts = countVehicleStatusesToday(dashboardVehicles)
    const complianceAlerts =
      countDriverComplianceAlerts(driverComplianceRows) +
      countVehicleComplianceAlerts(vehicleDocumentRows)

    const stats = {
      workers,
      workingToday,
      vehicles: dashboardVehicles.length,
      availableVehicles: vehicleStatusCounts.availableVehicles,
      offRoadOrOutOfService: vehicleStatusCounts.offRoadOrOutOfService,
      complianceAlerts,
      availabilityAlerts: {
        offRoadToday: vehicleStatusCounts.offRoadToday,
        maintenanceToday: vehicleStatusCounts.maintenanceToday,
        outOfServiceToday: vehicleStatusCounts.outOfServiceToday,
        goingOffRoadSoon: countUpcomingAvailabilityEvents(dashboardVehicles),
        documentsExpiringSoon: countVehicleDocumentsExpiringSoon(
          vehicleDocumentRows,
        ),
      },
      recentActivity: mergeRecentActivity(
        recentWorkers,
        recentAvailabilityEvents,
      ),
    }

    console.log('[dashboardService.fetchDashboardStats] result:', {
      workers: stats.workers,
      vehicles: stats.vehicles,
      workingToday: stats.workingToday,
    })

    return stats
  } catch (error) {
    console.error('[dashboardService.fetchDashboardStats] unexpected error:', error)
    return emptyDashboardStats
  }
}

export const dashboardService = {
  fetchDashboardStats,
}

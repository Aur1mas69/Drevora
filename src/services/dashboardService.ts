import { getTimesheetWeekSettings } from '@/lib/companySettingsGlobals'
import { getCompanyTodayIsoDate } from '@/lib/companyDate'
import { computeMonthlyConsumablesSummary } from '@/lib/consumableUtils'
import type { ConsumableType, ConsumableUnit } from '@/lib/consumableTypes'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import { getDefaultWeekStartMonday } from '@/lib/timesheetUtils'
import { formatTimesheetWeekDisplay } from '@/lib/timesheetWeekNumber'
import { fetchConsumablesMonthlySummary } from '@/services/consumablesService'
import { fetchCompanySettings } from '@/services/companySettingsService'
import {
  getAvailabilityRecordForDate,
  todayString,
} from '@/lib/vehicleAvailability'
import { fetchTimesheetWeekStats } from '@/services/timesheetsService'
import {
  getVehicleCheckActivitySeverity,
  vehicleCheckHasIssue,
} from '@/lib/vehicleCheckUtils'
import {
  getVehicleStatusForDate,
  type Vehicle,
  type VehicleAvailability,
  type VehicleStatus,
} from '@/services/vehiclesService'

const EXPIRING_SOON_DAYS = 30
const UPCOMING_ALERTS_DAYS = 7
const RECENT_ACTIVITY_FETCH_LIMIT = 12
const RECENT_ACTIVITY_DISPLAY_LIMIT = 10

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
      path?: string
    }
  | {
      type: 'vehicle'
      id: string
      title: string
      createdAt: string
      path?: string
    }
  | {
      type: 'availability'
      id: string
      title: string
      createdAt: string
      vehicleId: string
      path?: string
    }
  | {
      type: 'holiday_request'
      id: string
      title: string
      createdAt: string
      variant: 'requested' | 'approved' | 'declined'
      path?: string
    }
  | {
      type: 'timesheet'
      id: string
      title: string
      createdAt: string
      variant: 'submitted' | 'approved'
      path?: string
    }
  | {
      type: 'vehicle_check'
      id: string
      title: string
      createdAt: string
      severity: 'success' | 'warning' | 'danger'
      path?: string
    }
  | {
      type: 'driver_report'
      id: string
      title: string
      createdAt: string
      variant: 'created' | 'in_progress'
      reportTitle: string
      path?: string
    }
  | {
      type: 'document'
      id: string
      title: string
      createdAt: string
      documentName: string
      workerId?: string
      vehicleId?: string
      path?: string
    }
  | {
      type: 'consumable'
      id: string
      title: string
      createdAt: string
      consumableType: string
      vehicleReg: string
      vehicleId?: string | null
      path?: string
    }

export type DashboardAvailabilityAlerts = {
  offRoadToday: number
  maintenanceToday: number
  outOfServiceToday: number
  goingOffRoadSoon: number
  documentsExpiringSoon: number
}

export type DashboardTimesheetOverview = {
  weekTitle: string
  weekRangeLabel: string
  drafts: number
  submitted: number
  approved: number
  rejected: number
}

export type DashboardFleetStatus = {
  available: number
  offRoad: number
  maintenanceDue: number
}

export type DashboardHolidaySummary = {
  pending: number
  approved: number
  rejected: number
}

export type DashboardDriverReportsSummary = {
  open: number
  inProgress: number
  closed: number
}

export type DashboardConsumablesTypeTile = {
  consumableType: ConsumableType
  unit: ConsumableUnit
  totalQuantity: number
}

export type DashboardConsumablesOverview = {
  totalEntries: number
  totalQuantityLitres: number
  totalCost: number | null
  vehiclesUsed: number
  typeTiles: DashboardConsumablesTypeTile[]
}

export type DashboardVehicleChecksToday = {
  completedToday: number
  issuesToday: number
  latestIssueAt: string | null
}

export type DashboardDailyVehicleChecksStats = {
  completedOk: number
  issuesFailed: number
  notChecked: number
  totalVehicles: number
}

export type DashboardStats = {
  workers: number
  workingToday: number
  vehicles: number
  availableVehicles: number
  offRoadOrOutOfService: number
  complianceAlerts: number
  vehicleChecksToday: DashboardVehicleChecksToday
  dailyVehicleChecksStats: DashboardDailyVehicleChecksStats
  availabilityAlerts: DashboardAvailabilityAlerts
  timesheetOverview: DashboardTimesheetOverview
  fleetStatus: DashboardFleetStatus
  holidayRequests: DashboardHolidaySummary
  driverReports: DashboardDriverReportsSummary
  consumablesOverview: DashboardConsumablesOverview
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
  current_driver_id: string | null
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
  vehicleChecksToday: {
    completedToday: 0,
    issuesToday: 0,
    latestIssueAt: null,
  },
  dailyVehicleChecksStats: {
    completedOk: 0,
    issuesFailed: 0,
    notChecked: 0,
    totalVehicles: 0,
  },
  availabilityAlerts: {
    offRoadToday: 0,
    maintenanceToday: 0,
    outOfServiceToday: 0,
    goingOffRoadSoon: 0,
    documentsExpiringSoon: 0,
  },
  timesheetOverview: {
    weekTitle: 'Week —',
    weekRangeLabel: '—',
    drafts: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
  },
  fleetStatus: {
    available: 0,
    offRoad: 0,
    maintenanceDue: 0,
  },
  holidayRequests: {
    pending: 0,
    approved: 0,
    rejected: 0,
  },
  driverReports: {
    open: 0,
    inProgress: 0,
    closed: 0,
  },
  consumablesOverview: {
    totalEntries: 0,
    totalQuantityLitres: 0,
    totalCost: null,
    vehiclesUsed: 0,
    typeTiles: [],
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
    currentDriverId: row.current_driver_id,
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
          'id, created_at, registration, make, model, status, current_driver_id, insurance_expiry, mot_expiry, road_tax_expiry, tachograph_expiry',
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

type DriverNameJoinRow = {
  first_name: string
  last_name: string
}

type VehicleRegistrationJoinRow = {
  registration: string
}

type CompanyActivityScope = {
  companyId: string | null
  companyName: string | null
  workerIds: Set<string> | null
  timezone: string
}

function normalizeJoinRow<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function formatWorkerName(driver: DriverNameJoinRow | null): string {
  if (!driver) return 'Worker'
  const name = `${driver.first_name} ${driver.last_name}`.trim()
  return name || 'Worker'
}

function isWorkerInCompanyScope(
  workerId: string | null | undefined,
  scope: CompanyActivityScope,
): boolean {
  if (!scope.workerIds) return true
  if (!workerId) return false
  return scope.workerIds.has(workerId)
}

function hasMeaningfulStatusUpdate(createdAt: string, updatedAt: string): boolean {
  return new Date(updatedAt).getTime() > new Date(createdAt).getTime() + 1000
}

async function fetchCompanyActivityScope(): Promise<CompanyActivityScope> {
  const defaultScope: CompanyActivityScope = {
    companyId: null,
    companyName: null,
    workerIds: null,
    timezone: 'Europe/London',
  }

  try {
    const settings = await fetchCompanySettings()
    const timezone = settings?.timezone?.trim() || 'Europe/London'

    if (!settings?.id) {
      return { ...defaultScope, timezone }
    }

    const companyName = settings.name?.trim() || null
    if (!companyName) {
      return { companyId: settings.id, companyName: null, workerIds: null, timezone }
    }

    const { data, error } = await requireSupabase().from('drivers').select('id, company')

    if (error) {
      return { companyId: settings.id, companyName, workerIds: null, timezone }
    }

    const workerIds = (data ?? [])
      .filter((row) => {
        const workerCompany = row.company?.trim() ?? ''
        return !workerCompany || workerCompany === companyName
      })
      .map((row) => row.id)

    return {
      companyId: settings.id,
      companyName,
      workerIds: workerIds.length > 0 ? new Set(workerIds) : null,
      timezone,
    }
  } catch {
    return defaultScope
  }
}

async function fetchRecentWorkers(scope: CompanyActivityScope): Promise<DashboardRecentActivity[]> {
  try {
    let query = requireSupabase()
      .from('drivers')
      .select('id, first_name, last_name, created_at, company')
      .order('created_at', { ascending: false })
      .limit(RECENT_ACTIVITY_FETCH_LIMIT)

    if (scope.workerIds) {
      query = query.in('id', [...scope.workerIds])
    }

    const { data, error } = await query

    if (error) return []

    return (data ?? []).map((driver) => ({
      type: 'worker' as const,
      id: driver.id,
      title: `${driver.first_name} ${driver.last_name}`.trim() || 'Worker',
      createdAt: driver.created_at,
    }))
  } catch {
    return []
  }
}

async function fetchRecentVehicles(): Promise<DashboardRecentActivity[]> {
  try {
    const { data, error } = await requireSupabase()
      .from('vehicles')
      .select('id, registration, created_at')
      .order('created_at', { ascending: false })
      .limit(RECENT_ACTIVITY_FETCH_LIMIT)

    if (error) return []

    return (data ?? []).map((vehicle) => ({
      type: 'vehicle' as const,
      id: vehicle.id,
      title: vehicle.registration?.trim() || 'Vehicle',
      createdAt: vehicle.created_at,
    }))
  } catch {
    return []
  }
}

const HOLIDAY_REQUEST_ACTIVITY_SELECT = `
  id,
  created_at,
  updated_at,
  worker_id,
  status,
  drivers ( first_name, last_name )
`

async function fetchRecentHolidayActivity(
  scope: CompanyActivityScope,
): Promise<DashboardRecentActivity[]> {
  try {
    let query = requireSupabase()
      .from('holiday_requests')
      .select(HOLIDAY_REQUEST_ACTIVITY_SELECT)
      .order('created_at', { ascending: false })
      .limit(RECENT_ACTIVITY_FETCH_LIMIT)

    if (scope.workerIds) {
      query = query.in('worker_id', [...scope.workerIds])
    }

    const { data, error } = await query

    logSupabaseQuery({
      service: 'dashboardService.fetchRecentHolidayActivity',
      table: 'holiday_requests',
      data,
      error,
    })

    if (error) {
      console.error('[dashboardService.fetchRecentHolidayActivity] query failed:', error.message)
      return []
    }

    const rows = (data ?? []) as Array<{
      id: string
      created_at: string
      updated_at: string
      status: string
      worker_id: string
      drivers: DriverNameJoinRow | DriverNameJoinRow[] | null
    }>

    const items: DashboardRecentActivity[] = []

    for (const row of rows) {
      if (!isWorkerInCompanyScope(row.worker_id, scope)) continue

      const workerName = formatWorkerName(normalizeJoinRow(row.drivers))

      items.push({
        type: 'holiday_request',
        id: `${row.id}-requested`,
        title: workerName,
        variant: 'requested',
        createdAt: row.created_at,
      })

      if (
        row.status === 'Approved' &&
        hasMeaningfulStatusUpdate(row.created_at, row.updated_at)
      ) {
        items.push({
          type: 'holiday_request',
          id: `${row.id}-approved`,
          title: workerName,
          variant: 'approved',
          createdAt: row.updated_at,
        })
      }

      if (
        row.status === 'Rejected' &&
        hasMeaningfulStatusUpdate(row.created_at, row.updated_at)
      ) {
        items.push({
          type: 'holiday_request',
          id: `${row.id}-declined`,
          title: workerName,
          variant: 'declined',
          createdAt: row.updated_at,
        })
      }
    }

    return items
  } catch (error) {
    console.error('[dashboardService.fetchRecentHolidayActivity] unexpected error:', error)
    return []
  }
}

async function fetchRecentTimesheetActivity(
  scope: CompanyActivityScope,
): Promise<DashboardRecentActivity[]> {
  try {
    const { data, error } = await requireSupabase()
      .from('timesheets')
      .select(
        'id, submitted_at, approved_at, driver_id, drivers ( first_name, last_name )',
      )
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(RECENT_ACTIVITY_FETCH_LIMIT)

    logSupabaseQuery({
      service: 'dashboardService.fetchRecentTimesheetActivity',
      table: 'timesheets',
      data,
      error,
    })

    if (error) return []

    const items: DashboardRecentActivity[] = []

    for (const row of data ?? []) {
      if (!isWorkerInCompanyScope(row.driver_id, scope)) continue

      const workerName = formatWorkerName(
        normalizeJoinRow(
          row.drivers as DriverNameJoinRow | DriverNameJoinRow[] | null,
        ),
      )

      if (row.submitted_at) {
        items.push({
          type: 'timesheet',
          id: `${row.id}-submitted`,
          title: workerName,
          variant: 'submitted',
          createdAt: row.submitted_at,
        })
      }

      if (row.approved_at) {
        items.push({
          type: 'timesheet',
          id: `${row.id}-approved`,
          title: workerName,
          variant: 'approved',
          createdAt: row.approved_at,
        })
      }
    }

    return items
  } catch {
    return []
  }
}

async function fetchRecentVehicleCheckActivity(
  scope: CompanyActivityScope,
): Promise<DashboardRecentActivity[]> {
  try {
    const { data, error } = await requireSupabase()
      .from('vehicle_checks')
      .select(
        'id, created_at, status, overall_result, worker_id, drivers ( first_name, last_name ), vehicle_check_items ( result )',
      )
      .eq('status', 'Completed')
      .order('created_at', { ascending: false })
      .limit(RECENT_ACTIVITY_FETCH_LIMIT)

    logSupabaseQuery({
      service: 'dashboardService.fetchRecentVehicleCheckActivity',
      table: 'vehicle_checks',
      data,
      error,
    })

    if (error) return []

    return (data ?? [])
      .filter((row) => isWorkerInCompanyScope(row.worker_id, scope))
      .map((row) => {
        const itemRows = Array.isArray(row.vehicle_check_items)
          ? row.vehicle_check_items
          : row.vehicle_check_items
            ? [row.vehicle_check_items]
            : []

        return {
          type: 'vehicle_check' as const,
          id: row.id,
          title: formatWorkerName(
            normalizeJoinRow(
              row.drivers as DriverNameJoinRow | DriverNameJoinRow[] | null,
            ),
          ),
          createdAt: row.created_at,
          severity: getVehicleCheckActivitySeverity(row.overall_result, itemRows),
        }
      })
  } catch {
    return []
  }
}

async function fetchRecentDriverReportActivity(
  scope: CompanyActivityScope,
): Promise<DashboardRecentActivity[]> {
  try {
    let request = requireSupabase()
      .from('driver_reports')
      .select('id, created_at, updated_at, status, title, worker_id, company')
      .order('updated_at', { ascending: false })
      .limit(RECENT_ACTIVITY_FETCH_LIMIT)

    if (scope.companyName) {
      request = request.eq('company', scope.companyName)
    }

    const { data, error } = await request

    logSupabaseQuery({
      service: 'dashboardService.fetchRecentDriverReportActivity',
      table: 'driver_reports',
      data,
      error,
    })

    if (error) return []

    const scopedRows = (data ?? []).filter((row) =>
      isWorkerInCompanyScope(row.worker_id, scope),
    )

    const workerIds = scopedRows
      .map((row) => row.worker_id)
      .filter((id): id is string => Boolean(id))
    const workerNameById = new Map<string, string>()

    if (workerIds.length > 0) {
      const { data: workerRows } = await requireSupabase()
        .from('drivers')
        .select('id, first_name, last_name')
        .in('id', [...new Set(workerIds)])

      for (const worker of workerRows ?? []) {
        workerNameById.set(
          worker.id,
          formatWorkerName(worker as DriverNameJoinRow),
        )
      }
    }

    const items: DashboardRecentActivity[] = []

    for (const row of scopedRows) {
      const workerName = row.worker_id
        ? workerNameById.get(row.worker_id) ?? 'Worker'
        : 'Worker'
      const reportTitle = row.title?.trim() || 'Driver Report'

      items.push({
        type: 'driver_report',
        id: `${row.id}-created`,
        title: workerName,
        variant: 'created',
        reportTitle,
        createdAt: row.created_at,
      })

      if (
        isInProgressDriverReportStatus(row.status) &&
        hasMeaningfulStatusUpdate(row.created_at, row.updated_at)
      ) {
        items.push({
          type: 'driver_report',
          id: `${row.id}-in-progress`,
          title: workerName,
          variant: 'in_progress',
          reportTitle,
          createdAt: row.updated_at,
        })
      }
    }

    return items
  } catch {
    return []
  }
}

// Compliance-record tables are optional: they ship as migrations, but a given
// Supabase project may not have applied them yet. When that happens the REST
// call fails with a missing-table error (404). We remember that per table so we
// skip the query on later dashboard loads and never spam the console.
const missingComplianceTables = new Set<ComplianceRecordTable>()
const warnedMissingComplianceTables = new Set<ComplianceRecordTable>()

type ComplianceRecordTable =
  | 'worker_compliance_records'
  | 'vehicle_compliance_records'

type ComplianceDocumentRow = {
  id: string
  created_at: string
  document_name: string | null
  document_type: string | null
  file_url: string | null
  worker_id?: string | null
  vehicle_id?: string | null
}

function isMissingTableError(
  error: { message?: string; code?: string } | null,
): boolean {
  if (!error) return false

  const code = error.code ?? ''
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202') {
    return true
  }

  const message = (error.message ?? '').toLowerCase()
  return (
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('schema cache')
  )
}

// Returns null when the optional table is unavailable so callers can skip it
// entirely. Keeps the console quiet: no per-query dumps, and only a single
// clean development warning the first time a table is detected as missing.
async function fetchOptionalComplianceRows(
  table: ComplianceRecordTable,
  columns: string,
): Promise<ComplianceDocumentRow[] | null> {
  if (missingComplianceTables.has(table)) return null

  try {
    const { data, error } = await requireSupabase()
      .from(table)
      .select(columns)
      .not('file_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(RECENT_ACTIVITY_FETCH_LIMIT)

    if (error) {
      if (isMissingTableError(error)) {
        missingComplianceTables.add(table)

        if (import.meta.env.DEV && !warnedMissingComplianceTables.has(table)) {
          warnedMissingComplianceTables.add(table)
          const label =
            table === 'vehicle_compliance_records'
              ? 'Vehicle compliance'
              : 'Worker compliance'
          console.warn(`[dashboardService] ${label} activity source not available; skipping.`)
        }
      }

      return null
    }

    return (data ?? []) as unknown as ComplianceDocumentRow[]
  } catch {
    return null
  }
}

async function fetchRecentDocumentActivity(
  scope: CompanyActivityScope,
): Promise<DashboardRecentActivity[]> {
  try {
    const [workerDocs, vehicleDocs] = await Promise.all([
      fetchOptionalComplianceRows(
        'worker_compliance_records',
        'id, created_at, worker_id, document_name, document_type, file_url',
      ),
      fetchOptionalComplianceRows(
        'vehicle_compliance_records',
        'id, created_at, vehicle_id, document_name, document_type, file_url',
      ),
    ])

    const items: DashboardRecentActivity[] = []

    for (const row of workerDocs ?? []) {
      if (!isWorkerInCompanyScope(row.worker_id, scope)) continue

      const documentName =
        row.document_name?.trim() || row.document_type?.trim() || 'Document'

      items.push({
        type: 'document',
        id: `worker-doc-${row.id}`,
        title: documentName,
        documentName,
        workerId: row.worker_id ?? undefined,
        createdAt: row.created_at,
      })
    }

    for (const row of vehicleDocs ?? []) {
      const documentName =
        row.document_name?.trim() || row.document_type?.trim() || 'Document'

      items.push({
        type: 'document',
        id: `vehicle-doc-${row.id}`,
        title: documentName,
        documentName,
        vehicleId: row.vehicle_id ?? undefined,
        createdAt: row.created_at,
      })
    }

    return items
  } catch {
    return []
  }
}

async function fetchRecentConsumableActivity(
  scope: CompanyActivityScope,
): Promise<DashboardRecentActivity[]> {
  try {
    const { data, error } = await requireSupabase()
      .from('consumables')
      .select(
        'id, created_at, consumable_type, worker_id, vehicle_id, drivers ( first_name, last_name ), vehicles ( registration )',
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(RECENT_ACTIVITY_FETCH_LIMIT)

    logSupabaseQuery({
      service: 'dashboardService.fetchRecentConsumableActivity',
      table: 'consumables',
      data,
      error,
    })

    if (error) return []

    return (data ?? [])
      .filter((row) => isWorkerInCompanyScope(row.worker_id, scope))
      .map((row) => {
        const vehicle = normalizeJoinRow(
          row.vehicles as VehicleRegistrationJoinRow | VehicleRegistrationJoinRow[] | null,
        )

        return {
          type: 'consumable' as const,
          id: row.id,
          title: formatWorkerName(
            normalizeJoinRow(
              row.drivers as DriverNameJoinRow | DriverNameJoinRow[] | null,
            ),
          ),
          consumableType: row.consumable_type?.trim() || 'Consumable',
          vehicleReg: vehicle?.registration?.trim() || 'Vehicle',
          vehicleId: row.vehicle_id,
          createdAt: row.created_at,
        }
      })
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
      .limit(RECENT_ACTIVITY_FETCH_LIMIT)

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

function normalizeDriverReportStatus(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function isNewDriverReportStatus(value: string | null | undefined): boolean {
  const status = normalizeDriverReportStatus(value)
  return status === 'new' || status === 'open' || status === 'submitted'
}

function isInProgressDriverReportStatus(value: string | null | undefined): boolean {
  const status = normalizeDriverReportStatus(value)
  return status === 'in_progress' || status === 'inprogress'
}

function isClosedDriverReportStatus(value: string | null | undefined): boolean {
  const status = normalizeDriverReportStatus(value)
  return status === 'closed' || status === 'resolved'
}

async function fetchDriverReportsStatusCounts(
  scope: CompanyActivityScope,
): Promise<DashboardDriverReportsSummary> {
  try {
    let request = requireSupabase().from('driver_reports').select('status, company, worker_id')

    if (scope.companyName) {
      request = request.eq('company', scope.companyName)
    }

    const { data, error } = await request

    logSupabaseQuery({
      service: 'dashboardService.fetchDriverReportsStatusCounts',
      table: 'driver_reports',
      data,
      error,
    })

    if (error) return emptyDashboardStats.driverReports

    const rows = (data ?? []).filter((row) =>
      isWorkerInCompanyScope(row.worker_id, scope),
    )

    const newCount = rows.filter((row) => isNewDriverReportStatus(row.status)).length
    const inProgressCount = rows.filter((row) =>
      isInProgressDriverReportStatus(row.status),
    ).length

    return {
      open: newCount + inProgressCount,
      inProgress: inProgressCount,
      closed: rows.filter((row) => isClosedDriverReportStatus(row.status)).length,
    }
  } catch {
    return emptyDashboardStats.driverReports
  }
}

async function fetchHolidayStatusCounts(): Promise<DashboardHolidaySummary> {
  try {
    const { data, error } = await requireSupabase().from('holiday_requests').select('status')

    logSupabaseQuery({
      service: 'dashboardService.fetchHolidayStatusCounts',
      table: 'holiday_requests',
      data,
      error,
    })

    if (error) return emptyDashboardStats.holidayRequests

    const rows = data ?? []

    return {
      pending: rows.filter((row) => row.status === 'Pending').length,
      approved: rows.filter((row) => row.status === 'Approved').length,
      rejected: rows.filter((row) => row.status === 'Rejected').length,
    }
  } catch {
    return emptyDashboardStats.holidayRequests
  }
}

function computeVehicleChecksTodayFromRows(
  checks: TodayVehicleCheckRow[],
  scope: CompanyActivityScope,
): DashboardVehicleChecksToday {
  let completedToday = 0
  let issuesToday = 0
  let latestIssueAt: string | null = null

  for (const row of checks) {
    if (!isWorkerInCompanyScope(row.worker_id, scope)) continue

    if (row.status === 'Completed') {
      completedToday += 1
    }

    const itemRows = normalizeVehicleCheckItemRows(row.vehicle_check_items)

    if (vehicleCheckHasIssue(row.overall_result, itemRows)) {
      issuesToday += 1

      const rowLatestAt = pickLatestIsoTimestamp(row.updated_at, row.created_at)
      if (!latestIssueAt || rowLatestAt > latestIssueAt) {
        latestIssueAt = rowLatestAt
      }
    }
  }

  return { completedToday, issuesToday, latestIssueAt }
}

function pickLatestIsoTimestamp(
  updatedAt: string | null | undefined,
  createdAt: string | null | undefined,
): string {
  const updated = updatedAt ?? ''
  const created = createdAt ?? ''

  if (updated && created) {
    return updated >= created ? updated : created
  }

  return updated || created || new Date(0).toISOString()
}

type TodayVehicleCheckRow = {
  vehicle_id: string
  worker_id: string
  status: string
  overall_result: string
  created_at: string
  updated_at: string
  vehicle_check_items:
    | { result: string }[]
    | { result: string }
    | null
}

function normalizeVehicleCheckItemRows(
  itemResults: TodayVehicleCheckRow['vehicle_check_items'],
): { result: string }[] {
  if (!itemResults) return []
  return Array.isArray(itemResults) ? itemResults : [itemResults]
}

async function fetchTodayVehicleCheckRows(
  inspectionDate: string,
): Promise<TodayVehicleCheckRow[]> {
  const { data, error } = await requireSupabase()
    .from('vehicle_checks')
    .select(
      'vehicle_id, worker_id, status, overall_result, created_at, updated_at, vehicle_check_items ( result )',
    )
    .eq('inspection_date', inspectionDate)

  logSupabaseQuery({
    service: 'dashboardService.fetchTodayVehicleCheckRows',
    table: 'vehicle_checks',
    data,
    error,
  })

  if (error) return []
  return (data ?? []) as TodayVehicleCheckRow[]
}

function getActiveVehicleIdsForDailyChecks(vehicles: Vehicle[], today: string): Set<string> {
  const activeVehicleIds = new Set<string>()

  for (const vehicle of vehicles) {
    const status = getEffectiveStatusToday(vehicle, today)
    if (!UNAVAILABLE_STATUSES.includes(status)) {
      activeVehicleIds.add(vehicle.id)
    }
  }

  return activeVehicleIds
}

function computeDailyVehicleChecksStats(
  vehicles: Vehicle[],
  checks: TodayVehicleCheckRow[],
  scope: CompanyActivityScope,
  companyToday: string,
): DashboardDailyVehicleChecksStats {
  const activeVehicleIds = getActiveVehicleIdsForDailyChecks(vehicles, companyToday)
  const totalVehicles = activeVehicleIds.size

  if (totalVehicles === 0) {
    return {
      completedOk: 0,
      issuesFailed: 0,
      notChecked: 0,
      totalVehicles: 0,
    }
  }

  const vehicleOutcomes = new Map<string, 'ok' | 'issue'>()

  for (const row of checks) {
    if (!isWorkerInCompanyScope(row.worker_id, scope)) continue
    if (!activeVehicleIds.has(row.vehicle_id)) continue
    if (row.status !== 'Completed') continue

    const itemRows = normalizeVehicleCheckItemRows(row.vehicle_check_items)
    const hasIssue = vehicleCheckHasIssue(row.overall_result, itemRows)

    if (hasIssue) {
      vehicleOutcomes.set(row.vehicle_id, 'issue')
      continue
    }

    if (!vehicleOutcomes.has(row.vehicle_id)) {
      vehicleOutcomes.set(row.vehicle_id, 'ok')
    }
  }

  let completedOk = 0
  let issuesFailed = 0

  for (const vehicleId of activeVehicleIds) {
    const outcome = vehicleOutcomes.get(vehicleId)
    if (outcome === 'issue') {
      issuesFailed += 1
    } else if (outcome === 'ok') {
      completedOk += 1
    }
  }

  return {
    completedOk,
    issuesFailed,
    notChecked: totalVehicles - completedOk - issuesFailed,
    totalVehicles,
  }
}

function buildConsumablesTypeTiles(
  typeSummaries: ReturnType<typeof computeMonthlyConsumablesSummary>['typeSummaries'],
): DashboardConsumablesTypeTile[] {
  const byType = new Map<
    ConsumableType,
    { totalQuantity: number; unit: ConsumableUnit }
  >()

  for (const row of typeSummaries) {
    if (row.totalQuantity <= 0) continue

    const existing = byType.get(row.consumableType)
    if (!existing) {
      byType.set(row.consumableType, {
        totalQuantity: row.totalQuantity,
        unit: row.unit,
      })
      continue
    }

    if (existing.unit === row.unit) {
      existing.totalQuantity += row.totalQuantity
    } else if (row.totalQuantity > existing.totalQuantity) {
      byType.set(row.consumableType, {
        totalQuantity: row.totalQuantity,
        unit: row.unit,
      })
    }
  }

  return [...byType.entries()]
    .map(([consumableType, value]) => ({
      consumableType,
      unit: value.unit,
      totalQuantity: value.totalQuantity,
    }))
    .sort((first, second) => second.totalQuantity - first.totalQuantity)
}

async function fetchConsumablesOverview(): Promise<DashboardConsumablesOverview> {
  try {
    const now = new Date()
    const result = await fetchConsumablesMonthlySummary({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    })
    const summary = computeMonthlyConsumablesSummary(result.records)

    return {
      totalEntries: summary.totalEntries,
      totalQuantityLitres: summary.totalLitres,
      totalCost: summary.totalCost,
      vehiclesUsed: summary.vehiclesWithUsage,
      typeTiles: buildConsumablesTypeTiles(summary.typeSummaries),
    }
  } catch {
    return emptyDashboardStats.consumablesOverview
  }
}

async function fetchTimesheetOverview(): Promise<DashboardTimesheetOverview> {
  try {
    const weekStart = getDefaultWeekStartMonday()
    const weekDisplay = formatTimesheetWeekDisplay(weekStart, getTimesheetWeekSettings())
    const stats = await fetchTimesheetWeekStats(weekStart)

    return {
      weekTitle: weekDisplay.weekTitle,
      weekRangeLabel: weekDisplay.weekRangeLabel,
      drafts: stats.drafts,
      submitted: stats.pendingApproval,
      approved: stats.approved,
      rejected: stats.rejected,
    }
  } catch {
    return emptyDashboardStats.timesheetOverview
  }
}

export function getDashboardActivityRoute(activity: DashboardRecentActivity): string | null {
  switch (activity.type) {
    case 'worker':
      return `/drivers/${activity.id}`
    case 'vehicle':
      return `/vehicles/${activity.id}`
    case 'availability':
      return activity.vehicleId ? `/vehicles/${activity.vehicleId}` : null
    case 'holiday_request':
      return '/admin/holidays'
    case 'timesheet':
      return '/admin/timesheets'
    case 'vehicle_check':
      return '/admin/vehicle-checks'
    case 'driver_report':
      return '/admin/driver-reports'
    case 'document':
      if (activity.workerId) {
        return `/compliance/workers/${activity.workerId}`
      }
      if (activity.vehicleId) {
        return `/compliance/vehicles/${activity.vehicleId}`
      }
      return '/documents'
    case 'consumable':
      if (activity.vehicleId) {
        return `/consumables?vehicle=${activity.vehicleId}`
      }
      return '/consumables'
  }
}

function enrichActivityPaths(activities: DashboardRecentActivity[]): DashboardRecentActivity[] {
  return activities.map((activity) => {
    const path = getDashboardActivityRoute(activity)
    return path ? { ...activity, path } : activity
  })
}

function mergeRecentActivity(
  ...sources: DashboardRecentActivity[][]
): DashboardRecentActivity[] {
  return sources
    .flat()
    .sort(
      (firstActivity, secondActivity) =>
        new Date(secondActivity.createdAt).getTime() -
        new Date(firstActivity.createdAt).getTime(),
    )
    .slice(0, RECENT_ACTIVITY_DISPLAY_LIMIT)
}

async function fetchAllRecentActivity(
  vehicleRegistrations: Map<string, string>,
): Promise<DashboardRecentActivity[]> {
  const scope = await fetchCompanyActivityScope()

  const [
    workers,
    vehicles,
    holidayActivity,
    timesheetActivity,
    vehicleCheckActivity,
    driverReportActivity,
    documentActivity,
    consumableActivity,
    availabilityEvents,
  ] = await Promise.all([
    fetchRecentWorkers(scope),
    fetchRecentVehicles(),
    fetchRecentHolidayActivity(scope),
    fetchRecentTimesheetActivity(scope),
    fetchRecentVehicleCheckActivity(scope),
    fetchRecentDriverReportActivity(scope),
    fetchRecentDocumentActivity(scope),
    fetchRecentConsumableActivity(scope),
    fetchRecentAvailabilityEvents(vehicleRegistrations),
  ])

  return enrichActivityPaths(
    mergeRecentActivity(
      workers,
      vehicles,
      holidayActivity,
      timesheetActivity,
      vehicleCheckActivity,
      driverReportActivity,
      documentActivity,
      consumableActivity,
      availabilityEvents,
    ),
  )
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    console.log('[dashboardService.fetchDashboardStats] loading dashboard counts')

    const companyScope = await fetchCompanyActivityScope()

    const [
      workers,
      workingToday,
      driverComplianceRows,
      vehicleDocumentRows,
      dashboardVehicles,
      holidayRequests,
      timesheetOverview,
      driverReports,
      consumablesOverview,
    ] = await Promise.all([
      countTableRows('drivers'),
      countTableRows('drivers', { column: 'status', value: 'Working' }),
      fetchDriverComplianceRows(),
      fetchVehicleDocumentRows(),
      fetchDashboardVehicles(),
      fetchHolidayStatusCounts(),
      fetchTimesheetOverview(),
      fetchDriverReportsStatusCounts(companyScope),
      fetchConsumablesOverview(),
    ])

    const [vehicleChecksToday, dailyVehicleChecksStats] = await (async () => {
      const companyToday = getCompanyTodayIsoDate(companyScope.timezone)
      const todayChecks = await fetchTodayVehicleCheckRows(companyToday)
      return [
        computeVehicleChecksTodayFromRows(todayChecks, companyScope),
        computeDailyVehicleChecksStats(
          dashboardVehicles,
          todayChecks,
          companyScope,
          companyToday,
        ),
      ] as const
    })()

    const vehicleRegistrations = new Map(
      dashboardVehicles.map((vehicle) => [vehicle.id, vehicle.registration]),
    )
    const recentActivity = await fetchAllRecentActivity(vehicleRegistrations)

    const vehicleStatusCounts = countVehicleStatusesToday(dashboardVehicles)
    const complianceAlerts =
      countDriverComplianceAlerts(driverComplianceRows) +
      countVehicleComplianceAlerts(vehicleDocumentRows)

    const stats: DashboardStats = {
      workers,
      workingToday,
      vehicles: dashboardVehicles.length,
      availableVehicles: vehicleStatusCounts.availableVehicles,
      offRoadOrOutOfService: vehicleStatusCounts.offRoadOrOutOfService,
      complianceAlerts,
      vehicleChecksToday,
      dailyVehicleChecksStats,
      availabilityAlerts: {
        offRoadToday: vehicleStatusCounts.offRoadToday,
        maintenanceToday: vehicleStatusCounts.maintenanceToday,
        outOfServiceToday: vehicleStatusCounts.outOfServiceToday,
        goingOffRoadSoon: countUpcomingAvailabilityEvents(dashboardVehicles),
        documentsExpiringSoon: countVehicleDocumentsExpiringSoon(
          vehicleDocumentRows,
        ),
      },
      timesheetOverview,
      fleetStatus: {
        available: vehicleStatusCounts.availableVehicles,
        offRoad: vehicleStatusCounts.offRoadToday + vehicleStatusCounts.outOfServiceToday,
        maintenanceDue: vehicleStatusCounts.maintenanceToday,
      },
      holidayRequests,
      driverReports,
      consumablesOverview,
      recentActivity,
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

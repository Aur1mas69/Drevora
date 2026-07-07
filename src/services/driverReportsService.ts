import type {
  CreateDriverReportInput,
  DriverReport,
  DriverReportPriority,
  DriverReportStatus,
  UpdateDriverReportInput,
} from '@/lib/driverReportTypes'
import { getGlobalCompanySettings } from '@/lib/companySettingsGlobals'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'

type WorkerLookupRow = { id: string; first_name: string; last_name: string }
type VehicleLookupRow = { id: string; registration: string; fleet_number: string | null }

type DriverReportRow = {
  id: string
  company: string | null
  worker_id: string | null
  vehicle_id: string | null
  title: string
  report_type: string
  priority: string
  status: string
  description: string | null
  location: string | null
  issue_datetime: string | null
  office_notes: string | null
  attachment_url: string | null
  attachment_path: string | null
  created_at: string
  updated_at: string
}

const reportSelect = `
  id,
  company,
  worker_id,
  vehicle_id,
  title,
  report_type,
  priority,
  status,
  description,
  location,
  issue_datetime,
  office_notes,
  attachment_url,
  attachment_path,
  created_at,
  updated_at
`

export class DriverReportsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DriverReportsServiceError'
  }
}

function resolveCompanyScope(): string | null {
  return getGlobalCompanySettings()?.name?.trim() || null
}

function normalizeStatus(value: string): DriverReportStatus {
  if (value === 'New' || value === 'In Progress' || value === 'Closed') return value
  return 'New'
}

function normalizePriority(value: string): DriverReportPriority {
  if (value === 'Low' || value === 'Medium' || value === 'High' || value === 'Critical') {
    return value
  }
  return 'Medium'
}

function mapVehicleLabel(vehicle: VehicleLookupRow): string {
  return [vehicle.registration, vehicle.fleet_number].filter(Boolean).join(' · ')
}

function mapRow(
  row: DriverReportRow,
  workerNames: Map<string, string>,
  vehicleLabels: Map<string, string>,
): DriverReport {
  return {
    id: row.id,
    company: row.company,
    workerId: row.worker_id,
    workerName: row.worker_id ? workerNames.get(row.worker_id) ?? null : null,
    vehicleId: row.vehicle_id,
    vehicleLabel: row.vehicle_id ? vehicleLabels.get(row.vehicle_id) ?? null : null,
    title: row.title,
    reportType: row.report_type,
    priority: normalizePriority(row.priority),
    status: normalizeStatus(row.status),
    description: row.description,
    location: row.location,
    issueDatetime: row.issue_datetime,
    officeNotes: row.office_notes,
    attachmentUrl: row.attachment_url,
    attachmentPath: row.attachment_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function fetchWorkerNameMap(workerIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(workerIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await requireSupabase()
    .from('drivers')
    .select('id, first_name, last_name')
    .in('id', uniqueIds)

  if (error) throw new DriverReportsServiceError(error.message)

  return new Map(
    (data ?? []).map((row) => {
      const worker = row as WorkerLookupRow
      return [worker.id, `${worker.first_name} ${worker.last_name}`.trim()]
    }),
  )
}

async function fetchVehicleLabelMap(vehicleIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(vehicleIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await requireSupabase()
    .from('vehicles')
    .select('id, registration, fleet_number')
    .in('id', uniqueIds)

  if (error) throw new DriverReportsServiceError(error.message)

  return new Map(
    (data ?? []).map((row) => {
      const vehicle = row as VehicleLookupRow
      return [vehicle.id, mapVehicleLabel(vehicle)]
    }),
  )
}

async function mapReportRows(rows: DriverReportRow[]): Promise<DriverReport[]> {
  const workerIds = rows.map((row) => row.worker_id).filter((id): id is string => Boolean(id))
  const vehicleIds = rows.map((row) => row.vehicle_id).filter((id): id is string => Boolean(id))

  const [workerNames, vehicleLabels] = await Promise.all([
    fetchWorkerNameMap(workerIds),
    fetchVehicleLabelMap(vehicleIds),
  ])

  return rows.map((row) => mapRow(row, workerNames, vehicleLabels))
}

function isMissingTableError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('driver_reports') &&
    (normalized.includes('does not exist') ||
      normalized.includes('could not find the table') ||
      normalized.includes('schema cache'))
  )
}

function toDbPayload(
  input: CreateDriverReportInput | UpdateDriverReportInput,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if (input.title !== undefined) payload.title = input.title.trim()
  if (input.reportType !== undefined) payload.report_type = input.reportType.trim()
  if (input.workerId !== undefined) payload.worker_id = input.workerId || null
  if (input.vehicleId !== undefined) payload.vehicle_id = input.vehicleId || null
  if (input.priority !== undefined) payload.priority = input.priority
  if (input.status !== undefined) payload.status = input.status
  if (input.description !== undefined) payload.description = input.description?.trim() || null
  if (input.location !== undefined) payload.location = input.location?.trim() || null
  if (input.issueDatetime !== undefined) payload.issue_datetime = input.issueDatetime || null
  if (input.officeNotes !== undefined) payload.office_notes = input.officeNotes?.trim() || null
  if (input.attachmentUrl !== undefined) payload.attachment_url = input.attachmentUrl?.trim() || null
  if (input.attachmentPath !== undefined) {
    payload.attachment_path = input.attachmentPath?.trim() || null
  }

  return payload
}

export async function fetchDriverReports(): Promise<DriverReport[]> {
  let request = requireSupabase().from('driver_reports').select(reportSelect)

  const company = resolveCompanyScope()
  if (company) request = request.eq('company', company)

  const { data, error } = await request
    .order('created_at', { ascending: false })
    .order('title', { ascending: true })

  logSupabaseQuery({
    service: 'driverReportsService.fetchDriverReports',
    table: 'driver_reports',
    data,
    error,
  })

  if (error) {
    if (isMissingTableError(error.message)) {
      throw new DriverReportsServiceError(
        'Driver reports table is not available yet. Run the driver reports migration on your Supabase project.',
      )
    }
    throw new DriverReportsServiceError(error.message)
  }

  return mapReportRows((data ?? []) as unknown as DriverReportRow[])
}

export async function fetchDriverReportsForVehicle(vehicleId: string): Promise<DriverReport[]> {
  let request = requireSupabase()
    .from('driver_reports')
    .select(reportSelect)
    .eq('vehicle_id', vehicleId)

  const company = resolveCompanyScope()
  if (company) request = request.eq('company', company)

  const { data, error } = await request
    .order('created_at', { ascending: false })
    .order('title', { ascending: true })

  logSupabaseQuery({
    service: 'driverReportsService.fetchDriverReportsForVehicle',
    table: 'driver_reports',
    data,
    error,
  })

  if (error) {
    if (isMissingTableError(error.message)) {
      throw new DriverReportsServiceError(
        'Driver reports table is not available yet. Run the driver reports migration on your Supabase project.',
      )
    }
    throw new DriverReportsServiceError(error.message)
  }

  return mapReportRows((data ?? []) as unknown as DriverReportRow[])
}

export async function createDriverReport(input: CreateDriverReportInput): Promise<DriverReport> {
  const payload = {
    company: resolveCompanyScope(),
    ...toDbPayload(input),
    status: input.status ?? 'New',
    priority: input.priority ?? 'Medium',
  }

  const { data, error } = await requireSupabase()
    .from('driver_reports')
    .insert(payload)
    .select(reportSelect)
    .single()

  if (error) throw new DriverReportsServiceError(error.message)

  const rows = await mapReportRows([data as unknown as DriverReportRow])
  return rows[0]
}

export async function updateDriverReport(
  id: string,
  input: UpdateDriverReportInput,
): Promise<DriverReport> {
  const payload: Record<string, unknown> = {
    ...toDbPayload(input),
    updated_at: new Date().toISOString(),
  }

  let request = requireSupabase().from('driver_reports').update(payload).eq('id', id)

  const company = resolveCompanyScope()
  if (company) request = request.eq('company', company)

  const { data, error } = await request.select(reportSelect).single()

  if (error) throw new DriverReportsServiceError(error.message)

  const rows = await mapReportRows([data as unknown as DriverReportRow])
  return rows[0]
}

export async function deleteDriverReport(id: string): Promise<void> {
  let request = requireSupabase().from('driver_reports').delete().eq('id', id)

  const company = resolveCompanyScope()
  if (company) request = request.eq('company', company)

  const { error } = await request
  if (error) throw new DriverReportsServiceError(error.message)
}

export const driverReportsService = {
  fetchDriverReports,
  fetchDriverReportsForVehicle,
  createDriverReport,
  updateDriverReport,
  deleteDriverReport,
}

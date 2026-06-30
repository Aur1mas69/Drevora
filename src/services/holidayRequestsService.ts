import { calculateInclusiveCalendarDays, computeHolidaySummaryStats } from '@/lib/holidayRequestUtils'
import type {
  CreateHolidayRequestInput,
  HolidayRequest,
  HolidayRequestStatus,
  HolidayRequestsPageResult,
  HolidayRequestsQuery,
  HolidayRequestSummaryStats,
  UpdateHolidayRequestInput,
} from '@/lib/holidayRequestTypes'
import { DEFAULT_HOLIDAY_PAGE_SIZE } from '@/lib/holidayRequestTypes'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import type { DriverRole } from '@/services/driversService'

type DriverJoinRow = {
  first_name: string
  last_name: string
  role: string | null
}

type HolidayRequestRow = {
  id: string
  created_at: string
  updated_at: string
  worker_id: string
  start_date: string
  end_date: string
  total_days: number | string
  reason: string | null
  status: string
  manager_note: string | null
  drivers: DriverJoinRow | DriverJoinRow[] | null
}

const holidayRequestSelect = `
  id,
  created_at,
  updated_at,
  worker_id,
  start_date,
  end_date,
  total_days,
  reason,
  status,
  manager_note,
  drivers ( first_name, last_name, role )
`

export class HolidayRequestsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HolidayRequestsServiceError'
  }
}

function normalizeJoinRow<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function normalizeStatus(value: string | null | undefined): HolidayRequestStatus {
  switch (value) {
    case 'Approved':
    case 'Rejected':
    case 'Cancelled':
      return value
    default:
      return 'Pending'
  }
}

function mapRow(row: HolidayRequestRow): HolidayRequest {
  const driver = normalizeJoinRow(row.drivers)
  const workerName = driver
    ? `${driver.first_name} ${driver.last_name}`.trim()
    : 'Unknown worker'

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workerId: row.worker_id,
    workerName,
    workerRole: (driver?.role as DriverRole | null) ?? null,
    startDate: row.start_date,
    endDate: row.end_date,
    totalDays: Number(row.total_days) || 0,
    reason: row.reason,
    status: normalizeStatus(row.status),
    managerNote: row.manager_note,
  }
}

async function fetchHolidayRequestStats(): Promise<HolidayRequestSummaryStats> {
  const { data, error } = await requireSupabase()
    .from('holiday_requests')
    .select('status, start_date, end_date, worker_id, updated_at')

  logSupabaseQuery({
    service: 'holidayRequestsService.fetchHolidayRequestStats',
    table: 'holiday_requests',
    data,
    error,
  })

  if (error) {
    throw new HolidayRequestsServiceError(error.message)
  }

  return computeHolidaySummaryStats(
    (data ?? []).map((row) => ({
      status: normalizeStatus(row.status),
      startDate: row.start_date,
      endDate: row.end_date,
      workerId: row.worker_id,
      updatedAt: row.updated_at,
    })),
  )
}

export async function fetchHolidayRequests(
  query: HolidayRequestsQuery = {},
): Promise<HolidayRequestsPageResult> {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = query.pageSize ?? DEFAULT_HOLIDAY_PAGE_SIZE
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let request = requireSupabase()
    .from('holiday_requests')
    .select(holidayRequestSelect, { count: 'exact' })

  if (query.status && query.status !== 'all') {
    request = request.eq('status', query.status)
  }

  if (query.workerId && query.workerId !== 'all') {
    request = request.eq('worker_id', query.workerId)
  }

  if (query.dateFrom) {
    request = request.gte('end_date', query.dateFrom)
  }

  if (query.dateTo) {
    request = request.lte('start_date', query.dateTo)
  }

  const search = query.search?.trim()
  if (search) {
    request = request.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%`,
      { referencedTable: 'drivers' },
    )
  }

  request = request
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  const { data, error, count } = await request

  logSupabaseQuery({
    service: 'holidayRequestsService.fetchHolidayRequests',
    table: 'holiday_requests',
    data,
    error,
    count,
  })

  if (error) {
    throw new HolidayRequestsServiceError(error.message)
  }

  const rows = (data ?? []) as unknown as HolidayRequestRow[]
  const stats = await fetchHolidayRequestStats()

  return {
    items: rows.map(mapRow),
    totalCount: count ?? rows.length,
    page,
    pageSize,
    stats,
  }
}

export async function fetchHolidayRequestById(id: string): Promise<HolidayRequest | null> {
  const { data, error } = await requireSupabase()
    .from('holiday_requests')
    .select(holidayRequestSelect)
    .eq('id', id)
    .maybeSingle()

  logSupabaseQuery({
    service: 'holidayRequestsService.fetchHolidayRequestById',
    table: 'holiday_requests',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new HolidayRequestsServiceError(error.message)
  }

  if (!data) return null
  return mapRow(data as unknown as HolidayRequestRow)
}

export async function createHolidayRequest(
  input: CreateHolidayRequestInput,
): Promise<HolidayRequest> {
  const totalDays = calculateInclusiveCalendarDays(input.startDate, input.endDate)
  if (totalDays <= 0) {
    throw new HolidayRequestsServiceError('End date must be on or after start date.')
  }

  const { data, error } = await requireSupabase()
    .from('holiday_requests')
    .insert({
      worker_id: input.workerId,
      start_date: input.startDate,
      end_date: input.endDate,
      total_days: totalDays,
      reason: input.reason?.trim() || null,
      status: 'Pending',
    })
    .select(holidayRequestSelect)
    .single()

  logSupabaseQuery({
    service: 'holidayRequestsService.createHolidayRequest',
    table: 'holiday_requests',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new HolidayRequestsServiceError(error.message)
  }

  return mapRow(data as unknown as HolidayRequestRow)
}

export async function updateHolidayRequest(
  id: string,
  input: UpdateHolidayRequestInput,
): Promise<HolidayRequest> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.startDate !== undefined) patch.start_date = input.startDate
  if (input.endDate !== undefined) patch.end_date = input.endDate
  if (input.reason !== undefined) patch.reason = input.reason?.trim() || null
  if (input.status !== undefined) patch.status = input.status
  if (input.managerNote !== undefined) patch.manager_note = input.managerNote?.trim() || null

  if (input.startDate !== undefined || input.endDate !== undefined) {
    const { data: existing, error: existingError } = await requireSupabase()
      .from('holiday_requests')
      .select('start_date, end_date')
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      throw new HolidayRequestsServiceError(existingError.message)
    }

    if (!existing) {
      throw new HolidayRequestsServiceError('Holiday request not found.')
    }

    const startDate = input.startDate ?? existing.start_date
    const endDate = input.endDate ?? existing.end_date
    const totalDays = calculateInclusiveCalendarDays(startDate, endDate)

    if (totalDays <= 0) {
      throw new HolidayRequestsServiceError('End date must be on or after start date.')
    }

    patch.total_days = totalDays
  }

  const { data, error } = await requireSupabase()
    .from('holiday_requests')
    .update(patch)
    .eq('id', id)
    .select(holidayRequestSelect)
    .single()

  logSupabaseQuery({
    service: 'holidayRequestsService.updateHolidayRequest',
    table: 'holiday_requests',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new HolidayRequestsServiceError(error.message)
  }

  return mapRow(data as unknown as HolidayRequestRow)
}

export async function deleteHolidayRequest(id: string): Promise<void> {
  const { error } = await requireSupabase().from('holiday_requests').delete().eq('id', id)

  logSupabaseQuery({
    service: 'holidayRequestsService.deleteHolidayRequest',
    table: 'holiday_requests',
    data: error ? [] : [{ id }],
    error,
  })

  if (error) {
    throw new HolidayRequestsServiceError(error.message)
  }
}

export async function approveHolidayRequest(
  id: string,
  managerNote?: string | null,
): Promise<HolidayRequest> {
  return updateHolidayRequest(id, {
    status: 'Approved',
    managerNote: managerNote ?? null,
  })
}

export async function rejectHolidayRequest(
  id: string,
  managerNote?: string | null,
): Promise<HolidayRequest> {
  return updateHolidayRequest(id, {
    status: 'Rejected',
    managerNote: managerNote ?? null,
  })
}

export const holidayRequestsService = {
  fetchHolidayRequests,
  fetchHolidayRequestById,
  createHolidayRequest,
  updateHolidayRequest,
  deleteHolidayRequest,
  approveHolidayRequest,
  rejectHolidayRequest,
}

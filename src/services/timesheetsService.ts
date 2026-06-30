import { getSetting } from '@/lib/companySettingsGlobals'
import {
  buildWeekDates,
  calculateEntryTotalMinutes,
  computeTimesheetSummaryStats,
  formatWeekLabel,
  normalizeWeekStartForCompany,
  sortTimesheetListItems,
  summarizeTimesheetEntries,
  summarizeTimesheetEntriesFromTotals,
} from '@/lib/timesheetUtils'
import type {
  BulkCreateTimesheetsInput,
  CreateTimesheetInput,
  Timesheet,
  TimesheetEntry,
  TimesheetEntryInput,
  TimesheetListItem,
  TimesheetsPageResult,
  TimesheetsQuery,
  TimesheetStatus,
  UpdateTimesheetInput,
} from '@/lib/timesheetTypes'
import { DEFAULT_TIMESHEET_PAGE_SIZE } from '@/lib/timesheetTypes'
import { supabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import type { DriverRole } from '@/services/driversService'

type DriverJoinRow = {
  first_name: string
  last_name: string
  role: string | null
}

type VehicleJoinRow = {
  registration: string
  fleet_number: string | null
}

type TimesheetEntryRow = {
  id: string
  timesheet_id: string
  day_date: string
  start_time: string | null
  break_minutes: number | null
  finish_time: string | null
  total_minutes: number | null
  overtime_minutes: number | null
  payroll_minutes: number | null
}

type TimesheetRow = {
  id: string
  created_at: string
  updated_at: string
  driver_id: string
  vehicle_id: string | null
  week_start: string
  status: string
  notes: string | null
  drivers: DriverJoinRow | DriverJoinRow[] | null
  vehicles: VehicleJoinRow | VehicleJoinRow[] | null
  timesheet_entries?: TimesheetEntryRow[]
}

type EntryTotalsRow = {
  timesheet_id: string
  total_minutes: number | null
  break_minutes: number | null
  overtime_minutes: number | null
  payroll_minutes: number | null
}

const timesheetEntrySelect = `
    id,
    timesheet_id,
    day_date,
    start_time,
    break_minutes,
    finish_time,
    total_minutes,
    overtime_minutes
  `

const timesheetEntrySelectCore = `
    id,
    timesheet_id,
    day_date,
    start_time,
    break_minutes,
    finish_time,
    total_minutes
  `

const timesheetDetailSelect = `
  id,
  created_at,
  updated_at,
  driver_id,
  vehicle_id,
  week_start,
  status,
  notes,
  drivers ( first_name, last_name, role ),
  vehicles ( registration, fleet_number ),
  timesheet_entries (${timesheetEntrySelect})
`

const timesheetDetailSelectCore = `
  id,
  created_at,
  updated_at,
  driver_id,
  vehicle_id,
  week_start,
  status,
  notes,
  drivers ( first_name, last_name, role ),
  vehicles ( registration, fleet_number ),
  timesheet_entries (${timesheetEntrySelectCore})
`

const timesheetListSelect = `
  id,
  created_at,
  updated_at,
  driver_id,
  vehicle_id,
  week_start,
  status,
  notes,
  drivers ( first_name, last_name, role ),
  vehicles ( registration, fleet_number )
`

export class TimesheetsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimesheetsServiceError'
  }
}

function normalizeJoinRow<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function normalizeTime(value: string | null | undefined): string | null {
  if (!value) return null
  return value.slice(0, 5)
}

function normalizeStatus(value: string | null | undefined): TimesheetStatus {
  switch (value) {
    case 'Submitted':
    case 'Approved':
    case 'Rejected':
      return value
    case 'Draft':
    default:
      return 'Draft'
  }
}

function normalizeDriverRole(value: string | null | undefined): DriverRole | null {
  if (!value) return null
  return value as DriverRole
}

function mapEntryRow(row: TimesheetEntryRow): TimesheetEntry {
  const totalMinutes = row.total_minutes ?? 0
  const overtimeMinutes = row.overtime_minutes ?? 0

  return {
    id: row.id,
    timesheetId: row.timesheet_id,
    dayDate: row.day_date,
    startTime: normalizeTime(row.start_time),
    breakMinutes: row.break_minutes ?? 0,
    finishTime: normalizeTime(row.finish_time),
    totalMinutes,
    overtimeMinutes,
  }
}

function mapListRow(
  row: TimesheetRow,
  totals?: {
    workedMinutes: number
    breakMinutes: number
    overtimeMinutes: number
  },
): TimesheetListItem {
  const driver = normalizeJoinRow(row.drivers)
  const vehicle = normalizeJoinRow(row.vehicles)
  const driverName = driver
    ? `${driver.first_name} ${driver.last_name}`.trim()
    : 'Unknown worker'

  const summary = totals
    ? summarizeTimesheetEntriesFromTotals(totals)
    : { workedHours: 0, breakHours: 0, overtimeHours: 0 }

  return {
    id: row.id,
    driverId: row.driver_id,
    vehicleId: row.vehicle_id,
    weekStart: row.week_start,
    weekLabel: formatWeekLabel(row.week_start),
    status: normalizeStatus(row.status),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    driverName,
    driverRole: normalizeDriverRole(driver?.role ?? null),
    fleetNo: vehicle?.fleet_number?.trim() || '—',
    vehicleRegistration: vehicle?.registration?.trim() || '—',
    ...summary,
  }
}

function mapTimesheetRow(row: TimesheetRow): Timesheet {
  const entries = (row.timesheet_entries ?? [])
    .map(mapEntryRow)
    .sort((a, b) => a.dayDate.localeCompare(b.dayDate))

  const listItem = mapListRow(row)
  const totals = summarizeTimesheetEntries(entries)

  return {
    ...listItem,
    entries,
    ...totals,
  }
}

function mapInsertTime(value: string | null): string | null {
  if (!value?.trim()) return null
  return `${value.trim().slice(0, 5)}:00`
}

function isMissingTimesheetEntryColumnError(
  error: { message?: string; code?: string } | null,
): boolean {
  if (!error?.message) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('overtime_minutes') ||
    error.code === '42703'
  )
}

async function fetchEntryTotalsByTimesheetIds(
  timesheetIds: string[],
): Promise<
  Map<
    string,
    {
      workedMinutes: number
      breakMinutes: number
      overtimeMinutes: number
    }
  >
> {
  const totals = new Map<
    string,
    {
      workedMinutes: number
      breakMinutes: number
      overtimeMinutes: number
    }
  >()
  if (timesheetIds.length === 0) return totals

  const { data, error } = await supabase
    .from('timesheet_entries')
    .select('timesheet_id, total_minutes, break_minutes, overtime_minutes')
    .in('timesheet_id', timesheetIds)

  logSupabaseQuery({
    service: 'timesheetsService.fetchEntryTotalsByTimesheetIds',
    table: 'timesheet_entries',
    data,
    error,
  })

  if (error) {
    throw new TimesheetsServiceError(error.message)
  }

  for (const row of (data ?? []) as EntryTotalsRow[]) {
    const current = totals.get(row.timesheet_id) ?? {
      workedMinutes: 0,
      breakMinutes: 0,
      overtimeMinutes: 0,
    }
    const totalMinutes = row.total_minutes ?? 0
    const overtimeMinutes = row.overtime_minutes ?? 0
    current.workedMinutes += totalMinutes
    current.breakMinutes += row.break_minutes ?? 0
    current.overtimeMinutes += overtimeMinutes
    totals.set(row.timesheet_id, current)
  }

  return totals
}

function applyListTotals(
  items: TimesheetListItem[],
  totalsMap: Map<
    string,
    {
      workedMinutes: number
      breakMinutes: number
      overtimeMinutes: number
    }
  >,
): TimesheetListItem[] {
  return items.map((item) => {
    const totals = totalsMap.get(item.id)
    if (!totals) return item

    const summary = summarizeTimesheetEntriesFromTotals(totals)
    return { ...item, ...summary }
  })
}

function buildListSelect(query: TimesheetsQuery): string {
  const needsDriverInnerJoin =
    Boolean(query.search?.trim()) || (query.role && query.role !== 'all')

  if (needsDriverInnerJoin) {
    return timesheetListSelect.replace(
      'drivers ( first_name, last_name, role )',
      'drivers!inner ( first_name, last_name, role )',
    )
  }

  return timesheetListSelect
}

async function fetchTimesheetRowById(id: string): Promise<Timesheet> {
  let { data, error } = await supabase
    .from('timesheets')
    .select(timesheetDetailSelect)
    .eq('id', id)
    .single()

  if (isMissingTimesheetEntryColumnError(error)) {
    ;({ data, error } = await supabase
      .from('timesheets')
      .select(timesheetDetailSelectCore)
      .eq('id', id)
      .single())
  }

  logSupabaseQuery({
    service: 'timesheetsService.fetchTimesheetById',
    table: 'timesheets',
    data: data ? [data] : [],
    error,
  })

  if (error || !data) {
    throw new TimesheetsServiceError(error?.message ?? 'Timesheet not found')
  }

  return mapTimesheetRow(data as unknown as TimesheetRow)
}

export async function fetchTimesheetsPage(query: TimesheetsQuery): Promise<TimesheetsPageResult> {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = query.pageSize ?? DEFAULT_TIMESHEET_PAGE_SIZE
  const weekStart = normalizeWeekStartForCompany(query.weekStart)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const sortBy = query.sortBy ?? 'driverName'
  const sortDir = query.sortDir ?? 'asc'

  let request = supabase
    .from('timesheets')
    .select(buildListSelect(query), { count: 'exact' })
    .eq('week_start', weekStart)

  if (query.status && query.status !== 'all') {
    request = request.eq('status', query.status)
  }

  if (query.vehicleId === 'unassigned') {
    request = request.is('vehicle_id', null)
  } else if (query.vehicleId && query.vehicleId !== 'all') {
    request = request.eq('vehicle_id', query.vehicleId)
  }

  if (query.role && query.role !== 'all') {
    request = request.eq('drivers.role', query.role)
  }

  const search = query.search?.trim()
  if (search) {
    request = request.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%`,
      { referencedTable: 'drivers' },
    )
  }

  if (sortBy === 'updatedAt') {
    request = request.order('updated_at', { ascending: sortDir === 'asc' })
  } else if (sortBy === 'weekStart') {
    request = request.order('week_start', { ascending: sortDir === 'asc' })
  } else if (sortBy === 'status') {
    request = request.order('status', { ascending: sortDir === 'asc' })
  } else if (sortBy === 'driverName') {
    request = request
      .order('last_name', { ascending: sortDir === 'asc', referencedTable: 'drivers' })
      .order('first_name', { ascending: sortDir === 'asc', referencedTable: 'drivers' })
  } else {
    request = request.order('updated_at', { ascending: false })
  }

  request = request.range(from, to)

  const { data, error, count } = await request

  logSupabaseQuery({
    service: 'timesheetsService.fetchTimesheetsPage',
    table: 'timesheets',
    data,
    error,
    count,
  })

  if (error) {
    throw new TimesheetsServiceError(error.message)
  }

  const rows = (data ?? []) as unknown as TimesheetRow[]
  let items = rows.map((row) => mapListRow(row))
  const totalsMap = await fetchEntryTotalsByTimesheetIds(items.map((item) => item.id))
  items = applyListTotals(items, totalsMap)

  if (sortBy === 'workedHours') {
    items = sortTimesheetListItems(items, sortBy, sortDir)
  }

  const stats = await fetchTimesheetWeekStats(weekStart)

  return {
    items,
    totalCount: count ?? items.length,
    page,
    pageSize,
    stats,
  }
}

export async function fetchTimesheetWeekStats(weekStart: string) {
  const normalizedWeek = normalizeWeekStartForCompany(weekStart)

  const { data, error } = await supabase
    .from('timesheets')
    .select('id, status')
    .eq('week_start', normalizedWeek)

  logSupabaseQuery({
    service: 'timesheetsService.fetchTimesheetWeekStats',
    table: 'timesheets',
    data,
    error,
  })

  if (error) {
    throw new TimesheetsServiceError(error.message)
  }

  const rows = data ?? []

  return computeTimesheetSummaryStats(
    rows.map((row) => ({
      status: normalizeStatus(row.status),
    })),
  )
}

export async function fetchTimesheets(): Promise<Timesheet[]> {
  const { data, error } = await supabase
    .from('timesheets')
    .select(timesheetDetailSelect)
    .order('week_start', { ascending: false })
    .order('updated_at', { ascending: false })

  logSupabaseQuery({
    service: 'timesheetsService.fetchTimesheets',
    table: 'timesheets',
    data,
    error,
  })

  if (error) {
    throw new TimesheetsServiceError(error.message)
  }

  return ((data ?? []) as unknown as TimesheetRow[]).map(mapTimesheetRow)
}

export async function fetchTimesheetById(id: string): Promise<Timesheet> {
  return fetchTimesheetRowById(id)
}

async function insertTimesheetWithEntries(
  driverId: string,
  weekStart: string,
  vehicleId: string | null = null,
): Promise<string> {
  const { data: created, error } = await supabase
    .from('timesheets')
    .insert({
      driver_id: driverId,
      vehicle_id: vehicleId,
      week_start: weekStart,
      status: 'Draft',
      notes: null,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !created) {
    if (error?.code === '23505') {
      throw new TimesheetsServiceError('DUPLICATE')
    }
    throw new TimesheetsServiceError(error?.message ?? 'Failed to create timesheet')
  }

  const weekDates = buildWeekDates(weekStart)
  const entryRows = weekDates.map((dayDate) => ({
    timesheet_id: created.id,
    day_date: dayDate,
    start_time: null,
    break_minutes: getSetting('defaultBreakMinutes') ?? 30,
    finish_time: null,
    total_minutes: 0,
  }))

  const { error: entriesError } = await supabase.from('timesheet_entries').insert(entryRows)

  logSupabaseQuery({
    service: 'timesheetsService.insertTimesheetWithEntries',
    table: 'timesheet_entries',
    data: entryRows,
    error: entriesError,
  })

  if (entriesError) {
    await supabase.from('timesheets').delete().eq('id', created.id)
    throw new TimesheetsServiceError(entriesError.message)
  }

  return created.id
}

export async function createTimesheet(input: CreateTimesheetInput): Promise<Timesheet> {
  const weekStart = normalizeWeekStartForCompany(input.weekStart)

  try {
    const id = await insertTimesheetWithEntries(
      input.driverId,
      weekStart,
      input.vehicleId ?? null,
    )
    return fetchTimesheetRowById(id)
  } catch (error) {
    if (error instanceof TimesheetsServiceError && error.message === 'DUPLICATE') {
      throw new TimesheetsServiceError('A timesheet already exists for this worker and week')
    }
    throw error
  }
}

export async function bulkCreateTimesheets(
  input: BulkCreateTimesheetsInput,
): Promise<{ created: number; skipped: number }> {
  const weekStart = normalizeWeekStartForCompany(input.weekStart)
  const uniqueDriverIds = [...new Set(input.driverIds)]

  if (uniqueDriverIds.length === 0) {
    return { created: 0, skipped: 0 }
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('timesheets')
    .select('driver_id')
    .eq('week_start', weekStart)
    .in('driver_id', uniqueDriverIds)

  if (existingError) {
    throw new TimesheetsServiceError(existingError.message)
  }

  const existingDriverIds = new Set((existingRows ?? []).map((row) => row.driver_id))
  const pendingDriverIds = uniqueDriverIds.filter((id) => !existingDriverIds.has(id))

  let created = 0
  for (const driverId of pendingDriverIds) {
    try {
      await insertTimesheetWithEntries(driverId, weekStart, null)
      created += 1
    } catch (error) {
      if (error instanceof TimesheetsServiceError && error.message === 'DUPLICATE') {
        continue
      }
      throw error
    }
  }

  return {
    created,
    skipped: uniqueDriverIds.length - created,
  }
}

export async function updateTimesheet(
  id: string,
  input: UpdateTimesheetInput,
): Promise<Timesheet> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.vehicleId !== undefined) payload.vehicle_id = input.vehicleId
  if (input.status !== undefined) payload.status = input.status
  if (input.notes !== undefined) payload.notes = input.notes

  const { error } = await supabase.from('timesheets').update(payload).eq('id', id)

  logSupabaseQuery({
    service: 'timesheetsService.updateTimesheet',
    table: 'timesheets',
    data: error ? [] : [{ id }],
    error,
  })

  if (error) {
    throw new TimesheetsServiceError(error.message)
  }

  return fetchTimesheetRowById(id)
}

export async function deleteTimesheet(id: string): Promise<void> {
  const { error } = await supabase.from('timesheets').delete().eq('id', id)

  logSupabaseQuery({
    service: 'timesheetsService.deleteTimesheet',
    table: 'timesheets',
    data: error ? [] : [{ id }],
    error,
  })

  if (error) {
    throw new TimesheetsServiceError(error.message)
  }
}

export async function upsertTimesheetEntries(
  timesheetId: string,
  entries: TimesheetEntryInput[],
): Promise<Timesheet> {
  if (entries.length === 0) {
    throw new TimesheetsServiceError('No timesheet entries to save')
  }

  const rows = entries.map((entry) => {
    const totalMinutes = calculateEntryTotalMinutes(entry)
    const overtimeMinutes = entry.overtimeMinutes ?? 0

    return {
      ...(entry.id ? { id: entry.id } : {}),
      timesheet_id: timesheetId,
      day_date: entry.dayDate,
      start_time: mapInsertTime(entry.startTime),
      break_minutes: entry.breakMinutes,
      finish_time: mapInsertTime(entry.finishTime),
      total_minutes: totalMinutes,
      overtime_minutes: overtimeMinutes,
    }
  })

  const { error } = await supabase
    .from('timesheet_entries')
    .upsert(rows, { onConflict: 'timesheet_id,day_date' })

  logSupabaseQuery({
    service: 'timesheetsService.upsertTimesheetEntries',
    table: 'timesheet_entries',
    data: rows,
    error,
  })

  if (error) {
    throw new TimesheetsServiceError(error.message)
  }

  const { error: touchError } = await supabase
    .from('timesheets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', timesheetId)

  if (touchError) {
    throw new TimesheetsServiceError(touchError.message)
  }

  return fetchTimesheetRowById(timesheetId)
}

export async function approveTimesheet(id: string): Promise<Timesheet> {
  return updateTimesheet(id, { status: 'Approved' })
}

export async function rejectTimesheet(id: string): Promise<Timesheet> {
  return updateTimesheet(id, { status: 'Rejected' })
}

export async function submitTimesheet(id: string): Promise<Timesheet> {
  return updateTimesheet(id, { status: 'Submitted' })
}

export async function bulkApproveTimesheets(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0

  const { data, error } = await supabase
    .from('timesheets')
    .update({ status: 'Approved', updated_at: new Date().toISOString() })
    .in('id', ids)
    .eq('status', 'Submitted')
    .select('id')

  logSupabaseQuery({
    service: 'timesheetsService.bulkApproveTimesheets',
    table: 'timesheets',
    data,
    error,
  })

  if (error) {
    throw new TimesheetsServiceError(error.message)
  }

  return data?.length ?? 0
}

export async function bulkRejectTimesheets(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0

  const { data, error } = await supabase
    .from('timesheets')
    .update({ status: 'Rejected', updated_at: new Date().toISOString() })
    .in('id', ids)
    .in('status', ['Submitted', 'Draft'])
    .select('id')

  logSupabaseQuery({
    service: 'timesheetsService.bulkRejectTimesheets',
    table: 'timesheets',
    data,
    error,
  })

  if (error) {
    throw new TimesheetsServiceError(error.message)
  }

  return data?.length ?? 0
}

export async function fetchExistingTimesheetDriverIdsForWeek(
  weekStart: string,
  driverIds: string[],
): Promise<Set<string>> {
  if (driverIds.length === 0) return new Set()

  const normalizedWeek = normalizeWeekStartForCompany(weekStart)
  const { data, error } = await supabase
    .from('timesheets')
    .select('driver_id')
    .eq('week_start', normalizedWeek)
    .in('driver_id', driverIds)

  if (error) {
    throw new TimesheetsServiceError(error.message)
  }

  return new Set((data ?? []).map((row) => row.driver_id))
}

export const timesheetsService = {
  fetchTimesheetsPage,
  fetchTimesheetWeekStats,
  fetchTimesheets,
  fetchTimesheetById,
  createTimesheet,
  bulkCreateTimesheets,
  updateTimesheet,
  deleteTimesheet,
  upsertTimesheetEntries,
  approveTimesheet,
  rejectTimesheet,
  submitTimesheet,
  bulkApproveTimesheets,
  bulkRejectTimesheets,
  fetchExistingTimesheetDriverIdsForWeek,
}

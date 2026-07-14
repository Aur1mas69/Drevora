import {
  getGlobalPaidBreaks,
  getSetting,
  getTimesheetWeekSettings,
  requireVerifiedCompanyId,
} from '@/lib/companySettingsGlobals'
import {
  buildWeekDates,
  calculateEntryTotalMinutes,
  computeTimesheetSummaryStats,
  normalizeWeekStartForCompany,
  sortTimesheetListItems,
  summarizeTimesheetEntries,
  summarizeTimesheetEntriesFromTotals,
} from '@/lib/timesheetUtils'
import { formatTimesheetWeekDisplay } from '@/lib/timesheetWeekNumber'
import type {
  BulkCreateTimesheetsInput,
  CreateTimesheetInput,
  CreateTimesheetResult,
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
import { requireSupabase } from '@/lib/supabase'
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
  overtime_minutes?: number | null
  payroll_minutes?: number | null
  additional_hours?: number | null
  daily_comment?: string | null
  deleted_at?: string | null
  deleted_by?: string | null
  delete_reason?: string | null
}

type TimesheetRow = {
  id: string
  created_at: string
  updated_at: string
  submitted_at?: string | null
  approved_at?: string | null
  rejected_at?: string | null
  cleaned_at?: string | null
  driver_id: string
  vehicle_id: string | null
  week_start: string
  status: string
  notes: string | null
  bonus_amount: number | null
  deleted_at?: string | null
  deleted_by?: string | null
  delete_reason?: string | null
  drivers: DriverJoinRow | DriverJoinRow[] | null
  vehicles: VehicleJoinRow | VehicleJoinRow[] | null
  timesheet_entries?: TimesheetEntryRow[]
}

type EntryTotalsRow = {
  timesheet_id: string
  total_minutes: number | null
  break_minutes: number | null
  overtime_minutes: number | null
  additional_hours?: number | null
}

const timesheetEntrySelectCore = `
    id,
    timesheet_id,
    day_date,
    start_time,
    break_minutes,
    finish_time,
    total_minutes,
    overtime_minutes,
    additional_hours
  `

const timesheetEntrySelectMinimal = `
    id,
    timesheet_id,
    day_date,
    start_time,
    break_minutes,
    finish_time,
    total_minutes
  `

const timesheetDetailSelectWithoutDailyComment = `
  id,
  created_at,
  updated_at,
  submitted_at,
  approved_at,
  rejected_at,
  cleaned_at,
  driver_id,
  vehicle_id,
  week_start,
  status,
  notes,
  bonus_amount,
  drivers ( first_name, last_name, role ),
  vehicles ( registration, fleet_number ),
  timesheet_entries (${timesheetEntrySelectCore})
`

const timesheetDetailSelectMinimalEntries = `
  id,
  created_at,
  updated_at,
  submitted_at,
  approved_at,
  rejected_at,
  cleaned_at,
  driver_id,
  vehicle_id,
  week_start,
  status,
  notes,
  bonus_amount,
  drivers ( first_name, last_name, role ),
  vehicles ( registration, fleet_number ),
  timesheet_entries (${timesheetEntrySelectMinimal})
`

const timesheetEntrySelectWithDailyComment = `
    id,
    timesheet_id,
    day_date,
    start_time,
    break_minutes,
    finish_time,
    total_minutes,
    overtime_minutes,
    additional_hours,
    daily_comment
  `

const timesheetDetailSelect = `
  id,
  created_at,
  updated_at,
  submitted_at,
  approved_at,
  rejected_at,
  cleaned_at,
  driver_id,
  vehicle_id,
  week_start,
  status,
  notes,
  bonus_amount,
  drivers ( first_name, last_name, role ),
  vehicles ( registration, fleet_number ),
  timesheet_entries (${timesheetEntrySelectWithDailyComment})
`

const timesheetListSelect = `
  id,
  created_at,
  updated_at,
  submitted_at,
  approved_at,
  rejected_at,
  cleaned_at,
  driver_id,
  vehicle_id,
  week_start,
  status,
  notes,
  bonus_amount,
  drivers ( first_name, last_name, role )
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

function normalizeBonusAmount(value: number | null | undefined): number {
  const amount = Number(value ?? 0)
  if (Number.isNaN(amount)) return 0
  return Math.max(0, amount)
}

function normalizeDriverRole(value: string | null | undefined): DriverRole | null {
  if (!value) return null
  return value as DriverRole
}

function normalizeAdditionalHours(value: number | null | undefined): number {
  const hours = Number(value ?? 0)
  if (Number.isNaN(hours)) return 0
  return Math.max(0, hours)
}

function normalizeDailyComment(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

/** Maps React entry input (dailyComment) to timesheet_entries row (daily_comment). */
function buildTimesheetEntryDbRow(timesheetId: string, entry: TimesheetEntryInput) {
  return {
    timesheet_id: timesheetId,
    day_date: entry.dayDate,
    start_time: mapInsertTime(entry.startTime),
    break_minutes: entry.breakMinutes,
    finish_time: mapInsertTime(entry.finishTime),
    total_minutes: calculateEntryTotalMinutes(entry, {
      paidBreaks: getGlobalPaidBreaks(),
    }),
    overtime_minutes: entry.overtimeMinutes ?? 0,
    additional_hours: normalizeAdditionalHours(entry.additionalHours),
    daily_comment: normalizeDailyComment(entry.dailyComment) || null,
  }
}

function buildEmptyTimesheetEntryDbRow(
  timesheetId: string,
  dayDate: string,
  defaultBreakMinutes: number,
) {
  return {
    timesheet_id: timesheetId,
    day_date: dayDate,
    start_time: null,
    break_minutes: defaultBreakMinutes,
    finish_time: null,
    total_minutes: 0,
    overtime_minutes: 0,
    additional_hours: 0,
    daily_comment: null,
  }
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
    additionalHours: normalizeAdditionalHours(row.additional_hours),
    dailyComment: normalizeDailyComment(row.daily_comment),
  }
}

function mapListRow(
  row: TimesheetRow,
  totals?: {
    workedMinutes: number
    breakMinutes: number
    overtimeMinutes: number
    additionalHours: number
  },
): TimesheetListItem {
  const driver = normalizeJoinRow(row.drivers)
  const vehicle = normalizeJoinRow(row.vehicles)
  const driverName = driver
    ? `${driver.first_name} ${driver.last_name}`.trim()
    : 'Unknown worker'

  const summary = totals
    ? summarizeTimesheetEntriesFromTotals(totals)
    : {
        workedHours: 0,
        breakHours: 0,
        overtimeHours: 0,
        additionalHours: 0,
        totalHours: 0,
      }

  const weekDisplay = formatTimesheetWeekDisplay(
    row.week_start,
    getTimesheetWeekSettings(),
  )

  return {
    id: row.id,
    driverId: row.driver_id,
    vehicleId: row.vehicle_id,
    weekStart: row.week_start,
    weekLabel: weekDisplay.weekRangeLabel,
    weekNumber: weekDisplay.weekNumber,
    weekTitle: weekDisplay.weekTitle,
    weekRangeLabel: weekDisplay.weekRangeLabel,
    status: normalizeStatus(row.status),
    notes: row.notes,
    bonusAmount: normalizeBonusAmount(row.bonus_amount),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at ?? null,
    approvedAt: row.approved_at ?? null,
    rejectedAt: row.rejected_at ?? null,
    cleanedAt: row.cleaned_at ?? null,
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
    workedHours: totals.workedHours,
    breakHours: totals.breakHours,
    overtimeHours: totals.overtimeHours,
    additionalHours: totals.additionalHours,
    totalHours: totals.totalHours,
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
    message.includes('additional_hours') ||
    message.includes('daily_comment') ||
    message.includes('deleted_at') ||
    message.includes('deleted_by') ||
    message.includes('delete_reason') ||
    error.code === '42703'
  )
}

function buildSoftDeletePayload(deletedBy: string | null, deletedAt = new Date().toISOString()) {
  return {
    deleted_at: deletedAt,
    deleted_by: deletedBy,
    delete_reason: null,
  }
}

async function assertTimesheetInCompany(timesheetId: string, companyId: string): Promise<void> {
  const { data, error } = await requireSupabase()
    .from('timesheets')
    .select('id')
    .eq('id', timesheetId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw new TimesheetsServiceError(error.message)
  }
  if (!data) {
    throw new TimesheetsServiceError('Timesheet not found')
  }
}

async function assertDriverInCompany(driverId: string, companyId: string): Promise<void> {
  const { data, error } = await requireSupabase()
    .from('drivers')
    .select('id')
    .eq('id', driverId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw new TimesheetsServiceError(error.message)
  }
  if (!data) {
    throw new TimesheetsServiceError('Driver not found')
  }
}

/** Call only with timesheet IDs already scoped to the verified company. */
async function restoreSoftDeletedTimesheetEntries(
  timesheetId: string,
  deletedAt: string,
): Promise<void> {
  await requireSupabase()
    .from('timesheet_entries')
    .update({
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
    })
    .eq('timesheet_id', timesheetId)
    .eq('deleted_at', deletedAt)
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
      additionalHours: number
    }
  >
> {
  const totals = new Map<
    string,
    {
      workedMinutes: number
      breakMinutes: number
      overtimeMinutes: number
      additionalHours: number
    }
  >()
  if (timesheetIds.length === 0) return totals

  const initialResponse = await requireSupabase()
    .from('timesheet_entries')
    .select('timesheet_id, total_minutes, break_minutes, overtime_minutes, additional_hours')
    .in('timesheet_id', timesheetIds)
    .is('deleted_at', null)
  let data = initialResponse.data as EntryTotalsRow[] | null
  let error = initialResponse.error

  if (isMissingTimesheetEntryColumnError(error)) {
    const fallbackResponse = await requireSupabase()
      .from('timesheet_entries')
      .select('timesheet_id, total_minutes, break_minutes, overtime_minutes')
      .in('timesheet_id', timesheetIds)
      .is('deleted_at', null)
    data = fallbackResponse.data as EntryTotalsRow[] | null
    error = fallbackResponse.error
  }

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
      additionalHours: 0,
    }
    const totalMinutes = row.total_minutes ?? 0
    const overtimeMinutes = row.overtime_minutes ?? 0
    current.workedMinutes += totalMinutes
    current.breakMinutes += row.break_minutes ?? 0
    current.overtimeMinutes += overtimeMinutes
    current.additionalHours += Number(row.additional_hours ?? 0)
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
      additionalHours: number
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

async function fetchTimesheetRowById(id: string, companyId: string): Promise<Timesheet> {
  let { data, error } = await requireSupabase()
    .from('timesheets')
    .select(timesheetDetailSelect)
    .eq('id', id)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .is('timesheet_entries.deleted_at', null)
    .single()

  if (isMissingTimesheetEntryColumnError(error)) {
    ;({ data, error } = await requireSupabase()
      .from('timesheets')
      .select(timesheetDetailSelectWithoutDailyComment)
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .is('timesheet_entries.deleted_at', null)
      .single())
  }

  if (isMissingTimesheetEntryColumnError(error)) {
    ;({ data, error } = await requireSupabase()
      .from('timesheets')
      .select(timesheetDetailSelectMinimalEntries)
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .is('timesheet_entries.deleted_at', null)
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
  const companyId = requireVerifiedCompanyId()
  const page = Math.max(1, query.page ?? 1)
  const pageSize = query.pageSize ?? DEFAULT_TIMESHEET_PAGE_SIZE
  const weekStart = normalizeWeekStartForCompany(query.weekStart)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const sortBy = query.sortBy ?? 'createdAt'
  const sortDir = query.sortDir ?? 'desc'

  let request = requireSupabase()
    .from('timesheets')
    .select(buildListSelect(query), { count: 'exact' })
    .eq('week_start', weekStart)
    .eq('company_id', companyId)
    .is('deleted_at', null)

  request = applyTimesheetsCleanedAtViewFilter(request, query.viewMode)

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

  if (sortBy !== 'workedHours' && sortBy !== 'createdAt' && sortBy !== 'weekStart') {
    request = request.range(from, to)
  }

  const { data, error, count } = await request

  logSupabaseQuery({
    service: 'timesheetsService.fetchTimesheetsPage',
    table: 'timesheets',
    data,
    error,
    count,
  })

  if (error) {
    if (isMissingCleanedAtColumnError(error.message)) {
      throw new TimesheetsServiceError(
        'Timesheets cleanup views are not available yet. Ensure cleaned_at exists on timesheets.',
      )
    }
    throw new TimesheetsServiceError(error.message)
  }

  const rows = (data ?? []) as unknown as TimesheetRow[]
  let items = rows.map((row) => mapListRow(row))
  const totalsMap = await fetchEntryTotalsByTimesheetIds(items.map((item) => item.id))
  items = applyListTotals(items, totalsMap)

  if (sortBy === 'workedHours' || sortBy === 'createdAt' || sortBy === 'weekStart') {
    items = sortTimesheetListItems(items, sortBy, sortDir)
    items = items.slice(from, to + 1)
  }

  const stats = await fetchTimesheetWeekStatsForCompany(weekStart, query.viewMode, companyId)

  return {
    items,
    totalCount: count ?? items.length,
    page,
    pageSize,
    stats,
  }
}

function isMissingCleanedAtColumnError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('cleaned_at') &&
    (normalized.includes('does not exist') ||
      normalized.includes('schema cache') ||
      normalized.includes('column'))
  )
}

/** Apply Current / History / All cleaned_at visibility to a timesheets query. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyTimesheetsCleanedAtViewFilter(request: any, viewMode: TimesheetsQuery['viewMode']): any {
  if (viewMode === 'history') {
    return request.not('cleaned_at', 'is', null)
  }
  if (viewMode === 'all') {
    return request
  }
  return request.is('cleaned_at', null)
}

async function fetchTimesheetWeekStatsForCompany(
  weekStart: string,
  viewMode: TimesheetsQuery['viewMode'],
  companyId: string,
) {
  const normalizedWeek = normalizeWeekStartForCompany(weekStart)

  let request = requireSupabase()
    .from('timesheets')
    .select('id, status')
    .eq('week_start', normalizedWeek)
    .eq('company_id', companyId)
    .is('deleted_at', null)

  request = applyTimesheetsCleanedAtViewFilter(request, viewMode)

  const { data, error } = await request

  logSupabaseQuery({
    service: 'timesheetsService.fetchTimesheetWeekStats',
    table: 'timesheets',
    data,
    error,
  })

  if (error) {
    if (isMissingCleanedAtColumnError(error.message)) {
      throw new TimesheetsServiceError(
        'Timesheets cleanup views are not available yet. Ensure cleaned_at exists on timesheets.',
      )
    }
    throw new TimesheetsServiceError(error.message)
  }

  const rows = data ?? []

  return computeTimesheetSummaryStats(
    rows.map((row) => ({
      status: normalizeStatus(row.status),
    })),
  )
}

export async function fetchTimesheetWeekStats(
  weekStart: string,
  viewMode: TimesheetsQuery['viewMode'] = 'current',
) {
  const companyId = requireVerifiedCompanyId()
  return fetchTimesheetWeekStatsForCompany(weekStart, viewMode, companyId)
}

export async function fetchTimesheets(): Promise<Timesheet[]> {
  const companyId = requireVerifiedCompanyId()
  const { data, error } = await requireSupabase()
    .from('timesheets')
    .select(timesheetDetailSelect)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .is('timesheet_entries.deleted_at', null)
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
  const companyId = requireVerifiedCompanyId()
  return fetchTimesheetRowById(id, companyId)
}

async function insertTimesheetWithEntries(
  driverId: string,
  weekStart: string,
  companyId: string,
  vehicleId: string | null = null,
): Promise<string> {
  const { data: created, error } = await requireSupabase()
    .from('timesheets')
    .insert({
      company_id: companyId,
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
  const defaultBreakMinutes = getSetting('defaultBreakMinutes') ?? 30
  const entryRows = weekDates.map((dayDate) =>
    buildEmptyTimesheetEntryDbRow(created.id, dayDate, defaultBreakMinutes),
  )

  await assertTimesheetInCompany(created.id, companyId)
  const { error: entriesError } = await requireSupabase().from('timesheet_entries').insert(entryRows)

  logSupabaseQuery({
    service: 'timesheetsService.insertTimesheetWithEntries',
    table: 'timesheet_entries',
    data: entryRows,
    error: entriesError,
  })

  if (entriesError) {
    const deletedAt = new Date().toISOString()
    await requireSupabase()
      .from('timesheets')
      .update({
        ...buildSoftDeletePayload(null, deletedAt),
        updated_at: deletedAt,
      })
      .eq('id', created.id)
      .eq('company_id', companyId)
    throw new TimesheetsServiceError(entriesError.message)
  }

  return created.id
}

async function fetchActiveTimesheetIdForDriverWeek(
  driverId: string,
  weekStart: string,
  companyId: string,
): Promise<string | null> {
  const { data, error } = await requireSupabase()
    .from('timesheets')
    .select('id')
    .eq('driver_id', driverId)
    .eq('week_start', weekStart)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new TimesheetsServiceError(error.message)
  }

  return data?.id ?? null
}

async function resolveExistingTimesheetAfterDuplicate(
  driverId: string,
  weekStart: string,
  companyId: string,
): Promise<Timesheet | null> {
  const existingId = await fetchActiveTimesheetIdForDriverWeek(driverId, weekStart, companyId)
  if (!existingId) return null
  return fetchTimesheetRowById(existingId, companyId)
}

export async function createTimesheet(input: CreateTimesheetInput): Promise<CreateTimesheetResult> {
  const companyId = requireVerifiedCompanyId()
  await assertDriverInCompany(input.driverId, companyId)
  const weekStart = normalizeWeekStartForCompany(input.weekStart)
  const existingId = await fetchActiveTimesheetIdForDriverWeek(input.driverId, weekStart, companyId)

  if (existingId) {
    return {
      timesheet: await fetchTimesheetRowById(existingId, companyId),
      created: false,
    }
  }

  try {
    const id = await insertTimesheetWithEntries(
      input.driverId,
      weekStart,
      companyId,
      input.vehicleId ?? null,
    )
    return {
      timesheet: await fetchTimesheetRowById(id, companyId),
      created: true,
    }
  } catch (error) {
    if (error instanceof TimesheetsServiceError && error.message === 'DUPLICATE') {
      const existing = await resolveExistingTimesheetAfterDuplicate(input.driverId, weekStart, companyId)
      if (existing) {
        return { timesheet: existing, created: false }
      }
      throw new TimesheetsServiceError('A timesheet already exists for this worker and week')
    }
    throw error
  }
}

export async function bulkCreateTimesheets(
  input: BulkCreateTimesheetsInput,
): Promise<{ created: number; skipped: number }> {
  const companyId = requireVerifiedCompanyId()
  const weekStart = normalizeWeekStartForCompany(input.weekStart)
  const uniqueDriverIds = [...new Set(input.driverIds)]

  if (uniqueDriverIds.length === 0) {
    return { created: 0, skipped: 0 }
  }

  await Promise.all(uniqueDriverIds.map((driverId) => assertDriverInCompany(driverId, companyId)))
  const existingDriverIds = await fetchExistingTimesheetDriverIdsForWeek(
    weekStart,
    uniqueDriverIds,
  )
  const pendingDriverIds = uniqueDriverIds.filter((id) => !existingDriverIds.has(id))

  let created = 0
  let skippedDuringInsert = 0
  for (const driverId of pendingDriverIds) {
    try {
      await insertTimesheetWithEntries(driverId, weekStart, companyId, null)
      created += 1
    } catch (error) {
      if (error instanceof TimesheetsServiceError && error.message === 'DUPLICATE') {
        skippedDuringInsert += 1
        continue
      }
      throw error
    }
  }

  return {
    created,
    skipped: existingDriverIds.size + skippedDuringInsert,
  }
}

export async function updateTimesheet(
  id: string,
  input: UpdateTimesheetInput,
): Promise<Timesheet> {
  const companyId = requireVerifiedCompanyId()
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.vehicleId !== undefined) payload.vehicle_id = input.vehicleId
  if (input.status !== undefined) payload.status = input.status
  if (input.notes !== undefined) payload.notes = input.notes

  const { data, error } = await requireSupabase()
    .from('timesheets')
    .update(payload)
    .eq('id', id)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  logSupabaseQuery({
    service: 'timesheetsService.updateTimesheet',
    table: 'timesheets',
    data: data ? [data] : [],
    error,
  })

  if (error || !data) {
    throw new TimesheetsServiceError(error?.message ?? 'Timesheet not found')
  }

  return fetchTimesheetRowById(id, companyId)
}

export type CleanTimesheetsCurrentViewInput = {
  /** Exact displayed week_start (will be normalized with company Monday/Sunday setting). */
  weekStart: string
}

/**
 * Soft-clean Current week view: sets cleaned_at only on timesheets for that week.
 * Does not change status and does not touch timesheet_entries.
 * Scope: company_id, deleted_at IS NULL, cleaned_at IS NULL, week_start = normalized week.
 */
export async function cleanTimesheetsCurrentView(
  input: CleanTimesheetsCurrentViewInput,
): Promise<{ cleanedCount: number; cleanedIds: string[] }> {
  const companyId = requireVerifiedCompanyId()
  const weekStart = normalizeWeekStartForCompany(input.weekStart)
  const cleanedAt = new Date().toISOString()

  const { data, error } = await requireSupabase()
    .from('timesheets')
    .update({
      cleaned_at: cleanedAt,
      updated_at: cleanedAt,
    })
    .eq('week_start', weekStart)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .is('cleaned_at', null)
    .select('id, cleaned_at')

  logSupabaseQuery({
    service: 'timesheetsService.cleanTimesheetsCurrentView',
    table: 'timesheets',
    data,
    error,
  })

  if (error) {
    if (isMissingCleanedAtColumnError(error.message)) {
      throw new TimesheetsServiceError(
        'Timesheets cleanup is not available yet. Ensure cleaned_at exists on timesheets.',
      )
    }
    throw new TimesheetsServiceError(error.message)
  }

  const cleanedIds = (data ?? []).map((row) => String((row as { id: string }).id))

  if (import.meta.env.DEV) {
    console.info('[timesheets] clean current view', {
      weekStart,
      cleanedCount: cleanedIds.length,
      cleanedIds,
    })
  }

  return { cleanedCount: cleanedIds.length, cleanedIds }
}

export async function deleteTimesheet(id: string): Promise<void> {
  const companyId = requireVerifiedCompanyId()
  const supabase = requireSupabase()
  await assertTimesheetInCompany(id, companyId)
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) {
    throw new TimesheetsServiceError(userError.message)
  }

  const deletedAt = new Date().toISOString()
  const deletedBy = userData.user?.id ?? null
  const softDeletePayload = buildSoftDeletePayload(deletedBy, deletedAt)

  const { error: entriesError } = await supabase
    .from('timesheet_entries')
    .update(softDeletePayload)
    .eq('timesheet_id', id)
    .is('deleted_at', null)

  if (entriesError) {
    logSupabaseQuery({
      service: 'timesheetsService.deleteTimesheet',
      table: 'timesheet_entries',
      data: [],
      error: entriesError,
    })
    throw new TimesheetsServiceError(entriesError.message)
  }

  const { data, error } = await supabase
    .from('timesheets')
    .update({
      ...softDeletePayload,
      updated_at: deletedAt,
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .select('id')

  if (error) {
    await restoreSoftDeletedTimesheetEntries(id, deletedAt)
    logSupabaseQuery({
      service: 'timesheetsService.deleteTimesheet',
      table: 'timesheets',
      data: [],
      error,
    })
    throw new TimesheetsServiceError(error.message)
  }

  if (!data?.length) {
    await restoreSoftDeletedTimesheetEntries(id, deletedAt)
    throw new TimesheetsServiceError('Timesheet not found')
  }

  logSupabaseQuery({
    service: 'timesheetsService.deleteTimesheet',
    table: 'timesheets',
    data,
    error: null,
  })
}

export async function upsertTimesheetEntries(
  timesheetId: string,
  entries: TimesheetEntryInput[],
): Promise<Timesheet> {
  const companyId = requireVerifiedCompanyId()
  if (entries.length === 0) {
    throw new TimesheetsServiceError('No timesheet entries to save')
  }

  const supabase = requireSupabase()
  await assertTimesheetInCompany(timesheetId, companyId)

  for (const entry of entries) {
    const row = buildTimesheetEntryDbRow(timesheetId, entry)

    if (entry.id) {
      const { data, error } = await supabase
        .from('timesheet_entries')
        .update(row)
        .eq('id', entry.id)
        .eq('timesheet_id', timesheetId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle()

      logSupabaseQuery({
        service: 'timesheetsService.upsertTimesheetEntries.update',
        table: 'timesheet_entries',
        data: [{ id: entry.id, ...row }],
        error,
      })

      if (error || !data) {
        throw new TimesheetsServiceError(error?.message ?? 'Timesheet entry not found')
      }
      continue
    }

    const { error } = await supabase.from('timesheet_entries').insert(row)

    logSupabaseQuery({
      service: 'timesheetsService.upsertTimesheetEntries.insert',
      table: 'timesheet_entries',
      data: [row],
      error,
    })

    if (error) {
      throw new TimesheetsServiceError(error.message)
    }
  }

  const { data: touchedTimesheet, error: touchError } = await supabase
    .from('timesheets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', timesheetId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (touchError || !touchedTimesheet) {
    throw new TimesheetsServiceError(touchError?.message ?? 'Timesheet not found')
  }

  return fetchTimesheetRowById(timesheetId, companyId)
}

export async function approveTimesheet(id: string): Promise<Timesheet> {
  const companyId = requireVerifiedCompanyId()
  const now = new Date().toISOString()
  const { data, error } = await requireSupabase()
    .from('timesheets')
    .update({ status: 'Approved', approved_at: now, updated_at: now })
    .eq('id', id)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  logSupabaseQuery({
    service: 'timesheetsService.approveTimesheet',
    table: 'timesheets',
    data: data ? [data] : [],
    error,
  })

  if (error || !data) {
    throw new TimesheetsServiceError(error?.message ?? 'Timesheet not found')
  }

  return fetchTimesheetRowById(id, companyId)
}

export async function rejectTimesheet(id: string): Promise<Timesheet> {
  const companyId = requireVerifiedCompanyId()
  const now = new Date().toISOString()
  const { data, error } = await requireSupabase()
    .from('timesheets')
    .update({ status: 'Rejected', rejected_at: now, updated_at: now })
    .eq('id', id)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  logSupabaseQuery({
    service: 'timesheetsService.rejectTimesheet',
    table: 'timesheets',
    data: data ? [data] : [],
    error,
  })

  if (error || !data) {
    throw new TimesheetsServiceError(error?.message ?? 'Timesheet not found')
  }

  return fetchTimesheetRowById(id, companyId)
}

export async function submitTimesheet(id: string): Promise<Timesheet> {
  const companyId = requireVerifiedCompanyId()
  const supabase = requireSupabase()
  const now = new Date().toISOString()

  const { data: existing, error: fetchError } = await supabase
    .from('timesheets')
    .select('submitted_at')
    .eq('id', id)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) {
    throw new TimesheetsServiceError(fetchError?.message ?? 'Timesheet not found')
  }

  const payload: Record<string, unknown> = {
    status: 'Submitted',
    updated_at: now,
  }
  if (!existing.submitted_at) {
    payload.submitted_at = now
  }

  const { data, error } = await supabase
    .from('timesheets')
    .update(payload)
    .eq('id', id)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  logSupabaseQuery({
    service: 'timesheetsService.submitTimesheet',
    table: 'timesheets',
    data: data ? [{ ...data, ...payload }] : [],
    error,
  })

  if (error || !data) {
    throw new TimesheetsServiceError(error?.message ?? 'Timesheet not found')
  }

  return fetchTimesheetRowById(id, companyId)
}

export async function bulkApproveTimesheets(ids: string[]): Promise<number> {
  const companyId = requireVerifiedCompanyId()
  if (ids.length === 0) return 0

  const now = new Date().toISOString()
  const { data, error } = await requireSupabase()
    .from('timesheets')
    .update({ status: 'Approved', approved_at: now, updated_at: now })
    .in('id', ids)
    .eq('company_id', companyId)
    .eq('status', 'Submitted')
    .is('deleted_at', null)
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
  const companyId = requireVerifiedCompanyId()
  if (ids.length === 0) return 0

  const now = new Date().toISOString()
  const { data, error } = await requireSupabase()
    .from('timesheets')
    .update({ status: 'Rejected', rejected_at: now, updated_at: now })
    .in('id', ids)
    .eq('company_id', companyId)
    .in('status', ['Submitted', 'Draft'])
    .is('deleted_at', null)
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
  const companyId = requireVerifiedCompanyId()
  if (driverIds.length === 0) return new Set()

  const normalizedWeek = normalizeWeekStartForCompany(weekStart)
  const { data, error } = await requireSupabase()
    .from('timesheets')
    .select('driver_id')
    .eq('week_start', normalizedWeek)
    .eq('company_id', companyId)
    .in('driver_id', driverIds)
    .is('deleted_at', null)

  if (error) {
    throw new TimesheetsServiceError(error.message)
  }

  return new Set((data ?? []).map((row) => row.driver_id))
}

export async function fetchTimesheetsByDriverId(
  driverId: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<{ items: TimesheetListItem[]; totalCount: number }> {
  const companyId = requireVerifiedCompanyId()
  const page = Math.max(1, options.page ?? 1)
  const pageSize = options.pageSize ?? 25
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await requireSupabase()
    .from('timesheets')
    .select(timesheetListSelect, { count: 'exact' })
    .eq('driver_id', driverId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('week_start', { ascending: false })
    .order('updated_at', { ascending: false })
    .range(from, to)

  logSupabaseQuery({
    service: 'timesheetsService.fetchTimesheetsByDriverId',
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

  return {
    items,
    totalCount: count ?? items.length,
  }
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
  cleanTimesheetsCurrentView,
  upsertTimesheetEntries,
  approveTimesheet,
  rejectTimesheet,
  submitTimesheet,
  bulkApproveTimesheets,
  bulkRejectTimesheets,
  fetchExistingTimesheetDriverIdsForWeek,
  fetchTimesheetsByDriverId,
}

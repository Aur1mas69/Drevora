import {
  calculateHolidayDayBreakdown,
  addDaysIso,
  computeHolidaySummaryStats,
  DEFAULT_HOLIDAY_COUNTING_SETTINGS,
  HOLIDAY_MAX_WORKERS_OFF_PER_DAY,
  normalizeHolidayIsoDate,
  resolveWorkerDisplayName,
  toLocalIsoDate,
  type HolidayCountingSettings,
} from '@/lib/holidayRequestUtils'
import type {
  CreateHolidayRequestInput,
  HolidayBalanceSummary,
  HolidayCalendarQuery,
  HolidayCapacityWarning,
  HolidayLeaveType,
  HolidayRequest,
  HolidayRequestStatus,
  HolidayRequestsPageResult,
  HolidayRequestsQuery,
  HolidayRequestSummaryStats,
  UpdateHolidayRequestInput,
} from '@/lib/holidayRequestTypes'
import {
  DEFAULT_HOLIDAY_ENTITLEMENT_RULES,
  type HolidayEntitlementRules,
} from '@/lib/companySettingsTypes'
import { DEFAULT_HOLIDAY_PAGE_SIZE } from '@/lib/holidayRequestTypes'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import { companySettingsService } from '@/services/companySettingsService'
import type { DriverRole } from '@/services/driversService'

type DriverJoinRow = {
  first_name: string
  last_name: string
  role: string | null
  employment_type?: string | null
  paid_holiday_enabled?: boolean | null
  annual_paid_holiday_days?: number | string | null
  bank_holiday_entitlement_days?: number | string | null
  unpaid_leave_allowed?: boolean | null
  holiday_entitlement_notes?: string | null
  company?: string | null
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
  leave_type?: string | null
  is_paid_leave?: boolean | null
  holiday_days_deducted?: number | string | null
  calendar_days_total?: number | string | null
  non_working_days_excluded?: number | string | null
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
  leave_type,
  is_paid_leave,
  holiday_days_deducted,
  calendar_days_total,
  non_working_days_excluded,
  drivers (
    first_name,
    last_name,
    role,
    employment_type,
    company
  )
`

function logHolidayRequestWriteError(
  service: string,
  error: { message: string; code?: string; details?: string; hint?: string },
  payload: Record<string, unknown>,
): void {
  console.error(`[${service}] Supabase write failed`, {
    message: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null,
    code: error.code ?? null,
    payload,
  })
}

function isMissingColumnReadError(error: { message?: string; code?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? ''
  return (
    error?.code === 'PGRST204' ||
    error?.code === '42703' ||
    message.includes('schema cache') ||
    message.includes('could not find the') ||
    (message.includes('column') && message.includes('does not exist'))
  )
}

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

function normalizeLeaveType(value: string | null | undefined): HolidayLeaveType {
  if (value === 'unpaid_leave' || value === 'bank_holiday') return value
  return 'paid_holiday'
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

import {
  isPaidHolidayLeaveType,
  resolvePaidHolidayEntitlementDays,
} from '@/lib/holidayEntitlement'

function resolveWorkerEntitlement(
  driver: DriverJoinRow | null,
  rules: HolidayEntitlementRules,
  fallbackAnnualAllowance: number,
): {
  paidHolidayEnabled: boolean
  annualPaidHolidayDays: number
  bankHolidayEntitlementDays: number
  paidHolidayEntitlement: number
  unpaidLeaveAllowed: boolean
} {
  const employmentType =
    driver?.employment_type && driver.employment_type in rules
      ? (driver.employment_type as keyof HolidayEntitlementRules)
      : 'Other'
  const rule = rules[employmentType] ?? {
    ...DEFAULT_HOLIDAY_ENTITLEMENT_RULES.Other,
    annualPaidHolidayDays: fallbackAnnualAllowance,
  }
  const annualPaidHolidayDays =
    numberOrNull(driver?.annual_paid_holiday_days) ?? rule.annualPaidHolidayDays
  const bankHolidayEntitlementDays =
    numberOrNull(driver?.bank_holiday_entitlement_days) ?? rule.bankHolidayEntitlementDays
  const paidHolidayEnabled = driver?.paid_holiday_enabled ?? rule.paidHolidayEnabled

  return {
    paidHolidayEnabled,
    annualPaidHolidayDays,
    bankHolidayEntitlementDays,
    paidHolidayEntitlement: resolvePaidHolidayEntitlementDays(
      paidHolidayEnabled,
      annualPaidHolidayDays,
    ),
    unpaidLeaveAllowed: driver?.unpaid_leave_allowed ?? rule.unpaidLeaveAllowed,
  }
}

function mapRow(
  row: HolidayRequestRow,
  settings: HolidayCountingSettings = DEFAULT_HOLIDAY_COUNTING_SETTINGS,
): HolidayRequest {
  const driver = normalizeJoinRow(row.drivers)
  const workerName = driver
    ? resolveWorkerDisplayName(driver.first_name, driver.last_name)
    : 'Worker'
  const leaveType = normalizeLeaveType(row.leave_type)
  const isPaidLeave = row.is_paid_leave ?? leaveType === 'paid_holiday'
  const breakdown = calculateHolidayDayBreakdown(row.start_date, row.end_date, settings)
  const fallbackTotalDays = Number(row.total_days) || 0
  const holidayDaysDeducted = isPaidLeave
    ? (numberOrNull(row.holiday_days_deducted) ??
      (breakdown.holidayDaysDeducted === 0 ? fallbackTotalDays : breakdown.holidayDaysDeducted))
    : 0

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workerId: row.worker_id,
    workerName,
    workerRole: (driver?.role as DriverRole | null) ?? null,
    workerEmploymentType: (driver?.employment_type as HolidayRequest['workerEmploymentType']) ?? null,
    startDate: normalizeHolidayIsoDate(row.start_date),
    endDate: normalizeHolidayIsoDate(row.end_date),
    leaveType,
    isPaidLeave,
    totalDays: holidayDaysDeducted,
    calendarDaysTotal:
      numberOrNull(row.calendar_days_total) ??
      (breakdown.calendarDaysTotal === 0 ? fallbackTotalDays : breakdown.calendarDaysTotal),
    holidayDaysDeducted,
    nonWorkingDaysExcluded: numberOrNull(row.non_working_days_excluded) ?? breakdown.nonWorkingDaysExcluded,
    reason: row.reason,
    status: normalizeStatus(row.status),
    managerNote: row.manager_note,
  }
}

async function getHolidayCountingContext(): Promise<{
  settings: HolidayCountingSettings
  annualAllowance: number
  allowanceKnown: boolean
  entitlementRules: HolidayEntitlementRules
  holidayYearStart: string
}> {
  const companySettings = await companySettingsService.fetchCompanySettings()
  const rawAllowance = companySettings?.annualLeaveAllowance
  const allowanceKnown =
    rawAllowance != null &&
    Number.isFinite(Number(rawAllowance)) &&
    Number(rawAllowance) > 0

  return {
    settings: companySettings
      ? {
          holidayCountingMethod: companySettings.holidayCountingMethod,
          holidayWorkingDays: companySettings.holidayWorkingDays,
        }
      : DEFAULT_HOLIDAY_COUNTING_SETTINGS,
    annualAllowance: allowanceKnown ? Number(rawAllowance) : 28,
    allowanceKnown,
    entitlementRules: companySettings?.holidayEntitlementRules ?? DEFAULT_HOLIDAY_ENTITLEMENT_RULES,
    holidayYearStart: companySettings?.holidayYearStart ?? '01-01',
  }
}

function getLeaveYearBounds(dateValue: string, holidayYearStart: string): { start: string; end: string } {
  const requestDate = new Date(`${dateValue}T00:00:00`)
  const [monthRaw, dayRaw] = holidayYearStart.split('-')
  const month = Number.parseInt(monthRaw, 10)
  const day = Number.parseInt(dayRaw, 10)
  const startMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : 1
  const startDay = Number.isFinite(day) && day >= 1 && day <= 31 ? day : 1
  let start = new Date(requestDate.getFullYear(), startMonth - 1, startDay)

  if (requestDate < start) {
    start = new Date(requestDate.getFullYear() - 1, startMonth - 1, startDay)
  }

  const end = new Date(start.getFullYear() + 1, startMonth - 1, startDay)
  end.setDate(end.getDate() - 1)

  return {
    start: toLocalIsoDate(start),
    end: toLocalIsoDate(end),
  }
}

async function fetchApprovedHolidayDaysUsed({
  workerId,
  dateInLeaveYear,
  settings,
  holidayYearStart,
  excludeRequestId,
  status = 'Approved',
}: {
  workerId: string
  dateInLeaveYear: string
  settings: HolidayCountingSettings
  holidayYearStart: string
  excludeRequestId?: string
  status?: 'Approved' | 'Pending'
}): Promise<number> {
  const bounds = getLeaveYearBounds(dateInLeaveYear, holidayYearStart)
  const buildRequest = (select: string, includePaidFilter: boolean) => {
    let request = requireSupabase()
      .from('holiday_requests')
      .select(select)
      .eq('worker_id', workerId)
      .eq('status', status)
      .gte('end_date', bounds.start)
      .lte('start_date', bounds.end)

    if (includePaidFilter) {
      request = request.eq('is_paid_leave', true)
    }

    if (excludeRequestId) {
      request = request.neq('id', excludeRequestId)
    }

    return request
  }

  let { data, error } = await buildRequest(
    'id, start_date, end_date, leave_type, is_paid_leave, holiday_days_deducted',
    true,
  )

  if (isMissingColumnReadError(error)) {
    const fallback = await buildRequest('id, start_date, end_date', false)
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    throw new HolidayRequestsServiceError(error.message)
  }

  const rows = (data ?? []) as unknown as Array<{
    start_date: string
    end_date: string
    leave_type?: string | null
    holiday_days_deducted?: number | string | null
  }>

  return rows.reduce((total, row) => {
    if (!isPaidHolidayLeaveType(row.leave_type)) return total

    const startDate = row.start_date > bounds.start ? row.start_date : bounds.start
    const endDate = row.end_date < bounds.end ? row.end_date : bounds.end
    const storedDeduction = numberOrNull(row.holiday_days_deducted)
    if (storedDeduction != null) return total + storedDeduction
    const breakdown = calculateHolidayDayBreakdown(startDate, endDate, settings)
    return total + breakdown.holidayDaysDeducted
  }, 0)
}

export async function calculateHolidayRequestBalance(
  input: {
    workerId: string
    startDate: string
    endDate: string
    leaveType?: HolidayLeaveType
    excludeRequestId?: string
  },
): Promise<HolidayBalanceSummary> {
  const { settings, annualAllowance, allowanceKnown, entitlementRules, holidayYearStart } =
    await getHolidayCountingContext()
  const leaveType = input.leaveType ?? 'paid_holiday'

  const workerResult = await requireSupabase()
    .from('drivers')
    .select(
      'employment_type, paid_holiday_enabled, annual_paid_holiday_days, bank_holiday_entitlement_days, unpaid_leave_allowed, holiday_entitlement_notes',
    )
    .eq('id', input.workerId)
    .maybeSingle()
  let workerData: unknown = workerResult.data
  let workerError = workerResult.error

  if (isMissingColumnReadError(workerError)) {
    const fallback = await requireSupabase()
      .from('drivers')
      .select('employment_type')
      .eq('id', input.workerId)
      .maybeSingle()
    workerData = fallback.data
    workerError = fallback.error
  }

  if (workerError) {
    throw new HolidayRequestsServiceError(workerError.message)
  }

  const entitlement = resolveWorkerEntitlement(
    workerData as DriverJoinRow | null,
    entitlementRules,
    annualAllowance,
  )

  const breakdown = calculateHolidayDayBreakdown(input.startDate, input.endDate, settings)
  const usedHolidayDays = await fetchApprovedHolidayDaysUsed({
    workerId: input.workerId,
    dateInLeaveYear: input.startDate,
    settings,
    holidayYearStart,
    excludeRequestId: input.excludeRequestId,
  })
  const pendingHolidayDays = await fetchApprovedHolidayDaysUsed({
    workerId: input.workerId,
    dateInLeaveYear: input.startDate,
    settings,
    holidayYearStart,
    excludeRequestId: input.excludeRequestId,
    status: 'Pending',
  })
  const effectiveAllowanceKnown = allowanceKnown || entitlement.paidHolidayEntitlement > 0
  const effectiveAllowance = entitlement.paidHolidayEntitlement
  const deductibleDays =
    leaveType === 'paid_holiday' && entitlement.paidHolidayEnabled
      ? breakdown.holidayDaysDeducted
      : 0
  const remainingBeforeRequest = effectiveAllowanceKnown
    ? effectiveAllowance - usedHolidayDays
    : Number.NaN
  const remainingAfterRequest = effectiveAllowanceKnown
    ? remainingBeforeRequest - deductibleDays
    : Number.NaN
  const remainingAfterPendingRequests = effectiveAllowanceKnown
    ? remainingBeforeRequest - pendingHolidayDays - deductibleDays
    : Number.NaN

  return {
    ...breakdown,
    holidayDaysDeducted: deductibleDays,
    annualAllowance: effectiveAllowance,
    bankHolidayEntitlementDays: entitlement.bankHolidayEntitlementDays,
    allowanceKnown: effectiveAllowanceKnown,
    usedHolidayDays,
    pendingHolidayDays,
    remainingBeforeRequest,
    remainingAfterRequest,
    remainingAfterPendingRequests,
  }
}

export async function fetchWorkerHolidayBalanceSummary(workerId: string): Promise<HolidayBalanceSummary> {
  const today = toLocalIsoDate(new Date())
  return calculateHolidayRequestBalance({
    workerId,
    startDate: today,
    endDate: today,
    leaveType: 'unpaid_leave',
  })
}

async function assertHolidayBalanceAllowsRequest(input: {
  workerId: string
  startDate: string
  endDate: string
  leaveType?: HolidayLeaveType
  excludeRequestId?: string
}): Promise<HolidayBalanceSummary> {
  const balance = await calculateHolidayRequestBalance(input)

  if (balance.calendarDaysTotal <= 0) {
    throw new HolidayRequestsServiceError('End date must be on or after start date.')
  }

  return balance
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
  const { settings } = await getHolidayCountingContext()

  return {
    items: rows.map((row) => mapRow(row, settings)),
    totalCount: count ?? rows.length,
    page,
    pageSize,
    stats,
  }
}

export async function fetchHolidayCalendarRequests(
  query: HolidayCalendarQuery,
): Promise<HolidayRequest[]> {
  const statuses = query.statuses?.length ? query.statuses : ['Approved', 'Pending']

  let request = requireSupabase()
    .from('holiday_requests')
    .select(holidayRequestSelect)
    .in('status', statuses)
    .gte('end_date', query.dateFrom)
    .lte('start_date', query.dateTo)

  if (query.workerId) {
    request = request.eq('worker_id', query.workerId)
  }

  const { data, error } = await request
    .order('start_date', { ascending: true })
    .order('created_at', { ascending: true })

  logSupabaseQuery({
    service: 'holidayRequestsService.fetchHolidayCalendarRequests',
    table: 'holiday_requests',
    data,
    error,
  })

  if (error) {
    throw new HolidayRequestsServiceError(error.message)
  }

  const rows = (data ?? []) as unknown as HolidayRequestRow[]

  const { settings } = await getHolidayCountingContext()
  const mapped = rows.map((row) => mapRow(row, settings))

  return mapped.sort((left, right) => {
    const byName = left.workerName.localeCompare(right.workerName)
    return byName || left.startDate.localeCompare(right.startDate)
  })
}

export async function checkHolidayRequestCapacity(input: {
  workerId: string
  startDate: string
  endDate: string
  excludeRequestId?: string
}): Promise<HolidayCapacityWarning> {
  const existingRequests = (await fetchHolidayCalendarRequests({
    dateFrom: input.startDate,
    dateTo: input.endDate,
    statuses: ['Approved', 'Pending'],
  })).filter((request) => request.id !== input.excludeRequestId)

  const overLimitDates: string[] = []
  let maxWorkersOff = 0
  let currentDate = input.startDate

  while (currentDate <= input.endDate) {
    const workerIds = new Set(
      existingRequests
        .filter((request) => request.startDate <= currentDate && request.endDate >= currentDate)
        .map((request) => request.workerId),
    )
    workerIds.add(input.workerId)
    maxWorkersOff = Math.max(maxWorkersOff, workerIds.size)

    if (workerIds.size > HOLIDAY_MAX_WORKERS_OFF_PER_DAY) {
      overLimitDates.push(currentDate)
    }

    currentDate = addDaysIso(currentDate, 1)
  }

  return {
    maxWorkersOffPerDay: HOLIDAY_MAX_WORKERS_OFF_PER_DAY,
    maxWorkersOff,
    overLimitDates,
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
  const { settings } = await getHolidayCountingContext()
  return mapRow(data as unknown as HolidayRequestRow, settings)
}

export async function createHolidayRequest(
  input: CreateHolidayRequestInput,
): Promise<HolidayRequest> {
  const balance = await assertHolidayBalanceAllowsRequest(input)
  const leaveType = input.leaveType ?? 'paid_holiday'
  const isPaidLeave = leaveType === 'paid_holiday' || leaveType === 'bank_holiday'

  const payload = {
    worker_id: input.workerId,
    start_date: input.startDate,
    end_date: input.endDate,
    total_days: balance.holidayDaysDeducted,
    leave_type: leaveType,
    is_paid_leave: isPaidLeave,
    holiday_days_deducted: balance.holidayDaysDeducted,
    calendar_days_total: balance.calendarDaysTotal,
    non_working_days_excluded: balance.nonWorkingDaysExcluded,
    reason: input.reason?.trim() || null,
    status: 'Pending',
  }

  const { data, error } = await requireSupabase()
    .from('holiday_requests')
    .insert(payload)
    .select(holidayRequestSelect)
    .single()

  logSupabaseQuery({
    service: 'holidayRequestsService.createHolidayRequest',
    table: 'holiday_requests',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    logHolidayRequestWriteError('holidayRequestsService.createHolidayRequest', error, payload)
    throw new HolidayRequestsServiceError(error.message)
  }

  const { settings } = await getHolidayCountingContext()
  return mapRow(data as unknown as HolidayRequestRow, settings)
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
  if (input.leaveType !== undefined) {
    patch.leave_type = input.leaveType
    patch.is_paid_leave = input.leaveType === 'paid_holiday' || input.leaveType === 'bank_holiday'
  }
  if (input.managerNote !== undefined) patch.manager_note = input.managerNote?.trim() || null

  const shouldRecalculateDays =
    input.startDate !== undefined ||
    input.endDate !== undefined ||
    input.leaveType !== undefined ||
    input.status !== undefined

  if (shouldRecalculateDays) {
    const { data: existing, error: existingError } = await requireSupabase()
      .from('holiday_requests')
      .select('worker_id, start_date, end_date, leave_type')
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
    const leaveType = input.leaveType ?? normalizeLeaveType(existing.leave_type)
    const balance = await assertHolidayBalanceAllowsRequest({
      workerId: existing.worker_id,
      startDate,
      endDate,
      leaveType,
      excludeRequestId: id,
    })

    patch.total_days = balance.holidayDaysDeducted
    patch.holiday_days_deducted = balance.holidayDaysDeducted
    patch.calendar_days_total = balance.calendarDaysTotal
    patch.non_working_days_excluded = balance.nonWorkingDaysExcluded
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

  const { settings } = await getHolidayCountingContext()
  return mapRow(data as unknown as HolidayRequestRow, settings)
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
  fetchHolidayCalendarRequests,
  fetchHolidayRequestById,
  fetchWorkerHolidayBalanceSummary,
  calculateHolidayRequestBalance,
  checkHolidayRequestCapacity,
  createHolidayRequest,
  updateHolidayRequest,
  deleteHolidayRequest,
  approveHolidayRequest,
  rejectHolidayRequest,
}

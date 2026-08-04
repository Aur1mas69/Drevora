import { requireVerifiedCompanyId } from '@/lib/companySettingsGlobals'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import type {
  DriverTimesheetSettingsOverride,
  OvertimeCalculationMethod,
  WeekendRulesScope,
  WorkerTimesheetSettingsForm,
} from '@/lib/workerTimesheetSettingsTypes'
import type { CompanyCurrency, OvertimeMode, RoundTimeMinutes, TimesheetWeekStartDay } from '@/lib/companySettingsTypes'

type DriverTimesheetSettingsRow = {
  driver_id: string
  company_id: string
  created_at: string
  updated_at: string
  overtime_mode: string | null
  overtime_calculation_method: string | null
  overtime_after_hours: number | null
  weekly_overtime_after_hours: number | null
  overtime_multiplier: number | null
  default_break_minutes: number | null
  paid_breaks: boolean | null
  round_time_minutes: number | null
  currency: string | null
  timesheet_week_start_day: string | null
  saturday_overtime_enabled: boolean | null
  saturday_overtime_after_hours: number | null
  saturday_overtime_multiplier: number | null
  saturday_guaranteed_paid_hours: number | null
  saturday_use_company_default_break: boolean | null
  sunday_overtime_enabled: boolean | null
  sunday_overtime_after_hours: number | null
  sunday_overtime_multiplier: number | null
  sunday_guaranteed_paid_hours: number | null
  sunday_use_company_default_break: boolean | null
  default_paid_holiday_hours?: number | null
}

const SELECT_COLUMNS = `
  driver_id,
  company_id,
  created_at,
  updated_at,
  overtime_mode,
  overtime_calculation_method,
  overtime_after_hours,
  weekly_overtime_after_hours,
  overtime_multiplier,
  default_break_minutes,
  paid_breaks,
  round_time_minutes,
  currency,
  timesheet_week_start_day,
  saturday_overtime_enabled,
  saturday_overtime_after_hours,
  saturday_overtime_multiplier,
  saturday_guaranteed_paid_hours,
  saturday_use_company_default_break,
  sunday_overtime_enabled,
  sunday_overtime_after_hours,
  sunday_overtime_multiplier,
  sunday_guaranteed_paid_hours,
  sunday_use_company_default_break,
  default_paid_holiday_hours
`

const SELECT_COLUMNS_WITHOUT_HOLIDAY = `
  driver_id,
  company_id,
  created_at,
  updated_at,
  overtime_mode,
  overtime_calculation_method,
  overtime_after_hours,
  weekly_overtime_after_hours,
  overtime_multiplier,
  default_break_minutes,
  paid_breaks,
  round_time_minutes,
  currency,
  timesheet_week_start_day,
  saturday_overtime_enabled,
  saturday_overtime_after_hours,
  saturday_overtime_multiplier,
  saturday_guaranteed_paid_hours,
  saturday_use_company_default_break,
  sunday_overtime_enabled,
  sunday_overtime_after_hours,
  sunday_overtime_multiplier,
  sunday_guaranteed_paid_hours,
  sunday_use_company_default_break
`

export class WorkerTimesheetSettingsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkerTimesheetSettingsServiceError'
  }
}

function asOvertimeMode(value: string | null): OvertimeMode | null {
  return value === 'Manual' || value === 'Automatic' ? value : null
}

function asOtMethod(value: string | null): OvertimeCalculationMethod | null {
  return value === 'daily' || value === 'weekly' || value === 'none' ? value : null
}

function asRound(value: number | null): RoundTimeMinutes | null {
  return value === 0 || value === 5 || value === 15 ? value : null
}

function asCurrency(value: string | null): CompanyCurrency | null {
  return value === 'GBP' || value === 'EUR' || value === 'USD' || value === 'RUB'
    ? value
    : null
}

function asWeekStart(value: string | null): TimesheetWeekStartDay | null {
  return value === 'monday' || value === 'sunday' ? value : null
}

function isMissingHolidayHoursColumnError(
  error: { message?: string; code?: string } | null,
): boolean {
  if (!error?.message) return false
  const message = error.message.toLowerCase()
  return message.includes('default_paid_holiday_hours')
}

function mapRow(row: DriverTimesheetSettingsRow): DriverTimesheetSettingsOverride {
  return {
    driverId: row.driver_id,
    companyId: row.company_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    overtimeMode: asOvertimeMode(row.overtime_mode),
    overtimeCalculationMethod: asOtMethod(row.overtime_calculation_method),
    overtimeAfterHours: row.overtime_after_hours,
    weeklyOvertimeAfterHours: row.weekly_overtime_after_hours,
    overtimeMultiplier: row.overtime_multiplier,
    defaultBreakMinutes: row.default_break_minutes,
    paidBreaks: row.paid_breaks,
    roundTimeMinutes: asRound(row.round_time_minutes),
    currency: asCurrency(row.currency),
    timesheetWeekStartDay: asWeekStart(row.timesheet_week_start_day),
    saturdayOvertimeEnabled: row.saturday_overtime_enabled,
    saturdayOvertimeAfterHours: row.saturday_overtime_after_hours,
    saturdayOvertimeMultiplier: row.saturday_overtime_multiplier,
    saturdayGuaranteedPaidHours: row.saturday_guaranteed_paid_hours,
    saturdayUseCompanyDefaultBreak: row.saturday_use_company_default_break,
    sundayOvertimeEnabled: row.sunday_overtime_enabled,
    sundayOvertimeAfterHours: row.sunday_overtime_after_hours,
    sundayOvertimeMultiplier: row.sunday_overtime_multiplier,
    sundayGuaranteedPaidHours: row.sunday_guaranteed_paid_hours,
    sundayUseCompanyDefaultBreak: row.sunday_use_company_default_break,
    defaultPaidHolidayHours:
      row.default_paid_holiday_hours === undefined
        ? null
        : row.default_paid_holiday_hours,
  }
}

/**
 * Maps the form to a DB payload. Saturday/Sunday override columns are only
 * included when this company has handed weekend ownership to Workers
 * ("worker" scope). In "company" scope they are omitted entirely (not
 * nulled) so an existing personal weekend override is preserved untouched
 * and simply resumes if Admin switches scope back to "worker" later —
 * saving unrelated settings (e.g. break rules) must never erase it.
 */
function formToPayload(
  form: WorkerTimesheetSettingsForm,
  weekendRulesScope: WeekendRulesScope,
) {
  const payload: Record<string, unknown> = {
    overtime_mode: form.overtimeMode,
    overtime_calculation_method: form.overtimeCalculationMethod,
    overtime_after_hours: form.overtimeAfterHours,
    weekly_overtime_after_hours: form.weeklyOvertimeAfterHours,
    overtime_multiplier: form.overtimeMultiplier,
    default_break_minutes: form.defaultBreakMinutes,
    paid_breaks: form.paidBreaks,
    round_time_minutes: form.roundTimeMinutes,
    currency: form.currency,
    timesheet_week_start_day: form.timesheetWeekStartDay,
    updated_at: new Date().toISOString(),
  }

  if (weekendRulesScope === 'worker') {
    payload.saturday_overtime_enabled = form.saturdayOvertimeEnabled
    payload.saturday_overtime_after_hours = form.saturdayOvertimeAfterHours
    payload.saturday_overtime_multiplier = form.saturdayOvertimeMultiplier
    payload.saturday_guaranteed_paid_hours = form.saturdayGuaranteedPaidHours
    payload.saturday_use_company_default_break = form.saturdayUseCompanyDefaultBreak
    payload.sunday_overtime_enabled = form.sundayOvertimeEnabled
    payload.sunday_overtime_after_hours = form.sundayOvertimeAfterHours
    payload.sunday_overtime_multiplier = form.sundayOvertimeMultiplier
    payload.sunday_guaranteed_paid_hours = form.sundayGuaranteedPaidHours
    payload.sunday_use_company_default_break = form.sundayUseCompanyDefaultBreak
  }

  payload.default_paid_holiday_hours = form.useCompanyDefaultHolidayHours
    ? null
    : form.defaultPaidHolidayHours

  return payload
}

/** Load the authenticated worker's personal override (null = using company defaults). */
export async function fetchOwnDriverTimesheetSettings(
  driverId: string,
): Promise<DriverTimesheetSettingsOverride | null> {
  const companyId = requireVerifiedCompanyId()
  let { data, error } = await requireSupabase()
    .from('driver_timesheet_settings')
    .select(SELECT_COLUMNS)
    .eq('driver_id', driverId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error && isMissingHolidayHoursColumnError(error)) {
    const fallback = await requireSupabase()
      .from('driver_timesheet_settings')
      .select(SELECT_COLUMNS_WITHOUT_HOLIDAY)
      .eq('driver_id', driverId)
      .eq('company_id', companyId)
      .maybeSingle()
    data = fallback.data as typeof data
    error = fallback.error
  }

  logSupabaseQuery({
    service: 'workerTimesheetSettingsService.fetchOwn',
    table: 'driver_timesheet_settings',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new WorkerTimesheetSettingsServiceError(error.message)
  }
  if (!data) return null
  return mapRow(data as DriverTimesheetSettingsRow)
}

/** Office/Admin: load overrides for multiple workers in one company. */
export async function fetchDriverTimesheetSettingsByDriverIds(
  driverIds: string[],
): Promise<Map<string, DriverTimesheetSettingsOverride>> {
  const companyId = requireVerifiedCompanyId()
  const unique = Array.from(new Set(driverIds.filter(Boolean)))
  const result = new Map<string, DriverTimesheetSettingsOverride>()
  if (unique.length === 0) return result

  let { data, error } = await requireSupabase()
    .from('driver_timesheet_settings')
    .select(SELECT_COLUMNS)
    .eq('company_id', companyId)
    .in('driver_id', unique)

  if (error && isMissingHolidayHoursColumnError(error)) {
    const fallback = await requireSupabase()
      .from('driver_timesheet_settings')
      .select(SELECT_COLUMNS_WITHOUT_HOLIDAY)
      .eq('company_id', companyId)
      .in('driver_id', unique)
    data = fallback.data as typeof data
    error = fallback.error
  }

  logSupabaseQuery({
    service: 'workerTimesheetSettingsService.fetchByDriverIds',
    table: 'driver_timesheet_settings',
    data: data ?? [],
    error,
  })

  if (error) {
    throw new WorkerTimesheetSettingsServiceError(error.message)
  }

  for (const row of (data ?? []) as DriverTimesheetSettingsRow[]) {
    result.set(row.driver_id, mapRow(row))
  }
  return result
}

/** Upsert full personal settings snapshot for the authenticated worker. */
export async function saveOwnDriverTimesheetSettings(
  driverId: string,
  form: WorkerTimesheetSettingsForm,
  weekendRulesScope: WeekendRulesScope,
): Promise<DriverTimesheetSettingsOverride> {
  const companyId = requireVerifiedCompanyId()
  const payload: Record<string, unknown> = {
    driver_id: driverId,
    company_id: companyId,
    ...formToPayload(form, weekendRulesScope),
  }

  let { data, error } = await requireSupabase()
    .from('driver_timesheet_settings')
    .upsert(payload, { onConflict: 'driver_id' })
    .select(SELECT_COLUMNS)
    .single()

  if (error && isMissingHolidayHoursColumnError(error)) {
    const withoutHoliday = { ...payload }
    delete withoutHoliday.default_paid_holiday_hours
    const fallback = await requireSupabase()
      .from('driver_timesheet_settings')
      .upsert(withoutHoliday, { onConflict: 'driver_id' })
      .select(SELECT_COLUMNS_WITHOUT_HOLIDAY)
      .single()
    data = fallback.data as typeof data
    error = fallback.error
  }

  logSupabaseQuery({
    service: 'workerTimesheetSettingsService.saveOwn',
    table: 'driver_timesheet_settings',
    data: data ? [data] : [],
    error,
  })

  if (error || !data) {
    throw new WorkerTimesheetSettingsServiceError(
      error?.message ?? 'Unable to save Timesheet settings.',
    )
  }

  return mapRow(data as DriverTimesheetSettingsRow)
}

/** Delete personal override — return to company defaults. */
export async function resetOwnDriverTimesheetSettings(
  driverId: string,
): Promise<void> {
  const companyId = requireVerifiedCompanyId()
  const { error } = await requireSupabase()
    .from('driver_timesheet_settings')
    .delete()
    .eq('driver_id', driverId)
    .eq('company_id', companyId)

  logSupabaseQuery({
    service: 'workerTimesheetSettingsService.resetOwn',
    table: 'driver_timesheet_settings',
    data: [],
    error,
  })

  if (error) {
    throw new WorkerTimesheetSettingsServiceError(error.message)
  }
}

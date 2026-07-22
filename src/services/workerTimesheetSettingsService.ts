import { requireVerifiedCompanyId } from '@/lib/companySettingsGlobals'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import type {
  DriverTimesheetSettingsOverride,
  OvertimeCalculationMethod,
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
  sunday_overtime_enabled: boolean | null
  sunday_overtime_after_hours: number | null
  sunday_overtime_multiplier: number | null
  sunday_guaranteed_paid_hours: number | null
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
  sunday_overtime_enabled,
  sunday_overtime_after_hours,
  sunday_overtime_multiplier,
  sunday_guaranteed_paid_hours
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
    sundayOvertimeEnabled: row.sunday_overtime_enabled,
    sundayOvertimeAfterHours: row.sunday_overtime_after_hours,
    sundayOvertimeMultiplier: row.sunday_overtime_multiplier,
    sundayGuaranteedPaidHours: row.sunday_guaranteed_paid_hours,
  }
}

function formToPayload(form: WorkerTimesheetSettingsForm) {
  return {
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
    saturday_overtime_enabled: form.saturdayOvertimeEnabled,
    saturday_overtime_after_hours: form.saturdayOvertimeAfterHours,
    saturday_overtime_multiplier: form.saturdayOvertimeMultiplier,
    saturday_guaranteed_paid_hours: form.saturdayGuaranteedPaidHours,
    sunday_overtime_enabled: form.sundayOvertimeEnabled,
    sunday_overtime_after_hours: form.sundayOvertimeAfterHours,
    sunday_overtime_multiplier: form.sundayOvertimeMultiplier,
    sunday_guaranteed_paid_hours: form.sundayGuaranteedPaidHours,
    updated_at: new Date().toISOString(),
  }
}

/** Load the authenticated worker's personal override (null = using company defaults). */
export async function fetchOwnDriverTimesheetSettings(
  driverId: string,
): Promise<DriverTimesheetSettingsOverride | null> {
  const companyId = requireVerifiedCompanyId()
  const { data, error } = await requireSupabase()
    .from('driver_timesheet_settings')
    .select(SELECT_COLUMNS)
    .eq('driver_id', driverId)
    .eq('company_id', companyId)
    .maybeSingle()

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

  const { data, error } = await requireSupabase()
    .from('driver_timesheet_settings')
    .select(SELECT_COLUMNS)
    .eq('company_id', companyId)
    .in('driver_id', unique)

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
): Promise<DriverTimesheetSettingsOverride> {
  const companyId = requireVerifiedCompanyId()
  const payload = {
    driver_id: driverId,
    company_id: companyId,
    ...formToPayload(form),
  }

  const { data, error } = await requireSupabase()
    .from('driver_timesheet_settings')
    .upsert(payload, { onConflict: 'driver_id' })
    .select(SELECT_COLUMNS)
    .single()

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

import { COMPANY_UPDATED_EVENT } from '@/lib/companyEvents'
import { resolveCompanyName } from '@/lib/company'
import {
  companySettingsCoreSelect,
  companySettingsHolidayCountingSelect,
  companySettingsConsumablePricesSelect,
  companySettingsMedicalUploadSelect,
  companySettingsSelect,
  companySettingsWeekendSelect,
  companySettingsWeekNumberingSelect,
} from '@/lib/companySettingsColumns'
import {
  DEFAULT_COMPANY_SETTINGS,
  DEFAULT_TIMESHEET_WEEK_SETTINGS,
  type CompanyDateFormat,
  type CompanySettings,
  type CompanySettingsInput,
  type CompanyTheme,
  type CompanyWeekStarts,
  type DefaultBreakMinutes,
  type OvertimeAfterHours,
  type OvertimeMode,
  type OvertimeMultiplier,
  type RoundTimeMinutes,
  type CompanyCurrency,
  type TimesheetWeekStartDay,
  DEFAULT_OVERTIME_MULTIPLIER,
  DEFAULT_CURRENCY,
  DEFAULT_OVERTIME_AFTER_HOURS,
  DEFAULT_SATURDAY_OVERTIME_AFTER_HOURS,
  DEFAULT_SATURDAY_OVERTIME_MULTIPLIER,
  DEFAULT_SUNDAY_OVERTIME_AFTER_HOURS,
  DEFAULT_SUNDAY_OVERTIME_MULTIPLIER,
  OVERTIME_AFTER_HOURS_MAX,
  OVERTIME_AFTER_HOURS_MIN,
  OVERTIME_AFTER_HOURS_OPTIONS,
  OVERTIME_MULTIPLIER_OPTIONS,
  WEEKEND_OVERTIME_AFTER_HOURS_OPTIONS,
  WEEKEND_OVERTIME_MULTIPLIER_OPTIONS,
  CURRENCY_OPTIONS,
  DEFAULT_HOLIDAY_WORKING_DAYS,
  DEFAULT_HOLIDAY_ENTITLEMENT_RULES,
  HOLIDAY_WORKING_DAY_OPTIONS,
  type HolidayEntitlementRules,
  type HolidayEntitlementRule,
  type HolidayCountingMethod,
  type HolidayWorkingDay,
} from '@/lib/companySettingsTypes'
import {
  normalizeConsumableDefaultPrices,
  serializeConsumableDefaultPrices,
  type ConsumableDefaultPricesMap,
} from '@/lib/consumableDefaultPrices'
import { normalizeTimeFormat } from '@/lib/dateTimeFormat'
import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import type { DriverRole } from '@/services/driversService'
import type { VehicleStatus } from '@/services/vehiclesService'

type CompanyRow = {
  id: string
  created_at: string
  name: string | null
  logo_url: string | null
  address: string | null
  city: string | null
  country: string | null
  postcode: string | null
  timezone: string | null
  weather_location: string | null
  date_format: string | null
  time_format: string | null
  week_starts_on: string | null
  fleet_number_prefix: string | null
  default_vehicle_status: string | null
  default_driver_role: string | null
  default_break_minutes: number | null
  paid_breaks: boolean | null
  allow_medical_document_uploads?: boolean | null
  overtime_after_hours: number | null
  overtime_mode: string | null
  overtime_multiplier: number | null
  currency: string | null
  round_time_minutes: number | null
  require_manager_approval: boolean | null
  holiday_year_start: string | null
  annual_leave_allowance: number | null
  theme: string | null
  compact_tables: boolean | null
  email_notifications: boolean | null
  push_notifications: boolean | null
  session_timeout_minutes: number | null
  require_mfa: boolean | null
  saturday_overtime_enabled: boolean | null
  saturday_overtime_after_hours: number | null
  saturday_overtime_multiplier: number | null
  sunday_overtime_enabled: boolean | null
  sunday_overtime_after_hours: number | null
  sunday_overtime_multiplier: number | null
  timesheet_week_start_day: string | null
  timesheet_week_reset_month: number | null
  timesheet_week_reset_day: number | null
  holiday_counting_method: string | null
  holiday_working_days: string[] | null
  holiday_entitlement_rules: unknown | null
  consumable_default_prices: unknown | null
}

export class CompanySettingsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CompanySettingsServiceError'
  }
}

export const COMPANY_NAME_MAX_LENGTH = 80

export function validateCompanyName(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Company name is required.'
  if (trimmed.length > COMPANY_NAME_MAX_LENGTH) {
    return `Company name must be ${COMPANY_NAME_MAX_LENGTH} characters or fewer.`
  }
  return null
}

function normalizeDateFormat(value: string | null | undefined): CompanyDateFormat {
  if (value === 'MDY' || value === 'YMD') return value
  return 'DMY'
}

function normalizeWeekStarts(value: string | null | undefined): CompanyWeekStarts {
  return value === 'sunday' ? 'sunday' : 'monday'
}

function normalizeTheme(value: string | null | undefined): CompanyTheme {
  if (value === 'dark') return 'dark'
  if (value === 'system' || value === 'auto') return 'system'
  return 'light'
}

function normalizeBreakMinutes(value: number | null | undefined): DefaultBreakMinutes {
  if (value === 45 || value === 60) return value
  return 30
}

function normalizePaidBreaks(value: boolean | null | undefined): boolean {
  return value === true
}

function normalizeTimesheetWeekStartDay(
  value: string | null | undefined,
): TimesheetWeekStartDay {
  return value === 'sunday' ? 'sunday' : 'monday'
}

function normalizeHolidayCountingMethod(
  value: string | null | undefined,
): HolidayCountingMethod {
  if (value === 'calendar_days' || value === 'custom_working_week') return value
  return 'working_days'
}

function normalizeHolidayWorkingDays(value: string[] | null | undefined): HolidayWorkingDay[] {
  const allowed = new Set(HOLIDAY_WORKING_DAY_OPTIONS.map((option) => option.value))
  const selected = new Set(
    (value ?? []).filter((day): day is HolidayWorkingDay => allowed.has(day as HolidayWorkingDay)),
  )
  const ordered = HOLIDAY_WORKING_DAY_OPTIONS.map((option) => option.value).filter((day) =>
    selected.has(day),
  )

  return ordered.length > 0 ? ordered : DEFAULT_HOLIDAY_WORKING_DAYS
}

function normalizeHolidayEntitlementNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function normalizeHolidayEntitlementRule(value: unknown): HolidayEntitlementRule {
  const source = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  return {
    paidHolidayEnabled: source.paidHolidayEnabled === true,
    annualPaidHolidayDays: normalizeHolidayEntitlementNumber(source.annualPaidHolidayDays),
    bankHolidayEntitlementDays: normalizeHolidayEntitlementNumber(source.bankHolidayEntitlementDays),
    unpaidLeaveAllowed: source.unpaidLeaveAllowed !== false,
  }
}

function normalizeHolidayEntitlementRules(value: unknown): HolidayEntitlementRules {
  const source = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

  return Object.fromEntries(
    Object.entries(DEFAULT_HOLIDAY_ENTITLEMENT_RULES).map(([employmentType, fallback]) => {
      const rawRule = source[employmentType]
      if (rawRule == null) return [employmentType, fallback]

      return [
        employmentType,
        {
          ...fallback,
          ...normalizeHolidayEntitlementRule(rawRule),
        },
      ]
    }),
  ) as HolidayEntitlementRules
}

function normalizeTimesheetWeekResetMonth(value: number | null | undefined): number {
  if (value == null || value < 1 || value > 12) {
    return DEFAULT_TIMESHEET_WEEK_SETTINGS.timesheetWeekResetMonth
  }
  return value
}

function normalizeTimesheetWeekResetDay(
  value: number | null | undefined,
  month: number = DEFAULT_TIMESHEET_WEEK_SETTINGS.timesheetWeekResetMonth,
): number {
  const maxDay = new Date(2026, month, 0).getDate()
  if (value == null || value < 1 || value > maxDay) {
    return Math.min(DEFAULT_TIMESHEET_WEEK_SETTINGS.timesheetWeekResetDay, maxDay)
  }
  return value
}

function normalizeOvertimeHours(
  value: number | string | null | undefined,
): OvertimeAfterHours {
  if (value == null || value === '') return DEFAULT_OVERTIME_AFTER_HOURS

  const parsed = Number.parseFloat(String(value))
  if (Number.isNaN(parsed)) return DEFAULT_OVERTIME_AFTER_HOURS

  const snapped = Math.round(parsed * 2) / 2
  const clamped = Math.min(
    OVERTIME_AFTER_HOURS_MAX,
    Math.max(OVERTIME_AFTER_HOURS_MIN, snapped),
  )

  if (OVERTIME_AFTER_HOURS_OPTIONS.includes(clamped)) {
    return clamped
  }

  let nearest = DEFAULT_OVERTIME_AFTER_HOURS
  let minDiff = Math.abs(nearest - clamped)

  for (const option of OVERTIME_AFTER_HOURS_OPTIONS) {
    const diff = Math.abs(option - clamped)
    if (diff < minDiff) {
      nearest = option
      minDiff = diff
    }
  }

  return nearest
}

function snapToNearestOption(value: number, options: number[], fallback: number): number {
  if (options.includes(value)) return value

  let nearest = fallback
  let minDiff = Math.abs(nearest - value)

  for (const option of options) {
    const diff = Math.abs(option - value)
    if (diff < minDiff) {
      nearest = option
      minDiff = diff
    }
  }

  return nearest
}

function coerceNumericHours(value: unknown): number {
  if (typeof value === 'number') return value
  return Number.parseFloat(String(value))
}

function normalizeWeekendOvertimeAfterHours(
  value: number | string | null | undefined,
  fallback: number,
): number {
  if (value == null || value === '') return fallback

  const parsed = Number.parseFloat(String(value))
  if (Number.isNaN(parsed)) return fallback

  const snapped = Math.round(parsed * 2) / 2
  const clamped = Math.min(15.5, Math.max(0, snapped))
  return snapToNearestOption(clamped, WEEKEND_OVERTIME_AFTER_HOURS_OPTIONS, fallback)
}

function normalizeWeekendOvertimeMultiplier(
  value: number | string | null | undefined,
  fallback: number,
): number {
  if (value == null || value === '') return fallback

  const parsed = Number.parseFloat(String(value))
  if (Number.isNaN(parsed)) return fallback

  const snapped = Math.round(parsed * 10) / 10
  const clamped = Math.min(2.5, Math.max(1, snapped))
  return snapToNearestOption(clamped, WEEKEND_OVERTIME_MULTIPLIER_OPTIONS, fallback)
}

function normalizeOvertimeMode(value: string | null | undefined): OvertimeMode {
  return value === 'Automatic' ? 'Automatic' : 'Manual'
}

function normalizeOvertimeMultiplier(
  value: number | string | null | undefined,
): OvertimeMultiplier {
  if (value == null || value === '') return DEFAULT_OVERTIME_MULTIPLIER

  const parsed = Number.parseFloat(String(value))
  if (Number.isNaN(parsed)) return DEFAULT_OVERTIME_MULTIPLIER

  const rounded = Math.round(parsed * 10) / 10

  if (OVERTIME_MULTIPLIER_OPTIONS.includes(rounded as OvertimeMultiplier)) {
    return rounded as OvertimeMultiplier
  }

  let nearest: OvertimeMultiplier = DEFAULT_OVERTIME_MULTIPLIER
  let minDiff = Math.abs(nearest - rounded)

  for (const option of OVERTIME_MULTIPLIER_OPTIONS) {
    const diff = Math.abs(option - rounded)
    if (diff < minDiff) {
      nearest = option
      minDiff = diff
    }
  }

  return nearest
}

function normalizeCurrency(value: string | null | undefined): CompanyCurrency {
  const allowed = CURRENCY_OPTIONS.map((option) => option.value)
  return allowed.includes(value as CompanyCurrency) ? (value as CompanyCurrency) : DEFAULT_CURRENCY
}

function normalizeRoundTime(value: number | null | undefined): RoundTimeMinutes {
  if (value === 5 || value === 15) return value
  return 0
}

function normalizeVehicleStatus(value: string | null | undefined): VehicleStatus {
  const allowed: VehicleStatus[] = [
    'Available',
    'Assigned',
    'Workshop',
    'Maintenance',
    'Out of Service',
    'Off Road',
    'Reserved',
  ]
  return allowed.includes(value as VehicleStatus) ? (value as VehicleStatus) : 'Available'
}

function normalizeDriverRole(value: string | null | undefined): DriverRole {
  const allowed: DriverRole[] = [
    'Admin',
    'Driver',
    'Yardman',
    'Cleaner',
    'Supervisor',
    'Mechanic',
    'Transport Manager',
    'Planner',
    'Office Staff',
    'Other',
  ]
  return allowed.includes(value as DriverRole) ? (value as DriverRole) : 'Driver'
}

export function mapCompanySettingsRow(row: CompanyRow): CompanySettings {
  return {
    id: row.id,
    createdAt: row.created_at,
    name: resolveCompanyName(row),
    logoUrl: row.logo_url,
    address: row.address,
    city: row.city,
    country: row.country,
    postcode: row.postcode,
    timezone: row.timezone?.trim() || DEFAULT_COMPANY_SETTINGS.timezone,
    weatherLocation: row.weather_location,
    dateFormat: normalizeDateFormat(row.date_format),
    timeFormat: normalizeTimeFormat(row.time_format),
    weekStarts: normalizeWeekStarts(row.week_starts_on),
    fleetNumberPrefix: row.fleet_number_prefix?.trim() ?? '',
    defaultVehicleStatus: normalizeVehicleStatus(row.default_vehicle_status),
    defaultDriverRole: normalizeDriverRole(row.default_driver_role),
    defaultBreakMinutes: normalizeBreakMinutes(row.default_break_minutes),
    paidBreaks: normalizePaidBreaks(row.paid_breaks),
    allowMedicalDocumentUploads: normalizePaidBreaks(row.allow_medical_document_uploads),
    overtimeAfterHours: normalizeOvertimeHours(row.overtime_after_hours),
    overtimeMode: normalizeOvertimeMode(row.overtime_mode),
    overtimeMultiplier: normalizeOvertimeMultiplier(row.overtime_multiplier),
    currency: normalizeCurrency(row.currency),
    roundTimeMinutes: normalizeRoundTime(row.round_time_minutes),
    requireTimesheetApproval: row.require_manager_approval ?? true,
    holidayYearStart: row.holiday_year_start?.trim() || '01-01',
    annualLeaveAllowance: row.annual_leave_allowance ?? 28,
    theme: normalizeTheme(row.theme),
    compactTables: row.compact_tables ?? false,
    emailNotifications: row.email_notifications ?? true,
    pushNotifications: row.push_notifications ?? false,
    sessionTimeoutMinutes: row.session_timeout_minutes ?? 480,
    requireMfa: row.require_mfa ?? false,
    saturdayOvertimeEnabled: row.saturday_overtime_enabled ?? false,
    saturdayOvertimeAfterHours: normalizeWeekendOvertimeAfterHours(
      row.saturday_overtime_after_hours,
      DEFAULT_SATURDAY_OVERTIME_AFTER_HOURS,
    ),
    saturdayOvertimeMultiplier: normalizeWeekendOvertimeMultiplier(
      row.saturday_overtime_multiplier,
      DEFAULT_SATURDAY_OVERTIME_MULTIPLIER,
    ),
    sundayOvertimeEnabled: row.sunday_overtime_enabled ?? false,
    sundayOvertimeAfterHours: normalizeWeekendOvertimeAfterHours(
      row.sunday_overtime_after_hours,
      DEFAULT_SUNDAY_OVERTIME_AFTER_HOURS,
    ),
    sundayOvertimeMultiplier: normalizeWeekendOvertimeMultiplier(
      row.sunday_overtime_multiplier,
      DEFAULT_SUNDAY_OVERTIME_MULTIPLIER,
    ),
    timesheetWeekStartDay: normalizeTimesheetWeekStartDay(row.timesheet_week_start_day),
    timesheetWeekResetMonth: normalizeTimesheetWeekResetMonth(row.timesheet_week_reset_month),
    timesheetWeekResetDay: normalizeTimesheetWeekResetDay(
      row.timesheet_week_reset_day,
      normalizeTimesheetWeekResetMonth(row.timesheet_week_reset_month),
    ),
    holidayCountingMethod: normalizeHolidayCountingMethod(row.holiday_counting_method),
    holidayWorkingDays: normalizeHolidayWorkingDays(row.holiday_working_days),
    holidayEntitlementRules: normalizeHolidayEntitlementRules(row.holiday_entitlement_rules),
    consumableDefaultPrices: normalizeConsumableDefaultPrices(
      row.consumable_default_prices ?? {},
    ),
  }
}

export function companySettingsToFormValues(
  settings: CompanySettings | null,
): CompanySettingsInput {
  if (!settings) return { ...DEFAULT_COMPANY_SETTINGS }

  return {
    name: settings.name ?? '',
    logoUrl: settings.logoUrl ?? '',
    address: settings.address ?? '',
    city: settings.city ?? '',
    country: settings.country ?? '',
    postcode: settings.postcode ?? '',
    timezone: settings.timezone,
    weatherLocation: settings.weatherLocation ?? '',
    dateFormat: settings.dateFormat,
    timeFormat: settings.timeFormat,
    weekStarts: settings.weekStarts,
    fleetNumberPrefix: settings.fleetNumberPrefix,
    defaultVehicleStatus: settings.defaultVehicleStatus,
    defaultDriverRole: settings.defaultDriverRole,
    defaultBreakMinutes: settings.defaultBreakMinutes,
    paidBreaks: settings.paidBreaks,
    allowMedicalDocumentUploads: settings.allowMedicalDocumentUploads,
    overtimeAfterHours: settings.overtimeAfterHours,
    overtimeMode: settings.overtimeMode,
    overtimeMultiplier: settings.overtimeMultiplier,
    currency: settings.currency,
    roundTimeMinutes: settings.roundTimeMinutes,
    requireTimesheetApproval: settings.requireTimesheetApproval,
    holidayYearStart: settings.holidayYearStart,
    annualLeaveAllowance: settings.annualLeaveAllowance,
    theme: settings.theme,
    compactTables: settings.compactTables,
    emailNotifications: settings.emailNotifications,
    pushNotifications: settings.pushNotifications,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
    requireMfa: settings.requireMfa,
    saturdayOvertimeEnabled: settings.saturdayOvertimeEnabled,
    saturdayOvertimeAfterHours: settings.saturdayOvertimeAfterHours,
    saturdayOvertimeMultiplier: settings.saturdayOvertimeMultiplier,
    sundayOvertimeEnabled: settings.sundayOvertimeEnabled,
    sundayOvertimeAfterHours: settings.sundayOvertimeAfterHours,
    sundayOvertimeMultiplier: settings.sundayOvertimeMultiplier,
    timesheetWeekStartDay: settings.timesheetWeekStartDay,
    timesheetWeekResetMonth: settings.timesheetWeekResetMonth,
    timesheetWeekResetDay: settings.timesheetWeekResetDay,
    holidayCountingMethod: settings.holidayCountingMethod,
    holidayWorkingDays: settings.holidayWorkingDays,
    holidayEntitlementRules: settings.holidayEntitlementRules,
  }
}

function toDbPayload(input: Partial<CompanySettingsInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  // Company name is locked in Settings UI; not editable via this form.
  if (input.logoUrl !== undefined) payload.logo_url = input.logoUrl.trim() || null
  if (input.address !== undefined) payload.address = input.address.trim() || null
  if (input.city !== undefined) payload.city = input.city.trim() || null
  if (input.country !== undefined) payload.country = input.country.trim() || null
  if (input.postcode !== undefined) payload.postcode = input.postcode.trim() || null
  if (input.timezone !== undefined) {
    payload.timezone = input.timezone.trim() || DEFAULT_COMPANY_SETTINGS.timezone
  }
  if (input.weatherLocation !== undefined) {
    payload.weather_location = input.weatherLocation.trim() || null
  }
  if (input.dateFormat !== undefined) payload.date_format = input.dateFormat
  if (input.timeFormat !== undefined) {
    payload.time_format = normalizeTimeFormat(input.timeFormat)
  }
  if (input.weekStarts !== undefined) payload.week_starts_on = input.weekStarts
  if (input.fleetNumberPrefix !== undefined) {
    payload.fleet_number_prefix = input.fleetNumberPrefix.trim()
  }
  if (input.defaultVehicleStatus !== undefined) {
    payload.default_vehicle_status = input.defaultVehicleStatus
  }
  if (input.defaultDriverRole !== undefined) {
    payload.default_driver_role = input.defaultDriverRole
  }
  if (input.defaultBreakMinutes !== undefined) {
    payload.default_break_minutes = input.defaultBreakMinutes
  }
  if (input.paidBreaks !== undefined) {
    payload.paid_breaks = normalizePaidBreaks(input.paidBreaks)
  }
  if (input.allowMedicalDocumentUploads !== undefined) {
    payload.allow_medical_document_uploads = normalizePaidBreaks(
      input.allowMedicalDocumentUploads,
    )
  }
  if (input.overtimeAfterHours !== undefined) {
    payload.overtime_after_hours = normalizeOvertimeHours(
      coerceNumericHours(input.overtimeAfterHours),
    )
  }
  if (input.overtimeMode !== undefined) {
    payload.overtime_mode = input.overtimeMode
  }
  if (input.overtimeMultiplier !== undefined) {
    payload.overtime_multiplier = normalizeOvertimeMultiplier(
      coerceNumericHours(input.overtimeMultiplier),
    )
  }
  if (input.currency !== undefined) {
    payload.currency = input.currency
  }
  if (input.roundTimeMinutes !== undefined) {
    payload.round_time_minutes = input.roundTimeMinutes
  }
  if (input.requireTimesheetApproval !== undefined) {
    payload.require_manager_approval = input.requireTimesheetApproval
  }
  if (input.holidayYearStart !== undefined) {
    payload.holiday_year_start = input.holidayYearStart.trim() || '01-01'
  }
  if (input.annualLeaveAllowance !== undefined) {
    payload.annual_leave_allowance = input.annualLeaveAllowance
  }
  if (input.theme !== undefined) payload.theme = input.theme
  if (input.compactTables !== undefined) payload.compact_tables = input.compactTables
  if (input.emailNotifications !== undefined) {
    payload.email_notifications = input.emailNotifications
  }
  if (input.pushNotifications !== undefined) {
    payload.push_notifications = input.pushNotifications
  }
  if (input.sessionTimeoutMinutes !== undefined) {
    payload.session_timeout_minutes = input.sessionTimeoutMinutes
  }
  if (input.requireMfa !== undefined) payload.require_mfa = input.requireMfa
  if (input.saturdayOvertimeEnabled !== undefined) {
    payload.saturday_overtime_enabled = input.saturdayOvertimeEnabled
  }
  if (input.saturdayOvertimeAfterHours !== undefined) {
    payload.saturday_overtime_after_hours = normalizeWeekendOvertimeAfterHours(
      coerceNumericHours(input.saturdayOvertimeAfterHours),
      DEFAULT_SATURDAY_OVERTIME_AFTER_HOURS,
    )
  }
  if (input.saturdayOvertimeMultiplier !== undefined) {
    payload.saturday_overtime_multiplier = normalizeWeekendOvertimeMultiplier(
      coerceNumericHours(input.saturdayOvertimeMultiplier),
      DEFAULT_SATURDAY_OVERTIME_MULTIPLIER,
    )
  }
  if (input.sundayOvertimeEnabled !== undefined) {
    payload.sunday_overtime_enabled = input.sundayOvertimeEnabled
  }
  if (input.sundayOvertimeAfterHours !== undefined) {
    payload.sunday_overtime_after_hours = normalizeWeekendOvertimeAfterHours(
      coerceNumericHours(input.sundayOvertimeAfterHours),
      DEFAULT_SUNDAY_OVERTIME_AFTER_HOURS,
    )
  }
  if (input.sundayOvertimeMultiplier !== undefined) {
    payload.sunday_overtime_multiplier = normalizeWeekendOvertimeMultiplier(
      coerceNumericHours(input.sundayOvertimeMultiplier),
      DEFAULT_SUNDAY_OVERTIME_MULTIPLIER,
    )
  }
  if (input.timesheetWeekStartDay !== undefined) {
    payload.timesheet_week_start_day = normalizeTimesheetWeekStartDay(input.timesheetWeekStartDay)
  }
  if (input.timesheetWeekResetMonth !== undefined) {
    payload.timesheet_week_reset_month = normalizeTimesheetWeekResetMonth(
      input.timesheetWeekResetMonth,
    )
  }
  if (input.timesheetWeekResetDay !== undefined) {
    const month =
      input.timesheetWeekResetMonth ?? DEFAULT_TIMESHEET_WEEK_SETTINGS.timesheetWeekResetMonth
    payload.timesheet_week_reset_day = normalizeTimesheetWeekResetDay(
      input.timesheetWeekResetDay,
      month,
    )
  }
  if (input.holidayCountingMethod !== undefined) {
    payload.holiday_counting_method = normalizeHolidayCountingMethod(input.holidayCountingMethod)
  }
  if (input.holidayWorkingDays !== undefined) {
    payload.holiday_working_days = normalizeHolidayWorkingDays(input.holidayWorkingDays)
  }
  if (input.holidayEntitlementRules !== undefined) {
    payload.holiday_entitlement_rules = normalizeHolidayEntitlementRules(input.holidayEntitlementRules)
  }

  return payload
}

function logCompanySettingsPersistenceError(
  action: 'update' | 'insert' | 'select',
  table: string,
  payload: Record<string, unknown> | null,
  error: { message?: string; details?: string; hint?: string; code?: string } | null,
): void {
  console.error(`[companySettingsService.${action}] table: public.${table}`, {
    payload,
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    code: error?.code ?? null,
  })
}

async function updateCompanyRecord(
  companyId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const table = 'companies'
  const { error } = await requireSupabase()
    .from('companies')
    .update(payload)
    .eq('id', companyId)

  if (!error) return

  logCompanySettingsPersistenceError('update', table, payload, error)
  throw new CompanySettingsServiceError(error.message)
}

function isMissingColumnError(error: { message?: string; code?: string; details?: string } | null): boolean {
  if (!error) return false

  const message = error.message?.toLowerCase() ?? ''
  const details = error.details?.toLowerCase() ?? ''

  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    message.includes('schema cache') ||
    (message.includes('column') &&
      (message.includes('does not exist') ||
        message.includes('not found') ||
        message.includes('could not find'))) ||
    details.includes('column')
  )
}

async function queryCompanyRow(companyId: string, select: string) {
  return requireSupabase()
    .from('companies')
    .select(select)
    .eq('id', companyId)
    .maybeSingle()
}

async function fetchAlternateCompanyName(companyId: string): Promise<string | null> {
  for (const column of ['company_name', 'organisation_name'] as const) {
    const { data, error } = await requireSupabase()
      .from('companies')
      .select(column)
      .eq('id', companyId)
      .maybeSingle()

    if (error) {
      if (isMissingColumnError(error)) continue
      break
    }

    const value = (data as Record<string, string | null> | null)?.[column]?.trim()
    if (value) return value
  }

  return null
}

async function mergeOptionalConsumableDefaultPrices(
  companyId: string,
  row: CompanyRow,
): Promise<CompanyRow> {
  const { data: consumablePricesData, error: consumablePricesError } = await queryCompanyRow(
    companyId,
    companySettingsConsumablePricesSelect,
  )

  if (!consumablePricesError && consumablePricesData) {
    return {
      ...row,
      ...(consumablePricesData as unknown as Record<string, unknown>),
    } as CompanyRow
  }

  if (consumablePricesError) {
    logCompanySettingsPersistenceError(
      'select',
      'companies',
      { select: companySettingsConsumablePricesSelect, optional: 'consumable_default_prices' },
      consumablePricesError,
    )
  }

  return row
}

async function loadCompanySettingsRow(companyId: string): Promise<CompanyRow | null> {
  const table = 'companies'
  const { data, error } = await queryCompanyRow(companyId, companySettingsSelect)

  logSupabaseQuery({
    service: 'companySettingsService.fetchCompanySettingsById',
    table,
    data: data ? [data] : [],
    error,
  })

  if (!error && data) {
    return mergeOptionalConsumableDefaultPrices(companyId, data as unknown as CompanyRow)
  }

  if (error && !isMissingColumnError(error)) {
    logCompanySettingsPersistenceError(
      'select',
      table,
      { select: companySettingsSelect, companyId },
      error,
    )
    throw new CompanySettingsServiceError(error.message)
  }

  if (error) {
    logCompanySettingsPersistenceError(
      'select',
      table,
      { select: companySettingsSelect, fallback: 'core', companyId },
      error,
    )
  }

  const { data: coreData, error: coreError } = await queryCompanyRow(
    companyId,
    companySettingsCoreSelect,
  )

  logSupabaseQuery({
    service: 'companySettingsService.fetchCompanySettingsById.coreFallback',
    table,
    data: coreData ? [coreData] : [],
    error: coreError,
  })

  if (coreError) {
    logCompanySettingsPersistenceError(
      'select',
      table,
      { select: companySettingsCoreSelect, companyId },
      coreError,
    )
    throw new CompanySettingsServiceError(coreError.message)
  }

  if (!coreData) return null

  let merged = { ...(coreData as unknown as Record<string, unknown>) }

  const { data: weekendData, error: weekendError } = await queryCompanyRow(
    companyId,
    companySettingsWeekendSelect,
  )

  if (!weekendError && weekendData) {
    merged = { ...merged, ...(weekendData as unknown as Record<string, unknown>) }
  } else if (weekendError) {
    logCompanySettingsPersistenceError(
      'select',
      table,
      { select: companySettingsWeekendSelect, optional: 'weekend_overtime', companyId },
      weekendError,
    )
  }

  const { data: weekNumberingData, error: weekNumberingError } = await queryCompanyRow(
    companyId,
    companySettingsWeekNumberingSelect,
  )

  if (!weekNumberingError && weekNumberingData) {
    merged = { ...merged, ...(weekNumberingData as unknown as Record<string, unknown>) }
  } else if (weekNumberingError) {
    logCompanySettingsPersistenceError(
      'select',
      table,
      {
        select: companySettingsWeekNumberingSelect,
        optional: 'timesheet_week_numbering',
        companyId,
      },
      weekNumberingError,
    )
  }

  const { data: medicalUploadData, error: medicalUploadError } = await queryCompanyRow(
    companyId,
    companySettingsMedicalUploadSelect,
  )

  if (!medicalUploadError && medicalUploadData) {
    merged = { ...merged, ...(medicalUploadData as unknown as Record<string, unknown>) }
  } else if (medicalUploadError) {
    logCompanySettingsPersistenceError(
      'select',
      table,
      {
        select: companySettingsMedicalUploadSelect,
        optional: 'allow_medical_document_uploads',
        companyId,
      },
      medicalUploadError,
    )
  }

  const { data: holidayCountingData, error: holidayCountingError } = await queryCompanyRow(
    companyId,
    companySettingsHolidayCountingSelect,
  )

  if (!holidayCountingError && holidayCountingData) {
    merged = { ...merged, ...(holidayCountingData as unknown as Record<string, unknown>) }
  } else if (holidayCountingError) {
    logCompanySettingsPersistenceError(
      'select',
      table,
      { select: companySettingsHolidayCountingSelect, optional: 'holiday_counting', companyId },
      holidayCountingError,
    )
  }

  const { data: consumablePricesData, error: consumablePricesError } = await queryCompanyRow(
    companyId,
    companySettingsConsumablePricesSelect,
  )

  if (!consumablePricesError && consumablePricesData) {
    merged = { ...merged, ...(consumablePricesData as unknown as Record<string, unknown>) }
  } else if (consumablePricesError) {
    logCompanySettingsPersistenceError(
      'select',
      table,
      {
        select: companySettingsConsumablePricesSelect,
        optional: 'consumable_default_prices',
        companyId,
      },
      consumablePricesError,
    )
  }

  return merged as unknown as CompanyRow
}

async function resolveAuthenticatedCompanyId(): Promise<string | null> {
  const { getVerifiedCompanyId } = await import('@/lib/companySettingsGlobals')
  const verifiedId = getVerifiedCompanyId()
  if (verifiedId) {
    return verifiedId
  }

  const { resolveCurrentCompanyId } = await import('@/services/companyMembershipService')
  return resolveCurrentCompanyId()
}

async function mapLoadedCompanyRow(row: CompanyRow): Promise<CompanySettings> {
  const mapped = mapCompanySettingsRow(row)

  if (mapped.name?.trim()) {
    return mapped
  }

  const alternateName = await fetchAlternateCompanyName(row.id)
  if (!alternateName) {
    return mapped
  }

  return { ...mapped, name: alternateName }
}

/**
 * Load company settings for a specific companies.id.
 * Used after company_members resolves the authenticated tenant.
 */
export async function fetchCompanySettingsById(
  companyId: string,
): Promise<CompanySettings | null> {
  if (!isSupabaseConfigured) {
    return null
  }

  const normalizedId = companyId.trim()
  if (!normalizedId) {
    return null
  }

  const row = await loadCompanySettingsRow(normalizedId)
  return row ? mapLoadedCompanyRow(row) : null
}

/**
 * Load settings for the authenticated membership company.
 * Never selects the oldest/first companies row.
 */
export async function fetchCompanySettings(): Promise<CompanySettings | null> {
  if (!isSupabaseConfigured) {
    return null
  }

  const companyId = await resolveAuthenticatedCompanyId()
  if (!companyId) {
    return null
  }

  return fetchCompanySettingsById(companyId)
}

export async function saveCompanySettings(
  input: CompanySettingsInput,
): Promise<CompanySettings> {
  return updateCompanySettings(input)
}

export async function updateCompanySettings(
  input: Partial<CompanySettingsInput>,
): Promise<CompanySettings> {
  const companyId = await resolveAuthenticatedCompanyId()
  if (!companyId) {
    throw new CompanySettingsServiceError(
      'No active company membership. Company settings cannot be saved.',
    )
  }

  const payload = toDbPayload(input)
  if (Object.keys(payload).length === 0) {
    const existing = await fetchCompanySettingsById(companyId)
    if (!existing) {
      throw new CompanySettingsServiceError('No company settings record found')
    }
    return existing
  }

  const existing = await fetchCompanySettingsById(companyId)
  if (!existing) {
    throw new CompanySettingsServiceError(
      'Company settings not found for your membership company.',
    )
  }

  await updateCompanyRecord(existing.id, payload)

  const refreshed = await fetchCompanySettingsById(existing.id)
  if (!refreshed) {
    throw new CompanySettingsServiceError('Unable to reload company settings after save')
  }
  return refreshed
}

export async function updateConsumableDefaultPrices(
  prices: ConsumableDefaultPricesMap,
): Promise<CompanySettings> {
  if (!isSupabaseConfigured) {
    throw new CompanySettingsServiceError('Supabase is not configured')
  }

  const companyId = await resolveAuthenticatedCompanyId()
  if (!companyId) {
    throw new CompanySettingsServiceError(
      'No active company membership. Default prices cannot be saved.',
    )
  }

  const existing = await fetchCompanySettingsById(companyId)
  if (!existing) {
    throw new CompanySettingsServiceError('Company settings not found')
  }

  const payload = {
    consumable_default_prices: serializeConsumableDefaultPrices(prices),
  }

  const { error } = await requireSupabase()
    .from('companies')
    .update(payload)
    .eq('id', existing.id)

  if (error) {
    logCompanySettingsPersistenceError('update', 'companies', payload, error)
    if (isMissingColumnError(error)) {
      throw new CompanySettingsServiceError(
        'Default consumable prices are not available yet. Run the consumable_default_prices database migration in Supabase first.',
      )
    }
    throw new CompanySettingsServiceError(error.message)
  }

  const refreshed = await fetchCompanySettingsById(existing.id)
  if (!refreshed) {
    throw new CompanySettingsServiceError('Unable to reload company settings after save')
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(COMPANY_UPDATED_EVENT))
  }

  return refreshed
}

export const companySettingsService = {
  fetchCompanySettings,
  fetchCompanySettingsById,
  saveCompanySettings,
  updateCompanySettings,
  updateConsumableDefaultPrices,
  companySettingsToFormValues,
  mapCompanySettingsRow,
  validateCompanyName,
}

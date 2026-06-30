import { companySettingsSelect } from '@/lib/companySettingsColumns'
import {
  DEFAULT_COMPANY_SETTINGS,
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
  DEFAULT_OVERTIME_MULTIPLIER,
  OVERTIME_MULTIPLIER_OPTIONS,
} from '@/lib/companySettingsTypes'
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
  overtime_after_hours: number | null
  overtime_mode: string | null
  overtime_multiplier: number | null
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
}

export class CompanySettingsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CompanySettingsServiceError'
  }
}

function normalizeDateFormat(value: string | null | undefined): CompanyDateFormat {
  if (value === 'MDY' || value === 'YMD') return value
  return 'DMY'
}

function normalizeWeekStarts(value: string | null | undefined): CompanyWeekStarts {
  return value === 'sunday' ? 'sunday' : 'monday'
}

function normalizeTheme(value: string | null | undefined): CompanyTheme {
  if (value === 'dark' || value === 'auto') return value
  return 'light'
}

function normalizeBreakMinutes(value: number | null | undefined): DefaultBreakMinutes {
  if (value === 45 || value === 60) return value
  return 30
}

function normalizeOvertimeHours(value: number | null | undefined): OvertimeAfterHours {
  if (value === 9 || value === 10) return value
  return 8
}

function normalizeOvertimeMode(value: string | null | undefined): OvertimeMode {
  return value === 'Automatic' ? 'Automatic' : 'Manual'
}

function normalizeOvertimeMultiplier(
  value: number | null | undefined,
): OvertimeMultiplier {
  if (value != null && OVERTIME_MULTIPLIER_OPTIONS.includes(value as OvertimeMultiplier)) {
    return value as OvertimeMultiplier
  }
  return DEFAULT_OVERTIME_MULTIPLIER
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
    name: row.name,
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
    overtimeAfterHours: normalizeOvertimeHours(row.overtime_after_hours),
    overtimeMode: normalizeOvertimeMode(row.overtime_mode),
    overtimeMultiplier: normalizeOvertimeMultiplier(row.overtime_multiplier),
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
    overtimeAfterHours: settings.overtimeAfterHours,
    overtimeMode: settings.overtimeMode,
    overtimeMultiplier: settings.overtimeMultiplier,
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
  }
}

function toDbPayload(input: Partial<CompanySettingsInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  // Company name is set at registration and is not editable via Settings.
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
  if (input.overtimeAfterHours !== undefined) {
    payload.overtime_after_hours = input.overtimeAfterHours
  }
  if (input.overtimeMode !== undefined) {
    payload.overtime_mode = input.overtimeMode
  }
  if (input.overtimeMultiplier !== undefined) {
    payload.overtime_multiplier = input.overtimeMultiplier
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

  return payload
}

export async function fetchCompanySettings(): Promise<CompanySettings | null> {
  if (!isSupabaseConfigured) {
    return null
  }

  const table = 'companies'
  const { data, error } = await requireSupabase()
    .from(table)
    .select(companySettingsSelect)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  logSupabaseQuery({
    service: 'companySettingsService.fetchCompanySettings',
    table,
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new CompanySettingsServiceError(error.message)
  }

  return data ? mapCompanySettingsRow(data as unknown as CompanyRow) : null
}

export async function saveCompanySettings(
  input: CompanySettingsInput,
): Promise<CompanySettings> {
  return updateCompanySettings(input)
}

export async function updateCompanySettings(
  input: Partial<CompanySettingsInput>,
): Promise<CompanySettings> {
  const payload = toDbPayload(input)
  if (Object.keys(payload).length === 0) {
    const existing = await fetchCompanySettings()
    if (!existing) {
      throw new CompanySettingsServiceError('No company settings record found')
    }
    return existing
  }

  const existing = await fetchCompanySettings()

  if (existing) {
    const { data, error } = await requireSupabase()
      .from('companies')
      .update(payload)
      .eq('id', existing.id)
      .select(companySettingsSelect)
      .single()

    if (error) throw new CompanySettingsServiceError(error.message)
    return mapCompanySettingsRow(data as unknown as CompanyRow)
  }

  const merged: CompanySettingsInput = { ...DEFAULT_COMPANY_SETTINGS, ...input }
  const { data, error } = await requireSupabase()
    .from('companies')
    .insert(toDbPayload(merged))
    .select(companySettingsSelect)
    .single()

  if (error) throw new CompanySettingsServiceError(error.message)
  return mapCompanySettingsRow(data as unknown as CompanyRow)
}

export const companySettingsService = {
  fetchCompanySettings,
  saveCompanySettings,
  updateCompanySettings,
  companySettingsToFormValues,
  mapCompanySettingsRow,
}

import type { CompanyTimeFormat } from '@/lib/dateTimeFormat'
import type { DriverRole } from '@/services/driversService'
import type { VehicleStatus } from '@/services/vehiclesService'

export type CompanyDateFormat = 'DMY' | 'MDY' | 'YMD'
export type CompanyWeekStarts = 'monday' | 'sunday'
export type TimesheetWeekStartDay = 'monday' | 'sunday'

export type TimesheetWeekSettings = {
  timesheetWeekStartDay: TimesheetWeekStartDay
  timesheetWeekResetMonth: number
  timesheetWeekResetDay: number
}

export const DEFAULT_TIMESHEET_WEEK_SETTINGS: TimesheetWeekSettings = {
  timesheetWeekStartDay: 'monday',
  timesheetWeekResetMonth: 4,
  timesheetWeekResetDay: 5,
}

export type CompanyTheme = 'light' | 'dark' | 'system'
export type DefaultBreakMinutes = 30 | 45 | 60
export type OvertimeAfterHours = number
export type OvertimeMode = 'Manual' | 'Automatic'
export type OvertimeMultiplier =
  | 1.1
  | 1.2
  | 1.3
  | 1.4
  | 1.5
  | 1.6
  | 1.7
  | 1.8
  | 1.9
  | 2
  | 2.1
  | 2.2
  | 2.3
  | 2.4
  | 2.5
export type RoundTimeMinutes = 0 | 5 | 15
export type CompanyCurrency = 'GBP' | 'EUR' | 'USD' | 'RUB'

export const OVERTIME_MULTIPLIER_OPTIONS: OvertimeMultiplier[] = [
  1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.1, 2.2, 2.3, 2.4, 2.5,
]
export const DEFAULT_OVERTIME_MULTIPLIER: OvertimeMultiplier = 1.5

export const OVERTIME_AFTER_HOURS_MIN = 5.5
export const OVERTIME_AFTER_HOURS_MAX = 15.5
export const OVERTIME_AFTER_HOURS_STEP = 0.5

export const OVERTIME_AFTER_HOURS_OPTIONS: OvertimeAfterHours[] = Array.from(
  { length: Math.round((OVERTIME_AFTER_HOURS_MAX - OVERTIME_AFTER_HOURS_MIN) / OVERTIME_AFTER_HOURS_STEP) + 1 },
  (_, index) =>
    Math.round((OVERTIME_AFTER_HOURS_MIN + index * OVERTIME_AFTER_HOURS_STEP) * 10) / 10,
)

export const DEFAULT_OVERTIME_AFTER_HOURS: OvertimeAfterHours = 10.5

export function formatOvertimeAfterHoursLabel(hours: OvertimeAfterHours): string {
  return `${hours.toFixed(1)} hours`
}

export const WEEKEND_OVERTIME_AFTER_HOURS_MAX = 15.5
export const WEEKEND_OVERTIME_AFTER_HOURS_STEP = 0.5

export const WEEKEND_OVERTIME_AFTER_HOURS_OPTIONS: number[] = Array.from(
  {
    length:
      Math.round(WEEKEND_OVERTIME_AFTER_HOURS_MAX / WEEKEND_OVERTIME_AFTER_HOURS_STEP) + 1,
  },
  (_, index) => Math.round(index * WEEKEND_OVERTIME_AFTER_HOURS_STEP * 10) / 10,
)

export const WEEKEND_OVERTIME_MULTIPLIER_OPTIONS: number[] = Array.from(
  { length: 16 },
  (_, index) => Math.round((1 + index * 0.1) * 10) / 10,
)

export const DEFAULT_SATURDAY_OVERTIME_AFTER_HOURS = 6
export const DEFAULT_SATURDAY_OVERTIME_MULTIPLIER = 1.5
export const DEFAULT_SUNDAY_OVERTIME_AFTER_HOURS = 0
export const DEFAULT_SUNDAY_OVERTIME_MULTIPLIER = 2

export function formatWeekendOvertimeAfterHoursLabel(hours: number): string {
  if (hours === 0) return '0.0 hours — from first hour'
  return `${hours.toFixed(1)} hours`
}

export function formatWeekendOvertimeMultiplierLabel(value: number): string {
  return `${value.toFixed(1)}x`
}

export type TimesheetOvertimeRules = {
  overtimeAfterHours: number
  overtimeMultiplier: number
  saturdayOvertimeEnabled: boolean
  saturdayOvertimeAfterHours: number
  saturdayOvertimeMultiplier: number
  sundayOvertimeEnabled: boolean
  sundayOvertimeAfterHours: number
  sundayOvertimeMultiplier: number
}

export const DEFAULT_TIMESHEET_OVERTIME_RULES: TimesheetOvertimeRules = {
  overtimeAfterHours: DEFAULT_OVERTIME_AFTER_HOURS,
  overtimeMultiplier: DEFAULT_OVERTIME_MULTIPLIER,
  saturdayOvertimeEnabled: false,
  saturdayOvertimeAfterHours: DEFAULT_SATURDAY_OVERTIME_AFTER_HOURS,
  saturdayOvertimeMultiplier: DEFAULT_SATURDAY_OVERTIME_MULTIPLIER,
  sundayOvertimeEnabled: false,
  sundayOvertimeAfterHours: DEFAULT_SUNDAY_OVERTIME_AFTER_HOURS,
  sundayOvertimeMultiplier: DEFAULT_SUNDAY_OVERTIME_MULTIPLIER,
}

export const THEME_OPTIONS: { value: CompanyTheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]
export const DEFAULT_THEME: CompanyTheme = 'light'

export const CURRENCY_OPTIONS: { value: CompanyCurrency; label: string }[] = [
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'RUB', label: 'RUB (₽)' },
]
export const DEFAULT_CURRENCY: CompanyCurrency = 'GBP'

export function formatOvertimeMultiplierLabel(value: OvertimeMultiplier): string {
  return `${value.toFixed(1)}x`
}

export type CompanySettings = {
  id: string
  createdAt: string
  name: string | null
  logoUrl: string | null
  address: string | null
  city: string | null
  country: string | null
  postcode: string | null
  timezone: string
  weatherLocation: string | null
  dateFormat: CompanyDateFormat
  timeFormat: CompanyTimeFormat
  weekStarts: CompanyWeekStarts
  fleetNumberPrefix: string
  defaultVehicleStatus: VehicleStatus
  defaultDriverRole: DriverRole
  defaultBreakMinutes: DefaultBreakMinutes
  paidBreaks: boolean
  overtimeAfterHours: OvertimeAfterHours
  overtimeMode: OvertimeMode
  overtimeMultiplier: OvertimeMultiplier
  currency: CompanyCurrency
  roundTimeMinutes: RoundTimeMinutes
  requireTimesheetApproval: boolean
  holidayYearStart: string
  annualLeaveAllowance: number
  theme: CompanyTheme
  compactTables: boolean
  emailNotifications: boolean
  pushNotifications: boolean
  sessionTimeoutMinutes: number
  requireMfa: boolean
  saturdayOvertimeEnabled: boolean
  saturdayOvertimeAfterHours: number
  saturdayOvertimeMultiplier: number
  sundayOvertimeEnabled: boolean
  sundayOvertimeAfterHours: number
  sundayOvertimeMultiplier: number
  timesheetWeekStartDay: TimesheetWeekStartDay
  timesheetWeekResetMonth: number
  timesheetWeekResetDay: number
}

export type CompanySettingsInput = {
  name: string
  logoUrl: string
  address: string
  city: string
  country: string
  postcode: string
  timezone: string
  weatherLocation: string
  dateFormat: CompanyDateFormat
  timeFormat: CompanyTimeFormat
  weekStarts: CompanyWeekStarts
  fleetNumberPrefix: string
  defaultVehicleStatus: VehicleStatus
  defaultDriverRole: DriverRole
  defaultBreakMinutes: DefaultBreakMinutes
  paidBreaks: boolean
  overtimeAfterHours: OvertimeAfterHours
  overtimeMode: OvertimeMode
  overtimeMultiplier: OvertimeMultiplier
  currency: CompanyCurrency
  roundTimeMinutes: RoundTimeMinutes
  requireTimesheetApproval: boolean
  holidayYearStart: string
  annualLeaveAllowance: number
  theme: CompanyTheme
  compactTables: boolean
  emailNotifications: boolean
  pushNotifications: boolean
  sessionTimeoutMinutes: number
  requireMfa: boolean
  saturdayOvertimeEnabled: boolean
  saturdayOvertimeAfterHours: number
  saturdayOvertimeMultiplier: number
  sundayOvertimeEnabled: boolean
  sundayOvertimeAfterHours: number
  sundayOvertimeMultiplier: number
  timesheetWeekStartDay: TimesheetWeekStartDay
  timesheetWeekResetMonth: number
  timesheetWeekResetDay: number
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettingsInput = {
  name: '',
  logoUrl: '',
  address: '',
  city: '',
  country: '',
  postcode: '',
  timezone: 'Europe/London',
  weatherLocation: '',
  dateFormat: 'DMY',
  timeFormat: '24-hour',
  weekStarts: 'monday',
  fleetNumberPrefix: '',
  defaultVehicleStatus: 'Available',
  defaultDriverRole: 'Driver',
  defaultBreakMinutes: 30,
  paidBreaks: false,
  overtimeAfterHours: 10.5,
  overtimeMode: 'Manual',
  overtimeMultiplier: 1.5,
  currency: 'GBP',
  roundTimeMinutes: 0,
  requireTimesheetApproval: true,
  holidayYearStart: '01-01',
  annualLeaveAllowance: 28,
  theme: 'light',
  compactTables: false,
  emailNotifications: true,
  pushNotifications: false,
  sessionTimeoutMinutes: 480,
  requireMfa: false,
  saturdayOvertimeEnabled: false,
  saturdayOvertimeAfterHours: DEFAULT_SATURDAY_OVERTIME_AFTER_HOURS,
  saturdayOvertimeMultiplier: DEFAULT_SATURDAY_OVERTIME_MULTIPLIER,
  sundayOvertimeEnabled: false,
  sundayOvertimeAfterHours: DEFAULT_SUNDAY_OVERTIME_AFTER_HOURS,
  sundayOvertimeMultiplier: DEFAULT_SUNDAY_OVERTIME_MULTIPLIER,
  ...DEFAULT_TIMESHEET_WEEK_SETTINGS,
}

export type CompanySettingsTab =
  | 'general'
  | 'regional'
  | 'timesheets'
  | 'holidays'
  | 'appearance'
  | 'notifications'
  | 'security'

export const COMPANY_SETTINGS_TABS: {
  id: CompanySettingsTab
  label: string
}[] = [
  { id: 'general', label: 'General' },
  { id: 'regional', label: 'Regional' },
  { id: 'timesheets', label: 'Timesheets' },
  { id: 'holidays', label: 'Holidays' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
]

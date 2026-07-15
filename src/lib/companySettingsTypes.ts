import type { CompanyTimeFormat } from '@/lib/dateTimeFormat'
import type { ConsumableType, ConsumableUnit } from '@/lib/consumableTypes'
import type { DriverRole } from '@/services/driversService'
import type { VehicleStatus } from '@/services/vehiclesService'
import type { EmploymentType } from '@/services/driversService'

export type CompanyDateFormat = 'DMY' | 'MDY' | 'YMD'
export type CompanyWeekStarts = 'monday' | 'sunday'
export type TimesheetWeekStartDay = 'monday' | 'sunday'
export type HolidayCountingMethod = 'working_days' | 'calendar_days' | 'custom_working_week'
export type HolidayWorkingDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export type HolidayEntitlementRule = {
  paidHolidayEnabled: boolean
  annualPaidHolidayDays: number
  bankHolidayEntitlementDays: number
  unpaidLeaveAllowed: boolean
}

export type HolidayEntitlementRules = Record<EmploymentType, HolidayEntitlementRule>

export const DEFAULT_HOLIDAY_ENTITLEMENT_RULES: HolidayEntitlementRules = {
  'Full-time': {
    paidHolidayEnabled: true,
    annualPaidHolidayDays: 20,
    bankHolidayEntitlementDays: 8,
    unpaidLeaveAllowed: true,
  },
  'Part-time': {
    paidHolidayEnabled: true,
    annualPaidHolidayDays: 0,
    bankHolidayEntitlementDays: 0,
    unpaidLeaveAllowed: true,
  },
  Umbrella: {
    paidHolidayEnabled: false,
    annualPaidHolidayDays: 0,
    bankHolidayEntitlementDays: 0,
    unpaidLeaveAllowed: true,
  },
  Agency: {
    paidHolidayEnabled: false,
    annualPaidHolidayDays: 0,
    bankHolidayEntitlementDays: 0,
    unpaidLeaveAllowed: true,
  },
  'Self-employed / Contractor': {
    paidHolidayEnabled: false,
    annualPaidHolidayDays: 0,
    bankHolidayEntitlementDays: 0,
    unpaidLeaveAllowed: true,
  },
  'Zero-hours': {
    paidHolidayEnabled: false,
    annualPaidHolidayDays: 0,
    bankHolidayEntitlementDays: 0,
    unpaidLeaveAllowed: true,
  },
  Temporary: {
    paidHolidayEnabled: false,
    annualPaidHolidayDays: 0,
    bankHolidayEntitlementDays: 0,
    unpaidLeaveAllowed: true,
  },
  Casual: {
    paidHolidayEnabled: false,
    annualPaidHolidayDays: 0,
    bankHolidayEntitlementDays: 0,
    unpaidLeaveAllowed: true,
  },
  Other: {
    paidHolidayEnabled: true,
    annualPaidHolidayDays: 0,
    bankHolidayEntitlementDays: 0,
    unpaidLeaveAllowed: true,
  },
}

export const HOLIDAY_WORKING_DAY_OPTIONS: {
  value: HolidayWorkingDay
  label: string
}[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
]

export const DEFAULT_HOLIDAY_WORKING_DAYS: HolidayWorkingDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
]

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

export const WEEKEND_GUARANTEED_PAID_HOURS_MIN = 5
export const WEEKEND_GUARANTEED_PAID_HOURS_MAX = 15
export const WEEKEND_GUARANTEED_PAID_HOURS_STEP = 0.5

export const WEEKEND_GUARANTEED_PAID_HOURS_OPTIONS: number[] = Array.from(
  {
    length:
      Math.round(
        (WEEKEND_GUARANTEED_PAID_HOURS_MAX - WEEKEND_GUARANTEED_PAID_HOURS_MIN) /
          WEEKEND_GUARANTEED_PAID_HOURS_STEP,
      ) + 1,
  },
  (_, index) =>
    Math.round(
      (WEEKEND_GUARANTEED_PAID_HOURS_MIN + index * WEEKEND_GUARANTEED_PAID_HOURS_STEP) * 10,
    ) / 10,
)

export const DEFAULT_SATURDAY_OVERTIME_AFTER_HOURS = 6
export const DEFAULT_SATURDAY_OVERTIME_MULTIPLIER = 1.5
export const DEFAULT_SATURDAY_GUARANTEED_PAID_HOURS = 10
export const DEFAULT_SUNDAY_OVERTIME_AFTER_HOURS = 0
export const DEFAULT_SUNDAY_OVERTIME_MULTIPLIER = 2
export const DEFAULT_SUNDAY_GUARANTEED_PAID_HOURS = 10

export function formatWeekendOvertimeAfterHoursLabel(hours: number): string {
  if (hours === 0) return '0.0 hours — from first hour'
  return `${hours.toFixed(1)} hours`
}

export function formatWeekendOvertimeMultiplierLabel(value: number): string {
  return `${value.toFixed(1)}x`
}

export function formatWeekendGuaranteedPaidHoursLabel(hours: number): string {
  return `${hours.toFixed(1)} hours`
}

export type TimesheetOvertimeRules = {
  overtimeAfterHours: number
  overtimeMultiplier: number
  saturdayOvertimeEnabled: boolean
  saturdayOvertimeAfterHours: number
  saturdayOvertimeMultiplier: number
  saturdayGuaranteedPaidHours: number
  sundayOvertimeEnabled: boolean
  sundayOvertimeAfterHours: number
  sundayOvertimeMultiplier: number
  sundayGuaranteedPaidHours: number
}

export const DEFAULT_TIMESHEET_OVERTIME_RULES: TimesheetOvertimeRules = {
  overtimeAfterHours: DEFAULT_OVERTIME_AFTER_HOURS,
  overtimeMultiplier: DEFAULT_OVERTIME_MULTIPLIER,
  saturdayOvertimeEnabled: false,
  saturdayOvertimeAfterHours: DEFAULT_SATURDAY_OVERTIME_AFTER_HOURS,
  saturdayOvertimeMultiplier: DEFAULT_SATURDAY_OVERTIME_MULTIPLIER,
  saturdayGuaranteedPaidHours: DEFAULT_SATURDAY_GUARANTEED_PAID_HOURS,
  sundayOvertimeEnabled: false,
  sundayOvertimeAfterHours: DEFAULT_SUNDAY_OVERTIME_AFTER_HOURS,
  sundayOvertimeMultiplier: DEFAULT_SUNDAY_OVERTIME_MULTIPLIER,
  sundayGuaranteedPaidHours: DEFAULT_SUNDAY_GUARANTEED_PAID_HOURS,
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

export type ConsumableDefaultPricesMap = Partial<
  Record<ConsumableType, { unitPrice: number; unit: ConsumableUnit }>
>

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
  allowMedicalDocumentUploads: boolean
  overtimeAfterHours: OvertimeAfterHours
  overtimeMode: OvertimeMode
  overtimeMultiplier: OvertimeMultiplier
  currency: CompanyCurrency
  roundTimeMinutes: RoundTimeMinutes
  requireTimesheetApproval: boolean
  holidayYearStart: string
  annualLeaveAllowance: number
  holidayCountingMethod: HolidayCountingMethod
  holidayWorkingDays: HolidayWorkingDay[]
  holidayEntitlementRules: HolidayEntitlementRules
  theme: CompanyTheme
  compactTables: boolean
  emailNotifications: boolean
  pushNotifications: boolean
  sessionTimeoutMinutes: number
  requireMfa: boolean
  saturdayOvertimeEnabled: boolean
  saturdayOvertimeAfterHours: number
  saturdayOvertimeMultiplier: number
  saturdayGuaranteedPaidHours: number
  sundayOvertimeEnabled: boolean
  sundayOvertimeAfterHours: number
  sundayOvertimeMultiplier: number
  sundayGuaranteedPaidHours: number
  timesheetWeekStartDay: TimesheetWeekStartDay
  timesheetWeekResetMonth: number
  timesheetWeekResetDay: number
  consumableDefaultPrices: ConsumableDefaultPricesMap
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
  allowMedicalDocumentUploads: boolean
  overtimeAfterHours: OvertimeAfterHours
  overtimeMode: OvertimeMode
  overtimeMultiplier: OvertimeMultiplier
  currency: CompanyCurrency
  roundTimeMinutes: RoundTimeMinutes
  requireTimesheetApproval: boolean
  holidayYearStart: string
  annualLeaveAllowance: number
  holidayCountingMethod: HolidayCountingMethod
  holidayWorkingDays: HolidayWorkingDay[]
  holidayEntitlementRules: HolidayEntitlementRules
  theme: CompanyTheme
  compactTables: boolean
  emailNotifications: boolean
  pushNotifications: boolean
  sessionTimeoutMinutes: number
  requireMfa: boolean
  saturdayOvertimeEnabled: boolean
  saturdayOvertimeAfterHours: number
  saturdayOvertimeMultiplier: number
  saturdayGuaranteedPaidHours: number
  sundayOvertimeEnabled: boolean
  sundayOvertimeAfterHours: number
  sundayOvertimeMultiplier: number
  sundayGuaranteedPaidHours: number
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
  allowMedicalDocumentUploads: false,
  overtimeAfterHours: 10.5,
  overtimeMode: 'Manual',
  overtimeMultiplier: 1.5,
  currency: 'GBP',
  roundTimeMinutes: 0,
  requireTimesheetApproval: true,
  holidayYearStart: '01-01',
  annualLeaveAllowance: 28,
  holidayCountingMethod: 'working_days',
  holidayWorkingDays: DEFAULT_HOLIDAY_WORKING_DAYS,
  holidayEntitlementRules: DEFAULT_HOLIDAY_ENTITLEMENT_RULES,
  theme: 'light',
  compactTables: false,
  emailNotifications: true,
  pushNotifications: false,
  sessionTimeoutMinutes: 480,
  requireMfa: false,
  saturdayOvertimeEnabled: false,
  saturdayOvertimeAfterHours: DEFAULT_SATURDAY_OVERTIME_AFTER_HOURS,
  saturdayOvertimeMultiplier: DEFAULT_SATURDAY_OVERTIME_MULTIPLIER,
  saturdayGuaranteedPaidHours: DEFAULT_SATURDAY_GUARANTEED_PAID_HOURS,
  sundayOvertimeEnabled: false,
  sundayOvertimeAfterHours: DEFAULT_SUNDAY_OVERTIME_AFTER_HOURS,
  sundayOvertimeMultiplier: DEFAULT_SUNDAY_OVERTIME_MULTIPLIER,
  sundayGuaranteedPaidHours: DEFAULT_SUNDAY_GUARANTEED_PAID_HOURS,
  ...DEFAULT_TIMESHEET_WEEK_SETTINGS,
}

export type CompanySettingsTab =
  | 'general'
  | 'regional'
  | 'timesheets'
  | 'holidays'
  | 'consumables'
  | 'documents'
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
  { id: 'consumables', label: 'Consumables' },
  { id: 'documents', label: 'Documents' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
]

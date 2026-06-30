import type { CompanyTimeFormat } from '@/lib/dateTimeFormat'
import type { DriverRole } from '@/services/driversService'
import type { VehicleStatus } from '@/services/vehiclesService'

export type CompanyDateFormat = 'DMY' | 'MDY' | 'YMD'
export type CompanyWeekStarts = 'monday' | 'sunday'
export type CompanyTheme = 'light' | 'dark' | 'auto'
export type DefaultBreakMinutes = 30 | 45 | 60
export type OvertimeAfterHours = 8 | 9 | 10
export type OvertimeMode = 'Manual' | 'Automatic'
export type OvertimeMultiplier = 1 | 1.25 | 1.5 | 1.75 | 2
export type RoundTimeMinutes = 0 | 5 | 15

export const OVERTIME_MULTIPLIER_OPTIONS: OvertimeMultiplier[] = [1, 1.25, 1.5, 1.75, 2]
export const DEFAULT_OVERTIME_MULTIPLIER: OvertimeMultiplier = 1.5

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
  overtimeAfterHours: OvertimeAfterHours
  overtimeMode: OvertimeMode
  overtimeMultiplier: OvertimeMultiplier
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
  overtimeAfterHours: OvertimeAfterHours
  overtimeMode: OvertimeMode
  overtimeMultiplier: OvertimeMultiplier
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
  overtimeAfterHours: 8,
  overtimeMode: 'Manual',
  overtimeMultiplier: 1.5,
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
}

export type CompanySettingsTab =
  | 'general'
  | 'regional'
  | 'fleet'
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
  { id: 'fleet', label: 'Fleet' },
  { id: 'timesheets', label: 'Timesheets' },
  { id: 'holidays', label: 'Holidays' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
]

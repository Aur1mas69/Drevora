import type { DriverRole } from '@/services/driversService'

export type TimesheetStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected'

export type TimesheetEntry = {
  id: string
  timesheetId: string
  dayDate: string
  startTime: string | null
  breakMinutes: number
  finishTime: string | null
  totalMinutes: number
  overtimeMinutes: number
  additionalHours: number
  /** Persisted as timesheet_entries.daily_comment */
  dailyComment: string
}

export type TimesheetEntryInput = {
  id?: string
  dayDate: string
  startTime: string | null
  breakMinutes: number
  finishTime: string | null
  totalMinutes: number
  overtimeMinutes: number
  additionalHours: number
  /** Persisted as timesheet_entries.daily_comment */
  dailyComment: string
}

export type Timesheet = {
  id: string
  driverId: string
  vehicleId: string | null
  weekStart: string
  weekLabel: string
  weekNumber: number
  weekTitle: string
  weekRangeLabel: string
  status: TimesheetStatus
  notes: string | null
  bonusAmount: number
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  driverName: string
  driverRole: DriverRole | null
  fleetNo: string
  vehicleRegistration: string
  entries: TimesheetEntry[]
  workedHours: number
  breakHours: number
  overtimeHours: number
  additionalHours: number
  totalHours: number
}

export type TimesheetListItem = Omit<Timesheet, 'entries'> & {
  entries?: TimesheetEntry[]
}

export type TimesheetSummaryStats = {
  driversSubmitted: number
  pendingApproval: number
  approved: number
  rejected: number
  drafts: number
  total: number
}

export type TimesheetsSortField =
  | 'driverName'
  | 'weekStart'
  | 'status'
  | 'workedHours'
  | 'createdAt'
  | 'updatedAt'

export type TimesheetsSortDirection = 'asc' | 'desc'

export type TimesheetsQuery = {
  search?: string
  status?: TimesheetStatus | 'all'
  role?: DriverRole | 'all'
  weekStart: string
  vehicleId?: string | 'all' | 'unassigned'
  page?: number
  pageSize?: number
  sortBy?: TimesheetsSortField
  sortDir?: TimesheetsSortDirection
}

export type TimesheetsPageResult = {
  items: TimesheetListItem[]
  totalCount: number
  page: number
  pageSize: number
  stats: TimesheetSummaryStats
}

export type CreateTimesheetInput = {
  driverId: string
  vehicleId?: string | null
  weekStart: string
  notes?: string | null
}

export type CreateTimesheetResult = {
  timesheet: Timesheet
  created: boolean
}

export type BulkCreateTimesheetsInput = {
  weekStart: string
  driverIds: string[]
}

export type UpdateTimesheetInput = {
  vehicleId?: string | null
  status?: TimesheetStatus
  notes?: string | null
}

export const TIMESHEET_PAGE_SIZE_OPTIONS = [25, 50, 100] as const
export const DEFAULT_TIMESHEET_PAGE_SIZE = 50

export const TIMESHEET_DAY_LABELS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

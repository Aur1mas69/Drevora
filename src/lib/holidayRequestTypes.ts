import type { DriverRole } from '@/services/driversService'
import type { EmploymentType } from '@/services/driversService'

export type HolidayRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'
export type HolidayLeaveType = 'paid_holiday' | 'unpaid_leave' | 'bank_holiday'

export type HolidayRequest = {
  id: string
  createdAt: string
  updatedAt: string
  workerId: string
  workerName: string
  workerRole: DriverRole | null
  workerEmploymentType: EmploymentType | null
  startDate: string
  endDate: string
  leaveType: HolidayLeaveType
  isPaidLeave: boolean
  totalDays: number
  calendarDaysTotal: number
  holidayDaysDeducted: number
  nonWorkingDaysExcluded: number
  reason: string | null
  status: HolidayRequestStatus
  managerNote: string | null
}

export type HolidayDayBreakdown = {
  calendarDaysTotal: number
  holidayDaysDeducted: number
  nonWorkingDaysExcluded: number
}

export type HolidayBalanceSummary = HolidayDayBreakdown & {
  annualAllowance: number
  allowanceKnown: boolean
  usedHolidayDays: number
  pendingHolidayDays: number
  remainingBeforeRequest: number
  remainingAfterRequest: number
  remainingAfterPendingRequests: number
}

export type HolidayCapacityWarning = {
  maxWorkersOffPerDay: number
  maxWorkersOff: number
  overLimitDates: string[]
}

export type HolidayRequestSummaryStats = {
  pendingRequests: number
  approvedRequests: number
  declinedRequests: number
  totalRequests: number
  approvedThisMonth: number
  workersOffToday: number
  upcomingLeave: number
}

export type HolidayRequestsQuery = {
  search?: string
  status?: HolidayRequestStatus | 'all'
  workerId?: string | 'all'
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export type HolidayRequestsPageResult = {
  items: HolidayRequest[]
  totalCount: number
  page: number
  pageSize: number
  stats: HolidayRequestSummaryStats
}

export type HolidayCalendarQuery = {
  dateFrom: string
  dateTo: string
  statuses?: HolidayRequestStatus[]
  workerId?: string
}

export type CreateHolidayRequestInput = {
  workerId: string
  startDate: string
  endDate: string
  leaveType?: HolidayLeaveType
  reason?: string | null
}

export type UpdateHolidayRequestInput = {
  startDate?: string
  endDate?: string
  reason?: string | null
  status?: HolidayRequestStatus
  leaveType?: HolidayLeaveType
  managerNote?: string | null
}

export const HOLIDAY_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
export const DEFAULT_HOLIDAY_PAGE_SIZE = 25

export type HolidayRequestStatusFilter = HolidayRequestStatus | 'all'

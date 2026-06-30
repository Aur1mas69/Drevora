import type { DriverRole } from '@/services/driversService'

export type HolidayRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'

export type HolidayRequest = {
  id: string
  createdAt: string
  updatedAt: string
  workerId: string
  workerName: string
  workerRole: DriverRole | null
  startDate: string
  endDate: string
  totalDays: number
  reason: string | null
  status: HolidayRequestStatus
  managerNote: string | null
}

export type HolidayRequestSummaryStats = {
  pendingRequests: number
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

export type CreateHolidayRequestInput = {
  workerId: string
  startDate: string
  endDate: string
  reason?: string | null
}

export type UpdateHolidayRequestInput = {
  startDate?: string
  endDate?: string
  reason?: string | null
  status?: HolidayRequestStatus
  managerNote?: string | null
}

export const HOLIDAY_PAGE_SIZE_OPTIONS = [25, 50, 100] as const
export const DEFAULT_HOLIDAY_PAGE_SIZE = 50

export type HolidayRequestStatusFilter = HolidayRequestStatus | 'all'

import type {
  HolidayRequest,
  HolidayRequestStatus,
  HolidayRequestStatusFilter,
  HolidayRequestSummaryStats,
} from '@/lib/holidayRequestTypes'

export function calculateInclusiveCalendarDays(
  startDate: string,
  endDate: string,
): number {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0
  }
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  return diffDays + 1
}

export function getStatusLabel(status: HolidayRequestStatus): string {
  return status
}

export function getStatusBadgeClass(status: HolidayRequestStatus): string {
  switch (status) {
    case 'Pending':
      return 'bg-amber-50 text-amber-700 ring-amber-100'
    case 'Approved':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    case 'Rejected':
      return 'bg-rose-50 text-rose-700 ring-rose-100'
    case 'Cancelled':
      return 'bg-slate-100 text-slate-600 ring-slate-200'
  }
}

export function canApproveHolidayRequest(status: HolidayRequestStatus): boolean {
  return status === 'Pending'
}

export function canEditHolidayRequest(status: HolidayRequestStatus): boolean {
  return status === 'Pending' || status === 'Rejected'
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getMonthBounds(date = new Date()): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export function addDaysIso(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function computeHolidaySummaryStats(
  rows: Pick<HolidayRequest, 'status' | 'startDate' | 'endDate' | 'workerId' | 'updatedAt'>[],
): HolidayRequestSummaryStats {
  const today = todayIsoDate()
  const month = getMonthBounds()
  const upcomingEnd = addDaysIso(today, 30)

  const pendingRequests = rows.filter((row) => row.status === 'Pending').length

  const approvedThisMonth = rows.filter((row) => {
    if (row.status !== 'Approved') return false
    const updated = row.updatedAt.slice(0, 10)
    return updated >= month.start && updated <= month.end
  }).length

  const workersOffTodaySet = new Set<string>()
  for (const row of rows) {
    if (row.status !== 'Approved') continue
    if (row.startDate <= today && row.endDate >= today) {
      workersOffTodaySet.add(row.workerId)
    }
  }

  const upcomingLeave = rows.filter((row) => {
    if (row.status !== 'Approved') return false
    return row.startDate > today && row.startDate <= upcomingEnd
  }).length

  return {
    pendingRequests,
    approvedThisMonth,
    workersOffToday: workersOffTodaySet.size,
    upcomingLeave,
  }
}

export function filterHolidayRequestsClientSide(
  items: HolidayRequest[],
  searchTerm: string,
): HolidayRequest[] {
  const query = searchTerm.trim().toLowerCase()
  if (!query) return items

  return items.filter(
    (item) =>
      item.workerName.toLowerCase().includes(query) ||
      (item.reason?.toLowerCase().includes(query) ?? false),
  )
}

export function matchesStatusFilter(
  status: HolidayRequestStatus,
  filter: HolidayRequestStatusFilter,
): boolean {
  return filter === 'all' || status === filter
}

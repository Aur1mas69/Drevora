import {
  DEFAULT_HOLIDAY_WORKING_DAYS,
  type HolidayCountingMethod,
  type HolidayWorkingDay,
} from '@/lib/companySettingsTypes'
import type {
  HolidayDayBreakdown,
  HolidayRequest,
  HolidayRequestStatus,
  HolidayRequestStatusFilter,
  HolidayRequestSummaryStats,
} from '@/lib/holidayRequestTypes'

const DAY_INDEX_TO_HOLIDAY_DAY: HolidayWorkingDay[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

export type HolidayCountingSettings = {
  holidayCountingMethod: HolidayCountingMethod
  holidayWorkingDays: HolidayWorkingDay[]
}

export const DEFAULT_HOLIDAY_COUNTING_SETTINGS: HolidayCountingSettings = {
  holidayCountingMethod: 'working_days',
  holidayWorkingDays: DEFAULT_HOLIDAY_WORKING_DAYS,
}

export const HOLIDAY_MAX_WORKERS_OFF_PER_DAY = 2

export function resolveWorkerDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const first = firstName?.trim() ?? ''
  const last = lastName?.trim() ?? ''
  const full = `${first} ${last}`.trim()
  if (full) return full
  if (first) return first
  if (last) return last
  return 'Worker'
}

export function normalizeHolidayIsoDate(value: string): string {
  return value.slice(0, 10)
}

export function addHolidayDaysIso(iso: string, days: number): string {
  const date = new Date(`${normalizeHolidayIsoDate(iso)}T00:00:00`)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildHolidayRequestsByDay(
  requests: HolidayRequest[],
  visibleStart: string,
  visibleEnd: string,
): Map<string, HolidayRequest[]> {
  const map = new Map<string, HolidayRequest[]>()

  for (const request of requests) {
    const start = normalizeHolidayIsoDate(request.startDate)
    const end = normalizeHolidayIsoDate(request.endDate)
    if (!start || !end || end < start) continue

    let current = start
    while (current <= end) {
      if (current >= visibleStart && current <= visibleEnd) {
        const dayRequests = map.get(current) ?? []
        dayRequests.push(request)
        map.set(current, dayRequests)
      }
      current = addHolidayDaysIso(current, 1)
    }
  }

  for (const [iso, dayRequests] of map.entries()) {
    map.set(
      iso,
      dayRequests.sort((left, right) => left.workerName.localeCompare(right.workerName)),
    )
  }

  return map
}

export function matchesHolidayRequestCompanyScope(
  driverCompany: string | null | undefined,
  companyScope: string | null | undefined,
): boolean {
  const scope = companyScope?.trim() ?? ''
  if (!scope) return true

  const workerCompany = driverCompany?.trim() ?? ''
  if (!workerCompany) return true

  return workerCompany === scope
}

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

export function calculateHolidayDayBreakdown(
  startDate: string,
  endDate: string,
  settings: HolidayCountingSettings = DEFAULT_HOLIDAY_COUNTING_SETTINGS,
): HolidayDayBreakdown {
  const calendarDaysTotal = calculateInclusiveCalendarDays(startDate, endDate)
  if (calendarDaysTotal <= 0) {
    return {
      calendarDaysTotal: 0,
      holidayDaysDeducted: 0,
      nonWorkingDaysExcluded: 0,
    }
  }

  if (settings.holidayCountingMethod === 'calendar_days') {
    return {
      calendarDaysTotal,
      holidayDaysDeducted: calendarDaysTotal,
      nonWorkingDaysExcluded: 0,
    }
  }

  const workingDays = new Set(
    settings.holidayWorkingDays.length > 0
      ? settings.holidayWorkingDays
      : DEFAULT_HOLIDAY_WORKING_DAYS,
  )
  const current = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  let holidayDaysDeducted = 0

  while (current <= end) {
    const day = DAY_INDEX_TO_HOLIDAY_DAY[current.getDay()]
    if (workingDays.has(day)) {
      holidayDaysDeducted += 1
    }
    current.setDate(current.getDate() + 1)
  }

  return {
    calendarDaysTotal,
    holidayDaysDeducted,
    nonWorkingDaysExcluded: calendarDaysTotal - holidayDaysDeducted,
  }
}

export function getHolidayCountingMethodLabel(method: HolidayCountingMethod): string {
  switch (method) {
    case 'calendar_days':
      return 'Calendar days'
    case 'custom_working_week':
      return 'Custom working week'
    case 'working_days':
      return 'Working days only'
  }
}

export function getStatusLabel(status: HolidayRequestStatus): string {
  if (status === 'Rejected') return 'Declined'
  return status
}

export function getStatusBadgeClass(status: HolidayRequestStatus): string {
  switch (status) {
    case 'Pending':
      return 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60'
    case 'Approved':
      return 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-900/60'
    case 'Rejected':
      return 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60'
    case 'Cancelled':
      return 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10'
  }
}

export function canApproveHolidayRequest(status: HolidayRequestStatus): boolean {
  return status === 'Pending'
}

/**
 * Hard-delete is allowed only for Pending requests.
 * Approved / Declined (Rejected) history is preserved. Cancelled is also not deletable.
 */
export function canDeleteHolidayRequest(status: HolidayRequestStatus): boolean {
  return status === 'Pending'
}

export function canEditHolidayRequest(_status: HolidayRequestStatus): boolean {
  return true
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

export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDaysIso(dateValue: string, days: number): string {
  const date = new Date(`${normalizeHolidayIsoDate(dateValue)}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toLocalIsoDate(date)
}

export function computeHolidaySummaryStats(
  rows: Pick<HolidayRequest, 'status' | 'startDate' | 'endDate' | 'workerId' | 'updatedAt'>[],
): HolidayRequestSummaryStats {
  const today = todayIsoDate()
  const month = getMonthBounds()
  const upcomingEnd = addDaysIso(today, 30)

  const pendingRequests = rows.filter((row) => row.status === 'Pending').length
  const approvedRequests = rows.filter((row) => row.status === 'Approved').length
  const declinedRequests = rows.filter((row) => row.status === 'Rejected').length
  const totalRequests = rows.length

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
    approvedRequests,
    declinedRequests,
    totalRequests,
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

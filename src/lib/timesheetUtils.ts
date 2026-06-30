import {
  formatClockTime,
  formatDateTimeFromIso,
  getGlobalOvertimeAfterHours,
  getGlobalTimeFormat,
  getGlobalWeekStarts,
  normalizeWeekStart,
  type CompanyTimeFormat,
} from '@/lib/dateTimeFormat'
import type { OvertimeMode } from '@/lib/companySettingsTypes'
import type {
  Timesheet,
  TimesheetEntry,
  TimesheetEntryInput,
  TimesheetListItem,
  TimesheetStatus,
  TimesheetSummaryStats,
  TimesheetsSortField,
  TimesheetsSortDirection,
} from '@/lib/timesheetTypes'
import type { DriverRole } from '@/services/driversService'

export type TimesheetStatusFilter = TimesheetStatus | 'all'
export type TimesheetRoleFilter = DriverRole | 'all'
export type TimesheetVehicleFilter = string | 'all' | 'unassigned'

export function countWorkedDays(entries: Pick<TimesheetEntry, 'totalMinutes'>[]): number {
  return entries.filter((entry) => entry.totalMinutes > 0).length
}

export function calculateAutomaticOvertimeMinutes(
  totalMinutes: number,
  overtimeAfterHours: number = getGlobalOvertimeAfterHours(),
): number {
  if (totalMinutes <= 0) return 0
  const thresholdMinutes = overtimeAfterHours * 60
  return Math.max(0, totalMinutes - thresholdMinutes)
}

export function summarizeTimesheetEntries(
  entries: TimesheetEntry[],
): {
  workedHours: number
  breakHours: number
  overtimeHours: number
} {
  let workedMinutes = 0
  let breakMinutes = 0
  let overtimeMinutes = 0

  for (const entry of entries) {
    workedMinutes += entry.totalMinutes
    breakMinutes += entry.breakMinutes
    overtimeMinutes += entry.overtimeMinutes ?? 0
  }

  return {
    workedHours: Math.round((workedMinutes / 60) * 100) / 100,
    breakHours: Math.round((breakMinutes / 60) * 100) / 100,
    overtimeHours: Math.round((overtimeMinutes / 60) * 100) / 100,
  }
}

export function parseTimeToMinutes(value: string | null): number | null {
  if (!value?.trim()) return null
  const normalized = value.trim().slice(0, 5)
  const match = /^(\d{1,2}):(\d{2})$/.exec(normalized)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

export function calculateEntryTotalMinutes(input: {
  startTime: string | null
  breakMinutes: number
  finishTime: string | null
}): number {
  const start = parseTimeToMinutes(input.startTime)
  const finish = parseTimeToMinutes(input.finishTime)
  if (start === null || finish === null || finish <= start) return 0
  return Math.max(0, finish - start - input.breakMinutes)
}

export function calculateEntryTotalHours(input: {
  startTime: string | null
  breakMinutes: number
  finishTime: string | null
}): number {
  return Math.round((calculateEntryTotalMinutes(input) / 60) * 100) / 100
}


export function summarizeTimesheetEntriesFromTotals(totals: {
  workedMinutes: number
  breakMinutes: number
  overtimeMinutes: number
}) {
  return {
    workedHours: Math.round((totals.workedMinutes / 60) * 100) / 100,
    breakHours: Math.round((totals.breakMinutes / 60) * 100) / 100,
    overtimeHours: Math.round((totals.overtimeMinutes / 60) * 100) / 100,
  }
}

export function getStandardWeekHours(
  workedDays: number,
  overtimeAfterHours: number = getGlobalOvertimeAfterHours(),
): number {
  return overtimeAfterHours * workedDays
}

export function computeTimesheetSummaryStats(
  timesheets: Pick<TimesheetListItem, 'status'>[],
): TimesheetSummaryStats {
  const submittedStatuses = timesheets.filter(
    (sheet) => sheet.status === 'Submitted' || sheet.status === 'Approved',
  )

  return {
    total: timesheets.length,
    driversSubmitted: submittedStatuses.length,
    pendingApproval: timesheets.filter((sheet) => sheet.status === 'Submitted').length,
    approved: timesheets.filter((sheet) => sheet.status === 'Approved').length,
    rejected: timesheets.filter((sheet) => sheet.status === 'Rejected').length,
    drafts: timesheets.filter((sheet) => sheet.status === 'Draft').length,
  }
}

export function sortTimesheetListItems(
  items: TimesheetListItem[],
  sortBy: TimesheetsSortField,
  sortDir: TimesheetsSortDirection,
): TimesheetListItem[] {
  const direction = sortDir === 'asc' ? 1 : -1

  return [...items].sort((left, right) => {
    switch (sortBy) {
      case 'driverName':
        return left.driverName.localeCompare(right.driverName) * direction
      case 'weekStart':
        return left.weekStart.localeCompare(right.weekStart) * direction
      case 'status':
        return left.status.localeCompare(right.status) * direction
      case 'workedHours':
        return (left.workedHours - right.workedHours) * direction
      case 'updatedAt':
        return left.updatedAt.localeCompare(right.updatedAt) * direction
      default:
        return 0
    }
  })
}

export function buildRecentWeekOptions(count = 8): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const current = normalizeWeekStart(new Date().toISOString().slice(0, 10), getGlobalWeekStarts())
  const start = new Date(`${current}T00:00:00`)

  for (let index = 0; index < count; index += 1) {
    const weekStart = new Date(start)
    weekStart.setDate(start.getDate() - index * 7)
    const value = weekStart.toISOString().slice(0, 10)
    options.push({ value, label: formatWeekLabel(value) })
  }

  return options
}

export function formatTimesheetUpdatedAt(
  iso: string,
  timeFormat: CompanyTimeFormat = getGlobalTimeFormat(),
): string {
  return formatDateTimeFromIso(iso, { timeFormat })
}

export function formatHours(value: number): string {
  return `${value.toFixed(1)}h`
}

export function formatHoursFromMinutes(minutes: number): string {
  if (minutes <= 0) return '—'
  return formatHours(minutes / 60)
}

export function getStatusLabel(status: TimesheetStatus): string {
  return status
}

export function getStatusBadgeClass(status: TimesheetStatus): string {
  switch (status) {
    case 'Draft':
      return 'bg-slate-100 text-slate-600 ring-slate-200'
    case 'Submitted':
      return 'bg-blue-50 text-blue-700 ring-blue-100'
    case 'Approved':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    case 'Rejected':
      return 'bg-rose-50 text-rose-700 ring-rose-100'
  }
}

export function filterTimesheets(
  timesheets: Timesheet[],
  searchTerm: string,
  statusFilter: TimesheetStatusFilter,
  weekFilter: string,
): Timesheet[] {
  const query = searchTerm.trim().toLowerCase()

  return timesheets.filter((sheet) => {
    if (statusFilter !== 'all' && sheet.status !== statusFilter) {
      return false
    }

    if (weekFilter !== 'all' && sheet.weekStart !== weekFilter) {
      return false
    }

    if (!query) return true

    return (
      sheet.driverName.toLowerCase().includes(query) ||
      sheet.fleetNo.toLowerCase().includes(query) ||
      sheet.weekLabel.toLowerCase().includes(query) ||
      sheet.vehicleRegistration.toLowerCase().includes(query)
    )
  })
}

export function buildWeekOptions(timesheets: Timesheet[]): { value: string; label: string }[] {
  const unique = new Map<string, string>()
  for (const sheet of timesheets) {
    unique.set(sheet.weekStart, sheet.weekLabel)
  }

  return [
    { value: 'all', label: 'All weeks' },
    ...Array.from(unique.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([value, label]) => ({ value, label })),
  ]
}

export function normalizeWeekStartForCompany(dateValue: string): string {
  return normalizeWeekStart(dateValue, getGlobalWeekStarts())
}

export function getDefaultWeekStartMonday(): string {
  return normalizeWeekStart(new Date().toISOString().slice(0, 10), getGlobalWeekStarts())
}

export function buildWeekDates(weekStart: string): string[] {
  const dates: string[] = []
  const start = new Date(`${weekStart}T00:00:00`)

  for (let index = 0; index < 7; index += 1) {
    const current = new Date(start)
    current.setDate(start.getDate() + index)
    dates.push(current.toISOString().slice(0, 10))
  }

  return dates
}

export function formatWeekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const startLabel = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(end)

  return `${startLabel} – ${endLabel}`
}

export function formatDayLabel(dayDate: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${dayDate}T00:00:00`))
}

export function formatBreak(minutes: number): string {
  if (minutes <= 0) return '—'
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${minutes}m`
}

export function formatTimeDisplay(
  value: string | null,
  timeFormat: CompanyTimeFormat = getGlobalTimeFormat(),
): string {
  return formatClockTime(value, { timeFormat })
}

export function prepareEntryInputs(
  weekStart: string,
  entries: TimesheetEntry[],
  defaultBreakMinutes = 30,
): TimesheetEntryInput[] {
  const weekDates = buildWeekDates(weekStart)
  const byDate = new Map(entries.map((entry) => [entry.dayDate, entry]))

  return weekDates.map((dayDate) => {
    const existing = byDate.get(dayDate)
    if (existing) {
      return {
        id: existing.id,
        dayDate,
        startTime: existing.startTime,
        breakMinutes: existing.breakMinutes,
        finishTime: existing.finishTime,
        totalMinutes: existing.totalMinutes,
        overtimeMinutes: existing.overtimeMinutes ?? 0,
      }
    }

    return {
      dayDate,
      startTime: null,
      breakMinutes: defaultBreakMinutes,
      finishTime: null,
      totalMinutes: 0,
      overtimeMinutes: 0,
    }
  })
}

export type RecalculateEntryOptions = {
  overtimeMode?: OvertimeMode
  overtimeAfterHours?: number
}

export function recalculateEntryInputs(
  entries: TimesheetEntryInput[],
  options: RecalculateEntryOptions = {},
): TimesheetEntryInput[] {
  const overtimeMode = options.overtimeMode ?? 'Manual'
  const overtimeAfterHours = options.overtimeAfterHours ?? getGlobalOvertimeAfterHours()

  return entries.map((entry) => {
    const totalMinutes = calculateEntryTotalMinutes(entry)
    const overtimeMinutes =
      overtimeMode === 'Automatic'
        ? calculateAutomaticOvertimeMinutes(totalMinutes, overtimeAfterHours)
        : entry.overtimeMinutes

    return {
      ...entry,
      totalMinutes,
      overtimeMinutes,
    }
  })
}

export function canEditTimesheet(status: TimesheetStatus): boolean {
  return status === 'Draft' || status === 'Rejected'
}

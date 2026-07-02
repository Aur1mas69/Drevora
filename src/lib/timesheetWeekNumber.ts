import type { TimesheetWeekSettings, TimesheetWeekStartDay } from '@/lib/companySettingsTypes'

export type TimesheetWeekDisplay = {
  weekNumber: number
  weekTitle: string
  weekRangeLabel: string
}

const RANGE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}

function parseLocalDate(dateValue: string): Date {
  const [year, month, day] = dateValue.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((end.getTime() - start.getTime()) / msPerDay)
}

export function getTimesheetWeekStartDate(
  dateValue: string | Date,
  startDay: TimesheetWeekStartDay = 'monday',
): Date {
  const date =
    typeof dateValue === 'string' ? parseLocalDate(dateValue) : new Date(dateValue)
  const day = date.getDay()

  if (startDay === 'sunday') {
    date.setDate(date.getDate() - day)
    return date
  }

  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

function formatRangeDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', RANGE_FORMAT).format(date)
}

export function formatTimesheetWeekRangeLabel(
  weekStart: string,
  startDay: TimesheetWeekStartDay = 'monday',
): string {
  const start = getTimesheetWeekStartDate(weekStart, startDay)
  const end = addDays(start, 6)
  return `${formatRangeDate(start)} – ${formatRangeDate(end)}`
}

function clampResetDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month, 0).getDate()
  return new Date(year, month - 1, Math.min(day, lastDay))
}

function getResetAnchorDate(weekStartDate: Date, month: number, day: number): Date {
  const year = weekStartDate.getFullYear()
  let anchor = clampResetDay(year, month, day)

  if (weekStartDate < anchor) {
    anchor = clampResetDay(year - 1, month, day)
  }

  return anchor
}

export function calculateTimesheetWeekNumber(
  weekStart: string,
  settings: TimesheetWeekSettings,
): number {
  const weekStartDate = parseLocalDate(weekStart)
  const anchor = getResetAnchorDate(
    weekStartDate,
    settings.timesheetWeekResetMonth,
    settings.timesheetWeekResetDay,
  )
  const weekOneStart = getTimesheetWeekStartDate(anchor, settings.timesheetWeekStartDay)
  const currentWeekStart = getTimesheetWeekStartDate(weekStart, settings.timesheetWeekStartDay)
  const weekIndex = Math.floor(daysBetween(weekOneStart, currentWeekStart) / 7)
  return Math.max(1, weekIndex + 1)
}

export function formatTimesheetWeekDisplay(
  weekStart: string,
  settings: TimesheetWeekSettings,
): TimesheetWeekDisplay {
  const weekNumber = calculateTimesheetWeekNumber(weekStart, settings)
  return {
    weekNumber,
    weekTitle: `Timesheet Week ${weekNumber}`,
    weekRangeLabel: formatTimesheetWeekRangeLabel(weekStart, settings.timesheetWeekStartDay),
  }
}

export const TIMESHEET_WEEK_START_DAY_OPTIONS: {
  value: TimesheetWeekStartDay
  label: string
}[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'sunday', label: 'Sunday' },
]

export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(2026, index, 1)),
}))

export function getDaysInMonth(month: number): number[] {
  const year = 2026
  const total = new Date(year, month, 0).getDate()
  return Array.from({ length: total }, (_, index) => index + 1)
}

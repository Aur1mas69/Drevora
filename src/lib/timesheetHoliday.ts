import type { TimesheetDayType, TimesheetEntryInput } from '@/lib/timesheetTypes'
import type { HolidayDayPortion } from '@/lib/holidayRequestTypes'
import { entryHasStartAndFinish, formatDayLabel } from '@/lib/timesheetUtils'

export const DEFAULT_PAID_HOLIDAY_HOURS = 8
export const MAX_PAID_HOLIDAY_HOURS = 24

export const HOLIDAY_DAY_PORTION_OPTIONS: {
  value: HolidayDayPortion
  label: string
  shortLabel: string
  timesheetDayType: Exclude<TimesheetDayType, 'work'>
  code: 'H' | 'H-AM' | 'H-PM'
}[] = [
  {
    value: 'full',
    label: 'Full day',
    shortLabel: 'Full day',
    timesheetDayType: 'holiday',
    code: 'H',
  },
  {
    value: 'first_half',
    label: 'First half of the day',
    shortLabel: 'First half',
    timesheetDayType: 'holiday_am',
    code: 'H-AM',
  },
  {
    value: 'second_half',
    label: 'Second half of the day',
    shortLabel: 'Second half',
    timesheetDayType: 'holiday_pm',
    code: 'H-PM',
  },
]

/** Parse free-form holiday hours. Allows 0 (unpaid). Rejects negatives / invalid. */
export function parsePaidHolidayHours(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0 || raw > MAX_PAID_HOLIDAY_HOURS) return null
    return Math.round(raw * 100) / 100
  }
  if (raw == null) return null
  const trimmed = String(raw).trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_PAID_HOLIDAY_HOURS) return null
  return Math.round(parsed * 100) / 100
}

export function normalizePaidHolidayHours(
  value: unknown,
  fallback: number = DEFAULT_PAID_HOLIDAY_HOURS,
): number {
  const parsed = parsePaidHolidayHours(
    typeof value === 'number' || typeof value === 'string' ? value : null,
  )
  return parsed ?? fallback
}

export function holidayPortionShortLabel(portion: HolidayDayPortion): string {
  if (portion === 'first_half') return 'First half'
  if (portion === 'second_half') return 'Second half'
  return 'Full day'
}

export function holidayPortionCode(portion: HolidayDayPortion): 'H' | 'H-AM' | 'H-PM' {
  if (portion === 'first_half') return 'H-AM'
  if (portion === 'second_half') return 'H-PM'
  return 'H'
}

/** Compact Admin/Worker label for a request's start/end portions. */
export function formatHolidayRequestPortionSummary(input: {
  startDate: string
  endDate: string
  startDayPortion?: HolidayDayPortion | null
  endDayPortion?: HolidayDayPortion | null
}): string {
  const start = normalizeHolidayDayPortion(input.startDayPortion)
  const end =
    input.startDate === input.endDate
      ? start
      : normalizeHolidayDayPortion(input.endDayPortion)
  if (input.startDate === input.endDate) {
    return `${holidayPortionCode(start)} · ${holidayPortionShortLabel(start)}`
  }
  if (start === 'full' && end === 'full') {
    return 'H · Full days'
  }
  return `Start ${holidayPortionCode(start)} · End ${holidayPortionCode(end)}`
}

export function normalizeHolidayDayPortion(value: unknown): HolidayDayPortion {
  if (value === 'first_half' || value === 'second_half') return value
  return 'full'
}

export function normalizeTimesheetDayType(value: unknown): TimesheetDayType {
  if (value === 'holiday' || value === 'holiday_am' || value === 'holiday_pm') {
    return value
  }
  return 'work'
}

export function isHolidayDay(entry: { dayType?: TimesheetDayType | null }): boolean {
  const dayType = entry.dayType ?? 'work'
  return dayType === 'holiday' || dayType === 'holiday_am' || dayType === 'holiday_pm'
}

export function isFullHolidayDay(entry: { dayType?: TimesheetDayType | null }): boolean {
  return entry.dayType === 'holiday'
}

export function isHalfHolidayDay(entry: { dayType?: TimesheetDayType | null }): boolean {
  return entry.dayType === 'holiday_am' || entry.dayType === 'holiday_pm'
}

export function holidayPortionFromDayType(dayType: TimesheetDayType): HolidayDayPortion | null {
  if (dayType === 'holiday') return 'full'
  if (dayType === 'holiday_am') return 'first_half'
  if (dayType === 'holiday_pm') return 'second_half'
  return null
}

export function dayTypeFromHolidayPortion(portion: HolidayDayPortion): TimesheetDayType {
  if (portion === 'first_half') return 'holiday_am'
  if (portion === 'second_half') return 'holiday_pm'
  return 'holiday'
}

export function holidayDayCode(dayType: TimesheetDayType): 'H' | 'H-AM' | 'H-PM' | null {
  if (dayType === 'holiday') return 'H'
  if (dayType === 'holiday_am') return 'H-AM'
  if (dayType === 'holiday_pm') return 'H-PM'
  return null
}

export function holidayDayLabel(dayType: TimesheetDayType): string {
  if (dayType === 'holiday') return 'Full day holiday'
  if (dayType === 'holiday_am') return 'First half holiday'
  if (dayType === 'holiday_pm') return 'Second half holiday'
  return 'Work'
}

/** Full day = configured hours; half day = exactly 50% (decimals preserved). */
export function resolveHolidayPayableHours(
  fullDayHours: number,
  portion: HolidayDayPortion,
): number {
  const full = normalizePaidHolidayHours(fullDayHours, 0)
  if (portion === 'full') return full
  return Math.round(full * 50) / 100
}

export function holidayHoursToMinutes(hours: number): number {
  return Math.round(Math.max(0, hours) * 60)
}

export function holidayMinutesFromEntry(entry: {
  dayType?: TimesheetDayType | null
  holidayMinutes?: number | null
  totalMinutes?: number | null
}): number {
  if (!isHolidayDay(entry)) return 0
  const explicit = entry.holidayMinutes
  if (explicit != null && Number.isFinite(explicit) && explicit >= 0) {
    // Legacy full-holiday rows stored hours in total_minutes with holiday_minutes 0.
    if (explicit === 0 && entry.dayType === 'holiday' && (entry.totalMinutes ?? 0) > 0) {
      return Math.max(0, entry.totalMinutes ?? 0)
    }
    return Math.max(0, explicit)
  }
  if (entry.dayType === 'holiday') {
    return Math.max(0, entry.totalMinutes ?? 0)
  }
  return 0
}

/** True when the day already has worked hours/clocks. */
export function entryHasWorkContent(entry: TimesheetEntryInput): boolean {
  if (entryHasStartAndFinish(entry)) return true
  if ((entry.totalMinutes ?? 0) > 0 && !isFullHolidayDay(entry)) return true
  if ((entry.overtimeMinutes ?? 0) > 0) return true
  if ((entry.additionalHours ?? 0) > 0) return true
  return false
}

/**
 * Full-day Holiday cannot include worked hours.
 * H-AM / H-PM are leave portions only — any shift on the same date is allowed
 * (Workers have variable start times; there is no fixed 12:00 boundary).
 */
export function validateHolidayWorkOverlap(entry: TimesheetEntryInput): string | null {
  if (isFullHolidayDay(entry) && entryHasWorkContent({ ...entry, dayType: 'work' })) {
    return `${formatDayLabel(entry.dayDate)}: full-day holiday cannot include work hours.`
  }
  return null
}

export function applyHolidayDayHours(
  entry: TimesheetEntryInput,
  fullDayHolidayHours: number,
  portion: HolidayDayPortion = 'full',
): TimesheetEntryInput {
  const dayType = dayTypeFromHolidayPortion(portion)
  const holidayHours = resolveHolidayPayableHours(fullDayHolidayHours, portion)
  const holidayMinutes = holidayHoursToMinutes(holidayHours)

  if (portion === 'full') {
    return {
      ...entry,
      dayType,
      startTime: null,
      finishTime: null,
      breakMinutes: 0,
      totalMinutes: 0,
      overtimeMinutes: 0,
      additionalHours: 0,
      holidayMinutes,
    }
  }

  // Half-day: keep Start/Finish/Break and worked totals unchanged.
  return {
    ...entry,
    dayType,
    holidayMinutes,
    // If coming from a full holiday, work fields were cleared — leave them clear.
    startTime: isFullHolidayDay(entry) ? null : entry.startTime,
    finishTime: isFullHolidayDay(entry) ? null : entry.finishTime,
    breakMinutes: isFullHolidayDay(entry) ? 0 : Math.max(0, entry.breakMinutes ?? 0),
    totalMinutes: isFullHolidayDay(entry) ? 0 : Math.max(0, entry.totalMinutes ?? 0),
    overtimeMinutes: isFullHolidayDay(entry) ? 0 : Math.max(0, entry.overtimeMinutes ?? 0),
    additionalHours: isFullHolidayDay(entry) ? 0 : Math.max(0, entry.additionalHours ?? 0),
  }
}

export function applyWorkDayType(
  entry: TimesheetEntryInput,
  defaultBreakMinutes: number,
): TimesheetEntryInput {
  return {
    ...entry,
    dayType: 'work',
    holidayMinutes: 0,
    startTime: null,
    finishTime: null,
    breakMinutes: Math.max(0, defaultBreakMinutes),
    totalMinutes: 0,
    overtimeMinutes: 0,
    additionalHours: 0,
  }
}

/** Inclusive YYYY-MM-DD dates between start and end. */
export function enumerateInclusiveDates(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const cursor = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) {
    return dates
  }
  while (cursor <= end) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

/** Resolve leave portion for a calendar date within a multi-day request. */
export function resolvePortionForDate(
  dayDate: string,
  startDate: string,
  endDate: string,
  startPortion: HolidayDayPortion,
  endPortion: HolidayDayPortion,
): HolidayDayPortion {
  if (startDate === endDate) {
    return startPortion
  }
  if (dayDate === startDate) return startPortion
  if (dayDate === endDate) return endPortion
  return 'full'
}

export type HolidayConflict = {
  dayDate: string
  label: string
  reason: string
}

export type ApprovedHolidayDay = {
  dayDate: string
  portion: HolidayDayPortion
}

export type ApplyApprovedHolidaysResult = {
  entries: TimesheetEntryInput[]
  conflicts: HolidayConflict[]
  changed: boolean
}

/**
 * Apply approved holiday portions onto timesheet days.
 * Full leave never overwrites existing work (Admin conflict).
 * Half leave coexists with any worked shift on the same date without altering clocks.
 */
export function applyApprovedHolidaysToEntries(
  entries: TimesheetEntryInput[],
  approvedDays: Iterable<ApprovedHolidayDay>,
  fullDayHolidayHours: number,
): ApplyApprovedHolidaysResult {
  const byDate = new Map<string, HolidayDayPortion>()
  for (const day of approvedDays) {
    const existing = byDate.get(day.dayDate)
    if (!existing) {
      byDate.set(day.dayDate, day.portion)
      continue
    }
    // Prefer fuller leave when multiple approved requests cover the same date.
    if (existing === 'full' || day.portion === 'full') {
      byDate.set(day.dayDate, 'full')
    } else if (existing !== day.portion) {
      // AM + PM on same date → full day
      byDate.set(day.dayDate, 'full')
    }
  }

  const conflicts: HolidayConflict[] = []
  let changed = false

  const next = entries.map((entry) => {
    const portion = byDate.get(entry.dayDate)
    if (!portion) return entry

    const targetType = dayTypeFromHolidayPortion(portion)
    if (entry.dayType === targetType && holidayMinutesFromEntry(entry) > 0) {
      return entry
    }
    if (isHolidayDay(entry) && entry.dayType === targetType) {
      return entry
    }

    if (portion === 'full') {
      if (entryHasWorkContent(entry) && !isFullHolidayDay(entry)) {
        conflicts.push({
          dayDate: entry.dayDate,
          label: formatDayLabel(entry.dayDate),
          reason: 'existing work hours',
        })
        return entry
      }
      changed = true
      return applyHolidayDayHours(entry, fullDayHolidayHours, 'full')
    }

    // Half-day: apply holiday hours; preserve Start/Finish/Break/work totals.
    changed = true
    return applyHolidayDayHours(entry, fullDayHolidayHours, portion)
  })

  return { entries: next, conflicts, changed }
}

/** Export helper matching required examples. Always shows H / H-AM / H-PM, including 0.00 h. */
export function formatHolidayExportLine(
  entry: TimesheetEntryInput,
  workHours = 0,
): string {
  const dayType = entry.dayType ?? 'work'
  const code = holidayDayCode(dayType)
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(
    new Date(`${entry.dayDate}T12:00:00`),
  )
  if (!code) {
    return `${weekday} — Work — ${Number(workHours).toFixed(2)} h`
  }
  const holidayHours = holidayMinutesFromEntry(entry) / 60
  const label = holidayDayLabel(dayType)
  if (isHalfHolidayDay(entry) && workHours > 0) {
    return `${weekday} — ${code} — ${label} — ${Number(holidayHours).toFixed(2)} h + Work — ${Number(workHours).toFixed(2)} h`
  }
  return `${weekday} — ${code} — ${label} — ${Number(holidayHours).toFixed(2)} h`
}

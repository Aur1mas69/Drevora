import {
  formatClockTime,
  formatDateTimeFromIso,
  formatTimeFromDate,
  getGlobalOvertimeAfterHours,
  getGlobalTimeFormat,
  type CompanyTimeFormat,
} from '@/lib/dateTimeFormat'
import { DEFAULT_CURRENCY, type CompanyCurrency } from '@/lib/companySettingsTypes'
import {
  DEFAULT_TIMESHEET_OVERTIME_RULES,
  DEFAULT_TIMESHEET_WEEK_SETTINGS,
  type TimesheetOvertimeRules,
  type TimesheetWeekSettings,
} from '@/lib/companySettingsTypes'
import {
  getGlobalOvertimeMultiplier,
  getGlobalTimesheetOvertimeRules,
  getSetting,
  getTimesheetWeekSettings,
} from '@/lib/companySettingsGlobals'
import { formatTimesheetWeekDisplay } from '@/lib/timesheetWeekNumber'
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

export function countWorkedDays(entries: Pick<TimesheetEntry, 'totalMinutes'>[]): number {
  return entries.filter((entry) => entry.totalMinutes > 0).length
}

export function calculateAutomaticOvertimeMinutes(
  totalMinutes: number,
  overtimeAfterHours: number | string = getGlobalOvertimeAfterHours(),
): number {
  if (totalMinutes <= 0) return 0
  const thresholdHours = Number.parseFloat(String(overtimeAfterHours))
  if (Number.isNaN(thresholdHours)) return 0
  const thresholdMinutes = thresholdHours * 60
  return Math.max(0, totalMinutes - thresholdMinutes)
}

export function buildTimesheetOvertimeRules(
  partial: Partial<TimesheetOvertimeRules> = {},
): TimesheetOvertimeRules {
  return {
    ...DEFAULT_TIMESHEET_OVERTIME_RULES,
    ...getGlobalTimesheetOvertimeRules(),
    ...partial,
  }
}

export function resolveDayOvertimeRules(
  dayDate: string,
  rules: TimesheetOvertimeRules,
): {
  afterHours: number
  multiplier: number
  guaranteedPaidHours: number | null
} {
  const day = parseLocalDate(dayDate).getDay()

  if (day === 6 && rules.saturdayOvertimeEnabled) {
    return {
      afterHours: rules.saturdayOvertimeAfterHours,
      multiplier: rules.saturdayOvertimeMultiplier,
      guaranteedPaidHours: rules.saturdayGuaranteedPaidHours,
    }
  }

  if (day === 0 && rules.sundayOvertimeEnabled) {
    return {
      afterHours: rules.sundayOvertimeAfterHours,
      multiplier: rules.sundayOvertimeMultiplier,
      guaranteedPaidHours: rules.sundayGuaranteedPaidHours,
    }
  }

  return {
    afterHours: rules.overtimeAfterHours,
    multiplier: rules.overtimeMultiplier,
    guaranteedPaidHours: null,
  }
}

export function entryHasStartAndFinish(entry: {
  startTime: string | null
  finishTime: string | null
}): boolean {
  const start = parseTimeToMinutes(entry.startTime)
  const finish = parseTimeToMinutes(entry.finishTime)
  return start !== null && finish !== null
}

function calculateShiftSpanMinutes(startMinutes: number, finishMinutes: number): number {
  if (finishMinutes < startMinutes) {
    return finishMinutes + 24 * 60 - startMinutes
  }

  if (finishMinutes === startMinutes) {
    return 0
  }

  return finishMinutes - startMinutes
}

export function roundHoursOneDecimal(value: number): number {
  return Math.round(value * 10) / 10
}

/** Preserve payable Total Hours at two decimal places (e.g. 14.25, not 14.3). */
export function roundHoursTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Weekend guaranteed paid hours:
 * totalPaid = guaranteedPaidHours + max(actualWorked - overtimeStartsAfter, 0) * multiplier
 * Actual worked hours are NOT added on top of the guarantee.
 */
export function calculateWeekendGuaranteedPaidHours(
  actualWorkedHours: number,
  guaranteedPaidHours: number,
  overtimeStartsAfter: number,
  multiplier: number,
  additionalHours = 0,
): number {
  const overtimeHours = Math.max(actualWorkedHours - overtimeStartsAfter, 0)
  return guaranteedPaidHours + overtimeHours * multiplier + additionalHours
}

export function calculateEntryPaidEquivalentHours(
  input: {
    totalMinutes: number
    overtimeMinutes: number
    additionalHours: number
  },
  overtimeMultiplier: number = getGlobalOvertimeMultiplier(),
): number {
  const workedHours = input.totalMinutes / 60
  const overtimeHours = (input.overtimeMinutes ?? 0) / 60
  const additionalHours = input.additionalHours ?? 0
  const normalHours = Math.max(workedHours - overtimeHours, 0)
  return normalHours + overtimeHours * overtimeMultiplier + additionalHours
}

/**
 * Automatic paid-break minutes for Additional Hours.
 * Only when company paid-breaks are enabled and the day has a recorded shift.
 */
export function getEntryPaidBreakMinutes(
  entry: {
    breakMinutes: number
    startTime: string | null
    finishTime: string | null
  },
  paidBreaks: boolean,
): number {
  if (!paidBreaks) return 0
  if (!entryHasStartAndFinish(entry)) return 0
  return Math.max(0, entry.breakMinutes)
}

/** Combined payable Additional Hours: automatic paid break + manual additional. */
export function getEntryCombinedAdditionalHours(
  entry: {
    breakMinutes: number
    additionalHours: number
    startTime: string | null
    finishTime: string | null
  },
  paidBreaks: boolean,
): number {
  const paidBreakHours = getEntryPaidBreakMinutes(entry, paidBreaks) / 60
  return Math.max(0, (entry.additionalHours ?? 0) + paidBreakHours)
}

export type SummarizeTimesheetEntriesOptions = {
  overtimeRules?: Partial<TimesheetOvertimeRules>
  paidBreaks?: boolean
}

export function summarizeTimesheetEntries(
  entries: Array<{
    dayDate: string
    totalMinutes: number
    breakMinutes: number
    overtimeMinutes: number
    additionalHours: number
    startTime: string | null
    finishTime: string | null
  }>,
  options: SummarizeTimesheetEntriesOptions = {},
): {
  workedMinutes: number
  workedHours: number
  breakMinutes: number
  breakHours: number
  overtimeHours: number
  /** Combined: automatic paid break + manual Additional Hours. */
  additionalHours: number
  paidBreakMinutes: number
  manualAdditionalHours: number
  totalHours: number
} {
  const rules = buildTimesheetOvertimeRules(options.overtimeRules)
  const paidBreaks = options.paidBreaks ?? false

  let workedMinutes = 0
  let breakMinutes = 0
  let overtimeMinutes = 0
  let paidBreakMinutesTotal = 0
  let manualAdditionalHoursTotal = 0
  let additionalHoursTotal = 0
  let totalPayableHours = 0

  for (const entry of entries) {
    workedMinutes += entry.totalMinutes
    overtimeMinutes += entry.overtimeMinutes ?? 0

    const manualAdditional = entry.additionalHours ?? 0
    const paidBreakMinutes = getEntryPaidBreakMinutes(entry, paidBreaks)
    const combinedAdditional = manualAdditional + paidBreakMinutes / 60

    manualAdditionalHoursTotal += manualAdditional
    paidBreakMinutesTotal += paidBreakMinutes
    additionalHoursTotal += combinedAdditional

    if (entryHasStartAndFinish(entry)) {
      breakMinutes += entry.breakMinutes
    }

    const hasPayableHours =
      entry.totalMinutes > 0 || combinedAdditional > 0

    if (hasPayableHours) {
      const dayRules = resolveDayOvertimeRules(entry.dayDate, rules)
      if (dayRules.guaranteedPaidHours != null) {
        totalPayableHours += calculateWeekendGuaranteedPaidHours(
          entry.totalMinutes / 60,
          dayRules.guaranteedPaidHours,
          dayRules.afterHours,
          dayRules.multiplier,
          combinedAdditional,
        )
      } else {
        totalPayableHours += calculateEntryPaidEquivalentHours(
          {
            totalMinutes: entry.totalMinutes,
            overtimeMinutes: entry.overtimeMinutes,
            additionalHours: combinedAdditional,
          },
          dayRules.multiplier,
        )
      }
    }
  }

  return {
    workedMinutes,
    workedHours: Math.round((workedMinutes / 60) * 100) / 100,
    breakMinutes,
    breakHours: roundHoursOneDecimal(breakMinutes / 60),
    overtimeHours: roundHoursOneDecimal(overtimeMinutes / 60),
    additionalHours: roundHoursOneDecimal(additionalHoursTotal),
    paidBreakMinutes: paidBreakMinutesTotal,
    manualAdditionalHours: roundHoursOneDecimal(manualAdditionalHoursTotal),
    // Payable Total Hours — kept at two dp internally; display via formatTotalHours → h/m.
    totalHours: roundHoursTwoDecimals(totalPayableHours),
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

/**
 * Basic Hours in minutes = shift span − recorded break.
 * Paid breaks are not kept inside Basic; they contribute via Additional Hours.
 * `options.paidBreaks` is accepted for call-site compatibility and ignored here.
 */
export function calculateEntryTotalMinutes(
  input: {
    startTime: string | null
    breakMinutes: number
    finishTime: string | null
  },
  _options: { paidBreaks?: boolean } = {},
): number {
  const start = parseTimeToMinutes(input.startTime)
  const finish = parseTimeToMinutes(input.finishTime)
  if (start === null || finish === null) return 0

  const spanMinutes = calculateShiftSpanMinutes(start, finish)
  return Math.max(0, spanMinutes - input.breakMinutes)
}

export function calculateEntryTotalHours(
  input: {
    startTime: string | null
    breakMinutes: number
    finishTime: string | null
  },
  options: { paidBreaks?: boolean } = {},
): number {
  return Math.round((calculateEntryTotalMinutes(input, options) / 60) * 100) / 100
}


export function summarizeTimesheetEntriesFromTotals(
  totals: {
    workedMinutes: number
    breakMinutes: number
    overtimeMinutes: number
    additionalHours?: number
  },
  options: { paidBreaks?: boolean } = {},
) {
  const workedHours = Math.round((totals.workedMinutes / 60) * 100) / 100
  const overtimeHours = roundHoursOneDecimal(totals.overtimeMinutes / 60)
  const manualAdditional = totals.additionalHours ?? 0
  const paidBreakHours = options.paidBreaks ? Math.max(0, totals.breakMinutes) / 60 : 0
  const additionalHours = roundHoursOneDecimal(manualAdditional + paidBreakHours)

  return {
    workedHours,
    breakHours: Math.round((totals.breakMinutes / 60) * 100) / 100,
    overtimeHours,
    additionalHours,
    paidBreakMinutes: options.paidBreaks ? Math.max(0, totals.breakMinutes) : 0,
    manualAdditionalHours: roundHoursOneDecimal(manualAdditional),
    totalHours: roundHoursTwoDecimals(
      calculateEntryPaidEquivalentHours(
        {
          totalMinutes: totals.workedMinutes,
          overtimeMinutes: totals.overtimeMinutes,
          additionalHours: manualAdditional + paidBreakHours,
        },
        getGlobalOvertimeMultiplier(),
      ),
    ),
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

export function getTimesheetSortDate(item: {
  submittedAt: string | null
  updatedAt: string
  createdAt: string
  weekStart: string
}): string {
  return item.submittedAt ?? item.updatedAt ?? item.createdAt ?? `${item.weekStart}T00:00:00.000Z`
}

function compareTimesheetSortDateValues(
  left: {
    submittedAt: string | null
    updatedAt: string
    createdAt: string
    weekStart: string
  },
  right: {
    submittedAt: string | null
    updatedAt: string
    createdAt: string
    weekStart: string
  },
  direction: number,
): number {
  const leftTime = new Date(getTimesheetSortDate(left)).getTime()
  const rightTime = new Date(getTimesheetSortDate(right)).getTime()
  return (leftTime - rightTime) * direction
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
      case 'weekStart': {
        const weekCompare = left.weekStart.localeCompare(right.weekStart) * direction
        if (weekCompare !== 0) return weekCompare
        return compareTimesheetSortDateValues(left, right, direction)
      }
      case 'status':
        return left.status.localeCompare(right.status) * direction
      case 'workedHours':
        return (left.workedHours - right.workedHours) * direction
      case 'createdAt':
        return compareTimesheetSortDateValues(left, right, direction)
      case 'updatedAt':
        return left.updatedAt.localeCompare(right.updatedAt) * direction
      default:
        return 0
    }
  })
}

export function buildRecentWeekOptions(
  count = 8,
  settings: TimesheetWeekSettings = DEFAULT_TIMESHEET_WEEK_SETTINGS,
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const current = normalizeWeekStartForCompany(formatLocalDateString(new Date()))
  const start = parseLocalDate(current)

  for (let index = 0; index < count; index += 1) {
    const weekStart = new Date(start)
    weekStart.setDate(start.getDate() - index * 7)
    const value = formatLocalDateString(weekStart)
    const display = formatTimesheetWeekDisplay(value, settings)
    options.push({
      value,
      label: `${display.weekTitle} · ${display.weekRangeLabel}`,
    })
  }

  return options
}

export function formatTimesheetUpdatedAt(
  iso: string,
  timeFormat: CompanyTimeFormat = getGlobalTimeFormat(),
): string {
  return formatDateTimeFromIso(iso, { timeFormat })
}

export function formatTimesheetSubmittedAt(
  iso: string | null | undefined,
  options?: { separator?: 'dot' | 'comma'; timeFormat?: CompanyTimeFormat },
): string | null {
  if (!iso) return null

  const date = new Date(iso)
  const datePart = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
  const timePart = formatTimeFromDate(date, {
    timeFormat: options?.timeFormat ?? getGlobalTimeFormat(),
  })
  const separator = options?.separator === 'comma' ? ', ' : ' · '

  return `${datePart}${separator}${timePart}`
}

export function formatSubmittedAtDisplay(
  iso: string | null | undefined,
  status: TimesheetStatus,
): string {
  if (status === 'Draft' || !iso) return '—'
  return formatTimesheetSubmittedAt(iso) ?? '—'
}

export function formatHours(value: number): string {
  if (value <= 0) return '—'
  return formatHoursFromMinutes(Math.round(value * 60))
}

/**
 * Payable Total Hours display as hours-and-minutes.
 * Converts via whole minutes so 13.75h → 13h 45m (never 13h 75m).
 */
export function formatTotalHours(value: number): string {
  if (value <= 0) return '—'
  return formatHoursFromMinutes(Math.round(roundHoursTwoDecimals(value) * 60))
}

export function formatHoursFromMinutes(minutes: number): string {
  if (minutes <= 0) return '—'

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60

  if (remainder === 0) return `${hours}h`
  if (hours === 0) return `${remainder}m`
  return `${hours}h ${remainder}m`
}

export function getStatusLabel(status: TimesheetStatus): string {
  return status
}

export function getStatusBadgeClass(status: TimesheetStatus): string {
  switch (status) {
    case 'Draft':
      return 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10'
    case 'Submitted':
      return 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60'
    case 'Approved':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60'
    case 'Rejected':
      return 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60'
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
      sheet.weekTitle.toLowerCase().includes(query) ||
      String(sheet.weekNumber).includes(query) ||
      sheet.driverRole?.toLowerCase().includes(query)
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
  const date = parseLocalDate(dateValue)
  const day = date.getDay()
  const startDay = getTimesheetWeekSettings().timesheetWeekStartDay
  const diff = startDay === 'sunday' ? -day : day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return formatLocalDateString(date)
}

export function getDefaultWeekStartMonday(): string {
  return normalizeWeekStartForCompany(formatLocalDateString(new Date()))
}

export function parseLocalDate(dateValue: string): Date {
  const [year, month, day] = dateValue.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildWeekDates(weekStart: string): string[] {
  const start = parseLocalDate(weekStart)
  const dates: string[] = []

  for (let index = 0; index < 7; index += 1) {
    const current = new Date(start)
    current.setDate(start.getDate() + index)
    dates.push(formatLocalDateString(current))
  }

  return dates
}

export function formatWeekLabel(weekStart: string): string {
  const start = parseLocalDate(weekStart)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const startLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(end)

  return `${startLabel} – ${endLabel}`
}

const CURRENCY_SYMBOLS: Record<CompanyCurrency, string> = {
  GBP: '£',
  EUR: '€',
  USD: '$',
  RUB: '₽',
}

export function formatBonusAmount(
  amount: number,
  currency: CompanyCurrency = getSetting('currency') ?? DEFAULT_CURRENCY,
): string {
  const symbol = CURRENCY_SYMBOLS[currency]
  return `${symbol}${amount.toFixed(2)}`
}

export function formatDayLabel(dayDate: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(parseLocalDate(dayDate))
}

export function formatBreak(minutes: number): string {
  if (minutes <= 0) return '0m'

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60

  if (remainder === 0) return `${hours}h`
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${remainder}m`
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
        additionalHours: existing.additionalHours ?? 0,
        dailyComment: existing.dailyComment ?? '',
      }
    }

    return {
      dayDate,
      startTime: null,
      breakMinutes: defaultBreakMinutes,
      finishTime: null,
      totalMinutes: 0,
      overtimeMinutes: 0,
      additionalHours: 0,
      dailyComment: '',
    }
  })
}

export type RecalculateEntryOptions = {
  overtimeMode?: OvertimeMode
  overtimeRules?: Partial<TimesheetOvertimeRules>
  paidBreaks?: boolean
}

export function recalculateEntryInputs(
  entries: TimesheetEntryInput[],
  options: RecalculateEntryOptions = {},
): TimesheetEntryInput[] {
  const overtimeMode = options.overtimeMode ?? 'Manual'
  const rules = buildTimesheetOvertimeRules(options.overtimeRules)
  const paidBreaks = options.paidBreaks ?? false

  return entries.map((entry) => {
    const totalMinutes = calculateEntryTotalMinutes(entry, { paidBreaks })
    const dayRules = resolveDayOvertimeRules(entry.dayDate, rules)
    const overtimeMinutes =
      overtimeMode === 'Automatic'
        ? calculateAutomaticOvertimeMinutes(totalMinutes, dayRules.afterHours)
        : entry.overtimeMinutes

    return {
      ...entry,
      totalMinutes,
      overtimeMinutes,
    }
  })
}

/** View mode: recalculate worked minutes only; keep overtime_minutes from DB. */
export function applyViewModeEntryTotals(
  entries: TimesheetEntryInput[],
  options: Pick<RecalculateEntryOptions, 'paidBreaks'> = {},
): TimesheetEntryInput[] {
  const paidBreaks = options.paidBreaks ?? false

  return entries.map((entry) => ({
    ...entry,
    totalMinutes: calculateEntryTotalMinutes(entry, { paidBreaks }),
  }))
}

export function canEditTimesheet(status: TimesheetStatus): boolean {
  return (
    status === 'Draft' ||
    status === 'Rejected' ||
    status === 'Submitted' ||
    status === 'Approved'
  )
}

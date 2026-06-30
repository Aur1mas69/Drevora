import type { CompanyDateFormat, CompanyWeekStarts, OvertimeAfterHours } from '@/lib/companySettingsTypes'

export type CompanyTimeFormat = '24-hour' | '12-hour'

export const DEFAULT_TIME_FORMAT: CompanyTimeFormat = '24-hour'

export const COMPANY_TIME_FORMAT_OPTIONS: {
  value: CompanyTimeFormat
  label: string
}[] = [
  { value: '24-hour', label: '24 Hour' },
  { value: '12-hour', label: '12 Hour' },
]
export const DEFAULT_DATE_FORMAT: CompanyDateFormat = 'DMY'
export const DEFAULT_WEEK_STARTS: CompanyWeekStarts = 'monday'
export const DEFAULT_OVERTIME_AFTER_HOURS: OvertimeAfterHours = 8

export type DateTimeFormatOptions = {
  timeFormat?: CompanyTimeFormat
  dateFormat?: CompanyDateFormat
  timeZone?: string
  locale?: string
}

let globalTimeFormat: CompanyTimeFormat = DEFAULT_TIME_FORMAT
let globalDateFormat: CompanyDateFormat = DEFAULT_DATE_FORMAT
let globalWeekStarts: CompanyWeekStarts = DEFAULT_WEEK_STARTS
let globalOvertimeAfterHours: OvertimeAfterHours = DEFAULT_OVERTIME_AFTER_HOURS

export function setGlobalTimeFormat(timeFormat: CompanyTimeFormat): void {
  globalTimeFormat = timeFormat
}

export function getGlobalTimeFormat(): CompanyTimeFormat {
  return globalTimeFormat
}

export function setGlobalDateFormat(dateFormat: CompanyDateFormat): void {
  globalDateFormat = dateFormat
}

export function getGlobalDateFormat(): CompanyDateFormat {
  return globalDateFormat
}

export function setGlobalWeekStarts(weekStarts: CompanyWeekStarts): void {
  globalWeekStarts = weekStarts
}

export function getGlobalWeekStarts(): CompanyWeekStarts {
  return globalWeekStarts
}

export function setGlobalOvertimeAfterHours(hours: OvertimeAfterHours): void {
  globalOvertimeAfterHours = hours
}

export function getGlobalOvertimeAfterHours(): OvertimeAfterHours {
  return globalOvertimeAfterHours
}

export function applyGlobalDateTimeSettings(settings: {
  timeFormat?: CompanyTimeFormat
  dateFormat?: CompanyDateFormat
  weekStarts?: CompanyWeekStarts
  overtimeAfterHours?: OvertimeAfterHours
}): void {
  if (settings.timeFormat) setGlobalTimeFormat(settings.timeFormat)
  if (settings.dateFormat) setGlobalDateFormat(settings.dateFormat)
  if (settings.weekStarts) setGlobalWeekStarts(settings.weekStarts)
  if (settings.overtimeAfterHours) setGlobalOvertimeAfterHours(settings.overtimeAfterHours)
}

export function normalizeTimeFormat(value: string | null | undefined): CompanyTimeFormat {
  if (!value) return DEFAULT_TIME_FORMAT

  const normalized = value.trim().toLowerCase()
  if (
    normalized === '12-hour' ||
    normalized === '12h' ||
    normalized === '12 hour' ||
    normalized === '12'
  ) {
    return '12-hour'
  }

  return '24-hour'
}

function uses12HourClock(timeFormat: CompanyTimeFormat): boolean {
  return timeFormat === '12-hour'
}

export function normalizeDateFormat(value: string | null | undefined): CompanyDateFormat {
  if (value === 'MDY' || value === 'YMD') return value
  return DEFAULT_DATE_FORMAT
}

export function parseClockTime(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim())
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
    return null
  }

  return { hours, minutes }
}

function resolveTimeFormat(options?: DateTimeFormatOptions): CompanyTimeFormat {
  return options?.timeFormat ?? globalTimeFormat
}

function resolveDateFormat(options?: DateTimeFormatOptions): CompanyDateFormat {
  return options?.dateFormat ?? globalDateFormat
}

function buildTimeFormatter(timeFormat: CompanyTimeFormat, timeZone?: string) {
  const twelveHour = uses12HourClock(timeFormat)
  const baseOptions: Intl.DateTimeFormatOptions = {
    hour: twelveHour ? 'numeric' : '2-digit',
    minute: '2-digit',
    hour12: twelveHour,
    ...(timeZone ? { timeZone } : {}),
  }

  const locale = twelveHour ? 'en-US' : 'en-GB'
  return new Intl.DateTimeFormat(locale, baseOptions)
}


export function formatDateFromDate(
  date: Date,
  options?: DateTimeFormatOptions,
): string {
  const dateFormat = resolveDateFormat(options)
  const timeZone = options?.timeZone

  if (dateFormat === 'YMD') {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)

    const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
    const month = parts.find((part) => part.type === 'month')?.value ?? '01'
    const day = parts.find((part) => part.type === 'day')?.value ?? '01'
    return `${year}-${month}-${day}`
  }

  const locale = dateFormat === 'MDY' ? 'en-US' : 'en-GB'
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatDateFromIso(
  iso: string,
  options?: DateTimeFormatOptions,
): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return formatDateFromDate(new Date(`${iso}T00:00:00`), options)
  }

  return formatDateFromDate(new Date(iso), options)
}

export function formatTimeFromDate(
  date: Date,
  options?: DateTimeFormatOptions,
): string {
  const timeFormat = resolveTimeFormat(options)
  return buildTimeFormatter(timeFormat, options?.timeZone).format(date)
}

export function formatClockTime(
  value: string | null | undefined,
  options?: DateTimeFormatOptions,
): string {
  if (!value?.trim()) return '—'

  const parsed = parseClockTime(value)
  if (!parsed) return value.trim().slice(0, 5)

  const date = new Date(1970, 0, 1, parsed.hours, parsed.minutes, 0, 0)
  return formatTimeFromDate(date, options)
}

export function formatDateTimeFromIso(
  iso: string,
  options?: DateTimeFormatOptions,
): string {
  const date = new Date(iso)
  const datePart = formatDateFromDate(date, options)
  const timePart = formatTimeFromDate(date, options)
  return `${datePart}, ${timePart}`
}

export function formatRelativeDateTimeLabel(
  value: string,
  options?: DateTimeFormatOptions,
): string {
  const date = new Date(value)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  const time = formatTimeFromDate(date, options)

  if (diffDays === 0) return `Today • ${time}`
  if (diffDays === -1) return 'Yesterday'
  if (diffDays === 1) return `Tomorrow • ${time}`

  const day = formatDateFromDate(date, options)
  return `${day} • ${time}`
}

export function formatOperationsDateTime(
  date: Date,
  options?: DateTimeFormatOptions,
): string {
  const weekday = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
  }).format(date)

  const datePart = formatDateFromDate(date, options)
  const timePart = formatTimeFromDate(date, options)
  return `${weekday} • ${datePart} • ${timePart}`
}

export function normalizeWeekStart(
  dateValue: string,
  weekStarts: CompanyWeekStarts = globalWeekStarts,
): string {
  const date = new Date(`${dateValue}T00:00:00`)
  const day = date.getDay()

  if (weekStarts === 'sunday') {
    const diff = day === 0 ? 0 : -day
    date.setDate(date.getDate() + diff)
    return date.toISOString().slice(0, 10)
  }

  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date.toISOString().slice(0, 10)
}

export function getDefaultWeekStart(
  weekStarts: CompanyWeekStarts = globalWeekStarts,
): string {
  return normalizeWeekStart(new Date().toISOString().slice(0, 10), weekStarts)
}

export function getDateFormatLabel(dateFormat: CompanyDateFormat): string {
  switch (dateFormat) {
    case 'MDY':
      return 'MM/DD/YYYY'
    case 'YMD':
      return 'YYYY-MM-DD'
    case 'DMY':
    default:
      return 'DD/MM/YYYY'
  }
}

export function createCompanyDateTimeFormatter(
  timeFormat: CompanyTimeFormat,
  timeZone?: string,
  dateFormat: CompanyDateFormat = globalDateFormat,
) {
  const options: DateTimeFormatOptions = { timeFormat, dateFormat, timeZone }

  return {
    timeFormat,
    dateFormat,
    timeZone,
    formatDate: (value: string | Date) =>
      value instanceof Date
        ? formatDateFromDate(value, options)
        : formatDateFromIso(value, options),
    formatTime: (value: string | null | undefined) => formatClockTime(value, options),
    formatTimeFromDate: (date: Date) => formatTimeFromDate(date, options),
    formatDateTime: (iso: string) => formatDateTimeFromIso(iso, options),
    formatRelativeDateTime: (iso: string) => formatRelativeDateTimeLabel(iso, options),
    formatOperationsDateTime: (date: Date) => formatOperationsDateTime(date, options),
  }
}

export type CompanyDateTimeFormatter = ReturnType<typeof createCompanyDateTimeFormatter>

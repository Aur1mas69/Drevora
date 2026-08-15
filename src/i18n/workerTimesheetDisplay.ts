import {
  parseWorkerLanguage,
  WORKER_LANGUAGE_LOCALES,
} from '@/i18n/languages'
import { parseLocalDate } from '@/lib/timesheetUtils'
import type { TimesheetDayType, TimesheetStatus } from '@/lib/timesheetTypes'
import { formatTimeFromDate, getGlobalTimeFormat } from '@/lib/dateTimeFormat'

export function workerIntlLocale(language: string | undefined): string {
  return WORKER_LANGUAGE_LOCALES[parseWorkerLanguage(language)]
}

export function formatWorkerTimesheetDayLabel(
  dayDate: string,
  language: string | undefined,
): string {
  return new Intl.DateTimeFormat(workerIntlLocale(language), {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(parseLocalDate(dayDate))
}

export function formatWorkerTimesheetWeekday(
  dayDate: string,
  language: string | undefined,
  weekday: 'short' | 'long',
): string {
  return new Intl.DateTimeFormat(workerIntlLocale(language), { weekday }).format(
    parseLocalDate(dayDate),
  )
}

export function formatWorkerTimesheetWeekRange(
  weekStart: string,
  language: string | undefined,
): string {
  const start = parseLocalDate(weekStart)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }
  const locale = workerIntlLocale(language)
  return `${new Intl.DateTimeFormat(locale, options).format(start)} – ${new Intl.DateTimeFormat(locale, options).format(end)}`
}

/** Date part follows Worker language; clock follows company 12/24 setting. */
export function formatWorkerTimesheetDateTime(
  iso: string | null | undefined,
  language: string | undefined,
): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const datePart = new Intl.DateTimeFormat(workerIntlLocale(language), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
  const timePart = formatTimeFromDate(date, {
    timeFormat: getGlobalTimeFormat(),
  })
  return `${datePart} · ${timePart}`
}

export function timesheetStatusI18nKey(status: TimesheetStatus): string {
  switch (status) {
    case 'Draft':
      return 'timesheets.status.draft'
    case 'Submitted':
      return 'timesheets.status.submitted'
    case 'Approved':
      return 'timesheets.status.approved'
    case 'Rejected':
      return 'timesheets.status.rejected'
  }
}

export function holidayDayTypeI18nKey(dayType: TimesheetDayType): string {
  switch (dayType) {
    case 'holiday':
      return 'timesheets.holidayDayFull'
    case 'holiday_am':
      return 'timesheets.holidayDayAm'
    case 'holiday_pm':
      return 'timesheets.holidayDayPm'
    default:
      return 'timesheets.dayTypeWork'
  }
}

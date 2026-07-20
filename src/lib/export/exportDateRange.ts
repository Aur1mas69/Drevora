import { getCompanyTodayIsoDate } from '@/lib/companyDate'
import type { CompanyWeekStarts } from '@/lib/companySettingsTypes'
import { normalizeWeekStart } from '@/lib/dateTimeFormat'

/** Shared Admin export date-range presets (label order is fixed). */
export const EXPORT_DATE_RANGE_OPTIONS = [
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom date range' },
  { value: 'all_time', label: 'All time' },
] as const

export type ExportDateRangePreset = (typeof EXPORT_DATE_RANGE_OPTIONS)[number]['value']

export type ExportDateRangeSelection = {
  preset: ExportDateRangePreset
  customFrom: string
  customTo: string
}

export type ResolvedExportDateRange = {
  /** Inclusive lower bound (YYYY-MM-DD), omitted for all-time. */
  dateFrom?: string
  /** Inclusive upper bound (YYYY-MM-DD), omitted for all-time. */
  dateTo?: string
  label: string
  preset: ExportDateRangePreset
}

export const DEFAULT_EXPORT_DATE_RANGE: ExportDateRangeSelection = {
  preset: 'all_time',
  customFrom: '',
  customTo: '',
}

export const EXPORT_ERROR_EMPTY_DATE_RANGE = 'No records found for this date range'

export type ResolveExportDateRangeOptions = {
  weekStarts?: CompanyWeekStarts
  timeZone?: string | null
  /** Optional display formatter for custom range labels. */
  formatDate?: (isoDate: string) => string
}

function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + days)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function monthBoundsFromIsoDay(isoDate: string): { dateFrom: string; dateTo: string } {
  const [yearText, monthText] = isoDate.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const lastDay = new Date(year, month, 0).getDate()
  const paddedMonth = String(month).padStart(2, '0')
  return {
    dateFrom: `${year}-${paddedMonth}-01`,
    dateTo: `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`,
  }
}

function shiftMonthIsoDay(isoDate: string, deltaMonths: number): string {
  const [yearText, monthText, dayText] = isoDate.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const shifted = new Date(year, month - 1 + deltaMonths, Math.min(day, 28))
  // Anchor to day 1 of target month then re-read year/month.
  const target = new Date(shifted.getFullYear(), shifted.getMonth(), 1)
  return [
    target.getFullYear(),
    String(target.getMonth() + 1).padStart(2, '0'),
    '01',
  ].join('-')
}

/**
 * Validate custom export dates. Returns null when valid / not custom.
 */
export function validateExportCustomDateRange(
  selection: ExportDateRangeSelection,
): string | null {
  if (selection.preset !== 'custom') return null
  const from = selection.customFrom.trim()
  const to = selection.customTo.trim()
  if (!from || !to) {
    return 'Select both start and end dates for a custom range.'
  }
  if (to < from) {
    return 'End date cannot be before start date.'
  }
  return null
}

export function isExportDateRangeReady(selection: ExportDateRangeSelection): boolean {
  return validateExportCustomDateRange(selection) == null
}

/**
 * Resolve a mounted-only export date selection to inclusive ISO date bounds.
 * Does not invent a new week-start rule — uses company weekStarts when provided.
 */
export function resolveExportDateRange(
  selection: ExportDateRangeSelection,
  options: ResolveExportDateRangeOptions = {},
): ResolvedExportDateRange {
  const weekStarts = options.weekStarts ?? 'monday'
  const today = getCompanyTodayIsoDate(options.timeZone)
  const formatDate = options.formatDate ?? ((value: string) => value)

  switch (selection.preset) {
    case 'this_week': {
      const weekStart = normalizeWeekStart(today, weekStarts)
      const weekEnd = addDaysIso(weekStart, 6)
      return {
        preset: 'this_week',
        dateFrom: weekStart,
        dateTo: weekEnd,
        label: 'This week',
      }
    }
    case 'this_month': {
      const bounds = monthBoundsFromIsoDay(today)
      return {
        preset: 'this_month',
        ...bounds,
        label: 'This month',
      }
    }
    case 'last_month': {
      const bounds = monthBoundsFromIsoDay(shiftMonthIsoDay(today, -1))
      return {
        preset: 'last_month',
        ...bounds,
        label: 'Last month',
      }
    }
    case 'custom': {
      const from = selection.customFrom.trim()
      const to = selection.customTo.trim()
      return {
        preset: 'custom',
        dateFrom: from || undefined,
        dateTo: to || undefined,
        label:
          from && to
            ? `${formatDate(from)} – ${formatDate(to)}`
            : 'Custom date range',
      }
    }
    case 'all_time':
    default:
      return {
        preset: 'all_time',
        label: 'All time',
      }
  }
}

/** Filter client-side rows by an inclusive YYYY-MM-DD field (or date prefix of ISO datetime). */
export function rowMatchesExportDateRange(
  isoDateOrDateTime: string | null | undefined,
  range: ResolvedExportDateRange,
): boolean {
  if (!range.dateFrom && !range.dateTo) return true
  if (!isoDateOrDateTime) return false
  const day = isoDateOrDateTime.slice(0, 10)
  if (range.dateFrom && day < range.dateFrom) return false
  if (range.dateTo && day > range.dateTo) return false
  return true
}

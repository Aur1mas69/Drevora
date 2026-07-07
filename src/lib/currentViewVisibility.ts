import { getCompanyTodayIsoDate } from '@/lib/companyDate'

export type CurrentViewMode = 'current' | 'history' | 'all'

export function getCurrentMonthDateRange(date = new Date()): {
  dateFrom: string
  dateTo: string
} {
  const year = date.getFullYear()
  const month = date.getMonth()
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)

  return {
    dateFrom: formatDateInputValue(start),
    dateTo: formatDateInputValue(end),
  }
}

export function getCurrentViewToday(): string {
  return getCompanyTodayIsoDate()
}

export function formatCurrentMonthLabel(date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatDateInputValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

// TODO(retention): keep operational records searchable for at least 24 months.
// Future scheduled cleanup must be explicit, audited, and separate from current-view cleaning.

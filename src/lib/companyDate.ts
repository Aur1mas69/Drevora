import { DEFAULT_COMPANY_SETTINGS } from '@/lib/companySettingsTypes'

export const DEFAULT_COMPANY_TIMEZONE = DEFAULT_COMPANY_SETTINGS.timezone

export function getIsoDateInTimeZone(
  date: Date = new Date(),
  timeZone: string = DEFAULT_COMPANY_TIMEZONE,
): string {
  const resolvedTimeZone = timeZone.trim() || DEFAULT_COMPANY_TIMEZONE

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: resolvedTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)

    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value

    if (year && month && day) {
      return `${year}-${month}-${day}`
    }
  } catch {
    // Fall through to browser-local date below.
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function getCompanyTodayIsoDate(timeZone?: string | null): string {
  return getIsoDateInTimeZone(new Date(), timeZone?.trim() || DEFAULT_COMPANY_TIMEZONE)
}

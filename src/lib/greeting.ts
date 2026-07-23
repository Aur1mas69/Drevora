import type { CompanyTimeFormat } from '@/lib/dateTimeFormat'
import { formatTimeFromDate } from '@/lib/dateTimeFormat'
import { WORKER_EMPLOYMENT_TYPES } from '@/lib/workerProfileUtils'

export function getTimeGreeting(date = new Date()): string {
  const hour = date.getHours()

  if (hour >= 5 && hour < 12) return 'Good Morning'
  if (hour >= 12 && hour < 17) return 'Good Afternoon'
  if (hour >= 17 && hour < 22) return 'Good Evening'
  return 'Good Night'
}

/** Sentence-case daypart for personal greetings (Worker Home). */
export function getSentenceTimeGreeting(date = new Date()): string {
  const hour = date.getHours()

  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  if (hour >= 17 && hour < 22) return 'Good evening'
  return 'Good night'
}

const INVALID_GREETING_FIRST_NAMES = new Set(
  WORKER_EMPLOYMENT_TYPES.map((value) => value.toLowerCase()),
)

/**
 * Worker first name for greetings. Rejects empty values and employment-type
 * labels (e.g. "Temporary") that must never appear as a personal name.
 */
export function resolveGreetingFirstName(
  firstName: string | null | undefined,
): string | null {
  const trimmed = firstName?.trim()
  if (!trimmed) return null
  if (INVALID_GREETING_FIRST_NAMES.has(trimmed.toLowerCase())) return null
  return trimmed
}

/** Combined "Good morning, Aurimas" — daypart only while name is unavailable. */
export function formatPersonalTimeGreeting(
  firstName: string | null | undefined,
  date = new Date(),
): string {
  const daypart = getSentenceTimeGreeting(date)
  const name = resolveGreetingFirstName(firstName)
  return name ? `${daypart}, ${name}` : daypart
}

export function getOperationsDate(date = new Date()): string {
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(date)
  const datePart = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)

  return `${weekday} • ${datePart}`
}

export function isNightHours(date = new Date(), timeZone = 'Europe/London'): boolean {
  const hour = getHourInTimeZone(date, timeZone)
  return hour >= 22 || hour < 5
}

export function getHourInTimeZone(date: Date, timeZone: string): number {
  try {
    const hourPart = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(date)

    return Number(hourPart.find((part) => part.type === 'hour')?.value ?? date.getHours())
  } catch {
    return date.getHours()
  }
}

export function formatCompanyOperationsDate(date: Date, timeZone: string): string {
  try {
    const weekday = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'long',
    }).format(date)
    const datePart = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date)

    return `${weekday} • ${datePart}`
  } catch {
    return getOperationsDate(date)
  }
}

export function formatCompanyLocalTime(
  date: Date,
  timeZone: string,
  timeFormat: CompanyTimeFormat = '24-hour',
): string {
  try {
    return formatTimeFromDate(date, { timeFormat, timeZone })
  } catch {
    return formatTimeFromDate(date, { timeFormat })
  }
}

import type { CompanyTimeFormat } from '@/lib/dateTimeFormat'
import { formatTimeFromDate } from '@/lib/dateTimeFormat'
import { WORKER_EMPLOYMENT_TYPES } from '@/lib/workerProfileUtils'

export type GreetingPeriod = 'morning' | 'afternoon' | 'evening' | 'night'

/** Same hour bands as Worker Home greeting icons: 05–11 / 12–16 / 17–21 / 22–04. */
export function getGreetingPeriod(date = new Date()): GreetingPeriod {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'night'
}

export function getTimeGreeting(date = new Date()): string {
  switch (getGreetingPeriod(date)) {
    case 'morning':
      return 'Good Morning'
    case 'afternoon':
      return 'Good Afternoon'
    case 'evening':
      return 'Good Evening'
    case 'night':
      return 'Good Night'
  }
}

/** Sentence-case daypart for personal greetings (Worker Home). */
export function getSentenceTimeGreeting(date = new Date()): string {
  switch (getGreetingPeriod(date)) {
    case 'morning':
      return 'Good morning'
    case 'afternoon':
      return 'Good afternoon'
    case 'evening':
      return 'Good evening'
    case 'night':
      return 'Good night'
  }
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

/**
 * Worker full name for Home greetings. Uses profile first + last name, rejects
 * employment-type labels, and falls back safely when the name is missing.
 */
export function resolveGreetingFullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback = 'Worker',
): string {
  const first = resolveGreetingFirstName(firstName)
  const lastRaw = lastName?.trim() || null
  const last =
    lastRaw && !INVALID_GREETING_FIRST_NAMES.has(lastRaw.toLowerCase())
      ? lastRaw
      : null
  const full = [first, last].filter(Boolean).join(' ').trim()
  return full || fallback
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

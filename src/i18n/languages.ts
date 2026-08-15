export const WORKER_LANGUAGES = ['en', 'lt', 'pl', 'ro', 'ru'] as const

export type WorkerLanguage = (typeof WORKER_LANGUAGES)[number]

export const DEFAULT_WORKER_LANGUAGE: WorkerLanguage = 'en'

/** Native display labels for the Worker language selector. Do not translate. */
export const WORKER_LANGUAGE_LABELS: Record<WorkerLanguage, string> = {
  en: 'English',
  lt: 'Lietuvių',
  pl: 'Polski',
  ro: 'Română',
  ru: 'Русский',
}

/** Local SVG flag asset codes. English uses the GB flag. */
export const WORKER_LANGUAGE_FLAG_CODES = {
  en: 'gb',
  lt: 'lt',
  pl: 'pl',
  ro: 'ro',
  ru: 'ru',
} as const

export type WorkerLanguageFlagCode =
  (typeof WORKER_LANGUAGE_FLAG_CODES)[WorkerLanguage]

/** Intl locale mapping for future date/number formatting. Not applied in Phase 1. */
export const WORKER_LANGUAGE_LOCALES: Record<WorkerLanguage, string> = {
  en: 'en-GB',
  lt: 'lt-LT',
  pl: 'pl-PL',
  ro: 'ro-RO',
  ru: 'ru-RU',
}

export function isWorkerLanguage(value: unknown): value is WorkerLanguage {
  return (
    value === 'en' ||
    value === 'lt' ||
    value === 'pl' ||
    value === 'ro' ||
    value === 'ru'
  )
}

/** Returns a supported language, or English when the value is missing/invalid. */
export function parseWorkerLanguage(value: unknown): WorkerLanguage {
  return isWorkerLanguage(value) ? value : DEFAULT_WORKER_LANGUAGE
}

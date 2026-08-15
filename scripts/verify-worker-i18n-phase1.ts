/**
 * Focused Phase 1 Worker i18n verification.
 * Run: npm run verify:worker-i18n-phase1
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_WORKER_LANGUAGE,
  isWorkerLanguage,
  parseWorkerLanguage,
  WORKER_LANGUAGE_FLAG_CODES,
  WORKER_LANGUAGE_LABELS,
  WORKER_LANGUAGE_LOCALES,
  WORKER_LANGUAGES,
} from '../src/i18n/languages.ts'
import { enWorker } from '../src/i18n/locales/en/worker.ts'
import { ltWorker } from '../src/i18n/locales/lt/worker.ts'
import { plWorker } from '../src/i18n/locales/pl/worker.ts'
import { roWorker } from '../src/i18n/locales/ro/worker.ts'
import { ruWorker } from '../src/i18n/locales/ru/worker.ts'
import { workerI18n } from '../src/i18n/workerI18n.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return prefix ? [prefix] : []
  if (!value || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  )
}

function readValue(bundle: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[part]
  }, bundle)
}

function interpolationTokens(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)]
    .map((match) => match[1])
    .sort()
}

function read(relative: string): string {
  return readFileSync(resolve(relative), 'utf8')
}

assert(WORKER_LANGUAGES.length === 5, 'exactly five supported language codes')
assert(
  WORKER_LANGUAGES.join(',') === 'en,lt,pl,ro,ru',
  'language codes are en lt pl ro ru',
)
assert(DEFAULT_WORKER_LANGUAGE === 'en', 'default language is en')
assert(parseWorkerLanguage('nope') === 'en', 'invalid language falls back to en')
assert(parseWorkerLanguage(null) === 'en', 'null language falls back to en')
assert(isWorkerLanguage('en') && !isWorkerLanguage('de'), 'language guard')

assert(WORKER_LANGUAGE_LABELS.en === 'English', 'English label')
assert(WORKER_LANGUAGE_LABELS.lt === 'Lietuvių', 'Lietuvių label')
assert(WORKER_LANGUAGE_LABELS.pl === 'Polski', 'Polski label')
assert(WORKER_LANGUAGE_LABELS.ro === 'Română', 'Română label')
assert(WORKER_LANGUAGE_LABELS.ru === 'Русский', 'Русский label')

assert(WORKER_LANGUAGE_FLAG_CODES.en === 'gb', 'English uses GB flag')
assert(WORKER_LANGUAGE_FLAG_CODES.lt === 'lt', 'Lithuanian uses LT flag')
assert(WORKER_LANGUAGE_FLAG_CODES.pl === 'pl', 'Polish uses PL flag')
assert(WORKER_LANGUAGE_FLAG_CODES.ro === 'ro', 'Romanian uses RO flag')
assert(WORKER_LANGUAGE_FLAG_CODES.ru === 'ru', 'Russian uses RU flag')

for (const code of Object.values(WORKER_LANGUAGE_FLAG_CODES)) {
  const svg = read(`src/assets/flags/${code}.svg`)
  assert(svg.includes('<svg'), `local SVG flag exists for ${code}`)
  assert(!/[🇬🇧🇱🇹🇵🇱🇷🇴🇷🇺]/.test(svg), `${code} flag is not emoji`)
}

assert(WORKER_LANGUAGE_LOCALES.en === 'en-GB', 'en locale mapping')
assert(WORKER_LANGUAGE_LOCALES.lt === 'lt-LT', 'lt locale mapping')
assert(WORKER_LANGUAGE_LOCALES.pl === 'pl-PL', 'pl locale mapping')
assert(WORKER_LANGUAGE_LOCALES.ro === 'ro-RO', 'ro locale mapping')
assert(WORKER_LANGUAGE_LOCALES.ru === 'ru-RU', 'ru locale mapping')

const locales = {
  en: enWorker,
  lt: ltWorker,
  pl: plWorker,
  ro: roWorker,
  ru: ruWorker,
} as const

const englishKeys = flattenKeys(enWorker)
assert(englishKeys.length > 0, 'English Phase 1 keys exist')

for (const language of WORKER_LANGUAGES) {
  const keys = flattenKeys(locales[language])
  for (const key of englishKeys) {
    assert(keys.includes(key), `missing ${language} key: ${key}`)
    const englishValue = readValue(enWorker, key)
    const localeValue = readValue(locales[language], key)
    assert(typeof englishValue === 'string' && englishValue.length > 0, `en ${key} is copy`)
    assert(typeof localeValue === 'string' && localeValue.length > 0, `${language} ${key} is copy`)
    if (typeof englishValue !== 'string' || typeof localeValue !== 'string') continue
    assert(
      interpolationTokens(englishValue).join(',') ===
        interpolationTokens(localeValue).join(','),
      `interpolation mismatch for ${language} ${key}`,
    )
  }
}

assert(workerI18n.options.fallbackLng === 'en' || (Array.isArray(workerI18n.options.fallbackLng) && workerI18n.options.fallbackLng.includes('en')), 'fallbackLng is en')

void workerI18n.changeLanguage('lt')
const missing = workerI18n.t('nav.thisKeyDoesNotExist')
assert(
  missing !== 'nav.thisKeyDoesNotExist',
  'missing keys must not leak the raw key when English fallback/handler exists',
)
assert(
  workerI18n.t('nav.home') === 'Pradžia',
  'Lithuanian nav.home is used when language is lt',
)
void workerI18n.changeLanguage('en')
assert(workerI18n.t('nav.home') === 'Home', 'English nav.home after reset')

const adminLayout = read('src/layouts/AdminLayout.tsx')
const appRouter = read('src/router/AppRouter.tsx')
const loginPage = read('src/pages/LoginTwilightPreviewPage.tsx')
const workerSettings = read('src/pages/worker/WorkerSettingsPage.tsx')
const mainLayout = read('src/layouts/MainLayout.tsx')

assert(!adminLayout.includes('WorkerLocaleProvider'), 'AdminLayout has no Worker locale provider')
assert(!adminLayout.includes('preferred_language'), 'AdminLayout has no language column wiring')
assert(!adminLayout.includes('WORKER_LANGUAGE_LABELS'), 'AdminLayout has no language selector')
assert(!appRouter.includes('WorkerLocaleProvider'), 'AppRouter does not mount Worker locale itself')
assert(!loginPage.includes('WorkerLocaleProvider'), 'shared login has no Worker locale provider')
assert(!loginPage.includes('WORKER_LANGUAGE_LABELS'), 'shared login has no language selector')
assert(mainLayout.includes('WorkerLocaleProvider'), 'MainLayout mounts Worker locale provider')
assert(workerSettings.includes('WORKER_LANGUAGE_LABELS'), 'Worker Settings has the language selector')
assert(workerSettings.includes('settings.language'), 'Worker Settings translates Language')
assert(workerSettings.includes('WorkerLanguageFlag'), 'Worker Settings uses SVG language flags')
assert(!workerSettings.includes('🇬🇧'), 'Worker Settings does not use emoji flags')

const homeKeys = englishKeys.filter((key) => key.startsWith('home.'))
assert(homeKeys.length >= 20, 'Phase 2 home keys exist')
assert(homeKeys.includes('home.heroTitle'), 'home.heroTitle exists')
assert(homeKeys.includes('home.greetingMorning'), 'home.greetingMorning exists')
assert(homeKeys.includes('home.startVehicleCheck'), 'home.startVehicleCheck exists')
assert(String(ltWorker.home.heroTitle) !== String(enWorker.home.heroTitle), 'LT home.heroTitle is translated')
assert(String(plWorker.home.heroTitle) !== String(enWorker.home.heroTitle), 'PL home.heroTitle is translated')
assert(String(roWorker.home.heroTitle) !== String(enWorker.home.heroTitle), 'RO home.heroTitle is translated')
assert(String(ruWorker.home.heroTitle) !== String(enWorker.home.heroTitle), 'RU home.heroTitle is translated')

const dashboardPage = read('src/pages/DashboardPage.tsx')
const homeSheet = read('src/components/worker/WorkerHomeDefaultVehicleSheet.tsx')
assert(dashboardPage.includes("t('home.heroTitle'"), 'Dashboard translates hero title')
assert(dashboardPage.includes("t('home.startVehicleCheck'"), 'Dashboard translates start CTA')
assert(dashboardPage.includes("t('home.quickActions'"), 'Dashboard translates quick actions')
assert(dashboardPage.includes('WORKER_HOME_GREETING_KEYS'), 'Dashboard uses localized greeting keys')
assert(homeSheet.includes("t('home.selectDefaultVehicle'"), 'Home vehicle sheet title is translated')
assert(mainLayout.includes('nav.${item.id}'), 'MainLayout translates nav labels')
assert(mainLayout.includes("t('nav.home'"), 'MainLayout translates Home nav')

void workerI18n.changeLanguage('lt')
assert(
  workerI18n.t('home.heroTitle') === ltWorker.home.heroTitle,
  'Lithuanian home.heroTitle is used when language is lt',
)
void workerI18n.changeLanguage('en')
assert(workerI18n.t('home.heroTitle') === enWorker.home.heroTitle, 'English home.heroTitle after reset')

const timesheetKeys = englishKeys.filter((key) => key.startsWith('timesheets.'))
assert(timesheetKeys.length >= 40, 'Phase 3A timesheets keys exist')
assert(timesheetKeys.includes('timesheets.title'), 'timesheets.title exists')
assert(timesheetKeys.includes('timesheets.submitWeek'), 'timesheets.submitWeek exists')
assert(timesheetKeys.includes('timesheets.status.draft'), 'timesheets.status.draft exists')
assert(timesheetKeys.includes('timesheets.errors.timePair'), 'timesheets.errors.timePair exists')
assert(
  String(ltWorker.timesheets.title) !== String(enWorker.timesheets.title),
  'LT timesheets.title is translated',
)
assert(
  String(plWorker.timesheets.title) !== String(enWorker.timesheets.title),
  'PL timesheets.title is translated',
)
assert(
  String(roWorker.timesheets.title) !== String(enWorker.timesheets.title),
  'RO timesheets.title is translated',
)
assert(
  String(ruWorker.timesheets.title) !== String(enWorker.timesheets.title),
  'RU timesheets.title is translated',
)

const workerTimesheetsPage = read('src/pages/worker/WorkerTimesheetsPage.tsx')
assert(
  workerTimesheetsPage.includes("t('timesheets.title'"),
  'Worker Timesheets page translates title',
)
assert(
  workerTimesheetsPage.includes("t('timesheets.submitWeek'"),
  'Worker Timesheets page translates submit',
)
assert(
  !workerTimesheetsPage.includes('getStatusLabel('),
  'Worker Timesheets page does not show canonical status via getStatusLabel',
)

void workerI18n.changeLanguage('lt')
assert(
  workerI18n.t('timesheets.title') === ltWorker.timesheets.title,
  'Lithuanian timesheets.title is used when language is lt',
)
void workerI18n.changeLanguage('en')
assert(
  workerI18n.t('timesheets.title') === enWorker.timesheets.title,
  'English timesheets.title after reset',
)

console.log('verify-worker-i18n-phase1: PASS')

import i18n from 'i18next'
import { DEFAULT_WORKER_LANGUAGE, parseWorkerLanguage } from '@/i18n/languages'
import { enWorker } from '@/i18n/locales/en/worker'
import { ltWorker } from '@/i18n/locales/lt/worker'
import { plWorker } from '@/i18n/locales/pl/worker'
import { roWorker } from '@/i18n/locales/ro/worker'
import { ruWorker } from '@/i18n/locales/ru/worker'

export const WORKER_I18N_NAMESPACE = 'worker'

const englishBundle = enWorker as unknown as Record<string, unknown>

function readEnglishValue(key: string): string | undefined {
  const parts = key.split('.')
  let current: unknown = englishBundle
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

/**
 * Isolated Worker i18n instance. Never passed to Admin/Office/login.
 * Missing keys resolve to English copy — never the raw key when English exists.
 */
export const workerI18n = i18n.createInstance()

void workerI18n.init({
  resources: {
    en: { [WORKER_I18N_NAMESPACE]: enWorker },
    lt: { [WORKER_I18N_NAMESPACE]: ltWorker },
    pl: { [WORKER_I18N_NAMESPACE]: plWorker },
    ro: { [WORKER_I18N_NAMESPACE]: roWorker },
    ru: { [WORKER_I18N_NAMESPACE]: ruWorker },
  },
  lng: DEFAULT_WORKER_LANGUAGE,
  fallbackLng: DEFAULT_WORKER_LANGUAGE,
  supportedLngs: ['en', 'lt', 'pl', 'ro', 'ru'],
  nonExplicitSupportedLngs: false,
  load: 'currentOnly',
  defaultNS: WORKER_I18N_NAMESPACE,
  ns: [WORKER_I18N_NAMESPACE],
  interpolation: { escapeValue: false },
  returnNull: false,
  returnEmptyString: false,
  parseMissingKeyHandler: (key) => readEnglishValue(key) ?? readEnglishValue(key.replace(/^worker\./, '')) ?? '',
  react: { useSuspense: false },
})

export function applyWorkerI18nLanguage(language: string): void {
  const next = parseWorkerLanguage(language)
  if (workerI18n.language !== next) {
    void workerI18n.changeLanguage(next)
  }
}

export function resetWorkerI18nLanguage(): void {
  void workerI18n.changeLanguage(DEFAULT_WORKER_LANGUAGE)
}

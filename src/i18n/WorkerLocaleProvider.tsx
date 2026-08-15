import { useAuth } from '@/contexts/AuthContext'
import {
  DEFAULT_WORKER_LANGUAGE,
  parseWorkerLanguage,
  WORKER_LANGUAGE_LOCALES,
  type WorkerLanguage,
} from '@/i18n/languages'
import {
  applyWorkerI18nLanguage,
  resetWorkerI18nLanguage,
  workerI18n,
} from '@/i18n/workerI18n'
import {
  readWorkerLanguagePreference,
  writeWorkerLanguagePreference,
} from '@/i18n/workerLanguageCache'
import {
  DriversServiceError,
  fetchOwnPreferredLanguage,
  setWorkerPreferredLanguage,
} from '@/services/driversService'
import { WorkerLocaleContext } from '@/i18n/workerLocaleContext'
import { I18nextProvider } from 'react-i18next'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

function applyDocumentLanguage(language: WorkerLanguage): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = WORKER_LANGUAGE_LOCALES[language]
}

function clearDocumentLanguage(): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = 'en'
}

function WorkerLocaleController({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const dbSyncedForUserRef = useRef<string | null>(null)
  const userChangedRef = useRef(false)

  const [language, setLanguageState] = useState<WorkerLanguage>(() =>
    parseWorkerLanguage(readWorkerLanguagePreference(userId)),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyLanguage = useCallback(
    (next: WorkerLanguage) => {
      const resolved = parseWorkerLanguage(next)
      setLanguageState(resolved)
      applyWorkerI18nLanguage(resolved)
      applyDocumentLanguage(resolved)
      if (userId) {
        writeWorkerLanguagePreference(userId, resolved)
      }
    },
    [userId],
  )

  useLayoutEffect(() => {
    dbSyncedForUserRef.current = null
    userChangedRef.current = false
    const cached = readWorkerLanguagePreference(userId)
    applyLanguage(cached ?? DEFAULT_WORKER_LANGUAGE)
    return () => {
      resetWorkerI18nLanguage()
      clearDocumentLanguage()
    }
  }, [applyLanguage, userId])

  useEffect(() => {
    if (!userId) return
    if (dbSyncedForUserRef.current === userId) return

    let cancelled = false
    void fetchOwnPreferredLanguage()
      .then((stored) => {
        if (cancelled || stored == null || userChangedRef.current) return
        dbSyncedForUserRef.current = userId
        applyLanguage(stored)
      })
      .catch(() => {
        // Keep the valid cached language when the DB read fails.
      })

    return () => {
      cancelled = true
    }
  }, [applyLanguage, userId])

  const setLanguage = useCallback(
    async (next: WorkerLanguage) => {
      const resolved = parseWorkerLanguage(next)
      const previous = language
      userChangedRef.current = true
      applyLanguage(resolved)
      setIsSaving(true)
      setError(null)
      try {
        await setWorkerPreferredLanguage(resolved)
      } catch (saveError) {
        applyLanguage(previous)
        setError(
          saveError instanceof DriversServiceError
            ? saveError.message
            : saveError instanceof Error
              ? saveError.message
              : workerI18n.t('settings.languageSaveError'),
        )
      } finally {
        setIsSaving(false)
      }
    },
    [applyLanguage, language],
  )

  const value = useMemo(
    () => ({
      language,
      isSaving,
      error,
      setLanguage,
      t: (key: string, options?: Record<string, string | number>) =>
        workerI18n.t(key, options),
    }),
    [error, isSaving, language, setLanguage],
  )

  return (
    <WorkerLocaleContext.Provider value={value}>
      {children}
    </WorkerLocaleContext.Provider>
  )
}

/** Worker-only locale boundary. Admin/Office/login must never mount this. */
export function WorkerLocaleProvider({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={workerI18n}>
      <WorkerLocaleController>{children}</WorkerLocaleController>
    </I18nextProvider>
  )
}

export { useWorkerChromeText, useWorkerLocale } from '@/i18n/workerLocaleContext'

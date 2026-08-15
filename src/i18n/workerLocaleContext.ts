import {
  DEFAULT_WORKER_LANGUAGE,
  type WorkerLanguage,
} from '@/i18n/languages'
import { createContext, useContext } from 'react'

export type WorkerLocaleContextValue = {
  language: WorkerLanguage
  isSaving: boolean
  error: string | null
  setLanguage: (language: WorkerLanguage) => Promise<void>
  t: (key: string) => string
}

export const WorkerLocaleContext = createContext<WorkerLocaleContextValue | null>(
  null,
)

export function useWorkerLocale(): WorkerLocaleContextValue {
  const context = useContext(WorkerLocaleContext)
  if (!context) {
    return {
      language: DEFAULT_WORKER_LANGUAGE,
      isSaving: false,
      error: null,
      setLanguage: async () => undefined,
      t: () => '',
    }
  }
  return context
}

/** Safe outside the Worker tree: returns English fallback, never a raw key. */
export function useWorkerChromeText(key: string, fallback: string): string {
  const context = useContext(WorkerLocaleContext)
  if (!context) return fallback
  const value = context.t(key)
  if (!value || value === key) return fallback
  return value
}

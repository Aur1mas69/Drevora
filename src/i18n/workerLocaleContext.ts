import {
  DEFAULT_WORKER_LANGUAGE,
  type WorkerLanguage,
} from '@/i18n/languages'
import { createContext, useContext } from 'react'

export type WorkerChromeVars = Record<string, string | number>

export type WorkerLocaleContextValue = {
  language: WorkerLanguage
  isSaving: boolean
  error: string | null
  setLanguage: (language: WorkerLanguage) => Promise<void>
  t: (key: string, options?: WorkerChromeVars) => string
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

function interpolateFallback(fallback: string, options?: WorkerChromeVars): string {
  if (!options) return fallback
  return fallback.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name: string) =>
    options[name] !== undefined ? String(options[name]) : `{{${name}}}`,
  )
}

/** Safe outside the Worker tree: returns English fallback, never a raw key. */
export function useWorkerChromeText(
  key: string,
  fallback: string,
  options?: WorkerChromeVars,
): string {
  const context = useContext(WorkerLocaleContext)
  if (!context) return interpolateFallback(fallback, options)
  const value = context.t(key, options)
  if (!value || value === key) return interpolateFallback(fallback, options)
  return value
}

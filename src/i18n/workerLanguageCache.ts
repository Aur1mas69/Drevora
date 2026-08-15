import {
  DEFAULT_WORKER_LANGUAGE,
  isWorkerLanguage,
  parseWorkerLanguage,
  type WorkerLanguage,
} from '@/i18n/languages'

const STORAGE_PREFIX = 'drevora.worker.language:'

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

/** Personal Worker language preference saved for this browser/account. */
export function readWorkerLanguagePreference(
  userId: string | null | undefined,
): WorkerLanguage | null {
  if (!userId || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    return isWorkerLanguage(raw) ? raw : null
  } catch {
    return null
  }
}

export function writeWorkerLanguagePreference(
  userId: string,
  language: WorkerLanguage,
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(userId), parseWorkerLanguage(language))
  } catch {
    // Persistence is best-effort; in-session language still applies.
  }
}

export function resolveWorkerLanguagePreference(
  userId: string | null | undefined,
): WorkerLanguage {
  return readWorkerLanguagePreference(userId) ?? DEFAULT_WORKER_LANGUAGE
}

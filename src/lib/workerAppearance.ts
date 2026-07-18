import type { CompanyTheme } from '@/lib/companySettingsTypes'
import { applyDocumentTheme, subscribeToSystemTheme } from '@/lib/theme'

const STORAGE_PREFIX = 'drevora.worker.appearance:'

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

function isCompanyTheme(value: string | null): value is CompanyTheme {
  return value === 'light' || value === 'dark' || value === 'system'
}

/**
 * Personal Worker appearance preference for this browser/account.
 * Uses the same applyDocumentTheme / system subscription as Company Settings.
 * Not written to companies.theme (company-wide, office-managed).
 */
export function readWorkerAppearancePreference(
  userId: string | null | undefined,
): CompanyTheme | null {
  if (!userId || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    return isCompanyTheme(raw) ? raw : null
  } catch {
    return null
  }
}

export function writeWorkerAppearancePreference(
  userId: string,
  theme: CompanyTheme,
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(userId), theme)
  } catch {
    // Persistence is best-effort; still apply in-session below.
  }
  applyDocumentTheme(theme)
}

export function applyResolvedWorkerAppearance(
  userId: string | null | undefined,
  companyTheme: CompanyTheme,
): CompanyTheme {
  const preferred = readWorkerAppearancePreference(userId)
  const resolved = preferred ?? companyTheme
  applyDocumentTheme(resolved)
  return resolved
}

export function subscribeWorkerSystemAppearance(
  theme: CompanyTheme,
  onSystemChange: () => void,
): () => void {
  if (theme !== 'system') {
    return () => {}
  }
  return subscribeToSystemTheme(onSystemChange)
}

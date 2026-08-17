/**
 * Worker mobile appearance (Light / Dark).
 *
 * Intentionally independent from `src/lib/theme.ts` / `CompanySettingsContext`,
 * which manage the Office/Admin theme via a global `dark` class on
 * `document.documentElement`. Reusing that class here would mean a Worker's
 * personal preference could be silently overwritten by Office theme updates
 * (or vice versa) any time both run in the same document/session.
 *
 * Instead, Worker dark mode toggles a distinct `worker-dark` class on
 * `document.documentElement`. `src/styles/worker-theme.css` only reads that
 * class scoped under `.worker-mobile-layout` / `.worker-theme-surface`, so it
 * has zero effect on Admin (`.drevora-app-shell`) styling.
 */

export type WorkerAppearance = 'light' | 'dark'

const STORAGE_PREFIX = 'drevora.worker.appearance:'
const WORKER_DARK_CLASS = 'worker-dark'

export const DEFAULT_WORKER_APPEARANCE: WorkerAppearance = 'light'

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

function isWorkerAppearance(value: string | null): value is WorkerAppearance {
  return value === 'light' || value === 'dark'
}

/** Personal Worker appearance preference saved for this browser/account. */
export function readWorkerAppearancePreference(
  userId: string | null | undefined,
): WorkerAppearance | null {
  if (!userId || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    return isWorkerAppearance(raw) ? raw : null
  } catch {
    return null
  }
}

/** Applies Worker Light/Dark appearance by toggling the scoped `worker-dark` class. */
export function applyWorkerAppearance(theme: WorkerAppearance): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle(WORKER_DARK_CLASS, theme === 'dark')
  // Worker Light is independent of Office/Admin theme. Strip `dark` so
  // company Dark / iPhone system Dark cannot recolour Worker Light screens.
  if (theme === 'light') {
    root.classList.remove('dark')
  }
}

/** Removes the Worker theme class from the document (call on Worker shell unmount). */
export function clearWorkerAppearance(): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.remove(WORKER_DARK_CLASS)
}

export function writeWorkerAppearancePreference(
  userId: string,
  theme: WorkerAppearance,
): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(storageKey(userId), theme)
    } catch {
      // Persistence is best-effort; still apply in-session below.
    }
  }
  applyWorkerAppearance(theme)
}

/**
 * Resolve and apply the Worker appearance for this browser/account.
 * Personal preference wins; otherwise defaults to Light.
 */
export function applyResolvedWorkerAppearance(
  userId: string | null | undefined,
): WorkerAppearance {
  const resolved = readWorkerAppearancePreference(userId) ?? DEFAULT_WORKER_APPEARANCE
  applyWorkerAppearance(resolved)
  return resolved
}

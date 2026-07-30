/**
 * Decouples AuthContext sign-out from AppLockContext to avoid circular imports.
 * Native AppLockProvider registers cleanup; web never registers (no-op).
 */

type AppLockSignOutCleanup = () => Promise<void>

let cleanup: AppLockSignOutCleanup | null = null

export function setAppLockSignOutCleanup(fn: AppLockSignOutCleanup | null): void {
  cleanup = fn
}

/** Best-effort app-lock cleanup; never throws to the caller. */
export async function runAppLockSignOutCleanup(): Promise<void> {
  if (!cleanup) return
  try {
    await cleanup()
  } catch {
    // Preference cleanup must never block Supabase sign-out.
  }
}

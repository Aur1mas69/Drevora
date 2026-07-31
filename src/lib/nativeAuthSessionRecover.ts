import { getOnlineStatus } from '@/lib/networkStatus'
import {
  deriveProjectAuthStorageKey,
  parseStoredSessionPayload,
  recoverFromStoredSession,
  toRecoveredSession,
  type RecoveredAuthSession,
  type StoredAuthSession,
} from '@/lib/authSessionRecoverShared'

/**
 * Web/PWA: when token refresh fails due to network, keep the browser
 * localStorage Supabase session so cold start offline does not bounce to Login.
 */

function readStoredSession(): StoredAuthSession | null {
  const storageKey = deriveProjectAuthStorageKey()
  if (!storageKey || typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(storageKey)
    if (raw == null) return null
    return parseStoredSessionPayload(raw)
  } catch {
    return null
  }
}

/**
 * Recover a locally stored browser session after getSession() fails to refresh
 * offline. Does not invent sessions and does not accept non-retryable auth
 * rejection when online (true expiry / revoked refresh).
 */
export async function recoverNativeSessionAfterRefreshFailure(
  refreshError: unknown,
): Promise<RecoveredAuthSession | null> {
  const online = await getOnlineStatus()
  const stored = readStoredSession()
  return recoverFromStoredSession({ refreshError, online, stored })
}

/** Best-effort local session read for web identity (no network). */
export async function readNativeStoredAuthSession(): Promise<RecoveredAuthSession | null> {
  const stored = readStoredSession()
  if (!stored) return null
  return toRecoveredSession(stored)
}

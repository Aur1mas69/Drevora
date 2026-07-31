import { registerPlugin } from '@capacitor/core'
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
 * Native Android: when token refresh fails due to network, keep the SecureAuthStorage
 * session so cold start offline does not bounce to Login.
 */

type SecureAuthStoragePlugin = {
  getItem: (options: { key: string }) => Promise<{ value: string | null }>
}

const SecureAuthStorage = registerPlugin<SecureAuthStoragePlugin>('SecureAuthStorage')

async function readStoredSession(): Promise<StoredAuthSession | null> {
  const storageKey = deriveProjectAuthStorageKey()
  if (!storageKey) return null

  try {
    const result = await SecureAuthStorage.getItem({ key: storageKey })
    if (result.value == null) return null
    return parseStoredSessionPayload(result.value)
  } catch {
    return null
  }
}

/**
 * Recover a locally stored session after getSession() fails to refresh offline.
 * Does not invent sessions, does not clear SecureAuthStorage, and does not
 * accept non-retryable auth rejection when online (true expiry / revoked refresh).
 */
export async function recoverNativeSessionAfterRefreshFailure(
  refreshError: unknown,
): Promise<RecoveredAuthSession | null> {
  const online = await getOnlineStatus()
  const stored = await readStoredSession()
  return recoverFromStoredSession({ refreshError, online, stored })
}

/**
 * Best-effort local session read for native identity (no network).
 * Used when getSession() returned empty but SecureAuthStorage still has a session.
 */
export async function readNativeStoredAuthSession(): Promise<RecoveredAuthSession | null> {
  const stored = await readStoredSession()
  if (!stored) return null
  return toRecoveredSession(stored)
}

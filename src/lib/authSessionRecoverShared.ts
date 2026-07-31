/**
 * Shared offline auth-session recovery helpers for Web/PWA and Native.
 * Storage backends differ (localStorage vs SecureAuthStorage); parsing and
 * network-vs-auth rejection rules stay identical.
 */

export type StoredAuthSession = {
  access_token?: string
  refresh_token?: string
  expires_at?: number
  user?: {
    id?: string
    email?: string | null
  }
}

export type RecoveredAuthSession = {
  accessToken: string
  user: { id: string; email: string }
}

export function deriveProjectAuthStorageKey(): string | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
  if (!supabaseUrl) return null

  try {
    const hostname = new URL(supabaseUrl).hostname
    const projectRef = hostname.split('.')[0]
    if (!projectRef) return null
    return `sb-${projectRef}-auth-token`
  } catch {
    return null
  }
}

/**
 * True when Supabase rejected the refresh token / session for a non-network reason.
 * Network / transport failures must NOT match (those keep the local session).
 *
 * Do not import isAuthRetryableFetchError from @supabase/supabase-js — Rolldown
 * can collide that symbol in large chunks.
 */
export function isNonRetryableAuthRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const err = error as {
    name?: string
    status?: number
    message?: string
  }

  if (err.name === 'AuthRetryableFetchError') return false
  if (err.status === 0) return false

  const message = (err.message ?? '').toLowerCase()
  if (
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('networkerror') ||
    message.includes('load failed')
  ) {
    return false
  }

  if (err.name === 'AuthApiError') return true
  if (typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
    return true
  }

  return false
}

export function isStructurallyValidSession(
  value: unknown,
): value is StoredAuthSession {
  if (!value || typeof value !== 'object') return false
  const session = value as StoredAuthSession
  return (
    typeof session.access_token === 'string' &&
    session.access_token.length > 0 &&
    typeof session.refresh_token === 'string' &&
    session.refresh_token.length > 0 &&
    typeof session.expires_at === 'number' &&
    typeof session.user?.id === 'string' &&
    typeof session.user?.email === 'string' &&
    session.user.email.length > 0
  )
}

export function parseStoredSessionPayload(
  raw: unknown,
): StoredAuthSession | null {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
  }

  if (!parsed || typeof parsed !== 'object') return null

  const candidate =
    'currentSession' in parsed
      ? (parsed as { currentSession?: unknown }).currentSession
      : 'access_token' in parsed
        ? parsed
        : null

  if (!isStructurallyValidSession(candidate)) return null
  return candidate
}

export function toRecoveredSession(
  stored: StoredAuthSession,
): RecoveredAuthSession | null {
  if (!stored.user?.id || !stored.user.email || !stored.access_token) {
    return null
  }

  return {
    accessToken: stored.access_token,
    user: {
      id: stored.user.id,
      email: stored.user.email,
    },
  }
}

/**
 * Shared recovery policy after getSession() returns empty.
 * Caller supplies the already-read stored session (storage backend-specific).
 */
export async function recoverFromStoredSession(options: {
  refreshError: unknown
  online: boolean
  stored: StoredAuthSession | null
}): Promise<RecoveredAuthSession | null> {
  const { refreshError, online, stored } = options

  // True auth rejection while reachable — do not keep a revoked session.
  if (online && isNonRetryableAuthRejection(refreshError)) {
    return null
  }

  // Otherwise prefer a still-valid local session. Native Network often reports
  // "connected" while refresh fails or getSession returns empty without an
  // AuthApiError — bouncing to Login would drop offline Worker bootstrap.
  if (!stored) return null
  return toRecoveredSession(stored)
}

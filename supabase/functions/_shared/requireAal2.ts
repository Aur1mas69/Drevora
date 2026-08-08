/**
 * Require the caller's end-user session JWT to be AAL2.
 *
 * Use only at Edge Function boundaries after `auth.getUser()` with the same
 * Bearer token. Never trust an `aal` value from the request body.
 *
 * Service-role clients must NOT call this expecting the end-user AAL — privileged
 * RPCs invoked with service_role run without the caller's JWT claims.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.108.2'

export const MFA_REQUIRED_CODE = 'MFA_REQUIRED' as const

export type RequireAal2Result =
  | { ok: true }
  | {
      ok: false
      httpStatus: 403
      code: typeof MFA_REQUIRED_CODE
      message: string
    }

const MFA_REQUIRED_MESSAGE =
  'Two-factor authentication is required before you can perform this action.'

function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const parts = accessToken.split('.')
    if (parts.length < 2) return null
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const json = atob(padded)
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

/** Read `aal` from a validated access token payload (never from request body). */
export function readAalClaimFromAccessToken(accessToken: string): string | null {
  const payload = decodeJwtPayload(accessToken)
  const aal = payload?.aal
  return typeof aal === 'string' && aal.trim() ? aal.trim() : null
}

/**
 * Fail closed unless the caller's session is AAL2.
 * Prefers Supabase MFA assurance API; also rejects when the JWT `aal` claim is present and not aal2.
 */
export async function requireCallerAal2(
  userClient: SupabaseClient,
  accessToken: string,
): Promise<RequireAal2Result> {
  const claimAal = readAalClaimFromAccessToken(accessToken)

  const { data, error } = await userClient.auth.mfa.getAuthenticatorAssuranceLevel()
  const currentLevel =
    typeof data?.currentLevel === 'string' ? data.currentLevel : null

  if (error) {
    return {
      ok: false,
      httpStatus: 403,
      code: MFA_REQUIRED_CODE,
      message: MFA_REQUIRED_MESSAGE,
    }
  }

  // Prefer the MFA assurance API; fall back to JWT claim only if API omitted level.
  const effectiveAal = currentLevel ?? claimAal
  if (effectiveAal !== 'aal2') {
    return {
      ok: false,
      httpStatus: 403,
      code: MFA_REQUIRED_CODE,
      message: MFA_REQUIRED_MESSAGE,
    }
  }

  // Fail closed if the JWT claim is present and contradicts AAL2.
  if (claimAal != null && claimAal !== 'aal2') {
    return {
      ok: false,
      httpStatus: 403,
      code: MFA_REQUIRED_CODE,
      message: MFA_REQUIRED_MESSAGE,
    }
  }

  return { ok: true }
}

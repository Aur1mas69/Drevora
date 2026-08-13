/**
 * Require the caller's end-user session to satisfy Office MFA policy.
 *
 * Pause/Resume (after STEP 1 RPC exists):
 * - mfa_enabled false → AAL1 is valid, even if a verified TOTP factor remains.
 * - mfa_enabled true + verified factor → current session must be AAL2.
 * - mfa_enabled true + no verified factor → fail closed (MFA_REQUIRED).
 *
 * Before STEP 1 is applied live, `drevora_auth_office_mfa_is_enabled()` is
 * missing. That specific missing-function case falls back to today's
 * verified-factor-presence behaviour so production is not bricked. Unexpected
 * RPC, permission, or malformed responses fail closed and do not fall back.
 *
 * Use only at Edge Function boundaries after `auth.getUser()` with the same
 * Bearer token. Never trust an `aal` or client MFA flag from the request body.
 *
 * Service-role clients must NOT call this expecting the end-user AAL — privileged
 * RPCs invoked with service_role run without the caller's JWT claims.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.108.2'
import {
  MFA_REQUIRED_CODE,
  MFA_REQUIRED_MESSAGE,
  resolveOfficeMfaEdgeAuthorization,
  resolveOfficeMfaEnabledLookup,
  type RequireAal2Result,
} from './officeMfaEdgePolicy.ts'

export { MFA_REQUIRED_CODE }
export type { RequireAal2Result }

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

function factorIsVerified(factor: { status?: string } | null | undefined): boolean {
  return factor?.status === 'verified'
}

function denyMfaRequired(): RequireAal2Result {
  return {
    ok: false,
    httpStatus: 403,
    code: MFA_REQUIRED_CODE,
    message: MFA_REQUIRED_MESSAGE,
  }
}

/**
 * Fail closed unless the caller's server-side Office MFA policy is satisfied.
 * Reads mfa_enabled via the user-JWT RPC `drevora_auth_office_mfa_is_enabled`.
 * Prefers Supabase MFA factor listing + assurance API; never trusts request body.
 */
export async function requireCallerAal2(
  userClient: SupabaseClient,
  accessToken: string,
): Promise<RequireAal2Result> {
  const claimAal = readAalClaimFromAccessToken(accessToken)

  const [
    { data: aalData, error: aalError },
    { data: factorData, error: factorError },
    { data: enabledData, error: enabledError },
  ] = await Promise.all([
    userClient.auth.mfa.getAuthenticatorAssuranceLevel(),
    userClient.auth.mfa.listFactors(),
    userClient.rpc('drevora_auth_office_mfa_is_enabled'),
  ])

  if (aalError || factorError) {
    return denyMfaRequired()
  }

  const listed = [
    ...(factorData?.totp ?? []),
    ...(factorData?.all ?? []),
  ]
  const hasVerifiedFactor = listed.some((factor) => factorIsVerified(factor))

  const lookup = resolveOfficeMfaEnabledLookup({
    error: enabledError,
    data: enabledData,
  })

  const currentLevel =
    typeof aalData?.currentLevel === 'string' ? aalData.currentLevel : null

  // Prefer the MFA assurance API; fall back to JWT claim only if API omitted level.
  const effectiveAal = currentLevel ?? claimAal

  return resolveOfficeMfaEdgeAuthorization({
    lookup,
    hasVerifiedFactor,
    effectiveAal,
    jwtAal: claimAal,
  })
}

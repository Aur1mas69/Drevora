/**
 * Pure Office MFA authorization policy for Edge Functions.
 * No Deno / Supabase imports so Node verifiers can execute this matrix.
 *
 * Source of truth after STEP 1: drevora_auth_office_mfa_is_enabled().
 * Never trust request-body flags, user_metadata, localStorage, IP, or client user ids.
 */

export const MFA_REQUIRED_CODE = 'MFA_REQUIRED' as const

export type RequireAal2Result =
  | { ok: true }
  | {
      ok: false
      httpStatus: 403
      code: typeof MFA_REQUIRED_CODE
      message: string
    }

export const MFA_REQUIRED_MESSAGE =
  'Two-factor authentication is required before you can perform this action.'

export type OfficeMfaEnabledLookup =
  | { status: 'ok'; mfaEnabled: boolean }
  | { status: 'rpc_missing' }
  | { status: 'rpc_error' }

const MISSING_RPC_CODES = new Set(['PGRST202', '42883'])

const PERMISSION_OR_AUTH_MARKERS = [
  'permission denied',
  'insufficient_privilege',
  'not authorized',
  'unauthorized',
  '42501',
  'jwt',
  'row-level security',
]

function denyMfaRequired(): RequireAal2Result {
  return {
    ok: false,
    httpStatus: 403,
    code: MFA_REQUIRED_CODE,
    message: MFA_REQUIRED_MESSAGE,
  }
}

/**
 * True only for the compatibility case where the Pause/Resume RPC is not in
 * the live database yet (function missing from schema cache / undefined_function).
 *
 * Permission errors, RLS, JWT, timeouts, and other database failures must NOT
 * match — those fail closed.
 */
export function isOfficeMfaEnabledRpcMissing(
  error: { message?: string; code?: string; hint?: string; details?: string } | null | undefined,
): boolean {
  if (!error) return false

  const code = (error.code ?? '').trim().toUpperCase()
  const combined = [
    error.message,
    error.hint,
    error.details,
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .toLowerCase()

  if (code === '42501') return false
  if (PERMISSION_OR_AUTH_MARKERS.some((marker) => combined.includes(marker))) {
    return false
  }

  if (MISSING_RPC_CODES.has(code)) return true

  const mentionsFn = combined.includes('drevora_auth_office_mfa_is_enabled')
  const looksMissing =
    combined.includes('could not find the function') ||
    (combined.includes('function') && combined.includes('does not exist')) ||
    combined.includes('schema cache')

  return mentionsFn && looksMissing
}

export function parseOfficeMfaEnabledRpcData(data: unknown): boolean | null {
  if (data === true || data === false) return data
  return null
}

export function resolveOfficeMfaEnabledLookup(input: {
  error: { message?: string; code?: string; hint?: string; details?: string } | null
  data: unknown
}): OfficeMfaEnabledLookup {
  if (input.error) {
    if (isOfficeMfaEnabledRpcMissing(input.error)) {
      return { status: 'rpc_missing' }
    }
    return { status: 'rpc_error' }
  }

  const parsed = parseOfficeMfaEnabledRpcData(input.data)
  if (parsed === null) {
    return { status: 'rpc_error' }
  }

  return { status: 'ok', mfaEnabled: parsed }
}

export function sessionSatisfiesAal2(input: {
  effectiveAal: string | null
  jwtAal: string | null
}): boolean {
  if (input.effectiveAal !== 'aal2') return false
  if (input.jwtAal != null && input.jwtAal !== 'aal2') return false
  return true
}

/**
 * Edge MFA matrix.
 *
 * After STEP 1 exists:
 *   mfa_enabled false → AAL1 allowed (even with a verified factor)
 *   mfa_enabled true + verified + AAL2 → allow
 *   mfa_enabled true + verified + AAL1 → MFA_REQUIRED
 *   mfa_enabled true + no verified factor → MFA_REQUIRED (fail closed)
 *
 * Before STEP 1 (rpc_missing only):
 *   verified factor → require AAL2 (today's production behaviour)
 *   no verified factor → AAL1 allowed
 *
 * Unexpected RPC / malformed payload → MFA_REQUIRED (no compatibility fallback)
 */
export function resolveOfficeMfaEdgeAuthorization(input: {
  lookup: OfficeMfaEnabledLookup
  hasVerifiedFactor: boolean
  effectiveAal: string | null
  jwtAal: string | null
}): RequireAal2Result {
  if (input.lookup.status === 'rpc_error') {
    return denyMfaRequired()
  }

  let mfaEnabled: boolean
  if (input.lookup.status === 'rpc_missing') {
    // Pre-migration compatibility: factor presence is the enforcement flag.
    mfaEnabled = input.hasVerifiedFactor
    if (!mfaEnabled) {
      return { ok: true }
    }
  } else if (!input.lookup.mfaEnabled) {
    return { ok: true }
  } else {
    mfaEnabled = true
  }

  if (mfaEnabled && !input.hasVerifiedFactor) {
    return denyMfaRequired()
  }

  if (!sessionSatisfiesAal2(input)) {
    return denyMfaRequired()
  }

  return { ok: true }
}

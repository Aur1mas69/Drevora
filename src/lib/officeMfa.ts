/**
 * Pure Office MFA gate helpers (TOTP / AAL2 + server mfa_enabled).
 * Role must come from verified company_members — never from the browser portal.
 * Drivers are never required to complete MFA by these helpers.
 *
 * Pause/Resume: mfa_enabled is the enforcement flag. A verified TOTP factor may
 * remain enrolled while MFA is Off. Supabase AAL remains authoritative for
 * challenges. No localStorage flag and no IP trust.
 */

export type AuthenticatorAssuranceLevel = 'aal1' | 'aal2'

export type OfficeMfaTotpFactor = {
  id: string
  friendlyName: string | null
  status: 'verified' | 'unverified'
  factorType: 'totp'
}

export type OfficeMfaGateAction = 'allow' | 'challenge' | 'enroll' | 'loading'

export type OfficeMfaGateDecision = {
  action: OfficeMfaGateAction
  /** True when server-side MFA enforcement is on. */
  mfaRequired: boolean
  mfaEnabled: boolean
  hasVerifiedTotp: boolean
  aal: AuthenticatorAssuranceLevel | null
}

export function isAuthenticatorAssuranceLevel(
  value: string | null | undefined,
): value is AuthenticatorAssuranceLevel {
  return value === 'aal1' || value === 'aal2'
}

export function hasVerifiedTotpFactor(
  factors: ReadonlyArray<Pick<OfficeMfaTotpFactor, 'status' | 'factorType'>>,
): boolean {
  return factors.some(
    (factor) => factor.factorType === 'totp' && factor.status === 'verified',
  )
}

export function listVerifiedTotpFactors(
  factors: ReadonlyArray<OfficeMfaTotpFactor>,
): OfficeMfaTotpFactor[] {
  return factors.filter(
    (factor) => factor.factorType === 'totp' && factor.status === 'verified',
  )
}

export function listUnverifiedTotpFactors(
  factors: ReadonlyArray<OfficeMfaTotpFactor>,
): OfficeMfaTotpFactor[] {
  return factors.filter(
    (factor) => factor.factorType === 'totp' && factor.status === 'unverified',
  )
}

/**
 * Decide whether an authenticated member may enter the Office shell.
 *
 * - Non-Office (Driver / other): allow
 * - mfa_enabled false: allow (Pause; authenticator may still be enrolled)
 * - mfa_enabled true + verified TOTP + AAL2: allow
 * - mfa_enabled true + verified TOTP + AAL1: challenge existing factor
 * - mfa_enabled true + no verified TOTP: enroll/repair (fail closed)
 * - Flag / factors / AAL still loading: loading
 */
export function resolveOfficeMfaGate(input: {
  isOfficeRole: boolean
  aal: AuthenticatorAssuranceLevel | null
  /** null while factors are still loading from Supabase. */
  factors: ReadonlyArray<OfficeMfaTotpFactor> | null
  /** null while the server enforcement flag is still loading. */
  mfaEnabled: boolean | null
}): OfficeMfaGateDecision {
  if (!input.isOfficeRole) {
    return {
      action: 'allow',
      mfaRequired: false,
      mfaEnabled: false,
      hasVerifiedTotp: false,
      aal: input.aal,
    }
  }

  if (
    input.factors === null ||
    input.aal === null ||
    input.mfaEnabled === null
  ) {
    return {
      action: 'loading',
      mfaRequired: false,
      mfaEnabled: false,
      hasVerifiedTotp: false,
      aal: input.aal,
    }
  }

  const hasVerifiedTotp = hasVerifiedTotpFactor(input.factors)
  const mfaEnabled = input.mfaEnabled

  if (!mfaEnabled) {
    return {
      action: 'allow',
      mfaRequired: false,
      mfaEnabled: false,
      hasVerifiedTotp,
      aal: input.aal,
    }
  }

  if (!hasVerifiedTotp) {
    return {
      action: 'enroll',
      mfaRequired: true,
      mfaEnabled: true,
      hasVerifiedTotp: false,
      aal: input.aal,
    }
  }

  if (input.aal === 'aal2') {
    return {
      action: 'allow',
      mfaRequired: true,
      mfaEnabled: true,
      hasVerifiedTotp: true,
      aal: input.aal,
    }
  }

  return {
    action: 'challenge',
    mfaRequired: true,
    mfaEnabled: true,
    hasVerifiedTotp: true,
    aal: input.aal,
  }
}

export function formatOfficeMfaStatusLabel(mfaEnabled: boolean): string {
  return mfaEnabled ? 'On' : 'Off'
}

/**
 * True when Supabase reports the MFA factor id is already gone.
 * Used so stale-unverified cleanup is idempotent under races / StrictMode.
 */
export function isMfaFactorNotFoundError(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!error) return false
  const code = (error.code ?? '').trim().toLowerCase()
  const message = (error.message ?? '').trim().toLowerCase()
  return (
    code === 'mfa_factor_not_found' ||
    message.includes('factor not found') ||
    message.includes('factor does not exist')
  )
}

export function isOfficeMfaSettingsRpcUnavailable(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!error) return false
  const code = (error.code ?? '').trim().toUpperCase()
  const message = (error.message ?? '').trim().toLowerCase()
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    message.includes('drevora_auth_office_mfa_is_enabled') ||
    message.includes('drevora_auth_set_own_office_mfa_enabled') ||
    (message.includes('could not find the function') &&
      message.includes('office_mfa'))
  )
}

/** Browser event so Settings MFA changes can refresh RequireOfficeMfa. */
export const OFFICE_MFA_FACTORS_CHANGED_EVENT = 'drevora:office-mfa-factors-changed'

export function notifyOfficeMfaFactorsChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OFFICE_MFA_FACTORS_CHANGED_EVENT))
}

/**
 * Self-service removal is allowed only for AAL2 sessions and only for a
 * factor id that appears in the caller's current verified TOTP list.
 */
export function canRemoveOwnVerifiedTotpFactor(input: {
  aal: AuthenticatorAssuranceLevel | null
  factorId: string
  verifiedFactors: ReadonlyArray<Pick<OfficeMfaTotpFactor, 'id' | 'status' | 'factorType'>>
}): boolean {
  if (input.aal !== 'aal2') return false
  const factorId = input.factorId.trim()
  if (!factorId) return false
  return input.verifiedFactors.some(
    (factor) =>
      factor.id === factorId &&
      factor.factorType === 'totp' &&
      factor.status === 'verified',
  )
}

export function mustPauseBeforeRemovingLastFactor(
  verifiedCount: number,
): boolean {
  return verifiedCount === 1
}

export function resolveMfaStatusAfterVerifiedFactorRemoval(input: {
  remainingVerifiedCount: number
  mfaEnabled: boolean
}): {
  statusLabel: ReturnType<typeof formatOfficeMfaStatusLabel>
  requiresEnrollment: boolean
  mfaEnabled: boolean
} {
  const remaining = Math.max(0, input.remainingVerifiedCount)
  const mfaEnabled = remaining === 0 ? false : input.mfaEnabled
  return {
    statusLabel: formatOfficeMfaStatusLabel(mfaEnabled),
    requiresEnrollment: false,
    mfaEnabled,
  }
}

/**
 * Pure Office MFA gate helpers (TOTP / AAL2).
 * Role must come from verified company_members — never from the browser portal.
 * Drivers are never required to complete MFA by these helpers.
 */

export type AuthenticatorAssuranceLevel = 'aal1' | 'aal2'

export type OfficeMfaTotpFactor = {
  id: string
  friendlyName: string | null
  status: 'verified' | 'unverified'
  factorType: 'totp'
}

export type OfficeMfaGateAction = 'allow' | 'enroll' | 'challenge' | 'loading'

export type OfficeMfaGateDecision = {
  action: OfficeMfaGateAction
  /** True when the actor is an Office role that must reach AAL2. */
  mfaRequired: boolean
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
 * - Non-Office (Driver / other): allow (MFA not required here)
 * - Office + AAL2: allow
 * - Office + no verified TOTP: enroll
 * - Office + verified TOTP + AAL1: challenge
 * - Factors/AAL still loading: loading
 */
export function resolveOfficeMfaGate(input: {
  isOfficeRole: boolean
  aal: AuthenticatorAssuranceLevel | null
  /** null while factors are still loading from Supabase. */
  factors: ReadonlyArray<OfficeMfaTotpFactor> | null
}): OfficeMfaGateDecision {
  if (!input.isOfficeRole) {
    return {
      action: 'allow',
      mfaRequired: false,
      hasVerifiedTotp: false,
      aal: input.aal,
    }
  }

  if (input.factors === null || input.aal === null) {
    return {
      action: 'loading',
      mfaRequired: true,
      hasVerifiedTotp: false,
      aal: input.aal,
    }
  }

  const hasVerifiedTotp = hasVerifiedTotpFactor(input.factors)

  // Office with no verified TOTP must enroll — including after self-service
  // removal of the last authenticator while the JWT may still report aal2.
  if (!hasVerifiedTotp) {
    return {
      action: 'enroll',
      mfaRequired: true,
      hasVerifiedTotp: false,
      aal: input.aal,
    }
  }

  if (input.aal === 'aal2') {
    return {
      action: 'allow',
      mfaRequired: true,
      hasVerifiedTotp: true,
      aal: input.aal,
    }
  }

  return {
    action: 'challenge',
    mfaRequired: true,
    hasVerifiedTotp: true,
    aal: input.aal,
  }
}

export function formatOfficeMfaStatusLabel(hasVerifiedTotp: boolean): string {
  return hasVerifiedTotp ? 'Enabled' : 'Not configured'
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

export function resolveMfaStatusAfterVerifiedFactorRemoval(
  remainingVerifiedCount: number,
): {
  statusLabel: ReturnType<typeof formatOfficeMfaStatusLabel>
  requiresEnrollment: boolean
} {
  const remaining = Math.max(0, remainingVerifiedCount)
  return {
    statusLabel: formatOfficeMfaStatusLabel(remaining > 0),
    requiresEnrollment: remaining === 0,
  }
}

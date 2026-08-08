import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase'
import {
  canRemoveOwnVerifiedTotpFactor,
  isAuthenticatorAssuranceLevel,
  isMfaFactorNotFoundError,
  listVerifiedTotpFactors,
  type AuthenticatorAssuranceLevel,
  type OfficeMfaTotpFactor,
} from '@/lib/officeMfa'
import { AuthServiceError } from '@/services/authService'

export { isMfaFactorNotFoundError }

export class MfaServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MfaServiceError'
  }
}

export type TotpEnrollment = {
  factorId: string
  qrCode: string
  secret: string
  uri: string
}

type AuthLikeError = {
  message?: string
  code?: string
  status?: number
} | null

function mapFactorError(error: AuthLikeError, fallback: string): never {
  throw new MfaServiceError(error?.message?.trim() || fallback)
}

function toTotpFactor(raw: {
  id: string
  friendly_name?: string | null
  status?: string
  factor_type?: string
}): OfficeMfaTotpFactor | null {
  if (raw.factor_type !== 'totp') return null
  if (raw.status !== 'verified' && raw.status !== 'unverified') return null
  return {
    id: raw.id,
    friendlyName: raw.friendly_name?.trim() || null,
    status: raw.status,
    factorType: 'totp',
  }
}

/**
 * In-flight / completed enrollment attempt for the current setup session.
 * Shared across React StrictMode remounts so enroll() runs once and the UI
 * never holds a factor id that a parallel cleanup already removed.
 */
let activeEnrollmentAttempt: {
  friendlyName: string
  promise: Promise<TotpEnrollment>
} | null = null

/** Drop the shared enrollment attempt (after verify success or explicit retry). */
export function discardActiveTotpEnrollmentAttempt(): void {
  activeEnrollmentAttempt = null
}

export async function getAuthenticatorAssuranceLevel(): Promise<AuthenticatorAssuranceLevel> {
  if (!isSupabaseConfigured) {
    throw new MfaServiceError(
      'MFA is unavailable because Supabase environment variables are not configured.',
    )
  }

  const { data, error } =
    await requireSupabase().auth.mfa.getAuthenticatorAssuranceLevel()

  if (error) {
    mapFactorError(error, 'Unable to determine multi-factor assurance level.')
  }

  const current = data?.currentLevel
  if (isAuthenticatorAssuranceLevel(current)) {
    return current
  }

  // Supabase may return null before any MFA factor exists — treat as AAL1.
  return 'aal1'
}

export async function listTotpFactors(): Promise<OfficeMfaTotpFactor[]> {
  if (!isSupabaseConfigured) {
    throw new MfaServiceError(
      'MFA is unavailable because Supabase environment variables are not configured.',
    )
  }

  const { data, error } = await requireSupabase().auth.mfa.listFactors()

  if (error) {
    mapFactorError(error, 'Unable to load authenticator factors.')
  }

  const all = data?.all ?? []
  return all
    .map((factor) => toTotpFactor(factor))
    .filter((factor): factor is OfficeMfaTotpFactor => factor !== null)
}

/**
 * Remove incomplete (unverified) TOTP enrollments so a fresh enroll can start.
 * Never removes verified factors.
 * Treats mfa_factor_not_found as already gone (not fatal).
 */
export async function clearUnverifiedTotpFactors(): Promise<void> {
  const factors = await listTotpFactors()
  const unverified = factors.filter((factor) => factor.status === 'unverified')

  for (const factor of unverified) {
    const { error } = await requireSupabase().auth.mfa.unenroll({
      factorId: factor.id,
    })
    if (!error) continue
    if (isMfaFactorNotFoundError(error)) {
      // Parallel StrictMode cleanup (or a prior attempt) already removed it.
      continue
    }
    mapFactorError(error, 'Unable to clear an incomplete authenticator setup.')
  }
}

async function enrollTotpFactorOnce(
  friendlyName: string,
): Promise<TotpEnrollment> {
  await clearUnverifiedTotpFactors()

  const { data, error } = await requireSupabase().auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  })

  if (error) {
    mapFactorError(error, 'Unable to start authenticator enrollment.')
  }

  const totp = data?.totp
  const factorId = data?.id?.trim() || ''
  const qrCode = totp?.qr_code?.trim() || ''
  const secret = totp?.secret?.trim() || ''
  const uri = totp?.uri?.trim() || ''

  if (!factorId || !qrCode || !secret) {
    throw new MfaServiceError('Authenticator enrollment did not return a usable TOTP factor.')
  }

  return { factorId, qrCode, secret, uri }
}

/**
 * Start (or reuse) one TOTP enrollment attempt.
 * StrictMode double-mounts share the same enroll response so the QR/secret
 * and later challengeAndVerify always use the same factor id.
 */
export async function enrollTotpFactor(
  friendlyName = 'Authenticator app',
): Promise<TotpEnrollment> {
  if (!isSupabaseConfigured) {
    throw new MfaServiceError(
      'MFA is unavailable because Supabase environment variables are not configured.',
    )
  }

  const name = friendlyName.trim() || 'Authenticator app'

  if (activeEnrollmentAttempt && activeEnrollmentAttempt.friendlyName === name) {
    return activeEnrollmentAttempt.promise
  }

  let promise!: Promise<TotpEnrollment>
  promise = enrollTotpFactorOnce(name).catch((error: unknown) => {
    if (activeEnrollmentAttempt?.promise === promise) {
      activeEnrollmentAttempt = null
    }
    throw error
  })

  activeEnrollmentAttempt = { friendlyName: name, promise }
  return promise
}

export async function challengeAndVerifyTotp(input: {
  factorId: string
  code: string
}): Promise<AuthenticatorAssuranceLevel> {
  if (!isSupabaseConfigured) {
    throw new MfaServiceError(
      'MFA is unavailable because Supabase environment variables are not configured.',
    )
  }

  const factorId = input.factorId.trim()
  const code = input.code.replace(/\s+/g, '')

  if (!factorId) {
    throw new MfaServiceError('Authenticator factor is missing.')
  }

  if (!/^\d{6}$/.test(code)) {
    throw new MfaServiceError('Enter the 6-digit code from your authenticator app.')
  }

  const { error } = await requireSupabase().auth.mfa.challengeAndVerify({
    factorId,
    code,
  })

  if (error) {
    mapFactorError(error, 'Invalid authenticator code. Try again.')
  }

  const aal = await getAuthenticatorAssuranceLevel()
  if (aal !== 'aal2') {
    throw new MfaServiceError(
      'Verification succeeded but the session is still not fully authenticated. Sign out and try again.',
    )
  }

  return aal
}

export async function verifyTotpEnrollment(input: {
  factorId: string
  code: string
}): Promise<AuthenticatorAssuranceLevel> {
  return challengeAndVerifyTotp(input)
}

/**
 * Self-service unenroll of one of the signed-in user's own verified TOTP factors.
 * Requires AAL2 and only accepts ids from the current verified factor list.
 */
export async function unenrollOwnVerifiedTotpFactor(factorId: string): Promise<{
  remainingVerified: OfficeMfaTotpFactor[]
  aal: AuthenticatorAssuranceLevel
}> {
  if (!isSupabaseConfigured) {
    throw new MfaServiceError(
      'MFA is unavailable because Supabase environment variables are not configured.',
    )
  }

  const aal = await getAuthenticatorAssuranceLevel()
  if (aal !== 'aal2') {
    throw new MfaServiceError(
      'Confirm two-factor authentication again before removing an authenticator.',
    )
  }

  const factors = await listTotpFactors()
  const verified = listVerifiedTotpFactors(factors)
  const safeId = factorId.trim()

  if (
    !canRemoveOwnVerifiedTotpFactor({
      aal,
      factorId: safeId,
      verifiedFactors: verified,
    })
  ) {
    throw new MfaServiceError('That authenticator is not available to remove.')
  }

  const { error } = await requireSupabase().auth.mfa.unenroll({
    factorId: safeId,
  })

  if (error && !isMfaFactorNotFoundError(error)) {
    mapFactorError(error, 'Unable to remove authenticator. Try again.')
  }

  const [nextAal, nextFactors] = await Promise.all([
    getAuthenticatorAssuranceLevel(),
    listTotpFactors(),
  ])

  return {
    remainingVerified: listVerifiedTotpFactors(nextFactors),
    aal: nextAal,
  }
}

export function toAuthServiceCompatibleError(error: unknown): Error {
  if (error instanceof MfaServiceError || error instanceof AuthServiceError) {
    return error
  }
  if (error instanceof Error && error.message.trim()) {
    return new MfaServiceError(error.message)
  }
  return new MfaServiceError('Unable to complete multi-factor authentication.')
}

export const mfaService = {
  getAuthenticatorAssuranceLevel,
  listTotpFactors,
  clearUnverifiedTotpFactors,
  enrollTotpFactor,
  discardActiveTotpEnrollmentAttempt,
  challengeAndVerifyTotp,
  verifyTotpEnrollment,
  unenrollOwnVerifiedTotpFactor,
  isMfaFactorNotFoundError,
}

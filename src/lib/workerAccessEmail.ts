/**
 * Shared Worker access-email contracts (Admin Edge Function).
 * Keep in sync with supabase/functions/send-worker-access-email and
 * migration 20260806240000_worker_access_email.sql.
 */

import { OFFICE_MEMBERSHIP_ROLES } from '@/lib/membershipRoles'

export const WORKER_ACCESS_EMAIL_OFFICE_ROLES = OFFICE_MEMBERSHIP_ROLES

export const WORKER_ACCESS_EMAIL_REDIRECT_TO =
  'https://app.drevora.app/reset-password' as const

/** Default server-side cooldown between successful access emails (seconds). */
export const WORKER_ACCESS_EMAIL_COOLDOWN_SECONDS = 900 as const

/** Pending dispatch reservation TTL before auto-expire (seconds). */
export const WORKER_ACCESS_EMAIL_PENDING_TTL_SECONDS = 300 as const

export const WORKER_ACCESS_EMAIL_ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'WORKER_NOT_FOUND',
  'WORKER_ARCHIVED',
  'WORKER_AUTH_NOT_LINKED',
  'WORKER_LOGIN_EMAIL_OUT_OF_SYNC',
  'EMAIL_CONFIRMATION_MISMATCH',
  'ACCESS_EMAIL_RATE_LIMITED',
  'INVALID_EMAIL',
  'server_failure',
] as const

export type WorkerAccessEmailErrorCode =
  (typeof WORKER_ACCESS_EMAIL_ERROR_CODES)[number]

export type SendWorkerAccessEmailRequest = {
  workerId: string
  expectedEmail: string
  emailConfirmed: true
}

export type SendWorkerAccessEmailSuccess = {
  ok: true
  code: 'access_email_sent' | string
  workerId: string
  email: string
  cooldownSeconds: number
  message?: string
  auditRecorded?: boolean
}

export type SendWorkerAccessEmailFailure = {
  ok: false
  code: WorkerAccessEmailErrorCode | string
  message: string
  retryAfterSeconds?: number
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeAccessEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return null
  return email
}

export function isWorkerAccessEmailOfficeRole(
  role: string | null | undefined,
): boolean {
  return (
    typeof role === 'string' &&
    (WORKER_ACCESS_EMAIL_OFFICE_ROLES as readonly string[]).includes(role)
  )
}

export function validateSendWorkerAccessEmailInput(input: {
  workerId: unknown
  expectedEmail: unknown
  emailConfirmed: unknown
}):
  | { ok: true; value: SendWorkerAccessEmailRequest }
  | { ok: false; code: WorkerAccessEmailErrorCode; message: string } {
  if (input.emailConfirmed !== true) {
    return {
      ok: false,
      code: 'EMAIL_CONFIRMATION_MISMATCH',
      message: 'Confirm the email address before sending account access email.',
    }
  }

  if (typeof input.workerId !== 'string' || !UUID_RE.test(input.workerId.trim())) {
    return {
      ok: false,
      code: 'WORKER_NOT_FOUND',
      message: 'Worker was not found.',
    }
  }

  const expectedEmail = normalizeAccessEmail(input.expectedEmail)
  if (!expectedEmail) {
    return {
      ok: false,
      code: 'INVALID_EMAIL',
      message: 'Enter a valid email address.',
    }
  }

  return {
    ok: true,
    value: {
      workerId: input.workerId.trim(),
      expectedEmail,
      emailConfirmed: true,
    },
  }
}

/** Browser must never send companyId or authUserId. */
export function buildSendWorkerAccessEmailRequestBody(
  input: SendWorkerAccessEmailRequest,
): Record<string, unknown> {
  return {
    workerId: input.workerId,
    expectedEmail: input.expectedEmail,
    emailConfirmed: true,
  }
}

export function sendWorkerAccessEmailRequestContainsForbiddenKeys(
  body: Record<string, unknown>,
): boolean {
  return (
    Object.prototype.hasOwnProperty.call(body, 'companyId') ||
    Object.prototype.hasOwnProperty.call(body, 'authUserId') ||
    Object.prototype.hasOwnProperty.call(body, 'company_id') ||
    Object.prototype.hasOwnProperty.call(body, 'auth_user_id')
  )
}

export function mapWorkerAccessEmailDatabaseError(message: string): {
  code: WorkerAccessEmailErrorCode
  httpStatus: number
} {
  const upper = message.toUpperCase()
  if (upper.includes('ACCESS_EMAIL_RATE_LIMITED')) {
    return { code: 'ACCESS_EMAIL_RATE_LIMITED', httpStatus: 429 }
  }
  if (upper.includes('WORKER_LOGIN_EMAIL_OUT_OF_SYNC')) {
    return { code: 'WORKER_LOGIN_EMAIL_OUT_OF_SYNC', httpStatus: 409 }
  }
  if (upper.includes('EMAIL_CONFIRMATION_MISMATCH')) {
    return { code: 'EMAIL_CONFIRMATION_MISMATCH', httpStatus: 400 }
  }
  if (upper.includes('WORKER_NOT_FOUND')) {
    return { code: 'WORKER_NOT_FOUND', httpStatus: 404 }
  }
  if (upper.includes('WORKER_ARCHIVED')) {
    return { code: 'WORKER_ARCHIVED', httpStatus: 409 }
  }
  if (upper.includes('WORKER_AUTH_NOT_LINKED')) {
    return { code: 'WORKER_AUTH_NOT_LINKED', httpStatus: 409 }
  }
  if (upper.includes('FORBIDDEN')) {
    return { code: 'FORBIDDEN', httpStatus: 403 }
  }
  if (upper.includes('UNAUTHENTICATED')) {
    return { code: 'UNAUTHENTICATED', httpStatus: 401 }
  }
  if (upper.includes('INVALID_EMAIL')) {
    return { code: 'INVALID_EMAIL', httpStatus: 400 }
  }
  return { code: 'server_failure', httpStatus: 500 }
}

export function describeWorkerAccessEmailSequence(): {
  resolveAuthEmailServerSide: true
  sendWithResetPasswordForEmail: true
  redirectTo: typeof WORKER_ACCESS_EMAIL_REDIRECT_TO
  beginReservationBeforeSend: true
  finalizeAfterAcceptedSend: true
  failWithoutAuditOnSendError: true
  auditOnlyAfterAcceptedSend: true
  neverCreatesAuthUser: true
  neverRebindsAuthUserId: true
  neverUsesGenerateLink: true
  cooldownSeconds: typeof WORKER_ACCESS_EMAIL_COOLDOWN_SECONDS
  pendingTtlSeconds: typeof WORKER_ACCESS_EMAIL_PENDING_TTL_SECONDS
} {
  return {
    resolveAuthEmailServerSide: true,
    sendWithResetPasswordForEmail: true,
    redirectTo: WORKER_ACCESS_EMAIL_REDIRECT_TO,
    beginReservationBeforeSend: true,
    finalizeAfterAcceptedSend: true,
    failWithoutAuditOnSendError: true,
    auditOnlyAfterAcceptedSend: true,
    neverCreatesAuthUser: true,
    neverRebindsAuthUserId: true,
    neverUsesGenerateLink: true,
    cooldownSeconds: WORKER_ACCESS_EMAIL_COOLDOWN_SECONDS,
    pendingTtlSeconds: WORKER_ACCESS_EMAIL_PENDING_TTL_SECONDS,
  }
}

export function formatWorkerAccessEmailUserMessage(
  code: string | null | undefined,
  fallbackMessage?: string | null,
  options?: { retryAfterSeconds?: number | null },
): string {
  const normalized = (code ?? '').trim().toUpperCase()
  switch (normalized) {
    case 'WORKER_NOT_FOUND':
      return 'Worker was not found in your company.'
    case 'WORKER_ARCHIVED':
      return 'Archived Workers cannot receive account access email.'
    case 'WORKER_AUTH_NOT_LINKED':
      return 'This Worker is not linked to an Auth account yet.'
    case 'WORKER_LOGIN_EMAIL_OUT_OF_SYNC':
      return 'Worker profile email and Auth login email do not match. Fix login email first.'
    case 'EMAIL_CONFIRMATION_MISMATCH':
      return 'Confirmed email does not match the current Worker login email.'
    case 'ACCESS_EMAIL_RATE_LIMITED': {
      const retryAfter = options?.retryAfterSeconds
      if (
        typeof retryAfter === 'number' &&
        Number.isFinite(retryAfter) &&
        retryAfter > 0
      ) {
        const minutes = Math.max(1, Math.ceil(retryAfter / 60))
        return `An account access email was sent recently. You can send another after about ${minutes} minute${minutes === 1 ? '' : 's'}.`
      }
      return 'An account access email was sent recently. Please wait for the cooldown before sending another.'
    }
    case 'FORBIDDEN':
      return 'Only Office roles can send Worker account access email.'
    case 'UNAUTHENTICATED':
      return 'Your session has expired. Sign in again and try again.'
    case 'INVALID_EMAIL':
      return 'Enter a valid email address.'
    case 'SERVER_FAILURE':
      return 'Unable to send account access email right now. Please try again.'
    default:
      break
  }

  const safeFallback = fallbackMessage?.trim()
  if (
    safeFallback &&
    !/sql|stack|exception|supabase|postgres|pgrst|jwt|service.?role|dispatch_id|auth_user_id|company_id|auth\.users/i.test(
      safeFallback,
    )
  ) {
    return safeFallback
  }

  return 'Unable to send account access email right now. Please try again.'
}

export function formatWorkerAccessEmailSuccessToast(email: string): string {
  const normalized = normalizeAccessEmail(email) ?? email.trim().toLowerCase()
  if (normalized) {
    return `Account access email sent to ${normalized}.`
  }
  return 'Account access email sent.'
}

/** Confirm checkbox must be checked and expected email must be valid. */
export function canSubmitSendWorkerAccessEmail(input: {
  emailConfirmed: boolean
  expectedEmail: string
}): boolean {
  if (!input.emailConfirmed) return false
  return Boolean(normalizeAccessEmail(input.expectedEmail))
}

/** True when Worker has an Auth link (same rule as login-email lock). */
export function canShowSendWorkerAccessEmail(
  authUserId: string | null | undefined,
): boolean {
  return typeof authUserId === 'string' && authUserId.trim().length > 0
}

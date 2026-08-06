/**
 * Shared Worker login-email change contracts (Admin Edge Function).
 * Keep in sync with supabase/functions/change-worker-login-email and
 * migration 20260806220000_worker_login_email_change.sql.
 */

import { OFFICE_MEMBERSHIP_ROLES } from '@/lib/membershipRoles'

export const WORKER_LOGIN_EMAIL_OFFICE_ROLES = OFFICE_MEMBERSHIP_ROLES

export const WORKER_LOGIN_EMAIL_CHANGE_REQUIRED =
  'WORKER_LOGIN_EMAIL_CHANGE_REQUIRED' as const

export const WORKER_LOGIN_EMAIL_ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'WORKER_NOT_FOUND',
  'WORKER_ARCHIVED',
  'WORKER_AUTH_NOT_LINKED',
  'EMAIL_ALREADY_IN_USE',
  'SAME_PERSON_CONFIRMATION_REQUIRED',
  'INVALID_EMAIL',
  'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED',
  WORKER_LOGIN_EMAIL_CHANGE_REQUIRED,
  'server_failure',
] as const

export type WorkerLoginEmailErrorCode =
  (typeof WORKER_LOGIN_EMAIL_ERROR_CODES)[number]

export type ChangeWorkerLoginEmailRequest = {
  workerId: string
  newEmail: string
  reason: string
  samePersonConfirmed: true
}

export type ChangeWorkerLoginEmailSuccess = {
  ok: true
  code: 'login_email_changed' | 'already_same_email' | string
  changed: boolean
  workerId: string
  authUserId: string
  email: string
  oldEmail?: string
  message?: string
  authEmailUpdated?: boolean
  authRollbackAttempted?: boolean
  authRollbackSucceeded?: boolean
  authRollbackSkipped?: boolean
  authRollbackError?: string | null
}

export type ChangeWorkerLoginEmailFailure = {
  ok: false
  code: WorkerLoginEmailErrorCode | string
  message: string
  authEmailUpdated?: boolean
  authRollbackAttempted?: boolean
  authRollbackSucceeded?: boolean
  authRollbackSkipped?: boolean
  authRollbackError?: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeLoginEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return null
  return email
}

export function isWorkerLoginEmailOfficeRole(role: string | null | undefined): boolean {
  return (
    typeof role === 'string' &&
    (WORKER_LOGIN_EMAIL_OFFICE_ROLES as readonly string[]).includes(role)
  )
}

export function validateChangeWorkerLoginEmailInput(input: {
  workerId: unknown
  newEmail: unknown
  reason: unknown
  samePersonConfirmed: unknown
}):
  | { ok: true; value: ChangeWorkerLoginEmailRequest }
  | { ok: false; code: WorkerLoginEmailErrorCode; message: string } {
  if (input.samePersonConfirmed !== true) {
    return {
      ok: false,
      code: 'SAME_PERSON_CONFIRMATION_REQUIRED',
      message: 'Confirm this is the same person before changing login email.',
    }
  }

  if (typeof input.workerId !== 'string' || !UUID_RE.test(input.workerId.trim())) {
    return {
      ok: false,
      code: 'WORKER_NOT_FOUND',
      message: 'Worker was not found.',
    }
  }

  const newEmail = normalizeLoginEmail(input.newEmail)
  if (!newEmail) {
    return {
      ok: false,
      code: 'INVALID_EMAIL',
      message: 'Enter a valid email address.',
    }
  }

  if (typeof input.reason !== 'string' || input.reason.trim() === '') {
    return {
      ok: false,
      code: 'server_failure',
      message: 'A reason is required.',
    }
  }

  return {
    ok: true,
    value: {
      workerId: input.workerId.trim(),
      newEmail,
      reason: input.reason.trim(),
      samePersonConfirmed: true,
    },
  }
}

/** Browser must never send companyId or authUserId. */
export function buildChangeWorkerLoginEmailRequestBody(
  input: ChangeWorkerLoginEmailRequest,
): Record<string, unknown> {
  return {
    workerId: input.workerId,
    newEmail: input.newEmail,
    reason: input.reason,
    samePersonConfirmed: true,
  }
}

export function changeWorkerLoginEmailRequestContainsForbiddenKeys(
  body: Record<string, unknown>,
): boolean {
  return (
    Object.prototype.hasOwnProperty.call(body, 'companyId') ||
    Object.prototype.hasOwnProperty.call(body, 'authUserId') ||
    Object.prototype.hasOwnProperty.call(body, 'company_id') ||
    Object.prototype.hasOwnProperty.call(body, 'auth_user_id')
  )
}

export function mapWorkerLoginEmailDatabaseError(message: string): {
  code: WorkerLoginEmailErrorCode
  httpStatus: number
} {
  const upper = message.toUpperCase()
  if (upper.includes('WORKER_NOT_FOUND')) {
    return { code: 'WORKER_NOT_FOUND', httpStatus: 404 }
  }
  if (upper.includes('WORKER_ARCHIVED')) {
    return { code: 'WORKER_ARCHIVED', httpStatus: 409 }
  }
  if (upper.includes('WORKER_AUTH_NOT_LINKED')) {
    return { code: 'WORKER_AUTH_NOT_LINKED', httpStatus: 409 }
  }
  if (upper.includes('EMAIL_ALREADY_IN_USE')) {
    return { code: 'EMAIL_ALREADY_IN_USE', httpStatus: 409 }
  }
  if (upper.includes('INVALID_EMAIL')) {
    return { code: 'INVALID_EMAIL', httpStatus: 400 }
  }
  if (upper.includes('SAME_PERSON_CONFIRMATION_REQUIRED')) {
    return { code: 'SAME_PERSON_CONFIRMATION_REQUIRED', httpStatus: 400 }
  }
  if (upper.includes('WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED')) {
    return { code: 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED', httpStatus: 409 }
  }
  if (upper.includes(WORKER_LOGIN_EMAIL_CHANGE_REQUIRED)) {
    return { code: WORKER_LOGIN_EMAIL_CHANGE_REQUIRED, httpStatus: 409 }
  }
  if (upper.includes('FORBIDDEN')) {
    return { code: 'FORBIDDEN', httpStatus: 403 }
  }
  if (upper.includes('UNAUTHENTICATED')) {
    return { code: 'UNAUTHENTICATED', httpStatus: 401 }
  }
  return { code: 'server_failure', httpStatus: 500 }
}

export function describeLoginEmailChangeSequence(): {
  authFirst: true
  thenFinalizeRpc: 'drevora_finalize_worker_login_email_change'
  rollbackOnFinalizeFailure: 'restore_old_auth_email'
  neverCreatesAuthUser: true
  neverRebindsAuthUserId: true
} {
  return {
    authFirst: true,
    thenFinalizeRpc: 'drevora_finalize_worker_login_email_change',
    rollbackOnFinalizeFailure: 'restore_old_auth_email',
    neverCreatesAuthUser: true,
    neverRebindsAuthUserId: true,
  }
}

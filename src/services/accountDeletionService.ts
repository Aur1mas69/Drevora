import { requireSupabase } from '@/lib/supabase'

export type AccountDeletionRequestResult = {
  ok: true
  code: 'scheduled' | 'already_pending'
  requestId: string
  scheduledFor: string
  requestedAt: string
  emailSent?: boolean
  message: string
}

export type OwnActiveAccountDeletionRequest = {
  id: string
  status: 'pending' | 'processing'
  scheduledFor: string
  requestedAt: string
}

export type AccountDeletionErrorCode =
  | 'unauthenticated'
  | 'worker_not_linked'
  | 'office_account'
  | 'sole_admin'
  | 'email_required'
  | 'network_failure'
  | 'server_failure'
  | 'server_misconfigured'
  | 'unknown'

export class AccountDeletionServiceError extends Error {
  readonly code: AccountDeletionErrorCode

  constructor(code: AccountDeletionErrorCode, message: string) {
    super(message)
    this.name = 'AccountDeletionServiceError'
    this.code = code
  }
}

type EdgeErrorBody = {
  ok?: boolean
  code?: string
  message?: string
}

function mapErrorCode(code: string | undefined): AccountDeletionErrorCode {
  switch (code) {
    case 'unauthenticated':
      return 'unauthenticated'
    case 'worker_not_linked':
      return 'worker_not_linked'
    case 'office_account':
      return 'office_account'
    case 'sole_admin':
      return 'sole_admin'
    case 'email_required':
      return 'email_required'
    case 'server_misconfigured':
      return 'server_misconfigured'
    case 'server_failure':
      return 'server_failure'
    default:
      return 'unknown'
  }
}

function userMessageForCode(code: AccountDeletionErrorCode): string {
  switch (code) {
    case 'unauthenticated':
      return 'Your session has expired. Please sign in again.'
    case 'worker_not_linked':
      return 'Your Worker profile could not be linked to this login.'
    case 'office_account':
      return 'Unable to delete this office account. Contact admin@drevora.uk if you need help.'
    case 'sole_admin':
      return 'You must appoint another administrator before deleting your account.'
    case 'email_required':
      return 'Your account email is required to delete your account.'
    case 'network_failure':
      return 'Unable to reach the server. Check your connection and try again.'
    case 'server_misconfigured':
    case 'server_failure':
    case 'unknown':
    default:
      return 'Unable to schedule account deletion right now. Please try again later.'
  }
}

function formatScheduledDeletionDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** User-facing body for the dedicated pending-deletion blocked screen. */
export function formatAccountDeletionScheduledMessage(scheduledFor: string): string {
  const dateLabel = formatScheduledDeletionDate(scheduledFor)
  return `Your DREVORA access is disabled. Your account is scheduled for deletion on ${dateLabel}. To cancel before this date, contact your organisation administrator or admin@drevora.uk.`
}

/**
 * Secure own-request lookup (RLS: auth_user_id = auth.uid()).
 * Returns the active pending/processing deletion request, if any.
 */
export async function fetchOwnActiveAccountDeletionRequest(): Promise<OwnActiveAccountDeletionRequest | null> {
  const { data, error } = await requireSupabase()
    .from('account_deletion_requests')
    .select('id, status, scheduled_for, requested_at')
    .in('status', ['pending', 'processing'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new AccountDeletionServiceError(
      'server_failure',
      userMessageForCode('server_failure'),
    )
  }

  if (!data) return null

  const status = data.status
  if (status !== 'pending' && status !== 'processing') return null
  if (typeof data.scheduled_for !== 'string' || !data.scheduled_for.trim()) {
    return null
  }
  if (typeof data.id !== 'string' || !data.id.trim()) return null

  return {
    id: data.id,
    status,
    scheduledFor: data.scheduled_for,
    requestedAt:
      typeof data.requested_at === 'string' ? data.requested_at : data.scheduled_for,
  }
}

/**
 * Invoke the delete-account Edge Function (action: request).
 * Works for Worker and Office/Admin callers. Does not delete Auth locally.
 */
export async function requestAccountDeletion(): Promise<AccountDeletionRequestResult> {
  let data: unknown
  let error: { message?: string; context?: Response } | null = null

  try {
    const result = await requireSupabase().functions.invoke('delete-account', {
      body: { action: 'request' },
    })
    data = result.data
    error = result.error
  } catch {
    throw new AccountDeletionServiceError(
      'network_failure',
      userMessageForCode('network_failure'),
    )
  }

  if (error) {
    let body: EdgeErrorBody | null = null
    try {
      if (error.context) {
        body = (await error.context.json()) as EdgeErrorBody
      }
    } catch {
      body = null
    }

    const code = mapErrorCode(
      typeof body?.code === 'string' ? body.code : undefined,
    )
    throw new AccountDeletionServiceError(
      code,
      typeof body?.message === 'string' && body.message.trim()
        ? body.message.trim()
        : userMessageForCode(code),
    )
  }

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    (data as { ok?: unknown }).ok !== true
  ) {
    throw new AccountDeletionServiceError(
      'server_failure',
      userMessageForCode('server_failure'),
    )
  }

  const payload = data as Record<string, unknown>
  const code =
    payload.code === 'already_pending' ? 'already_pending' : 'scheduled'
  const requestId =
    typeof payload.requestId === 'string' ? payload.requestId : ''
  const scheduledFor =
    typeof payload.scheduledFor === 'string' ? payload.scheduledFor : ''
  const requestedAt =
    typeof payload.requestedAt === 'string' ? payload.requestedAt : ''

  if (!requestId || !scheduledFor || !requestedAt) {
    throw new AccountDeletionServiceError(
      'server_failure',
      userMessageForCode('server_failure'),
    )
  }

  return {
    ok: true,
    code,
    requestId,
    scheduledFor,
    requestedAt,
    emailSent: payload.emailSent === true,
    message:
      typeof payload.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : 'Account deletion is scheduled.',
  }
}

/** @deprecated Prefer requestAccountDeletion — same Edge invoke. */
export async function requestWorkerAccountDeletion(): Promise<AccountDeletionRequestResult> {
  return requestAccountDeletion()
}

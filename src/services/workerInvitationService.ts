/**
 * Admin Add Worker → invite-worker Edge Function client.
 * Uses the authenticated Supabase browser client only (never service-role).
 */
import { requireSupabase } from '@/lib/supabase'
import {
  buildInviteWorkerRequestBody,
  classifyInviteWorkerSuccess,
  formatInviteWorkerSuccessToast,
  formatInviteWorkerUserMessage,
  inviteWorkerRequestContainsCompanyId,
  parseFunctionsInvokeErrorBody,
  type InviteWorkerFormFields,
  type InviteWorkerSuccessKind,
} from '@/lib/workerInvitation'

export class WorkerInvitationServiceError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'WorkerInvitationServiceError'
    this.code = code
  }
}

export type InviteWorkerSuccessResult = {
  ok: true
  code: string
  kind: InviteWorkerSuccessKind
  driverId: string | null
  workerCode: string | null
  inviteSent: boolean
  emailDeliveryFailed: boolean
  linkingSucceeded: true
  alreadyExisted: boolean
  toastMessage: string
  message: string
}

type FunctionsInvokeErrorLike = {
  message?: string
  context?: unknown
  name?: string
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Invite a Worker via the invite-worker Edge Function.
 * Caller JWT provides tenant context — never send companyId.
 */
export async function inviteWorker(
  form: InviteWorkerFormFields,
): Promise<InviteWorkerSuccessResult> {
  const body = buildInviteWorkerRequestBody(form)
  if (inviteWorkerRequestContainsCompanyId(body)) {
    throw new WorkerInvitationServiceError(
      'server_failure',
      'Unable to invite Worker right now. Please try again.',
    )
  }

  let data: unknown
  let error: FunctionsInvokeErrorLike | null = null

  try {
    const result = await requireSupabase().functions.invoke('invite-worker', {
      body,
    })
    data = result.data
    error = result.error
  } catch {
    throw new WorkerInvitationServiceError(
      'server_failure',
      formatInviteWorkerUserMessage('server_failure'),
    )
  }

  if (error) {
    const parsed = await parseFunctionsInvokeErrorBody({ error, data })
    throw new WorkerInvitationServiceError(
      parsed.code,
      formatInviteWorkerUserMessage(parsed.code, parsed.message),
    )
  }

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    (data as { ok?: unknown }).ok !== true
  ) {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const record = data as Record<string, unknown>
      const code = asNonEmptyString(record.code) || 'server_failure'
      throw new WorkerInvitationServiceError(
        code,
        formatInviteWorkerUserMessage(
          code,
          asNonEmptyString(record.message),
        ),
      )
    }

    throw new WorkerInvitationServiceError(
      'server_failure',
      formatInviteWorkerUserMessage('server_failure'),
    )
  }

  const payload = data as Record<string, unknown>
  const code = asNonEmptyString(payload.code) ?? 'linked'
  const inviteSent = payload.inviteSent === true
  const emailDeliveryFailed = payload.emailDeliveryFailed === true
  const kind = classifyInviteWorkerSuccess({
    code,
    inviteSent,
    emailDeliveryFailed,
  })
  const workerCode = asNonEmptyString(payload.workerCode)
  const driverId = asNonEmptyString(payload.driverId)
  const message =
    asNonEmptyString(payload.message) ??
    formatInviteWorkerSuccessToast(kind, workerCode)

  return {
    ok: true,
    code,
    kind,
    driverId,
    workerCode,
    inviteSent,
    emailDeliveryFailed,
    linkingSucceeded: true,
    alreadyExisted: payload.alreadyExisted === true,
    toastMessage: formatInviteWorkerSuccessToast(kind, workerCode),
    message,
  }
}

export function isWorkerInvitationServiceError(
  error: unknown,
): error is WorkerInvitationServiceError {
  return error instanceof WorkerInvitationServiceError
}

export { parseFunctionsInvokeErrorBody } from '@/lib/workerInvitation'

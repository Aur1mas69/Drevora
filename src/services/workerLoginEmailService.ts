/**
 * Admin Change login email → change-worker-login-email Edge Function client.
 * Uses the authenticated Supabase browser client only (never service-role).
 */
import { requireSupabase } from '@/lib/supabase'
import {
  buildChangeWorkerLoginEmailRequestBody,
  changeWorkerLoginEmailRequestContainsForbiddenKeys,
  formatWorkerLoginEmailSuccessToast,
  formatWorkerLoginEmailUserMessage,
  validateChangeWorkerLoginEmailInput,
  type ChangeWorkerLoginEmailSuccess,
} from '@/lib/workerLoginEmail'
import { parseFunctionsInvokeErrorBody } from '@/lib/workerInvitation'

export class WorkerLoginEmailServiceError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'WorkerLoginEmailServiceError'
    this.code = code
  }
}

export type ChangeWorkerLoginEmailResult = {
  ok: true
  code: string
  changed: boolean
  workerId: string
  email: string
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
 * Change login email for an Auth-linked Worker.
 * Never send companyId or authUserId — tenant comes from the caller JWT.
 */
export async function changeWorkerLoginEmail(input: {
  workerId: string
  newEmail: string
  reason: string
  samePersonConfirmed: true
}): Promise<ChangeWorkerLoginEmailResult> {
  const validated = validateChangeWorkerLoginEmailInput(input)
  if (!validated.ok) {
    throw new WorkerLoginEmailServiceError(
      validated.code,
      formatWorkerLoginEmailUserMessage(validated.code, validated.message),
    )
  }

  const body = buildChangeWorkerLoginEmailRequestBody(validated.value)
  if (changeWorkerLoginEmailRequestContainsForbiddenKeys(body)) {
    throw new WorkerLoginEmailServiceError(
      'server_failure',
      formatWorkerLoginEmailUserMessage('server_failure'),
    )
  }

  let data: unknown
  let error: FunctionsInvokeErrorLike | null = null

  try {
    const result = await requireSupabase().functions.invoke(
      'change-worker-login-email',
      { body },
    )
    data = result.data
    error = result.error
  } catch {
    throw new WorkerLoginEmailServiceError(
      'server_failure',
      formatWorkerLoginEmailUserMessage('server_failure'),
    )
  }

  if (error) {
    const parsed = await parseFunctionsInvokeErrorBody({ error, data })
    throw new WorkerLoginEmailServiceError(
      parsed.code,
      formatWorkerLoginEmailUserMessage(parsed.code, parsed.message),
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
      throw new WorkerLoginEmailServiceError(
        code,
        formatWorkerLoginEmailUserMessage(
          code,
          asNonEmptyString(record.message),
        ),
      )
    }
    throw new WorkerLoginEmailServiceError(
      'server_failure',
      formatWorkerLoginEmailUserMessage('server_failure'),
    )
  }

  const success = data as ChangeWorkerLoginEmailSuccess
  const email = asNonEmptyString(success.email) || validated.value.newEmail
  const workerId = asNonEmptyString(success.workerId) || validated.value.workerId
  const changed = success.changed !== false
  const message =
    asNonEmptyString(success.message) ||
    formatWorkerLoginEmailSuccessToast({ changed, email })

  return {
    ok: true,
    code: asNonEmptyString(success.code) || 'login_email_changed',
    changed,
    workerId,
    email,
    toastMessage: formatWorkerLoginEmailSuccessToast({ changed, email }),
    message,
  }
}

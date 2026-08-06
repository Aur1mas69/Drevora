/**
 * Admin Send account access email → send-worker-access-email Edge Function client.
 * Uses the authenticated Supabase browser client only (never service-role).
 */
import { requireSupabase } from '@/lib/supabase'
import {
  buildSendWorkerAccessEmailRequestBody,
  formatWorkerAccessEmailSuccessToast,
  formatWorkerAccessEmailUserMessage,
  sendWorkerAccessEmailRequestContainsForbiddenKeys,
  validateSendWorkerAccessEmailInput,
  type SendWorkerAccessEmailSuccess,
} from '@/lib/workerAccessEmail'
import { parseFunctionsInvokeErrorBody } from '@/lib/workerInvitation'

export class WorkerAccessEmailServiceError extends Error {
  readonly code: string
  readonly retryAfterSeconds?: number

  constructor(
    code: string,
    message: string,
    options?: { retryAfterSeconds?: number },
  ) {
    super(message)
    this.name = 'WorkerAccessEmailServiceError'
    this.code = code
    if (
      typeof options?.retryAfterSeconds === 'number' &&
      Number.isFinite(options.retryAfterSeconds)
    ) {
      this.retryAfterSeconds = options.retryAfterSeconds
    }
  }
}

export type SendWorkerAccessEmailResult = {
  ok: true
  code: string
  workerId: string
  email: string
  cooldownSeconds: number
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

function readRetryAfterSeconds(data: unknown): number | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined
  const raw = (data as Record<string, unknown>).retryAfterSeconds
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return undefined
}

/**
 * Send account access email for an Auth-linked Worker.
 * Never send companyId or authUserId — tenant comes from the caller JWT.
 * Never send a browser-selected target email — expectedEmail is confirmation only.
 */
export async function sendWorkerAccessEmail(input: {
  workerId: string
  expectedEmail: string
  emailConfirmed: true
}): Promise<SendWorkerAccessEmailResult> {
  const validated = validateSendWorkerAccessEmailInput(input)
  if (!validated.ok) {
    throw new WorkerAccessEmailServiceError(
      validated.code,
      formatWorkerAccessEmailUserMessage(validated.code, validated.message),
    )
  }

  const body = buildSendWorkerAccessEmailRequestBody(validated.value)
  if (sendWorkerAccessEmailRequestContainsForbiddenKeys(body)) {
    throw new WorkerAccessEmailServiceError(
      'server_failure',
      formatWorkerAccessEmailUserMessage('server_failure'),
    )
  }

  let data: unknown
  let error: FunctionsInvokeErrorLike | null = null

  try {
    const result = await requireSupabase().functions.invoke(
      'send-worker-access-email',
      { body },
    )
    data = result.data
    error = result.error
  } catch {
    throw new WorkerAccessEmailServiceError(
      'server_failure',
      formatWorkerAccessEmailUserMessage('server_failure'),
    )
  }

  if (error) {
    const parsed = await parseFunctionsInvokeErrorBody({ error, data })
    const retryAfterSeconds = readRetryAfterSeconds(data)
    throw new WorkerAccessEmailServiceError(
      parsed.code,
      formatWorkerAccessEmailUserMessage(parsed.code, parsed.message, {
        retryAfterSeconds,
      }),
      { retryAfterSeconds },
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
      const retryAfterSeconds = readRetryAfterSeconds(data)
      throw new WorkerAccessEmailServiceError(
        code,
        formatWorkerAccessEmailUserMessage(
          code,
          asNonEmptyString(record.message),
          { retryAfterSeconds },
        ),
        { retryAfterSeconds },
      )
    }
    throw new WorkerAccessEmailServiceError(
      'server_failure',
      formatWorkerAccessEmailUserMessage('server_failure'),
    )
  }

  const success = data as SendWorkerAccessEmailSuccess
  const email =
    asNonEmptyString(success.email) || validated.value.expectedEmail
  const workerId =
    asNonEmptyString(success.workerId) || validated.value.workerId
  const cooldownSeconds =
    typeof success.cooldownSeconds === 'number' &&
    Number.isFinite(success.cooldownSeconds)
      ? success.cooldownSeconds
      : 0
  const toastMessage = formatWorkerAccessEmailSuccessToast(email)

  return {
    ok: true,
    code: asNonEmptyString(success.code) || 'access_email_sent',
    workerId,
    email,
    cooldownSeconds,
    toastMessage,
    message: asNonEmptyString(success.message) || toastMessage,
  }
}

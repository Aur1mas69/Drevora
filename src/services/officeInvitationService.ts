/**
 * Settings → Office Users — invite-office-user Edge Function + list RPC client.
 * Uses the authenticated Supabase browser client only (never service-role).
 */
import { requireSupabase } from '@/lib/supabase'
import {
  buildInviteOfficeUserRequestBody,
  classifyInviteOfficeUserSuccess,
  filterOfficeUsersListRows,
  formatInviteOfficeUserSuccessToast,
  formatInviteOfficeUserUserMessage,
  formatOfficeUsersListError,
  inviteOfficeUserRequestContainsForbiddenIds,
  mapOfficeUserListRpcRow,
  type InviteOfficeUserSuccessKind,
  type OfficeInvitationInput,
  type OfficeUserListRow,
} from '@/lib/officeInvitation'
import { parseFunctionsInvokeErrorBody } from '@/lib/workerInvitation'

export class OfficeInvitationServiceError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'OfficeInvitationServiceError'
    this.code = code
  }
}

export type InviteOfficeUserSuccessResult = {
  ok: true
  code: string
  kind: InviteOfficeUserSuccessKind
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

function mapListRpcError(error: { message?: string; code?: string } | null): never {
  const message = error?.message ?? ''
  const upper = message.toUpperCase()
  let code = 'server_failure'
  if (upper.includes('UNAUTHENTICATED')) code = 'unauthenticated'
  else if (upper.includes('FORBIDDEN')) code = 'forbidden'
  throw new OfficeInvitationServiceError(code, formatOfficeUsersListError(message))
}

/**
 * List Office-access memberships for the caller's company.
 * Excludes Driver. Never sends companyId.
 */
export async function listOfficeUsers(): Promise<OfficeUserListRow[]> {
  const { data, error } = await requireSupabase().rpc('drevora_list_office_users')

  if (error) {
    mapListRpcError(error)
  }

  const rows = Array.isArray(data) ? data : []
  const mapped: OfficeUserListRow[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const mappedRow = mapOfficeUserListRpcRow(row as Record<string, unknown>)
    if (mappedRow) mapped.push(mappedRow)
  }

  return filterOfficeUsersListRows(mapped)
}

/**
 * Invite an Office user via the invite-office-user Edge Function.
 * Caller JWT provides tenant context — never send companyId / userId / authUserId.
 */
export async function inviteOfficeUser(
  form: OfficeInvitationInput,
): Promise<InviteOfficeUserSuccessResult> {
  const body = buildInviteOfficeUserRequestBody(form)
  if (inviteOfficeUserRequestContainsForbiddenIds(body)) {
    throw new OfficeInvitationServiceError(
      'server_failure',
      'Unable to invite Office user right now. Please try again.',
    )
  }

  const allowedKeys = new Set(['email', 'role', 'fullName'])
  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      throw new OfficeInvitationServiceError(
        'server_failure',
        'Unable to invite Office user right now. Please try again.',
      )
    }
  }

  let data: unknown
  let error: FunctionsInvokeErrorLike | null = null

  try {
    const result = await requireSupabase().functions.invoke('invite-office-user', {
      body,
    })
    data = result.data
    error = result.error
  } catch {
    throw new OfficeInvitationServiceError(
      'server_failure',
      formatInviteOfficeUserUserMessage('server_failure'),
    )
  }

  if (error) {
    const parsed = await parseFunctionsInvokeErrorBody({ error, data })
    throw new OfficeInvitationServiceError(
      parsed.code,
      formatInviteOfficeUserUserMessage(parsed.code, parsed.message),
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
      throw new OfficeInvitationServiceError(
        code,
        formatInviteOfficeUserUserMessage(
          code,
          asNonEmptyString(record.message),
        ),
      )
    }

    throw new OfficeInvitationServiceError(
      'server_failure',
      formatInviteOfficeUserUserMessage('server_failure'),
    )
  }

  const payload = data as Record<string, unknown>
  const code = asNonEmptyString(payload.code) ?? 'linked'
  const inviteSent = payload.inviteSent === true
  const emailDeliveryFailed = payload.emailDeliveryFailed === true
  const kind = classifyInviteOfficeUserSuccess({
    code,
    inviteSent,
    emailDeliveryFailed,
  })
  const message =
    asNonEmptyString(payload.message) ?? formatInviteOfficeUserSuccessToast(kind)

  return {
    ok: true,
    code,
    kind,
    inviteSent,
    emailDeliveryFailed,
    linkingSucceeded: true,
    alreadyExisted: payload.alreadyExisted === true,
    toastMessage: formatInviteOfficeUserSuccessToast(kind),
    message,
  }
}

export function isOfficeInvitationServiceError(
  error: unknown,
): error is OfficeInvitationServiceError {
  return error instanceof OfficeInvitationServiceError
}

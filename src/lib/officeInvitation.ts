/**
 * Shared Office-user invitation contracts (Admin invite-office-user Edge Function).
 * Keep in sync with supabase/functions/invite-office-user and
 * migration 20260808150000_office_user_invitation_foundation.sql.
 *
 * Membership target roles are company_members.role only (never drivers.role).
 */

import {
  ALL_OFFICE_MEMBERSHIP_ROLES,
  LOGIN_PATH,
  OFFICE_MEMBERSHIP_ROLES,
  WORKER_MEMBERSHIP_ROLE,
  type CanonicalOfficeMembershipRole,
  isCanonicalOfficeMembershipRole,
} from '@/lib/membershipRoles'

/** Canonical production app origin — never default to localhost. */
export const DREVORA_PRODUCTION_APP_ORIGIN = 'https://app.drevora.app'

/** Same password-setup path used by Worker invite / Forgot password. */
export const OFFICE_INVITE_PASSWORD_PATH = '/reset-password'

export const OFFICE_INVITATION_TARGET_ROLES = OFFICE_MEMBERSHIP_ROLES

export type OfficeInvitationTargetRole = CanonicalOfficeMembershipRole

/** Who may invite Office users (MVP Office + legacy Office membership). */
export const OFFICE_INVITATION_ACTOR_ROLES = ALL_OFFICE_MEMBERSHIP_ROLES

/** Advisory lock namespace for Auth-user serialization (distinct from Worker). */
export const OFFICE_INVITE_AUTH_USER_LOCK_NAMESPACE = 872014552

export const USER_ALREADY_LINKED_TO_ANOTHER_COMPANY =
  'USER_ALREADY_LINKED_TO_ANOTHER_COMPANY' as const

export const OFFICE_INVITATION_ERROR_CODES = [
  'unauthenticated',
  'forbidden',
  'invalid_email',
  'invalid_argument',
  'invalid_role',
  'duplicate_membership',
  USER_ALREADY_LINKED_TO_ANOTHER_COMPANY,
  'email_conflict',
  'company_not_found',
  'server_misconfigured',
  'server_failure',
  'invite_send_failed',
  'partial_link_failed',
] as const

export type OfficeInvitationErrorCode =
  (typeof OFFICE_INVITATION_ERROR_CODES)[number]

export const OFFICE_INVITATION_EVENT_STATUSES = [
  'linked',
  'already_linked',
  'link_failed',
  'invite_send_failed',
  'email_failed',
] as const

export type OfficeInvitationEventStatus =
  (typeof OFFICE_INVITATION_EVENT_STATUSES)[number]

export type OfficeInvitationInput = {
  email: string
  role: string
  fullName?: string | null
  /** Must never be sent to invite-office-user. */
  companyId?: unknown
  userId?: unknown
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeOfficeInvitationEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return null
  return email
}

export function isOfficeInvitationTargetRole(
  value: string | null | undefined,
): value is OfficeInvitationTargetRole {
  return isCanonicalOfficeMembershipRole(value)
}

export function isOfficeInvitationActorRole(
  value: string | null | undefined,
): boolean {
  return (
    typeof value === 'string' &&
    (OFFICE_INVITATION_ACTOR_ROLES as readonly string[]).includes(value)
  )
}

export function resolveOfficeInviteAppOrigin(
  envOrigin: string | null | undefined,
): string {
  const trimmed = envOrigin?.trim().replace(/\/$/, '') ?? ''
  if (trimmed) return trimmed
  return DREVORA_PRODUCTION_APP_ORIGIN
}

export function buildOfficeInviteRedirectTo(
  envOrigin: string | null | undefined,
): string {
  return `${resolveOfficeInviteAppOrigin(envOrigin)}${OFFICE_INVITE_PASSWORD_PATH}`
}

/** Post-invite landing after password setup (normal app login). */
export const OFFICE_POST_INVITE_LOGIN_PATH = LOGIN_PATH

export function validateOfficeInvitationInput(input: OfficeInvitationInput):
  | {
      ok: true
      email: string
      role: OfficeInvitationTargetRole
      fullName: string | null
    }
  | { ok: false; code: OfficeInvitationErrorCode; message: string } {
  const email = normalizeOfficeInvitationEmail(input.email)
  if (!email) {
    return {
      ok: false,
      code: 'invalid_email',
      message: 'Enter a valid Office user email address.',
    }
  }

  const role = typeof input.role === 'string' ? input.role.trim() : ''
  if (role === WORKER_MEMBERSHIP_ROLE || role === 'Driver') {
    return {
      ok: false,
      code: 'invalid_role',
      message: 'Driver cannot be invited as an Office user.',
    }
  }
  if (!isOfficeInvitationTargetRole(role)) {
    return {
      ok: false,
      code: 'invalid_role',
      message: 'Select Admin, Manager, Office, or Supervisor.',
    }
  }

  const fullName =
    typeof input.fullName === 'string' && input.fullName.trim()
      ? input.fullName.trim()
      : null

  return { ok: true, email, role, fullName }
}

/**
 * Build Edge Function body. Never includes companyId / userId.
 */
export function buildInviteOfficeUserRequestBody(
  form: OfficeInvitationInput,
): Record<string, unknown> {
  const validated = validateOfficeInvitationInput(form)
  if (!validated.ok) {
    throw new Error(validated.message)
  }

  const body: Record<string, unknown> = {
    email: validated.email,
    role: validated.role,
  }
  if (validated.fullName) {
    body.fullName = validated.fullName
  }
  return body
}

export function inviteOfficeUserRequestContainsForbiddenIds(
  body: Record<string, unknown>,
): boolean {
  return (
    Object.prototype.hasOwnProperty.call(body, 'companyId') ||
    Object.prototype.hasOwnProperty.call(body, 'userId') ||
    Object.prototype.hasOwnProperty.call(body, 'membershipId') ||
    Object.prototype.hasOwnProperty.call(body, 'authUserId') ||
    Object.prototype.hasOwnProperty.call(body, 'company_id') ||
    Object.prototype.hasOwnProperty.call(body, 'user_id') ||
    Object.prototype.hasOwnProperty.call(body, 'membership_id') ||
    Object.prototype.hasOwnProperty.call(body, 'auth_user_id')
  )
}

export function classifyInvitedOfficeAuthMembership(input: {
  targetCompanyId: string
  activeMembershipCompanyIds: string[]
}): 'none' | 'same_company' | 'other_company' {
  const target = input.targetCompanyId.trim()
  const active = input.activeMembershipCompanyIds
    .map((id) => id.trim())
    .filter(Boolean)

  if (active.some((id) => id !== target)) {
    return 'other_company'
  }
  if (active.some((id) => id === target)) {
    return 'same_company'
  }
  return 'none'
}

/**
 * Forbidden Auth existence probe API call fragments for Office invite.
 * Link generation, magic links, recovery-link probes, OTP, and signup must
 * never be used to discover whether an Auth user already exists.
 */
export const OFFICE_INVITE_FORBIDDEN_AUTH_EXISTENCE_PROBES = [
  '.generateLink(',
  "type: 'magiclink'",
  'type: "magiclink"',
  '.signUp(',
  'signInWithOtp',
] as const

/** Existing Auth users are resolved via read-only admin.listUsers only. */
export function officeInviteExistingAuthLookupCreatesUsers(): false {
  return false
}

/** New Auth users are created only by a successful inviteUserByEmail call. */
export function officeInviteCreatesAuthUserVia(): 'inviteUserByEmail' {
  return 'inviteUserByEmail'
}

export function buildOfficeInviteEmailDeliveryOutcome(input: {
  alreadyExisted: boolean
  linkCode: string
  inviteApiAccepted: boolean
  recoveryEmailAccepted: boolean | null
}): {
  inviteSent: boolean
  emailDeliveryFailed: boolean
  linkingSucceeded: true
  code: string
  message: string
} {
  const baseCode =
    input.linkCode === 'already_linked' ? 'already_linked' : 'linked'

  if (!input.alreadyExisted) {
    return {
      inviteSent: input.inviteApiAccepted,
      emailDeliveryFailed: !input.inviteApiAccepted,
      linkingSucceeded: true,
      code: input.inviteApiAccepted ? baseCode : `${baseCode}_email_failed`,
      message: input.inviteApiAccepted
        ? 'Invitation sent. The Office user can set a password from the email link.'
        : 'Office user was linked, but the invitation email could not be confirmed as sent.',
    }
  }

  const recoveryOk = input.recoveryEmailAccepted === true
  return {
    inviteSent: recoveryOk,
    emailDeliveryFailed: !recoveryOk,
    linkingSucceeded: true,
    code: recoveryOk ? baseCode : `${baseCode}_email_failed`,
    message: recoveryOk
      ? input.linkCode === 'already_linked'
        ? 'Office user is already linked for this company. A password reset email was sent.'
        : 'Office user linked. A password reset email was sent so they can set a password.'
      : 'Office linking succeeded, but the password email could not be sent. Ask them to use Forgot password, or retry the invite.',
  }
}

export function mapOfficeInviteDatabaseError(message: string): {
  code: OfficeInvitationErrorCode
  httpStatus: number
  message: string
} {
  const upper = message.toUpperCase()

  if (upper.includes('OFFICE_INVITE_FORBIDDEN')) {
    return {
      code: 'forbidden',
      httpStatus: 403,
      message: 'Only Office roles can invite Office users.',
    }
  }
  if (upper.includes('OFFICE_INVITE_INVALID_EMAIL')) {
    return {
      code: 'invalid_email',
      httpStatus: 400,
      message: 'Enter a valid Office user email address.',
    }
  }
  if (upper.includes('OFFICE_INVITE_INVALID_ROLE')) {
    return {
      code: 'invalid_role',
      httpStatus: 400,
      message: 'Select Admin, Manager, Office, or Supervisor.',
    }
  }
  if (
    upper.includes('USER_ALREADY_LINKED_TO_ANOTHER_COMPANY') ||
    upper.includes('OFFICE_INVITE_USER_HAS_OTHER_COMPANY')
  ) {
    return {
      code: USER_ALREADY_LINKED_TO_ANOTHER_COMPANY,
      httpStatus: 409,
      message:
        'This email already belongs to an active membership in another company.',
    }
  }
  if (upper.includes('OFFICE_INVITE_EMAIL_CONFLICT')) {
    return {
      code: 'email_conflict',
      httpStatus: 409,
      message:
        'This account already has a Worker or non-Office membership in your company.',
    }
  }
  if (upper.includes('OFFICE_INVITE_DUPLICATE_MEMBERSHIP')) {
    return {
      code: 'duplicate_membership',
      httpStatus: 409,
      message: 'An active membership already exists for this user in your company.',
    }
  }
  if (upper.includes('OFFICE_INVITE_COMPANY_NOT_FOUND')) {
    return {
      code: 'company_not_found',
      httpStatus: 404,
      message: 'Company could not be found.',
    }
  }
  if (upper.includes('OFFICE_INVITE_PARTIAL_LINK_FAILED')) {
    return {
      code: 'partial_link_failed',
      httpStatus: 500,
      message: 'Invitation could not be completed safely. Retry the invite.',
    }
  }
  if (upper.includes('OFFICE_INVITE_INVALID_ARGUMENT')) {
    return {
      code: 'invalid_argument',
      httpStatus: 400,
      message: 'Invitation details are incomplete or invalid.',
    }
  }
  return {
    code: 'server_failure',
    httpStatus: 500,
    message: 'Unable to invite Office user right now.',
  }
}

export function decideNewOfficeAuthUserCleanup(input: {
  createdAuthUserThisRequest: boolean
  membershipQueryOk: boolean
  activeMembershipCount: number | null
  anyMembershipCount: number | null
}): { action: 'delete' | 'skip'; reason: string } {
  if (!input.createdAuthUserThisRequest) {
    return { action: 'skip', reason: 'not_created_this_request' }
  }
  if (!input.membershipQueryOk) {
    return { action: 'skip', reason: 'membership_query_failed' }
  }
  if ((input.activeMembershipCount ?? 0) > 0) {
    return { action: 'skip', reason: 'active_membership_present' }
  }
  if ((input.anyMembershipCount ?? 0) > 0) {
    return { action: 'skip', reason: 'membership_present' }
  }
  return { action: 'delete', reason: 'safe_orphan_after_link_failure' }
}

/**
 * Static contract: Office invite must never create a drivers row.
 */
export function officeInviteCreatesDriversRow(): false {
  return false
}

/**
 * Static contract: Worker invite membership remains Driver.
 */
export function workerInviteMembershipRoleUnchanged(): string {
  return WORKER_MEMBERSHIP_ROLE
}

/** System roles offered in the Invite Office User UI (never includes Driver). */
export const OFFICE_USERS_INVITE_ROLE_OPTIONS = OFFICE_INVITATION_TARGET_ROLES

export type OfficeUserListRow = {
  membershipId: string
  fullName: string | null
  email: string | null
  role: string
  isActive: boolean
  createdAt: string | null
}

/** True when a membership role belongs on the Office Users list (never Driver). */
export function isOfficeUsersListMembershipRole(
  role: string | null | undefined,
): boolean {
  return (
    typeof role === 'string' &&
    (ALL_OFFICE_MEMBERSHIP_ROLES as readonly string[]).includes(role) &&
    role !== WORKER_MEMBERSHIP_ROLE &&
    role !== 'Driver'
  )
}

/**
 * Filter list rows to Office-access memberships only.
 * Driver / Worker memberships are always excluded.
 */
export function filterOfficeUsersListRows<T extends { role: string }>(
  rows: T[],
): T[] {
  return rows.filter((row) => isOfficeUsersListMembershipRole(row.role))
}

export function mapOfficeUserListRpcRow(
  row: Record<string, unknown>,
): OfficeUserListRow | null {
  const membershipId =
    typeof row.membership_id === 'string' ? row.membership_id.trim() : ''
  const role = typeof row.role === 'string' ? row.role.trim() : ''
  if (!membershipId || !isOfficeUsersListMembershipRole(role)) {
    return null
  }

  const fullName =
    typeof row.full_name === 'string' && row.full_name.trim()
      ? row.full_name.trim()
      : null
  const email =
    typeof row.email === 'string' && row.email.trim()
      ? row.email.trim().toLowerCase()
      : null
  const createdAt =
    typeof row.created_at === 'string' && row.created_at.trim()
      ? row.created_at.trim()
      : null

  return {
    membershipId,
    fullName,
    email,
    role,
    isActive: row.is_active === true,
    createdAt,
  }
}

export type InviteOfficeUserSuccessKind =
  | 'invited'
  | 'already_linked'
  | 'created_email_failed'

export function classifyInviteOfficeUserSuccess(input: {
  code: string
  inviteSent: boolean
  emailDeliveryFailed: boolean
}): InviteOfficeUserSuccessKind {
  const code = input.code.toLowerCase()
  if (input.emailDeliveryFailed || code.endsWith('_email_failed')) {
    return 'created_email_failed'
  }
  if (code === 'already_linked') {
    return 'already_linked'
  }
  return 'invited'
}

export function formatInviteOfficeUserSuccessToast(
  kind: InviteOfficeUserSuccessKind,
): string {
  if (kind === 'created_email_failed') {
    return 'Office user was linked, but the invitation email could not be sent. Ask them to use Forgot password, or retry the invite.'
  }
  if (kind === 'already_linked') {
    return 'This Office user is already linked to your company.'
  }
  return 'Office user invited successfully.'
}

/** Safe user-facing messages for invite-office-user structured error codes. */
export function formatInviteOfficeUserUserMessage(
  code: string | null | undefined,
  fallbackMessage?: string | null,
): string {
  const normalized = (code ?? '').trim()
  switch (normalized) {
    case USER_ALREADY_LINKED_TO_ANOTHER_COMPANY:
      return 'This email already belongs to an active account in another company.'
    case 'duplicate_membership':
    case 'already_linked':
      return 'This Office user is already linked to your company.'
    case 'email_conflict':
      return 'This email is already used by a Worker or non-Office account in your company.'
    case 'forbidden':
      return 'Only Office roles can invite Office users.'
    case 'unauthenticated':
      return 'Your session has expired. Sign in again and try inviting the Office user.'
    case 'invalid_email':
      return 'Enter a valid Office user email address.'
    case 'invalid_role':
      return 'Select Admin, Manager, Office, or Supervisor.'
    case 'invalid_argument':
      return 'Check the Office user details and try again.'
    case 'invite_send_failed':
      return 'Unable to send the Office invitation email. Please try again.'
    case 'partial_link_failed':
      return 'The invitation could not be completed safely. Please try again.'
    case 'company_not_found':
      return 'Your company could not be found. Contact DREVORA support.'
    case 'server_misconfigured':
      return 'Office invitations are temporarily unavailable. Contact DREVORA support.'
    case 'server_failure':
    default: {
      const safe =
        typeof fallbackMessage === 'string' ? fallbackMessage.trim() : ''
      if (
        safe &&
        !safe.toLowerCase().includes('pgrst') &&
        !safe.toLowerCase().includes('sql') &&
        !safe.includes('{') &&
        safe.length < 180
      ) {
        return safe
      }
      return 'Unable to invite Office user right now. Please try again.'
    }
  }
}

export function formatOfficeUsersListError(
  codeOrMessage: string | null | undefined,
): string {
  const upper = (codeOrMessage ?? '').toUpperCase()
  if (upper.includes('UNAUTHENTICATED')) {
    return 'Your session has expired. Sign in again to view Office users.'
  }
  if (upper.includes('FORBIDDEN')) {
    return 'Only Office roles can view Office users.'
  }
  return 'Unable to load Office users right now. Please try again.'
}

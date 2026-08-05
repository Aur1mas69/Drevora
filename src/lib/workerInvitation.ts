/**
 * Shared Worker invitation contracts (Admin invite-worker Edge Function).
 * Keep in sync with supabase/functions/invite-worker and
 * migration 20260805210000_worker_invitation_foundation.sql.
 */

import {
  LOGIN_PATH,
  OFFICE_MEMBERSHIP_ROLES,
  WORKER_MEMBERSHIP_ROLE,
} from '@/lib/membershipRoles'

/** Canonical production app origin — never default to localhost. */
export const DREVORA_PRODUCTION_APP_ORIGIN = 'https://app.drevora.app'

/** Same path used by ForgotPasswordPage / ResetPasswordPage. */
export const WORKER_INVITE_PASSWORD_PATH = '/reset-password'

export const WORKER_INVITATION_MEMBERSHIP_ROLE = WORKER_MEMBERSHIP_ROLE

export const WORKER_INVITATION_OFFICE_ROLES = OFFICE_MEMBERSHIP_ROLES

/** Structured API / RPC code when the Auth user is active in another company. */
export const USER_ALREADY_LINKED_TO_ANOTHER_COMPANY =
  'USER_ALREADY_LINKED_TO_ANOTHER_COMPANY' as const

export const WORKER_OPERATIONAL_ROLES = [
  'Admin',
  'Driver',
  'Yardman',
  'Cleaner',
  'Supervisor',
  'Mechanic',
  'Transport Manager',
  'Planner',
  'Office Staff',
  'Warehouse',
  'Other',
] as const

export type WorkerOperationalRole = (typeof WORKER_OPERATIONAL_ROLES)[number]

export const WORKER_INVITATION_STATUSES = [
  'Working',
  'Off Duty',
  'Holiday',
  'Suspended',
] as const

export type WorkerInvitationStatus = (typeof WORKER_INVITATION_STATUSES)[number]

export const WORKER_INVITATION_ERROR_CODES = [
  'unauthenticated',
  'forbidden',
  'invalid_email',
  'invalid_argument',
  'invalid_role',
  'duplicate_worker',
  'duplicate_membership',
  USER_ALREADY_LINKED_TO_ANOTHER_COMPANY,
  'email_conflict',
  'plan_limit_reached',
  'plan_allowance_unavailable',
  'subscription_expired',
  'company_not_found',
  'server_misconfigured',
  'server_failure',
  'invite_send_failed',
  'partial_link_failed',
] as const

export type WorkerInvitationErrorCode =
  (typeof WORKER_INVITATION_ERROR_CODES)[number]

export type WorkerInvitationProfileInput = {
  email: string
  firstName: string
  lastName: string
  /** Operational role stored on public.drivers.role (not company_members.role). */
  operationalRole: WorkerOperationalRole | string
  status?: WorkerInvitationStatus | string
  phone?: string
  employmentType?: string
  paidHolidayEnabled?: boolean | null
  annualPaidHolidayDays?: string | number | null
  bankHolidayEntitlementDays?: string | number | null
  unpaidLeaveAllowed?: boolean | null
  holidayEntitlementNotes?: string
  licenceCategories?: string[]
  drivingLicenceExpiry?: string
  tachoCardNumber?: string
  cpcExpiry?: string
  driverCardExpiry?: string
  medicalExpiry?: string
  defaultVehicleId?: string
  startDate?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelationship?: string
  addressLine1?: string
  addressLine2?: string
  townCity?: string
  county?: string
  postcode?: string
  country?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeInvitationEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return null
  return email
}

export function isWorkerOperationalRole(
  value: string | null | undefined,
): value is WorkerOperationalRole {
  return (
    typeof value === 'string' &&
    (WORKER_OPERATIONAL_ROLES as readonly string[]).includes(value)
  )
}

export function isWorkerInvitationOfficeRole(
  value: string | null | undefined,
): boolean {
  return (
    typeof value === 'string' &&
    (WORKER_INVITATION_OFFICE_ROLES as readonly string[]).includes(value)
  )
}

/**
 * Resolve invite redirect origin.
 * Prefer explicit production env; never fall back to localhost.
 */
export function resolveWorkerInviteAppOrigin(
  envOrigin: string | null | undefined,
): string {
  const trimmed = envOrigin?.trim().replace(/\/$/, '') ?? ''
  if (trimmed) return trimmed
  return DREVORA_PRODUCTION_APP_ORIGIN
}

export function buildWorkerInviteRedirectTo(
  envOrigin: string | null | undefined,
): string {
  return `${resolveWorkerInviteAppOrigin(envOrigin)}${WORKER_INVITE_PASSWORD_PATH}`
}

export function validateWorkerInvitationProfile(
  input: WorkerInvitationProfileInput,
):
  | { ok: true; email: string; firstName: string; lastName: string; operationalRole: WorkerOperationalRole; status: WorkerInvitationStatus }
  | { ok: false; code: WorkerInvitationErrorCode; message: string } {
  const email = normalizeInvitationEmail(input.email)
  if (!email) {
    return {
      ok: false,
      code: 'invalid_email',
      message: 'Enter a valid Worker email address.',
    }
  }

  const firstName = input.firstName?.trim() ?? ''
  const lastName = input.lastName?.trim() ?? ''
  if (!firstName || !lastName) {
    return {
      ok: false,
      code: 'invalid_argument',
      message: 'First name and last name are required.',
    }
  }

  if (!isWorkerOperationalRole(input.operationalRole)) {
    return {
      ok: false,
      code: 'invalid_role',
      message: 'Select a valid Worker operational role.',
    }
  }

  const statusRaw = (input.status ?? 'Off Duty').toString().trim() || 'Off Duty'
  if (!(WORKER_INVITATION_STATUSES as readonly string[]).includes(statusRaw)) {
    return {
      ok: false,
      code: 'invalid_argument',
      message: 'Select a valid Worker status.',
    }
  }

  return {
    ok: true,
    email,
    firstName,
    lastName,
    operationalRole: input.operationalRole,
    status: statusRaw as WorkerInvitationStatus,
  }
}

/**
 * Classify an existing Auth user's active memberships relative to the invite target.
 * Used by Edge Function pre-check; RPC re-checks under advisory lock.
 */
export function classifyInvitedAuthMembership(input: {
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
 * auth.admin.generateLink() only resolves/generates link data.
 * It must never be treated as an email-sending operation.
 */
export function doesGenerateLinkSendEmail(): false {
  return false
}

export type InviteEmailDeliveryOutcome = {
  inviteSent: boolean
  emailDeliveryFailed: boolean
  linkingSucceeded: true
  code: string
  message: string
}

/**
 * Build response flags after membership/profile linking succeeded.
 * - New Auth user: inviteUserByEmail acceptance drives inviteSent.
 * - Existing Auth user: only resetPasswordForEmail acceptance drives inviteSent.
 * - generateLink never counts as email delivery.
 */
export function buildInviteEmailDeliveryOutcome(input: {
  alreadyExisted: boolean
  linkCode: string
  /** True only when inviteUserByEmail was accepted by Supabase. */
  inviteApiAccepted: boolean
  /**
   * For existing users: true/false after resetPasswordForEmail.
   * Null when recovery was not attempted (should not happen after successful link).
   */
  recoveryEmailAccepted: boolean | null
}): InviteEmailDeliveryOutcome {
  const baseCode =
    input.linkCode === 'already_linked' ? 'already_linked' : 'linked'

  if (!input.alreadyExisted) {
    return {
      inviteSent: input.inviteApiAccepted,
      emailDeliveryFailed: !input.inviteApiAccepted,
      linkingSucceeded: true,
      code: input.inviteApiAccepted ? baseCode : `${baseCode}_email_failed`,
      message: input.inviteApiAccepted
        ? 'Invitation sent. The Worker can set a password from the email link.'
        : 'Worker was linked, but the invitation email could not be confirmed as sent.',
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
        ? 'Worker is already linked for this company. A password reset email was sent.'
        : 'Worker linked. A password reset email was sent so they can set a password.'
      : 'Worker linking succeeded, but the password email could not be sent. Ask the Worker to use Forgot password, or retry the invite.',
  }
}

/** Documents RPC concurrency: advisory lock namespace used in SQL. */
export const WORKER_INVITE_AUTH_USER_LOCK_NAMESPACE = 872014551

export function describeWorkerInviteRpcConcurrencyGuard(): {
  lockKind: 'pg_advisory_xact_lock'
  namespace: number
  rejectsOtherCompanyCode: typeof USER_ALREADY_LINKED_TO_ANOTHER_COMPANY
} {
  return {
    lockKind: 'pg_advisory_xact_lock',
    namespace: WORKER_INVITE_AUTH_USER_LOCK_NAMESPACE,
    rejectsOtherCompanyCode: USER_ALREADY_LINKED_TO_ANOTHER_COMPANY,
  }
}

export type AuthCleanupSkipReason =
  | 'not_created_this_request'
  | 'linking_succeeded'
  | 'active_membership_present'
  | 'membership_present'
  | 'linked_profile_evidence'
  | 'membership_query_failed'
  | 'profile_query_failed'

export type AuthCleanupDecision =
  | { action: 'delete'; reason: 'safe_orphan_after_link_failure' }
  | { action: 'skip'; reason: AuthCleanupSkipReason }

/**
 * Decide whether a newly created Auth user may be deleted after RPC link failure.
 * Pure policy helper — Edge Function still performs the live queries/deletion.
 */
export function decideNewAuthUserCleanup(input: {
  createdAuthUserThisRequest: boolean
  linkingSucceeded: boolean
  membershipQueryOk: boolean
  /** Active memberships for the Auth user (any company). */
  activeMembershipCount: number | null
  /** Any membership rows including inactive. */
  anyMembershipCount: number | null
  profileQueryOk: boolean
  /**
   * True when evidence shows the Auth user is linked to a Worker profile
   * (membership present for a company that has an active drivers row for the invite email).
   */
  linkedProfileEvidence: boolean | null
}): AuthCleanupDecision {
  if (!input.createdAuthUserThisRequest) {
    return { action: 'skip', reason: 'not_created_this_request' }
  }
  if (input.linkingSucceeded) {
    return { action: 'skip', reason: 'linking_succeeded' }
  }
  if (!input.membershipQueryOk) {
    return { action: 'skip', reason: 'membership_query_failed' }
  }
  if (!input.profileQueryOk) {
    return { action: 'skip', reason: 'profile_query_failed' }
  }
  if ((input.activeMembershipCount ?? 0) > 0) {
    return { action: 'skip', reason: 'active_membership_present' }
  }
  if ((input.anyMembershipCount ?? 0) > 0) {
    return { action: 'skip', reason: 'membership_present' }
  }
  if (input.linkedProfileEvidence === true) {
    return { action: 'skip', reason: 'linked_profile_evidence' }
  }
  return { action: 'delete', reason: 'safe_orphan_after_link_failure' }
}

export type AuthCleanupMetadata = {
  authCleanupAttempted: boolean
  authCleanupSucceeded: boolean
  authCleanupSkipped: boolean
  authCleanupError: string | null
  authCleanupSkipReason: AuthCleanupSkipReason | null
}

export function buildAuthCleanupMetadata(input: {
  decision: AuthCleanupDecision
  deleteAttempted: boolean
  deleteSucceeded: boolean
  deleteNotFound: boolean
  deleteErrorMessage: string | null
}): AuthCleanupMetadata {
  if (input.decision.action === 'skip') {
    return {
      authCleanupAttempted: false,
      authCleanupSucceeded: false,
      authCleanupSkipped: true,
      authCleanupError: null,
      authCleanupSkipReason: input.decision.reason,
    }
  }

  if (!input.deleteAttempted) {
    return {
      authCleanupAttempted: false,
      authCleanupSucceeded: false,
      authCleanupSkipped: true,
      authCleanupError: null,
      authCleanupSkipReason: 'membership_query_failed',
    }
  }

  if (input.deleteSucceeded || input.deleteNotFound) {
    return {
      authCleanupAttempted: true,
      authCleanupSucceeded: true,
      authCleanupSkipped: false,
      authCleanupError: null,
      authCleanupSkipReason: null,
    }
  }

  return {
    authCleanupAttempted: true,
    authCleanupSucceeded: false,
    authCleanupSkipped: false,
    authCleanupError: sanitizeAuthCleanupError(input.deleteErrorMessage),
    authCleanupSkipReason: null,
  }
}

/** Strip secrets / overly specific internals from cleanup error text. */
export function sanitizeAuthCleanupError(
  message: string | null | undefined,
): string | null {
  if (!message) return 'Auth cleanup failed.'
  const trimmed = message.trim()
  if (!trimmed) return 'Auth cleanup failed.'
  const lower = trimmed.toLowerCase()
  if (
    lower.includes('service_role') ||
    lower.includes('apikey') ||
    lower.includes('bearer ') ||
    lower.includes('jwt')
  ) {
    return 'Auth cleanup failed.'
  }
  // Keep short, non-sensitive classification only.
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Auth cleanup failed due to a network error.'
  }
  if (lower.includes('not allowed') || lower.includes('forbidden')) {
    return 'Auth cleanup was not permitted.'
  }
  return 'Auth cleanup failed.'
}

export function isAuthDeleteNotFoundError(message: string | null | undefined): boolean {
  if (!message) return false
  const lower = message.toLowerCase()
  return (
    lower.includes('not found') ||
    lower.includes('user not found') ||
    lower.includes('does not exist')
  )
}

/** Map Postgres exception text from RPCs / triggers to structured codes. */
export function mapInviteDatabaseError(message: string): {
  code: WorkerInvitationErrorCode
  httpStatus: number
} {
  const upper = message.toUpperCase()
  if (upper.includes('SUBSCRIPTION_PLAN_EXPIRED')) {
    return { code: 'subscription_expired', httpStatus: 403 }
  }
  if (upper.includes('WORKER_PLAN_LIMIT_REACHED')) {
    return { code: 'plan_limit_reached', httpStatus: 403 }
  }
  if (upper.includes('WORKER_PLAN_ALLOWANCE_UNAVAILABLE')) {
    return { code: 'plan_allowance_unavailable', httpStatus: 403 }
  }
  if (upper.includes('INVITE_FORBIDDEN')) {
    return { code: 'forbidden', httpStatus: 403 }
  }
  if (upper.includes('INVITE_INVALID_EMAIL')) {
    return { code: 'invalid_email', httpStatus: 400 }
  }
  if (upper.includes('INVITE_INVALID_ROLE')) {
    return { code: 'invalid_role', httpStatus: 400 }
  }
  if (upper.includes('INVITE_DUPLICATE_WORKER')) {
    return { code: 'duplicate_worker', httpStatus: 409 }
  }
  if (
    upper.includes(USER_ALREADY_LINKED_TO_ANOTHER_COMPANY) ||
    upper.includes('INVITE_USER_HAS_OTHER_COMPANY')
  ) {
    return { code: USER_ALREADY_LINKED_TO_ANOTHER_COMPANY, httpStatus: 409 }
  }
  if (upper.includes('INVITE_EMAIL_CONFLICT')) {
    return { code: 'email_conflict', httpStatus: 409 }
  }
  if (upper.includes('INVITE_COMPANY_NOT_FOUND')) {
    return { code: 'company_not_found', httpStatus: 404 }
  }
  if (upper.includes('INVITE_PARTIAL_LINK_FAILED')) {
    return { code: 'partial_link_failed', httpStatus: 500 }
  }
  if (upper.includes('INVITE_INVALID_ARGUMENT')) {
    return { code: 'invalid_argument', httpStatus: 400 }
  }
  return { code: 'server_failure', httpStatus: 500 }
}

/** Login path after password set (documentation helper for future UI). */
export const WORKER_POST_INVITE_LOGIN_PATH = LOGIN_PATH

/** Form-shaped input used by Admin Add Worker → invite-worker. */
export type InviteWorkerFormFields = {
  email: string
  firstName: string
  lastName: string
  role: string
  status: string
  phone?: string
  employmentType?: string
  paidHolidayEnabled?: boolean | null | string
  annualPaidHolidayDays?: string | number | null
  bankHolidayEntitlementDays?: string | number | null
  unpaidLeaveAllowed?: boolean | string
  holidayEntitlementNotes?: string
  licenceCategories?: string[]
  drivingLicenceExpiry?: string
  tachoCardNumber?: string
  cpcExpiry?: string
  driverCardExpiry?: string
  medicalExpiry?: string
  defaultVehicleId?: string
  startDate?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelationship?: string
  addressLine1?: string
  addressLine2?: string
  townCity?: string
  county?: string
  postcode?: string
  country?: string
  /** Must never be sent to invite-worker. */
  companyId?: unknown
  company?: unknown
}

/**
 * Build the Edge Function body from the Add Worker form.
 * Never includes companyId (tenant comes from the caller's membership).
 */
export function buildInviteWorkerRequestBody(
  form: InviteWorkerFormFields,
): Record<string, unknown> {
  const email = normalizeInvitationEmail(form.email)
  if (!email) {
    throw new Error('Enter a valid Worker email address.')
  }

  const paidHoliday =
    typeof form.paidHolidayEnabled === 'boolean'
      ? form.paidHolidayEnabled
      : form.paidHolidayEnabled === 'true'
        ? true
        : form.paidHolidayEnabled === 'false'
          ? false
          : null

  const unpaidLeave =
    typeof form.unpaidLeaveAllowed === 'boolean'
      ? form.unpaidLeaveAllowed
      : form.unpaidLeaveAllowed === 'false'
        ? false
        : true

  const body: Record<string, unknown> = {
    email,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    operationalRole: form.role.trim(),
    status: (form.status?.trim() || 'Off Duty'),
    phone: form.phone?.trim() || '',
    employmentType: form.employmentType?.trim() || '',
    paidHolidayEnabled: paidHoliday,
    annualPaidHolidayDays: form.annualPaidHolidayDays ?? '',
    bankHolidayEntitlementDays: form.bankHolidayEntitlementDays ?? '',
    unpaidLeaveAllowed: unpaidLeave,
    holidayEntitlementNotes: form.holidayEntitlementNotes?.trim() || '',
    licenceCategories: Array.isArray(form.licenceCategories)
      ? form.licenceCategories
      : [],
    drivingLicenceExpiry: form.drivingLicenceExpiry?.trim() || '',
    tachoCardNumber: form.tachoCardNumber?.trim() || '',
    cpcExpiry: form.cpcExpiry?.trim() || '',
    driverCardExpiry: form.driverCardExpiry?.trim() || '',
    medicalExpiry: form.medicalExpiry?.trim() || '',
    defaultVehicleId: form.defaultVehicleId?.trim() || '',
    startDate: form.startDate?.trim() || '',
    emergencyContactName: form.emergencyContactName?.trim() || '',
    emergencyContactPhone: form.emergencyContactPhone?.trim() || '',
    emergencyContactRelationship:
      form.emergencyContactRelationship?.trim() || '',
    addressLine1: form.addressLine1?.trim() || '',
    addressLine2: form.addressLine2?.trim() || '',
    townCity: form.townCity?.trim() || '',
    county: form.county?.trim() || '',
    postcode: form.postcode?.trim() || '',
    country: form.country?.trim() || 'United Kingdom',
  }

  // Explicitly never forward tenant keys from the browser.
  delete body.companyId
  delete body.company_id
  delete body.company

  return body
}

export function inviteWorkerRequestContainsCompanyId(
  body: Record<string, unknown>,
): boolean {
  return (
    Object.prototype.hasOwnProperty.call(body, 'companyId') ||
    Object.prototype.hasOwnProperty.call(body, 'company_id')
  )
}

export type InviteWorkerSuccessKind =
  | 'invited'
  | 'already_linked'
  | 'created_email_failed'

export function classifyInviteWorkerSuccess(input: {
  code: string
  inviteSent: boolean
  emailDeliveryFailed: boolean
}): InviteWorkerSuccessKind {
  const code = input.code.toLowerCase()
  if (input.emailDeliveryFailed || code.endsWith('_email_failed')) {
    return 'created_email_failed'
  }
  if (code === 'already_linked') {
    return 'already_linked'
  }
  return 'invited'
}

export function formatInviteWorkerSuccessToast(
  kind: InviteWorkerSuccessKind,
  workerCode: string | null,
): string {
  const idSuffix = workerCode?.trim()
    ? ` Worker ID: ${workerCode.trim()}.`
    : ''

  if (kind === 'created_email_failed') {
    return `Worker was added, but the invitation email could not be sent.${idSuffix} Ask them to use Forgot password, or retry the invite.`
  }
  if (kind === 'already_linked') {
    return `This Worker is already linked to your company.${idSuffix}`
  }
  return `Worker added and invitation sent.${idSuffix}`
}

/**
 * After invite succeeded, optional avatar upload failed.
 * Treat as created-with-warning — never as a failed invitation.
 */
export function formatInviteWorkerAvatarFailureToast(
  kind: InviteWorkerSuccessKind,
): string {
  if (kind === 'created_email_failed') {
    return 'Worker was added, but the invitation email could not be sent and the profile photo could not be uploaded.'
  }
  if (kind === 'already_linked') {
    return 'Worker is already linked, but the profile photo could not be uploaded.'
  }
  return 'Worker was added and invited, but the profile photo could not be uploaded.'
}

/** User-facing messages for invite-worker structured error codes. */
export function formatInviteWorkerUserMessage(
  code: string | null | undefined,
  fallbackMessage?: string | null,
): string {
  const normalized = (code ?? '').trim()
  switch (normalized) {
    case USER_ALREADY_LINKED_TO_ANOTHER_COMPANY:
      return 'This email already belongs to an active account in another company.'
    case 'plan_limit_reached':
    case 'WORKER_PLAN_LIMIT_REACHED':
      return 'Worker allowance reached. Archive an inactive Worker or change the company plan to add another Worker.'
    case 'plan_allowance_unavailable':
    case 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE':
      return 'Worker allowance unavailable. Assign a valid company plan before adding Workers.'
    case 'subscription_expired':
    case 'SUBSCRIPTION_PLAN_EXPIRED':
      return 'Your trial has expired. Existing records remain available. Contact DREVORA to renew your plan.'
    case 'duplicate_worker':
      return 'An active Worker with this email already exists in your company.'
    case 'email_conflict':
      return 'This email is already used by a non-Worker account in your company.'
    case 'forbidden':
      return 'Only Office roles can invite Workers.'
    case 'unauthenticated':
      return 'Your session has expired. Sign in again and try inviting the Worker.'
    case 'invalid_email':
      return 'Enter a valid Worker email address.'
    case 'invalid_role':
      return 'Select a valid Worker operational role.'
    case 'invalid_argument':
      return 'Check the Worker details and try again.'
    case 'invite_send_failed':
      return 'Unable to send the Worker invitation email. Please try again.'
    case 'partial_link_failed':
      return 'The invitation could not be completed safely. Please try again.'
    case 'company_not_found':
      return 'Your company could not be found. Contact DREVORA support.'
    case 'server_misconfigured':
    case 'server_failure':
      return 'Unable to invite Worker right now. Please try again.'
    default:
      break
  }

  const safeFallback = fallbackMessage?.trim()
  if (
    safeFallback &&
    !/sql|stack|exception|supabase|postgres|pgrst|jwt|service.?role/i.test(
      safeFallback,
    )
  ) {
    return safeFallback
  }

  return 'Unable to invite Worker right now. Please try again.'
}

type FunctionsInvokeErrorLike = {
  message?: string
  context?: unknown
  name?: string
}

export type ParsedFunctionsErrorBody = {
  code: string
  message: string | null
  /** True when a structured JSON body with a code was recovered. */
  structured: boolean
  /** True when the response body was read (at most once by the parser). */
  bodyConsumed: boolean
}

function mapInvokeFailureCode(raw: string | null | undefined): string {
  const code = (raw ?? '').trim()
  if (!code) return 'server_failure'
  if (code === USER_ALREADY_LINKED_TO_ANOTHER_COMPANY) return code
  if (code === 'WORKER_PLAN_LIMIT_REACHED') return 'plan_limit_reached'
  if (code === 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE') {
    return 'plan_allowance_unavailable'
  }
  if (code === 'SUBSCRIPTION_PLAN_EXPIRED') return 'subscription_expired'
  return code
}

function looksLikeHtml(text: string): boolean {
  const sample = text.slice(0, 200).toLowerCase()
  return (
    sample.includes('<!doctype') ||
    sample.includes('<html') ||
    sample.includes('<body')
  )
}

function asParsedNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Read a Functions invoke error response body at most once.
 * Prefers JSON `{ code, message }`; never returns raw HTML/SQL/tokens.
 */
export async function parseFunctionsInvokeErrorBody(input: {
  error: FunctionsInvokeErrorLike | null | undefined
  /** Sometimes Supabase still populates data on non-2xx. */
  data?: unknown
}): Promise<ParsedFunctionsErrorBody> {
  if (
    input.data &&
    typeof input.data === 'object' &&
    !Array.isArray(input.data)
  ) {
    const record = input.data as Record<string, unknown>
    const code = asParsedNonEmptyString(record.code)
    if (code) {
      return {
        code: mapInvokeFailureCode(code),
        message: asParsedNonEmptyString(record.message),
        structured: true,
        bodyConsumed: false,
      }
    }
  }

  const context = input.error?.context
  if (!context || typeof context !== 'object') {
    return {
      code: 'server_failure',
      message: null,
      structured: false,
      bodyConsumed: false,
    }
  }

  const responseLike = context as {
    json?: () => Promise<unknown>
    text?: () => Promise<string>
    clone?: () => { text: () => Promise<string> }
    bodyUsed?: boolean
  }

  if (responseLike.bodyUsed === true) {
    return {
      code: 'server_failure',
      message: null,
      structured: false,
      bodyConsumed: true,
    }
  }

  let rawText: string | null = null
  let bodyConsumed = false

  try {
    if (typeof responseLike.text === 'function') {
      rawText = await responseLike.text()
      bodyConsumed = true
    } else if (typeof responseLike.clone === 'function') {
      const cloned = responseLike.clone()
      if (typeof cloned.text === 'function') {
        rawText = await cloned.text()
        bodyConsumed = true
      }
    } else if (typeof responseLike.json === 'function') {
      const parsed = await responseLike.json()
      bodyConsumed = true
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>
        const code = asParsedNonEmptyString(record.code)
        if (code) {
          return {
            code: mapInvokeFailureCode(code),
            message: asParsedNonEmptyString(record.message),
            structured: true,
            bodyConsumed: true,
          }
        }
      }
      return {
        code: 'server_failure',
        message: null,
        structured: false,
        bodyConsumed: true,
      }
    }
  } catch {
    return {
      code: 'server_failure',
      message: null,
      structured: false,
      bodyConsumed,
    }
  }

  if (rawText == null || !rawText.trim()) {
    return {
      code: 'server_failure',
      message: null,
      structured: false,
      bodyConsumed,
    }
  }

  if (looksLikeHtml(rawText)) {
    return {
      code: 'server_failure',
      message: null,
      structured: false,
      bodyConsumed,
    }
  }

  try {
    const parsed: unknown = JSON.parse(rawText)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>
      const code = asParsedNonEmptyString(record.code)
      if (code) {
        return {
          code: mapInvokeFailureCode(code),
          message: asParsedNonEmptyString(record.message),
          structured: true,
          bodyConsumed,
        }
      }
    }
  } catch {
    // Non-JSON — generic fallback.
  }

  return {
    code: 'server_failure',
    message: null,
    structured: false,
    bodyConsumed,
  }
}

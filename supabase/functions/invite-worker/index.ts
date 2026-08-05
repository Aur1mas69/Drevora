/**
 * DREVORA Edge Function: invite-worker
 *
 * Office Admin flow: invite a Worker Auth user, create Driver membership,
 * and create/link the public.drivers profile in the caller's company.
 *
 * - Requires authenticated Office JWT (Admin / Transport Manager / Supervisor /
 *   Planner / Office Staff).
 * - Never trusts a browser-supplied company ID.
 * - Uses service role only inside this function (Auth Admin + RPCs).
 * - Invite redirect uses production app origin + /reset-password (same as
 *   password recovery). Does not hardcode localhost as the default origin.
 *
 * Deploy later:
 *   supabase functions deploy invite-worker
 *
 * Required migration (apply manually first):
 *   20260805210000_worker_invitation_foundation.sql
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.108.2'

const WORKER_MEMBERSHIP_ROLE = 'Driver'
const OFFICE_ROLES = new Set([
  'Admin',
  'Transport Manager',
  'Supervisor',
  'Planner',
  'Office Staff',
])

const OPERATIONAL_ROLES = new Set([
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
])

const WORKER_STATUSES = new Set([
  'Working',
  'Off Duty',
  'Holiday',
  'Suspended',
])

const PRODUCTION_APP_ORIGIN = 'https://app.drevora.app'
const PASSWORD_PATH = '/reset-password'

const ALLOWED_CORS_ORIGINS = new Set([
  'http://localhost:5173',
  'https://app.drevora.app',
  'capacitor://localhost',
  'http://localhost',
])

const CORS_ALLOW_HEADERS =
  'authorization, x-client-info, apikey, content-type'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type JsonResponseBody = Record<string, unknown>

type MembershipRow = {
  id: string
  user_id: string
  company_id: string
  role: string
  is_active: boolean
}

type InviteBody = {
  email?: unknown
  firstName?: unknown
  lastName?: unknown
  operationalRole?: unknown
  status?: unknown
  phone?: unknown
  employmentType?: unknown
  paidHolidayEnabled?: unknown
  annualPaidHolidayDays?: unknown
  bankHolidayEntitlementDays?: unknown
  unpaidLeaveAllowed?: unknown
  holidayEntitlementNotes?: unknown
  licenceCategories?: unknown
  drivingLicenceExpiry?: unknown
  tachoCardNumber?: unknown
  cpcExpiry?: unknown
  driverCardExpiry?: unknown
  medicalExpiry?: unknown
  defaultVehicleId?: unknown
  startDate?: unknown
  emergencyContactName?: unknown
  emergencyContactPhone?: unknown
  emergencyContactRelationship?: unknown
  addressLine1?: unknown
  addressLine2?: unknown
  townCity?: unknown
  county?: unknown
  postcode?: unknown
  country?: unknown
  /** Ignored if present — company always comes from caller membership. */
  companyId?: unknown
}

function corsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  const origin = req.headers.get('Origin')
  if (origin && ALLOWED_CORS_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function optionsResponse(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req),
  })
}

function jsonResponse(
  req: Request,
  status: number,
  body: JsonResponseBody,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(req),
    },
  })
}

function trimEnv(name: string): string | null {
  const value = Deno.env.get(name)
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function logSafe(fields: Record<string, unknown>): void {
  console.error(JSON.stringify(fields))
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim())
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function resolvePrivilegedSupabaseKey(): string | null {
  const serviceRoleKey = trimEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (serviceRoleKey) return serviceRoleKey

  const rawSecretKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (rawSecretKeys == null || rawSecretKeys.trim() === '') return null

  try {
    const parsed: unknown = JSON.parse(rawSecretKeys)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    const defaultKey = (parsed as Record<string, unknown>).default
    if (typeof defaultKey !== 'string') return null
    const trimmed = defaultKey.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

function createAdminClient(privilegedKey: string): SupabaseClient {
  const supabaseUrl = trimEnv('SUPABASE_URL')
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL missing')
  }
  return createClient(supabaseUrl, privilegedKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

function resolveAppOrigin(): string {
  const fromEnv =
    trimEnv('DREVORA_APP_ORIGIN') ??
    trimEnv('APP_ORIGIN') ??
    trimEnv('SITE_URL')
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '')
  }
  return PRODUCTION_APP_ORIGIN
}

function buildRedirectTo(): string {
  return `${resolveAppOrigin()}${PASSWORD_PATH}`
}

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return null
  return email
}

function mapDbError(message: string): { code: string; httpStatus: number; message: string } {
  const upper = message.toUpperCase()
  if (upper.includes('SUBSCRIPTION_PLAN_EXPIRED')) {
    return {
      code: 'subscription_expired',
      httpStatus: 403,
      message:
        'Your trial has expired. Existing records remain available. Contact DREVORA to renew your plan.',
    }
  }
  if (upper.includes('WORKER_PLAN_LIMIT_REACHED')) {
    return {
      code: 'plan_limit_reached',
      httpStatus: 403,
      message:
        'Worker allowance reached. Archive an inactive Worker or change the company plan to add another Worker.',
    }
  }
  if (upper.includes('WORKER_PLAN_ALLOWANCE_UNAVAILABLE')) {
    return {
      code: 'plan_allowance_unavailable',
      httpStatus: 403,
      message:
        'Worker allowance unavailable. Assign a valid company plan before adding Workers.',
    }
  }
  if (upper.includes('INVITE_FORBIDDEN')) {
    return {
      code: 'forbidden',
      httpStatus: 403,
      message: 'Only Office roles can invite Workers.',
    }
  }
  if (upper.includes('INVITE_INVALID_EMAIL')) {
    return {
      code: 'invalid_email',
      httpStatus: 400,
      message: 'Enter a valid Worker email address.',
    }
  }
  if (upper.includes('INVITE_INVALID_ROLE')) {
    return {
      code: 'invalid_role',
      httpStatus: 400,
      message: 'Select a valid Worker operational role.',
    }
  }
  if (upper.includes('INVITE_DUPLICATE_WORKER')) {
    return {
      code: 'duplicate_worker',
      httpStatus: 409,
      message: 'An active Worker with this email already exists in your company.',
    }
  }
  if (
    upper.includes('USER_ALREADY_LINKED_TO_ANOTHER_COMPANY') ||
    upper.includes('INVITE_USER_HAS_OTHER_COMPANY')
  ) {
    return {
      code: 'USER_ALREADY_LINKED_TO_ANOTHER_COMPANY',
      httpStatus: 409,
      message:
        'This email already belongs to an active membership in another company.',
    }
  }
  if (upper.includes('INVITE_EMAIL_CONFLICT')) {
    return {
      code: 'email_conflict',
      httpStatus: 409,
      message: 'This account already has a non-Worker membership in your company.',
    }
  }
  if (upper.includes('INVITE_COMPANY_NOT_FOUND')) {
    return {
      code: 'company_not_found',
      httpStatus: 404,
      message: 'Company could not be found.',
    }
  }
  if (upper.includes('INVITE_PARTIAL_LINK_FAILED')) {
    return {
      code: 'partial_link_failed',
      httpStatus: 500,
      message: 'Invitation could not be completed safely. Retry the invite.',
    }
  }
  if (upper.includes('INVITE_INVALID_ARGUMENT')) {
    return {
      code: 'invalid_argument',
      httpStatus: 400,
      message: 'Invitation details are incomplete or invalid.',
    }
  }
  return {
    code: 'server_failure',
    httpStatus: 500,
    message: 'Unable to invite Worker right now.',
  }
}

function buildProfileJson(body: InviteBody, validated: {
  email: string
  firstName: string
  lastName: string
  operationalRole: string
  status: string
}): Record<string, unknown> {
  const licenceCategories = Array.isArray(body.licenceCategories)
    ? body.licenceCategories.filter((v): v is string => typeof v === 'string')
    : []

  return {
    first_name: validated.firstName,
    last_name: validated.lastName,
    operational_role: validated.operationalRole,
    status: validated.status,
    phone: asTrimmedString(body.phone),
    employment_type: asTrimmedString(body.employmentType),
    paid_holiday_enabled:
      typeof body.paidHolidayEnabled === 'boolean'
        ? body.paidHolidayEnabled
        : null,
    annual_paid_holiday_days:
      body.annualPaidHolidayDays == null || body.annualPaidHolidayDays === ''
        ? null
        : String(body.annualPaidHolidayDays),
    bank_holiday_entitlement_days:
      body.bankHolidayEntitlementDays == null ||
        body.bankHolidayEntitlementDays === ''
        ? null
        : String(body.bankHolidayEntitlementDays),
    unpaid_leave_allowed:
      typeof body.unpaidLeaveAllowed === 'boolean'
        ? body.unpaidLeaveAllowed
        : true,
    holiday_entitlement_notes: asTrimmedString(body.holidayEntitlementNotes),
    licence_categories: licenceCategories,
    driving_licence_expiry: asTrimmedString(body.drivingLicenceExpiry),
    tacho_card_number: asTrimmedString(body.tachoCardNumber),
    cpc_expiry: asTrimmedString(body.cpcExpiry),
    driver_card_expiry: asTrimmedString(body.driverCardExpiry),
    medical_expiry: asTrimmedString(body.medicalExpiry),
    default_vehicle_id: asTrimmedString(body.defaultVehicleId),
    start_date: asTrimmedString(body.startDate),
    emergency_contact_name: asTrimmedString(body.emergencyContactName),
    emergency_contact_phone: asTrimmedString(body.emergencyContactPhone),
    emergency_contact_relationship: asTrimmedString(
      body.emergencyContactRelationship,
    ),
    address_line_1: asTrimmedString(body.addressLine1),
    address_line_2: asTrimmedString(body.addressLine2),
    town_city: asTrimmedString(body.townCity),
    county: asTrimmedString(body.county),
    postcode: asTrimmedString(body.postcode),
    country: asTrimmedString(body.country) ?? 'United Kingdom',
  }
}

function isAlreadyRegisteredError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('already been registered') ||
    lower.includes('already registered') ||
    lower.includes('user already exists') ||
    lower.includes('email_exists') ||
    (lower.includes('duplicate') && lower.includes('email'))
  )
}

const USER_ALREADY_LINKED_TO_ANOTHER_COMPANY =
  'USER_ALREADY_LINKED_TO_ANOTHER_COMPANY'

/**
 * Resolve an existing Auth user id via generateLink.
 * generateLink never sends email and must never set inviteSent.
 */
async function resolveExistingAuthUserId(
  admin: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<string> {
  const link = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  })

  if (!link.error && link.data.user?.id) {
    return link.data.user.id
  }

  const recovery = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  if (!recovery.error && recovery.data.user?.id) {
    return recovery.data.user.id
  }

  throw Object.assign(
    new Error(
      link.error?.message ??
        recovery.error?.message ??
        'Unable to resolve existing Auth user',
    ),
    { code: 'invite_send_failed' },
  )
}

async function sendPasswordRecoveryEmail(input: {
  supabaseUrl: string
  anonKey: string
  email: string
  redirectTo: string
}): Promise<boolean> {
  const anonClient = createClient(input.supabaseUrl, input.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { error } = await anonClient.auth.resetPasswordForEmail(input.email, {
    redirectTo: input.redirectTo,
  })

  return !error
}

function classifyMembership(
  targetCompanyId: string,
  rows: MembershipRow[],
): 'none' | 'same_company' | 'other_company' {
  const active = rows.filter((row) => row.is_active)
  if (active.some((row) => row.company_id !== targetCompanyId)) {
    return 'other_company'
  }
  if (active.some((row) => row.company_id === targetCompanyId)) {
    return 'same_company'
  }
  return 'none'
}

function buildEmailDeliveryOutcome(input: {
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

type AuthCleanupSkipReason =
  | 'not_created_this_request'
  | 'linking_succeeded'
  | 'active_membership_present'
  | 'membership_present'
  | 'linked_profile_evidence'
  | 'membership_query_failed'
  | 'profile_query_failed'

type AuthCleanupMetadata = {
  authCleanupAttempted: boolean
  authCleanupSucceeded: boolean
  authCleanupSkipped: boolean
  authCleanupError: string | null
  authCleanupSkipReason: AuthCleanupSkipReason | null
}

function sanitizeAuthCleanupError(message: string | null | undefined): string {
  if (!message?.trim()) return 'Auth cleanup failed.'
  const lower = message.toLowerCase()
  if (
    lower.includes('service_role') ||
    lower.includes('apikey') ||
    lower.includes('bearer ') ||
    lower.includes('jwt')
  ) {
    return 'Auth cleanup failed.'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Auth cleanup failed due to a network error.'
  }
  if (lower.includes('not allowed') || lower.includes('forbidden')) {
    return 'Auth cleanup was not permitted.'
  }
  return 'Auth cleanup failed.'
}

function isAuthDeleteNotFoundError(message: string | null | undefined): boolean {
  if (!message) return false
  const lower = message.toLowerCase()
  return (
    lower.includes('not found') ||
    lower.includes('user not found') ||
    lower.includes('does not exist')
  )
}

function decideNewAuthUserCleanup(input: {
  createdAuthUserThisRequest: boolean
  membershipQueryOk: boolean
  activeMembershipCount: number | null
  anyMembershipCount: number | null
  profileQueryOk: boolean
  linkedProfileEvidence: boolean | null
}): { action: 'delete' | 'skip'; reason: AuthCleanupSkipReason | 'safe_orphan_after_link_failure' } {
  if (!input.createdAuthUserThisRequest) {
    return { action: 'skip', reason: 'not_created_this_request' }
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

/**
 * Best-effort delete of an Auth user created by this request after RPC link failure.
 * Never deletes pre-existing users or users that appear linked.
 */
async function cleanupAuthUserCreatedThisRequest(input: {
  admin: SupabaseClient
  authUserId: string
  email: string
  createdAuthUserThisRequest: boolean
}): Promise<AuthCleanupMetadata> {
  if (!input.createdAuthUserThisRequest) {
    return {
      authCleanupAttempted: false,
      authCleanupSucceeded: false,
      authCleanupSkipped: true,
      authCleanupError: null,
      authCleanupSkipReason: 'not_created_this_request',
    }
  }

  // Re-check after RPC failure (concurrent linker race).
  const membershipsResult = await input.admin
    .from('company_members')
    .select('id, company_id, is_active')
    .eq('user_id', input.authUserId)

  if (membershipsResult.error) {
    logSafe({
      event: 'invite_worker_auth_cleanup_membership_query_failed',
      authUserId: input.authUserId,
    })
    return {
      authCleanupAttempted: false,
      authCleanupSucceeded: false,
      authCleanupSkipped: true,
      authCleanupError: null,
      authCleanupSkipReason: 'membership_query_failed',
    }
  }

  const membershipRows = membershipsResult.data ?? []
  const activeMembershipCount = membershipRows.filter((row) => row.is_active).length
  const anyMembershipCount = membershipRows.length
  const membershipCompanyIds = [
    ...new Set(
      membershipRows
        .map((row) => row.company_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ]

  // drivers has no auth_user_id FK; authoritative link evidence is membership +
  // active profile email match in the same company.
  const profilesResult = await input.admin
    .from('drivers')
    .select('id, company_id, email, archived_at')
    .ilike('email', input.email)
    .is('archived_at', null)

  if (profilesResult.error) {
    logSafe({
      event: 'invite_worker_auth_cleanup_profile_query_failed',
      authUserId: input.authUserId,
    })
    return {
      authCleanupAttempted: false,
      authCleanupSucceeded: false,
      authCleanupSkipped: true,
      authCleanupError: null,
      authCleanupSkipReason: 'profile_query_failed',
    }
  }

  const activeProfiles = profilesResult.data ?? []
  const linkedProfileEvidence = activeProfiles.some(
    (profile) =>
      typeof profile.company_id === 'string' &&
      membershipCompanyIds.includes(profile.company_id),
  )

  const decision = decideNewAuthUserCleanup({
    createdAuthUserThisRequest: true,
    membershipQueryOk: true,
    activeMembershipCount,
    anyMembershipCount,
    profileQueryOk: true,
    linkedProfileEvidence,
  })

  if (decision.action === 'skip') {
    logSafe({
      event: 'invite_worker_auth_cleanup_skipped',
      authUserId: input.authUserId,
      reason: decision.reason,
    })
    return {
      authCleanupAttempted: false,
      authCleanupSucceeded: false,
      authCleanupSkipped: true,
      authCleanupError: null,
      authCleanupSkipReason: decision.reason as AuthCleanupSkipReason,
    }
  }

  const { error: deleteError } = await input.admin.auth.admin.deleteUser(
    input.authUserId,
  )

  if (!deleteError) {
    logSafe({
      event: 'invite_worker_auth_cleanup_deleted',
      authUserId: input.authUserId,
    })
    return {
      authCleanupAttempted: true,
      authCleanupSucceeded: true,
      authCleanupSkipped: false,
      authCleanupError: null,
      authCleanupSkipReason: null,
    }
  }

  if (isAuthDeleteNotFoundError(deleteError.message)) {
    logSafe({
      event: 'invite_worker_auth_cleanup_already_absent',
      authUserId: input.authUserId,
    })
    return {
      authCleanupAttempted: true,
      authCleanupSucceeded: true,
      authCleanupSkipped: false,
      authCleanupError: null,
      authCleanupSkipReason: null,
    }
  }

  logSafe({
    event: 'invite_worker_auth_cleanup_delete_failed',
    authUserId: input.authUserId,
    message: deleteError.message,
  })

  return {
    authCleanupAttempted: true,
    authCleanupSucceeded: false,
    authCleanupSkipped: false,
    authCleanupError: sanitizeAuthCleanupError(deleteError.message),
    authCleanupSkipReason: null,
  }
}

async function handleInvite(req: Request): Promise<Response> {
  const token = bearerToken(req)
  if (!token) {
    return jsonResponse(req, 401, {
      ok: false,
      code: 'unauthenticated',
      message: 'Sign in required.',
    })
  }

  const supabaseUrl = trimEnv('SUPABASE_URL')
  const anonKey = trimEnv('SUPABASE_ANON_KEY')
  const privilegedKey = resolvePrivilegedSupabaseKey()
  if (!supabaseUrl || !anonKey || !privilegedKey) {
    logSafe({ event: 'invite_worker_misconfigured' })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_misconfigured',
      message: 'Worker invitations are temporarily unavailable.',
    })
  }

  let body: InviteBody
  try {
    body = (await req.json()) as InviteBody
  } catch {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'invalid_argument',
      message: 'Request body must be JSON.',
    })
  }

  if (body.companyId != null) {
    logSafe({ event: 'invite_worker_ignored_client_company_id' })
  }

  const email = normalizeEmail(body.email)
  if (!email) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'invalid_email',
      message: 'Enter a valid Worker email address.',
    })
  }

  const firstName = asTrimmedString(body.firstName)
  const lastName = asTrimmedString(body.lastName)
  if (!firstName || !lastName) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'invalid_argument',
      message: 'First name and last name are required.',
    })
  }

  const operationalRole = asTrimmedString(body.operationalRole)
  if (!operationalRole || !OPERATIONAL_ROLES.has(operationalRole)) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'invalid_role',
      message: 'Select a valid Worker operational role.',
    })
  }

  const status = asTrimmedString(body.status) ?? 'Off Duty'
  if (!WORKER_STATUSES.has(status)) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'invalid_argument',
      message: 'Select a valid Worker status.',
    })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user || !isUuid(user.id)) {
    return jsonResponse(req, 401, {
      ok: false,
      code: 'unauthenticated',
      message: 'Sign in required.',
    })
  }

  const admin = createAdminClient(privilegedKey)

  const membershipsResult = await admin
    .from('company_members')
    .select('id, user_id, company_id, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (membershipsResult.error) {
    logSafe({
      event: 'invite_worker_membership_lookup_failed',
      authUserId: user.id,
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to resolve your company membership.',
    })
  }

  const memberships = (membershipsResult.data ?? []) as MembershipRow[]
  if (memberships.length === 0) {
    return jsonResponse(req, 403, {
      ok: false,
      code: 'forbidden',
      message: 'Your account is not linked to an active company.',
    })
  }

  if (memberships.length > 1) {
    return jsonResponse(req, 403, {
      ok: false,
      code: 'forbidden',
      message:
        'Multiple company memberships found. Resolve membership before inviting Workers.',
    })
  }

  const membership = memberships[0]
  if (!OFFICE_ROLES.has(membership.role)) {
    return jsonResponse(req, 403, {
      ok: false,
      code: 'forbidden',
      message: 'Only Office roles can invite Workers.',
    })
  }

  const companyId = membership.company_id

  const assertResult = await admin.rpc('drevora_assert_company_can_add_worker', {
    p_company_id: companyId,
  })
  if (assertResult.error) {
    const mapped = mapDbError(assertResult.error.message ?? '')
    const existingProfile = await admin
      .from('drivers')
      .select('id')
      .eq('company_id', companyId)
      .is('archived_at', null)
      .ilike('email', email)
      .maybeSingle()

    const canSkipSeatCheck =
      !existingProfile.error &&
      existingProfile.data?.id &&
      (mapped.code === 'plan_limit_reached' ||
        mapped.code === 'plan_allowance_unavailable' ||
        mapped.code === 'subscription_expired')

    if (!canSkipSeatCheck) {
      return jsonResponse(req, mapped.httpStatus, {
        ok: false,
        code: mapped.code,
        message: mapped.message,
      })
    }
  }

  const redirectTo = buildRedirectTo()
  let authUserId: string
  let alreadyExisted = false
  let inviteApiAccepted = false
  /** True only when inviteUserByEmail created a new Auth user in this request. */
  let createdAuthUserThisRequest = false

  const invite = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      drevora_invite: true,
      invited_as: WORKER_MEMBERSHIP_ROLE,
    },
  })

  if (!invite.error && invite.data.user?.id) {
    authUserId = invite.data.user.id
    alreadyExisted = false
    inviteApiAccepted = true
    createdAuthUserThisRequest = true
  } else {
    const inviteMessage = invite.error?.message ?? 'invite failed'
    if (!isAlreadyRegisteredError(inviteMessage)) {
      logSafe({
        event: 'invite_worker_auth_invite_failed',
        companyId,
        message: inviteMessage,
      })
      return jsonResponse(req, 500, {
        ok: false,
        code: 'invite_send_failed',
        message: 'Unable to send the Worker invitation email.',
      })
    }

    try {
      // Lookup only — generateLink does not send email and never creates Auth users here.
      authUserId = await resolveExistingAuthUserId(admin, email, redirectTo)
      alreadyExisted = true
      inviteApiAccepted = false
      createdAuthUserThisRequest = false
    } catch (error) {
      const message = error instanceof Error ? error.message : 'lookup failed'
      logSafe({
        event: 'invite_worker_existing_user_lookup_failed',
        companyId,
        message,
      })
      return jsonResponse(req, 500, {
        ok: false,
        code: 'invite_send_failed',
        message: 'Unable to resolve the existing Auth user for this email.',
      })
    }

    const invitedMembershipsResult = await admin
      .from('company_members')
      .select('id, user_id, company_id, role, is_active')
      .eq('user_id', authUserId)
      .eq('is_active', true)

    if (invitedMembershipsResult.error) {
      logSafe({
        event: 'invite_worker_target_membership_lookup_failed',
        authUserId,
      })
      return jsonResponse(req, 500, {
        ok: false,
        code: 'server_failure',
        message: 'Unable to check existing memberships for this email.',
      })
    }

    const invitedMemberships =
      (invitedMembershipsResult.data ?? []) as MembershipRow[]
    const membershipClass = classifyMembership(companyId, invitedMemberships)

    if (membershipClass === 'other_company') {
      return jsonResponse(req, 409, {
        ok: false,
        code: USER_ALREADY_LINKED_TO_ANOTHER_COMPANY,
        message:
          'This email already belongs to an active membership in another company.',
      })
    }
  }

  const profile = buildProfileJson(body, {
    email,
    firstName,
    lastName,
    operationalRole,
    status,
  })

  const linkResult = await admin.rpc('drevora_link_invited_worker', {
    p_actor_user_id: user.id,
    p_company_id: companyId,
    p_auth_user_id: authUserId,
    p_email: email,
    p_profile: profile,
  })

  if (linkResult.error) {
    const mapped = mapDbError(linkResult.error.message ?? '')
    logSafe({
      event: 'invite_worker_link_failed',
      companyId,
      authUserId,
      code: mapped.code,
      message: linkResult.error.message,
    })

    const cleanup = await cleanupAuthUserCreatedThisRequest({
      admin,
      authUserId,
      email,
      createdAuthUserThisRequest,
    })

    return jsonResponse(req, mapped.httpStatus, {
      ok: false,
      code: mapped.code,
      message: mapped.message,
      authCleanupAttempted: cleanup.authCleanupAttempted,
      authCleanupSucceeded: cleanup.authCleanupSucceeded,
      authCleanupSkipped: cleanup.authCleanupSkipped,
      authCleanupError: cleanup.authCleanupError,
      authCleanupSkipReason: cleanup.authCleanupSkipReason,
    })
  }

  const linked = (linkResult.data ?? {}) as Record<string, unknown>
  const linkCode =
    typeof linked.code === 'string' ? linked.code : 'linked'

  let recoveryEmailAccepted: boolean | null = null
  if (alreadyExisted) {
    recoveryEmailAccepted = await sendPasswordRecoveryEmail({
      supabaseUrl,
      anonKey,
      email,
      redirectTo,
    })
    if (!recoveryEmailAccepted) {
      logSafe({
        event: 'invite_worker_recovery_email_failed',
        companyId,
        authUserId,
      })
    }
  }

  const emailOutcome = buildEmailDeliveryOutcome({
    alreadyExisted,
    linkCode,
    inviteApiAccepted,
    recoveryEmailAccepted,
  })

  return jsonResponse(req, 200, {
    ok: true,
    code: emailOutcome.code,
    linkingSucceeded: true,
    emailDeliveryFailed: emailOutcome.emailDeliveryFailed,
    companyId,
    membershipRole: WORKER_MEMBERSHIP_ROLE,
    membershipId: linked.membership_id ?? null,
    driverId: linked.driver_id ?? null,
    workerCode: linked.worker_code ?? null,
    authUserId,
    inviteSent: emailOutcome.inviteSent,
    alreadyExisted,
    createdAuthUserThisRequest,
    redirectTo,
    message: emailOutcome.message,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req)
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, 405, {
      ok: false,
      code: 'invalid_argument',
      message: 'Method not allowed.',
    })
  }

  try {
    return await handleInvite(req)
  } catch (error) {
    logSafe({
      event: 'invite_worker_unhandled',
      message: error instanceof Error ? error.message : 'unknown',
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to invite Worker right now.',
    })
  }
})

/**
 * DREVORA Edge Function: invite-office-user
 *
 * Office Admin flow: invite an Office Auth user and create/link
 * public.company_members with a distinct MVP Office role.
 *
 * - Requires authenticated Office JWT (Admin / Manager / Office / Supervisor,
 *   plus legacy Transport Manager / Planner / Office Staff).
 * - Never trusts a browser-supplied company ID or user ID.
 * - Target roles ONLY: Admin | Manager | Office | Supervisor (never Driver).
 * - Never creates a drivers row.
 * - Uses service role only inside this function (Auth Admin + RPCs).
 * - Invite redirect uses production app origin + /reset-password.
 *
 * Deploy later:
 *   supabase functions deploy invite-office-user
 *
 * Required migration (apply manually first):
 *   20260808150000_office_user_invitation_foundation.sql
 * Prerequisite:
 *   20260808140000_mvp_system_membership_roles.sql (drevora_is_office_membership_role)
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.108.2'
import { requireCallerAal2 } from '../_shared/requireAal2.ts'

const TARGET_OFFICE_ROLES = new Set([
  'Admin',
  'Manager',
  'Office',
  'Supervisor',
])

const ACTOR_OFFICE_ROLES = new Set([
  'Admin',
  'Manager',
  'Office',
  'Supervisor',
  'Transport Manager',
  'Planner',
  'Office Staff',
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

const USER_ALREADY_LINKED_TO_ANOTHER_COMPANY =
  'USER_ALREADY_LINKED_TO_ANOTHER_COMPANY'

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
  role?: unknown
  fullName?: unknown
  /** Ignored if present — company always comes from caller membership. */
  companyId?: unknown
  userId?: unknown
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

function mapDbError(message: string): {
  code: string
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

/**
 * Resolve an existing Auth user id via admin.listUsers pagination only.
 * Read-only directory scan: never creates Auth users. Must not use link
 * generation, magic links, recovery-link probes, OTP, or signup APIs to
 * discover whether an Auth user already exists.
 */
async function resolveExistingAuthUserIdByListUsers(
  admin: SupabaseClient,
  email: string,
): Promise<string> {
  const target = email.trim().toLowerCase()
  const perPage = 200
  let page = 1

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw Object.assign(new Error(error.message || 'Unable to list Auth users'), {
        code: 'invite_send_failed',
      })
    }

    const users = data?.users ?? []
    const match = users.find(
      (row) => (row.email ?? '').trim().toLowerCase() === target,
    )
    if (match?.id) {
      return match.id
    }

    if (users.length < perPage) {
      break
    }
    page += 1
    // Safety cap against runaway pagination.
    if (page > 100) {
      break
    }
  }

  throw Object.assign(
    new Error('Existing Auth user was not found for this email.'),
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

type AuthCleanupSkipReason =
  | 'not_created_this_request'
  | 'membership_query_failed'
  | 'active_membership_present'
  | 'membership_present'

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

async function recordInviteEvent(input: {
  admin: SupabaseClient
  companyId: string
  email: string
  role: string
  actorUserId: string
  authUserId: string | null
  membershipId: string | null
  fullName: string | null
  status: string
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    await input.admin.rpc('drevora_insert_office_user_invitation_event', {
      p_company_id: input.companyId,
      p_invited_email: input.email,
      p_invited_role: input.role,
      p_actor_user_id: input.actorUserId,
      p_auth_user_id: input.authUserId,
      p_membership_id: input.membershipId,
      p_full_name: input.fullName,
      p_status: input.status,
      p_details: input.details ?? {},
    })
  } catch (error) {
    logSafe({
      event: 'invite_office_user_audit_failed',
      status: input.status,
      message: error instanceof Error ? error.message : 'unknown',
    })
  }
}

/**
 * Best-effort delete of an Auth user created by this request after RPC link failure.
 * Never deletes pre-existing users or users that appear linked.
 */
async function cleanupAuthUserCreatedThisRequest(input: {
  admin: SupabaseClient
  authUserId: string
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

  const membershipsResult = await input.admin
    .from('company_members')
    .select('id, is_active')
    .eq('user_id', input.authUserId)

  if (membershipsResult.error) {
    logSafe({
      event: 'invite_office_user_auth_cleanup_membership_query_failed',
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
  if (activeMembershipCount > 0) {
    return {
      authCleanupAttempted: false,
      authCleanupSucceeded: false,
      authCleanupSkipped: true,
      authCleanupError: null,
      authCleanupSkipReason: 'active_membership_present',
    }
  }
  if (membershipRows.length > 0) {
    return {
      authCleanupAttempted: false,
      authCleanupSucceeded: false,
      authCleanupSkipped: true,
      authCleanupError: null,
      authCleanupSkipReason: 'membership_present',
    }
  }

  const { error: deleteError } = await input.admin.auth.admin.deleteUser(
    input.authUserId,
  )

  if (!deleteError) {
    return {
      authCleanupAttempted: true,
      authCleanupSucceeded: true,
      authCleanupSkipped: false,
      authCleanupError: null,
      authCleanupSkipReason: null,
    }
  }

  if (isAuthDeleteNotFoundError(deleteError.message)) {
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
    logSafe({ event: 'invite_office_user_misconfigured' })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_misconfigured',
      message: 'Office invitations are temporarily unavailable.',
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

  if (body.companyId != null || body.userId != null) {
    logSafe({ event: 'invite_office_user_ignored_client_ids' })
  }

  const email = normalizeEmail(body.email)
  if (!email) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'invalid_email',
      message: 'Enter a valid Office user email address.',
    })
  }

  const role = asTrimmedString(body.role)
  if (!role || role === 'Driver' || !TARGET_OFFICE_ROLES.has(role)) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'invalid_role',
      message: 'Select Admin, Manager, Office, or Supervisor.',
    })
  }

  const fullName = asTrimmedString(body.fullName)

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
      event: 'invite_office_user_membership_lookup_failed',
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
        'Multiple company memberships found. Resolve membership before inviting Office users.',
    })
  }

  const membership = memberships[0]
  if (!ACTOR_OFFICE_ROLES.has(membership.role)) {
    return jsonResponse(req, 403, {
      ok: false,
      code: 'forbidden',
      message: 'Only Office roles can invite Office users.',
    })
  }

  const aal2 = await requireCallerAal2(userClient, token)
  if (!aal2.ok) {
    return jsonResponse(req, aal2.httpStatus, {
      ok: false,
      code: aal2.code,
      message: aal2.message,
    })
  }

  const companyId = membership.company_id
  const redirectTo = buildRedirectTo()
  let authUserId: string
  let alreadyExisted = false
  let inviteApiAccepted = false
  let createdAuthUserThisRequest = false

  const invite = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      drevora_invite: true,
      invited_as: role,
      invite_kind: 'office',
      ...(fullName ? { full_name: fullName } : {}),
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
        event: 'invite_office_user_auth_invite_failed',
        companyId,
        message: inviteMessage,
      })
      await recordInviteEvent({
        admin,
        companyId,
        email,
        role,
        actorUserId: user.id,
        authUserId: null,
        membershipId: null,
        fullName,
        status: 'invite_send_failed',
        details: { stage: 'inviteUserByEmail' },
      })
      return jsonResponse(req, 500, {
        ok: false,
        code: 'invite_send_failed',
        message: 'Unable to send the Office invitation email.',
      })
    }

    try {
      // Read-only Auth directory lookup — listUsers never creates Auth users.
      authUserId = await resolveExistingAuthUserIdByListUsers(admin, email)
      alreadyExisted = true
      inviteApiAccepted = false
      createdAuthUserThisRequest = false
    } catch (error) {
      const message = error instanceof Error ? error.message : 'lookup failed'
      logSafe({
        event: 'invite_office_user_existing_user_lookup_failed',
        companyId,
        message,
      })
      await recordInviteEvent({
        admin,
        companyId,
        email,
        role,
        actorUserId: user.id,
        authUserId: null,
        membershipId: null,
        fullName,
        status: 'invite_send_failed',
        details: { stage: 'resolveExistingAuthUserIdByListUsers' },
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
        event: 'invite_office_user_target_membership_lookup_failed',
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

  const linkResult = await admin.rpc('drevora_link_invited_office_user', {
    p_actor_user_id: user.id,
    p_company_id: companyId,
    p_auth_user_id: authUserId,
    p_email: email,
    p_role: role,
    p_full_name: fullName,
  })

  if (linkResult.error) {
    const mapped = mapDbError(linkResult.error.message ?? '')
    logSafe({
      event: 'invite_office_user_link_failed',
      companyId,
      authUserId,
      code: mapped.code,
      message: linkResult.error.message,
    })

    await recordInviteEvent({
      admin,
      companyId,
      email,
      role,
      actorUserId: user.id,
      authUserId,
      membershipId: null,
      fullName,
      status: 'link_failed',
      details: { code: mapped.code },
    })

    const cleanup = await cleanupAuthUserCreatedThisRequest({
      admin,
      authUserId,
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
  const linkCode = typeof linked.code === 'string' ? linked.code : 'linked'
  const membershipRole =
    typeof linked.membership_role === 'string' ? linked.membership_role : role

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
        event: 'invite_office_user_recovery_email_failed',
        companyId,
        authUserId,
      })
      await recordInviteEvent({
        admin,
        companyId,
        email,
        role,
        actorUserId: user.id,
        authUserId,
        membershipId:
          typeof linked.membership_id === 'string' ? linked.membership_id : null,
        fullName,
        status: 'email_failed',
        details: { linkCode, stage: 'resetPasswordForEmail' },
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
    membershipRole,
    membershipId: linked.membership_id ?? null,
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
      event: 'invite_office_user_unhandled',
      message: error instanceof Error ? error.message : 'unknown',
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to invite Office user right now.',
    })
  }
})

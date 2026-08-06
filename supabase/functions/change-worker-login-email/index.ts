/**
 * DREVORA Edge Function: change-worker-login-email
 *
 * Office-only: change login email for an existing Auth-linked Worker.
 * Same drivers.id + same drivers.auth_user_id. Never creates/rebinds Auth users.
 *
 * Sequence:
 *   1) Auth Admin updateUserById (same Auth UUID)
 *   2) Atomic RPC drevora_finalize_worker_login_email_change (drivers.email + audit)
 *   3) If (2) fails after (1) succeeded → restore old Auth email; return original error
 *
 * Deploy later:
 *   supabase functions deploy change-worker-login-email
 *
 * Required migration (apply manually first):
 *   20260806220000_worker_login_email_change.sql
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.108.2'

const OFFICE_ROLES = new Set([
  'Admin',
  'Transport Manager',
  'Supervisor',
  'Planner',
  'Office Staff',
])

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

type DriverRow = {
  id: string
  company_id: string | null
  email: string | null
  auth_user_id: string | null
  archived_at: string | null
  worker_code: string | null
}

type RequestBody = {
  workerId?: unknown
  newEmail?: unknown
  reason?: unknown
  samePersonConfirmed?: unknown
  /** Ignored if present — never trusted from browser. */
  companyId?: unknown
  /** Ignored if present — never trusted from browser. */
  authUserId?: unknown
}

type RollbackMeta = {
  authEmailUpdated: boolean
  authRollbackAttempted: boolean
  authRollbackSucceeded: boolean
  authRollbackSkipped: boolean
  authRollbackError: string | null
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

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return null
  return email
}

function sanitizePublicError(message: string | null | undefined): string {
  if (!message) return 'Unable to change Worker login email right now.'
  const lower = message.toLowerCase()
  if (
    lower.includes('service_role') ||
    lower.includes('secret') ||
    lower.includes('password') ||
    lower.includes('stack') ||
    lower.includes('sql') ||
    lower.includes('postgres')
  ) {
    return 'Unable to change Worker login email right now.'
  }
  return message.length > 240 ? 'Unable to change Worker login email right now.' : message
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

function emptyRollback(): RollbackMeta {
  return {
    authEmailUpdated: false,
    authRollbackAttempted: false,
    authRollbackSucceeded: false,
    authRollbackSkipped: true,
    authRollbackError: null,
  }
}

function mapDbError(message: string): {
  code: string
  httpStatus: number
  message: string
} {
  const upper = message.toUpperCase()
  if (upper.includes('WORKER_NOT_FOUND')) {
    return {
      code: 'WORKER_NOT_FOUND',
      httpStatus: 404,
      message: 'Worker was not found in your company.',
    }
  }
  if (upper.includes('WORKER_ARCHIVED')) {
    return {
      code: 'WORKER_ARCHIVED',
      httpStatus: 409,
      message: 'Archived Workers cannot change login email.',
    }
  }
  if (upper.includes('WORKER_AUTH_NOT_LINKED')) {
    return {
      code: 'WORKER_AUTH_NOT_LINKED',
      httpStatus: 409,
      message: 'This Worker is not linked to an Auth account yet.',
    }
  }
  if (upper.includes('EMAIL_ALREADY_IN_USE')) {
    return {
      code: 'EMAIL_ALREADY_IN_USE',
      httpStatus: 409,
      message: 'That email is already in use.',
    }
  }
  if (upper.includes('INVALID_EMAIL')) {
    return {
      code: 'INVALID_EMAIL',
      httpStatus: 400,
      message: 'Enter a valid email address.',
    }
  }
  if (upper.includes('FORBIDDEN') || upper.includes('LOGIN_EMAIL_FORBIDDEN')) {
    return {
      code: 'FORBIDDEN',
      httpStatus: 403,
      message: 'Only Office roles can change Worker login email.',
    }
  }
  if (upper.includes('WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED')) {
    return {
      code: 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED',
      httpStatus: 409,
      message:
        'This Worker cannot be rebound to a different Auth user. Archive and create a new Worker for a different person.',
    }
  }
  if (upper.includes('WORKER_LOGIN_EMAIL_CHANGE_REQUIRED')) {
    return {
      code: 'WORKER_LOGIN_EMAIL_CHANGE_REQUIRED',
      httpStatus: 409,
      message: 'Use the secure login email change flow for linked Workers.',
    }
  }
  if (upper.includes('SAME_PERSON_CONFIRMATION_REQUIRED')) {
    return {
      code: 'SAME_PERSON_CONFIRMATION_REQUIRED',
      httpStatus: 400,
      message: 'Confirm this is the same person before changing login email.',
    }
  }
  return {
    code: 'server_failure',
    httpStatus: 500,
    message: 'Unable to change Worker login email right now.',
  }
}

/**
 * Resolve whether an Auth user already owns this email.
 * generateLink is lookup-only (does not create users for our purposes when it errors).
 */
async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const invite = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (!invite.error && invite.data.user?.id) {
    return invite.data.user.id
  }

  const recovery = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
  })
  if (!recovery.error && recovery.data.user?.id) {
    return recovery.data.user.id
  }

  return null
}

async function restoreAuthEmail(input: {
  admin: SupabaseClient
  authUserId: string
  oldEmail: string
}): Promise<{ attempted: boolean; succeeded: boolean; error: string | null }> {
  try {
    const result = await input.admin.auth.admin.updateUserById(input.authUserId, {
      email: input.oldEmail,
      email_confirm: true,
    })
    if (result.error) {
      return {
        attempted: true,
        succeeded: false,
        error: sanitizePublicError(result.error.message),
      }
    }
    return { attempted: true, succeeded: true, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'rollback failed'
    return {
      attempted: true,
      succeeded: false,
      error: sanitizePublicError(message),
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req)
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, 405, {
      ok: false,
      code: 'server_failure',
      message: 'Method not allowed.',
    })
  }

  const token = bearerToken(req)
  if (!token) {
    return jsonResponse(req, 401, {
      ok: false,
      code: 'UNAUTHENTICATED',
      message: 'Sign in required.',
    })
  }

  const supabaseUrl = trimEnv('SUPABASE_URL')
  const anonKey = trimEnv('SUPABASE_ANON_KEY')
  const privilegedKey = resolvePrivilegedSupabaseKey()
  if (!supabaseUrl || !anonKey || !privilegedKey) {
    logSafe({ event: 'change_worker_login_email_misconfigured' })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Login email changes are temporarily unavailable.',
    })
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'server_failure',
      message: 'Request body must be JSON.',
    })
  }

  if (body.companyId != null || body.authUserId != null) {
    logSafe({
      event: 'change_worker_login_email_ignored_client_identity_fields',
    })
  }

  if (body.samePersonConfirmed !== true) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'SAME_PERSON_CONFIRMATION_REQUIRED',
      message: 'Confirm this is the same person before changing login email.',
    })
  }

  const reason = asTrimmedString(body.reason)
  if (!reason) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'server_failure',
      message: 'A reason is required.',
    })
  }

  const workerId = asTrimmedString(body.workerId)
  if (!workerId || !isUuid(workerId)) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'WORKER_NOT_FOUND',
      message: 'Worker was not found.',
    })
  }

  const newEmail = normalizeEmail(body.newEmail)
  if (!newEmail) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'INVALID_EMAIL',
      message: 'Enter a valid email address.',
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
      code: 'UNAUTHENTICATED',
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
      event: 'change_worker_login_email_membership_lookup_failed',
      authUserId: user.id,
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to resolve your company membership.',
    })
  }

  const memberships = (membershipsResult.data ?? []) as MembershipRow[]
  if (memberships.length !== 1) {
    return jsonResponse(req, 403, {
      ok: false,
      code: 'FORBIDDEN',
      message:
        memberships.length === 0
          ? 'Your account is not linked to an active company.'
          : 'Multiple company memberships found. Resolve membership before continuing.',
    })
  }

  const membership = memberships[0]
  if (!OFFICE_ROLES.has(membership.role)) {
    return jsonResponse(req, 403, {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Only Office roles can change Worker login email.',
    })
  }

  const companyId = membership.company_id

  const workerResult = await admin
    .from('drivers')
    .select('id, company_id, email, auth_user_id, archived_at, worker_code')
    .eq('id', workerId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (workerResult.error) {
    logSafe({
      event: 'change_worker_login_email_worker_lookup_failed',
      workerId,
      companyId,
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to load the Worker profile.',
    })
  }

  const worker = workerResult.data as DriverRow | null
  if (!worker) {
    return jsonResponse(req, 404, {
      ok: false,
      code: 'WORKER_NOT_FOUND',
      message: 'Worker was not found in your company.',
    })
  }

  if (worker.archived_at != null) {
    return jsonResponse(req, 409, {
      ok: false,
      code: 'WORKER_ARCHIVED',
      message: 'Archived Workers cannot change login email.',
    })
  }

  if (!worker.auth_user_id || !isUuid(worker.auth_user_id)) {
    return jsonResponse(req, 409, {
      ok: false,
      code: 'WORKER_AUTH_NOT_LINKED',
      message: 'This Worker is not linked to an Auth account yet.',
    })
  }

  const authUserId = worker.auth_user_id
  const currentProfileEmail = normalizeEmail(worker.email)

  if (currentProfileEmail === newEmail) {
    return jsonResponse(req, 200, {
      ok: true,
      code: 'already_same_email',
      changed: false,
      workerId: worker.id,
      authUserId,
      email: newEmail,
      workerCode: worker.worker_code,
      message: 'Login email is already set to this address.',
      ...emptyRollback(),
    })
  }

  // Active Worker email uniqueness in this company.
  const conflictWorker = await admin
    .from('drivers')
    .select('id')
    .eq('company_id', companyId)
    .is('archived_at', null)
    .neq('id', worker.id)
    .ilike('email', newEmail)
    .maybeSingle()

  if (conflictWorker.error) {
    logSafe({
      event: 'change_worker_login_email_email_conflict_query_failed',
      companyId,
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to validate the new email address.',
    })
  }

  if (conflictWorker.data?.id) {
    return jsonResponse(req, 409, {
      ok: false,
      code: 'EMAIL_ALREADY_IN_USE',
      message: 'That email is already used by another Worker in your company.',
    })
  }

  // Auth email ownership check — never create a new Auth user.
  let existingAuthForNewEmail: string | null = null
  try {
    existingAuthForNewEmail = await findAuthUserIdByEmail(admin, newEmail)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'lookup failed'
    logSafe({
      event: 'change_worker_login_email_auth_email_lookup_failed',
      message: sanitizePublicError(message),
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to validate the new email address.',
    })
  }

  if (
    existingAuthForNewEmail != null &&
    existingAuthForNewEmail !== authUserId
  ) {
    return jsonResponse(req, 409, {
      ok: false,
      code: 'EMAIL_ALREADY_IN_USE',
      message: 'That email already belongs to another Auth account.',
    })
  }

  const authUserResult = await admin.auth.admin.getUserById(authUserId)
  if (authUserResult.error || !authUserResult.data.user) {
    logSafe({
      event: 'change_worker_login_email_auth_user_missing',
      authUserId,
    })
    return jsonResponse(req, 409, {
      ok: false,
      code: 'WORKER_AUTH_NOT_LINKED',
      message: 'This Worker is not linked to an Auth account yet.',
    })
  }

  const oldAuthEmail = normalizeEmail(authUserResult.data.user.email)
  if (!oldAuthEmail) {
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to resolve the current Auth login email.',
    })
  }

  if (oldAuthEmail === newEmail) {
    // Auth already matches; still finalize profile/audit if profile differs.
    const finalizeSameAuth = await admin.rpc(
      'drevora_finalize_worker_login_email_change',
      {
        p_actor_user_id: user.id,
        p_driver_id: worker.id,
        p_expected_auth_user_id: authUserId,
        p_old_email: currentProfileEmail ?? oldAuthEmail,
        p_new_email: newEmail,
        p_reason: reason,
      },
    )

    if (finalizeSameAuth.error) {
      const mapped = mapDbError(finalizeSameAuth.error.message ?? '')
      return jsonResponse(req, mapped.httpStatus, {
        ok: false,
        code: mapped.code,
        message: mapped.message,
        ...emptyRollback(),
      })
    }

    return jsonResponse(req, 200, {
      ok: true,
      code: 'login_email_changed',
      changed: true,
      workerId: worker.id,
      authUserId,
      email: newEmail,
      oldEmail: currentProfileEmail ?? oldAuthEmail,
      workerCode: worker.worker_code,
      message: 'Worker login email updated.',
      ...emptyRollback(),
    })
  }

  // 1) Update Auth first (same Auth UUID only).
  const authUpdate = await admin.auth.admin.updateUserById(authUserId, {
    email: newEmail,
    email_confirm: true,
  })

  if (authUpdate.error) {
    const message = authUpdate.error.message ?? ''
    const upper = message.toUpperCase()
    if (
      upper.includes('ALREADY') ||
      upper.includes('REGISTERED') ||
      upper.includes('EXISTS') ||
      upper.includes('DUPLICATE')
    ) {
      return jsonResponse(req, 409, {
        ok: false,
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'That email already belongs to another Auth account.',
        ...emptyRollback(),
      })
    }
    logSafe({
      event: 'change_worker_login_email_auth_update_failed',
      authUserId,
      message: sanitizePublicError(message),
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to update the Auth login email.',
      ...emptyRollback(),
    })
  }

  // 2) Atomic drivers.email + audit.
  const finalize = await admin.rpc('drevora_finalize_worker_login_email_change', {
    p_actor_user_id: user.id,
    p_driver_id: worker.id,
    p_expected_auth_user_id: authUserId,
    p_old_email: oldAuthEmail,
    p_new_email: newEmail,
    p_reason: reason,
  })

  if (finalize.error) {
    const mapped = mapDbError(finalize.error.message ?? '')
    const rollback = await restoreAuthEmail({
      admin,
      authUserId,
      oldEmail: oldAuthEmail,
    })

    logSafe({
      event: 'change_worker_login_email_finalize_failed',
      workerId: worker.id,
      authUserId,
      authRollbackSucceeded: rollback.succeeded,
    })

    return jsonResponse(req, mapped.httpStatus, {
      ok: false,
      code: mapped.code,
      message: mapped.message,
      authEmailUpdated: true,
      authRollbackAttempted: rollback.attempted,
      authRollbackSucceeded: rollback.succeeded,
      authRollbackSkipped: false,
      authRollbackError: rollback.error,
    })
  }

  const finalizeData =
    finalize.data && typeof finalize.data === 'object' && !Array.isArray(finalize.data)
      ? (finalize.data as Record<string, unknown>)
      : {}

  return jsonResponse(req, 200, {
    ok: true,
    code:
      typeof finalizeData.code === 'string'
        ? finalizeData.code
        : 'login_email_changed',
    changed: finalizeData.changed !== false,
    workerId: worker.id,
    authUserId,
    email: newEmail,
    oldEmail: oldAuthEmail,
    workerCode: worker.worker_code,
    eventId:
      typeof finalizeData.event_id === 'string' ? finalizeData.event_id : null,
    message: 'Worker login email updated.',
    authEmailUpdated: true,
    authRollbackAttempted: false,
    authRollbackSucceeded: false,
    authRollbackSkipped: true,
    authRollbackError: null,
  })
})

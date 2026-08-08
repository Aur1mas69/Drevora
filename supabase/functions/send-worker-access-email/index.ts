/**
 * DREVORA Edge Function: send-worker-access-email
 *
 * Office-only: send account access (password reset) email for an Auth-linked Worker.
 * Same drivers.id + same drivers.auth_user_id. Never creates/rebinds Auth users.
 *
 * Sequence:
 *   1) Resolve caller company from company_members (ignore browser companyId/authUserId)
 *   2) Load Worker (same company, active, auth_user_id set)
 *   3) Load Auth user by drivers.auth_user_id; require profile email == Auth email
 *   4) expectedEmail must match server Auth email (confirmation only — never send target)
 *   5) RPC drevora_begin_worker_access_email_send — advisory lock + pending reservation
 *   6) anon resetPasswordForEmail(serverAuthEmail, { redirectTo })
 *   7) On accepted send: RPC drevora_finalize_worker_access_email_send (pending→sent + audit)
 *   8) On send failure: RPC drevora_fail_worker_access_email_send (pending→failed, no audit)
 *
 * Deploy later:
 *   supabase functions deploy send-worker-access-email
 *
 * Required migration (apply manually first):
 *   20260806240000_worker_access_email.sql
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.108.2'
import { requireCallerAal2 } from '../_shared/requireAal2.ts'

const OFFICE_ROLES = new Set([
  'Admin',
  'Manager',
  'Office',
  'Supervisor',
  'Transport Manager',
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

const ACCESS_EMAIL_REDIRECT_TO = 'https://app.drevora.app/reset-password'
const ACCESS_EMAIL_COOLDOWN_SECONDS = 900
const ACCESS_EMAIL_PENDING_TTL_SECONDS = 300
const ACCESS_EMAIL_AUDIT_REASON = 'office_send_account_access_email'

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
  expectedEmail?: unknown
  emailConfirmed?: unknown
  /** Ignored if present — never trusted from browser. */
  companyId?: unknown
  /** Ignored if present — never trusted from browser. */
  authUserId?: unknown
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
  if (!message) return 'Unable to send account access email right now.'
  const lower = message.toLowerCase()
  if (
    lower.includes('service_role') ||
    lower.includes('secret') ||
    lower.includes('password') ||
    lower.includes('stack') ||
    lower.includes('sql') ||
    lower.includes('postgres')
  ) {
    return 'Unable to send account access email right now.'
  }
  return message.length > 240
    ? 'Unable to send account access email right now.'
    : message
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

function mapDbError(message: string): {
  code: string
  httpStatus: number
  message: string
  retryAfterSeconds?: number
} {
  const upper = message.toUpperCase()
  if (upper.includes('ACCESS_EMAIL_RATE_LIMITED')) {
    const retryMatch = /RETRY AFTER (\d+)/i.exec(message)
    const retryAfterSeconds = retryMatch
      ? Math.max(1, Number.parseInt(retryMatch[1] ?? '1', 10) || 1)
      : ACCESS_EMAIL_COOLDOWN_SECONDS
    return {
      code: 'ACCESS_EMAIL_RATE_LIMITED',
      httpStatus: 429,
      message: 'An access email was sent recently. Please wait before sending again.',
      retryAfterSeconds,
    }
  }
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
      message: 'Archived Workers cannot receive account access email.',
    }
  }
  if (upper.includes('WORKER_AUTH_NOT_LINKED')) {
    return {
      code: 'WORKER_AUTH_NOT_LINKED',
      httpStatus: 409,
      message: 'This Worker is not linked to an Auth account yet.',
    }
  }
  if (upper.includes('WORKER_LOGIN_EMAIL_OUT_OF_SYNC')) {
    return {
      code: 'WORKER_LOGIN_EMAIL_OUT_OF_SYNC',
      httpStatus: 409,
      message:
        'Worker profile email and Auth login email do not match. Fix login email first.',
    }
  }
  if (upper.includes('FORBIDDEN')) {
    return {
      code: 'FORBIDDEN',
      httpStatus: 403,
      message: 'Only Office roles can send Worker account access email.',
    }
  }
  if (upper.includes('UNAUTHENTICATED')) {
    return {
      code: 'UNAUTHENTICATED',
      httpStatus: 401,
      message: 'Sign in required.',
    }
  }
  return {
    code: 'server_failure',
    httpStatus: 500,
    message: 'Unable to send account access email right now.',
  }
}

async function sendAccessEmail(input: {
  supabaseUrl: string
  anonKey: string
  email: string
}): Promise<{ accepted: boolean; errorMessage: string | null }> {
  const anonClient = createClient(input.supabaseUrl, input.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { error } = await anonClient.auth.resetPasswordForEmail(input.email, {
    redirectTo: ACCESS_EMAIL_REDIRECT_TO,
  })

  if (error) {
    return {
      accepted: false,
      errorMessage: sanitizePublicError(error.message),
    }
  }

  return { accepted: true, errorMessage: null }
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
    logSafe({ event: 'send_worker_access_email_misconfigured' })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Account access email is temporarily unavailable.',
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
      event: 'send_worker_access_email_ignored_client_identity_fields',
    })
  }

  if (body.emailConfirmed !== true) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'EMAIL_CONFIRMATION_MISMATCH',
      message: 'Confirm the email address before sending account access email.',
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

  const expectedEmail = normalizeEmail(body.expectedEmail)
  if (!expectedEmail) {
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
      event: 'send_worker_access_email_membership_lookup_failed',
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
      message: 'Only Office roles can send Worker account access email.',
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

  const workerResult = await admin
    .from('drivers')
    .select('id, company_id, email, auth_user_id, archived_at, worker_code')
    .eq('id', workerId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (workerResult.error) {
    logSafe({
      event: 'send_worker_access_email_worker_lookup_failed',
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
      message: 'Archived Workers cannot receive account access email.',
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
  const profileEmail = normalizeEmail(worker.email)
  if (!profileEmail) {
    return jsonResponse(req, 409, {
      ok: false,
      code: 'WORKER_LOGIN_EMAIL_OUT_OF_SYNC',
      message:
        'Worker profile email and Auth login email do not match. Fix login email first.',
    })
  }

  const authUserResult = await admin.auth.admin.getUserById(authUserId)
  if (authUserResult.error || !authUserResult.data.user) {
    logSafe({
      event: 'send_worker_access_email_auth_user_missing',
      authUserId,
    })
    return jsonResponse(req, 409, {
      ok: false,
      code: 'WORKER_AUTH_NOT_LINKED',
      message: 'This Worker is not linked to an Auth account yet.',
    })
  }

  const authEmail = normalizeEmail(authUserResult.data.user.email)
  if (!authEmail) {
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to resolve the current Auth login email.',
    })
  }

  if (profileEmail !== authEmail) {
    return jsonResponse(req, 409, {
      ok: false,
      code: 'WORKER_LOGIN_EMAIL_OUT_OF_SYNC',
      message:
        'Worker profile email and Auth login email do not match. Fix login email first.',
    })
  }

  // Confirmation only — never use browser email as the send target.
  if (expectedEmail !== authEmail) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'EMAIL_CONFIRMATION_MISMATCH',
      message: 'Confirmed email does not match the current Worker login email.',
    })
  }

  const beginResult = await admin.rpc('drevora_begin_worker_access_email_send', {
    p_actor_user_id: user.id,
    p_driver_id: worker.id,
    p_expected_auth_user_id: authUserId,
    p_cooldown_seconds: ACCESS_EMAIL_COOLDOWN_SECONDS,
    p_pending_ttl_seconds: ACCESS_EMAIL_PENDING_TTL_SECONDS,
  })

  if (beginResult.error) {
    const mapped = mapDbError(beginResult.error.message ?? '')
    return jsonResponse(req, mapped.httpStatus, {
      ok: false,
      code: mapped.code,
      message: mapped.message,
      ...(mapped.retryAfterSeconds
        ? { retryAfterSeconds: mapped.retryAfterSeconds }
        : {}),
    })
  }

  const beginData =
    beginResult.data &&
    typeof beginResult.data === 'object' &&
    !Array.isArray(beginResult.data)
      ? (beginResult.data as Record<string, unknown>)
      : null
  const dispatchId =
    typeof beginData?.dispatch_id === 'string' ? beginData.dispatch_id : null

  if (!dispatchId || !isUuid(dispatchId)) {
    logSafe({
      event: 'send_worker_access_email_begin_missing_dispatch_id',
      workerId: worker.id,
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to reserve account access email send.',
    })
  }

  // Send ONLY to server-resolved Auth email.
  const sendResult = await sendAccessEmail({
    supabaseUrl,
    anonKey,
    email: authEmail,
  })

  if (!sendResult.accepted) {
    const failResult = await admin.rpc('drevora_fail_worker_access_email_send', {
      p_actor_user_id: user.id,
      p_dispatch_id: dispatchId,
      p_failure_code: 'server_failure',
    })
    if (failResult.error) {
      logSafe({
        event: 'send_worker_access_email_fail_rpc_error',
        workerId: worker.id,
        dispatchId,
        message: sanitizePublicError(failResult.error.message),
      })
    }
    logSafe({
      event: 'send_worker_access_email_send_rejected',
      workerId: worker.id,
      authUserId,
      dispatchId,
      message: sendResult.errorMessage,
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to send account access email right now.',
    })
  }

  const finalizeResult = await admin.rpc(
    'drevora_finalize_worker_access_email_send',
    {
      p_actor_user_id: user.id,
      p_dispatch_id: dispatchId,
      p_expected_auth_user_id: authUserId,
      p_email: authEmail,
      p_reason: ACCESS_EMAIL_AUDIT_REASON,
    },
  )

  if (finalizeResult.error) {
    // Email was accepted by Auth; reservation may still be pending until TTL/manual fail.
    logSafe({
      event: 'send_worker_access_email_finalize_failed_after_send',
      workerId: worker.id,
      authUserId,
      dispatchId,
      message: sanitizePublicError(finalizeResult.error.message),
    })
    return jsonResponse(req, 200, {
      ok: true,
      code: 'access_email_sent',
      workerId: worker.id,
      email: authEmail,
      cooldownSeconds: ACCESS_EMAIL_COOLDOWN_SECONDS,
      auditRecorded: false,
      dispatchId,
      workerCode: worker.worker_code,
      message:
        'Account access email was sent, but the audit record could not be saved.',
    })
  }

  return jsonResponse(req, 200, {
    ok: true,
    code: 'access_email_sent',
    workerId: worker.id,
    email: authEmail,
    cooldownSeconds: ACCESS_EMAIL_COOLDOWN_SECONDS,
    auditRecorded: true,
    dispatchId,
    workerCode: worker.worker_code,
    message: 'Account access email sent.',
  })
})

/**
 * DREVORA Edge Function: delete-account
 *
 * Actions:
 *   - request     — authenticated Worker or Office JWT; schedule deletion + immediate access revoke
 *   - process_due — cron secret ONLY; anonymise due pending Worker requests / complete office deletes + delete Auth users
 *   - cancel      — cron secret ONLY; support-assisted cancel of a pending request
 *
 * Worker: deactivate membership, archive Worker profile, role_context=worker.
 * Office/Admin: sole-Admin protection; deactivate caller membership only; role_context=office;
 *   never archive Workers or close the company.
 *
 * For `process_due` and `cancel`, invoke with header x-drevora-account-deletion-cron-secret
 * (see README.md in this folder). Do not auto-configure cron in this change set.
 *
 * Never expose SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, or cron secrets to the frontend.
 * A normal authenticated Worker/Admin JWT alone cannot call process_due or cancel.
 */

import { timingSafeEqual } from 'jsr:@std/crypto/timing-safe-equal'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.108.2'
import { requireCallerAal2 } from '../_shared/requireAal2.ts'

const CRON_SECRET_HEADER = 'x-drevora-account-deletion-cron-secret'
const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const WORKER_AVATARS_BUCKET = 'worker-avatars'
const SUPPORT_ATTACHMENTS_BUCKET = 'support-attachments'
const DELETION_DELAY_DAYS = 30
const WORKER_ROLE = 'Driver'
const ADMIN_ROLE = 'Admin'
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
  'authorization, x-client-info, apikey, content-type, x-drevora-account-deletion-cron-secret'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  email: string
  archived_at: string | null
  avatar_url: string | null
  first_name: string
  last_name: string
}

type DeletionRequestRow = {
  id: string
  auth_user_id: string
  company_id: string
  driver_id: string | null
  role_context: string
  status: string
  requested_at: string
  scheduled_for: string
  processed_at: string | null
  cancelled_at: string | null
  processing_error: string | null
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

async function secretsMatch(
  providedHeader: string,
  configuredSecret: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const providedDigest = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(providedHeader),
    )
    const configuredDigest = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(configuredSecret),
    )
    return timingSafeEqual(providedDigest, configuredDigest)
  } catch {
    return false
  }
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDeletionDateUtc(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function addDaysIso(fromIso: string, days: number): string {
  const date = new Date(fromIso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!match) return null
  const token = match[1]?.trim()
  return token && token.length > 0 ? token : null
}

function resolveEmailFrom(): string | null {
  return trimEnv('DREVORA_ACCOUNT_EMAIL_FROM') ?? trimEnv('DREVORA_SUPPORT_EMAIL_FROM')
}

function avatarObjectPath(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null
  const trimmed = avatarUrl.trim()
  if (!trimmed) return null
  if (trimmed.startsWith(`${WORKER_AVATARS_BUCKET}/`)) {
    return trimmed.slice(WORKER_AVATARS_BUCKET.length + 1)
  }
  try {
    const url = new URL(trimmed)
    const marker = `/${WORKER_AVATARS_BUCKET}/`
    const idx = url.pathname.indexOf(marker)
    if (idx >= 0) {
      return decodeURIComponent(url.pathname.slice(idx + marker.length))
    }
  } catch {
    // Not a URL — treat as storage path.
  }
  if (trimmed.includes('/worker-avatars/')) {
    return trimmed
  }
  return null
}

async function requireCronAuthorization(req: Request): Promise<Response | null> {
  const configured = trimEnv('DREVORA_ACCOUNT_DELETION_CRON_SECRET')
  const provided = req.headers.get(CRON_SECRET_HEADER)?.trim() ?? ''
  if (!configured || !provided || !(await secretsMatch(provided, configured))) {
    return jsonResponse(req, 401, {
      ok: false,
      code: 'unauthorized',
      message: 'Invalid cron credentials.',
    })
  }
  return null
}

async function sendDeletionScheduledEmail(params: {
  toEmail: string
  scheduledForIso: string
  requestId: string
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = trimEnv('RESEND_API_KEY')
  const from = resolveEmailFrom()
  if (!apiKey || !from) {
    return { ok: false, reason: 'email_not_configured' }
  }

  const scheduledLabel = formatDeletionDateUtc(params.scheduledForIso)
  const subject = 'DREVORA · Account deletion scheduled'
  const text = [
    'DREVORA — Account deletion scheduled',
    '',
    'Your DREVORA account access has been disabled immediately.',
    '',
    `Permanent deletion and anonymisation of your personal account data is scheduled for ${scheduledLabel} (UTC).`,
    '',
    'Operational, compliance and legal records (for example Vehicle Checks, timesheets, holiday requests, reports and legal acceptances) may be retained according to DREVORA and your organisation’s retention policy.',
    '',
    'If you requested this in error, contact your organisation administrator or DREVORA support before the scheduled date:',
    'admin@drevora.uk',
    '',
    'This message was sent automatically. Do not reply with passwords or security codes.',
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:#0b1f3a;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:700;">
              DREVORA · Account deletion scheduled
            </td>
          </tr>
          <tr>
            <td style="padding:24px;font-size:15px;line-height:1.55;color:#334155;">
              <p style="margin:0 0 14px;">Your DREVORA account access has been <strong>disabled immediately</strong>.</p>
              <p style="margin:0 0 14px;">Permanent deletion and anonymisation of your personal account data is scheduled for <strong>${escapeHtml(scheduledLabel)} (UTC)</strong>.</p>
              <p style="margin:0 0 14px;">Operational, compliance and legal records (for example Vehicle Checks, timesheets, holiday requests, reports and legal acceptances) may be retained according to DREVORA and your organisation’s retention policy.</p>
              <p style="margin:0 0 14px;">If you requested this in error, contact your organisation administrator or DREVORA support before the scheduled date at <a href="mailto:admin@drevora.uk" style="color:#2563eb;">admin@drevora.uk</a>.</p>
              <p style="margin:0;font-size:13px;color:#64748b;">This message was sent automatically. Do not reply with passwords or security codes.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `account-deletion/${params.requestId}`,
      },
      body: JSON.stringify({
        from,
        to: [params.toEmail],
        subject,
        text,
        html,
      }),
    })
    if (!response.ok) {
      logSafe({
        event: 'account_deletion_email_failed',
        status: response.status,
        requestId: params.requestId,
      })
      return { ok: false, reason: 'email_send_failed' }
    }
    return { ok: true }
  } catch {
    logSafe({
      event: 'account_deletion_email_exception',
      requestId: params.requestId,
    })
    return { ok: false, reason: 'email_send_exception' }
  }
}

async function sendDeletionCancelledEmail(params: {
  toEmail: string
  requestId: string
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = trimEnv('RESEND_API_KEY')
  const from = resolveEmailFrom()
  if (!apiKey || !from) {
    return { ok: false, reason: 'email_not_configured' }
  }

  const subject = 'DREVORA · Account deletion cancelled'
  const text = [
    'DREVORA — Account deletion cancelled',
    '',
    'Your scheduled DREVORA account deletion has been cancelled.',
    '',
    'Your login access has been restored. Sign in again with your existing email and password.',
    '',
    'If you did not expect this message, contact admin@drevora.uk immediately.',
    '',
    'This message was sent automatically. Do not reply with passwords or security codes.',
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:#0b1f3a;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:700;">
              DREVORA · Account deletion cancelled
            </td>
          </tr>
          <tr>
            <td style="padding:24px;font-size:15px;line-height:1.55;color:#334155;">
              <p style="margin:0 0 14px;">Your scheduled DREVORA account deletion has been <strong>cancelled</strong>.</p>
              <p style="margin:0 0 14px;">Your login access has been restored. Sign in again with your existing email and password.</p>
              <p style="margin:0 0 14px;">If you did not expect this message, contact <a href="mailto:admin@drevora.uk" style="color:#2563eb;">admin@drevora.uk</a> immediately.</p>
              <p style="margin:0;font-size:13px;color:#64748b;">This message was sent automatically. Do not reply with passwords or security codes.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `account-deletion-cancel/${params.requestId}`,
      },
      body: JSON.stringify({
        from,
        to: [params.toEmail],
        subject,
        text,
        html,
      }),
    })
    if (!response.ok) {
      logSafe({
        event: 'account_deletion_cancel_email_failed',
        status: response.status,
        requestId: params.requestId,
      })
      return { ok: false, reason: 'email_send_failed' }
    }
    return { ok: true }
  } catch {
    logSafe({
      event: 'account_deletion_cancel_email_exception',
      requestId: params.requestId,
    })
    return { ok: false, reason: 'email_send_exception' }
  }
}

/** Mirror drevora_archive_driver lifecycle fields (service-role; no office-role gate). */
async function archiveWorkerProfile(
  admin: SupabaseClient,
  driver: DriverRow,
): Promise<void> {
  if (driver.archived_at) return

  const archivedAt = new Date().toISOString()
  const retention = new Date(archivedAt)
  retention.setUTCFullYear(retention.getUTCFullYear() + 6)

  await admin
    .from('vehicles')
    .update({ current_driver_id: null })
    .eq('current_driver_id', driver.id)

  const { error } = await admin
    .from('drivers')
    .update({
      default_vehicle_id: null,
      archived_at: archivedAt,
      retention_expires_at: retention.toISOString(),
    })
    .eq('id', driver.id)
    .eq('company_id', driver.company_id)

  if (error) {
    throw new Error('archive_failed')
  }
}

async function deactivateMembership(
  admin: SupabaseClient,
  membershipId: string,
): Promise<void> {
  const { error } = await admin
    .from('company_members')
    .update({ is_active: false })
    .eq('id', membershipId)
  if (error) {
    throw new Error('membership_deactivate_failed')
  }
}

async function countActiveAdmins(
  admin: SupabaseClient,
  companyId: string,
): Promise<number> {
  const { count, error } = await admin
    .from('company_members')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('role', ADMIN_ROLE)
    .eq('is_active', true)

  if (error) {
    throw new Error('admin_count_failed')
  }
  return typeof count === 'number' ? count : 0
}

function pickSingleMembership(
  rows: MembershipRow[],
): MembershipRow | null {
  if (rows.length === 1) return rows[0]!
  return null
}

async function scheduleDeletionRequest(params: {
  admin: SupabaseClient
  req: Request
  authUserId: string
  userEmail: string
  membership: MembershipRow
  driverId: string | null
  roleContext: 'worker' | 'office'
  afterDeactivate?: () => Promise<void>
}): Promise<Response> {
  const {
    admin,
    req,
    authUserId,
    userEmail,
    membership,
    driverId,
    roleContext,
    afterDeactivate,
  } = params

  const requestedAt = new Date().toISOString()
  const scheduledFor = addDaysIso(requestedAt, DELETION_DELAY_DAYS)

  try {
    await deactivateMembership(admin, membership.id)
    if (afterDeactivate) {
      await afterDeactivate()
    }
  } catch {
    logSafe({
      event: 'account_deletion_immediate_revoke_failed',
      authUserId,
      roleContext,
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to disable account access right now.',
    })
  }

  const insertResult = await admin
    .from('account_deletion_requests')
    .insert({
      auth_user_id: authUserId,
      company_id: membership.company_id,
      driver_id: driverId,
      role_context: roleContext,
      status: 'pending',
      requested_at: requestedAt,
      scheduled_for: scheduledFor,
    })
    .select(
      'id, auth_user_id, company_id, driver_id, role_context, status, requested_at, scheduled_for, processed_at, cancelled_at, processing_error',
    )
    .single()

  if (insertResult.error || !insertResult.data) {
    const raced = await admin
      .from('account_deletion_requests')
      .select(
        'id, auth_user_id, company_id, driver_id, role_context, status, requested_at, scheduled_for, processed_at, cancelled_at, processing_error',
      )
      .eq('auth_user_id', authUserId)
      .eq('status', 'pending')
      .maybeSingle()

    if (raced.data) {
      const row = raced.data as DeletionRequestRow
      return jsonResponse(req, 200, {
        ok: true,
        code: 'already_pending',
        requestId: row.id,
        scheduledFor: row.scheduled_for,
        requestedAt: row.requested_at,
        message:
          'Account deletion is already scheduled. Access remains disabled until the scheduled date.',
      })
    }

    logSafe({
      event: 'account_deletion_insert_failed',
      authUserId,
      roleContext,
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to create the deletion request.',
    })
  }

  const created = insertResult.data as DeletionRequestRow

  const emailResult = await sendDeletionScheduledEmail({
    toEmail: userEmail,
    scheduledForIso: created.scheduled_for,
    requestId: created.id,
  })

  return jsonResponse(req, 200, {
    ok: true,
    code: 'scheduled',
    requestId: created.id,
    scheduledFor: created.scheduled_for,
    requestedAt: created.requested_at,
    emailSent: emailResult.ok,
    message:
      'Account deletion is scheduled. Access has been disabled immediately.',
  })
}

async function handleOfficeRequest(params: {
  req: Request
  admin: SupabaseClient
  authUserId: string
  userEmail: string
  memberships: MembershipRow[]
}): Promise<Response> {
  const { req, admin, authUserId, userEmail, memberships } = params

  const activeOffice = memberships.filter(
    (row) => OFFICE_ROLES.has(row.role) && row.is_active,
  )
  let membership = pickSingleMembership(activeOffice)
  if (!membership) {
    const inactiveOffice = memberships.filter((row) =>
      OFFICE_ROLES.has(row.role),
    )
    membership = pickSingleMembership(inactiveOffice)
  }

  if (!membership) {
    return jsonResponse(req, 403, {
      ok: false,
      code: 'office_account',
      message:
        'A single office membership is required to delete this account.',
    })
  }

  if (membership.role === ADMIN_ROLE && membership.is_active) {
    let activeAdminCount = 0
    try {
      activeAdminCount = await countActiveAdmins(admin, membership.company_id)
    } catch {
      logSafe({
        event: 'account_deletion_admin_count_failed',
        authUserId,
        companyId: membership.company_id,
      })
      return jsonResponse(req, 500, {
        ok: false,
        code: 'server_failure',
        message: 'Unable to process account deletion right now.',
      })
    }

    if (activeAdminCount <= 1) {
      return jsonResponse(req, 403, {
        ok: false,
        code: 'sole_admin',
        message:
          'You must appoint another administrator before deleting your account.',
      })
    }
  }

  return scheduleDeletionRequest({
    admin,
    req,
    authUserId,
    userEmail,
    membership,
    driverId: null,
    roleContext: 'office',
  })
}

async function handleWorkerRequest(params: {
  req: Request
  admin: SupabaseClient
  authUserId: string
  userEmail: string
  memberships: MembershipRow[]
}): Promise<Response> {
  const { req, admin, authUserId, userEmail, memberships } = params

  const workerMemberships = memberships.filter(
    (row) => row.role === WORKER_ROLE && row.is_active,
  )
  if (workerMemberships.length === 0) {
    const inactiveWorkers = memberships.filter((row) => row.role === WORKER_ROLE)
    if (inactiveWorkers.length !== 1) {
      return jsonResponse(req, 403, {
        ok: false,
        code: 'worker_not_linked',
        message: 'A single Worker membership is required to delete this account.',
      })
    }
    workerMemberships.push(inactiveWorkers[0]!)
  }

  if (workerMemberships.length !== 1) {
    return jsonResponse(req, 403, {
      ok: false,
      code: 'worker_not_linked',
      message: 'A single Worker membership is required to delete this account.',
    })
  }

  const membership = workerMemberships[0]!

  const driversResult = await admin
    .from('drivers')
    .select(
      'id, company_id, email, archived_at, avatar_url, first_name, last_name',
    )
    .eq('company_id', membership.company_id)

  if (driversResult.error) {
    logSafe({
      event: 'account_deletion_driver_lookup_failed',
      authUserId,
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to process account deletion right now.',
    })
  }

  const emailLower = userEmail.toLowerCase()
  const drivers = ((driversResult.data ?? []) as DriverRow[]).filter(
    (row) => row.email.trim().toLowerCase() === emailLower,
  )
  if (drivers.length !== 1) {
    return jsonResponse(req, 403, {
      ok: false,
      code: 'worker_not_linked',
      message: 'Your Worker profile could not be linked to this login.',
    })
  }

  const driver = drivers[0]!

  return scheduleDeletionRequest({
    admin,
    req,
    authUserId,
    userEmail,
    membership,
    driverId: driver.id,
    roleContext: 'worker',
    afterDeactivate: async () => {
      await archiveWorkerProfile(admin, driver)
    },
  })
}

async function handleRequest(req: Request): Promise<Response> {
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
    logSafe({ event: 'account_deletion_misconfigured', action: 'request' })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_misconfigured',
      message: 'Account deletion is temporarily unavailable.',
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

  const userEmail = typeof user.email === 'string' ? user.email.trim() : ''
  if (!userEmail) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'email_required',
      message: 'Your account email is required to delete your account.',
    })
  }

  const admin = createAdminClient(privilegedKey)

  const existingPending = await admin
    .from('account_deletion_requests')
    .select(
      'id, auth_user_id, company_id, driver_id, role_context, status, requested_at, scheduled_for, processed_at, cancelled_at, processing_error',
    )
    .eq('auth_user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingPending.error) {
    logSafe({
      event: 'account_deletion_pending_lookup_failed',
      authUserId: user.id,
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to process account deletion right now.',
    })
  }

  if (existingPending.data) {
    const row = existingPending.data as DeletionRequestRow
    return jsonResponse(req, 200, {
      ok: true,
      code: 'already_pending',
      requestId: row.id,
      scheduledFor: row.scheduled_for,
      requestedAt: row.requested_at,
      message:
        'Account deletion is already scheduled. Access remains disabled until the scheduled date.',
    })
  }

  const membershipsResult = await admin
    .from('company_members')
    .select('id, user_id, company_id, role, is_active')
    .eq('user_id', user.id)

  if (membershipsResult.error) {
    logSafe({
      event: 'account_deletion_membership_lookup_failed',
      authUserId: user.id,
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to process account deletion right now.',
    })
  }

  const memberships = (membershipsResult.data ?? []) as MembershipRow[]
  if (memberships.length === 0) {
    return jsonResponse(req, 403, {
      ok: false,
      code: 'worker_not_linked',
      message: 'No company membership was found for this account.',
    })
  }

  const hasOfficeRole = memberships.some((row) => OFFICE_ROLES.has(row.role))
  if (hasOfficeRole) {
    const aal2 = await requireCallerAal2(userClient, token)
    if (!aal2.ok) {
      return jsonResponse(req, aal2.httpStatus, {
        ok: false,
        code: aal2.code,
        message: aal2.message,
      })
    }

    return handleOfficeRequest({
      req,
      admin,
      authUserId: user.id,
      userEmail,
      memberships,
    })
  }

  return handleWorkerRequest({
    req,
    admin,
    authUserId: user.id,
    userEmail,
    memberships,
  })
}

async function anonymiseDriver(
  admin: SupabaseClient,
  driverId: string,
  companyId: string,
): Promise<void> {
  const anonymisedEmail = `deleted+${driverId.replace(/-/g, '')}@deleted.invalid`

  const { data: driver, error: loadError } = await admin
    .from('drivers')
    .select('id, avatar_url, company_id, archived_at, retention_expires_at')
    .eq('id', driverId)
    .maybeSingle()

  if (loadError) {
    throw new Error('driver_load_failed')
  }
  if (!driver) return

  const path = avatarObjectPath(
    typeof driver.avatar_url === 'string' ? driver.avatar_url : null,
  )
  if (path) {
    try {
      await admin.storage.from(WORKER_AVATARS_BUCKET).remove([path])
    } catch {
      logSafe({ event: 'account_deletion_avatar_remove_failed', driverId })
    }
  }

  const { data: supportRows } = await admin
    .from('support_requests')
    .select('id, attachment_paths')
    .eq('driver_id', driverId)

  const attachmentPaths: string[] = []
  for (const row of supportRows ?? []) {
    const paths = Array.isArray(row.attachment_paths) ? row.attachment_paths : []
    for (const p of paths) {
      if (typeof p === 'string' && p.trim()) attachmentPaths.push(p.trim())
    }
  }
  if (attachmentPaths.length > 0) {
    try {
      await admin.storage.from(SUPPORT_ATTACHMENTS_BUCKET).remove(attachmentPaths)
    } catch {
      logSafe({ event: 'account_deletion_support_attachments_failed', driverId })
    }
    await admin
      .from('support_requests')
      .update({ attachment_paths: [] })
      .eq('driver_id', driverId)
  }

  const payload: Record<string, unknown> = {
    first_name: 'Deleted',
    last_name: 'User',
    email: anonymisedEmail,
    phone: null,
    avatar_url: null,
    address_line_1: null,
    address_line_2: null,
    town_city: null,
    county: null,
    postcode: null,
    country: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    emergency_contact_relationship: null,
    holiday_entitlement_notes: null,
    tacho_card_number: null,
    default_vehicle_id: null,
  }

  if (!driver.archived_at) {
    const archivedAt = new Date().toISOString()
    const retention = new Date(archivedAt)
    retention.setUTCFullYear(retention.getUTCFullYear() + 6)
    payload.archived_at = archivedAt
    payload.retention_expires_at = retention.toISOString()
  }

  const { error: updateError } = await admin
    .from('drivers')
    .update(payload)
    .eq('id', driverId)
    .eq('company_id', companyId)

  if (updateError) {
    throw new Error('driver_anonymise_failed')
  }
}

async function processOneRequest(
  admin: SupabaseClient,
  row: DeletionRequestRow,
): Promise<void> {
  const claim = await admin
    .from('account_deletion_requests')
    .update({ status: 'processing', processing_error: null })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (claim.error || !claim.data) {
    return
  }

  try {
    // Worker: anonymise linked profile PII only. Office: never touch Workers/company ops.
    if (row.role_context === 'worker' && row.driver_id) {
      await anonymiseDriver(admin, row.driver_id, row.company_id)
    }

    await admin
      .from('company_members')
      .update({ is_active: false })
      .eq('user_id', row.auth_user_id)
      .eq('company_id', row.company_id)

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(
      row.auth_user_id,
    )
    if (authDeleteError) {
      // User may already be gone — treat missing user as success for idempotency.
      const message = authDeleteError.message?.toLowerCase() ?? ''
      if (!message.includes('not found') && !message.includes('user not found')) {
        throw new Error('auth_delete_failed')
      }
    }

    const { error: completeError } = await admin
      .from('account_deletion_requests')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        processing_error: null,
      })
      .eq('id', row.id)

    if (completeError) {
      throw new Error('complete_failed')
    }
  } catch (error) {
    const safeMessage =
      error instanceof Error ? error.message.slice(0, 200) : 'processing_failed'
    logSafe({
      event: 'account_deletion_process_failed',
      requestId: row.id,
      code: safeMessage,
    })
    await admin
      .from('account_deletion_requests')
      .update({
        status: 'failed',
        processing_error: safeMessage,
      })
      .eq('id', row.id)
  }
}

async function handleProcessDue(req: Request): Promise<Response> {
  const authError = await requireCronAuthorization(req)
  if (authError) return authError

  const privilegedKey = resolvePrivilegedSupabaseKey()
  if (!privilegedKey) {
    logSafe({ event: 'account_deletion_misconfigured', action: 'process_due' })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_misconfigured',
      message: 'Account deletion processor is misconfigured.',
    })
  }

  const admin = createAdminClient(privilegedKey)
  const nowIso = new Date().toISOString()

  const dueResult = await admin
    .from('account_deletion_requests')
    .select(
      'id, auth_user_id, company_id, driver_id, role_context, status, requested_at, scheduled_for, processed_at, cancelled_at, processing_error',
    )
    .eq('status', 'pending')
    .in('role_context', ['worker', 'office'])
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true })
    .limit(50)

  if (dueResult.error) {
    logSafe({ event: 'account_deletion_due_lookup_failed' })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to load due deletion requests.',
    })
  }

  const rows = (dueResult.data ?? []) as DeletionRequestRow[]
  for (const row of rows) {
    await processOneRequest(admin, row)
  }

  return jsonResponse(req, 200, {
    ok: true,
    code: 'processed',
    scanned: rows.length,
  })
}

async function unarchiveWorkerProfile(
  admin: SupabaseClient,
  driverId: string,
  companyId: string,
): Promise<void> {
  const { error } = await admin
    .from('drivers')
    .update({
      archived_at: null,
      retention_expires_at: null,
    })
    .eq('id', driverId)
    .eq('company_id', companyId)

  if (error) {
    throw new Error('unarchive_failed')
  }
}

/**
 * Support-assisted cancel. Cron secret required — not callable by Worker JWT alone.
 */
async function handleCancel(
  req: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  const authError = await requireCronAuthorization(req)
  if (authError) return authError

  const requestId =
    typeof body.requestId === 'string' ? body.requestId.trim() : ''
  if (!isUuid(requestId)) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'invalid_request_id',
      message: 'A valid deletion request id is required.',
    })
  }

  const privilegedKey = resolvePrivilegedSupabaseKey()
  if (!privilegedKey) {
    logSafe({ event: 'account_deletion_misconfigured', action: 'cancel' })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_misconfigured',
      message: 'Account deletion cancel is misconfigured.',
    })
  }

  const admin = createAdminClient(privilegedKey)

  const existing = await admin
    .from('account_deletion_requests')
    .select(
      'id, auth_user_id, company_id, driver_id, role_context, status, requested_at, scheduled_for, processed_at, cancelled_at, processing_error',
    )
    .eq('id', requestId)
    .maybeSingle()

  if (existing.error || !existing.data) {
    return jsonResponse(req, 404, {
      ok: false,
      code: 'not_found',
      message: 'Deletion request not found.',
    })
  }

  const row = existing.data as DeletionRequestRow

  if (row.status === 'cancelled') {
    return jsonResponse(req, 200, {
      ok: true,
      code: 'already_cancelled',
      requestId: row.id,
      cancelledAt: row.cancelled_at,
      message: 'Deletion request was already cancelled.',
    })
  }

  if (row.status !== 'pending') {
    return jsonResponse(req, 409, {
      ok: false,
      code: 'not_cancellable',
      message: `Only pending requests can be cancelled (current status: ${row.status}).`,
    })
  }

  const cancelledAt = new Date().toISOString()

  const claim = await admin
    .from('account_deletion_requests')
    .update({
      status: 'cancelled',
      cancelled_at: cancelledAt,
      processing_error: null,
    })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select(
      'id, auth_user_id, company_id, driver_id, role_context, status, requested_at, scheduled_for, processed_at, cancelled_at, processing_error',
    )
    .maybeSingle()

  if (claim.error || !claim.data) {
    const raced = await admin
      .from('account_deletion_requests')
      .select(
        'id, auth_user_id, company_id, driver_id, role_context, status, requested_at, scheduled_for, processed_at, cancelled_at, processing_error',
      )
      .eq('id', row.id)
      .maybeSingle()

    if (raced.data && (raced.data as DeletionRequestRow).status === 'cancelled') {
      const cancelled = raced.data as DeletionRequestRow
      return jsonResponse(req, 200, {
        ok: true,
        code: 'already_cancelled',
        requestId: cancelled.id,
        cancelledAt: cancelled.cancelled_at,
        message: 'Deletion request was already cancelled.',
      })
    }

    return jsonResponse(req, 409, {
      ok: false,
      code: 'not_cancellable',
      message: 'Deletion request could not be cancelled.',
    })
  }

  const cancelled = claim.data as DeletionRequestRow

  try {
    await admin
      .from('company_members')
      .update({ is_active: true })
      .eq('user_id', cancelled.auth_user_id)
      .eq('company_id', cancelled.company_id)

    // Worker cancel only — never alter Worker profiles for office deletions.
    if (
      cancelled.role_context === 'worker' &&
      cancelled.driver_id
    ) {
      await unarchiveWorkerProfile(
        admin,
        cancelled.driver_id,
        cancelled.company_id,
      )
    }
  } catch {
    logSafe({
      event: 'account_deletion_cancel_restore_failed',
      requestId: cancelled.id,
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'restore_failed',
      message:
        'Request marked cancelled but membership/profile restore failed. Manual follow-up required.',
      requestId: cancelled.id,
    })
  }

  let emailSent = false
  try {
    const { data: authUserData } = await admin.auth.admin.getUserById(
      cancelled.auth_user_id,
    )
    const toEmail = authUserData.user?.email?.trim()
    if (toEmail) {
      const emailResult = await sendDeletionCancelledEmail({
        toEmail,
        requestId: cancelled.id,
      })
      emailSent = emailResult.ok
    }
  } catch {
    logSafe({
      event: 'account_deletion_cancel_email_lookup_failed',
      requestId: cancelled.id,
    })
  }

  return jsonResponse(req, 200, {
    ok: true,
    code: 'cancelled',
    requestId: cancelled.id,
    cancelledAt: cancelled.cancelled_at,
    emailSent,
    message: 'Deletion request cancelled. Access has been restored.',
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req)
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, 405, {
      ok: false,
      code: 'method_not_allowed',
      message: 'POST required.',
    })
  }

  let body: Record<string, unknown> = {}
  try {
    const parsed: unknown = await req.json()
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>
    }
  } catch {
    body = {}
  }

  const action = typeof body.action === 'string' ? body.action.trim() : 'request'

  try {
    if (action === 'process_due') {
      return await handleProcessDue(req)
    }
    if (action === 'cancel') {
      return await handleCancel(req, body)
    }
    if (action === 'request') {
      return await handleRequest(req)
    }
    return jsonResponse(req, 400, {
      ok: false,
      code: 'invalid_action',
      message: 'Unsupported action.',
    })
  } catch {
    logSafe({ event: 'account_deletion_unhandled', action })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: 'Unable to process account deletion.',
    })
  }
})

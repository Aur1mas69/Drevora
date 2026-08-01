/**
 * DREVORA Edge Function: notify-support-request
 *
 * Invoked by a Supabase Database Webhook on public.support_requests INSERT.
 * Sends a Resend operator email for request_type = 'bug' only.
 *
 * Authentication is application-level via x-drevora-support-webhook-secret only.
 * Deploy later with: supabase functions deploy notify-support-request --no-verify-jwt
 *
 * Never call this from the Worker frontend.
 */

import { timingSafeEqual } from 'jsr:@std/crypto/timing-safe-equal'
import { createClient } from 'npm:@supabase/supabase-js@2.108.2'

const WEBHOOK_SECRET_HEADER = 'x-drevora-support-webhook-secret'
const DEFAULT_EMAIL_TO = 'admin@drevora.uk'
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type DatabaseWebhookPayload = {
  type: string
  table: string
  schema: string
  record: Record<string, unknown> | null
  old_record: unknown
}

type SupportRequestRow = {
  id: string
  created_at: string
  company_id: string
  driver_id: string
  request_type: string
  title: string
  description: string
  steps_to_reproduce: string | null
  reference: string
  app_version: string
  platform: string
  route: string | null
  network_state: string
  attachment_paths: string[] | null
}

type JsonResponseBody = Record<string, unknown>

function jsonResponse(status: number, body: JsonResponseBody): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
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

/**
 * Timing-safe secret compare for Deno Edge Functions.
 * Hashes both UTF-8 strings with SHA-256 so compared buffers are always 32 bytes.
 * Never logs or throws secrets; returns false on any unexpected failure.
 */
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

/**
 * Resolve a privileged Supabase key for canonical read-only lookups.
 * Prefer legacy SUPABASE_SERVICE_ROLE_KEY, then SUPABASE_SECRET_KEYS.default.
 */
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function formatUtc(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return `${iso} (UTC)`
  return `${date.toISOString().replace(/\.\d{3}Z$/, 'Z')} (UTC)`
}

function attachmentCount(paths: string[] | null): number {
  if (!Array.isArray(paths)) return 0
  return paths.filter((path) => typeof path === 'string' && path.trim().length > 0)
    .length
}

function buildEmailBodies(params: {
  reference: string
  submittedAt: string
  companyName: string
  workerName: string
  title: string
  description: string
  stepsToReproduce: string | null
  platform: string
  appVersion: string
  route: string | null
  networkState: string
  attachments: number
  requestId: string
}): { subject: string; text: string; html: string } {
  const subject = `[DREVORA Bug] ${params.reference} — ${params.title}`
  const steps =
    params.stepsToReproduce && params.stepsToReproduce.trim().length > 0
      ? params.stepsToReproduce.trim()
      : '—'
  const route =
    params.route && params.route.trim().length > 0 ? params.route.trim() : '—'

  const text = [
    'DREVORA — New Worker bug report',
    '',
    `Reference: ${params.reference}`,
    `Submitted: ${params.submittedAt}`,
    `Company: ${params.companyName}`,
    `Worker: ${params.workerName}`,
    `Title: ${params.title}`,
    '',
    'Description:',
    params.description,
    '',
    'Steps to reproduce:',
    steps,
    '',
    `Platform: ${params.platform}`,
    `App version: ${params.appVersion}`,
    `Route: ${route}`,
    `Network state: ${params.networkState}`,
    `Attachments: ${params.attachments}`,
    `Support request UUID: ${params.requestId}`,
    '',
    'Open Supabase → Table Editor → support_requests and search for the reference above.',
    '',
    'Screenshots remain private in the support-attachments bucket and are not attached to this email.',
  ].join('\n')

  const e = {
    reference: escapeHtml(params.reference),
    submittedAt: escapeHtml(params.submittedAt),
    companyName: escapeHtml(params.companyName),
    workerName: escapeHtml(params.workerName),
    title: escapeHtml(params.title),
    description: escapeHtml(params.description).replace(/\n/g, '<br />'),
    steps: escapeHtml(steps).replace(/\n/g, '<br />'),
    platform: escapeHtml(params.platform),
    appVersion: escapeHtml(params.appVersion),
    route: escapeHtml(route),
    networkState: escapeHtml(params.networkState),
    attachments: escapeHtml(String(params.attachments)),
    requestId: escapeHtml(params.requestId),
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${e.reference}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#10233f;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #d8e0ea;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#0b1f3a;color:#ffffff;padding:18px 22px;font-size:16px;font-weight:700;">
              DREVORA · Worker bug report
            </td>
          </tr>
          <tr>
            <td style="padding:22px;">
              <p style="margin:0 0 14px;font-size:14px;line-height:1.5;">
                A new bug report was submitted in Worker Help &amp; Support.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;line-height:1.55;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#5b6b7c;width:140px;">Reference</td><td style="padding:6px 0;font-weight:600;">${e.reference}</td></tr>
                <tr><td style="padding:6px 0;color:#5b6b7c;">Submitted</td><td style="padding:6px 0;">${e.submittedAt}</td></tr>
                <tr><td style="padding:6px 0;color:#5b6b7c;">Company</td><td style="padding:6px 0;">${e.companyName}</td></tr>
                <tr><td style="padding:6px 0;color:#5b6b7c;">Worker</td><td style="padding:6px 0;">${e.workerName}</td></tr>
                <tr><td style="padding:6px 0;color:#5b6b7c;">Title</td><td style="padding:6px 0;font-weight:600;">${e.title}</td></tr>
                <tr><td style="padding:6px 0;color:#5b6b7c;">Platform</td><td style="padding:6px 0;">${e.platform}</td></tr>
                <tr><td style="padding:6px 0;color:#5b6b7c;">App version</td><td style="padding:6px 0;">${e.appVersion}</td></tr>
                <tr><td style="padding:6px 0;color:#5b6b7c;">Route</td><td style="padding:6px 0;">${e.route}</td></tr>
                <tr><td style="padding:6px 0;color:#5b6b7c;">Network</td><td style="padding:6px 0;">${e.networkState}</td></tr>
                <tr><td style="padding:6px 0;color:#5b6b7c;">Attachments</td><td style="padding:6px 0;">${e.attachments}</td></tr>
                <tr><td style="padding:6px 0;color:#5b6b7c;">Request UUID</td><td style="padding:6px 0;font-family:Consolas,Menlo,monospace;font-size:12px;">${e.requestId}</td></tr>
              </table>
              <div style="margin-top:18px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#5b6b7c;text-transform:uppercase;letter-spacing:0.04em;">Description</p>
                <p style="margin:0;font-size:13px;line-height:1.55;">${e.description}</p>
              </div>
              <div style="margin-top:16px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#5b6b7c;text-transform:uppercase;letter-spacing:0.04em;">Steps to reproduce</p>
                <p style="margin:0;font-size:13px;line-height:1.55;">${e.steps}</p>
              </div>
              <p style="margin:20px 0 0;padding:12px 14px;background:#f0f4f8;border-radius:8px;font-size:12px;line-height:1.5;color:#314356;">
                Open Supabase → Table Editor → support_requests and search for the reference above.
              </p>
              <p style="margin:12px 0 0;font-size:11px;line-height:1.45;color:#7a8a9c;">
                Screenshots remain private in support-attachments and are not included in this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' })
  }

  const webhookSecret = trimEnv('DREVORA_SUPPORT_WEBHOOK_SECRET')
  if (!webhookSecret) {
    logSafe({ event: 'notify_support_request', result: 'config_error' })
    return jsonResponse(500, { ok: false, error: 'configuration_error' })
  }

  const providedSecret = request.headers.get(WEBHOOK_SECRET_HEADER) ?? ''
  const authorized = await secretsMatch(providedSecret, webhookSecret)
  if (!authorized) {
    logSafe({ event: 'notify_support_request', result: 'unauthorized' })
    return jsonResponse(401, { ok: false, error: 'unauthorized' })
  }

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonResponse(415, { ok: false, error: 'unsupported_media_type' })
  }

  let payload: DatabaseWebhookPayload
  try {
    payload = (await request.json()) as DatabaseWebhookPayload
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_json' })
  }

  if (
    payload.schema !== 'public' ||
    payload.table !== 'support_requests' ||
    payload.type !== 'INSERT' ||
    !payload.record ||
    typeof payload.record !== 'object'
  ) {
    return jsonResponse(400, { ok: false, error: 'invalid_webhook_payload' })
  }

  const requestId = asNonEmptyString(payload.record.id)
  if (!requestId || !isUuid(requestId)) {
    return jsonResponse(400, { ok: false, error: 'invalid_record_id' })
  }

  const supabaseUrl = trimEnv('SUPABASE_URL')
  const privilegedKey = resolvePrivilegedSupabaseKey()

  if (!supabaseUrl || !privilegedKey) {
    logSafe({
      event: 'notify_support_request',
      supportRequestId: requestId,
      result: 'config_error',
      configArea: 'database',
    })
    return jsonResponse(500, { ok: false, error: 'configuration_error' })
  }

  const supabase = createClient(supabaseUrl, privilegedKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { data: row, error: rowError } = await supabase
    .from('support_requests')
    .select(
      'id, created_at, company_id, driver_id, request_type, title, description, steps_to_reproduce, reference, app_version, platform, route, network_state, attachment_paths',
    )
    .eq('id', requestId)
    .maybeSingle()
    .overrideTypes<SupportRequestRow, { merge: false }>()

  if (rowError) {
    logSafe({
      event: 'notify_support_request',
      supportRequestId: requestId,
      result: 'db_lookup_failed',
    })
    return jsonResponse(502, { ok: false, error: 'database_lookup_failed' })
  }

  if (!row) {
    logSafe({
      event: 'notify_support_request',
      supportRequestId: requestId,
      result: 'not_found',
    })
    return jsonResponse(404, { ok: false, error: 'support_request_not_found' })
  }

  const support = row
  const reference = asNonEmptyString(support.reference) ?? requestId

  if (support.request_type !== 'bug') {
    logSafe({
      event: 'notify_support_request',
      supportRequestId: requestId,
      reference,
      result: 'skipped_not_bug',
    })
    return jsonResponse(200, { ok: true, skipped: true, reason: 'not_bug' })
  }

  const resendApiKey = trimEnv('RESEND_API_KEY')
  const emailFrom = trimEnv('DREVORA_SUPPORT_EMAIL_FROM')
  const emailTo = trimEnv('DREVORA_SUPPORT_EMAIL_TO') ?? DEFAULT_EMAIL_TO

  if (!resendApiKey || !emailFrom) {
    logSafe({
      event: 'notify_support_request',
      supportRequestId: requestId,
      reference,
      result: 'config_error',
      configArea: 'email',
    })
    return jsonResponse(500, { ok: false, error: 'configuration_error' })
  }

  let companyName = 'Unknown company'
  if (isUuid(support.company_id)) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', support.company_id)
      .maybeSingle()
    const resolved = asNonEmptyString(
      company && typeof company === 'object'
        ? (company as { name?: unknown }).name
        : null,
    )
    if (resolved) companyName = resolved
  }

  let workerName = 'Unknown Worker'
  if (isUuid(support.driver_id)) {
    const { data: driver } = await supabase
      .from('drivers')
      .select('first_name, last_name')
      .eq('id', support.driver_id)
      .maybeSingle()
    if (driver && typeof driver === 'object') {
      const first = asNonEmptyString(
        (driver as { first_name?: unknown }).first_name,
      )
      const last = asNonEmptyString(
        (driver as { last_name?: unknown }).last_name,
      )
      const combined = [first, last].filter(Boolean).join(' ').trim()
      if (combined) workerName = combined
    }
  }

  const title = asNonEmptyString(support.title) ?? '(untitled)'
  const description = asNonEmptyString(support.description) ?? ''
  const { subject, text, html } = buildEmailBodies({
    reference,
    submittedAt: formatUtc(support.created_at),
    companyName,
    workerName,
    title,
    description,
    stepsToReproduce: support.steps_to_reproduce,
    platform: asNonEmptyString(support.platform) ?? '—',
    appVersion: asNonEmptyString(support.app_version) ?? '—',
    route: support.route,
    networkState: asNonEmptyString(support.network_state) ?? '—',
    attachments: attachmentCount(support.attachment_paths),
    requestId,
  })

  let resendStatus = 0
  let emailId: string | null = null

  try {
    const resendResponse = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `support-request/${requestId}`,
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [emailTo],
        subject,
        text,
        html,
      }),
    })

    resendStatus = resendResponse.status
    let resendBody: unknown = null
    try {
      resendBody = await resendResponse.json()
    } catch {
      resendBody = null
    }

    if (!resendResponse.ok) {
      logSafe({
        event: 'notify_support_request',
        supportRequestId: requestId,
        reference,
        result: 'resend_error',
        resendStatus,
      })
      return jsonResponse(502, {
        ok: false,
        error: 'email_delivery_failed',
        reference,
      })
    }

    if (
      resendBody &&
      typeof resendBody === 'object' &&
      typeof (resendBody as { id?: unknown }).id === 'string' &&
      (resendBody as { id: string }).id.trim().length > 0
    ) {
      emailId = (resendBody as { id: string }).id.trim()
    }

    logSafe({
      event: 'notify_support_request',
      supportRequestId: requestId,
      reference,
      result: 'sent',
      resendStatus,
      emailId,
    })

    return jsonResponse(200, {
      ok: true,
      reference,
      emailId,
    })
  } catch {
    logSafe({
      event: 'notify_support_request',
      supportRequestId: requestId,
      reference,
      result: 'resend_network_error',
      resendStatus,
    })
    return jsonResponse(502, {
      ok: false,
      error: 'email_delivery_failed',
      reference,
    })
  }
})

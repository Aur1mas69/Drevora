/**
 * DREVORA Edge Function: dvla-vehicle-enquiry
 *
 * Office Add/Edit Vehicle → DVLA Vehicle Enquiry Service (VES) lookup.
 *
 * - Requires authenticated Office JWT + AAL2.
 * - Never trusts company_id / role / aal / mode / endpoint / API key from the body.
 * - Mode and secrets are server-only:
 *     DVLA_VES_MODE=disabled|uat|production
 *     DVLA_VES_UAT_API_KEY
 *     DVLA_VES_API_KEY
 *
 * Deploy later (do not run from this task):
 *   supabase functions deploy dvla-vehicle-enquiry
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.108.2'
import { requireCallerAal2 } from '../_shared/requireAal2.ts'
import {
  DVLA_VES_API_KEY_ENV,
  DVLA_VES_MODE_ENV,
  DVLA_VES_UAT_API_KEY_ENV,
  formatDvlaEnquiryUserMessage,
  isPlausibleRegistrationNumber,
  mapDvlaHttpStatusToCode,
  mapDvlaResponseToVehicle,
  normalizeRegistrationNumber,
  resolveDvlaVesUpstream,
} from '../_shared/dvlaVes.ts'

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

type JsonResponseBody = Record<string, unknown>

type MembershipRow = {
  id: string
  user_id: string
  company_id: string
  role: string
  is_active: boolean
}

type EnquiryBody = {
  registrationNumber?: unknown
  /** Ignored if present — never trust browser-selected environment. */
  mode?: unknown
  environment?: unknown
  endpoint?: unknown
  apiKey?: unknown
  companyId?: unknown
  role?: unknown
  aal?: unknown
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

function createUserClient(token: string): SupabaseClient {
  const supabaseUrl = trimEnv('SUPABASE_URL')
  const anonKey = trimEnv('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase env missing')
  }
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
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

function errorStatusForCode(code: string): number {
  if (code === 'DVLA_INVALID_REGISTRATION') return 400
  if (code === 'DVLA_VEHICLE_NOT_FOUND') return 404
  if (code === 'DVLA_RATE_LIMITED') return 429
  if (code === 'DVLA_SERVICE_UNAVAILABLE') return 503
  if (code === 'DVLA_SERVICE_ERROR') return 500
  if (code === 'DVLA_DISABLED') return 403
  if (code === 'DVLA_NOT_CONFIGURED') return 503
  if (code === 'MFA_REQUIRED') return 403
  if (code === 'forbidden') return 403
  if (code === 'unauthenticated') return 401
  return 500
}

async function handleEnquiry(req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(authHeader)
  const token = match?.[1]?.trim() ?? ''
  if (!token) {
    return jsonResponse(req, 401, {
      ok: false,
      code: 'unauthenticated',
      message: formatDvlaEnquiryUserMessage('unauthenticated'),
    })
  }

  let body: EnquiryBody
  try {
    body = (await req.json()) as EnquiryBody
  } catch {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'DVLA_INVALID_REGISTRATION',
      message: formatDvlaEnquiryUserMessage('DVLA_INVALID_REGISTRATION'),
    })
  }

  const rawRegistration =
    typeof body.registrationNumber === 'string' ? body.registrationNumber : ''
  const registrationNumber = normalizeRegistrationNumber(rawRegistration)
  if (!isPlausibleRegistrationNumber(registrationNumber)) {
    return jsonResponse(req, 400, {
      ok: false,
      code: 'DVLA_INVALID_REGISTRATION',
      message: formatDvlaEnquiryUserMessage('DVLA_INVALID_REGISTRATION'),
    })
  }

  const privilegedKey = resolvePrivilegedSupabaseKey()
  if (!privilegedKey) {
    logSafe({ event: 'dvla_vehicle_enquiry_missing_service_role' })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: formatDvlaEnquiryUserMessage('server_failure'),
    })
  }

  let userClient: SupabaseClient
  try {
    userClient = createUserClient(token)
  } catch {
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: formatDvlaEnquiryUserMessage('server_failure'),
    })
  }

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user || !isUuid(user.id)) {
    return jsonResponse(req, 401, {
      ok: false,
      code: 'unauthenticated',
      message: formatDvlaEnquiryUserMessage('unauthenticated'),
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
      event: 'dvla_vehicle_enquiry_membership_lookup_failed',
      authUserId: user.id,
    })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: formatDvlaEnquiryUserMessage('server_failure'),
    })
  }

  const memberships = (membershipsResult.data ?? []) as MembershipRow[]
  if (memberships.length === 0) {
    return jsonResponse(req, 403, {
      ok: false,
      code: 'forbidden',
      message: formatDvlaEnquiryUserMessage('forbidden'),
    })
  }

  if (memberships.length > 1) {
    return jsonResponse(req, 403, {
      ok: false,
      code: 'forbidden',
      message: formatDvlaEnquiryUserMessage('forbidden'),
    })
  }

  const membership = memberships[0]
  if (!OFFICE_ROLES.has(membership.role)) {
    return jsonResponse(req, 403, {
      ok: false,
      code: 'forbidden',
      message: formatDvlaEnquiryUserMessage('forbidden'),
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

  // Mode / secrets are authoritative server-side. Body mode/endpoint/key are ignored.
  const upstream = resolveDvlaVesUpstream({
    mode: trimEnv(DVLA_VES_MODE_ENV),
    uatApiKey: trimEnv(DVLA_VES_UAT_API_KEY_ENV),
    productionApiKey: trimEnv(DVLA_VES_API_KEY_ENV),
  })

  if (!upstream.ok) {
    const status = errorStatusForCode(upstream.code)
    logSafe({
      event: 'dvla_vehicle_enquiry_mode_blocked',
      code: upstream.code,
      // Do not log keys. Mode name is safe (disabled / not configured).
    })
    return jsonResponse(req, status, {
      ok: false,
      code: upstream.code,
      message: formatDvlaEnquiryUserMessage(upstream.code),
    })
  }

  let dvlaResponse: Response
  try {
    dvlaResponse = await fetch(upstream.endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': upstream.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ registrationNumber }),
    })
  } catch {
    logSafe({
      event: 'dvla_vehicle_enquiry_upstream_network_error',
      mode: upstream.mode,
    })
    return jsonResponse(req, 503, {
      ok: false,
      code: 'DVLA_SERVICE_UNAVAILABLE',
      message: formatDvlaEnquiryUserMessage('DVLA_SERVICE_UNAVAILABLE'),
    })
  }

  if (!dvlaResponse.ok) {
    const code = mapDvlaHttpStatusToCode(dvlaResponse.status)
    logSafe({
      event: 'dvla_vehicle_enquiry_upstream_error',
      mode: upstream.mode,
      upstreamStatus: dvlaResponse.status,
      code,
    })
    return jsonResponse(req, errorStatusForCode(code), {
      ok: false,
      code,
      message: formatDvlaEnquiryUserMessage(code),
    })
  }

  let dvlaBody: unknown
  try {
    dvlaBody = await dvlaResponse.json()
  } catch {
    logSafe({
      event: 'dvla_vehicle_enquiry_upstream_invalid_json',
      mode: upstream.mode,
    })
    return jsonResponse(req, 502, {
      ok: false,
      code: 'DVLA_SERVICE_ERROR',
      message: formatDvlaEnquiryUserMessage('DVLA_SERVICE_ERROR'),
    })
  }

  const vehicle = mapDvlaResponseToVehicle(dvlaBody, registrationNumber)
  if (!vehicle) {
    return jsonResponse(req, 502, {
      ok: false,
      code: 'DVLA_SERVICE_ERROR',
      message: formatDvlaEnquiryUserMessage('DVLA_SERVICE_ERROR'),
    })
  }

  logSafe({
    event: 'dvla_vehicle_enquiry_ok',
    mode: upstream.mode,
    apiKeyEnvName: upstream.apiKeyEnvName,
  })

  return jsonResponse(req, 200, {
    ok: true,
    vehicle,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse(req)
  if (req.method !== 'POST') {
    return jsonResponse(req, 405, {
      ok: false,
      code: 'method_not_allowed',
      message: 'Method not allowed.',
    })
  }

  try {
    return await handleEnquiry(req)
  } catch {
    logSafe({ event: 'dvla_vehicle_enquiry_unhandled' })
    return jsonResponse(req, 500, {
      ok: false,
      code: 'server_failure',
      message: formatDvlaEnquiryUserMessage('server_failure'),
    })
  }
})

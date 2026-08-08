/**
 * Pure DVLA VES helpers for the Edge Function (no Deno APIs).
 * Keep behaviour aligned with src/lib/dvlaVehicleEnquiry.ts.
 */

export const DVLA_VES_UAT_ENDPOINT =
  'https://uat.driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles'

export const DVLA_VES_PRODUCTION_ENDPOINT =
  'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles'

export const DVLA_VES_MODE_ENV = 'DVLA_VES_MODE'
export const DVLA_VES_UAT_API_KEY_ENV = 'DVLA_VES_UAT_API_KEY'
export const DVLA_VES_API_KEY_ENV = 'DVLA_VES_API_KEY'

export type DvlaVesMode = 'disabled' | 'uat' | 'production'

export type DvlaVehicleSummary = {
  registrationNumber: string
  make: string | null
  yearOfManufacture: number | null
  motStatus: string | null
  motExpiryDate: string | null
  taxStatus: string | null
  taxDueDate: string | null
  colour: string | null
  fuelType: string | null
  revenueWeight: number | null
  wheelplan: string | null
  typeApproval: string | null
  euroStatus: string | null
  engineCapacity: number | null
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function normalizeRegistrationNumber(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

export function isPlausibleRegistrationNumber(normalized: string): boolean {
  return /^[A-Z0-9]{2,8}$/.test(normalized)
}

export function parseDvlaIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!ISO_DATE_RE.test(trimmed)) return null
  const [yearText, monthText, dayText] = trimmed.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (
    Number.isNaN(utc.getTime()) ||
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null
  }
  return trimmed
}

export function parseDvlaVesMode(raw: string | null | undefined): DvlaVesMode | null {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === 'disabled' || value === 'uat' || value === 'production') {
    return value
  }
  return null
}

export type ResolveDvlaVesUpstreamResult =
  | {
      ok: true
      mode: 'uat' | 'production'
      endpoint: string
      apiKey: string
      apiKeyEnvName: typeof DVLA_VES_UAT_API_KEY_ENV | typeof DVLA_VES_API_KEY_ENV
    }
  | {
      ok: false
      code: 'DVLA_DISABLED' | 'DVLA_NOT_CONFIGURED'
    }

export function resolveDvlaVesUpstream(input: {
  mode: string | null | undefined
  uatApiKey: string | null | undefined
  productionApiKey: string | null | undefined
}): ResolveDvlaVesUpstreamResult {
  const trimmedMode = typeof input.mode === 'string' ? input.mode.trim() : ''
  if (!trimmedMode) {
    return { ok: false, code: 'DVLA_DISABLED' }
  }

  const mode = parseDvlaVesMode(trimmedMode)
  if (mode == null) {
    return { ok: false, code: 'DVLA_NOT_CONFIGURED' }
  }
  if (mode === 'disabled') {
    return { ok: false, code: 'DVLA_DISABLED' }
  }

  if (mode === 'uat') {
    const apiKey =
      typeof input.uatApiKey === 'string' ? input.uatApiKey.trim() : ''
    if (!apiKey) {
      return { ok: false, code: 'DVLA_NOT_CONFIGURED' }
    }
    return {
      ok: true,
      mode: 'uat',
      endpoint: DVLA_VES_UAT_ENDPOINT,
      apiKey,
      apiKeyEnvName: DVLA_VES_UAT_API_KEY_ENV,
    }
  }

  const apiKey =
    typeof input.productionApiKey === 'string'
      ? input.productionApiKey.trim()
      : ''
  if (!apiKey) {
    return { ok: false, code: 'DVLA_NOT_CONFIGURED' }
  }
  return {
    ok: true,
    mode: 'production',
    endpoint: DVLA_VES_PRODUCTION_ENDPOINT,
    apiKey,
    apiKeyEnvName: DVLA_VES_API_KEY_ENV,
  }
}

export function mapDvlaHttpStatusToCode(status: number): string {
  if (status === 400) return 'DVLA_INVALID_REGISTRATION'
  if (status === 404) return 'DVLA_VEHICLE_NOT_FOUND'
  if (status === 429) return 'DVLA_RATE_LIMITED'
  if (status === 503) return 'DVLA_SERVICE_UNAVAILABLE'
  if (status >= 500) return 'DVLA_SERVICE_ERROR'
  return 'DVLA_SERVICE_ERROR'
}

function asOptionalTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asOptionalFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asOptionalInteger(value: unknown): number | null {
  const number = asOptionalFiniteNumber(value)
  if (number == null || !Number.isInteger(number)) return null
  return number
}

export function mapDvlaResponseToVehicle(
  body: unknown,
  fallbackRegistration: string,
): DvlaVehicleSummary | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const record = body as Record<string, unknown>
  const registration =
    asOptionalTrimmedString(record.registrationNumber)?.replace(/\s+/g, '').toUpperCase() ||
    fallbackRegistration

  return {
    registrationNumber: registration,
    make: asOptionalTrimmedString(record.make),
    yearOfManufacture: asOptionalInteger(record.yearOfManufacture),
    motStatus: asOptionalTrimmedString(record.motStatus),
    motExpiryDate: parseDvlaIsoDate(record.motExpiryDate),
    taxStatus: asOptionalTrimmedString(record.taxStatus),
    taxDueDate: parseDvlaIsoDate(record.taxDueDate),
    colour: asOptionalTrimmedString(record.colour),
    fuelType: asOptionalTrimmedString(record.fuelType),
    revenueWeight: asOptionalInteger(record.revenueWeight),
    wheelplan: asOptionalTrimmedString(record.wheelplan),
    typeApproval: asOptionalTrimmedString(record.typeApproval),
    euroStatus: asOptionalTrimmedString(record.euroStatus),
    engineCapacity: asOptionalInteger(record.engineCapacity),
  }
}

export function formatDvlaEnquiryUserMessage(code: string): string {
  switch (code) {
    case 'DVLA_INVALID_REGISTRATION':
      return 'Check the registration number and try again.'
    case 'DVLA_VEHICLE_NOT_FOUND':
      return 'Vehicle not found in DVLA records.'
    case 'DVLA_RATE_LIMITED':
      return 'DVLA request limit reached. Please try again shortly.'
    case 'DVLA_SERVICE_ERROR':
    case 'DVLA_SERVICE_UNAVAILABLE':
      return 'DVLA service is temporarily unavailable. Please try again later.'
    case 'DVLA_DISABLED':
      return 'DVLA lookup is not currently available.'
    case 'DVLA_NOT_CONFIGURED':
      return 'DVLA lookup is not configured.'
    case 'MFA_REQUIRED':
      return 'Two-factor authentication is required before you can perform this action.'
    case 'forbidden':
      return 'You do not have permission to look up vehicles with DVLA.'
    case 'unauthenticated':
      return 'Sign in required.'
    default:
      return 'Unable to look up this vehicle right now. Please try again.'
  }
}

/**
 * DVLA Vehicle Enquiry Service (VES) — shared pure helpers.
 * Security boundary is the Edge Function; VITE_DVLA_LOOKUP_ENABLED is UX only.
 */

export const DVLA_VES_UAT_ENDPOINT =
  'https://uat.driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles'

export const DVLA_VES_PRODUCTION_ENDPOINT =
  'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles'

export const DVLA_VES_MODE_ENV = 'DVLA_VES_MODE' as const
export const DVLA_VES_UAT_API_KEY_ENV = 'DVLA_VES_UAT_API_KEY' as const
export const DVLA_VES_API_KEY_ENV = 'DVLA_VES_API_KEY' as const
export const VITE_DVLA_LOOKUP_ENABLED_ENV = 'VITE_DVLA_LOOKUP_ENABLED' as const

export type DvlaVesMode = 'disabled' | 'uat' | 'production'

export type DvlaEnquiryErrorCode =
  | 'DVLA_DISABLED'
  | 'DVLA_NOT_CONFIGURED'
  | 'DVLA_INVALID_REGISTRATION'
  | 'DVLA_VEHICLE_NOT_FOUND'
  | 'DVLA_RATE_LIMITED'
  | 'DVLA_SERVICE_ERROR'
  | 'DVLA_SERVICE_UNAVAILABLE'
  | 'MFA_REQUIRED'
  | 'forbidden'
  | 'unauthenticated'
  | 'server_failure'

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

/** Documented DVLA UAT test registrations (no live calls in unit verify). */
export const DVLA_UAT_TEST_REGISTRATIONS = {
  AA19PPP: { kind: 'success' as const },
  AA19AAA: { kind: 'success' as const },
  ER19BAD: { kind: 'error' as const, httpStatus: 400 },
  ER19NFD: { kind: 'error' as const, httpStatus: 404 },
  ER19THR: { kind: 'error' as const, httpStatus: 429 },
  ER19ERR: { kind: 'error' as const, httpStatus: 500 },
  ER19MNT: { kind: 'error' as const, httpStatus: 503 },
} as const

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Trim, strip spaces, uppercase. */
export function normalizeRegistrationNumber(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

/** Local reject for blank / obviously invalid VRNs (server also enforces). */
export function isPlausibleRegistrationNumber(normalized: string): boolean {
  return /^[A-Z0-9]{2,8}$/.test(normalized)
}

/**
 * Accept only real YYYY-MM-DD calendar dates.
 * Rejects DVLA UAT placeholders such as "<1 YEAR FROM NOW>".
 */
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

/**
 * Server-side mode → endpoint + secret selection.
 * Never accept mode/endpoint/key from the browser.
 */
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

export function mapDvlaHttpStatusToCode(status: number): DvlaEnquiryErrorCode {
  if (status === 400) return 'DVLA_INVALID_REGISTRATION'
  if (status === 404) return 'DVLA_VEHICLE_NOT_FOUND'
  if (status === 429) return 'DVLA_RATE_LIMITED'
  if (status === 503) return 'DVLA_SERVICE_UNAVAILABLE'
  if (status >= 500) return 'DVLA_SERVICE_ERROR'
  return 'DVLA_SERVICE_ERROR'
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

/** UX-only flag. Not a security control. */
export function isDvlaLookupUiEnabled(
  flag: string | boolean | null | undefined,
): boolean {
  if (typeof flag === 'boolean') return flag
  if (typeof flag !== 'string') return false
  return flag.trim().toLowerCase() === 'true'
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

/** Map a DVLA VES JSON body into the DREVORA-safe vehicle summary. */
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

/** Fields that may be written into the Add/Edit Vehicle form after lookup. */
export type DvlaVehicleFormPatch = {
  registration: string
  make?: string
  year?: string
  motExpiry?: string
  roadTaxExpiry?: string
}

/**
 * Build form patch for autofill. Never includes model, VIN, type, driver, etc.
 * Omits date fields when not real YYYY-MM-DD.
 */
export function buildVehicleFormPatchFromDvla(
  vehicle: DvlaVehicleSummary,
): DvlaVehicleFormPatch {
  const patch: DvlaVehicleFormPatch = {
    registration: vehicle.registrationNumber,
  }
  if (vehicle.make) {
    patch.make = vehicle.make
  }
  if (vehicle.yearOfManufacture != null) {
    patch.year = String(vehicle.yearOfManufacture)
  }
  if (vehicle.motExpiryDate) {
    patch.motExpiry = vehicle.motExpiryDate
  }
  if (vehicle.taxDueDate) {
    patch.roadTaxExpiry = vehicle.taxDueDate
  }
  return patch
}

export type DvlaInfoPanelRow = {
  label: string
  value: string
}

/** Compact read-only panel rows — only fields that are present. */
export function buildDvlaInfoPanelRows(vehicle: DvlaVehicleSummary): DvlaInfoPanelRow[] {
  const rows: Array<[string, string | null]> = [
    ['MOT status', vehicle.motStatus],
    ['Tax status', vehicle.taxStatus],
    ['Colour', vehicle.colour],
    ['Fuel type', vehicle.fuelType],
    [
      'Revenue weight',
      vehicle.revenueWeight != null ? String(vehicle.revenueWeight) : null,
    ],
    ['Wheelplan', vehicle.wheelplan],
    ['Type approval', vehicle.typeApproval],
    ['Euro status', vehicle.euroStatus],
  ]
  return rows
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, value]) => ({ label, value }))
}

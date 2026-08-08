/**
 * Admin Vehicles → DVLA VES lookup via Edge Function.
 * Uses authenticated browser client only (never service-role / DVLA keys).
 */
import {
  formatDvlaEnquiryUserMessage,
  isPlausibleRegistrationNumber,
  normalizeRegistrationNumber,
  type DvlaVehicleSummary,
} from '@/lib/dvlaVehicleEnquiry'
import { parseFunctionsInvokeErrorBody } from '@/lib/workerInvitation'
import { requireSupabase } from '@/lib/supabase'

export class DvlaVehicleEnquiryServiceError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'DvlaVehicleEnquiryServiceError'
    this.code = code
  }
}

type FunctionsInvokeErrorLike = {
  message?: string
  context?: unknown
  name?: string
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isVehicleSummary(value: unknown): value is DvlaVehicleSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.registrationNumber === 'string'
}

/**
 * Look up a vehicle registration via dvla-vehicle-enquiry.
 * Never send mode / endpoint / API key / companyId / role / aal.
 */
export async function enquireDvlaVehicle(
  registrationNumberRaw: string,
): Promise<DvlaVehicleSummary> {
  const registrationNumber = normalizeRegistrationNumber(registrationNumberRaw)
  if (!isPlausibleRegistrationNumber(registrationNumber)) {
    throw new DvlaVehicleEnquiryServiceError(
      'DVLA_INVALID_REGISTRATION',
      formatDvlaEnquiryUserMessage('DVLA_INVALID_REGISTRATION'),
    )
  }

  const body = { registrationNumber }

  let data: unknown
  let error: FunctionsInvokeErrorLike | null = null

  try {
    const result = await requireSupabase().functions.invoke(
      'dvla-vehicle-enquiry',
      { body },
    )
    data = result.data
    error = result.error
  } catch {
    throw new DvlaVehicleEnquiryServiceError(
      'server_failure',
      formatDvlaEnquiryUserMessage('server_failure'),
    )
  }

  if (error) {
    const parsed = await parseFunctionsInvokeErrorBody({ error, data })
    throw new DvlaVehicleEnquiryServiceError(
      parsed.code,
      formatDvlaEnquiryUserMessage(parsed.code),
    )
  }

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    (data as { ok?: unknown }).ok !== true
  ) {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const record = data as Record<string, unknown>
      const code = asNonEmptyString(record.code) || 'server_failure'
      throw new DvlaVehicleEnquiryServiceError(
        code,
        formatDvlaEnquiryUserMessage(code),
      )
    }
    throw new DvlaVehicleEnquiryServiceError(
      'server_failure',
      formatDvlaEnquiryUserMessage('server_failure'),
    )
  }

  const vehicle = (data as { vehicle?: unknown }).vehicle
  if (!isVehicleSummary(vehicle)) {
    throw new DvlaVehicleEnquiryServiceError(
      'DVLA_SERVICE_ERROR',
      formatDvlaEnquiryUserMessage('DVLA_SERVICE_ERROR'),
    )
  }

  return vehicle
}

export const dvlaVehicleEnquiryService = {
  enquireDvlaVehicle,
}

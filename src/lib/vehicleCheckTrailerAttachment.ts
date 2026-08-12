import type { VehicleCheckTrailerSource } from '@/lib/vehicleCheckTypes'
import { normalizeRegistrationForSearch } from '@/lib/vehicleRegistrationSearch'
import {
  isTrailerFleetAsset,
  isTrailerVehicleType,
  type Vehicle,
} from '@/services/vehiclesService'

/**
 * Form + write payload for attaching an optional trailer to a Vehicle Check.
 * `vehicle_checks.vehicle_id` remains the towing/powered vehicle.
 */
export type VehicleCheckTrailerDraft = {
  source: VehicleCheckTrailerSource
  trailerVehicleId: string | null
  trailerNumberSnapshot: string | null
  trailerRegistrationSnapshot: string | null
  trailerLabelSnapshot: string | null
}

export type VehicleCheckTrailerWriteFields = {
  trailerSource: VehicleCheckTrailerSource
  trailerVehicleId: string | null
  trailerNumberSnapshot: string | null
  trailerRegistrationSnapshot: string | null
  trailerLabelSnapshot: string | null
}

export const DEFAULT_VEHICLE_CHECK_TRAILER_DRAFT: VehicleCheckTrailerDraft = {
  source: 'none',
  trailerVehicleId: null,
  trailerNumberSnapshot: null,
  trailerRegistrationSnapshot: null,
  trailerLabelSnapshot: null,
}

export function emptyVehicleCheckTrailerDraft(): VehicleCheckTrailerDraft {
  return { ...DEFAULT_VEHICLE_CHECK_TRAILER_DRAFT }
}

/** Powered/towing vehicles only — never Trailer rows. Low Loader stays powered. */
export function filterPoweredVehiclesForVehicleCheck(vehicles: Vehicle[]): Vehicle[] {
  return vehicles.filter((vehicle) => !isTrailerFleetAsset(vehicle))
}

/** Active company fleet trailers (`vehicle_type === 'Trailer'` only). */
export function filterCompanyTrailersForVehicleCheck(vehicles: Vehicle[]): Vehicle[] {
  return vehicles.filter((vehicle) => isTrailerFleetAsset(vehicle))
}

export function isPoweredVehicleForVehicleCheck(
  vehicle: Pick<Vehicle, 'vehicleType'> | null | undefined,
): boolean {
  if (!vehicle) return false
  return !isTrailerVehicleType(vehicle.vehicleType)
}

export function companyTrailerPrimaryLabel(vehicle: Vehicle): string {
  return vehicle.trailerNumber?.trim() || 'No trailer number'
}

export function companyTrailerSecondaryLabel(vehicle: Vehicle): string {
  const makeModel = `${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim()
  const parts = [
    vehicle.trailerType?.trim() || null,
    vehicle.registration?.trim() || null,
    makeModel || null,
  ].filter(Boolean)
  return parts.join(' · ')
}

export function trailerMatchesSearchQuery(vehicle: Vehicle, query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return true

  const lower = trimmed.toLowerCase()
  const normalizedQuery = normalizeRegistrationForSearch(trimmed)
  const number = vehicle.trailerNumber?.toLowerCase() ?? ''
  const type = vehicle.trailerType?.toLowerCase() ?? ''
  const make = vehicle.make?.toLowerCase() ?? ''
  const model = vehicle.model?.toLowerCase() ?? ''
  const registration = normalizeRegistrationForSearch(vehicle.registration)

  return (
    number.includes(lower) ||
    type.includes(lower) ||
    make.includes(lower) ||
    model.includes(lower) ||
    (normalizedQuery.length > 0 && registration.includes(normalizedQuery))
  )
}

export function formatThirdPartyTrailerLabel(identifier: string): string {
  const trimmed = identifier.trim()
  return trimmed ? `Third-party — ${trimmed}` : ''
}

/**
 * Switching trailer modes must drop the previous mode's identity.
 * Company → none/third_party clears the company FK.
 * Third-party → none/company clears the manual identifier.
 */
export function applyVehicleCheckTrailerSource(
  _current: VehicleCheckTrailerDraft,
  nextSource: VehicleCheckTrailerSource,
): VehicleCheckTrailerDraft {
  return {
    source: nextSource,
    trailerVehicleId: null,
    trailerNumberSnapshot: null,
    trailerRegistrationSnapshot: null,
    trailerLabelSnapshot: null,
  }
}

export function selectCompanyTrailerForVehicleCheck(
  trailer: Vehicle,
): VehicleCheckTrailerDraft {
  return {
    source: 'company',
    trailerVehicleId: trailer.id,
    // Company snapshots are filled by the DB before-write trigger.
    trailerNumberSnapshot: null,
    trailerRegistrationSnapshot: null,
    trailerLabelSnapshot: null,
  }
}

export function setThirdPartyTrailerIdentity(
  identifier: string,
  registration: string,
): VehicleCheckTrailerDraft {
  const number = identifier.trim()
  const reg = registration.trim()
  return {
    source: 'third_party',
    trailerVehicleId: null,
    trailerNumberSnapshot: number || null,
    trailerRegistrationSnapshot: reg || null,
    trailerLabelSnapshot: number ? formatThirdPartyTrailerLabel(number) : null,
  }
}

export function validateVehicleCheckTrailerDraft(
  draft: VehicleCheckTrailerDraft,
  companyTrailers: Vehicle[] = [],
): string | null {
  if (draft.source === 'none') return null

  if (draft.source === 'company') {
    if (!draft.trailerVehicleId?.trim()) {
      return 'Select a company trailer, or choose No trailer.'
    }
    const trailer = companyTrailers.find((row) => row.id === draft.trailerVehicleId)
    if (trailer && !trailer.trailerNumber?.trim()) {
      return 'Selected company trailer has no trailer number. Set trailer number on the trailer record first.'
    }
    return null
  }

  if (!draft.trailerNumberSnapshot?.trim()) {
    return 'Enter a trailer identifier / number, or choose No trailer.'
  }
  return null
}

export function isVehicleCheckTrailerDraftReady(
  draft: VehicleCheckTrailerDraft,
  companyTrailers: Vehicle[] = [],
): boolean {
  return validateVehicleCheckTrailerDraft(draft, companyTrailers) == null
}

export function toVehicleCheckTrailerWriteFields(
  draft: VehicleCheckTrailerDraft,
): VehicleCheckTrailerWriteFields {
  if (draft.source === 'none') {
    return {
      trailerSource: 'none',
      trailerVehicleId: null,
      trailerNumberSnapshot: null,
      trailerRegistrationSnapshot: null,
      trailerLabelSnapshot: null,
    }
  }

  if (draft.source === 'company') {
    return {
      trailerSource: 'company',
      trailerVehicleId: draft.trailerVehicleId,
      trailerNumberSnapshot: null,
      trailerRegistrationSnapshot: null,
      trailerLabelSnapshot: null,
    }
  }

  return {
    trailerSource: 'third_party',
    trailerVehicleId: null,
    trailerNumberSnapshot: draft.trailerNumberSnapshot,
    trailerRegistrationSnapshot: draft.trailerRegistrationSnapshot,
    trailerLabelSnapshot: draft.trailerLabelSnapshot,
  }
}

/** Company trailer `vehicles.trailer_type` only. Third-party and none return null. */
export function getCompanyTrailerTypeForDraft(
  draft: VehicleCheckTrailerDraft,
  companyTrailers: Vehicle[],
): string | null {
  if (draft.source !== 'company' || !draft.trailerVehicleId) return null
  return (
    companyTrailers.find((row) => row.id === draft.trailerVehicleId)?.trailerType?.trim() ||
    null
  )
}

export function formatVehicleCheckTrailerSummary(
  draft: VehicleCheckTrailerDraft,
  companyTrailers: Vehicle[],
): string {
  if (draft.source === 'none') return 'No trailer'

  if (draft.source === 'company') {
    const trailer = companyTrailers.find((row) => row.id === draft.trailerVehicleId)
    if (!trailer) return 'Company trailer'
    const secondary = companyTrailerSecondaryLabel(trailer)
    return secondary
      ? `${companyTrailerPrimaryLabel(trailer)} · ${secondary}`
      : companyTrailerPrimaryLabel(trailer)
  }

  return draft.trailerLabelSnapshot?.trim() || formatThirdPartyTrailerLabel(
    draft.trailerNumberSnapshot ?? '',
  ) || 'Third-party trailer'
}

import { requireVerifiedCompanyId } from '@/lib/companySettingsGlobals'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import {
  formatVehiclePlanLimitError,
  isVehiclePlanLimitError,
  VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE,
  VEHICLE_PLAN_LIMIT_REACHED,
} from '@/lib/vehicleAllowance'
import { todayString } from '@/lib/vehicleAvailability'

export const vehicleTypeOptions = [
  'Car',
  'Van',
  'Pickup',
  '3.5t Van',
  '7.5t Lorry',
  '12t Rigid',
  '18t Rigid',
  '26t Rigid',
  '32t Rigid',
  'Artic Tractor Unit',
  'Trailer',
  'Box Lorry',
  'Curtain Side Lorry',
  'Flatbed Lorry',
  'Tipper',
  'Grab Lorry',
  'Skip Lorry',
  'Hook Loader',
  'RoRo / Roll-on Roll-off',
  'Volumetric Concrete Mixer',
  'Concrete Mixer Drum',
  'Concrete Pump',
  'Tanker',
  'Fuel Tanker',
  'Water Tanker',
  'Waste Tanker',
  'Refrigerated Vehicle',
  'Low Loader',
  'Plant / Machinery',
  'Forklift',
  'Telehandler',
  'Yard Vehicle',
  'Other',
] as const

export type VehicleType = (typeof vehicleTypeOptions)[number]

const vehicleTypeOptionSet = new Set<string>(vehicleTypeOptions)

export function getVehicleTypeSelectOptions(currentValue?: string | null): string[] {
  const trimmed = currentValue?.trim()
  if (!trimmed || vehicleTypeOptionSet.has(trimmed)) {
    return [...vehicleTypeOptions]
  }

  return [trimmed, ...vehicleTypeOptions]
}

export type VehicleStatus =
  | 'Available'
  | 'Assigned'
  | 'Workshop'
  | 'Maintenance'
  | 'Out of Service'
  | 'Off Road'
  | 'Reserved'

export type OffRoadReason =
  | 'Accident'
  | 'Mechanical Failure'
  | 'Awaiting Parts'
  | 'Insurance Expired'
  | 'MOT Expired'
  | 'SORN'
  | 'Other'

export type AvailabilityReason =
  | OffRoadReason
  | 'Service'
  | 'Repair'
  | 'MOT'
  | 'Inspection'
  | 'Tyres'
  | 'Other'

export type VehicleAvailability = {
  id: string
  createdAt: string
  vehicleId: string
  status: VehicleStatus
  startDate: string
  endDate: string | null
  reason: string | null
  notes: string | null
}

export type VehicleAvailabilityInput = {
  vehicleId: string
  status: VehicleStatus
  startDate: string
  endDate: string
  reason: string
  notes: string
}

export type Vehicle = {
  id: string
  createdAt: string
  registration: string
  fleetNumber: string | null
  trailerNumber: string | null
  make: string
  model: string
  year: number | null
  vin: string | null
  currentOdometer: number | null
  vehicleType: string | null
  baseStatus: VehicleStatus
  status: VehicleStatus
  availabilityStatus: VehicleStatus
  currentDriverId: string | null
  insuranceExpiry: string | null
  motExpiry: string | null
  roadTaxExpiry: string | null
  tachographExpiry: string | null
  offRoadReason: OffRoadReason | null
  offRoadStartDate: string | null
  offRoadExpectedReturnDate: string | null
  offRoadStart: string | null
  offRoadReturn: string | null
  offRoadNotes: string | null
  notes: string | null
  availabilityRecords: VehicleAvailability[]
  /** Null = active plan seat. Set when archived (former Vehicle). */
  archivedAt: string | null
}

export type VehicleInput = {
  registration: string
  fleetNumber: string
  trailerNumber: string
  vehicleType: string
  make: string
  model: string
  year: string
  vin: string
  currentOdometer: string
  status: VehicleStatus
  currentDriverId: string
  insuranceExpiry: string
  motExpiry: string
  roadTaxExpiry: string
  tachographExpiry: string
  offRoadReason: OffRoadReason | ''
  offRoadStartDate: string
  offRoadExpectedReturnDate: string
  offRoadNotes: string
  notes: string
}

type VehicleRow = {
  id: string
  created_at: string
  registration: string | null
  fleet_number: string | null
  trailer_number: string | null
  vehicle_type: string | null
  make: string
  model: string
  year: number | null
  vin: string | null
  current_odometer: number | null
  status: string | null
  availability_status: string | null
  current_driver_id: string | null
  insurance_expiry: string | null
  mot_expiry: string | null
  road_tax_expiry: string | null
  tachograph_expiry: string | null
  off_road_reason: string | null
  off_road_start_date: string | null
  off_road_expected_return_date: string | null
  off_road_start: string | null
  off_road_return: string | null
  off_road_notes: string | null
  notes: string | null
  archived_at?: string | null
}

type VehicleAvailabilityRow = {
  id: string
  created_at: string
  vehicle_id: string
  status: string
  start_date: string
  end_date: string | null
  reason: string | null
  notes: string | null
}

export class VehiclesServiceError extends Error {
  readonly code: string | null

  constructor(message: string, code: string | null = null) {
    super(message)
    this.name = 'VehiclesServiceError'
    this.code = code
  }
}

function planLimitErrorCodeFromMessage(message: string): string | null {
  const upper = message.toUpperCase()
  if (upper.includes(VEHICLE_PLAN_LIMIT_REACHED)) return VEHICLE_PLAN_LIMIT_REACHED
  if (upper.includes(VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE)) {
    return VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE
  }
  return null
}

function isMissingColumnError(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? '').toLowerCase()
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    message.includes('schema cache') ||
    message.includes('could not find the') ||
    (message.includes('column') && message.includes('does not exist'))
  )
}

/**
 * Returns the set of vehicle ids owned by the verified company. Used to scope
 * the child vehicle_availability table (which has no company_id column; Phase 1
 * scopes children via their parent).
 */
async function fetchCompanyVehicleIds(companyId: string): Promise<string[]> {
  const { data, error } = await requireSupabase()
    .from('vehicles')
    .select('id')
    .eq('company_id', companyId)

  if (error) {
    throw new VehiclesServiceError(error.message)
  }

  return (data ?? []).map((row) => (row as { id: string }).id)
}

/** Verifies a vehicle belongs to the verified company before a child write. */
async function assertVehicleInCompany(
  vehicleId: string,
  companyId: string,
): Promise<void> {
  const { data, error } = await requireSupabase()
    .from('vehicles')
    .select('id')
    .eq('id', vehicleId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw new VehiclesServiceError(error.message)
  }

  if (!data) {
    throw new VehiclesServiceError(
      'That vehicle is not available for your company.',
    )
  }
}

function logVehicleSaveError(payload: unknown, error: unknown) {
  const supabaseError = error as {
    code?: string
    message?: string
    details?: string
    hint?: string
  } | null

  console.error('[vehiclesService] Vehicle save failed:', {
    code: supabaseError?.code,
    message: supabaseError?.message,
    details: supabaseError?.details,
    hint: supabaseError?.hint,
  })

  if (import.meta.env.DEV) {
    console.error('[vehiclesService] Vehicle save payload:', payload)
  }
}

function isVehicleStatus(value: string | null): value is VehicleStatus {
  return (
    value === 'Available' ||
    value === 'Assigned' ||
    value === 'Workshop' ||
    value === 'Maintenance' ||
    value === 'Out of Service' ||
    value === 'Off Road' ||
    value === 'Reserved'
  )
}

function isOffRoadReason(value: string | null): value is OffRoadReason {
  return (
    value === 'Accident' ||
    value === 'Mechanical Failure' ||
    value === 'Awaiting Parts' ||
    value === 'Insurance Expired' ||
    value === 'MOT Expired' ||
    value === 'SORN' ||
    value === 'Other'
  )
}

function parseOptionalInteger(value: string): number | null {
  const trimmedValue = value.trim()
  if (!trimmedValue) return null

  const parsedValue = Number.parseInt(trimmedValue, 10)
  return Number.isNaN(parsedValue) ? null : parsedValue
}

function mapAvailabilityRow(row: VehicleAvailabilityRow): VehicleAvailability {
  return {
    id: row.id,
    createdAt: row.created_at,
    vehicleId: row.vehicle_id,
    status: isVehicleStatus(row.status) ? row.status : 'Available',
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    notes: row.notes,
  }
}

export function getVehicleStatusForDate(
  vehicle: Vehicle,
  date = todayString(),
): VehicleStatus {
  const matchingRecords = vehicle.availabilityRecords
    .filter((record) => {
      return record.startDate <= date && (!record.endDate || record.endDate >= date)
    })
    .sort((firstRecord, secondRecord) =>
      secondRecord.startDate.localeCompare(firstRecord.startDate),
    )

  return matchingRecords[0]?.status ?? vehicle.baseStatus ?? vehicle.status ?? 'Available'
}

function applyAvailabilityStatus(
  vehicle: Vehicle,
  availabilityRecords: VehicleAvailability[],
): Vehicle {
  const vehicleAvailabilityRecords = availabilityRecords.filter(
    (record) => record.vehicleId === vehicle.id,
  )

  return {
    ...vehicle,
    availabilityRecords: vehicleAvailabilityRecords,
    status:
      vehicleAvailabilityRecords.length > 0
        ? getVehicleStatusForDate({
            ...vehicle,
            availabilityRecords: vehicleAvailabilityRecords,
          })
        : vehicle.baseStatus,
  }
}

function mapVehicleRow(row: VehicleRow): Vehicle {
  const baseStatus = isVehicleStatus(row.status) ? row.status : 'Available'
  const availabilityStatus = isVehicleStatus(row.availability_status)
    ? row.availability_status
    : baseStatus

  return {
    id: row.id,
    createdAt: row.created_at,
    registration: row.registration?.trim() || '',
    fleetNumber: row.fleet_number,
    trailerNumber: row.trailer_number?.trim() || null,
    vehicleType: row.vehicle_type?.trim() || null,
    make: row.make,
    model: row.model,
    year: row.year,
    vin: row.vin,
    currentOdometer: row.current_odometer,
    baseStatus,
    status: baseStatus,
    availabilityStatus,
    currentDriverId: row.current_driver_id,
    insuranceExpiry: row.insurance_expiry,
    motExpiry: row.mot_expiry,
    roadTaxExpiry: row.road_tax_expiry,
    tachographExpiry: row.tachograph_expiry,
    offRoadReason: isOffRoadReason(row.off_road_reason)
      ? row.off_road_reason
      : null,
    offRoadStartDate: row.off_road_start ?? row.off_road_start_date,
    offRoadExpectedReturnDate:
      row.off_road_return ?? row.off_road_expected_return_date,
    offRoadStart: row.off_road_start,
    offRoadReturn: row.off_road_return,
    offRoadNotes: row.off_road_notes,
    notes: row.notes,
    availabilityRecords: [],
    archivedAt: row.archived_at?.trim() || null,
  }
}

const vehicleSelect =
  'id, created_at, registration, fleet_number, trailer_number, vehicle_type, make, model, year, vin, current_odometer, status, availability_status, current_driver_id, insurance_expiry, mot_expiry, road_tax_expiry, tachograph_expiry, off_road_reason, off_road_start_date, off_road_expected_return_date, off_road_start, off_road_return, off_road_notes, notes, archived_at'

const vehicleSelectLegacy =
  'id, created_at, registration, fleet_number, trailer_number, vehicle_type, make, model, year, vin, current_odometer, status, availability_status, current_driver_id, insurance_expiry, mot_expiry, road_tax_expiry, tachograph_expiry, off_road_reason, off_road_start_date, off_road_expected_return_date, off_road_start, off_road_return, off_road_notes, notes'

const vehicleAvailabilitySelect =
  'id, created_at, vehicle_id, status, start_date, end_date, reason, notes'

function isTrailerVehicleType(vehicleType: string): boolean {
  return vehicleType.trim() === 'Trailer'
}

function mapVehicleWriteError(error: unknown): never {
  const supabaseError = error as {
    code?: string
    message?: string
    details?: string
    hint?: string
  } | null

  const message = `${supabaseError?.message ?? ''} ${supabaseError?.details ?? ''} ${supabaseError?.hint ?? ''}`
  const planCode = planLimitErrorCodeFromMessage(message)
  if (planCode || isVehiclePlanLimitError({ message, code: supabaseError?.code ?? null })) {
    throw new VehiclesServiceError(
      formatVehiclePlanLimitError({ message, code: planCode }),
      planCode ?? planLimitErrorCodeFromMessage(message),
    )
  }

  const isDuplicateTrailerNumber =
    supabaseError?.code === '23505' &&
    (message.includes('trailer_number') ||
      message.includes('vehicles_company_trailer_number'))

  if (isDuplicateTrailerNumber) {
    throw new VehiclesServiceError('This trailer number is already in use.')
  }

  if (error instanceof VehiclesServiceError) {
    throw error
  }

  if (error instanceof Error && error.message.trim()) {
    throw new VehiclesServiceError(error.message)
  }

  throw new VehiclesServiceError(
    'Unable to save vehicle. Please check the details and try again.',
  )
}

function buildVehiclePayload(input: VehicleInput) {
  const isTrailer = isTrailerVehicleType(input.vehicleType)
  const trimmedRegistration = input.registration.trim()

  return {
    // vehicles has no legacy company text column (Phase 1); company_id only.
    registration: isTrailer
      ? trimmedRegistration
        ? trimmedRegistration.toUpperCase()
        : null
      : trimmedRegistration.toUpperCase(),
    fleet_number: input.fleetNumber.trim() || null,
    trailer_number: isTrailer ? input.trailerNumber.trim() || null : null,
    vehicle_type: input.vehicleType.trim(),
    make: input.make.trim(),
    model: input.model.trim(),
    year: parseOptionalInteger(input.year),
    vin: input.vin.trim() || null,
    current_odometer: parseOptionalInteger(input.currentOdometer),
    status: input.status,
    availability_status: input.status,
    current_driver_id:
      input.status === 'Off Road' ? null : input.currentDriverId || null,
    insurance_expiry: input.insuranceExpiry || null,
    mot_expiry: input.motExpiry || null,
    road_tax_expiry: input.roadTaxExpiry || null,
    tachograph_expiry: input.tachographExpiry || null,
    off_road_reason:
      input.status === 'Off Road' ? input.offRoadReason || null : null,
    off_road_start_date:
      input.status === 'Off Road' ? input.offRoadStartDate || null : null,
    off_road_expected_return_date:
      input.status === 'Off Road'
        ? input.offRoadExpectedReturnDate || null
        : null,
    off_road_start:
      input.status === 'Off Road' ? input.offRoadStartDate || null : null,
    off_road_return:
      input.status === 'Off Road'
        ? input.offRoadExpectedReturnDate || null
        : null,
    off_road_notes:
      input.status === 'Off Road' ? input.offRoadNotes.trim() || null : null,
    notes: input.notes.trim() || null,
  }
}

export async function fetchPlanningAvailabilityRecords(
  year: number,
): Promise<VehicleAvailability[]> {
  const companyId = requireVerifiedCompanyId()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const vehicleIds = await fetchCompanyVehicleIds(companyId)
  if (vehicleIds.length === 0) return []

  const { data, error } = await requireSupabase()
    .from('vehicle_availability')
    .select(vehicleAvailabilitySelect)
    .in('vehicle_id', vehicleIds)
    .lte('start_date', yearEnd)
    .or(`end_date.is.null,end_date.gte.${yearStart}`)
    .order('start_date', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    return []
  }

  return (data ?? []).map((row) =>
    mapAvailabilityRow(row as VehicleAvailabilityRow),
  )
}

async function fetchRelevantAvailabilityRecords(
  companyVehicleIds: string[],
  rangeStart?: string,
): Promise<VehicleAvailability[]> {
  if (companyVehicleIds.length === 0) return []

  const today = todayString()
  const startDate = rangeStart ?? today

  const { data, error } = await requireSupabase()
    .from('vehicle_availability')
    .select(vehicleAvailabilitySelect)
    .in('vehicle_id', companyVehicleIds)
    .or(`end_date.is.null,end_date.gte.${startDate},start_date.gte.${startDate}`)
    .order('start_date', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    return []
  }

  return (data ?? []).map((row) =>
    mapAvailabilityRow(row as VehicleAvailabilityRow),
  )
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const table = 'vehicles'
  const companyId = requireVerifiedCompanyId()
  let data: unknown[] | null = null
  let errorMessage: string | null = null
  let errorCode: string | undefined

  {
    const primary = await requireSupabase()
      .from(table)
      .select(vehicleSelect)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    data = primary.data
    errorMessage = primary.error?.message ?? null
    errorCode = primary.error?.code

    if (primary.error && isMissingColumnError(primary.error)) {
      const legacy = await requireSupabase()
        .from(table)
        .select(vehicleSelectLegacy)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
      data = legacy.data
      errorMessage = legacy.error?.message ?? null
      errorCode = legacy.error?.code
    }
  }

  logSupabaseQuery({
    service: 'vehiclesService.fetchVehicles',
    table,
    data,
    error: errorMessage ? { message: errorMessage, code: errorCode } : null,
  })

  if (errorMessage) {
    throw new VehiclesServiceError(errorMessage)
  }

  const vehicles = (data ?? []).map((row) => mapVehicleRow(row as VehicleRow))
  const availabilityRecords = await fetchRelevantAvailabilityRecords(
    vehicles.map((vehicle) => vehicle.id),
  )

  logSupabaseQuery({
    service: 'vehiclesService.fetchRelevantAvailabilityRecords',
    table: 'vehicle_availability',
    data: availabilityRecords,
    error: null,
  })

  return vehicles.map((vehicle) =>
    applyAvailabilityStatus(vehicle, availabilityRecords),
  )
}

export async function fetchVehicleTimelineRecords(
  vehicleId: string,
): Promise<VehicleAvailability[]> {
  const companyId = requireVerifiedCompanyId()
  await assertVehicleInCompany(vehicleId, companyId)
  return fetchAvailabilityRecords(vehicleId)
}

export async function fetchVehicleById(id: string): Promise<Vehicle | null> {
  const companyId = requireVerifiedCompanyId()
  let data: unknown | null = null
  let errorMessage: string | null = null

  {
    const primary = await requireSupabase()
      .from('vehicles')
      .select(vehicleSelect)
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    data = primary.data
    errorMessage = primary.error?.message ?? null

    // Live DB may not have archived_at until the vehicle-archive migration is applied.
    // Match fetchVehicles(): fall back to the legacy column set so profile load still works.
    if (primary.error && isMissingColumnError(primary.error)) {
      const legacy = await requireSupabase()
        .from('vehicles')
        .select(vehicleSelectLegacy)
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle()
      data = legacy.data
      errorMessage = legacy.error?.message ?? null
    }
  }

  if (errorMessage) {
    throw new VehiclesServiceError(
      'Unable to load vehicle details. Please try again.',
    )
  }

  if (!data) return null

  const vehicle = mapVehicleRow(data as VehicleRow)
  const availabilityRecords = await fetchAvailabilityRecords(id)

  return applyAvailabilityStatus(vehicle, availabilityRecords)
}

export async function fetchVehicleTypeById(vehicleId: string): Promise<string | null> {
  const companyId = requireVerifiedCompanyId()
  const { data, error } = await requireSupabase()
    .from('vehicles')
    .select('vehicle_type')
    .eq('id', vehicleId)
    .eq('company_id', companyId)
    .maybeSingle()

  logSupabaseQuery({
    service: 'vehiclesService.fetchVehicleTypeById',
    table: 'vehicles',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new VehiclesServiceError(error.message)
  }

  const vehicleType = (data as { vehicle_type?: string | null } | null)?.vehicle_type?.trim()
  return vehicleType || null
}

export async function fetchAvailabilityRecords(
  vehicleId?: string,
): Promise<VehicleAvailability[]> {
  let query = requireSupabase()
    .from('vehicle_availability')
    .select(vehicleAvailabilitySelect)
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (vehicleId) {
    query = query.eq('vehicle_id', vehicleId)
  }

  const { data, error } = await query

  if (error) {
    return []
  }

  return (data ?? []).map((row) =>
    mapAvailabilityRow(row as VehicleAvailabilityRow),
  )
}

export async function updateAvailabilityRecord(
  id: string,
  input: VehicleAvailabilityInput,
): Promise<VehicleAvailability> {
  const companyId = requireVerifiedCompanyId()
  // Both the target availability row and the destination vehicle must belong
  // to the verified company (child table scoped via parent vehicle).
  const companyVehicleIds = await fetchCompanyVehicleIds(companyId)
  if (!companyVehicleIds.includes(input.vehicleId)) {
    throw new VehiclesServiceError(
      'That vehicle is not available for your company.',
    )
  }

  const payload = {
    vehicle_id: input.vehicleId,
    status: input.status,
    start_date: input.startDate,
    end_date: input.endDate || null,
    reason: input.reason.trim() || null,
    notes: input.notes.trim() || null,
  }

  const { data, error } = await requireSupabase()
    .from('vehicle_availability')
    .update(payload)
    .eq('id', id)
    .in('vehicle_id', companyVehicleIds)
    .select(vehicleAvailabilitySelect)
    .maybeSingle()

  if (error) {
    logVehicleSaveError({ id, ...payload }, error)
    throw error
  }

  if (!data) {
    throw new VehiclesServiceError(
      'Availability record could not be updated for your company.',
    )
  }

  return mapAvailabilityRow(data as VehicleAvailabilityRow)
}

export async function deleteAvailabilityRecord(id: string): Promise<void> {
  const companyId = requireVerifiedCompanyId()
  const companyVehicleIds = await fetchCompanyVehicleIds(companyId)
  if (companyVehicleIds.length === 0) {
    throw new VehiclesServiceError(
      'Availability record could not be deleted for your company.',
    )
  }

  const { data, error } = await requireSupabase()
    .from('vehicle_availability')
    .delete()
    .eq('id', id)
    .in('vehicle_id', companyVehicleIds)
    .select('id')

  if (error) {
    logVehicleSaveError({ id }, error)
    throw error
  }

  if ((data ?? []).length === 0) {
    throw new VehiclesServiceError(
      'Availability record could not be deleted for your company.',
    )
  }
}

export async function createAvailabilityRecord(
  input: VehicleAvailabilityInput,
): Promise<VehicleAvailability> {
  const companyId = requireVerifiedCompanyId()
  await assertVehicleInCompany(input.vehicleId, companyId)

  const payload = {
    vehicle_id: input.vehicleId,
    status: input.status,
    start_date: input.startDate,
    end_date: input.endDate || null,
    reason: input.reason.trim() || null,
    notes: input.notes.trim() || null,
  }

  const { data, error } = await requireSupabase()
    .from('vehicle_availability')
    .insert(payload)
    .select(vehicleAvailabilitySelect)
    .single()

  if (error) {
    logVehicleSaveError(payload, error)
    throw error
  }

  return mapAvailabilityRow(data as VehicleAvailabilityRow)
}

async function assertDriverInCompany(
  driverId: string,
  companyId: string,
): Promise<void> {
  const { data, error } = await requireSupabase()
    .from('drivers')
    .select('id')
    .eq('id', driverId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw new VehiclesServiceError(error.message)
  }

  if (!data) {
    throw new VehiclesServiceError(
      'That worker is not available for your company.',
    )
  }
}

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  const companyId = requireVerifiedCompanyId()
  const payload = { ...buildVehiclePayload(input), company_id: companyId }

  // Never allow assigning a driver from another company.
  if (payload.current_driver_id) {
    await assertDriverInCompany(payload.current_driver_id, companyId)
  }

  // Select without archived_at so create still works before the archive migration.
  const { data, error } = await requireSupabase()
    .from('vehicles')
    .insert(payload)
    .select(vehicleSelectLegacy)
    .single()

  if (error) {
    logVehicleSaveError(payload, error)
    mapVehicleWriteError(error)
  }

  return mapVehicleRow(data as VehicleRow)
}

export async function updateVehicle(
  id: string,
  input: VehicleInput,
): Promise<Vehicle> {
  const companyId = requireVerifiedCompanyId()
  const payload = buildVehiclePayload(input)

  if (payload.current_driver_id) {
    await assertDriverInCompany(payload.current_driver_id, companyId)
  }

  const { data, error } = await requireSupabase()
    .from('vehicles')
    .update(payload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select(vehicleSelectLegacy)
    .maybeSingle()

  if (error) {
    logVehicleSaveError(payload, error)
    mapVehicleWriteError(error)
  }

  if (!data) {
    throw new VehiclesServiceError(
      'Vehicle could not be updated for your company. Refresh and try again.',
    )
  }

  return mapVehicleRow(data as VehicleRow)
}

export async function deleteVehicle(id: string): Promise<void> {
  const companyId = requireVerifiedCompanyId()
  const { data, error } = await requireSupabase()
    .from('vehicles')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)
    .select('id')

  if (error) {
    logVehicleSaveError({ id }, error)
    throw error
  }

  if ((data ?? []).length === 0) {
    throw new VehiclesServiceError(
      'Vehicle could not be deleted for your company. Refresh and try again.',
    )
  }
}

/**
 * Soft-archive a Vehicle. Frees an active plan seat without deleting history.
 */
export async function archiveVehicle(id: string): Promise<Vehicle> {
  const companyId = requireVerifiedCompanyId()
  const { data, error } = await requireSupabase()
    .from('vehicles')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
    .is('archived_at', null)
    .select(vehicleSelectLegacy)
    .maybeSingle()

  if (error) {
    if (isMissingColumnError(error)) {
      throw new VehiclesServiceError(
        'Vehicle archiving is not available yet. Ask DREVORA support to apply the latest database migration.',
      )
    }
    mapVehicleWriteError(error)
  }

  if (!data) {
    throw new VehiclesServiceError(
      'Vehicle could not be archived for your company. Refresh and try again.',
    )
  }

  return mapVehicleRow({ ...(data as VehicleRow), archived_at: new Date().toISOString() })
}

/**
 * Reactivate an archived Vehicle when a plan seat is available.
 * Server trigger rejects with VEHICLE_PLAN_LIMIT_REACHED when full.
 */
export async function reactivateVehicle(id: string): Promise<Vehicle> {
  const companyId = requireVerifiedCompanyId()
  const { data, error } = await requireSupabase()
    .from('vehicles')
    .update({ archived_at: null })
    .eq('id', id)
    .eq('company_id', companyId)
    .not('archived_at', 'is', null)
    .select(vehicleSelectLegacy)
    .maybeSingle()

  if (error) {
    if (isMissingColumnError(error)) {
      throw new VehiclesServiceError(
        'Vehicle reactivation is not available yet. Ask DREVORA support to apply the latest database migration.',
      )
    }
    mapVehicleWriteError(error)
  }

  if (!data) {
    throw new VehiclesServiceError(
      'Vehicle could not be reactivated for your company. Refresh and try again.',
    )
  }

  return mapVehicleRow({ ...(data as VehicleRow), archived_at: null })
}

export const vehiclesService = {
  fetchVehicles,
  fetchVehicleById,
  fetchVehicleTypeById,
  fetchAvailabilityRecords,
  fetchVehicleTimelineRecords,
  fetchPlanningAvailabilityRecords,
  createAvailabilityRecord,
  updateAvailabilityRecord,
  deleteAvailabilityRecord,
  getVehicleStatusForDate,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  archiveVehicle,
  reactivateVehicle,
}

import { supabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import { todayString } from '@/lib/vehicleAvailability'

export type VehicleType = 'HGV Truck' | 'Forklift' | 'Trailer'

export const vehicleTypeOptions: VehicleType[] = ['HGV Truck', 'Forklift', 'Trailer']

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
}

export type VehicleInput = {
  registration: string
  fleetNumber: string
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
  registration: string
  fleet_number: string | null
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
  constructor(message: string) {
    super(message)
    this.name = 'VehiclesServiceError'
  }
}

function logVehicleSaveError(payload: unknown, error: unknown) {
  const supabaseError = error as {
    code?: string
    message?: string
    details?: string
    hint?: string
  } | null

  console.group('Vehicle Save Error')
  console.log('Payload:', payload)
  console.log('Supabase Error:', error)
  console.log('Code:', supabaseError?.code)
  console.log('Message:', supabaseError?.message)
  console.log('Details:', supabaseError?.details)
  console.log('Hint:', supabaseError?.hint)
  console.groupEnd()
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
    registration: row.registration,
    fleetNumber: row.fleet_number,
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
  }
}

const vehicleSelect =
  'id, created_at, registration, fleet_number, vehicle_type, make, model, year, vin, current_odometer, status, availability_status, current_driver_id, insurance_expiry, mot_expiry, road_tax_expiry, tachograph_expiry, off_road_reason, off_road_start_date, off_road_expected_return_date, off_road_start, off_road_return, off_road_notes, notes'

const vehicleAvailabilitySelect =
  'id, created_at, vehicle_id, status, start_date, end_date, reason, notes'

function buildVehiclePayload(input: VehicleInput) {
  return {
    registration: input.registration.trim().toUpperCase(),
    fleet_number: input.fleetNumber.trim() || null,
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
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const { data, error } = await supabase
    .from('vehicle_availability')
    .select(vehicleAvailabilitySelect)
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
  rangeStart?: string,
  vehicleId?: string,
): Promise<VehicleAvailability[]> {
  const today = todayString()
  const startDate = rangeStart ?? today

  let query = supabase
    .from('vehicle_availability')
    .select(vehicleAvailabilitySelect)
    .or(`end_date.is.null,end_date.gte.${startDate},start_date.gte.${startDate}`)
    .order('start_date', { ascending: true })
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

export async function fetchVehicles(): Promise<Vehicle[]> {
  const table = 'vehicles'
  const { data, error } = await supabase
    .from(table)
    .select(vehicleSelect)
    .order('created_at', { ascending: false })

  logSupabaseQuery({
    service: 'vehiclesService.fetchVehicles',
    table,
    data,
    error,
  })

  if (error) {
    throw new VehiclesServiceError(error.message)
  }

  const vehicles = (data ?? []).map((row) => mapVehicleRow(row as VehicleRow))
  const availabilityRecords = await fetchRelevantAvailabilityRecords()

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
  return fetchAvailabilityRecords(vehicleId)
}

export async function fetchVehicleById(id: string): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select(vehicleSelect)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new VehiclesServiceError(error.message)
  }

  if (!data) return null

  const vehicle = mapVehicleRow(data as VehicleRow)
  const availabilityRecords = await fetchAvailabilityRecords(id)

  return applyAvailabilityStatus(vehicle, availabilityRecords)
}

export async function fetchVehicleTypeById(vehicleId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('vehicle_type')
    .eq('id', vehicleId)
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
  let query = supabase
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
  const payload = {
    vehicle_id: input.vehicleId,
    status: input.status,
    start_date: input.startDate,
    end_date: input.endDate || null,
    reason: input.reason.trim() || null,
    notes: input.notes.trim() || null,
  }

  const { data, error } = await supabase
    .from('vehicle_availability')
    .update(payload)
    .eq('id', id)
    .select(vehicleAvailabilitySelect)
    .single()

  if (error) {
    logVehicleSaveError({ id, ...payload }, error)
    throw error
  }

  return mapAvailabilityRow(data as VehicleAvailabilityRow)
}

export async function deleteAvailabilityRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from('vehicle_availability')
    .delete()
    .eq('id', id)

  if (error) {
    logVehicleSaveError({ id }, error)
    throw error
  }
}

export async function createAvailabilityRecord(
  input: VehicleAvailabilityInput,
): Promise<VehicleAvailability> {
  const payload = {
    vehicle_id: input.vehicleId,
    status: input.status,
    start_date: input.startDate,
    end_date: input.endDate || null,
    reason: input.reason.trim() || null,
    notes: input.notes.trim() || null,
  }

  const { data, error } = await supabase
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

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  const payload = buildVehiclePayload(input)
  const { data, error } = await supabase
    .from('vehicles')
    .insert(payload)
    .select(vehicleSelect)
    .single()

  if (error) {
    logVehicleSaveError(payload, error)
    throw error
  }

  return mapVehicleRow(data as VehicleRow)
}

export async function updateVehicle(
  id: string,
  input: VehicleInput,
): Promise<Vehicle> {
  const payload = buildVehiclePayload(input)
  const { data, error } = await supabase
    .from('vehicles')
    .update(payload)
    .eq('id', id)
    .select(vehicleSelect)
    .single()

  if (error) {
    logVehicleSaveError(payload, error)
    throw error
  }

  return mapVehicleRow(data as VehicleRow)
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from('vehicles').delete().eq('id', id)

  if (error) {
    logVehicleSaveError({ id }, error)
    throw error
  }
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
}

import { supabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'

export type DriverStatus = 'Working' | 'Off Duty' | 'Holiday' | 'Suspended'
export type DriverRole =
  | 'Admin'
  | 'Driver'
  | 'Yardman'
  | 'Cleaner'
  | 'Supervisor'
  | 'Mechanic'
  | 'Transport Manager'
  | 'Planner'
  | 'Office Staff'
  | 'Other'

export type Driver = {
  id: string
  createdAt: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  company: string
  role: DriverRole
  assignment: string | null
  status: DriverStatus
  drivingLicenceExpiry: string | null
  driving_licence_expiry: string | null
  cpcExpiry: string | null
  driverCardExpiry: string | null
  medicalExpiry: string | null
  adrExpiry: string | null
  hiabExpiry: string | null
  avatarUrl: string | null
}

export type CreateDriverInput = {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  role: DriverRole
  status: DriverStatus
}

export type UpdateDriverInput = CreateDriverInput

type DriverRow = {
  id: string
  created_at: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  company: string | null
  role: string | null
  assigned_vehicle?: string | null
  status: string | null
  driving_licence_expiry?: string | null
  cpc_expiry?: string | null
  driver_card_expiry?: string | null
  medical_expiry?: string | null
  adr_expiry?: string | null
  hiab_expiry?: string | null
  avatar_url: string | null
}

const basicDriverSelect =
  'id, created_at, first_name, last_name, email, phone, company, role, status, avatar_url'

const basicDriverSelectWithAssignment =
  'id, created_at, first_name, last_name, email, phone, company, role, assigned_vehicle, status, avatar_url'

const complianceDriverSelect =
  'id, created_at, first_name, last_name, email, phone, company, role, status, driving_licence_expiry, cpc_expiry, driver_card_expiry, medical_expiry, adr_expiry, hiab_expiry, avatar_url'

export class DriversServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DriversServiceError'
  }
}

function isDriverStatus(value: string | null): value is DriverStatus {
  return (
    value === 'Working' ||
    value === 'Off Duty' ||
    value === 'Holiday' ||
    value === 'Suspended'
  )
}

function isDriverRole(value: string | null): value is DriverRole {
  return (
    value === 'Admin' ||
    value === 'Driver' ||
    value === 'Yardman' ||
    value === 'Cleaner' ||
    value === 'Supervisor' ||
    value === 'Mechanic' ||
    value === 'Transport Manager' ||
    value === 'Planner' ||
    value === 'Office Staff' ||
    value === 'Other'
  )
}

function mapDriverRow(row: DriverRow): Driver {
  return {
    id: row.id,
    createdAt: row.created_at,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    company: row.company ?? '',
    role: isDriverRole(row.role) ? row.role : 'Driver',
    assignment: row.assigned_vehicle?.trim() || null,
    status: isDriverStatus(row.status) ? row.status : 'Off Duty',
    drivingLicenceExpiry: row.driving_licence_expiry ?? null,
    driving_licence_expiry: row.driving_licence_expiry ?? null,
    cpcExpiry: row.cpc_expiry ?? null,
    driverCardExpiry: row.driver_card_expiry ?? null,
    medicalExpiry: row.medical_expiry ?? null,
    adrExpiry: row.adr_expiry ?? null,
    hiabExpiry: row.hiab_expiry ?? null,
    avatarUrl: row.avatar_url,
  }
}

export async function fetchDrivers(): Promise<Driver[]> {
  const table = 'drivers'
  const { data, error } = await supabase
    .from(table)
    .select(basicDriverSelectWithAssignment)
    .order('created_at', { ascending: false })

  if (error) {
    const fallback = await supabase
      .from(table)
      .select(basicDriverSelect)
      .order('created_at', { ascending: false })

    logSupabaseQuery({
      service: 'driversService.fetchDrivers',
      table,
      data: fallback.data,
      error: fallback.error,
    })

    if (fallback.error) {
      throw new DriversServiceError(fallback.error.message)
    }

    return (fallback.data ?? []).map((row) => mapDriverRow(row as DriverRow))
  }

  logSupabaseQuery({
    service: 'driversService.fetchDrivers',
    table,
    data,
    error,
  })

  return (data ?? []).map((row) => mapDriverRow(row as DriverRow))
}

export async function fetchDriversWithCompliance(): Promise<Driver[]> {
  const { data, error } = await supabase
    .from('drivers')
    .select(complianceDriverSelect)
    .order('created_at', { ascending: false })

  if (error) {
    throw new DriversServiceError(error.message)
  }

  return (data ?? []).map((row) => mapDriverRow(row as DriverRow))
}

export async function fetchDriverById(id: string): Promise<Driver | null> {
  const { data, error } = await supabase
    .from('drivers')
    .select(basicDriverSelect)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new DriversServiceError(error.message)
  }

  return data ? mapDriverRow(data as DriverRow) : null
}

export async function createDriver(input: CreateDriverInput): Promise<Driver> {
  const tableName = 'drivers'
  const insertPayload = {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim() || null,
    company: input.company.trim(),
    role: input.role,
    status: input.status,
    avatar_url: null,
  }

  console.info('[driversService.createDriver] Supabase table:', tableName)
  console.info('[driversService.createDriver] Insert payload:', insertPayload)

  const { data, error } = await supabase
    .from(tableName)
    .insert(insertPayload)
    .select(basicDriverSelect)
    .single()

  if (error) {
    console.error('[driversService.createDriver] Supabase insert error:', error)
    console.error(
      '[driversService.createDriver] Supabase error message:',
      error.message,
    )
    throw new DriversServiceError(error.message)
  }

  return mapDriverRow(data as DriverRow)
}

export async function updateDriver(
  id: string,
  input: UpdateDriverInput,
): Promise<Driver> {
  const tableName = 'drivers'
  const updatePayload = {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim() || null,
    company: input.company.trim(),
    role: input.role,
    status: input.status,
  }

  const { data, error } = await supabase
    .from(tableName)
    .update(updatePayload)
    .eq('id', id)
    .select(basicDriverSelect)
    .single()

  if (error) {
    console.error('[driversService.updateDriver] Supabase update error:', error)
    console.error(
      '[driversService.updateDriver] Supabase error message:',
      error.message,
    )
    throw new DriversServiceError(error.message)
  }

  return mapDriverRow(data as DriverRow)
}

export async function deleteDriver(id: string): Promise<void> {
  const { error } = await supabase.from('drivers').delete().eq('id', id)

  if (error) {
    console.error('[driversService.deleteDriver] Supabase delete error:', error)
    console.error(
      '[driversService.deleteDriver] Supabase error message:',
      error.message,
    )
    throw new DriversServiceError(error.message)
  }
}

export const driversService = {
  fetchDrivers,
  fetchDriversWithCompliance,
  fetchDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
}

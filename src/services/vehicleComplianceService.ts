import { computeComplianceStatus } from '@/lib/complianceUtils'
import type {
  ComplianceRecordStatus,
  CreateVehicleComplianceRecordInput,
  UpdateVehicleComplianceRecordInput,
  VehicleComplianceRecord,
} from '@/lib/complianceTypes'
import { supabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'

type VehicleJoinRow = {
  registration: string
}

type VehicleComplianceRecordRow = {
  id: string
  created_at: string
  updated_at: string
  vehicle_id: string
  document_type: string
  document_name: string | null
  issue_date: string | null
  expiry_date: string | null
  status: string
  reference_number: string | null
  notes: string | null
  file_url: string | null
  vehicles: VehicleJoinRow | VehicleJoinRow[] | null
}

const vehicleComplianceSelect = `
  id,
  created_at,
  updated_at,
  vehicle_id,
  document_type,
  document_name,
  issue_date,
  expiry_date,
  status,
  reference_number,
  notes,
  file_url,
  vehicles ( registration )
`

export class VehicleComplianceServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VehicleComplianceServiceError'
  }
}

function normalizeJoinRow<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function normalizeStatus(value: string | null | undefined): ComplianceRecordStatus {
  switch (value) {
    case 'Expiring Soon':
    case 'Expired':
    case 'Not Added':
      return value
    default:
      return 'Valid'
  }
}

function mapRow(row: VehicleComplianceRecordRow): VehicleComplianceRecord {
  const vehicle = normalizeJoinRow(row.vehicles)
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    vehicleId: row.vehicle_id,
    vehicleRegistration: vehicle?.registration ?? 'Unknown',
    documentType: row.document_type,
    documentName: row.document_name,
    issueDate: row.issue_date,
    expiryDate: row.expiry_date,
    referenceNumber: row.reference_number,
    status: normalizeStatus(row.status),
    notes: row.notes,
    fileUrl: row.file_url,
  }
}

export async function fetchVehicleComplianceRecords(): Promise<VehicleComplianceRecord[]> {
  const { data, error } = await supabase
    .from('vehicle_compliance_records')
    .select(vehicleComplianceSelect)
    .order('expiry_date', { ascending: true, nullsFirst: false })

  logSupabaseQuery({
    service: 'vehicleComplianceService.fetchVehicleComplianceRecords',
    table: 'vehicle_compliance_records',
    data,
    error,
  })

  if (error) throw new VehicleComplianceServiceError(error.message)
  return ((data ?? []) as unknown as VehicleComplianceRecordRow[]).map(mapRow)
}

export async function fetchVehicleComplianceRecordsByVehicleId(
  vehicleId: string,
): Promise<VehicleComplianceRecord[]> {
  const { data, error } = await supabase
    .from('vehicle_compliance_records')
    .select(vehicleComplianceSelect)
    .eq('vehicle_id', vehicleId)
    .order('expiry_date', { ascending: true, nullsFirst: false })

  logSupabaseQuery({
    service: 'vehicleComplianceService.fetchVehicleComplianceRecordsByVehicleId',
    table: 'vehicle_compliance_records',
    data,
    error,
  })

  if (error) throw new VehicleComplianceServiceError(error.message)
  return ((data ?? []) as unknown as VehicleComplianceRecordRow[]).map(mapRow)
}

export async function createVehicleComplianceRecord(
  input: CreateVehicleComplianceRecordInput,
): Promise<VehicleComplianceRecord> {
  const status = computeComplianceStatus(input.expiryDate)

  const { data, error } = await supabase
    .from('vehicle_compliance_records')
    .insert({
      vehicle_id: input.vehicleId,
      document_type: input.documentType,
      document_name: input.documentName?.trim() || null,
      issue_date: input.issueDate || null,
      expiry_date: input.expiryDate || null,
      reference_number: input.referenceNumber?.trim() || null,
      status,
      notes: input.notes?.trim() || null,
      file_url: input.fileUrl?.trim() || null,
    })
    .select(vehicleComplianceSelect)
    .single()

  logSupabaseQuery({
    service: 'vehicleComplianceService.createVehicleComplianceRecord',
    table: 'vehicle_compliance_records',
    data: data ? [data] : [],
    error,
  })

  if (error) throw new VehicleComplianceServiceError(error.message)
  return mapRow(data as unknown as VehicleComplianceRecordRow)
}

export async function updateVehicleComplianceRecord(
  id: string,
  input: UpdateVehicleComplianceRecordInput,
): Promise<VehicleComplianceRecord> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (input.vehicleId !== undefined) patch.vehicle_id = input.vehicleId
  if (input.documentType !== undefined) patch.document_type = input.documentType
  if (input.documentName !== undefined) patch.document_name = input.documentName?.trim() || null
  if (input.issueDate !== undefined) patch.issue_date = input.issueDate || null
  if (input.expiryDate !== undefined) patch.expiry_date = input.expiryDate || null
  if (input.referenceNumber !== undefined) {
    patch.reference_number = input.referenceNumber?.trim() || null
  }
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null
  if (input.fileUrl !== undefined) patch.file_url = input.fileUrl?.trim() || null
  if (input.expiryDate !== undefined) patch.status = computeComplianceStatus(input.expiryDate)

  const { data, error } = await supabase
    .from('vehicle_compliance_records')
    .update(patch)
    .eq('id', id)
    .select(vehicleComplianceSelect)
    .single()

  logSupabaseQuery({
    service: 'vehicleComplianceService.updateVehicleComplianceRecord',
    table: 'vehicle_compliance_records',
    data: data ? [data] : [],
    error,
  })

  if (error) throw new VehicleComplianceServiceError(error.message)
  return mapRow(data as unknown as VehicleComplianceRecordRow)
}

export async function deleteVehicleComplianceRecord(id: string): Promise<void> {
  const { error } = await supabase.from('vehicle_compliance_records').delete().eq('id', id)

  logSupabaseQuery({
    service: 'vehicleComplianceService.deleteVehicleComplianceRecord',
    table: 'vehicle_compliance_records',
    data: error ? [] : [{ id }],
    error,
  })

  if (error) throw new VehicleComplianceServiceError(error.message)
}

export const vehicleComplianceService = {
  fetchVehicleComplianceRecords,
  fetchVehicleComplianceRecordsByVehicleId,
  createVehicleComplianceRecord,
  updateVehicleComplianceRecord,
  deleteVehicleComplianceRecord,
}

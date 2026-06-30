import { computeComplianceStatus } from '@/lib/complianceUtils'
import type {
  ComplianceRecordStatus,
  CreateWorkerComplianceRecordInput,
  UpdateWorkerComplianceRecordInput,
  WorkerComplianceRecord,
} from '@/lib/complianceTypes'
import { supabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import type { DriverRole } from '@/services/driversService'

type DriverJoinRow = {
  first_name: string
  last_name: string
  role: string | null
}

type WorkerComplianceRecordRow = {
  id: string
  created_at: string
  updated_at: string
  worker_id: string
  document_type: string
  document_name: string | null
  issue_date: string | null
  expiry_date: string | null
  status: string
  reference_number: string | null
  notes: string | null
  file_url: string | null
  drivers: DriverJoinRow | DriverJoinRow[] | null
}

const workerComplianceSelect = `
  id,
  created_at,
  updated_at,
  worker_id,
  document_type,
  document_name,
  issue_date,
  expiry_date,
  status,
  reference_number,
  notes,
  file_url,
  drivers ( first_name, last_name, role )
`

export class WorkerComplianceServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkerComplianceServiceError'
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

function mapRow(row: WorkerComplianceRecordRow): WorkerComplianceRecord {
  const driver = normalizeJoinRow(row.drivers)
  const workerName = driver
    ? `${driver.first_name} ${driver.last_name}`.trim()
    : 'Unknown worker'

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workerId: row.worker_id,
    workerName,
    workerRole: (driver?.role as DriverRole | null) ?? null,
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

export async function fetchWorkerComplianceRecords(): Promise<WorkerComplianceRecord[]> {
  const { data, error } = await supabase
    .from('worker_compliance_records')
    .select(workerComplianceSelect)
    .order('expiry_date', { ascending: true, nullsFirst: false })
    .order('document_type', { ascending: true })

  logSupabaseQuery({
    service: 'workerComplianceService.fetchWorkerComplianceRecords',
    table: 'worker_compliance_records',
    data,
    error,
  })

  if (error) throw new WorkerComplianceServiceError(error.message)
  return ((data ?? []) as unknown as WorkerComplianceRecordRow[]).map(mapRow)
}

export async function fetchWorkerComplianceRecordsByWorkerId(
  workerId: string,
): Promise<WorkerComplianceRecord[]> {
  const { data, error } = await supabase
    .from('worker_compliance_records')
    .select(workerComplianceSelect)
    .eq('worker_id', workerId)
    .order('expiry_date', { ascending: true, nullsFirst: false })

  logSupabaseQuery({
    service: 'workerComplianceService.fetchWorkerComplianceRecordsByWorkerId',
    table: 'worker_compliance_records',
    data,
    error,
  })

  if (error) throw new WorkerComplianceServiceError(error.message)
  return ((data ?? []) as unknown as WorkerComplianceRecordRow[]).map(mapRow)
}

export async function fetchWorkerComplianceRecordById(
  id: string,
): Promise<WorkerComplianceRecord | null> {
  const { data, error } = await supabase
    .from('worker_compliance_records')
    .select(workerComplianceSelect)
    .eq('id', id)
    .maybeSingle()

  logSupabaseQuery({
    service: 'workerComplianceService.fetchWorkerComplianceRecordById',
    table: 'worker_compliance_records',
    data: data ? [data] : [],
    error,
  })

  if (error) throw new WorkerComplianceServiceError(error.message)
  if (!data) return null
  return mapRow(data as unknown as WorkerComplianceRecordRow)
}

export async function createWorkerComplianceRecord(
  input: CreateWorkerComplianceRecordInput,
): Promise<WorkerComplianceRecord> {
  const status = computeComplianceStatus(input.expiryDate)

  const { data, error } = await supabase
    .from('worker_compliance_records')
    .insert({
      worker_id: input.workerId,
      document_type: input.documentType,
      document_name: input.documentName?.trim() || null,
      issue_date: input.issueDate || null,
      expiry_date: input.expiryDate || null,
      reference_number: input.referenceNumber?.trim() || null,
      status,
      notes: input.notes?.trim() || null,
      file_url: input.fileUrl?.trim() || null,
    })
    .select(workerComplianceSelect)
    .single()

  logSupabaseQuery({
    service: 'workerComplianceService.createWorkerComplianceRecord',
    table: 'worker_compliance_records',
    data: data ? [data] : [],
    error,
  })

  if (error) throw new WorkerComplianceServiceError(error.message)
  return mapRow(data as unknown as WorkerComplianceRecordRow)
}

export async function updateWorkerComplianceRecord(
  id: string,
  input: UpdateWorkerComplianceRecordInput,
): Promise<WorkerComplianceRecord> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (input.workerId !== undefined) patch.worker_id = input.workerId
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
    .from('worker_compliance_records')
    .update(patch)
    .eq('id', id)
    .select(workerComplianceSelect)
    .single()

  logSupabaseQuery({
    service: 'workerComplianceService.updateWorkerComplianceRecord',
    table: 'worker_compliance_records',
    data: data ? [data] : [],
    error,
  })

  if (error) throw new WorkerComplianceServiceError(error.message)
  return mapRow(data as unknown as WorkerComplianceRecordRow)
}

export async function deleteWorkerComplianceRecord(id: string): Promise<void> {
  const { error } = await supabase.from('worker_compliance_records').delete().eq('id', id)

  logSupabaseQuery({
    service: 'workerComplianceService.deleteWorkerComplianceRecord',
    table: 'worker_compliance_records',
    data: error ? [] : [{ id }],
    error,
  })

  if (error) throw new WorkerComplianceServiceError(error.message)
}

export const workerComplianceService = {
  fetchWorkerComplianceRecords,
  fetchWorkerComplianceRecordsByWorkerId,
  fetchWorkerComplianceRecordById,
  createWorkerComplianceRecord,
  updateWorkerComplianceRecord,
  deleteWorkerComplianceRecord,
}

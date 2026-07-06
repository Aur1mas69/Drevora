import { computeDocumentStatus } from '@/lib/documentUtils'
import type {
  CreateDocumentInput,
  Document,
  DocumentsQuery,
  UpdateDocumentInput,
} from '@/lib/documentTypes'
import { getGlobalCompanySettings } from '@/lib/companySettingsGlobals'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'

type WorkerLookupRow = {
  id: string
  first_name: string
  last_name: string
}

type VehicleLookupRow = {
  id: string
  registration: string
  fleet_number: string | null
}

type DocumentRow = {
  id: string
  company: string | null
  document_name: string
  document_type: string
  applies_to: string
  worker_id: string | null
  vehicle_id: string | null
  reference_number: string | null
  issue_date: string | null
  expiry_date: string | null
  file_url: string | null
  file_path: string | null
  notes: string | null
  status: string
  created_at: string
  updated_at: string
}

const documentSelect = `
  id,
  company,
  document_name,
  document_type,
  applies_to,
  worker_id,
  vehicle_id,
  reference_number,
  issue_date,
  expiry_date,
  file_url,
  file_path,
  notes,
  status,
  created_at,
  updated_at
`

export class DocumentsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocumentsServiceError'
  }
}

function resolveCompanyScope(): string | null {
  const name = getGlobalCompanySettings()?.name?.trim()
  return name || null
}

function normalizeAppliesTo(value: string): Document['appliesTo'] {
  if (value === 'company' || value === 'worker' || value === 'vehicle') return value
  return 'company'
}

function normalizeStatus(value: string, expiryDate: string | null): Document['status'] {
  const computed = computeDocumentStatus(expiryDate)
  if (value === 'valid' || value === 'expiring_soon' || value === 'expired' || value === 'no_expiry') {
    return computed
  }
  return computed
}

function mapVehicleLabel(vehicle: VehicleLookupRow): string {
  return [vehicle.registration, vehicle.fleet_number].filter(Boolean).join(' · ')
}

function mapRow(
  row: DocumentRow,
  workerNames: Map<string, string>,
  vehicleLabels: Map<string, string>,
): Document {
  return {
    id: row.id,
    company: row.company,
    documentName: row.document_name,
    documentType: row.document_type,
    appliesTo: normalizeAppliesTo(row.applies_to),
    workerId: row.worker_id,
    workerName: row.worker_id ? workerNames.get(row.worker_id) ?? null : null,
    vehicleId: row.vehicle_id,
    vehicleLabel: row.vehicle_id ? vehicleLabels.get(row.vehicle_id) ?? null : null,
    referenceNumber: row.reference_number,
    issueDate: row.issue_date,
    expiryDate: row.expiry_date,
    fileUrl: row.file_url,
    filePath: row.file_path,
    notes: row.notes,
    status: normalizeStatus(row.status, row.expiry_date),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function fetchWorkerNameMap(workerIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(workerIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await requireSupabase()
    .from('drivers')
    .select('id, first_name, last_name')
    .in('id', uniqueIds)

  logSupabaseQuery({
    service: 'documentsService.fetchWorkerNameMap',
    table: 'drivers',
    data,
    error,
  })

  if (error) {
    throw new DocumentsServiceError(error.message)
  }

  return new Map(
    (data ?? []).map((row) => {
      const worker = row as WorkerLookupRow
      return [worker.id, `${worker.first_name} ${worker.last_name}`.trim()]
    }),
  )
}

async function fetchVehicleLabelMap(vehicleIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(vehicleIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await requireSupabase()
    .from('vehicles')
    .select('id, registration, fleet_number')
    .in('id', uniqueIds)

  logSupabaseQuery({
    service: 'documentsService.fetchVehicleLabelMap',
    table: 'vehicles',
    data,
    error,
  })

  if (error) {
    throw new DocumentsServiceError(error.message)
  }

  return new Map(
    (data ?? []).map((row) => {
      const vehicle = row as VehicleLookupRow
      return [vehicle.id, mapVehicleLabel(vehicle)]
    }),
  )
}

async function mapDocumentRows(rows: DocumentRow[]): Promise<Document[]> {
  const workerIds = rows.map((row) => row.worker_id).filter((id): id is string => Boolean(id))
  const vehicleIds = rows.map((row) => row.vehicle_id).filter((id): id is string => Boolean(id))

  const [workerNames, vehicleLabels] = await Promise.all([
    fetchWorkerNameMap(workerIds),
    fetchVehicleLabelMap(vehicleIds),
  ])

  return rows.map((row) => mapRow(row, workerNames, vehicleLabels))
}

function isMissingDocumentsTableError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('documents') &&
    (normalized.includes('does not exist') ||
      normalized.includes('could not find the table') ||
      normalized.includes('schema cache'))
  )
}

function toDbPayload(input: CreateDocumentInput | UpdateDocumentInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if (input.documentName !== undefined) payload.document_name = input.documentName.trim()
  if (input.documentType !== undefined) payload.document_type = input.documentType.trim()
  if (input.appliesTo !== undefined) payload.applies_to = input.appliesTo
  if (input.workerId !== undefined) payload.worker_id = input.workerId || null
  if (input.vehicleId !== undefined) payload.vehicle_id = input.vehicleId || null
  if (input.referenceNumber !== undefined) {
    payload.reference_number = input.referenceNumber?.trim() || null
  }
  if (input.issueDate !== undefined) payload.issue_date = input.issueDate || null
  if (input.expiryDate !== undefined) {
    payload.expiry_date = input.expiryDate || null
    payload.status = computeDocumentStatus(input.expiryDate)
  }
  if (input.fileUrl !== undefined) payload.file_url = input.fileUrl?.trim() || null
  if (input.filePath !== undefined) payload.file_path = input.filePath?.trim() || null
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null

  return payload
}

export async function fetchDocuments(query: DocumentsQuery = {}): Promise<Document[]> {
  let request = requireSupabase().from('documents').select(documentSelect)

  const company = resolveCompanyScope()
  if (company) {
    request = request.eq('company', company)
  }

  if (query.appliesTo && query.appliesTo !== 'all') {
    request = request.eq('applies_to', query.appliesTo)
  }

  if (query.type && query.type !== 'all') {
    request = request.eq('document_type', query.type)
  }

  if (query.workerId && query.workerId !== 'all') {
    request = request.eq('worker_id', query.workerId)
  }

  if (query.vehicleId && query.vehicleId !== 'all') {
    request = request.eq('vehicle_id', query.vehicleId)
  }

  const { data, error } = await request
    .order('expiry_date', { ascending: true, nullsFirst: false })
    .order('document_name', { ascending: true })

  logSupabaseQuery({
    service: 'documentsService.fetchDocuments',
    table: 'documents',
    data,
    error,
  })

  if (error) {
    if (isMissingDocumentsTableError(error.message)) {
      throw new DocumentsServiceError(
        'Documents table is not available yet. Run the documents migration on your Supabase project.',
      )
    }
    throw new DocumentsServiceError(error.message)
  }

  return mapDocumentRows((data ?? []) as unknown as DocumentRow[])
}

export async function fetchDocumentById(id: string): Promise<Document | null> {
  let request = requireSupabase().from('documents').select(documentSelect).eq('id', id)

  const company = resolveCompanyScope()
  if (company) {
    request = request.eq('company', company)
  }

  const { data, error } = await request.maybeSingle()

  logSupabaseQuery({
    service: 'documentsService.fetchDocumentById',
    table: 'documents',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new DocumentsServiceError(error.message)
  }

  if (!data) return null
  const rows = await mapDocumentRows([data as unknown as DocumentRow])
  return rows[0] ?? null
}

export async function fetchDocumentsByWorkerId(workerId: string): Promise<Document[]> {
  return fetchDocuments({ workerId, appliesTo: 'worker' })
}

export async function fetchDocumentsByVehicleId(vehicleId: string): Promise<Document[]> {
  return fetchDocuments({ vehicleId, appliesTo: 'vehicle' })
}

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  const status = computeDocumentStatus(input.expiryDate ?? null)
  const payload = {
    company: resolveCompanyScope(),
    ...toDbPayload(input),
    status,
    worker_id: input.appliesTo === 'worker' ? input.workerId ?? null : null,
    vehicle_id: input.appliesTo === 'vehicle' ? input.vehicleId ?? null : null,
  }

  const { data, error } = await requireSupabase()
    .from('documents')
    .insert(payload)
    .select(documentSelect)
    .single()

  logSupabaseQuery({
    service: 'documentsService.createDocument',
    table: 'documents',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new DocumentsServiceError(error.message)
  }

  const rows = await mapDocumentRows([data as unknown as DocumentRow])
  return rows[0]
}

export async function updateDocument(id: string, input: UpdateDocumentInput): Promise<Document> {
  const payload: Record<string, unknown> = {
    ...toDbPayload(input),
    updated_at: new Date().toISOString(),
  }

  if (input.appliesTo !== undefined) {
    if (input.appliesTo === 'company') {
      payload.worker_id = null
      payload.vehicle_id = null
    } else if (input.appliesTo === 'worker') {
      payload.vehicle_id = null
    } else if (input.appliesTo === 'vehicle') {
      payload.worker_id = null
    }
  }

  let request = requireSupabase().from('documents').update(payload).eq('id', id)

  const company = resolveCompanyScope()
  if (company) {
    request = request.eq('company', company)
  }

  const { data, error } = await request.select(documentSelect).single()

  logSupabaseQuery({
    service: 'documentsService.updateDocument',
    table: 'documents',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new DocumentsServiceError(error.message)
  }

  const rows = await mapDocumentRows([data as unknown as DocumentRow])
  return rows[0]
}

export async function deleteDocument(id: string): Promise<void> {
  let request = requireSupabase().from('documents').delete().eq('id', id)

  const company = resolveCompanyScope()
  if (company) {
    request = request.eq('company', company)
  }

  const { error } = await request

  logSupabaseQuery({
    service: 'documentsService.deleteDocument',
    table: 'documents',
    data: [],
    error,
  })

  if (error) {
    throw new DocumentsServiceError(error.message)
  }
}

export const documentsService = {
  fetchDocuments,
  fetchDocumentById,
  fetchDocumentsByWorkerId,
  fetchDocumentsByVehicleId,
  createDocument,
  updateDocument,
  deleteDocument,
}

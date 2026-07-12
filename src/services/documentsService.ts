import { computeDocumentStatus, workerDocumentTypesInclude } from '@/lib/documentUtils'
import type {
  CreateDocumentInput,
  Document,
  DocumentSource,
  DocumentsQuery,
  UpdateDocumentInput,
} from '@/lib/documentTypes'
import { MEDICAL_DOCUMENT_TYPE, normalizeMedicalDocumentType } from '@/lib/documentTypes'
import { getGlobalCompanySettings } from '@/lib/companySettingsGlobals'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import { deleteWorkerComplianceRecord } from '@/services/workerComplianceService'

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

type CompanyDriverRow = {
  id: string
  first_name: string
  last_name: string
  company: string | null
  driving_licence_expiry: string | null
  cpc_expiry: string | null
  driver_card_expiry: string | null
  medical_expiry: string | null
  adr_expiry: string | null
  hiab_expiry: string | null
}

type WorkerComplianceSourceRow = {
  id: string
  worker_id: string
  document_type: string
  document_name: string | null
  reference_number: string | null
  issue_date: string | null
  expiry_date: string | null
  file_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
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

const LEGACY_WORKER_EXPIRY_FIELDS: Array<{
  field: keyof CompanyDriverRow
  documentType: string
}> = [
  { field: 'driving_licence_expiry', documentType: 'Driving Licence' },
  { field: 'cpc_expiry', documentType: 'CPC' },
  { field: 'driver_card_expiry', documentType: 'Tachograph Card' },
  { field: 'medical_expiry', documentType: MEDICAL_DOCUMENT_TYPE },
  { field: 'adr_expiry', documentType: 'ADR' },
  { field: 'hiab_expiry', documentType: 'HIAB' },
]

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
  source: DocumentSource = 'documents',
): Document {
  return {
    id: row.id,
    company: row.company,
    documentName: row.document_name,
    documentType: normalizeMedicalDocumentType(row.document_type),
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
    source,
  }
}

function mapWorkerComplianceToDocument(
  row: WorkerComplianceSourceRow,
  workerName: string,
  company: string | null,
): Document {
  const expiryDate = row.expiry_date
  return {
    id: row.id,
    company,
    documentName: row.document_name?.trim() || row.document_type,
    documentType: normalizeMedicalDocumentType(row.document_type),
    appliesTo: 'worker',
    workerId: row.worker_id,
    workerName,
    vehicleId: null,
    vehicleLabel: null,
    referenceNumber: row.reference_number,
    issueDate: row.issue_date,
    expiryDate,
    fileUrl: row.file_url,
    filePath: null,
    notes: row.notes,
    status: computeDocumentStatus(expiryDate),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: 'worker_compliance',
  }
}

function mapLegacyWorkerExpiryToDocument(
  driver: CompanyDriverRow,
  documentType: string,
  expiryDate: string,
  company: string | null,
): Document {
  return {
    id: `legacy-worker-${driver.id}-${documentType}`,
    company,
    documentName: documentType,
    documentType,
    appliesTo: 'worker',
    workerId: driver.id,
    workerName: `${driver.first_name} ${driver.last_name}`.trim(),
    vehicleId: null,
    vehicleLabel: null,
    referenceNumber: null,
    issueDate: null,
    expiryDate,
    fileUrl: null,
    filePath: null,
    notes: null,
    status: computeDocumentStatus(expiryDate),
    createdAt: '',
    updatedAt: '',
    source: 'legacy_worker',
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

  return rows.map((row) => mapRow(row, workerNames, vehicleLabels, 'documents'))
}

async function fetchCompanyDrivers(): Promise<CompanyDriverRow[]> {
  const company = resolveCompanyScope()
  let request = requireSupabase()
    .from('drivers')
    .select(
      'id, first_name, last_name, company, driving_licence_expiry, cpc_expiry, driver_card_expiry, medical_expiry, adr_expiry, hiab_expiry',
    )

  if (company) {
    request = request.eq('company', company)
  }

  const { data, error } = await request

  logSupabaseQuery({
    service: 'documentsService.fetchCompanyDrivers',
    table: 'drivers',
    data,
    error,
  })

  if (error) {
    let fallback = requireSupabase().from('drivers').select('id, first_name, last_name, company')
    if (company) fallback = fallback.eq('company', company)
    const { data: coreData, error: coreError } = await fallback
    if (coreError) throw new DocumentsServiceError(coreError.message)
    return ((coreData ?? []) as Array<Pick<CompanyDriverRow, 'id' | 'first_name' | 'last_name' | 'company'>>).map(
      (row) => ({
        ...row,
        driving_licence_expiry: null,
        cpc_expiry: null,
        driver_card_expiry: null,
        medical_expiry: null,
        adr_expiry: null,
        hiab_expiry: null,
      }),
    )
  }

  return (data ?? []) as CompanyDriverRow[]
}

async function fetchWorkerComplianceRowsForWorkers(
  workerIds: string[],
): Promise<WorkerComplianceSourceRow[]> {
  if (workerIds.length === 0) return []

  const { data, error } = await requireSupabase()
    .from('worker_compliance_records')
    .select(
      'id, worker_id, document_type, document_name, reference_number, issue_date, expiry_date, file_url, notes, created_at, updated_at',
    )
    .in('worker_id', workerIds)
    .order('expiry_date', { ascending: true, nullsFirst: false })

  logSupabaseQuery({
    service: 'documentsService.fetchWorkerComplianceRowsForWorkers',
    table: 'worker_compliance_records',
    data,
    error,
  })

  if (error) {
    const normalized = error.message.toLowerCase()
    if (
      normalized.includes('worker_compliance_records') &&
      (normalized.includes('does not exist') ||
        normalized.includes('could not find the table') ||
        normalized.includes('schema cache'))
    ) {
      return []
    }
    throw new DocumentsServiceError(error.message)
  }

  return (data ?? []) as WorkerComplianceSourceRow[]
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

function sortDocuments(documents: Document[]): Document[] {
  return [...documents].sort((left, right) => {
    const leftExpiry = left.expiryDate ?? '9999-12-31'
    const rightExpiry = right.expiryDate ?? '9999-12-31'
    if (leftExpiry !== rightExpiry) return leftExpiry.localeCompare(rightExpiry)
    return left.documentName.localeCompare(right.documentName)
  })
}

/**
 * Loads Documents Centre rows from:
 * 1) public.documents (company-scoped)
 * 2) public.worker_compliance_records for company workers (Worker profile source of truth)
 * 3) legacy expiry columns on public.drivers when no matching compliance/document row exists
 */
export async function fetchDocuments(query: DocumentsQuery = {}): Promise<Document[]> {
  const company = resolveCompanyScope()
  const companyDrivers = await fetchCompanyDrivers()
  const companyDriverIds = companyDrivers.map((driver) => driver.id)
  const driverNameById = new Map(
    companyDrivers.map((driver) => [
      driver.id,
      `${driver.first_name} ${driver.last_name}`.trim(),
    ]),
  )

  let request = requireSupabase().from('documents').select(documentSelect)

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

  const documentRows = (data ?? []) as unknown as DocumentRow[]

  let orphanWorkerDocs: DocumentRow[] = []
  if (companyDriverIds.length > 0) {
    const { data: workerScopedData, error: workerScopedError } = await requireSupabase()
      .from('documents')
      .select(documentSelect)
      .eq('applies_to', 'worker')
      .in('worker_id', companyDriverIds)

    logSupabaseQuery({
      service: 'documentsService.fetchDocuments.workerScoped',
      table: 'documents',
      data: workerScopedData,
      error: workerScopedError,
    })

    if (!workerScopedError) {
      orphanWorkerDocs = (workerScopedData ?? []) as unknown as DocumentRow[]
    }
  }

  const mergedRowsById = new Map<string, DocumentRow>()
  for (const row of documentRows) mergedRowsById.set(row.id, row)
  for (const row of orphanWorkerDocs) {
    if (!mergedRowsById.has(row.id)) mergedRowsById.set(row.id, row)
  }

  const mappedDocuments = await mapDocumentRows([...mergedRowsById.values()])
  const byId = new Map(mappedDocuments.map((doc) => [doc.id, doc]))

  const complianceRows = await fetchWorkerComplianceRowsForWorkers(companyDriverIds)
  for (const row of complianceRows) {
    const workerName = driverNameById.get(row.worker_id) ?? 'Unknown worker'
    byId.set(row.id, mapWorkerComplianceToDocument(row, workerName, company))
  }

  const typesByWorker = new Map<string, Set<string>>()
  for (const doc of byId.values()) {
    if (doc.appliesTo !== 'worker' || !doc.workerId) continue
    const set = typesByWorker.get(doc.workerId) ?? new Set<string>()
    set.add(doc.documentType)
    typesByWorker.set(doc.workerId, set)
  }

  for (const driver of companyDrivers) {
    const existingTypes = typesByWorker.get(driver.id) ?? new Set<string>()
    for (const item of LEGACY_WORKER_EXPIRY_FIELDS) {
      const expiry = driver[item.field]
      if (typeof expiry !== 'string' || !expiry.trim()) continue
      if (workerDocumentTypesInclude(existingTypes, item.documentType)) continue
      const legacyDoc = mapLegacyWorkerExpiryToDocument(
        driver,
        item.documentType,
        expiry,
        company,
      )
      byId.set(legacyDoc.id, legacyDoc)
      existingTypes.add(item.documentType)
      typesByWorker.set(driver.id, existingTypes)
    }
  }

  return sortDocuments([...byId.values()])
}

export async function fetchDocumentById(id: string): Promise<Document | null> {
  const all = await fetchDocuments()
  return all.find((doc) => doc.id === id) ?? null
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

export async function deleteDocument(
  id: string,
  source: DocumentSource = 'documents',
): Promise<void> {
  if (source === 'legacy_worker') {
    throw new DocumentsServiceError(
      'Legacy worker expiry fields are managed on the worker profile and cannot be deleted here.',
    )
  }

  if (source === 'worker_compliance') {
    try {
      await deleteWorkerComplianceRecord(id)
    } catch (error) {
      throw new DocumentsServiceError(
        error instanceof Error ? error.message : 'Unable to delete worker compliance document.',
      )
    }
    // Also remove a mirrored documents row if the migration backfilled one
    await requireSupabase().from('documents').delete().eq('id', id)
    return
  }

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

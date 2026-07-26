import { computeDocumentStatus, workerDocumentTypesInclude } from '@/lib/documentUtils'
import type {
  CreateDocumentInput,
  Document,
  DocumentProvenanceKind,
  DocumentSource,
  DocumentsQuery,
  UpdateDocumentInput,
} from '@/lib/documentTypes'
import {
  MEDICAL_DOCUMENT_TYPE,
  isWorkerCoreDocumentType,
  normalizeMedicalDocumentType,
  normalizeTachographDocumentType,
  normalizeWorkerCoreDocumentType,
} from '@/lib/documentTypes'
import {
  getVerifiedCompanyName,
  requireVerifiedCompanyId,
} from '@/lib/companySettingsGlobals'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import { fetchCompanyWorkerDocumentSubmissions } from '@/services/workerDocumentSubmissionsService'
type WorkerLookupRow = {
  id: string
  first_name: string
  last_name: string
  archived_at?: string | null
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
  archived_at: string | null
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
  issue_date: string | null
  expiry_date: string | null
  file_url: string | null
  notes: string | null
  reference_number?: string | null
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
  deleted_at?: string | null
  deleted_by?: string | null
  delete_reason?: string | null
  source_kind?: string | null
  source_key?: string | null
  source_record_id?: string | null
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

const documentSelectBase = `
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
  updated_at,
  deleted_at,
  deleted_by,
  delete_reason
`

const documentSelect = `
  ${documentSelectBase},
  source_kind,
  source_key,
  source_record_id
`

function isMissingDocumentsProvenanceColumnError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    (normalized.includes('source_kind') ||
      normalized.includes('source_key') ||
      normalized.includes('source_record_id')) &&
    (normalized.includes('column') ||
      normalized.includes('schema cache') ||
      normalized.includes('does not exist'))
  )
}

function normalizeDocumentTypeForRow(documentType: string): string {
  const core = normalizeWorkerCoreDocumentType(documentType)
  if (core) return core
  return normalizeTachographDocumentType(normalizeMedicalDocumentType(documentType))
}

function normalizeProvenanceKind(value: string | null | undefined): DocumentProvenanceKind | null {
  if (value === 'legacy_worker' || value === 'worker_compliance') return value
  return null
}

function isMissingWorkerCoreMaterialisationError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('drevora_save_worker_core_document') ||
    normalized.includes('source_kind') ||
    normalized.includes('source_key') ||
    normalized.includes('source_record_id')
  ) && (
    normalized.includes('could not find') ||
    normalized.includes('does not exist') ||
    normalized.includes('schema cache') ||
    normalized.includes('function') ||
    normalized.includes('column')
  )
}

function workerCoreMaterialisationRequiredError(): DocumentsServiceError {
  return new DocumentsServiceError(
    'Worker core document sync is not available yet. Run migration 20260726140000_materialise_worker_core_documents.sql on your Supabase project.',
  )
}

function isMissingDocumentsSoftDeleteColumnError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    (normalized.includes('deleted_at') ||
      normalized.includes('deleted_by') ||
      normalized.includes('delete_reason')) &&
    (normalized.includes('column') ||
      normalized.includes('schema cache') ||
      normalized.includes('does not exist'))
  )
}

function softDeleteMigrationRequiredError(): DocumentsServiceError {
  return new DocumentsServiceError(
    'Document archive/restore is not available yet. Run migration 20260726120000_documents_soft_delete.sql on your Supabase project.',
  )
}

export class DocumentsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocumentsServiceError'
  }
}

/** Verified company display name — TRANSITIONAL legacy text/display only, never a filter. */
function resolveCompanyDisplayName(): string | null {
  return getVerifiedCompanyName()
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

type WorkerLookup = {
  name: string
  archivedAt: string | null
}

function mapRow(
  row: DocumentRow,
  workerLookups: Map<string, WorkerLookup>,
  vehicleLabels: Map<string, string>,
  source: DocumentSource = 'documents',
): Document {
  const worker = row.worker_id ? workerLookups.get(row.worker_id) : undefined
  return {
    id: row.id,
    company: row.company,
    documentName: row.document_name,
    documentType: normalizeDocumentTypeForRow(row.document_type),
    appliesTo: normalizeAppliesTo(row.applies_to),
    workerId: row.worker_id,
    workerName: worker?.name ?? null,
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
    deletedAt: row.deleted_at ?? null,
    deletedBy: row.deleted_by ?? null,
    deleteReason: row.delete_reason ?? null,
    workerArchivedAt: worker?.archivedAt ?? null,
    sourceKind: normalizeProvenanceKind(row.source_kind),
    sourceKey: row.source_key ?? null,
    sourceRecordId: row.source_record_id ?? null,
    source,
  }
}

function mapWorkerComplianceToDocument(
  row: WorkerComplianceSourceRow,
  workerName: string,
  company: string | null,
  workerArchivedAt: string | null = null,
): Document {
  const expiryDate = row.expiry_date
  return {
    id: row.id,
    company,
    documentName: row.document_name?.trim() || row.document_type,
    documentType: normalizeDocumentTypeForRow(row.document_type),
    appliesTo: 'worker',
    workerId: row.worker_id,
    workerName,
    vehicleId: null,
    vehicleLabel: null,
    // Prefer null when the live select omits reference_number.
    referenceNumber: row.reference_number?.trim() || null,
    issueDate: row.issue_date,
    expiryDate,
    fileUrl: row.file_url,
    filePath: null,
    notes: row.notes,
    status: computeDocumentStatus(expiryDate),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workerArchivedAt,
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
    workerArchivedAt: driver.archived_at?.trim() || null,
    source: 'legacy_worker',
  }
}

function mapWorkerSubmissionToDocument(
  submission: {
    id: string
    workerId: string
    documentType: string
    customDocumentName: string | null
    referenceNumber: string | null
    notes: string | null
    reviewStatus: 'pending_review' | 'reviewed' | 'rejected'
    rejectionReason: string | null
    submittedAt: string
    createdAt: string
    updatedAt: string
    deletedAt?: string | null
    deletedBy?: string | null
    deleteReason?: string | null
    attachments: Array<{
      id: string
      filePath: string
      originalFileName: string
      mimeType: string
      fileSizeBytes: number
      sortOrder: number
    }>
  },
  workerName: string,
  company: string | null,
  workerArchivedAt: string | null,
): Document {
  const sortedAttachments = [...submission.attachments].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const primaryName =
    submission.documentType === 'Other'
      ? submission.customDocumentName?.trim() || 'Other'
      : submission.documentType

  return {
    id: `ws-${submission.id}`,
    company,
    documentName: primaryName,
    documentType: submission.documentType,
    appliesTo: 'worker',
    workerId: submission.workerId,
    workerName,
    vehicleId: null,
    vehicleLabel: null,
    referenceNumber: submission.referenceNumber,
    issueDate: null,
    expiryDate: null,
    fileUrl: null,
    filePath: sortedAttachments[0]?.filePath ?? null,
    notes: submission.notes,
    status: 'no_expiry',
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
    deletedAt: submission.deletedAt?.trim() || null,
    deletedBy: submission.deletedBy?.trim() || null,
    deleteReason: submission.deleteReason?.trim() || null,
    workerArchivedAt,
    source: 'worker_submission',
    reviewStatus: submission.reviewStatus,
    rejectionReason: submission.rejectionReason,
    submittedAt: submission.submittedAt,
    submissionId: submission.id,
    attachmentCount: sortedAttachments.length,
    attachments: sortedAttachments.map((attachment) => ({
      id: attachment.id,
      filePath: attachment.filePath,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
      fileSizeBytes: attachment.fileSizeBytes,
      sortOrder: attachment.sortOrder,
    })),
  }
}

async function fetchWorkerLookupMap(workerIds: string[]): Promise<Map<string, WorkerLookup>> {
  const uniqueIds = [...new Set(workerIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await requireSupabase()
    .from('drivers')
    .select('id, first_name, last_name, archived_at')
    .in('id', uniqueIds)

  logSupabaseQuery({
    service: 'documentsService.fetchWorkerLookupMap',
    table: 'drivers',
    data,
    error,
  })

  if (error) {
    // Fallback without archived_at if the column is unavailable in an older schema.
    const { data: coreData, error: coreError } = await requireSupabase()
      .from('drivers')
      .select('id, first_name, last_name')
      .in('id', uniqueIds)

    if (coreError) {
      throw new DocumentsServiceError(error.message)
    }

    return new Map(
      (coreData ?? []).map((row) => {
        const worker = row as WorkerLookupRow
        return [
          worker.id,
          {
            name: `${worker.first_name} ${worker.last_name}`.trim(),
            archivedAt: null,
          },
        ]
      }),
    )
  }

  return new Map(
    (data ?? []).map((row) => {
      const worker = row as WorkerLookupRow
      return [
        worker.id,
        {
          name: `${worker.first_name} ${worker.last_name}`.trim(),
          archivedAt: worker.archived_at?.trim() || null,
        },
      ]
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

  const [workerLookups, vehicleLabels] = await Promise.all([
    fetchWorkerLookupMap(workerIds),
    fetchVehicleLabelMap(vehicleIds),
  ])

  return rows.map((row) => mapRow(row, workerLookups, vehicleLabels, 'documents'))
}

async function fetchCompanyDrivers(): Promise<CompanyDriverRow[]> {
  const companyId = requireVerifiedCompanyId()
  const request = requireSupabase()
    .from('drivers')
    .select(
      'id, first_name, last_name, company, archived_at, driving_licence_expiry, cpc_expiry, driver_card_expiry, medical_expiry, adr_expiry, hiab_expiry',
    )
    .eq('company_id', companyId)

  const { data, error } = await request

  logSupabaseQuery({
    service: 'documentsService.fetchCompanyDrivers',
    table: 'drivers',
    data,
    error,
  })

  if (error) {
    const fallback = requireSupabase()
      .from('drivers')
      .select('id, first_name, last_name, company, archived_at')
      .eq('company_id', companyId)
    const { data: coreData, error: coreError } = await fallback
    if (coreError) {
      const minimal = requireSupabase()
        .from('drivers')
        .select('id, first_name, last_name, company')
        .eq('company_id', companyId)
      const { data: minimalData, error: minimalError } = await minimal
      if (minimalError) throw new DocumentsServiceError(minimalError.message)
      return ((minimalData ?? []) as Array<
        Pick<CompanyDriverRow, 'id' | 'first_name' | 'last_name' | 'company'>
      >).map((row) => ({
        ...row,
        archived_at: null,
        driving_licence_expiry: null,
        cpc_expiry: null,
        driver_card_expiry: null,
        medical_expiry: null,
        adr_expiry: null,
        hiab_expiry: null,
      }))
    }
    return ((coreData ?? []) as Array<
      Pick<CompanyDriverRow, 'id' | 'first_name' | 'last_name' | 'company' | 'archived_at'>
    >).map((row) => ({
      ...row,
      archived_at: row.archived_at?.trim() || null,
      driving_licence_expiry: null,
      cpc_expiry: null,
      driver_card_expiry: null,
      medical_expiry: null,
      adr_expiry: null,
      hiab_expiry: null,
    }))
  }

  return ((data ?? []) as CompanyDriverRow[]).map((row) => ({
    ...row,
    archived_at: row.archived_at?.trim() || null,
  }))
}

async function fetchWorkerComplianceRowsForWorkers(
  workerIds: string[],
): Promise<WorkerComplianceSourceRow[]> {
  if (workerIds.length === 0) return []

  // Do not select reference_number — production table does not have that column.
  const { data, error } = await requireSupabase()
    .from('worker_compliance_records')
    .select(
      'id, worker_id, document_type, document_name, issue_date, expiry_date, file_url, notes, created_at, updated_at',
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
 *
 * When query.workerId is set, compliance + legacy merges are limited to that Worker only.
 */
export async function fetchDocuments(query: DocumentsQuery = {}): Promise<Document[]> {
  const companyId = requireVerifiedCompanyId()
  const company = resolveCompanyDisplayName()
  const companyDrivers = await fetchCompanyDrivers()
  const companyDriverIds = companyDrivers.map((driver) => driver.id)
  const selectedWorkerId =
    query.workerId && query.workerId !== 'all' ? query.workerId.trim() : null
  const scopedDrivers = selectedWorkerId
    ? companyDrivers.filter((driver) => driver.id === selectedWorkerId)
    : companyDrivers
  const scopedDriverIds = scopedDrivers.map((driver) => driver.id)
  const driverNameById = new Map(
    companyDrivers.map((driver) => [
      driver.id,
      `${driver.first_name} ${driver.last_name}`.trim(),
    ]),
  )

  async function queryCompanyDocuments(selectClause: string) {
    let request = requireSupabase()
      .from('documents')
      .select(selectClause)
      .eq('company_id', companyId)

    if (query.appliesTo && query.appliesTo !== 'all') {
      request = request.eq('applies_to', query.appliesTo)
    }

    if (query.type && query.type !== 'all') {
      request = request.eq('document_type', query.type)
    }

    if (selectedWorkerId) {
      request = request.eq('worker_id', selectedWorkerId)
    }

    if (query.vehicleId && query.vehicleId !== 'all') {
      request = request.eq('vehicle_id', query.vehicleId)
    }

    return request
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('document_name', { ascending: true })
  }

  let selectClause = documentSelect
  let { data, error } = await queryCompanyDocuments(selectClause)

  if (error && isMissingDocumentsProvenanceColumnError(error.message)) {
    selectClause = documentSelectBase
    ;({ data, error } = await queryCompanyDocuments(selectClause))
  }

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
    if (isMissingDocumentsSoftDeleteColumnError(error.message)) {
      throw softDeleteMigrationRequiredError()
    }
    throw new DocumentsServiceError(error.message)
  }

  const documentRows = (data ?? []) as unknown as DocumentRow[]

  // Company-wide orphan merge only — never expand a selected-Worker query.
  let orphanWorkerDocs: DocumentRow[] = []
  if (!selectedWorkerId && companyDriverIds.length > 0) {
    const { data: workerScopedData, error: workerScopedError } = await requireSupabase()
      .from('documents')
      .select(selectClause)
      .eq('company_id', companyId)
      .eq('applies_to', 'worker')
      .in('worker_id', companyDriverIds)

    logSupabaseQuery({
      service: 'documentsService.fetchDocuments.workerScoped',
      table: 'documents',
      data: workerScopedData,
      error: workerScopedError,
    })

    if (workerScopedError) {
      if (isMissingDocumentsSoftDeleteColumnError(workerScopedError.message)) {
        throw softDeleteMigrationRequiredError()
      }
    } else {
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
  const driverArchivedAtById = new Map(
    companyDrivers.map((driver) => [driver.id, driver.archived_at?.trim() || null]),
  )

  // Types already covered by real public.documents rows (active + soft-deleted).
  // Soft-deleted core docs must suppress compliance/legacy synthetic fallbacks.
  const typesByWorker = new Map<string, Set<string>>()
  for (const doc of byId.values()) {
    if (doc.appliesTo !== 'worker' || !doc.workerId) continue
    if (doc.source && doc.source !== 'documents') continue
    const set = typesByWorker.get(doc.workerId) ?? new Set<string>()
    set.add(doc.documentType)
    typesByWorker.set(doc.workerId, set)
  }

  const complianceRows = await fetchWorkerComplianceRowsForWorkers(scopedDriverIds)
  for (const row of complianceRows) {
    // Prefer the persisted documents row when IDs collide (prior compliance backfill).
    if (byId.has(row.id)) continue

    const existingTypes = typesByWorker.get(row.worker_id) ?? new Set<string>()
    if (workerDocumentTypesInclude(existingTypes, row.document_type)) continue

    const workerName = driverNameById.get(row.worker_id) ?? 'Unknown worker'
    byId.set(
      row.id,
      mapWorkerComplianceToDocument(
        row,
        workerName,
        company,
        driverArchivedAtById.get(row.worker_id) ?? null,
      ),
    )
    existingTypes.add(normalizeDocumentTypeForRow(row.document_type))
    typesByWorker.set(row.worker_id, existingTypes)
  }

  // Deduplicate legacy rows against persisted + compliance worker documents.
  for (const driver of scopedDrivers) {
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

  // Worker document submissions — namespaced ids (ws-{uuid}); never reuse documents UUIDs.
  const submissions = await fetchCompanyWorkerDocumentSubmissions()
  for (const submission of submissions) {
    if (selectedWorkerId && submission.workerId !== selectedWorkerId) continue
    const mapped = mapWorkerSubmissionToDocument(
      submission,
      driverNameById.get(submission.workerId) ?? 'Unknown worker',
      company,
      driverArchivedAtById.get(submission.workerId) ?? null,
    )
    byId.set(mapped.id, mapped)
  }

  // Ensure every worker-linked row carries drivers.archived_at for Active/Archived filtering.
  for (const [id, doc] of byId) {
    if (!doc.workerId) continue
    const archivedAt = driverArchivedAtById.get(doc.workerId) ?? null
    if (doc.workerArchivedAt !== archivedAt) {
      byId.set(id, { ...doc, workerArchivedAt: archivedAt })
    }
  }

  return sortDocuments([...byId.values()])
}

export async function fetchDocumentById(id: string): Promise<Document | null> {
  const all = await fetchDocuments()
  return all.find((doc) => doc.id === id) ?? null
}

/**
 * Worker Profile Documents tab — selected Worker only.
 * Filters at query level by worker_id; never falls back to all company documents.
 */
export async function fetchDocumentsByWorkerId(workerId: string): Promise<Document[]> {
  const trimmedWorkerId = workerId.trim()
  if (!trimmedWorkerId) return []

  const docs = await fetchDocuments({ workerId: trimmedWorkerId, appliesTo: 'worker' })
  return docs.filter((doc) => !doc.deletedAt)
}

/**
 * Vehicle Profile Documents tab — vehicle-linked rows only.
 * Must not reuse fetchDocuments(), which also merges company-wide worker
 * documents, worker_compliance_records, and legacy driver expiry fields (CPC, D4/Medical, etc.).
 */
export async function fetchDocumentsByVehicleId(vehicleId: string): Promise<Document[]> {
  const trimmedVehicleId = vehicleId.trim()
  if (!trimmedVehicleId) {
    return []
  }

  const companyId = requireVerifiedCompanyId()

  let vehicleSelect = documentSelect
  let { data, error } = await requireSupabase()
    .from('documents')
    .select(vehicleSelect)
    .eq('company_id', companyId)
    .eq('applies_to', 'vehicle')
    .eq('vehicle_id', trimmedVehicleId)
    .order('expiry_date', { ascending: true, nullsFirst: false })
    .order('document_name', { ascending: true })

  if (error && isMissingDocumentsProvenanceColumnError(error.message)) {
    vehicleSelect = documentSelectBase
    ;({ data, error } = await requireSupabase()
      .from('documents')
      .select(vehicleSelect)
      .eq('company_id', companyId)
      .eq('applies_to', 'vehicle')
      .eq('vehicle_id', trimmedVehicleId)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('document_name', { ascending: true }))
  }

  logSupabaseQuery({
    service: 'documentsService.fetchDocumentsByVehicleId',
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
    if (isMissingDocumentsSoftDeleteColumnError(error.message)) {
      throw softDeleteMigrationRequiredError()
    }
    throw new DocumentsServiceError(error.message)
  }

  const rows = ((data ?? []) as unknown as DocumentRow[]).filter(
    (row) =>
      row.applies_to === 'vehicle' &&
      row.vehicle_id === trimmedVehicleId &&
      !row.deleted_at,
  )

  return sortDocuments(await mapDocumentRows(rows))
}

async function saveWorkerCoreDocumentViaRpc(params: {
  mode: 'create' | 'update'
  documentId: string | null
  input: CreateDocumentInput | UpdateDocumentInput
  updateFilePath: boolean
}): Promise<Document> {
  const companyId = requireVerifiedCompanyId()
  const documentType =
    typeof params.input.documentType === 'string'
      ? normalizeDocumentTypeForRow(params.input.documentType)
      : null
  const workerId =
    typeof params.input.workerId === 'string' && params.input.workerId.trim()
      ? params.input.workerId.trim()
      : null

  if (!documentType || !isWorkerCoreDocumentType(documentType) || !workerId) {
    throw new DocumentsServiceError('Worker core document requires a Worker and synchronised type.')
  }

  const { data, error } = await requireSupabase().rpc('drevora_save_worker_core_document', {
    p_mode: params.mode,
    p_company_id: companyId,
    p_document_id: params.documentId,
    p_document_name:
      typeof params.input.documentName === 'string'
        ? params.input.documentName
        : documentType,
    p_document_type: documentType,
    p_worker_id: workerId,
    p_reference_number:
      typeof params.input.referenceNumber === 'string'
        ? params.input.referenceNumber
        : null,
    p_issue_date:
      typeof params.input.issueDate === 'string' && params.input.issueDate.trim()
        ? params.input.issueDate
        : null,
    p_expiry_date:
      typeof params.input.expiryDate === 'string' && params.input.expiryDate.trim()
        ? params.input.expiryDate
        : null,
    p_notes: typeof params.input.notes === 'string' ? params.input.notes : null,
    p_file_path:
      typeof params.input.filePath === 'string' ? params.input.filePath : null,
    p_update_file_path: params.updateFilePath,
  })

  logSupabaseQuery({
    service: `documentsService.saveWorkerCoreDocumentViaRpc.${params.mode}`,
    table: 'documents',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    if (isMissingWorkerCoreMaterialisationError(error.message)) {
      throw workerCoreMaterialisationRequiredError()
    }
    throw new DocumentsServiceError(error.message)
  }

  if (!data) {
    throw new DocumentsServiceError('Document could not be saved for your company.')
  }

  const rows = await mapDocumentRows([data as unknown as DocumentRow])
  return rows[0]
}

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  const companyId = requireVerifiedCompanyId()

  if (
    input.appliesTo === 'worker' &&
    input.workerId &&
    isWorkerCoreDocumentType(input.documentType)
  ) {
    return saveWorkerCoreDocumentViaRpc({
      mode: 'create',
      documentId: null,
      input,
      updateFilePath: Boolean(input.filePath),
    })
  }

  const status = computeDocumentStatus(input.expiryDate ?? null)
  const payload = {
    ...toDbPayload(input),
    // Authoritative tenant key + transitional legacy company text.
    company_id: companyId,
    company: resolveCompanyDisplayName(),
    status,
    worker_id: input.appliesTo === 'worker' ? input.workerId ?? null : null,
    vehicle_id: input.appliesTo === 'vehicle' ? input.vehicleId ?? null : null,
  }

  const { data, error } = await requireSupabase()
    .from('documents')
    .insert(payload)
    .select(documentSelectBase)
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
  const companyId = requireVerifiedCompanyId()

  const { data: existing, error: existingError } = await requireSupabase()
    .from('documents')
    .select(
      'id, document_type, applies_to, worker_id, expiry_date, document_name, reference_number, issue_date, notes, file_path, deleted_at',
    )
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (existingError) {
    if (isMissingWorkerCoreMaterialisationError(existingError.message)) {
      throw workerCoreMaterialisationRequiredError()
    }
    throw new DocumentsServiceError(existingError.message)
  }

  if (!existing) {
    throw new DocumentsServiceError(
      'Document could not be updated for your company. Refresh and try again.',
    )
  }

  const appliesTo = input.appliesTo ?? normalizeAppliesTo(String(existing.applies_to))
  const documentType = normalizeDocumentTypeForRow(
    typeof input.documentType === 'string'
      ? input.documentType
      : String(existing.document_type),
  )
  const workerId =
    typeof input.workerId === 'string' && input.workerId.trim()
      ? input.workerId.trim()
      : typeof existing.worker_id === 'string'
        ? existing.worker_id
        : null

  // Worker core docs always go through the atomic RPC (mandatory expiry sync).
  // File-only saves reassert the stored expiry so profile and document stay aligned.
  if (appliesTo === 'worker' && workerId && isWorkerCoreDocumentType(documentType)) {
    return saveWorkerCoreDocumentViaRpc({
      mode: 'update',
      documentId: id,
      input: {
        documentName:
          typeof input.documentName === 'string'
            ? input.documentName
            : String(existing.document_name ?? documentType),
        documentType,
        appliesTo: 'worker',
        workerId,
        referenceNumber:
          typeof input.referenceNumber === 'string'
            ? input.referenceNumber
            : (existing.reference_number as string | null) ?? null,
        issueDate:
          typeof input.issueDate === 'string'
            ? input.issueDate
            : (existing.issue_date as string | null) ?? null,
        expiryDate:
          typeof input.expiryDate === 'string'
            ? input.expiryDate
            : (existing.expiry_date as string | null) ?? null,
        notes:
          typeof input.notes === 'string'
            ? input.notes
            : (existing.notes as string | null) ?? null,
        filePath:
          typeof input.filePath === 'string'
            ? input.filePath
            : (existing.file_path as string | null) ?? null,
      },
      updateFilePath: Object.prototype.hasOwnProperty.call(input, 'filePath'),
    })
  }

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

  const { data, error } = await requireSupabase()
    .from('documents')
    .update(payload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select(documentSelectBase)
    .maybeSingle()

  logSupabaseQuery({
    service: 'documentsService.updateDocument',
    table: 'documents',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new DocumentsServiceError(error.message)
  }

  if (!data) {
    throw new DocumentsServiceError(
      'Document could not be updated for your company. Refresh and try again.',
    )
  }

  const rows = await mapDocumentRows([data as unknown as DocumentRow])
  return rows[0]
}

/**
 * Soft-delete a persisted public.documents row.
 * Does not SQL DELETE, does not remove Storage files, and never clears Worker profile expiry fields.
 */
export async function softDeleteDocument(
  id: string,
  source: DocumentSource = 'documents',
  options?: { deleteReason?: string | null },
): Promise<Document> {
  if (source === 'legacy_worker') {
    throw new DocumentsServiceError(
      'Legacy worker expiry fields are managed on the worker profile and cannot be archived here.',
    )
  }

  if (source === 'worker_compliance' || source === 'vehicle_compliance') {
    throw new DocumentsServiceError(
      'Compliance profile records are managed on the worker/vehicle compliance profile and cannot be archived from Documents.',
    )
  }

  if (source === 'worker_submission') {
    throw new DocumentsServiceError(
      'Worker submissions cannot be deleted from Documents. Mark them reviewed or rejected instead.',
    )
  }

  const companyId = requireVerifiedCompanyId()
  const supabase = requireSupabase()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) {
    throw new DocumentsServiceError(userError.message)
  }

  const deletedAt = new Date().toISOString()
  const deletedBy = userData.user?.id ?? null
  const deleteReason = options?.deleteReason?.trim() || null

  const { data, error } = await supabase
    .from('documents')
    .update({
      deleted_at: deletedAt,
      deleted_by: deletedBy,
      delete_reason: deleteReason,
      updated_at: deletedAt,
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .select(documentSelectBase)
    .maybeSingle()

  logSupabaseQuery({
    service: 'documentsService.softDeleteDocument',
    table: 'documents',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    if (isMissingDocumentsSoftDeleteColumnError(error.message)) {
      throw softDeleteMigrationRequiredError()
    }
    throw new DocumentsServiceError(error.message)
  }

  if (!data) {
    throw new DocumentsServiceError(
      'Document could not be archived for your company. It may already be archived — refresh and try again.',
    )
  }

  const rows = await mapDocumentRows([data as unknown as DocumentRow])
  return rows[0]
}

/** @deprecated Prefer softDeleteDocument — hard delete is not used by Admin Documents. */
export async function deleteDocument(
  id: string,
  source: DocumentSource = 'documents',
): Promise<void> {
  await softDeleteDocument(id, source)
}

export async function restoreDocument(id: string): Promise<Document> {
  const companyId = requireVerifiedCompanyId()
  const supabase = requireSupabase()

  const { data: existing, error: existingError } = await supabase
    .from('documents')
    .select('id, worker_id, deleted_at')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (existingError) {
    if (isMissingDocumentsSoftDeleteColumnError(existingError.message)) {
      throw softDeleteMigrationRequiredError()
    }
    throw new DocumentsServiceError(existingError.message)
  }

  if (!existing || !existing.deleted_at) {
    throw new DocumentsServiceError(
      'Document could not be restored for your company. Refresh and try again.',
    )
  }

  const workerId = typeof existing.worker_id === 'string' ? existing.worker_id : null
  if (workerId) {
    const { data: workerRow, error: workerError } = await supabase
      .from('drivers')
      .select('id, archived_at')
      .eq('id', workerId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (workerError) {
      throw new DocumentsServiceError(workerError.message)
    }

    if (workerRow?.archived_at) {
      throw new DocumentsServiceError(
        'This document belongs to an archived Worker and cannot be restored until the Worker is restored.',
      )
    }
  }

  const restoredAt = new Date().toISOString()

  const { data, error } = await supabase
    .from('documents')
    .update({
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      updated_at: restoredAt,
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .not('deleted_at', 'is', null)
    .select(documentSelectBase)
    .maybeSingle()

  logSupabaseQuery({
    service: 'documentsService.restoreDocument',
    table: 'documents',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    if (isMissingDocumentsSoftDeleteColumnError(error.message)) {
      throw softDeleteMigrationRequiredError()
    }
    throw new DocumentsServiceError(error.message)
  }

  if (!data) {
    throw new DocumentsServiceError(
      'Document could not be restored for your company. Refresh and try again.',
    )
  }

  const rows = await mapDocumentRows([data as unknown as DocumentRow])
  return rows[0]
}

export const documentsService = {
  fetchDocuments,
  fetchDocumentById,
  fetchDocumentsByWorkerId,
  fetchDocumentsByVehicleId,
  createDocument,
  updateDocument,
  softDeleteDocument,
  restoreDocument,
  deleteDocument,
}

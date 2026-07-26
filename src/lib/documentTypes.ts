export const DOCUMENT_APPLIES_TO = ['company', 'worker', 'vehicle'] as const

export type DocumentAppliesTo = (typeof DOCUMENT_APPLIES_TO)[number]

export const COMPANY_DOCUMENT_TYPES = [
  'Operator Licence',
  'Company Insurance',
  'Public Liability Insurance',
  'Employer Liability Insurance',
  'Policy',
  'Contract',
  'Other',
] as const

export const WORKER_DOCUMENT_TYPES = [
  'Driving Licence',
  'CPC',
  'Tachograph Card',
  'D4 / Medical',
  'Right to Work',
  'Training Certificate',
  'Other',
] as const

/** Canonical type shown in Documents Centre for D4 / medical certificate rows. */
export const MEDICAL_DOCUMENT_TYPE = 'D4 / Medical'

/** Historical aliases that must dedupe against MEDICAL_DOCUMENT_TYPE. */
export const MEDICAL_DOCUMENT_TYPE_ALIASES = [
  'D4 / Medical',
  'Medical',
  'Medical Certificate',
] as const

/** Canonical Tachograph / tacho card type used by Worker profile + Documents. */
export const TACHOGRAPH_DOCUMENT_TYPE = 'Tachograph Card'

export const TACHOGRAPH_DOCUMENT_TYPE_ALIASES = [
  'Tachograph Card',
  'Tacho Card',
] as const

/** Worker document types materialised into public.documents with expiry sync. */
export const WORKER_CORE_DOCUMENT_TYPES = [
  'Driving Licence',
  'CPC',
  TACHOGRAPH_DOCUMENT_TYPE,
  MEDICAL_DOCUMENT_TYPE,
] as const

export type WorkerCoreDocumentType = (typeof WORKER_CORE_DOCUMENT_TYPES)[number]

export function isMedicalDocumentType(documentType: string | null | undefined): boolean {
  const normalized = documentType?.trim()
  if (!normalized) return false
  return (MEDICAL_DOCUMENT_TYPE_ALIASES as readonly string[]).includes(normalized)
}

export function normalizeMedicalDocumentType(documentType: string): string {
  return isMedicalDocumentType(documentType) ? MEDICAL_DOCUMENT_TYPE : documentType
}

export function isTachographDocumentType(documentType: string | null | undefined): boolean {
  const normalized = documentType?.trim()
  if (!normalized) return false
  return (TACHOGRAPH_DOCUMENT_TYPE_ALIASES as readonly string[]).includes(normalized)
}

export function normalizeTachographDocumentType(documentType: string): string {
  return isTachographDocumentType(documentType) ? TACHOGRAPH_DOCUMENT_TYPE : documentType
}

/** Normalize medical + tachograph aliases to canonical Worker core types. */
export function normalizeWorkerCoreDocumentType(
  documentType: string | null | undefined,
): WorkerCoreDocumentType | null {
  const trimmed = documentType?.trim()
  if (!trimmed) return null
  if (trimmed === 'Driving Licence' || trimmed === 'CPC') return trimmed
  if (isTachographDocumentType(trimmed)) return TACHOGRAPH_DOCUMENT_TYPE
  if (isMedicalDocumentType(trimmed)) return MEDICAL_DOCUMENT_TYPE
  return null
}

export function isWorkerCoreDocumentType(documentType: string | null | undefined): boolean {
  return normalizeWorkerCoreDocumentType(documentType) !== null
}

export const VEHICLE_DOCUMENT_TYPES = [
  'MOT',
  'Insurance',
  'Tax',
  'Service Record',
  'Calibration',
  'LOLER',
  'Other',
] as const

export type CompanyDocumentType = (typeof COMPANY_DOCUMENT_TYPES)[number]
export type WorkerDocumentType = (typeof WORKER_DOCUMENT_TYPES)[number]
export type VehicleDocumentType = (typeof VEHICLE_DOCUMENT_TYPES)[number]

export type DocumentType = CompanyDocumentType | WorkerDocumentType | VehicleDocumentType | string

export const DOCUMENT_STATUSES = ['valid', 'expiring_soon', 'expired', 'no_expiry'] as const

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export type DocumentSource =
  | 'documents'
  | 'worker_compliance'
  | 'vehicle_compliance'
  | 'legacy_worker'
  | 'worker_submission'

/** Top-level Admin Documents page views (not URL routes). */
export const DOCUMENTS_PAGE_MODES = ['worker_uploads', 'managed'] as const

export type DocumentsPageMode = (typeof DOCUMENTS_PAGE_MODES)[number]

/** Status / lifecycle filter used inside the Worker Uploads view. */
export const WORKER_UPLOAD_STATUS_FILTERS = [
  'all',
  'pending_review',
  'reviewed',
  'rejected',
  'archived',
] as const

export type DocumentWorkerUploadStatusFilter =
  (typeof WORKER_UPLOAD_STATUS_FILTERS)[number]

/** @deprecated Prefer DocumentsPageMode + DocumentWorkerUploadStatusFilter */
export const WORKER_SUBMISSION_REVIEW_FILTERS = [
  'all',
  'worker_uploads',
  'pending_review',
  'reviewed',
  'rejected',
] as const

/** @deprecated Prefer DocumentWorkerUploadStatusFilter */
export type DocumentWorkerUploadFilter =
  (typeof WORKER_SUBMISSION_REVIEW_FILTERS)[number]

export type WorkerSubmissionReviewStatus =
  | 'pending_review'
  | 'reviewed'
  | 'rejected'

export type DocumentSubmissionAttachment = {
  id: string
  filePath: string
  originalFileName: string
  mimeType: string
  fileSizeBytes: number
  sortOrder: number
}

/** Why a document appears in the Archived lifecycle view. */
export type DocumentArchiveReason = 'deleted_document' | 'archived_worker'

/** Documents list lifecycle filter (separate from expiry status). */
export type DocumentLifecycleFilter = 'active' | 'archived' | 'all'

export type DocumentProvenanceKind = 'legacy_worker' | 'worker_compliance'

export type Document = {
  id: string
  company: string | null
  documentName: string
  documentType: string
  appliesTo: DocumentAppliesTo
  workerId: string | null
  workerName: string | null
  vehicleId: string | null
  vehicleLabel: string | null
  referenceNumber: string | null
  issueDate: string | null
  expiryDate: string | null
  fileUrl: string | null
  filePath: string | null
  notes: string | null
  status: DocumentStatus
  createdAt: string
  updatedAt: string
  /** Soft-delete timestamp from public.documents.deleted_at (null = not manually deleted). */
  deletedAt?: string | null
  deletedBy?: string | null
  deleteReason?: string | null
  /** Linked worker drivers.archived_at when appliesTo worker. */
  workerArchivedAt?: string | null
  /** Durable provenance for materialised Worker core documents. */
  sourceKind?: DocumentProvenanceKind | null
  sourceKey?: string | null
  sourceRecordId?: string | null
  /** Where the row was resolved from (Documents Centre may merge multiple sources). */
  source?: DocumentSource
  /** Worker submission review fields (source === worker_submission). */
  reviewStatus?: WorkerSubmissionReviewStatus | null
  rejectionReason?: string | null
  submittedAt?: string | null
  submissionId?: string | null
  attachmentCount?: number
  attachments?: DocumentSubmissionAttachment[]
}

export type DocumentsCentreTab =
  | 'all'
  | 'company'
  | 'workers'
  | 'vehicles'
  | 'expiring-soon'
  | 'expired'

export const DOCUMENTS_CENTRE_TABS: { id: Exclude<DocumentsCentreTab, 'all'>; label: string }[] = [
  { id: 'company', label: 'Company' },
  { id: 'workers', label: 'Workers' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'expiring-soon', label: 'Expiring Soon' },
  { id: 'expired', label: 'Expired' },
]

export type DocumentTypeFilter = string | 'all'
export type DocumentAppliesToFilter = DocumentAppliesTo | 'all'
export type DocumentStatusFilter = DocumentStatus | 'all'

export function isDocumentSoftDeleted(document: Pick<Document, 'deletedAt'>): boolean {
  return Boolean(document.deletedAt?.trim())
}

export function isWorkerArchivedForDocument(
  document: Pick<Document, 'workerArchivedAt'>,
): boolean {
  return Boolean(document.workerArchivedAt?.trim())
}

/** Soft-deleted or retained under an archived Worker — not in the default Active list. */
export function isDocumentInArchivedLifecycle(
  document: Pick<Document, 'deletedAt' | 'workerArchivedAt'>,
): boolean {
  return isDocumentSoftDeleted(document) || isWorkerArchivedForDocument(document)
}

/**
 * Archive reason for UI labels.
 * Manual soft-delete takes precedence when both apply.
 */
export function getDocumentArchiveReason(
  document: Pick<Document, 'deletedAt' | 'workerArchivedAt'>,
): DocumentArchiveReason | null {
  if (isDocumentSoftDeleted(document)) return 'deleted_document'
  if (isWorkerArchivedForDocument(document)) return 'archived_worker'
  return null
}

export function getDocumentArchiveReasonLabel(reason: DocumentArchiveReason): string {
  return reason === 'deleted_document' ? 'Deleted document' : 'Archived Worker'
}

/** @deprecated Prefer isDocumentSoftDeleted / isDocumentInArchivedLifecycle */
export function isDocumentArchived(document: Pick<Document, 'deletedAt'>): boolean {
  return isDocumentSoftDeleted(document)
}

export type DocumentsQuery = {
  search?: string
  appliesTo?: DocumentAppliesToFilter
  type?: DocumentTypeFilter
  status?: DocumentStatusFilter
  lifecycle?: DocumentLifecycleFilter
  /** @deprecated Managed view excludes submissions at the page layer. */
  workerUploadFilter?: DocumentWorkerUploadFilter
  workerUploadStatusFilter?: DocumentWorkerUploadStatusFilter
  workerId?: string | 'all'
  vehicleId?: string | 'all'
  tab?: DocumentsCentreTab
  /** When set, restricts rows by canonical Documents Centre source. */
  pageMode?: DocumentsPageMode
}

export type CreateDocumentInput = {
  documentName: string
  documentType: string
  appliesTo: DocumentAppliesTo
  workerId?: string | null
  vehicleId?: string | null
  referenceNumber?: string | null
  issueDate?: string | null
  expiryDate?: string | null
  fileUrl?: string | null
  filePath?: string | null
  notes?: string | null
}

export type UpdateDocumentInput = Partial<CreateDocumentInput>

export type DocumentFormValues = {
  documentName: string
  documentType: string
  appliesTo: DocumentAppliesTo
  workerId: string
  vehicleId: string
  referenceNumber: string
  issueDate: string
  expiryDate: string
  notes: string
}

export type DocumentFormSubmitPayload = {
  values: DocumentFormValues
  file: File | null
  removeFile: boolean
}

export const DEFAULT_DOCUMENT_PAGE_SIZE = 25
export const DOCUMENT_PAGE_SIZE_OPTIONS = [25, 50, 100] as const

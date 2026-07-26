import type {
  Document,
  DocumentAppliesTo,
  DocumentFormValues,
  DocumentStatus,
  DocumentsCentreTab,
  DocumentsQuery,
  WorkerSubmissionReviewStatus,
} from '@/lib/documentTypes'
import {
  COMPANY_DOCUMENT_TYPES,
  MEDICAL_DOCUMENT_TYPE,
  VEHICLE_DOCUMENT_TYPES,
  WORKER_DOCUMENT_TYPES,
  isDocumentInArchivedLifecycle,
  isMedicalDocumentType,
  isTachographDocumentType,
  normalizeMedicalDocumentType,
  normalizeTachographDocumentType,
  normalizeWorkerCoreDocumentType,
} from '@/lib/documentTypes'
import type { CreateDocumentInput } from '@/lib/documentTypes'

/** Worker-archived document retention window (calendar months). */
export const WORKER_DOCUMENT_RETENTION_MONTHS = 24

/**
 * Add calendar months to an ISO timestamp/date without treating months as fixed days.
 * Clamps end-of-month overflow (e.g. 31 Jan + 1 month → 28/29 Feb).
 */
export function addCalendarMonths(isoTimestamp: string, months: number): Date | null {
  const start = new Date(isoTimestamp)
  if (Number.isNaN(start.getTime())) return null

  const year = start.getFullYear()
  const month = start.getMonth()
  const day = start.getDate()
  const hours = start.getHours()
  const minutes = start.getMinutes()
  const seconds = start.getSeconds()
  const ms = start.getMilliseconds()

  const target = new Date(year, month + months, 1, hours, minutes, seconds, ms)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, lastDay))
  return target
}

/** Retention until = worker archived_at + 24 calendar months. */
export function getWorkerDocumentRetentionUntil(
  workerArchivedAt: string | null | undefined,
): Date | null {
  if (!workerArchivedAt?.trim()) return null
  return addCalendarMonths(workerArchivedAt, WORKER_DOCUMENT_RETENTION_MONTHS)
}

function toLocalIsoDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatRetentionUntilDate(
  workerArchivedAt: string | null | undefined,
  formatDate: (value: string) => string,
): string | null {
  const until = getWorkerDocumentRetentionUntil(workerArchivedAt)
  if (!until) return null
  return formatDate(toLocalIsoDate(until))
}

/** Full UI label, e.g. "Retention until: 26 July 2028". */
export function formatRetentionUntilLabel(
  workerArchivedAt: string | null | undefined,
  formatDate: (value: string) => string,
): string | null {
  const dateLabel = formatRetentionUntilDate(workerArchivedAt, formatDate)
  if (!dateLabel) return null
  return `Retention until: ${dateLabel}`
}

/** Persisted public.documents rows that may be edited while Active. */
export function canEditDocumentRecord(document: Document): boolean {
  if (document.source && document.source !== 'documents') return false
  if (isDocumentInArchivedLifecycle(document)) return false
  return true
}

/** Soft-deleted persisted rows may be restored only when the Worker is not archived. */
export function canRestoreDocumentRecord(document: Document): boolean {
  if (document.source && document.source !== 'documents') return false
  if (!document.deletedAt?.trim()) return false
  if (document.workerArchivedAt?.trim()) return false
  return true
}

export const DOCUMENT_EXPIRING_SOON_DAYS = 30

export function getToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

export function getDaysRemaining(value: string | null | undefined): number | null {
  if (!value) return null
  const expiryDate = new Date(`${value}T00:00:00`)
  if (Number.isNaN(expiryDate.getTime())) return null
  return Math.ceil((expiryDate.getTime() - getToday().getTime()) / 86_400_000)
}

export function computeDocumentStatus(expiryDate: string | null | undefined): DocumentStatus {
  if (!expiryDate?.trim()) return 'no_expiry'
  const daysRemaining = getDaysRemaining(expiryDate)
  if (daysRemaining === null) return 'no_expiry'
  if (daysRemaining < 0) return 'expired'
  if (daysRemaining <= DOCUMENT_EXPIRING_SOON_DAYS) return 'expiring_soon'
  return 'valid'
}

export function getDocumentStatusLabel(status: DocumentStatus | 'archived'): string {
  switch (status) {
    case 'valid':
      return 'Valid'
    case 'expiring_soon':
      return 'Expiring Soon'
    case 'expired':
      return 'Expired'
    case 'no_expiry':
      return 'No Expiry'
    case 'archived':
      return 'Archived'
    default:
      return status
  }
}

export const documentStatusClassMap: Record<DocumentStatus | 'archived', string> = {
  valid:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
  expiring_soon:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
  expired:
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60',
  no_expiry:
    'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
  archived:
    'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
}

/** Display status — Archived overrides expiry for soft-deleted or archived-worker rows. */
export function getDocumentDisplayStatus(
  document: Pick<Document, 'status' | 'deletedAt' | 'workerArchivedAt'>,
): DocumentStatus | 'archived' {
  return isDocumentInArchivedLifecycle(document) ? 'archived' : document.status
}

export function getDocumentTypesForAppliesTo(
  appliesTo: DocumentAppliesTo,
  options?: { allowMedicalDocumentUploads?: boolean },
): readonly string[] {
  let types: readonly string[]
  switch (appliesTo) {
    case 'company':
      types = COMPANY_DOCUMENT_TYPES
      break
    case 'worker':
      types = WORKER_DOCUMENT_TYPES
      break
    case 'vehicle':
      types = VEHICLE_DOCUMENT_TYPES
      break
    default:
      types = []
  }

  if (appliesTo === 'worker' && options?.allowMedicalDocumentUploads === false) {
    return types.filter((type) => !isMedicalDocumentType(type))
  }

  return types
}

export function workerDocumentTypesInclude(
  existingTypes: Set<string>,
  documentType: string,
): boolean {
  if (isMedicalDocumentType(documentType)) {
    for (const existing of existingTypes) {
      if (isMedicalDocumentType(existing)) return true
    }
    return false
  }

  if (isTachographDocumentType(documentType)) {
    for (const existing of existingTypes) {
      if (isTachographDocumentType(existing)) return true
    }
    return false
  }

  const canonical = normalizeWorkerCoreDocumentType(documentType)
  if (canonical) {
    for (const existing of existingTypes) {
      if (normalizeWorkerCoreDocumentType(existing) === canonical) return true
    }
  }

  return (
    existingTypes.has(documentType) ||
    existingTypes.has(normalizeMedicalDocumentType(documentType)) ||
    existingTypes.has(normalizeTachographDocumentType(documentType))
  )
}

export { MEDICAL_DOCUMENT_TYPE, isMedicalDocumentType, isTachographDocumentType }

export function buildEmptyDocumentFormValues(
  appliesTo: DocumentAppliesTo = 'company',
): DocumentFormValues {
  const types = getDocumentTypesForAppliesTo(appliesTo)
  return {
    documentName: '',
    documentType: types[0] ?? 'Other',
    appliesTo,
    workerId: '',
    vehicleId: '',
    referenceNumber: '',
    issueDate: '',
    expiryDate: '',
    notes: '',
  }
}

export function documentToFormValues(document: Document): DocumentFormValues {
  return {
    documentName: document.documentName,
    documentType: document.documentType,
    appliesTo: document.appliesTo,
    workerId: document.workerId ?? '',
    vehicleId: document.vehicleId ?? '',
    referenceNumber: document.referenceNumber ?? '',
    issueDate: document.issueDate ?? '',
    expiryDate: document.expiryDate ?? '',
    notes: document.notes ?? '',
  }
}

export function validateDocumentForm(values: DocumentFormValues): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!values.documentName.trim() && !values.documentType.trim()) {
    errors.documentName = 'Document name or type is required.'
  }

  if (!values.documentType.trim()) {
    errors.documentType = 'Document type is required.'
  }

  if (values.appliesTo === 'worker' && !values.workerId.trim()) {
    errors.workerId = 'Worker is required.'
  }

  if (values.appliesTo === 'vehicle' && !values.vehicleId.trim()) {
    errors.vehicleId = 'Vehicle is required.'
  }

  return errors
}

export function documentFormValuesToInput(values: DocumentFormValues): CreateDocumentInput {
  return {
    documentName: values.documentName.trim() || values.documentType.trim(),
    documentType: values.documentType.trim(),
    appliesTo: values.appliesTo,
    workerId: values.appliesTo === 'worker' ? values.workerId.trim() : null,
    vehicleId: values.appliesTo === 'vehicle' ? values.vehicleId.trim() : null,
    referenceNumber: values.referenceNumber.trim() || null,
    issueDate: values.issueDate.trim() || null,
    expiryDate: values.expiryDate.trim() || null,
    notes: values.notes.trim() || null,
  }
}

export function filterDocumentsByTab(
  documents: Document[],
  tab: DocumentsCentreTab,
): Document[] {
  switch (tab) {
    case 'all':
      return documents
    case 'company':
      return documents.filter((doc) => doc.appliesTo === 'company')
    case 'workers':
      return documents.filter((doc) => doc.appliesTo === 'worker')
    case 'vehicles':
      return documents.filter((doc) => doc.appliesTo === 'vehicle')
    case 'expiring-soon':
      return documents.filter(
        (doc) => doc.source !== 'worker_submission' && doc.status === 'expiring_soon',
      )
    case 'expired':
      return documents.filter(
        (doc) => doc.source !== 'worker_submission' && doc.status === 'expired',
      )
    default:
      return documents
  }
}

export function getDocumentRelatedToLabel(document: Document): string {
  if (document.appliesTo === 'worker') {
    return document.workerName?.trim() || '—'
  }
  if (document.appliesTo === 'vehicle') {
    return document.vehicleLabel?.trim() || '—'
  }
  return document.company?.trim() || 'Company'
}

export function getDocumentPrimaryName(document: Document): string {
  return document.documentName?.trim() || document.documentType || 'Document'
}

/** Secondary type line only when it differs from the primary name. */
export function getDocumentSecondaryType(document: Document): string | null {
  const primary = getDocumentPrimaryName(document)
  const type = document.documentType?.trim() || ''
  if (!type || type.toLowerCase() === primary.toLowerCase()) return null
  return type
}

export function getWorkerSubmissionReviewLabel(
  status: WorkerSubmissionReviewStatus | null | undefined,
): string {
  switch (status) {
    case 'pending_review':
      return 'Pending review'
    case 'reviewed':
      return 'Reviewed'
    case 'rejected':
      return 'Rejected'
    default:
      return 'Pending review'
  }
}

export const workerSubmissionReviewClassMap: Record<WorkerSubmissionReviewStatus, string> = {
  pending_review:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
  reviewed:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
  rejected:
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60',
}

export function isWorkerSubmissionDocument(document: Document): boolean {
  return document.source === 'worker_submission'
}

export function canReviewWorkerSubmission(document: Document): boolean {
  return (
    isWorkerSubmissionDocument(document) &&
    document.reviewStatus === 'pending_review' &&
    !isDocumentInArchivedLifecycle(document)
  )
}

export type DocumentSummaryStats = {
  company: number
  workers: number
  vehicles: number
  expiringSoon: number
  expired: number
}

/**
 * Counts from the full documents list (not the filtered table rows).
 * Excludes manually soft-deleted docs and docs for archived Workers.
 */
export function computeDocumentSummaryStats(documents: Document[]): DocumentSummaryStats {
  let company = 0
  let workers = 0
  let vehicles = 0
  let expiringSoon = 0
  let expired = 0

  for (const doc of documents) {
    if (isDocumentInArchivedLifecycle(doc)) continue
    if (doc.source === 'worker_submission') {
      // Worker uploads count under Workers; they are not expiry documents.
      workers += 1
      continue
    }
    if (doc.appliesTo === 'company') company += 1
    if (doc.appliesTo === 'worker') workers += 1
    if (doc.appliesTo === 'vehicle') vehicles += 1
    if (doc.status === 'expiring_soon') expiringSoon += 1
    if (doc.status === 'expired') expired += 1
  }

  return { company, workers, vehicles, expiringSoon, expired }
}

export function filterDocumentsByQuery(documents: Document[], query: DocumentsQuery): Document[] {
  let result = documents

  const lifecycle = query.lifecycle ?? 'active'
  if (lifecycle === 'active') {
    result = result.filter((doc) => !isDocumentInArchivedLifecycle(doc))
  } else if (lifecycle === 'archived') {
    result = result.filter((doc) => isDocumentInArchivedLifecycle(doc))
  }

  if (query.tab) {
    result = filterDocumentsByTab(result, query.tab)
  }

  if (query.appliesTo && query.appliesTo !== 'all') {
    result = result.filter((doc) => doc.appliesTo === query.appliesTo)
  }

  if (query.type && query.type !== 'all') {
    result = result.filter((doc) => doc.documentType === query.type)
  }

  if (query.status && query.status !== 'all') {
    result = result.filter(
      (doc) => doc.source !== 'worker_submission' && doc.status === query.status,
    )
  }

  if (query.workerUploadFilter && query.workerUploadFilter !== 'all') {
    if (query.workerUploadFilter === 'worker_uploads') {
      result = result.filter((doc) => doc.source === 'worker_submission')
    } else {
      result = result.filter(
        (doc) =>
          doc.source === 'worker_submission' &&
          doc.reviewStatus === query.workerUploadFilter,
      )
    }
  }

  if (query.workerId && query.workerId !== 'all') {
    result = result.filter((doc) => doc.workerId === query.workerId)
  }

  if (query.vehicleId && query.vehicleId !== 'all') {
    result = result.filter((doc) => doc.vehicleId === query.vehicleId)
  }

  const search = query.search?.trim().toLowerCase()
  if (search) {
    result = result.filter((doc) => {
      const haystack = [
        doc.documentName,
        doc.documentType,
        doc.referenceNumber,
        doc.workerName,
        doc.vehicleLabel,
        doc.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(search)
    })
  }

  return result
}

export function hasDocumentFile(document: Document): boolean {
  if (isWorkerSubmissionDocument(document)) {
    return (document.attachmentCount ?? document.attachments?.length ?? 0) > 0
  }
  return Boolean(document.filePath?.trim() || document.fileUrl?.trim())
}

export function getDocumentFileCountLabel(document: Document): string {
  if (isWorkerSubmissionDocument(document)) {
    const count = document.attachmentCount ?? document.attachments?.length ?? 0
    return count === 1 ? '1 file' : `${count} files`
  }
  return hasDocumentFile(document) ? 'View' : 'No file uploaded'
}

export type DocumentViewTarget =
  | { kind: 'file' }
  | { kind: 'worker'; workerId: string }
  | { kind: 'vehicle'; vehicleId: string }
  | { kind: 'none' }

/** Resolve what the Documents table “View” action should do for a row. */
export function getDocumentViewTarget(document: Document): DocumentViewTarget {
  if (hasDocumentFile(document)) return { kind: 'file' }

  const workerId = document.workerId?.trim()
  if (workerId) return { kind: 'worker', workerId }

  const vehicleId = document.vehicleId?.trim()
  if (vehicleId) return { kind: 'vehicle', vehicleId }

  return { kind: 'none' }
}

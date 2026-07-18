import type {
  Document,
  DocumentAppliesTo,
  DocumentFormValues,
  DocumentStatus,
  DocumentsCentreTab,
  DocumentsQuery,
} from '@/lib/documentTypes'
import {
  COMPANY_DOCUMENT_TYPES,
  MEDICAL_DOCUMENT_TYPE,
  VEHICLE_DOCUMENT_TYPES,
  WORKER_DOCUMENT_TYPES,
  isMedicalDocumentType,
} from '@/lib/documentTypes'
import type { CreateDocumentInput } from '@/lib/documentTypes'

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

export function getDocumentStatusLabel(status: DocumentStatus): string {
  switch (status) {
    case 'valid':
      return 'Valid'
    case 'expiring_soon':
      return 'Expiring Soon'
    case 'expired':
      return 'Expired'
    case 'no_expiry':
      return 'No Expiry'
    default:
      return status
  }
}

export const documentStatusClassMap: Record<DocumentStatus, string> = {
  valid:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
  expiring_soon:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
  expired:
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60',
  no_expiry:
    'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
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

  return existingTypes.has(documentType)
}

export { MEDICAL_DOCUMENT_TYPE, isMedicalDocumentType }

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
      return documents.filter((doc) => doc.status === 'expiring_soon')
    case 'expired':
      return documents.filter((doc) => doc.status === 'expired')
    default:
      return documents
  }
}

export type DocumentSummaryStats = {
  company: number
  workers: number
  vehicles: number
  expiringSoon: number
  expired: number
}

/** Counts from the full documents list (not the filtered table rows). */
export function computeDocumentSummaryStats(documents: Document[]): DocumentSummaryStats {
  let company = 0
  let workers = 0
  let vehicles = 0
  let expiringSoon = 0
  let expired = 0

  for (const doc of documents) {
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
    result = result.filter((doc) => doc.status === query.status)
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
  return Boolean(document.filePath?.trim() || document.fileUrl?.trim())
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

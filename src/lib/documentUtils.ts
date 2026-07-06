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
  VEHICLE_DOCUMENT_TYPES,
  WORKER_DOCUMENT_TYPES,
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
  valid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  expiring_soon: 'bg-amber-50 text-amber-700 ring-amber-200',
  expired: 'bg-rose-50 text-rose-700 ring-rose-200',
  no_expiry: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function getDocumentTypesForAppliesTo(appliesTo: DocumentAppliesTo): readonly string[] {
  switch (appliesTo) {
    case 'company':
      return COMPANY_DOCUMENT_TYPES
    case 'worker':
      return WORKER_DOCUMENT_TYPES
    case 'vehicle':
      return VEHICLE_DOCUMENT_TYPES
    default:
      return []
  }
}

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

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
  'Tacho Card',
  'D4 / Medical',
  'Right to Work',
  'Training Certificate',
  'Other',
] as const

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
}

export type DocumentsCentreTab =
  | 'company'
  | 'workers'
  | 'vehicles'
  | 'expiring-soon'
  | 'expired'

export const DOCUMENTS_CENTRE_TABS: { id: DocumentsCentreTab; label: string }[] = [
  { id: 'company', label: 'Company' },
  { id: 'workers', label: 'Workers' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'expiring-soon', label: 'Expiring Soon' },
  { id: 'expired', label: 'Expired' },
]

export type DocumentTypeFilter = string | 'all'
export type DocumentAppliesToFilter = DocumentAppliesTo | 'all'
export type DocumentStatusFilter = DocumentStatus | 'all'

export type DocumentsQuery = {
  search?: string
  appliesTo?: DocumentAppliesToFilter
  type?: DocumentTypeFilter
  status?: DocumentStatusFilter
  workerId?: string | 'all'
  vehicleId?: string | 'all'
  tab?: DocumentsCentreTab
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

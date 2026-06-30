import type { DriverRole } from '@/services/driversService'

export type ComplianceRecordStatus = 'Valid' | 'Expiring Soon' | 'Expired' | 'Not Added'

export type ComplianceCentreTab = 'workers' | 'vehicles' | 'expiring-soon' | 'expired'

export type ComplianceProfileTab = 'overview' | 'compliance' | 'documents' | 'history'

export type ComplianceDocumentSource =
  | 'worker_record'
  | 'legacy_worker'
  | 'vehicle_record'
  | 'legacy_vehicle'

export type ComplianceDocumentItem = {
  id: string
  source: ComplianceDocumentSource
  entityType: 'worker' | 'vehicle'
  entityId: string
  entityName: string
  documentType: string
  documentName: string | null
  issueDate: string | null
  expiryDate: string | null
  referenceNumber: string | null
  daysRemaining: number | null
  status: ComplianceRecordStatus
  notes: string | null
  fileUrl: string | null
  createdAt: string | null
  updatedAt: string | null
  canEdit: boolean
  canDelete: boolean
}

export type WorkerComplianceRecord = {
  id: string
  createdAt: string
  updatedAt: string
  workerId: string
  workerName: string
  workerRole: DriverRole | null
  documentType: string
  documentName: string | null
  issueDate: string | null
  expiryDate: string | null
  referenceNumber: string | null
  status: ComplianceRecordStatus
  notes: string | null
  fileUrl: string | null
}

export type VehicleComplianceRecord = {
  id: string
  createdAt: string
  updatedAt: string
  vehicleId: string
  vehicleRegistration: string
  documentType: string
  documentName: string | null
  issueDate: string | null
  expiryDate: string | null
  referenceNumber: string | null
  status: ComplianceRecordStatus
  notes: string | null
  fileUrl: string | null
}

export type WorkerComplianceSummary = {
  workerId: string
  workerName: string
  workerRole: string
  department: string | null
  avatarUrl: string | null
  email: string
  complianceScore: number
  validCount: number
  expiringCount: number
  expiredCount: number
  totalDocuments: number
}

export type VehicleComplianceSummary = {
  vehicleId: string
  registration: string
  fleetNumber: string | null
  vehicleName: string
  complianceScore: number
  validCount: number
  expiringCount: number
  expiredCount: number
  totalDocuments: number
}

export type ComplianceDashboardStats = {
  totalWorkers: number
  workersWithExpiringDocuments: number
  expiredDocuments: number
  vehicleComplianceAlerts: number
}

export type CreateWorkerComplianceRecordInput = {
  workerId: string
  documentType: string
  documentName?: string | null
  issueDate?: string | null
  expiryDate?: string | null
  referenceNumber?: string | null
  notes?: string | null
  fileUrl?: string | null
}

export type UpdateWorkerComplianceRecordInput = {
  workerId?: string
  documentType?: string
  documentName?: string | null
  issueDate?: string | null
  expiryDate?: string | null
  referenceNumber?: string | null
  notes?: string | null
  fileUrl?: string | null
}

export type CreateVehicleComplianceRecordInput = {
  vehicleId: string
  documentType: string
  documentName?: string | null
  issueDate?: string | null
  expiryDate?: string | null
  referenceNumber?: string | null
  notes?: string | null
  fileUrl?: string | null
}

export type UpdateVehicleComplianceRecordInput = CreateVehicleComplianceRecordInput

export const WORKER_COMPLIANCE_DOCUMENT_TYPES = [
  'Driving Licence',
  'CPC',
  'Tachograph Card',
  'ADR',
  'Medical',
  'HIAB',
  'Forklift Licence',
  'Loader Licence',
  'Transport Manager CPC',
  'Operator Licence Awareness',
  'Health & Safety',
  'First Aid',
  'Fire Marshal',
  'Risk Assessment Training',
  'Manual Handling',
  'GDPR',
  'Workshop Safety',
  'LOLER Awareness',
  'Other',
] as const

export const VEHICLE_COMPLIANCE_DOCUMENT_TYPES = [
  'MOT',
  'Insurance',
  'Road Tax',
  'Tachograph Calibration',
  'Inspection Certificates',
  'Other',
] as const

export const COMPLIANCE_CENTRE_TABS: { id: ComplianceCentreTab; label: string }[] = [
  { id: 'workers', label: 'Workers' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'expiring-soon', label: 'Expiring Soon' },
  { id: 'expired', label: 'Expired' },
]

export const DEFAULT_COMPLIANCE_PAGE_SIZE = 50

export const COMPLIANCE_PAGE_SIZE_OPTIONS = [25, 50, 100] as const

export type ComplianceRecordFormInput = {
  workerId: string
  documentType: string
  documentName: string
  issueDate: string
  expiryDate: string
  referenceNumber: string
  notes: string
}

export type VehicleComplianceRecordFormInput = {
  vehicleId: string
  documentType: string
  documentName: string
  issueDate: string
  expiryDate: string
  referenceNumber: string
  notes: string
}

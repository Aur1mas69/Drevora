import type {
  ComplianceDashboardStats,
  ComplianceDocumentItem,
  ComplianceRecordStatus,
  VehicleComplianceRecord,
  VehicleComplianceSummary,
  WorkerComplianceRecord,
  WorkerComplianceSummary,
} from '@/lib/complianceTypes'
import type { Driver, DriverRole } from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'

export const EXPIRING_SOON_DAYS = 60
export const EXPIRING_CRITICAL_DAYS = 30

export const ROLE_DOCUMENT_SUGGESTIONS: Record<string, string[]> = {
  Driver: [
    'Driving Licence',
    'CPC',
    'Tachograph Card',
    'ADR',
    'D4 / Medical',
    'HIAB',
    'Forklift Licence',
    'Loader Licence',
  ],
  'Transport Manager': [
    'Transport Manager CPC',
    'Operator Licence Awareness',
    'Health & Safety',
    'First Aid',
    'Fire Marshal',
  ],
  Supervisor: ['Health & Safety', 'First Aid', 'Fire Marshal', 'Manual Handling'],
  Mechanic: ['Workshop Safety', 'LOLER Awareness', 'Manual Handling', 'First Aid'],
  Yardman: ['Forklift Licence', 'Loader Licence', 'Manual Handling', 'Health & Safety'],
  Cleaner: ['Manual Handling', 'Health & Safety'],
  'Office Staff': ['GDPR', 'Health & Safety', 'Fire Marshal'],
  Admin: ['GDPR', 'Health & Safety', 'Fire Marshal'],
  Planner: ['Health & Safety', 'GDPR'],
  Other: ['Health & Safety', 'Manual Handling'],
}

const LEGACY_WORKER_FIELDS: { field: keyof Driver; documentType: string }[] = [
  { field: 'drivingLicenceExpiry', documentType: 'Driving Licence' },
  { field: 'cpcExpiry', documentType: 'CPC' },
  { field: 'driverCardExpiry', documentType: 'Tachograph Card' },
  { field: 'medicalExpiry', documentType: 'D4 / Medical' },
  { field: 'adrExpiry', documentType: 'ADR' },
  { field: 'hiabExpiry', documentType: 'HIAB' },
]

const LEGACY_VEHICLE_FIELDS: { field: keyof Vehicle; documentType: string }[] = [
  { field: 'motExpiry', documentType: 'MOT' },
  { field: 'insuranceExpiry', documentType: 'Insurance' },
  { field: 'roadTaxExpiry', documentType: 'Road Tax' },
  { field: 'tachographExpiry', documentType: 'Tachograph Calibration' },
]

export const statusClassMap: Record<ComplianceRecordStatus, string> = {
  Valid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'Expiring Soon': 'bg-orange-50 text-orange-700 ring-orange-200',
  Expired: 'bg-rose-50 text-rose-700 ring-rose-200',
  'Not Added': 'bg-slate-100 text-slate-500 ring-slate-200',
}

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

export function computeComplianceStatus(
  expiryDate: string | null | undefined,
): ComplianceRecordStatus {
  if (!expiryDate) return 'Not Added'
  const daysRemaining = getDaysRemaining(expiryDate)
  if (daysRemaining === null) return 'Not Added'
  if (daysRemaining < 0) return 'Expired'
  if (daysRemaining <= EXPIRING_SOON_DAYS) return 'Expiring Soon'
  return 'Valid'
}

export function formatComplianceDate(value: string | null | undefined): string {
  if (!value) return 'Not added'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export function getDaysRemainingLabel(daysRemaining: number | null): string {
  if (daysRemaining === null) return '—'
  if (daysRemaining < 0) {
    const overdue = Math.abs(daysRemaining)
    return `${overdue} day${overdue === 1 ? '' : 's'} overdue`
  }
  return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`
}

export function getWorkerName(driver: Driver): string {
  return `${driver.firstName} ${driver.lastName}`.trim()
}

export function getWorkerInitials(driver: Driver): string {
  return `${driver.firstName.charAt(0)}${driver.lastName.charAt(0)}`.toUpperCase()
}

export function getVehicleName(vehicle: Vehicle): string {
  return `${vehicle.make} ${vehicle.model}`.trim()
}

export function getSuggestedDocumentTypes(role: DriverRole | null | undefined): string[] {
  if (!role) return ROLE_DOCUMENT_SUGGESTIONS.Other ?? []
  return ROLE_DOCUMENT_SUGGESTIONS[role] ?? ROLE_DOCUMENT_SUGGESTIONS.Other ?? []
}

export function computeComplianceScore(
  documents: Pick<ComplianceDocumentItem, 'status' | 'expiryDate' | 'documentType'>[],
  recommendedTypes: string[] = [],
): number {
  let score = 100

  for (const doc of documents) {
    if (doc.status === 'Expired') score -= 25
    else if (doc.status === 'Expiring Soon') score -= 8
  }

  const presentTypes = new Set(documents.map((doc) => doc.documentType))
  for (const recommended of recommendedTypes) {
    if (!presentTypes.has(recommended)) score -= 5
  }

  return Math.max(0, Math.min(100, score))
}

function mapWorkerRecord(
  record: WorkerComplianceRecord,
): ComplianceDocumentItem {
  return {
    id: record.id,
    source: 'worker_record',
    entityType: 'worker',
    entityId: record.workerId,
    entityName: record.workerName,
    documentType: record.documentType,
    documentName: record.documentName,
    issueDate: record.issueDate,
    expiryDate: record.expiryDate,
    referenceNumber: record.referenceNumber,
    daysRemaining: getDaysRemaining(record.expiryDate),
    status: computeComplianceStatus(record.expiryDate),
    notes: record.notes,
    fileUrl: record.fileUrl,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    canEdit: true,
    canDelete: true,
  }
}

function mapLegacyWorkerDocument(
  driver: Driver,
  documentType: string,
  expiryDate: string | null,
): ComplianceDocumentItem {
  return {
    id: `legacy-${driver.id}-${documentType}`,
    source: 'legacy_worker',
    entityType: 'worker',
    entityId: driver.id,
    entityName: getWorkerName(driver),
    documentType,
    documentName: documentType,
    issueDate: null,
    expiryDate,
    referenceNumber: null,
    daysRemaining: getDaysRemaining(expiryDate),
    status: computeComplianceStatus(expiryDate),
    notes: null,
    fileUrl: null,
    createdAt: null,
    updatedAt: null,
    canEdit: false,
    canDelete: false,
  }
}

function mapVehicleRecord(record: VehicleComplianceRecord): ComplianceDocumentItem {
  return {
    id: record.id,
    source: 'vehicle_record',
    entityType: 'vehicle',
    entityId: record.vehicleId,
    entityName: record.vehicleRegistration,
    documentType: record.documentType,
    documentName: record.documentName,
    issueDate: record.issueDate,
    expiryDate: record.expiryDate,
    referenceNumber: record.referenceNumber,
    daysRemaining: getDaysRemaining(record.expiryDate),
    status: computeComplianceStatus(record.expiryDate),
    notes: record.notes,
    fileUrl: record.fileUrl,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    canEdit: true,
    canDelete: true,
  }
}

function mapLegacyVehicleDocument(
  vehicle: Vehicle,
  documentType: string,
  expiryDate: string | null,
): ComplianceDocumentItem {
  return {
    id: `legacy-${vehicle.id}-${documentType}`,
    source: 'legacy_vehicle',
    entityType: 'vehicle',
    entityId: vehicle.id,
    entityName: vehicle.registration,
    documentType,
    documentName: getVehicleName(vehicle),
    issueDate: null,
    expiryDate,
    referenceNumber: null,
    daysRemaining: getDaysRemaining(expiryDate),
    status: computeComplianceStatus(expiryDate),
    notes: null,
    fileUrl: null,
    createdAt: null,
    updatedAt: null,
    canEdit: false,
    canDelete: false,
  }
}

export function buildWorkerDocuments(
  workerId: string,
  records: WorkerComplianceRecord[],
  drivers: Driver[],
): ComplianceDocumentItem[] {
  const driver = drivers.find((item) => item.id === workerId)
  const workerRecords = records.filter((record) => record.workerId === workerId).map(mapWorkerRecord)
  const existingTypes = new Set(workerRecords.map((item) => item.documentType))

  const legacyItems: ComplianceDocumentItem[] = []
  if (driver) {
    for (const item of LEGACY_WORKER_FIELDS) {
      const expiry = driver[item.field] as string | null
      if (!expiry || existingTypes.has(item.documentType)) continue
      legacyItems.push(mapLegacyWorkerDocument(driver, item.documentType, expiry))
    }
  }

  return [...workerRecords, ...legacyItems].sort((a, b) =>
    a.documentType.localeCompare(b.documentType),
  )
}

export function buildVehicleDocuments(
  vehicleId: string,
  records: VehicleComplianceRecord[],
  vehicles: Vehicle[],
): ComplianceDocumentItem[] {
  const vehicle = vehicles.find((item) => item.id === vehicleId)
  const vehicleRecords = records
    .filter((record) => record.vehicleId === vehicleId)
    .map(mapVehicleRecord)
  const existingTypes = new Set(vehicleRecords.map((item) => item.documentType))

  const legacyItems: ComplianceDocumentItem[] = []
  if (vehicle) {
    for (const item of LEGACY_VEHICLE_FIELDS) {
      const expiry = vehicle[item.field] as string | null
      if (existingTypes.has(item.documentType)) continue
      legacyItems.push(mapLegacyVehicleDocument(vehicle, item.documentType, expiry))
    }
  }

  return [...vehicleRecords, ...legacyItems].sort((a, b) =>
    a.documentType.localeCompare(b.documentType),
  )
}

export function buildAllWorkerDocuments(
  records: WorkerComplianceRecord[],
  drivers: Driver[],
): ComplianceDocumentItem[] {
  return drivers.flatMap((driver) => buildWorkerDocuments(driver.id, records, drivers))
}

export function buildAllVehicleDocuments(
  records: VehicleComplianceRecord[],
  vehicles: Vehicle[],
): ComplianceDocumentItem[] {
  return vehicles.flatMap((vehicle) => buildVehicleDocuments(vehicle.id, records, vehicles))
}

export function buildAllDocuments(
  workerRecords: WorkerComplianceRecord[],
  vehicleRecords: VehicleComplianceRecord[],
  drivers: Driver[],
  vehicles: Vehicle[],
): ComplianceDocumentItem[] {
  return [
    ...buildAllWorkerDocuments(workerRecords, drivers),
    ...buildAllVehicleDocuments(vehicleRecords, vehicles),
  ]
}

function countByStatus(documents: ComplianceDocumentItem[]) {
  return {
    validCount: documents.filter((doc) => doc.status === 'Valid').length,
    expiringCount: documents.filter((doc) => doc.status === 'Expiring Soon').length,
    expiredCount: documents.filter((doc) => doc.status === 'Expired').length,
    totalDocuments: documents.filter((doc) => doc.status !== 'Not Added').length,
  }
}

export function buildWorkerSummaries(
  records: WorkerComplianceRecord[],
  drivers: Driver[],
): WorkerComplianceSummary[] {
  return drivers
    .map((driver) => {
      const documents = buildWorkerDocuments(driver.id, records, drivers)
      const counts = countByStatus(documents)
      return {
        workerId: driver.id,
        workerName: getWorkerName(driver),
        workerRole: driver.role,
        department: driver.assignment ?? driver.company ?? null,
        avatarUrl: driver.avatarUrl,
        email: driver.email,
        complianceScore: computeComplianceScore(documents, getSuggestedDocumentTypes(driver.role)),
        ...counts,
      }
    })
    .sort((a, b) => a.workerName.localeCompare(b.workerName))
}

export function buildVehicleSummaries(
  records: VehicleComplianceRecord[],
  vehicles: Vehicle[],
): VehicleComplianceSummary[] {
  return vehicles
    .map((vehicle) => {
      const documents = buildVehicleDocuments(vehicle.id, records, vehicles)
      const counts = countByStatus(documents)
      return {
        vehicleId: vehicle.id,
        registration: vehicle.registration,
        fleetNumber: vehicle.fleetNumber,
        vehicleName: getVehicleName(vehicle),
        complianceScore: computeComplianceScore(documents),
        ...counts,
      }
    })
    .sort((a, b) => a.registration.localeCompare(b.registration))
}

export function computeDashboardStats(
  workerSummaries: WorkerComplianceSummary[],
  vehicleSummaries: VehicleComplianceSummary[],
  allDocuments: ComplianceDocumentItem[],
): ComplianceDashboardStats {
  const workersWithExpiring = workerSummaries.filter((worker) => worker.expiringCount > 0).length
  const expiredDocuments = allDocuments.filter((doc) => doc.status === 'Expired').length
  const vehicleAlerts = vehicleSummaries.filter(
    (vehicle) => vehicle.expiringCount > 0 || vehicle.expiredCount > 0,
  ).length

  return {
    totalWorkers: workerSummaries.length,
    workersWithExpiringDocuments: workersWithExpiring,
    expiredDocuments,
    vehicleComplianceAlerts: vehicleAlerts,
  }
}

export function filterExpiringDocuments(
  documents: ComplianceDocumentItem[],
): ComplianceDocumentItem[] {
  return documents
    .filter((doc) => doc.status === 'Expiring Soon')
    .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999))
}

export function filterExpiredDocuments(
  documents: ComplianceDocumentItem[],
): ComplianceDocumentItem[] {
  return documents
    .filter((doc) => doc.status === 'Expired')
    .sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0))
}

export function filterSummariesBySearch<T extends { [key: string]: unknown }>(
  items: T[],
  searchTerm: string,
  fields: (keyof T)[],
): T[] {
  const query = searchTerm.trim().toLowerCase()
  if (!query) return items
  return items.filter((item) =>
    fields.some((field) => String(item[field] ?? '').toLowerCase().includes(query)),
  )
}

export function filterDocumentsBySearch(
  documents: ComplianceDocumentItem[],
  searchTerm: string,
): ComplianceDocumentItem[] {
  const query = searchTerm.trim().toLowerCase()
  if (!query) return documents
  return documents.filter(
    (doc) =>
      doc.entityName.toLowerCase().includes(query) ||
      doc.documentType.toLowerCase().includes(query) ||
      (doc.documentName?.toLowerCase().includes(query) ?? false),
  )
}

export function getScoreTone(score: number): string {
  if (score >= 90) return 'text-emerald-700'
  if (score >= 75) return 'text-amber-700'
  return 'text-rose-700'
}

export function getScoreRingTone(score: number): string {
  if (score >= 90) return 'bg-emerald-50 ring-emerald-100'
  if (score >= 75) return 'bg-amber-50 ring-amber-100'
  return 'bg-rose-50 ring-rose-100'
}

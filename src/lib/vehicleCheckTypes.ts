export type VehicleCheckOdometerUnit = 'miles' | 'km'

export const DEFAULT_VEHICLE_CHECK_ODOMETER_UNIT: VehicleCheckOdometerUnit = 'miles'

export type VehicleCheckStatus = 'Completed' | 'Pending' | 'In Progress'

export type VehicleCheckResult = 'Pass' | 'Advisory' | 'Fail'

export type VehicleCheckItemResult = VehicleCheckResult

export type VehicleCheckItemTemplateRef = {
  description: string | null
  allowNotes?: boolean
  allowPhoto?: boolean
  failOnDefect?: boolean
}

export type VehicleCheckItem = {
  id: string
  vehicleCheckId: string
  category: string
  itemName: string
  result: VehicleCheckItemResult
  comment: string | null
  photoUrl: string | null
  description: string | null
  templateItem?: VehicleCheckItemTemplateRef | null
  allowNotes: boolean
  allowPhoto: boolean
  failOnDefect: boolean
}

export type VehicleCheckListItem = {
  id: string
  createdAt: string
  updatedAt: string
  vehicleId: string
  vehicleRegistration: string
  fleetNumber: string | null
  vehicleMake: string | null
  vehicleModel: string | null
  workerId: string
  workerName: string
  inspectionDate: string
  odometer: number | null
  odometerUnit: VehicleCheckOdometerUnit
  status: VehicleCheckStatus
  overallResult: VehicleCheckResult
  notes: string | null
  signatureUrl: string | null
  signedAt: string | null
  inspectionStartedAt: string | null
  inspectionCompletedAt: string | null
  durationSeconds: number | null
  failCount: number
  defectCount: number
}

export type VehicleCheck = VehicleCheckListItem & {
  items: VehicleCheckItem[]
}

export type VehicleCheckSummaryStats = {
  totalChecks: number
  checksToday: number
  passedToday: number
  failedToday: number
  defectsReported: number
  vehiclesChecked: number
  openDefects: number
  failedInspections: number
}

export type VehicleChecksQuery = {
  search?: string
  status?: VehicleCheckStatus | 'all'
  result?: VehicleCheckResultFilter
  vehicleId?: string | 'all'
  workerId?: string | 'all'
  inspectionDate?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export type VehicleChecksPageResult = {
  items: VehicleCheckListItem[]
  totalCount: number
  page: number
  pageSize: number
  stats: VehicleCheckSummaryStats
}

export type VehicleCheckItemInput = {
  category: string
  itemName: string
  result: VehicleCheckItemResult
  comment?: string | null
  photoUrl?: string | null
  /** Client-only pending defect photo file selected before save/upload. */
  photoFile?: File | null
  /** Client-only blob preview URL for a pending photo selection. */
  photoPreviewUrl?: string | null
  description?: string | null
  templateItem?: VehicleCheckItemTemplateRef | null
  allowNotes?: boolean
  allowPhoto?: boolean
  failOnDefect?: boolean
  /** Form-only flag: false until the worker selects OK, Defect, or N/A. */
  isAnswered?: boolean
}

export type CreateVehicleCheckInput = {
  vehicleId: string
  workerId: string
  inspectionDate: string
  odometer: number
  odometerUnit?: VehicleCheckOdometerUnit
  status?: VehicleCheckStatus
  notes?: string | null
  signatureFile: File
  inspectionStartedAt: string
  items: VehicleCheckItemInput[]
}

export type UpdateVehicleCheckInput = {
  vehicleId?: string
  workerId?: string
  inspectionDate?: string
  odometer?: number | null
  status?: VehicleCheckStatus
  notes?: string | null
  items?: VehicleCheckItemInput[]
}

export const VEHICLE_CHECK_PAGE_SIZE_OPTIONS = [25, 50, 100] as const
export const DEFAULT_VEHICLE_CHECK_PAGE_SIZE = 50

export type VehicleCheckStatusFilter = VehicleCheckStatus | 'all'

export type VehicleCheckResultFilter = VehicleCheckResult | 'Defects' | 'all'

export type VehicleChecklistSection = {
  section: string
  itemNames: string[]
}

import type { VehicleCheckLocationCapture } from '@/lib/vehicleCheckLocation'

export type VehicleCheckOdometerUnit = 'miles' | 'km'

export const DEFAULT_VEHICLE_CHECK_ODOMETER_UNIT: VehicleCheckOdometerUnit = 'miles'

export type VehicleCheckStatus = 'Completed' | 'Pending' | 'In Progress'

/** Stored checklist / overall result values (DB CHECK). Defect = Advisory; N/A = Fail. */
export type VehicleCheckResult = 'Pass' | 'Advisory' | 'Fail'

export type VehicleCheckItemResult = VehicleCheckResult

/**
 * Trailer attachment on a towing vehicle's Vehicle Check
 * (`vehicle_checks.trailer_source`). No standalone Trailer Check.
 */
export type VehicleCheckTrailerSource = 'none' | 'company' | 'third_party'

/**
 * Checklist answer ownership (`vehicle_check_items.asset_scope`).
 * Existing historical rows default to `vehicle`.
 */
export type VehicleCheckAssetScope = 'vehicle' | 'trailer' | 'combination'

/** Manager operational decision for inspections that contain defects. */
export type VehicleCheckDefectReviewStatus =
  | 'awaiting_review'
  | 'safe_to_operate'
  | 'repair_required'
  | 'vehicle_off_road'
  | 'resolved'

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
  /**
   * DB `asset_scope`. Trailer Base items persist as `trailer`;
   * combination DVSA items persist as `combination` when a trailer is attached.
   */
  assetScope: VehicleCheckAssetScope
}

/**
 * Device GPS captured once for a single moment (Vehicle Check start or
 * completion). Supporting information only — always optional, never a
 * pass/fail signal. `null` fields mean location was not available.
 */
export type VehicleCheckLocationSnapshot = {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  /** When the device actually returned the GPS fix (distinct from the workflow action timestamp). */
  locationAt: string | null
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
  vehicleType: string | null
  vehicleStatus: string | null
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
  /** Count of Defect (Advisory) items only — N/A (Fail) is excluded. */
  defectCount: number
  defectReviewStatus: VehicleCheckDefectReviewStatus | null
  defectReviewedAt: string | null
  defectReviewedBy: string | null
  defectReviewedByName: string | null
  defectReviewNotes: string | null
  /** When set, this row is a correction of another Vehicle Check. */
  originalCheckId: string | null
  correctionReason: string | null
  correctionCreatedBy: string | null
  correctionCreatedAt: string | null
  /** Linked corrections that point at this row (0 when this row is itself a correction). */
  linkedCorrectionCount: number
  /** Newest linked correction id for this original, if any. */
  latestCorrectionId: string | null
  /**
   * Trailer attachment fields. List queries may omit them (mapper defaults to none).
   * Detail/report queries select stored snapshots.
   */
  trailerSource: VehicleCheckTrailerSource
  trailerVehicleId: string | null
  vehicleRegistrationSnapshot: string | null
  vehicleFleetNumberSnapshot: string | null
  trailerNumberSnapshot: string | null
  trailerRegistrationSnapshot: string | null
  trailerTypeSnapshot: string | null
  trailerLabelSnapshot: string | null
}

export type VehicleCheck = VehicleCheckListItem & {
  items: VehicleCheckItem[]
  /** Only loaded on the Vehicle Check details query — not part of the list/table view. */
  startedLocation: VehicleCheckLocationSnapshot
  completedLocation: VehicleCheckLocationSnapshot
}

export type VehicleCheckSummaryStats = {
  totalChecks: number
  checksToday: number
  passedToday: number
  /** Completed inspections today with one or more Defect items. */
  defectsFoundToday: number
  /** Defect inspections still awaiting manager review. */
  awaitingReview: number
  /** Individual Defect (Advisory) item count (all-time, company-scoped). */
  defectItemsReported: number
}

export type VehicleChecksQuery = {
  search?: string
  status?: VehicleCheckStatus | 'all'
  result?: VehicleCheckResultFilter
  reviewStatus?: VehicleCheckReviewStatusFilter
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
  /** Written on save. Defaults to vehicle when omitted. */
  assetScope?: VehicleCheckAssetScope
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
  /** Device GPS captured once when the Worker pressed Start. Omit/null when unavailable — never a hard requirement. */
  startedLocation?: VehicleCheckLocationCapture | null
  /** Device GPS captured once immediately before this completed Vehicle Check was saved. Omit/null when unavailable. */
  completedLocation?: VehicleCheckLocationCapture | null
  /** Optional trailer on this towing-vehicle check. Omit/none = no trailer. */
  trailerSource?: VehicleCheckTrailerSource
  trailerVehicleId?: string | null
  trailerNumberSnapshot?: string | null
  trailerRegistrationSnapshot?: string | null
  trailerLabelSnapshot?: string | null
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

export type SaveVehicleCheckDefectReviewInput = {
  reviewStatus: Exclude<VehicleCheckDefectReviewStatus, 'awaiting_review'>
  notes?: string | null
  reviewerName: string
  confirmVehicleOffRoad?: boolean
}

export type CreateVehicleCheckCorrectionInput = {
  originalCheckId: string
  reason: string
}

export const VEHICLE_CHECK_PAGE_SIZE_OPTIONS = [25, 50, 100] as const
export const DEFAULT_VEHICLE_CHECK_PAGE_SIZE = 50

export type VehicleCheckStatusFilter = VehicleCheckStatus | 'all'

/** UI result filter — Fail (N/A) is not an inspection-level result. */
export type VehicleCheckResultFilter = 'Pass' | 'Advisory' | 'all'

export type VehicleCheckReviewStatusFilter =
  | VehicleCheckDefectReviewStatus
  | 'none'
  | 'all'

export type VehicleChecklistSection = {
  section: string
  itemNames: string[]
  /** Set when two DREVORA Recommended layers share the heading but differ by asset. */
  assetScope?: VehicleCheckAssetScope
}

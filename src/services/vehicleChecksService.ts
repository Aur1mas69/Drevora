import {
  computeOverallResult,
  computeVehicleCheckSummaryStats,
  countDefectAnswers,
  defaultDefectReviewStatus,
  enrichVehicleCheckItemsWithTemplates,
  resolveInspectionResult,
} from '@/lib/vehicleCheckUtils'
import type {
  CreateVehicleCheckInput,
  SaveVehicleCheckDefectReviewInput,
  UpdateVehicleCheckInput,
  VehicleCheck,
  VehicleCheckDefectReviewStatus,
  VehicleCheckItem,
  VehicleCheckItemInput,
  VehicleCheckListItem,
  VehicleCheckOdometerUnit,
  VehicleCheckResult,
  VehicleCheckResultFilter,
  VehicleCheckReviewStatusFilter,
  VehicleChecksPageResult,
  VehicleChecksQuery,
  VehicleCheckStatus,
  VehicleCheckSummaryStats,
} from '@/lib/vehicleCheckTypes'
import { DEFAULT_VEHICLE_CHECK_ODOMETER_UNIT } from '@/lib/vehicleCheckTypes'
import { calculateInspectionDurationSeconds } from '@/lib/vehicleCheckDurationUtils'
import { DEFAULT_VEHICLE_CHECK_PAGE_SIZE } from '@/lib/vehicleCheckTypes'
import {
  requireVerifiedCompanyId,
} from '@/lib/companySettingsGlobals'
import { isOfficeMembershipRole } from '@/lib/membershipRoles'
import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import { resolveCurrentCompanyMembership } from '@/services/companyMembershipService'
import { fetchTemplateItemsByVehicleType } from '@/services/vehicleCheckTemplatesService'
import {
  deleteVehicleCheckPhoto,
  uploadVehicleCheckDefectPhoto,
  uploadVehicleCheckSignature,
} from '@/services/vehicleCheckPhotoStorageService'

export const VEHICLE_CHECK_ITEMS_TABLE = 'vehicle_check_items'

type DriverJoinRow = {
  first_name: string
  last_name: string
}

type VehicleJoinRow = {
  registration: string
  fleet_number: string | null
  make: string | null
  model: string | null
  vehicle_type: string | null
  status?: string | null
}

type VehicleCheckItemRow = {
  id: string
  vehicle_check_id: string
  category: string
  item_name: string
  result: string
  comment: string | null
  photo_url: string | null
}

const completedCheckItemSelect = `
  id,
  vehicle_check_id,
  category,
  item_name,
  result,
  comment,
  photo_url
`

const vehicleCheckListSelect = `
  id,
  created_at,
  updated_at,
  vehicle_id,
  worker_id,
  inspection_date,
  odometer,
  odometer_unit,
  status,
  overall_result,
  notes,
  signature_url,
  signed_at,
  inspection_started_at,
  inspection_completed_at,
  duration_seconds,
  defect_review_status,
  defect_reviewed_at,
  defect_reviewed_by,
  defect_reviewed_by_name,
  defect_review_notes,
  drivers ( first_name, last_name ),
  vehicles ( registration, fleet_number, make, model, vehicle_type, status ),
  vehicle_check_items ( ${completedCheckItemSelect} )
`

const vehicleCheckDetailSelect = `
  id,
  created_at,
  updated_at,
  vehicle_id,
  worker_id,
  inspection_date,
  odometer,
  odometer_unit,
  status,
  overall_result,
  notes,
  signature_url,
  signed_at,
  inspection_started_at,
  inspection_completed_at,
  duration_seconds,
  defect_review_status,
  defect_reviewed_at,
  defect_reviewed_by,
  defect_reviewed_by_name,
  defect_review_notes,
  drivers ( first_name, last_name ),
  vehicles ( registration, fleet_number, make, model, vehicle_type, status ),
  vehicle_check_items ( ${completedCheckItemSelect} )
`

type VehicleCheckRow = {
  id: string
  created_at: string
  updated_at: string
  vehicle_id: string
  worker_id: string
  inspection_date: string
  odometer: number | null
  odometer_unit: string | null
  status: string
  overall_result: string
  notes: string | null
  signature_url: string | null
  signed_at: string | null
  inspection_started_at: string | null
  inspection_completed_at: string | null
  duration_seconds: number | null
  defect_review_status: string | null
  defect_reviewed_at: string | null
  defect_reviewed_by: string | null
  defect_reviewed_by_name: string | null
  defect_review_notes: string | null
  drivers: DriverJoinRow | DriverJoinRow[] | null
  vehicles:
    | (VehicleJoinRow & { status?: string | null })
    | (VehicleJoinRow & { status?: string | null })[]
    | null
  vehicle_check_items?: VehicleCheckItemRow[]
}

export class VehicleChecksServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VehicleChecksServiceError'
  }
}

function normalizeJoinRow<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function normalizeStatus(value: string | null | undefined): VehicleCheckStatus {
  switch (value) {
    case 'Pending':
    case 'In Progress':
      return value
    default:
      return 'Completed'
  }
}

function normalizeResult(value: string | null | undefined): VehicleCheckResult {
  switch (value) {
    case 'Advisory':
    case 'Fail':
      return value
    default:
      return 'Pass'
  }
}

function normalizeOdometerUnit(
  value: string | null | undefined,
): VehicleCheckOdometerUnit {
  return value === 'km' ? 'km' : DEFAULT_VEHICLE_CHECK_ODOMETER_UNIT
}

function mapItemRow(row: VehicleCheckItemRow): VehicleCheckItem {
  return {
    id: row.id,
    vehicleCheckId: row.vehicle_check_id,
    category: row.category,
    itemName: row.item_name,
    result: normalizeResult(row.result),
    comment: row.comment,
    photoUrl: row.photo_url,
    description: null,
    templateItem: null,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
  }
}

function normalizeDefectReviewStatus(
  value: string | null | undefined,
): VehicleCheckDefectReviewStatus | null {
  switch (value) {
    case 'awaiting_review':
    case 'safe_to_operate':
    case 'repair_required':
    case 'vehicle_off_road':
    case 'resolved':
      return value
    default:
      return null
  }
}

function countDefectItems(row: VehicleCheckRow): number {
  return countDefectAnswers(row.vehicle_check_items ?? [])
}

function mapListRow(row: VehicleCheckRow): VehicleCheckListItem {
  const driver = normalizeJoinRow(row.drivers)
  const vehicle = normalizeJoinRow(row.vehicles)
  const defectCount = countDefectItems(row)
  const overallResult = resolveInspectionResult(row.overall_result, defectCount)
  const storedReview = normalizeDefectReviewStatus(row.defect_review_status)

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    vehicleId: row.vehicle_id,
    vehicleRegistration: vehicle?.registration ?? 'Unknown',
    fleetNumber: vehicle?.fleet_number ?? null,
    vehicleMake: vehicle?.make ?? null,
    vehicleModel: vehicle?.model ?? null,
    vehicleStatus: vehicle?.status ?? null,
    workerId: row.worker_id,
    workerName: driver ? `${driver.first_name} ${driver.last_name}`.trim() : 'Unknown',
    inspectionDate: row.inspection_date,
    odometer: row.odometer,
    odometerUnit: normalizeOdometerUnit(row.odometer_unit),
    status: normalizeStatus(row.status),
    overallResult,
    notes: row.notes,
    signatureUrl: row.signature_url,
    signedAt: row.signed_at,
    inspectionStartedAt: row.inspection_started_at,
    inspectionCompletedAt: row.inspection_completed_at,
    durationSeconds: row.duration_seconds,
    defectCount,
    defectReviewStatus:
      defectCount > 0 ? (storedReview ?? 'awaiting_review') : null,
    defectReviewedAt: row.defect_reviewed_at,
    defectReviewedBy: row.defect_reviewed_by,
    defectReviewedByName: row.defect_reviewed_by_name,
    defectReviewNotes: row.defect_review_notes,
  }
}

function mapDetailRow(row: VehicleCheckRow): VehicleCheck {
  const list = mapListRow(row)
  const items = (row.vehicle_check_items ?? []).map(mapItemRow)
  items.sort((a, b) => a.itemName.localeCompare(b.itemName))
  return { ...list, items }
}

async function assertWorkerAndVehicleInCompany(
  workerId: string,
  vehicleId: string,
  companyId: string,
): Promise<void> {
  const [workerResult, vehicleResult] = await Promise.all([
    requireSupabase()
      .from('drivers')
      .select('id')
      .eq('id', workerId)
      .eq('company_id', companyId)
      .maybeSingle(),
    requireSupabase()
      .from('vehicles')
      .select('id')
      .eq('id', vehicleId)
      .eq('company_id', companyId)
      .maybeSingle(),
  ])

  if (workerResult.error) throw new VehicleChecksServiceError(workerResult.error.message)
  if (vehicleResult.error) throw new VehicleChecksServiceError(vehicleResult.error.message)
  if (!workerResult.data) {
    throw new VehicleChecksServiceError('That worker is not available for your company.')
  }
  if (!vehicleResult.data) {
    throw new VehicleChecksServiceError('That vehicle is not available for your company.')
  }
}

/** Verifies a parent check before any child item read, write, or delete. */
async function assertVehicleCheckInCompany(
  vehicleCheckId: string,
  companyId: string,
): Promise<void> {
  const { data, error } = await requireSupabase()
    .from('vehicle_checks')
    .select('id')
    .eq('id', vehicleCheckId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) throw new VehicleChecksServiceError(error.message)
  if (!data) {
    throw new VehicleChecksServiceError('Inspection is not available for your company.')
  }
}

async function deleteVehicleCheckForCompany(
  vehicleCheckId: string,
  companyId: string,
): Promise<void> {
  const { data, error } = await requireSupabase()
    .from('vehicle_checks')
    .delete()
    .eq('id', vehicleCheckId)
    .eq('company_id', companyId)
    .select('id')

  if (error) throw new VehicleChecksServiceError(error.message)
  if ((data ?? []).length === 0) {
    throw new VehicleChecksServiceError(
      'Inspection could not be deleted for your company. Refresh and try again.',
    )
  }
}

async function fetchVehicleCheckStats(
  companyId: string,
): Promise<VehicleCheckSummaryStats> {
  const checksResult = await requireSupabase()
    .from('vehicle_checks')
    .select(
      'id, inspection_date, overall_result, vehicle_id, defect_review_status, vehicle_check_items ( result )',
    )
    .eq('company_id', companyId)

  logSupabaseQuery({
    service: 'vehicleChecksService.fetchVehicleCheckStats.checks',
    table: 'vehicle_checks',
    data: checksResult.data,
    error: checksResult.error,
  })

  if (checksResult.error) {
    throw new VehicleChecksServiceError(checksResult.error.message)
  }

  const rows = (checksResult.data ?? []) as unknown as Array<{
    id: string
    inspection_date: string
    overall_result: string
    vehicle_id: string
    defect_review_status: string | null
    vehicle_check_items?: { result: string }[] | null
  }>

  if (rows.length === 0) {
    return computeVehicleCheckSummaryStats([], 0)
  }

  let defectItemCount = 0
  const mapped = rows.map((row) => {
    const defectCount = countDefectAnswers(row.vehicle_check_items ?? [])
    defectItemCount += defectCount
    const storedReview = normalizeDefectReviewStatus(row.defect_review_status)
    return {
      inspectionDate: row.inspection_date,
      overallResult: resolveInspectionResult(row.overall_result, defectCount),
      vehicleId: row.vehicle_id,
      defectCount,
      defectReviewStatus:
        defectCount > 0 ? (storedReview ?? 'awaiting_review') : null,
    }
  })

  return computeVehicleCheckSummaryStats(mapped, defectItemCount)
}

function matchesVehicleCheckSearch(row: VehicleCheckRow, search: string): boolean {
  const driver = normalizeJoinRow(row.drivers)
  const vehicle = normalizeJoinRow(row.vehicles)
  const items = row.vehicle_check_items ?? []
  const haystack = [
    vehicle?.registration,
    vehicle?.fleet_number,
    vehicle?.make,
    vehicle?.model,
    driver?.first_name,
    driver?.last_name,
    row.notes,
    ...items.flatMap((item) => [item.category, item.item_name, item.comment]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(search.toLowerCase())
}

function matchesResultFilter(
  row: VehicleCheckRow,
  result: VehicleCheckResultFilter | undefined,
): boolean {
  if (!result || result === 'all') return true
  const defectCount = countDefectItems(row)
  const resolved = resolveInspectionResult(row.overall_result, defectCount)
  return resolved === result
}

function matchesReviewStatusFilter(
  row: VehicleCheckRow,
  reviewStatus: VehicleCheckReviewStatusFilter | undefined,
): boolean {
  if (!reviewStatus || reviewStatus === 'all') return true
  const defectCount = countDefectItems(row)
  const stored = normalizeDefectReviewStatus(row.defect_review_status)
  const effective =
    defectCount > 0 ? (stored ?? 'awaiting_review') : null

  if (reviewStatus === 'none') {
    return effective == null
  }

  return effective === reviewStatus
}

async function requireOfficeReviewerContext(): Promise<{
  userId: string
  companyId: string
  membershipRole: string
}> {
  if (!isSupabaseConfigured) {
    throw new VehicleChecksServiceError('Supabase is not configured.')
  }

  const membership = await resolveCurrentCompanyMembership()
  if (membership.status !== 'ready') {
    throw new VehicleChecksServiceError(
      membership.status === 'unauthenticated'
        ? 'Sign in to review defects.'
        : membership.message,
    )
  }

  if (!isOfficeMembershipRole(membership.membershipRole)) {
    throw new VehicleChecksServiceError(
      'Only office roles can save a defect review decision.',
    )
  }

  return {
    userId: membership.userId,
    companyId: membership.companyId,
    membershipRole: membership.membershipRole,
  }
}

async function markVehicleCheckAttentionRead(
  companyId: string,
  userId: string,
  vehicleCheckId: string,
): Promise<void> {
  const { data, error } = await requireSupabase()
    .from('notifications')
    .select('id')
    .eq('company_id', companyId)
    .eq('entity_type', 'vehicle_check')
    .eq('entity_id', vehicleCheckId)
    .eq('notification_type', 'vehicle_check_attention')
    .maybeSingle()

  if (error || !data) return

  await requireSupabase().from('notification_reads').upsert(
    {
      notification_id: data.id,
      user_id: userId,
      read_at: new Date().toISOString(),
    },
    { onConflict: 'notification_id,user_id' },
  )
}

function stripClientOnlyChecklistFields(item: VehicleCheckItemInput): VehicleCheckItemInput {
  const rest = { ...item }
  delete rest.photoFile
  delete rest.photoPreviewUrl
  return rest
}

async function resolveDefectPhotoUrl(
  vehicleId: string,
  checkId: string,
  item: VehicleCheckItemInput,
  existingPhotoUrl?: string | null,
): Promise<string | null> {
  if (item.result !== 'Advisory') {
    if (existingPhotoUrl) {
      try {
        await deleteVehicleCheckPhoto(existingPhotoUrl)
      } catch {
        /* ignore cleanup failures */
      }
    }
    return null
  }

  if (item.photoFile) {
    const path = await uploadVehicleCheckDefectPhoto(
      vehicleId,
      checkId,
      item.category,
      item.itemName,
      item.photoFile,
    )

    if (existingPhotoUrl && existingPhotoUrl !== path) {
      try {
        await deleteVehicleCheckPhoto(existingPhotoUrl)
      } catch {
        /* ignore cleanup failures */
      }
    }

    return path
  }

  const nextPhotoUrl = item.photoUrl?.trim() || null
  if (!nextPhotoUrl && existingPhotoUrl) {
    try {
      await deleteVehicleCheckPhoto(existingPhotoUrl)
    } catch {
      /* ignore cleanup failures */
    }
  }

  return nextPhotoUrl
}

async function prepareItemsWithUploadedPhotos(
  vehicleId: string,
  checkId: string,
  items: VehicleCheckItemInput[],
  existingItems?: VehicleCheckItem[],
): Promise<VehicleCheckItemInput[]> {
  const existingByKey = new Map(
    (existingItems ?? []).map((item) => [`${item.category}-${item.itemName}`, item.photoUrl]),
  )

  return Promise.all(
    items.map(async (item) => {
      const existingPhotoUrl = existingByKey.get(`${item.category}-${item.itemName}`) ?? null
      const photoUrl = await resolveDefectPhotoUrl(vehicleId, checkId, item, existingPhotoUrl)
      return {
        ...stripClientOnlyChecklistFields(item),
        photoUrl,
      }
    }),
  )
}

function buildItemRows(checkId: string, items: VehicleCheckItemInput[]) {
  // Completed answers only — template settings live on vehicle_check_template_items.
  return items.map((item) => ({
    vehicle_check_id: checkId,
    category: item.category,
    item_name: item.itemName,
    result: item.result,
    comment: item.comment?.trim() || null,
    photo_url: item.photoUrl?.trim() || null,
  }))
}

export async function fetchVehicleChecks(
  query: VehicleChecksQuery = {},
): Promise<VehicleChecksPageResult> {
  const companyId = requireVerifiedCompanyId()
  const page = Math.max(1, query.page ?? 1)
  const pageSize = query.pageSize ?? DEFAULT_VEHICLE_CHECK_PAGE_SIZE

  let request = requireSupabase()
    .from('vehicle_checks')
    .select(vehicleCheckListSelect, { count: 'exact' })
    .eq('company_id', companyId)

  if (query.status && query.status !== 'all') {
    request = request.eq('status', query.status)
  }

  if (query.result && query.result !== 'all') {
    request = request.eq('overall_result', query.result)
  }

  if (query.reviewStatus && query.reviewStatus !== 'all' && query.reviewStatus !== 'none') {
    request = request.eq('defect_review_status', query.reviewStatus)
  }

  if (query.vehicleId && query.vehicleId !== 'all') {
    request = request.eq('vehicle_id', query.vehicleId)
  }

  if (query.workerId && query.workerId !== 'all') {
    request = request.eq('worker_id', query.workerId)
  }

  if (query.inspectionDate) {
    request = request.eq('inspection_date', query.inspectionDate)
  }

  if (query.dateFrom) {
    request = request.gte('inspection_date', query.dateFrom)
  }

  if (query.dateTo) {
    request = request.lte('inspection_date', query.dateTo)
  }

  request = request
    .order('inspection_date', { ascending: false })
    .order('created_at', { ascending: false })

  const { data, error, count } = await request

  logSupabaseQuery({
    service: 'vehicleChecksService.fetchVehicleChecks',
    table: 'vehicle_checks',
    data,
    error,
    count,
  })

  if (error) {
    throw new VehicleChecksServiceError(error.message)
  }

  const rows = (data ?? []) as unknown as VehicleCheckRow[]
  const search = query.search?.trim()
  const filteredRows = rows.filter((row) => {
    if (!matchesResultFilter(row, query.result)) return false
    if (!matchesReviewStatusFilter(row, query.reviewStatus)) return false
    if (search && !matchesVehicleCheckSearch(row, search)) return false
    return true
  })
  const from = (page - 1) * pageSize
  const to = from + pageSize
  const stats = await fetchVehicleCheckStats(companyId)
  const needsClientCount =
    Boolean(search) ||
    query.reviewStatus === 'none' ||
    (query.result === 'Advisory' && filteredRows.length !== (count ?? 0))

  return {
    items: filteredRows.slice(from, to).map(mapListRow),
    totalCount: needsClientCount ? filteredRows.length : (count ?? filteredRows.length),
    page,
    pageSize,
    stats,
  }
}

export async function fetchVehicleCheckById(id: string): Promise<VehicleCheck | null> {
  const companyId = requireVerifiedCompanyId()
  const { data, error } = await requireSupabase()
    .from('vehicle_checks')
    .select(vehicleCheckDetailSelect)
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  logSupabaseQuery({
    service: 'vehicleChecksService.fetchVehicleCheckById',
    table: 'vehicle_checks',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new VehicleChecksServiceError(error.message)
  }

  if (!data) return null

  const row = data as unknown as VehicleCheckRow
  const check = mapDetailRow(row)
  const vehicle = normalizeJoinRow(row.vehicles)
  const vehicleType = vehicle?.vehicle_type?.trim()

  if (vehicleType && check.items.length > 0) {
    const templates = await fetchTemplateItemsByVehicleType(vehicleType)
    check.items = enrichVehicleCheckItemsWithTemplates(check.items, templates)
  }

  return check
}

export async function createVehicleCheck(input: CreateVehicleCheckInput): Promise<VehicleCheck> {
  const verifiedCompanyId = requireVerifiedCompanyId()
  if (input.items.length === 0) {
    throw new VehicleChecksServiceError('Inspection checklist cannot be empty.')
  }

  if (input.odometer == null || Number.isNaN(input.odometer) || input.odometer < 0) {
    throw new VehicleChecksServiceError('Odometer / mileage is required.')
  }

  if (!input.signatureFile) {
    throw new VehicleChecksServiceError('Worker signature is required.')
  }

  const inspectionStartedAt = input.inspectionStartedAt?.trim()
  if (!inspectionStartedAt) {
    throw new VehicleChecksServiceError('Inspection duration could not be calculated.')
  }

  const startedAtDate = new Date(inspectionStartedAt)
  if (Number.isNaN(startedAtDate.getTime())) {
    throw new VehicleChecksServiceError('Inspection duration could not be calculated.')
  }

  // Create always opens as In Progress, then completes in one final parent update.
  // input.status is ignored so callers cannot insert as Completed under strict RLS.
  const overallResult = computeOverallResult(input.items)
  const defectCount = countDefectAnswers(input.items.filter((item) => item.isAnswered === true))
  const defectReviewStatus = defaultDefectReviewStatus(defectCount)
  const odometerUnit = input.odometerUnit ?? DEFAULT_VEHICLE_CHECK_ODOMETER_UNIT
  await assertWorkerAndVehicleInCompany(
    input.workerId,
    input.vehicleId,
    verifiedCompanyId,
  )

  const { data: checkRow, error: checkError } = await requireSupabase()
    .from('vehicle_checks')
    .insert({
      company_id: verifiedCompanyId,
      vehicle_id: input.vehicleId,
      worker_id: input.workerId,
      inspection_date: input.inspectionDate,
      odometer: input.odometer,
      odometer_unit: odometerUnit,
      status: 'In Progress',
      overall_result: overallResult,
      defect_review_status: defectReviewStatus,
      notes: input.notes?.trim() || null,
      inspection_started_at: startedAtDate.toISOString(),
    })
    .select('id')
    .single()

  logSupabaseQuery({
    service: 'vehicleChecksService.createVehicleCheck.insert',
    table: 'vehicle_checks',
    data: checkRow ? [checkRow] : [],
    error: checkError,
  })

  if (checkError || !checkRow) {
    throw new VehicleChecksServiceError(checkError?.message ?? 'Failed to create inspection.')
  }

  // On any later failure: leave the check In Progress and do not report completion success.
  try {
    let itemsWithPhotos: VehicleCheckItemInput[]
    try {
      itemsWithPhotos = await prepareItemsWithUploadedPhotos(
        input.vehicleId,
        checkRow.id,
        input.items,
      )
    } catch (photoError) {
      throw new VehicleChecksServiceError(
        photoError instanceof Error ? photoError.message : 'Failed to upload defect photo.',
      )
    }

    await assertVehicleCheckInCompany(checkRow.id, verifiedCompanyId)
    const itemRows = buildItemRows(checkRow.id, itemsWithPhotos)
    const { error: itemsError } = await requireSupabase()
      .from(VEHICLE_CHECK_ITEMS_TABLE)
      .insert(itemRows)

    logSupabaseQuery({
      service: 'vehicleChecksService.createVehicleCheck.items',
      table: 'vehicle_check_items',
      data: itemRows,
      error: itemsError,
    })

    if (itemsError) {
      throw new VehicleChecksServiceError(itemsError.message)
    }

    let signaturePath: string
    try {
      signaturePath = await uploadVehicleCheckSignature(
        input.vehicleId,
        checkRow.id,
        input.signatureFile,
      )
    } catch (signatureError) {
      throw new VehicleChecksServiceError(
        signatureError instanceof Error
          ? signatureError.message
          : 'Failed to upload worker signature.',
      )
    }

    const completedAtDate = new Date()
    const durationSeconds = calculateInspectionDurationSeconds(startedAtDate, completedAtDate)
    if (durationSeconds == null) {
      throw new VehicleChecksServiceError('Inspection duration could not be calculated.')
    }

    const signedAt = completedAtDate.toISOString()
    const { data: completedRows, error: completeError } = await requireSupabase()
      .from('vehicle_checks')
      .update({
        status: 'Completed',
        overall_result: overallResult,
        defect_review_status: defectReviewStatus,
        signature_url: signaturePath,
        signed_at: signedAt,
        inspection_completed_at: signedAt,
        duration_seconds: durationSeconds,
        updated_at: signedAt,
      })
      .eq('id', checkRow.id)
      .eq('company_id', verifiedCompanyId)
      .select('id')

    logSupabaseQuery({
      service: 'vehicleChecksService.createVehicleCheck.complete',
      table: 'vehicle_checks',
      data: completedRows ?? [],
      error: completeError,
    })

    if (completeError) {
      throw new VehicleChecksServiceError(completeError.message)
    }
    if ((completedRows ?? []).length === 0) {
      throw new VehicleChecksServiceError(
        'Inspection could not be completed for your company.',
      )
    }
  } catch (error) {
    throw error instanceof VehicleChecksServiceError
      ? error
      : new VehicleChecksServiceError(
          error instanceof Error ? error.message : 'Failed to save inspection.',
        )
  }

  const created = await fetchVehicleCheckById(checkRow.id)
  if (!created) {
    throw new VehicleChecksServiceError('Inspection was saved but could not be loaded.')
  }
  if (created.status !== 'Completed') {
    throw new VehicleChecksServiceError(
      'Inspection was left in progress and was not marked completed.',
    )
  }

  return created
}

export async function updateVehicleCheck(
  id: string,
  input: UpdateVehicleCheckInput,
): Promise<VehicleCheck> {
  const verifiedCompanyId = requireVerifiedCompanyId()
  const existing = await fetchVehicleCheckById(id)
  if (!existing) {
    throw new VehicleChecksServiceError('Inspection not found.')
  }

  const items = input.items ?? existing.items.map((item) => ({
    category: item.category,
    itemName: item.itemName,
    result: item.result,
    comment: item.comment,
    photoUrl: item.photoUrl,
    templateItem: item.templateItem,
    description: null,
    allowNotes: item.allowNotes,
    allowPhoto: item.allowPhoto,
    failOnDefect: item.failOnDefect,
  }))

  if (input.items && input.items.length === 0) {
    throw new VehicleChecksServiceError('Inspection checklist cannot be empty.')
  }

  await assertWorkerAndVehicleInCompany(
    input.workerId ?? existing.workerId,
    input.vehicleId ?? existing.vehicleId,
    verifiedCompanyId,
  )

  const overallResult = computeOverallResult(items)
  const defectCount = countDefectAnswers(
    items.filter((item) => {
      const answered = (item as VehicleCheckItemInput).isAnswered
      return answered === true || answered === undefined
    }),
  )
  const nextReviewStatus =
    defectCount > 0
      ? (existing.defectReviewStatus && existing.defectReviewStatus !== 'awaiting_review'
          ? existing.defectReviewStatus
          : 'awaiting_review')
      : null
  const existingEditable =
    (existing.status === 'Pending' || existing.status === 'In Progress') &&
    !existing.signedAt
  const targetStatus = input.status ?? existing.status
  const willComplete = existingEditable && targetStatus === 'Completed'
  const willRewriteItems = Boolean(input.items)

  // While still editable, keep parent non-Completed until items are rewritten.
  // Final Completed transition happens only after item writes (if any).
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    overall_result: overallResult,
    defect_review_status: nextReviewStatus,
  }

  if (input.vehicleId !== undefined) patch.vehicle_id = input.vehicleId
  if (input.workerId !== undefined) patch.worker_id = input.workerId
  if (input.inspectionDate !== undefined) patch.inspection_date = input.inspectionDate
  if (input.odometer !== undefined) patch.odometer = input.odometer
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null

  if (willComplete && willRewriteItems) {
    patch.status = existing.status === 'Pending' ? 'Pending' : 'In Progress'
  } else if (input.status !== undefined) {
    patch.status = input.status
  }

  const { data: updatedRows, error: updateError } = await requireSupabase()
    .from('vehicle_checks')
    .update(patch)
    .eq('id', id)
    .eq('company_id', verifiedCompanyId)
    .select('id')

  logSupabaseQuery({
    service: 'vehicleChecksService.updateVehicleCheck',
    table: 'vehicle_checks',
    data: updateError ? [] : [{ id }],
    error: updateError,
  })

  if (updateError) {
    throw new VehicleChecksServiceError(updateError.message)
  }
  if ((updatedRows ?? []).length === 0) {
    throw new VehicleChecksServiceError(
      'Inspection could not be updated for your company. Refresh and try again.',
    )
  }

  if (input.items) {
    await assertVehicleCheckInCompany(id, verifiedCompanyId)
    const { error: deleteError } = await requireSupabase()
      .from(VEHICLE_CHECK_ITEMS_TABLE)
      .delete()
      .eq('vehicle_check_id', id)

    if (deleteError) {
      throw new VehicleChecksServiceError(deleteError.message)
    }

    let itemsWithPhotos: VehicleCheckItemInput[]
    try {
      itemsWithPhotos = await prepareItemsWithUploadedPhotos(
        input.vehicleId ?? existing.vehicleId,
        id,
        items,
        existing.items,
      )
    } catch (photoError) {
      throw new VehicleChecksServiceError(
        photoError instanceof Error ? photoError.message : 'Failed to upload defect photo.',
      )
    }

    await assertVehicleCheckInCompany(id, verifiedCompanyId)
    const itemRows = buildItemRows(id, itemsWithPhotos)
    const { error: itemsError } = await requireSupabase()
      .from(VEHICLE_CHECK_ITEMS_TABLE)
      .insert(itemRows)

    logSupabaseQuery({
      service: 'vehicleChecksService.updateVehicleCheck.items',
      table: 'vehicle_check_items',
      data: itemRows,
      error: itemsError,
    })

    if (itemsError) {
      throw new VehicleChecksServiceError(itemsError.message)
    }
  }

  if (willComplete && willRewriteItems) {
    const completedAt = new Date().toISOString()
    const { data: completedRows, error: completeError } = await requireSupabase()
      .from('vehicle_checks')
      .update({
        status: 'Completed',
        overall_result: overallResult,
        defect_review_status: nextReviewStatus,
        updated_at: completedAt,
      })
      .eq('id', id)
      .eq('company_id', verifiedCompanyId)
      .select('id')

    logSupabaseQuery({
      service: 'vehicleChecksService.updateVehicleCheck.complete',
      table: 'vehicle_checks',
      data: completedRows ?? [],
      error: completeError,
    })

    if (completeError) {
      throw new VehicleChecksServiceError(completeError.message)
    }
    if ((completedRows ?? []).length === 0) {
      throw new VehicleChecksServiceError(
        'Inspection could not be completed for your company.',
      )
    }
  }

  const updated = await fetchVehicleCheckById(id)
  if (!updated) {
    throw new VehicleChecksServiceError('Inspection was updated but could not be loaded.')
  }

  return updated
}

export async function deleteVehicleCheck(id: string): Promise<void> {
  const verifiedCompanyId = requireVerifiedCompanyId()
  let error: Error | null = null

  try {
    await deleteVehicleCheckForCompany(id, verifiedCompanyId)
  } catch (deleteError) {
    error =
      deleteError instanceof Error
        ? deleteError
        : new Error('Failed to delete inspection.')
  }

  logSupabaseQuery({
    service: 'vehicleChecksService.deleteVehicleCheck',
    table: 'vehicle_checks',
    data: error ? [] : [{ id }],
    error,
  })

  if (error) {
    throw new VehicleChecksServiceError(error.message)
  }
}

/**
 * Office-only operational decision for inspections with defects.
 * Does not modify Worker checklist answers or historical defect records.
 */
export async function saveVehicleCheckDefectReview(
  id: string,
  input: SaveVehicleCheckDefectReviewInput,
): Promise<VehicleCheck> {
  const { userId, companyId, membershipRole } = await requireOfficeReviewerContext()
  const existing = await fetchVehicleCheckById(id)
  if (!existing) {
    throw new VehicleChecksServiceError('Inspection not found.')
  }
  if (existing.defectCount <= 0) {
    throw new VehicleChecksServiceError(
      'Manager review is only available for inspections with defects.',
    )
  }

  const notes = input.notes?.trim() || null
  if (
    (input.reviewStatus === 'repair_required' ||
      input.reviewStatus === 'vehicle_off_road') &&
    !notes
  ) {
    throw new VehicleChecksServiceError(
      'Manager notes are required for this review decision.',
    )
  }

  if (input.reviewStatus === 'vehicle_off_road' && !input.confirmVehicleOffRoad) {
    throw new VehicleChecksServiceError(
      'Confirm that the vehicle should be marked Off Road before saving.',
    )
  }

  const reviewedAt = new Date().toISOString()
  const reviewerName =
    input.reviewerName.trim() || `${membershipRole}`.trim() || 'Office user'

  const { data: updatedRows, error } = await requireSupabase()
    .from('vehicle_checks')
    .update({
      defect_review_status: input.reviewStatus,
      defect_reviewed_at: reviewedAt,
      defect_reviewed_by: userId,
      defect_reviewed_by_name: reviewerName,
      defect_review_notes: notes,
      updated_at: reviewedAt,
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('id')

  logSupabaseQuery({
    service: 'vehicleChecksService.saveVehicleCheckDefectReview',
    table: 'vehicle_checks',
    data: updatedRows ?? [],
    error,
  })

  if (error) {
    throw new VehicleChecksServiceError(error.message)
  }
  if ((updatedRows ?? []).length === 0) {
    throw new VehicleChecksServiceError(
      'Review decision could not be saved for your company.',
    )
  }

  if (input.reviewStatus === 'vehicle_off_road') {
    const { error: vehicleError } = await requireSupabase()
      .from('vehicles')
      .update({
        status: 'Off Road',
        off_road_reason: 'Other',
        off_road_notes: notes,
        off_road_start_date: reviewedAt.slice(0, 10),
        updated_at: reviewedAt,
      })
      .eq('id', existing.vehicleId)
      .eq('company_id', companyId)

    if (vehicleError) {
      throw new VehicleChecksServiceError(
        `Review saved, but vehicle status could not be updated: ${vehicleError.message}`,
      )
    }
  }

  try {
    await markVehicleCheckAttentionRead(companyId, userId, id)
  } catch {
    // Notification read-state is best-effort and must not block the review save.
  }

  const updated = await fetchVehicleCheckById(id)
  if (!updated) {
    throw new VehicleChecksServiceError(
      'Review was saved but the inspection could not be reloaded.',
    )
  }

  return updated
}

export const vehicleChecksService = {
  fetchVehicleChecks,
  fetchVehicleCheckById,
  createVehicleCheck,
  updateVehicleCheck,
  deleteVehicleCheck,
  saveVehicleCheckDefectReview,
}

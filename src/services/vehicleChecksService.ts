import {
  computeOverallResult,
  computeVehicleCheckSummaryStats,
  enrichVehicleCheckItemsWithTemplates,
} from '@/lib/vehicleCheckUtils'
import type {
  CreateVehicleCheckInput,
  UpdateVehicleCheckInput,
  VehicleCheck,
  VehicleCheckItem,
  VehicleCheckItemInput,
  VehicleCheckListItem,
  VehicleCheckOdometerUnit,
  VehicleCheckResult,
  VehicleCheckResultFilter,
  VehicleChecksPageResult,
  VehicleChecksQuery,
  VehicleCheckStatus,
  VehicleCheckSummaryStats,
} from '@/lib/vehicleCheckTypes'
import { DEFAULT_VEHICLE_CHECK_ODOMETER_UNIT } from '@/lib/vehicleCheckTypes'
import { calculateInspectionDurationSeconds } from '@/lib/vehicleCheckDurationUtils'
import { DEFAULT_VEHICLE_CHECK_PAGE_SIZE } from '@/lib/vehicleCheckTypes'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
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
  drivers ( first_name, last_name ),
  vehicles ( registration, fleet_number, make, model, vehicle_type ),
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
  drivers ( first_name, last_name ),
  vehicles ( registration, fleet_number, make, model, vehicle_type ),
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
  drivers: DriverJoinRow | DriverJoinRow[] | null
  vehicles: VehicleJoinRow | VehicleJoinRow[] | null
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

function countFailItems(row: VehicleCheckRow): number {
  const items = row.vehicle_check_items ?? []
  return items.filter((item) => item.result === 'Fail').length
}

function countDefectItems(row: VehicleCheckRow): number {
  const items = row.vehicle_check_items ?? []
  return items.filter((item) => item.result === 'Fail' || item.result === 'Advisory').length
}

function mapListRow(row: VehicleCheckRow): VehicleCheckListItem {
  const driver = normalizeJoinRow(row.drivers)
  const vehicle = normalizeJoinRow(row.vehicles)

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    vehicleId: row.vehicle_id,
    vehicleRegistration: vehicle?.registration ?? 'Unknown',
    fleetNumber: vehicle?.fleet_number ?? null,
    vehicleMake: vehicle?.make ?? null,
    vehicleModel: vehicle?.model ?? null,
    workerId: row.worker_id,
    workerName: driver ? `${driver.first_name} ${driver.last_name}`.trim() : 'Unknown',
    inspectionDate: row.inspection_date,
    odometer: row.odometer,
    odometerUnit: normalizeOdometerUnit(row.odometer_unit),
    status: normalizeStatus(row.status),
    overallResult: normalizeResult(row.overall_result),
    notes: row.notes,
    signatureUrl: row.signature_url,
    signedAt: row.signed_at,
    inspectionStartedAt: row.inspection_started_at,
    inspectionCompletedAt: row.inspection_completed_at,
    durationSeconds: row.duration_seconds,
    failCount: countFailItems(row),
    defectCount: countDefectItems(row),
  }
}

function mapDetailRow(row: VehicleCheckRow): VehicleCheck {
  const list = mapListRow(row)
  const items = (row.vehicle_check_items ?? []).map(mapItemRow)
  items.sort((a, b) => a.itemName.localeCompare(b.itemName))
  return { ...list, items }
}

async function fetchVehicleCheckStats(): Promise<VehicleCheckSummaryStats> {
  const [checksResult, defectItemsResult] = await Promise.all([
    requireSupabase()
      .from('vehicle_checks')
      .select('inspection_date, overall_result, vehicle_id'),
    requireSupabase()
      .from(VEHICLE_CHECK_ITEMS_TABLE)
      .select('id')
      .in('result', ['Fail', 'Advisory']),
  ])

  logSupabaseQuery({
    service: 'vehicleChecksService.fetchVehicleCheckStats.checks',
    table: 'vehicle_checks',
    data: checksResult.data,
    error: checksResult.error,
  })

  logSupabaseQuery({
    service: 'vehicleChecksService.fetchVehicleCheckStats.defectItems',
    table: 'vehicle_check_items',
    data: defectItemsResult.data,
    error: defectItemsResult.error,
  })

  if (checksResult.error) {
    throw new VehicleChecksServiceError(checksResult.error.message)
  }

  if (defectItemsResult.error) {
    throw new VehicleChecksServiceError(defectItemsResult.error.message)
  }

  return computeVehicleCheckSummaryStats(
    (checksResult.data ?? []).map((row) => ({
      inspectionDate: row.inspection_date,
      overallResult: normalizeResult(row.overall_result),
      vehicleId: row.vehicle_id,
    })),
    defectItemsResult.data?.length ?? 0,
  )
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
  if (result === 'Defects') {
    return normalizeResult(row.overall_result) === 'Advisory' || countDefectItems(row) > 0
  }

  return normalizeResult(row.overall_result) === result
}

function stripClientOnlyChecklistFields(item: VehicleCheckItemInput): VehicleCheckItemInput {
  const { photoFile: _photoFile, photoPreviewUrl: _photoPreviewUrl, ...rest } = item
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
  const page = Math.max(1, query.page ?? 1)
  const pageSize = query.pageSize ?? DEFAULT_VEHICLE_CHECK_PAGE_SIZE

  let request = requireSupabase()
    .from('vehicle_checks')
    .select(vehicleCheckListSelect, { count: 'exact' })

  if (query.status && query.status !== 'all') {
    request = request.eq('status', query.status)
  }

  if (query.result && query.result !== 'all' && query.result !== 'Defects') {
    request = request.eq('overall_result', query.result)
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
    if (search && !matchesVehicleCheckSearch(row, search)) return false
    return true
  })
  const from = (page - 1) * pageSize
  const to = from + pageSize
  const stats = await fetchVehicleCheckStats()

  return {
    items: filteredRows.slice(from, to).map(mapListRow),
    totalCount:
      search || query.result === 'Defects'
        ? filteredRows.length
        : (count ?? filteredRows.length),
    page,
    pageSize,
    stats,
  }
}

export async function fetchVehicleCheckById(id: string): Promise<VehicleCheck | null> {
  const { data, error } = await requireSupabase()
    .from('vehicle_checks')
    .select(vehicleCheckDetailSelect)
    .eq('id', id)
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

  const completedAtDate = new Date()
  const durationSeconds = calculateInspectionDurationSeconds(startedAtDate, completedAtDate)
  if (durationSeconds == null) {
    throw new VehicleChecksServiceError('Inspection duration could not be calculated.')
  }

  const overallResult = computeOverallResult(input.items)
  const status = input.status ?? 'Completed'
  const odometerUnit = input.odometerUnit ?? DEFAULT_VEHICLE_CHECK_ODOMETER_UNIT

  const { data: checkRow, error: checkError } = await requireSupabase()
    .from('vehicle_checks')
    .insert({
      vehicle_id: input.vehicleId,
      worker_id: input.workerId,
      inspection_date: input.inspectionDate,
      odometer: input.odometer,
      odometer_unit: odometerUnit,
      status,
      overall_result: overallResult,
      notes: input.notes?.trim() || null,
      inspection_started_at: startedAtDate.toISOString(),
      inspection_completed_at: completedAtDate.toISOString(),
      duration_seconds: durationSeconds,
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

  try {
    const signaturePath = await uploadVehicleCheckSignature(
      input.vehicleId,
      checkRow.id,
      input.signatureFile,
    )

    const { error: signatureError } = await requireSupabase()
      .from('vehicle_checks')
      .update({
        signature_url: signaturePath,
        signed_at: new Date().toISOString(),
      })
      .eq('id', checkRow.id)

    if (signatureError) {
      throw new VehicleChecksServiceError(signatureError.message)
    }
  } catch (signatureError) {
    await requireSupabase().from('vehicle_checks').delete().eq('id', checkRow.id)
    throw new VehicleChecksServiceError(
      signatureError instanceof Error
        ? signatureError.message
        : 'Failed to upload worker signature.',
    )
  }

  let itemsWithPhotos: VehicleCheckItemInput[]
  try {
    itemsWithPhotos = await prepareItemsWithUploadedPhotos(
      input.vehicleId,
      checkRow.id,
      input.items,
    )
  } catch (photoError) {
    await requireSupabase().from('vehicle_checks').delete().eq('id', checkRow.id)
    throw new VehicleChecksServiceError(
      photoError instanceof Error ? photoError.message : 'Failed to upload defect photo.',
    )
  }

  const itemRows = buildItemRows(checkRow.id, itemsWithPhotos)
  const { error: itemsError } = await requireSupabase().from(VEHICLE_CHECK_ITEMS_TABLE).insert(itemRows)

  logSupabaseQuery({
    service: 'vehicleChecksService.createVehicleCheck.items',
    table: 'vehicle_check_items',
    data: itemRows,
    error: itemsError,
  })

  if (itemsError) {
    await requireSupabase().from('vehicle_checks').delete().eq('id', checkRow.id)
    throw new VehicleChecksServiceError(itemsError.message)
  }

  const created = await fetchVehicleCheckById(checkRow.id)
  if (!created) {
    throw new VehicleChecksServiceError('Inspection was created but could not be loaded.')
  }

  return created
}

export async function updateVehicleCheck(
  id: string,
  input: UpdateVehicleCheckInput,
): Promise<VehicleCheck> {
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

  const overallResult = computeOverallResult(items)
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    overall_result: overallResult,
  }

  if (input.vehicleId !== undefined) patch.vehicle_id = input.vehicleId
  if (input.workerId !== undefined) patch.worker_id = input.workerId
  if (input.inspectionDate !== undefined) patch.inspection_date = input.inspectionDate
  if (input.odometer !== undefined) patch.odometer = input.odometer
  if (input.status !== undefined) patch.status = input.status
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null

  const { error: updateError } = await requireSupabase()
    .from('vehicle_checks')
    .update(patch)
    .eq('id', id)

  logSupabaseQuery({
    service: 'vehicleChecksService.updateVehicleCheck',
    table: 'vehicle_checks',
    data: updateError ? [] : [{ id }],
    error: updateError,
  })

  if (updateError) {
    throw new VehicleChecksServiceError(updateError.message)
  }

  if (input.items) {
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

    const itemRows = buildItemRows(id, itemsWithPhotos)
    const { error: itemsError } = await requireSupabase().from(VEHICLE_CHECK_ITEMS_TABLE).insert(itemRows)

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

  const updated = await fetchVehicleCheckById(id)
  if (!updated) {
    throw new VehicleChecksServiceError('Inspection was updated but could not be loaded.')
  }

  return updated
}

export async function deleteVehicleCheck(id: string): Promise<void> {
  const { error } = await requireSupabase().from('vehicle_checks').delete().eq('id', id)

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

export const vehicleChecksService = {
  fetchVehicleChecks,
  fetchVehicleCheckById,
  createVehicleCheck,
  updateVehicleCheck,
  deleteVehicleCheck,
}

import { requireVerifiedCompanyId } from '@/lib/companySettingsGlobals'
import { getCurrentViewToday } from '@/lib/currentViewVisibility'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import {
  buildTyreLayout,
  DEFAULT_TYRE_CHECK_PAGE_SIZE,
  formatTyreSummaryLabel,
  parseTyreTreadDepthMm,
  treadDepthToStatus,
  tyreAxleTypeFor,
  tyrePositionFromDb,
  tyrePositionToDb,
  validateTyreAxleCounts,
  type TyreCheckAdminOverviewStats,
  type TyreCheckListItem,
  type TyreCheckOverallResult,
  type TyreChecksPageResult,
  type TyreChecksQuery,
  type TyreMeasurement,
  type TyreStatus,
  type TyreUnit,
  type WorkerTyreCheckDraft,
} from '@/lib/tyreCheckTypes'
import {
  getVehicleStatusForDate,
  type Vehicle,
  type VehicleStatus,
} from '@/services/vehiclesService'

const TYRE_OVERVIEW_UNAVAILABLE_STATUSES: VehicleStatus[] = [
  'Off Road',
  'Maintenance',
  'Workshop',
  'Out of Service',
  'Reserved',
  'Assigned',
]

export class TyreChecksServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TyreChecksServiceError'
  }
}

const tyreCheckListSelect = `
  id,
  created_at,
  submitted_at,
  inspection_started_at,
  inspection_completed_at,
  duration_seconds,
  odometer,
  odometer_unit,
  vehicle_id,
  trailer_vehicle_id,
  trailer_number_snapshot,
  worker_id,
  truck_axle_count,
  trailer_axle_count,
  overall_result,
  good_count,
  attention_count,
  critical_count,
  dirty_count,
  defect_count,
  not_checked_count,
  notes,
  status,
  vehicles!vehicle_id (
    registration,
    make,
    model
  ),
  trailer:vehicles!trailer_vehicle_id (
    registration,
    trailer_number
  ),
  drivers!worker_id (
    first_name,
    last_name,
    email
  )
`

const tyreCheckDetailSelect = `
  ${tyreCheckListSelect},
  tyre_check_items (
    id,
    unit,
    axle_number,
    axle_type,
    position,
    tread_depth_mm,
    tread_status,
    is_dirty,
    has_defect,
    defect_notes,
    notes,
    photo_paths
  )
`

type VehicleEmbed = {
  registration: string | null
  make: string | null
  model: string | null
} | null

type TrailerEmbed = {
  registration: string | null
  trailer_number: string | null
} | null

type DriverEmbed = {
  first_name: string | null
  last_name: string | null
  email: string | null
} | null

type TyreCheckRow = {
  id: string
  created_at: string
  submitted_at: string | null
  inspection_started_at: string | null
  inspection_completed_at: string | null
  duration_seconds?: number | null
  odometer?: number | null
  odometer_unit?: string | null
  vehicle_id: string
  trailer_vehicle_id: string | null
  trailer_number_snapshot: string | null
  worker_id: string
  truck_axle_count: number
  trailer_axle_count: number | null
  overall_result: string
  good_count: number
  attention_count: number
  critical_count: number
  dirty_count: number
  defect_count: number
  not_checked_count: number
  notes: string | null
  status: string
  vehicles: VehicleEmbed
  trailer: TrailerEmbed
  drivers: DriverEmbed
}

type TyreCheckItemRow = {
  id: string
  unit: string
  axle_number: number
  axle_type: string
  position: string
  tread_depth_mm: number | null
  tread_status: string | null
  is_dirty: boolean
  has_defect: boolean
  defect_notes: string | null
  notes: string | null
  photo_paths: string[] | null
}

type TyreCheckDetailRow = TyreCheckRow & {
  tyre_check_items: TyreCheckItemRow[] | null
}

function sanitizeSearchTerm(value: string): string {
  return value.trim().replace(/[%_,]/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildIlikePattern(value: string): string {
  return `%${sanitizeSearchTerm(value)}%`
}

/** PostgREST `.or()` values with spaces/special chars need double quotes. */
function quotedIlike(column: string, term: string): string {
  const pattern = buildIlikePattern(term).replace(/"/g, '')
  return `${column}.ilike."${pattern}"`
}

function isMissingTyreChecksError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('tyre_checks') &&
    (normalized.includes('does not exist') ||
      normalized.includes('schema cache') ||
      normalized.includes('could not find the table'))
  )
}

function normalizeOverallResult(value: string): TyreCheckOverallResult {
  if (value === 'pass' || value === 'fail' || value === 'attention' || value === 'incomplete') {
    return value
  }
  return 'incomplete'
}

function workerDisplayName(driver: DriverEmbed): string {
  if (!driver) return 'Worker'
  const name = `${driver.first_name ?? ''} ${driver.last_name ?? ''}`.trim()
  return name || 'Worker'
}

function resolveInspectedAt(row: TyreCheckRow): string {
  return (
    row.submitted_at ||
    row.inspection_completed_at ||
    row.inspection_started_at ||
    row.created_at
  )
}

function mapListRow(row: TyreCheckRow): TyreCheckListItem {
  const vehicle = row.vehicles
  const trailer = row.trailer
  const summaryLabel = formatTyreSummaryLabel({
    good: row.good_count,
    attention: row.attention_count,
    critical: row.critical_count,
    dirty: row.dirty_count,
    notChecked: row.not_checked_count,
  })

  return {
    id: row.id,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    inspectedAt: resolveInspectedAt(row),
    vehicleId: row.vehicle_id,
    vehicleRegistration: vehicle?.registration?.trim() || '—',
    vehicleMake: vehicle?.make?.trim() || null,
    vehicleModel: vehicle?.model?.trim() || null,
    trailerVehicleId: row.trailer_vehicle_id,
    trailerRegistration: trailer?.registration?.trim() || null,
    trailerNumber:
      row.trailer_number_snapshot?.trim() ||
      trailer?.trailer_number?.trim() ||
      null,
    workerId: row.worker_id,
    workerName: workerDisplayName(row.drivers),
    workerEmail: row.drivers?.email?.trim() || null,
    truckAxleCount: row.truck_axle_count,
    trailerAxleCount: row.trailer_axle_count,
    overallResult: normalizeOverallResult(row.overall_result),
    goodCount: row.good_count,
    attentionCount: row.attention_count,
    criticalCount: row.critical_count,
    dirtyCount: row.dirty_count,
    defectCount: row.defect_count,
    notCheckedCount: row.not_checked_count,
    summaryLabel,
    notes: row.notes,
    status:
      row.status === 'submitted' || row.status === 'in_progress' || row.status === 'draft'
        ? row.status
        : 'draft',
  }
}

function mapItemStatus(row: TyreCheckItemRow): TyreStatus {
  return treadDepthToStatus(row.tread_depth_mm, row.is_dirty)
}

function mapDetailMeasurements(items: TyreCheckItemRow[]): TyreMeasurement[] {
  return items
    .slice()
    .sort((a, b) => {
      if (a.unit !== b.unit) return a.unit === 'vehicle' ? -1 : 1
      if (a.axle_number !== b.axle_number) return a.axle_number - b.axle_number
      return a.position.localeCompare(b.position)
    })
    .map((item) => {
      const unit = (item.unit === 'trailer' ? 'trailer' : 'vehicle') as TyreUnit
      const position = tyrePositionFromDb(item.position)
      const axleLabel =
        unit === 'trailer'
          ? `Trailer Axle ${item.axle_number}`
          : item.axle_number === 1
            ? 'Steer Axle 1'
            : `Drive Axle ${item.axle_number}`
      return {
        id: `${unit}-${item.axle_number}-${position}`,
        dbItemId: item.id,
        unit,
        axleNumber: item.axle_number,
        position,
        axleLabel,
        treadDepthMm: item.tread_depth_mm,
        status: mapItemStatus(item),
        isDirty: item.is_dirty,
        hasDefect: item.has_defect,
        defectNotes: item.defect_notes?.trim() || '',
        notes: item.notes?.trim() || '',
      }
    })
}

function mapWorkerDraft(
  listItem: TyreCheckListItem,
  measurements: TyreMeasurement[],
  meta: {
    odometer: number
    odometerUnit: 'miles' | 'km'
    inspectionStartedAt: string
    durationSeconds: number | null
  },
): WorkerTyreCheckDraft {
  return {
    checkId: listItem.id,
    vehicleId: listItem.vehicleId,
    trailerVehicleId: listItem.trailerVehicleId,
    truckAxleCount: listItem.truckAxleCount,
    trailerAxleCount: listItem.trailerAxleCount,
    workerId: listItem.workerId,
    odometer: meta.odometer,
    odometerUnit: meta.odometerUnit,
    inspectionStartedAt: meta.inspectionStartedAt,
    status: listItem.status,
    items: measurements,
    goodCount: listItem.goodCount,
    attentionCount: listItem.attentionCount,
    criticalCount: listItem.criticalCount,
    dirtyCount: listItem.dirtyCount,
    defectCount: listItem.defectCount,
    notCheckedCount: listItem.notCheckedCount,
    overallResult: listItem.overallResult,
    durationSeconds: meta.durationSeconds,
    submittedAt: listItem.submittedAt,
  }
}

async function resolveSearchTargetIds(
  companyId: string,
  search: string,
): Promise<{
  vehicleIds: string[]
  workerIds: string[]
  hasTrailerNumberMatch: boolean
}> {
  const pattern = buildIlikePattern(search)

  const [vehiclesResult, workersResult, trailerNumberResult] = await Promise.all([
    requireSupabase()
      .from('vehicles')
      .select('id')
      .eq('company_id', companyId)
      .or(
        [
          quotedIlike('registration', search),
          quotedIlike('fleet_number', search),
          quotedIlike('make', search),
          quotedIlike('model', search),
          quotedIlike('trailer_number', search),
        ].join(','),
      )
      .limit(200),
    requireSupabase()
      .from('drivers')
      .select('id')
      .eq('company_id', companyId)
      .or(
        [
          quotedIlike('first_name', search),
          quotedIlike('last_name', search),
          quotedIlike('email', search),
        ].join(','),
      )
      .limit(200),
    requireSupabase()
      .from('tyre_checks')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .ilike('trailer_number_snapshot', pattern),
  ])

  if (vehiclesResult.error) {
    throw new TyreChecksServiceError(vehiclesResult.error.message)
  }
  if (workersResult.error) {
    throw new TyreChecksServiceError(workersResult.error.message)
  }
  if (trailerNumberResult.error && !isMissingTyreChecksError(trailerNumberResult.error.message)) {
    throw new TyreChecksServiceError(trailerNumberResult.error.message)
  }

  return {
    vehicleIds: (vehiclesResult.data ?? []).map((row) => row.id),
    workerIds: (workersResult.data ?? []).map((row) => row.id),
    hasTrailerNumberMatch: (trailerNumberResult.count ?? 0) > 0,
  }
}

function endOfDayIso(dateOnly: string): string {
  return `${dateOnly}T23:59:59.999Z`
}

function startOfDayIso(dateOnly: string): string {
  return `${dateOnly}T00:00:00.000Z`
}

export async function fetchTyreChecks(
  query: TyreChecksQuery = {},
): Promise<TyreChecksPageResult> {
  const companyId = requireVerifiedCompanyId()
  const page = Math.max(1, query.page ?? 1)
  const pageSize = query.pageSize ?? DEFAULT_TYRE_CHECK_PAGE_SIZE
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const sortAscending = query.sortDir === 'asc'
  const search = query.search?.trim() ?? ''

  let searchVehicleIds: string[] = []
  let searchWorkerIds: string[] = []
  let searchHasTrailerSnapshot = false

  if (search) {
    const resolved = await resolveSearchTargetIds(companyId, search)
    searchVehicleIds = resolved.vehicleIds
    searchWorkerIds = resolved.workerIds
    searchHasTrailerSnapshot = resolved.hasTrailerNumberMatch

    if (
      searchVehicleIds.length === 0 &&
      searchWorkerIds.length === 0 &&
      !searchHasTrailerSnapshot
    ) {
      return { items: [], totalCount: 0, page, pageSize }
    }
  }

  let request = requireSupabase()
    .from('tyre_checks')
    .select(tyreCheckListSelect, { count: 'exact' })
    .eq('company_id', companyId)

  if (query.result && query.result !== 'all') {
    request = request.eq('overall_result', query.result)
  }

  if (query.defectFocus && query.defectFocus !== 'all') {
    switch (query.defectFocus) {
      case 'critical':
        request = request.gt('critical_count', 0)
        break
      case 'attention':
        request = request.gt('attention_count', 0)
        break
      case 'dirty':
        request = request.gt('dirty_count', 0)
        break
      case 'has_defect':
        request = request.gt('defect_count', 0)
        break
      default:
        break
    }
  }

  if (query.vehicleId && query.vehicleId !== 'all') {
    request = request.eq('vehicle_id', query.vehicleId)
  }

  if (query.workerId && query.workerId !== 'all') {
    request = request.eq('worker_id', query.workerId)
  }

  if (query.trailerVehicleId && query.trailerVehicleId !== 'all') {
    request = request.eq('trailer_vehicle_id', query.trailerVehicleId)
  }

  if (query.dateFrom) {
    request = request.gte('created_at', startOfDayIso(query.dateFrom))
  }

  if (query.dateTo) {
    request = request.lte('created_at', endOfDayIso(query.dateTo))
  }

  if (search) {
    const orParts: string[] = []
    if (searchVehicleIds.length > 0) {
      const ids = searchVehicleIds.join(',')
      orParts.push(`vehicle_id.in.(${ids})`)
      orParts.push(`trailer_vehicle_id.in.(${ids})`)
    }
    if (searchWorkerIds.length > 0) {
      orParts.push(`worker_id.in.(${searchWorkerIds.join(',')})`)
    }
    orParts.push(quotedIlike('trailer_number_snapshot', search))
    request = request.or(orParts.join(','))
  }

  request = request
    .order('created_at', { ascending: sortAscending })
    .order('id', { ascending: sortAscending })
    .range(from, to)

  const { data, error, count } = await request

  logSupabaseQuery({
    service: 'tyreChecksService.fetchTyreChecks',
    table: 'tyre_checks',
    data,
    error,
    count,
  })

  if (error) {
    if (isMissingTyreChecksError(error.message)) {
      return { items: [], totalCount: 0, page, pageSize }
    }
    throw new TyreChecksServiceError(error.message)
  }

  const rows = (data ?? []) as unknown as TyreCheckRow[]

  return {
    items: rows.map(mapListRow),
    totalCount: count ?? rows.length,
    page,
    pageSize,
  }
}

export async function fetchTyreCheckAdminOverview(
  vehicles: Vehicle[],
  companyToday: string = getCurrentViewToday(),
): Promise<TyreCheckAdminOverviewStats> {
  const companyId = requireVerifiedCompanyId()
  const start = startOfDayIso(companyToday)
  const end = endOfDayIso(companyToday)

  const activeVehicleIds = new Set<string>()
  for (const vehicle of vehicles) {
    const status = getVehicleStatusForDate(vehicle, companyToday)
    if (!TYRE_OVERVIEW_UNAVAILABLE_STATUSES.includes(status)) {
      activeVehicleIds.add(vehicle.id)
    }
  }

  const totalActiveVehicles = activeVehicleIds.size

  const empty: TyreCheckAdminOverviewStats = {
    completedToday: 0,
    notCheckedToday: totalActiveVehicles,
    attention: 0,
    critical: 0,
    dirty: 0,
    openDefects: 0,
    totalActiveVehicles,
    needsAttention: [],
  }

  if (totalActiveVehicles === 0) return empty

  const { data, error } = await requireSupabase()
    .from('tyre_checks')
    .select(tyreCheckListSelect)
    .eq('company_id', companyId)
    .eq('status', 'submitted')
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: false })
    .limit(200)

  logSupabaseQuery({
    service: 'tyreChecksService.fetchTyreCheckAdminOverview',
    table: 'tyre_checks',
    data,
    error,
  })

  if (error) {
    if (isMissingTyreChecksError(error.message)) return empty
    throw new TyreChecksServiceError(error.message)
  }

  const rows = ((data ?? []) as unknown as TyreCheckRow[]).map(mapListRow)
  const checkedVehicleIds = new Set<string>()
  let attention = 0
  let critical = 0
  let dirty = 0
  let openDefects = 0

  for (const row of rows) {
    if (activeVehicleIds.has(row.vehicleId)) {
      checkedVehicleIds.add(row.vehicleId)
    }
    attention += row.attentionCount
    critical += row.criticalCount
    dirty += row.dirtyCount
    openDefects += row.defectCount
  }

  const needsAttention = rows
    .filter(
      (row) =>
        row.criticalCount > 0 ||
        row.attentionCount > 0 ||
        row.dirtyCount > 0 ||
        row.defectCount > 0 ||
        row.overallResult === 'fail' ||
        row.overallResult === 'attention',
    )
    .slice(0, 8)

  return {
    completedToday: checkedVehicleIds.size,
    notCheckedToday: Math.max(0, totalActiveVehicles - checkedVehicleIds.size),
    attention,
    critical,
    dirty,
    openDefects,
    totalActiveVehicles,
    needsAttention,
  }
}

export async function fetchTyreCheckDetail(id: string): Promise<{
  listItem: TyreCheckListItem
  measurements: TyreMeasurement[]
} | null> {
  const companyId = requireVerifiedCompanyId()
  const { data, error } = await requireSupabase()
    .from('tyre_checks')
    .select(tyreCheckDetailSelect)
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle()

  logSupabaseQuery({
    service: 'tyreChecksService.fetchTyreCheckDetail',
    table: 'tyre_checks',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    if (isMissingTyreChecksError(error.message)) return null
    throw new TyreChecksServiceError(error.message)
  }

  if (!data) return null

  const row = data as unknown as TyreCheckDetailRow
  return {
    listItem: mapListRow(row),
    measurements: mapDetailMeasurements(row.tyre_check_items ?? []),
  }
}

export type CreateWorkerTyreCheckInput = {
  workerId: string
  vehicleId: string
  trailerVehicleId?: string | null
  truckAxleCount: number
  trailerAxleCount?: number | null
  odometer: number
  odometerUnit?: 'miles' | 'km'
}

export type UpdateWorkerTyreCheckItemInput = {
  treadDepthMm: number | null
  isDirty: boolean
  hasDefect: boolean
  defectNotes: string
  notes?: string
}

export async function createWorkerTyreCheck(
  input: CreateWorkerTyreCheckInput,
): Promise<WorkerTyreCheckDraft> {
  const companyId = requireVerifiedCompanyId()
  const trailerVehicleId = input.trailerVehicleId?.trim() || null
  const trailerAxleCount = trailerVehicleId
    ? (input.trailerAxleCount ?? null)
    : null

  const axleError = validateTyreAxleCounts(input.truckAxleCount, trailerAxleCount)
  if (axleError) throw new TyreChecksServiceError(axleError)

  if (!Number.isInteger(input.odometer) || input.odometer < 0) {
    throw new TyreChecksServiceError('Enter a valid odometer reading.')
  }

  const inspectionStartedAt = new Date().toISOString()
  const parentPayload = {
    company_id: companyId,
    vehicle_id: input.vehicleId,
    trailer_vehicle_id: trailerVehicleId,
    trailer_axle_count: trailerAxleCount,
    worker_id: input.workerId,
    status: 'in_progress' as const,
    truck_axle_count: input.truckAxleCount,
    inspection_started_at: inspectionStartedAt,
    odometer: input.odometer,
    odometer_unit: input.odometerUnit === 'km' ? 'km' : 'miles',
  }

  const { data: parentData, error: parentError } = await requireSupabase()
    .from('tyre_checks')
    .insert(parentPayload)
    .select('id')
    .single()

  logSupabaseQuery({
    service: 'tyreChecksService.createWorkerTyreCheck',
    table: 'tyre_checks',
    data: parentData ? [parentData] : [],
    error: parentError,
  })

  if (parentError || !parentData) {
    throw new TyreChecksServiceError(
      parentError?.message || 'Unable to start tyre check.',
    )
  }

  const checkId = parentData.id as string
  const layout = buildTyreLayout(input.truckAxleCount, trailerAxleCount)
  const itemRows = layout.map((tyre) => ({
    tyre_check_id: checkId,
    unit: tyre.unit,
    axle_number: tyre.axleNumber,
    axle_type: tyreAxleTypeFor(tyre.unit, tyre.axleNumber),
    position: tyrePositionToDb(tyre.position),
    tread_depth_mm: null,
    is_dirty: false,
    has_defect: false,
    defect_notes: null,
    notes: null,
    photo_paths: [] as string[],
  }))

  const { error: itemsError } = await requireSupabase()
    .from('tyre_check_items')
    .insert(itemRows)

  logSupabaseQuery({
    service: 'tyreChecksService.createWorkerTyreCheck.items',
    table: 'tyre_check_items',
    data: itemRows,
    error: itemsError,
  })

  if (itemsError) {
    await requireSupabase().from('tyre_checks').delete().eq('id', checkId)
    throw new TyreChecksServiceError(
      itemsError.message || 'Unable to create tyre check positions.',
    )
  }

  const draft = await fetchWorkerTyreCheckDraft(checkId)
  if (!draft) {
    throw new TyreChecksServiceError('Tyre check was created but could not be reloaded.')
  }
  return draft
}

export async function fetchWorkerTyreCheckDraft(
  checkId: string,
): Promise<WorkerTyreCheckDraft | null> {
  const companyId = requireVerifiedCompanyId()
  const { data, error } = await requireSupabase()
    .from('tyre_checks')
    .select(tyreCheckDetailSelect)
    .eq('company_id', companyId)
    .eq('id', checkId)
    .maybeSingle()

  logSupabaseQuery({
    service: 'tyreChecksService.fetchWorkerTyreCheckDraft',
    table: 'tyre_checks',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    if (isMissingTyreChecksError(error.message)) return null
    throw new TyreChecksServiceError(error.message)
  }
  if (!data) return null

  const row = data as unknown as TyreCheckDetailRow & {
    odometer: number | null
    odometer_unit: string | null
    duration_seconds: number | null
  }

  return mapWorkerDraft(mapListRow(row), mapDetailMeasurements(row.tyre_check_items ?? []), {
    odometer: row.odometer ?? 0,
    odometerUnit: row.odometer_unit === 'km' ? 'km' : 'miles',
    inspectionStartedAt:
      row.inspection_started_at || row.created_at || new Date().toISOString(),
    durationSeconds: row.duration_seconds,
  })
}

export async function updateWorkerTyreCheckItem(
  itemId: string,
  patch: UpdateWorkerTyreCheckItemInput,
): Promise<TyreMeasurement> {
  if (patch.hasDefect && !patch.defectNotes.trim()) {
    throw new TyreChecksServiceError('Defect notes are required when Defect is selected.')
  }

  if (patch.treadDepthMm != null) {
    const parsed = parseTyreTreadDepthMm(String(patch.treadDepthMm))
    if (!parsed.ok) throw new TyreChecksServiceError(parsed.error)
  }

  const payload = {
    tread_depth_mm: patch.treadDepthMm,
    is_dirty: patch.isDirty,
    has_defect: patch.hasDefect,
    defect_notes: patch.hasDefect ? patch.defectNotes.trim() : null,
    notes: patch.notes?.trim() || null,
  }

  const { data, error } = await requireSupabase()
    .from('tyre_check_items')
    .update(payload)
    .eq('id', itemId)
    .select(
      'id, unit, axle_number, axle_type, position, tread_depth_mm, tread_status, is_dirty, has_defect, defect_notes, notes, photo_paths',
    )
    .maybeSingle()

  logSupabaseQuery({
    service: 'tyreChecksService.updateWorkerTyreCheckItem',
    table: 'tyre_check_items',
    data: data ? [data] : [],
    error,
  })

  if (error) throw new TyreChecksServiceError(error.message)
  if (!data) throw new TyreChecksServiceError('Tyre position not found or not editable.')

  const [measurement] = mapDetailMeasurements([data as TyreCheckItemRow])
  return measurement
}

export async function submitWorkerTyreCheck(
  checkId: string,
): Promise<WorkerTyreCheckDraft> {
  const draft = await fetchWorkerTyreCheckDraft(checkId)
  if (!draft) throw new TyreChecksServiceError('Tyre check not found.')
  if (draft.status === 'submitted') {
    throw new TyreChecksServiceError('This tyre check is already submitted.')
  }

  for (const item of draft.items) {
    if (item.treadDepthMm == null) {
      throw new TyreChecksServiceError(
        'Every tyre needs a tread depth before you can submit.',
      )
    }
    if (item.hasDefect && !item.defectNotes?.trim()) {
      throw new TyreChecksServiceError(
        'Add defect notes for every tyre marked Defect.',
      )
    }
  }

  const { error } = await requireSupabase()
    .from('tyre_checks')
    .update({ status: 'submitted' })
    .eq('id', checkId)
    .in('status', ['draft', 'in_progress'])

  logSupabaseQuery({
    service: 'tyreChecksService.submitWorkerTyreCheck',
    table: 'tyre_checks',
    data: [{ id: checkId, status: 'submitted' }],
    error,
  })

  if (error) throw new TyreChecksServiceError(error.message)

  const submitted = await fetchWorkerTyreCheckDraft(checkId)
  if (!submitted || submitted.status !== 'submitted') {
    throw new TyreChecksServiceError('Submit did not complete. Please try again.')
  }
  return submitted
}

import {
  isConsumableType,
  isConsumableUnit,
} from '@/lib/consumableUtils'
import type {
  Consumable,
  ConsumablesMonthlySummaryQuery,
  ConsumablesMonthlySummaryResult,
  ConsumablesPageResult,
  ConsumablesQuery,
  CreateConsumableInput,
  UpdateConsumableInput,
} from '@/lib/consumableTypes'
import { DEFAULT_CONSUMABLE_PAGE_SIZE } from '@/lib/consumableTypes'
import { getMonthDateRange } from '@/lib/consumableUtils'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'

type WorkerLookupRow = {
  id: string
  first_name: string
  last_name: string
}

type VehicleLookupRow = {
  id: string
  registration: string
  make: string | null
  model: string | null
}

type ConsumableRow = {
  id: string
  created_at: string
  updated_at: string
  vehicle_id: string | null
  worker_id: string | null
  consumable_type: string
  item_name: string | null
  quantity: number | string
  unit: string
  cost: number | string | null
  supplier: string | null
  site: string | null
  odometer: number | string | null
  receipt_url: string | null
  notes: string | null
  entry_date: string
  entry_time: string | null
}

const consumableSelect = `
  id,
  created_at,
  updated_at,
  vehicle_id,
  worker_id,
  consumable_type,
  item_name,
  quantity,
  unit,
  cost,
  supplier,
  site,
  odometer,
  receipt_url,
  notes,
  entry_date,
  entry_time
`

export class ConsumablesServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConsumablesServiceError'
  }
}

function mapVehicleLabel(vehicle: VehicleLookupRow): string {
  return vehicle.registration
}

function mapRow(
  row: ConsumableRow,
  workerNames: Map<string, string>,
  vehicleLabels: Map<string, string>,
): Consumable {
  const consumableType = isConsumableType(row.consumable_type) ? row.consumable_type : 'Other'
  const unit = isConsumableUnit(row.unit) ? row.unit : 'L'

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    vehicleId: row.vehicle_id,
    vehicleLabel: row.vehicle_id ? vehicleLabels.get(row.vehicle_id) ?? null : null,
    workerId: row.worker_id,
    workerName: row.worker_id ? workerNames.get(row.worker_id) ?? null : null,
    consumableType,
    itemName: row.item_name,
    quantity: Number(row.quantity) || 0,
    unit,
    cost: row.cost === null || row.cost === undefined ? null : Number(row.cost),
    supplier: row.supplier,
    site: row.site,
    odometer: row.odometer === null || row.odometer === undefined ? null : Number(row.odometer),
    receiptUrl: row.receipt_url,
    notes: row.notes,
    entryDate: row.entry_date,
    entryTime: row.entry_time,
  }
}

function isMissingConsumablesTableError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('consumables') &&
    (normalized.includes('does not exist') ||
      normalized.includes('could not find the table') ||
      normalized.includes('schema cache'))
  )
}

async function fetchWorkerNameMap(workerIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(workerIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await requireSupabase()
    .from('drivers')
    .select('id, first_name, last_name')
    .in('id', uniqueIds)

  logSupabaseQuery({
    service: 'consumablesService.fetchWorkerNameMap',
    table: 'drivers',
    data,
    error,
  })

  if (error) {
    throw new ConsumablesServiceError(error.message)
  }

  return new Map(
    (data ?? []).map((row) => {
      const worker = row as WorkerLookupRow
      return [worker.id, `${worker.first_name} ${worker.last_name}`.trim()]
    }),
  )
}

async function fetchVehicleLabelMap(vehicleIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(vehicleIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await requireSupabase()
    .from('vehicles')
    .select('id, registration, make, model')
    .in('id', uniqueIds)

  logSupabaseQuery({
    service: 'consumablesService.fetchVehicleLabelMap',
    table: 'vehicles',
    data,
    error,
  })

  if (error) {
    throw new ConsumablesServiceError(error.message)
  }

  return new Map(
    (data ?? []).map((row) => {
      const vehicle = row as VehicleLookupRow
      return [vehicle.id, mapVehicleLabel(vehicle)]
    }),
  )
}

async function mapConsumableRows(rows: ConsumableRow[]): Promise<Consumable[]> {
  const workerIds = rows.map((row) => row.worker_id).filter((id): id is string => Boolean(id))
  const vehicleIds = rows.map((row) => row.vehicle_id).filter((id): id is string => Boolean(id))

  const [workerNames, vehicleLabels] = await Promise.all([
    fetchWorkerNameMap(workerIds),
    fetchVehicleLabelMap(vehicleIds),
  ])

  return rows.map((row) => mapRow(row, workerNames, vehicleLabels))
}

export async function fetchConsumables(
  query: ConsumablesQuery = {},
): Promise<ConsumablesPageResult> {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = query.pageSize ?? DEFAULT_CONSUMABLE_PAGE_SIZE
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let request = requireSupabase()
    .from('consumables')
    .select(consumableSelect, { count: 'exact' })
    .is('deleted_at', null)

  if (query.type && query.type !== 'all') {
    request = request.eq('consumable_type', query.type)
  }

  if (query.vehicleId && query.vehicleId !== 'all') {
    request = request.eq('vehicle_id', query.vehicleId)
  }

  if (query.workerId && query.workerId !== 'all') {
    request = request.eq('worker_id', query.workerId)
  }

  if (query.dateFrom) {
    request = request.gte('entry_date', query.dateFrom)
  }

  if (query.dateTo) {
    request = request.lte('entry_date', query.dateTo)
  }

  const search = query.search?.trim()
  if (search) {
    request = request.or(
      `item_name.ilike.%${search}%,supplier.ilike.%${search}%,site.ilike.%${search}%,consumable_type.ilike.%${search}%`,
    )
  }

  request = request
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  const { data, error, count } = await request

  logSupabaseQuery({
    service: 'consumablesService.fetchConsumables',
    table: 'consumables',
    data,
    error,
    count,
  })

  if (error) {
    if (isMissingConsumablesTableError(error.message)) {
      return { items: [], totalCount: 0, page, pageSize }
    }
    throw new ConsumablesServiceError(error.message)
  }

  const rows = (data ?? []) as unknown as ConsumableRow[]
  const items = await mapConsumableRows(rows)

  return {
    items,
    totalCount: count ?? rows.length,
    page,
    pageSize,
  }
}

export async function fetchConsumablesForVehicle(vehicleId: string): Promise<Consumable[]> {
  const { data, error } = await requireSupabase()
    .from('consumables')
    .select(consumableSelect)
    .eq('vehicle_id', vehicleId)
    .is('deleted_at', null)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  logSupabaseQuery({
    service: 'consumablesService.fetchConsumablesForVehicle',
    table: 'consumables',
    data,
    error,
  })

  if (error) {
    if (isMissingConsumablesTableError(error.message)) return []
    throw new ConsumablesServiceError(error.message)
  }

  const rows = (data ?? []) as unknown as ConsumableRow[]
  return mapConsumableRows(rows)
}

export async function fetchConsumableById(id: string): Promise<Consumable | null> {
  const { data, error } = await requireSupabase()
    .from('consumables')
    .select(consumableSelect)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  logSupabaseQuery({
    service: 'consumablesService.fetchConsumableById',
    table: 'consumables',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    if (isMissingConsumablesTableError(error.message)) return null
    throw new ConsumablesServiceError(error.message)
  }

  if (!data) return null

  const [item] = await mapConsumableRows([data as unknown as ConsumableRow])
  return item ?? null
}

export async function createConsumable(input: CreateConsumableInput): Promise<Consumable> {
  const payload = {
    vehicle_id: input.vehicleId,
    worker_id: input.workerId ?? null,
    consumable_type: input.consumableType,
    item_name: input.itemName?.trim() || null,
    quantity: input.quantity,
    unit: input.unit,
    cost: input.cost ?? null,
    supplier: input.supplier?.trim() || null,
    site: input.site?.trim() || null,
    odometer: input.odometer ?? null,
    receipt_url: input.receiptUrl?.trim() || null,
    notes: input.notes?.trim() || null,
    entry_date: input.entryDate,
    entry_time: input.entryTime?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await requireSupabase()
    .from('consumables')
    .insert(payload)
    .select(consumableSelect)
    .single()

  logSupabaseQuery({
    service: 'consumablesService.createConsumable',
    table: 'consumables',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new ConsumablesServiceError(error.message)
  }

  const [item] = await mapConsumableRows([data as unknown as ConsumableRow])
  return item
}

export async function updateConsumable(
  id: string,
  input: UpdateConsumableInput,
): Promise<Consumable> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.entryDate !== undefined) payload.entry_date = input.entryDate
  if (input.entryTime !== undefined) payload.entry_time = input.entryTime?.trim() || null
  if (input.vehicleId !== undefined) payload.vehicle_id = input.vehicleId
  if (input.workerId !== undefined) payload.worker_id = input.workerId || null
  if (input.consumableType !== undefined) payload.consumable_type = input.consumableType
  if (input.itemName !== undefined) payload.item_name = input.itemName?.trim() || null
  if (input.quantity !== undefined) payload.quantity = input.quantity
  if (input.unit !== undefined) payload.unit = input.unit
  if (input.cost !== undefined) payload.cost = input.cost
  if (input.supplier !== undefined) payload.supplier = input.supplier?.trim() || null
  if (input.site !== undefined) payload.site = input.site?.trim() || null
  if (input.odometer !== undefined) payload.odometer = input.odometer
  if (input.receiptUrl !== undefined) payload.receipt_url = input.receiptUrl?.trim() || null
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null

  const { data, error } = await requireSupabase()
    .from('consumables')
    .update(payload)
    .eq('id', id)
    .is('deleted_at', null)
    .select(consumableSelect)
    .single()

  logSupabaseQuery({
    service: 'consumablesService.updateConsumable',
    table: 'consumables',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new ConsumablesServiceError(error.message)
  }

  const [item] = await mapConsumableRows([data as unknown as ConsumableRow])
  return item
}

export async function deleteConsumable(id: string, deleteReason?: string | null): Promise<void> {
  const deletedAt = new Date().toISOString()
  const payload = {
    deleted_at: deletedAt,
    deleted_by: null,
    delete_reason: deleteReason?.trim() || null,
    updated_at: deletedAt,
  }

  const { error } = await requireSupabase()
    .from('consumables')
    .update(payload)
    .eq('id', id)
    .is('deleted_at', null)

  logSupabaseQuery({
    service: 'consumablesService.deleteConsumable',
    table: 'consumables',
    data: null,
    error,
  })

  if (error) {
    throw new ConsumablesServiceError(error.message)
  }
}

export async function fetchConsumablesMonthlySummary(
  query: ConsumablesMonthlySummaryQuery,
): Promise<ConsumablesMonthlySummaryResult> {
  const { dateFrom, dateTo } = getMonthDateRange(query.year, query.month)

  let request = requireSupabase()
    .from('consumables')
    .select('consumable_type, quantity, unit, cost, vehicle_id, entry_date')
    .is('deleted_at', null)
    .gte('entry_date', dateFrom)
    .lte('entry_date', dateTo)

  if (query.type && query.type !== 'all') {
    request = request.eq('consumable_type', query.type)
  }

  if (query.vehicleId && query.vehicleId !== 'all') {
    request = request.eq('vehicle_id', query.vehicleId)
  }

  const { data, error } = await request.order('entry_date', { ascending: false })

  logSupabaseQuery({
    service: 'consumablesService.fetchConsumablesMonthlySummary',
    table: 'consumables',
    data,
    error,
  })

  if (error) {
    if (isMissingConsumablesTableError(error.message)) {
      return { records: [], vehicleLabels: {} }
    }
    throw new ConsumablesServiceError(error.message)
  }

  const rows = (data ?? []) as Array<{
    consumable_type: string
    quantity: number | string
    unit: string
    cost: number | string | null
    vehicle_id: string | null
    entry_date: string
  }>

  const vehicleIds = rows.map((row) => row.vehicle_id).filter((id): id is string => Boolean(id))
  const vehicleLabelMap = await fetchVehicleLabelMap(vehicleIds)

  const records = rows.map((row) => ({
    consumableType: isConsumableType(row.consumable_type) ? row.consumable_type : 'Other',
    unit: isConsumableUnit(row.unit) ? row.unit : 'L',
    quantity: Number(row.quantity) || 0,
    cost: row.cost === null || row.cost === undefined ? null : Number(row.cost),
    vehicleId: row.vehicle_id,
    entryDate: row.entry_date,
  }))

  return {
    records,
    vehicleLabels: Object.fromEntries(vehicleLabelMap.entries()),
  }
}

export const consumablesService = {
  fetchConsumables,
  fetchConsumablesForVehicle,
  fetchConsumableById,
  fetchConsumablesMonthlySummary,
  createConsumable,
  updateConsumable,
  deleteConsumable,
}

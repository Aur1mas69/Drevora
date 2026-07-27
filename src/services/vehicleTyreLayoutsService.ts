import { requireVerifiedCompanyId } from '@/lib/companySettingsGlobals'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import type { AxleWheelLayout, VehicleTyreLayout } from '@/lib/tyreCheckTypes'

export class VehicleTyreLayoutsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VehicleTyreLayoutsServiceError'
  }
}

function isMissingTableError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('vehicle_tyre_layouts') &&
    (normalized.includes('does not exist') ||
      normalized.includes('schema cache') ||
      normalized.includes('could not find the table'))
  )
}

function isValidAxleLayout(value: string): value is AxleWheelLayout {
  return value === 'single' || value === 'dual'
}

function mapRow(row: { vehicle_id: string; axle_count: number; axle_layouts: string[] }): VehicleTyreLayout {
  return {
    vehicleId: row.vehicle_id,
    axleCount: row.axle_count,
    axleLayouts: row.axle_layouts.filter(isValidAxleLayout),
  }
}

/**
 * Load the persisted default Single/Dual axle layout for one Vehicle
 * (truck or trailer). Returns null when nothing has been saved yet — callers
 * should fall back to the existing default layout resolvers in that case.
 */
export async function fetchVehicleTyreLayout(
  vehicleId: string,
): Promise<VehicleTyreLayout | null> {
  if (!vehicleId) return null
  const companyId = requireVerifiedCompanyId()

  const { data, error } = await requireSupabase()
    .from('vehicle_tyre_layouts')
    .select('vehicle_id, axle_count, axle_layouts')
    .eq('company_id', companyId)
    .eq('vehicle_id', vehicleId)
    .maybeSingle()

  logSupabaseQuery({
    service: 'vehicleTyreLayoutsService.fetchVehicleTyreLayout',
    table: 'vehicle_tyre_layouts',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    if (isMissingTableError(error.message)) return null
    throw new VehicleTyreLayoutsServiceError(error.message)
  }
  if (!data) return null

  return mapRow(data)
}

/**
 * Load persisted default layouts for several Vehicles in one request
 * (e.g. for an Admin Vehicle picker). Vehicles with no saved layout are
 * simply absent from the returned map.
 */
export async function fetchVehicleTyreLayouts(
  vehicleIds: string[],
): Promise<Map<string, VehicleTyreLayout>> {
  const ids = [...new Set(vehicleIds.filter(Boolean))]
  const result = new Map<string, VehicleTyreLayout>()
  if (ids.length === 0) return result

  const companyId = requireVerifiedCompanyId()
  const { data, error } = await requireSupabase()
    .from('vehicle_tyre_layouts')
    .select('vehicle_id, axle_count, axle_layouts')
    .eq('company_id', companyId)
    .in('vehicle_id', ids)

  logSupabaseQuery({
    service: 'vehicleTyreLayoutsService.fetchVehicleTyreLayouts',
    table: 'vehicle_tyre_layouts',
    data,
    error,
  })

  if (error) {
    if (isMissingTableError(error.message)) return result
    throw new VehicleTyreLayoutsServiceError(error.message)
  }

  for (const row of data ?? []) {
    const mapped = mapRow(row)
    result.set(mapped.vehicleId, mapped)
  }
  return result
}

/**
 * Save the default Single/Dual layout for one Vehicle via the
 * drevora_set_vehicle_tyre_layout RPC. Available to an active same-company
 * Worker or an Office/Admin user; never alters any existing Tyre Check.
 */
export async function saveVehicleTyreLayout(
  vehicleId: string,
  axleLayouts: AxleWheelLayout[],
): Promise<VehicleTyreLayout> {
  if (!vehicleId) {
    throw new VehicleTyreLayoutsServiceError('Vehicle is required.')
  }
  if (axleLayouts.length === 0) {
    throw new VehicleTyreLayoutsServiceError('At least one axle layout is required.')
  }

  const { data, error } = await requireSupabase().rpc('drevora_set_vehicle_tyre_layout', {
    p_vehicle_id: vehicleId,
    p_axle_layouts: axleLayouts,
  })

  logSupabaseQuery({
    service: 'vehicleTyreLayoutsService.saveVehicleTyreLayout',
    table: 'rpc:drevora_set_vehicle_tyre_layout',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    if (/function .*drevora_set_vehicle_tyre_layout/i.test(error.message ?? '')) {
      throw new VehicleTyreLayoutsServiceError(
        'Saving a default tyre layout is not available yet. Ask DREVORA support to apply the latest database migration.',
      )
    }
    throw new VehicleTyreLayoutsServiceError(
      error.message || 'Unable to save the default tyre layout.',
    )
  }

  const payload = data as { vehicle_id?: string; axle_count?: number; axle_layouts?: string[] } | null
  if (!payload?.vehicle_id || !payload.axle_count || !payload.axle_layouts) {
    return { vehicleId, axleCount: axleLayouts.length, axleLayouts }
  }

  return mapRow({
    vehicle_id: payload.vehicle_id,
    axle_count: payload.axle_count,
    axle_layouts: payload.axle_layouts,
  })
}

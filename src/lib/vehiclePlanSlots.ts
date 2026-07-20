import type { SubscriptionPlanDefinition } from '@/lib/subscriptionPlans'
import type { Vehicle } from '@/services/vehiclesService'

/** Maximum visual plan slots shown on one Vehicles grid page. */
export const VEHICLE_PLAN_SLOTS_PER_PAGE = 50

/**
 * Vehicles that occupy an active plan slot.
 * Archived Vehicles (`archived_at` set) do not occupy a seat.
 * Operational status (Available / Off Road / Maintenance / etc.) does not free a slot.
 */
export function isActiveVehicleForPlanSlot(vehicle: Vehicle): boolean {
  return vehicle.archivedAt == null
}

export function countActiveVehiclesForPlan(vehicles: Vehicle[]): number {
  return vehicles.filter(isActiveVehicleForPlanSlot).length
}

export type VehicleSlotItem =
  | { kind: 'vehicle'; key: string; vehicle: Vehicle }
  | { kind: 'available'; key: string; slotNumber: number }

export type VehicleSlotPageResult = {
  items: VehicleSlotItem[]
  page: number
  totalPages: number
  slotFrom: number
  slotTo: number
  totalSlots: number
  showingVehiclesOnly: boolean
}

/**
 * Build one page of Vehicle cards + available-slot fillers.
 * Real Vehicles appear first in the provided order; available slots follow.
 */
export function buildVehicleSlotPage(input: {
  vehicles: Vehicle[]
  allowance: number | null
  page: number
  /** When true (search/filters), show matching Vehicles only — no empty slots. */
  constrainToVehiclesOnly: boolean
}): VehicleSlotPageResult {
  const pageSize = VEHICLE_PLAN_SLOTS_PER_PAGE
  const safeRequestedPage = Math.max(1, input.page)

  if (input.constrainToVehiclesOnly || input.allowance == null) {
    const totalSlots = input.vehicles.length
    const totalPages = Math.max(1, Math.ceil(totalSlots / pageSize) || 1)
    const page = Math.min(safeRequestedPage, totalPages)
    const start = (page - 1) * pageSize
    const slice = input.vehicles.slice(start, start + pageSize)
    const items: VehicleSlotItem[] = slice.map((vehicle) => ({
      kind: 'vehicle',
      key: vehicle.id,
      vehicle,
    }))
    const slotFrom = totalSlots === 0 ? 0 : start + 1
    const slotTo = start + items.length
    return {
      items,
      page,
      totalPages,
      slotFrom,
      slotTo,
      totalSlots,
      showingVehiclesOnly: true,
    }
  }

  const allowance = input.allowance
  const activeCount = input.vehicles.length

  if (activeCount > allowance) {
    const totalSlots = activeCount
    const totalPages = Math.max(1, Math.ceil(totalSlots / pageSize))
    const page = Math.min(safeRequestedPage, totalPages)
    const start = (page - 1) * pageSize
    const slice = input.vehicles.slice(start, start + pageSize)
    return {
      items: slice.map((vehicle) => ({
        kind: 'vehicle' as const,
        key: vehicle.id,
        vehicle,
      })),
      page,
      totalPages,
      slotFrom: totalSlots === 0 ? 0 : start + 1,
      slotTo: start + slice.length,
      totalSlots,
      showingVehiclesOnly: true,
    }
  }

  const totalSlots = allowance
  const totalPages = Math.max(1, Math.ceil(totalSlots / pageSize))
  const page = Math.min(safeRequestedPage, totalPages)
  const start = (page - 1) * pageSize
  const end = Math.min(page * pageSize, totalSlots)
  const items: VehicleSlotItem[] = []

  for (let index = start; index < end; index += 1) {
    if (index < activeCount) {
      const vehicle = input.vehicles[index]
      items.push({ kind: 'vehicle', key: vehicle.id, vehicle })
    } else {
      const slotNumber = index + 1
      items.push({
        kind: 'available',
        key: `available-vehicle-slot-${slotNumber}`,
        slotNumber,
      })
    }
  }

  return {
    items,
    page,
    totalPages,
    slotFrom: totalSlots === 0 ? 0 : start + 1,
    slotTo: end,
    totalSlots,
    showingVehiclesOnly: false,
  }
}

export type VehiclePlanUsageView = {
  planDisplayName: string | null
  activeCount: number
  allowance: number | null
  availableCount: number
  overCount: number
  state: 'normal' | 'at_limit' | 'over' | 'unknown'
}

export function buildVehiclePlanUsageView(input: {
  plan: SubscriptionPlanDefinition | null
  activeCount: number
}): VehiclePlanUsageView {
  if (!input.plan) {
    return {
      planDisplayName: null,
      activeCount: input.activeCount,
      allowance: null,
      availableCount: 0,
      overCount: 0,
      state: 'unknown',
    }
  }

  const allowance = input.plan.vehicleLimit
  const overCount = Math.max(0, input.activeCount - allowance)
  const availableCount = Math.max(0, allowance - input.activeCount)

  let state: VehiclePlanUsageView['state'] = 'normal'
  if (overCount > 0) state = 'over'
  else if (availableCount === 0) state = 'at_limit'

  return {
    planDisplayName: input.plan.displayName,
    activeCount: input.activeCount,
    allowance,
    availableCount,
    overCount,
    state,
  }
}

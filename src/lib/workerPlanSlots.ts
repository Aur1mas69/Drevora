import type { Driver } from '@/services/driversService'
import type { SubscriptionPlanDefinition } from '@/lib/subscriptionPlans'

/** Maximum visual plan slots shown on one Workers page. */
export const WORKER_PLAN_SLOTS_PER_PAGE = 50

/**
 * Workers that occupy an active plan slot.
 * Archived Workers (`archived_at` set) do not occupy a seat.
 * Duty status (Working / Off Duty / Holiday / Suspended) does not free a slot.
 */
export function isActiveWorkerForPlanSlot(driver: Driver): boolean {
  return driver.archivedAt == null
}

export function countActiveWorkersForPlan(drivers: Driver[]): number {
  return drivers.filter(isActiveWorkerForPlanSlot).length
}

export type WorkerSlotItem =
  | { kind: 'worker'; key: string; driver: Driver }
  | { kind: 'available'; key: string; slotNumber: number }

export type WorkerSlotPageResult = {
  items: WorkerSlotItem[]
  page: number
  totalPages: number
  slotFrom: number
  slotTo: number
  totalSlots: number
  showingWorkersOnly: boolean
}

/**
 * Build one page of Worker cards + available-slot fillers.
 * Real Workers appear first in the provided order; available slots follow.
 */
export function buildWorkerSlotPage(input: {
  workers: Driver[]
  allowance: number | null
  page: number
  /** When true (search/filters), show matching Workers only — no empty slots. */
  constrainToWorkersOnly: boolean
}): WorkerSlotPageResult {
  const pageSize = WORKER_PLAN_SLOTS_PER_PAGE
  const safeRequestedPage = Math.max(1, input.page)

  if (input.constrainToWorkersOnly || input.allowance == null) {
    const totalSlots = input.workers.length
    const totalPages = Math.max(1, Math.ceil(totalSlots / pageSize) || 1)
    const page = Math.min(safeRequestedPage, totalPages)
    const start = (page - 1) * pageSize
    const slice = input.workers.slice(start, start + pageSize)
    const items: WorkerSlotItem[] = slice.map((driver) => ({
      kind: 'worker',
      key: driver.id,
      driver,
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
      showingWorkersOnly: true,
    }
  }

  const allowance = input.allowance
  const activeCount = input.workers.length

  // Over allowance: never hide Workers; no available-slot fillers.
  if (activeCount > allowance) {
    const totalSlots = activeCount
    const totalPages = Math.max(1, Math.ceil(totalSlots / pageSize))
    const page = Math.min(safeRequestedPage, totalPages)
    const start = (page - 1) * pageSize
    const slice = input.workers.slice(start, start + pageSize)
    return {
      items: slice.map((driver) => ({
        kind: 'worker' as const,
        key: driver.id,
        driver,
      })),
      page,
      totalPages,
      slotFrom: totalSlots === 0 ? 0 : start + 1,
      slotTo: start + slice.length,
      totalSlots,
      showingWorkersOnly: true,
    }
  }

  const totalSlots = allowance
  const totalPages = Math.max(1, Math.ceil(totalSlots / pageSize))
  const page = Math.min(safeRequestedPage, totalPages)
  const start = (page - 1) * pageSize
  const end = Math.min(page * pageSize, totalSlots)
  const items: WorkerSlotItem[] = []

  for (let index = start; index < end; index += 1) {
    if (index < activeCount) {
      const driver = input.workers[index]
      items.push({ kind: 'worker', key: driver.id, driver })
    } else {
      const slotNumber = index + 1
      items.push({
        kind: 'available',
        key: `available-slot-${slotNumber}`,
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
    showingWorkersOnly: false,
  }
}

export type WorkerPlanUsageView = {
  planDisplayName: string | null
  activeCount: number
  allowance: number | null
  availableCount: number
  overCount: number
  state: 'normal' | 'at_limit' | 'over' | 'unknown'
}

export function buildWorkerPlanUsageView(input: {
  plan: SubscriptionPlanDefinition | null
  activeCount: number
}): WorkerPlanUsageView {
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

  const allowance = input.plan.activeWorkerLimit
  const overCount = Math.max(0, input.activeCount - allowance)
  const availableCount = Math.max(0, allowance - input.activeCount)

  let state: WorkerPlanUsageView['state'] = 'normal'
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

import type { CompanyPlanRecord } from '@/services/companyPlanService'
import {
  buildVehiclePlanUsageView,
  countActiveVehiclesForPlan,
  type VehiclePlanUsageView,
} from '@/lib/vehiclePlanSlots'
import type { Vehicle } from '@/services/vehiclesService'

export const VEHICLE_PLAN_LIMIT_REACHED = 'VEHICLE_PLAN_LIMIT_REACHED'
export const VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE = 'VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE'

export type VehicleAllowanceSnapshot = VehiclePlanUsageView & {
  planCode: CompanyPlanRecord['planCode']
  canAddVehicle: boolean
  title: string
  detail: string | null
  countLabel: string | null
}

/**
 * Shared Grid/List allowance snapshot.
 * Always count from the full company Vehicle set — never from search/filter results.
 */
export function buildVehicleAllowanceSnapshot(input: {
  vehicles: Vehicle[]
  plan: CompanyPlanRecord | null
}): VehicleAllowanceSnapshot {
  const activeCount = countActiveVehiclesForPlan(input.vehicles)
  const usage = buildVehiclePlanUsageView({
    plan: input.plan?.definition ?? null,
    activeCount,
  })

  const planCode = input.plan?.planCode ?? null

  if (planCode === 'custom') {
    return {
      ...usage,
      planDisplayName: 'Custom Fleet',
      planCode,
      state: 'unknown',
      allowance: null,
      availableCount: 0,
      overCount: 0,
      canAddVehicle: false,
      title: 'Custom Vehicle allowance not configured',
      detail:
        'Custom Fleet Vehicle limit enforcement is not yet available. Contact DREVORA support before adding Vehicles.',
      countLabel: `${activeCount} active Vehicles`,
    }
  }

  if (usage.state === 'unknown' || usage.allowance == null) {
    return {
      ...usage,
      planCode,
      canAddVehicle: false,
      title: 'Vehicle allowance unavailable',
      detail:
        'Assign a valid company plan before adding Vehicles. Existing Vehicle records remain available.',
      countLabel: `${activeCount} active Vehicles`,
    }
  }

  if (usage.state === 'over') {
    return {
      ...usage,
      planCode,
      canAddVehicle: false,
      title: 'Vehicle allowance reached',
      detail: `${usage.activeCount} / ${usage.allowance} Vehicles · ${usage.overCount} Vehicle${usage.overCount === 1 ? '' : 's'} over the current allowance. Archive an inactive Vehicle or change the company plan to add another Vehicle.`,
      countLabel: `${usage.activeCount} / ${usage.allowance} Vehicles`,
    }
  }

  if (usage.state === 'at_limit') {
    return {
      ...usage,
      planCode,
      canAddVehicle: false,
      title: 'Vehicle allowance reached',
      detail:
        'Archive an inactive Vehicle or change the company plan to add another Vehicle.',
      countLabel: `${usage.activeCount} / ${usage.allowance} Vehicles · Vehicle allowance reached`,
    }
  }

  return {
    ...usage,
    planCode,
    canAddVehicle: true,
    title: '',
    detail: null,
    countLabel: `${usage.activeCount} / ${usage.allowance} Vehicles`,
  }
}

export function isVehiclePlanLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toUpperCase()
  const code =
    'code' in error && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code.toUpperCase()
      : ''
  return (
    code === VEHICLE_PLAN_LIMIT_REACHED ||
    code === VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE ||
    message.includes(VEHICLE_PLAN_LIMIT_REACHED) ||
    message.includes(VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE)
  )
}

export function formatVehiclePlanLimitError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Vehicle allowance reached. Archive an inactive Vehicle or change the company plan to add another Vehicle.'
  }

  const blob = `${error.message} ${'code' in error ? String((error as { code?: unknown }).code ?? '') : ''}`.toUpperCase()

  if (blob.includes(VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE)) {
    if (blob.includes('CUSTOM')) {
      return 'Custom Vehicle allowance not configured. Contact DREVORA support before adding Vehicles.'
    }
    return 'Vehicle allowance unavailable. Assign a valid company plan before adding Vehicles.'
  }

  return 'Vehicle allowance reached. Archive an inactive Vehicle or change the company plan to add another Vehicle.'
}

import type { CompanyPlanRecord } from '@/services/companyPlanService'
import {
  formatSubscriptionExpiredMessage,
  isSubscriptionPlanExpiredError,
  resolveSubscriptionEntitlement,
  SUBSCRIPTION_PLAN_EXPIRED,
} from '@/lib/subscriptionEntitlement'
import {
  buildVehiclePlanUsageView,
  countActiveVehiclesForPlan,
  type VehiclePlanUsageView,
} from '@/lib/vehiclePlanSlots'
import type { Vehicle } from '@/services/vehiclesService'

export const VEHICLE_PLAN_LIMIT_REACHED = 'VEHICLE_PLAN_LIMIT_REACHED'
export const VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE = 'VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE'
export { SUBSCRIPTION_PLAN_EXPIRED }

export type VehicleAllowanceBlockReason =
  | 'expired'
  | 'limit'
  | 'unavailable'
  | 'custom'
  | null

export type VehicleAllowanceSnapshot = VehiclePlanUsageView & {
  planCode: CompanyPlanRecord['planCode']
  canAddVehicle: boolean
  blockReason: VehicleAllowanceBlockReason
  title: string
  detail: string | null
  countLabel: string | null
}

function formatExpiryDateLabel(validUntil: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(validUntil)
}

/**
 * Shared Grid/List allowance snapshot.
 * Always count from the full company Vehicle set — never from search/filter results.
 * Expiry is resolved centrally via resolveSubscriptionEntitlement.
 */
export function buildVehicleAllowanceSnapshot(input: {
  vehicles: Vehicle[]
  plan: CompanyPlanRecord | null
  now?: Date
}): VehicleAllowanceSnapshot {
  const activeCount = countActiveVehiclesForPlan(input.vehicles)
  const usage = buildVehiclePlanUsageView({
    plan: input.plan?.definition ?? null,
    activeCount,
  })

  const planCode = input.plan?.planCode ?? null
  const entitlement = resolveSubscriptionEntitlement(input.plan, input.now)

  if (entitlement.isExpired && entitlement.validUntilDate) {
    const expiryLabel = formatExpiryDateLabel(entitlement.validUntilDate)
    return {
      ...usage,
      planCode,
      canAddVehicle: false,
      blockReason: 'expired',
      title: 'Trial expired',
      detail: formatSubscriptionExpiredMessage(expiryLabel),
      countLabel: `${activeCount} active Vehicles`,
    }
  }

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
      blockReason: 'custom',
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
      blockReason: 'unavailable',
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
      blockReason: 'limit',
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
      blockReason: 'limit',
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
    blockReason: null,
    title: '',
    detail: null,
    countLabel: `${usage.activeCount} / ${usage.allowance} Vehicles`,
  }
}

export function isVehiclePlanLimitError(error: unknown): boolean {
  if (isSubscriptionPlanExpiredError(error)) return true
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
  if (isSubscriptionPlanExpiredError(error)) {
    if (error instanceof Error) {
      const hintMatch = error.message.match(/Your trial expired on [^.]+\./i)
      if (hintMatch) {
        return `${hintMatch[0]} Existing records remain available. Contact DREVORA to renew your plan.`
      }
      if (error.message.includes('Existing records remain available')) {
        return error.message
      }
    }
    return 'Your trial has expired. Existing records remain available. Contact DREVORA to renew your plan.'
  }

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

import type { CompanyPlanRecord } from '@/services/companyPlanService'
import {
  formatSubscriptionExpiredMessage,
  isSubscriptionPlanExpiredError,
  resolveSubscriptionEntitlement,
  SUBSCRIPTION_PLAN_EXPIRED,
} from '@/lib/subscriptionEntitlement'
import {
  buildWorkerPlanUsageView,
  countActiveWorkersForPlan,
  type WorkerPlanUsageView,
} from '@/lib/workerPlanSlots'
import type { Driver } from '@/services/driversService'

export const WORKER_PLAN_LIMIT_REACHED = 'WORKER_PLAN_LIMIT_REACHED'
export const WORKER_PLAN_ALLOWANCE_UNAVAILABLE = 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
export { SUBSCRIPTION_PLAN_EXPIRED }

export type WorkerAllowanceBlockReason =
  | 'expired'
  | 'limit'
  | 'unavailable'
  | 'custom'
  | null

export type WorkerAllowanceSnapshot = WorkerPlanUsageView & {
  planCode: CompanyPlanRecord['planCode']
  canAddWorker: boolean
  blockReason: WorkerAllowanceBlockReason
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
 * Always count from the full company Worker set — never from search/filter results.
 * Expiry is resolved centrally via resolveSubscriptionEntitlement.
 */
export function buildWorkerAllowanceSnapshot(input: {
  drivers: Driver[]
  plan: CompanyPlanRecord | null
  now?: Date
}): WorkerAllowanceSnapshot {
  const activeCount = countActiveWorkersForPlan(input.drivers)
  const usage = buildWorkerPlanUsageView({
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
      canAddWorker: false,
      blockReason: 'expired',
      title: 'Trial expired',
      detail: formatSubscriptionExpiredMessage(expiryLabel),
      countLabel: `${activeCount} active Workers`,
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
      canAddWorker: false,
      blockReason: 'custom',
      title: 'Worker allowance unavailable',
      detail:
        'Custom Fleet Worker limit enforcement is not yet available. Contact DREVORA support before adding Workers.',
      countLabel: `${activeCount} active Workers`,
    }
  }

  if (usage.state === 'unknown' || usage.allowance == null) {
    return {
      ...usage,
      planCode,
      canAddWorker: false,
      blockReason: 'unavailable',
      title: 'Worker allowance unavailable',
      detail:
        'Assign a valid company plan before adding Workers. Existing Worker records remain available.',
      countLabel: `${activeCount} active Workers`,
    }
  }

  if (usage.state === 'over') {
    return {
      ...usage,
      planCode,
      canAddWorker: false,
      blockReason: 'limit',
      title: 'Worker allowance reached',
      detail: `This company is ${usage.overCount} Worker${usage.overCount === 1 ? '' : 's'} over the plan limit. Archive an inactive Worker or change the company plan to add another Worker.`,
      countLabel: `${usage.activeCount} / ${usage.allowance} active Workers`,
    }
  }

  if (usage.state === 'at_limit') {
    return {
      ...usage,
      planCode,
      canAddWorker: false,
      blockReason: 'limit',
      title: 'Worker allowance reached',
      detail:
        'Archive an inactive Worker or change the company plan to add another Worker.',
      countLabel: `${usage.activeCount} / ${usage.allowance} active Workers`,
    }
  }

  return {
    ...usage,
    planCode,
    canAddWorker: true,
    blockReason: null,
    title: '',
    detail: null,
    countLabel:
      usage.allowance != null
        ? `${usage.activeCount} / ${usage.allowance} active Workers`
        : `${usage.activeCount} active Workers`,
  }
}

export function isWorkerPlanLimitError(error: unknown): boolean {
  if (isSubscriptionPlanExpiredError(error)) return true
  if (!(error instanceof Error)) return false
  const message = error.message.toUpperCase()
  const code =
    'code' in error && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code.toUpperCase()
      : ''
  return (
    code === WORKER_PLAN_LIMIT_REACHED ||
    code === WORKER_PLAN_ALLOWANCE_UNAVAILABLE ||
    message.includes(WORKER_PLAN_LIMIT_REACHED) ||
    message.includes(WORKER_PLAN_ALLOWANCE_UNAVAILABLE)
  )
}

export function formatWorkerPlanLimitError(error: unknown): string {
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
    return 'Worker allowance reached. Archive an inactive Worker or change the company plan to add another Worker.'
  }

  const blob = `${error.message} ${'code' in error ? String((error as { code?: unknown }).code ?? '') : ''}`.toUpperCase()

  if (blob.includes(WORKER_PLAN_ALLOWANCE_UNAVAILABLE)) {
    if (blob.includes('CUSTOM')) {
      return 'Custom Fleet Worker limit enforcement is not yet available. Contact DREVORA support before adding Workers.'
    }
    return 'Worker allowance unavailable. Assign a valid company plan before adding Workers.'
  }

  return 'Worker allowance reached. Archive an inactive Worker or change the company plan to add another Worker.'
}

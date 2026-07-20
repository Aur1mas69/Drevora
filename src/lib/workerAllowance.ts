import type { CompanyPlanRecord } from '@/services/companyPlanService'
import {
  buildWorkerPlanUsageView,
  countActiveWorkersForPlan,
  type WorkerPlanUsageView,
} from '@/lib/workerPlanSlots'
import type { Driver } from '@/services/driversService'

export const WORKER_PLAN_LIMIT_REACHED = 'WORKER_PLAN_LIMIT_REACHED'
export const WORKER_PLAN_ALLOWANCE_UNAVAILABLE = 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'

export type WorkerAllowanceSnapshot = WorkerPlanUsageView & {
  planCode: CompanyPlanRecord['planCode']
  canAddWorker: boolean
  title: string
  detail: string | null
  countLabel: string | null
}

/**
 * Shared Grid/List allowance snapshot.
 * Always count from the full company Worker set — never from search/filter results.
 */
export function buildWorkerAllowanceSnapshot(input: {
  drivers: Driver[]
  plan: CompanyPlanRecord | null
}): WorkerAllowanceSnapshot {
  const activeCount = countActiveWorkersForPlan(input.drivers)
  const usage = buildWorkerPlanUsageView({
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
      canAddWorker: false,
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
    title: '',
    detail: null,
    countLabel:
      usage.allowance != null
        ? `${usage.activeCount} / ${usage.allowance} active Workers`
        : `${usage.activeCount} active Workers`,
  }
}

export function isWorkerPlanLimitError(error: unknown): boolean {
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

import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  formatPlanVehicleLimit,
  formatPlanWorkerLimit,
} from '@/lib/subscriptionPlans'
import {
  resolveSubscriptionEntitlement,
  type SubscriptionEntitlement,
} from '@/lib/subscriptionEntitlement'
import {
  fetchCompanyPlan,
  type CompanyPlanRecord,
} from '@/services/companyPlanService'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

function statusLabel(
  plan: CompanyPlanRecord,
  entitlement: SubscriptionEntitlement,
): string {
  if (entitlement.lifecycleState === 'expired') {
    return 'Expired'
  }
  if (plan.subscriptionStatus === 'trial') {
    return 'Trial'
  }
  if (plan.planCode === 'custom') {
    return 'Custom'
  }
  if (plan.planCode) {
    return 'Active plan'
  }
  return 'Not set'
}

function daysRemainingLabel(days: number | null): string {
  if (days == null) return 'No expiry date set'
  if (days === 0) return '0 days'
  if (days === 1) return '1 day'
  return `${days} days`
}

export function SettingsPlanSummary({ companyId }: { companyId: string }) {
  const { formatDate } = useCompanySettings()
  const [plan, setPlan] = useState<CompanyPlanRecord | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'unavailable'>(
    'loading',
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadState('loading')
      try {
        const record = await fetchCompanyPlan(companyId)
        if (cancelled) return
        setPlan(record)
        setLoadState(record == null ? 'unavailable' : 'ready')
      } catch {
        if (!cancelled) {
          setPlan(null)
          setLoadState('unavailable')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [companyId])

  if (loadState === 'loading') {
    return (
      <div className="rounded-[16px] bg-[#F8FBFF] px-4 py-3 text-sm text-slate-500 ring-1 ring-blue-100">
        Loading plan…
      </div>
    )
  }

  if (loadState === 'unavailable' || !plan?.planCode) {
    return (
      <div className="rounded-[16px] bg-[#F8FBFF] px-4 py-3 text-sm text-slate-500 ring-1 ring-blue-100">
        No subscription plan is stored for this company yet.
      </div>
    )
  }

  const entitlement = resolveSubscriptionEntitlement(plan)
  const expired = entitlement.lifecycleState === 'expired'
  const displayName =
    plan.definition?.displayName ??
    (plan.planCode === 'custom' ? 'Custom Fleet' : plan.planCode)

  const validUntilDisplay =
    entitlement.validUntilDate != null
      ? formatDate(entitlement.validUntilDate)
      : 'No expiry date set'

  return (
    <div
      className={cn(
        'rounded-[16px] px-4 py-4 ring-1',
        expired
          ? 'bg-rose-50 ring-rose-200 dark:bg-rose-950/40 dark:ring-rose-900'
          : 'bg-[#F8FBFF] ring-blue-100',
      )}
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt
            className={cn(
              'text-xs font-semibold uppercase tracking-[0.12em]',
              expired ? 'text-rose-500' : 'text-[#5499BF]',
            )}
          >
            Current plan
          </dt>
          <dd
            className={cn(
              'mt-1 text-sm font-semibold',
              expired ? 'text-rose-900 dark:text-rose-100' : 'text-[#113C69]',
            )}
          >
            {displayName}
          </dd>
        </div>
        <div>
          <dt
            className={cn(
              'text-xs font-semibold uppercase tracking-[0.12em]',
              expired ? 'text-rose-500' : 'text-[#5499BF]',
            )}
          >
            Status
          </dt>
          <dd
            className={cn(
              'mt-1 text-sm font-medium',
              expired
                ? 'font-semibold text-rose-700 dark:text-rose-200'
                : 'text-[#113C69]',
            )}
          >
            {statusLabel(plan, entitlement)}
          </dd>
        </div>

        <div>
          <dt
            className={cn(
              'text-xs font-semibold uppercase tracking-[0.12em]',
              expired ? 'text-rose-500' : 'text-[#5499BF]',
            )}
          >
            Valid until
          </dt>
          <dd
            className={cn(
              'mt-1 text-sm',
              expired ? 'font-semibold text-rose-800 dark:text-rose-100' : 'text-[#113C69]',
            )}
          >
            {validUntilDisplay}
          </dd>
        </div>
        <div>
          <dt
            className={cn(
              'text-xs font-semibold uppercase tracking-[0.12em]',
              expired ? 'text-rose-500' : 'text-[#5499BF]',
            )}
          >
            Days remaining
          </dt>
          <dd
            className={cn(
              'mt-1 text-sm',
              expired ? 'text-rose-800 dark:text-rose-100' : 'text-[#113C69]',
            )}
          >
            {daysRemainingLabel(entitlement.daysRemaining)}
          </dd>
        </div>

        {plan.definition ? (
          <>
            <div>
              <dt
                className={cn(
                  'text-xs font-semibold uppercase tracking-[0.12em]',
                  expired ? 'text-rose-500' : 'text-[#5499BF]',
                )}
              >
                Vehicle allowance
              </dt>
              <dd
                className={cn(
                  'mt-1 text-sm',
                  expired ? 'text-rose-900 dark:text-rose-100' : 'text-[#113C69]',
                )}
              >
                {formatPlanVehicleLimit(plan.definition)}
              </dd>
            </div>
            <div>
              <dt
                className={cn(
                  'text-xs font-semibold uppercase tracking-[0.12em]',
                  expired ? 'text-rose-500' : 'text-[#5499BF]',
                )}
              >
                Active Worker allowance
              </dt>
              <dd
                className={cn(
                  'mt-1 text-sm',
                  expired ? 'text-rose-900 dark:text-rose-100' : 'text-[#113C69]',
                )}
              >
                {formatPlanWorkerLimit(plan.definition)}
              </dd>
            </div>
          </>
        ) : (
          <div className="sm:col-span-2">
            <dt
              className={cn(
                'text-xs font-semibold uppercase tracking-[0.12em]',
                expired ? 'text-rose-500' : 'text-[#5499BF]',
              )}
            >
              Allowances
            </dt>
            <dd
              className={cn(
                'mt-1 text-sm',
                expired ? 'text-rose-900 dark:text-rose-100' : 'text-[#113C69]',
              )}
            >
              Custom vehicle and Worker limits — contact DREVORA support.
            </dd>
          </div>
        )}
      </dl>
      {expired ? (
        <p className="mt-3 text-xs leading-5 text-rose-700 dark:text-rose-200">
          Existing Vehicles and Workers remain available. Contact DREVORA to renew
          your plan before adding new records.
        </p>
      ) : (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Read-only. Payment setup and plan changes are handled separately.
        </p>
      )}
    </div>
  )
}

import {
  formatPlanVehicleLimit,
  formatPlanWorkerLimit,
} from '@/lib/subscriptionPlans'
import {
  fetchCompanyPlan,
  type CompanyPlanRecord,
} from '@/services/companyPlanService'
import { useEffect, useState } from 'react'

function statusLabel(plan: CompanyPlanRecord): string {
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

export function SettingsPlanSummary({ companyId }: { companyId: string }) {
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
        setLoadState(record ? 'ready' : 'unavailable')
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

  const displayName =
    plan.definition?.displayName ??
    (plan.planCode === 'custom' ? 'Custom Fleet' : plan.planCode)

  return (
    <div className="rounded-[16px] bg-[#F8FBFF] px-4 py-4 ring-1 ring-blue-100">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
            Current plan
          </dt>
          <dd className="mt-1 text-sm font-semibold text-[#113C69]">{displayName}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
            Status
          </dt>
          <dd className="mt-1 text-sm font-medium text-[#113C69]">{statusLabel(plan)}</dd>
        </div>
        {plan.definition ? (
          <>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
                Vehicle allowance
              </dt>
              <dd className="mt-1 text-sm text-[#113C69]">
                {formatPlanVehicleLimit(plan.definition)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
                Active Worker allowance
              </dt>
              <dd className="mt-1 text-sm text-[#113C69]">
                {formatPlanWorkerLimit(plan.definition)}
              </dd>
            </div>
          </>
        ) : (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
              Allowances
            </dt>
            <dd className="mt-1 text-sm text-[#113C69]">
              Custom vehicle and Worker limits — contact DREVORA support.
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Read-only. Payment setup and plan changes are handled separately.
      </p>
    </div>
  )
}

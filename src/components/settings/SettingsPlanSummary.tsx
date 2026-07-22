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
import { CalendarDays, Car, Timer, Users } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

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

type StatusTone = 'trial' | 'active' | 'expired' | 'custom' | 'neutral'

function resolveStatusTone(
  plan: CompanyPlanRecord,
  entitlement: SubscriptionEntitlement,
): StatusTone {
  if (entitlement.lifecycleState === 'expired') return 'expired'
  if (plan.subscriptionStatus === 'trial') return 'trial'
  if (plan.planCode === 'custom') return 'custom'
  if (plan.planCode) return 'active'
  return 'neutral'
}

const STATUS_BADGE_CLASS: Record<StatusTone, string> = {
  trial: 'bg-amber-300/95 text-amber-950 ring-1 ring-amber-200/80',
  active: 'bg-emerald-300/95 text-emerald-950 ring-1 ring-emerald-200/70',
  expired: 'bg-rose-300/95 text-rose-950 ring-1 ring-rose-200/80',
  custom: 'bg-sky-300/95 text-sky-950 ring-1 ring-sky-200/80',
  neutral: 'bg-white/90 text-slate-800 ring-1 ring-white/50',
}

function SubscriptionStatusBadge({
  label,
  tone,
}: {
  label: string
  tone: StatusTone
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.02em]',
        STATUS_BADGE_CLASS[tone],
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          tone === 'trial' && 'bg-amber-800',
          tone === 'active' && 'bg-emerald-800',
          tone === 'expired' && 'bg-rose-800',
          tone === 'custom' && 'bg-sky-800',
          tone === 'neutral' && 'bg-slate-500',
        )}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}

function DetailCell({
  label,
  value,
  helper,
  icon,
  emphasize,
  danger,
}: {
  label: string
  value: ReactNode
  helper?: string
  icon: ReactNode
  emphasize?: boolean
  danger?: boolean
}) {
  return (
    <div
      className={cn(
        'relative flex min-h-[5.5rem] flex-col justify-between rounded-2xl border px-3.5 py-3',
        danger
          ? 'border-rose-200/80 bg-rose-50/80'
          : 'border-[#D4E7F7] bg-white/80',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'text-[10px] font-semibold uppercase tracking-[0.12em]',
            danger ? 'text-rose-500' : 'text-[#5B7FA3]',
          )}
        >
          {label}
        </p>
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-lg',
            danger
              ? 'bg-rose-100 text-rose-600'
              : 'bg-[#EAF4FF] text-[#3B6FE0]',
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <div className="mt-2">
        <p
          className={cn(
            'font-semibold tracking-[-0.02em]',
            emphasize ? 'text-xl tabular-nums sm:text-2xl' : 'text-base sm:text-lg',
            danger ? 'text-rose-900' : 'text-[#123A6B]',
          )}
        >
          {value}
        </p>
        {helper ? (
          <p className={cn('mt-0.5 text-xs', danger ? 'text-rose-600/80' : 'text-[#6B8AAB]')}>
            {helper}
          </p>
        ) : null}
      </div>
    </div>
  )
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
      <div className="rounded-[20px] border border-[#C8DFF5] bg-[#F8FBFF] px-4 py-4 text-sm text-slate-500">
        Loading plan…
      </div>
    )
  }

  if (loadState === 'unavailable' || !plan?.planCode) {
    return (
      <div className="rounded-[20px] border border-[#C8DFF5] bg-[#F8FBFF] px-4 py-4 text-sm text-slate-500">
        No subscription plan is stored for this company yet.
      </div>
    )
  }

  const entitlement = resolveSubscriptionEntitlement(plan)
  const expired = entitlement.lifecycleState === 'expired'
  const statusTone = resolveStatusTone(plan, entitlement)
  const statusText = statusLabel(plan, entitlement)
  const displayName =
    plan.definition?.displayName ??
    (plan.planCode === 'custom' ? 'Custom Fleet' : plan.planCode)

  const validUntilDisplay =
    entitlement.validUntilDate != null
      ? formatDate(entitlement.validUntilDate)
      : 'No expiry date set'

  const daysRemaining = entitlement.daysRemaining
  const daysValue =
    daysRemaining == null ? (
      'No expiry date set'
    ) : (
      <span className="inline-flex items-baseline gap-1.5">
        <span>{daysRemaining}</span>
        {daysRemaining > 0 ? (
          <span
            className={cn(
              'text-sm font-medium',
              expired ? 'text-rose-600/80' : 'text-[#6B8AAB]',
            )}
          >
            {daysRemaining === 1 ? 'day remaining' : 'days remaining'}
          </span>
        ) : null}
      </span>
    )

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)] lg:items-stretch">
        {/* Featured plan membership card */}
        <article
          className={cn(
            'relative overflow-hidden rounded-[24px] p-5 shadow-[0_18px_40px_rgba(6,78,59,0.28),0_6px_16px_rgba(15,23,42,0.08)] sm:p-6',
            expired
              ? 'bg-[linear-gradient(155deg,#7F1D1D_0%,#9F1239_45%,#BE123C_100%)]'
              : 'bg-[linear-gradient(155deg,#064E3B_0%,#0F766E_42%,#115E59_100%)]',
          )}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-16 left-1/3 size-48 rounded-full bg-emerald-300/15 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/30"
            aria-hidden="true"
          />

          <div className="relative flex h-full min-h-[12.5rem] flex-col">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100/85">
                Current plan
              </p>
              <SubscriptionStatusBadge label={statusText} tone={statusTone} />
            </div>

            <h3
              className={cn(
                'mt-5 text-[1.85rem] font-semibold leading-[1.1] tracking-[-0.04em] text-white sm:text-[2.15rem]',
                expired && 'text-rose-50',
              )}
            >
              {displayName}
            </h3>

            <p className="mt-3 max-w-[18rem] text-sm leading-6 text-emerald-50/80">
              {expired
                ? 'This subscription has expired. Renew to restore create limits.'
                : 'Your company membership for fleet operations and active workers.'}
            </p>

            <div className="mt-auto flex items-center gap-2 pt-6">
              <span className="h-1.5 w-8 rounded-full bg-white/70" aria-hidden="true" />
              <span className="h-1.5 w-3 rounded-full bg-white/35" aria-hidden="true" />
              <span className="text-xs font-medium tracking-[0.04em] text-emerald-50/70">
                DREVORA subscription
              </span>
            </div>
          </div>
        </article>

        {/* Supporting details panel */}
        <aside
          className={cn(
            'rounded-[24px] border p-3.5 shadow-[0_10px_28px_rgba(30,64,175,0.08)] sm:p-4',
            expired
              ? 'border-rose-200/80 bg-[linear-gradient(160deg,#FFF8F8_0%,#FFF1F2_100%)]'
              : 'border-[#C6DFF4] bg-[linear-gradient(160deg,#F8FBFF_0%,#EEF6FF_55%,#E7F2FF_100%)]',
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-2 px-0.5">
            <div>
              <p
                className={cn(
                  'text-[11px] font-semibold uppercase tracking-[0.12em]',
                  expired ? 'text-rose-500' : 'text-[#5B7FA3]',
                )}
              >
                Subscription details
              </p>
              <p
                className={cn(
                  'mt-0.5 text-sm font-semibold',
                  expired ? 'text-rose-900' : 'text-[#123A6B]',
                )}
              >
                Validity and allowances
              </p>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <DetailCell
              label="Valid until"
              value={validUntilDisplay}
              icon={<CalendarDays className="size-3.5" strokeWidth={2.1} />}
              danger={expired}
            />
            <DetailCell
              label="Days remaining"
              value={daysValue}
              helper={daysRemaining === 0 ? 'Plan expired' : undefined}
              icon={<Timer className="size-3.5" strokeWidth={2.1} />}
              emphasize={daysRemaining != null}
              danger={expired}
            />

            {plan.definition ? (
              <>
                <DetailCell
                  label="Vehicle allowance"
                  value={formatPlanVehicleLimit(plan.definition)}
                  icon={<Car className="size-3.5" strokeWidth={2.1} />}
                  danger={expired}
                />
                <DetailCell
                  label="Active worker allowance"
                  value={formatPlanWorkerLimit(plan.definition)}
                  icon={<Users className="size-3.5" strokeWidth={2.1} />}
                  danger={expired}
                />
              </>
            ) : (
              <div
                className={cn(
                  'sm:col-span-2 rounded-2xl border px-3.5 py-3 text-sm leading-6',
                  expired
                    ? 'border-rose-200/80 bg-rose-50/80 text-rose-900'
                    : 'border-[#D4E7F7] bg-white/80 text-[#123A6B]',
                )}
              >
                Custom vehicle and Worker limits — contact DREVORA support.
              </div>
            )}
          </div>
        </aside>
      </div>

      {expired ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-3.5 py-2.5 text-xs leading-5 text-rose-700">
          Existing Vehicles and Workers remain available. Contact DREVORA to renew
          your plan before adding new records.
        </p>
      ) : (
        <p className="px-0.5 text-xs leading-5 text-slate-500">
          Read-only. Payment setup and plan changes are handled separately.
        </p>
      )}
    </div>
  )
}

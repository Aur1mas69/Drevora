import { formatConsumableCost, formatSummaryQuantity } from '@/lib/consumableUtils'
import type { DashboardConsumablesOverview } from '@/services/dashboardService'
import { dashboardOverviewCardClass } from '@/components/dashboard/dashboardOverviewCardStyles'
import { DashboardOverviewCardHeader } from '@/components/dashboard/DashboardOverviewCardHeader'
import { Droplets } from 'lucide-react'

const MAX_USAGE_ROWS = 5

function CompactKpiStrip({ overview }: { overview: DashboardConsumablesOverview }) {
  const items = [
    { label: 'Entries', value: overview.totalEntries.toLocaleString('en-GB') },
    { label: 'Vehicles', value: overview.vehiclesUsed.toLocaleString('en-GB') },
    { label: 'Total Cost', value: formatConsumableCost(overview.totalCost) },
  ]

  return (
    <div className="mb-3 grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-[#D2E5F5] bg-[rgba(244,249,255,0.9)] px-2 py-1.5 text-center dark:border-white/10 dark:bg-slate-800/50"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5D7C9D] dark:text-slate-400">
            {item.label}
          </p>
          <p className="mt-0.5 truncate text-xs font-bold tabular-nums text-[#163A63] dark:text-slate-100">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

function ConsumablesUsageSummary({
  overview,
}: {
  overview: DashboardConsumablesOverview
}) {
  const usageRows = overview.typeTiles.filter((tile) => tile.totalQuantity > 0)
  const visibleRows = usageRows.slice(0, MAX_USAGE_ROWS)
  const remainingCount = usageRows.length - visibleRows.length

  if (visibleRows.length === 0) {
    return (
      <div className="mt-auto rounded-xl border border-dashed border-[#D2E5F5] bg-[#F8FBFF]/80 px-3 py-5 text-center dark:border-white/10 dark:bg-slate-800/40">
        <p className="text-xs font-medium text-[#5D7C9D] dark:text-slate-400">
          No consumables recorded this month.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-auto min-w-0">
      <ul className="divide-y divide-[#D2E5F5] dark:divide-white/10" aria-label="Consumables used this month">
        {visibleRows.map((tile) => (
          <li
            key={tile.consumableType}
            className="flex min-w-0 items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0"
          >
            <span className="min-w-0 truncate text-sm font-medium text-[#163A63] dark:text-slate-100">
              {tile.consumableType}
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-[#163A63] dark:text-slate-100">
              {formatSummaryQuantity(tile.totalQuantity)} {tile.unit}
            </span>
          </li>
        ))}
      </ul>
      {remainingCount > 0 ? (
        <p className="mt-2 text-xs font-medium text-[#5D7C9D] dark:text-slate-400">
          + {remainingCount} more
        </p>
      ) : null}
    </div>
  )
}

export function ConsumablesOverviewCard({
  overview,
}: {
  overview: DashboardConsumablesOverview
}) {
  return (
    <section className={`${dashboardOverviewCardClass} flex h-full flex-col`}>
      <DashboardOverviewCardHeader
        title="Total Consumables"
        subtitle="Current month usage"
        actionTo="/consumables"
        leading={
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#D2E5F5] bg-[#DCEEFF] text-[#3B82F6] dark:border-white/10 dark:bg-slate-800/60 dark:text-blue-300">
            <Droplets className="size-4" strokeWidth={1.9} aria-hidden="true" />
          </div>
        }
      />

      <CompactKpiStrip overview={overview} />
      <ConsumablesUsageSummary overview={overview} />
    </section>
  )
}

import { formatConsumableCost, formatSummaryQuantity } from '@/lib/consumableUtils'
import type { DashboardConsumablesOverview } from '@/services/dashboardService'
import {
  dashboardOverviewCardClass,
  dashboardOverviewMiniStatLabelClass,
  dashboardOverviewMiniStatTileClass,
  dashboardOverviewMiniStatValueClass,
} from '@/components/dashboard/dashboardOverviewCardStyles'
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
    <div className="mb-3.5 grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div key={item.label} className={dashboardOverviewMiniStatTileClass}>
          <p className={dashboardOverviewMiniStatLabelClass}>{item.label}</p>
          <p className={`${dashboardOverviewMiniStatValueClass} truncate`}>{item.value}</p>
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
      <div className="mt-auto rounded-xl border border-dashed border-[#D0E4F6] bg-[rgba(248,251,255,0.85)] px-3 py-5 text-center dark:border-white/10 dark:bg-slate-800/40">
        <p className="text-xs font-medium text-[#6B8AAB] dark:text-slate-400">
          No consumables recorded this month.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-auto min-w-0 rounded-xl border border-[#D0E4F6] bg-[rgba(248,251,255,0.72)] px-3.5 py-2.5 shadow-[0_1px_4px_rgba(30,64,175,0.04)] dark:border-white/10 dark:bg-slate-800/40">
      <ul className="divide-y divide-[#D0E4F6] dark:divide-white/10" aria-label="Consumables used this month">
        {visibleRows.map((tile) => (
          <li
            key={tile.consumableType}
            className="flex min-w-0 items-baseline justify-between gap-3 py-2 first:pt-0.5 last:pb-0.5"
          >
            <span className="min-w-0 truncate text-sm font-medium text-[#123A63] dark:text-slate-100">
              {tile.consumableType}
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums tracking-[-0.02em] text-[#123A63] dark:text-slate-100">
              {formatSummaryQuantity(tile.totalQuantity)} {tile.unit}
            </span>
          </li>
        ))}
      </ul>
      {remainingCount > 0 ? (
        <p className="mt-1.5 text-xs font-medium text-[#6B8AAB] dark:text-slate-400">
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
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#D0E4F6] bg-[#E8F3FE] text-[#3B82F6] dark:border-white/10 dark:bg-slate-800/60 dark:text-blue-300">
            <Droplets className="size-4" strokeWidth={1.9} aria-hidden="true" />
          </div>
        }
      />

      <CompactKpiStrip overview={overview} />
      <ConsumablesUsageSummary overview={overview} />
    </section>
  )
}

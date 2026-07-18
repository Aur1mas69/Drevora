import { formatConsumableCost, formatSummaryQuantity } from '@/lib/consumableUtils'
import type { DashboardConsumablesOverview } from '@/services/dashboardService'
import { dashboardOverviewCardClass } from '@/components/dashboard/dashboardOverviewCardStyles'
import { DashboardOverviewCardHeader } from '@/components/dashboard/DashboardOverviewCardHeader'
import { Droplets } from 'lucide-react'

const MAX_TYPE_TILES = 8

function CompactKpiStrip({ overview }: { overview: DashboardConsumablesOverview }) {
  const items = [
    { label: 'Entries', value: overview.totalEntries.toLocaleString('en-GB') },
    {
      label: 'Diesel',
      value: `${formatSummaryQuantity(overview.dieselLitres)} L`,
    },
    {
      label: 'AdBlue',
      value: `${formatSummaryQuantity(overview.adBlueLitres)} L`,
    },
    { label: 'Cost', value: formatConsumableCost(overview.totalCost) },
    { label: 'Vehicles', value: overview.vehiclesUsed.toLocaleString('en-GB') },
  ]

  return (
    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
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

function ConsumableTypeTile({
  type,
  quantity,
  unit,
}: {
  type: string
  quantity: number
  unit: string
}) {
  return (
    <div className="rounded-xl border border-[#D2E5F5] bg-[rgba(244,249,255,0.9)] px-2.5 py-2.5 text-center transition-colors hover:bg-[#E8F3FE]/90 dark:border-white/10 dark:bg-slate-800/50 dark:hover:bg-slate-800/70">
      <p className="truncate text-[11px] font-semibold leading-tight text-[#5D7C9D] dark:text-slate-400" title={type}>
        {type}
      </p>
      <p className="mt-1 text-base font-bold leading-none tabular-nums text-[#163A63] dark:text-slate-100">
        {formatSummaryQuantity(quantity)} {unit}
      </p>
    </div>
  )
}

export function ConsumablesOverviewCard({
  overview,
}: {
  overview: DashboardConsumablesOverview
}) {
  const typeTiles = overview.typeTiles.slice(0, MAX_TYPE_TILES)

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

      {typeTiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D2E5F5] bg-[#F8FBFF]/80 px-3 py-6 text-center dark:border-white/10 dark:bg-slate-800/40">
          <p className="text-xs font-medium text-[#5D7C9D] dark:text-slate-400">No consumables recorded this month.</p>
        </div>
      ) : (
        <div className="mt-auto grid grid-cols-2 gap-2">
          {typeTiles.map((tile) => (
            <ConsumableTypeTile
              key={tile.consumableType}
              type={tile.consumableType}
              quantity={tile.totalQuantity}
              unit={tile.unit}
            />
          ))}
        </div>
      )}
    </section>
  )
}

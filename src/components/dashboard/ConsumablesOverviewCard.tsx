import { formatConsumableCost, formatSummaryQuantity } from '@/lib/consumableUtils'
import type { DashboardConsumablesOverview } from '@/services/dashboardService'
import { dashboardOverviewCardClass } from '@/components/dashboard/dashboardOverviewCardStyles'
import { Droplets } from 'lucide-react'
import { Link } from 'react-router-dom'

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
          className="rounded-lg border border-[#E8F3FE] bg-[#F5FAFF]/80 px-2 py-1.5 text-center"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#3D7A9C]">
            {item.label}
          </p>
          <p className="mt-0.5 truncate text-xs font-bold tabular-nums text-[#113C69]">
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
    <div className="rounded-xl border border-[#D3E9FC] bg-[#F5FAFF]/90 px-2.5 py-2.5 text-center transition-colors hover:border-[#BFE3F5] hover:bg-[#E8F3FE]/70">
      <p className="truncate text-[11px] font-semibold leading-tight text-[#3D7A9C]" title={type}>
        {type}
      </p>
      <p className="mt-1 text-base font-bold leading-none tabular-nums text-[#113C69]">
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
    <section className={`${dashboardOverviewCardClass} p-4`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#BFE3F5] bg-[#E8F3FE] text-[#218EE7]">
            <Droplets className="size-4" strokeWidth={1.9} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-[-0.02em] text-[#113C69]">
              Total Consumables
            </h3>
            <p className="mt-0.5 text-xs text-[#3D7A9C]">Current month usage</p>
          </div>
        </div>
        <Link to="/consumables" className="shrink-0 text-xs font-semibold text-[#218EE7] hover:underline">
          View
        </Link>
      </div>

      <CompactKpiStrip overview={overview} />

      {typeTiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D3E9FC] bg-[#F5FAFF]/80 px-3 py-6 text-center">
          <p className="text-xs font-medium text-[#3D7A9C]">No consumables recorded this month.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
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

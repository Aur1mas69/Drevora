import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  vehicleProfilePanelClass,
  vehicleProfileTableHeadClass,
  vehicleProfileTableRowClass,
} from '@/components/vehicles/profile/vehicleProfileUi'
import type { Consumable } from '@/lib/consumableTypes'
import {
  computeVehicleConsumableSummaries,
  formatConsumableItemCost,
  formatConsumableEntryDateTime,
  formatQuantityWithUnit,
  getConsumableTypeBadgeClass,
} from '@/lib/consumableUtils'
import { Link } from 'react-router-dom'

type VehicleConsumablesTabProps = {
  vehicleId: string
  items: Consumable[]
  isLoading: boolean
  loadError: string | null
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#D3E9FC] bg-[#F5FAFF]/80 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#3D7A9C]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#113C69]">{value}</p>
    </div>
  )
}

export function VehicleConsumablesTab({
  vehicleId,
  items,
  isLoading,
  loadError,
}: VehicleConsumablesTabProps) {
  const { formatDate, formatTime, settings } = useCompanySettings()
  const defaultPrices = settings?.consumableDefaultPrices ?? {}
  const summaries = computeVehicleConsumableSummaries(items)

  if (isLoading) {
    return (
      <div className="rounded-[20px] border border-[#D3E9FC] bg-white/80 p-6 shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl bg-[#E8F3FE]/70" />
          ))}
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
        {loadError}
      </div>
    )
  }

  return (
    <div className={`${vehicleProfilePanelClass} space-y-4 p-5`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#113C69]">Consumables</h3>
          <p className="mt-1 text-sm text-[#3D7A9C]">
            Fuel, AdBlue, oils and other consumables recorded for this vehicle.
          </p>
        </div>
        <Link
          to={`/consumables?vehicle=${vehicleId}`}
          className="text-sm font-semibold text-[#218EE7] hover:underline"
        >
          View in Consumables
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryStat label="Diesel total" value={formatQuantityWithUnit(summaries.dieselTotal, 'L')} />
        <SummaryStat label="AdBlue total" value={formatQuantityWithUnit(summaries.adBlueTotal, 'L')} />
        <SummaryStat
          label="Other fluids total"
          value={formatQuantityWithUnit(summaries.otherFluidsTotal, 'L')}
        />
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D3E9FC] bg-[#F5FAFF]/80 px-4 py-8 text-center">
          <p className="text-sm font-medium text-[#113C69]">No consumables recorded yet</p>
          <p className="mt-1 text-sm text-[#3D7A9C]">
            Fluids and consumables added for this vehicle will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-[#D3E9FC]/80">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className={vehicleProfileTableHeadClass}>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={vehicleProfileTableRowClass}>
                  <td className="px-4 py-3 text-sm font-medium tabular-nums text-[#113C69]">
                    {formatConsumableEntryDateTime(
                      item.entryDate,
                      item.entryTime,
                      formatDate,
                      formatTime,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getConsumableTypeBadgeClass(item.consumableType)}`}
                    >
                      {item.consumableType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold tabular-nums text-[#113C69]">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#5499BF]">{item.unit}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[#0B68BE]">
                    {formatConsumableItemCost(item, defaultPrices)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#5499BF]">{item.workerName ?? '—'}</td>
                  <td className="max-w-[180px] px-4 py-3 text-sm text-[#5499BF]">
                    <span className="line-clamp-2">{item.notes ?? item.itemName ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {item.receiptUrl ? (
                      <a
                        href={item.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[#218EE7] hover:underline"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-[#5499BF]/70">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

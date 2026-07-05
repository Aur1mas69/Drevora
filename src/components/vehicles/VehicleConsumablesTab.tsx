import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { Consumable } from '@/lib/consumableTypes'
import {
  computeVehicleConsumableSummaries,
  formatConsumableCost,
  formatQuantityWithUnit,
  formatSupplierSite,
  formatVehicleConsumableHistoryLine,
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
  const { formatDate } = useCompanySettings()
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
    <div className="space-y-4 rounded-[20px] border border-[#D3E9FC] bg-white/80 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#113C69]">Fluids & Consumables</h3>
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
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-[#D3E9FC] bg-[#F5FAFF]/70 px-4 py-3 transition-colors hover:bg-[#E8F3FE]/60"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getConsumableTypeBadgeClass(item.consumableType)}`}
                    >
                      {item.consumableType}
                    </span>
                    <span className="text-sm font-semibold text-[#113C69]">
                      {formatQuantityWithUnit(item.quantity, item.unit)}
                    </span>
                    <span className="text-sm font-semibold text-[#0B68BE]">
                      {formatConsumableCost(item.cost)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#113C69]">
                    {formatVehicleConsumableHistoryLine({
                      entryDateLabel: formatDate(item.entryDate),
                      consumableType: item.consumableType,
                      itemName: item.itemName,
                      quantity: item.quantity,
                      unit: item.unit,
                      costLabel: formatConsumableCost(item.cost),
                      supplierSite: formatSupplierSite(item.supplier, item.site),
                    })}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm text-[#3D7A9C]">
                  <p>{item.workerName ?? '—'}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

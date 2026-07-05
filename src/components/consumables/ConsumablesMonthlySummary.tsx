import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { CONSUMABLE_TYPES, type ConsumableTypeFilter } from '@/lib/consumableTypes'
import {
  computeMonthlyConsumablesSummary,
  computeVehicleBreakdownForTypeUnit,
  formatConsumableCost,
  formatEntryCount,
  formatSummaryQuantity,
  getConsumableTypeBadgeClass,
} from '@/lib/consumableUtils'
import {
  ConsumablesServiceError,
  fetchConsumablesMonthlySummary,
} from '@/services/consumablesService'
import type { Vehicle } from '@/services/vehiclesService'
import {
  ChevronDown,
  ClipboardList,
  Droplets,
  PoundSterling,
  Truck,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const

const selectClassName =
  'h-11 rounded-xl border border-[#BFE3F5] bg-white/90 px-3 text-sm font-medium text-[#113C69] shadow-sm outline-none transition-all hover:border-[#218EE7] focus:border-[#218EE7] focus:ring-2 focus:ring-[#218EE7]/20'

type KpiVariant = 'entries' | 'litres' | 'cost' | 'vehicles'

const KPI_VARIANT_STYLES: Record<
  KpiVariant,
  { accentBar: string; iconWrap: string; valueClass?: string }
> = {
  entries: {
    accentBar: 'bg-[#218EE7]',
    iconWrap: 'border-[#BFE3F5] bg-[#E8F3FE] text-[#218EE7]',
  },
  litres: {
    accentBar: 'bg-[#41A1EF]',
    iconWrap: 'border-[#89CFF0] bg-[#E8F3FE] text-[#41A1EF]',
  },
  cost: {
    accentBar: 'bg-[#10B981]',
    iconWrap: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    valueClass: 'text-[#113C69]',
  },
  vehicles: {
    accentBar: 'bg-[#0B68BE]',
    iconWrap: 'border-[#BFE3F5] bg-[#E8F3FE] text-[#0B68BE]',
  },
}

type ConsumablesMonthlySummaryProps = {
  vehicles: Vehicle[]
  refreshToken?: number
}

function SummaryKpiCard({
  label,
  value,
  helper,
  icon: Icon,
  variant,
}: {
  label: string
  value: string
  helper: string
  icon: typeof ClipboardList
  variant: KpiVariant
}) {
  const styles = KPI_VARIANT_STYLES[variant]

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[#D3E9FC] bg-white/85 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(33,142,231,0.16)] sm:min-h-[128px] sm:p-6">
      <div className={`absolute inset-x-0 top-0 h-1 ${styles.accentBar}`} aria-hidden="true" />

      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#3D7A9C] sm:text-sm">
          {label}
        </p>
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm transition-transform duration-300 group-hover:scale-105 sm:size-12 ${styles.iconWrap}`}
        >
          <Icon className="size-5 sm:size-[22px]" strokeWidth={1.9} />
        </div>
      </div>

      <div className="mt-4 min-w-0">
        <p
          className={`text-3xl font-bold tracking-[-0.03em] text-[#113C69] sm:text-4xl ${styles.valueClass ?? ''}`}
        >
          {value}
        </p>
        <p className="mt-1.5 text-xs font-medium text-[#5499BF]">{helper}</p>
      </div>
    </article>
  )
}

function VehicleBreakdownTable({
  vehicleLabel,
  totalQuantity,
  unit,
  totalCost,
  entryCount,
  lastEntryLabel,
}: {
  vehicleLabel: string
  totalQuantity: number
  unit: string
  totalCost: string
  entryCount: number
  lastEntryLabel: string
}) {
  return (
    <div className="rounded-xl border border-[#D3E9FC] bg-white/80 p-4 shadow-sm">
      <div className="grid gap-2 text-sm">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-[#113C69]">{vehicleLabel}</p>
          <p className="font-semibold text-[#0B68BE]">
            {formatSummaryQuantity(totalQuantity)} {unit}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[#3D7A9C]">
          <p>
            Cost: <span className="font-semibold text-[#10B981]">{totalCost}</span>
          </p>
          <p>
            Entries:{' '}
            <span className="font-medium text-[#113C69]">{formatEntryCount(entryCount)}</span>
          </p>
          <p className="col-span-2">
            Last entry:{' '}
            <span className="font-medium text-[#113C69]">{lastEntryLabel}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export function ConsumablesMonthlySummary({
  vehicles,
  refreshToken = 0,
}: ConsumablesMonthlySummaryProps) {
  const { formatDate } = useCompanySettings()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [vehicleFilter, setVehicleFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<ConsumableTypeFilter>('all')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [records, setRecords] = useState<Awaited<ReturnType<typeof fetchConsumablesMonthlySummary>>['records']>([])
  const [vehicleLabels, setVehicleLabels] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, index) => currentYear - index)
  }, [])

  const sortedVehicles = useMemo(
    () => [...vehicles].sort((a, b) => a.registration.localeCompare(b.registration)),
    [vehicles],
  )

  const loadSummary = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const result = await fetchConsumablesMonthlySummary({
        year,
        month,
        vehicleId: vehicleFilter,
        type: typeFilter,
      })
      setRecords(result.records)
      setVehicleLabels(result.vehicleLabels)
    } catch (error) {
      setLoadError(
        error instanceof ConsumablesServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to load monthly summary',
      )
      setRecords([])
      setVehicleLabels({})
    } finally {
      setIsLoading(false)
    }
  }, [month, typeFilter, vehicleFilter, year])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary, refreshToken])

  useEffect(() => {
    setExpandedKey(null)
  }, [month, year, vehicleFilter, typeFilter])

  const vehicleLabelMap = useMemo(() => new Map(Object.entries(vehicleLabels)), [vehicleLabels])

  const summary = useMemo(() => computeMonthlyConsumablesSummary(records), [records])

  const kpiTotalCost = formatConsumableCost(summary.totalCost)
  const kpiTotalLitres = `${formatSummaryQuantity(summary.totalLitres)} L`

  const isCurrentMonth =
    month === now.getMonth() + 1 && year === now.getFullYear()
  const overviewBadgeLabel = isCurrentMonth
    ? 'Current month overview'
    : `${MONTH_OPTIONS.find((option) => option.value === month)?.label ?? ''} ${year} overview`

  return (
    <section className="rounded-3xl border border-[#BFE3F5] bg-gradient-to-br from-white/95 via-[#F5FAFF] to-[#E8F3FE] p-6 shadow-[0_18px_45px_rgba(11,104,190,0.12)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.03em] text-[#113C69] sm:text-2xl">
            Monthly Consumables Summary
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-[#3D7A9C]">
            Track total fuel, AdBlue, oils and fluids used across the fleet.
          </p>
          <span className="mt-3 inline-flex rounded-full border border-[#BFE3F5] bg-[#E8F3FE] px-3 py-1 text-xs font-semibold text-[#0B68BE]">
            {overviewBadgeLabel}
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className={selectClassName}
            aria-label="Summary month"
          >
            {MONTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className={selectClassName}
            aria-label="Summary year"
          >
            {yearOptions.map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear}
              </option>
            ))}
          </select>

          <select
            value={vehicleFilter}
            onChange={(event) => setVehicleFilter(event.target.value)}
            className={selectClassName}
            aria-label="Summary vehicle filter"
          >
            <option value="all">All vehicles</option>
            {sortedVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as ConsumableTypeFilter)}
            className={selectClassName}
            aria-label="Summary type filter"
          >
            <option value="all">All types</option>
            {CONSUMABLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {loadError}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <SummaryKpiCard
          label="Total entries"
          value={summary.totalEntries.toLocaleString('en-GB')}
          helper="Records this month"
          icon={ClipboardList}
          variant="entries"
        />
        <SummaryKpiCard
          label="Total litres"
          value={kpiTotalLitres}
          helper="Liquid usage"
          icon={Droplets}
          variant="litres"
        />
        <SummaryKpiCard
          label="Total cost"
          value={kpiTotalCost}
          helper="Recorded spend"
          icon={PoundSterling}
          variant="cost"
        />
        <SummaryKpiCard
          label="Vehicles with usage"
          value={summary.vehiclesWithUsage.toLocaleString('en-GB')}
          helper="Vehicles used"
          icon={Truck}
          variant="vehicles"
        />
      </div>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="min-h-[120px] animate-pulse rounded-2xl border border-[#D3E9FC] bg-white/60 sm:min-h-[128px]"
            />
          ))}
        </div>
      ) : summary.typeSummaries.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#BFE3F5] bg-white/70 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-[#113C69]">No consumables recorded for this month.</p>
          <p className="mt-1 text-sm text-[#5499BF]">Try another month or adjust your filters.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-hidden rounded-2xl border border-[#D3E9FC] bg-white/60 md:block">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#BFE3F5] bg-gradient-to-r from-[#E8F3FE]/80 to-[#F5FAFF]/90 text-xs font-semibold uppercase tracking-[0.1em] text-[#3D7A9C] sm:text-sm">
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5">Total Quantity</th>
                  <th className="px-4 py-3.5">Unit</th>
                  <th className="px-4 py-3.5">Total Cost</th>
                  <th className="px-4 py-3.5">Number of Entries</th>
                  <th className="px-4 py-3.5">Vehicles Used</th>
                  <th className="px-4 py-3.5">Last Entry</th>
                  <th className="w-10 px-4 py-3.5" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {summary.typeSummaries.map((row) => {
                  const isExpanded = expandedKey === row.key
                  const breakdown = isExpanded
                    ? computeVehicleBreakdownForTypeUnit(
                        records,
                        row.consumableType,
                        row.unit,
                        vehicleLabelMap,
                      )
                    : []

                  return (
                    <SummaryTableRowGroup
                      key={row.key}
                      row={row}
                      isExpanded={isExpanded}
                      breakdown={breakdown}
                      formatDate={formatDate}
                      onToggle={() => setExpandedKey(isExpanded ? null : row.key)}
                    />
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>

          <div className="mt-6 space-y-3 md:hidden">
            {summary.typeSummaries.map((row) => {
              const isExpanded = expandedKey === row.key
              const breakdown = isExpanded
                ? computeVehicleBreakdownForTypeUnit(
                    records,
                    row.consumableType,
                    row.unit,
                    vehicleLabelMap,
                  )
                : []

              return (
                <SummaryMobileCard
                  key={row.key}
                  row={row}
                  isExpanded={isExpanded}
                  breakdown={breakdown}
                  formatDate={formatDate}
                  onToggle={() => setExpandedKey(isExpanded ? null : row.key)}
                />
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

type SummaryRowProps = {
  row: ReturnType<typeof computeMonthlyConsumablesSummary>['typeSummaries'][number]
  isExpanded: boolean
  breakdown: ReturnType<typeof computeVehicleBreakdownForTypeUnit>
  formatDate: (value: string) => string
  onToggle: () => void
}

function SummaryTableRowGroup({
  row,
  isExpanded,
  breakdown,
  formatDate,
  onToggle,
}: SummaryRowProps) {
  return (
    <>
      <tr
        className="group/row cursor-pointer border-b border-[#D3E9FC]/70 bg-white/50 transition-colors hover:bg-[#F1F7FE]"
        onClick={onToggle}
      >
        <td className="px-4 py-3.5">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold sm:text-sm ${getConsumableTypeBadgeClass(row.consumableType)}`}
          >
            {row.consumableType}
          </span>
        </td>
        <td className="px-4 py-3.5 text-sm font-semibold tabular-nums text-[#113C69]">
          {formatSummaryQuantity(row.totalQuantity)}
        </td>
        <td className="px-4 py-3.5 text-sm font-medium text-[#113C69]">{row.unit}</td>
        <td className="px-4 py-3.5 text-sm font-semibold tabular-nums text-[#10B981]">
          {formatConsumableCost(row.totalCost)}
        </td>
        <td className="px-4 py-3.5 text-sm font-medium text-[#113C69]">
          {formatEntryCount(row.entryCount)}
        </td>
        <td className="px-4 py-3.5 text-sm font-semibold text-[#113C69]">{row.vehiclesUsed}</td>
        <td className="px-4 py-3.5 whitespace-nowrap text-sm font-medium text-[#113C69]">
          {row.lastEntryDate ? formatDate(row.lastEntryDate) : '—'}
        </td>
        <td className="px-4 py-3.5">
          <span className="inline-flex rounded-lg p-1.5 text-[#218EE7] transition-colors group-hover/row:bg-[#E8F3FE]">
            <ChevronDown
              className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </span>
        </td>
      </tr>
      {isExpanded ? (
        <tr className="border-b border-[#D3E9FC]/70 bg-[#F5FAFF]/80">
          <td colSpan={8} className="px-4 py-4">
            <VehicleBreakdownPanel breakdown={breakdown} unit={row.unit} formatDate={formatDate} />
          </td>
        </tr>
      ) : null}
    </>
  )
}

function SummaryMobileCard({ row, isExpanded, breakdown, formatDate, onToggle }: SummaryRowProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#D3E9FC] bg-white/85 shadow-sm">
      <button type="button" onClick={onToggle} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getConsumableTypeBadgeClass(row.consumableType)}`}
            >
              {row.consumableType}
            </span>
            <p className="mt-2 text-lg font-bold text-[#113C69]">
              {formatSummaryQuantity(row.totalQuantity)} {row.unit}
            </p>
          </div>
          <span className="inline-flex rounded-lg bg-[#E8F3FE] p-1.5 text-[#218EE7]">
            <ChevronDown
              className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-[#3D7A9C]">
          <div>
            <dt>Total cost</dt>
            <dd className="font-semibold text-[#10B981]">{formatConsumableCost(row.totalCost)}</dd>
          </div>
          <div>
            <dt>Entries</dt>
            <dd className="font-semibold text-[#113C69]">{formatEntryCount(row.entryCount)}</dd>
          </div>
          <div>
            <dt>Vehicles</dt>
            <dd className="font-semibold text-[#113C69]">{row.vehiclesUsed}</dd>
          </div>
          <div>
            <dt>Last entry</dt>
            <dd className="font-medium text-[#113C69]">
              {row.lastEntryDate ? formatDate(row.lastEntryDate) : '—'}
            </dd>
          </div>
        </dl>
      </button>

      {isExpanded ? (
        <div className="border-t border-[#D3E9FC] bg-[#F5FAFF]/70 px-4 py-4">
          <VehicleBreakdownPanel breakdown={breakdown} unit={row.unit} formatDate={formatDate} />
        </div>
      ) : null}
    </article>
  )
}

function VehicleBreakdownPanel({
  breakdown,
  unit,
  formatDate,
}: {
  breakdown: ReturnType<typeof computeVehicleBreakdownForTypeUnit>
  unit: string
  formatDate: (value: string) => string
}) {
  if (breakdown.length === 0) {
    return (
      <p className="text-sm font-medium text-[#3D7A9C]">No vehicle breakdown available.</p>
    )
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#3D7A9C]">
        Breakdown by vehicle
      </p>

      <div className="mt-3 hidden overflow-hidden rounded-xl border border-[#D3E9FC] md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#BFE3F5] bg-[#E8F3FE]/70 text-xs font-semibold uppercase tracking-[0.08em] text-[#3D7A9C]">
              <th className="px-3 py-2.5">Vehicle</th>
              <th className="px-3 py-2.5">Total Quantity</th>
              <th className="px-3 py-2.5">Total Cost</th>
              <th className="px-3 py-2.5">Entries</th>
              <th className="px-3 py-2.5">Last Entry</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((item) => (
              <tr
                key={item.vehicleId ?? '__none__'}
                className="border-b border-[#D3E9FC]/70 bg-white/50 transition-colors hover:bg-[#F1F7FE]"
              >
                <td className="px-3 py-2.5 text-sm font-semibold text-[#113C69]">
                  {item.vehicleLabel ?? item.vehicleId ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-[#113C69]">
                  {formatSummaryQuantity(item.totalQuantity)} {unit}
                </td>
                <td className="px-3 py-2.5 text-sm font-semibold text-[#10B981]">
                  {formatConsumableCost(item.totalCost)}
                </td>
                <td className="px-3 py-2.5 text-sm font-medium text-[#113C69]">
                  {formatEntryCount(item.entryCount)}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-sm font-medium text-[#113C69]">
                  {item.lastEntryDate ? formatDate(item.lastEntryDate) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 space-y-2 md:hidden">
        {breakdown.map((item) => (
          <VehicleBreakdownTable
            key={item.vehicleId ?? '__none__'}
            vehicleLabel={item.vehicleLabel ?? item.vehicleId ?? '—'}
            totalQuantity={item.totalQuantity}
            unit={unit}
            totalCost={formatConsumableCost(item.totalCost)}
            entryCount={item.entryCount}
            lastEntryLabel={item.lastEntryDate ? formatDate(item.lastEntryDate) : '—'}
          />
        ))}
      </div>
    </div>
  )
}

import { Input } from '@/components/ui/input'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  CONSUMABLE_TYPES,
  type ConsumableSummaryPeriod,
  type ConsumableType,
  type ConsumableTypeFilter,
} from '@/lib/consumableTypes'
import {
  computeConsumableTypeCards,
  computeMonthlyConsumablesSummary,
  computeVehicleBreakdownForType,
  computeVehicleBreakdownForTypeUnit,
  formatConsumableCost,
  formatEntryCount,
  formatSummaryQuantity,
  formatTypeCardQuantity,
  getConsumableSummaryPeriodLabel,
  getConsumableTypeAccent,
  getConsumableTypeBadgeClass,
} from '@/lib/consumableUtils'
import {
  ConsumablesServiceError,
  fetchConsumablesMonthlySummary,
} from '@/services/consumablesService'
import type { Vehicle } from '@/services/vehiclesService'
import { BarChart3, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

const selectClassName =
  'h-10 rounded-xl border border-[#BFE3F5] bg-white/90 px-3 text-sm font-medium text-[#113C69] shadow-sm outline-none transition-all hover:border-[#218EE7] focus:border-[#218EE7] focus:ring-2 focus:ring-[#218EE7]/20'

const PERIOD_OPTIONS: { value: ConsumableSummaryPeriod; label: string }[] = [
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'this_year', label: 'This year' },
  { value: 'all_time', label: 'All time' },
  { value: 'custom', label: 'Custom' },
]

type ConsumablesMonthlySummaryProps = {
  vehicles: Vehicle[]
  refreshToken?: number
}

export function ConsumablesMonthlySummary({
  vehicles,
  refreshToken = 0,
}: ConsumablesMonthlySummaryProps) {
  const { formatDate } = useCompanySettings()
  const [period, setPeriod] = useState<ConsumableSummaryPeriod>('this_month')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<ConsumableTypeFilter>('all')
  const [selectedType, setSelectedType] = useState<ConsumableType | null>(null)
  const [expandedTableKey, setExpandedTableKey] = useState<string | null>(null)
  const [records, setRecords] = useState<
    Awaited<ReturnType<typeof fetchConsumablesMonthlySummary>>['records']
  >([])
  const [vehicleLabels, setVehicleLabels] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const sortedVehicles = useMemo(
    () => [...vehicles].sort((a, b) => a.registration.localeCompare(b.registration)),
    [vehicles],
  )

  const loadSummary = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const result = await fetchConsumablesMonthlySummary({
        period,
        dateFrom: period === 'custom' ? customDateFrom || undefined : undefined,
        dateTo: period === 'custom' ? customDateTo || undefined : undefined,
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
            : 'Failed to load consumables summary',
      )
      setRecords([])
      setVehicleLabels({})
    } finally {
      setIsLoading(false)
    }
  }, [customDateFrom, customDateTo, period, typeFilter, vehicleFilter])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary, refreshToken])

  useEffect(() => {
    setExpandedTableKey(null)
  }, [period, customDateFrom, customDateTo, vehicleFilter, typeFilter])

  useEffect(() => {
    if (typeFilter === 'all') {
      setSelectedType(null)
      return
    }
    setSelectedType(typeFilter)
  }, [typeFilter])

  const vehicleLabelMap = useMemo(() => new Map(Object.entries(vehicleLabels)), [vehicleLabels])

  const typeCards = useMemo(() => computeConsumableTypeCards(records), [records])
  const summary = useMemo(() => computeMonthlyConsumablesSummary(records), [records])

  const maxBarQuantity = useMemo(
    () => Math.max(...typeCards.map((card) => card.primaryQuantity), 1),
    [typeCards],
  )

  const periodLabel = getConsumableSummaryPeriodLabel(
    period,
    customDateFrom,
    customDateTo,
  )

  const selectedVehicleLabel =
    vehicleFilter === 'all'
      ? null
      : sortedVehicles.find((vehicle) => vehicle.id === vehicleFilter)?.registration ?? null

  const typeBreakdown = useMemo(() => {
    if (!selectedType) return []
    return computeVehicleBreakdownForType(records, selectedType, vehicleLabelMap)
  }, [records, selectedType, vehicleLabelMap])

  function handleTypeCardClick(type: ConsumableType) {
    if (selectedType === type && typeFilter === type) {
      setSelectedType(null)
      setTypeFilter('all')
      return
    }
    setSelectedType(type)
    setTypeFilter(type)
  }

  return (
    <section className="rounded-3xl border border-[#BFE3F5] bg-gradient-to-br from-white/95 via-[#F5FAFF] to-[#E8F3FE] p-5 shadow-[0_18px_45px_rgba(11,104,190,0.12)] sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.03em] text-[#113C69] sm:text-2xl">
            Consumables Summary
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-[#3D7A9C]">
            Usage by type across your fleet — fuel, fluids, oils and materials.
          </p>
          <span className="mt-3 inline-flex rounded-full border border-[#BFE3F5] bg-[#E8F3FE] px-3 py-1 text-xs font-semibold text-[#0B68BE]">
            {periodLabel}
            {selectedVehicleLabel ? ` · ${selectedVehicleLabel}` : ''}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {PERIOD_OPTIONS.map((option) => {
              const isActive = period === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPeriod(option.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                    isActive
                      ? 'border-[#218EE7] bg-gradient-to-br from-[#218EE7] to-[#0B68BE] text-white shadow-sm'
                      : 'border-[#C5DFFB] bg-white/90 text-[#0B68BE] hover:border-[#89CFF0] hover:bg-[#F5FAFF]'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          {period === 'custom' ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="date"
                value={customDateFrom}
                onChange={(event) => setCustomDateFrom(event.target.value)}
                className="h-10 rounded-xl border-[#BFE3F5] bg-white/90 text-sm"
                aria-label="Custom range from"
              />
              <span className="hidden text-sm text-[#5499BF] sm:inline">to</span>
              <Input
                type="date"
                value={customDateTo}
                onChange={(event) => setCustomDateTo(event.target.value)}
                className="h-10 rounded-xl border-[#BFE3F5] bg-white/90 text-sm"
                aria-label="Custom range to"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
      </div>

      {loadError ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-[132px] animate-pulse rounded-2xl border border-[#D3E9FC] bg-white/60"
            />
          ))}
        </div>
      ) : typeCards.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#BFE3F5] bg-white/70 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-[#113C69]">
            No consumables recorded for this period.
          </p>
          <p className="mt-1 text-sm text-[#5499BF]">Try another period or adjust your filters.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {typeCards.map((card) => {
              const accent = getConsumableTypeAccent(card.consumableType)
              const isSelected = selectedType === card.consumableType
              const barWidth = Math.max(
                8,
                Math.round((card.primaryQuantity / maxBarQuantity) * 100),
              )

              return (
                <button
                  key={card.consumableType}
                  type="button"
                  onClick={() => handleTypeCardClick(card.consumableType)}
                  aria-pressed={isSelected}
                  className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(33,142,231,0.14)] ${accent.cardBg} ${
                    isSelected
                      ? `border-[#218EE7] ring-2 ${accent.cardRing}`
                      : 'border-[#D3E9FC]/80 hover:border-[#89CFF0]'
                  }`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${accent.bar}`} aria-hidden="true" />

                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getConsumableTypeBadgeClass(card.consumableType)}`}
                    >
                      {card.consumableType}
                    </span>
                  </div>

                  <p className="mt-3 text-xl font-bold tracking-[-0.02em] text-[#113C69]">
                    {formatTypeCardQuantity(card.quantityLines)}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-600">
                    {formatConsumableCost(card.totalCost)}
                  </p>
                  <p className="mt-2 text-xs font-medium text-[#5499BF]">
                    {formatEntryCount(card.entryCount)} · {card.vehiclesUsed}{' '}
                    {card.vehiclesUsed === 1 ? 'vehicle' : 'vehicles'}
                  </p>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70 ring-1 ring-[#D3E9FC]/60">
                    <div
                      className={`h-full rounded-full transition-all ${accent.bar}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>

          <UsageChart
            typeCards={typeCards}
            maxBarQuantity={maxBarQuantity}
            formatCost={formatConsumableCost}
          />

          {selectedType && typeBreakdown.length > 0 ? (
            <TypeVehicleBreakdownPanel
              consumableType={selectedType}
              breakdown={typeBreakdown}
              formatDate={formatDate}
            />
          ) : null}

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-[#113C69]">Detailed breakdown</h3>
            <p className="mt-1 text-xs text-[#5499BF]">
              Quantities are grouped by type and unit — litres, kilograms and other units are never
              mixed.
            </p>

            <div className="mt-3 hidden overflow-hidden rounded-2xl border border-[#D3E9FC] bg-white/70 md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#BFE3F5] bg-gradient-to-r from-[#E8F3FE]/90 to-[#F5FAFF]/95 text-xs font-semibold uppercase tracking-[0.08em] text-[#3D7A9C]">
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Total Quantity</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Total Cost</th>
                      <th className="px-4 py-3">Entries</th>
                      <th className="px-4 py-3">Vehicles Used</th>
                      <th className="px-4 py-3">Last Entry</th>
                      <th className="w-10 px-4 py-3" aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {summary.typeSummaries.map((row) => {
                      const isExpanded = expandedTableKey === row.key
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
                          onToggle={() =>
                            setExpandedTableKey(isExpanded ? null : row.key)
                          }
                        />
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-3 space-y-3 md:hidden">
              {summary.typeSummaries.map((row) => {
                const isExpanded = expandedTableKey === row.key
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
                    onToggle={() => setExpandedTableKey(isExpanded ? null : row.key)}
                  />
                )
              })}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function UsageChart({
  typeCards,
  maxBarQuantity,
  formatCost,
}: {
  typeCards: ReturnType<typeof computeConsumableTypeCards>
  maxBarQuantity: number
  formatCost: typeof formatConsumableCost
}) {
  if (typeCards.length === 0) return null

  return (
    <div className="mt-6 rounded-2xl border border-[#D3E9FC] bg-white/75 p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-4 text-[#218EE7]" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-[#113C69]">Usage by type</h3>
      </div>
      <p className="mt-1 text-xs text-[#5499BF]">
        Relative quantity for the selected period. Cost shown where recorded.
      </p>

      <div className="mt-4 space-y-3">
        {typeCards.map((card) => {
          const accent = getConsumableTypeAccent(card.consumableType)
          const width = Math.max(4, Math.round((card.primaryQuantity / maxBarQuantity) * 100))

          return (
            <div key={card.consumableType} className="grid gap-1.5 sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-3">
              <p className="text-xs font-semibold text-[#113C69] sm:text-sm">{card.consumableType}</p>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF6FF] ring-1 ring-[#D3E9FC]/70">
                <div className={`h-full rounded-full ${accent.bar}`} style={{ width: `${width}%` }} />
              </div>
              <div className="text-right text-xs sm:text-sm">
                <span className="font-semibold tabular-nums text-[#113C69]">
                  {formatTypeCardQuantity(card.quantityLines)}
                </span>
                <span className="ml-2 font-medium text-emerald-600">
                  {formatCost(card.totalCost)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TypeVehicleBreakdownPanel({
  consumableType,
  breakdown,
  formatDate,
}: {
  consumableType: ConsumableType
  breakdown: ReturnType<typeof computeVehicleBreakdownForType>
  formatDate: (value: string) => string
}) {
  return (
    <div className="mt-6 rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF] to-[#EEF6FF]/80 p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-semibold text-[#113C69]">
        {consumableType} — breakdown by vehicle
      </h3>

      <div className="mt-3 hidden overflow-hidden rounded-xl border border-[#D3E9FC] md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#BFE3F5] bg-[#E8F3FE]/70 text-xs font-semibold uppercase tracking-[0.08em] text-[#3D7A9C]">
              <th className="px-3 py-2.5">Vehicle</th>
              <th className="px-3 py-2.5">Quantity</th>
              <th className="px-3 py-2.5">Cost</th>
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
                <td className="px-3 py-2.5 font-semibold text-[#113C69]">
                  {item.vehicleLabel ?? item.vehicleId ?? '—'}
                </td>
                <td className="px-3 py-2.5 font-semibold tabular-nums text-[#113C69]">
                  {formatTypeCardQuantity(item.quantityLines)}
                </td>
                <td className="px-3 py-2.5 font-semibold text-emerald-600">
                  {formatConsumableCost(item.totalCost)}
                </td>
                <td className="px-3 py-2.5 font-medium text-[#113C69]">
                  {formatEntryCount(item.entryCount)}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap font-medium text-[#113C69]">
                  {item.lastEntryDate ? formatDate(item.lastEntryDate) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 space-y-2 md:hidden">
        {breakdown.map((item) => (
          <article
            key={item.vehicleId ?? '__none__'}
            className="rounded-xl border border-[#D3E9FC] bg-white/80 p-3 shadow-sm"
          >
            <p className="font-semibold text-[#113C69]">
              {item.vehicleLabel ?? item.vehicleId ?? '—'}
            </p>
            <p className="mt-1 text-sm font-bold text-[#0B68BE]">
              {formatTypeCardQuantity(item.quantityLines)}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#5499BF]">
              <div>
                <dt>Cost</dt>
                <dd className="font-semibold text-emerald-600">
                  {formatConsumableCost(item.totalCost)}
                </dd>
              </div>
              <div>
                <dt>Entries</dt>
                <dd className="font-medium text-[#113C69]">{formatEntryCount(item.entryCount)}</dd>
              </div>
              <div className="col-span-2">
                <dt>Last entry</dt>
                <dd className="font-medium text-[#113C69]">
                  {item.lastEntryDate ? formatDate(item.lastEntryDate) : '—'}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
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
        <td className="px-4 py-3">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getConsumableTypeBadgeClass(row.consumableType)}`}
          >
            {row.consumableType}
          </span>
        </td>
        <td className="px-4 py-3 text-sm font-semibold tabular-nums text-[#113C69]">
          {formatSummaryQuantity(row.totalQuantity)}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-[#113C69]">{row.unit}</td>
        <td className="px-4 py-3 text-sm font-semibold tabular-nums text-emerald-600">
          {formatConsumableCost(row.totalCost)}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-[#113C69]">
          {formatEntryCount(row.entryCount)}
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-[#113C69]">{row.vehiclesUsed}</td>
        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[#113C69]">
          {row.lastEntryDate ? formatDate(row.lastEntryDate) : '—'}
        </td>
        <td className="px-4 py-3">
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
            <UnitVehicleBreakdownPanel
              breakdown={breakdown}
              unit={row.unit}
              formatDate={formatDate}
            />
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
            <dd className="font-semibold text-emerald-600">{formatConsumableCost(row.totalCost)}</dd>
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
          <UnitVehicleBreakdownPanel breakdown={breakdown} unit={row.unit} formatDate={formatDate} />
        </div>
      ) : null}
    </article>
  )
}

function UnitVehicleBreakdownPanel({
  breakdown,
  unit,
  formatDate,
}: {
  breakdown: ReturnType<typeof computeVehicleBreakdownForTypeUnit>
  unit: string
  formatDate: (value: string) => string
}) {
  if (breakdown.length === 0) {
    return <p className="text-sm font-medium text-[#3D7A9C]">No vehicle breakdown available.</p>
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
              <th className="px-3 py-2.5">Quantity</th>
              <th className="px-3 py-2.5">Cost</th>
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
                <td className="px-3 py-2.5 text-sm font-semibold text-emerald-600">
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
          <article
            key={item.vehicleId ?? '__none__'}
            className="rounded-xl border border-[#D3E9FC] bg-white/80 p-3"
          >
            <p className="font-semibold text-[#113C69]">
              {item.vehicleLabel ?? item.vehicleId ?? '—'}
            </p>
            <p className="mt-1 text-sm font-bold text-[#0B68BE]">
              {formatSummaryQuantity(item.totalQuantity)} {unit}
            </p>
            <p className="mt-1 text-xs text-[#5499BF]">
              {formatConsumableCost(item.totalCost)} · {formatEntryCount(item.entryCount)} · Last:{' '}
              {item.lastEntryDate ? formatDate(item.lastEntryDate) : '—'}
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}

import { ConsumablesPagination } from '@/components/consumables/ConsumablesPagination'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  DEFAULT_CONSUMABLE_PAGE_SIZE,
  type ConsumableType,
} from '@/lib/consumableTypes'
import {
  computeCostByTypeChartData,
  computeMonthlyConsumablesSummary,
  computeUsageByTypeChartData,
  computeUsageOverTimeChartData,
  computeVehicleBreakdownForTypeUnit,
  enrichConsumableSummaryRecords,
  formatConsumableCost,
  formatEntryCount,
  formatSummaryQuantity,
  getConsumableTypeBadgeClass,
} from '@/lib/consumableUtils'
import {
  ConsumablesServiceError,
  fetchConsumablesMonthlySummary,
} from '@/services/consumablesService'
import type { ConsumablesFilterValues } from '@/components/consumables/ConsumablesToolbar'
import { ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const chartCardClass =
  'rounded-2xl border border-[#D3E9FC] bg-white p-4 shadow-[0_4px_16px_rgba(40,80,140,0.05)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20 sm:p-5'

type ConsumablesMonthlySummaryProps = {
  filters: ConsumablesFilterValues
  refreshToken?: number
}

export function ConsumablesMonthlySummary({
  filters,
  refreshToken = 0,
}: ConsumablesMonthlySummaryProps) {
  const { formatDate, settings } = useCompanySettings()
  const defaultPrices = settings?.consumableDefaultPrices ?? {}
  const [expandedTableKey, setExpandedTableKey] = useState<string | null>(null)
  const [tablePage, setTablePage] = useState(1)
  const [tablePageSize, setTablePageSize] = useState(DEFAULT_CONSUMABLE_PAGE_SIZE)
  const [records, setRecords] = useState<
    Awaited<ReturnType<typeof fetchConsumablesMonthlySummary>>['records']
  >([])
  const [vehicleLabels, setVehicleLabels] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { period, customDateFrom, customDateTo, vehicleId, chartType, viewMode } = filters

  const loadSummary = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const result = await fetchConsumablesMonthlySummary({
        period,
        dateFrom: period === 'custom' ? customDateFrom || undefined : undefined,
        dateTo: period === 'custom' ? customDateTo || undefined : undefined,
        vehicleId,
        type: 'all',
        viewMode,
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
  }, [customDateFrom, customDateTo, period, vehicleId, viewMode])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary, refreshToken])

  useEffect(() => {
    setExpandedTableKey(null)
    setTablePage(1)
  }, [period, customDateFrom, customDateTo, vehicleId, chartType, viewMode, tablePageSize])

  const vehicleLabelMap = useMemo(() => new Map(Object.entries(vehicleLabels)), [vehicleLabels])

  const enrichedRecords = useMemo(
    () => enrichConsumableSummaryRecords(records, defaultPrices),
    [defaultPrices, records],
  )

  const usageByType = useMemo(
    () => computeUsageByTypeChartData(enrichedRecords, 'all'),
    [enrichedRecords],
  )
  const costByType = useMemo(
    () => computeCostByTypeChartData(enrichedRecords),
    [enrichedRecords],
  )
  const usageTrend = useMemo(
    () =>
      computeUsageOverTimeChartData(
        enrichedRecords,
        period,
        chartType,
        customDateFrom,
        customDateTo,
      ),
    [chartType, customDateFrom, customDateTo, enrichedRecords, period],
  )
  const summary = useMemo(
    () => computeMonthlyConsumablesSummary(enrichedRecords),
    [enrichedRecords],
  )

  const paginatedRows = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize
    return summary.typeSummaries.slice(start, start + tablePageSize)
  }, [summary.typeSummaries, tablePage, tablePageSize])

  const hasData = enrichedRecords.length > 0

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-[-0.03em] text-[#113C69] dark:text-slate-100 sm:text-2xl">
          Consumables Summary
        </h2>
        <p className="mt-1 text-sm leading-6 text-[#3D7A9C]">
          Usage by type across your fleet — fuel, fluids, oils and materials.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="h-[280px] animate-pulse rounded-2xl border border-[#D3E9FC] bg-white dark:border-white/10 dark:bg-slate-900/70" />
            <div className="h-[280px] animate-pulse rounded-2xl border border-[#D3E9FC] bg-white dark:border-white/10 dark:bg-slate-900/70" />
          </div>
          <div className="h-[320px] animate-pulse rounded-2xl border border-[#D3E9FC] bg-white dark:border-white/10 dark:bg-slate-900/70" />
        </div>
      ) : !hasData ? (
        <div className="rounded-2xl border border-dashed border-[#BFE3F5] bg-white px-4 py-12 text-center dark:border-white/10 dark:bg-slate-900/70">
          <p className="text-sm font-semibold text-[#113C69] dark:text-slate-100">
            No consumables recorded for this period.
          </p>
          <p className="mt-1 text-sm text-[#5499BF]">Try another period or adjust your filters.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UsageByTypeChart data={usageByType} />
            <CostByTypeChart data={costByType} />
          </div>

          <UsageOverTimeChart data={usageTrend} selectedType={chartType} />

          <div className={`${chartCardClass} !p-0 overflow-hidden`}>
            <div className="border-b border-[#E8F3FE] px-4 py-4 sm:px-5">
              <h3 className="text-sm font-semibold text-[#113C69] dark:text-slate-100">Detailed breakdown</h3>
              <p className="mt-1 text-xs text-[#5499BF]">
                Quantities are grouped by type and unit — incompatible units are never mixed.
              </p>
            </div>

            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#BFE3F5] bg-[#F5FAFF] text-xs font-semibold uppercase tracking-[0.08em] text-[#3D7A9C]">
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
                    {paginatedRows.map((row) => {
                      const isExpanded = expandedTableKey === row.key
                      const breakdown = isExpanded
                        ? computeVehicleBreakdownForTypeUnit(
                            enrichedRecords,
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

            <div className="space-y-3 p-4 md:hidden">
              {paginatedRows.map((row) => {
                const isExpanded = expandedTableKey === row.key
                const breakdown = isExpanded
                  ? computeVehicleBreakdownForTypeUnit(
                      enrichedRecords,
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

            <ConsumablesPagination
              page={tablePage}
              pageSize={tablePageSize}
              totalCount={summary.typeSummaries.length}
              onPageChange={setTablePage}
              onPageSizeChange={setTablePageSize}
            />
          </div>
        </>
      )}
    </section>
  )
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-[#D3E9FC] bg-[#F8FBFF] px-4 text-center">
      <p className="text-sm font-medium text-[#5499BF]">{message}</p>
    </div>
  )
}

function UsageByTypeChart({
  data,
}: {
  data: ReturnType<typeof computeUsageByTypeChartData>
}) {
  return (
    <div className={chartCardClass}>
      <h3 className="text-sm font-semibold text-[#113C69] dark:text-slate-100">Usage by Type</h3>
      <p className="mt-1 text-xs text-[#5499BF]">
        {data
          ? `Quantities in ${data.unit} only — sorted highest to lowest.`
          : 'Litre-based usage for the selected filters.'}
      </p>

      {!data ? (
        <div className="mt-4">
          <ChartEmptyState message="No compatible quantity data for this chart." />
        </div>
      ) : (
        <div className="mt-4 h-[280px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.rows}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E8F3FE" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#5499BF', fontSize: 11 }}
                axisLine={{ stroke: '#D3E9FC' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={128}
                tick={{ fill: '#113C69', fontSize: 11, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(33,142,231,0.06)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null
                  const row = payload[0].payload as (typeof data.rows)[number]
                  return (
                    <div className="rounded-xl border border-[#D3E9FC] bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:shadow-black/40">
                      <p className="font-semibold text-[#113C69] dark:text-slate-100">{row.consumableType}</p>
                      <p className="mt-0.5 tabular-nums text-[#3D7A9C]">
                        {formatSummaryQuantity(row.quantity)} {row.unit}
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="quantity" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {data.rows.map((row) => (
                  <Cell key={row.consumableType} fill={row.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function CostByTypeChart({
  data,
}: {
  data: ReturnType<typeof computeCostByTypeChartData>
}) {
  return (
    <div className={chartCardClass}>
      <h3 className="text-sm font-semibold text-[#113C69] dark:text-slate-100">Cost by Type</h3>
      <p className="mt-1 text-xs text-[#5499BF]">Recorded cost only — missing costs are excluded.</p>

      {!data ? (
        <div className="mt-4">
          <ChartEmptyState message="No recorded cost data for this period." />
        </div>
      ) : (
        <div className="relative mt-4 h-[280px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.rows}
                dataKey="cost"
                nameKey="consumableType"
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={100}
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
              >
                {data.rows.map((row) => (
                  <Cell key={row.consumableType} fill={row.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null
                  const row = payload[0].payload as (typeof data.rows)[number]
                  return (
                    <div className="rounded-xl border border-[#D3E9FC] bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:shadow-black/40">
                      <p className="font-semibold text-[#113C69] dark:text-slate-100">{row.consumableType}</p>
                      <p className="mt-0.5 tabular-nums text-[#3D7A9C]">
                        {formatConsumableCost(row.cost)}
                      </p>
                      <p className="mt-0.5 text-[#5499BF]">
                        {row.percentage.toFixed(1)}% of recorded cost
                      </p>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5499BF]">
              Total
            </p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-[#113C69] dark:text-slate-100">
              {formatConsumableCost(data.totalCost)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function UsageOverTimeChart({
  data,
  selectedType,
}: {
  data: ReturnType<typeof computeUsageOverTimeChartData>
  selectedType: ConsumableType
}) {
  const unitLabel = data?.unit ?? null

  return (
    <div className={chartCardClass}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-[#113C69] dark:text-slate-100">Usage Over Time</h3>
        <p className="mt-1 text-xs text-[#5499BF]">
          {unitLabel
            ? `${selectedType} — trend in ${unitLabel} for the selected period`
            : `No ${selectedType} usage recorded for the selected filters.`}
        </p>
      </div>

      {!data ? (
        <div className="mt-4">
          <ChartEmptyState
            message={`No ${selectedType} usage recorded for the selected filters.`}
          />
        </div>
      ) : (
        <div className="mt-4 h-[280px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="consumablesUsageFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#218EE7" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#218EE7" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8F3FE" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#5499BF', fontSize: 11 }}
                axisLine={{ stroke: '#D3E9FC' }}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                tick={{ fill: '#5499BF', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={(value) => `${value} ${data.unit}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null
                  const point = payload[0].payload as (typeof data.points)[number]
                  return (
                    <div className="rounded-xl border border-[#D3E9FC] bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:shadow-black/40">
                      <p className="font-semibold text-[#113C69] dark:text-slate-100">{point.label}</p>
                      <p className="mt-0.5 text-[#5499BF]">{point.consumableType}</p>
                      <p className="mt-0.5 tabular-nums text-[#3D7A9C]">
                        {formatSummaryQuantity(point.quantity)} {point.unit}
                      </p>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="quantity"
                stroke="#0B68BE"
                strokeWidth={2.5}
                fill="url(#consumablesUsageFill)"
                dot={{ r: 3, fill: '#218EE7', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
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
        className="group/row cursor-pointer border-b border-[#D3E9FC]/70 bg-white transition-colors hover:bg-[#F8FBFF] dark:border-white/10 dark:bg-slate-900/70 dark:hover:bg-slate-800/50"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getConsumableTypeBadgeClass(row.consumableType)}`}
          >
            {row.consumableType}
          </span>
        </td>
        <td className="px-4 py-3 text-sm font-semibold tabular-nums text-[#113C69] dark:text-slate-100">
          {formatSummaryQuantity(row.totalQuantity)}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-[#113C69] dark:text-slate-100">{row.unit}</td>
        <td className="px-4 py-3 text-sm font-semibold tabular-nums text-emerald-600">
          {formatConsumableCost(row.totalCost)}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-[#113C69] dark:text-slate-100">
          {formatEntryCount(row.entryCount)}
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-[#113C69] dark:text-slate-100">{row.vehiclesUsed}</td>
        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[#113C69] dark:text-slate-100">
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
    <article className="overflow-hidden rounded-2xl border border-[#D3E9FC] bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/70">
      <button type="button" onClick={onToggle} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getConsumableTypeBadgeClass(row.consumableType)}`}
            >
              {row.consumableType}
            </span>
            <p className="mt-2 text-lg font-bold text-[#113C69] dark:text-slate-100">
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
            <dd className="font-semibold text-[#113C69] dark:text-slate-100">{formatEntryCount(row.entryCount)}</dd>
          </div>
          <div>
            <dt>Vehicles</dt>
            <dd className="font-semibold text-[#113C69] dark:text-slate-100">{row.vehiclesUsed}</dd>
          </div>
          <div>
            <dt>Last entry</dt>
            <dd className="font-medium text-[#113C69] dark:text-slate-100">
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
                className="border-b border-[#D3E9FC]/70 bg-white/50 transition-colors hover:bg-[#F1F7FE] dark:border-white/10 dark:bg-slate-900/50 dark:hover:bg-slate-800/50"
              >
                <td className="px-3 py-2.5 text-sm font-semibold text-[#113C69] dark:text-slate-100">
                  {item.vehicleLabel ?? item.vehicleId ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-[#113C69] dark:text-slate-100">
                  {formatSummaryQuantity(item.totalQuantity)} {unit}
                </td>
                <td className="px-3 py-2.5 text-sm font-semibold text-emerald-600">
                  {formatConsumableCost(item.totalCost)}
                </td>
                <td className="px-3 py-2.5 text-sm font-medium text-[#113C69] dark:text-slate-100">
                  {formatEntryCount(item.entryCount)}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-sm font-medium text-[#113C69] dark:text-slate-100">
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
            className="rounded-xl border border-[#D3E9FC] bg-white/80 p-3 dark:border-white/10 dark:bg-slate-900/70"
          >
            <p className="font-semibold text-[#113C69] dark:text-slate-100">
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

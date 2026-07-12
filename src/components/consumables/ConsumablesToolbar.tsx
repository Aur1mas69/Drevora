import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CONSUMABLE_TYPES,
  type ConsumableSummaryPeriod,
  type ConsumableType,
} from '@/lib/consumableTypes'
import type { Vehicle } from '@/services/vehiclesService'
import { Filter, Plus, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export type ConsumablesViewMode = 'current' | 'history'

export type ConsumablesFilterValues = {
  period: ConsumableSummaryPeriod
  customDateFrom: string
  customDateTo: string
  vehicleId: string
  chartType: ConsumableType
  viewMode: ConsumablesViewMode
}

export const DEFAULT_CONSUMABLES_FILTERS: ConsumablesFilterValues = {
  period: 'this_month',
  customDateFrom: '',
  customDateTo: '',
  vehicleId: 'all',
  chartType: 'AdBlue',
  viewMode: 'current',
}

const PERIOD_OPTIONS: { value: ConsumableSummaryPeriod; label: string }[] = [
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'this_year', label: 'This year' },
  { value: 'all_time', label: 'All time' },
  { value: 'custom', label: 'Custom' },
]

const selectClassName =
  'h-9 w-full rounded-xl border border-[#BFE3F5] bg-white px-3 text-sm font-medium text-[#113C69] shadow-sm outline-none transition-colors hover:border-[#218EE7] focus:border-[#218EE7] focus:ring-2 focus:ring-[#218EE7]/20'

const filterPanelClass =
  'z-40 w-full max-h-[min(85dvh,40rem)] overflow-y-auto rounded-t-[20px] border border-[#C5DFFB] bg-gradient-to-br from-white to-[#F5FAFF] p-4 shadow-[0_16px_40px_rgba(33,142,231,0.12)] ring-1 ring-[#D3E9FC]/60 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 sm:absolute sm:left-0 sm:top-[calc(100%+0.5rem)] sm:max-h-none sm:w-[min(100vw-2rem,22rem)] sm:overflow-visible sm:rounded-[16px]'

type ConsumablesToolbarProps = {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  filters: ConsumablesFilterValues
  vehicles: Vehicle[]
  hasActiveFilters: boolean
  onApplyFilters: (filters: ConsumablesFilterValues) => void
  onResetFilters: () => void
  onCleanCurrentView: () => void
  onNewRecord: () => void
}

function isCustomRangeComplete(filters: ConsumablesFilterValues): boolean {
  if (filters.period !== 'custom') return true
  return Boolean(filters.customDateFrom && filters.customDateTo)
}

export function ConsumablesToolbar({
  searchTerm,
  onSearchTermChange,
  filters,
  vehicles,
  hasActiveFilters,
  onApplyFilters,
  onResetFilters,
  onCleanCurrentView,
  onNewRecord,
}: ConsumablesToolbarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [draft, setDraft] = useState<ConsumablesFilterValues>(filters)
  const [customDateError, setCustomDateError] = useState<string | null>(null)
  const filtersRef = useRef<HTMLDivElement>(null)

  const sortedVehicles = [...vehicles].sort((a, b) =>
    a.registration.localeCompare(b.registration),
  )

  useEffect(() => {
    if (!isFiltersOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setIsFiltersOpen(false)
        setCustomDateError(null)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsFiltersOpen(false)
        setCustomDateError(null)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isFiltersOpen])

  function openFilters() {
    setDraft(filters)
    setCustomDateError(null)
    setIsFiltersOpen(true)
  }

  function applyFilters() {
    if (!isCustomRangeComplete(draft)) {
      setCustomDateError('Select both start and end dates for a custom range.')
      return
    }
    setCustomDateError(null)
    onApplyFilters(draft)
    setIsFiltersOpen(false)
  }

  function resetFilters() {
    setDraft(DEFAULT_CONSUMABLES_FILTERS)
    onResetFilters()
    setCustomDateError(null)
    setIsFiltersOpen(false)
  }

  return (
    <div className="rounded-[18px] border border-[#D3E9FC] bg-white/80 p-3 shadow-sm shadow-[#BDDDFB]/20">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <div className="relative w-full min-w-0 sm:w-[360px] lg:w-[420px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#3D7A9C]" />
            <Input
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search item, supplier, site..."
              className="h-11 rounded-xl border-[#D3E9FC] bg-white/90 pl-9 text-sm font-medium text-[#113C69] placeholder:text-[#3D7A9C]/70 focus-visible:ring-[#BFE3F5]"
              aria-label="Search consumables"
            />
          </div>

          <div className="flex items-center gap-2 sm:contents">
          <div ref={filtersRef} className="relative shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => (isFiltersOpen ? setIsFiltersOpen(false) : openFilters())}
              className="h-11 rounded-xl border-[#D3E9FC] bg-white px-3 text-sm font-semibold text-[#0B68BE] hover:bg-[#F5FAFF]"
              aria-expanded={isFiltersOpen}
              aria-haspopup="dialog"
            >
              <Filter className="mr-1.5 size-4" />
              Filters
              {hasActiveFilters ? (
                <span className="ml-1.5 size-2 rounded-full bg-[#218EE7]" aria-label="Filters active" />
              ) : null}
            </Button>

            {isFiltersOpen ? (
              <>
                <div
                  className="fixed inset-0 z-30 bg-[#113C69]/20 sm:hidden"
                  aria-hidden="true"
                  onClick={() => {
                    setIsFiltersOpen(false)
                    setCustomDateError(null)
                  }}
                />
                <div
                  className={filterPanelClass}
                  role="dialog"
                  aria-label="Consumables filters"
                >
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-[#5499BF]">Period</span>
                    <select
                      value={draft.period}
                      onChange={(event) => {
                        setDraft((current) => ({
                          ...current,
                          period: event.target.value as ConsumableSummaryPeriod,
                        }))
                        setCustomDateError(null)
                      }}
                      className={selectClassName}
                      aria-label="Period"
                    >
                      {PERIOD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {draft.period === 'custom' ? (
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-semibold text-[#5499BF]">Start date</span>
                        <Input
                          type="date"
                          value={draft.customDateFrom}
                          onChange={(event) => {
                            setDraft((current) => ({
                              ...current,
                              customDateFrom: event.target.value,
                            }))
                            setCustomDateError(null)
                          }}
                          className="h-9 rounded-xl border-[#BFE3F5] bg-white text-sm"
                          aria-label="Start date"
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-xs font-semibold text-[#5499BF]">End date</span>
                        <Input
                          type="date"
                          value={draft.customDateTo}
                          onChange={(event) => {
                            setDraft((current) => ({
                              ...current,
                              customDateTo: event.target.value,
                            }))
                            setCustomDateError(null)
                          }}
                          className="h-9 rounded-xl border-[#BFE3F5] bg-white text-sm"
                          aria-label="End date"
                        />
                      </label>
                    </div>
                  ) : null}

                  <label className="mt-3 block space-y-1.5">
                    <span className="text-xs font-semibold text-[#5499BF]">Vehicle</span>
                    <select
                      value={draft.vehicleId}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          vehicleId: event.target.value,
                        }))
                      }
                      className={selectClassName}
                      aria-label="Vehicle"
                    >
                      <option value="all">All vehicles</option>
                      {sortedVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.registration}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-3 block space-y-1.5">
                    <span className="text-xs font-semibold text-[#5499BF]">Consumable type</span>
                    <select
                      value={draft.chartType}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          chartType: event.target.value as ConsumableType,
                        }))
                      }
                      className={selectClassName}
                      aria-label="Consumable type"
                    >
                      {CONSUMABLE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-3 block space-y-1.5">
                    <span className="text-xs font-semibold text-[#5499BF]">View</span>
                    <select
                      value={draft.viewMode}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          viewMode: event.target.value as ConsumablesViewMode,
                        }))
                      }
                      className={selectClassName}
                      aria-label="View"
                    >
                      <option value="current">Current view</option>
                      <option value="history">History view</option>
                    </select>
                  </label>

                  {customDateError ? (
                    <p className="mt-3 text-xs font-medium text-rose-600">{customDateError}</p>
                  ) : null}

                  <div className="mt-4 flex flex-col gap-2">
                    <Button
                      type="button"
                      onClick={applyFilters}
                      className="h-9 w-full rounded-[12px] bg-[#0B68BE] text-sm font-semibold text-white hover:bg-[#0958A3]"
                    >
                      Apply Filters
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={resetFilters}
                      className="h-9 w-full rounded-[12px] text-sm font-semibold text-[#0B68BE] hover:bg-[#EEF6FF]"
                    >
                      <X className="mr-1.5 size-4" />
                      Reset Filters
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setIsFiltersOpen(false)
                        setCustomDateError(null)
                        onCleanCurrentView()
                      }}
                      className="h-9 w-full rounded-[12px] border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                    >
                      Clean Current View
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </div>

        <Button
          type="button"
          onClick={onNewRecord}
          className="h-11 shrink-0 rounded-xl bg-[#218EE7] px-4 text-sm font-semibold text-white hover:bg-[#0B68BE] sm:hidden"
        >
          <Plus className="mr-1.5 size-4" />
          Add Consumable
        </Button>
          </div>
        </div>

        <Button
          type="button"
          onClick={onNewRecord}
          className="hidden h-11 shrink-0 rounded-xl bg-[#218EE7] px-4 text-sm font-semibold text-white hover:bg-[#0B68BE] sm:inline-flex"
        >
          <Plus className="mr-1.5 size-4" />
          Add Consumable
        </Button>
      </div>
    </div>
  )
}

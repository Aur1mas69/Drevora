import { ModuleListToolbar } from '@/components/common/ModuleListToolbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CONSUMABLE_TYPES,
  type ConsumableSummaryPeriod,
  type ConsumableType,
} from '@/lib/consumableTypes'
import type { Vehicle } from '@/services/vehiclesService'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type ConsumablesViewMode = 'current' | 'history' | 'all'

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
  'h-9 w-full rounded-xl border border-[#BFE3F5] bg-white px-3 text-sm font-medium text-[#113C69] shadow-sm outline-none transition-colors hover:border-[#218EE7] focus:border-[#218EE7] focus:ring-2 focus:ring-[#218EE7]/20 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-slate-600'

const filterPanelClassName =
  'max-h-[min(85dvh,40rem)] overflow-y-auto rounded-2xl border border-[#C5DFFB] bg-gradient-to-br from-white to-[#F5FAFF] p-4 shadow-[0_16px_40px_rgba(33,142,231,0.12)] ring-1 ring-[#D3E9FC]/60'

const cleanCurrentViewButtonClass =
  'h-9 w-full rounded-[12px] border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-800'

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

type FilterPanelPosition = {
  top: number
  right: number
}

function countActivePanelFilters(filters: ConsumablesFilterValues): number {
  let count = 0
  if (filters.period !== DEFAULT_CONSUMABLES_FILTERS.period) count += 1
  if (filters.vehicleId !== DEFAULT_CONSUMABLES_FILTERS.vehicleId) count += 1
  if (filters.chartType !== DEFAULT_CONSUMABLES_FILTERS.chartType) count += 1
  if (filters.period === 'custom' && (filters.customDateFrom || filters.customDateTo)) {
    count += 1
  }
  return count
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
  onApplyFilters,
  onResetFilters,
  onCleanCurrentView,
  onNewRecord,
}: ConsumablesToolbarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [draft, setDraft] = useState<ConsumablesFilterValues>(filters)
  const [customDateError, setCustomDateError] = useState<string | null>(null)
  const [panelPosition, setPanelPosition] = useState<FilterPanelPosition>({ top: 0, right: 16 })
  const filterRootRef = useRef<HTMLDivElement>(null)
  const filterDesktopPanelRef = useRef<HTMLDivElement>(null)
  const filterMobilePanelRef = useRef<HTMLDivElement>(null)

  const sortedVehicles = [...vehicles].sort((a, b) =>
    a.registration.localeCompare(b.registration),
  )

  const activeFilterCount = useMemo(() => countActivePanelFilters(filters), [filters])

  useEffect(() => {
    if (!isFiltersOpen) return
    setDraft(filters)
    setCustomDateError(null)
  }, [isFiltersOpen, filters])

  useEffect(() => {
    if (!isFiltersOpen) return

    function updatePanelPosition() {
      const anchor = filterRootRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const width = Math.min(352, window.innerWidth - 32)
      const right = Math.max(
        16,
        Math.min(window.innerWidth - rect.right, window.innerWidth - width - 16),
      )
      setPanelPosition({
        top: Math.min(rect.bottom + 12, window.innerHeight - 48),
        right,
      })
    }

    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [isFiltersOpen])

  useEffect(() => {
    if (!isFiltersOpen) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        filterRootRef.current?.contains(target) ||
        filterDesktopPanelRef.current?.contains(target) ||
        filterMobilePanelRef.current?.contains(target)
      ) {
        return
      }
      setIsFiltersOpen(false)
      setCustomDateError(null)
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

  function handleCleanCurrentView() {
    setIsFiltersOpen(false)
    setCustomDateError(null)
    onCleanCurrentView()
  }

  const filterPanelBody = (
    <>
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
              className="h-9 rounded-xl border-[#BFE3F5] bg-white text-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
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
              className="h-9 rounded-xl border-[#BFE3F5] bg-white text-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
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
          <option value="history">History</option>
          <option value="all">All</option>
        </select>
      </label>

      {customDateError ? (
        <p className="mt-3 text-xs font-medium text-rose-600">{customDateError}</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 border-t border-[#D3E9FC] pt-3">
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
          className="h-9 w-full rounded-[12px] text-sm font-semibold text-[#0B68BE] hover:bg-[#EEF6FF] dark:text-blue-300 dark:hover:bg-slate-800/50"
        >
          <X className="mr-1.5 size-4" />
          Reset Filters
        </Button>
        {draft.viewMode === 'current' ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handleCleanCurrentView}
            className={cleanCurrentViewButtonClass}
          >
            Clean Current View
          </Button>
        ) : null}
      </div>
    </>
  )

  const desktopFilterPanel =
    isFiltersOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={filterDesktopPanelRef}
            role="dialog"
            aria-label="Consumables filters"
            className={`fixed z-[60] hidden w-[22rem] max-w-[calc(100vw-2rem)] md:block ${filterPanelClassName}`}
            style={{ top: panelPosition.top, right: panelPosition.right }}
          >
            {filterPanelBody}
          </div>,
          document.body,
        )
      : null

  const mobileFilterSheet =
    isFiltersOpen && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[60] md:hidden">
            <button
              type="button"
              aria-label="Close filters"
              className="absolute inset-0 bg-[#113C69]/20"
              onClick={() => {
                setIsFiltersOpen(false)
                setCustomDateError(null)
              }}
            />
            <div
              ref={filterMobilePanelRef}
              role="dialog"
              aria-label="Consumables filters"
              className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[20px] border border-[#C5DFFB] bg-gradient-to-br from-white to-[#F5FAFF] p-4 pb-8 shadow-2xl"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D3E9FC]" />
              {filterPanelBody}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <ModuleListToolbar
        primaryActionLabel="Add Consumable"
        onPrimaryAction={onNewRecord}
        searchValue={searchTerm}
        onSearchChange={onSearchTermChange}
        searchPlaceholder="Search item, supplier, site..."
        onFilterToggle={() => setIsFiltersOpen((open) => !open)}
        filterOpen={isFiltersOpen}
        activeFilterCount={activeFilterCount}
        filterAnchorRef={filterRootRef}
      />
      {desktopFilterPanel}
      {mobileFilterSheet}
    </>
  )
}

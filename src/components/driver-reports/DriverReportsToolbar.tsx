import { ModuleListToolbar } from '@/components/common/ModuleListToolbar'
import { Button } from '@/components/ui/button'
import {
  DRIVER_REPORT_PRIORITIES,
  DRIVER_REPORT_STATUSES,
  DRIVER_REPORT_TYPES,
  type DriverReportPriorityFilter,
  type DriverReportStatusFilter,
  type DriverReportTypeFilter,
} from '@/lib/driverReportTypes'
import type { CurrentViewMode } from '@/lib/currentViewVisibility'
import type { Driver } from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { driverReportSelectClass } from './driverReportUiStyles'

type FilterDraft = {
  statusFilter: DriverReportStatusFilter
  typeFilter: DriverReportTypeFilter
  priorityFilter: DriverReportPriorityFilter
  workerFilter: string
  vehicleFilter: string
  dateFrom: string
  dateTo: string
  visibilityMode: CurrentViewMode
}

type DriverReportsToolbarProps = {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  statusFilter: DriverReportStatusFilter
  onStatusFilterChange: (value: DriverReportStatusFilter) => void
  typeFilter: DriverReportTypeFilter
  onTypeFilterChange: (value: DriverReportTypeFilter) => void
  priorityFilter: DriverReportPriorityFilter
  onPriorityFilterChange: (value: DriverReportPriorityFilter) => void
  workerFilter: string
  onWorkerFilterChange: (value: string) => void
  vehicleFilter: string
  onVehicleFilterChange: (value: string) => void
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
  visibilityMode: CurrentViewMode
  onVisibilityModeChange: (value: CurrentViewMode) => void
  workers: Driver[]
  vehicles: Vehicle[]
  onClearFilters: () => void
  onCleanCurrentView: () => void
  onAddReport: () => void
}

const labelClassName =
  'text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]'

const filterPanelClassName =
  'max-h-[min(85dvh,40rem)] overflow-y-auto rounded-2xl border border-[#C5DFFB] bg-gradient-to-br from-white to-[#F5FAFF] p-4 shadow-[0_16px_40px_rgba(33,142,231,0.12)] ring-1 ring-[#D3E9FC]/60'

const cleanCurrentViewButtonClass =
  'h-9 w-full rounded-[12px] border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-800'

type FilterPanelPosition = {
  top: number
  right: number
}

function countActivePanelFilters(draft: Omit<FilterDraft, never>): number {
  return (
    (draft.statusFilter !== 'all' ? 1 : 0) +
    (draft.typeFilter !== 'all' ? 1 : 0) +
    (draft.priorityFilter !== 'all' ? 1 : 0) +
    (draft.workerFilter !== 'all' ? 1 : 0) +
    (draft.vehicleFilter !== 'all' ? 1 : 0) +
    (draft.dateFrom ? 1 : 0) +
    (draft.dateTo ? 1 : 0)
  )
}

function buildDraftFromProps(props: DriverReportsToolbarProps): FilterDraft {
  return {
    statusFilter: props.statusFilter,
    typeFilter: props.typeFilter,
    priorityFilter: props.priorityFilter,
    workerFilter: props.workerFilter,
    vehicleFilter: props.vehicleFilter,
    dateFrom: props.dateFrom,
    dateTo: props.dateTo,
    visibilityMode: props.visibilityMode,
  }
}

function DriverReportsFilterPanelBody({
  draft,
  setDraft,
  workers,
  vehicles,
  onClear,
  onApply,
  onCleanCurrentView,
}: {
  draft: FilterDraft
  setDraft: Dispatch<SetStateAction<FilterDraft>>
  workers: Driver[]
  vehicles: Vehicle[]
  onClear: () => void
  onApply: () => void
  onCleanCurrentView: () => void
}) {
  const sortedWorkers = [...workers].sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
  )
  const sortedVehicles = [...vehicles].sort((a, b) =>
    a.registration.localeCompare(b.registration),
  )

  return (
    <>
      <div className="space-y-3">
        <label className="block">
          <span className={labelClassName}>Status</span>
          <select
            value={draft.statusFilter}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                statusFilter: event.target.value as DriverReportStatusFilter,
              }))
            }
            className={`${driverReportSelectClass} mt-1 w-full`}
          >
            <option value="all">All statuses</option>
            {DRIVER_REPORT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClassName}>Report type</span>
          <select
            value={draft.typeFilter}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                typeFilter: event.target.value as DriverReportTypeFilter,
              }))
            }
            className={`${driverReportSelectClass} mt-1 w-full`}
          >
            <option value="all">All types</option>
            {DRIVER_REPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClassName}>Priority</span>
          <select
            value={draft.priorityFilter}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                priorityFilter: event.target.value as DriverReportPriorityFilter,
              }))
            }
            className={`${driverReportSelectClass} mt-1 w-full`}
          >
            <option value="all">All priorities</option>
            {DRIVER_REPORT_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
            <option value="critical_high">Critical / High</option>
          </select>
        </label>

        <label className="block">
          <span className={labelClassName}>Worker</span>
          <select
            value={draft.workerFilter}
            onChange={(event) =>
              setDraft((current) => ({ ...current, workerFilter: event.target.value }))
            }
            className={`${driverReportSelectClass} mt-1 w-full`}
          >
            <option value="all">All workers</option>
            {sortedWorkers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.firstName} {worker.lastName}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClassName}>Vehicle</span>
          <select
            value={draft.vehicleFilter}
            onChange={(event) =>
              setDraft((current) => ({ ...current, vehicleFilter: event.target.value }))
            }
            className={`${driverReportSelectClass} mt-1 w-full`}
          >
            <option value="all">All vehicles</option>
            {sortedVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration}
                {vehicle.fleetNumber ? ` · ${vehicle.fleetNumber}` : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={labelClassName}>From</span>
            <input
              type="date"
              value={draft.dateFrom}
              onChange={(event) =>
                setDraft((current) => ({ ...current, dateFrom: event.target.value }))
              }
              className={`${driverReportSelectClass} mt-1 w-full`}
            />
          </label>
          <label className="block">
            <span className={labelClassName}>To</span>
            <input
              type="date"
              value={draft.dateTo}
              onChange={(event) =>
                setDraft((current) => ({ ...current, dateTo: event.target.value }))
              }
              className={`${driverReportSelectClass} mt-1 w-full`}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClassName}>View</span>
          <select
            value={draft.visibilityMode}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                visibilityMode: event.target.value as CurrentViewMode,
              }))
            }
            className={`${driverReportSelectClass} mt-1 w-full`}
            aria-label="View"
          >
            <option value="current">Current view</option>
            <option value="history">History</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-[#D3E9FC] pt-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClear}
            className="h-9 rounded-[10px] px-3 text-xs font-semibold text-[#0D477F] hover:bg-[#E8F3FE]"
          >
            Reset
          </Button>
          <Button
            type="button"
            onClick={onApply}
            className="h-9 rounded-[10px] bg-[#218EE7] px-4 text-xs font-semibold text-white hover:bg-[#0B68BE]"
          >
            Apply
          </Button>
        </div>
        {draft.visibilityMode === 'current' ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCleanCurrentView}
            className={cleanCurrentViewButtonClass}
          >
            Clean Current View
          </Button>
        ) : null}
      </div>
    </>
  )
}

export function DriverReportsToolbar(props: DriverReportsToolbarProps) {
  const {
    searchTerm,
    onSearchTermChange,
    statusFilter,
    typeFilter,
    priorityFilter,
    workerFilter,
    vehicleFilter,
    dateFrom,
    dateTo,
    visibilityMode,
    onStatusFilterChange,
    onTypeFilterChange,
    onPriorityFilterChange,
    onWorkerFilterChange,
    onVehicleFilterChange,
    onDateFromChange,
    onDateToChange,
    onVisibilityModeChange,
    workers,
    vehicles,
    onClearFilters,
    onCleanCurrentView,
    onAddReport,
  } = props

  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [draft, setDraft] = useState<FilterDraft>(() => buildDraftFromProps(props))
  const [panelPosition, setPanelPosition] = useState<FilterPanelPosition>({ top: 0, right: 16 })
  const filterRootRef = useRef<HTMLDivElement>(null)
  const filterDesktopPanelRef = useRef<HTMLDivElement>(null)
  const filterMobilePanelRef = useRef<HTMLDivElement>(null)

  const activeFilterCount = useMemo(
    () =>
      countActivePanelFilters({
        statusFilter,
        typeFilter,
        priorityFilter,
        workerFilter,
        vehicleFilter,
        dateFrom,
        dateTo,
        visibilityMode,
      }),
    [
      dateFrom,
      dateTo,
      priorityFilter,
      statusFilter,
      typeFilter,
      vehicleFilter,
      visibilityMode,
      workerFilter,
    ],
  )

  useEffect(() => {
    if (!isFilterOpen) return
    setDraft(buildDraftFromProps(props))
  }, [
    isFilterOpen,
    statusFilter,
    typeFilter,
    priorityFilter,
    workerFilter,
    vehicleFilter,
    dateFrom,
    dateTo,
    visibilityMode,
  ])

  useEffect(() => {
    if (!isFilterOpen) return

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
  }, [isFilterOpen])

  useEffect(() => {
    if (!isFilterOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsFilterOpen(false)
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        filterRootRef.current?.contains(target) ||
        filterDesktopPanelRef.current?.contains(target) ||
        filterMobilePanelRef.current?.contains(target)
      ) {
        return
      }
      setIsFilterOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isFilterOpen])

  function handleApplyFilters() {
    onStatusFilterChange(draft.statusFilter)
    onTypeFilterChange(draft.typeFilter)
    onPriorityFilterChange(draft.priorityFilter)
    onWorkerFilterChange(draft.workerFilter)
    onVehicleFilterChange(draft.vehicleFilter)
    onDateFromChange(draft.dateFrom)
    onDateToChange(draft.dateTo)
    onVisibilityModeChange(draft.visibilityMode)
    setIsFilterOpen(false)
  }

  function handleClearFilters() {
    onClearFilters()
    setDraft({
      statusFilter: 'all',
      typeFilter: 'all',
      priorityFilter: 'all',
      workerFilter: 'all',
      vehicleFilter: 'all',
      dateFrom: '',
      dateTo: '',
      visibilityMode: 'current',
    })
    setIsFilterOpen(false)
  }

  function handleCleanCurrentView() {
    setIsFilterOpen(false)
    onCleanCurrentView()
  }

  const desktopFilterPanel =
    isFilterOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={filterDesktopPanelRef}
            role="dialog"
            aria-label="Driver report filters"
            className={`fixed z-[60] hidden w-[22rem] max-w-[calc(100vw-2rem)] md:block ${filterPanelClassName}`}
            style={{ top: panelPosition.top, right: panelPosition.right }}
          >
            <DriverReportsFilterPanelBody
              draft={draft}
              setDraft={setDraft}
              workers={workers}
              vehicles={vehicles}
              onClear={handleClearFilters}
              onApply={handleApplyFilters}
              onCleanCurrentView={handleCleanCurrentView}
            />
          </div>,
          document.body,
        )
      : null

  const mobileFilterSheet =
    isFilterOpen && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[60] md:hidden">
            <button
              type="button"
              aria-label="Close filters"
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
              onClick={() => setIsFilterOpen(false)}
            />
            <div
              ref={filterMobilePanelRef}
              role="dialog"
              aria-label="Driver report filters"
              className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[24px] border border-[#C5DFFB] bg-[#F5FAFF] p-5 pb-8 shadow-2xl"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D3E9FC]" />
              <DriverReportsFilterPanelBody
                draft={draft}
                setDraft={setDraft}
                workers={workers}
                vehicles={vehicles}
                onClear={handleClearFilters}
                onApply={handleApplyFilters}
                onCleanCurrentView={handleCleanCurrentView}
              />
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <ModuleListToolbar
        primaryActionLabel="New Report"
        onPrimaryAction={onAddReport}
        searchValue={searchTerm}
        onSearchChange={onSearchTermChange}
        searchPlaceholder="Search reports…"
        onFilterToggle={() => setIsFilterOpen((open) => !open)}
        filterOpen={isFilterOpen}
        activeFilterCount={activeFilterCount}
        filterAnchorRef={filterRootRef}
      />
      {desktopFilterPanel}
      {mobileFilterSheet}
    </>
  )
}

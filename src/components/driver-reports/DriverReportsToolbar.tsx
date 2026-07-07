import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DRIVER_REPORT_PRIORITIES,
  DRIVER_REPORT_STATUSES,
  DRIVER_REPORT_TYPES,
  type DriverReportPriorityFilter,
  type DriverReportStatusFilter,
  type DriverReportTypeFilter,
} from '@/lib/driverReportTypes'
import type { Driver } from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'
import type { CurrentViewMode } from '@/lib/currentViewVisibility'
import { Filter, Plus, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  driverReportPrimaryButtonClass,
  driverReportSearchInputClass,
  driverReportSelectClass,
  driverReportToolbarClass,
} from './driverReportUiStyles'

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

const filterPanelClass =
  'absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(100vw-2rem,22rem)] rounded-[16px] border border-[#C5DFFB] bg-gradient-to-br from-white to-[#F5FAFF] p-4 shadow-[0_16px_40px_rgba(33,142,231,0.12)] ring-1 ring-[#D3E9FC]/60'

export function DriverReportsToolbar({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  workerFilter,
  onWorkerFilterChange,
  vehicleFilter,
  onVehicleFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  visibilityMode,
  onVisibilityModeChange,
  workers,
  vehicles,
  onClearFilters,
  onCleanCurrentView,
  onAddReport,
}: DriverReportsToolbarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (priorityFilter !== 'all' ? 1 : 0) +
    (workerFilter !== 'all' ? 1 : 0) +
    (vehicleFilter !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)

  useEffect(() => {
    if (!isFiltersOpen) return
    function handlePointerDown(event: MouseEvent) {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setIsFiltersOpen(false)
      }
    }
    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [isFiltersOpen])

  const sortedWorkers = [...workers].sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
  )
  const sortedVehicles = [...vehicles].sort((a, b) =>
    a.registration.localeCompare(b.registration),
  )

  return (
    <div className={`${driverReportToolbarClass} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5499BF]" />
          <Input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search reports…"
            className={driverReportSearchInputClass}
          />
        </div>

        <div className="inline-flex shrink-0 rounded-[14px] border border-[#C5DFFB] bg-white p-1 shadow-sm">
          {(['current', 'history', 'all'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onVisibilityModeChange(mode)}
              className={`rounded-[10px] px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                visibilityMode === mode
                  ? 'bg-[#E8F3FE] text-[#0B68BE]'
                  : 'text-[#3D7A9C] hover:bg-[#F5FAFF]'
              }`}
            >
              {mode === 'current' ? 'Current' : mode === 'history' ? 'History' : 'All'}
            </button>
          ))}
        </div>

        <div className="relative shrink-0" ref={filtersRef}>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsFiltersOpen((open) => !open)}
            className="h-10 rounded-[14px] border-[#C5DFFB] bg-white px-3.5 text-sm font-semibold text-[#0B68BE] hover:bg-[#F5FAFF]"
          >
            <Filter className="mr-1.5 size-4" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-[#218EE7] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>

          {isFiltersOpen ? (
            <div className={filterPanelClass}>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#113C69]">Filters</p>
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="text-xs font-semibold text-[#0B68BE] hover:underline"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                    Status
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      onStatusFilterChange(event.target.value as DriverReportStatusFilter)
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
                  <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                    Report type
                  </span>
                  <select
                    value={typeFilter}
                    onChange={(event) =>
                      onTypeFilterChange(event.target.value as DriverReportTypeFilter)
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
                  <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                    Priority
                  </span>
                  <select
                    value={priorityFilter}
                    onChange={(event) =>
                      onPriorityFilterChange(event.target.value as DriverReportPriorityFilter)
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
                  <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                    Worker
                  </span>
                  <select
                    value={workerFilter}
                    onChange={(event) => onWorkerFilterChange(event.target.value)}
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
                  <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                    Vehicle
                  </span>
                  <select
                    value={vehicleFilter}
                    onChange={(event) => onVehicleFilterChange(event.target.value)}
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
                    <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                      From
                    </span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(event) => onDateFromChange(event.target.value)}
                      className={`${driverReportSelectClass} mt-1 w-full`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                      To
                    </span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(event) => onDateToChange(event.target.value)}
                      className={`${driverReportSelectClass} mt-1 w-full`}
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {activeFilterCount > 0 ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex h-10 items-center gap-1 rounded-[14px] px-2 text-sm font-semibold text-[#0B68BE] hover:bg-[#EEF6FF]"
          >
            <X className="size-4" />
            Clear
          </button>
        ) : null}

        <button
          type="button"
          onClick={onCleanCurrentView}
          className="inline-flex h-10 items-center rounded-[14px] px-2.5 text-sm font-semibold text-[#0B68BE] hover:bg-[#EEF6FF]"
        >
          Clean current view
        </button>
      </div>

      <button type="button" onClick={onAddReport} className={driverReportPrimaryButtonClass}>
        <Plus className="mr-1.5 inline size-4" />
        New Report
      </button>
    </div>
  )
}

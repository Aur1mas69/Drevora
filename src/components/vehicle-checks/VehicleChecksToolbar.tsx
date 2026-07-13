import { ModuleListToolbar } from '@/components/common/ModuleListToolbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { VehicleCheckResultFilter, VehicleCheckStatusFilter } from '@/lib/vehicleCheckTypes'
import type { Vehicle } from '@/services/vehiclesService'
import type { Driver } from '@/services/driversService'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type VehicleChecksToolbarProps = {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  statusFilter: VehicleCheckStatusFilter
  onStatusFilterChange: (value: VehicleCheckStatusFilter) => void
  resultFilter: VehicleCheckResultFilter
  onResultFilterChange: (value: VehicleCheckResultFilter) => void
  vehicleFilter: string
  onVehicleFilterChange: (value: string) => void
  workerFilter: string
  onWorkerFilterChange: (value: string) => void
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
  vehicles: Vehicle[]
  workers: Driver[]
  hasActiveFilters: boolean
  onClearFilters: () => void
  onNewCheck: () => void
}

const selectClass =
  'h-10 rounded-[12px] border border-[#C5DFFB] bg-white px-3 text-sm font-medium text-[#113C69] shadow-sm outline-none transition-colors focus:border-[#218EE7] focus:ring-2 focus:ring-[#89CFF0]/30'

const filterPanelClass =
  'absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(100vw-2rem,26rem)] overflow-hidden rounded-[18px] border border-[#C5DFFB] bg-gradient-to-br from-white to-[#F5FAFF] p-4 shadow-[0_18px_44px_rgba(33,142,231,0.14)] ring-1 ring-[#D3E9FC]/60'

const labelClass = 'text-xs font-semibold text-[#5499BF]'

export function VehicleChecksToolbar({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  resultFilter,
  onResultFilterChange,
  vehicleFilter,
  onVehicleFilterChange,
  workerFilter,
  onWorkerFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  vehicles,
  workers,
  hasActiveFilters,
  onClearFilters,
  onNewCheck,
}: VehicleChecksToolbarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)

  const sortedVehicles = useMemo(
    () => [...vehicles].sort((a, b) => a.registration.localeCompare(b.registration)),
    [vehicles],
  )

  const sortedWorkers = useMemo(
    () =>
      [...workers].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      ),
    [workers],
  )

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (statusFilter !== 'all') count += 1
    if (resultFilter !== 'all') count += 1
    if (vehicleFilter !== 'all') count += 1
    if (workerFilter !== 'all') count += 1
    if (dateFrom) count += 1
    if (dateTo) count += 1
    return count
  }, [dateFrom, dateTo, resultFilter, statusFilter, vehicleFilter, workerFilter])

  useEffect(() => {
    if (!isFiltersOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setIsFiltersOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsFiltersOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFiltersOpen])

  function handleClearFilters() {
    onClearFilters()
    setIsFiltersOpen(false)
  }

  return (
    <ModuleListToolbar
      primaryActionLabel="New Vehicle Check"
      onPrimaryAction={onNewCheck}
      searchValue={searchTerm}
      onSearchChange={onSearchTermChange}
      searchPlaceholder="Search vehicle, worker, registration or defect..."
      onFilterToggle={() => setIsFiltersOpen((open) => !open)}
      filterOpen={isFiltersOpen}
      activeFilterCount={activeFilterCount}
      filterAnchorRef={filtersRef}
      filterPanel={
        isFiltersOpen ? (
          <div
            id="vehicle-checks-filters-panel"
            className={filterPanelClass}
            role="dialog"
            aria-label="Vehicle check filters"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#113C69]">Filters</p>
                <p className="mt-0.5 text-xs text-[#5499BF]">Refine vehicle checks</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFiltersOpen(false)}
                className="rounded-[10px] p-1 text-[#5499BF] transition-colors hover:bg-[#EEF6FF] hover:text-[#0B68BE]"
                aria-label="Close filters"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <label className="block min-w-0 space-y-1.5">
                  <span className={labelClass}>Start date</span>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => onDateFromChange(event.target.value)}
                    className={`${selectClass} w-full min-w-0 px-2`}
                  />
                </label>
                <label className="block min-w-0 space-y-1.5">
                  <span className={labelClass}>End date</span>
                  <Input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(event) => onDateToChange(event.target.value)}
                    className={`${selectClass} w-full min-w-0 px-2`}
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className={labelClass}>Vehicle</span>
                <select
                  value={vehicleFilter}
                  onChange={(event) => onVehicleFilterChange(event.target.value)}
                  className={`${selectClass} w-full`}
                  aria-label="Filter by vehicle"
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

              <label className="block space-y-1.5">
                <span className={labelClass}>Worker</span>
                <select
                  value={workerFilter}
                  onChange={(event) => onWorkerFilterChange(event.target.value)}
                  className={`${selectClass} w-full`}
                  aria-label="Filter by worker"
                >
                  <option value="all">All workers</option>
                  {sortedWorkers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.firstName} {worker.lastName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className={labelClass}>Result</span>
                <select
                  value={resultFilter}
                  onChange={(event) =>
                    onResultFilterChange(event.target.value as VehicleCheckResultFilter)
                  }
                  className={`${selectClass} w-full`}
                  aria-label="Filter by result"
                >
                  <option value="all">All results</option>
                  <option value="Pass">Passed</option>
                  <option value="Fail">Failed</option>
                  <option value="Defects">Defects</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className={labelClass}>Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    onStatusFilterChange(event.target.value as VehicleCheckStatusFilter)
                  }
                  className={`${selectClass} w-full`}
                  aria-label="Filter by status"
                >
                  <option value="all">All statuses</option>
                  <option value="Completed">Completed</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#D3E9FC]/70 pt-3">
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClearFilters}
                  className="h-9 rounded-[12px] px-2.5 text-xs font-semibold text-[#5499BF] hover:bg-[#EEF6FF] hover:text-[#0B68BE]"
                >
                  Clear filters
                </Button>
              ) : (
                <span className="text-xs text-[#5499BF]">No filters applied</span>
              )}
              <Button
                type="button"
                onClick={() => setIsFiltersOpen(false)}
                className="h-9 rounded-[12px] bg-[#218EE7] px-3 text-xs font-semibold text-white hover:bg-[#1d7fd0]"
              >
                Done
              </Button>
            </div>
          </div>
        ) : null
      }
    />
  )
}

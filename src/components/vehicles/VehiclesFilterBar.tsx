import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  vehicleFilterFieldLabelClass,
  vehicleFilterPanelClass,
  vehicleSearchInputClass,
  vehicleSelectClass,
  vehicleToolbarClass,
} from '@/components/vehicles/vehicleUiStyles'
import type { DocumentFilter } from '@/lib/vehiclePageUtils'
import { vehicleStatuses } from '@/lib/vehicleForm'
import type { Driver } from '@/services/driversService'
import type { VehicleStatus } from '@/services/vehiclesService'
import { Download, Filter, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

export type StatusFilter = VehicleStatus | 'All' | 'Unavailable'

type VehiclesFilterBarProps = {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
  driverFilter: string
  onDriverFilterChange: (value: string) => void
  motFilter: DocumentFilter
  onMotFilterChange: (value: DocumentFilter) => void
  insuranceFilter: DocumentFilter
  onInsuranceFilterChange: (value: DocumentFilter) => void
  drivers: Driver[]
  onClearFilters: () => void
  onExportCsv: () => void
  hasActiveFilters: boolean
}

const documentFilterOptions: DocumentFilter[] = [
  'All',
  'Valid',
  'Expiring Soon',
  'Expired',
]

export function VehiclesFilterBar({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  driverFilter,
  onDriverFilterChange,
  motFilter,
  onMotFilterChange,
  insuranceFilter,
  onInsuranceFilterChange,
  drivers,
  onClearFilters,
  onExportCsv,
  hasActiveFilters,
}: VehiclesFilterBarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)

  const sortedDrivers = useMemo(
    () =>
      [...drivers].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      ),
    [drivers],
  )

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (statusFilter !== 'All') count += 1
    if (driverFilter !== 'All') count += 1
    if (motFilter !== 'All') count += 1
    if (insuranceFilter !== 'All') count += 1
    return count
  }, [driverFilter, insuranceFilter, motFilter, statusFilter])

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
    <div className={vehicleToolbarClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5499BF]"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search registration, fleet #, make/model, or driver…"
            className={vehicleSearchInputClass}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
          <div ref={filtersRef} className="relative">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsFiltersOpen((open) => !open)}
              aria-expanded={isFiltersOpen}
              aria-controls="vehicles-filters-panel"
              className="h-10 rounded-[14px] border border-[#C5DFFB] bg-white/90 px-3.5 text-sm font-semibold text-[#0B68BE] shadow-sm hover:bg-[#F5FAFF] hover:text-[#218EE7]"
            >
              <Filter className="mr-1.5 size-4" aria-hidden="true" />
              Filters
              {activeFilterCount > 0 ? (
                <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[#218EE7] px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>

            {isFiltersOpen ? (
              <div
                id="vehicles-filters-panel"
                className={vehicleFilterPanelClass}
                role="dialog"
                aria-label="Vehicle filters"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#113C69]">Filters</p>
                    <p className="mt-0.5 text-xs text-[#5499BF]">Refine your fleet list</p>
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

                <div className="mt-4 space-y-3">
                  <label className="block space-y-1.5">
                    <span className={vehicleFilterFieldLabelClass}>Status</span>
                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        onStatusFilterChange(event.target.value as StatusFilter)
                      }
                      className={vehicleSelectClass}
                      aria-label="Filter by status"
                    >
                      <option value="All">All statuses</option>
                      <option value="Unavailable">Off Road / OOS</option>
                      {vehicleStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className={vehicleFilterFieldLabelClass}>Driver</span>
                    <select
                      value={driverFilter}
                      onChange={(event) => onDriverFilterChange(event.target.value)}
                      className={vehicleSelectClass}
                      aria-label="Filter by driver"
                    >
                      <option value="All">All drivers</option>
                      <option value="Unassigned">Unassigned</option>
                      {sortedDrivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.firstName} {driver.lastName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className={vehicleFilterFieldLabelClass}>MOT</span>
                    <select
                      value={motFilter}
                      onChange={(event) =>
                        onMotFilterChange(event.target.value as DocumentFilter)
                      }
                      className={vehicleSelectClass}
                      aria-label="Filter by MOT status"
                    >
                      {documentFilterOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === 'All' ? 'All MOT statuses' : `MOT: ${option}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className={vehicleFilterFieldLabelClass}>Insurance</span>
                    <select
                      value={insuranceFilter}
                      onChange={(event) =>
                        onInsuranceFilterChange(event.target.value as DocumentFilter)
                      }
                      className={vehicleSelectClass}
                      aria-label="Filter by insurance status"
                    >
                      {documentFilterOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === 'All'
                            ? 'All insurance statuses'
                            : `Insurance: ${option}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {hasActiveFilters ? (
                  <div className="mt-4 border-t border-[#D3E9FC]/70 pt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="h-9 w-full rounded-[12px] text-sm font-semibold text-[#5499BF] hover:bg-[#EEF6FF] hover:text-[#0B68BE]"
                    >
                      <X className="mr-1.5 size-3.5" />
                      Clear filters
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            className="h-10 rounded-[14px] border-[#C5DFFB] bg-white/90 px-3.5 text-sm font-semibold text-[#0B68BE] shadow-sm hover:bg-[#F5FAFF] hover:text-[#218EE7]"
          >
            <Download className="mr-1.5 size-4" />
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  )
}

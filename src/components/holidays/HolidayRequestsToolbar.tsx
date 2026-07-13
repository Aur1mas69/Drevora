import { ModuleListToolbar } from '@/components/common/ModuleListToolbar'
import { Button } from '@/components/ui/button'
import { HolidayDateInput } from '@/components/holidays/HolidayDateInput'
import { HolidayDatePickerGroup } from '@/components/holidays/HolidayDatePickerGroup'
import type { HolidayRequestStatusFilter } from '@/lib/holidayRequestTypes'
import type { Driver } from '@/services/driversService'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { holidaySelectClass } from './holidayUiStyles'

type HolidayRequestsToolbarProps = {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  statusFilter: HolidayRequestStatusFilter
  onStatusFilterChange: (value: HolidayRequestStatusFilter) => void
  workerFilter: string
  onWorkerFilterChange: (value: string) => void
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
  workers: Driver[]
  onClearFilters: () => void
  onNewRequest: () => void
}

const filterPanelClass =
  'absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 w-full overflow-hidden rounded-[16px] border border-[#C5DFFB] bg-gradient-to-br from-white to-[#F5FAFF] p-4 shadow-[0_16px_40px_rgba(33,142,231,0.12)] ring-1 ring-[#D3E9FC]/60 sm:left-auto sm:right-0 sm:w-[min(100vw-2rem,22rem)]'

const filterFieldLabelClass = 'text-xs font-semibold text-[#5499BF]'

export function HolidayRequestsToolbar({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  workerFilter,
  onWorkerFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  workers,
  onClearFilters,
  onNewRequest,
}: HolidayRequestsToolbarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)

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
    if (workerFilter !== 'all') count += 1
    if (dateFrom.length > 0) count += 1
    if (dateTo.length > 0) count += 1
    return count
  }, [dateFrom, dateTo, statusFilter, workerFilter])

  const hasDropdownFilters = activeFilterCount > 0

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
      primaryActionLabel="New Holiday Request"
      onPrimaryAction={onNewRequest}
      searchValue={searchTerm}
      onSearchChange={onSearchTermChange}
      searchPlaceholder="Search by worker name..."
      onFilterToggle={() => setIsFiltersOpen((open) => !open)}
      filterOpen={isFiltersOpen}
      activeFilterCount={activeFilterCount}
      filterAnchorRef={filtersRef}
      filterPanel={
        isFiltersOpen ? (
          <div
            id="holiday-requests-filters-panel"
            className={filterPanelClass}
            role="dialog"
            aria-label="Holiday request filters"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#113C69]">Filters</p>
                <p className="mt-0.5 text-xs text-[#5499BF]">Refine holiday requests</p>
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
                <span className={filterFieldLabelClass}>Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    onStatusFilterChange(event.target.value as HolidayRequestStatusFilter)
                  }
                  className={`${holidaySelectClass} w-full`}
                  aria-label="Filter by status"
                >
                  <option value="all">All statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Declined</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className={filterFieldLabelClass}>Worker</span>
                <select
                  value={workerFilter}
                  onChange={(event) => onWorkerFilterChange(event.target.value)}
                  className={`${holidaySelectClass} w-full`}
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

              <HolidayDatePickerGroup>
                <div className="grid min-w-0 grid-cols-2 gap-2">
                  <label className="block min-w-0 space-y-1.5">
                    <span className={filterFieldLabelClass}>Start date</span>
                    <HolidayDateInput
                      value={dateFrom}
                      onChange={onDateFromChange}
                      className={`${holidaySelectClass} w-full min-w-0 px-2`}
                      aria-label="Start date"
                    />
                  </label>
                  <label className="block min-w-0 space-y-1.5">
                    <span className={filterFieldLabelClass}>End date</span>
                    <HolidayDateInput
                      value={dateTo}
                      onChange={onDateToChange}
                      min={dateFrom || undefined}
                      className={`${holidaySelectClass} w-full min-w-0 px-2`}
                      aria-label="End date"
                    />
                  </label>
                </div>
              </HolidayDatePickerGroup>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#D3E9FC]/70 pt-3">
              {hasDropdownFilters ? (
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

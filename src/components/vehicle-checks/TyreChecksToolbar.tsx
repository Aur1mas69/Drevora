import { ModuleListToolbar } from '@/components/common/ModuleListToolbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { TyreCheckResultFilter } from '@/lib/tyreCheckTypes'
import type { Driver } from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type TyreChecksToolbarProps = {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  resultFilter: TyreCheckResultFilter
  onResultFilterChange: (value: TyreCheckResultFilter) => void
  vehicleFilter: string
  onVehicleFilterChange: (value: string) => void
  workerFilter: string
  onWorkerFilterChange: (value: string) => void
  trailerFilter: string
  onTrailerFilterChange: (value: string) => void
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
  vehicles: Vehicle[]
  workers: Driver[]
  hasActiveFilters: boolean
  onClearFilters: () => void
  disabled?: boolean
  loading?: boolean
}

const selectClass =
  'h-10 rounded-[12px] border border-[#C5DFFB] bg-white px-3 text-sm font-medium text-[#113C69] shadow-sm outline-none transition-colors focus:border-[#218EE7] focus:ring-2 focus:ring-[#89CFF0]/30 dark:border-white/15 dark:bg-slate-900/70 dark:text-slate-100'

const filterPanelClass =
  'absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(100vw-2rem,26rem)] max-h-[min(70vh,36rem)] overflow-y-auto overflow-x-hidden rounded-[18px] border border-[#C5DFFB] bg-gradient-to-br from-white to-[#F5FAFF] p-4 shadow-[0_18px_44px_rgba(33,142,231,0.14)] ring-1 ring-[#D3E9FC]/60 dark:border-white/10 dark:from-slate-900 dark:to-slate-900 dark:ring-white/10'

const labelClass = 'text-xs font-semibold text-[#5499BF] dark:text-slate-400'

function isTrailerVehicle(vehicle: Vehicle): boolean {
  const type = vehicle.vehicleType?.toLowerCase() ?? ''
  return type.includes('trailer') || type.includes('low loader')
}

function vehicleOptionLabel(vehicle: Vehicle): string {
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim()
  const trailerNumber = vehicle.trailerNumber?.trim()
  if (trailerNumber) {
    return `${vehicle.registration}${makeModel ? ` · ${makeModel}` : ''} · ${trailerNumber}`
  }
  return `${vehicle.registration}${makeModel ? ` · ${makeModel}` : ''}`
}

export function TyreChecksToolbar({
  searchTerm,
  onSearchTermChange,
  resultFilter,
  onResultFilterChange,
  vehicleFilter,
  onVehicleFilterChange,
  workerFilter,
  onWorkerFilterChange,
  trailerFilter,
  onTrailerFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  vehicles,
  workers,
  hasActiveFilters,
  onClearFilters,
  disabled = false,
  loading = false,
}: TyreChecksToolbarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)

  const [draftResult, setDraftResult] = useState(resultFilter)
  const [draftVehicle, setDraftVehicle] = useState(vehicleFilter)
  const [draftWorker, setDraftWorker] = useState(workerFilter)
  const [draftTrailer, setDraftTrailer] = useState(trailerFilter)
  const [draftDateFrom, setDraftDateFrom] = useState(dateFrom)
  const [draftDateTo, setDraftDateTo] = useState(dateTo)

  const tractorVehicles = useMemo(
    () =>
      [...vehicles]
        .filter((vehicle) => !isTrailerVehicle(vehicle))
        .sort((a, b) => a.registration.localeCompare(b.registration)),
    [vehicles],
  )

  const trailerVehicles = useMemo(
    () =>
      [...vehicles]
        .filter((vehicle) => isTrailerVehicle(vehicle))
        .sort((a, b) => a.registration.localeCompare(b.registration)),
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
    if (resultFilter !== 'all') count += 1
    if (vehicleFilter !== 'all') count += 1
    if (workerFilter !== 'all') count += 1
    if (trailerFilter !== 'all') count += 1
    if (dateFrom) count += 1
    if (dateTo) count += 1
    return count
  }, [dateFrom, dateTo, resultFilter, trailerFilter, vehicleFilter, workerFilter])

  useEffect(() => {
    if (!isFiltersOpen) return
    setDraftResult(resultFilter)
    setDraftVehicle(vehicleFilter)
    setDraftWorker(workerFilter)
    setDraftTrailer(trailerFilter)
    setDraftDateFrom(dateFrom)
    setDraftDateTo(dateTo)
  }, [
    dateFrom,
    dateTo,
    isFiltersOpen,
    resultFilter,
    trailerFilter,
    vehicleFilter,
    workerFilter,
  ])

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

  function handleApplyFilters() {
    onResultFilterChange(draftResult)
    onVehicleFilterChange(draftVehicle)
    onWorkerFilterChange(draftWorker)
    onTrailerFilterChange(draftTrailer)
    onDateFromChange(draftDateFrom)
    onDateToChange(draftDateTo)
    setIsFiltersOpen(false)
  }

  function handleClearFilters() {
    setDraftResult('all')
    setDraftVehicle('all')
    setDraftWorker('all')
    setDraftTrailer('all')
    setDraftDateFrom('')
    setDraftDateTo('')
    onClearFilters()
    setIsFiltersOpen(false)
  }

  return (
    <ModuleListToolbar
      hidePrimaryAction
      searchValue={searchTerm}
      onSearchChange={onSearchTermChange}
      onSearchClear={() => onSearchTermChange('')}
      searchPlaceholder="Search vehicle, worker, registration or trailer"
      onFilterToggle={() => setIsFiltersOpen((open) => !open)}
      filterOpen={isFiltersOpen}
      activeFilterCount={activeFilterCount}
      filterAnchorRef={filtersRef}
      disabled={disabled}
      loading={loading}
      filterPanel={
        isFiltersOpen ? (
          <div
            id="tyre-checks-filters-panel"
            className={filterPanelClass}
            role="dialog"
            aria-label="Tyre check filters"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#113C69] dark:text-slate-100">
                  Filters
                </p>
                <p className="mt-0.5 text-xs text-[#5499BF] dark:text-slate-400">
                  Refine tyre check history
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFiltersOpen(false)}
                className="rounded-[10px] p-1 text-[#5499BF] transition-colors hover:bg-[#EEF6FF] hover:text-[#0B68BE] dark:hover:bg-slate-800"
                aria-label="Close filters"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 grid min-w-0 gap-3">
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <label className="block min-w-0 space-y-1.5">
                  <span className={labelClass}>From date</span>
                  <Input
                    type="date"
                    value={draftDateFrom}
                    onChange={(event) => setDraftDateFrom(event.target.value)}
                    className={`${selectClass} w-full min-w-0 px-2`}
                  />
                </label>
                <label className="block min-w-0 space-y-1.5">
                  <span className={labelClass}>To date</span>
                  <Input
                    type="date"
                    value={draftDateTo}
                    min={draftDateFrom || undefined}
                    onChange={(event) => setDraftDateTo(event.target.value)}
                    className={`${selectClass} w-full min-w-0 px-2`}
                  />
                </label>
              </div>

              <label className="block min-w-0 space-y-1.5">
                <span className={labelClass}>Result</span>
                <select
                  value={draftResult}
                  onChange={(event) =>
                    setDraftResult(event.target.value as TyreCheckResultFilter)
                  }
                  className={`${selectClass} w-full`}
                  aria-label="Filter by result"
                >
                  <option value="all">All results</option>
                  <option value="pass">Passed</option>
                  <option value="fail">Defects found</option>
                </select>
              </label>

              <label className="block min-w-0 space-y-1.5">
                <span className={labelClass}>Vehicle</span>
                <select
                  value={draftVehicle}
                  onChange={(event) => setDraftVehicle(event.target.value)}
                  className={`${selectClass} w-full`}
                  aria-label="Filter by vehicle"
                >
                  <option value="all">All vehicles</option>
                  {tractorVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicleOptionLabel(vehicle)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block min-w-0 space-y-1.5">
                <span className={labelClass}>Worker</span>
                <select
                  value={draftWorker}
                  onChange={(event) => setDraftWorker(event.target.value)}
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

              <label className="block min-w-0 space-y-1.5">
                <span className={labelClass}>Trailer</span>
                <select
                  value={draftTrailer}
                  onChange={(event) => setDraftTrailer(event.target.value)}
                  className={`${selectClass} w-full`}
                  aria-label="Filter by trailer"
                >
                  <option value="all">All trailers</option>
                  {trailerVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicleOptionLabel(vehicle)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#D3E9FC]/70 pt-3 dark:border-white/10">
              {hasActiveFilters ||
              draftResult !== 'all' ||
              draftVehicle !== 'all' ||
              draftWorker !== 'all' ||
              draftTrailer !== 'all' ||
              draftDateFrom ||
              draftDateTo ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClearFilters}
                  className="h-9 rounded-[12px] px-2.5 text-xs font-semibold text-[#5499BF] hover:bg-[#EEF6FF] hover:text-[#0B68BE] dark:hover:bg-slate-800"
                >
                  Clear all
                </Button>
              ) : (
                <span className="text-xs text-[#5499BF] dark:text-slate-400">
                  No filters applied
                </span>
              )}
              <Button
                type="button"
                onClick={handleApplyFilters}
                className="h-9 rounded-[12px] bg-[#218EE7] px-3 text-xs font-semibold text-white hover:bg-[#1d7fd0]"
              >
                Apply filters
              </Button>
            </div>
          </div>
        ) : null
      }
    />
  )
}

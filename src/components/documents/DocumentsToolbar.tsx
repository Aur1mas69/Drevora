import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type {
  DocumentAppliesToFilter,
  DocumentStatusFilter,
  DocumentTypeFilter,
} from '@/lib/documentTypes'
import { getDocumentTypesForAppliesTo } from '@/lib/documentUtils'
import type { Driver } from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'
import { Filter, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  documentPrimaryButtonClass,
  documentSearchInputClass,
  documentSelectClass,
  documentToolbarClass,
} from './documentUiStyles'

type DocumentsToolbarProps = {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  typeFilter: DocumentTypeFilter
  onTypeFilterChange: (value: DocumentTypeFilter) => void
  appliesToFilter: DocumentAppliesToFilter
  onAppliesToFilterChange: (value: DocumentAppliesToFilter) => void
  statusFilter: DocumentStatusFilter
  onStatusFilterChange: (value: DocumentStatusFilter) => void
  workerFilter: string
  onWorkerFilterChange: (value: string) => void
  vehicleFilter: string
  onVehicleFilterChange: (value: string) => void
  workers: Driver[]
  vehicles: Vehicle[]
  onClearFilters: () => void
  onAddDocument: () => void
}

const filterPanelClass =
  'absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(100vw-2rem,22rem)] rounded-[16px] border border-[#C5DFFB] bg-gradient-to-br from-white to-[#F5FAFF] p-4 shadow-[0_16px_40px_rgba(33,142,231,0.12)] ring-1 ring-[#D3E9FC]/60'

export function DocumentsToolbar({
  searchTerm,
  onSearchTermChange,
  typeFilter,
  onTypeFilterChange,
  appliesToFilter,
  onAppliesToFilterChange,
  statusFilter,
  onStatusFilterChange,
  workerFilter,
  onWorkerFilterChange,
  vehicleFilter,
  onVehicleFilterChange,
  workers,
  vehicles,
  onClearFilters,
  onAddDocument,
}: DocumentsToolbarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)

  const typeOptions = useMemo(() => {
    if (appliesToFilter !== 'all') {
      return getDocumentTypesForAppliesTo(appliesToFilter)
    }
    return [
      ...getDocumentTypesForAppliesTo('company'),
      ...getDocumentTypesForAppliesTo('worker'),
      ...getDocumentTypesForAppliesTo('vehicle'),
    ].filter((value, index, array) => array.indexOf(value) === index)
  }, [appliesToFilter])

  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (appliesToFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (workerFilter !== 'all' ? 1 : 0) +
    (vehicleFilter !== 'all' ? 1 : 0)

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
    <div className={documentToolbarClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5499BF]" />
            <Input
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search documents..."
              className={documentSearchInputClass}
              aria-label="Search documents"
            />
          </div>

          <div ref={filtersRef} className="relative shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFiltersOpen((current) => !current)}
              className="h-10 rounded-[14px] border-[#C5DFFB]/80 bg-white px-3 text-sm font-semibold text-[#0B68BE] hover:bg-[#F5FAFF]"
              aria-expanded={isFiltersOpen}
            >
              <Filter className="mr-1.5 size-4" />
              Filters
              {activeFilterCount > 0 ? (
                <span className="ml-1.5 inline-flex size-5 items-center justify-center rounded-full bg-[#218EE7] text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>

              {isFiltersOpen ? (
                <div className={filterPanelClass}>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-[#5499BF]">Applies to</span>
                    <select
                      value={appliesToFilter}
                      onChange={(event) =>
                        onAppliesToFilterChange(event.target.value as DocumentAppliesToFilter)
                      }
                      className={`${documentSelectClass} w-full`}
                    >
                      <option value="all">All scopes</option>
                      <option value="company">Company</option>
                      <option value="worker">Worker</option>
                      <option value="vehicle">Vehicle</option>
                    </select>
                  </label>

                  <label className="mt-3 block space-y-1.5">
                    <span className="text-xs font-semibold text-[#5499BF]">Document type</span>
                    <select
                      value={typeFilter}
                      onChange={(event) => onTypeFilterChange(event.target.value)}
                      className={`${documentSelectClass} w-full`}
                    >
                      <option value="all">All types</option>
                      {typeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-3 block space-y-1.5">
                    <span className="text-xs font-semibold text-[#5499BF]">Status</span>
                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        onStatusFilterChange(event.target.value as DocumentStatusFilter)
                      }
                      className={`${documentSelectClass} w-full`}
                    >
                      <option value="all">All statuses</option>
                      <option value="valid">Valid</option>
                      <option value="expiring_soon">Expiring Soon</option>
                      <option value="expired">Expired</option>
                      <option value="no_expiry">No Expiry</option>
                    </select>
                  </label>

                  <label className="mt-3 block space-y-1.5">
                    <span className="text-xs font-semibold text-[#5499BF]">Worker</span>
                    <select
                      value={workerFilter}
                      onChange={(event) => onWorkerFilterChange(event.target.value)}
                      className={`${documentSelectClass} w-full`}
                    >
                      <option value="all">All workers</option>
                      {sortedWorkers.map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          {worker.firstName} {worker.lastName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-3 block space-y-1.5">
                    <span className="text-xs font-semibold text-[#5499BF]">Vehicle</span>
                    <select
                      value={vehicleFilter}
                      onChange={(event) => onVehicleFilterChange(event.target.value)}
                      className={`${documentSelectClass} w-full`}
                    >
                      <option value="all">All vehicles</option>
                      {sortedVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.registration}
                        </option>
                      ))}
                    </select>
                  </label>

                  {activeFilterCount > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        onClearFilters()
                        setIsFiltersOpen(false)
                      }}
                      className="mt-4 h-9 w-full rounded-[12px] text-sm font-semibold text-[#0B68BE] hover:bg-[#EEF6FF]"
                    >
                      <X className="mr-1.5 size-4" />
                      Clear filters
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <Button type="button" onClick={onAddDocument} className={documentPrimaryButtonClass}>
            <Plus className="mr-1.5 size-4" />
            Add Document
          </Button>
        </div>
      </div>
  )
}

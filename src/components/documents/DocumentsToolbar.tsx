import { ModuleListToolbar } from '@/components/common/ModuleListToolbar'
import { Button } from '@/components/ui/button'
import type {
  DocumentAppliesToFilter,
  DocumentStatusFilter,
  DocumentTypeFilter,
} from '@/lib/documentTypes'
import { getDocumentTypesForAppliesTo } from '@/lib/documentUtils'
import type { Driver } from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { documentSelectClass } from './documentUiStyles'

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
    <ModuleListToolbar
      primaryActionLabel="Add Document"
      onPrimaryAction={onAddDocument}
      searchValue={searchTerm}
      onSearchChange={onSearchTermChange}
      searchPlaceholder="Search documents..."
      onFilterToggle={() => setIsFiltersOpen((current) => !current)}
      filterOpen={isFiltersOpen}
      activeFilterCount={activeFilterCount}
      filterAnchorRef={filtersRef}
      filterPanel={
        isFiltersOpen ? (
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
        ) : null
      }
    />
  )
}

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { VehicleCheckStatusFilter } from '@/lib/vehicleCheckTypes'
import { adminFilterPanel, adminSearchInput, adminSelectSm } from '@/lib/adminUiStyles'
import type { Vehicle } from '@/services/vehiclesService'
import { Filter, Plus, Search, X } from 'lucide-react'

type VehicleChecksToolbarProps = {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  statusFilter: VehicleCheckStatusFilter
  onStatusFilterChange: (value: VehicleCheckStatusFilter) => void
  vehicleFilter: string
  onVehicleFilterChange: (value: string) => void
  inspectionDate: string
  onInspectionDateChange: (value: string) => void
  vehicles: Vehicle[]
  hasActiveFilters: boolean
  onClearFilters: () => void
  onNewInspection: () => void
}

export function VehicleChecksToolbar({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  vehicleFilter,
  onVehicleFilterChange,
  inspectionDate,
  onInspectionDateChange,
  vehicles,
  hasActiveFilters,
  onClearFilters,
  onNewInspection,
}: VehicleChecksToolbarProps) {
  const sortedVehicles = [...vehicles].sort((a, b) =>
    a.registration.localeCompare(b.registration),
  )

  return (
    <div className={adminFilterPanel}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search registration or fleet no…"
            className={`${adminSearchInput} h-9 pl-8 text-sm`}
          />
        </div>

        <Button
          type="button"
          onClick={onNewInspection}
          className="h-9 rounded-[10px] bg-[#2563EB] px-3 text-xs font-semibold text-white hover:bg-[#1d4ed8]"
        >
          <Plus className="mr-1 size-3.5" />
          New Inspection
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Filter className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Filters</span>
        </div>

        <select
          value={vehicleFilter}
          onChange={(event) => onVehicleFilterChange(event.target.value)}
          className={adminSelectSm}
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

        <select
          value={statusFilter}
          onChange={(event) =>
            onStatusFilterChange(event.target.value as VehicleCheckStatusFilter)
          }
          className={adminSelectSm}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="Completed">Completed</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
        </select>

        <Input
          type="date"
          value={inspectionDate}
          onChange={(event) => onInspectionDateChange(event.target.value)}
          className={`${adminSelectSm} w-[140px] px-2`}
          aria-label="Filter by inspection date"
        />

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onClearFilters}
            className="h-9 rounded-[10px] px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
          >
            <X className="mr-1 size-3.5" />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}

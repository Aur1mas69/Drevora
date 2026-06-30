import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DocumentFilter } from '@/lib/vehiclePageUtils'
import { vehicleStatuses } from '@/lib/vehicleForm'
import type { Driver } from '@/services/driversService'
import type { VehicleStatus } from '@/services/vehiclesService'
import { Download, Search, X } from 'lucide-react'

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

const selectClassName =
  'h-10 w-full min-w-[140px] rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100'

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
  return (
    <div className="rounded-[18px] border border-[rgba(75,120,220,0.10)] bg-white p-4 shadow-[0_4px_16px_rgba(40,80,140,0.05)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative min-w-0 flex-1 xl:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search registration, fleet #, make/model, or driver…"
            className="h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] pl-10 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:flex-wrap xl:items-center">
          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(event.target.value as StatusFilter)
            }
            className={selectClassName}
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

          <select
            value={driverFilter}
            onChange={(event) => onDriverFilterChange(event.target.value)}
            className={selectClassName}
            aria-label="Filter by driver"
          >
            <option value="All">All drivers</option>
            <option value="Unassigned">Unassigned</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.firstName} {driver.lastName}
              </option>
            ))}
          </select>

          <select
            value={motFilter}
            onChange={(event) =>
              onMotFilterChange(event.target.value as DocumentFilter)
            }
            className={selectClassName}
            aria-label="Filter by MOT status"
          >
            {documentFilterOptions.map((option) => (
              <option key={option} value={option}>
                MOT: {option}
              </option>
            ))}
          </select>

          <select
            value={insuranceFilter}
            onChange={(event) =>
              onInsuranceFilterChange(event.target.value as DocumentFilter)
            }
            className={selectClassName}
            aria-label="Filter by insurance status"
          >
            {documentFilterOptions.map((option) => (
              <option key={option} value={option}>
                Insurance: {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-blue-50 pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExportCsv}
          className="h-9 rounded-[10px] border-[rgba(75,120,220,0.12)] bg-white text-sm font-semibold text-[#2563EB] hover:bg-[#EEF4FF]"
        >
          <Download className="size-3.5" />
          Export CSV
        </Button>
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-9 rounded-[10px] text-sm font-semibold text-slate-600 hover:bg-[#EEF4FF] hover:text-[#2563EB]"
          >
            <X className="size-3.5" />
            Clear Filters
          </Button>
        ) : null}
      </div>
    </div>
  )
}

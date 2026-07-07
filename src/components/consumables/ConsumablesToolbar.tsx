import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CONSUMABLE_TYPES, type ConsumableTypeFilter } from '@/lib/consumableTypes'
import { adminSelectSm } from '@/lib/adminUiStyles'
import type { Vehicle } from '@/services/vehiclesService'
import { Filter, Plus, Search, X } from 'lucide-react'
import { useState } from 'react'

type ConsumablesToolbarProps = {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  typeFilter: ConsumableTypeFilter
  onTypeFilterChange: (value: ConsumableTypeFilter) => void
  vehicleFilter: string
  onVehicleFilterChange: (value: string) => void
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
  vehicles: Vehicle[]
  hasActiveFilters: boolean
  isHistoryView: boolean
  currentPeriodLabel: string
  onClearFilters: () => void
  onCleanCurrentView: () => void
  onShowCurrentPeriod: () => void
  onShowHistory: () => void
  onNewRecord: () => void
}

export function ConsumablesToolbar({
  searchTerm,
  onSearchTermChange,
  typeFilter,
  onTypeFilterChange,
  vehicleFilter,
  onVehicleFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  vehicles,
  hasActiveFilters,
  isHistoryView,
  currentPeriodLabel,
  onClearFilters,
  onCleanCurrentView,
  onShowCurrentPeriod,
  onShowHistory,
  onNewRecord,
}: ConsumablesToolbarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const sortedVehicles = [...vehicles].sort((a, b) =>
    a.registration.localeCompare(b.registration),
  )

  return (
    <div className="rounded-[18px] border border-[#D3E9FC] bg-white/80 p-3 shadow-sm shadow-[#BDDDFB]/20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-[360px] lg:w-[420px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#3D7A9C]" />
            <Input
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search item, supplier, site..."
              className="h-11 rounded-xl border-[#D3E9FC] bg-white/90 pl-9 text-sm font-medium text-[#113C69] placeholder:text-[#3D7A9C]/70 focus-visible:ring-[#BFE3F5]"
            />
          </div>

          <div className="relative">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFiltersOpen((current) => !current)}
              className="h-11 rounded-xl border-[#D3E9FC] bg-white px-3 text-sm font-semibold text-[#0B68BE] hover:bg-[#F5FAFF]"
              aria-expanded={isFiltersOpen}
            >
              <Filter className="mr-1.5 size-4" />
              Filters
              {hasActiveFilters ? (
                <span className="ml-1.5 size-2 rounded-full bg-[#218EE7]" aria-label="Filters active" />
              ) : null}
            </Button>

            {isFiltersOpen ? (
              <div className="absolute left-0 top-full z-30 mt-2 w-full rounded-2xl border border-[#D3E9FC] bg-white p-4 shadow-lg shadow-[#BDDDFB]/30 sm:w-[360px] lg:w-[400px]">
                <div className="grid gap-3">
                  <label className="block text-xs font-semibold text-[#3D7A9C]">
                    Type
                    <select
                      value={typeFilter}
                      onChange={(event) => onTypeFilterChange(event.target.value as ConsumableTypeFilter)}
                      className={`${adminSelectSm} mt-1.5 h-10 text-sm`}
                      aria-label="Filter by type"
                    >
                      <option value="all">All types</option>
                      {CONSUMABLE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs font-semibold text-[#3D7A9C]">
                    Vehicle
                    <select
                      value={vehicleFilter}
                      onChange={(event) => onVehicleFilterChange(event.target.value)}
                      className={`${adminSelectSm} mt-1.5 h-10 text-sm`}
                      aria-label="Filter by vehicle"
                    >
                      <option value="all">All vehicles</option>
                      {sortedVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.registration}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-semibold text-[#3D7A9C]">
                      Date from
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(event) => onDateFromChange(event.target.value)}
                        className="mt-1.5 h-10 rounded-[10px] border-[#D3E9FC] bg-white px-2 text-sm"
                        aria-label="Date from"
                      />
                    </label>

                    <label className="block text-xs font-semibold text-[#3D7A9C]">
                      Date to
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(event) => onDateToChange(event.target.value)}
                        className="mt-1.5 h-10 rounded-[10px] border-[#D3E9FC] bg-white px-2 text-sm"
                        aria-label="Date to"
                      />
                    </label>
                  </div>

                  {hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={onClearFilters}
                      className="h-9 justify-start rounded-[10px] px-2.5 text-sm font-medium text-slate-600 hover:bg-[#F5FAFF]"
                    >
                      <X className="mr-1.5 size-4" />
                      Clear filters
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={isHistoryView ? onShowCurrentPeriod : onShowHistory}
            className="h-11 rounded-xl border-[#D3E9FC] bg-white px-3 text-sm font-semibold text-[#0B68BE] hover:bg-[#F5FAFF]"
          >
            {isHistoryView ? currentPeriodLabel : 'Show history'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={onCleanCurrentView}
            className="h-11 rounded-xl px-3 text-sm font-semibold text-[#0B68BE] hover:bg-[#F5FAFF]"
          >
            Clean current view
          </Button>
        </div>

        <Button
          type="button"
          onClick={onNewRecord}
          className="h-11 rounded-xl bg-[#218EE7] px-4 text-sm font-semibold text-white hover:bg-[#0B68BE]"
        >
          <Plus className="mr-1.5 size-4" />
          Add Consumable
        </Button>
      </div>
    </div>
  )
}

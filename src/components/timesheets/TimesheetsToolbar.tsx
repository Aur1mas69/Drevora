import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  adminGlassToolbar,
  adminPanel,
  adminSearchInput,
  adminSelectSm,
  adminText,
} from '@/lib/adminUiStyles'
import type { TimesheetsSortField, TimesheetsSortDirection } from '@/lib/timesheetTypes'
import type {
  TimesheetRoleFilter,
  TimesheetStatusFilter,
  TimesheetVehicleFilter,
} from '@/lib/timesheetUtils'
import type { Vehicle } from '@/services/vehiclesService'
import type { DriverRole } from '@/services/driversService'
import { ChevronDown, Filter, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

const selectClassName = adminSelectSm

const labelClassName = `text-[11px] font-semibold ${adminText}`

const DRIVER_ROLES: DriverRole[] = [
  'Driver',
  'Admin',
  'Yardman',
  'Cleaner',
  'Supervisor',
  'Mechanic',
  'Transport Manager',
  'Planner',
  'Office Staff',
  'Other',
]

type FilterDraft = {
  weekFilter: string
  statusFilter: TimesheetStatusFilter
  roleFilter: TimesheetRoleFilter
  vehicleFilter: TimesheetVehicleFilter
  sortBy: TimesheetsSortField
  sortDir: TimesheetsSortDirection
}

type TimesheetsToolbarProps = {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  statusFilter: TimesheetStatusFilter
  onStatusFilterChange: (value: TimesheetStatusFilter) => void
  roleFilter: TimesheetRoleFilter
  onRoleFilterChange: (value: TimesheetRoleFilter) => void
  weekFilter: string
  onWeekFilterChange: (value: string) => void
  weekOptions: { value: string; label: string }[]
  vehicleFilter: TimesheetVehicleFilter
  onVehicleFilterChange: (value: TimesheetVehicleFilter) => void
  vehicles: Vehicle[]
  sortBy: TimesheetsSortField
  onSortByChange: (value: TimesheetsSortField) => void
  sortDir: TimesheetsSortDirection
  onSortDirChange: (value: TimesheetsSortDirection) => void
  hasActiveFilters: boolean
  onClearFilters: () => void
  onNewTimesheet: () => void
}

function countActivePanelFilters(
  statusFilter: TimesheetStatusFilter,
  roleFilter: TimesheetRoleFilter,
  vehicleFilter: TimesheetVehicleFilter,
): number {
  let count = 0
  if (statusFilter !== 'all') count += 1
  if (roleFilter !== 'all') count += 1
  if (vehicleFilter !== 'all') count += 1
  return count
}

function buildDraftFromProps(props: TimesheetsToolbarProps): FilterDraft {
  return {
    weekFilter: props.weekFilter,
    statusFilter: props.statusFilter,
    roleFilter: props.roleFilter,
    vehicleFilter: props.vehicleFilter,
    sortBy: props.sortBy,
    sortDir: props.sortDir,
  }
}

export function TimesheetsToolbar(props: TimesheetsToolbarProps) {
  const {
    searchTerm,
    onSearchTermChange,
    statusFilter,
    onStatusFilterChange,
    roleFilter,
    onRoleFilterChange,
    weekFilter,
    onWeekFilterChange,
    weekOptions,
    vehicleFilter,
    onVehicleFilterChange,
    vehicles,
    sortBy,
    onSortByChange,
    sortDir,
    onSortDirChange,
    onClearFilters,
    onNewTimesheet,
  } = props

  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [draft, setDraft] = useState<FilterDraft>(() => buildDraftFromProps(props))
  const filterRootRef = useRef<HTMLDivElement>(null)

  const activeFilterCount = useMemo(
    () => countActivePanelFilters(statusFilter, roleFilter, vehicleFilter),
    [roleFilter, statusFilter, vehicleFilter],
  )

  useEffect(() => {
    if (!isFilterOpen) return
    setDraft({
      weekFilter,
      statusFilter,
      roleFilter,
      vehicleFilter,
      sortBy,
      sortDir,
    })
  }, [
    isFilterOpen,
    weekFilter,
    statusFilter,
    roleFilter,
    vehicleFilter,
    sortBy,
    sortDir,
  ])

  useEffect(() => {
    if (!isFilterOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsFilterOpen(false)
      }
    }

    function handlePointerDown(event: MouseEvent) {
      if (!filterRootRef.current?.contains(event.target as Node)) {
        setIsFilterOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isFilterOpen])

  function handleApplyFilters() {
    onWeekFilterChange(draft.weekFilter)
    onStatusFilterChange(draft.statusFilter)
    onRoleFilterChange(draft.roleFilter)
    onVehicleFilterChange(draft.vehicleFilter)
    onSortByChange(draft.sortBy)
    onSortDirChange(draft.sortDir)
    setIsFilterOpen(false)
  }

  function handleClearFilters() {
    onClearFilters()
    setDraft((current) => ({
      ...current,
      statusFilter: 'all',
      roleFilter: 'all',
      vehicleFilter: 'all',
    }))
    setIsFilterOpen(false)
  }

  return (
    <div className={`${adminGlassToolbar} px-3 py-2.5 sm:px-4`}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search worker…"
            className={`${adminSearchInput} pl-9 text-sm shadow-sm`}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          <div ref={filterRootRef} className="relative">
            <Button
              type="button"
              aria-expanded={isFilterOpen}
              aria-haspopup="dialog"
              onClick={() => setIsFilterOpen((open) => !open)}
              className={`h-10 rounded-[12px] px-3 text-xs font-semibold transition-all duration-150 ${
                activeFilterCount > 0
                  ? 'bg-[#2563EB] text-white shadow-[0_4px_14px_rgba(37,99,235,0.28)] hover:bg-[#1d4ed8]'
                  : 'border border-[rgba(75,120,220,0.18)] bg-white/90 text-slate-700 shadow-sm hover:bg-[#F8FBFF] dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <Filter className="mr-1.5 size-3.5" strokeWidth={2.2} />
              {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filter'}
              <ChevronDown
                className={`ml-1 size-3.5 transition-transform duration-150 ${
                  isFilterOpen ? 'rotate-180' : ''
                }`}
              />
            </Button>

            {isFilterOpen ? (
              <div
                role="dialog"
                aria-label="Timesheet filters"
                className={`absolute right-0 z-50 mt-2 w-[min(340px,calc(100vw-2rem))] origin-top-right animate-in fade-in slide-in-from-top-1 p-4 duration-150 ${adminPanel}`}
              >
                <div className="space-y-3">
                  <label className="block space-y-1.5">
                    <span className={labelClassName}>Week</span>
                    <select
                      value={draft.weekFilter}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, weekFilter: event.target.value }))
                      }
                      className={selectClassName}
                    >
                      {weekOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className={labelClassName}>Status</span>
                    <select
                      value={draft.statusFilter}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          statusFilter: event.target.value as TimesheetStatusFilter,
                        }))
                      }
                      className={selectClassName}
                    >
                      <option value="all">All statuses</option>
                      <option value="Draft">Draft</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className={labelClassName}>Role</span>
                    <select
                      value={draft.roleFilter}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          roleFilter: event.target.value as TimesheetRoleFilter,
                        }))
                      }
                      className={selectClassName}
                    >
                      <option value="all">All roles</option>
                      {DRIVER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className={labelClassName}>Vehicle</span>
                    <select
                      value={draft.vehicleFilter}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          vehicleFilter: event.target.value as TimesheetVehicleFilter,
                        }))
                      }
                      className={selectClassName}
                    >
                      <option value="all">All vehicles</option>
                      <option value="unassigned">No vehicle</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.registration}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className={labelClassName}>Sort by</span>
                    <select
                      value={draft.sortBy}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          sortBy: event.target.value as TimesheetsSortField,
                        }))
                      }
                      className={selectClassName}
                    >
                      <option value="driverName">Worker</option>
                      <option value="status">Status</option>
                      <option value="workedHours">Worked hours</option>
                      <option value="updatedAt">Last updated</option>
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className={labelClassName}>Sort order</span>
                    <select
                      value={draft.sortDir}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          sortDir: event.target.value as TimesheetsSortDirection,
                        }))
                      }
                      className={selectClassName}
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </label>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[rgba(75,120,220,0.08)] pt-3 dark:border-white/10">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleClearFilters}
                    className="h-9 rounded-[10px] px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Clear Filters
                  </Button>
                  <Button
                    type="button"
                    onClick={handleApplyFilters}
                    className="h-9 rounded-[10px] bg-[#2563EB] px-4 text-xs font-semibold text-white hover:bg-[#1d4ed8]"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            onClick={onNewTimesheet}
            className="h-10 rounded-[12px] bg-[#2563EB] px-3 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.22)] hover:bg-[#1d4ed8]"
          >
            <Plus className="mr-1.5 size-3.5" />
            New Timesheet
          </Button>
        </div>
      </div>
    </div>
  )
}

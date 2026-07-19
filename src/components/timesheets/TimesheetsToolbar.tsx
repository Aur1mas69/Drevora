import { ModuleListToolbar } from '@/components/common/ModuleListToolbar'
import { Button } from '@/components/ui/button'
import { adminSelectSm } from '@/lib/adminUiStyles'
import type {
  TimesheetsSortField,
  TimesheetsSortDirection,
  TimesheetsViewMode,
} from '@/lib/timesheetTypes'
import type { TimesheetRoleFilter, TimesheetStatusFilter } from '@/lib/timesheetUtils'
import type { DriverRole } from '@/services/driversService'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { createPortal } from 'react-dom'

const selectClassName = adminSelectSm

const labelClassName = `text-[11px] font-semibold text-[#113C69] dark:text-slate-200`

const filterPanelClassName =
  'max-h-[min(85dvh,40rem)] overflow-y-auto rounded-2xl border border-[#D3E9FC] bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900'

const cleanCurrentViewButtonClass =
  'h-9 w-full rounded-[12px] border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-800'

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
  viewMode: TimesheetsViewMode
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
  viewMode: TimesheetsViewMode
  onViewModeChange: (value: TimesheetsViewMode) => void
  weekFilter: string
  onWeekFilterChange: (value: string) => void
  weekOptions: { value: string; label: string }[]
  sortBy: TimesheetsSortField
  onSortByChange: (value: TimesheetsSortField) => void
  sortDir: TimesheetsSortDirection
  onSortDirChange: (value: TimesheetsSortDirection) => void
  hasActiveFilters: boolean
  onClearFilters: () => void
  onCleanCurrentView: () => void
  onNewTimesheet: () => void
  secondaryActions?: ReactNode
}

type FilterPanelPosition = {
  top: number
  right: number
}

function countActivePanelFilters(
  statusFilter: TimesheetStatusFilter,
  roleFilter: TimesheetRoleFilter,
): number {
  let count = 0
  if (statusFilter !== 'all') count += 1
  if (roleFilter !== 'all') count += 1
  return count
}

function buildDraftFromProps(props: TimesheetsToolbarProps): FilterDraft {
  return {
    weekFilter: props.weekFilter,
    statusFilter: props.statusFilter,
    roleFilter: props.roleFilter,
    viewMode: props.viewMode,
    sortBy: props.sortBy,
    sortDir: props.sortDir,
  }
}

function TimesheetFilterPanelBody({
  draft,
  setDraft,
  weekOptions,
  onClear,
  onApply,
  onCleanCurrentView,
}: {
  draft: FilterDraft
  setDraft: Dispatch<SetStateAction<FilterDraft>>
  weekOptions: { value: string; label: string }[]
  onClear: () => void
  onApply: () => void
  onCleanCurrentView: () => void
}) {
  return (
    <>
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
            <option value="createdAt">Date</option>
            <option value="weekStart">Week</option>
            <option value="driverName">Worker</option>
            <option value="workedHours">Worked hours</option>
            <option value="status">Status</option>
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
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className={labelClassName}>View</span>
          <select
            value={draft.viewMode}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                viewMode: event.target.value as TimesheetsViewMode,
              }))
            }
            className={selectClassName}
            aria-label="View"
          >
            <option value="current">Current view</option>
            <option value="history">History</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-[#D3E9FC] pt-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClear}
            className="h-9 rounded-[10px] px-3 text-xs font-semibold text-[#0D477F] hover:bg-[#E8F3FE] dark:text-slate-300 dark:hover:bg-slate-800/50"
          >
            Clear Filters
          </Button>
          <Button
            type="button"
            onClick={onApply}
            className="h-9 rounded-[10px] bg-[#218EE7] px-4 text-xs font-semibold text-white hover:bg-[#0B68BE]"
          >
            Apply
          </Button>
        </div>
        {draft.viewMode === 'current' ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCleanCurrentView}
            className={cleanCurrentViewButtonClass}
          >
            Clean Current View
          </Button>
        ) : null}
      </div>
    </>
  )
}

export function TimesheetsToolbar(props: TimesheetsToolbarProps) {
  const {
    searchTerm,
    onSearchTermChange,
    statusFilter,
    roleFilter,
    viewMode,
    weekFilter,
    weekOptions,
    sortBy,
    sortDir,
    onStatusFilterChange,
    onRoleFilterChange,
    onViewModeChange,
    onWeekFilterChange,
    onSortByChange,
    onSortDirChange,
    onCleanCurrentView,
    onClearFilters,
    onNewTimesheet,
    secondaryActions,
  } = props

  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [draft, setDraft] = useState<FilterDraft>(() => buildDraftFromProps(props))
  const [panelPosition, setPanelPosition] = useState<FilterPanelPosition>({ top: 0, right: 16 })
  const filterRootRef = useRef<HTMLDivElement>(null)
  const filterDesktopPanelRef = useRef<HTMLDivElement>(null)
  const filterMobilePanelRef = useRef<HTMLDivElement>(null)

  const activeFilterCount = useMemo(
    () => countActivePanelFilters(statusFilter, roleFilter),
    [roleFilter, statusFilter],
  )

  useEffect(() => {
    if (!isFilterOpen) return
    setDraft({
      weekFilter,
      statusFilter,
      roleFilter,
      viewMode,
      sortBy,
      sortDir,
    })
  }, [isFilterOpen, weekFilter, statusFilter, roleFilter, viewMode, sortBy, sortDir])

  useEffect(() => {
    if (!isFilterOpen) return

    function updatePanelPosition() {
      const anchor = filterRootRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      const width = Math.min(360, window.innerWidth - 32)
      const right = Math.max(16, Math.min(window.innerWidth - rect.right, window.innerWidth - width - 16))
      setPanelPosition({
        top: Math.min(rect.bottom + 12, window.innerHeight - 48),
        right,
      })
    }

    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)

    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [isFilterOpen])

  useEffect(() => {
    if (!isFilterOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsFilterOpen(false)
      }
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        filterRootRef.current?.contains(target) ||
        filterDesktopPanelRef.current?.contains(target) ||
        filterMobilePanelRef.current?.contains(target)
      ) {
        return
      }
      setIsFilterOpen(false)
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
    onViewModeChange(draft.viewMode)
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
      viewMode: 'current',
    }))
    setIsFilterOpen(false)
  }

  function handleCleanCurrentView() {
    setIsFilterOpen(false)
    onCleanCurrentView()
  }

  const desktopFilterPanel =
    isFilterOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={filterDesktopPanelRef}
            role="dialog"
            aria-label="Timesheet filters"
            className={`fixed z-[60] hidden w-[360px] max-w-[calc(100vw-2rem)] origin-top-right animate-in fade-in slide-in-from-top-1 duration-150 md:block ${filterPanelClassName}`}
            style={{
              top: panelPosition.top,
              right: panelPosition.right,
            }}
          >
            <TimesheetFilterPanelBody
              draft={draft}
              setDraft={setDraft}
              weekOptions={weekOptions}
              onClear={handleClearFilters}
              onApply={handleApplyFilters}
              onCleanCurrentView={handleCleanCurrentView}
            />
          </div>,
          document.body,
        )
      : null

  const mobileFilterSheet =
    isFilterOpen && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[60] md:hidden">
            <button
              type="button"
              aria-label="Close filters"
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
              onClick={() => setIsFilterOpen(false)}
            />
            <div
              ref={filterMobilePanelRef}
              role="dialog"
              aria-label="Timesheet filters"
              className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[24px] border border-[#D3E9FC] bg-[#F5FAFF] p-5 pb-8 shadow-2xl dark:border-white/10 dark:bg-slate-900"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D3E9FC] dark:bg-slate-700" />
              <TimesheetFilterPanelBody
                draft={draft}
                setDraft={setDraft}
                weekOptions={weekOptions}
                onClear={handleClearFilters}
                onApply={handleApplyFilters}
                onCleanCurrentView={handleCleanCurrentView}
              />
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <ModuleListToolbar
        primaryActionLabel="New Timesheet"
        onPrimaryAction={onNewTimesheet}
        searchValue={searchTerm}
        onSearchChange={onSearchTermChange}
        searchPlaceholder="Search worker…"
        onFilterToggle={() => setIsFilterOpen((open) => !open)}
        filterOpen={isFilterOpen}
        activeFilterCount={activeFilterCount}
        filterAnchorRef={filterRootRef}
        secondaryActions={secondaryActions}
      />
      {desktopFilterPanel}
      {mobileFilterSheet}
    </>
  )
}

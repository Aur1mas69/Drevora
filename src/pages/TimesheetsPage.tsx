import { NewTimesheetModal } from '@/components/timesheets/NewTimesheetModal'
import { TimesheetDrawer } from '@/components/timesheets/TimesheetDrawer'
import { TimesheetsBulkActionsBar } from '@/components/timesheets/TimesheetsBulkActionsBar'
import { TimesheetsDataTable } from '@/components/timesheets/TimesheetsDataTable'
import { TimesheetsEmptyState } from '@/components/timesheets/TimesheetsEmptyState'
import { TimesheetsPagination } from '@/components/timesheets/TimesheetsPagination'
import { TimesheetsSummaryStrip } from '@/components/timesheets/TimesheetsSummaryStrip'
import { TimesheetsToolbar } from '@/components/timesheets/TimesheetsToolbar'
import AdminLayout from '@/layouts/AdminLayout'
import type {
  Timesheet,
  TimesheetEntryInput,
  TimesheetListItem,
  TimesheetSummaryStats,
  TimesheetsSortField,
  TimesheetsSortDirection,
} from '@/lib/timesheetTypes'
import { DEFAULT_TIMESHEET_PAGE_SIZE } from '@/lib/timesheetTypes'
import {
  buildRecentWeekOptions,
  canEditTimesheet,
  formatWeekLabel,
  getDefaultWeekStartMonday,
  normalizeWeekStartForCompany,
  type TimesheetRoleFilter,
  type TimesheetStatusFilter,
  type TimesheetVehicleFilter,
} from '@/lib/timesheetUtils'
import { fetchDrivers, type Driver } from '@/services/driversService'
import {
  approveTimesheet,
  bulkApproveTimesheets,
  bulkCreateTimesheets,
  bulkRejectTimesheets,
  createTimesheet,
  deleteTimesheet,
  fetchTimesheetById,
  fetchTimesheetsPage,
  submitTimesheet,
  TimesheetsServiceError,
  upsertTimesheetEntries,
} from '@/services/timesheetsService'
import { fetchVehicles, type Vehicle } from '@/services/vehiclesService'
import { useCallback, useEffect, useMemo, useState } from 'react'

type DrawerState = {
  timesheet: Timesheet
  mode: 'view' | 'edit'
}

export default function TimesheetsPage() {
  const [items, setItems] = useState<TimesheetListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState<TimesheetSummaryStats>({
    total: 0,
    driversSubmitted: 0,
    pendingApproval: 0,
    approved: 0,
    rejected: 0,
    drafts: 0,
  })
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TimesheetStatusFilter>('all')
  const [roleFilter, setRoleFilter] = useState<TimesheetRoleFilter>('all')
  const [vehicleFilter, setVehicleFilter] = useState<TimesheetVehicleFilter>('all')
  const [weekFilter, setWeekFilter] = useState(getDefaultWeekStartMonday())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_TIMESHEET_PAGE_SIZE)
  const [sortBy, setSortBy] = useState<TimesheetsSortField>('driverName')
  const [sortDir, setSortDir] = useState<TimesheetsSortDirection>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [drawerState, setDrawerState] = useState<DrawerState | null>(null)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [drawerSaveError, setDrawerSaveError] = useState<string | null>(null)
  const [isBulkBusy, setIsBulkBusy] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const weekOptions = useMemo(() => buildRecentWeekOptions(12), [])
  const weekLabel = useMemo(() => formatWeekLabel(weekFilter), [weekFilter])

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 ||
    statusFilter !== 'all' ||
    roleFilter !== 'all' ||
    vehicleFilter !== 'all'

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2800)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), 250)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, roleFilter, vehicleFilter, weekFilter, sortBy, sortDir, pageSize])

  const loadReferenceData = useCallback(async () => {
    const [loadedDrivers, loadedVehicles] = await Promise.all([
      fetchDrivers(),
      fetchVehicles(),
    ])
    setDrivers(loadedDrivers)
    setVehicles(loadedVehicles)
  }, [])

  const loadTimesheets = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const result = await fetchTimesheetsPage({
        search: debouncedSearch,
        status: statusFilter,
        role: roleFilter,
        weekStart: weekFilter,
        vehicleId: vehicleFilter,
        page,
        pageSize,
        sortBy,
        sortDir,
      })

      setItems(result.items)
      setTotalCount(result.totalCount)
      setStats(result.stats)
      setSelectedIds(new Set())
    } catch (error) {
      const message =
        error instanceof TimesheetsServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to load timesheets'
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }, [
    debouncedSearch,
    page,
    pageSize,
    roleFilter,
    sortBy,
    sortDir,
    statusFilter,
    vehicleFilter,
    weekFilter,
  ])

  useEffect(() => {
    void loadReferenceData()
  }, [loadReferenceData])

  useEffect(() => {
    void loadTimesheets()
  }, [loadTimesheets])

  function replaceListItem(updated: TimesheetListItem) {
    setItems((current) =>
      current.map((sheet) => (sheet.id === updated.id ? updated : sheet)),
    )
    setDrawerState((current) =>
      current?.timesheet.id === updated.id
        ? { ...current, timesheet: { ...current.timesheet, ...updated } }
        : current,
    )
  }

  async function openTimesheet(id: string, mode: 'view' | 'edit') {
    setDrawerSaveError(null)
    try {
      const timesheet = await fetchTimesheetById(id)
      setDrawerState({ timesheet, mode })
    } catch (error) {
      showToast(
        error instanceof TimesheetsServiceError
          ? error.message
          : 'Failed to open timesheet',
      )
    }
  }

  async function persistDrawerEntries(entries: TimesheetEntryInput[]) {
    if (!drawerState) {
      throw new TimesheetsServiceError('No timesheet open')
    }

    const saved = await upsertTimesheetEntries(drawerState.timesheet.id, entries)
    const refreshed = await fetchTimesheetById(saved.id)
    replaceListItem(refreshed)
    setDrawerState((current) =>
      current ? { ...current, timesheet: refreshed } : current,
    )
    return refreshed
  }

  async function handleSaveEntries(entries: TimesheetEntryInput[]) {
    if (!drawerState || drawerState.mode !== 'edit') return

    setIsSaving(true)
    setDrawerSaveError(null)
    try {
      await persistDrawerEntries(entries)
      showToast('Saved')
      void loadTimesheets()
    } catch (error) {
      const message =
        error instanceof TimesheetsServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to save timesheet'
      console.error('Failed to save timesheet entries:', error)
      setDrawerSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmitTimesheet(entries: TimesheetEntryInput[]) {
    if (!drawerState || drawerState.mode !== 'edit') return

    setIsSaving(true)
    setDrawerSaveError(null)
    try {
      const saved = await persistDrawerEntries(entries)
      const submitted = await submitTimesheet(saved.id)
      const refreshed = await fetchTimesheetById(submitted.id)
      replaceListItem(refreshed)
      setDrawerState({ timesheet: refreshed, mode: 'view' })
      showToast('Submitted for approval')
      void loadTimesheets()
    } catch (error) {
      const message =
        error instanceof TimesheetsServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to submit timesheet'
      console.error('Failed to submit timesheet:', error)
      setDrawerSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(timesheet: TimesheetListItem) {
    const confirmed = window.confirm(
      `Delete timesheet for ${timesheet.driverName} (${timesheet.weekLabel})? This cannot be undone.`,
    )
    if (!confirmed) return

    try {
      await deleteTimesheet(timesheet.id)
      if (drawerState?.timesheet.id === timesheet.id) {
        setDrawerState(null)
      }
      showToast('Timesheet deleted')
      void loadTimesheets()
    } catch (error) {
      showToast(
        error instanceof TimesheetsServiceError
          ? error.message
          : 'Failed to delete timesheet',
      )
    }
  }

  async function handleApprove(timesheet: TimesheetListItem) {
    try {
      const updated = await approveTimesheet(timesheet.id)
      replaceListItem(updated)
      showToast(`${timesheet.driverName} approved`)
      void loadTimesheets()
    } catch (error) {
      showToast(
        error instanceof TimesheetsServiceError
          ? error.message
          : 'Failed to approve timesheet',
      )
    }
  }

  function handleView(timesheet: TimesheetListItem) {
    void openTimesheet(timesheet.id, 'view')
  }

  function handleEdit(timesheet: TimesheetListItem) {
    void openTimesheet(
      timesheet.id,
      canEditTimesheet(timesheet.status) ? 'edit' : 'view',
    )
  }

  async function handleCreateSingle(driverId: string, weekStart: string) {
    setIsSaving(true)
    setCreateError(null)
    try {
      const created = await createTimesheet({ driverId, weekStart })
      setIsNewModalOpen(false)
      setCreateError(null)
      setWeekFilter(created.weekStart)
      showToast('Timesheet created')
      void loadTimesheets()
      setDrawerState({ timesheet: created, mode: 'edit' })
    } catch (error) {
      const message =
        error instanceof TimesheetsServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to create timesheet'
      console.error('Failed to create timesheet:', error)
      setCreateError(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateBulk(mode: 'allActive' | 'driversByRole', weekStart: string) {
    setIsSaving(true)
    setCreateError(null)
    try {
      const targetDrivers = drivers.filter((driver) => {
        if (driver.status !== 'Working') return false
        if (mode === 'driversByRole') return driver.role === 'Driver'
        return true
      })

      const result = await bulkCreateTimesheets({
        weekStart,
        driverIds: targetDrivers.map((driver) => driver.id),
      })

      setIsNewModalOpen(false)
      setCreateError(null)
      setWeekFilter(normalizeWeekStartForCompany(weekStart))
      showToast(
        `Created ${result.created} timesheet${result.created === 1 ? '' : 's'}${
          result.skipped > 0 ? ` · ${result.skipped} skipped` : ''
        }`,
      )
      void loadTimesheets()
    } catch (error) {
      const message =
        error instanceof TimesheetsServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to create weekly timesheets'
      console.error('Failed to create weekly timesheets:', error)
      setCreateError(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateWeeklyFromEmpty() {
    await handleCreateBulk('driversByRole', weekFilter)
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(items.map((item) => item.id)) : new Set())
  }

  async function handleBulkApprove() {
    setIsBulkBusy(true)
    try {
      const count = await bulkApproveTimesheets([...selectedIds])
      showToast(`Approved ${count} timesheet${count === 1 ? '' : 's'}`)
      void loadTimesheets()
    } catch (error) {
      showToast(
        error instanceof TimesheetsServiceError
          ? error.message
          : 'Bulk approve failed',
      )
    } finally {
      setIsBulkBusy(false)
    }
  }

  async function handleBulkReject() {
    setIsBulkBusy(true)
    try {
      const count = await bulkRejectTimesheets([...selectedIds])
      showToast(`Rejected ${count} timesheet${count === 1 ? '' : 's'}`)
      void loadTimesheets()
    } catch (error) {
      showToast(
        error instanceof TimesheetsServiceError
          ? error.message
          : 'Bulk reject failed',
      )
    } finally {
      setIsBulkBusy(false)
    }
  }

  function handleBulkReminder() {
    showToast(`Reminder queued for ${selectedIds.size} worker${selectedIds.size === 1 ? '' : 's'} (coming soon)`)
  }

  function handleBulkExport() {
    showToast('Export coming soon')
  }

  const showWeekEmptyState =
    !isLoading && !loadError && totalCount === 0 && !hasActiveFilters

  return (
    <AdminLayout premiumBackground>
      <section className="space-y-3">
        <div>
          <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em] text-[#2A376F]">
            Timesheets
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Review and approve worker hours at scale.
          </p>
        </div>

        <TimesheetsSummaryStrip stats={stats} weekLabel={weekLabel} />

        <TimesheetsToolbar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          weekFilter={weekFilter}
          onWeekFilterChange={setWeekFilter}
          weekOptions={weekOptions}
          vehicleFilter={vehicleFilter}
          onVehicleFilterChange={setVehicleFilter}
          vehicles={vehicles}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortDir={sortDir}
          onSortDirChange={setSortDir}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={() => {
            setSearchTerm('')
            setDebouncedSearch('')
            setStatusFilter('all')
            setRoleFilter('all')
            setVehicleFilter('all')
          }}
          onNewTimesheet={() => {
            setCreateError(null)
            setIsNewModalOpen(true)
          }}
        />

        <TimesheetsBulkActionsBar
          selectedCount={selectedIds.size}
          isBusy={isBulkBusy}
          onApproveSelected={() => void handleBulkApprove()}
          onRejectSelected={() => void handleBulkReject()}
          onReminderSelected={handleBulkReminder}
          onExportSelected={handleBulkExport}
          onClearSelection={() => setSelectedIds(new Set())}
        />

        {isLoading ? (
          <div className="rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white px-6 py-10 text-center">
            <p className="text-sm font-semibold text-[#2A376F]">Loading timesheets…</p>
          </div>
        ) : loadError ? (
          <div className="rounded-[14px] border border-rose-200 bg-white px-6 py-10 text-center">
            <p className="text-sm font-semibold text-rose-700">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadTimesheets()}
              className="mt-3 text-sm font-semibold text-[#2563EB] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : showWeekEmptyState ? (
          <TimesheetsEmptyState
            weekLabel={weekLabel}
            onCreateWeekly={() => void handleCreateWeeklyFromEmpty()}
            onCreateSingle={() => setIsNewModalOpen(true)}
            isCreating={isSaving}
          />
        ) : items.length === 0 ? (
          <div className="rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white px-6 py-10 text-center">
            <p className="text-sm font-semibold text-[#2A376F]">No matching timesheets</p>
            <p className="mt-1 text-sm text-slate-500">
              Adjust filters or search to find records for {weekLabel}.
            </p>
          </div>
        ) : (
          <>
            <TimesheetsDataTable
              timesheets={items}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onView={handleView}
              onEdit={handleEdit}
              onApprove={(timesheet) => void handleApprove(timesheet)}
              onDelete={(timesheet) => void handleDelete(timesheet)}
            />
            <TimesheetsPagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </section>

      <TimesheetDrawer
        timesheet={drawerState?.timesheet ?? null}
        mode={drawerState?.mode ?? 'view'}
        isSaving={isSaving}
        saveError={drawerSaveError}
        onClose={() => {
          setDrawerSaveError(null)
          setDrawerState(null)
        }}
        onEdit={() => {
          if (!drawerState) return
          setDrawerSaveError(null)
          setDrawerState({ ...drawerState, mode: 'edit' })
        }}
        onSave={handleSaveEntries}
        onSubmit={handleSubmitTimesheet}
      />

      <NewTimesheetModal
        isOpen={isNewModalOpen}
        drivers={drivers}
        isSaving={isSaving}
        error={createError}
        onClose={() => {
          setCreateError(null)
          setIsNewModalOpen(false)
        }}
        onCreateSingle={(driverId, weekStart) => void handleCreateSingle(driverId, weekStart)}
        onCreateBulk={(mode, weekStart) => void handleCreateBulk(mode, weekStart)}
      />

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-[14px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(15,23,42,0.28)]">
          {toastMessage}
        </div>
      ) : null}
    </AdminLayout>
  )
}

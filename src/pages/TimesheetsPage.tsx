import { CleanCurrentViewModal } from '@/components/common/CleanCurrentViewModal'
import { DeleteTimesheetModal } from '@/components/timesheets/DeleteTimesheetModal'
import { NewTimesheetModal } from '@/components/timesheets/NewTimesheetModal'
import { TimesheetDrawer } from '@/components/timesheets/TimesheetDrawer'
import { TimesheetsBulkActionsBar } from '@/components/timesheets/TimesheetsBulkActionsBar'
import { TimesheetsDataTable } from '@/components/timesheets/TimesheetsDataTable'
import { TimesheetsEmptyState } from '@/components/timesheets/TimesheetsEmptyState'
import { TimesheetsPagination } from '@/components/timesheets/TimesheetsPagination'
import { TimesheetsSummaryStrip } from '@/components/timesheets/TimesheetsSummaryStrip'
import { TimesheetsToolbar } from '@/components/timesheets/TimesheetsToolbar'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import { DEFAULT_TIMESHEET_WEEK_SETTINGS } from '@/lib/companySettingsTypes'
import type {
  Timesheet,
  TimesheetEntryInput,
  TimesheetListItem,
  TimesheetSummaryStats,
  TimesheetsSortField,
  TimesheetsSortDirection,
  TimesheetsViewMode,
} from '@/lib/timesheetTypes'
import { DEFAULT_TIMESHEET_PAGE_SIZE } from '@/lib/timesheetTypes'
import {
  buildRecentWeekOptions,
  getDefaultWeekStartMonday,
  normalizeWeekStartForCompany,
  type TimesheetRoleFilter,
  type TimesheetStatusFilter,
} from '@/lib/timesheetUtils'
import { fetchDrivers, type Driver } from '@/services/driversService'
import {
  approveTimesheet,
  bulkApproveTimesheets,
  bulkCreateTimesheets,
  cleanTimesheetsCurrentView,
  createTimesheet,
  deleteTimesheet,
  fetchTimesheetById,
  fetchTimesheetsPage,
  rejectTimesheet,
  submitTimesheet,
  TimesheetsServiceError,
  upsertTimesheetEntries,
} from '@/services/timesheetsService'
import { formatTimesheetWeekDisplay } from '@/lib/timesheetWeekNumber'
import AdminLayout from '@/layouts/AdminLayout'
import { useCallback, useEffect, useMemo, useState } from 'react'

type DrawerState = {
  timesheet: Timesheet
  mode: 'view' | 'edit'
}

export default function TimesheetsPage() {
  const { settings } = useCompanySettings()
  const { companyReady, companyId, companyLoading, membershipError } = useCompanyTenantGate()
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
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TimesheetStatusFilter>('all')
  const [roleFilter, setRoleFilter] = useState<TimesheetRoleFilter>('all')
  const [viewMode, setViewMode] = useState<TimesheetsViewMode>('current')
  const [weekFilter, setWeekFilter] = useState(getDefaultWeekStartMonday())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_TIMESHEET_PAGE_SIZE)
  const [sortBy, setSortBy] = useState<TimesheetsSortField>('createdAt')
  const [sortDir, setSortDir] = useState<TimesheetsSortDirection>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [drawerState, setDrawerState] = useState<DrawerState | null>(null)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [drawerSaveError, setDrawerSaveError] = useState<string | null>(null)
  const [isBulkBusy, setIsBulkBusy] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TimesheetListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isCleanCurrentViewOpen, setIsCleanCurrentViewOpen] = useState(false)
  const [isCleaningCurrentView, setIsCleaningCurrentView] = useState(false)

  const weekSettings = useMemo(
    () =>
      settings
        ? {
            timesheetWeekStartDay: settings.timesheetWeekStartDay,
            timesheetWeekResetMonth: settings.timesheetWeekResetMonth,
            timesheetWeekResetDay: settings.timesheetWeekResetDay,
          }
        : DEFAULT_TIMESHEET_WEEK_SETTINGS,
    [settings],
  )

  const weekOptions = useMemo(() => buildRecentWeekOptions(12, weekSettings), [weekSettings])
  const weekDisplay = useMemo(
    () => formatTimesheetWeekDisplay(weekFilter, weekSettings),
    [weekFilter, weekSettings],
  )

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 ||
    statusFilter !== 'all' ||
    roleFilter !== 'all' ||
    viewMode !== 'current'

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
  }, [debouncedSearch, statusFilter, roleFilter, viewMode, weekFilter, sortBy, sortDir, pageSize])

  const loadReferenceData = useCallback(async () => {
    const loadedDrivers = await fetchDrivers()
    setDrivers(loadedDrivers)
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
        viewMode,
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
    viewMode,
    weekFilter,
  ])

  useEffect(() => {
    if (!companyReady || !companyId) {
      if (!companyLoading) {
        setDrivers([])
        if (membershipError) {
          /* reference data waits for membership; list error handled below */
        }
      }
      return
    }

    void loadReferenceData()
  }, [companyReady, companyId, companyLoading, membershipError, loadReferenceData])

  useEffect(() => {
    if (!companyReady || !companyId) {
      if (!companyLoading) {
        setIsLoading(false)
        setItems([])
        setTotalCount(0)
        if (membershipError) {
          setLoadError(membershipError)
        }
      }
      return
    }

    void loadTimesheets()
  }, [companyReady, companyId, companyLoading, membershipError, loadTimesheets])

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

    await upsertTimesheetEntries(drawerState.timesheet.id, entries)
    const refreshed = await fetchTimesheetById(drawerState.timesheet.id)
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

  function handleDelete(timesheet: TimesheetListItem) {
    setDeleteError(null)
    setDeleteTarget(timesheet)
  }

  async function handleConfirmCleanCurrentView() {
    if (isCleaningCurrentView) return

    setIsCleaningCurrentView(true)
    try {
      // Scope: all non-cleaned timesheets for the currently displayed week only.
      const { cleanedCount } = await cleanTimesheetsCurrentView({
        weekStart: weekFilter,
      })

      if (cleanedCount === 0) {
        showToast('No timesheets were cleaned from the current view.')
        return
      }

      setSearchTerm('')
      setDebouncedSearch('')
      setStatusFilter('all')
      setRoleFilter('all')
      setViewMode('current')
      setSelectedIds(new Set())
      setPage(1)
      setIsCleanCurrentViewOpen(false)
      await loadTimesheets()
      showToast(
        cleanedCount === 1
          ? '1 timesheet removed from current view'
          : `${cleanedCount} timesheets removed from current view`,
      )
    } catch (error) {
      showToast(
        error instanceof TimesheetsServiceError
          ? error.message
          : 'Unable to clean timesheets current view.',
      )
    } finally {
      setIsCleaningCurrentView(false)
    }
  }

  function handleCancelDelete() {
    if (isDeleting) return
    setDeleteTarget(null)
    setDeleteError(null)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || isDeleting) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await deleteTimesheet(deleteTarget.id)
      if (drawerState?.timesheet.id === deleteTarget.id) {
        setDrawerState(null)
      }
      setDeleteTarget(null)
      showToast('Timesheet deleted')
      void loadTimesheets()
    } catch (error) {
      const message =
        error instanceof TimesheetsServiceError
          ? error.message
          : 'Failed to delete timesheet'
      setDeleteError(message)
    } finally {
      setIsDeleting(false)
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

  async function handleReject(timesheet: TimesheetListItem) {
    try {
      const updated = await rejectTimesheet(timesheet.id)
      replaceListItem(updated)
      showToast(`${timesheet.driverName} rejected`)
      void loadTimesheets()
    } catch (error) {
      showToast(
        error instanceof TimesheetsServiceError
          ? error.message
          : 'Failed to reject timesheet',
      )
    }
  }

  function handleView(timesheet: TimesheetListItem) {
    void openTimesheet(timesheet.id, 'view')
  }

  function handleEdit(timesheet: TimesheetListItem) {
    void openTimesheet(timesheet.id, 'edit')
  }

  async function handleCreateSingle(driverId: string, weekStart: string) {
    setIsSaving(true)
    setCreateError(null)
    try {
      const result = await createTimesheet({ driverId, weekStart })

      if (result.created) {
        setIsNewModalOpen(false)
        setCreateError(null)
        setWeekFilter(result.timesheet.weekStart)
        showToast('Timesheet created')
        void loadTimesheets()
        setDrawerState({ timesheet: result.timesheet, mode: 'edit' })
        return
      }

      setWeekFilter(result.timesheet.weekStart)
      void loadTimesheets()
      setIsNewModalOpen(false)
      setCreateError(null)
      setDrawerState({ timesheet: result.timesheet, mode: 'edit' })
      showToast('A timesheet already exists for this worker and week. Opened the existing record.')
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
      if (result.created === 0 && result.skipped > 0) {
        showToast(
          `Skipped ${result.skipped} existing timesheet${result.skipped === 1 ? '' : 's'}.`,
        )
      } else if (result.skipped > 0) {
        showToast(
          `Created ${result.created} timesheet${result.created === 1 ? '' : 's'}. Skipped ${result.skipped} existing timesheet${result.skipped === 1 ? '' : 's'}.`,
        )
      } else {
        showToast(`Created ${result.created} timesheet${result.created === 1 ? '' : 's'}.`)
      }
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

  const selectedSubmittedCount = useMemo(
    () =>
      items.filter((item) => selectedIds.has(item.id) && item.status === 'Submitted')
        .length,
    [items, selectedIds],
  )

  async function handleBulkApprove() {
    setIsBulkBusy(true)
    try {
      const count = await bulkApproveTimesheets([...selectedIds])
      if (count === 0) {
        showToast('No submitted timesheets selected')
      } else if (count < selectedIds.size) {
        showToast(`Approved ${count} submitted timesheet${count === 1 ? '' : 's'}`)
      } else {
        showToast(`Approved ${count} timesheet${count === 1 ? '' : 's'}`)
      }
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

  async function handleBulkExport() {
    if (selectedIds.size === 0) {
      showToast('Select at least one timesheet to export.')
      return
    }

    setIsExporting(true)
    try {
      const ids = [...selectedIds]
      const timesheets = await Promise.all(ids.map((id) => fetchTimesheetById(id)))

      if (timesheets.length === 0) {
        showToast('No timesheets to export.')
        return
      }

      const { exportTimesheetsToPdf } = await import('@/lib/timesheetPdfExport')
      await exportTimesheetsToPdf(timesheets)
      showToast(
        timesheets.length === 1
          ? 'Exported timesheet to PDF'
          : `Exported ${timesheets.length} timesheets to ZIP`,
      )
    } catch (error) {
      showToast(
        error instanceof TimesheetsServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to export timesheets',
      )
    } finally {
      setIsExporting(false)
    }
  }

  const showWeekEmptyState =
    !isLoading && !loadError && totalCount === 0 && !hasActiveFilters

  return (
    <AdminLayout premiumBackground>
      <section className="min-w-0 space-y-3">
        <div>
          <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em] text-[#2A376F]">
            Timesheets
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Review and approve worker hours at scale.
          </p>
        </div>

        <TimesheetsSummaryStrip
          stats={stats}
          weekTitle={weekDisplay.weekTitle}
          weekRangeLabel={weekDisplay.weekRangeLabel}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

        <TimesheetsToolbar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          weekFilter={weekFilter}
          onWeekFilterChange={setWeekFilter}
          weekOptions={weekOptions}
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
            setViewMode('current')
          }}
          onCleanCurrentView={() => setIsCleanCurrentViewOpen(true)}
          onNewTimesheet={() => {
            setCreateError(null)
            setIsNewModalOpen(true)
          }}
        />

        <TimesheetsBulkActionsBar
          selectedCount={selectedIds.size}
          submittedCount={selectedSubmittedCount}
          isBusy={isBulkBusy}
          isExporting={isExporting}
          onApproveSelected={() => void handleBulkApprove()}
          onExportSelected={() => void handleBulkExport()}
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
            weekTitle={weekDisplay.weekTitle}
            weekRangeLabel={weekDisplay.weekRangeLabel}
            onCreateWeekly={() => void handleCreateWeeklyFromEmpty()}
            onCreateSingle={() => setIsNewModalOpen(true)}
            isCreating={isSaving}
          />
        ) : items.length === 0 ? (
          <div className="rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white px-6 py-10 text-center">
            <p className="text-sm font-semibold text-[#2A376F]">No matching timesheets</p>
            <p className="mt-1 text-sm text-slate-500">
              Adjust filters or search to find records for {weekDisplay.weekTitle}.
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
              onReject={(timesheet) => void handleReject(timesheet)}
              onDelete={handleDelete}
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

      {deleteTarget ? (
        <DeleteTimesheetModal
          timesheet={deleteTarget}
          errorMessage={deleteError}
          isDeleting={isDeleting}
          onCancel={handleCancelDelete}
          onConfirm={() => void handleConfirmDelete()}
        />
      ) : null}

      <CleanCurrentViewModal
        open={isCleanCurrentViewOpen}
        title="Clean timesheets current view?"
        description="Timesheets will be removed from the Current view and kept in History. No records or Timesheet entries will be permanently deleted."
        confirmLabel="Clean current view"
        confirming={isCleaningCurrentView}
        onCancel={() => {
          if (!isCleaningCurrentView) setIsCleanCurrentViewOpen(false)
        }}
        onConfirm={() => void handleConfirmCleanCurrentView()}
      />

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-[14px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(15,23,42,0.28)]">
          {toastMessage}
        </div>
      ) : null}
    </AdminLayout>
  )
}

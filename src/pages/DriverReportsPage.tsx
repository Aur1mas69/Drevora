import { CleanCurrentViewModal } from '@/components/common/CleanCurrentViewModal'
import { DeleteDriverReportModal } from '@/components/driver-reports/DeleteDriverReportModal'
import { DriverReportDrawer } from '@/components/driver-reports/DriverReportDrawer'
import {
  DriverReportFormModal,
  driverReportFormValuesToInput,
} from '@/components/driver-reports/DriverReportFormModal'
import { getDriverReportStoragePath } from '@/components/driver-reports/DriverReportFileField'
import { DriverReportsDataTable } from '@/components/driver-reports/DriverReportsDataTable'
import { DriverReportsEmptyState } from '@/components/driver-reports/DriverReportsEmptyState'
import { DriverReportsPagination } from '@/components/driver-reports/DriverReportsPagination'
import { DriverReportsSummaryCards } from '@/components/driver-reports/DriverReportsSummaryCards'
import { DriverReportsToolbar } from '@/components/driver-reports/DriverReportsToolbar'
import { driverReportPageCardClass } from '@/components/driver-reports/driverReportUiStyles'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import AdminLayout from '@/layouts/AdminLayout'
import type {
  DriverReport,
  DriverReportFormSubmitPayload,
  DriverReportKpiFilter,
  DriverReportPriorityFilter,
  DriverReportStatusFilter,
  DriverReportTypeFilter,
} from '@/lib/driverReportTypes'
import { DEFAULT_DRIVER_REPORT_PAGE_SIZE } from '@/lib/driverReportTypes'
import {
  computeDriverReportSummaryStats,
  filterDriverReports,
  filterDriverReportsByVisibility,
} from '@/lib/driverReportUtils'
import type { CurrentViewMode } from '@/lib/currentViewVisibility'
import { adminHeading, adminTextMuted } from '@/lib/adminUiStyles'
import {
  applyDriverReportFileChanges,
  deleteDriverReportFile,
  DriverReportFileStorageError,
  getDriverReportFileSignedUrl,
} from '@/services/driverReportFileStorageService'
import {
  createDriverReport,
  deleteDriverReport,
  DriverReportsServiceError,
  fetchDriverReports,
  updateDriverReport,
} from '@/services/driverReportsService'
import { fetchDrivers, type Driver } from '@/services/driversService'
import { fetchVehicles, type Vehicle } from '@/services/vehiclesService'
import { useCallback, useEffect, useMemo, useState } from 'react'

export default function DriverReportsPage() {
  const { formatDate, formatDateTime, settings: companySettings } = useCompanySettings()
  const { portal } = useAuth()
  const { worker: currentWorker } = useCurrentWorker()

  const isAdminForm = portal !== 'worker'
  const formContext = isAdminForm ? 'admin' : 'worker'
  const currentWorkerName = currentWorker
    ? `${currentWorker.firstName} ${currentWorker.lastName}`.trim()
    : null

  const [items, setItems] = useState<DriverReport[]>([])
  const [workers, setWorkers] = useState<Driver[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [kpiFilter, setKpiFilter] = useState<DriverReportKpiFilter>('all')
  const [statusFilter, setStatusFilter] = useState<DriverReportStatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<DriverReportTypeFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<DriverReportPriorityFilter>('all')
  const [workerFilter, setWorkerFilter] = useState('all')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [visibilityMode, setVisibilityMode] = useState<CurrentViewMode>('current')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_DRIVER_REPORT_PAGE_SIZE)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editRecord, setEditRecord] = useState<DriverReport | null>(null)
  const [viewRecord, setViewRecord] = useState<DriverReport | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<DriverReport | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isCleanCurrentViewOpen, setIsCleanCurrentViewOpen] = useState(false)

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 ||
    visibilityMode !== 'current' ||
    kpiFilter !== 'all' ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    priorityFilter !== 'all' ||
    workerFilter !== 'all' ||
    vehicleFilter !== 'all' ||
    Boolean(dateFrom) ||
    Boolean(dateTo)

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2800)
  }, [])

  const loadReports = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [reports, workerRows, vehicleRows] = await Promise.all([
        fetchDriverReports(),
        fetchDrivers(),
        fetchVehicles(),
      ])
      setItems(reports)
      setWorkers(workerRows)
      setVehicles(vehicleRows)
    } catch (error) {
      setLoadError(
        error instanceof DriverReportsServiceError
          ? error.message
          : 'Unable to load driver reports.',
      )
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), 250)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
  }, [
    debouncedSearch,
    kpiFilter,
    statusFilter,
    typeFilter,
    priorityFilter,
    workerFilter,
    vehicleFilter,
    dateFrom,
    dateTo,
    visibilityMode,
    pageSize,
  ])

  const summaryStats = useMemo(() => computeDriverReportSummaryStats(items), [items])

  const filteredItems = useMemo(
    () => {
      const visibleItems = filterDriverReportsByVisibility(items, visibilityMode)
      return filterDriverReports(visibleItems, {
        search: debouncedSearch,
        kpiFilter,
        status: statusFilter,
        reportType: typeFilter,
        priority: priorityFilter,
        workerId: workerFilter,
        vehicleId: vehicleFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
    },
    [
      items,
      visibilityMode,
      debouncedSearch,
      kpiFilter,
      statusFilter,
      typeFilter,
      priorityFilter,
      workerFilter,
      vehicleFilter,
      dateFrom,
      dateTo,
    ],
  )

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, page, pageSize])

  function openCreateModal() {
    setFormMode('create')
    setEditRecord(null)
    setIsFormOpen(true)
  }

  function openEditModal(record: DriverReport) {
    setFormMode('edit')
    setEditRecord(record)
    setViewRecord(null)
    setIsFormOpen(true)
  }

  function clearFilters() {
    setSearchTerm('')
    setDebouncedSearch('')
    setKpiFilter('all')
    setStatusFilter('all')
    setTypeFilter('all')
    setPriorityFilter('all')
    setWorkerFilter('all')
    setVehicleFilter('all')
    setDateFrom('')
    setDateTo('')
    setVisibilityMode('current')
  }

  function handleKpiFilterChange(filter: DriverReportKpiFilter) {
    setKpiFilter(filter)
    if (filter === 'new') {
      setStatusFilter('New')
      setVisibilityMode('current')
    } else if (filter === 'in_progress') {
      setStatusFilter('In Progress')
      setVisibilityMode('current')
    } else if (filter === 'closed') {
      setStatusFilter('Closed')
      setVisibilityMode('history')
    } else if (filter === 'critical_high') {
      setPriorityFilter('critical_high')
      setVisibilityMode('all')
      setStatusFilter('all')
    } else {
      setStatusFilter('all')
      setPriorityFilter('all')
    }
  }

  function handleStatusFilterChange(value: DriverReportStatusFilter) {
    setStatusFilter(value)
    setKpiFilter('all')
    if (value === 'Closed') {
      setVisibilityMode('history')
    } else if (value === 'New' || value === 'In Progress') {
      setVisibilityMode('current')
    }
  }

  function handleVisibilityModeChange(value: CurrentViewMode) {
    setVisibilityMode(value)
    setKpiFilter('all')
    setStatusFilter('all')
  }

  function handleConfirmCleanCurrentView() {
    clearFilters()
    setIsCleanCurrentViewOpen(false)
    showToast('Active driver reports view cleaned')
  }

  async function handleOpenAttachment(record: DriverReport) {
    const path = getDriverReportStoragePath(record)
    if (!path) return

    try {
      const url = await getDriverReportFileSignedUrl(path)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      showToast(
        error instanceof DriverReportFileStorageError
          ? error.message
          : 'Unable to open attachment.',
      )
    }
  }

  async function handleFormSubmit(payload: DriverReportFormSubmitPayload) {
    setIsSaving(true)
    const companyId = companySettings?.id
    let input = driverReportFormValuesToInput(payload.values)

    if (!isAdminForm) {
      if (!currentWorker?.id) {
        throw new DriverReportsServiceError('Unable to identify your worker profile.')
      }
      input = {
        ...input,
        workerId: currentWorker.id,
        status: formMode === 'create' ? 'New' : input.status,
        officeNotes: null,
      }
    }

    try {
      if (formMode === 'create') {
        const created = await createDriverReport(input)

        if (companyId && payload.file) {
          const filePath = await applyDriverReportFileChanges({
            companyId,
            reportId: created.id,
            existingFilePath: null,
            file: payload.file,
            removeFile: false,
          })
          await updateDriverReport(created.id, { attachmentPath: filePath })
        }

        showToast('Report created')
      } else if (editRecord) {
        await updateDriverReport(editRecord.id, input)

        if (companyId && (payload.file || payload.removeFile)) {
          const filePath = await applyDriverReportFileChanges({
            companyId,
            reportId: editRecord.id,
            existingFilePath:
              editRecord.attachmentPath ?? editRecord.attachmentUrl,
            file: payload.file,
            removeFile: payload.removeFile,
          })
          await updateDriverReport(editRecord.id, { attachmentPath: filePath })
        }

        showToast('Report updated')
      }

      await loadReports()
    } catch (error) {
      if (error instanceof DriverReportFileStorageError) throw error
      throw error instanceof DriverReportsServiceError
        ? error
        : new DriverReportsServiceError('Failed to save report')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteRecord) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      const path = getDriverReportStoragePath(deleteRecord)
      if (path) {
        try {
          await deleteDriverReportFile(path)
        } catch {
          /* continue delete */
        }
      }

      await deleteDriverReport(deleteRecord.id)
      showToast('Report deleted')
      setDeleteRecord(null)
      await loadReports()
    } catch (error) {
      setDeleteError(
        error instanceof DriverReportsServiceError
          ? error.message
          : 'Unable to delete report.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const showEmptyState =
    !isLoading && !loadError && items.length === 0 && !hasActiveFilters

  return (
    <AdminLayout premiumBackground wideContent>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#218EE7]">
            Operations
          </p>
          <h1 className={`mt-2 text-3xl font-semibold tracking-[-0.03em] ${adminHeading}`}>
            Driver Reports
          </h1>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${adminTextMuted}`}>
            Review reported vehicle, site and operational issues from workers.
          </p>
        </div>

        <DriverReportsSummaryCards
          stats={summaryStats}
          activeFilter={kpiFilter}
          onFilterChange={handleKpiFilterChange}
        />

        <DriverReportsToolbar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={(value) => {
            setPriorityFilter(value)
            if (value !== 'critical_high') setKpiFilter('all')
          }}
          workerFilter={workerFilter}
          onWorkerFilterChange={setWorkerFilter}
          vehicleFilter={vehicleFilter}
          onVehicleFilterChange={setVehicleFilter}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          visibilityMode={visibilityMode}
          onVisibilityModeChange={handleVisibilityModeChange}
          workers={workers}
          vehicles={vehicles}
          onClearFilters={clearFilters}
          onCleanCurrentView={() => setIsCleanCurrentViewOpen(true)}
          onAddReport={openCreateModal}
        />

        {loadError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {loadError}
          </div>
        ) : null}

        {isLoading ? (
          <div className={`px-6 py-10 text-center text-sm text-[#5499BF] ${driverReportPageCardClass}`}>
            Loading driver reports…
          </div>
        ) : showEmptyState ? (
          <DriverReportsEmptyState hasActiveFilters={false} />
        ) : filteredItems.length === 0 ? (
          <DriverReportsEmptyState hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
        ) : (
          <div className={driverReportPageCardClass}>
            <DriverReportsDataTable
              reports={paginatedItems}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
              onView={setViewRecord}
              onEdit={openEditModal}
              onDelete={setDeleteRecord}
            />
            <DriverReportsPagination
              page={page}
              pageSize={pageSize}
              totalCount={filteredItems.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      <DriverReportFormModal
        isOpen={isFormOpen}
        mode={formMode}
        formContext={formContext}
        record={editRecord}
        workers={workers}
        vehicles={vehicles}
        currentWorkerId={currentWorker?.id ?? null}
        currentWorkerName={currentWorkerName}
        isSaving={isSaving}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <DriverReportDrawer
        record={viewRecord}
        isOpen={Boolean(viewRecord)}
        formatDateTime={formatDateTime}
        onClose={() => setViewRecord(null)}
        onEdit={openEditModal}
        onOpenAttachment={(record) => void handleOpenAttachment(record)}
      />

      {deleteRecord ? (
        <DeleteDriverReportModal
          record={deleteRecord}
          errorMessage={deleteError}
          isDeleting={isDeleting}
          onCancel={() => {
            setDeleteRecord(null)
            setDeleteError(null)
          }}
          onConfirm={() => void handleDeleteConfirm()}
        />
      ) : null}

      <CleanCurrentViewModal
        open={isCleanCurrentViewOpen}
        title="Clean driver reports current view?"
        description="This will return Driver Reports to New and In Progress records and clear search/filter selections only. Closed reports remain saved and searchable in History or All."
        confirmLabel="Clean current view"
        onCancel={() => setIsCleanCurrentViewOpen(false)}
        onConfirm={handleConfirmCleanCurrentView}
      />

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[140] rounded-xl bg-[#113C69] px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </AdminLayout>
  )
}

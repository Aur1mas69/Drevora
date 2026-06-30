import { EditHolidayRequestModal } from '@/components/holidays/EditHolidayRequestModal'
import { HolidayRequestDrawer } from '@/components/holidays/HolidayRequestDrawer'
import { HolidayRequestsDataTable } from '@/components/holidays/HolidayRequestsDataTable'
import { HolidayRequestsEmptyState } from '@/components/holidays/HolidayRequestsEmptyState'
import { HolidayRequestsPagination } from '@/components/holidays/HolidayRequestsPagination'
import { HolidayRequestsSummaryCards } from '@/components/holidays/HolidayRequestsSummaryCards'
import { HolidayRequestsToolbar } from '@/components/holidays/HolidayRequestsToolbar'
import { NewHolidayRequestModal } from '@/components/holidays/NewHolidayRequestModal'
import AdminLayout from '@/layouts/AdminLayout'
import type {
  HolidayRequest,
  HolidayRequestStatusFilter,
  HolidayRequestSummaryStats,
} from '@/lib/holidayRequestTypes'
import { DEFAULT_HOLIDAY_PAGE_SIZE } from '@/lib/holidayRequestTypes'
import { fetchDrivers, type Driver } from '@/services/driversService'
import {
  approveHolidayRequest,
  createHolidayRequest,
  deleteHolidayRequest,
  fetchHolidayRequests,
  HolidayRequestsServiceError,
  rejectHolidayRequest,
  updateHolidayRequest,
} from '@/services/holidayRequestsService'
import { useCallback, useEffect, useState } from 'react'

export default function HolidayRequestsPage() {
  const [items, setItems] = useState<HolidayRequest[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState<HolidayRequestSummaryStats>({
    pendingRequests: 0,
    approvedThisMonth: 0,
    workersOffToday: 0,
    upcomingLeave: 0,
  })
  const [workers, setWorkers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<HolidayRequestStatusFilter>('all')
  const [workerFilter, setWorkerFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_HOLIDAY_PAGE_SIZE)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [editRequest, setEditRequest] = useState<HolidayRequest | null>(null)
  const [viewRequest, setViewRequest] = useState<HolidayRequest | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 ||
    statusFilter !== 'all' ||
    workerFilter !== 'all' ||
    dateFrom.length > 0 ||
    dateTo.length > 0

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
  }, [debouncedSearch, statusFilter, workerFilter, dateFrom, dateTo, pageSize])

  const loadWorkers = useCallback(async () => {
    const loadedWorkers = await fetchDrivers()
    setWorkers(loadedWorkers)
  }, [])

  const loadRequests = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const result = await fetchHolidayRequests({
        search: debouncedSearch,
        status: statusFilter,
        workerId: workerFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize,
      })

      setItems(result.items)
      setTotalCount(result.totalCount)
      setStats(result.stats)
    } catch (error) {
      const message =
        error instanceof HolidayRequestsServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to load holiday requests'
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, dateFrom, dateTo, page, pageSize, statusFilter, workerFilter])

  useEffect(() => {
    void loadWorkers().catch(() => {
      /* workers load failure handled on submit */
    })
  }, [loadWorkers])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  function clearFilters() {
    setSearchTerm('')
    setDebouncedSearch('')
    setStatusFilter('all')
    setWorkerFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  async function handleCreate(input: {
    workerId: string
    startDate: string
    endDate: string
    reason: string
  }) {
    setIsSaving(true)
    try {
      await createHolidayRequest({
        workerId: input.workerId,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason,
      })
      showToast('Holiday request submitted')
      await loadRequests()
    } catch (error) {
      throw error instanceof HolidayRequestsServiceError
        ? error
        : new HolidayRequestsServiceError('Failed to create holiday request')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdate(input: {
    startDate: string
    endDate: string
    reason: string
    status: HolidayRequest['status']
  }) {
    if (!editRequest) return

    setIsSaving(true)
    try {
      await updateHolidayRequest(editRequest.id, {
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason,
        status: input.status,
      })
      showToast('Holiday request updated')
      setEditRequest(null)
      await loadRequests()
    } catch (error) {
      throw error instanceof HolidayRequestsServiceError
        ? error
        : new HolidayRequestsServiceError('Failed to update holiday request')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleApprove(request: HolidayRequest, managerNote?: string) {
    setIsSaving(true)
    try {
      await approveHolidayRequest(request.id, managerNote)
      showToast('Holiday request approved')
      setViewRequest(null)
      await loadRequests()
    } catch (error) {
      const message =
        error instanceof HolidayRequestsServiceError
          ? error.message
          : 'Failed to approve holiday request'
      showToast(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReject(request: HolidayRequest, managerNote?: string) {
    setIsSaving(true)
    try {
      await rejectHolidayRequest(request.id, managerNote)
      showToast('Holiday request rejected')
      setViewRequest(null)
      await loadRequests()
    } catch (error) {
      const message =
        error instanceof HolidayRequestsServiceError
          ? error.message
          : 'Failed to reject holiday request'
      showToast(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(request: HolidayRequest) {
    const confirmed = window.confirm(
      `Delete holiday request for ${request.workerName} (${request.startDate} – ${request.endDate})?`,
    )
    if (!confirmed) return

    setIsSaving(true)
    try {
      await deleteHolidayRequest(request.id)
      showToast('Holiday request deleted')
      await loadRequests()
    } catch (error) {
      const message =
        error instanceof HolidayRequestsServiceError
          ? error.message
          : 'Failed to delete holiday request'
      showToast(message)
    } finally {
      setIsSaving(false)
    }
  }

  const showEmptyState =
    !isLoading && !loadError && totalCount === 0 && !hasActiveFilters

  return (
    <AdminLayout>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#2A376F]">
            Holiday Requests
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage annual leave, approvals and workforce availability.
          </p>
        </header>

        <HolidayRequestsSummaryCards stats={stats} />

        <HolidayRequestsToolbar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          workerFilter={workerFilter}
          onWorkerFilterChange={setWorkerFilter}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          workers={workers}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          onNewRequest={() => setIsNewModalOpen(true)}
        />

        {loadError ? (
          <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-[0_2px_8px_rgba(40,80,140,0.04)]">
            Loading holiday requests…
          </div>
        ) : showEmptyState ? (
          <HolidayRequestsEmptyState onCreateFirst={() => setIsNewModalOpen(true)} />
        ) : items.length === 0 ? (
          <div className="rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white px-6 py-10 text-center shadow-[0_2px_8px_rgba(40,80,140,0.04)]">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F]">
              No matching requests
            </h2>
            <p className="mt-2 text-sm text-slate-500">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div>
            <HolidayRequestsDataTable
              requests={items}
              onView={setViewRequest}
              onEdit={setEditRequest}
              onApprove={(request) => void handleApprove(request)}
              onReject={(request) => void handleReject(request)}
              onDelete={(request) => void handleDelete(request)}
            />
            <HolidayRequestsPagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      <NewHolidayRequestModal
        isOpen={isNewModalOpen}
        workers={workers}
        isSaving={isSaving}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleCreate}
      />

      <EditHolidayRequestModal
        request={editRequest}
        isOpen={editRequest !== null}
        isSaving={isSaving}
        onClose={() => setEditRequest(null)}
        onSubmit={handleUpdate}
      />

      <HolidayRequestDrawer
        request={viewRequest}
        isOpen={viewRequest !== null}
        isSaving={isSaving}
        onClose={() => setViewRequest(null)}
        onApprove={(note) => (viewRequest ? handleApprove(viewRequest, note) : Promise.resolve())}
        onReject={(note) => (viewRequest ? handleReject(viewRequest, note) : Promise.resolve())}
      />

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[60] rounded-[12px] bg-[#2A376F] px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </AdminLayout>
  )
}

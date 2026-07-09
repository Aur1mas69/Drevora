import { EditHolidayRequestModal } from '@/components/holidays/EditHolidayRequestModal'
import { HolidayRequestDrawer } from '@/components/holidays/HolidayRequestDrawer'
import { HolidayRequestsDataTable } from '@/components/holidays/HolidayRequestsDataTable'
import { HolidayRequestsEmptyState } from '@/components/holidays/HolidayRequestsEmptyState'
import {
  HolidayRequestsCalendar,
  type HolidayCalendarView,
} from '@/components/holidays/HolidayRequestsCalendar'
import { HolidayRequestsPagination } from '@/components/holidays/HolidayRequestsPagination'
import { HolidayRequestsSummaryCards } from '@/components/holidays/HolidayRequestsSummaryCards'
import { HolidayRequestsToolbar } from '@/components/holidays/HolidayRequestsToolbar'
import { holidayPageCardClass, holidayPrimaryButtonClass } from '@/components/holidays/holidayUiStyles'
import { NewHolidayRequestModal } from '@/components/holidays/NewHolidayRequestModal'
import { Button } from '@/components/ui/button'
import AdminLayout from '@/layouts/AdminLayout'
import type {
  HolidayRequest,
  HolidayLeaveType,
  HolidayRequestStatusFilter,
  HolidayRequestSummaryStats,
} from '@/lib/holidayRequestTypes'
import { DEFAULT_HOLIDAY_PAGE_SIZE } from '@/lib/holidayRequestTypes'
import { fetchDrivers, type Driver } from '@/services/driversService'
import {
  approveHolidayRequest,
  createHolidayRequest,
  deleteHolidayRequest,
  fetchHolidayCalendarRequests,
  fetchHolidayRequests,
  HolidayRequestsServiceError,
  rejectHolidayRequest,
  updateHolidayRequest,
} from '@/services/holidayRequestsService'
import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

export default function HolidayRequestsPage() {
  const [items, setItems] = useState<HolidayRequest[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState<HolidayRequestSummaryStats>({
    pendingRequests: 0,
    approvedRequests: 0,
    declinedRequests: 0,
    totalRequests: 0,
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
  const [calendarItems, setCalendarItems] = useState<HolidayRequest[]>([])
  const [calendarView, setCalendarView] = useState<HolidayCalendarView>('month')
  const [calendarAnchorDate, setCalendarAnchorDate] = useState(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  const [calendarRange, setCalendarRange] = useState<{ start: string; end: string } | null>(null)
  const [isCalendarLoading, setIsCalendarLoading] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0)

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

  const loadCalendarRequests = useCallback(async () => {
    if (!calendarRange) return

    setIsCalendarLoading(true)
    setCalendarError(null)

    try {
      const calendarRequests = await fetchHolidayCalendarRequests({
        dateFrom: calendarRange.start,
        dateTo: calendarRange.end,
        statuses: ['Approved', 'Pending'],
      })
      setCalendarItems(calendarRequests)
    } catch (error) {
      const message =
        error instanceof HolidayRequestsServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to load holiday calendar'
      setCalendarError(message)
    } finally {
      setIsCalendarLoading(false)
    }
  }, [calendarRange])

  const handleCalendarRangeChange = useCallback((range: { start: string; end: string }) => {
    setCalendarRange((current) =>
      current?.start === range.start && current.end === range.end ? current : range,
    )
  }, [])

  useEffect(() => {
    void loadWorkers().catch(() => {
      /* workers load failure handled on submit */
    })
  }, [loadWorkers])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  useEffect(() => {
    if (!calendarRange) return
    void loadCalendarRequests()
  }, [calendarRange, calendarRefreshKey, loadCalendarRequests])

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
    leaveType: HolidayLeaveType
    reason: string
  }) {
    setIsSaving(true)
    try {
      await createHolidayRequest({
        workerId: input.workerId,
        startDate: input.startDate,
        endDate: input.endDate,
        leaveType: input.leaveType,
        reason: input.reason,
      })
      showToast('Holiday request submitted')
      await loadRequests()
      setCalendarRefreshKey((current) => current + 1)
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
    leaveType: HolidayRequest['leaveType']
  }) {
    if (!editRequest) return

    setIsSaving(true)
    try {
      await updateHolidayRequest(editRequest.id, {
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason,
        status: input.status,
        leaveType: input.leaveType,
      })
      showToast('Holiday request updated')
      setEditRequest(null)
      await loadRequests()
      setCalendarRefreshKey((current) => current + 1)
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
      setCalendarRefreshKey((current) => current + 1)
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
      showToast('Holiday request declined')
      setViewRequest(null)
      await loadRequests()
      setCalendarRefreshKey((current) => current + 1)
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
      setCalendarRefreshKey((current) => current + 1)
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
      <div className="min-w-0 space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#218EE7]">
              Operations
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#113C69]">
              Holiday Requests
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[#5499BF]">
              Manage worker holiday requests, approvals and declined requests.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className={`w-full shrink-0 sm:w-auto ${holidayPrimaryButtonClass}`}
          >
            <Plus className="mr-1.5 size-4" />
            New Holiday Request
          </Button>
        </header>

        <HolidayRequestsSummaryCards
          stats={stats}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

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
          onClearFilters={clearFilters}
        />

        {loadError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </div>
        ) : null}

        {isLoading ? (
          <div className={`px-6 py-10 text-center text-sm text-[#5499BF] ${holidayPageCardClass}`}>
            Loading holiday requests…
          </div>
        ) : showEmptyState ? (
          <HolidayRequestsEmptyState onCreateFirst={() => setIsNewModalOpen(true)} />
        ) : items.length === 0 ? (
          <div className={`px-6 py-10 text-center ${holidayPageCardClass}`}>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#113C69]">
              No holiday requests found.
            </h2>
            <p className="mt-2 text-sm text-[#5499BF]">Try adjusting your search or filters.</p>
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

        <HolidayRequestsCalendar
          requests={calendarItems}
          workers={workers}
          isLoading={isCalendarLoading}
          error={calendarError}
          view={calendarView}
          anchorDate={calendarAnchorDate}
          onViewChange={setCalendarView}
          onAnchorDateChange={setCalendarAnchorDate}
          onRangeChange={handleCalendarRangeChange}
        />
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

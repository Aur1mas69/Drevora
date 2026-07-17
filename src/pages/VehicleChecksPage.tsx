import { DeleteVehicleCheckModal } from '@/components/vehicle-checks/DeleteVehicleCheckModal'
import { EditVehicleCheckModal } from '@/components/vehicle-checks/EditVehicleCheckModal'
import { NewVehicleCheckModal } from '@/components/vehicle-checks/NewVehicleCheckModal'
import { TyreCheckPanel } from '@/components/vehicle-checks/TyreCheckPanel'
import { VehicleCheckDrawer } from '@/components/vehicle-checks/VehicleCheckDrawer'
import { VehicleChecksDataTable } from '@/components/vehicle-checks/VehicleChecksDataTable'
import { VehicleChecksEmptyState } from '@/components/vehicle-checks/VehicleChecksEmptyState'
import {
  VehicleChecksModuleTabs,
  type VehicleChecksModuleTab,
} from '@/components/vehicle-checks/VehicleChecksModuleTabs'
import { VehicleChecksPagination } from '@/components/vehicle-checks/VehicleChecksPagination'
import {
  VehicleChecksSummaryCards,
  type VehicleChecksKpiFilter,
} from '@/components/vehicle-checks/VehicleChecksSummaryCards'
import { VehicleChecksToolbar } from '@/components/vehicle-checks/VehicleChecksToolbar'
import AdminLayout from '@/layouts/AdminLayout'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import type {
  VehicleCheck,
  VehicleCheckListItem,
  VehicleCheckOdometerUnit,
  VehicleCheckResultFilter,
  VehicleCheckStatusFilter,
  VehicleCheckSummaryStats,
} from '@/lib/vehicleCheckTypes'
import { DEFAULT_VEHICLE_CHECK_PAGE_SIZE } from '@/lib/vehicleCheckTypes'
import { fetchDrivers, type Driver } from '@/services/driversService'
import {
  createVehicleCheck,
  deleteVehicleCheck,
  fetchVehicleCheckById,
  fetchVehicleChecks,
  updateVehicleCheck,
  VehicleChecksServiceError,
} from '@/services/vehicleChecksService'
import {
  fetchVehicles,
  getVehicleStatusForDate,
  type Vehicle,
  type VehicleStatus,
} from '@/services/vehiclesService'
import { getCurrentViewToday } from '@/lib/currentViewVisibility'
import { useCallback, useEffect, useState } from 'react'

const vehicleUnavailableStatuses: VehicleStatus[] = [
  'Off Road',
  'Maintenance',
  'Workshop',
  'Out of Service',
  'Reserved',
  'Assigned',
]

export default function VehicleChecksPage() {
  const { companyReady, companyId, companyLoading, membershipError } = useCompanyTenantGate()
  const [moduleTab, setModuleTab] = useState<VehicleChecksModuleTab>('vehicle-checks')
  const [items, setItems] = useState<VehicleCheckListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState<VehicleCheckSummaryStats>({
    totalChecks: 0,
    checksToday: 0,
    passedToday: 0,
    failedToday: 0,
    defectsReported: 0,
    openDefects: 0,
    vehiclesChecked: 0,
    failedInspections: 0,
  })
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<VehicleCheckStatusFilter>('all')
  const [resultFilter, setResultFilter] = useState<VehicleCheckResultFilter>('all')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [workerFilter, setWorkerFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState(() => getCurrentViewToday())
  const [dateTo, setDateTo] = useState(() => getCurrentViewToday())
  const [activeKpiFilter, setActiveKpiFilter] = useState<VehicleChecksKpiFilter>('checksToday')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_VEHICLE_CHECK_PAGE_SIZE)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [viewCheck, setViewCheck] = useState<VehicleCheck | null>(null)
  const [editCheck, setEditCheck] = useState<VehicleCheck | null>(null)
  const [deletingCheck, setDeletingCheck] = useState<VehicleCheckListItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 ||
    statusFilter !== 'all' ||
    resultFilter !== 'all' ||
    vehicleFilter !== 'all' ||
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
  }, [dateFrom, dateTo, debouncedSearch, pageSize, resultFilter, statusFilter, vehicleFilter, workerFilter])

  const loadReferenceData = useCallback(async () => {
    const [loadedVehicles, loadedDrivers] = await Promise.all([
      fetchVehicles(),
      fetchDrivers(),
    ])
    setVehicles(loadedVehicles)
    setDrivers(loadedDrivers)
  }, [])

  const loadChecks = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const result = await fetchVehicleChecks({
        search: debouncedSearch,
        status: statusFilter,
        result: resultFilter,
        vehicleId: vehicleFilter,
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
        error instanceof VehicleChecksServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to load vehicle checks'
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }, [dateFrom, dateTo, debouncedSearch, page, pageSize, resultFilter, statusFilter, vehicleFilter, workerFilter])

  useEffect(() => {
    if (!companyReady || !companyId) {
      if (!companyLoading) {
        setVehicles([])
        setDrivers([])
      }
      return
    }

    void loadReferenceData().catch(() => {
      /* reference data errors surface on create */
    })
  }, [companyReady, companyId, companyLoading, loadReferenceData])

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

    void loadChecks()
  }, [companyReady, companyId, companyLoading, membershipError, loadChecks])

  async function openCheckDetail(id: string, mode: 'view' | 'edit') {
    setIsLoadingDetail(true)
    try {
      const detail = await fetchVehicleCheckById(id)
      if (!detail) {
        showToast('Inspection not found')
        return
      }

      if (mode === 'view') {
        setViewCheck(detail)
      } else {
        setEditCheck(detail)
      }
    } catch (error) {
      const message =
        error instanceof VehicleChecksServiceError
          ? error.message
          : 'Failed to load inspection'
      showToast(message)
    } finally {
      setIsLoadingDetail(false)
    }
  }

  function clearFilters() {
    setSearchTerm('')
    setDebouncedSearch('')
    setStatusFilter('all')
    setResultFilter('all')
    setVehicleFilter('all')
    setWorkerFilter('all')
    setDateFrom('')
    setDateTo('')
    setActiveKpiFilter(null)
  }

  function handleKpiFilterChange(value: VehicleChecksKpiFilter) {
    setActiveKpiFilter(value)
    setSearchTerm('')
    setDebouncedSearch('')
    setVehicleFilter('all')
    setWorkerFilter('all')

    if (!value) {
      setStatusFilter('all')
      setResultFilter('all')
      setDateFrom('')
      setDateTo('')
      return
    }

    setDateFrom(getCurrentViewToday())
    setDateTo(getCurrentViewToday())
    setStatusFilter('all')

    if (value === 'passedToday') {
      setResultFilter('Pass')
    } else if (value === 'failedToday') {
      setResultFilter('Fail')
    } else if (value === 'defectsReported') {
      setResultFilter('Defects')
      setDateFrom('')
      setDateTo('')
    } else {
      setResultFilter('all')
    }
  }

  async function handleCreate(input: {
    vehicleId: string
    workerId: string
    inspectionDate: string
    odometer: number
    odometerUnit: VehicleCheckOdometerUnit
    notes: string
    signatureFile: File
    inspectionStartedAt: string
    items: Parameters<typeof createVehicleCheck>[0]['items']
  }) {
    setIsSaving(true)
    try {
      await createVehicleCheck({
        vehicleId: input.vehicleId,
        workerId: input.workerId,
        inspectionDate: input.inspectionDate,
        odometer: input.odometer,
        odometerUnit: input.odometerUnit,
        notes: input.notes,
        signatureFile: input.signatureFile,
        inspectionStartedAt: input.inspectionStartedAt,
        items: input.items,
      })
      showToast('Inspection saved')
      await loadChecks()
    } catch (error) {
      throw error instanceof VehicleChecksServiceError
        ? error
        : new VehicleChecksServiceError('Failed to save inspection')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdate(input: {
    vehicleId: string
    workerId: string
    inspectionDate: string
    odometer: number | null
    status: VehicleCheck['status']
    notes: string
    items: Parameters<typeof updateVehicleCheck>[1]['items']
  }) {
    if (!editCheck) return

    setIsSaving(true)
    try {
      await updateVehicleCheck(editCheck.id, {
        vehicleId: input.vehicleId,
        workerId: input.workerId,
        inspectionDate: input.inspectionDate,
        odometer: input.odometer,
        status: input.status,
        notes: input.notes,
        items: input.items,
      })
      showToast('Inspection updated')
      setEditCheck(null)
      await loadChecks()
    } catch (error) {
      throw error instanceof VehicleChecksServiceError
        ? error
        : new VehicleChecksServiceError('Failed to update inspection')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deletingCheck) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await deleteVehicleCheck(deletingCheck.id)

      if (viewCheck?.id === deletingCheck.id) setViewCheck(null)
      if (editCheck?.id === deletingCheck.id) setEditCheck(null)

      setDeletingCheck(null)
      showToast('Vehicle check deleted')
      await loadChecks()
    } catch (error) {
      const message =
        error instanceof VehicleChecksServiceError
          ? error.message
          : 'Unable to delete vehicle check. Please try again.'
      setDeleteError(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const today = getCurrentViewToday()
  const activeVehicleCount = vehicles.filter(
    (vehicle) => !vehicleUnavailableStatuses.includes(getVehicleStatusForDate(vehicle, today)),
  ).length
  const vehiclesNotChecked =
    vehicles.length > 0 ? Math.max(activeVehicleCount - stats.vehiclesChecked, 0) : null
  const isTodayView =
    debouncedSearch.trim().length === 0 &&
    statusFilter === 'all' &&
    resultFilter === 'all' &&
    vehicleFilter === 'all' &&
    workerFilter === 'all' &&
    dateFrom === today &&
    dateTo === today
  const showNoRecordsState = !isLoading && !loadError && totalCount === 0 && stats.totalChecks === 0
  const showNoTodayState =
    !isLoading && !loadError && totalCount === 0 && stats.totalChecks > 0 && isTodayView

  return (
    <AdminLayout>
      <div className="space-y-4">
        <VehicleChecksModuleTabs
          activeTab={moduleTab}
          onTabChange={setModuleTab}
        />

        {moduleTab === 'tyre-check' ? (
          <TyreCheckPanel vehicles={vehicles} drivers={drivers} />
        ) : (
          <>
        <header>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#2A376F]">
            Vehicle Checks
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage daily vehicle inspections and defect reports.
          </p>
        </header>

        <VehicleChecksSummaryCards
          stats={stats}
          vehiclesNotChecked={vehiclesNotChecked}
          activeFilter={activeKpiFilter}
          onFilterChange={handleKpiFilterChange}
        />

        <VehicleChecksToolbar
          searchTerm={searchTerm}
          onSearchTermChange={(value) => {
            setSearchTerm(value)
            setActiveKpiFilter(null)
          }}
          statusFilter={statusFilter}
          onStatusFilterChange={(value) => {
            setStatusFilter(value)
            setActiveKpiFilter(null)
          }}
          resultFilter={resultFilter}
          onResultFilterChange={(value) => {
            setResultFilter(value)
            setActiveKpiFilter(null)
          }}
          vehicleFilter={vehicleFilter}
          onVehicleFilterChange={(value) => {
            setVehicleFilter(value)
            setActiveKpiFilter(null)
          }}
          workerFilter={workerFilter}
          onWorkerFilterChange={(value) => {
            setWorkerFilter(value)
            setActiveKpiFilter(null)
          }}
          dateFrom={dateFrom}
          onDateFromChange={(value) => {
            setDateFrom(value)
            setActiveKpiFilter(null)
          }}
          dateTo={dateTo}
          onDateToChange={(value) => {
            setDateTo(value)
            setActiveKpiFilter(null)
          }}
          vehicles={vehicles}
          workers={drivers}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          onNewCheck={() => setIsNewModalOpen(true)}
        />

        {loadError ? (
          <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-[0_2px_8px_rgba(40,80,140,0.04)]">
            Loading inspections…
          </div>
        ) : showNoRecordsState ? (
          <VehicleChecksEmptyState onCreateFirst={() => setIsNewModalOpen(true)} />
        ) : showNoTodayState ? (
          <div className="rounded-[18px] border border-[#D3E9FC] bg-white px-6 py-10 text-center shadow-[0_10px_30px_rgba(33,142,231,0.08)]">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F]">
              No checks completed today.
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Change the date range or clear the date filters to view previous checks.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white px-6 py-10 text-center shadow-[0_2px_8px_rgba(40,80,140,0.04)]">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F]">
              No matching inspections
            </h2>
            <p className="mt-2 text-sm text-slate-500">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div>
            <VehicleChecksDataTable
              checks={items}
              onView={(check) => void openCheckDetail(check.id, 'view')}
              onEdit={(check) => void openCheckDetail(check.id, 'edit')}
              onDelete={(check) => {
                setDeleteError(null)
                setDeletingCheck(check)
              }}
            />
            <VehicleChecksPagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
          </>
        )}
      </div>

      <NewVehicleCheckModal
        isOpen={isNewModalOpen}
        vehicles={vehicles}
        drivers={drivers}
        isSaving={isSaving}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleCreate}
      />

      <EditVehicleCheckModal
        check={editCheck}
        isOpen={editCheck !== null}
        vehicles={vehicles}
        drivers={drivers}
        isSaving={isSaving}
        onClose={() => setEditCheck(null)}
        onSubmit={handleUpdate}
      />

      <VehicleCheckDrawer
        check={viewCheck}
        isOpen={viewCheck !== null}
        onClose={() => setViewCheck(null)}
        onEdit={() => {
          if (!viewCheck) return
          setEditCheck(viewCheck)
          setViewCheck(null)
        }}
      />

      {deletingCheck ? (
        <DeleteVehicleCheckModal
          check={deletingCheck}
          errorMessage={deleteError}
          isDeleting={isDeleting}
          onCancel={() => {
            if (isDeleting) return
            setDeletingCheck(null)
            setDeleteError(null)
          }}
          onConfirm={() => void handleConfirmDelete()}
        />
      ) : null}

      {isLoadingDetail ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px]">
          <div className="rounded-[12px] bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-lg">
            Loading inspection…
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[60] rounded-[12px] bg-[#2A376F] px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </AdminLayout>
  )
}

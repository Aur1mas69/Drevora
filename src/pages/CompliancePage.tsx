import { AddComplianceRecordModal } from '@/components/compliance/AddComplianceRecordModal'
import {
  ComplianceCentreTabBar,
  ComplianceCentreToolbar,
} from '@/components/compliance/ComplianceCentreToolbar'
import { ComplianceDashboardCards } from '@/components/compliance/ComplianceDashboardCards'
import { ComplianceEmptyState } from '@/components/compliance/ComplianceEmptyState'
import { ComplianceExpiryTable } from '@/components/compliance/ComplianceExpiryTable'
import { CompliancePagination } from '@/components/compliance/CompliancePagination'
import { VehiclesComplianceTable } from '@/components/compliance/VehiclesComplianceTable'
import { WorkersComplianceTable } from '@/components/compliance/WorkersComplianceTable'
import { Button } from '@/components/ui/button'
import AdminLayout from '@/layouts/AdminLayout'
import type { ComplianceCentreTab, ComplianceRecordFormInput } from '@/lib/complianceTypes'
import { DEFAULT_COMPLIANCE_PAGE_SIZE } from '@/lib/complianceTypes'
import {
  buildAllDocuments,
  buildVehicleSummaries,
  buildWorkerSummaries,
  computeDashboardStats,
  filterDocumentsBySearch,
  filterExpiredDocuments,
  filterExpiringDocuments,
  filterSummariesBySearch,
} from '@/lib/complianceUtils'
import { fetchDrivers, type Driver } from '@/services/driversService'
import {
  createWorkerComplianceRecord,
  fetchWorkerComplianceRecords,
  WorkerComplianceServiceError,
} from '@/services/workerComplianceService'
import {
  fetchVehicleComplianceRecords,
  VehicleComplianceServiceError,
} from '@/services/vehicleComplianceService'
import { fetchVehicles, type Vehicle } from '@/services/vehiclesService'
import { useCallback, useEffect, useMemo, useState } from 'react'

const TAB_EMPTY_MESSAGES: Record<ComplianceCentreTab, string> = {
  workers: 'No workers match your search.',
  vehicles: 'No vehicles match your search.',
  'expiring-soon': 'Nothing is expiring within the next 60 days.',
  expired: 'No expired compliance items found.',
}

export default function CompliancePage() {
  const [workerRecords, setWorkerRecords] = useState<Awaited<ReturnType<typeof fetchWorkerComplianceRecords>>>([])
  const [vehicleRecords, setVehicleRecords] = useState<Awaited<ReturnType<typeof fetchVehicleComplianceRecords>>>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [activeTab, setActiveTab] = useState<ComplianceCentreTab>('workers')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_COMPLIANCE_PAGE_SIZE)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

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
  }, [activeTab, debouncedSearch, pageSize])

  const loadComplianceData = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [loadedWorkerRecords, loadedVehicleRecords, loadedDrivers, loadedVehicles] =
        await Promise.all([
          fetchWorkerComplianceRecords(),
          fetchVehicleComplianceRecords(),
          fetchDrivers(),
          fetchVehicles(),
        ])

      setWorkerRecords(loadedWorkerRecords)
      setVehicleRecords(loadedVehicleRecords)
      setDrivers(loadedDrivers)
      setVehicles(loadedVehicles)
    } catch (error) {
      const message =
        error instanceof WorkerComplianceServiceError
          ? error.message
          : error instanceof VehicleComplianceServiceError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Failed to load compliance data'
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadComplianceData()
  }, [loadComplianceData])

  const workerSummaries = useMemo(
    () => buildWorkerSummaries(workerRecords, drivers),
    [workerRecords, drivers],
  )

  const vehicleSummaries = useMemo(
    () => buildVehicleSummaries(vehicleRecords, vehicles),
    [vehicleRecords, vehicles],
  )

  const allDocuments = useMemo(
    () => buildAllDocuments(workerRecords, vehicleRecords, drivers, vehicles),
    [workerRecords, vehicleRecords, drivers, vehicles],
  )

  const dashboardStats = useMemo(
    () => computeDashboardStats(workerSummaries, vehicleSummaries, allDocuments),
    [workerSummaries, vehicleSummaries, allDocuments],
  )

  const filteredWorkers = useMemo(
    () =>
      filterSummariesBySearch(workerSummaries, debouncedSearch, [
        'workerName',
        'workerRole',
        'department',
        'email',
      ]),
    [workerSummaries, debouncedSearch],
  )

  const filteredVehicles = useMemo(
    () =>
      filterSummariesBySearch(vehicleSummaries, debouncedSearch, [
        'registration',
        'fleetNumber',
        'vehicleName',
      ]),
    [vehicleSummaries, debouncedSearch],
  )

  const filteredExpiring = useMemo(
    () => filterDocumentsBySearch(filterExpiringDocuments(allDocuments), debouncedSearch),
    [allDocuments, debouncedSearch],
  )

  const filteredExpired = useMemo(
    () => filterDocumentsBySearch(filterExpiredDocuments(allDocuments), debouncedSearch),
    [allDocuments, debouncedSearch],
  )

  const activeItems = useMemo(() => {
    switch (activeTab) {
      case 'workers':
        return filteredWorkers
      case 'vehicles':
        return filteredVehicles
      case 'expiring-soon':
        return filteredExpiring
      case 'expired':
        return filteredExpired
    }
  }, [activeTab, filteredWorkers, filteredVehicles, filteredExpiring, filteredExpired])

  const paginatedWorkers = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredWorkers.slice(start, start + pageSize)
  }, [filteredWorkers, page, pageSize])

  const paginatedVehicles = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredVehicles.slice(start, start + pageSize)
  }, [filteredVehicles, page, pageSize])

  const paginatedExpiring = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredExpiring.slice(start, start + pageSize)
  }, [filteredExpiring, page, pageSize])

  const paginatedExpired = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredExpired.slice(start, start + pageSize)
  }, [filteredExpired, page, pageSize])

  function handleTabChange(tab: ComplianceCentreTab) {
    setActiveTab(tab)
    setSearchTerm('')
    setDebouncedSearch('')
  }

  async function handleCreate(input: ComplianceRecordFormInput) {
    setIsSaving(true)
    try {
      await createWorkerComplianceRecord({
        workerId: input.workerId,
        documentType: input.documentType,
        documentName: input.documentName || null,
        issueDate: input.issueDate || null,
        expiryDate: input.expiryDate || null,
        referenceNumber: input.referenceNumber || null,
        notes: input.notes || null,
      })
      showToast('Compliance record added')
      await loadComplianceData()
    } catch (error) {
      throw error instanceof WorkerComplianceServiceError
        ? error
        : new WorkerComplianceServiceError('Failed to create compliance record')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminLayout>
      <section className="rounded-[28px] bg-white/75 p-5 shadow-[0_24px_70px_rgba(59,130,246,0.10)] ring-1 ring-white/70 backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-[2.15rem]">
              Documents
            </p>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
              Manage company, worker and vehicle documents in one place.
            </p>
          </div>
          <ComplianceCentreTabBar activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
      </section>

      {isLoading ? (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[132px] animate-pulse rounded-[20px] bg-white ring-1 ring-blue-100/70"
            />
          ))}
        </section>
      ) : null}

      {!isLoading && errorMessage ? (
        <div className="rounded-[22px] bg-white px-6 py-14 text-center shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
          <p className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
            Unable to load compliance data
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium text-slate-500">
            {errorMessage}
          </p>
          <Button
            type="button"
            onClick={() => void loadComplianceData()}
            className="mt-6 h-11 rounded-[16px] bg-[#3B82F6] px-5 font-semibold text-white hover:bg-[#2563EB]"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {!isLoading && !errorMessage ? (
        <>
          <ComplianceDashboardCards stats={dashboardStats} />

          <ComplianceCentreToolbar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            onAddRecord={() => setIsAddModalOpen(true)}
          />

          {activeItems.length === 0 ? (
            <ComplianceEmptyState
              message={TAB_EMPTY_MESSAGES[activeTab]}
              onAddRecord={activeTab === 'workers' ? () => setIsAddModalOpen(true) : undefined}
            />
          ) : (
            <div>
              {activeTab === 'workers' ? <WorkersComplianceTable workers={paginatedWorkers} /> : null}
              {activeTab === 'vehicles' ? <VehiclesComplianceTable vehicles={paginatedVehicles} /> : null}
              {activeTab === 'expiring-soon' ? (
                <ComplianceExpiryTable documents={paginatedExpiring} />
              ) : null}
              {activeTab === 'expired' ? (
                <ComplianceExpiryTable documents={paginatedExpired} />
              ) : null}
              <CompliancePagination
                page={page}
                pageSize={pageSize}
                totalCount={activeItems.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </>
      ) : null}

      <AddComplianceRecordModal
        isOpen={isAddModalOpen}
        workers={drivers}
        isSaving={isSaving}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreate}
      />

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[60] rounded-[12px] bg-[#2A376F] px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </AdminLayout>
  )
}

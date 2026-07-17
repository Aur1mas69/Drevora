import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Truck } from 'lucide-react'
import AdminLayout from '@/layouts/AdminLayout'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import { Button } from '@/components/ui/button'
import {
  adminEmptyState,
  adminHeading,
  adminTextMuted,
} from '@/lib/adminUiStyles'
import {
  AvailabilityDetailsModal,
  DeleteAvailabilityModal,
  EditAvailabilityModal,
  type AvailabilityDetailsContext,
} from '@/components/vehicles/AvailabilityEventModals'
import { FleetAvailabilityOverview } from '@/components/vehicles/FleetAvailabilityOverview'
import { FleetPlanningCalendar } from '@/components/vehicles/FleetPlanningCalendar'
import { DeleteVehicleModal } from '@/components/vehicles/DeleteVehicleModal'
import { VehicleEditModal } from '@/components/vehicles/VehicleEditModal'
import {
  VehiclesDataTable,
  VehiclesTableSkeleton,
} from '@/components/vehicles/VehiclesDataTable'
import {
  VehiclesFilterBar,
  type StatusFilter,
} from '@/components/vehicles/VehiclesFilterBar'
import { VehiclesSummaryCards } from '@/components/vehicles/VehiclesSummaryCards'
import type { VehicleKpiKey } from '@/components/vehicles/vehicleSummaryKpiStyles'
import {
  computeFleetSummaryStats,
  exportVehiclesToCsv,
  matchesDocumentFilter,
  vehicleMatchesSearch,
  type DocumentFilter,
} from '@/lib/vehiclePageUtils'
import {
  getVehicleFormValues,
  initialVehicleForm,
  scheduledAvailabilityStatuses,
  validateVehicleForm,
  vehicleStatuses,
  type VehicleFormErrors,
} from '@/lib/vehicleForm'
import { VEHICLES_UPDATED_EVENT } from '@/lib/vehicleEvents'
import type { CalendarView, PlanningEvent } from '@/lib/vehiclePlanning'
import { driversService, type Driver } from '@/services/driversService'
import {
  vehiclesService,
  getVehicleStatusForDate,
  type Vehicle,
  type VehicleAvailability,
  type VehicleAvailabilityInput,
  type VehicleInput,
  type VehicleStatus,
} from '@/services/vehiclesService'

function parseVehicleStatusFilter(value: string | null): StatusFilter {
  if (!value) return 'All'
  if (value === 'Unavailable') return 'Unavailable'
  if (value === 'MaintenanceDue') return 'MaintenanceDue'
  if (vehicleStatuses.includes(value as VehicleStatus)) {
    return value as VehicleStatus
  }
  return 'All'
}

function getActiveVehicleQuickFilter(
  statusFilter: StatusFilter,
  motFilter: DocumentFilter,
  insuranceFilter: DocumentFilter,
): VehicleKpiKey | null {
  if (motFilter === 'All' && insuranceFilter === 'All') {
    if (statusFilter === 'Available') return 'available'
    if (statusFilter === 'Unavailable') return 'offRoad'
    if (statusFilter === 'MaintenanceDue') return 'maintenanceDue'
  }

  if (statusFilter === 'All' && motFilter === 'Expiring Soon' && insuranceFilter === 'All') {
    return 'motExpiringSoon'
  }

  if (statusFilter === 'All' && motFilter === 'All' && insuranceFilter === 'Expiring Soon') {
    return 'insuranceExpiringSoon'
  }

  return null
}

function VehiclesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { companyReady, companyId, companyLoading, membershipError } = useCompanyTenantGate()
  const calendarSectionRef = useRef<HTMLDivElement>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [driverFilter, setDriverFilter] = useState('All')
  const [motFilter, setMotFilter] = useState<DocumentFilter>('All')
  const [insuranceFilter, setInsuranceFilter] = useState<DocumentFilter>('All')
  const [tablePage, setTablePage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null)
  const [form, setForm] = useState<VehicleInput>(initialVehicleForm)
  const [formErrors, setFormErrors] = useState<VehicleFormErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [detailsContext, setDetailsContext] =
    useState<AvailabilityDetailsContext | null>(null)
  const [editingRecord, setEditingRecord] = useState<VehicleAvailability | null>(
    null,
  )
  const [deletingRecord, setDeletingRecord] = useState<VehicleAvailability | null>(
    null,
  )
  const [availabilityEditError, setAvailabilityEditError] = useState<string | null>(
    null,
  )
  const [availabilityDeleteError, setAvailabilityDeleteError] = useState<
    string | null
  >(null)
  const [isSavingAvailability, setIsSavingAvailability] = useState(false)
  const [isDeletingAvailability, setIsDeletingAvailability] = useState(false)

  const showFullCalendar = searchParams.get('view') === 'calendar'

  const loadVehicles = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const [vehicleResult, driverResult] = await Promise.all([
        vehiclesService.fetchVehicles(),
        driversService.fetchDrivers(),
      ])
      setVehicles(vehicleResult)
      setDrivers(driverResult)
    } catch {
      setLoadError('Please check the vehicles table and try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    setStatusFilter(parseVehicleStatusFilter(searchParams.get('status')))
  }, [searchParams])

  useEffect(() => {
    if (!showFullCalendar) return

    const timeoutId = window.setTimeout(() => {
      calendarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)

    return () => window.clearTimeout(timeoutId)
  }, [showFullCalendar])

  useEffect(() => {
    if (!companyReady || !companyId) {
      if (!companyLoading) {
        setIsLoading(false)
        setVehicles([])
        setDrivers([])
        if (membershipError) {
          setLoadError(membershipError)
        }
      }
      return
    }

    void loadVehicles()
  }, [companyReady, companyId, companyLoading, membershipError, loadVehicles])

  useEffect(() => {
    function handleVehiclesUpdated() {
      if (!companyReady || !companyId) return
      void loadVehicles()
    }

    window.addEventListener(VEHICLES_UPDATED_EVENT, handleVehiclesUpdated)
    return () => window.removeEventListener(VEHICLES_UPDATED_EVENT, handleVehiclesUpdated)
  }, [companyReady, companyId, loadVehicles])

  useEffect(() => {
    if (!toastMessage) return
    const timeoutId = window.setTimeout(() => setToastMessage(null), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [toastMessage])

  useEffect(() => {
    setTablePage(1)
  }, [searchTerm, statusFilter, driverFilter, motFilter, insuranceFilter])

  const summaryStats = useMemo(
    () => computeFleetSummaryStats(vehicles),
    [vehicles],
  )

  const filteredVehicles = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return vehicles.filter((vehicle) => {
      const currentStatus = getVehicleStatusForDate(vehicle)

      const matchesSearch = vehicleMatchesSearch(vehicle, query, drivers)
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Unavailable'
          ? currentStatus === 'Off Road' || currentStatus === 'Out of Service'
          : statusFilter === 'MaintenanceDue'
            ? currentStatus === 'Maintenance' || currentStatus === 'Workshop'
            : currentStatus === statusFilter)
      const matchesDriver =
        driverFilter === 'All' ||
        (driverFilter === 'Unassigned'
          ? !vehicle.currentDriverId
          : vehicle.currentDriverId === driverFilter)
      const matchesMot = matchesDocumentFilter(vehicle.motExpiry, motFilter)
      const matchesInsurance = matchesDocumentFilter(
        vehicle.insuranceExpiry,
        insuranceFilter,
      )

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDriver &&
        matchesMot &&
        matchesInsurance
      )
    })
  }, [
    driverFilter,
    drivers,
    insuranceFilter,
    motFilter,
    searchTerm,
    statusFilter,
    vehicles,
  ])

  const calendarInitialView = useMemo((): CalendarView | undefined => {
    return showFullCalendar ? 'Week' : undefined
  }, [showFullCalendar])

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    statusFilter !== 'All' ||
    driverFilter !== 'All' ||
    motFilter !== 'All' ||
    insuranceFilter !== 'All'

  function handleStatusFilterChange(value: StatusFilter) {
    setStatusFilter(value)
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        if (value === 'All') {
          nextParams.delete('status')
        } else {
          nextParams.set('status', value)
        }
        return nextParams
      },
      { replace: true },
    )
  }

  function handleQuickFilterSelect(key: VehicleKpiKey) {
    const activeKey = getActiveVehicleQuickFilter(
      statusFilter,
      motFilter,
      insuranceFilter,
    )

    if (activeKey === key) {
      handleStatusFilterChange('All')
      setMotFilter('All')
      setInsuranceFilter('All')
      return
    }

    switch (key) {
      case 'available':
        handleStatusFilterChange('Available')
        setMotFilter('All')
        setInsuranceFilter('All')
        break
      case 'offRoad':
        handleStatusFilterChange('Unavailable')
        setMotFilter('All')
        setInsuranceFilter('All')
        break
      case 'maintenanceDue':
        handleStatusFilterChange('MaintenanceDue')
        setMotFilter('All')
        setInsuranceFilter('All')
        break
      case 'motExpiringSoon':
        handleStatusFilterChange('All')
        setMotFilter('Expiring Soon')
        setInsuranceFilter('All')
        break
      case 'insuranceExpiringSoon':
        handleStatusFilterChange('All')
        setMotFilter('All')
        setInsuranceFilter('Expiring Soon')
        break
    }
  }

  function clearAllFilters() {
    setSearchTerm('')
    setStatusFilter('All')
    setDriverFilter('All')
    setMotFilter('All')
    setInsuranceFilter('All')
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        nextParams.delete('status')
        nextParams.delete('view')
        return nextParams
      },
      { replace: true },
    )
  }

  function openFullCalendar() {
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        nextParams.set('view', 'calendar')
        return nextParams
      },
      { replace: true },
    )
  }

  function openAddVehicleModal() {
    setForm(initialVehicleForm)
    setFormErrors({})
    setSaveError(null)
    setEditingVehicle(null)
    setIsModalOpen(true)
  }

  function openEditVehicleModal(vehicle: Vehicle) {
    setForm(getVehicleFormValues(vehicle))
    setFormErrors({})
    setSaveError(null)
    setEditingVehicle(vehicle)
    setIsModalOpen(true)
  }

  function handleFormChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
      ...(name === 'status' ? { offRoadReason: '' } : {}),
      ...(name === 'vehicleType' && value !== 'Trailer' ? { trailerNumber: '' } : {}),
    }))
    setFormErrors((currentErrors) => ({ ...currentErrors, [name]: undefined }))
  }

  async function handleSaveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateVehicleForm(form)
    setFormErrors(validationErrors)
    setSaveError(null)

    if (Object.keys(validationErrors).length > 0) return

    setIsSaving(true)
    try {
      const shouldCreateAvailability =
        scheduledAvailabilityStatuses.includes(form.status) && form.offRoadStartDate
      const vehicleForm: VehicleInput = shouldCreateAvailability
        ? {
            ...form,
            status: editingVehicle?.baseStatus ?? 'Available',
            offRoadReason: '',
            offRoadStartDate: '',
            offRoadExpectedReturnDate: '',
            offRoadNotes: '',
          }
        : form
      let savedVehicle: Vehicle

      if (editingVehicle) {
        savedVehicle = await vehiclesService.updateVehicle(
          editingVehicle.id,
          vehicleForm,
        )
      } else {
        savedVehicle = await vehiclesService.createVehicle(vehicleForm)
      }

      if (shouldCreateAvailability) {
        await vehiclesService.createAvailabilityRecord({
          vehicleId: savedVehicle.id,
          status: form.status,
          startDate: form.offRoadStartDate,
          endDate: form.offRoadExpectedReturnDate,
          reason: form.offRoadReason,
          notes: form.offRoadNotes,
        })
      }

      setIsModalOpen(false)
      setEditingVehicle(null)
      setForm(initialVehicleForm)
      await loadVehicles()
      setToastMessage(
        editingVehicle
          ? 'Vehicle updated successfully.'
          : 'Vehicle created successfully.',
      )
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Unable to save vehicle. Please check the details and try again.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmDeleteVehicle() {
    if (!deletingVehicle) return

    setIsDeleting(true)
    setDeleteError(null)
    try {
      await vehiclesService.deleteVehicle(deletingVehicle.id)
      setDeletingVehicle(null)
      await loadVehicles()
      setToastMessage('Vehicle deleted successfully.')
    } catch {
      setDeleteError('Unable to delete vehicle. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  function openAvailabilityDetails(
    vehicle: Vehicle,
    record: VehicleAvailability | null,
    planningEvent?: PlanningEvent | null,
    date?: string,
  ) {
    setDetailsContext({ vehicle, record, planningEvent, date })
  }

  function openAvailabilityFromNextEvent(
    vehicle: Vehicle,
    event: PlanningEvent,
  ) {
    openAvailabilityDetails(vehicle, event.availabilityRecord, event)
  }

  function openAvailabilityFromPlanningEvent(
    vehicle: Vehicle,
    event: PlanningEvent,
  ) {
    openAvailabilityDetails(vehicle, event.availabilityRecord, event)
  }

  function openAvailabilityFromCalendar(
    vehicle: Vehicle,
    record: VehicleAvailability | null,
    date: string,
  ) {
    openAvailabilityDetails(vehicle, record, null, date)
  }

  async function handleSaveAvailabilityEdit(input: VehicleAvailabilityInput) {
    if (!editingRecord) return

    setIsSavingAvailability(true)
    setAvailabilityEditError(null)

    try {
      await vehiclesService.updateAvailabilityRecord(editingRecord.id, input)
      setEditingRecord(null)
      setDetailsContext(null)
      await loadVehicles()
      setToastMessage('Availability event updated successfully.')
    } catch (error) {
      setAvailabilityEditError(
        error instanceof Error
          ? error.message
          : 'Unable to update availability event. Please try again.',
      )
    } finally {
      setIsSavingAvailability(false)
    }
  }

  async function handleConfirmDeleteAvailability() {
    if (!deletingRecord || !detailsContext) return

    setIsDeletingAvailability(true)
    setAvailabilityDeleteError(null)

    try {
      await vehiclesService.deleteAvailabilityRecord(deletingRecord.id)
      setDeletingRecord(null)
      setDetailsContext(null)
      await loadVehicles()
      setToastMessage('Availability event deleted successfully.')
    } catch {
      setAvailabilityDeleteError(
        'Unable to delete availability event. Please try again.',
      )
    } finally {
      setIsDeletingAvailability(false)
    }
  }

  return (
    <AdminLayout premiumBackground>
      <section className="min-w-0 space-y-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#218EE7]">
            Fleet
          </p>
          <h1 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.04em] text-[#2A376F] sm:text-[2rem]">
            Vehicles
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-[#5499BF]">
            Manage your fleet, documents, maintenance and inspections.
          </p>
        </div>

        <VehiclesSummaryCards
          stats={summaryStats}
          isLoading={isLoading}
          activeKey={getActiveVehicleQuickFilter(
            statusFilter,
            motFilter,
            insuranceFilter,
          )}
          onSelect={handleQuickFilterSelect}
        />

        {!isLoading && !loadError && vehicles.length > 0 ? (
          <>
            <VehiclesFilterBar
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusFilterChange={handleStatusFilterChange}
              driverFilter={driverFilter}
              onDriverFilterChange={setDriverFilter}
              motFilter={motFilter}
              onMotFilterChange={setMotFilter}
              insuranceFilter={insuranceFilter}
              onInsuranceFilterChange={setInsuranceFilter}
              drivers={drivers}
              onClearFilters={clearAllFilters}
              onExportCsv={() => exportVehiclesToCsv(filteredVehicles, drivers)}
              onAddVehicle={openAddVehicleModal}
              hasActiveFilters={hasActiveFilters}
            />

            {filteredVehicles.length > 0 ? (
              <VehiclesDataTable
                vehicles={filteredVehicles}
                drivers={drivers}
                page={tablePage}
                onPageChange={setTablePage}
                onEditVehicle={openEditVehicleModal}
                onDeleteVehicle={(vehicle) => {
                  setDeleteError(null)
                  setDeletingVehicle(vehicle)
                }}
                onOpenAvailabilityEvent={openAvailabilityFromNextEvent}
              />
            ) : (
              <div className={`${adminEmptyState} py-12`}>
                <p className={`text-lg font-semibold ${adminHeading}`}>
                  No vehicles match your filters
                </p>
                <p className={`mt-2 text-sm ${adminTextMuted}`}>
                  Try adjusting your search or filter criteria.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearAllFilters}
                  className="mt-4 rounded-[10px]"
                >
                  Clear Filters
                </Button>
              </div>
            )}

            <FleetAvailabilityOverview
              vehicles={filteredVehicles}
              onOpenEvent={openAvailabilityFromPlanningEvent}
              onOpenFullCalendar={openFullCalendar}
            />

            {showFullCalendar ? (
              <div ref={calendarSectionRef} id="fleet-planning-calendar">
                <FleetPlanningCalendar
                  vehicles={filteredVehicles}
                  initialView={calendarInitialView}
                  onOpenPlanningEvent={openAvailabilityFromPlanningEvent}
                  onOpenDayStatus={openAvailabilityFromCalendar}
                />
              </div>
            ) : null}
          </>
        ) : null}

        {isLoading ? <VehiclesTableSkeleton /> : null}

        {!isLoading && loadError ? (
          <div className={`${adminEmptyState} py-12`}>
            <p className={`text-lg font-semibold ${adminHeading}`}>
              Unable to load vehicles
            </p>
            <p className={`mt-2 text-sm ${adminTextMuted}`}>{loadError}</p>
            <Button
              type="button"
              onClick={loadVehicles}
              className="mt-4 rounded-[12px] bg-[#2563EB] text-white"
            >
              Retry
            </Button>
          </div>
        ) : null}

        {!isLoading && !loadError && vehicles.length === 0 ? (
          <div className={`${adminEmptyState} py-14`}>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB] dark:bg-slate-800/70 dark:text-blue-300">
              <Truck className="size-6" />
            </div>
            <p className={`mt-4 text-lg font-semibold ${adminHeading}`}>
              No vehicles yet
            </p>
            <p className={`mt-2 text-sm ${adminTextMuted}`}>
              Add your first vehicle to start managing your fleet.
            </p>
            <Button
              type="button"
              onClick={openAddVehicleModal}
              className="mt-5 rounded-[12px] bg-[#2563EB] text-white"
            >
              <Plus className="size-4" />
              Add Vehicle
            </Button>
          </div>
        ) : null}
      </section>

      {isModalOpen ? (
        <VehicleEditModal
          eyebrow={editingVehicle ? 'Edit Vehicle' : 'New Vehicle'}
          title={editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
          submitLabel={editingVehicle ? 'Save Changes' : 'Create Vehicle'}
          form={form}
          drivers={drivers}
          errors={formErrors}
          submitError={saveError}
          isSubmitting={isSaving}
          onChange={handleFormChange}
          onClose={() => {
            if (isSaving) return
            setIsModalOpen(false)
            setEditingVehicle(null)
          }}
          onSubmit={handleSaveVehicle}
        />
      ) : null}

      {deletingVehicle ? (
        <DeleteVehicleModal
          vehicle={deletingVehicle}
          errorMessage={deleteError}
          isDeleting={isDeleting}
          onCancel={() => {
            if (isDeleting) return
            setDeletingVehicle(null)
          }}
          onConfirm={handleConfirmDeleteVehicle}
        />
      ) : null}

      {detailsContext ? (
        <AvailabilityDetailsModal
          context={detailsContext}
          onClose={() => setDetailsContext(null)}
          onEdit={(record) => {
            setEditingRecord(record)
            setAvailabilityEditError(null)
          }}
          onDelete={(record) => {
            setDeletingRecord(record)
            setAvailabilityDeleteError(null)
          }}
        />
      ) : null}

      {editingRecord && detailsContext ? (
        <EditAvailabilityModal
          vehicle={detailsContext.vehicle}
          record={editingRecord}
          submitError={availabilityEditError}
          isSubmitting={isSavingAvailability}
          onClose={() => {
            if (isSavingAvailability) return
            setEditingRecord(null)
          }}
          onSave={handleSaveAvailabilityEdit}
        />
      ) : null}

      {deletingRecord && detailsContext ? (
        <DeleteAvailabilityModal
          record={deletingRecord}
          vehicleRegistration={detailsContext.vehicle.registration}
          errorMessage={availabilityDeleteError}
          isDeleting={isDeletingAvailability}
          onCancel={() => {
            if (isDeletingAvailability) return
            setDeletingRecord(null)
          }}
          onConfirm={handleConfirmDeleteAvailability}
        />
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-[14px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </AdminLayout>
  )
}

export default VehiclesPage

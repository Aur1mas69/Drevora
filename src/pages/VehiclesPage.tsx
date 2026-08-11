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
import { ArchiveVehicleModal } from '@/components/vehicles/ArchiveVehicleModal'
import { RestoreVehicleModal } from '@/components/vehicles/RestoreVehicleModal'
import { VehicleEditModal } from '@/components/vehicles/VehicleEditModal'
import {
  VehiclesCardGrid,
  VehiclesCardGridSkeleton,
} from '@/components/vehicles/VehiclesCardGrid'
import {
  VehiclesDataTable,
  VehiclesTableSkeleton,
} from '@/components/vehicles/VehiclesDataTable'
import {
  VehiclesFilterBar,
  type StatusFilter,
  type VehiclesFleetMode,
  type VehiclesLifecycleFilter,
} from '@/components/vehicles/VehiclesFilterBar'
import type { VehicleArchiveReason } from '@/lib/vehicleArchive'
import { VehiclesAllowanceNotice } from '@/components/vehicles/VehiclesAllowanceNotice'
import { VehiclesSummaryCards } from '@/components/vehicles/VehiclesSummaryCards'
import type { VehicleKpiKey } from '@/components/vehicles/vehicleSummaryKpiStyles'
import {
  buildVehicleAllowanceSnapshot,
  formatVehiclePlanLimitError,
  isVehiclePlanLimitError,
} from '@/lib/vehicleAllowance'
import {
  buildVehicleSlotPage,
  isActiveVehicleForPlanSlot,
} from '@/lib/vehiclePlanSlots'
import {
  computeFleetSummaryStats,
  exportVehiclesToCsv,
  matchesDocumentFilter,
  vehicleMatchesSearch,
  type DocumentFilter,
} from '@/lib/vehiclePageUtils'
import {
  readVehiclesViewMode,
  writeVehiclesViewMode,
  type VehiclesViewMode,
} from '@/lib/vehiclesViewMode'
import {
  fetchCompanyPlan,
  type CompanyPlanRecord,
} from '@/services/companyPlanService'
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
  isTrailerFleetAsset,
  isTrailerVehicleType,
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
  const [fleetMode, setFleetMode] = useState<VehiclesFleetMode>('vehicles')
  const [lifecycleFilter, setLifecycleFilter] =
    useState<VehiclesLifecycleFilter>('active')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [driverFilter, setDriverFilter] = useState('All')
  const [motFilter, setMotFilter] = useState<DocumentFilter>('All')
  const [insuranceFilter, setInsuranceFilter] = useState<DocumentFilter>('All')
  const [viewMode, setViewMode] = useState<VehiclesViewMode>(() =>
    readVehiclesViewMode(),
  )
  const [tablePage, setTablePage] = useState(1)
  const [gridPage, setGridPage] = useState(1)
  const [companyPlan, setCompanyPlan] = useState<CompanyPlanRecord | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [archivingVehicle, setArchivingVehicle] = useState<Vehicle | null>(null)
  const [restoringVehicle, setRestoringVehicle] = useState<Vehicle | null>(null)
  const [form, setForm] = useState<VehicleInput>(initialVehicleForm)
  const [formErrors, setFormErrors] = useState<VehicleFormErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
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
        // Admin list needs both Active and Archived; plan seats use active-only count.
        vehiclesService.fetchVehicles({ lifecycle: 'all' }),
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
    if (!companyReady || !companyId) {
      setCompanyPlan(null)
      return
    }

    let cancelled = false
    void fetchCompanyPlan(companyId)
      .then((record) => {
        if (!cancelled) setCompanyPlan(record)
      })
      .catch(() => {
        if (!cancelled) setCompanyPlan(null)
      })

    return () => {
      cancelled = true
    }
  }, [companyReady, companyId])

  useEffect(() => {
    if (!toastMessage) return
    const timeoutId = window.setTimeout(() => setToastMessage(null), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [toastMessage])

  useEffect(() => {
    setTablePage(1)
    setGridPage(1)
  }, [
    searchTerm,
    fleetMode,
    lifecycleFilter,
    statusFilter,
    driverFilter,
    motFilter,
    insuranceFilter,
  ])

  const isTrailersMode = fleetMode === 'trailers'

  const fleetVehicles = useMemo(
    () =>
      vehicles.filter((vehicle) =>
        isTrailersMode ? isTrailerFleetAsset(vehicle) : !isTrailerFleetAsset(vehicle),
      ),
    [isTrailersMode, vehicles],
  )

  const activeVehicles = useMemo(
    () => fleetVehicles.filter((vehicle) => vehicle.archivedAt == null),
    [fleetVehicles],
  )

  const archivedVehicles = useMemo(
    () => fleetVehicles.filter((vehicle) => vehicle.archivedAt != null),
    [fleetVehicles],
  )

  const visibleVehicles = useMemo(
    () => (lifecycleFilter === 'archived' ? archivedVehicles : activeVehicles),
    [activeVehicles, archivedVehicles, lifecycleFilter],
  )

  const vehicleAllowance = useMemo(
    () =>
      buildVehicleAllowanceSnapshot({
        vehicles,
        plan: companyPlan,
      }),
    [companyPlan, vehicles],
  )

  // Trailers never consume/require a vehicle plan slot — only an expired trial
  // blocks adding a Trailer (see vehicleAllowance.canAddTrailer).
  const canAddForCurrentMode = isTrailersMode
    ? vehicleAllowance.canAddTrailer
    : vehicleAllowance.canAddVehicle

  const summaryStats = useMemo(
    () => computeFleetSummaryStats(activeVehicles),
    [activeVehicles],
  )

  const filteredVehicles = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return visibleVehicles.filter((vehicle) => {
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
        isTrailersMode ||
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
    isTrailersMode,
    motFilter,
    searchTerm,
    statusFilter,
    visibleVehicles,
  ])

  const hasListConstraints =
    searchTerm.trim().length > 0 ||
    statusFilter !== 'All' ||
    driverFilter !== 'All' ||
    motFilter !== 'All' ||
    insuranceFilter !== 'All'

  const allActiveVehiclesForPlan = useMemo(
    () => vehicles.filter(isActiveVehicleForPlanSlot),
    [vehicles],
  )

  const activeVehiclesForSlots = useMemo(
    () =>
      allActiveVehiclesForPlan.filter((vehicle) =>
        isTrailersMode ? isTrailerFleetAsset(vehicle) : !isTrailerFleetAsset(vehicle),
      ),
    [allActiveVehiclesForPlan, isTrailersMode],
  )

  const slotVehicles = useMemo(() => {
    if (hasListConstraints) {
      return filteredVehicles.filter(isActiveVehicleForPlanSlot)
    }
    return activeVehiclesForSlots
  }, [activeVehiclesForSlots, filteredVehicles, hasListConstraints])

  const slotPage = useMemo(
    () =>
      buildVehicleSlotPage({
        vehicles: slotVehicles,
        allowance: vehicleAllowance.allowance,
        page: gridPage,
        constrainToVehiclesOnly: hasListConstraints || isTrailersMode,
        occupiedSlotCount: vehicleAllowance.activeCount,
      }),
    [
      gridPage,
      hasListConstraints,
      isTrailersMode,
      slotVehicles,
      vehicleAllowance.activeCount,
      vehicleAllowance.allowance,
    ],
    )

  useEffect(() => {
    if (gridPage !== slotPage.page) {
      setGridPage(slotPage.page)
    }
  }, [gridPage, slotPage.page])

  const calendarInitialView = useMemo((): CalendarView | undefined => {
    return showFullCalendar ? 'Week' : undefined
  }, [showFullCalendar])

  const hasActiveFilters = hasListConstraints

  function handleFleetModeChange(mode: VehiclesFleetMode) {
    if (mode === fleetMode) return
    setFleetMode(mode)
    if (mode === 'trailers') {
      setDriverFilter('All')
    }
    setTablePage(1)
    setGridPage(1)
  }

  function handleViewModeChange(mode: VehiclesViewMode) {
    if (mode === viewMode) return
    setViewMode(mode)
    writeVehiclesViewMode(mode)
    setTablePage(1)
    setGridPage(1)
  }

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
    if (!canAddForCurrentMode) {
      setToastMessage(vehicleAllowance.title || 'Vehicle allowance reached')
      return
    }

    setForm(
      isTrailersMode
        ? { ...initialVehicleForm, vehicleType: 'Trailer', trailerType: 'Other' }
        : initialVehicleForm,
    )
    setFormErrors({})
    setSaveError(null)
    setEditingVehicle(null)
    setIsModalOpen(true)
  }

  function openArchiveVehicleModal(vehicle: Vehicle) {
    if (vehicle.archivedAt != null) return
    setArchiveError(null)
    setArchivingVehicle(vehicle)
  }

  function openRestoreVehicleModal(vehicle: Vehicle) {
    if (vehicle.archivedAt == null) return
    setRestoreError(null)
    setRestoringVehicle(vehicle)
  }

  function openEditVehicleModal(vehicle: Vehicle) {
    if (vehicle.archivedAt != null) return
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
      ...(name === 'vehicleType' && value !== 'Trailer'
        ? { trailerNumber: '', trailerType: '' }
        : {}),
    }))
    setFormErrors((currentErrors) => ({ ...currentErrors, [name]: undefined }))
  }

  function handleFormPatch(patch: Partial<VehicleInput>) {
    setForm((currentForm) => ({ ...currentForm, ...patch }))
    setFormErrors((currentErrors) => {
      const next = { ...currentErrors }
      for (const key of Object.keys(patch) as Array<keyof VehicleInput>) {
        next[key] = undefined
      }
      return next
    })
  }

  async function handleSaveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateVehicleForm(form)
    setFormErrors(validationErrors)
    setSaveError(null)

    if (Object.keys(validationErrors).length > 0) return

    const isSavingTrailer = isTrailerVehicleType(form.vehicleType)
    const canSave = isSavingTrailer
      ? vehicleAllowance.canAddTrailer
      : vehicleAllowance.canAddVehicle
    if (!editingVehicle && !canSave) {
      setSaveError(
        vehicleAllowance.detail ??
          'Vehicle allowance reached. Archive an inactive Vehicle or change the company plan to add another Vehicle.',
      )
      return
    }

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
      const savedAsTrailer = isTrailerFleetAsset(savedVehicle)
      setToastMessage(
        editingVehicle
          ? savedAsTrailer
            ? 'Trailer updated successfully.'
            : 'Vehicle updated successfully.'
          : savedAsTrailer
            ? 'Trailer created successfully.'
            : 'Vehicle created successfully.',
      )
    } catch (error) {
      if (isVehiclePlanLimitError(error)) {
        setSaveError(formatVehiclePlanLimitError(error))
      } else {
        setSaveError(
          error instanceof Error
            ? error.message
            : 'Unable to save vehicle. Please check the details and try again.',
        )
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmArchiveVehicle(input: {
    reason: VehicleArchiveReason
    archiveDate: string
  }) {
    if (!archivingVehicle) return

    setIsArchiving(true)
    setArchiveError(null)
    try {
      await vehiclesService.archiveVehicle(archivingVehicle.id, input)
      setArchivingVehicle(null)
      await loadVehicles()
      setToastMessage(
        isTrailerFleetAsset(archivingVehicle)
          ? 'Trailer archived successfully.'
          : 'Vehicle archived successfully.',
      )
    } catch (error) {
      setArchiveError(
        error instanceof Error
          ? error.message
          : 'Unable to archive vehicle. Please try again.',
      )
    } finally {
      setIsArchiving(false)
    }
  }

  async function handleConfirmRestoreVehicle() {
    if (!restoringVehicle) return

    setIsRestoring(true)
    setRestoreError(null)
    try {
      await vehiclesService.restoreVehicle(restoringVehicle.id)
      setRestoringVehicle(null)
      setLifecycleFilter('active')
      await loadVehicles()
      setToastMessage(
        isTrailerFleetAsset(restoringVehicle)
          ? 'Trailer restored successfully.'
          : 'Vehicle restored successfully.',
      )
    } catch (error) {
      if (isVehiclePlanLimitError(error)) {
        setRestoreError(formatVehiclePlanLimitError(error))
      } else {
        setRestoreError(
          error instanceof Error
            ? error.message
            : 'Unable to restore vehicle. Please try again.',
        )
      }
    } finally {
      setIsRestoring(false)
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
          fleetMode={fleetMode}
        />

        {!isLoading && !loadError ? (
          <div className="space-y-3">
            <VehiclesFilterBar
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              lifecycleFilter={lifecycleFilter}
              onLifecycleFilterChange={setLifecycleFilter}
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
              onExportCsv={() =>
                exportVehiclesToCsv(filteredVehicles, drivers, {
                  includeTrailerNumber: isTrailersMode,
                  omitAssignedDriver: isTrailersMode,
                })
              }
              onAddVehicle={openAddVehicleModal}
              canAddVehicle={canAddForCurrentMode}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              hasActiveFilters={hasActiveFilters}
              fleetMode={fleetMode}
              onFleetModeChange={handleFleetModeChange}
            />
            {lifecycleFilter === 'active' && !isTrailersMode ? (
              <VehiclesAllowanceNotice allowance={vehicleAllowance} />
            ) : null}
          </div>
        ) : null}

        {isLoading ? (
          viewMode === 'grid' && lifecycleFilter === 'active' ? (
            <VehiclesCardGridSkeleton />
          ) : (
            <VehiclesTableSkeleton />
          )
        ) : null}

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

        {!isLoading && !loadError && visibleVehicles.length === 0 ? (
          lifecycleFilter === 'archived' ? (
            <div className={`${adminEmptyState} py-14`}>
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB] dark:bg-slate-800/70 dark:text-blue-300">
                <Truck className="size-6" />
              </div>
              <p className={`mt-4 text-lg font-semibold ${adminHeading}`}>
                {isTrailersMode ? 'No archived trailers' : 'No archived vehicles'}
              </p>
              <p className={`mt-2 text-sm ${adminTextMuted}`}>
                {isTrailersMode
                  ? 'Archived trailers appear here. Active trailers stay on the Active tab.'
                  : 'Archived vehicles appear here. Active vehicles stay on the Active tab and count toward your plan.'}
              </p>
            </div>
          ) : viewMode === 'grid' &&
            !isTrailersMode &&
            vehicleAllowance.allowance != null &&
            canAddForCurrentMode ? (
            <VehiclesCardGrid
              items={slotPage.items}
              drivers={drivers}
              page={slotPage.page}
              totalPages={slotPage.totalPages}
              slotFrom={slotPage.slotFrom}
              slotTo={slotPage.slotTo}
              totalSlots={slotPage.totalSlots}
              showingVehiclesOnly={slotPage.showingVehiclesOnly}
              onPageChange={setGridPage}
              onAddVehicle={openAddVehicleModal}
              onEditVehicle={openEditVehicleModal}
              onArchiveVehicle={openArchiveVehicleModal}
              onRestoreVehicle={openRestoreVehicleModal}
            />
          ) : (
            <div className={`${adminEmptyState} py-14`}>
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB] dark:bg-slate-800/70 dark:text-blue-300">
                <Truck className="size-6" />
              </div>
              <p className={`mt-4 text-lg font-semibold ${adminHeading}`}>
                {isTrailersMode ? 'No trailers yet' : 'No vehicles yet'}
              </p>
              <p className={`mt-2 text-sm ${adminTextMuted}`}>
                {canAddForCurrentMode
                  ? isTrailersMode
                    ? 'Add your first trailer to start managing your trailer fleet.'
                    : 'Add your first vehicle to start managing your fleet.'
                  : isTrailersMode
                    ? 'Trailer creation is blocked until a valid plan allowance is available.'
                    : 'Vehicle creation is blocked until a valid plan allowance is available.'}
              </p>
              <Button
                type="button"
                onClick={openAddVehicleModal}
                disabled={!canAddForCurrentMode}
                className="mt-5 rounded-[12px] bg-[#2563EB] text-white"
              >
                <Plus className="size-4" />
                {isTrailersMode ? 'Add Trailer' : 'Add Vehicle'}
              </Button>
            </div>
          )
        ) : null}

        {!isLoading && !loadError && visibleVehicles.length > 0 ? (
          <>
            {hasListConstraints && filteredVehicles.length === 0 ? (
              <div className={`${adminEmptyState} py-12`}>
                <p className={`text-lg font-semibold ${adminHeading}`}>
                  {isTrailersMode
                    ? 'No trailers match your search or filters.'
                    : 'No Vehicles match your search or filters.'}
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
            ) : viewMode === 'grid' && lifecycleFilter === 'active' ? (
              <VehiclesCardGrid
                items={slotPage.items}
                drivers={drivers}
                page={slotPage.page}
                totalPages={slotPage.totalPages}
                slotFrom={slotPage.slotFrom}
                slotTo={slotPage.slotTo}
                totalSlots={slotPage.totalSlots}
                showingVehiclesOnly={slotPage.showingVehiclesOnly}
                onPageChange={setGridPage}
                onAddVehicle={openAddVehicleModal}
                onEditVehicle={openEditVehicleModal}
                onArchiveVehicle={openArchiveVehicleModal}
                onRestoreVehicle={openRestoreVehicleModal}
              />
            ) : (
              <VehiclesDataTable
                vehicles={filteredVehicles}
                drivers={drivers}
                page={tablePage}
                onPageChange={setTablePage}
                onEditVehicle={openEditVehicleModal}
                onArchiveVehicle={openArchiveVehicleModal}
                onRestoreVehicle={openRestoreVehicleModal}
                onOpenAvailabilityEvent={openAvailabilityFromNextEvent}
                fleetMode={fleetMode}
              />
            )}

            {lifecycleFilter === 'active' ? (
              <>
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
          </>
        ) : null}
      </section>

      {isModalOpen ? (
        <VehicleEditModal
          eyebrow={
            isTrailerVehicleType(form.vehicleType)
              ? editingVehicle
                ? 'Edit Trailer'
                : 'New Trailer'
              : editingVehicle
                ? 'Edit Vehicle'
                : 'New Vehicle'
          }
          title={
            isTrailerVehicleType(form.vehicleType)
              ? editingVehicle
                ? 'Edit Trailer'
                : 'Add Trailer'
              : editingVehicle
                ? 'Edit Vehicle'
                : 'Add Vehicle'
          }
          submitLabel={
            isTrailerVehicleType(form.vehicleType)
              ? editingVehicle
                ? 'Save Changes'
                : 'Create Trailer'
              : editingVehicle
                ? 'Save Changes'
                : 'Create Vehicle'
          }
          form={form}
          drivers={drivers}
          errors={formErrors}
          submitError={saveError}
          isSubmitting={isSaving}
          lockVehicleType={
            isTrailersMode ||
            (editingVehicle != null && isTrailerFleetAsset(editingVehicle))
          }
          onChange={handleFormChange}
          onPatchForm={handleFormPatch}
          onClose={() => {
            if (isSaving) return
            setIsModalOpen(false)
            setEditingVehicle(null)
          }}
          onSubmit={handleSaveVehicle}
        />
      ) : null}

      {archivingVehicle ? (
        <ArchiveVehicleModal
          key={archivingVehicle.id}
          vehicle={archivingVehicle}
          errorMessage={archiveError}
          isArchiving={isArchiving}
          onCancel={() => {
            if (isArchiving) return
            setArchivingVehicle(null)
          }}
          onConfirm={handleConfirmArchiveVehicle}
        />
      ) : null}

      {restoringVehicle ? (
        <RestoreVehicleModal
          vehicle={restoringVehicle}
          errorMessage={restoreError}
          isRestoring={isRestoring}
          onCancel={() => {
            if (isRestoring) return
            setRestoringVehicle(null)
          }}
          onConfirm={handleConfirmRestoreVehicle}
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

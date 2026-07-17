import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Trash2,
} from 'lucide-react'
import AdminLayout from '@/layouts/AdminLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  AvailabilityDetailsModal,
  DeleteAvailabilityModal,
  EditAvailabilityModal,
  type AvailabilityDetailsContext,
} from '@/components/vehicles/AvailabilityEventModals'
import { DeleteVehicleModal } from '@/components/vehicles/DeleteVehicleModal'
import { VehicleConsumablesTab } from '@/components/vehicles/VehicleConsumablesTab'
import { VehicleEditModal } from '@/components/vehicles/VehicleEditModal'
import { VehicleProfileAvailabilityTab } from '@/components/vehicles/profile/VehicleProfileAvailabilityTab'
import { VehicleProfileChecksTab } from '@/components/vehicles/profile/VehicleProfileChecksTab'
import { VehicleProfileDocumentsTab } from '@/components/vehicles/profile/VehicleProfileDocumentsTab'
import { VehicleProfileDriverReportsTab } from '@/components/vehicles/profile/VehicleProfileDriverReportsTab'
import { VehicleProfileHeader } from '@/components/vehicles/profile/VehicleProfileHeader'
import { VehicleProfileOverviewTab } from '@/components/vehicles/profile/VehicleProfileOverviewTab'
import { VehicleProfileTabBar } from '@/components/vehicles/profile/VehicleProfileTabBar'
import {
  vehicleProfilePanelClass,
  vehicleProfileTabFromSearchParam,
  type VehicleProfileTabId,
} from '@/components/vehicles/profile/vehicleProfileUi'
import {
  getVehicleFormValues,
  initialVehicleForm,
  scheduledAvailabilityStatuses,
  validateVehicleForm,
  type VehicleFormErrors,
} from '@/lib/vehicleForm'
import { notifyVehiclesUpdated } from '@/lib/vehicleEvents'
import { driversService, type Driver } from '@/services/driversService'
import {
  vehiclesService,
  type VehicleAvailability,
  type VehicleAvailabilityInput,
  type Vehicle,
  type VehicleInput,
  type VehicleStatus,
} from '@/services/vehiclesService'
import {
  fetchConsumablesForVehicle,
  ConsumablesServiceError,
} from '@/services/consumablesService'
import type { Consumable } from '@/lib/consumableTypes'

const maintenanceReasons = ['Service', 'Repair', 'MOT', 'Inspection', 'Tyres', 'Other']

type AvailabilityForm = Omit<VehicleAvailabilityInput, 'vehicleId'>
type AvailabilityFormErrors = Partial<Record<keyof AvailabilityForm, string>>

const initialAvailabilityForm: AvailabilityForm = {
  status: 'Available',
  startDate: '',
  endDate: '',
  reason: '',
  notes: '',
}

const vehicleStatuses: VehicleStatus[] = [
  'Available',
  'Assigned',
  'Workshop',
  'Maintenance',
  'Out of Service',
  'Off Road',
  'Reserved',
]

const offRoadReasons = [
  'Accident',
  'Mechanical Failure',
  'Awaiting Parts',
  'Insurance Expired',
  'MOT Expired',
  'SORN',
  'Other',
]

function getReasonOptions(status: VehicleStatus): string[] {
  if (status === 'Off Road') return offRoadReasons
  if (status === 'Maintenance' || status === 'Workshop') return maintenanceReasons
  return []
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null

  return <p className="mt-1.5 text-xs font-medium text-rose-500">{message}</p>
}

function AvailabilityModal({
  form,
  errors,
  submitError,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
}: {
  form: AvailabilityForm
  errors: AvailabilityFormErrors
  submitError: string | null
  isSubmitting: boolean
  onChange: (event: ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const reasonOptions = getReasonOptions(form.status)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-[20px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100">
        <form onSubmit={onSubmit} className="p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#3B82F6]">
            Vehicle Availability
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            Add Availability
          </h2>

          {submitError ? (
            <div className="mt-5 rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
              {submitError}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Status</span>
              <select
                name="status"
                value={form.status}
                onChange={onChange}
                className="mt-2 h-11 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
              >
                {vehicleStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <FieldError message={errors.status} />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Reason</span>
              {reasonOptions.length > 0 ? (
                <select
                  name="reason"
                  value={form.reason}
                  onChange={onChange}
                  className="mt-2 h-11 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
                >
                  <option value="">Select reason</option>
                  {reasonOptions.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  name="reason"
                  value={form.reason}
                  onChange={onChange}
                  className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
                />
              )}
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Start Date</span>
              <Input
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={onChange}
                className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
              />
              <FieldError message={errors.startDate} />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">End Date</span>
              <Input
                name="endDate"
                type="date"
                value={form.endDate}
                onChange={onChange}
                className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700">Notes</span>
              <textarea
                name="notes"
                value={form.notes}
                onChange={onChange}
                rows={4}
                className="mt-2 w-full resize-none rounded-[16px] border-0 bg-[#F8FBFF] px-3 py-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-11 rounded-[16px] border-0 bg-white px-5 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:bg-[#EAF4FF] hover:text-[#2563EB]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 rounded-[16px] bg-[#3B82F6] px-5 font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#2563EB] disabled:translate-y-0 disabled:opacity-70"
            >
              {isSubmitting ? 'Saving...' : 'Add Availability'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function VehicleDetailsSkeleton() {
  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <div className={`${vehicleProfilePanelClass} animate-pulse p-6`}>
        <div className="h-9 w-36 rounded-[12px] bg-[#E8F3FE]" />
        <div className="mt-6 flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-[#E8F3FE]" />
          <div className="space-y-2">
            <div className="h-8 w-48 rounded-full bg-[#E8F3FE]" />
            <div className="h-4 w-32 rounded-full bg-[#E8F3FE]" />
          </div>
        </div>
      </div>
      <div className={`${vehicleProfilePanelClass} grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4`}>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-[#E8F3FE]/70" />
        ))}
      </div>
    </section>
  )
}

function VehicleDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [activeTab, setActiveTab] = useState<VehicleProfileTabId>('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false)
  const [availabilityForm, setAvailabilityForm] = useState<AvailabilityForm>(
    initialAvailabilityForm,
  )
  const [availabilityErrors, setAvailabilityErrors] =
    useState<AvailabilityFormErrors>({})
  const [availabilitySaveError, setAvailabilitySaveError] = useState<string | null>(
    null,
  )
  const [isSavingAvailability, setIsSavingAvailability] = useState(false)
  const [timelineRecords, setTimelineRecords] = useState<VehicleAvailability[]>([])
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false)
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
  const [isDeletingAvailability, setIsDeletingAvailability] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [vehicleForm, setVehicleForm] = useState<VehicleInput>(initialVehicleForm)
  const [vehicleFormErrors, setVehicleFormErrors] = useState<VehicleFormErrors>({})
  const [vehicleSaveError, setVehicleSaveError] = useState<string | null>(null)
  const [isSavingVehicle, setIsSavingVehicle] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [vehicleConsumables, setVehicleConsumables] = useState<Consumable[]>([])
  const [isLoadingConsumables, setIsLoadingConsumables] = useState(false)
  const [consumablesLoadError, setConsumablesLoadError] = useState<string | null>(null)

  const loadVehicle = useCallback(async () => {
    if (!id) {
      setVehicle(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const [vehicleResult, driverResult] = await Promise.all([
        vehiclesService.fetchVehicleById(id),
        driversService.fetchDrivers(),
      ])
      setVehicle(vehicleResult)
      setDrivers(driverResult)
    } catch {
      setLoadError('Unable to load vehicle details. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadVehicle()
  }, [loadVehicle])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && vehicleProfileTabFromSearchParam[tabParam]) {
      setActiveTab(vehicleProfileTabFromSearchParam[tabParam])
    }
  }, [searchParams])

  useEffect(() => {
    if (!toastMessage) return
    const timeoutId = window.setTimeout(() => setToastMessage(null), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [toastMessage])

  useEffect(() => {
    if (activeTab !== 'availability' || !vehicle) return

    const vehicleId = vehicle.id
    let isCancelled = false

    async function loadTimeline() {
      setIsLoadingTimeline(true)
      try {
        const records = await vehiclesService.fetchVehicleTimelineRecords(vehicleId)
        if (!isCancelled) {
          setTimelineRecords(records)
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingTimeline(false)
        }
      }
    }

    void loadTimeline()

    return () => {
      isCancelled = true
    }
  }, [activeTab, vehicle])

  useEffect(() => {
    if (activeTab !== 'consumables' || !vehicle) return

    const vehicleId = vehicle.id
    let isCancelled = false

    async function loadConsumables() {
      setIsLoadingConsumables(true)
      setConsumablesLoadError(null)

      try {
        const records = await fetchConsumablesForVehicle(vehicleId)
        if (!isCancelled) {
          setVehicleConsumables(records)
        }
      } catch (error) {
        if (!isCancelled) {
          setConsumablesLoadError(
            error instanceof ConsumablesServiceError
              ? error.message
              : 'Unable to load consumables for this vehicle.',
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingConsumables(false)
        }
      }
    }

    void loadConsumables()

    return () => {
      isCancelled = true
    }
  }, [activeTab, vehicle])

  const timelineVehicle = useMemo(() => {
    if (!vehicle) return null
    return { ...vehicle, availabilityRecords: timelineRecords }
  }, [vehicle, timelineRecords])

  const currentDriverName = useMemo(() => {
    const driver = drivers.find((item) => item.id === vehicle?.currentDriverId)
    return driver ? `${driver.firstName} ${driver.lastName}`.trim() : 'Unassigned'
  }, [drivers, vehicle?.currentDriverId])

  function openEditVehicleModal() {
    if (!vehicle) return
    setVehicleForm(getVehicleFormValues(vehicle))
    setVehicleFormErrors({})
    setVehicleSaveError(null)
    setIsEditModalOpen(true)
  }

  function handleVehicleFormChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target
    setVehicleForm((currentForm) => ({
      ...currentForm,
      [name]: value,
      ...(name === 'status' ? { offRoadReason: '' } : {}),
      ...(name === 'vehicleType' && value !== 'Trailer' ? { trailerNumber: '' } : {}),
    }))
    setVehicleFormErrors((currentErrors) => ({ ...currentErrors, [name]: undefined }))
  }

  async function handleSaveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!vehicle) return

    const validationErrors = validateVehicleForm(vehicleForm)
    setVehicleFormErrors(validationErrors)
    setVehicleSaveError(null)

    if (Object.keys(validationErrors).length > 0) return

    setIsSavingVehicle(true)
    try {
      const shouldCreateAvailability =
        scheduledAvailabilityStatuses.includes(vehicleForm.status) &&
        vehicleForm.offRoadStartDate
      const saveForm: VehicleInput = shouldCreateAvailability
        ? {
            ...vehicleForm,
            status: vehicle.baseStatus,
            offRoadReason: '',
            offRoadStartDate: '',
            offRoadExpectedReturnDate: '',
            offRoadNotes: '',
          }
        : vehicleForm

      await vehiclesService.updateVehicle(vehicle.id, saveForm)

      if (shouldCreateAvailability) {
        await vehiclesService.createAvailabilityRecord({
          vehicleId: vehicle.id,
          status: vehicleForm.status,
          startDate: vehicleForm.offRoadStartDate,
          endDate: vehicleForm.offRoadExpectedReturnDate,
          reason: vehicleForm.offRoadReason,
          notes: vehicleForm.offRoadNotes,
        })
      }

      setIsEditModalOpen(false)
      await loadVehicle()
      if (activeTab === 'availability') {
        const records = await vehiclesService.fetchVehicleTimelineRecords(vehicle.id)
        setTimelineRecords(records)
      }
      notifyVehiclesUpdated()
      setToastMessage('Vehicle updated successfully.')
    } catch (error) {
      setVehicleSaveError(
        error instanceof Error
          ? error.message
          : 'Unable to save vehicle. Please check the details and try again.',
      )
    } finally {
      setIsSavingVehicle(false)
    }
  }

  function openAvailabilityModal() {
    setAvailabilityForm(initialAvailabilityForm)
    setAvailabilityErrors({})
    setAvailabilitySaveError(null)
    setIsAvailabilityModalOpen(true)
  }

  function handleAvailabilityFormChange(
    event: ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target
    setAvailabilityForm((currentForm) => ({
      ...currentForm,
      [name]: value,
      ...(name === 'status' ? { reason: '' } : {}),
    }))
    setAvailabilityErrors((currentErrors) => ({
      ...currentErrors,
      [name]: undefined,
    }))
  }

  async function handleSaveAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!vehicle) return

    const errors: AvailabilityFormErrors = {}
    if (!availabilityForm.startDate) {
      errors.startDate = 'Start date is required.'
    }
    if (
      availabilityForm.endDate &&
      availabilityForm.startDate &&
      availabilityForm.endDate < availabilityForm.startDate
    ) {
      errors.endDate = 'End date must be after start date.'
    }

    setAvailabilityErrors(errors)
    setAvailabilitySaveError(null)

    if (Object.keys(errors).length > 0) return

    setIsSavingAvailability(true)
    try {
      await vehiclesService.createAvailabilityRecord({
        vehicleId: vehicle.id,
        ...availabilityForm,
      })
      setIsAvailabilityModalOpen(false)
      setAvailabilityForm(initialAvailabilityForm)
      await loadVehicle()
      if (activeTab === 'availability') {
        const records = await vehiclesService.fetchVehicleTimelineRecords(vehicle.id)
        setTimelineRecords(records)
      }
    } catch (error) {
      setAvailabilitySaveError(
        error instanceof Error
          ? error.message
          : 'Unable to save availability. Please try again.',
      )
    } finally {
      setIsSavingAvailability(false)
    }
  }

  function openAvailabilityDetails(record: VehicleAvailability) {
    if (!vehicle) return
    setDetailsContext({ vehicle, record })
  }

  async function handleSaveAvailabilityEdit(input: VehicleAvailabilityInput) {
    if (!editingRecord) return

    setIsSavingAvailability(true)
    setAvailabilityEditError(null)

    try {
      await vehiclesService.updateAvailabilityRecord(editingRecord.id, input)
      setEditingRecord(null)
      setDetailsContext(null)
      await loadVehicle()
      if (vehicle) {
        const records = await vehiclesService.fetchVehicleTimelineRecords(vehicle.id)
        setTimelineRecords(records)
      }
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
    if (!deletingRecord || !vehicle) return

    setIsDeletingAvailability(true)
    setAvailabilityDeleteError(null)

    try {
      await vehiclesService.deleteAvailabilityRecord(deletingRecord.id)
      setDeletingRecord(null)
      setDetailsContext(null)
      await loadVehicle()
      const records = await vehiclesService.fetchVehicleTimelineRecords(vehicle.id)
      setTimelineRecords(records)
    } catch {
      setAvailabilityDeleteError(
        'Unable to delete availability event. Please try again.',
      )
    } finally {
      setIsDeletingAvailability(false)
    }
  }

  async function handleConfirmDeleteVehicle() {
    if (!vehicle) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await vehiclesService.deleteVehicle(vehicle.id)
      navigate('/vehicles')
    } catch {
      setDeleteError('Unable to delete vehicle. Please try again.')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <VehicleDetailsSkeleton />
      </AdminLayout>
    )
  }

  if (!vehicle && !loadError) {
    return (
      <AdminLayout>
        <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-xl font-semibold tracking-[-0.03em] text-slate-950">
              Vehicle not found
            </p>
            <Button
              asChild
              className="mt-6 h-11 rounded-[16px] bg-[#3B82F6] px-5 font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#2563EB]"
            >
              <Link to="/vehicles">
                <ArrowLeft className="size-4" />
                Back to Vehicles
              </Link>
            </Button>
          </CardContent>
        </Card>
      </AdminLayout>
    )
  }

  if (loadError || !vehicle) {
    return (
      <AdminLayout>
        <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
          <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
              Unable to load vehicle details.
            </p>
            <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
              {loadError}
            </p>
            <Button
              type="button"
              onClick={loadVehicle}
              className="mt-6 h-11 rounded-[16px] bg-[#3B82F6] px-5 font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#2563EB]"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout premiumBackground>
      <section className="mx-auto max-w-6xl space-y-5">
        <VehicleProfileHeader
          vehicle={vehicle}
          assignedWorkerLabel={currentDriverName}
          onEdit={openEditVehicleModal}
        />

        {deleteError ? (
          <div className={`${vehicleProfilePanelClass} px-4 py-3 text-sm font-medium text-rose-600`}>
            {deleteError}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            onClick={() => {
              setDeleteError(null)
              setIsDeleteModalOpen(true)
            }}
            disabled={isDeleting}
            variant="ghost"
            className="h-9 rounded-[12px] px-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="size-3.5" />
            Delete vehicle
          </Button>
        </div>

        <VehicleProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'overview' ? (
          <VehicleProfileOverviewTab
            vehicle={vehicle}
            assignedWorkerLabel={currentDriverName}
          />
        ) : null}
        {activeTab === 'vehicle-checks' ? (
          <VehicleProfileChecksTab vehicleId={vehicle.id} />
        ) : null}
        {activeTab === 'consumables' ? (
          <VehicleConsumablesTab
            vehicleId={vehicle.id}
            items={vehicleConsumables}
            isLoading={isLoadingConsumables}
            loadError={consumablesLoadError}
          />
        ) : null}
        {activeTab === 'documents' ? <VehicleProfileDocumentsTab vehicle={vehicle} /> : null}
        {activeTab === 'driver-reports' ? (
          <VehicleProfileDriverReportsTab vehicleId={vehicle.id} />
        ) : null}
        {activeTab === 'availability' ? (
          <VehicleProfileAvailabilityTab
            vehicle={vehicle}
            timelineVehicle={timelineVehicle}
            isLoadingTimeline={isLoadingTimeline}
            onAddAvailability={openAvailabilityModal}
            onSelectRecord={openAvailabilityDetails}
          />
        ) : null}
      </section>

      {isEditModalOpen ? (
        <VehicleEditModal
          eyebrow="Edit Vehicle"
          title="Edit Vehicle"
          submitLabel="Save Changes"
          form={vehicleForm}
          drivers={drivers}
          errors={vehicleFormErrors}
          submitError={vehicleSaveError}
          isSubmitting={isSavingVehicle}
          onChange={handleVehicleFormChange}
          onClose={() => {
            if (isSavingVehicle) return
            setIsEditModalOpen(false)
          }}
          onSubmit={handleSaveVehicle}
        />
      ) : null}

      {isAvailabilityModalOpen ? (
        <AvailabilityModal
          form={availabilityForm}
          errors={availabilityErrors}
          submitError={availabilitySaveError}
          isSubmitting={isSavingAvailability}
          onChange={handleAvailabilityFormChange}
          onClose={() => {
            if (isSavingAvailability) return
            setIsAvailabilityModalOpen(false)
          }}
          onSubmit={handleSaveAvailability}
        />
      ) : null}

      {isDeleteModalOpen ? (
        <DeleteVehicleModal
          vehicle={vehicle}
          errorMessage={deleteError}
          isDeleting={isDeleting}
          onCancel={() => {
            if (isDeleting) return
            setIsDeleteModalOpen(false)
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
        <div className="fixed bottom-6 right-6 z-50 rounded-[18px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(15,23,42,0.25)]">
          {toastMessage}
        </div>
      ) : null}
    </AdminLayout>
  )
}

export default VehicleDetailsPage

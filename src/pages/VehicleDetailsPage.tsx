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
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  Truck,
  Wrench,
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
import { TimelineTab } from '@/components/vehicles/TimelineTab'
import { VehicleConsumablesTab } from '@/components/vehicles/VehicleConsumablesTab'
import { VehicleEditModal } from '@/components/vehicles/VehicleEditModal'
import { VehicleStatusBadge } from '@/components/vehicles/VehicleStatusBadge'
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
  getVehicleStatusForDate,
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

type VehicleTab =
  | 'Overview'
  | 'Documents'
  | 'Availability'
  | 'Timeline'
  | 'Maintenance'
  | 'Vehicle Checks'
  | 'Defects'
  | 'Fluids & Consumables'
  | 'History'

const tabs: VehicleTab[] = [
  'Overview',
  'Documents',
  'Availability',
  'Timeline',
  'Maintenance',
  'Vehicle Checks',
  'Defects',
  'Fluids & Consumables',
  'History',
]

const tabFromSearchParam: Record<string, VehicleTab> = {
  consumables: 'Fluids & Consumables',
}

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

function formatDate(value: string | null): string {
  if (!value) return 'Not set'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function getVehicleName(vehicle: Vehicle): string {
  return `${vehicle.make} ${vehicle.model}`.trim()
}

function getDaysRemaining(value: string | null): number | null {
  if (!value) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiryDate = new Date(`${value}T00:00:00`)

  return Math.ceil((expiryDate.getTime() - today.getTime()) / 86_400_000)
}

function getDocumentStatus(daysRemaining: number | null) {
  if (daysRemaining === null) return 'Not set'
  if (daysRemaining < 0) return 'Expired'
  if (daysRemaining <= 30) return 'Expiring Soon'
  return 'Valid'
}

function DetailItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-[#F8FBFF] px-4 py-3.5 ring-1 ring-blue-50">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <div className="mt-2 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null

  return <p className="mt-1.5 text-xs font-medium text-rose-500">{message}</p>
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: typeof ClipboardCheck
  message: string
}) {
  return (
    <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
      <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-[18px] bg-[#EAF4FF] text-[#3B82F6] ring-1 ring-blue-100">
          <Icon className="size-6" strokeWidth={1.9} />
        </div>
        <p className="mt-4 text-lg font-semibold tracking-[-0.02em] text-slate-950">
          {message}
        </p>
        <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
          This section is ready for future module integration.
        </p>
      </CardContent>
    </Card>
  )
}

function OverviewTab({
  vehicle,
  currentDriverName,
}: {
  vehicle: Vehicle
  currentDriverName: string
}) {
  const vehicleAge = vehicle.year
    ? `${Math.max(new Date().getFullYear() - vehicle.year, 0)} years`
    : 'Not set'

  return (
    <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
      <CardContent className="p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <DetailItem label="Registration" value={vehicle.registration} />
          <DetailItem label="Fleet Number" value={vehicle.fleetNumber ?? 'Not set'} />
          <DetailItem label="Vehicle Type" value={vehicle.vehicleType ?? 'Not set'} />
          <DetailItem label="Make" value={vehicle.make} />
          <DetailItem label="Model" value={vehicle.model} />
          <DetailItem label="Year" value={vehicle.year ?? 'Not set'} />
          <DetailItem label="VIN" value={vehicle.vin ?? 'Not set'} />
          <DetailItem label="Assigned Driver" value={currentDriverName} />
          <DetailItem
            label="Status"
            value={getVehicleStatusForDate(vehicle)}
          />
          <DetailItem
            label="Current Mileage"
            value={vehicle.currentOdometer?.toLocaleString('en-GB') ?? 'Not set'}
          />
          <DetailItem label="Vehicle Age" value={vehicleAge} />
          {getVehicleStatusForDate(vehicle) === 'Off Road' ? (
            <>
              <DetailItem
                label="Off Road Reason"
                value={vehicle.offRoadReason ?? 'Not set'}
              />
              <DetailItem
                label="Off Road Start Date"
                value={formatDate(vehicle.offRoadStartDate)}
              />
              <DetailItem
                label="Expected Return Date"
                value={formatDate(vehicle.offRoadExpectedReturnDate)}
              />
              <DetailItem label="Off Road Notes" value={vehicle.notes ?? 'Not set'} />
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function DocumentsTab({ vehicle }: { vehicle: Vehicle }) {
  const documents = [
    { label: 'Insurance', expiry: vehicle.insuranceExpiry },
    { label: 'MOT', expiry: vehicle.motExpiry },
    { label: 'Road Tax', expiry: vehicle.roadTaxExpiry },
    { label: 'Tachograph Calibration', expiry: vehicle.tachographExpiry },
    { label: 'Operator Licence', expiry: null },
  ]

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {documents.map((document) => {
        const daysRemaining = getDaysRemaining(document.expiry)
        const status = getDocumentStatus(daysRemaining)
        const statusClass =
          status === 'Expired'
            ? 'bg-rose-50 text-rose-700 ring-rose-200'
            : status === 'Expiring Soon'
              ? 'bg-orange-50 text-orange-700 ring-orange-200'
              : 'bg-emerald-50 text-emerald-700 ring-emerald-200'

        return (
          <Card
            key={document.label}
            className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                    {document.label}
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    Expiry date: {formatDate(document.expiry)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Days remaining:{' '}
                    {daysRemaining === null ? 'Not set' : daysRemaining}
                  </p>
                </div>
                <FileText className="size-5 text-[#3B82F6]" />
              </div>
              <span
                className={`mt-5 inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClass}`}
              >
                {status}
              </span>
              <p className="mt-4 text-xs font-medium text-slate-400">
                Upload support prepared for future documents module.
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function AvailabilityTab({
  vehicle,
  onAddAvailability,
  onSelectRecord,
}: {
  vehicle: Vehicle
  onAddAvailability: () => void
  onSelectRecord: (record: VehicleAvailability) => void
}) {
  return (
    <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xl font-semibold tracking-[-0.03em] text-slate-950">
              Availability
            </p>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Schedule date-based vehicle availability without changing the main vehicle record.
            </p>
          </div>
          <Button
            type="button"
            onClick={onAddAvailability}
            className="h-11 rounded-[16px] bg-[#3B82F6] px-4 font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#2563EB]"
          >
            <Plus className="size-4" />
            Add Availability
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {vehicle.availabilityRecords.length === 0 ? (
            <div className="rounded-2xl bg-[#F8FBFF] px-4 py-8 text-center ring-1 ring-blue-50">
              <p className="text-sm font-semibold text-slate-600">
                No availability records yet
              </p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                If no record exists, the vehicle uses its fallback status.
              </p>
            </div>
          ) : (
            vehicle.availabilityRecords.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => onSelectRecord(record)}
                className="flex w-full flex-col gap-3 rounded-2xl bg-[#F8FBFF] px-4 py-4 text-left ring-1 ring-blue-50 transition-all duration-[250ms] hover:-translate-y-0.5 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <VehicleStatusBadge status={record.status} />
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {formatDate(record.startDate)} -{' '}
                    {record.endDate ? formatDate(record.endDate) : 'Ongoing'}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Reason: {record.reason ?? 'Not set'}
                  </p>
                </div>
                <p className="max-w-md text-sm font-medium text-slate-500">
                  {record.notes ?? 'No notes'}
                </p>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
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
    <section className="space-y-5">
      <Card className="rounded-[20px] border-0 bg-white/72 py-0 shadow-[0_18px_45px_rgba(59,130,246,0.07)] ring-1 ring-white/80">
        <CardContent className="animate-pulse p-6">
          <div className="h-10 w-36 rounded-[16px] bg-blue-100" />
          <div className="mt-6 h-12 w-72 rounded-full bg-blue-100" />
        </CardContent>
      </Card>
      <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
        <CardContent className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-[#F8FBFF]" />
          ))}
        </CardContent>
      </Card>
    </section>
  )
}

function VehicleDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [activeTab, setActiveTab] = useState<VehicleTab>('Overview')
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
    if (tabParam && tabFromSearchParam[tabParam]) {
      setActiveTab(tabFromSearchParam[tabParam])
    }
  }, [searchParams])

  useEffect(() => {
    if (!toastMessage) return
    const timeoutId = window.setTimeout(() => setToastMessage(null), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [toastMessage])

  useEffect(() => {
    if (activeTab !== 'Timeline' || !vehicle) return

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
    if (activeTab !== 'Fluids & Consumables' || !vehicle) return

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
    return driver ? `${driver.firstName} ${driver.lastName}`.trim() : 'No current driver'
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
      if (activeTab === 'Timeline') {
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
      if (activeTab === 'Timeline') {
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
    <AdminLayout>
      <section className="space-y-5">
        <Card className="rounded-[20px] border-0 bg-white/72 py-0 shadow-[0_18px_45px_rgba(59,130,246,0.07)] ring-1 ring-white/80 backdrop-blur">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-6">
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-[16px] border-0 bg-white px-4 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#EAF4FF] hover:text-[#2563EB]"
              >
                <Link to="/vehicles">
                  <ArrowLeft className="size-4" />
                  Back to Vehicles
                </Link>
              </Button>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-[#EAF4FF] text-[#2563EB] ring-1 ring-blue-100">
                  <Truck className="size-7" strokeWidth={1.9} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-3xl">
                      {vehicle.registration}
                    </h1>
                    <VehicleStatusBadge status={getVehicleStatusForDate(vehicle)} />
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {getVehicleName(vehicle)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={openEditVehicleModal}
                  className="h-9 rounded-[12px] border-0 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:bg-[#EAF4FF] hover:text-[#2563EB]"
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setDeleteError(null)
                    setIsDeleteModalOpen(true)
                  }}
                  disabled={isDeleting}
                  variant="outline"
                  className="h-9 rounded-[12px] border-0 bg-white px-3 text-sm font-semibold text-rose-600 shadow-sm ring-1 ring-rose-100 transition-all duration-[250ms] ease-out hover:bg-rose-50 hover:text-rose-700 disabled:opacity-70"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </div>

            {deleteError ? (
              <div className="mt-5 rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
                {deleteError}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
          <CardContent className="p-3">
            <div className="flex gap-2 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`shrink-0 rounded-[16px] px-4 py-2.5 text-sm font-semibold transition-all duration-[250ms] ease-out ${
                    activeTab === tab
                      ? 'bg-[#DCEEFF] text-[#2563EB] shadow-[0_10px_24px_rgba(59,130,246,0.18)]'
                      : 'text-slate-500 hover:-translate-y-0.5 hover:bg-[#F6FAFF] hover:text-slate-950'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {activeTab === 'Overview' ? (
          <OverviewTab vehicle={vehicle} currentDriverName={currentDriverName} />
        ) : null}
        {activeTab === 'Documents' ? <DocumentsTab vehicle={vehicle} /> : null}
        {activeTab === 'Availability' ? (
          <AvailabilityTab
            vehicle={vehicle}
            onAddAvailability={openAvailabilityModal}
            onSelectRecord={openAvailabilityDetails}
          />
        ) : null}
        {activeTab === 'Timeline' ? (
          isLoadingTimeline || !timelineVehicle ? (
            <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
              <CardContent className="space-y-4 p-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-2xl bg-[#F8FBFF]"
                  />
                ))}
              </CardContent>
            </Card>
          ) : (
            <TimelineTab
              vehicle={timelineVehicle}
              onSelectRecord={openAvailabilityDetails}
            />
          )
        ) : null}
        {activeTab === 'Maintenance' ? (
          <EmptyState icon={Wrench} message="No maintenance records yet" />
        ) : null}
        {activeTab === 'Vehicle Checks' ? (
          <EmptyState icon={ClipboardCheck} message="No vehicle checks yet" />
        ) : null}
        {activeTab === 'Defects' ? (
          <EmptyState icon={ShieldAlert} message="No defects yet" />
        ) : null}
        {activeTab === 'Fluids & Consumables' ? (
          <VehicleConsumablesTab
            vehicleId={vehicle.id}
            items={vehicleConsumables}
            isLoading={isLoadingConsumables}
            loadError={consumablesLoadError}
          />
        ) : null}
        {activeTab === 'History' ? (
          <EmptyState icon={CheckCircle2} message="No vehicle history yet" />
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

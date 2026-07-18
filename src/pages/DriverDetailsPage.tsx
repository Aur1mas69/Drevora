import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  Pencil,
  Phone,
  Trash2,
} from 'lucide-react'
import AdminLayout from '@/layouts/AdminLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  driversService,
  getDriverFormValues,
  type CreateDriverInput,
  type Driver,
  type DriverRole,
  type DriverStatus,
  type LicenceCategory,
} from '@/services/driversService'
import { WorkerAvatar } from '@/components/workers/WorkerAvatar'
import { WorkerCodeBadge } from '@/components/workers/WorkerCodeBadge'
import { WorkerComplianceBadge } from '@/components/workers/WorkerComplianceBadge'
import { WorkerProfileOverview } from '@/components/workers/WorkerProfileOverview'
import {
  WorkerProfileHistoryTabs,
  type WorkerProfileHistoryTab,
} from '@/components/workers/profile/WorkerProfileHistoryTabs'
import { WorkerFormModal } from '@/components/workers/WorkerFormModal'
import { saveWorkerAvatarForDriver } from '@/services/workerAvatarStorageService'
import { vehiclesService, type Vehicle } from '@/services/vehiclesService'

type DriverDetailsTab = 'Overview' | WorkerProfileHistoryTab

type DriverForm = CreateDriverInput
type DriverFormErrors = Partial<Record<keyof DriverForm, string>>

const tabs: DriverDetailsTab[] = [
  'Overview',
  'Timesheets',
  'Holidays',
  'Vehicle Checks',
  'Documents',
  'Consumables',
]

const statusClassMap: Record<DriverStatus, string> = {
  Working:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
  'Off Duty':
    'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
  Holiday:
    'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900/60',
  Suspended:
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60',
}

const driverStatuses: DriverStatus[] = [
  'Working',
  'Off Duty',
  'Holiday',
  'Suspended',
]

const workerRoles: DriverRole[] = [
  'Admin',
  'Driver',
  'Mechanic',
  'Transport Manager',
  'Office Staff',
  'Warehouse',
  'Yardman',
  'Cleaner',
  'Supervisor',
  'Planner',
  'Other',
]

function getDriverName(driver: Driver): string {
  return `${driver.firstName} ${driver.lastName}`.trim()
}

function resetAvatarFormState(setters: {
  setAvatarFile: (file: File | null) => void
  setRemoveAvatar: (value: boolean) => void
  setAvatarError: (value: string | null) => void
}) {
  setters.setAvatarFile(null)
  setters.setRemoveAvatar(false)
  setters.setAvatarError(null)
}

function validateDriverForm(form: DriverForm): DriverFormErrors {
  const errors: DriverFormErrors = {}

  if (!form.firstName.trim()) errors.firstName = 'First name is required.'
  if (!form.lastName.trim()) errors.lastName = 'Last name is required.'
  if (!form.role.trim()) errors.role = 'Role is required.'
  if (
    form.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  ) {
    errors.email = 'Enter a valid email address.'
  }

  return errors
}

function DriverStatusBadge({ status }: { status: DriverStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClassMap[status]}`}
    >
      {status}
    </span>
  )
}

function DeleteDriverModal({
  driver,
  errorMessage,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  driver: Driver
  errorMessage: string | null
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[20px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 dark:bg-slate-900/95 dark:ring-white/10 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-500">
          Delete Worker
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-slate-100">
          Are you sure you want to delete this worker?
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
          {getDriverName(driver)} will be removed from DREVORA.
        </p>

        {errorMessage ? (
          <div className="mt-5 rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
            className="h-11 rounded-[16px] border-0 bg-white px-5 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:bg-[#EAF4FF] hover:text-[#2563EB] dark:bg-slate-900/70 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-slate-800/50 dark:hover:text-blue-300"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-11 rounded-[16px] bg-rose-600 px-5 font-semibold text-white shadow-[0_14px_28px_rgba(225,29,72,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-rose-700 disabled:translate-y-0 disabled:opacity-70"
          >
            {isDeleting ? 'Deleting...' : 'Delete Worker'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function DriverDetailsSkeleton() {
  return (
    <section className="mx-auto max-w-6xl space-y-4">
      <Card className="rounded-2xl border border-[#D3E9FC] bg-[#FAFCFF] py-0 dark:border-white/10 dark:bg-slate-900/70">
        <CardContent className="animate-pulse p-5">
          <div className="mb-4 h-9 w-36 rounded-xl bg-blue-100" />
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-2xl bg-blue-100" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-48 rounded-full bg-blue-100" />
              <div className="h-4 w-64 max-w-full rounded-full bg-blue-50" />
              <div className="h-6 w-32 rounded-full bg-blue-100" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-44 animate-pulse rounded-2xl border border-[#D3E9FC] bg-[#F8FBFF] dark:border-white/10 dark:bg-slate-900/70"
          />
        ))}
      </div>
    </section>
  )
}

function DriverNotFound() {
  return (
    <AdminLayout>
      <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70 dark:bg-slate-900/70 dark:ring-white/10">
        <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-slate-100">
            Worker not found
          </p>
          <p className="mt-2 max-w-md text-sm font-medium text-slate-500 dark:text-slate-400">
            This worker may have been deleted or the link may be incorrect.
          </p>
          <Button
            asChild
            className="mt-6 h-11 rounded-[16px] bg-[#3B82F6] px-5 font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#2563EB]"
          >
            <Link to="/drivers">
              <ArrowLeft className="size-4" />
              Back to Workers
            </Link>
          </Button>
        </CardContent>
      </Card>
    </AdminLayout>
  )
}

function parseDriverDetailsTab(value: string | null): DriverDetailsTab | null {
  if (!value) return null
  const normalised = value.trim().toLowerCase()
  if (normalised === 'overview') return 'Overview'
  if (normalised === 'timesheets') return 'Timesheets'
  if (normalised === 'holidays') return 'Holidays'
  if (normalised === 'vehicle checks' || normalised === 'vehicle-checks' || normalised === 'checks') {
    return 'Vehicle Checks'
  }
  if (normalised === 'documents') return 'Documents'
  if (normalised === 'consumables') return 'Consumables'
  return null
}

function DriverDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [driver, setDriver] = useState<Driver | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [activeTab, setActiveTab] = useState<DriverDetailsTab>(() => {
    return parseDriverDetailsTab(searchParams.get('tab')) ?? 'Overview'
  })
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [form, setForm] = useState<DriverForm | null>(null)
  const [formErrors, setFormErrors] = useState<DriverFormErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)

  const loadDriver = useCallback(async () => {
    if (!id) {
      setIsLoading(false)
      setDriver(null)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const result = await driversService.fetchDriverById(id)
      setDriver(result)
    } catch {
      setLoadError('Unable to load worker details. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadDriver()
  }, [loadDriver])

  useEffect(() => {
    const tabFromQuery = parseDriverDetailsTab(searchParams.get('tab'))
    if (tabFromQuery) setActiveTab(tabFromQuery)
  }, [searchParams])

  useEffect(() => {
    void vehiclesService.fetchVehicles().then(setVehicles).catch(() => {
      setVehicles([])
    })
  }, [])

  useEffect(() => {
    if (!toastMessage) return

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null)
    }, 3000)

    return () => window.clearTimeout(timeoutId)
  }, [toastMessage])

  function openEditModal() {
    if (!driver) return

    setForm(getDriverFormValues(driver))
    setFormErrors({})
    setSaveError(null)
    resetAvatarFormState({ setAvatarFile, setRemoveAvatar, setAvatarError })
    setIsEditModalOpen(true)
  }

  function handleFormChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target

    setForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            [name]: value,
          }
        : currentForm,
    )
    setFormErrors((currentErrors) => ({
      ...currentErrors,
      [name]: undefined,
    }))
  }

  function handleLicenceCategoriesChange(categories: LicenceCategory[]) {
    setForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            licenceCategories: categories,
          }
        : currentForm,
    )
  }

  async function handleSaveDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!driver || !form) return

    const validationErrors = validateDriverForm(form)
    setFormErrors(validationErrors)
    setSaveError(null)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSaving(true)
    setAvatarError(null)

    try {
      let updatedDriver = await driversService.updateDriver(driver.id, form)

      if (avatarFile || removeAvatar) {
        setIsAvatarUploading(true)
        try {
          updatedDriver = await saveWorkerAvatarForDriver(
            updatedDriver,
            avatarFile,
            removeAvatar,
          )
        } catch (avatarUploadError) {
          if (import.meta.env.DEV) {
            console.error('[DriverDetailsPage] avatar upload failed:', avatarUploadError)
          }
          setAvatarError(
            'Worker updated, but the avatar upload failed. Try again.',
          )
          setDriver(updatedDriver)
          setToastMessage('Worker updated, but avatar upload failed.')
          return
        } finally {
          setIsAvatarUploading(false)
        }
      }

      setDriver(updatedDriver)
      setIsEditModalOpen(false)
      setForm(null)
      resetAvatarFormState({ setAvatarFile, setRemoveAvatar, setAvatarError })
      setToastMessage('Worker updated successfully.')
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[DriverDetailsPage] save worker failed:', error)
      }
      setSaveError(
        'Unable to save worker. Please check required fields or database setup.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmDeleteDriver() {
    if (!driver) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await driversService.deleteDriver(driver.id)
      navigate('/drivers', {
        state: { toastMessage: 'Worker deleted successfully.' },
      })
    } catch {
      setDeleteError('Unable to delete worker. Please try again.')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <DriverDetailsSkeleton />
      </AdminLayout>
    )
  }

  if (!driver && !loadError) {
    return <DriverNotFound />
  }

  if (loadError) {
    return (
      <AdminLayout>
        <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70 dark:bg-slate-900/70 dark:ring-white/10">
          <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-slate-100">
              Worker not found
            </p>
            <p className="mt-2 max-w-md text-sm font-medium text-slate-500 dark:text-slate-400">
              {loadError}
            </p>
            <Button
              type="button"
              onClick={loadDriver}
              className="mt-6 h-11 rounded-[16px] bg-[#3B82F6] px-5 font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#2563EB]"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </AdminLayout>
    )
  }

  if (!driver) {
    return <DriverNotFound />
  }

  return (
    <AdminLayout>
      <section className="mx-auto max-w-6xl space-y-4">
        <Card className="rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF]/98 to-[#EEF6FF]/88 py-0 shadow-[0_4px_16px_rgba(33,142,231,0.06)] ring-1 ring-[#C5DFFB]/35 dark:border-white/10 dark:from-slate-900/70 dark:to-slate-900/60 dark:ring-white/10">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <Button
                asChild
                variant="outline"
                className="h-9 rounded-xl border border-[#D3E9FC] bg-white/90 px-3 text-sm font-semibold text-[#113C69] shadow-sm transition-all duration-200 hover:bg-[#F5FAFF] hover:text-[#0B68BE] dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800/50 dark:hover:text-blue-300"
              >
                <Link to="/drivers">
                  <ArrowLeft className="size-4" />
                  Back to Workers
                </Link>
              </Button>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <WorkerAvatar
                  firstName={driver.firstName}
                  lastName={driver.lastName}
                  avatarUrl={driver.avatarUrl}
                  size="lg"
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-2xl font-semibold tracking-[-0.03em] text-[#113C69] dark:text-slate-100 sm:text-3xl">
                      {getDriverName(driver)}
                    </h1>
                    <WorkerCodeBadge
                      code={driver.workerCode}
                      emptyLabel="No Worker ID"
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <DriverStatusBadge status={driver.status} />
                    <WorkerComplianceBadge driver={driver} />
                  </div>

                  <div className="mt-2.5 flex flex-col gap-1.5 text-sm font-medium text-[#3D7A9C] sm:flex-row sm:flex-wrap sm:gap-x-4">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Mail className="size-3.5 shrink-0 text-[#5499BF]" />
                      <span className="truncate">
                        {driver.email || (
                          <span className="text-slate-400">Not set</span>
                        )}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Phone className="size-3.5 shrink-0 text-[#5499BF]" />
                      {driver.phone ?? (
                        <span className="text-slate-400">Not set</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  onClick={openEditModal}
                  className="h-10 rounded-xl bg-gradient-to-br from-[#218EE7] to-[#0B68BE] px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(33,142,231,0.2)] transition-all duration-200 hover:-translate-y-0.5"
                >
                  <Pencil className="size-4" />
                  Edit Worker
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setDeleteError(null)
                    setIsDeleteModalOpen(true)
                  }}
                  disabled={isDeleting}
                  variant="outline"
                  className="h-10 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 shadow-sm transition-all duration-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-70 dark:border-rose-900/40 dark:bg-slate-900/70 dark:text-rose-400 dark:hover:bg-rose-950/50 dark:hover:text-rose-300"
                >
                  <Trash2 className="size-4" />
                  {isDeleting ? 'Deleting...' : 'Delete Worker'}
                </Button>
              </div>
            </div>

            {deleteError ? (
              <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
                {deleteError}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-[#D3E9FC] bg-white/90 py-0 shadow-sm ring-1 ring-[#C5DFFB]/30 dark:border-white/10 dark:bg-slate-900/70 dark:ring-white/10">
          <CardContent className="p-2">
            <div className="flex gap-1.5 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                    activeTab === tab
                      ? 'bg-[#E8F3FE] text-[#0B68BE] shadow-sm ring-1 ring-[#C5DFFB]/60 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/40'
                      : 'text-slate-500 hover:bg-[#F5FAFF] hover:text-[#113C69] dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {activeTab === 'Overview' ? <WorkerProfileOverview driver={driver} /> : null}
        {activeTab !== 'Overview' ? (
          <WorkerProfileHistoryTabs worker={driver} activeTab={activeTab} />
        ) : null}
      </section>

      {isEditModalOpen && form ? (
        <WorkerFormModal
          eyebrow="Edit Worker"
          title="Edit Worker"
          submitLabel="Save Changes"
          form={form}
          errors={formErrors}
          submitError={saveError}
          isSubmitting={isSaving}
          workerCode={driver.workerCode}
          avatarUrl={driver.avatarUrl}
          pendingAvatarFile={avatarFile}
          removeAvatar={removeAvatar}
          isAvatarUploading={isAvatarUploading}
          avatarError={avatarError}
          onAvatarFileSelect={(file) => {
            setAvatarFile(file)
            if (file) setRemoveAvatar(false)
          }}
          onRemoveAvatar={() => {
            setRemoveAvatar(true)
            setAvatarFile(null)
            setAvatarError(null)
          }}
          onClearPendingAvatar={() => {
            setAvatarFile(null)
            setAvatarError(null)
          }}
          vehicles={vehicles}
          workerRoles={workerRoles}
          driverStatuses={driverStatuses}
          onChange={handleFormChange}
          onLicenceCategoriesChange={handleLicenceCategoriesChange}
          onClose={() => {
            if (isSaving || isAvatarUploading) return
            setIsEditModalOpen(false)
            setForm(null)
            resetAvatarFormState({ setAvatarFile, setRemoveAvatar, setAvatarError })
          }}
          onSubmit={handleSaveDriver}
        />
      ) : null}

      {isDeleteModalOpen ? (
        <DeleteDriverModal
          driver={driver}
          errorMessage={deleteError}
          isDeleting={isDeleting}
          onCancel={() => {
            if (isDeleting) return
            setIsDeleteModalOpen(false)
          }}
          onConfirm={handleConfirmDeleteDriver}
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

export default DriverDetailsPage

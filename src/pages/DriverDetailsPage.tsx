import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import AdminLayout from '@/layouts/AdminLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  driversService,
  type CreateDriverInput,
  type Driver,
  type DriverRole,
  type DriverStatus,
} from '@/services/driversService'

type DriverDetailsTab =
  | 'Overview'
  | 'Timesheets'
  | 'Holidays'
  | 'Vehicle Checks'
  | 'Documents'

type DriverForm = CreateDriverInput
type DriverFormErrors = Partial<Record<keyof DriverForm, string>>

const tabs: DriverDetailsTab[] = [
  'Overview',
  'Timesheets',
  'Holidays',
  'Vehicle Checks',
  'Documents',
]

const statusClassMap: Record<DriverStatus, string> = {
  Working: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'Off Duty': 'bg-slate-100 text-slate-600 ring-slate-200',
  Holiday: 'bg-orange-50 text-orange-700 ring-orange-200',
  Suspended: 'bg-rose-50 text-rose-700 ring-rose-200',
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
  'Yardman',
  'Cleaner',
  'Supervisor',
  'Mechanic',
  'Transport Manager',
  'Planner',
  'Office Staff',
  'Other',
]

function getDriverName(driver: Driver): string {
  return `${driver.firstName} ${driver.lastName}`.trim()
}

function getDriverInitials(driver: Driver): string {
  return `${driver.firstName.charAt(0)}${driver.lastName.charAt(0)}`.toUpperCase()
}

function getDriverFormValues(driver: Driver): DriverForm {
  return {
    firstName: driver.firstName,
    lastName: driver.lastName,
    email: driver.email,
    phone: driver.phone ?? '',
    company: driver.company,
    role: driver.role,
    status: driver.status,
  }
}

function validateDriverForm(form: DriverForm): DriverFormErrors {
  const errors: DriverFormErrors = {}

  if (!form.firstName.trim()) errors.firstName = 'First name is required.'
  if (!form.lastName.trim()) errors.lastName = 'Last name is required.'
  if (!form.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (!form.phone.trim()) errors.phone = 'Phone is required.'
  if (!form.company.trim()) errors.company = 'Company is required.'

  return errors
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value.includes('T') ? value : `${value}T00:00:00`))
}

function DriverStatusBadge({ status }: { status: DriverStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClassMap[status]}`}
    >
      {status}
    </span>
  )
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: string | ReactNode
}) {
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

function EditDriverModal({
  form,
  errors,
  submitError,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
}: {
  form: DriverForm
  errors: DriverFormErrors
  submitError: string | null
  isSubmitting: boolean
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-[20px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100">
        <form onSubmit={onSubmit} className="p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#3B82F6]">
            Edit Worker
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            Edit Worker
          </h2>

          {submitError ? (
            <div className="mt-5 rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
              {submitError}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">First Name</span>
              <Input
                name="firstName"
                value={form.firstName}
                onChange={onChange}
                className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
              />
              <FieldError message={errors.firstName} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Last Name</span>
              <Input
                name="lastName"
                value={form.lastName}
                onChange={onChange}
                className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
              />
              <FieldError message={errors.lastName} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <Input
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
              />
              <FieldError message={errors.email} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Phone</span>
              <Input
                name="phone"
                value={form.phone}
                onChange={onChange}
                className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
              />
              <FieldError message={errors.phone} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Company</span>
              <Input
                name="company"
                value={form.company}
                onChange={onChange}
                className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
              />
              <FieldError message={errors.company} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Role</span>
              <select
                name="role"
                value={form.role}
                onChange={onChange}
                className="mt-2 h-11 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
              >
                {workerRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <FieldError message={errors.role} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Status</span>
              <select
                name="status"
                value={form.status}
                onChange={onChange}
                className="mt-2 h-11 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
              >
                {driverStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
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
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
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
      <div className="w-full max-w-md rounded-[20px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-500">
          Delete Worker
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
          Are you sure you want to delete this worker?
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
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
            className="h-11 rounded-[16px] border-0 bg-white px-5 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:bg-[#EAF4FF] hover:text-[#2563EB]"
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

function EmptyTabState({
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
          This section will connect to the worker profile as the module is built.
        </p>
      </CardContent>
    </Card>
  )
}

function OverviewTab({ driver }: { driver: Driver }) {
  return (
    <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
      <CardContent className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-[14px] bg-[#EAF4FF] text-[#3B82F6] ring-1 ring-blue-100">
            <UserRound className="size-5" strokeWidth={1.9} />
          </div>
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
            Overview
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailItem label="First Name" value={driver.firstName} />
          <DetailItem label="Last Name" value={driver.lastName} />
          <DetailItem label="Email" value={driver.email} />
          <DetailItem label="Phone" value={driver.phone ?? 'Not set'} />
          <DetailItem label="Company" value={driver.company} />
          <DetailItem label="Role" value={driver.role} />
          <DetailItem
            label="Department / Assignment"
            value={driver.assignment ?? 'Not Assigned'}
          />
          <DetailItem
            label="Status"
            value={<DriverStatusBadge status={driver.status} />}
          />
          <DetailItem label="Created Date" value={formatDate(driver.createdAt)} />
        </div>
      </CardContent>
    </Card>
  )
}

function DriverDetailsSkeleton() {
  return (
    <section className="space-y-5">
      <Card className="rounded-[20px] border-0 bg-white/72 py-0 shadow-[0_18px_45px_rgba(59,130,246,0.07)] ring-1 ring-white/80">
        <CardContent className="animate-pulse p-6">
          <div className="mb-6 h-10 w-36 rounded-[16px] bg-blue-100" />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="size-24 rounded-[24px] bg-blue-100" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-52 rounded-full bg-blue-100" />
              <div className="h-3 w-72 max-w-full rounded-full bg-blue-50" />
              <div className="h-8 w-24 rounded-full bg-blue-100" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
        <CardContent className="space-y-5 p-6">
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-10 w-28 animate-pulse rounded-[16px] bg-blue-50"
              />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-2xl bg-[#F8FBFF]"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function DriverNotFound() {
  return (
    <AdminLayout>
      <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
        <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-xl font-semibold tracking-[-0.03em] text-slate-950">
            Worker not found
          </p>
          <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
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

function DriverDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [driver, setDriver] = useState<Driver | null>(null)
  const [activeTab, setActiveTab] = useState<DriverDetailsTab>('Overview')
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

    try {
      const updatedDriver = await driversService.updateDriver(driver.id, form)
      setDriver(updatedDriver)
      setIsEditModalOpen(false)
      setForm(null)
      setToastMessage('Worker updated successfully.')
    } catch {
      setSaveError('Unable to save worker. Please check the details and try again.')
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
        <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
          <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
              Worker not found
            </p>
            <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
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
      <section className="space-y-5">
        <Card className="rounded-[20px] border-0 bg-white/72 py-0 shadow-[0_18px_45px_rgba(59,130,246,0.07)] ring-1 ring-white/80 backdrop-blur">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-6">
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-[16px] border-0 bg-white px-4 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#EAF4FF] hover:text-[#2563EB]"
              >
                <Link to="/drivers">
                  <ArrowLeft className="size-4" />
                  Back to Workers
                </Link>
              </Button>
            </div>

            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-[24px] bg-[#EAF4FF] text-2xl font-semibold text-[#2563EB] shadow-sm ring-1 ring-blue-100">
                  {driver.avatarUrl ? (
                    <img
                      src={driver.avatarUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    getDriverInitials(driver)
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-[2.4rem]">
                      {getDriverName(driver)}
                    </h1>
                    <DriverStatusBadge status={driver.status} />
                  </div>

                  <div className="mt-3 grid gap-2 text-sm font-medium text-slate-500 sm:grid-cols-2 xl:grid-cols-3">
                    <span className="inline-flex items-center gap-2">
                      <Mail className="size-4 text-slate-400" />
                      {driver.email}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Phone className="size-4 text-slate-400" />
                      {driver.phone ?? 'Not set'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row xl:justify-end">
                <Button
                  type="button"
                  onClick={openEditModal}
                  className="h-11 rounded-[16px] bg-[#3B82F6] px-4 font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#2563EB]"
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
                  className="h-11 rounded-[16px] border-0 bg-white px-4 font-semibold text-rose-600 shadow-sm ring-1 ring-rose-100 transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-rose-50 hover:text-rose-700 disabled:translate-y-0 disabled:opacity-70"
                >
                  <Trash2 className="size-4" />
                  {isDeleting ? 'Deleting...' : 'Delete Worker'}
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

        {activeTab === 'Overview' ? <OverviewTab driver={driver} /> : null}
        {activeTab === 'Timesheets' ? (
          <EmptyTabState icon={ClipboardCheck} message="No timesheets yet" />
        ) : null}
        {activeTab === 'Holidays' ? (
          <EmptyTabState icon={CalendarCheck} message="No holiday requests yet" />
        ) : null}
        {activeTab === 'Vehicle Checks' ? (
          <EmptyTabState icon={ShieldCheck} message="No vehicle checks yet" />
        ) : null}
        {activeTab === 'Documents' ? (
          <EmptyTabState icon={FileText} message="No documents yet" />
        ) : null}
      </section>

      {isEditModalOpen && form ? (
        <EditDriverModal
          form={form}
          errors={formErrors}
          submitError={saveError}
          isSubmitting={isSaving}
          onChange={handleFormChange}
          onClose={() => {
            if (isSaving) return
            setIsEditModalOpen(false)
            setForm(null)
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

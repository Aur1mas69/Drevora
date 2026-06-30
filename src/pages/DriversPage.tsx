import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, Filter, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import AdminLayout from '@/layouts/AdminLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import {
  driversService,
  type CreateDriverInput,
  type Driver,
  type DriverRole,
  type DriverStatus,
} from '@/services/driversService'

type StatusFilter = DriverStatus | 'All'
type CreateDriverForm = CreateDriverInput
type DriverFormErrors = Partial<Record<keyof CreateDriverForm, string>>

const driverStatuses: DriverStatus[] = [
  'Working',
  'Off Duty',
  'Holiday',
  'Suspended',
]

function parseDriverStatusFilter(value: string | null): StatusFilter {
  if (!value) return 'All'
  if (driverStatuses.includes(value as DriverStatus)) {
    return value as DriverStatus
  }
  return 'All'
}

function ActiveFilterChip({
  label,
  onClear,
}: {
  label: string
  onClear: () => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="inline-flex items-center gap-2 rounded-full bg-[#EAF4FF] px-3 py-1.5 text-sm font-semibold text-[#2563EB] ring-1 ring-blue-100">
        {label}
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear filter: ${label}`}
          className="flex size-5 items-center justify-center rounded-full text-[#2563EB] transition-colors hover:bg-white/80"
        >
          <X className="size-3.5" />
        </button>
      </span>
    </div>
  )
}

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

const initialDriverForm: CreateDriverForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  role: 'Driver',
  status: 'Off Duty',
}

const statusClassMap: Record<DriverStatus, string> = {
  Working: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'Off Duty': 'bg-slate-100 text-slate-600 ring-slate-200',
  Holiday: 'bg-orange-50 text-orange-700 ring-orange-200',
  Suspended: 'bg-rose-50 text-rose-700 ring-rose-200',
}

function getDriverName(driver: Driver): string {
  return `${driver.firstName} ${driver.lastName}`.trim()
}

function getDriverInitials(driver: Driver): string {
  return `${driver.firstName.charAt(0)}${driver.lastName.charAt(0)}`.toUpperCase()
}

function getWorkerAssignment(driver: Driver): string {
  return driver.assignment ?? 'Not Assigned'
}

function getDriverFormValues(driver: Driver): CreateDriverForm {
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

function validateDriverForm(form: CreateDriverForm): DriverFormErrors {
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

function DriverStatusBadge({ status }: { status: DriverStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClassMap[status]}`}
    >
      {status}
    </span>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null

  return <p className="mt-1.5 text-xs font-medium text-rose-500">{message}</p>
}

function DriversToolbar({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  companyFilter,
  onCompanyFilterChange,
  companyOptions,
  isFilterOpen,
  onFilterToggle,
  onAddDriver,
}: {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
  companyFilter: string
  onCompanyFilterChange: (value: string) => void
  companyOptions: string[]
  isFilterOpen: boolean
  onFilterToggle: () => void
  onAddDriver: () => void
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Button
        type="button"
        onClick={onAddDriver}
        className="h-11 rounded-[16px] bg-[#3B82F6] px-4 font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#2563EB] hover:shadow-[0_18px_34px_rgba(59,130,246,0.3)]"
      >
        <Plus className="size-4" />
        Add Worker
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 sm:w-[280px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search workers"
            className="h-11 rounded-[16px] border-0 bg-white pl-10 pr-4 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out placeholder:text-slate-400 focus-visible:ring-3 focus-visible:ring-blue-200"
          />
        </div>

        <div className="relative">
          <Button
            type="button"
            variant="outline"
            onClick={onFilterToggle}
            className="h-11 rounded-[16px] border-0 bg-white px-4 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#EAF4FF] hover:text-[#2563EB] hover:shadow-md"
          >
            <Filter className="size-4" />
            Filter
          </Button>

          {isFilterOpen ? (
            <div className="absolute right-0 z-20 mt-3 w-[260px] rounded-[20px] bg-white p-4 shadow-[0_18px_45px_rgba(59,130,246,0.16)] ring-1 ring-blue-100">
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Status
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      onStatusFilterChange(event.target.value as StatusFilter)
                    }
                    className="mt-2 h-11 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
                  >
                    <option value="All">All statuses</option>
                    {driverStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Company
                  </span>
                  <select
                    value={companyFilter}
                    onChange={(event) => onCompanyFilterChange(event.target.value)}
                    className="mt-2 h-11 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
                  >
                    <option value="All">All companies</option>
                    {companyOptions.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function DriverRowActions({
  driver,
  onEdit,
  onDelete,
}: {
  driver: Driver
  onEdit: () => void
  onDelete: () => void
}) {
  const actions: RowAction[] = [
    {
      id: 'view',
      label: 'View',
      icon: Eye,
      to: `/drivers/${driver.id}`,
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: onEdit,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      tone: 'danger',
      onClick: onDelete,
    },
  ]

  return <RowActionsMenu actions={actions} />
}

function DriversTable({
  drivers,
  onEditDriver,
  onDeleteDriver,
}: {
  drivers: Driver[]
  onEditDriver: (driver: Driver) => void
  onDeleteDriver: (driver: Driver) => void
}) {
  return (
    <Card className="overflow-hidden rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr className="bg-[#F6FAFF] text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                <th className="px-6 py-4">Avatar</th>
                <th className="px-6 py-4">Worker</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Department / Assignment</th>
                <th className="px-6 py-4">Status</th>
                <TableActionsHeader className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {drivers.map((driver) => (
                <tr
                  key={driver.id}
                  className="group transition-all duration-[250ms] ease-out hover:bg-[#F8FBFF]"
                >
                  <td className="px-6 py-5">
                    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[15px] bg-[#EAF4FF] text-sm font-semibold text-[#2563EB] shadow-sm ring-1 ring-blue-100 transition-transform duration-[250ms] ease-out group-hover:-translate-y-0.5">
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
                  </td>
                  <td className="px-6 py-5">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {getDriverName(driver)}
                      </p>
                      <div>
                        <p className="mt-1 text-xs font-medium text-slate-400">
                          {driver.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm font-medium text-slate-600">
                    {driver.role}
                  </td>
                  <td className="px-6 py-5 text-sm font-medium text-slate-600">
                    {getWorkerAssignment(driver)}
                  </td>
                  <td className="px-6 py-5">
                    <DriverStatusBadge status={driver.status} />
                  </td>
                  <TableActionsCell className="px-6 py-5">
                    <DriverRowActions
                      driver={driver}
                      onEdit={() => onEditDriver(driver)}
                      onDelete={() => onDeleteDriver(driver)}
                    />
                  </TableActionsCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function DriversLoadingSkeleton() {
  return (
    <Card className="overflow-hidden rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
      <CardContent className="space-y-4 p-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex animate-pulse items-center gap-4 rounded-2xl bg-[#F8FBFF] p-4"
          >
            <div className="size-11 rounded-[15px] bg-blue-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-40 rounded-full bg-blue-100" />
              <div className="h-3 w-64 max-w-full rounded-full bg-blue-50" />
            </div>
            <div className="hidden h-8 w-24 rounded-full bg-blue-100 sm:block" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function DriversErrorState({
  onRetry,
  message,
}: {
  onRetry: () => void
  message: string
}) {
  return (
    <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
      <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <p className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
          Unable to load workers.
        </p>
        <p className="mt-2 max-w-md text-sm font-medium text-slate-500">{message}</p>
        <Button
          type="button"
          onClick={onRetry}
          className="mt-6 h-11 rounded-[16px] bg-[#3B82F6] px-5 font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#2563EB]"
        >
          Retry
        </Button>
      </CardContent>
    </Card>
  )
}

function DriversEmptyState({ onAddDriver }: { onAddDriver: () => void }) {
  return (
    <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
      <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
          No workers yet
        </p>
        <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
          Add your first worker to begin.
        </p>
        <Button
          type="button"
          onClick={onAddDriver}
          className="mt-6 h-11 rounded-[16px] bg-[#3B82F6] px-4 font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#2563EB] hover:shadow-[0_18px_34px_rgba(59,130,246,0.3)]"
        >
          <Plus className="size-4" />
          Add First Worker
        </Button>
      </CardContent>
    </Card>
  )
}

function AddDriverModal({
  eyebrow,
  title,
  submitLabel,
  form,
  errors,
  submitError,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
}: {
  eyebrow: string
  title: string
  submitLabel: string
  form: CreateDriverForm
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#3B82F6]">
                {eyebrow}
              </p>
              <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                {title}
              </h2>
            </div>
          </div>

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
              {isSubmitting ? 'Saving...' : submitLabel}
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

function DriversPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [companyFilter, setCompanyFilter] = useState('All')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null)
  const [form, setForm] = useState<CreateDriverForm>(initialDriverForm)
  const [formErrors, setFormErrors] = useState<DriverFormErrors>({})
  const [createError, setCreateError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const loadDrivers = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const result = await driversService.fetchDrivers()
      setDrivers(result)
    } catch (error) {
      setLoadError('Please check the workers data and try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    setStatusFilter(parseDriverStatusFilter(searchParams.get('status')))
  }, [searchParams])

  useEffect(() => {
    void loadDrivers()
  }, [loadDrivers])

  useEffect(() => {
    if (!toastMessage) return

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null)
    }, 3000)

    return () => window.clearTimeout(timeoutId)
  }, [toastMessage])

  useEffect(() => {
    const routeState = location.state as { toastMessage?: string } | null

    if (!routeState?.toastMessage) return

    setToastMessage(routeState.toastMessage)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  const companyOptions = useMemo(
    () =>
      Array.from(new Set(drivers.map((driver) => driver.company).filter(Boolean))).sort(),
    [drivers],
  )

  const filteredDrivers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return drivers.filter((driver) => {
      const matchesSearch =
        !query ||
        [
          driver.firstName,
          driver.lastName,
          driver.email,
          driver.company,
          driver.role,
          driver.assignment ?? '',
        ].some((value) => value.toLowerCase().includes(query))

      const matchesStatus =
        statusFilter === 'All' || driver.status === statusFilter
      const matchesCompany =
        companyFilter === 'All' || driver.company === companyFilter

      return matchesSearch && matchesStatus && matchesCompany
    })
  }, [companyFilter, drivers, searchTerm, statusFilter])

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

  function clearStatusFilter() {
    handleStatusFilterChange('All')
  }

  function openAddDriverModal() {
    setForm(initialDriverForm)
    setFormErrors({})
    setCreateError(null)
    setEditingDriver(null)
    setIsModalOpen(true)
  }

  function openEditDriverModal(driver: Driver) {
    setForm(getDriverFormValues(driver))
    setFormErrors({})
    setCreateError(null)
    setEditingDriver(driver)
    setIsModalOpen(true)
  }

  function openDeleteDriverModal(driver: Driver) {
    setDeleteError(null)
    setDeletingDriver(driver)
  }

  function closeAddDriverModal() {
    if (isCreating) return

    setIsModalOpen(false)
    setEditingDriver(null)
  }

  function handleFormChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
    setFormErrors((currentErrors) => ({
      ...currentErrors,
      [name]: undefined,
    }))
  }

  async function handleSaveDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateDriverForm(form)
    setFormErrors(validationErrors)
    setCreateError(null)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsCreating(true)

    try {
      if (editingDriver) {
        await driversService.updateDriver(editingDriver.id, form)
      } else {
        await driversService.createDriver(form)
      }
      setIsModalOpen(false)
      setEditingDriver(null)
      setForm(initialDriverForm)
      await loadDrivers()
      setToastMessage(
        editingDriver
          ? 'Worker updated successfully.'
          : 'Worker created successfully.',
      )
    } catch (error) {
      setCreateError('Unable to save worker. Please check the details and try again.')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleConfirmDeleteDriver() {
    if (!deletingDriver) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await driversService.deleteDriver(deletingDriver.id)
      setDeletingDriver(null)
      await loadDrivers()
      setToastMessage('Worker deleted successfully.')
    } catch {
      setDeleteError('Unable to delete worker. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AdminLayout>
      <section className="space-y-5">
        <div className="flex flex-col gap-4 rounded-[20px] bg-white/72 p-5 shadow-[0_18px_45px_rgba(59,130,246,0.07)] ring-1 ring-white/80 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#3B82F6]">
              Worker Management
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-[2.4rem]">
              Workers
            </h1>
            <p className="max-w-2xl text-sm font-medium leading-6 text-slate-500">
              Manage workers, roles, licences and compliance.
            </p>
          </div>

          <DriversToolbar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
            companyFilter={companyFilter}
            onCompanyFilterChange={setCompanyFilter}
            companyOptions={companyOptions}
            isFilterOpen={isFilterOpen}
            onFilterToggle={() => setIsFilterOpen((currentValue) => !currentValue)}
            onAddDriver={openAddDriverModal}
          />

          {statusFilter !== 'All' ? (
            <ActiveFilterChip
              label={`Status: ${statusFilter}`}
              onClear={clearStatusFilter}
            />
          ) : null}
        </div>

        {isLoading ? <DriversLoadingSkeleton /> : null}

        {!isLoading && loadError ? (
          <DriversErrorState message={loadError} onRetry={loadDrivers} />
        ) : null}

        {!isLoading && !loadError && drivers.length === 0 ? (
          <DriversEmptyState onAddDriver={openAddDriverModal} />
        ) : null}

        {!isLoading && !loadError && drivers.length > 0 ? (
          filteredDrivers.length > 0 ? (
            <DriversTable
              drivers={filteredDrivers}
              onEditDriver={openEditDriverModal}
              onDeleteDriver={openDeleteDriverModal}
            />
          ) : (
            <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
              <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <p className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
                  No matching records found.
                </p>
                <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
                  Try adjusting the search or filters.
                </p>
              </CardContent>
            </Card>
          )
        ) : null}
      </section>

      {isModalOpen ? (
        <AddDriverModal
          eyebrow={editingDriver ? 'Edit Worker' : 'New Worker'}
          title={editingDriver ? 'Edit Worker' : 'Add Worker'}
          submitLabel={editingDriver ? 'Save Changes' : 'Create Worker'}
          form={form}
          errors={formErrors}
          submitError={createError}
          isSubmitting={isCreating}
          onChange={handleFormChange}
          onClose={closeAddDriverModal}
          onSubmit={handleSaveDriver}
        />
      ) : null}

      {deletingDriver ? (
        <DeleteDriverModal
          driver={deletingDriver}
          errorMessage={deleteError}
          isDeleting={isDeleting}
          onCancel={() => {
            if (isDeleting) return
            setDeletingDriver(null)
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

export default DriversPage

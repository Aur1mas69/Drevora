import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate, useSearchParams, Link } from 'react-router-dom'
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
import { WorkerAvatar } from '@/components/workers/WorkerAvatar'
import { WorkerCodeBadge } from '@/components/workers/WorkerCodeBadge'
import { WorkerComplianceBadge } from '@/components/workers/WorkerComplianceBadge'
import { WorkerFormModal } from '@/components/workers/WorkerFormModal'
import { WorkersSummaryCards } from '@/components/workers/WorkersSummaryCards'
import {
  DEFAULT_WORKER_PAGE_SIZE,
  WorkersPagination,
} from '@/components/workers/WorkersPagination'
import { getGlobalCompanySettings } from '@/lib/companySettingsGlobals'
import {
  adminFilterChip,
  adminHeadingLg,
  adminPanel,
  adminSearchInputLg,
  adminSelect,
  adminSkeletonPulse,
  adminTableEntityName,
  adminTextMuted,
} from '@/lib/adminUiStyles'
import {
  computeWorkerRoleSummaryStats,
  workerMatchesRoleQuickFilter,
  type WorkerRoleQuickFilter,
} from '@/lib/workerRoleSummary'
import { getWorkerDefaultVehicleLabel } from '@/lib/workerProfileUtils'
import {
  driversService,
  emptyCreateDriverInput,
  getDriverFormValues,
  type CreateDriverInput,
  type Driver,
  type DriverRole,
  type DriverStatus,
  type LicenceCategory,
} from '@/services/driversService'
import { saveWorkerAvatarForDriver } from '@/services/workerAvatarStorageService'
import { vehiclesService, type Vehicle } from '@/services/vehiclesService'

type StatusFilter = DriverStatus | 'All'
type RoleFilter = DriverRole | 'All'
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
      <span className={adminFilterChip}>
        {label}
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear filter: ${label}`}
          className="flex size-5 items-center justify-center rounded-full text-[#2563EB] transition-colors hover:bg-white/80 dark:text-blue-300 dark:hover:bg-slate-700/80"
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

const initialDriverForm: CreateDriverInput = emptyCreateDriverInput

const statusClassMap: Record<DriverStatus, string> = {
  Working: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
  'Off Duty': 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
  Holiday: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900/60',
  Suspended: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60',
}

const roleClassMap: Record<DriverRole, string> = {
  Admin: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900/60',
  Driver: 'bg-[#E8F3FE] text-[#0B68BE] ring-[#C5DFFB]/70 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60',
  Yardman: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-900/60',
  Cleaner: 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-900/60',
  Supervisor: 'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:ring-purple-900/60',
  Mechanic: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
  'Transport Manager': 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-900/60',
  Planner: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900/60',
  'Office Staff': 'bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
  Warehouse: 'bg-[#EEF6FF] text-[#3D7A9C] ring-[#C5DFFB]/70 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-900/60',
  Other: 'bg-[#F1F5F9] text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
}

const workersPrimaryButtonClass =
  'h-11 rounded-2xl border border-[#89CFF0]/70 bg-gradient-to-br from-[#218EE7] to-[#0B68BE] px-4 font-semibold text-white shadow-[0_8px_24px_rgba(33,142,231,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#BFE3F5] hover:from-[#1A7FD4] hover:to-[#095FA8] hover:shadow-[0_12px_32px_rgba(33,142,231,0.28)] active:translate-y-0 active:scale-[0.98] active:shadow-[0_6px_18px_rgba(33,142,231,0.18)]'

const workersTableCardClass =
  'overflow-hidden rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF]/98 to-[#EEF6FF]/92 shadow-[0_8px_24px_rgba(33,142,231,0.1),0_0_0_1px_rgba(197,223,251,0.35)] ring-1 ring-[#C5DFFB]/45 dark:border-white/10 dark:from-slate-900/70 dark:to-slate-900/60 dark:ring-white/10'

const workersSearchInputClass =
  `${adminSearchInputLg} pl-10 pr-4 transition-all duration-200 hover:ring-[#BFE3F5] focus-visible:border-[#89CFF0] focus-visible:ring-[#BFE3F5]/70`

const workersFilterButtonClass =
  'h-11 shrink-0 rounded-2xl border border-[#D3E9FC] bg-white/90 px-4 font-semibold text-[#113C69] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#BFE3F5] hover:bg-[#F5FAFF] hover:text-[#0B68BE] hover:shadow-[0_8px_20px_rgba(33,142,231,0.12)] focus-visible:ring-2 focus-visible:ring-[#BFE3F5]/70 active:translate-y-0 active:scale-[0.98] dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800/90'

function getDriverName(driver: Driver): string {
  return `${driver.firstName} ${driver.lastName}`.trim()
}

function getWorkerProfilePath(driver: Driver): string {
  return `/drivers/${driver.id}`
}

function WorkerProfileLink({
  driver,
  className,
  children,
}: {
  driver: Driver
  className?: string
  children: ReactNode
}) {
  const workerName = getDriverName(driver)

  return (
    <Link
      to={getWorkerProfilePath(driver)}
      aria-label={`View worker profile for ${workerName}`}
      className={className}
    >
      {children}
    </Link>
  )
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

function validateDriverForm(form: CreateDriverForm): DriverFormErrors {
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
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClassMap[status]}`}
    >
      {status}
    </span>
  )
}

function WorkerRoleBadge({ role }: { role: DriverRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${roleClassMap[role] ?? roleClassMap.Other}`}
    >
      {role}
    </span>
  )
}

function DriversToolbar({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  roleFilter,
  onRoleFilterChange,
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
  roleFilter: RoleFilter
  onRoleFilterChange: (value: RoleFilter) => void
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
        className={`w-full sm:w-auto ${workersPrimaryButtonClass}`}
      >
        <Plus className="size-4" />
        Add Worker
      </Button>

      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
        <div className="relative min-w-0 w-full sm:w-[280px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#5499BF]" />
          <Input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search workers"
            className={workersSearchInputClass}
            aria-label="Search workers"
          />
        </div>

        <div className="relative w-full shrink-0 sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={onFilterToggle}
            className={`w-full sm:w-auto ${workersFilterButtonClass}`}
            aria-expanded={isFilterOpen}
          >
            <Filter className="size-4" />
            Filter
          </Button>

          {isFilterOpen ? (
            <div className={`absolute left-0 right-0 z-20 mt-3 w-full p-4 sm:left-auto sm:right-0 sm:w-[260px] ${adminPanel} shadow-[0_18px_45px_rgba(59,130,246,0.16)] ring-1 ring-blue-100 dark:ring-white/10`}>
              <div className="space-y-3">
                <label className="block">
                  <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${adminTextMuted}`}>
                    Status
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      onStatusFilterChange(event.target.value as StatusFilter)
                    }
                    className={`mt-2 h-11 w-full rounded-[16px] ${adminSelect}`}
                    aria-label="Filter by status"
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
                  <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${adminTextMuted}`}>
                    Role
                  </span>
                  <select
                    value={roleFilter}
                    onChange={(event) =>
                      onRoleFilterChange(event.target.value as RoleFilter)
                    }
                    className={`mt-2 h-11 w-full rounded-[16px] ${adminSelect}`}
                    aria-label="Filter by role"
                  >
                    <option value="All">All roles</option>
                    {workerRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${adminTextMuted}`}>
                    Company
                  </span>
                  <select
                    value={companyFilter}
                    onChange={(event) => onCompanyFilterChange(event.target.value)}
                    className={`mt-2 h-11 w-full rounded-[16px] ${adminSelect}`}
                    aria-label="Filter by company"
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
      to: getWorkerProfilePath(driver),
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

  return <RowActionsMenu actions={actions} appearance="workers" />
}

function DriversTable({
  drivers,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  onEditDriver,
  onDeleteDriver,
}: {
  drivers: Driver[]
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onEditDriver: (driver: Driver) => void
  onDeleteDriver: (driver: Driver) => void
}) {
  return (
    <Card className={workersTableCardClass}>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse">
            <thead>
              <tr className="border-b border-[#D3E9FC] bg-[#F5FAFF]/90 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B68BE] dark:bg-slate-800/70 dark:text-blue-300">
                <th className="px-6 py-4">Avatar</th>
                <th className="px-6 py-4">Worker ID</th>
                <th className="px-6 py-4">Worker</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Default Vehicle</th>
                <th className="px-6 py-4">Compliance</th>
                <th className="px-6 py-4">Status</th>
                <TableActionsHeader className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr
                  key={driver.id}
                  className="group border-b border-[#D3E9FC]/55 transition-all duration-200 last:border-b-0 hover:bg-[#F5FAFF]/95 hover:shadow-[inset_0_0_0_1px_rgba(191,227,245,0.45),0_4px_14px_rgba(33,142,231,0.06)] dark:hover:bg-slate-800/40"
                >
                  <td className="px-6 py-4">
                    <WorkerProfileLink
                      driver={driver}
                      className="inline-flex rounded-full no-underline transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/45 [&>div]:cursor-pointer [&>div]:transition-all [&>div]:duration-200 hover:[&>div]:-translate-y-0.5 hover:[&>div]:ring-[#218EE7] hover:[&>div]:shadow-[0_6px_16px_rgba(33,142,231,0.16)]"
                    >
                      <WorkerAvatar
                        firstName={driver.firstName}
                        lastName={driver.lastName}
                        avatarUrl={driver.avatarUrl}
                        size="sm"
                      />
                    </WorkerProfileLink>
                  </td>
                  <td className="px-6 py-4">
                    {driver.workerCode ? (
                      <WorkerProfileLink
                        driver={driver}
                        className="inline-flex rounded-full no-underline transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/45 [&>span]:cursor-pointer [&>span]:transition-all [&>span]:duration-200 hover:[&>span]:bg-[#E8F3FE] hover:[&>span]:ring-[#89CFF0]/80"
                      >
                        <WorkerCodeBadge code={driver.workerCode} />
                      </WorkerProfileLink>
                    ) : (
                      <WorkerCodeBadge code={driver.workerCode} />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="min-w-0">
                      <WorkerProfileLink
                        driver={driver}
                        className="block max-w-full rounded-sm no-underline transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40"
                      >
                        <p className={`truncate ${adminTableEntityName} transition-colors duration-200 hover:text-[#0B68BE] dark:hover:text-blue-300`}>
                          {getDriverName(driver)}
                        </p>
                      </WorkerProfileLink>
                      <p className="mt-1 truncate text-xs font-medium text-[#5499BF]/90 dark:text-slate-400">
                        {driver.email}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <WorkerRoleBadge role={driver.role} />
                  </td>
                  <td className="px-6 py-4">
                    <p className="max-w-[180px] truncate text-sm font-medium text-[#3D7A9C] dark:text-slate-300">
                      {getWorkerDefaultVehicleLabel(driver)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <WorkerComplianceBadge driver={driver} />
                  </td>
                  <td className="px-6 py-4">
                    <DriverStatusBadge status={driver.status} />
                  </td>
                  <TableActionsCell className="px-4 py-4">
                    <div className="rounded-lg opacity-70 transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100 [&_button[aria-haspopup=menu]]:group-hover:bg-[rgba(59,130,246,0.08)] [&_button[aria-haspopup=menu]]:group-hover:text-[#0B68BE] [&_button[aria-haspopup=menu]]:group-hover:ring-1 [&_button[aria-haspopup=menu]]:group-hover:ring-[rgba(147,197,253,0.45)]">
                      <DriverRowActions
                        driver={driver}
                        onEdit={() => onEditDriver(driver)}
                        onDelete={() => onDeleteDriver(driver)}
                      />
                    </div>
                  </TableActionsCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <WorkersPagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </CardContent>
    </Card>
  )
}

function DriversLoadingSkeleton() {
  return (
    <Card className={workersTableCardClass}>
      <CardContent className="space-y-4 p-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className={`flex items-center gap-4 rounded-2xl p-4 ${adminSkeletonPulse} bg-[#F8FBFF] dark:bg-slate-800/60`}
          >
            <div className="size-11 rounded-[15px] bg-blue-100 dark:bg-slate-700/60" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-40 rounded-full bg-blue-100 dark:bg-slate-700/60" />
              <div className="h-3 w-64 max-w-full rounded-full bg-blue-50 dark:bg-slate-700/40" />
            </div>
            <div className="hidden h-8 w-24 rounded-full bg-blue-100 dark:bg-slate-700/60 sm:block" />
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
    <Card className={workersTableCardClass}>
      <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <p className={`text-lg font-semibold tracking-[-0.02em] ${adminHeadingLg}`}>
          Unable to load workers.
        </p>
        <p className={`mt-2 max-w-md text-sm font-medium ${adminTextMuted}`}>{message}</p>
        <Button
          type="button"
          onClick={onRetry}
          className={`mt-6 ${workersPrimaryButtonClass}`}
        >
          Retry
        </Button>
      </CardContent>
    </Card>
  )
}

function DriversEmptyState({ onAddDriver }: { onAddDriver: () => void }) {
  return (
    <Card className={workersTableCardClass}>
      <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className={`text-lg font-semibold tracking-[-0.02em] ${adminHeadingLg}`}>
          No workers yet
        </p>
        <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
          Add your first worker to begin.
        </p>
        <Button
          type="button"
          onClick={onAddDriver}
          className={`mt-6 ${workersPrimaryButtonClass}`}
        >
          <Plus className="size-4" />
          Add First Worker
        </Button>
      </CardContent>
    </Card>
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All')
  const [roleQuickFilter, setRoleQuickFilter] = useState<WorkerRoleQuickFilter | null>(null)
  const [companyFilter, setCompanyFilter] = useState('All')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [tablePage, setTablePage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_WORKER_PAGE_SIZE)
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)

  const loadDrivers = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const result = await driversService.fetchDrivers()
      const companyName = getGlobalCompanySettings()?.name?.trim()
      const scoped = companyName
        ? result.filter((driver) => driver.company?.trim() === companyName)
        : result

      // Deduplicate by id in case of overlapping query fallbacks
      const uniqueById = new Map(scoped.map((driver) => [driver.id, driver]))
      setDrivers([...uniqueById.values()])
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

  const roleSummaryStats = useMemo(
    () => computeWorkerRoleSummaryStats(drivers),
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
          driver.workerCode ?? '',
          driver.assignment ?? '',
        ].some((value) => value.toLowerCase().includes(query))

      const matchesStatus =
        statusFilter === 'All' || driver.status === statusFilter
      const matchesCompany =
        companyFilter === 'All' || driver.company === companyFilter
      const matchesRoleFilter =
        roleFilter === 'All' || driver.role === roleFilter
      const matchesRoleQuickFilter = workerMatchesRoleQuickFilter(
        driver.role,
        roleQuickFilter,
      )

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCompany &&
        matchesRoleFilter &&
        matchesRoleQuickFilter
      )
    })
  }, [companyFilter, drivers, roleFilter, roleQuickFilter, searchTerm, statusFilter])

  useEffect(() => {
    setTablePage(1)
  }, [searchTerm, statusFilter, roleFilter, roleQuickFilter, companyFilter, pageSize])

  const paginatedDrivers = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredDrivers.length / pageSize))
    const safePage = Math.min(tablePage, totalPages)
    const start = (safePage - 1) * pageSize
    return filteredDrivers.slice(start, start + pageSize)
  }, [filteredDrivers, pageSize, tablePage])

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

  function handleRoleQuickFilterSelect(key: WorkerRoleQuickFilter) {
    if (key === 'total') {
      setRoleQuickFilter(null)
      return
    }
    setRoleQuickFilter((current) => (current === key ? null : key))
  }

  function clearStatusFilter() {
    handleStatusFilterChange('All')
  }

  function openAddDriverModal() {
    setForm(initialDriverForm)
    setFormErrors({})
    setCreateError(null)
    setEditingDriver(null)
    resetAvatarFormState({ setAvatarFile, setRemoveAvatar, setAvatarError })
    setIsModalOpen(true)
  }

  function openEditDriverModal(driver: Driver) {
    setForm(getDriverFormValues(driver))
    setFormErrors({})
    setCreateError(null)
    setEditingDriver(driver)
    resetAvatarFormState({ setAvatarFile, setRemoveAvatar, setAvatarError })
    setIsModalOpen(true)
  }

  function openDeleteDriverModal(driver: Driver) {
    setDeleteError(null)
    setDeletingDriver(driver)
  }

  function closeAddDriverModal() {
    if (isCreating || isAvatarUploading) return

    setIsModalOpen(false)
    setEditingDriver(null)
    resetAvatarFormState({ setAvatarFile, setRemoveAvatar, setAvatarError })
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

  function handleLicenceCategoriesChange(categories: LicenceCategory[]) {
    setForm((currentForm) => ({
      ...currentForm,
      licenceCategories: categories,
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
    setAvatarError(null)

    try {
      let savedWorker: Driver

      if (editingDriver) {
        savedWorker = await driversService.updateDriver(editingDriver.id, form)
      } else {
        savedWorker = await driversService.createDriver(form)
      }

      if (avatarFile || removeAvatar) {
        setIsAvatarUploading(true)
        try {
          savedWorker = await saveWorkerAvatarForDriver(
            savedWorker,
            avatarFile,
            removeAvatar,
          )
        } catch (avatarUploadError) {
          if (import.meta.env.DEV) {
            console.error('[DriversPage] avatar upload failed:', avatarUploadError)
          }
          setAvatarError(
            'Worker saved, but the avatar upload failed. Try again from Edit Worker.',
          )
          setToastMessage(
            editingDriver
              ? 'Worker updated, but avatar upload failed.'
              : 'Worker created, but avatar upload failed.',
          )
          await loadDrivers()
          return
        } finally {
          setIsAvatarUploading(false)
        }
      }

      setIsModalOpen(false)
      setEditingDriver(null)
      setForm(initialDriverForm)
      resetAvatarFormState({ setAvatarFile, setRemoveAvatar, setAvatarError })
      await loadDrivers()
      setToastMessage(
        editingDriver
          ? 'Worker updated successfully.'
          : savedWorker.workerCode
            ? `Worker created successfully. Worker ID: ${savedWorker.workerCode}.`
            : 'Worker created successfully.',
      )
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[DriversPage] save worker failed:', error)
      }
      setCreateError(
        'Unable to save worker. Please check required fields or database setup.',
      )
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
      <section className="min-w-0 space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#218EE7]">
            Worker Management
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#113C69] sm:text-[1.75rem]">
            Workers
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5499BF]">
            Manage workers, roles, licences and compliance.
          </p>
        </header>

        <WorkersSummaryCards
          stats={roleSummaryStats}
          isLoading={isLoading}
          activeKey={roleQuickFilter ?? 'total'}
          onSelect={handleRoleQuickFilterSelect}
        />

        <div className="space-y-3">
          <DriversToolbar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
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
              drivers={paginatedDrivers}
              page={tablePage}
              pageSize={pageSize}
              totalCount={filteredDrivers.length}
              onPageChange={setTablePage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setTablePage(1)
              }}
              onEditDriver={openEditDriverModal}
              onDeleteDriver={openDeleteDriverModal}
            />
          ) : (
            <Card className={workersTableCardClass}>
              <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <p className={`text-lg font-semibold tracking-[-0.02em] ${adminHeadingLg}`}>
                  No matching records found.
                </p>
                <p className={`mt-2 max-w-md text-sm font-medium ${adminTextMuted}`}>
                  Try adjusting the search or filters.
                </p>
              </CardContent>
            </Card>
          )
        ) : null}
      </section>

      {isModalOpen ? (
        <WorkerFormModal
          eyebrow={editingDriver ? 'Edit Worker' : 'New Worker'}
          title={editingDriver ? 'Edit Worker' : 'Add Worker'}
          submitLabel={editingDriver ? 'Save Changes' : 'Create Worker'}
          form={form}
          errors={formErrors}
          submitError={createError}
          isSubmitting={isCreating}
          workerCode={editingDriver?.workerCode}
          avatarUrl={editingDriver?.avatarUrl}
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

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { ModuleListToolbar, moduleListPrimaryButtonClass } from '@/components/common/ModuleListToolbar'
import AdminLayout from '@/layouts/AdminLayout'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { WorkerFormModal } from '@/components/workers/WorkerFormModal'
import { WorkersSummaryCards } from '@/components/workers/WorkersSummaryCards'
import {
  WorkersCardGrid,
  WorkersCardGridSkeleton,
} from '@/components/workers/WorkersCardGrid'
import {
  WorkersListTable,
  WorkersListTableSkeleton,
} from '@/components/workers/WorkersListTable'
import { DEFAULT_WORKER_PAGE_SIZE } from '@/components/workers/WorkersPagination'
import { WorkersAllowanceNotice } from '@/components/workers/WorkersAllowanceNotice'
import { WorkersViewSwitcher } from '@/components/workers/WorkersViewSwitcher'
import {
  adminFilterChip,
  adminHeadingLg,
  adminPanel,
  adminSelect,
  adminTextMuted,
} from '@/lib/adminUiStyles'
import {
  buildWorkerAllowanceSnapshot,
  formatWorkerPlanLimitError,
  isWorkerPlanLimitError,
} from '@/lib/workerAllowance'
import {
  buildWorkerSlotPage,
  isActiveWorkerForPlanSlot,
} from '@/lib/workerPlanSlots'
import {
  fetchCompanyPlan,
  type CompanyPlanRecord,
} from '@/services/companyPlanService'
import {
  readWorkersViewMode,
  writeWorkersViewMode,
  type WorkersViewMode,
} from '@/lib/workersViewMode'
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

const workersPanelCardClass =
  'overflow-hidden rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF]/98 to-[#EEF6FF]/92 shadow-[0_8px_24px_rgba(33,142,231,0.1),0_0_0_1px_rgba(197,223,251,0.35)] ring-1 ring-[#C5DFFB]/45 dark:border-white/10 dark:from-slate-900/70 dark:to-slate-900/60 dark:ring-white/10'

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
  canAddWorker,
  viewMode,
  onViewModeChange,
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
  canAddWorker: boolean
  viewMode: WorkersViewMode
  onViewModeChange: (mode: WorkersViewMode) => void
}) {
  const activeFilterCount =
    (statusFilter !== 'All' ? 1 : 0) +
    (roleFilter !== 'All' ? 1 : 0) +
    (companyFilter !== 'All' ? 1 : 0)

  return (
    <ModuleListToolbar
      primaryActionLabel="Add Worker"
      onPrimaryAction={onAddDriver}
      primaryActionDisabled={!canAddWorker}
      searchValue={searchTerm}
      onSearchChange={onSearchTermChange}
      searchPlaceholder="Search workers"
      onFilterToggle={onFilterToggle}
      filterOpen={isFilterOpen}
      activeFilterCount={activeFilterCount}
      secondaryActions={
        <WorkersViewSwitcher value={viewMode} onChange={onViewModeChange} />
      }
      filterPanel={
        isFilterOpen ? (
          <div
            className={`absolute left-0 right-0 z-20 mt-3 w-full p-4 sm:left-auto sm:right-0 sm:w-[260px] ${adminPanel} shadow-[0_18px_45px_rgba(59,130,246,0.16)] ring-1 ring-blue-100 dark:ring-white/10`}
          >
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
        ) : null
      }
    />
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
    <Card className={workersPanelCardClass}>
      <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <p className={`text-lg font-semibold tracking-[-0.02em] ${adminHeadingLg}`}>
          Unable to load workers.
        </p>
        <p className={`mt-2 max-w-md text-sm font-medium ${adminTextMuted}`}>{message}</p>
        <Button
          type="button"
          onClick={onRetry}
          className={`mt-6 ${moduleListPrimaryButtonClass}`}
        >
          Retry
        </Button>
      </CardContent>
    </Card>
  )
}

function DriversEmptyState({
  onAddDriver,
  canAddWorker,
}: {
  onAddDriver: () => void
  canAddWorker: boolean
}) {
  return (
    <Card className={workersPanelCardClass}>
      <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className={`text-lg font-semibold tracking-[-0.02em] ${adminHeadingLg}`}>
          No workers yet
        </p>
        <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
          {canAddWorker
            ? 'Add your first worker to begin.'
            : 'Worker creation is blocked until a valid plan allowance is available.'}
        </p>
        <Button
          type="button"
          onClick={onAddDriver}
          disabled={!canAddWorker}
          className={`mt-6 ${moduleListPrimaryButtonClass}`}
        >
          <Plus className="size-4" />
          Add First Worker
        </Button>
      </CardContent>
    </Card>
  )
}

function ArchiveDriverModal({
  driver,
  errorMessage,
  isArchiving,
  onCancel,
  onConfirm,
}: {
  driver: Driver
  errorMessage: string | null
  isArchiving: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[20px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 dark:bg-slate-900/95 dark:ring-white/10 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-500">
          Archive Worker
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-slate-100">
          Archive this worker?
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
          {getDriverName(driver)} will be archived and will no longer occupy an
          active Worker seat. Historical records stay intact.
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
            disabled={isArchiving}
            className="h-11 rounded-[16px] border-0 bg-white px-5 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:bg-[#EAF4FF] hover:text-[#2563EB] dark:bg-slate-900/70 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-slate-800/50 dark:hover:text-blue-300"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isArchiving}
            className="h-11 rounded-[16px] bg-rose-600 px-5 font-semibold text-white shadow-[0_14px_28px_rgba(225,29,72,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-rose-700 disabled:translate-y-0 disabled:opacity-70"
          >
            {isArchiving ? 'Archiving...' : 'Archive Worker'}
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
  const { companyReady, companyId, companyLoading, membershipError } = useCompanyTenantGate()
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
  const [viewMode, setViewMode] = useState<WorkersViewMode>(() => readWorkersViewMode())
  const [gridPage, setGridPage] = useState(1)
  const [tablePage, setTablePage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_WORKER_PAGE_SIZE)
  const [companyPlan, setCompanyPlan] = useState<CompanyPlanRecord | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
  const [archivingDriver, setArchivingDriver] = useState<Driver | null>(null)
  const [form, setForm] = useState<CreateDriverForm>(initialDriverForm)
  const [formErrors, setFormErrors] = useState<DriverFormErrors>({})
  const [createError, setCreateError] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)

  const loadDrivers = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      // fetchDrivers is scoped to the verified company_id server-side.
      const result = await driversService.fetchDrivers()

      // Deduplicate by id in case of overlapping query fallbacks
      const uniqueById = new Map(result.map((driver) => [driver.id, driver]))
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
    if (!companyReady || !companyId) {
      if (!companyLoading) {
        setIsLoading(false)
        setDrivers([])
        setVehicles([])
        if (membershipError) {
          setLoadError(membershipError)
        }
      }
      return
    }

    void loadDrivers()
  }, [companyReady, companyId, companyLoading, membershipError, loadDrivers])

  useEffect(() => {
    if (!companyReady || !companyId) return

    void vehiclesService.fetchVehicles().then(setVehicles).catch(() => {
      setVehicles([])
    })
  }, [companyReady, companyId])

  useEffect(() => {
    if (!companyReady || !companyId) {
      setCompanyPlan(null)
      return
    }

    let cancelled = false
    void fetchCompanyPlan(companyId)
      .then((record) => {
        if (!cancelled) {
          setCompanyPlan(record)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompanyPlan(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [companyReady, companyId])

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

  const visibleDrivers = useMemo(
    () => drivers.filter((driver) => driver.archivedAt == null),
    [drivers],
  )

  const workerAllowance = useMemo(
    () =>
      buildWorkerAllowanceSnapshot({
        drivers,
        plan: companyPlan,
      }),
    [companyPlan, drivers],
  )

  const companyOptions = useMemo(
    () =>
      Array.from(
        new Set(visibleDrivers.map((driver) => driver.company).filter(Boolean)),
      ).sort(),
    [visibleDrivers],
  )

  const roleSummaryStats = useMemo(
    () => computeWorkerRoleSummaryStats(visibleDrivers),
    [visibleDrivers],
  )

  const filteredDrivers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return visibleDrivers.filter((driver) => {
      const vehicleLabel = getWorkerDefaultVehicleLabel(driver)
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
          vehicleLabel,
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
  }, [
    companyFilter,
    roleFilter,
    roleQuickFilter,
    searchTerm,
    statusFilter,
    visibleDrivers,
  ])

  const hasListConstraints =
    searchTerm.trim() !== '' ||
    statusFilter !== 'All' ||
    roleFilter !== 'All' ||
    companyFilter !== 'All' ||
    roleQuickFilter != null

  const activeWorkersForSlots = useMemo(
    () => drivers.filter(isActiveWorkerForPlanSlot),
    [drivers],
  )

  const slotWorkers = useMemo(() => {
    if (hasListConstraints) {
      return filteredDrivers.filter(isActiveWorkerForPlanSlot)
    }
    return activeWorkersForSlots
  }, [activeWorkersForSlots, filteredDrivers, hasListConstraints])

  useEffect(() => {
    setGridPage(1)
    setTablePage(1)
  }, [searchTerm, statusFilter, roleFilter, roleQuickFilter, companyFilter, pageSize])

  const slotPage = useMemo(
    () =>
      buildWorkerSlotPage({
        workers: slotWorkers,
        // Shared with List: company allowance, never search/filter size.
        allowance: workerAllowance.allowance,
        page: gridPage,
        constrainToWorkersOnly: hasListConstraints,
      }),
    [gridPage, hasListConstraints, slotWorkers, workerAllowance.allowance],
  )

  useEffect(() => {
    if (gridPage !== slotPage.page) {
      setGridPage(slotPage.page)
    }
  }, [gridPage, slotPage.page])

  const listPage = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredDrivers.length / pageSize))
    const page = Math.min(tablePage, totalPages)
    const start = (page - 1) * pageSize
    return {
      page,
      totalPages,
      drivers: filteredDrivers.slice(start, start + pageSize),
    }
  }, [filteredDrivers, pageSize, tablePage])

  useEffect(() => {
    if (tablePage !== listPage.page) {
      setTablePage(listPage.page)
    }
  }, [listPage.page, tablePage])

  function handleViewModeChange(mode: WorkersViewMode) {
    if (mode === viewMode) return
    setViewMode(mode)
    writeWorkersViewMode(mode)
    setGridPage(1)
    setTablePage(1)
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
    if (!workerAllowance.canAddWorker) {
      setToastMessage(workerAllowance.title || 'Worker allowance reached')
      return
    }

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

  function openArchiveDriverModal(driver: Driver) {
    setArchiveError(null)
    setArchivingDriver(driver)
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

    if (!editingDriver && !workerAllowance.canAddWorker) {
      setCreateError(
        workerAllowance.detail ??
          'Worker allowance reached. Archive an inactive Worker or change the company plan to add another Worker.',
      )
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
      if (isWorkerPlanLimitError(error)) {
        setCreateError(formatWorkerPlanLimitError(error))
      } else {
        setCreateError(
          'Unable to save worker. Please check required fields or database setup.',
        )
      }
    } finally {
      setIsCreating(false)
    }
  }

  async function handleConfirmArchiveDriver() {
    if (!archivingDriver) return

    setIsArchiving(true)
    setArchiveError(null)

    try {
      await driversService.archiveDriver(archivingDriver.id)
      setArchivingDriver(null)
      await loadDrivers()
      setToastMessage('Worker archived successfully.')
    } catch {
      setArchiveError('Unable to archive worker. Please try again.')
    } finally {
      setIsArchiving(false)
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
            canAddWorker={workerAllowance.canAddWorker}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />

          {statusFilter !== 'All' ? (
            <ActiveFilterChip
              label={`Status: ${statusFilter}`}
              onClear={clearStatusFilter}
            />
          ) : null}

          {!isLoading && !loadError ? (
            <WorkersAllowanceNotice allowance={workerAllowance} />
          ) : null}
        </div>

        {isLoading ? (
          viewMode === 'grid' ? (
            <WorkersCardGridSkeleton />
          ) : (
            <WorkersListTableSkeleton />
          )
        ) : null}

        {!isLoading && loadError ? (
          <DriversErrorState message={loadError} onRetry={loadDrivers} />
        ) : null}

        {!isLoading && !loadError && visibleDrivers.length === 0 ? (
          viewMode === 'grid' &&
          workerAllowance.allowance != null &&
          workerAllowance.canAddWorker ? (
            <WorkersCardGrid
              items={slotPage.items}
              page={slotPage.page}
              totalPages={slotPage.totalPages}
              slotFrom={slotPage.slotFrom}
              slotTo={slotPage.slotTo}
              totalSlots={slotPage.totalSlots}
              showingWorkersOnly={slotPage.showingWorkersOnly}
              canAddWorker={workerAllowance.canAddWorker}
              onPageChange={setGridPage}
              onAddWorker={openAddDriverModal}
              onEditWorker={openEditDriverModal}
              onDeleteWorker={openArchiveDriverModal}
            />
          ) : (
            <DriversEmptyState
              onAddDriver={openAddDriverModal}
              canAddWorker={workerAllowance.canAddWorker}
            />
          )
        ) : null}

        {!isLoading && !loadError && visibleDrivers.length > 0 ? (
          hasListConstraints && filteredDrivers.length === 0 ? (
            <Card className={workersPanelCardClass}>
              <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <p className={`text-lg font-semibold tracking-[-0.02em] ${adminHeadingLg}`}>
                  No Workers match your search or filters.
                </p>
                <p className={`mt-2 max-w-md text-sm font-medium ${adminTextMuted}`}>
                  {viewMode === 'grid'
                    ? 'Clear search or filters to restore the full Worker slot grid.'
                    : 'Clear search or filters to restore the Worker list.'}
                </p>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <WorkersCardGrid
              items={slotPage.items}
              page={slotPage.page}
              totalPages={slotPage.totalPages}
              slotFrom={slotPage.slotFrom}
              slotTo={slotPage.slotTo}
              totalSlots={slotPage.totalSlots}
              showingWorkersOnly={slotPage.showingWorkersOnly}
              canAddWorker={workerAllowance.canAddWorker}
              onPageChange={setGridPage}
              onAddWorker={openAddDriverModal}
              onEditWorker={openEditDriverModal}
              onDeleteWorker={openArchiveDriverModal}
            />
          ) : (
            <WorkersListTable
              drivers={listPage.drivers}
              page={listPage.page}
              pageSize={pageSize}
              totalCount={filteredDrivers.length}
              onPageChange={setTablePage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setTablePage(1)
              }}
              onEditDriver={openEditDriverModal}
              onDeleteDriver={openArchiveDriverModal}
            />
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

      {archivingDriver ? (
        <ArchiveDriverModal
          driver={archivingDriver}
          errorMessage={archiveError}
          isArchiving={isArchiving}
          onCancel={() => {
            if (isArchiving) return
            setArchivingDriver(null)
          }}
          onConfirm={handleConfirmArchiveDriver}
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

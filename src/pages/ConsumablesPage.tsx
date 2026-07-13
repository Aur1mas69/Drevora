import { CleanCurrentViewModal } from '@/components/common/CleanCurrentViewModal'
import { ConsumableDrawer } from '@/components/consumables/ConsumableDrawer'
import {
  ConsumableFormModal,
  consumableFormValuesToInput,
} from '@/components/consumables/ConsumableFormModal'
import { ConsumablesMonthlySummary } from '@/components/consumables/ConsumablesMonthlySummary'
import { ConsumablesDataTable } from '@/components/consumables/ConsumablesDataTable'
import { ConsumablesEmptyState } from '@/components/consumables/ConsumablesEmptyState'
import { ConsumablesPagination } from '@/components/consumables/ConsumablesPagination'
import {
  ConsumablesToolbar,
  DEFAULT_CONSUMABLES_FILTERS,
  type ConsumablesFilterValues,
} from '@/components/consumables/ConsumablesToolbar'
import { DeleteConsumableModal } from '@/components/consumables/DeleteConsumableModal'
import AdminLayout from '@/layouts/AdminLayout'
import type { Consumable, ConsumableFormSubmitPayload } from '@/lib/consumableTypes'
import { DEFAULT_CONSUMABLE_PAGE_SIZE } from '@/lib/consumableTypes'
import { adminHeading, adminTextMuted } from '@/lib/adminUiStyles'
import { getConsumableSummaryDateRange } from '@/lib/consumableUtils'
import {
  cleanConsumablesCurrentView,
  createConsumable,
  deleteConsumable,
  fetchConsumables,
  ConsumablesServiceError,
  updateConsumable,
} from '@/services/consumablesService'
import {
  applyConsumableReceiptChanges,
  ConsumableReceiptStorageError,
  deleteConsumableReceipt,
} from '@/services/consumableReceiptStorageService'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { fetchDrivers, type Driver } from '@/services/driversService'
import { fetchVehicles, type Vehicle } from '@/services/vehiclesService'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

function filtersAreDefault(filters: ConsumablesFilterValues): boolean {
  return (
    filters.period === DEFAULT_CONSUMABLES_FILTERS.period &&
    filters.customDateFrom === DEFAULT_CONSUMABLES_FILTERS.customDateFrom &&
    filters.customDateTo === DEFAULT_CONSUMABLES_FILTERS.customDateTo &&
    filters.vehicleId === DEFAULT_CONSUMABLES_FILTERS.vehicleId &&
    filters.chartType === DEFAULT_CONSUMABLES_FILTERS.chartType &&
    filters.viewMode === DEFAULT_CONSUMABLES_FILTERS.viewMode
  )
}

export default function ConsumablesPage() {
  const [searchParams] = useSearchParams()
  const { settings: companySettings } = useCompanySettings()
  const [items, setItems] = useState<Consumable[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [workers, setWorkers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters] = useState<ConsumablesFilterValues>(DEFAULT_CONSUMABLES_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_CONSUMABLE_PAGE_SIZE)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editRecord, setEditRecord] = useState<Consumable | null>(null)
  const [viewRecord, setViewRecord] = useState<Consumable | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<Consumable | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [summaryRefreshToken, setSummaryRefreshToken] = useState(0)
  const [isCleanCurrentViewOpen, setIsCleanCurrentViewOpen] = useState(false)
  const [isCleaningCurrentView, setIsCleaningCurrentView] = useState(false)

  const listDateRange = useMemo(() => {
    // History shows cleaned rows across periods; Current/All keep the Period filter.
    if (filters.viewMode === 'history') return { dateFrom: undefined, dateTo: undefined }
    return getConsumableSummaryDateRange(
      filters.period,
      filters.customDateFrom,
      filters.customDateTo,
    )
  }, [filters])

  const cleanScopeDateRange = useMemo(
    () =>
      getConsumableSummaryDateRange(
        filters.period,
        filters.customDateFrom,
        filters.customDateTo,
      ),
    [filters.period, filters.customDateFrom, filters.customDateTo],
  )

  const hasActiveFilters = debouncedSearch.trim().length > 0 || !filtersAreDefault(filters)

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
  }, [debouncedSearch, filters, pageSize])

  useEffect(() => {
    const vehicleId = searchParams.get('vehicle')
    if (vehicleId) {
      setFilters((current) => ({ ...current, vehicleId }))
    }
  }, [searchParams])

  const loadLookups = useCallback(async () => {
    const [loadedVehicles, loadedWorkers] = await Promise.all([fetchVehicles(), fetchDrivers()])
    setVehicles(loadedVehicles)
    setWorkers(loadedWorkers)
  }, [])

  const refreshSummary = useCallback(() => {
    setSummaryRefreshToken((current) => current + 1)
  }, [])

  const loadConsumables = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const result = await fetchConsumables({
        search: debouncedSearch,
        type: 'all',
        vehicleId: filters.vehicleId,
        dateFrom: listDateRange.dateFrom,
        dateTo: listDateRange.dateTo,
        viewMode: filters.viewMode,
        page,
        pageSize,
      })

      setItems(result.items)
      setTotalCount(result.totalCount)
      refreshSummary()
    } catch (error) {
      const message =
        error instanceof ConsumablesServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to load consumables'
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }, [
    debouncedSearch,
    filters.vehicleId,
    filters.viewMode,
    listDateRange.dateFrom,
    listDateRange.dateTo,
    page,
    pageSize,
    refreshSummary,
  ])

  useEffect(() => {
    void loadLookups().catch(() => {
      /* lookup failure handled on save */
    })
  }, [loadLookups])

  useEffect(() => {
    void loadConsumables()
  }, [loadConsumables])

  function openCreateForm() {
    setFormMode('create')
    setEditRecord(null)
    setIsFormOpen(true)
  }

  function openEditForm(record: Consumable) {
    setFormMode('edit')
    setEditRecord(record)
    setViewRecord(null)
    setIsFormOpen(true)
  }

  async function handleFormSubmit(payload: ConsumableFormSubmitPayload) {
    setIsSaving(true)

    const companyId = companySettings?.id
    if (!companyId && payload.receiptFile) {
      throw new ConsumablesServiceError(
        'Company settings are not loaded yet. Please wait and try again.',
      )
    }

    try {
      const input = consumableFormValuesToInput(
        payload.values,
        companySettings?.consumableDefaultPrices ?? {},
      )
      const existingReceiptPath = editRecord?.receiptUrl ?? null

      if (formMode === 'create') {
        const created = await createConsumable(input)

        if (companyId && payload.receiptFile) {
          const receiptPath = await applyConsumableReceiptChanges({
            companyId,
            consumableId: created.id,
            existingReceiptPath: null,
            receiptFile: payload.receiptFile,
            removeReceipt: false,
          })
          await updateConsumable(created.id, { receiptUrl: receiptPath })
        }

        showToast('Consumable record added')
      } else if (editRecord) {
        await updateConsumable(editRecord.id, input)

        if (payload.removeReceipt) {
          if (existingReceiptPath) {
            try {
              await deleteConsumableReceipt(existingReceiptPath)
            } catch {
              /* clear DB even if storage delete fails */
            }
          }
          await updateConsumable(editRecord.id, { receiptUrl: null })
        } else if (companyId && payload.receiptFile) {
          const receiptPath = await applyConsumableReceiptChanges({
            companyId,
            consumableId: editRecord.id,
            existingReceiptPath,
            receiptFile: payload.receiptFile,
            removeReceipt: false,
          })
          await updateConsumable(editRecord.id, { receiptUrl: receiptPath })
        }

        showToast('Consumable record updated')
      }

      await loadConsumables()
    } catch (error) {
      if (error instanceof ConsumableReceiptStorageError) {
        throw error
      }
      throw error instanceof ConsumablesServiceError
        ? error
        : new ConsumablesServiceError('Failed to save consumable record')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteRecord) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await deleteConsumable(deleteRecord.id)
      showToast('Consumable record deleted')
      setDeleteRecord(null)
      await loadConsumables()
    } catch (error) {
      setDeleteError(
        error instanceof ConsumablesServiceError
          ? error.message
          : 'Failed to delete consumable record',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  function applyFilters(next: ConsumablesFilterValues) {
    setFilters(next)
  }

  function resetFilters() {
    setSearchTerm('')
    setDebouncedSearch('')
    setFilters(DEFAULT_CONSUMABLES_FILTERS)
  }

  async function handleConfirmCleanCurrentView() {
    if (isCleaningCurrentView) return

    setIsCleaningCurrentView(true)
    try {
      // Scope matches Current view list filters: Period + Vehicle (not chart type / search).
      const { cleanedCount } = await cleanConsumablesCurrentView({
        dateFrom: cleanScopeDateRange.dateFrom,
        dateTo: cleanScopeDateRange.dateTo,
        vehicleId: filters.vehicleId,
      })

      if (cleanedCount === 0) {
        showToast('No active consumable entries were cleaned.')
        return
      }

      resetFilters()
      setPage(1)
      setIsCleanCurrentViewOpen(false)
      await loadConsumables()
      showToast(
        cleanedCount === 1
          ? '1 consumable entry moved to History'
          : `${cleanedCount} consumable entries moved to History`,
      )
    } catch (error) {
      showToast(
        error instanceof ConsumablesServiceError
          ? error.message
          : 'Unable to clean consumables current view.',
      )
    } finally {
      setIsCleaningCurrentView(false)
    }
  }

  return (
    <AdminLayout premiumBackground wideContent>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#218EE7]">
            Fleet operations
          </p>
          <h1 className={`mt-2 text-3xl font-semibold tracking-[-0.03em] ${adminHeading}`}>
            Consumables
          </h1>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${adminTextMuted}`}>
            Track fuel, AdBlue, oils, screenwash, hydraulic oil, admixtures and other vehicle
            consumables.
          </p>
        </div>

        <ConsumablesToolbar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          filters={filters}
          vehicles={vehicles}
          hasActiveFilters={hasActiveFilters}
          onApplyFilters={applyFilters}
          onResetFilters={resetFilters}
          onCleanCurrentView={() => setIsCleanCurrentViewOpen(true)}
          onNewRecord={openCreateForm}
        />

        <ConsumablesMonthlySummary
          filters={filters}
          refreshToken={summaryRefreshToken}
        />

        {loadError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {loadError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-[#D3E9FC] bg-white/80 px-4 py-10 text-center text-sm font-medium text-[#3D7A9C] shadow-sm">
            Loading consumables…
          </div>
        ) : items.length === 0 ? (
          <ConsumablesEmptyState
            hasActiveFilters={hasActiveFilters}
            onCreateFirst={openCreateForm}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#D3E9FC] bg-white/80 shadow-sm">
            <ConsumablesDataTable
              items={items}
              onView={setViewRecord}
              onEdit={openEditForm}
              onDelete={setDeleteRecord}
            />
            <ConsumablesPagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {toastMessage ? (
        <div className="fixed bottom-5 right-5 z-[70] rounded-xl bg-[#113C69] px-4 py-3 text-sm font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}

      <ConsumableFormModal
        isOpen={isFormOpen}
        mode={formMode}
        record={editRecord}
        vehicles={vehicles}
        workers={workers}
        isSaving={isSaving}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <ConsumableDrawer
        record={viewRecord}
        isOpen={Boolean(viewRecord)}
        onClose={() => setViewRecord(null)}
        onEdit={openEditForm}
      />

      {deleteRecord ? (
        <DeleteConsumableModal
          record={deleteRecord}
          errorMessage={deleteError}
          isDeleting={isDeleting}
          onCancel={() => {
            if (!isDeleting) {
              setDeleteRecord(null)
              setDeleteError(null)
            }
          }}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}

      <CleanCurrentViewModal
        open={isCleanCurrentViewOpen}
        title="Clean consumables current view?"
        description="Consumable entries will be removed from the Current view and kept in History. No records will be permanently deleted."
        confirmLabel="Clean current view"
        confirming={isCleaningCurrentView}
        onCancel={() => {
          if (!isCleaningCurrentView) setIsCleanCurrentViewOpen(false)
        }}
        onConfirm={() => void handleConfirmCleanCurrentView()}
      />
    </AdminLayout>
  )
}

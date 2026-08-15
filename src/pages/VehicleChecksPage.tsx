import { CreateVehicleCheckCorrectionModal } from '@/components/vehicle-checks/CreateVehicleCheckCorrectionModal'
import { DeleteVehicleCheckModal } from '@/components/vehicle-checks/DeleteVehicleCheckModal'
import { EditVehicleCheckModal } from '@/components/vehicle-checks/EditVehicleCheckModal'
import { NewVehicleCheckModal } from '@/components/vehicle-checks/NewVehicleCheckModal'
import { ReviewVehicleCheckDefectsModal } from '@/components/vehicle-checks/ReviewVehicleCheckDefectsModal'
import { TyreCheckPanel } from '@/components/vehicle-checks/TyreCheckPanel'
import { VehicleCheckDrawer } from '@/components/vehicle-checks/VehicleCheckDrawer'
import { VehicleChecksDataTable } from '@/components/vehicle-checks/VehicleChecksDataTable'
import { VehicleChecksEmptyState } from '@/components/vehicle-checks/VehicleChecksEmptyState'
import {
  VehicleChecksModuleTabs,
  type VehicleChecksModuleTab,
} from '@/components/vehicle-checks/VehicleChecksModuleTabs'
import { VehicleChecksPagination } from '@/components/vehicle-checks/VehicleChecksPagination'
import {
  VehicleChecksSummaryCards,
  type VehicleChecksKpiFilter,
} from '@/components/vehicle-checks/VehicleChecksSummaryCards'
import { VehicleChecksToolbar } from '@/components/vehicle-checks/VehicleChecksToolbar'
import { ExportMenu } from '@/components/export/ExportMenu'
import AdminLayout from '@/layouts/AdminLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import {
  DEFAULT_EXPORT_DATE_RANGE,
  resolveExportDateRange,
  type ExportDateRangeSelection,
} from '@/lib/export/exportDateRange'
import { toExportUserMessage } from '@/lib/export/exportErrors'
import { resolveExportMeta } from '@/lib/export/exportMeta'
import {
  downloadFilteredVehicleCheckFilesZip,
  downloadVehicleCheckAttachments,
  downloadVehicleCheckPdf,
  exportVehicleChecksCsv,
  exportVehicleChecksFilteredPdfs,
} from '@/lib/export/modules/vehicleChecksExport'
import { isVehicleCheckEditable } from '@/lib/vehicleCheckUtils'
import type {
  SaveVehicleCheckDefectReviewInput,
  VehicleCheck,
  VehicleCheckListItem,
  VehicleCheckOdometerUnit,
  VehicleCheckResultFilter,
  VehicleCheckReviewStatusFilter,
  VehicleCheckStatusFilter,
  VehicleCheckSummaryStats,
} from '@/lib/vehicleCheckTypes'
import { DEFAULT_VEHICLE_CHECK_PAGE_SIZE } from '@/lib/vehicleCheckTypes'
import type { VehicleCheckTrailerWriteFields } from '@/lib/vehicleCheckTrailerAttachment'
import { fetchDrivers, type Driver } from '@/services/driversService'
import {
  createVehicleCheck,
  createVehicleCheckCorrection,
  deleteVehicleCheck,
  fetchVehicleCheckById,
  fetchVehicleCheckCorrections,
  fetchVehicleChecks,
  saveVehicleCheckDefectReview,
  updateVehicleCheck,
  VehicleChecksServiceError,
} from '@/services/vehicleChecksService'
import { fetchVehicles, type Vehicle } from '@/services/vehiclesService'
import { getCurrentViewToday } from '@/lib/currentViewVisibility'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

function parseVehicleChecksModuleTab(value: string | null): VehicleChecksModuleTab {
  return value === 'tyre-check' ? 'tyre-check' : 'vehicle-checks'
}

export default function VehicleChecksPage() {
  const { companyName, settings, formatDate, weekStarts, timezone } = useCompanySettings()
  const { session } = useAuth()
  const { companyReady, companyId, companyLoading, membershipError } = useCompanyTenantGate()
  const [searchParams, setSearchParams] = useSearchParams()
  const moduleTab = parseVehicleChecksModuleTab(searchParams.get('tab'))

  function handleModuleTabChange(tab: VehicleChecksModuleTab) {
    const next = new URLSearchParams(searchParams)
    if (tab === 'tyre-check') {
      next.set('tab', 'tyre-check')
    } else {
      next.delete('tab')
      next.delete('section')
      next.delete('tyre_check_id')
    }
    setSearchParams(next, { replace: true })
  }
  const [items, setItems] = useState<VehicleCheckListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [exportDateRange, setExportDateRange] =
    useState<ExportDateRangeSelection>(DEFAULT_EXPORT_DATE_RANGE)
  const [stats, setStats] = useState<VehicleCheckSummaryStats>({
    totalChecks: 0,
    checksToday: 0,
    passedToday: 0,
    defectsFoundToday: 0,
    awaitingReview: 0,
    defectItemsReported: 0,
  })
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<VehicleCheckStatusFilter>('all')
  const [resultFilter, setResultFilter] = useState<VehicleCheckResultFilter>('all')
  const [reviewStatusFilter, setReviewStatusFilter] =
    useState<VehicleCheckReviewStatusFilter>('all')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [workerFilter, setWorkerFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState(() => getCurrentViewToday())
  const [dateTo, setDateTo] = useState(() => getCurrentViewToday())
  const [activeKpiFilter, setActiveKpiFilter] = useState<VehicleChecksKpiFilter>('checksToday')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_VEHICLE_CHECK_PAGE_SIZE)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [viewCheck, setViewCheck] = useState<VehicleCheck | null>(null)
  const [viewCorrections, setViewCorrections] = useState<VehicleCheckListItem[]>([])
  const [editCheck, setEditCheck] = useState<VehicleCheck | null>(null)
  const [reviewCheck, setReviewCheck] = useState<VehicleCheck | null>(null)
  const [correctionSource, setCorrectionSource] =
    useState<VehicleCheckListItem | null>(null)
  const [correctionError, setCorrectionError] = useState<string | null>(null)
  const [deletingCheck, setDeletingCheck] = useState<VehicleCheckListItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [downloadingCheckId, setDownloadingCheckId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 ||
    statusFilter !== 'all' ||
    resultFilter !== 'all' ||
    reviewStatusFilter !== 'all' ||
    vehicleFilter !== 'all' ||
    workerFilter !== 'all' ||
    dateFrom.length > 0 ||
    dateTo.length > 0

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2800)
  }, [])

  const resolvedExportDateRange = useMemo(
    () =>
      resolveExportDateRange(exportDateRange, {
        weekStarts,
        timeZone: timezone,
        formatDate,
      }),
    [exportDateRange, formatDate, timezone, weekStarts],
  )

  const exportQuery = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: statusFilter,
      result: resultFilter,
      reviewStatus: reviewStatusFilter,
      vehicleId: vehicleFilter,
      workerId: workerFilter,
      dateFrom: resolvedExportDateRange.dateFrom,
      dateTo: resolvedExportDateRange.dateTo,
    }),
    [
      debouncedSearch,
      statusFilter,
      resultFilter,
      reviewStatusFilter,
      vehicleFilter,
      workerFilter,
      resolvedExportDateRange.dateFrom,
      resolvedExportDateRange.dateTo,
    ],
  )

  const exportMeta = useMemo(
    () =>
      resolveExportMeta({
        companyName,
        logoUrl: settings?.logoUrl,
        generatedBy: session?.user.email ?? null,
        documentTitle: 'Vehicle Checks',
        filterSummary: `Date ${resolvedExportDateRange.label}`,
      }),
    [companyName, resolvedExportDateRange.label, session?.user.email, settings?.logoUrl],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), 250)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
  }, [
    dateFrom,
    dateTo,
    debouncedSearch,
    pageSize,
    resultFilter,
    reviewStatusFilter,
    statusFilter,
    vehicleFilter,
    workerFilter,
  ])

  const loadReferenceData = useCallback(async () => {
    const [loadedVehicles, loadedDrivers] = await Promise.all([
      fetchVehicles(),
      fetchDrivers(),
    ])
    setVehicles(loadedVehicles)
    setDrivers(loadedDrivers)
  }, [])

  const loadChecks = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const result = await fetchVehicleChecks({
        search: debouncedSearch,
        status: statusFilter,
        result: resultFilter,
        reviewStatus: reviewStatusFilter,
        vehicleId: vehicleFilter,
        workerId: workerFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize,
      })

      setItems(result.items)
      setTotalCount(result.totalCount)
      setStats(result.stats)
    } catch (error) {
      const message =
        error instanceof VehicleChecksServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to load vehicle checks'
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }, [
    dateFrom,
    dateTo,
    debouncedSearch,
    page,
    pageSize,
    resultFilter,
    reviewStatusFilter,
    statusFilter,
    vehicleFilter,
    workerFilter,
  ])

  useEffect(() => {
    if (!companyReady || !companyId) {
      if (!companyLoading) {
        setVehicles([])
        setDrivers([])
      }
      return
    }

    void loadReferenceData().catch(() => {
      /* reference data errors surface on create */
    })
  }, [companyReady, companyId, companyLoading, loadReferenceData])

  useEffect(() => {
    if (!companyReady || !companyId) {
      if (!companyLoading) {
        setIsLoading(false)
        setItems([])
        setTotalCount(0)
        if (membershipError) {
          setLoadError(membershipError)
        }
      }
      return
    }

    void loadChecks()
  }, [companyReady, companyId, companyLoading, membershipError, loadChecks])

  async function openCheckDetail(id: string, mode: 'view' | 'edit') {
    setIsLoadingDetail(true)
    try {
      const detail = await fetchVehicleCheckById(id)
      if (!detail) {
        showToast('Inspection not found')
        return
      }

      if (mode === 'edit') {
        if (!isVehicleCheckEditable(detail)) {
          showToast('Completed Vehicle Checks are read-only. Create a correction to amend.')
          setViewCheck(detail)
          if (!detail.originalCheckId) {
            try {
              setViewCorrections(await fetchVehicleCheckCorrections(detail.id))
            } catch {
              setViewCorrections([])
            }
          } else {
            setViewCorrections([])
          }
          return
        }
        setEditCheck(detail)
        return
      }

      setViewCheck(detail)
      if (!detail.originalCheckId) {
        try {
          setViewCorrections(await fetchVehicleCheckCorrections(detail.id))
        } catch {
          setViewCorrections([])
        }
      } else {
        setViewCorrections([])
      }
    } catch (error) {
      const message =
        error instanceof VehicleChecksServiceError
          ? error.message
          : 'Failed to load inspection'
      showToast(message)
    } finally {
      setIsLoadingDetail(false)
    }
  }

  async function handleCreateCorrection(reason: string) {
    if (!correctionSource) return

    setIsSaving(true)
    setCorrectionError(null)
    try {
      const correction = await createVehicleCheckCorrection({
        originalCheckId: correctionSource.id,
        reason,
      })
      setCorrectionSource(null)
      setViewCheck(null)
      setViewCorrections([])
      showToast('Correction created')
      await loadChecks()
      setEditCheck(correction)
    } catch (error) {
      const message =
        error instanceof VehicleChecksServiceError
          ? error.message
          : 'Failed to create correction'
      setCorrectionError(message)
    } finally {
      setIsSaving(false)
    }
  }

  function clearFilters() {
    setSearchTerm('')
    setDebouncedSearch('')
    setStatusFilter('all')
    setResultFilter('all')
    setReviewStatusFilter('all')
    setVehicleFilter('all')
    setWorkerFilter('all')
    setDateFrom('')
    setDateTo('')
    setActiveKpiFilter(null)
  }

  function handleKpiFilterChange(value: VehicleChecksKpiFilter) {
    setActiveKpiFilter(value)
    setSearchTerm('')
    setDebouncedSearch('')
    setVehicleFilter('all')
    setWorkerFilter('all')

    if (!value) {
      setStatusFilter('all')
      setResultFilter('all')
      setReviewStatusFilter('all')
      setDateFrom('')
      setDateTo('')
      return
    }

    setDateFrom(getCurrentViewToday())
    setDateTo(getCurrentViewToday())
    setStatusFilter('all')
    setReviewStatusFilter('all')

    if (value === 'passedToday') {
      setResultFilter('Pass')
    } else if (value === 'defectsFound') {
      setResultFilter('Advisory')
    } else if (value === 'awaitingReview') {
      setResultFilter('all')
      setReviewStatusFilter('awaiting_review')
      setDateFrom('')
      setDateTo('')
    } else {
      setResultFilter('all')
    }
  }

  async function openReviewDefects(id: string) {
    setIsLoadingDetail(true)
    try {
      const detail = await fetchVehicleCheckById(id)
      if (!detail) {
        showToast('Inspection not found')
        return
      }
      if (detail.defectCount <= 0) {
        showToast('This inspection has no defects to review')
        return
      }
      setReviewCheck(detail)
    } catch (error) {
      const message =
        error instanceof VehicleChecksServiceError
          ? error.message
          : 'Failed to load inspection'
      showToast(message)
    } finally {
      setIsLoadingDetail(false)
    }
  }

  async function handleSaveDefectReview(input: SaveVehicleCheckDefectReviewInput) {
    if (!reviewCheck) return
    setIsSaving(true)
    try {
      await saveVehicleCheckDefectReview(reviewCheck.id, input)
      setReviewCheck(null)
      showToast('Review decision saved')
      await loadChecks()
      await loadReferenceData()
    } catch (error) {
      throw error instanceof VehicleChecksServiceError
        ? error
        : new VehicleChecksServiceError('Failed to save review decision')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreate(input: {
    vehicleId: string
    workerId: string
    inspectionDate: string
    odometer: number
    odometerUnit: VehicleCheckOdometerUnit
    notes: string
    signatureFile: File
    inspectionStartedAt: string
    items: Parameters<typeof createVehicleCheck>[0]['items']
  } & VehicleCheckTrailerWriteFields) {
    setIsSaving(true)
    try {
      await createVehicleCheck({
        vehicleId: input.vehicleId,
        workerId: input.workerId,
        inspectionDate: input.inspectionDate,
        odometer: input.odometer,
        odometerUnit: input.odometerUnit,
        notes: input.notes,
        signatureFile: input.signatureFile,
        inspectionStartedAt: input.inspectionStartedAt,
        items: input.items,
        trailerSource: input.trailerSource,
        trailerVehicleId: input.trailerVehicleId,
        trailerNumberSnapshot: input.trailerNumberSnapshot,
        trailerRegistrationSnapshot: input.trailerRegistrationSnapshot,
        trailerLabelSnapshot: input.trailerLabelSnapshot,
      })
      showToast('Inspection saved')
      await loadChecks()
    } catch (error) {
      throw error instanceof VehicleChecksServiceError
        ? error
        : new VehicleChecksServiceError('Failed to save inspection')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdate(input: {
    vehicleId: string
    workerId: string
    inspectionDate: string
    odometer: number | null
    status: VehicleCheck['status']
    notes: string
    items: Parameters<typeof updateVehicleCheck>[1]['items']
  }) {
    if (!editCheck) return

    setIsSaving(true)
    try {
      await updateVehicleCheck(editCheck.id, {
        vehicleId: input.vehicleId,
        workerId: input.workerId,
        inspectionDate: input.inspectionDate,
        odometer: input.odometer,
        status: input.status,
        notes: input.notes,
        items: input.items,
      })
      showToast('Inspection updated')
      setEditCheck(null)
      await loadChecks()
    } catch (error) {
      throw error instanceof VehicleChecksServiceError
        ? error
        : new VehicleChecksServiceError('Failed to update inspection')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deletingCheck) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await deleteVehicleCheck(deletingCheck.id)

      if (viewCheck?.id === deletingCheck.id) setViewCheck(null)
      if (editCheck?.id === deletingCheck.id) setEditCheck(null)
      if (reviewCheck?.id === deletingCheck.id) setReviewCheck(null)

      setDeletingCheck(null)
      showToast('Vehicle check deleted')
      await loadChecks()
    } catch (error) {
      const message =
        error instanceof VehicleChecksServiceError
          ? error.message
          : 'Unable to delete vehicle check. Please try again.'
      setDeleteError(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const today = getCurrentViewToday()
  const isTodayView =
    debouncedSearch.trim().length === 0 &&
    statusFilter === 'all' &&
    resultFilter === 'all' &&
    vehicleFilter === 'all' &&
    workerFilter === 'all' &&
    dateFrom === today &&
    dateTo === today
  const showNoRecordsState = !isLoading && !loadError && totalCount === 0 && stats.totalChecks === 0
  const showNoTodayState =
    !isLoading && !loadError && totalCount === 0 && stats.totalChecks > 0 && isTodayView

  return (
    <AdminLayout>
      <div className="space-y-4">
        <VehicleChecksModuleTabs
          activeTab={moduleTab}
          onTabChange={handleModuleTabChange}
        />

        {moduleTab === 'tyre-check' ? (
          <TyreCheckPanel vehicles={vehicles} drivers={drivers} />
        ) : (
          <>
        <header>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#2A376F]">
            Vehicle Checks
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage daily vehicle inspections and defect reports.
          </p>
        </header>

        <VehicleChecksSummaryCards
          stats={stats}
          activeFilter={activeKpiFilter}
          onFilterChange={handleKpiFilterChange}
        />

        <VehicleChecksToolbar
          searchTerm={searchTerm}
          onSearchTermChange={(value) => {
            setSearchTerm(value)
            setActiveKpiFilter(null)
          }}
          statusFilter={statusFilter}
          onStatusFilterChange={(value) => {
            setStatusFilter(value)
            setActiveKpiFilter(null)
          }}
          resultFilter={resultFilter}
          onResultFilterChange={(value) => {
            setResultFilter(value)
            setActiveKpiFilter(null)
          }}
          reviewStatusFilter={reviewStatusFilter}
          onReviewStatusFilterChange={(value) => {
            setReviewStatusFilter(value)
            setActiveKpiFilter(null)
          }}
          vehicleFilter={vehicleFilter}
          onVehicleFilterChange={(value) => {
            setVehicleFilter(value)
            setActiveKpiFilter(null)
          }}
          workerFilter={workerFilter}
          onWorkerFilterChange={(value) => {
            setWorkerFilter(value)
            setActiveKpiFilter(null)
          }}
          dateFrom={dateFrom}
          onDateFromChange={(value) => {
            setDateFrom(value)
            setActiveKpiFilter(null)
          }}
          dateTo={dateTo}
          onDateToChange={(value) => {
            setDateTo(value)
            setActiveKpiFilter(null)
          }}
          vehicles={vehicles}
          workers={drivers}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          onNewCheck={() => setIsNewModalOpen(true)}
          secondaryActions={
            <ExportMenu
              busy={isExporting}
              disabled={isLoading}
              dateRange={exportDateRange}
              onDateRangeChange={setExportDateRange}
              actions={[
                {
                  id: 'csv',
                  label: 'Export list (.csv)',
                  disabled: totalCount === 0,
                  onSelect: async () => {
                    setIsExporting(true)
                    try {
                      await exportVehicleChecksCsv(exportQuery)
                      showToast('Exported vehicle checks list')
                    } catch (error) {
                      showToast(toExportUserMessage(error))
                    } finally {
                      setIsExporting(false)
                    }
                  },
                },
                {
                  id: 'pdf-zip',
                  label: 'Download PDFs (.zip)',
                  disabled: totalCount === 0,
                  onSelect: async () => {
                    setIsExporting(true)
                    try {
                      await exportVehicleChecksFilteredPdfs(exportQuery, exportMeta)
                      showToast(
                        totalCount === 1
                          ? 'Exported vehicle check to PDF'
                          : 'Exported vehicle checks to ZIP',
                      )
                    } catch (error) {
                      showToast(toExportUserMessage(error))
                    } finally {
                      setIsExporting(false)
                    }
                  },
                },
                {
                  id: 'zip',
                  label: 'Download files (.zip)',
                  disabled: totalCount === 0,
                  onSelect: async () => {
                    setIsExporting(true)
                    try {
                      await downloadFilteredVehicleCheckFilesZip(exportQuery)
                      showToast('Downloaded vehicle check files')
                    } catch (error) {
                      showToast(toExportUserMessage(error))
                    } finally {
                      setIsExporting(false)
                    }
                  },
                },
              ]}
            />
          }
        />

        {loadError ? (
          <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-[0_2px_8px_rgba(40,80,140,0.04)] dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-400 dark:shadow-black/20">
            Loading inspections…
          </div>
        ) : showNoRecordsState ? (
          <VehicleChecksEmptyState onCreateFirst={() => setIsNewModalOpen(true)} />
        ) : showNoTodayState ? (
          <div className="rounded-[18px] border border-[#D3E9FC] bg-white px-6 py-10 text-center shadow-[0_10px_30px_rgba(33,142,231,0.08)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100">
              No checks completed today.
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Change the date range or clear the date filters to view previous checks.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white px-6 py-10 text-center shadow-[0_2px_8px_rgba(40,80,140,0.04)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100">
              No matching inspections
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div>
            <VehicleChecksDataTable
              checks={items}
              onView={(check) => void openCheckDetail(check.id, 'view')}
              onEdit={(check) => void openCheckDetail(check.id, 'edit')}
              onReviewDefects={(check) => void openReviewDefects(check.id)}
              onCreateCorrection={(check) => {
                setCorrectionError(null)
                setCorrectionSource(check)
              }}
              onOpenOriginal={(originalCheckId) => {
                void openCheckDetail(originalCheckId, 'view')
              }}
              onOpenLatestCorrection={(correctionId) => {
                void openCheckDetail(correctionId, 'view')
              }}
              onOpenCorrectionHistory={(check) => {
                void openCheckDetail(check.id, 'view')
              }}
              onDelete={(check) => {
                setDeleteError(null)
                setDeletingCheck(check)
              }}
            />
            <VehicleChecksPagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
          </>
        )}
      </div>

      <NewVehicleCheckModal
        isOpen={isNewModalOpen}
        vehicles={vehicles}
        drivers={drivers}
        isSaving={isSaving}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleCreate}
      />

      <EditVehicleCheckModal
        check={editCheck}
        isOpen={editCheck !== null}
        vehicles={vehicles}
        drivers={drivers}
        isSaving={isSaving}
        onClose={() => setEditCheck(null)}
        onSubmit={handleUpdate}
      />

      <VehicleCheckDrawer
        check={viewCheck}
        isOpen={viewCheck !== null}
        isDownloadingPdf={isDownloadingPdf}
        isDownloadingFiles={
          Boolean(viewCheck && downloadingCheckId === viewCheck.id)
        }
        corrections={viewCorrections}
        onClose={() => {
          setViewCheck(null)
          setViewCorrections([])
        }}
        onEdit={() => {
          if (!viewCheck || !isVehicleCheckEditable(viewCheck)) return
          setEditCheck(viewCheck)
          setViewCheck(null)
          setViewCorrections([])
        }}
        onCreateCorrection={() => {
          if (!viewCheck) return
          setCorrectionError(null)
          setCorrectionSource(viewCheck)
        }}
        onViewCorrection={(correctionId) => {
          void openCheckDetail(correctionId, 'view')
        }}
        onViewOriginal={(originalCheckId) => {
          void openCheckDetail(originalCheckId, 'view')
        }}
        onDownloadFiles={() => {
          if (!viewCheck || downloadingCheckId) return
          setDownloadingCheckId(viewCheck.id)
          void downloadVehicleCheckAttachments(viewCheck)
            .then(() => showToast('Downloaded vehicle check files'))
            .catch((error) => showToast(toExportUserMessage(error)))
            .finally(() => setDownloadingCheckId(null))
        }}
        onDownloadPdf={() => {
          if (!viewCheck) return
          setIsDownloadingPdf(true)
          void downloadVehicleCheckPdf(viewCheck, {
            ...exportMeta,
            documentTitle: 'Vehicle Check',
          })
            .then(() => showToast('Exported vehicle check to PDF'))
            .catch((error) => showToast(toExportUserMessage(error)))
            .finally(() => setIsDownloadingPdf(false))
        }}
      />

      <CreateVehicleCheckCorrectionModal
        check={correctionSource}
        isOpen={correctionSource !== null}
        isSaving={isSaving}
        errorMessage={correctionError}
        onClose={() => {
          if (isSaving) return
          setCorrectionSource(null)
          setCorrectionError(null)
        }}
        onConfirm={(reason) => {
          void handleCreateCorrection(reason)
        }}
      />

      <ReviewVehicleCheckDefectsModal
        check={reviewCheck}
        isOpen={reviewCheck !== null}
        isSaving={isSaving}
        onClose={() => {
          if (isSaving) return
          setReviewCheck(null)
        }}
        onSave={handleSaveDefectReview}
      />

      {deletingCheck ? (
        <DeleteVehicleCheckModal
          check={deletingCheck}
          errorMessage={deleteError}
          isDeleting={isDeleting}
          onCancel={() => {
            if (isDeleting) return
            setDeletingCheck(null)
            setDeleteError(null)
          }}
          onConfirm={() => void handleConfirmDelete()}
        />
      ) : null}

      {isLoadingDetail ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px]">
          <div className="rounded-[12px] bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-lg dark:bg-slate-900/95 dark:text-slate-200 dark:shadow-black/40">
            Loading inspection…
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[60] rounded-[12px] bg-[#2A376F] px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </AdminLayout>
  )
}

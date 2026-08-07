import { timesheetKpiVisualStyles } from '@/components/timesheets/timesheetSummaryKpiStyles'
import { AxleLayoutEditor } from '@/components/vehicle-checks/AxleLayoutEditor'
import { CorrectTyreCheckModal } from '@/components/vehicle-checks/CorrectTyreCheckModal'
import { DeleteTyreCheckModal } from '@/components/vehicle-checks/DeleteTyreCheckModal'
import { TyreCheckAdminReport } from '@/components/vehicle-checks/TyreCheckAdminReport'
import { TyreCheckAdminSectionTabs } from '@/components/vehicle-checks/TyreCheckAdminSectionTabs'
import { TyreCheckDiagram } from '@/components/vehicle-checks/TyreCheckDiagram'
import { TyreChecksPagination } from '@/components/vehicle-checks/TyreChecksPagination'
import { TyreChecksToolbar } from '@/components/vehicle-checks/TyreChecksToolbar'
import { ExportMenu } from '@/components/export/ExportMenu'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { toExportUserMessage } from '@/lib/export/exportErrors'
import { resolveExportMeta } from '@/lib/export/exportMeta'
import {
  downloadTyreCheckPdfById,
  exportTyreChecksExcel,
  exportTyreChecksFilteredPdfs,
} from '@/lib/export/modules/tyreChecksExport'
import {
  adminHeading,
  adminPanel,
  adminSelect,
  adminTableEntityName,
  adminTableHeader,
  adminTableRow,
  adminTableShell,
  adminTextMuted,
} from '@/lib/adminUiStyles'
import { getCurrentViewToday } from '@/lib/currentViewVisibility'
import {
  buildTyreLayout,
  DEFAULT_TRUCK_AXLE_COUNT,
  DEFAULT_TYRE_CHECK_PAGE_SIZE,
  MAX_TYRE_CHECK_PAGE_SIZE,
  formatAxleCountLabel,
  formatTyreCheckResultLabel,
  MAX_COMBINED_TYRE_AXLES,
  resizeAxleWheelLayouts,
  resolveFallbackTrailerAxleWheelLayouts,
  resolveFallbackTruckAxleWheelLayouts,
  type AxleWheelLayout,
  type SavedTyreCheck,
  type TyreCheckAdminOverviewStats,
  type TyreCheckAdminSection,
  type TyreCheckDefectFocusFilter,
  type TyreCheckListItem,
  type TyreCheckResultFilter,
} from '@/lib/tyreCheckTypes'
import { cn } from '@/lib/utils'
import type { Driver } from '@/services/driversService'
import {
  applyTyreCheckCorrection,
  fetchTyreCheckAdminOverview,
  fetchTyreCheckDetail,
  fetchTyreChecks,
  softDeleteTyreCheck,
  TyreChecksServiceError,
} from '@/services/tyreChecksService'
import {
  fetchVehicleTyreLayout,
  saveVehicleTyreLayout,
} from '@/services/vehicleTyreLayoutsService'
import type { Vehicle } from '@/services/vehiclesService'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  Loader2,
  Pencil,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'

type TyreCheckPanelProps = {
  vehicles: Vehicle[]
  drivers: Driver[]
}

function vehicleLabel(vehicle: Vehicle): string {
  return (
    vehicle.registration?.trim() ||
    vehicle.fleetNumber?.trim() ||
    vehicle.id.slice(0, 8)
  )
}

function isTrailerVehicle(vehicle: Vehicle): boolean {
  const type = vehicle.vehicleType?.toLowerCase() ?? ''
  return type.includes('trailer') || type.includes('low loader')
}

function parseAdminSection(value: string | null): TyreCheckAdminSection {
  if (value === 'configuration' || value === 'history' || value === 'overview') {
    return value
  }
  return 'overview'
}

export function TyreCheckPanel({ vehicles, drivers }: TyreCheckPanelProps) {
  const { companyName, settings } = useCompanySettings()
  const { session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = parseAdminSection(searchParams.get('section'))

  const tractorVehicles = useMemo(
    () => vehicles.filter((vehicle) => !isTrailerVehicle(vehicle)),
    [vehicles],
  )
  const trailerVehicles = useMemo(
    () => vehicles.filter((vehicle) => isTrailerVehicle(vehicle)),
    [vehicles],
  )

  const [overview, setOverview] = useState<TyreCheckAdminOverviewStats | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  const [historyItems, setHistoryItems] = useState<TyreCheckListItem[]>([])
  const [historyTotalCount, setHistoryTotalCount] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [resultFilter, setResultFilter] = useState<TyreCheckResultFilter>('all')
  const [defectFocus, setDefectFocus] = useState<TyreCheckDefectFocusFilter>('all')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [workerFilter, setWorkerFilter] = useState('all')
  const [trailerFilter, setTrailerFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_TYRE_CHECK_PAGE_SIZE)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [viewingCheck, setViewingCheck] = useState<SavedTyreCheck | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [correctModalOpen, setCorrectModalOpen] = useState(false)
  const [isSavingCorrection, setIsSavingCorrection] = useState(false)
  const [correctionError, setCorrectionError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TyreCheckListItem | null>(null)
  const [isSavingDelete, setIsSavingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const detailReportRef = useRef<HTMLDivElement>(null)

  useBodyScrollLock(
    Boolean(viewingCheck) || correctModalOpen || Boolean(deleteTarget),
  )

  useEffect(() => {
    if (!viewingCheck) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDownloadingPdf) {
        setViewingCheck(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewingCheck, isDownloadingPdf])

  const hasActiveHistoryFilters =
    debouncedSearch.trim().length > 0 ||
    resultFilter !== 'all' ||
    defectFocus !== 'all' ||
    vehicleFilter !== 'all' ||
    workerFilter !== 'all' ||
    trailerFilter !== 'all' ||
    dateFrom.length > 0 ||
    dateTo.length > 0

  const historyExpanded = activeSection === 'history'
  const showOverviewWorkspace =
    activeSection === 'overview' || activeSection === 'history'

  function setSection(section: TyreCheckAdminSection) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'tyre-check')
    if (section === 'overview') {
      next.delete('section')
    } else {
      next.set('section', section)
    }
    setSearchParams(next, { replace: true })
  }

  function openFullHistory(options?: {
    defectFocus?: TyreCheckDefectFocusFilter
    result?: TyreCheckResultFilter
  }) {
    if (options?.defectFocus) setDefectFocus(options.defectFocus)
    if (options?.result) setResultFilter(options.result)
    setPage(1)
    setSection('history')
  }

  function showToast(message: string) {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2800)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
  }, [
    debouncedSearch,
    resultFilter,
    defectFocus,
    vehicleFilter,
    workerFilter,
    trailerFilter,
    dateFrom,
    dateTo,
    pageSize,
  ])

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true)
    setOverviewError(null)
    try {
      const stats = await fetchTyreCheckAdminOverview(vehicles, getCurrentViewToday())
      setOverview(stats)
    } catch (error) {
      const message =
        error instanceof TyreChecksServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to load tyre check overview'
      setOverviewError(message)
      setOverview(null)
    } finally {
      setOverviewLoading(false)
    }
  }, [vehicles])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const result = await fetchTyreChecks({
        search: debouncedSearch,
        result: resultFilter,
        defectFocus,
        vehicleId: vehicleFilter,
        workerId: workerFilter,
        trailerVehicleId: trailerFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize,
        sortDir: 'desc',
      })
      setHistoryItems(result.items)
      setHistoryTotalCount(result.totalCount)
    } catch (error) {
      const message =
        error instanceof TyreChecksServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to load tyre checks'
      setHistoryError(message)
      setHistoryItems([])
      setHistoryTotalCount(0)
    } finally {
      setHistoryLoading(false)
    }
  }, [
    dateFrom,
    dateTo,
    debouncedSearch,
    defectFocus,
    page,
    pageSize,
    resultFilter,
    trailerFilter,
    vehicleFilter,
    workerFilter,
  ])

  useEffect(() => {
    if (showOverviewWorkspace) {
      void loadOverview()
    }
  }, [showOverviewWorkspace, loadOverview])

  useEffect(() => {
    if (showOverviewWorkspace) {
      void loadHistory()
    }
  }, [showOverviewWorkspace, loadHistory])

  async function handleViewHistory(check: TyreCheckListItem) {
    setIsLoadingDetail(true)
    try {
      const detail = await fetchTyreCheckDetail(check.id)
      if (!detail) {
        showToast('Tyre check not found')
        return
      }
      const vehicleMakeModel = [detail.listItem.vehicleMake, detail.listItem.vehicleModel]
        .filter(Boolean)
        .join(' ')
        .trim()
      const trailerLabel =
        detail.listItem.trailerRegistration ||
        detail.listItem.trailerNumber ||
        null
      setViewingCheck({
        id: detail.listItem.id,
        checkedAt: detail.listItem.inspectedAt,
        vehicleId: detail.listItem.vehicleId,
        vehicleLabel: vehicleMakeModel
          ? `${detail.listItem.vehicleRegistration} · ${vehicleMakeModel}`
          : detail.listItem.vehicleRegistration,
        trailerId: detail.listItem.trailerVehicleId,
        trailerLabel,
        checkedBy: detail.listItem.workerName,
        truckAxleCount: detail.listItem.truckAxleCount,
        trailerAxleCount: detail.listItem.trailerAxleCount,
        pressureUnit: detail.pressureUnit,
        summaryLabel: detail.listItem.summaryLabel,
        notes: detail.listItem.notes?.trim() || '',
        photoCount: 0,
        measurements: detail.measurements,
        corrections: detail.corrections,
      })
      setCorrectModalOpen(false)
      setCorrectionError(null)
    } catch (error) {
      const message =
        error instanceof TyreChecksServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to open tyre check'
      showToast(message)
    } finally {
      setIsLoadingDetail(false)
    }
  }

  async function handleEditHistory(check: TyreCheckListItem) {
    setIsLoadingDetail(true)
    try {
      const detail = await fetchTyreCheckDetail(check.id)
      if (!detail) {
        showToast('Tyre check not found')
        return
      }
      const vehicleMakeModel = [detail.listItem.vehicleMake, detail.listItem.vehicleModel]
        .filter(Boolean)
        .join(' ')
        .trim()
      const trailerLabel =
        detail.listItem.trailerRegistration ||
        detail.listItem.trailerNumber ||
        null
      setViewingCheck({
        id: detail.listItem.id,
        checkedAt: detail.listItem.inspectedAt,
        vehicleId: detail.listItem.vehicleId,
        vehicleLabel: vehicleMakeModel
          ? `${detail.listItem.vehicleRegistration} · ${vehicleMakeModel}`
          : detail.listItem.vehicleRegistration,
        trailerId: detail.listItem.trailerVehicleId,
        trailerLabel,
        checkedBy: detail.listItem.workerName,
        truckAxleCount: detail.listItem.truckAxleCount,
        trailerAxleCount: detail.listItem.trailerAxleCount,
        pressureUnit: detail.pressureUnit,
        summaryLabel: detail.listItem.summaryLabel,
        notes: detail.listItem.notes?.trim() || '',
        photoCount: 0,
        measurements: detail.measurements,
        corrections: detail.corrections,
      })
      setCorrectionError(null)
      setCorrectModalOpen(true)
    } catch (error) {
      const message =
        error instanceof TyreChecksServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to open tyre check for edit'
      showToast(message)
    } finally {
      setIsLoadingDetail(false)
    }
  }

  function handleDeleteHistory(check: TyreCheckListItem) {
    setDeleteError(null)
    setDeleteTarget(check)
  }

  function handleClearHistoryFilters() {
    setResultFilter('all')
    setDefectFocus('all')
    setVehicleFilter('all')
    setWorkerFilter('all')
    setTrailerFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  function trailerDisplayLabel(check: TyreCheckListItem): string {
    if (check.trailerRegistration && check.trailerNumber) {
      return `${check.trailerRegistration} · ${check.trailerNumber}`
    }
    return check.trailerRegistration || check.trailerNumber || '—'
  }

  function vehicleDisplayLabel(check: TyreCheckListItem): string {
    const makeModel = [check.vehicleMake, check.vehicleModel].filter(Boolean).join(' ').trim()
    return makeModel
      ? `${check.vehicleRegistration} · ${makeModel}`
      : check.vehicleRegistration
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className={`text-2xl font-semibold tracking-[-0.03em] ${adminHeading}`}>
          Tyre Checks
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Monitor today&apos;s coverage and review submitted tyre inspections.
          Configure layouts under Configuration. Workers perform checks on mobile.
        </p>
      </header>

      <TyreCheckAdminSectionTabs
        activeSection={activeSection}
        onSectionChange={(section) => setSection(section)}
      />

      {showOverviewWorkspace ? (
        <div className="space-y-4">
          <OverviewKpiStrip
            overview={overview}
            loading={overviewLoading}
            error={overviewError}
            onRetry={() => void loadOverview()}
          />

          <HistoryWorkspace
            title={historyExpanded ? 'All Tyre Checks' : 'Recent Tyre Checks'}
            description={
              historyExpanded
                ? 'Search, filter, and export submitted tyre checks from Supabase.'
                : 'Latest submitted tyre inspections. Expand to browse the full history.'
            }
            defectFocus={defectFocus}
            onDefectFocusChange={setDefectFocus}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            resultFilter={resultFilter}
            onResultFilterChange={setResultFilter}
            vehicleFilter={vehicleFilter}
            onVehicleFilterChange={setVehicleFilter}
            workerFilter={workerFilter}
            onWorkerFilterChange={setWorkerFilter}
            trailerFilter={trailerFilter}
            onTrailerFilterChange={setTrailerFilter}
            dateFrom={dateFrom}
            onDateFromChange={setDateFrom}
            dateTo={dateTo}
            onDateToChange={setDateTo}
            vehicles={vehicles}
            workers={drivers}
            hasActiveFilters={hasActiveHistoryFilters}
            onClearFilters={handleClearHistoryFilters}
            historyLoading={historyLoading}
            historyError={historyError}
            historyItems={historyItems}
            historyTotalCount={historyTotalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(nextSize) =>
              setPageSize(Math.min(MAX_TYRE_CHECK_PAGE_SIZE, Math.max(10, nextSize)))
            }
            isLoadingDetail={isLoadingDetail}
            isExporting={isExporting}
            exportMenu={
              <ExportMenu
                busy={isExporting}
                disabled={historyLoading || historyTotalCount === 0}
                actions={[
                  {
                    id: 'excel',
                    label: 'Export filtered results to Excel',
                    disabled: historyTotalCount === 0,
                    onSelect: async () => {
                      setIsExporting(true)
                      try {
                        await exportTyreChecksExcel(
                          {
                            search: debouncedSearch || undefined,
                            result: resultFilter,
                            defectFocus,
                            vehicleId: vehicleFilter,
                            workerId: workerFilter,
                            trailerVehicleId: trailerFilter,
                            dateFrom: dateFrom || undefined,
                            dateTo: dateTo || undefined,
                            sortDir: 'desc',
                          },
                          resolveExportMeta({
                            companyName,
                            logoUrl: settings?.logoUrl,
                            generatedBy: session?.user.email ?? null,
                            documentTitle: 'Tyre Checks',
                          }),
                        )
                        showToast('Exported tyre checks to Excel')
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
                    disabled: historyTotalCount === 0,
                    onSelect: async () => {
                      setIsExporting(true)
                      try {
                        await exportTyreChecksFilteredPdfs(
                          {
                            search: debouncedSearch || undefined,
                            result: resultFilter,
                            defectFocus,
                            vehicleId: vehicleFilter,
                            workerId: workerFilter,
                            trailerVehicleId: trailerFilter,
                            dateFrom: dateFrom || undefined,
                            dateTo: dateTo || undefined,
                            sortDir: 'desc',
                          },
                          resolveExportMeta({
                            companyName,
                            logoUrl: settings?.logoUrl,
                            generatedBy: session?.user.email ?? null,
                            documentTitle: 'Tyre Check',
                          }),
                        )
                        showToast(
                          historyTotalCount === 1
                            ? 'Exported tyre check to PDF'
                            : 'Exported tyre checks to ZIP',
                        )
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
            onViewCheck={(check) => void handleViewHistory(check)}
            onEditCheck={(check) => void handleEditHistory(check)}
            onDeleteCheck={handleDeleteHistory}
            vehicleDisplayLabel={vehicleDisplayLabel}
            trailerDisplayLabel={trailerDisplayLabel}
          />

          {!historyExpanded ? (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-[12px] px-4 text-sm font-semibold"
                onClick={() => openFullHistory()}
              >
                View all inspections
                {historyTotalCount > historyItems.length
                  ? ` (${historyTotalCount})`
                  : ''}
              </Button>
            </div>
          ) : (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-[12px] px-3 text-sm font-semibold text-[#2563EB]"
                onClick={() => {
                  setPage(1)
                  setSection('overview')
                }}
              >
                Show recent only
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {activeSection === 'configuration' ? (
        <ConfigurationSection
          tractorVehicles={tractorVehicles}
          trailerVehicles={trailerVehicles}
        />
      ) : null}

      <div className="rounded-[16px] border border-[#BFE3F5] bg-[#EAF4FF] px-4 py-3 text-sm text-[#2A376F] dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-300">
        Tyre inspections are archived for 24 months. Workers complete checks on mobile;
        this Admin page is for configuration, monitoring, and review only.
      </div>

      {viewingCheck
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
              role="presentation"
            >
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                aria-label="Close tyre check detail"
                disabled={isDownloadingPdf}
                onClick={() => {
                  if (!isDownloadingPdf) setViewingCheck(null)
                }}
              />

              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="tyre-check-detail-title"
                className="relative z-[1] flex max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[20px] bg-white shadow-xl dark:bg-slate-900/95 dark:shadow-black/50 sm:max-h-[90vh] sm:rounded-[20px]"
              >
                {/* Single sticky header — title, meta, actions */}
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#D3E9FC] px-5 py-4 dark:border-white/10">
                  <div className="min-w-0">
                    <h3
                      id="tyre-check-detail-title"
                      className={`text-lg font-semibold ${adminHeading}`}
                    >
                      Tyre check detail
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {formatCheckedAt(viewingCheck.checkedAt)} ·{' '}
                      {viewingCheck.vehicleLabel}
                      {viewingCheck.trailerLabel
                        ? ` + ${viewingCheck.trailerLabel}`
                        : ''}{' '}
                      · {viewingCheck.checkedBy}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-[10px] px-2.5 text-xs font-semibold"
                      disabled={isDownloadingPdf || isSavingCorrection}
                      aria-label="Edit tyre check measurements"
                      onClick={() => {
                        setCorrectionError(null)
                        setCorrectModalOpen(true)
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-[10px] px-2.5 text-xs font-semibold"
                      disabled={isDownloadingPdf}
                      aria-label="Download tyre check PDF"
                      onClick={() => {
                        setIsDownloadingPdf(true)
                        void downloadTyreCheckPdfById(
                          viewingCheck.id,
                          resolveExportMeta({
                            companyName,
                            logoUrl: settings?.logoUrl,
                            generatedBy: session?.user.email ?? null,
                            documentTitle: 'Tyre Check',
                          }),
                          detailReportRef.current,
                        )
                          .then(() => showToast('Exported tyre check to PDF'))
                          .catch((error) => showToast(toExportUserMessage(error)))
                          .finally(() => setIsDownloadingPdf(false))
                      }}
                    >
                      {isDownloadingPdf ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="size-3.5" aria-hidden="true" />
                      )}
                      PDF
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-[10px]"
                      disabled={isDownloadingPdf}
                      onClick={() => {
                        setCorrectModalOpen(false)
                        setViewingCheck(null)
                      }}
                    >
                      Close
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  <div ref={detailReportRef}>
                    <TyreCheckAdminReport
                      id={viewingCheck.id}
                      vehicleLabel={viewingCheck.vehicleLabel}
                      trailerLabel={viewingCheck.trailerLabel}
                      checkedBy={viewingCheck.checkedBy}
                      completedLabel={formatCheckedAt(viewingCheck.checkedAt)}
                      summaryLabel={viewingCheck.summaryLabel}
                      notes={viewingCheck.notes}
                      measurements={viewingCheck.measurements}
                      pressureUnit={viewingCheck.pressureUnit}
                      corrections={viewingCheck.corrections}
                    />
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <CorrectTyreCheckModal
        check={viewingCheck}
        isOpen={correctModalOpen && Boolean(viewingCheck)}
        isSaving={isSavingCorrection}
        errorMessage={correctionError}
        onClose={() => {
          if (isSavingCorrection) return
          setCorrectModalOpen(false)
          setCorrectionError(null)
        }}
        onConfirm={(payload) => {
          if (!viewingCheck) return
          setIsSavingCorrection(true)
          setCorrectionError(null)
          void applyTyreCheckCorrection({
            tyreCheckId: viewingCheck.id,
            reason: payload.reason,
            pressureUnit: payload.pressureUnit,
            items: payload.items,
          })
            .then(async () => {
              const detail = await fetchTyreCheckDetail(viewingCheck.id)
              if (!detail) {
                throw new TyreChecksServiceError('Corrected check could not be reloaded.')
              }
              const vehicleMakeModel = [
                detail.listItem.vehicleMake,
                detail.listItem.vehicleModel,
              ]
                .filter(Boolean)
                .join(' ')
                .trim()
              const trailerLabel =
                detail.listItem.trailerRegistration ||
                detail.listItem.trailerNumber ||
                null
              setViewingCheck({
                id: detail.listItem.id,
                checkedAt: detail.listItem.inspectedAt,
                vehicleId: detail.listItem.vehicleId,
                vehicleLabel: vehicleMakeModel
                  ? `${detail.listItem.vehicleRegistration} · ${vehicleMakeModel}`
                  : detail.listItem.vehicleRegistration,
                trailerId: detail.listItem.trailerVehicleId,
                trailerLabel,
                checkedBy: detail.listItem.workerName,
                truckAxleCount: detail.listItem.truckAxleCount,
                trailerAxleCount: detail.listItem.trailerAxleCount,
                pressureUnit: detail.pressureUnit,
                summaryLabel: detail.listItem.summaryLabel,
                notes: detail.listItem.notes?.trim() || '',
                photoCount: 0,
                measurements: detail.measurements,
                corrections: detail.corrections,
              })
              setCorrectModalOpen(false)
              showToast('Tyre check correction saved')
              void loadHistory()
              void loadOverview()
            })
            .catch((error) => {
              setCorrectionError(
                error instanceof TyreChecksServiceError
                  ? error.message
                  : error instanceof Error
                    ? error.message
                    : 'Unable to save correction.',
              )
            })
            .finally(() => setIsSavingCorrection(false))
        }}
      />

      <DeleteTyreCheckModal
        check={deleteTarget}
        isOpen={Boolean(deleteTarget)}
        isSaving={isSavingDelete}
        errorMessage={deleteError}
        onClose={() => {
          if (isSavingDelete) return
          setDeleteTarget(null)
          setDeleteError(null)
        }}
        onConfirm={(reason) => {
          if (!deleteTarget) return
          setIsSavingDelete(true)
          setDeleteError(null)
          void softDeleteTyreCheck(deleteTarget.id, reason)
            .then(() => {
              if (viewingCheck?.id === deleteTarget.id) {
                setCorrectModalOpen(false)
                setViewingCheck(null)
              }
              setDeleteTarget(null)
              showToast('Tyre check deleted from active list')
              void loadHistory()
              void loadOverview()
            })
            .catch((error) => {
              setDeleteError(
                error instanceof TyreChecksServiceError
                  ? error.message
                  : error instanceof Error
                    ? error.message
                    : 'Unable to delete tyre check.',
              )
            })
            .finally(() => setIsSavingDelete(false))
        }}
      />

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[130] rounded-[12px] bg-[#2A376F] px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </div>
  )
}

function OverviewKpiStrip({
  overview,
  loading,
  error,
  onRetry,
}: {
  overview: TyreCheckAdminOverviewStats | null
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  const needsAttentionCount =
    (overview?.attention ?? 0) + (overview?.critical ?? 0) + (overview?.dirty ?? 0)

  const cards = [
    {
      label: 'Completed Today',
      value: overview?.completedToday ?? 0,
      helper: 'Vehicles checked today',
      icon: CheckCircle2,
      style: timesheetKpiVisualStyles.approved,
    },
    {
      label: 'Needs Attention',
      value: needsAttentionCount,
      helper: 'Critical, dirty & attention',
      icon: AlertTriangle,
      style: timesheetKpiVisualStyles.drafts,
    },
    {
      label: 'Not Checked Today',
      value: overview?.notCheckedToday ?? 0,
      helper: 'Active vehicles still waiting',
      icon: Clock3,
      style: timesheetKpiVisualStyles.total,
    },
    {
      label: 'Open Tyre Defects',
      value: overview?.openDefects ?? 0,
      helper: 'Defect positions recorded today',
      icon: ClipboardList,
      style: timesheetKpiVisualStyles.rejected,
    },
  ]

  return (
    <div className="space-y-3">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <CompactKpiCard
            key={card.label}
            label={card.label}
            value={loading ? null : card.value}
            helper={card.helper}
            icon={card.icon}
            style={card.style}
          />
        ))}
      </section>

      {error ? (
        <div className={`${adminPanel} flex flex-wrap items-center justify-between gap-3 p-4`}>
          <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
          <Button type="button" variant="outline" className="h-9 rounded-[10px]" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function CompactKpiCard({
  label,
  value,
  helper,
  icon: Icon,
  style,
}: {
  label: string
  value: number | null
  helper: string
  icon: typeof CheckCircle2
  style: (typeof timesheetKpiVisualStyles)[keyof typeof timesheetKpiVisualStyles]
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-l-4 p-4 ${style.baseGradient} ${style.baseBorder} ${style.leftBorder} ${style.baseShadow}`}
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-35 blur-2xl ${style.glowClass}`}
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-3.5">
        <div
          className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${style.iconWrap}`}
        >
          <Icon className={`size-5 ${style.iconClass}`} strokeWidth={2.1} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-3xl font-bold leading-none tracking-[-0.04em] tabular-nums sm:text-4xl ${style.valueClass}`}
          >
            {value == null ? '—' : value}
          </p>
          <p className={`mt-2.5 text-sm font-semibold ${style.labelClass}`}>{label}</p>
          <p className={`mt-1 text-xs leading-snug ${style.subtitleClass}`}>{helper}</p>
        </div>
      </div>
    </div>
  )
}

function HistoryWorkspace({
  title,
  description,
  defectFocus,
  onDefectFocusChange,
  searchTerm,
  onSearchTermChange,
  resultFilter,
  onResultFilterChange,
  vehicleFilter,
  onVehicleFilterChange,
  workerFilter,
  onWorkerFilterChange,
  trailerFilter,
  onTrailerFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  vehicles,
  workers,
  hasActiveFilters,
  onClearFilters,
  historyLoading,
  historyError,
  historyItems,
  historyTotalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoadingDetail,
  isExporting,
  exportMenu,
  onViewCheck,
  onEditCheck,
  onDeleteCheck,
  vehicleDisplayLabel,
  trailerDisplayLabel,
}: {
  title: string
  description: string
  defectFocus: TyreCheckDefectFocusFilter
  onDefectFocusChange: (value: TyreCheckDefectFocusFilter) => void
  searchTerm: string
  onSearchTermChange: (value: string) => void
  resultFilter: TyreCheckResultFilter
  onResultFilterChange: (value: TyreCheckResultFilter) => void
  vehicleFilter: string
  onVehicleFilterChange: (value: string) => void
  workerFilter: string
  onWorkerFilterChange: (value: string) => void
  trailerFilter: string
  onTrailerFilterChange: (value: string) => void
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
  vehicles: Vehicle[]
  workers: Driver[]
  hasActiveFilters: boolean
  onClearFilters: () => void
  historyLoading: boolean
  historyError: string | null
  historyItems: TyreCheckListItem[]
  historyTotalCount: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  isLoadingDetail: boolean
  isExporting: boolean
  exportMenu: ReactNode
  onViewCheck: (check: TyreCheckListItem) => void
  onEditCheck: (check: TyreCheckListItem) => void
  onDeleteCheck: (check: TyreCheckListItem) => void
  vehicleDisplayLabel: (check: TyreCheckListItem) => string
  trailerDisplayLabel: (check: TyreCheckListItem) => string
}) {
  return (
    <section className="space-y-3">
      <div className="min-w-0">
        <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>

      <TyreChecksToolbar
        searchTerm={searchTerm}
        onSearchTermChange={onSearchTermChange}
        resultFilter={resultFilter}
        onResultFilterChange={onResultFilterChange}
        defectFocus={defectFocus}
        onDefectFocusChange={onDefectFocusChange}
        vehicleFilter={vehicleFilter}
        onVehicleFilterChange={onVehicleFilterChange}
        workerFilter={workerFilter}
        onWorkerFilterChange={onWorkerFilterChange}
        trailerFilter={trailerFilter}
        onTrailerFilterChange={onTrailerFilterChange}
        dateFrom={dateFrom}
        onDateFromChange={onDateFromChange}
        dateTo={dateTo}
        onDateToChange={onDateToChange}
        vehicles={vehicles}
        workers={workers}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        loading={historyLoading || isExporting}
        secondaryActions={exportMenu}
      />

      <div className={adminTableShell}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className={adminTableHeader}>
              <tr>
                {[
                  'Date',
                  'Vehicle',
                  'Trailer',
                  'Worker',
                  'Result',
                  'Axles',
                  'Summary',
                  'Actions',
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.07em] text-[#0D477F] dark:text-sky-300"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    Loading tyre checks…
                  </td>
                </tr>
              ) : historyError ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-rose-600 dark:text-rose-300"
                  >
                    {historyError}
                  </td>
                </tr>
              ) : historyItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    {hasActiveFilters
                      ? 'No tyre checks match your search or filters.'
                      : 'No tyre checks have been recorded yet.'}
                  </td>
                </tr>
              ) : (
                historyItems.map((check) => (
                  <tr key={check.id} className={adminTableRow}>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatCheckedAt(check.inspectedAt)}
                    </td>
                    <td className={`px-4 py-3 ${adminTableEntityName}`}>
                      {vehicleDisplayLabel(check)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {trailerDisplayLabel(check)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {check.workerName}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatTyreCheckResultLabel(check.overallResult)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatAxleCountLabel(check.truckAxleCount, check.trailerAxleCount)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {check.summaryLabel}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-[10px] px-2.5 text-xs"
                          disabled={isLoadingDetail}
                          onClick={() => onViewCheck(check)}
                        >
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-[10px] px-2.5 text-xs"
                          disabled={isLoadingDetail}
                          onClick={() => onEditCheck(check)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-[10px] px-2.5 text-xs text-rose-700 ring-rose-200 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-300 dark:ring-rose-900/40 dark:hover:bg-rose-950/30"
                          disabled={isLoadingDetail}
                          onClick={() => onDeleteCheck(check)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TyreChecksPagination
          page={page}
          pageSize={pageSize}
          totalCount={historyTotalCount}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          disabled={historyLoading}
        />
      </div>
    </section>
  )
}

function ConfigurationSection({
  tractorVehicles,
  trailerVehicles,
}: {
  tractorVehicles: Vehicle[]
  trailerVehicles: Vehicle[]
}) {
  const allVehicles = useMemo(
    () => [...tractorVehicles, ...trailerVehicles],
    [tractorVehicles, trailerVehicles],
  )

  const [vehicleId, setVehicleId] = useState('')
  const [axleCount, setAxleCount] = useState(DEFAULT_TRUCK_AXLE_COUNT)
  const [axleLayouts, setAxleLayouts] = useState<AxleWheelLayout[]>(() =>
    resolveFallbackTruckAxleWheelLayouts(DEFAULT_TRUCK_AXLE_COUNT),
  )
  const [hasSavedLayout, setHasSavedLayout] = useState(false)
  const [isLoadingLayout, setIsLoadingLayout] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const selectedVehicle = allVehicles.find((vehicle) => vehicle.id === vehicleId) ?? null
  const isTrailer = selectedVehicle ? isTrailerVehicle(selectedVehicle) : false

  function resolveFallback(count: number): AxleWheelLayout[] {
    return isTrailer
      ? resolveFallbackTrailerAxleWheelLayouts(count)
      : resolveFallbackTruckAxleWheelLayouts(count)
  }

  function handleVehicleIdChange(nextVehicleId: string) {
    setVehicleId(nextVehicleId)
    if (!nextVehicleId) {
      setHasSavedLayout(false)
      setLoadError(null)
      setSaveError(null)
      setSaveMessage(null)
    }
  }

  useEffect(() => {
    if (!vehicleId) return
    let cancelled = false
    async function load() {
      setIsLoadingLayout(true)
      setLoadError(null)
      setSaveMessage(null)
      setSaveError(null)
      try {
        const saved = await fetchVehicleTyreLayout(vehicleId)
        if (cancelled) return
        if (saved && saved.axleLayouts.length > 0) {
          setHasSavedLayout(true)
          setAxleCount(saved.axleCount)
          setAxleLayouts(saved.axleLayouts)
        } else {
          setHasSavedLayout(false)
          const fallbackCount = DEFAULT_TRUCK_AXLE_COUNT
          setAxleCount(fallbackCount)
          setAxleLayouts(resolveFallback(fallbackCount))
        }
      } catch (error) {
        if (cancelled) return
        setLoadError(
          error instanceof Error ? error.message : 'Unable to load the saved layout.',
        )
      } finally {
        if (!cancelled) setIsLoadingLayout(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // resolveFallback intentionally excluded: only re-run when the selected vehicle changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId])

  function handleAxleCountChange(nextCount: number) {
    setAxleCount(nextCount)
    setAxleLayouts((current) => resizeAxleWheelLayouts(current, nextCount, resolveFallback))
    setSaveMessage(null)
  }

  async function handleSave() {
    if (!vehicleId || !selectedVehicle) return
    setIsSaving(true)
    setSaveError(null)
    setSaveMessage(null)
    try {
      await saveVehicleTyreLayout(vehicleId, axleLayouts)
      setHasSavedLayout(true)
      setSaveMessage(`Saved default layout for ${vehicleLabel(selectedVehicle)}.`)
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Unable to save the layout.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const previewMeasurements = useMemo(
    () =>
      buildTyreLayout(axleCount, null, {
        truckAxleLayouts: axleLayouts,
      }),
    [axleCount, axleLayouts],
  )

  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-[#D3E9FC] bg-[#F8FBFF] px-4 py-3 text-sm text-[#2A376F] dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-300">
        <p className="font-semibold">Vehicle tyre layout configuration</p>
        <p className="mt-1 leading-6">
          Select a Vehicle to view or set its saved default axle layout. Workers using
          this Vehicle receive this default and may correct it before starting a new
          check. Saving here never changes any existing Tyre Check.
        </p>
      </div>

      <section className={`${adminPanel} grid gap-3 p-4 lg:grid-cols-3`}>
        <label className="space-y-1.5 lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
            Vehicle
          </span>
          <select
            value={vehicleId}
            onChange={(event) => handleVehicleIdChange(event.target.value)}
            className={adminSelect}
          >
            <option value="">Select a vehicle…</option>
            {tractorVehicles.length > 0 ? (
              <optgroup label="Trucks / tractors">
                {tractorVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicleLabel(vehicle)}
                    {vehicle.vehicleType ? ` · ${vehicle.vehicleType}` : ''}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {trailerVehicles.length > 0 ? (
              <optgroup label="Trailers">
                {trailerVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicleLabel(vehicle)}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
            Axle count
          </span>
          <select
            value={axleCount}
            disabled={!vehicleId || isLoadingLayout}
            onChange={(event) => handleAxleCountChange(Number(event.target.value))}
            className={adminSelect}
          >
            {Array.from({ length: MAX_COMBINED_TYRE_AXLES }, (_, index) => index + 1).map(
              (count) => (
                <option key={count} value={count}>
                  {count} axle{count === 1 ? '' : 's'}
                </option>
              ),
            )}
          </select>
        </label>
      </section>

      {!vehicleId ? (
        <div className="rounded-[16px] border border-[#D3E9FC] bg-[#F8FBFF] px-4 py-3 text-sm text-[#2A376F] dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-300">
          Select a Vehicle above to view or set its default axle layout.
        </div>
      ) : (
        <>
          {loadError ? (
            <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-200">
              {loadError}
            </div>
          ) : (
            <div
              className={cn(
                'rounded-[16px] border px-4 py-3 text-sm',
                hasSavedLayout
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200',
              )}
            >
              <p className="font-semibold">
                {hasSavedLayout ? 'Saved default layout' : 'No layout saved yet'}
              </p>
              <p className="mt-1 leading-6">
                {hasSavedLayout
                  ? 'This is the persisted default for this Vehicle.'
                  : 'Showing a suggested starting layout. Save below to persist it as the default for future checks.'}
              </p>
            </div>
          )}

          {saveError ? (
            <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-200">
              {saveError}
            </div>
          ) : null}
          {saveMessage ? (
            <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              {saveMessage}
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)]">
            <section className={`${adminPanel} p-4`}>
              <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
                Layout preview
              </h2>
              <p className={`mt-1 text-sm ${adminTextMuted}`}>
                {vehicleLabel(selectedVehicle!)} · top view
              </p>
              <div className="mt-4">
                {isLoadingLayout ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    Loading saved layout…
                  </p>
                ) : (
                  <TyreCheckDiagram
                    measurements={previewMeasurements}
                    selectedTyreId={null}
                    onSelectTyre={() => {}}
                    palette="pastel"
                    vehicleUnitTitle={`${vehicleLabel(selectedVehicle!)} · top view`}
                  />
                )}
              </div>
            </section>

            <aside className={`${adminPanel} space-y-3 p-4`}>
              <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
                Per-axle layout
              </h2>
              <p className={`text-sm ${adminTextMuted}`}>
                Single = one tyre per side. Dual = outer and inner per side.
              </p>
              <AxleLayoutEditor
                unitLabel={isTrailer ? 'Trailer' : 'Truck'}
                axleLayouts={axleLayouts}
                onChange={(next) => {
                  setAxleLayouts(next)
                  setSaveMessage(null)
                }}
                disabled={isLoadingLayout}
              />
              <Button
                type="button"
                className="h-11 w-full rounded-[12px] bg-[#2563EB] font-semibold text-white hover:bg-[#1d4ed8]"
                disabled={isLoadingLayout || isSaving}
                onClick={() => void handleSave()}
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                Save default layout
              </Button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Good: tread ≥ 6.0 mm · Attention: 4.0–5.9 mm · Critical: &lt; 4.0 mm.
                Saving does not alter previous Tyre Checks.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

function formatCheckedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

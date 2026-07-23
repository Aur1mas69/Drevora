import { TyreCheckAdminSectionTabs } from '@/components/vehicle-checks/TyreCheckAdminSectionTabs'
import { TyreCheckDiagram } from '@/components/vehicle-checks/TyreCheckDiagram'
import { TyreChecksPagination } from '@/components/vehicle-checks/TyreChecksPagination'
import { TyreChecksToolbar } from '@/components/vehicle-checks/TyreChecksToolbar'
import { ExportMenu } from '@/components/export/ExportMenu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { toExportUserMessage } from '@/lib/export/exportErrors'
import { resolveExportMeta } from '@/lib/export/exportMeta'
import {
  downloadTyreCheckPdfById,
  exportTyreChecksExcel,
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
  attentionTyres,
  buildTyreLayout,
  DEFAULT_TRAILER_AXLE_COUNT,
  DEFAULT_TRUCK_AXLE_COUNT,
  DEFAULT_TYRE_CHECK_PAGE_SIZE,
  formatAxleCountLabel,
  formatTyreCheckResultLabel,
  MAX_COMBINED_TYRE_AXLES,
  summarizeTyreMeasurements,
  totalAxleCount,
  trailerAxleOptions,
  treadDepthToStatus,
  truckAxleOptions,
  tyreStatusClasses,
  tyreStatusLabel,
  type SavedTyreCheck,
  type TyreCheckAdminOverviewStats,
  type TyreCheckAdminSection,
  type TyreCheckDefectFocusFilter,
  type TyreCheckListItem,
  type TyreCheckResultFilter,
  type TyreMeasurement,
} from '@/lib/tyreCheckTypes'
import { cn } from '@/lib/utils'
import type { Driver } from '@/services/driversService'
import {
  fetchTyreCheckAdminOverview,
  fetchTyreCheckDetail,
  fetchTyreChecks,
  TyreChecksServiceError,
} from '@/services/tyreChecksService'
import type { Vehicle } from '@/services/vehiclesService'
import {
  AlertTriangle,
  CircleDot,
  ClipboardList,
  Download,
  Loader2,
  Settings2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const DEFECT_FOCUS_OPTIONS: { id: TyreCheckDefectFocusFilter; label: string }[] = [
  { id: 'all', label: 'All checks' },
  { id: 'critical', label: 'Critical' },
  { id: 'attention', label: 'Attention' },
  { id: 'dirty', label: 'Dirty' },
  { id: 'has_defect', label: 'Has defect' },
]

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

  const [vehicleId, setVehicleId] = useState('')
  const [trailerId, setTrailerId] = useState('')
  const [truckAxleCount, setTruckAxleCount] = useState(DEFAULT_TRUCK_AXLE_COUNT)
  const [trailerAxleCount, setTrailerAxleCount] = useState<number | null>(null)
  const [measurements, setMeasurements] = useState<TyreMeasurement[]>(() =>
    buildTyreLayout(DEFAULT_TRUCK_AXLE_COUNT, null),
  )
  const [selectedTyreId, setSelectedTyreId] = useState<string | null>(null)

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
  const [isExporting, setIsExporting] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const tyreEditorRef = useRef<HTMLDivElement>(null)

  const hasTrailer = Boolean(trailerId)
  const truckOptions = truckAxleOptions(hasTrailer ? trailerAxleCount : null)
  const trailerOptions = trailerAxleOptions(truckAxleCount)
  const combinedAxles = totalAxleCount(truckAxleCount, hasTrailer ? trailerAxleCount : null)
  const summary = useMemo(() => summarizeTyreMeasurements(measurements), [measurements])
  const selectedTyre = measurements.find((tyre) => tyre.id === selectedTyreId) ?? null

  const hasActiveHistoryFilters =
    debouncedSearch.trim().length > 0 ||
    resultFilter !== 'all' ||
    defectFocus !== 'all' ||
    vehicleFilter !== 'all' ||
    workerFilter !== 'all' ||
    trailerFilter !== 'all' ||
    dateFrom.length > 0 ||
    dateTo.length > 0

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

  function openHistory(options?: {
    defectFocus?: TyreCheckDefectFocusFilter
    result?: TyreCheckResultFilter
  }) {
    if (options?.defectFocus) setDefectFocus(options.defectFocus)
    if (options?.result) setResultFilter(options.result)
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
    if (activeSection === 'overview') {
      void loadOverview()
    }
  }, [activeSection, loadOverview])

  useEffect(() => {
    if (activeSection === 'history') {
      void loadHistory()
    }
  }, [activeSection, loadHistory])

  useEffect(() => {
    const next = buildTyreLayout(truckAxleCount, hasTrailer ? trailerAxleCount : null)
    setMeasurements((current) =>
      next.map((tyre) => {
        const previous = current.find((item) => item.id === tyre.id)
        if (!previous) return tyre
        return {
          ...tyre,
          treadDepthMm: previous.treadDepthMm,
          status: previous.status,
        }
      }),
    )
    setSelectedTyreId((currentId) => {
      if (!currentId) return null
      return next.some((tyre) => tyre.id === currentId) ? currentId : null
    })
  }, [truckAxleCount, trailerAxleCount, hasTrailer])

  useEffect(() => {
    if (!selectedTyreId || activeSection !== 'configuration') return
    tyreEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedTyreId, activeSection])

  function updateTyre(
    tyreId: string,
    patch: { treadDepthMm?: number | null; dirty?: boolean },
  ) {
    setMeasurements((current) =>
      current.map((tyre) => {
        if (tyre.id !== tyreId) return tyre
        const nextDepth =
          patch.treadDepthMm !== undefined ? patch.treadDepthMm : tyre.treadDepthMm
        const dirty =
          patch.dirty !== undefined ? patch.dirty : tyre.status === 'dirty'
        return {
          ...tyre,
          treadDepthMm: nextDepth,
          status: treadDepthToStatus(nextDepth, dirty),
        }
      }),
    )
  }

  function handleTrailerChange(nextTrailerId: string) {
    setTrailerId(nextTrailerId)
    if (nextTrailerId) {
      setTruckAxleCount(DEFAULT_TRUCK_AXLE_COUNT)
      setTrailerAxleCount(DEFAULT_TRAILER_AXLE_COUNT)
      return
    }
    setTrailerAxleCount(null)
    setTruckAxleCount((current) =>
      Math.min(MAX_COMBINED_TYRE_AXLES, Math.max(1, current)),
    )
  }

  function handleTruckAxleChange(nextTruckAxles: number) {
    setTruckAxleCount(nextTruckAxles)
    if (!hasTrailer || trailerAxleCount == null) return
    const maxTrailer = MAX_COMBINED_TYRE_AXLES - nextTruckAxles
    if (trailerAxleCount > maxTrailer) {
      setTrailerAxleCount(Math.max(1, maxTrailer))
    }
  }

  function handleTrailerAxleChange(nextTrailerAxles: number) {
    setTrailerAxleCount(nextTrailerAxles)
    const maxTruck = MAX_COMBINED_TYRE_AXLES - nextTrailerAxles
    if (truckAxleCount > maxTruck) {
      setTruckAxleCount(Math.max(1, maxTruck))
    }
  }

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
        summaryLabel: detail.listItem.summaryLabel,
        notes: detail.listItem.notes?.trim() || '',
        photoCount: 0,
        measurements: detail.measurements,
      })
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
          Configure layouts, monitor today&apos;s coverage, and review submitted tyre
          inspections. Workers perform inspections on mobile.
        </p>
      </header>

      <TyreCheckAdminSectionTabs
        activeSection={activeSection}
        onSectionChange={setSection}
      />

      {activeSection === 'overview' ? (
        <OverviewSection
          overview={overview}
          loading={overviewLoading}
          error={overviewError}
          onRetry={() => void loadOverview()}
          onViewHistory={() => openHistory()}
          onViewCritical={() => openHistory({ defectFocus: 'critical' })}
          onConfigure={() => setSection('configuration')}
          onOpenCheck={(check) => void handleViewHistory(check)}
          isLoadingDetail={isLoadingDetail}
        />
      ) : null}

      {activeSection === 'configuration' ? (
        <ConfigurationSection
          tractorVehicles={tractorVehicles}
          trailerVehicles={trailerVehicles}
          vehicleId={vehicleId}
          trailerId={trailerId}
          truckAxleCount={truckAxleCount}
          trailerAxleCount={trailerAxleCount}
          hasTrailer={hasTrailer}
          truckOptions={truckOptions}
          trailerOptions={trailerOptions}
          combinedAxles={combinedAxles}
          measurements={measurements}
          selectedTyreId={selectedTyreId}
          selectedTyre={selectedTyre}
          summary={summary}
          tyreEditorRef={tyreEditorRef}
          onVehicleIdChange={setVehicleId}
          onTrailerChange={handleTrailerChange}
          onTruckAxleChange={handleTruckAxleChange}
          onTrailerAxleChange={handleTrailerAxleChange}
          onSelectTyre={setSelectedTyreId}
          onUpdateTyre={updateTyre}
        />
      ) : null}

      {activeSection === 'history' ? (
        <section className="space-y-3">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
                History & Defects
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Search, filter, and export submitted tyre checks from Supabase.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {DEFECT_FOCUS_OPTIONS.map((option) => {
              const selected = defectFocus === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setDefectFocus(option.id)}
                  className={cn(
                    'rounded-[12px] px-3.5 py-2 text-sm font-semibold transition-colors ring-1',
                    selected
                      ? 'bg-[#EAF4FF] text-[#2563EB] ring-[#BFDBFE] dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60'
                      : 'bg-white text-slate-600 ring-[rgba(75,120,220,0.12)] hover:bg-[#F8FBFF] dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <TyreChecksToolbar
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
            loading={historyLoading}
            secondaryActions={
              <ExportMenu
                busy={isExporting}
                disabled={historyLoading}
                actions={[
                  {
                    id: 'excel',
                    label: 'Export filtered results to Excel',
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
                ]}
              />
            }
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
                        {hasActiveHistoryFilters
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
                          {formatAxleCountLabel(
                            check.truckAxleCount,
                            check.trailerAxleCount,
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {check.summaryLabel}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-[10px] px-3 text-xs"
                            disabled={isLoadingDetail}
                            onClick={() => void handleViewHistory(check)}
                          >
                            View
                          </Button>
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
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              disabled={historyLoading}
            />
          </div>
        </section>
      ) : null}

      <div className="rounded-[16px] border border-[#BFE3F5] bg-[#EAF4FF] px-4 py-3 text-sm text-[#2A376F] dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-300">
        Tyre inspections are archived for 24 months. Workers complete checks on mobile;
        this Admin page is for configuration, monitoring, and review only.
      </div>

      {viewingCheck ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[1px]">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white p-5 shadow-xl dark:bg-slate-900/95 dark:shadow-black/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className={`text-lg font-semibold ${adminHeading}`}>
                  Tyre check detail
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {formatCheckedAt(viewingCheck.checkedAt)} · {viewingCheck.vehicleLabel}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
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
                  onClick={() => setViewingCheck(null)}
                >
                  Close
                </Button>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              Worker: {viewingCheck.checkedBy}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {viewingCheck.summaryLabel}
            </p>
            {viewingCheck.notes ? (
              <p className="mt-2 rounded-[12px] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
                {viewingCheck.notes}
              </p>
            ) : null}
            <div className="mt-4 space-y-2">
              {attentionTyres(viewingCheck.measurements).length === 0 ? (
                <p className="text-sm text-slate-500">No attention or critical positions.</p>
              ) : (
                attentionTyres(viewingCheck.measurements).map((tyre) => (
                  <div
                    key={tyre.id}
                    className="rounded-[12px] border border-[#D3E9FC] px-3 py-2 text-sm dark:border-white/10"
                  >
                    <p className="font-semibold text-[#2A376F] dark:text-slate-100">
                      {tyre.axleLabel} · {tyre.position}
                    </p>
                    <p className="text-slate-600">
                      {tyre.treadDepthMm == null
                        ? '—'
                        : `${tyre.treadDepthMm.toFixed(1)} mm`}{' '}
                      · {tyreStatusLabel(tyre.status)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[70] rounded-[12px] bg-[#2A376F] px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </div>
  )
}

function OverviewSection({
  overview,
  loading,
  error,
  onRetry,
  onViewHistory,
  onViewCritical,
  onConfigure,
  onOpenCheck,
  isLoadingDetail,
}: {
  overview: TyreCheckAdminOverviewStats | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onViewHistory: () => void
  onViewCritical: () => void
  onConfigure: () => void
  onOpenCheck: (check: TyreCheckListItem) => void
  isLoadingDetail: boolean
}) {
  const cards = [
    {
      label: 'Completed today',
      value: overview?.completedToday ?? 0,
      tone: 'good' as const,
    },
    {
      label: 'Not checked today',
      value: overview?.notCheckedToday ?? 0,
      tone: 'not_checked' as const,
    },
    {
      label: 'Attention',
      value: overview?.attention ?? 0,
      tone: 'attention' as const,
    },
    {
      label: 'Critical',
      value: overview?.critical ?? 0,
      tone: 'critical' as const,
    },
    {
      label: 'Dirty',
      value: overview?.dirty ?? 0,
      tone: 'dirty' as const,
    },
    {
      label: 'Open tyre defects',
      value: overview?.openDefects ?? 0,
      tone: 'critical' as const,
    },
  ]

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <SummaryMetric
            key={card.label}
            label={card.label}
            value={loading ? null : card.value}
            tone={card.tone}
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)]">
        <section className={`${adminPanel} p-4`}>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-800/50">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
                Critical tyres / Needs attention
              </h2>
              <p className={`mt-1 text-sm ${adminTextMuted}`}>
                Submitted checks today with attention, critical, dirty, or defect positions.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {loading ? (
              <p className="py-6 text-center text-sm text-slate-500">Loading overview…</p>
            ) : !overview || overview.needsAttention.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[#D3E9FC] bg-[#F8FBFF] px-4 py-6 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-400">
                No attention or critical tyre checks recorded today.
              </div>
            ) : (
              overview.needsAttention.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between gap-3 rounded-[14px] border border-[#D3E9FC] bg-white px-3 py-3 dark:border-white/10 dark:bg-slate-900/70"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#2A376F] dark:text-slate-100">
                      {check.vehicleRegistration}
                      {check.trailerRegistration
                        ? ` · ${check.trailerRegistration}`
                        : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      {check.workerName} · {formatCheckedAt(check.inspectedAt)}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {check.summaryLabel}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 shrink-0 rounded-[10px]"
                    disabled={isLoadingDetail}
                    onClick={() => onOpenCheck(check)}
                  >
                    View
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className={`${adminPanel} space-y-3 p-4`}>
          <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
            Quick links
          </h2>
          <p className={`text-sm ${adminTextMuted}`}>
            Jump to history, critical filters, or layout configuration.
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full justify-start gap-2 rounded-[12px]"
            onClick={onViewHistory}
          >
            <ClipboardList className="size-4" />
            View history
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full justify-start gap-2 rounded-[12px]"
            onClick={onViewCritical}
          >
            <CircleDot className="size-4" />
            View critical checks
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full justify-start gap-2 rounded-[12px]"
            onClick={onConfigure}
          >
            <Settings2 className="size-4" />
            Configure tyre layouts
          </Button>
          {overview ? (
            <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">
              Active vehicles today:{' '}
              <span className="font-semibold tabular-nums text-[#113C69] dark:text-slate-200">
                {overview.totalActiveVehicles}
              </span>
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function ConfigurationSection({
  tractorVehicles,
  trailerVehicles,
  vehicleId,
  trailerId,
  truckAxleCount,
  trailerAxleCount,
  hasTrailer,
  truckOptions,
  trailerOptions,
  combinedAxles,
  measurements,
  selectedTyreId,
  selectedTyre,
  summary,
  tyreEditorRef,
  onVehicleIdChange,
  onTrailerChange,
  onTruckAxleChange,
  onTrailerAxleChange,
  onSelectTyre,
  onUpdateTyre,
}: {
  tractorVehicles: Vehicle[]
  trailerVehicles: Vehicle[]
  vehicleId: string
  trailerId: string
  truckAxleCount: number
  trailerAxleCount: number | null
  hasTrailer: boolean
  truckOptions: number[]
  trailerOptions: number[]
  combinedAxles: number
  measurements: TyreMeasurement[]
  selectedTyreId: string | null
  selectedTyre: TyreMeasurement | null
  summary: ReturnType<typeof summarizeTyreMeasurements>
  tyreEditorRef: React.RefObject<HTMLDivElement | null>
  onVehicleIdChange: (value: string) => void
  onTrailerChange: (value: string) => void
  onTruckAxleChange: (value: number) => void
  onTrailerAxleChange: (value: number) => void
  onSelectTyre: (id: string | null) => void
  onUpdateTyre: (
    tyreId: string,
    patch: { treadDepthMm?: number | null; dirty?: boolean },
  ) => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-semibold">Configuration preview only</p>
        <p className="mt-1 leading-6">
          Use this screen to preview axle layouts, tyre positions, and tread status
          colours. Layout preferences are not persisted yet, and this screen does not
          create a completed Tyre Check.
        </p>
      </div>

      <section className={`${adminPanel} grid gap-3 p-4 lg:grid-cols-4`}>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
            Vehicle / type preview
          </span>
          <select
            value={vehicleId}
            onChange={(event) => onVehicleIdChange(event.target.value)}
            className={adminSelect}
          >
            <option value="">Select vehicle (optional)</option>
            {tractorVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicleLabel(vehicle)}
                {vehicle.vehicleType ? ` · ${vehicle.vehicleType}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
            Trailer (optional)
          </span>
          <select
            value={trailerId}
            onChange={(event) => onTrailerChange(event.target.value)}
            className={adminSelect}
          >
            <option value="">No trailer</option>
            {trailerVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicleLabel(vehicle)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
            Truck axle count
          </span>
          <select
            value={truckAxleCount}
            onChange={(event) => onTruckAxleChange(Number(event.target.value))}
            className={adminSelect}
          >
            {truckOptions.map((count) => (
              <option key={count} value={count}>
                {count} axle{count === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>

        {hasTrailer ? (
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
              Trailer axle count
            </span>
            <select
              value={trailerAxleCount ?? DEFAULT_TRAILER_AXLE_COUNT}
              onChange={(event) => onTrailerAxleChange(Number(event.target.value))}
              className={adminSelect}
            >
              {trailerOptions.map((count) => (
                <option key={count} value={count}>
                  {count} axle{count === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="flex items-end">
            <p className="rounded-[12px] border border-[#D3E9FC] bg-[#F8FBFF] px-3 py-2.5 text-xs font-semibold text-[#0B68BE] dark:border-white/10 dark:bg-slate-800/60 dark:text-blue-300">
              Total axles: {combinedAxles} / {MAX_COMBINED_TYRE_AXLES}
            </p>
          </div>
        )}

        {hasTrailer ? (
          <div className="flex items-end lg:col-span-4">
            <p className="rounded-[12px] border border-[#D3E9FC] bg-[#F8FBFF] px-3 py-2.5 text-xs font-semibold text-[#0B68BE] dark:border-white/10 dark:bg-slate-800/60 dark:text-blue-300">
              Total axles: {combinedAxles} / {MAX_COMBINED_TYRE_AXLES}
            </p>
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)]">
        <section className={`${adminPanel} p-4`}>
          <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
            Layout preview
          </h2>
          <p className={`mt-1 text-sm ${adminTextMuted}`}>
            Preview tyre positions per axle. Optional sample depths show status colours
            only — nothing is saved.
          </p>
          <div className="mt-4">
            <TyreCheckDiagram
              measurements={measurements}
              selectedTyreId={selectedTyreId}
              onSelectTyre={onSelectTyre}
            />
          </div>

          {selectedTyre ? (
            <div
              ref={tyreEditorRef}
              className="mt-4 rounded-[16px] border border-[#D3E9FC] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70"
            >
              <p className="text-sm font-semibold text-[#2A376F] dark:text-slate-100">
                {selectedTyre.axleLabel} · {selectedTyre.position}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
                    Sample tread depth (mm)
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    step={0.1}
                    value={selectedTyre.treadDepthMm ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value
                      onUpdateTyre(selectedTyre.id, {
                        treadDepthMm: raw === '' ? null : Number(raw),
                        dirty: false,
                      })
                    }}
                    className="h-11 rounded-[12px]"
                    placeholder="Preview only"
                  />
                </label>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-[12px]"
                    onClick={() =>
                      onUpdateTyre(selectedTyre.id, {
                        dirty: selectedTyre.status !== 'dirty',
                        treadDepthMm: selectedTyre.treadDepthMm,
                      })
                    }
                  >
                    {selectedTyre.status === 'dirty' ? 'Clear dirty' : 'Mark dirty'}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <section className={`${adminPanel} p-4`}>
            <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
              Preview summary
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <SummaryMetric label="Good" value={summary.good} tone="good" />
              <SummaryMetric label="Attention" value={summary.attention} tone="attention" />
              <SummaryMetric label="Critical" value={summary.critical} tone="critical" />
              <SummaryMetric label="Dirty" value={summary.dirty} tone="dirty" />
              <SummaryMetric
                label="Not checked"
                value={summary.notChecked}
                tone="not_checked"
                className="col-span-2"
              />
            </div>
          </section>

          <section className={`${adminPanel} space-y-3 p-4`}>
            <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
              Rules reference
            </h2>
            <ul className={`space-y-2 text-sm ${adminTextMuted}`}>
              <li>Good: tread ≥ 3.0 mm</li>
              <li>Attention: tread 2.0–2.9 mm</li>
              <li>Critical: tread &lt; 2.0 mm</li>
              <li>Dirty: marked dirty (yellow)</li>
              <li>Defect flags are recorded by Workers during inspection</li>
            </ul>
            <p className="rounded-[12px] border border-dashed border-[#D3E9FC] bg-[#F8FBFF] px-3 py-2 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-400">
              Company enable/disable for Tyre Checks will appear here when implemented.
              Threshold persistence is not available yet.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}

function SummaryMetric({
  label,
  value,
  tone,
  className,
}: {
  label: string
  value: number | null
  tone: Parameters<typeof tyreStatusClasses>[0]
  className?: string
}) {
  const colours = tyreStatusClasses(tone)
  return (
    <div className={cn('rounded-[14px] border px-3 py-3', colours.tile, className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#2A376F] dark:text-slate-100">
        {value == null ? '—' : value}
      </p>
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

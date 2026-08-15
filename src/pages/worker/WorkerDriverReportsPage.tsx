import { DriverReportFormModal } from '@/components/driver-reports/DriverReportFormModal'
import { Button } from '@/components/ui/button'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import type { DriverReport, DriverReportFormSubmitPayload } from '@/lib/driverReportTypes'
import { driverReportFormValuesToInput } from '@/lib/driverReportUtils'
import {
  applyDriverReportFileChanges,
  DriverReportFileStorageError,
} from '@/services/driverReportFileStorageService'
import {
  createDriverReport,
  DriverReportsServiceError,
  updateDriverReport,
} from '@/services/driverReportsService'
import { fetchVehicles, type Vehicle } from '@/services/vehiclesService'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * Launcher for the existing "Create Driver Report" Worker Vehicles action.
 * Reuses the shared `DriverReportFormModal` (already worker-aware via
 * `formContext="worker"`) and the existing `driverReportsService` — no new
 * form, service or database table.
 *
 * Cancel returns to Vehicles immediately (nothing was created). A successful
 * submission shows a confirmation with an explicit "Back to Vehicles" button,
 * matching the existing Start Tyre Check / Vehicle Check completion pattern.
 */
export default function WorkerDriverReportsPage() {
  const { t } = useTranslation('worker')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedVehicleId = searchParams.get('vehicleId')?.trim() || null

  const { worker, isLoading: workerLoading, error: workerError } = useCurrentWorker()
  const { companyReady, companyLoading, membershipError } = useCompanyTenantGate()
  const { settings } = useCompanySettings()

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [submittedReport, setSubmittedReport] = useState<DriverReport | null>(null)
  const justSubmittedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (companyLoading || workerLoading) return

      if (!companyReady || !worker) {
        if (!cancelled) {
          setVehicles([])
          setIsLoadingVehicles(false)
          setLoadError(membershipError ?? workerError)
        }
        return
      }

      setIsLoadingVehicles(true)
      setLoadError(null)

      try {
        const rows = await fetchVehicles()
        if (cancelled) return
        setVehicles(rows)
      } catch (error) {
        if (cancelled) return
        setVehicles([])
        setLoadError(error instanceof Error ? error.message : t('reports.loadVehiclesFailed'))
      } finally {
        if (!cancelled) setIsLoadingVehicles(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [companyLoading, companyReady, membershipError, worker, workerError, workerLoading])

  /** Cancel (or the modal's own close button) — nothing was created, return safely. */
  function handleModalClose() {
    setIsFormOpen(false)
    if (!justSubmittedRef.current) {
      navigate('/worker/vehicles')
    }
  }

  async function handleSubmit(payload: DriverReportFormSubmitPayload) {
    if (!worker?.id) {
      throw new DriverReportsServiceError(t('reports.profileUnverified'))
    }

    setIsSaving(true)
    const companyId = settings?.id
    const input = {
      ...driverReportFormValuesToInput(payload.values),
      workerId: worker.id,
      status: 'New' as const,
      officeNotes: null,
    }

    try {
      let created = await createDriverReport(input)

      if (companyId && payload.file) {
        const filePath = await applyDriverReportFileChanges({
          companyId,
          reportId: created.id,
          existingFilePath: null,
          file: payload.file,
          removeFile: false,
        })
        created = await updateDriverReport(created.id, { attachmentPath: filePath })
      }

      justSubmittedRef.current = true
      setSubmittedReport(created)
    } catch (error) {
      if (error instanceof DriverReportFileStorageError) throw error
      throw error instanceof DriverReportsServiceError
        ? error
        : new DriverReportsServiceError(t('reports.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  const workerName = worker ? `${worker.firstName} ${worker.lastName}`.trim() : null
  const isLoading = workerLoading || companyLoading || isLoadingVehicles

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <Loader2
          className="size-6 animate-spin text-[color:var(--worker-accent)]"
          aria-label={t('reports.loading')}
        />
      </div>
    )
  }

  if (workerError || !worker) {
    return (
      <div className="px-4 py-8">
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {workerError || t('reports.profileMissing')}
        </p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="px-4 py-8">
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {loadError}
        </p>
      </div>
    )
  }

  if (submittedReport) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pt-8 pb-8">
        <div className="flex flex-col items-center gap-3 rounded-[1.75rem] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] px-5 py-8 text-center shadow-sm">
          <CheckCircle2 className="size-10 text-[color:var(--worker-success)]" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-[color:var(--worker-text)]">
            {t('reports.submittedTitle')}
          </h1>
          <p className="text-sm text-[color:var(--worker-text-muted)]">
            {t('reports.submittedBody', { title: submittedReport.title })}
          </p>
          <Button
            type="button"
            className="mt-2 h-12 w-full rounded-2xl bg-[color:var(--worker-accent)] font-semibold text-white"
            onClick={() => navigate('/worker/vehicles')}
          >
            {t('reports.backToVehicles')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-4">
      <h1 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--worker-text)]">
        {t('reports.title')}
      </h1>
      <p className="mt-1 text-sm text-[color:var(--worker-text-muted)]">
        {t('reports.subtitle')}
      </p>

      <DriverReportFormModal
        isOpen={isFormOpen}
        mode="create"
        formContext="worker"
        record={null}
        workers={[worker]}
        vehicles={vehicles}
        currentWorkerId={worker.id}
        currentWorkerName={workerName}
        initialVehicleId={preselectedVehicleId}
        isSaving={isSaving}
        onClose={handleModalClose}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

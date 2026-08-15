import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LegalAcceptancePanel } from '@/components/legal/LegalAcceptancePanel'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { getLegalManifestEntry } from '@/content/legal/legalManifest'
import type { WorkerLegalStatus } from '@/lib/legalAcceptanceTypes'
import { readWorkerLegalLocalSummary } from '@/lib/legalAcceptanceTypes'
import { WORKER_LEGAL_ROUTES } from '@/lib/legalContent'
import {
  addOnlineStatusListener,
  getOnlineStatus,
} from '@/lib/networkStatus'
import {
  acceptWorkerLegalDocuments,
  fetchWorkerLegalStatus,
  LegalAcceptanceServiceError,
} from '@/services/legalAcceptanceService'

type WorkerLegalAgreementsPageProps = {
  onAccepted?: () => void
  className?: string
}

export default function WorkerLegalAgreementsPage({
  onAccepted,
  className,
}: WorkerLegalAgreementsPageProps) {
  const { t } = useTranslation('worker')
  const { companyId, companyReady } = useCompanySettings()
  const { worker, isLoading: workerLoading } = useCurrentWorker()
  const location = useLocation()
  const [isOnline, setIsOnline] = useState(true)
  const [status, setStatus] = useState<WorkerLegalStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    let removeListener: (() => Promise<void>) | null = null
    void getOnlineStatus().then((online) => {
      if (!cancelled) setIsOnline(online)
    })
    void addOnlineStatusListener((online) => {
      if (!cancelled) setIsOnline(online)
    }).then((handle) => {
      if (cancelled) {
        void handle.remove()
        return
      }
      removeListener = () => handle.remove()
    })
    return () => {
      cancelled = true
      if (removeListener) void removeListener()
    }
  }, [])

  const reload = useCallback(async () => {
    if (!companyReady || !companyId) {
      setStatus(null)
      setLoading(false)
      return
    }
    if (!(await getOnlineStatus())) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const next = await fetchWorkerLegalStatus(companyId)
      setStatus(next)
    } catch (err) {
      setStatus(null)
      setError(
        err instanceof LegalAcceptanceServiceError
          ? err.message
          : t('legal.loadStatusFailed', {
              defaultValue: 'Unable to load legal agreement status.',
            }),
      )
    } finally {
      setLoading(false)
    }
  }, [companyId, companyReady, t])

  useEffect(() => {
    void reload()
  }, [reload, isOnline])

  const versions = useMemo(
    () => ({
      workerTerms: getLegalManifestEntry('worker_terms').version,
      privacy: getLegalManifestEntry('privacy_policy').version,
    }),
    [],
  )

  const workerName = worker
    ? `${worker.firstName} ${worker.lastName}`.trim()
    : ''

  async function handleSubmit(payload: {
    acceptWorkerTerms: boolean
    acknowledgePrivacy: boolean
  }) {
    if (!companyId || !worker || !isOnline) return
    setIsSubmitting(true)
    setError(null)
    try {
      const hadPreviousAcceptance = Boolean(readWorkerLegalLocalSummary())
      await acceptWorkerLegalDocuments({
        companyId,
        driverId: worker.id,
        acceptWorkerTerms: payload.acceptWorkerTerms,
        acknowledgePrivacy: payload.acknowledgePrivacy,
        acceptedByName: workerName || worker.email,
        acceptanceSource: hadPreviousAcceptance ? 'legal_update' : 'worker_first_login',
        route: location.pathname,
      })
      await reload()
      onAccepted?.()
    } catch (err) {
      setError(
        err instanceof LegalAcceptanceServiceError
          ? err.message
          : t('legal.recordFailed', {
              defaultValue: 'Unable to record legal acceptance.',
            }),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className={`mx-auto w-full max-w-md space-y-5 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] lg:max-w-lg ${className ?? ''}`}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2F80ED]">
          {t('legal.required', { defaultValue: 'Required' })}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          {t('legal.agreementsTitle', { defaultValue: 'Legal agreements' })}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--worker-text-secondary)]">
          {workerName
            ? t('legal.welcomeAccept', {
                name: workerName,
                defaultValue:
                  'Hi {{name}}. Please accept the Worker Terms and acknowledge the Privacy Policy to continue.',
              })
            : t('legal.pleaseAccept', {
                defaultValue:
                  'Please accept the Worker Terms and acknowledge the Privacy Policy to continue.',
              })}
        </p>
      </div>

      {!isOnline ? (
        <div className="rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-semibold">
            {t('legal.connectionRequired', { defaultValue: 'Internet connection required' })}
          </p>
          <p className="mt-1">
            {t('legal.connectionRequiredBody', {
              defaultValue:
                'An internet connection is required to confirm the latest Worker Terms and Privacy Policy. You can still read the Worker Terms and Privacy Policy offline. Acceptance stays disabled until you reconnect. Any Vehicle Checks already saved on this device are kept.',
            })}
          </p>
        </div>
      ) : null}

      {loading || workerLoading ? (
        <p className="text-sm text-[color:var(--worker-text-muted)]">
          {t('legal.loading', { defaultValue: 'Loading legal documents' })}
        </p>
      ) : (
        <>
          {error ? (
            <p className="rounded-2xl border border-rose-300/80 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100">
              {error}
            </p>
          ) : null}

          <LegalAcceptancePanel
            mode="worker"
            versions={versions}
            workerTermsHref={WORKER_LEGAL_ROUTES.worker_terms}
            privacyHref={WORKER_LEGAL_ROUTES.privacy_policy}
            disabled={!isOnline || !worker}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />

          {status && !status.requiresAcceptance ? (
            <p className="text-sm text-[color:var(--worker-text-secondary)]">
              {t('legal.upToDate', {
                defaultValue: 'You’re up to date with the current Worker legal documents.',
              })}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}

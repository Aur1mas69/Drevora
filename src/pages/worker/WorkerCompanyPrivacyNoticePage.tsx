import { useEffect, useState } from 'react'
import { WorkerPrivacyNoticeCard } from '@/components/legal/WorkerPrivacyNoticeCard'
import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { WorkerLegalStatus } from '@/lib/legalAcceptanceTypes'
import {
  fetchWorkerLegalStatus,
  LegalAcceptanceServiceError,
} from '@/services/legalAcceptanceService'

export default function WorkerCompanyPrivacyNoticePage() {
  const { companyId, companyReady } = useCompanySettings()
  const [status, setStatus] = useState<WorkerLegalStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!companyReady || !companyId) {
        setStatus(null)
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const next = await fetchWorkerLegalStatus(companyId)
        if (!cancelled) setStatus(next)
      } catch (err) {
        if (cancelled) return
        setStatus(null)
        setError(
          err instanceof LegalAcceptanceServiceError
            ? err.message
            : 'Unable to load your company privacy notice.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [companyId, companyReady])

  const notice = status?.companyPrivacyNotice

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <div className="space-y-2">
        <WorkerSettingsBackLink to="/worker/settings/help" label="Help & Support" />
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          Company Privacy Notice
        </h1>
        <p className="text-sm leading-relaxed text-[color:var(--worker-text-secondary)]">
          Your employer’s Worker Privacy Notice for information processed in DREVORA.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[color:var(--worker-text-muted)]">Loading…</p>
      ) : error ? (
        <p className="rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          {error}
        </p>
      ) : (
        <WorkerPrivacyNoticeCard url={notice?.url} content={notice?.content} />
      )}
    </div>
  )
}

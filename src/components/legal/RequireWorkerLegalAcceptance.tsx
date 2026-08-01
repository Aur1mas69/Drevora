import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import WorkerLegalAgreementsPage from '@/pages/WorkerLegalAgreementsPage'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { getLegalManifestEntry } from '@/content/legal/legalManifest'
import { evaluateOfflineWorkerLegalAccess } from '@/lib/legalAcceptanceTypes'
import { WORKER_LEGAL_ROUTES } from '@/lib/legalContent'
import {
  addOnlineStatusListener,
  getOnlineStatus,
} from '@/lib/networkStatus'
import {
  fetchWorkerLegalStatus,
  isLegalForbiddenError,
  isLegalNetworkError,
  isLegalNotAvailableYetError,
  LegalAcceptanceServiceError,
} from '@/services/legalAcceptanceService'
import { AuthSplashScreen } from '@/components/auth/AuthSplashScreen'

const WORKER_LEGAL_ALLOWLIST = new Set<string>([
  WORKER_LEGAL_ROUTES.worker_terms,
  WORKER_LEGAL_ROUTES.privacy_policy,
  WORKER_LEGAL_ROUTES.company_privacy_notice,
  '/worker/settings/help',
  '/worker/settings/help/guides',
])

function isWorkerLegalAllowlisted(pathname: string): boolean {
  if (WORKER_LEGAL_ALLOWLIST.has(pathname)) return true
  if (pathname.startsWith('/worker/settings/help/legal')) return true
  if (pathname.startsWith('/worker/settings/help/guides/')) return true
  return false
}

type RequireWorkerLegalAcceptanceProps = {
  children: ReactNode
}

/**
 * Worker-only legal gate (Worker Terms + Privacy).
 * Never shows Customer Terms or DPA. Offline access uses a safe local summary
 * matched to bundled manifest versions — Supabase remains source of truth online.
 */
export function RequireWorkerLegalAcceptance({
  children,
}: RequireWorkerLegalAcceptanceProps) {
  const { companyId, companyReady, companyLoading } = useCompanySettings()
  const location = useLocation()
  const [isOnline, setIsOnline] = useState(true)
  const [requiresAcceptance, setRequiresAcceptance] = useState<boolean | null>(null)
  const [usingCachedAcceptance, setUsingCachedAcceptance] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const applyOfflineOrCacheDecision = useCallback((nextCompanyId: string) => {
    const decision = evaluateOfflineWorkerLegalAccess({
      companyId: nextCompanyId,
      bundledWorkerTermsVersion: getLegalManifestEntry('worker_terms').version,
      bundledPrivacyVersion: getLegalManifestEntry('privacy_policy').version,
    })
    if (decision.kind === 'allow_cached') {
      setRequiresAcceptance(false)
      setUsingCachedAcceptance(true)
      setError(null)
      return
    }
    // No valid cache / outdated versions — Worker-only gate, not Customer docs.
    setRequiresAcceptance(true)
    setUsingCachedAcceptance(false)
    setError(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!companyReady || !companyId) {
      setRequiresAcceptance(null)
      setUsingCachedAcceptance(false)
      return
    }

    const online = await getOnlineStatus()
    if (!online) {
      applyOfflineOrCacheDecision(companyId)
      return
    }

    setError(null)
    try {
      const status = await fetchWorkerLegalStatus(companyId)
      setRequiresAcceptance(status.requiresAcceptance)
      setUsingCachedAcceptance(false)
    } catch (err) {
      if (isLegalNotAvailableYetError(err)) {
        setRequiresAcceptance(false)
        setUsingCachedAcceptance(false)
        setError(null)
        return
      }

      // Network failure after a prior acceptance — use cache; never invent acceptance.
      if (isLegalNetworkError(err)) {
        applyOfflineOrCacheDecision(companyId)
        return
      }

      // Forbidden / auth — do not soft-pass.
      if (isLegalForbiddenError(err)) {
        setRequiresAcceptance(null)
        setUsingCachedAcceptance(false)
        setError(
          err instanceof LegalAcceptanceServiceError
            ? err.message
            : 'You do not have permission to verify legal acceptance.',
        )
        return
      }

      const message =
        err instanceof LegalAcceptanceServiceError
          ? err.message
          : 'Unable to verify legal acceptance status.'

      // If the device is actually offline despite getOnlineStatus, prefer cache.
      if (!(await getOnlineStatus())) {
        applyOfflineOrCacheDecision(companyId)
        return
      }

      setRequiresAcceptance(null)
      setUsingCachedAcceptance(false)
      setError(message)
    }
  }, [applyOfflineOrCacheDecision, companyId, companyReady])

  useEffect(() => {
    void refresh()
  }, [refresh, isOnline])

  if (companyLoading || (companyReady && requiresAcceptance === null && !error && isOnline)) {
    return <AuthSplashScreen />
  }

  if (error && isOnline && !usingCachedAcceptance) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F6F9FF] px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">Legal agreements</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            className="mt-5 h-10 w-full rounded-2xl bg-[#2F80ED] text-sm font-semibold text-white hover:bg-[#2563EB]"
            onClick={() => void refresh()}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (requiresAcceptance && !isWorkerLegalAllowlisted(location.pathname)) {
    return (
      <div className="min-h-dvh bg-[#F6F9FF] dark:bg-slate-950">
        <WorkerLegalAgreementsPage onAccepted={() => void refresh()} />
      </div>
    )
  }

  return (
    <>
      {usingCachedAcceptance && !isOnline ? (
        <div
          role="status"
          className="legal-print-hide border-b border-amber-200/80 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
        >
          You’re offline. Your previously confirmed legal settings are being used.
        </div>
      ) : null}
      {children}
    </>
  )
}

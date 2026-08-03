import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import WorkerLegalAgreementsPage from '@/pages/WorkerLegalAgreementsPage'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { getLegalManifestEntry } from '@/content/legal/legalManifest'
import {
  evaluateOfflineWorkerLegalAccess,
  shouldDeferWorkerLegalUpdate,
  type WorkerLegalAccessState,
} from '@/lib/legalAcceptanceTypes'
import { WORKER_LEGAL_ROUTES } from '@/lib/legalContent'
import {
  addOnlineStatusListener,
  getOnlineStatus,
} from '@/lib/networkStatus'
import {
  isWorkerActiveCheckSession,
  subscribeWorkerActiveCheckSession,
} from '@/lib/workerActiveCheckSession'
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

function bundledVersions() {
  return {
    bundledWorkerTermsVersion: getLegalManifestEntry('worker_terms').version,
    bundledPrivacyVersion: getLegalManifestEntry('privacy_policy').version,
  }
}

type RequireWorkerLegalAcceptanceProps = {
  children: ReactNode
}

/**
 * Worker-only legal gate (Worker Terms + Privacy).
 * Never shows Customer Terms or DPA.
 * Offline: accepted_previous still allows Vehicle Checks; never invents latest acceptance.
 * Online: latest Terms required, deferred until any active check completes.
 */
export function RequireWorkerLegalAcceptance({
  children,
}: RequireWorkerLegalAcceptanceProps) {
  const { companyId, companyReady, companyLoading } = useCompanySettings()
  const location = useLocation()
  const [isOnline, setIsOnline] = useState(true)
  const [requiresAcceptance, setRequiresAcceptance] = useState<boolean | null>(null)
  const [usingCachedAcceptance, setUsingCachedAcceptance] = useState(false)
  const [accessState, setAccessState] = useState<WorkerLegalAccessState | null>(null)
  const [deferredLatestRequired, setDeferredLatestRequired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeCheckEpoch, setActiveCheckEpoch] = useState(0)

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

  useEffect(() => {
    return subscribeWorkerActiveCheckSession(() => {
      setActiveCheckEpoch((n) => n + 1)
    })
  }, [])

  const applyOfflineOrCacheDecision = useCallback(
    (
      nextCompanyId: string,
      options?: { treatMissingAsUnavailable?: boolean },
    ): WorkerLegalAccessState => {
      const state = evaluateOfflineWorkerLegalAccess({
        companyId: nextCompanyId,
        ...bundledVersions(),
        treatMissingAsUnavailable: options?.treatMissingAsUnavailable,
      })
      setAccessState(state)

      if (state === 'accepted_latest' || state === 'accepted_previous') {
        setRequiresAcceptance(false)
        setUsingCachedAcceptance(true)
        setError(null)
        return state
      }

      if (state === 'unavailable_offline') {
        // Network failure without usable proof — never treat as first-use Terms.
        setRequiresAcceptance(null)
        setUsingCachedAcceptance(false)
        setError(
          'Unable to verify legal acceptance while offline. Reconnect to continue, or try again.',
        )
        return state
      }

      // never_accepted — block first use (Terms screen; accept disabled offline).
      setRequiresAcceptance(true)
      setUsingCachedAcceptance(false)
      setError(null)
      return state
    },
    [],
  )

  const applyOnlineRequiresAcceptance = useCallback(
    (nextCompanyId: string, serverRequiresAcceptance: boolean) => {
      const offlineState = evaluateOfflineWorkerLegalAccess({
        companyId: nextCompanyId,
        ...bundledVersions(),
      })
      setAccessState(offlineState)

      if (!serverRequiresAcceptance) {
        setRequiresAcceptance(false)
        setUsingCachedAcceptance(false)
        setDeferredLatestRequired(false)
        setError(null)
        return
      }

      const hasActiveCheck = isWorkerActiveCheckSession()
      if (
        shouldDeferWorkerLegalUpdate({
          requiresLatestAcceptance: true,
          isOnline: true,
          hasActiveCheck,
          offlineState,
        })
      ) {
        // Keep the active Vehicle Check mounted; require Terms after it finishes.
        setRequiresAcceptance(false)
        setUsingCachedAcceptance(false)
        setDeferredLatestRequired(true)
        setError(null)
        return
      }

      setRequiresAcceptance(true)
      setUsingCachedAcceptance(false)
      setDeferredLatestRequired(false)
      setError(null)
    },
    [],
  )

  const refresh = useCallback(async () => {
    if (!companyReady || !companyId) {
      setRequiresAcceptance(null)
      setUsingCachedAcceptance(false)
      setAccessState(null)
      setDeferredLatestRequired(false)
      return
    }

    // Offline path first — never wait on a network call before deciding.
    const online = await getOnlineStatus()
    if (!online) {
      applyOfflineOrCacheDecision(companyId)
      return
    }

    setError(null)
    try {
      const status = await fetchWorkerLegalStatus(companyId)
      // fetchWorkerLegalStatus only writes cache when satisfied — previous proof is kept.
      applyOnlineRequiresAcceptance(companyId, status.requiresAcceptance)
    } catch (err) {
      if (isLegalNotAvailableYetError(err)) {
        setRequiresAcceptance(false)
        setUsingCachedAcceptance(false)
        setAccessState(null)
        setDeferredLatestRequired(false)
        setError(null)
        return
      }

      // Network failure after a prior acceptance — use cache; never invent acceptance
      // and never misclassify as never_accepted.
      if (isLegalNetworkError(err)) {
        applyOfflineOrCacheDecision(companyId, { treatMissingAsUnavailable: true })
        return
      }

      if (isLegalForbiddenError(err)) {
        setRequiresAcceptance(null)
        setUsingCachedAcceptance(false)
        setDeferredLatestRequired(false)
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

      if (!(await getOnlineStatus())) {
        applyOfflineOrCacheDecision(companyId, { treatMissingAsUnavailable: true })
        return
      }

      setRequiresAcceptance(null)
      setUsingCachedAcceptance(false)
      setError(message)
    }
  }, [applyOfflineOrCacheDecision, applyOnlineRequiresAcceptance, companyId, companyReady])

  useEffect(() => {
    void refresh()
  }, [refresh, isOnline])

  // After an active check ends, apply any deferred latest-Terms requirement.
  useEffect(() => {
    if (!deferredLatestRequired) return
    if (isWorkerActiveCheckSession()) return
    if (!isOnline) return
    setRequiresAcceptance(true)
    setDeferredLatestRequired(false)
  }, [activeCheckEpoch, deferredLatestRequired, isOnline])

  if (companyLoading || (companyReady && requiresAcceptance === null && !error && isOnline)) {
    return <AuthSplashScreen />
  }

  if (error && isOnline && !usingCachedAcceptance && requiresAcceptance !== false) {
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

  // Evaluate offline / deferred path before replacing the tree with the Terms screen.
  if (requiresAcceptance && !isWorkerLegalAllowlisted(location.pathname)) {
    if (isWorkerActiveCheckSession()) {
      // Safety: never unmount an active check even if state races.
      return (
        <>
          {children}
        </>
      )
    }
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
          {accessState === 'accepted_previous'
            ? 'You’re offline. Continuing with your previously accepted Worker Terms. Confirm the latest version when you reconnect.'
            : 'You’re offline. Your previously confirmed legal settings are being used.'}
        </div>
      ) : null}
      {deferredLatestRequired && isOnline ? (
        <div
          role="status"
          className="legal-print-hide border-b border-sky-200/80 bg-sky-50 px-4 py-2 text-center text-xs font-medium text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"
        >
          Updated Worker Terms are available. You’ll be asked to confirm them after this check is
          saved.
        </div>
      ) : null}
      {children}
    </>
  )
}

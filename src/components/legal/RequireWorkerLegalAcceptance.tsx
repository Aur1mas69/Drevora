import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import WorkerLegalAgreementsPage from '@/pages/WorkerLegalAgreementsPage'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { WORKER_LEGAL_ROUTES } from '@/lib/legalContent'
import {
  addOnlineStatusListener,
  getOnlineStatus,
} from '@/lib/networkStatus'
import {
  fetchWorkerLegalStatus,
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
 * Worker first-login / legal-update gate. Offline users who still require
 * acceptance see the gate with an offline explanation; allowlisted document
 * routes remain readable.
 */
export function RequireWorkerLegalAcceptance({
  children,
}: RequireWorkerLegalAcceptanceProps) {
  const { companyId, companyReady, companyLoading } = useCompanySettings()
  const location = useLocation()
  const [isOnline, setIsOnline] = useState(true)
  const [requiresAcceptance, setRequiresAcceptance] = useState<boolean | null>(null)
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

  const refresh = useCallback(async () => {
    if (!companyReady || !companyId) {
      setRequiresAcceptance(null)
      return
    }
    const online = await getOnlineStatus()
    if (!online) {
      // Keep prior known state when possible; treat unknown as requiring gate.
      setRequiresAcceptance((prev) => (prev == null ? true : prev))
      return
    }
    setError(null)
    try {
      const status = await fetchWorkerLegalStatus(companyId)
      setRequiresAcceptance(status.requiresAcceptance)
    } catch (err) {
      const message =
        err instanceof LegalAcceptanceServiceError
          ? err.message
          : 'Unable to verify legal acceptance status.'
      if (/not available yet/i.test(message)) {
        setRequiresAcceptance(false)
        setError(null)
        return
      }
      setRequiresAcceptance(null)
      setError(message)
    }
  }, [companyId, companyReady])

  useEffect(() => {
    void refresh()
  }, [refresh, isOnline])

  if (companyLoading || (companyReady && requiresAcceptance === null && !error && isOnline)) {
    return <AuthSplashScreen />
  }

  if (error && isOnline) {
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

  return children
}

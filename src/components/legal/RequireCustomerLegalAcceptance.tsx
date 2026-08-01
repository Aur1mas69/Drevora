import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import CustomerLegalAgreementsPage from '@/pages/CustomerLegalAgreementsPage'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  fetchCustomerLegalStatus,
  isLegalNotAvailableYetError,
  LegalAcceptanceServiceError,
} from '@/services/legalAcceptanceService'
import { AuthSplashScreen } from '@/components/auth/AuthSplashScreen'

const CUSTOMER_LEGAL_ALLOWLIST_PREFIXES = [
  '/terms',
  '/privacy',
  '/dpa',
  '/admin/settings',
  '/onboarding',
] as const

function isCustomerLegalAllowlisted(pathname: string): boolean {
  return CUSTOMER_LEGAL_ALLOWLIST_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

type RequireCustomerLegalAcceptanceProps = {
  children: ReactNode
}

/**
 * After office membership is confirmed, block the Office shell until customer
 * legal documents are accepted — unless the user is reading allowlisted docs/settings.
 */
export function RequireCustomerLegalAcceptance({
  children,
}: RequireCustomerLegalAcceptanceProps) {
  const { companyId, companyReady, companyLoading } = useCompanySettings()
  const location = useLocation()
  const [requiresAcceptance, setRequiresAcceptance] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!companyReady || !companyId) {
      setRequiresAcceptance(null)
      return
    }
    setError(null)
    try {
      const status = await fetchCustomerLegalStatus(companyId)
      setRequiresAcceptance(status.requiresAcceptance)
    } catch (err) {
      const message =
        err instanceof LegalAcceptanceServiceError
          ? err.message
          : 'Unable to verify legal acceptance status.'
      // Soft-pass until the legal migration is applied on the project.
      if (isLegalNotAvailableYetError(err) || /not available yet/i.test(message)) {
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
  }, [refresh])

  if (companyLoading || (companyReady && requiresAcceptance === null && !error)) {
    return <AuthSplashScreen />
  }

  if (error) {
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

  if (requiresAcceptance && !isCustomerLegalAllowlisted(location.pathname)) {
    const source =
      location.state &&
      typeof location.state === 'object' &&
      'legalAcceptanceSource' in location.state &&
      typeof (location.state as { legalAcceptanceSource?: unknown }).legalAcceptanceSource ===
        'string'
        ? ((location.state as { legalAcceptanceSource: string }).legalAcceptanceSource as
            | 'onboarding'
            | 'trial'
            | 'subscription'
            | 'office_login'
            | 'legal_update')
        : 'office_login'

    return (
      <div className="min-h-dvh bg-[#F6F9FF] dark:bg-slate-950">
        <CustomerLegalAgreementsPage
          acceptanceSource={source}
          onAccepted={() => void refresh()}
        />
      </div>
    )
  }

  return children
}

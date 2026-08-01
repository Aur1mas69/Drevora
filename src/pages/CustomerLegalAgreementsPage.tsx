import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CompanyLegalDetailsCard } from '@/components/legal/CompanyLegalDetailsCard'
import { LegalAcceptancePanel } from '@/components/legal/LegalAcceptancePanel'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { CustomerLegalStatus } from '@/lib/legalAcceptanceTypes'
import { getLegalManifestEntry } from '@/content/legal/legalManifest'
import { adminHeading, adminTextMuted } from '@/lib/adminUiStyles'
import {
  acceptCustomerLegalDocuments,
  fetchCustomerLegalStatus,
  LegalAcceptanceServiceError,
} from '@/services/legalAcceptanceService'

type CustomerLegalAgreementsPageProps = {
  /** Called after a successful acceptance batch (e.g. refresh gate status). */
  onAccepted?: () => void
  acceptanceSource?: 'onboarding' | 'trial' | 'subscription' | 'office_login' | 'legal_update'
  className?: string
}

function displayNameFromEmail(email: string | undefined): string {
  if (!email) return 'Office user'
  const local = email.split('@')[0] ?? ''
  const cleaned = local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
  return cleaned || email
}

export default function CustomerLegalAgreementsPage({
  onAccepted,
  acceptanceSource = 'office_login',
  className,
}: CustomerLegalAgreementsPageProps) {
  const { session } = useAuth()
  const { companyId, companyReady } = useCompanySettings()
  const location = useLocation()
  const [status, setStatus] = useState<CustomerLegalStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reload = useCallback(async () => {
    if (!companyReady || !companyId) {
      setStatus(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const next = await fetchCustomerLegalStatus(companyId)
      setStatus(next)
    } catch (err) {
      setStatus(null)
      setError(
        err instanceof LegalAcceptanceServiceError
          ? err.message
          : 'Unable to load legal agreement status.',
      )
    } finally {
      setLoading(false)
    }
  }, [companyId, companyReady])

  useEffect(() => {
    void reload()
  }, [reload])

  const versions = useMemo(
    () => ({
      customerTerms: getLegalManifestEntry('customer_terms').version,
      dpa: getLegalManifestEntry('dpa').version,
      privacy: getLegalManifestEntry('privacy_policy').version,
    }),
    [],
  )

  const pendingDocs = status?.documents.filter((doc) => doc.required && !doc.isSatisfied) ?? []
  const legalCompanyName =
    status?.legalEntity.legalCompanyName?.trim() ||
    'your organisation'

  async function handleSubmit(payload: {
    confirmedAuthority: boolean
    acceptCustomerTerms: boolean
    acceptDpa: boolean
    acknowledgePrivacy: boolean
  }) {
    if (!companyId || !status?.companyLegalComplete) return
    setIsSubmitting(true)
    setError(null)
    try {
      await acceptCustomerLegalDocuments({
        companyId,
        confirmedAuthority: payload.confirmedAuthority,
        acceptCustomerTerms: payload.acceptCustomerTerms,
        acceptDpa: payload.acceptDpa,
        acknowledgePrivacy: payload.acknowledgePrivacy,
        acceptedByName: displayNameFromEmail(session?.user.email),
        acceptanceSource,
        route: location.pathname,
      })
      await reload()
      onAccepted?.()
    } catch (err) {
      setError(
        err instanceof LegalAcceptanceServiceError
          ? err.message
          : 'Unable to record legal acceptance.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className={`mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6 ${className ?? ''}`}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
          Required
        </p>
        <h1 className={`mt-2 text-3xl font-semibold tracking-[-0.03em] ${adminHeading}`}>
          Legal agreements
        </h1>
        <p className={`mt-2 text-sm leading-6 ${adminTextMuted}`}>
          Review and accept the current DREVORA Customer Terms, Data Processing Agreement and
          Privacy Policy before using the Office app.
        </p>
      </div>

      {loading ? (
        <p className={`text-sm ${adminTextMuted}`}>Loading legal status…</p>
      ) : (
        <>
          {pendingDocs.length > 0 ? (
            <div className="rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="font-semibold">Documents requiring action</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                {pendingDocs.map((doc) => (
                  <li key={doc.documentType}>
                    {doc.title} (v{doc.version})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <CompanyLegalDetailsCard
            entity={status?.legalEntity}
            complete={Boolean(status?.companyLegalComplete)}
            missingFields={status?.missingLegalFields}
          />

          {error ? (
            <p className="rounded-2xl border border-rose-300/80 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100">
              {error}
            </p>
          ) : null}

          <LegalAcceptancePanel
            mode="customer"
            legalCompanyName={legalCompanyName}
            versions={versions}
            disabled={!status?.companyLegalComplete}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
        </>
      )}
    </div>
  )
}

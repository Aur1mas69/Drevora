import { useEffect, useMemo, useState } from 'react'
import { CompanyLegalDetailsCard } from '@/components/legal/CompanyLegalDetailsCard'
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { CustomerLegalStatus } from '@/lib/legalAcceptanceTypes'
import { getBundledLegalDocument } from '@/lib/legalContent'
import {
  fetchCustomerLegalStatus,
  LegalAcceptanceServiceError,
} from '@/services/legalAcceptanceService'

function buildCustomerSummaryMarkdown(status: CustomerLegalStatus | null): string {
  const entity = status?.legalEntity
  const line = (label: string, value: string | null | undefined) =>
    `- **${label}:** ${value?.trim() || 'Not provided'}`

  const address = [
    entity?.businessAddressLine1,
    entity?.businessAddressLine2,
    entity?.city,
    entity?.county,
    entity?.postcode,
    entity?.country,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')

  return [
    '## Customer controller summary',
    '',
    'These details identify the Customer organisation acting as Controller for this DPA.',
    '',
    line('Legal company name', entity?.legalCompanyName),
    line('Business address', address || null),
    line('Privacy contact email', entity?.privacyContactEmail),
    '',
    status?.companyLegalComplete
      ? '> Legal company details are complete for acceptance.'
      : '> Legal company details are incomplete. Complete them in Settings before accepting this DPA.',
    '',
  ].join('\n')
}

export default function DpaPage() {
  const { companyId, companyReady } = useCompanySettings()
  const [status, setStatus] = useState<CustomerLegalStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!companyReady || !companyId) {
        setStatus(null)
        return
      }
      setError(null)
      try {
        const next = await fetchCustomerLegalStatus(companyId)
        if (!cancelled) setStatus(next)
      } catch (err) {
        if (cancelled) return
        setStatus(null)
        setError(
          err instanceof LegalAcceptanceServiceError
            ? err.message
            : 'Unable to load company legal details.',
        )
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [companyId, companyReady])

  const markdownOverride = useMemo(() => {
    const base = getBundledLegalDocument('dpa').markdown
    return `${buildCustomerSummaryMarkdown(status)}\n${base}`
  }, [status])

  return (
    <LegalDocumentPage
      documentType="dpa"
      layout="admin"
      markdownOverride={markdownOverride}
      headerExtra={
        <div className="legal-print-hide space-y-3 pt-2">
          {error ? (
            <p className="rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
              {error}
            </p>
          ) : null}
          <CompanyLegalDetailsCard
            entity={status?.legalEntity}
            complete={Boolean(status?.companyLegalComplete)}
            missingFields={status?.missingLegalFields}
          />
        </div>
      }
    />
  )
}

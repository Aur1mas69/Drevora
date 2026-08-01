import { Link } from 'react-router-dom'
import type { CustomerLegalStatus } from '@/lib/legalAcceptanceTypes'
import { adminHeading, adminPanel, adminText, adminTextMuted } from '@/lib/adminUiStyles'
import { cn } from '@/lib/utils'

type LegalEntity = CustomerLegalStatus['legalEntity']

type CompanyLegalDetailsCardProps = {
  entity: LegalEntity | null | undefined
  complete: boolean
  missingFields?: string[]
  className?: string
  settingsHref?: string
}

function formatAddress(entity: LegalEntity): string {
  return [
    entity.businessAddressLine1,
    entity.businessAddressLine2,
    entity.city,
    entity.county,
    entity.postcode,
    entity.country,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
}

/** Shows legal entity fields or a CTA to complete them in Settings. */
export function CompanyLegalDetailsCard({
  entity,
  complete,
  missingFields = [],
  className,
  settingsHref = '/admin/settings#company-legal',
}: CompanyLegalDetailsCardProps) {
  if (!complete || !entity?.legalCompanyName?.trim()) {
    return (
      <div className={cn(`${adminPanel} p-5`, className)}>
        <h2 className={`text-base font-semibold ${adminHeading}`}>Company legal details</h2>
        <p className={`mt-1.5 text-sm leading-6 ${adminTextMuted}`}>
          Complete your legal company details before accepting the Data Processing Agreement.
        </p>
        {missingFields.length > 0 ? (
          <p className={`mt-2 text-sm ${adminText}`}>Missing: {missingFields.join(', ')}</p>
        ) : null}
        <Link
          to={settingsHref}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl bg-[#2F80ED] px-4 text-sm font-semibold text-white hover:bg-[#2563EB]"
        >
          Complete legal company details
        </Link>
      </div>
    )
  }

  return (
    <div className={cn(`${adminPanel} p-5`, className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className={`text-base font-semibold ${adminHeading}`}>Company legal details</h2>
        <Link
          to={settingsHref}
          className="legal-print-hide text-sm font-semibold text-[#0B68BE] hover:underline dark:text-sky-400"
        >
          Edit
        </Link>
      </div>
      <dl className={`mt-3 space-y-2 text-sm leading-6 ${adminText}`}>
        <div>
          <dt className={`text-xs font-semibold uppercase tracking-[0.08em] ${adminTextMuted}`}>
            Legal company name
          </dt>
          <dd className={`font-medium ${adminHeading}`}>{entity.legalCompanyName}</dd>
        </div>
        <div>
          <dt className={`text-xs font-semibold uppercase tracking-[0.08em] ${adminTextMuted}`}>
            Business address
          </dt>
          <dd>{formatAddress(entity) || '—'}</dd>
        </div>
        <div>
          <dt className={`text-xs font-semibold uppercase tracking-[0.08em] ${adminTextMuted}`}>
            Privacy contact
          </dt>
          <dd>{entity.privacyContactEmail?.trim() || '—'}</dd>
        </div>
      </dl>
    </div>
  )
}

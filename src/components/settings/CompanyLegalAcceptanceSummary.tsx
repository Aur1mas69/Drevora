import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  settingsCardDescriptionClassName,
  settingsCardTitleClassName,
  settingsInnerCardClassName,
} from '@/components/settings/SettingsControls'
import type { CustomerLegalStatus, LegalDocumentStatusItem } from '@/lib/legalAcceptanceTypes'
import {
  fetchCustomerLegalStatus,
  LegalAcceptanceServiceError,
} from '@/services/legalAcceptanceService'

type CompanyLegalAcceptanceSummaryProps = {
  companyId: string
}

function formatAcceptedAt(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function DocumentStatusRow({ doc }: { doc: LegalDocumentStatusItem }) {
  return (
    <li className="rounded-[12px] bg-[#F8FBFF]/90 px-3 py-2.5 ring-1 ring-[rgba(75,120,220,0.10)] dark:bg-slate-800/50 dark:ring-white/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#2A376F] dark:text-slate-100">
            {doc.title}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Current version {doc.version || '—'}
          </p>
        </div>
        <span
          className={
            doc.isSatisfied
              ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
              : 'rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-100'
          }
        >
          {doc.isSatisfied ? 'Accepted' : 'Not accepted'}
        </span>
      </div>
      {doc.isSatisfied ? (
        <dl className="mt-2 grid gap-1 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-500">Accepted by</dt>
            <dd className="text-slate-700 dark:text-slate-300">
              {doc.acceptedByName?.trim() || doc.acceptedByEmail?.trim() || '—'}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-500">Accepted at</dt>
            <dd className="text-slate-700 dark:text-slate-300">
              {formatAcceptedAt(doc.acceptedAt)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-slate-500 dark:text-slate-500">Batch ref</dt>
            <dd className="break-all font-mono text-[11px] text-slate-700 dark:text-slate-300">
              {doc.acceptanceBatchId || '—'}
            </dd>
          </div>
        </dl>
      ) : null}
    </li>
  )
}

/** Read-only summary of current customer legal document acceptance status. */
export function CompanyLegalAcceptanceSummary({
  companyId,
}: CompanyLegalAcceptanceSummaryProps) {
  const [status, setStatus] = useState<CustomerLegalStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const next = await fetchCustomerLegalStatus(companyId)
        if (!cancelled) setStatus(next)
      } catch (err) {
        if (!cancelled) {
          setStatus(null)
          setError(
            err instanceof LegalAcceptanceServiceError
              ? err.message
              : 'Unable to load legal acceptance status.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [companyId])

  return (
    <div className={`${settingsInnerCardClassName} sm:col-span-2`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={settingsCardTitleClassName}>Legal Acceptance</h3>
          <p className={settingsCardDescriptionClassName}>
            Current document versions and acceptance status for this company. History cannot be
            edited or deleted here.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold text-[#0B68BE] dark:text-sky-400">
          <Link to="/terms" className="hover:underline">
            Terms
          </Link>
          <Link to="/dpa" className="hover:underline">
            DPA
          </Link>
          <Link to="/privacy" className="hover:underline">
            Privacy
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading acceptance status…</p>
      ) : error ? (
        <p className="mt-4 rounded-[12px] bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900">
          {error}
        </p>
      ) : status && status.documents.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {status.documents.map((doc) => (
            <DocumentStatusRow key={doc.documentType} doc={doc} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          No legal document status available yet.
        </p>
      )}
    </div>
  )
}

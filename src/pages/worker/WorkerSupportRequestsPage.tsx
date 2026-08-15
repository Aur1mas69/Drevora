import { SupportStatusBadge } from '@/components/worker/help/SupportStatusBadge'
import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import type { SupportRequest, SupportRequestListFilter } from '@/lib/supportRequestTypes'
import { workerListCardClass } from '@/lib/workerDarkAccent'
import { cn } from '@/lib/utils'
import {
  fetchOwnSupportRequests,
  SupportRequestsServiceError,
} from '@/services/supportRequestsService'
import {
  supportStatusDisplayLabel,
  supportStoredCategoryDisplayLabel,
} from '@/i18n/workerFinalDisplay'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const FILTER_IDS: SupportRequestListFilter[] = [
  'all',
  'submitted',
  'in_progress',
  'resolved',
]

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export default function WorkerSupportRequestsPage() {
  const { t } = useTranslation('worker')
  const isDark = useIsWorkerDarkMode()
  const [filter, setFilter] = useState<SupportRequestListFilter>('all')
  const [items, setItems] = useState<SupportRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const rows = await fetchOwnSupportRequests(filter)
        if (!cancelled) setItems(rows)
      } catch (loadError) {
        if (cancelled) return
        setItems([])
        setError(
          loadError instanceof SupportRequestsServiceError
            ? loadError.message
            : t('support.loadRequestsFailed', {
                defaultValue: 'Unable to load your support requests.',
              }),
        )
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [filter])

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header className="space-y-2">
        <WorkerSettingsBackLink
          to="/worker/settings/help"
          label={t('support.backHelp', { defaultValue: 'Help & Support' })}
        />
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          {t('support.requestsTitle', { defaultValue: 'My Support Requests' })}
        </h1>
        <p className="text-sm text-[color:var(--worker-text-secondary)]">
          {t('support.requestsIntro', {
            defaultValue: 'Only your own DREVORA support requests are shown here.',
          })}
        </p>
      </header>

      <div
        role="tablist"
        aria-label={t('support.filterAria', { defaultValue: 'Filter requests' })}
        className="grid grid-cols-4 gap-1 rounded-[1.25rem] border border-[#BFE3F5]/70 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900/40"
      >
        {FILTER_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={cn(
              'min-h-11 rounded-2xl px-1 text-[11px] font-semibold transition-colors sm:text-xs',
              filter === id
                ? 'bg-[#2F80ED] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300',
            )}
          >
            {id === 'all'
              ? t('support.filterAll', { defaultValue: 'All' })
              : supportStatusDisplayLabel(id, t)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="min-h-[10rem] rounded-[1.5rem] bg-[color:var(--worker-card)]" role="status" aria-label={t('support.loadingRequests', { defaultValue: 'Loading requests' })} />
      ) : error ? (
        <div className="rounded-[1.5rem] border border-rose-100 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-[color:var(--worker-border)] px-4 py-8 text-center">
          <p className="text-base font-semibold text-[color:var(--worker-text)]">
            {t('support.empty', { defaultValue: 'No support requests yet.' })}
          </p>
          <p className="mt-2 text-sm text-[color:var(--worker-text-secondary)]">
            {t('support.emptyBody', {
              defaultValue: 'Bug reports and feedback you send will appear here.',
            })}
          </p>
        </div>
      ) : (
        <ul className="worker-list-stack space-y-2">
          {items.map((item, index) => (
            <li key={item.id}>
              <Link
                to={`/worker/settings/help/requests/${item.id}`}
                className={cn(
                  workerListCardClass(index, isDark),
                  'worker-list-row block min-h-11',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--worker-text-muted)]">
                    {item.reference}
                  </p>
                  <SupportStatusBadge status={item.status} />
                </div>
                <p className="mt-1 text-[15px] font-semibold text-[color:var(--worker-text)]">
                  {item.title}
                </p>
                <p className="mt-1 text-xs text-[color:var(--worker-text-secondary)]">
                  {item.requestType === 'bug'
                    ? t('support.typeBug', { defaultValue: 'Bug' })
                    : t('support.typeFeedback', { defaultValue: 'Feedback' })}{' '}
                  · {supportStoredCategoryDisplayLabel(item.category, t)}
                </p>
                <p className="mt-1 text-xs text-[color:var(--worker-text-muted)]">
                  {t('support.submittedOn', {
                    date: formatDate(item.createdAt),
                    defaultValue: 'Submitted {{date}}',
                  })}
                  {item.updatedAt !== item.createdAt
                    ? ` · ${t('support.updatedOn', {
                        date: formatDate(item.updatedAt),
                        defaultValue: 'Updated {{date}}',
                      })}`
                    : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

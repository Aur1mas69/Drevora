import { SupportStatusBadge } from '@/components/worker/help/SupportStatusBadge'
import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import type { SupportRequest } from '@/lib/supportRequestTypes'
import {
  createSupportAttachmentSignedUrl,
} from '@/services/supportAttachmentsService'
import {
  fetchOwnSupportRequestById,
  SupportRequestsServiceError,
} from '@/services/supportRequestsService'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--worker-text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[color:var(--worker-text)] whitespace-pre-wrap break-words">
        {value}
      </dd>
    </div>
  )
}

export default function WorkerSupportRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const [item, setItem] = useState<SupportRequest | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!requestId) {
        setError('Support request not found.')
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setError(null)
      try {
        const row = await fetchOwnSupportRequestById(requestId)
        if (cancelled) return
        setItem(row)
        const urls = await Promise.all(
          row.attachmentPaths.map((path) => createSupportAttachmentSignedUrl(path)),
        )
        if (!cancelled) {
          setImageUrls(urls.filter((url): url is string => Boolean(url)))
        }
      } catch (loadError) {
        if (cancelled) return
        setItem(null)
        setError(
          loadError instanceof SupportRequestsServiceError
            ? loadError.message
            : 'Unable to load this support request.',
        )
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [requestId])

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header className="space-y-2">
        <WorkerSettingsBackLink
          to="/worker/settings/help/requests"
          label="My Support Requests"
        />
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          Support request
        </h1>
      </header>

      {isLoading ? (
        <div className="min-h-[12rem] rounded-[1.5rem] bg-[color:var(--worker-card)]" role="status" />
      ) : error || !item ? (
        <div className="rounded-[1.5rem] border border-rose-100 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error ?? 'Support request not found.'}
        </div>
      ) : (
        <article className="space-y-4 rounded-[1.5rem] border border-[#BFE3F5]/80 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--worker-text-muted)]">
              {item.reference}
            </p>
            <SupportStatusBadge status={item.status} />
          </div>

          <dl className="space-y-3">
            <DetailRow label="Type" value={item.requestType === 'bug' ? 'Bug' : 'Feedback'} />
            <DetailRow label="Category" value={item.category} />
            <DetailRow label="Title" value={item.title} />
            <DetailRow label="Description" value={item.description} />
            {item.stepsToReproduce ? (
              <DetailRow label="Steps to reproduce" value={item.stepsToReproduce} />
            ) : null}
            {item.rating != null ? (
              <DetailRow label="Rating" value={`${item.rating} / 5`} />
            ) : null}
            <DetailRow label="Submitted" value={formatDateTime(item.createdAt)} />
            <DetailRow label="App version" value={item.appVersion} />
            <DetailRow label="Platform" value={item.platform} />
            <DetailRow label="Status" value={item.status.replace('_', ' ')} />
            {item.supportResponse ? (
              <DetailRow label="DREVORA response" value={item.supportResponse} />
            ) : (
              <DetailRow
                label="DREVORA response"
                value="No response yet."
              />
            )}
            {item.resolvedAt ? (
              <DetailRow label="Resolved" value={formatDateTime(item.resolvedAt)} />
            ) : null}
          </dl>

          {imageUrls.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--worker-text-muted)]">
                Screenshots
              </p>
              <div className="grid grid-cols-1 gap-2">
                {imageUrls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="overflow-hidden rounded-xl border border-[#BFE3F5]/80"
                  >
                    <img
                      src={url}
                      alt="Support screenshot"
                      className="max-h-64 w-full object-contain bg-slate-50"
                    />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      )}
    </div>
  )
}

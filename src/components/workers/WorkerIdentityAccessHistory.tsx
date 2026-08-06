import { useCallback, useEffect, useState } from 'react'
import { History, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDateTimeFromIso } from '@/lib/dateTimeFormat'
import {
  formatWorkerIdentityEventLabel,
  type WorkerIdentityEvent,
} from '@/lib/workerIdentityEvents'
import {
  listWorkerIdentityEvents,
  WorkerIdentityEventsServiceError,
} from '@/services/workerIdentityEventsService'

type WorkerIdentityAccessHistoryProps = {
  workerId: string
}

function HistoryField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5499BF]/85">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold leading-snug text-[#113C69] dark:text-slate-100">
        {value}
      </p>
    </div>
  )
}

function LoginEmailChangedDetails({ event }: { event: WorkerIdentityEvent }) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <HistoryField
        label="Changed by"
        value={event.actorLabel ?? 'Not recorded'}
      />
      <HistoryField
        label="Reason"
        value={event.reason ?? 'Not recorded'}
      />
      <HistoryField label="From" value={event.oldEmail ?? 'Not recorded'} />
      <HistoryField label="To" value={event.newEmail ?? 'Not recorded'} />
    </div>
  )
}

function AccessEmailSentDetails({ event }: { event: WorkerIdentityEvent }) {
  const hasActor = Boolean(event.actorLabel)
  const hasReason = Boolean(event.reason)
  const hasEmail = Boolean(event.newEmail)
  if (!hasActor && !hasReason && !hasEmail) return null

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {hasActor ? (
        <HistoryField label="Sent by" value={event.actorLabel!} />
      ) : null}
      {hasReason ? (
        <HistoryField label="Source" value={event.reason!} />
      ) : null}
      {hasEmail ? (
        <HistoryField label="Email" value={event.newEmail!} />
      ) : null}
    </div>
  )
}

function GenericEventDetails({ event }: { event: WorkerIdentityEvent }) {
  const hasActor = Boolean(event.actorLabel)
  const hasReason = Boolean(event.reason)
  if (!hasActor && !hasReason) return null

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {hasActor ? (
        <HistoryField label="Changed by" value={event.actorLabel!} />
      ) : null}
      {hasReason ? <HistoryField label="Reason" value={event.reason!} /> : null}
    </div>
  )
}

export function WorkerIdentityAccessHistory({
  workerId,
}: WorkerIdentityAccessHistoryProps) {
  const [events, setEvents] = useState<WorkerIdentityEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const next = await listWorkerIdentityEvents(workerId)
      setEvents(next)
    } catch (error) {
      setEvents([])
      if (error instanceof WorkerIdentityEventsServiceError) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage(
          'Unable to load identity and access history. Please try again.',
        )
      }
    } finally {
      setIsLoading(false)
    }
  }, [workerId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF]/98 to-[#EEF6FF]/88 p-4 shadow-[0_4px_16px_rgba(33,142,231,0.06)] ring-1 ring-[#C5DFFB]/35 dark:border-white/10 dark:from-slate-900/70 dark:to-slate-900/60 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#D3E9FC]/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#E8F3FE] text-[#0B68BE] ring-1 ring-[#C5DFFB]/60">
            <History className="size-4" strokeWidth={2} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-[#113C69] dark:text-slate-100">
              Identity & Access History
            </h2>
            <p className="mt-0.5 text-xs font-medium text-[#5499BF]">
              Read-only record of login and identity changes for this Worker.
            </p>
          </div>
        </div>
        {!isLoading && errorMessage ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl"
            onClick={() => void load()}
          >
            Retry
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm font-medium text-[#5499BF]">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Loading identity history…
        </div>
      ) : null}

      {!isLoading && errorMessage ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/40">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && events.length === 0 ? (
        <p className="py-4 text-sm font-medium text-slate-500 dark:text-slate-400">
          No identity or access changes recorded.
        </p>
      ) : null}

      {!isLoading && !errorMessage && events.length > 0 ? (
        <ul className="space-y-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-xl bg-white/80 px-4 py-3 ring-1 ring-[#C5DFFB]/45 dark:bg-slate-950/40 dark:ring-white/10"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <p className="text-sm font-semibold text-[#113C69] dark:text-slate-100">
                  {formatWorkerIdentityEventLabel(event.eventType)}
                </p>
                <p className="shrink-0 text-xs font-medium text-[#5499BF]">
                  {formatDateTimeFromIso(event.createdAt)}
                </p>
              </div>
              {event.eventType === 'login_email_changed' ? (
                <LoginEmailChangedDetails event={event} />
              ) : event.eventType === 'access_email_sent' ? (
                <AccessEmailSentDetails event={event} />
              ) : (
                <GenericEventDetails event={event} />
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

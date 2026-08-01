import { useEffect, useState } from 'react'
import { ChevronRight, ClipboardList } from 'lucide-react'
import type { TimesheetListItem } from '@/lib/timesheetTypes'
import {
  formatSubmittedAtDisplay,
  formatTimesheetSubmittedAt,
  formatTotalHours,
  getStatusBadgeClass,
  getStatusLabel,
} from '@/lib/timesheetUtils'
import { WORKER_PROFILE_HISTORY_LIMIT } from '@/lib/workerProfileUtils'
import { cn } from '@/lib/utils'
import { fetchTimesheetsByDriverId, TimesheetsServiceError } from '@/services/timesheetsService'

type WorkerTimesheetHistoryListProps = {
  workerId: string
  onOpenWeek: (item: TimesheetListItem) => void
}

/**
 * Worker-facing Timesheet history — reuses the same `fetchTimesheetsByDriverId`
 * service already used by the Admin Worker Profile history tab.
 */
export function WorkerTimesheetHistoryList({
  workerId,
  onOpenWeek,
}: WorkerTimesheetHistoryListProps) {
  const [items, setItems] = useState<TimesheetListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setErrorMessage(null)

    void fetchTimesheetsByDriverId(workerId, {
      pageSize: WORKER_PROFILE_HISTORY_LIMIT,
    })
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
      })
      .catch((error) => {
        if (cancelled) return
        setErrorMessage(
          error instanceof TimesheetsServiceError
            ? error.message
            : 'Unable to load timesheet history.',
        )
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [workerId])

  if (isLoading) {
    return (
      <div
        className="min-h-[30vh] rounded-[1.5rem] bg-white/60"
        aria-label="Loading timesheet history"
        role="status"
      />
    )
  }

  if (errorMessage) {
    return (
      <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {errorMessage}
      </p>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[1.5rem] border border-slate-100 bg-white px-4 py-8 text-center shadow-sm">
        <ClipboardList className="size-6 text-slate-300" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-500">No previous timesheets yet.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpenWeek(item)}
            className={cn(
              'flex w-full items-stretch gap-3 rounded-[1.5rem] border border-[#BFE3F5]/80 bg-gradient-to-br from-white to-[#F5FAFF] p-4 text-left shadow-[0_2px_8px_rgba(33,142,231,0.08)] transition-colors',
              'hover:border-[#89CFF0] hover:bg-[#F0F7FF] active:bg-[#E8F3FE]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F80ED]/40',
            )}
            aria-label={`View week ${item.weekNumber} timesheet, ${getStatusLabel(item.status)}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold tracking-tight text-slate-950">
                    Week {item.weekNumber}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                    {item.weekRangeLabel}
                  </p>
                </div>
                <span
                  className={cn(
                    'inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                    getStatusBadgeClass(item.status),
                  )}
                >
                  {getStatusLabel(item.status)}
                </span>
              </div>

              <div className="mt-3 flex items-end justify-between gap-3 border-t border-[#E8F3FE] pt-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Submitted
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-600">
                    {formatSubmittedAtDisplay(item.submittedAt, item.status)}
                  </p>
                  {item.workerConfirmed && item.confirmedAt ? (
                    <p className="mt-1.5 text-xs font-medium leading-5 text-slate-600">
                      Confirmed by {item.driverName}
                      <span className="block text-slate-500">
                        {formatTimesheetSubmittedAt(item.confirmedAt) ?? '—'}
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Total
                  </p>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-slate-950">
                    {formatTotalHours(item.totalHours)}
                  </p>
                </div>
              </div>
            </div>
            <span className="flex shrink-0 items-center self-center text-[#5499BF]" aria-hidden>
              <ChevronRight className="size-5" strokeWidth={2} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import type { TimesheetListItem } from '@/lib/timesheetTypes'
import {
  formatSubmittedAtDisplay,
  formatTotalHours,
  getStatusBadgeClass,
  getStatusLabel,
} from '@/lib/timesheetUtils'
import { WORKER_PROFILE_HISTORY_LIMIT } from '@/lib/workerProfileUtils'
import { cn } from '@/lib/utils'
import { fetchTimesheetsByDriverId, TimesheetsServiceError } from '@/services/timesheetsService'

type WorkerTimesheetHistoryListProps = {
  workerId: string
}

/**
 * Worker-facing Timesheet history — reuses the same `fetchTimesheetsByDriverId`
 * service already used by the Admin Worker Profile history tab
 * (see WorkerProfileHistoryTabs.tsx). No new query or table; this only adds a
 * mobile-styled list around existing data.
 */
export function WorkerTimesheetHistoryList({
  workerId,
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
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/50"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">Week {item.weekNumber}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{item.weekRangeLabel}</p>
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
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">
              {formatSubmittedAtDisplay(item.submittedAt, item.status)}
            </p>
            <p className="text-sm font-semibold tabular-nums text-slate-950">
              {formatTotalHours(item.totalHours)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

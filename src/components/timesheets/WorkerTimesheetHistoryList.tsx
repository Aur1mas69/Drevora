import { useEffect, useState } from 'react'
import { ChevronRight, ClipboardList } from 'lucide-react'
import type { TimesheetListItem } from '@/lib/timesheetTypes'
import {
  formatTotalHours,
  getStatusBadgeClass,
} from '@/lib/timesheetUtils'
import { WORKER_PROFILE_HISTORY_LIMIT } from '@/lib/workerProfileUtils'
import { cn } from '@/lib/utils'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import { workerListCardClass } from '@/lib/workerDarkAccent'
import { fetchTimesheetsByDriverId, TimesheetsServiceError } from '@/services/timesheetsService'
import {
  formatWorkerTimesheetDateTime,
  formatWorkerTimesheetWeekRange,
  timesheetStatusI18nKey,
} from '@/i18n/workerTimesheetDisplay'
import { useTranslation } from 'react-i18next'

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
  const { t, i18n } = useTranslation('worker')
  const isDark = useIsWorkerDarkMode()
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
            : t('timesheets.errors.loadHistoryFailed', {
                defaultValue: 'Unable to load timesheet history.',
              }),
        )
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [t, workerId])

  if (isLoading) {
    return (
      <div
        className="min-h-[30vh] rounded-[1rem] bg-white/60"
        aria-label={t('timesheets.loadingHistory', {
          defaultValue: 'Loading timesheet history',
        })}
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
      <div className="flex flex-col items-center gap-2 rounded-[1rem] border border-dashed border-[color:var(--worker-border)] bg-[color:var(--worker-card)] px-4 py-6 text-center">
        <ClipboardList className="size-5 text-[color:var(--worker-text-muted)]" aria-hidden="true" />
        <p className="text-sm font-medium text-[color:var(--worker-text-secondary)]">
          {t('timesheets.noHistory', { defaultValue: 'No previous timesheets yet.' })}
        </p>
      </div>
    )
  }

  return (
    <ul className="worker-list-stack">
      {items.map((item, index) => {
        const statusLabel = t(timesheetStatusI18nKey(item.status), {
          defaultValue: item.status,
        })
        const submittedLabel =
          item.status === 'Draft' || !item.submittedAt
            ? '—'
            : formatWorkerTimesheetDateTime(item.submittedAt, i18n.language) ?? '—'
        const confirmedWhen = item.confirmedAt
          ? formatWorkerTimesheetDateTime(item.confirmedAt, i18n.language)
          : null

        return (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpenWeek(item)}
            className={workerListCardClass(index, isDark, { interactive: true }, 'flex items-center gap-2')}
            aria-label={t('timesheets.historyAria', {
              weekNumber: item.weekNumber,
              status: statusLabel,
              defaultValue: `View week ${item.weekNumber} timesheet, ${statusLabel}`,
            })}
          >
            <div className="min-w-0 flex-1">
              <div className="worker-list-card__meta">
                <div className="min-w-0">
                  <p
                    className={cn(
                      'worker-accent-title truncate text-sm font-bold tracking-tight',
                      !isDark && 'text-slate-950',
                    )}
                  >
                    {t('timesheets.weekNumber', {
                      weekNumber: item.weekNumber,
                      defaultValue: `Week ${item.weekNumber}`,
                    })}
                    <span
                      className={cn(
                        'worker-accent-secondary ml-1.5 text-xs font-medium',
                        !isDark && 'text-slate-500',
                      )}
                    >
                      · {formatWorkerTimesheetWeekRange(item.weekStart, i18n.language)}
                    </span>
                  </p>
                </div>
                <span
                  className={cn(
                    'worker-accent-badge inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                    getStatusBadgeClass(item.status),
                  )}
                >
                  {statusLabel}
                </span>
              </div>

              <div className="worker-list-card__footer">
                <p
                  className={cn(
                    'worker-accent-muted min-w-0 truncate text-[11px] font-medium',
                    !isDark && 'text-slate-500',
                  )}
                >
                  {submittedLabel}
                  {item.workerConfirmed && confirmedWhen
                    ? ` · ${t('timesheets.confirmedAt', {
                        when: confirmedWhen,
                        defaultValue: `Confirmed ${confirmedWhen}`,
                      })}`
                    : null}
                </p>
                <p
                  className={cn(
                    'worker-accent-value shrink-0 text-sm font-bold tabular-nums',
                    !isDark && 'text-slate-950',
                  )}
                >
                  {formatTotalHours(item.totalHours)}
                </p>
              </div>
            </div>
            <span
              className={cn(
                'worker-accent-muted flex shrink-0 items-center',
                !isDark && 'text-[#5499BF]',
              )}
              aria-hidden
            >
              <ChevronRight className="size-4" strokeWidth={2} />
            </span>
          </button>
        </li>
        )
      })}
    </ul>
  )
}

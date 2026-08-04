import { useEffect, useId, useState } from 'react'
import { X } from 'lucide-react'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import type { OvertimeMode, TimesheetOvertimeRules } from '@/lib/companySettingsTypes'
import type { Timesheet } from '@/lib/timesheetTypes'
import {
  formatDayLabel,
  formatHours,
  formatSubmittedAtDisplay,
  formatTimesheetSubmittedAt,
  formatTotalHours,
  getEntryPayableDisplayResult,
  getStatusBadgeClass,
  getStatusLabel,
} from '@/lib/timesheetUtils'
import { cn } from '@/lib/utils'
import { fetchTimesheetById, TimesheetsServiceError } from '@/services/timesheetsService'

const HISTORY_MODAL_STATE_KEY = '__drevoraTimesheetHistoryModal'

type WorkerTimesheetHistoryDetailModalProps = {
  timesheetId: string | null
  overtimeMode: OvertimeMode
  overtimeRules: TimesheetOvertimeRules
  paidBreaks: boolean
  onClose: () => void
}

/**
 * Read-only Worker history detail. Loads by id into local modal state only —
 * never writes into the Current Week editable form.
 */
export function WorkerTimesheetHistoryDetailModal({
  timesheetId,
  overtimeMode,
  overtimeRules,
  paidBreaks,
  onClose,
}: WorkerTimesheetHistoryDetailModalProps) {
  const titleId = useId()
  const open = Boolean(timesheetId)
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useBodyScrollLock(open)

  useEffect(() => {
    if (!timesheetId) {
      setTimesheet(null)
      setErrorMessage(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setErrorMessage(null)
    setTimesheet(null)

    void fetchTimesheetById(timesheetId)
      .then((loaded) => {
        if (cancelled) return
        setTimesheet(loaded)
      })
      .catch((error) => {
        if (cancelled) return
        setErrorMessage(
          error instanceof TimesheetsServiceError
            ? error.message
            : 'Unable to load this timesheet.',
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [timesheetId])

  // Browser / Android Back closes the modal before leaving the page.
  useEffect(() => {
    if (!open) return

    window.history.pushState({ [HISTORY_MODAL_STATE_KEY]: true }, '')

    function onPopState() {
      onClose()
    }

    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      const state = window.history.state
      if (
        typeof state === 'object' &&
        state !== null &&
        (state as { [HISTORY_MODAL_STATE_KEY]?: boolean })[HISTORY_MODAL_STATE_KEY] ===
          true
      ) {
        window.history.back()
      }
    }
  }, [onClose, open])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="worker-theme-surface fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        aria-label="Dismiss timesheet history"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative flex w-full flex-col overflow-hidden bg-[color:var(--worker-card)] shadow-xl',
          'h-[min(100dvh,100%)] max-h-[100dvh] rounded-t-[20px] border border-[color:var(--worker-border)]',
          'sm:h-auto sm:max-h-[min(90dvh,880px)] sm:max-w-2xl sm:rounded-[20px]',
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--worker-border)] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--worker-text)] sm:text-xl"
            >
              {timesheet ? `Week ${timesheet.weekNumber}` : 'Timesheet'}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">
              {timesheet?.weekRangeLabel ?? (isLoading ? 'Loading…' : '—')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F80ED]/40"
            aria-label="Close"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {isLoading ? (
            <div
              className="min-h-[30vh] rounded-[1.25rem] bg-slate-50/80"
              aria-label="Loading timesheet detail"
              role="status"
            />
          ) : null}

          {errorMessage ? (
            <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          {timesheet && !isLoading ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                    getStatusBadgeClass(timesheet.status),
                  )}
                >
                  {getStatusLabel(timesheet.status)}
                </span>
                <span className="text-xs font-medium text-slate-500">Read-only</span>
              </div>

              <section
                aria-label="Week summary"
                className="grid grid-cols-3 gap-2.5"
              >
                <SummaryStat label="Worked" value={formatHours(timesheet.workedHours)} />
                <SummaryStat
                  label="Overtime"
                  value={formatHours(timesheet.overtimeHours)}
                />
                <SummaryStat
                  label="Total"
                  value={formatTotalHours(timesheet.totalHours)}
                />
              </section>

              <dl className="space-y-2 rounded-[14px] border border-[color:var(--worker-border)] bg-[color:var(--worker-input)] px-4 py-3 text-sm">
                <DetailRow
                  label="Submitted"
                  value={formatSubmittedAtDisplay(
                    timesheet.submittedAt,
                    timesheet.status,
                  )}
                />
                {timesheet.status === 'Approved' ? (
                  <DetailRow
                    label="Approved"
                    value={
                      formatTimesheetSubmittedAt(timesheet.approvedAt) ?? '—'
                    }
                  />
                ) : null}
                {timesheet.status === 'Rejected' ? (
                  <DetailRow
                    label="Rejected"
                    value={
                      formatTimesheetSubmittedAt(timesheet.rejectedAt) ?? '—'
                    }
                  />
                ) : null}
                {timesheet.workerConfirmed && timesheet.confirmedAt ? (
                  <DetailRow
                    label="Confirmation"
                    value={`Confirmed by ${timesheet.driverName}${
                      formatTimesheetSubmittedAt(timesheet.confirmedAt)
                        ? ` · ${formatTimesheetSubmittedAt(timesheet.confirmedAt)}`
                        : ''
                    }`}
                  />
                ) : null}
              </dl>

              <ul className="space-y-3" aria-label="Days this week">
                {timesheet.entries.map((entry) => {
                  const payable = getEntryPayableDisplayResult(entry, {
                    overtimeMode,
                    overtimeRules,
                    paidBreaks,
                  })
                  const note = entry.dailyComment.trim()
                  const isFullHoliday = entry.dayType === 'holiday'
                  const isHalfHoliday =
                    entry.dayType === 'holiday_am' || entry.dayType === 'holiday_pm'
                  const holidayCode =
                    entry.dayType === 'holiday'
                      ? 'H'
                      : entry.dayType === 'holiday_am'
                        ? 'H-AM'
                        : entry.dayType === 'holiday_pm'
                          ? 'H-PM'
                          : null

                  return (
                    <li
                      key={entry.id || entry.dayDate}
                      className="rounded-[14px] border border-[color:var(--worker-border)] bg-white px-3.5 py-3"
                    >
                      <p className="text-sm font-bold text-slate-950">
                        {formatDayLabel(entry.dayDate)}
                        {holidayCode ? (
                          <span className="ml-2 text-xs font-bold uppercase tracking-[0.08em] text-sky-800">
                            {holidayCode}
                            {isHalfHoliday ? ' · Half day' : ' · Holiday'}
                          </span>
                        ) : null}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4">
                        <DayField
                          label="Start"
                          value={
                            isFullHoliday
                              ? holidayCode ?? 'H'
                              : entry.startTime?.slice(0, 5) || '—'
                          }
                        />
                        <DayField
                          label="Finish"
                          value={
                            isFullHoliday
                              ? 'Holiday'
                              : entry.finishTime?.slice(0, 5) || '—'
                          }
                        />
                        <DayField
                          label="Break"
                          value={isFullHoliday ? '—' : `${entry.breakMinutes}m`}
                        />
                        <DayField
                          label="Basic"
                          value={
                            isFullHoliday
                              ? formatHours(payable.holidayHours)
                              : isHalfHoliday
                                ? `H ${formatHours(payable.holidayHours)}${
                                    payable.workBasicHours > 0
                                      ? ` + Work ${formatHours(payable.workBasicHours)}`
                                      : ''
                                  }`
                                : formatHours(payable.basicHours)
                          }
                        />
                        <DayField
                          label="Overtime"
                          value={formatHours(payable.overtimeDisplayHours)}
                        />
                        <DayField
                          label="Additional"
                          value={isFullHoliday ? '—' : formatHours(payable.additionalHours)}
                        />
                        <DayField
                          label="Total"
                          value={formatTotalHours(payable.totalPaidHours)}
                        />
                      </div>

                      <div className="mt-3 border-t border-slate-100 pt-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                          Notes
                        </p>
                        <p className="mt-0.5 text-sm leading-5 text-slate-700">
                          {note || '—'}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#DCEEFF] bg-[#F5FAFF] px-3 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5499BF]">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold tabular-nums text-slate-950">{value}</p>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 font-medium text-[color:var(--worker-text-secondary)]">
        {label}
      </dt>
      <dd className="text-right font-semibold text-[color:var(--worker-text)]">
        {value}
      </dd>
    </div>
  )
}

function DayField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 font-semibold tabular-nums text-slate-800">{value}</p>
    </div>
  )
}

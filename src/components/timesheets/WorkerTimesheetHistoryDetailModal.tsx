import { useEffect, useId, useState } from 'react'
import { X } from 'lucide-react'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import type { OvertimeMode, TimesheetOvertimeRules } from '@/lib/companySettingsTypes'
import type { Timesheet } from '@/lib/timesheetTypes'
import {
  formatHours,
  formatTotalHours,
  getEntryPayableDisplayResult,
  getStatusBadgeClass,
} from '@/lib/timesheetUtils'
import { cn } from '@/lib/utils'
import { fetchTimesheetById, TimesheetsServiceError } from '@/services/timesheetsService'
import {
  formatWorkerTimesheetDateTime,
  formatWorkerTimesheetDayLabel,
  formatWorkerTimesheetWeekRange,
  timesheetStatusI18nKey,
} from '@/i18n/workerTimesheetDisplay'
import { useTranslation } from 'react-i18next'

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
  const { t, i18n } = useTranslation('worker')
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
            : t('timesheets.errors.loadDetailFailed', {
                defaultValue: 'Unable to load this timesheet.',
              }),
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [t, timesheetId])

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
        aria-label={t('timesheets.dismissHistory', {
          defaultValue: 'Dismiss timesheet history',
        })}
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
              {timesheet
                ? t('timesheets.weekNumber', {
                    weekNumber: timesheet.weekNumber,
                    defaultValue: `Week ${timesheet.weekNumber}`,
                  })
                : t('timesheets.title', { defaultValue: 'My Timesheet' })}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">
              {timesheet
                ? formatWorkerTimesheetWeekRange(timesheet.weekStart, i18n.language)
                : isLoading
                  ? t('timesheets.loadingEllipsis', { defaultValue: 'Loading…' })
                  : '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F80ED]/40"
            aria-label={t('home.close', { defaultValue: 'Close' })}
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {isLoading ? (
            <div
              className="min-h-[30vh] rounded-[1.25rem] bg-slate-50/80"
              aria-label={t('timesheets.loadingDetail', {
                defaultValue: 'Loading timesheet detail',
              })}
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
                  {t(timesheetStatusI18nKey(timesheet.status), {
                    defaultValue: timesheet.status,
                  })}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {t('timesheets.readOnly', { defaultValue: 'Read-only' })}
                </span>
              </div>

              <section
                aria-label={t('timesheets.weekSummaryAria', {
                  defaultValue: 'Week summary',
                })}
                className="grid grid-cols-3 gap-2.5"
              >
                <SummaryStat
                  label={t('timesheets.worked', { defaultValue: 'Worked' })}
                  value={formatHours(timesheet.workedHours)}
                />
                <SummaryStat
                  label={t('timesheets.overtime', { defaultValue: 'Overtime' })}
                  value={formatHours(timesheet.overtimeHours)}
                />
                <SummaryStat
                  label={t('timesheets.total', { defaultValue: 'Total' })}
                  value={formatTotalHours(timesheet.totalHours)}
                />
              </section>

              <dl className="space-y-2 rounded-[14px] border border-[color:var(--worker-border)] bg-[color:var(--worker-input)] px-4 py-3 text-sm">
                <DetailRow
                  label={t('timesheets.submitted', { defaultValue: 'Submitted' })}
                  value={
                    timesheet.status === 'Draft' || !timesheet.submittedAt
                      ? '—'
                      : formatWorkerTimesheetDateTime(
                          timesheet.submittedAt,
                          i18n.language,
                        ) ?? '—'
                  }
                />
                {timesheet.status === 'Approved' ? (
                  <DetailRow
                    label={t('timesheets.approved', { defaultValue: 'Approved' })}
                    value={
                      formatWorkerTimesheetDateTime(
                        timesheet.approvedAt,
                        i18n.language,
                      ) ?? '—'
                    }
                  />
                ) : null}
                {timesheet.status === 'Rejected' ? (
                  <DetailRow
                    label={t('timesheets.rejected', { defaultValue: 'Rejected' })}
                    value={
                      formatWorkerTimesheetDateTime(
                        timesheet.rejectedAt,
                        i18n.language,
                      ) ?? '—'
                    }
                  />
                ) : null}
                {timesheet.workerConfirmed && timesheet.confirmedAt ? (
                  <DetailRow
                    label={t('timesheets.confirmation', {
                      defaultValue: 'Confirmation',
                    })}
                    value={`${t('timesheets.confirmedBy', {
                      name: timesheet.driverName,
                      defaultValue: `Confirmed by ${timesheet.driverName}`,
                    })}${
                      formatWorkerTimesheetDateTime(
                        timesheet.confirmedAt,
                        i18n.language,
                      )
                        ? ` · ${formatWorkerTimesheetDateTime(timesheet.confirmedAt, i18n.language)}`
                        : ''
                    }`}
                  />
                ) : null}
              </dl>

              <ul
                className="space-y-3"
                aria-label={t('timesheets.daysAria', { defaultValue: 'Days this week' })}
              >
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
                        {formatWorkerTimesheetDayLabel(entry.dayDate, i18n.language)}
                        {holidayCode ? (
                          <span className="ml-2 text-xs font-bold uppercase tracking-[0.08em] text-sky-800">
                            {holidayCode}
                            {isHalfHoliday
                              ? ` · ${t('timesheets.halfDay', { defaultValue: 'Half day' })}`
                              : ` · ${t('timesheets.holiday', { defaultValue: 'Holiday' })}`}
                          </span>
                        ) : null}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4">
                        <DayField
                          label={t('timesheets.start', { defaultValue: 'Start' })}
                          value={
                            isFullHoliday
                              ? holidayCode ?? 'H'
                              : entry.startTime?.slice(0, 5) || '—'
                          }
                        />
                        <DayField
                          label={t('timesheets.finish', { defaultValue: 'Finish' })}
                          value={
                            isFullHoliday
                              ? t('timesheets.holiday', { defaultValue: 'Holiday' })
                              : entry.finishTime?.slice(0, 5) || '—'
                          }
                        />
                        <DayField
                          label={t('timesheets.break', { defaultValue: 'Break' })}
                          value={
                            isFullHoliday
                              ? '—'
                              : t('timesheets.breakMinutes', {
                                  minutes: entry.breakMinutes,
                                  defaultValue: `${entry.breakMinutes}m`,
                                })
                          }
                        />
                        <DayField
                          label={t('timesheets.basic', { defaultValue: 'Basic' })}
                          value={
                            isFullHoliday
                              ? formatHours(payable.holidayHours)
                              : isHalfHoliday
                                ? t('timesheets.holidayPlusWork', {
                                    holiday: formatHours(payable.holidayHours),
                                    work: formatHours(payable.workBasicHours),
                                    defaultValue: `H ${formatHours(payable.holidayHours)}${
                                      payable.workBasicHours > 0
                                        ? ` + Work ${formatHours(payable.workBasicHours)}`
                                        : ''
                                    }`,
                                  })
                                : formatHours(payable.basicHours)
                          }
                        />
                        <DayField
                          label={t('timesheets.overtime', { defaultValue: 'Overtime' })}
                          value={formatHours(payable.overtimeDisplayHours)}
                        />
                        <DayField
                          label={t('timesheets.additionalHours', {
                            defaultValue: 'Additional Hours',
                          })}
                          value={isFullHoliday ? '—' : formatHours(payable.additionalHours)}
                        />
                        <DayField
                          label={t('timesheets.total', { defaultValue: 'Total' })}
                          value={formatTotalHours(payable.totalPaidHours)}
                        />
                      </div>

                      <div className="mt-3 border-t border-slate-100 pt-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                          {t('timesheets.notes', { defaultValue: 'Notes' })}
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

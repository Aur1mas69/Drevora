import { TimesheetDecimalHoursInput } from '@/components/timesheets/TimesheetDecimalHoursInput'
import { WorkerTimesheetShiftTimes } from '@/components/timesheets/WorkerTimesheetShiftTimes'
import { WorkerSubmitTimesheetDialog } from '@/components/timesheets/WorkerSubmitTimesheetDialog'
import { Button } from '@/components/ui/button'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useWorkerEffectiveTimesheetSettings } from '@/hooks/useWorkerEffectiveTimesheetSettings'
import { downloadTimesheetPdf } from '@/lib/export/modules/timesheetsExport'
import { WorkerTimesheetHistoryDetailModal } from '@/components/timesheets/WorkerTimesheetHistoryDetailModal'
import { WorkerTimesheetHistoryList } from '@/components/timesheets/WorkerTimesheetHistoryList'
import type {
  Timesheet,
  TimesheetDayType,
  TimesheetEntryInput,
  TimesheetStatus,
} from '@/lib/timesheetTypes'
import { fetchApprovedHolidayDaysForWorkerWeek } from '@/lib/timesheetApprovedHolidays'
import {
  applyApprovedHolidaysToEntries,
  applyHolidayDayHours,
  applyWorkDayType,
  holidayDayCode,
  holidayDayLabel,
  holidayPortionFromDayType,
  isFullHolidayDay,
  isHalfHolidayDay,
  isHolidayDay,
  validateHolidayWorkOverlap,
} from '@/lib/timesheetHoliday'
import {
  buildTimesheetOvertimeRules,
  buildWeekDates,
  decimalHoursToMinutes,
  entryHasStartAndFinish,
  formatHours,
  formatLocalDateString,
  formatTotalHours,
  getDefaultWeekStartMonday,
  getEntryPayableDisplayResult,
  getMissingTimePairField,
  getStatusBadgeClass,
  isIncompleteTimePair,
  minutesToDecimalHours,
  normalizeWeekStartForCompany,
  parseLocalDate,
  prepareEntryInputs,
  recalculateEntryInputs,
  summarizeTimesheetEntries,
  TIMESHEET_TIME_PAIR_MESSAGE,
  validateTimesheetTimePairs,
} from '@/lib/timesheetUtils'
import { cn } from '@/lib/utils'
import {
  createTimesheet,
  fetchTimesheetById,
  fetchTimesheetForDriverWeek,
  submitTimesheet,
  TimesheetsServiceError,
  upsertTimesheetEntries,
} from '@/services/timesheetsService'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  formatWorkerTimesheetDateTime,
  formatWorkerTimesheetDayLabel,
  formatWorkerTimesheetWeekday,
  formatWorkerTimesheetWeekRange,
  holidayDayTypeI18nKey,
  timesheetStatusI18nKey,
} from '@/i18n/workerTimesheetDisplay'

function workerCaughtTimesheetError(
  error: unknown,
  t: TFunction,
  fallbackKey: string,
  fallback: string,
): string {
  if (error instanceof TimesheetsServiceError) return error.message
  if (error instanceof Error) {
    if (error.message === 'Timesheet does not belong to the signed-in worker.') {
      return t('timesheets.errors.notYours', { defaultValue: error.message })
    }
    return error.message
  }
  return t(fallbackKey, { defaultValue: fallback })
}

const BREAK_OPTIONS = [0, 15, 30, 45, 60] as const

function canWorkerEditTimesheet(status: TimesheetStatus): boolean {
  return status === 'Draft' || status === 'Rejected'
}

function shiftWeekStart(
  weekStart: string,
  deltaWeeks: number,
  weekSettings?: { timesheetWeekStartDay: 'monday' | 'sunday' },
): string {
  const date = parseLocalDate(weekStart)
  date.setDate(date.getDate() + deltaWeeks * 7)
  return normalizeWeekStartForCompany(formatLocalDateString(date), weekSettings)
}

type EntrySnapshotRow = {
  id: string | null
  dayDate: string
  startTime: string | null
  finishTime: string | null
  breakMinutes: number
  totalMinutes: number
  overtimeMinutes: number
  additionalHours: number
  dailyComment: string
  dayType: TimesheetDayType
}

function entriesSnapshot(entries: TimesheetEntryInput[]): string {
  return JSON.stringify(
    entries.map((entry) => ({
      id: entry.id ?? null,
      dayDate: entry.dayDate,
      startTime: entry.startTime,
      finishTime: entry.finishTime,
      breakMinutes: entry.breakMinutes,
      totalMinutes: entry.totalMinutes,
      overtimeMinutes: entry.overtimeMinutes,
      additionalHours: entry.additionalHours,
      dailyComment: entry.dailyComment,
      dayType: entry.dayType ?? 'work',
    })),
  )
}

/**
 * After Save Day, mark only the saved day as clean in the dirty snapshot.
 * Other days keep their previously saved snapshot values so unsaved local
 * edits on those days are not treated as persisted.
 */
function mergeSavedDayIntoSnapshot(
  previousSnapshot: string,
  currentEntries: TimesheetEntryInput[],
  savedDayDate: string,
): string {
  let previousRows: EntrySnapshotRow[] = []
  try {
    previousRows = previousSnapshot
      ? (JSON.parse(previousSnapshot) as EntrySnapshotRow[])
      : []
  } catch {
    previousRows = []
  }

  const synthetic: TimesheetEntryInput[] = currentEntries.map((entry) => {
    if (entry.dayDate === savedDayDate) {
      return entry
    }
    const previous = previousRows.find((row) => row.dayDate === entry.dayDate)
    if (!previous) {
      return entry
    }
    return {
      ...entry,
      id: previous.id ?? entry.id,
      startTime: previous.startTime,
      finishTime: previous.finishTime,
      breakMinutes: previous.breakMinutes,
      totalMinutes: previous.totalMinutes,
      overtimeMinutes: previous.overtimeMinutes,
      additionalHours: previous.additionalHours,
      dailyComment: previous.dailyComment,
      dayType: previous.dayType ?? entry.dayType ?? 'work',
    }
  })

  return entriesSnapshot(synthetic)
}

function pickDefaultDayDate(entries: TimesheetEntryInput[]): string {
  if (entries.length === 0) return ''
  const today = formatLocalDateString(new Date())
  if (entries.some((entry) => entry.dayDate === today)) return today
  return entries[0].dayDate
}

type DayIndicatorState = 'empty' | 'partial' | 'valid' | 'error'

/**
 * Day indicator rule (Worker Timesheets redesign):
 * - error: existing Manual "Additional Hours requires a comment" validation
 *   (same rule `validateManualAdditional` blocks on Save/Submit).
 * - partial: exactly one of Start/Finish is filled (`isIncompleteTimePair`).
 * - valid: both Start and Finish are saved/entered (`entryHasStartAndFinish`).
 * - empty: nothing meaningful entered yet.
 * A day never shows "valid" merely because one time field has a value.
 */
function getDayIndicatorState(entry: TimesheetEntryInput): DayIndicatorState {
  if (isFullHolidayDay(entry)) return 'valid'
  if (entry.additionalHours > 0 && !entry.dailyComment.trim()) return 'error'
  if (isIncompleteTimePair(entry)) return 'partial'
  if (isHalfHolidayDay(entry)) {
    if (entryHasStartAndFinish(entry) || (!entry.startTime && !entry.finishTime)) {
      return 'valid'
    }
  }
  if (entryHasStartAndFinish(entry)) return 'valid'
  if (isHalfHolidayDay(entry)) return 'valid'
  return 'empty'
}

const DAY_INDICATOR_DOT_CLASS: Record<DayIndicatorState, string> = {
  empty: 'border-slate-200 bg-slate-100 text-slate-400',
  partial: 'border-amber-200 bg-amber-50 text-amber-700',
  valid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
}

function DayIndicatorDot({ state }: { state: DayIndicatorState }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full border',
        DAY_INDICATOR_DOT_CLASS[state],
      )}
    >
      {state === 'valid' ? <Check className="size-4" /> : null}
      {state === 'partial' ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {state === 'error' ? <AlertTriangle className="size-4" /> : null}
    </span>
  )
}

function dayIndicatorAriaLabel(
  state: DayIndicatorState,
  t: TFunction,
): string {
  switch (state) {
    case 'valid':
      return t('timesheets.indicatorCompleted', { defaultValue: 'completed' })
    case 'partial':
      return t('timesheets.indicatorInProgress', { defaultValue: 'in progress' })
    case 'error':
      return t('timesheets.indicatorNeedsAttention', {
        defaultValue: 'needs attention',
      })
    default:
      return t('timesheets.indicatorNotStarted', { defaultValue: 'not started' })
  }
}

function collapsedDaySummary(
  entry: TimesheetEntryInput,
  state: DayIndicatorState,
  t: TFunction,
): string {
  if (state === 'valid') {
    const start = entry.startTime?.slice(0, 5) ?? '—'
    const finish = entry.finishTime?.slice(0, 5) ?? '—'
    return `${start}–${finish}`
  }
  if (state === 'partial') {
    const missing = getMissingTimePairField(entry)
    return missing === 'finish'
      ? t('timesheets.finishMissing', { defaultValue: 'Finish time missing' })
      : t('timesheets.startMissing', { defaultValue: 'Start time missing' })
  }
  if (state === 'error') {
    return t('timesheets.commentRequiredSummary', {
      defaultValue: 'Comment required for Additional Hours',
    })
  }
  return t('timesheets.noEntryYet', { defaultValue: 'No entry yet' })
}

const workerFieldClass =
  'h-12 w-full rounded-2xl border border-[#C5DFFB]/90 bg-[#F8FBFF] px-3 text-sm font-semibold tabular-nums text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/20 disabled:opacity-60'

const workerReadonlyFieldClass =
  'flex h-12 items-center rounded-2xl border border-[#D3E9FC] bg-[#F8FBFF] px-3 text-sm font-semibold tabular-nums text-slate-800'

type DaySaveState = 'idle' | 'saving' | 'saved' | 'error'

type DayFormProps = {
  entry: TimesheetEntryInput
  editable: boolean
  isManualMode: boolean
  overtimeMode: 'Manual' | 'Automatic'
  overtimeRules: ReturnType<typeof buildTimesheetOvertimeRules>
  paidBreaks: boolean
  onUpdate: (
    dayDate: string,
    patch: Partial<
      Pick<
        TimesheetEntryInput,
        | 'startTime'
        | 'finishTime'
        | 'breakMinutes'
        | 'dailyComment'
        | 'additionalHours'
        | 'totalMinutes'
        | 'overtimeMinutes'
        | 'dayType'
      >
    >,
  ) => void
}

/** Form body only — the accordion row supplies the day header/indicator/total. */
function WorkerDayFormFields({
  entry,
  editable,
  isManualMode,
  overtimeMode,
  overtimeRules,
  paidBreaks,
  onUpdate,
}: DayFormProps) {
  const { t, i18n } = useTranslation('worker')
  const language = i18n.language
  const isHoliday = isHolidayDay(entry)
  const isFullHoliday = isFullHolidayDay(entry)
  const isHalfHoliday = isHalfHolidayDay(entry)
  const holidayCode = holidayDayCode(entry.dayType ?? 'work')
  const payable = getEntryPayableDisplayResult(entry, {
    overtimeRules,
    paidBreaks,
    overtimeMode,
  })
  const incompletePair = !isFullHoliday && isIncompleteTimePair(entry)
  const missingField = isFullHoliday ? null : getMissingTimePairField(entry)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#E8F3FE] bg-white/80 p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5499BF]">
          {t('timesheets.dayType', { defaultValue: 'Day type' })}
        </p>
        {editable ? (
          <select
            value={entry.dayType ?? 'work'}
            onChange={(event) =>
              onUpdate(entry.dayDate, {
                dayType: event.target.value as TimesheetDayType,
              })
            }
            className={cn(workerFieldClass, 'mt-2.5')}
            aria-label={t('timesheets.dayTypeAria', {
              day: formatWorkerTimesheetDayLabel(entry.dayDate, language),
              defaultValue: `Day type for ${formatWorkerTimesheetDayLabel(entry.dayDate, language)}`,
            })}
          >
            <option value="work">
              {t('timesheets.dayTypeWork', { defaultValue: 'Work' })}
            </option>
            <option value="holiday">
              {t('timesheets.dayTypeFull', { defaultValue: 'Full day holiday (H)' })}
            </option>
            <option value="holiday_am">
              {t('timesheets.dayTypeAm', { defaultValue: 'First half (H-AM)' })}
            </option>
            <option value="holiday_pm">
              {t('timesheets.dayTypePm', { defaultValue: 'Second half (H-PM)' })}
            </option>
          </select>
        ) : (
          <p className={cn(workerReadonlyFieldClass, 'mt-2.5')}>
            {isHoliday && holidayCode
              ? t('timesheets.holidayCodeLabel', {
                  code: holidayCode,
                  label: t(holidayDayTypeI18nKey(entry.dayType ?? 'work'), {
                    defaultValue: holidayDayLabel(entry.dayType ?? 'work'),
                  }),
                  defaultValue: `${holidayCode} — ${holidayDayLabel(entry.dayType ?? 'work')}`,
                })
              : t('timesheets.dayTypeWork', { defaultValue: 'Work' })}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-[#E8F3FE] bg-white/80 p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5499BF]">
          {t('timesheets.shift', { defaultValue: 'Shift' })}
        </p>
        {isFullHoliday ? (
          <p className="mt-2.5 text-base font-bold uppercase tracking-[0.08em] text-sky-800">
            {t('timesheets.fullDayHolidayBanner', {
              defaultValue: 'H — Full day holiday',
            })}
          </p>
        ) : editable ? (
          <div className="mt-2.5 space-y-2">
            {isHalfHoliday && holidayCode ? (
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-sky-800">
                {t('timesheets.halfHolidayWorkAllowed', {
                  code: holidayCode,
                  defaultValue: `${holidayCode} — work hours allowed on the same day`,
                })}
              </p>
            ) : null}
            <WorkerTimesheetShiftTimes
              startValue={entry.startTime}
              finishValue={entry.finishTime}
              onStartChange={(value) => onUpdate(entry.dayDate, { startTime: value })}
              onFinishChange={(value) => onUpdate(entry.dayDate, { finishTime: value })}
              startInvalid={missingField === 'start'}
              finishInvalid={missingField === 'finish'}
              className={workerFieldClass}
            />
          </div>
        ) : (
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            {isHalfHoliday && holidayCode ? (
              <p className="col-span-2 text-xs font-bold uppercase tracking-[0.08em] text-sky-800">
                {holidayCode}
              </p>
            ) : null}
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                {t('timesheets.start', { defaultValue: 'Start' })}
              </span>
              <p className={workerReadonlyFieldClass}>
                {entry.startTime?.slice(0, 5) || '—'}
              </p>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                {t('timesheets.finish', { defaultValue: 'Finish' })}
              </span>
              <p className={workerReadonlyFieldClass}>
                {entry.finishTime?.slice(0, 5) || '—'}
              </p>
            </label>
          </div>
        )}
        {incompletePair ? (
          <p className="mt-2 text-xs font-medium text-rose-600">
            {t('timesheets.errors.timePairShort', {
              defaultValue: TIMESHEET_TIME_PAIR_MESSAGE,
            })}
          </p>
        ) : null}

        <label className="mt-3.5 block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t('timesheets.break', { defaultValue: 'Break' })}
          </span>
          {isFullHoliday ? (
            <p className={workerReadonlyFieldClass}>—</p>
          ) : editable ? (
            <select
              value={entry.breakMinutes}
              onChange={(event) =>
                onUpdate(entry.dayDate, {
                  breakMinutes: Number(event.target.value),
                })
              }
              className={workerFieldClass}
            >
              {BREAK_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes === 0
                    ? t('timesheets.breakMinutes', {
                        minutes: 0,
                        defaultValue: '0m',
                      })
                    : t('timesheets.breakMinutes', {
                        minutes,
                        defaultValue: `${minutes}m`,
                      })}
                </option>
              ))}
              {!BREAK_OPTIONS.includes(
                entry.breakMinutes as (typeof BREAK_OPTIONS)[number],
              ) ? (
                <option value={entry.breakMinutes}>
                  {t('timesheets.breakMinutes', {
                    minutes: entry.breakMinutes,
                    defaultValue: `${entry.breakMinutes}m`,
                  })}
                </option>
              ) : null}
            </select>
          ) : (
            <p className={workerReadonlyFieldClass}>
              {t('timesheets.breakMinutes', {
                minutes: entry.breakMinutes,
                defaultValue: `${entry.breakMinutes}m`,
              })}
            </p>
          )}
        </label>
      </div>

      <div className="rounded-2xl border border-[#E8F3FE] bg-white/80 p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5499BF]">
          {t('timesheets.paidHours', { defaultValue: 'Paid hours' })}
        </p>

        {isFullHoliday ? (
          <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-2xl border border-[#DCEEFF] bg-[#F5FAFF] px-3 py-3 text-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {t('timesheets.holiday', { defaultValue: 'Holiday' })}
              </p>
              <p className="mt-1 text-sm font-bold tabular-nums text-slate-950">
                {formatHours(payable.holidayHours)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {t('timesheets.overtime', { defaultValue: 'Overtime' })}
              </p>
              <p className="mt-1 text-sm font-bold tabular-nums text-slate-950">
                {formatHours(0)}
              </p>
            </div>
          </div>
        ) : isHalfHoliday ? (
          <div className="mt-2.5 space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#DCEEFF] bg-[#F5FAFF] px-3 py-3 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {t('timesheets.holidayWithCode', {
                    code: holidayCode,
                    defaultValue: `Holiday (${holidayCode})`,
                  })}
                </p>
                <p className="mt-1 text-sm font-bold tabular-nums text-slate-950">
                  {formatHours(payable.holidayHours)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {t('timesheets.work', { defaultValue: 'Work' })}
                </p>
                <p className="mt-1 text-sm font-bold tabular-nums text-slate-950">
                  {formatHours(payable.workBasicHours)}
                </p>
              </div>
            </div>
            {isManualMode ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {t('timesheets.workBasicHours', { defaultValue: 'Work Basic Hours' })}
                  </span>
                  {editable ? (
                    <TimesheetDecimalHoursInput
                      value={minutesToDecimalHours(entry.totalMinutes)}
                      onChange={(hours) =>
                        onUpdate(entry.dayDate, {
                          totalMinutes: decimalHoursToMinutes(hours),
                        })
                      }
                      className={workerFieldClass}
                      aria-label={t('timesheets.workBasicAria', {
                        day: formatWorkerTimesheetDayLabel(entry.dayDate, language),
                        defaultValue: `Work Basic Hours for ${formatWorkerTimesheetDayLabel(entry.dayDate, language)}`,
                      })}
                    />
                  ) : (
                    <p className={workerReadonlyFieldClass}>
                      {formatHours(payable.workBasicHours)}
                    </p>
                  )}
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {t('timesheets.overtimeWorkOnly', {
                      defaultValue: 'Overtime (work only)',
                    })}
                  </span>
                  {editable ? (
                    <TimesheetDecimalHoursInput
                      value={minutesToDecimalHours(entry.overtimeMinutes)}
                      onChange={(hours) =>
                        onUpdate(entry.dayDate, {
                          overtimeMinutes: decimalHoursToMinutes(hours),
                        })
                      }
                      className={workerFieldClass}
                      aria-label={t('timesheets.overtimeAria', {
                        day: formatWorkerTimesheetDayLabel(entry.dayDate, language),
                        defaultValue: `Overtime for ${formatWorkerTimesheetDayLabel(entry.dayDate, language)}`,
                      })}
                    />
                  ) : (
                    <p className={workerReadonlyFieldClass}>
                      {formatHours(payable.overtimeDisplayHours)}
                    </p>
                  )}
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#DCEEFF] bg-[#F5FAFF] px-3 py-3 text-center">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {t('timesheets.overtime', { defaultValue: 'Overtime' })}
                  </p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-slate-950">
                    {formatHours(payable.overtimeDisplayHours)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {t('timesheets.total', { defaultValue: 'Total' })}
                  </p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-slate-950">
                    {formatHours(payable.totalPaidHours)}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : isManualMode ? (
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                {t('timesheets.basicHours', { defaultValue: 'Basic Hours' })}
              </span>
              {editable ? (
                <TimesheetDecimalHoursInput
                  value={minutesToDecimalHours(entry.totalMinutes)}
                  onChange={(hours) =>
                    onUpdate(entry.dayDate, {
                      totalMinutes: decimalHoursToMinutes(hours),
                    })
                  }
                  className={workerFieldClass}
                  aria-label={t('timesheets.basicAria', {
                    day: formatWorkerTimesheetDayLabel(entry.dayDate, language),
                    defaultValue: `Basic Hours for ${formatWorkerTimesheetDayLabel(entry.dayDate, language)}`,
                  })}
                />
              ) : (
                <p className={workerReadonlyFieldClass}>
                  {formatHours(payable.basicHours)}
                </p>
              )}
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                {t('timesheets.overtime', { defaultValue: 'Overtime' })}
              </span>
              {editable ? (
                <TimesheetDecimalHoursInput
                  value={minutesToDecimalHours(entry.overtimeMinutes)}
                  onChange={(hours) =>
                    onUpdate(entry.dayDate, {
                      overtimeMinutes: decimalHoursToMinutes(hours),
                    })
                  }
                  className={workerFieldClass}
                  aria-label={t('timesheets.overtimeAria', {
                    day: formatWorkerTimesheetDayLabel(entry.dayDate, language),
                    defaultValue: `Overtime for ${formatWorkerTimesheetDayLabel(entry.dayDate, language)}`,
                  })}
                />
              ) : (
                <p className={workerReadonlyFieldClass}>
                  {formatHours(payable.overtimeDisplayHours)}
                </p>
              )}
            </label>
          </div>
        ) : (
          <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-2xl border border-[#DCEEFF] bg-[#F5FAFF] px-3 py-3 text-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {t('timesheets.basic', { defaultValue: 'Basic' })}
              </p>
              <p className="mt-1 text-sm font-bold tabular-nums text-slate-950">
                {formatHours(payable.basicHours)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {t('timesheets.overtime', { defaultValue: 'Overtime' })}
              </p>
              <p className="mt-1 text-sm font-bold tabular-nums text-slate-950">
                {formatHours(payable.overtimeDisplayHours)}
              </p>
            </div>
          </div>
        )}

        {!isFullHoliday ? (
          <label className="mt-3.5 block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('timesheets.additionalHours', { defaultValue: 'Additional Hours' })}
            </span>
            {editable ? (
              <TimesheetDecimalHoursInput
                value={entry.additionalHours}
                onChange={(hours) => onUpdate(entry.dayDate, { additionalHours: hours })}
                className={workerFieldClass}
                aria-label={t('timesheets.additionalAria', {
                  day: formatWorkerTimesheetDayLabel(entry.dayDate, language),
                  defaultValue: `Additional Hours for ${formatWorkerTimesheetDayLabel(entry.dayDate, language)}`,
                })}
              />
            ) : (
              <p className={workerReadonlyFieldClass}>
                {formatHours(payable.additionalHours)}
              </p>
            )}
            {!isManualMode &&
            !payable.weekendGuaranteeDay &&
            payable.additionalHours > entry.additionalHours ? (
              <p className="text-xs font-medium text-slate-500">
                {t('timesheets.includesPaidBreak', {
                  defaultValue: 'Includes automatic paid break where enabled',
                })}
              </p>
            ) : null}
          </label>
        ) : null}

        <div className="mt-3.5 rounded-2xl border border-[#DCEEFF] bg-[#F5FAFF] px-3 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t('timesheets.totalHours', { defaultValue: 'Total Hours' })}
          </p>
          <p className="mt-1 text-base font-bold tabular-nums text-slate-950">
            {incompletePair ? '—' : formatTotalHours(payable.totalPaidHours)}
          </p>
          {incompletePair ? (
            <p className="mt-0.5 text-[11px] text-rose-600">
              {t('timesheets.errors.timePairShort', {
              defaultValue: TIMESHEET_TIME_PAIR_MESSAGE,
            })}
            </p>
          ) : isFullHoliday ? (
            <p className="mt-0.5 text-[11px] text-slate-500">
              {t('timesheets.fullHolidayOtZero', {
                defaultValue: 'Full day holiday · OT = 0',
              })}
            </p>
          ) : isHalfHoliday ? (
            <p className="mt-0.5 text-[11px] text-slate-500">
              {t('timesheets.holidayPlusWorkOt', {
                defaultValue: 'Holiday + work · OT on work only',
              })}
            </p>
          ) : isManualMode ? (
            <p className="mt-0.5 text-[11px] text-slate-500">
              {t('timesheets.totalFormula', {
                defaultValue: 'Read-only · Basic + OT × multiplier + Additional',
              })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-[#E8F3FE] bg-white/80 p-3.5">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t('timesheets.dailyNote', { defaultValue: 'Daily note' })}
          </span>
          {editable ? (
            <input
              type="text"
              value={entry.dailyComment}
              onChange={(event) =>
                onUpdate(entry.dayDate, {
                  dailyComment: event.target.value,
                })
              }
              placeholder={
                entry.additionalHours > 0
                  ? t('timesheets.noteRequiredPlaceholder', {
                      defaultValue: 'Required — e.g. Night-shift allowance',
                    })
                  : t('timesheets.noteOptionalPlaceholder', {
                      defaultValue: 'Optional note',
                    })
              }
              className={workerFieldClass}
            />
          ) : (
            <p className="min-h-12 rounded-2xl border border-[#D3E9FC] bg-[#F8FBFF] px-3 py-3 text-sm text-slate-800">
              {entry.dailyComment.trim() || '—'}
            </p>
          )}
        </label>
      </div>
    </div>
  )
}

type WorkerMobileDaySelectorProps = {
  entries: TimesheetEntryInput[]
  selectedDayDate: string
  todayDateString: string
  onSelectDay: (dayDate: string) => void
}

/**
 * Compact Mon–Sun day boxes for Worker mobile. Status uses the same
 * getDayIndicatorState rules as the accordion (valid / partial / empty / error).
 * Only one day’s full form is shown below — this strip never stacks full forms.
 */
function WorkerMobileDaySelector({
  entries,
  selectedDayDate,
  todayDateString,
  onSelectDay,
}: WorkerMobileDaySelectorProps) {
  const { t, i18n } = useTranslation('worker')
  return (
    <div
      role="group"
      aria-label={t('timesheets.daysAria', { defaultValue: 'Days this week' })}
      className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="mx-auto grid min-w-[17.5rem] grid-cols-7 gap-1 sm:gap-1.5">
        {entries.map((entry) => {
          const state = getDayIndicatorState(entry)
          const selected = entry.dayDate === selectedDayDate
          const isToday = entry.dayDate === todayDateString
          const shortLabel = formatWorkerTimesheetWeekday(
            entry.dayDate,
            i18n.language,
            'short',
          )
          const statusPhrase = dayIndicatorAriaLabel(state, t)

          return (
            <button
              key={entry.dayDate}
              type="button"
              onClick={() => onSelectDay(entry.dayDate)}
              aria-label={
                isToday
                  ? t('timesheets.dayAriaToday', {
                      day: formatWorkerTimesheetWeekday(
                        entry.dayDate,
                        i18n.language,
                        'long',
                      ),
                      status: statusPhrase,
                      defaultValue: `${formatWorkerTimesheetWeekday(entry.dayDate, i18n.language, 'long')}, ${statusPhrase}, today`,
                    })
                  : t('timesheets.dayAria', {
                      day: formatWorkerTimesheetWeekday(
                        entry.dayDate,
                        i18n.language,
                        'long',
                      ),
                      status: statusPhrase,
                      defaultValue: `${formatWorkerTimesheetWeekday(entry.dayDate, i18n.language, 'long')}, ${statusPhrase}`,
                    })
              }
              aria-pressed={selected}
              className={cn(
                'flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border px-0.5 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F80ED] focus-visible:ring-offset-2',
                state === 'valid' &&
                  'worker-day-complete border-emerald-300 bg-emerald-50 text-[color:var(--worker-primary)]',
                state === 'partial' &&
                  'border-amber-300 bg-amber-50 text-amber-900',
                state === 'error' && 'border-rose-300 bg-rose-50 text-rose-900',
                state === 'empty' && 'border-slate-200 bg-white text-slate-700',
                selected && 'ring-2 ring-[#89CFF0] ring-offset-1',
              )}
            >
              <span className="text-[11px] font-semibold leading-none tracking-tight">
                {shortLabel}
              </span>
              <span
                aria-hidden="true"
                className="flex h-3.5 items-center justify-center"
              >
                {state === 'valid' ? <Check className="size-3" strokeWidth={2.5} /> : null}
                {state === 'partial' ? (
                  <span className="size-1.5 rounded-full bg-amber-500" />
                ) : null}
                {state === 'error' ? (
                  <AlertTriangle className="size-3" strokeWidth={2.5} />
                ) : null}
                {state === 'empty' ? (
                  <span className="size-1 rounded-full bg-slate-300" />
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

type WorkerMobileSelectedDayCardProps = DayFormProps & {
  entry: TimesheetEntryInput
  isToday: boolean
  onSaveDay: () => void
  isSavingDay: boolean
  daySaveState: DaySaveState
}

/** Single expanded day form under the mobile day selector. */
function WorkerMobileSelectedDayCard({
  entry,
  isToday,
  onSaveDay,
  isSavingDay,
  daySaveState,
  editable,
  ...dayFormProps
}: WorkerMobileSelectedDayCardProps) {
  const { t, i18n } = useTranslation('worker')
  const state = getDayIndicatorState(entry)

  return (
    <article
      className={cn(
        'rounded-[1.5rem] border bg-white p-4 shadow-[0_2px_10px_rgba(33,142,231,0.08)]',
        state === 'error' ? 'border-rose-200' : 'border-[#BFE3F5]/80',
        'ring-2 ring-[#2F80ED]/55',
      )}
    >
      <div className="mb-4 flex items-center gap-3 border-b border-[#E8F3FE] pb-3">
        <DayIndicatorDot state={state} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-950">
              {formatWorkerTimesheetDayLabel(entry.dayDate, i18n.language)}
            </h2>
            {isToday ? (
              <span className="rounded-full bg-[#E8F3FE] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0B68BE]">
                {t('timesheets.today', { defaultValue: 'Today' })}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {dayIndicatorAriaLabel(state, t)}
          </p>
        </div>
      </div>

      <WorkerDayFormFields entry={entry} editable={editable} {...dayFormProps} />

      {editable ? (
        <div className="mt-4 space-y-2">
          <Button
            type="button"
            disabled={isSavingDay}
            className="h-12 w-full rounded-2xl bg-[#2F80ED] hover:bg-[#2569C7]"
            onClick={onSaveDay}
          >
            {daySaveState === 'saving' || isSavingDay
              ? t('timesheets.saving', { defaultValue: 'Saving…' })
              : daySaveState === 'saved'
                ? t('timesheets.saved', { defaultValue: 'Saved' })
                : t('timesheets.saveDay', { defaultValue: 'Save Day' })}
          </Button>
          {daySaveState === 'error' ? (
            <p className="text-center text-xs font-medium text-rose-600">
              {t('timesheets.saveDayFailedRetry', {
                defaultValue: 'Could not save day. Try again.',
              })}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

type WorkerDayAccordionRowProps = DayFormProps & {
  entry: TimesheetEntryInput
  isExpanded: boolean
  isToday: boolean
  onToggle: () => void
  onSaveDay: () => void
  isSavingDay: boolean
  daySaveState: DaySaveState
}

/**
 * Desktop (lg+) Current Week — one accordion row per day. Today/selected
 * expands by default; other days stay collapsed. Mobile uses
 * WorkerMobileDaySelector + WorkerMobileSelectedDayCard instead.
 */
function WorkerDayAccordionRow({
  entry,
  isExpanded,
  isToday,
  onToggle,
  onSaveDay,
  isSavingDay,
  daySaveState,
  editable,
  ...dayFormProps
}: WorkerDayAccordionRowProps) {
  const { t, i18n } = useTranslation('worker')
  const state = getDayIndicatorState(entry)
  const payable = getEntryPayableDisplayResult(entry, {
    overtimeRules: dayFormProps.overtimeRules,
    paidBreaks: dayFormProps.paidBreaks,
    overtimeMode: dayFormProps.overtimeMode,
  })
  const showHighlight = isExpanded || isToday

  return (
    <article
      className={cn(
        'rounded-[1.5rem] border bg-white shadow-sm shadow-slate-200/50 transition-shadow',
        state === 'error' ? 'border-rose-200' : 'border-slate-100',
        showHighlight && 'ring-2 ring-[#2F80ED]/70',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex w-full items-center gap-3 rounded-[1.5rem] p-4 text-left"
      >
        <DayIndicatorDot state={state} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-950">
              {formatWorkerTimesheetDayLabel(entry.dayDate, i18n.language)}
            </h2>
            {isToday ? (
              <span className="rounded-full bg-[#F6F9FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#2F80ED]">
                {t('timesheets.today', { defaultValue: 'Today' })}
              </span>
            ) : null}
          </div>
          {!isExpanded ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {collapsedDaySummary(entry, state, t)}
            </p>
          ) : (
            <span className="sr-only">{dayIndicatorAriaLabel(state, t)}</span>
          )}
        </div>
        {!isExpanded && state === 'valid' ? (
          <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-950">
            {formatTotalHours(payable.totalPaidHours)}
          </p>
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-slate-400 transition-transform',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      {isExpanded ? (
        <div className="border-t border-slate-100 p-4">
          <WorkerDayFormFields entry={entry} editable={editable} {...dayFormProps} />

          {editable ? (
            <div className="mt-4 space-y-2">
              <Button
                type="button"
                disabled={isSavingDay}
                className="h-12 w-full rounded-2xl bg-[#2F80ED] hover:bg-[#2569C7]"
                onClick={onSaveDay}
              >
                {daySaveState === 'saving' || isSavingDay
                  ? t('timesheets.saving', { defaultValue: 'Saving…' })
                  : daySaveState === 'saved'
                    ? t('timesheets.saved', { defaultValue: 'Saved' })
                    : t('timesheets.saveDay', { defaultValue: 'Save Day' })}
              </Button>
              {daySaveState === 'error' ? (
                <p className="text-center text-xs font-medium text-rose-600">
                  {t('timesheets.saveDayFailedRetry', {
                defaultValue: 'Could not save day. Try again.',
              })}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export default function WorkerTimesheetsPage() {
  const { t, i18n } = useTranslation('worker')
  const { worker, isLoading: workerLoading, error: workerError } = useCurrentWorker()
  const { companyReady, companyLoading, membershipError } = useCompanyTenantGate()
  const {
    settings: companySettings,
    refreshCompanySettings,
  } = useCompanySettings()
  const {
    effective,
    isLoading: effectiveSettingsLoading,
  } = useWorkerEffectiveTimesheetSettings(worker?.id)

  const timesheetManagementScope = companySettings?.timesheetManagementScope
  /** Only treat as office-managed once settings finished loading with an explicit scope. */
  const officeManagesTimesheets =
    !companyLoading && timesheetManagementScope === 'office'
  const workersManageTimesheets = !officeManagesTimesheets

  const workerMutationOptions = useMemo(
    () =>
      worker
        ? {
            asWorkerSelfService: true as const,
            timesheetManagementScope,
            actingDriverId: worker.id,
          }
        : null,
    [timesheetManagementScope, worker],
  )

  const defaultBreakMinutes = effective?.defaultBreakMinutes ?? 30
  const overtimeMode = effective?.overtimeMode ?? 'Manual'
  const paidBreaks = effective?.paidBreaks ?? false
  const overtimeRules = useMemo(
    () =>
      buildTimesheetOvertimeRules(effective?.overtimeRules ?? {}),
    [effective?.overtimeRules],
  )
  const weekSettings = useMemo(
    () => ({
      timesheetWeekStartDay: effective?.timesheetWeekStartDay ?? 'monday',
    }),
    [effective?.timesheetWeekStartDay],
  )

  const [weekStart, setWeekStart] = useState(() => getDefaultWeekStartMonday())
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null)
  const [entries, setEntries] = useState<TimesheetEntryInput[]>([])
  const [selectedDayDate, setSelectedDayDate] = useState('')
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingDay, setIsSavingDay] = useState(false)
  const [daySaveState, setDaySaveState] = useState<DaySaveState>('idle')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current')
  const [historyDetailId, setHistoryDetailId] = useState<string | null>(null)
  const loadGenerationRef = useRef(0)
  const submitLockRef = useRef(false)

  const todayDateString = useMemo(() => formatLocalDateString(new Date()), [])

  const editable =
    Boolean(timesheet) &&
    workersManageTimesheets &&
    canWorkerEditTimesheet(timesheet!.status)
  const isDirty = editable && entriesSnapshot(entries) !== savedSnapshot
  const isManualMode = overtimeMode === 'Manual'

  const summary = useMemo(
    () =>
      summarizeTimesheetEntries(entries, {
        overtimeRules,
        paidBreaks,
        overtimeMode,
      }),
    [entries, overtimeMode, overtimeRules, paidBreaks],
  )

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.dayDate === selectedDayDate) ?? entries[0] ?? null,
    [entries, selectedDayDate],
  )

  function validateManualAdditional(nextEntries: TimesheetEntryInput[]): string | null {
    for (const entry of nextEntries) {
      if (entry.additionalHours > 0 && !entry.dailyComment.trim()) {
        return t('timesheets.errors.additionalComment', {
          day: formatWorkerTimesheetDayLabel(entry.dayDate, i18n.language),
          defaultValue: `Add a daily comment for ${formatWorkerTimesheetDayLabel(entry.dayDate, i18n.language)} explaining the Additional Hours (for example night-shift allowance).`,
        })
      }
    }
    return null
  }

  function validateEntriesForSave(nextEntries: TimesheetEntryInput[]): string | null {
    for (const entry of nextEntries) {
      const overlapError = validateHolidayWorkOverlap(entry)
      if (overlapError) {
        return t('timesheets.errors.fullHolidayWithWork', {
          day: formatWorkerTimesheetDayLabel(entry.dayDate, i18n.language),
          defaultValue: overlapError,
        })
      }
    }
    return (
      validateTimesheetTimePairs(nextEntries) != null
        ? (() => {
            const incomplete = nextEntries.find(
              (entry) =>
                entry.dayType !== 'holiday' && isIncompleteTimePair(entry),
            )
            return incomplete
              ? t('timesheets.errors.timePair', {
                  day: formatWorkerTimesheetDayLabel(
                    incomplete.dayDate,
                    i18n.language,
                  ),
                  defaultValue: TIMESHEET_TIME_PAIR_MESSAGE,
                })
              : t('timesheets.errors.timePairShort', {
                  defaultValue: TIMESHEET_TIME_PAIR_MESSAGE,
                })
          })()
        : validateManualAdditional(nextEntries)
    )
  }

  const breakOptions = useMemo(
    () => ({
      saturdayUseCompanyDefaultBreak: effective?.saturdayUseCompanyDefaultBreak ?? true,
      sundayUseCompanyDefaultBreak: effective?.sundayUseCompanyDefaultBreak ?? true,
    }),
    [
      effective?.saturdayUseCompanyDefaultBreak,
      effective?.sundayUseCompanyDefaultBreak,
    ],
  )

  const applyLoadedTimesheet = useCallback(
    async (loaded: Timesheet, canEditLoaded: boolean) => {
      const prepared = prepareEntryInputs(
        loaded.weekStart,
        loaded.entries,
        defaultBreakMinutes,
        breakOptions,
      )

      const weekDates = buildWeekDates(loaded.weekStart)
      const weekEnd = weekDates[weekDates.length - 1] ?? loaded.weekStart
      const approvedDays = await fetchApprovedHolidayDaysForWorkerWeek({
        workerId: loaded.driverId,
        weekStart: loaded.weekStart,
        weekEnd,
      })
      const applied = applyApprovedHolidaysToEntries(
        prepared,
        approvedDays,
        effective?.defaultPaidHolidayHours ?? 0,
      )

      const nextEntries = canEditLoaded
        ? recalculateEntryInputs(applied.entries, {
            overtimeMode,
            overtimeRules,
            paidBreaks,
          })
        : applied.entries

      setTimesheet(loaded)
      setEntries(nextEntries)
      setSavedSnapshot(entriesSnapshot(nextEntries))
      setWeekStart(loaded.weekStart)
      setSelectedDayDate((previous) => {
        if (previous && nextEntries.some((entry) => entry.dayDate === previous)) {
          return previous
        }
        return pickDefaultDayDate(nextEntries)
      })
    },
    [
      breakOptions,
      defaultBreakMinutes,
      effective?.defaultPaidHolidayHours,
      overtimeMode,
      overtimeRules,
      paidBreaks,
    ],
  )

  const loadWeek = useCallback(
    async (targetWeekStart: string) => {
      const generation = ++loadGenerationRef.current
      setIsLoading(true)
      setLoadError(null)
      setActionError(null)
      setActionMessage(null)
      setDaySaveState('idle')

      if (!companyReady || !worker) {
        setTimesheet(null)
        setEntries([])
        setSavedSnapshot('')
        setSelectedDayDate('')
        setIsLoading(false)
        setLoadError(
          membershipError ??
            workerError ??
            t('timesheets.errors.profileUnverified', {
              defaultValue: 'Your worker profile could not be verified.',
            }),
        )
        return
      }

      try {
        const normalizedWeek = normalizeWeekStartForCompany(
          targetWeekStart,
          weekSettings,
        )

        if (workersManageTimesheets) {
          const result = await createTimesheet(
            {
              driverId: worker.id,
              weekStart: normalizedWeek,
              vehicleId: worker.defaultVehicleId,
            },
            workerMutationOptions ?? { asWorkerSelfService: true },
          )

          if (generation !== loadGenerationRef.current) return

          if (result.timesheet.driverId !== worker.id) {
            throw new Error('Timesheet does not belong to the signed-in worker.')
          }

          await applyLoadedTimesheet(
            result.timesheet,
            canWorkerEditTimesheet(result.timesheet.status),
          )
        } else {
          const existing = await fetchTimesheetForDriverWeek(worker.id, normalizedWeek)

          if (generation !== loadGenerationRef.current) return

          if (!existing) {
            setTimesheet(null)
            setEntries([])
            setSavedSnapshot('')
            setSelectedDayDate('')
            setWeekStart(normalizedWeek)
            return
          }

          if (existing.driverId !== worker.id) {
            throw new Error('Timesheet does not belong to the signed-in worker.')
          }

          await applyLoadedTimesheet(existing, false)
        }
      } catch (error) {
        if (generation !== loadGenerationRef.current) return
        setTimesheet(null)
        setEntries([])
        setSavedSnapshot('')
        setSelectedDayDate('')
        setLoadError(
          workerCaughtTimesheetError(
            error,
            t,
            'timesheets.errors.loadFailed',
            'Unable to load your timesheet.',
          ),
        )
      } finally {
        if (generation === loadGenerationRef.current) {
          setIsLoading(false)
        }
      }
    },
    [
      applyLoadedTimesheet,
      companyReady,
      membershipError,
      weekSettings,
      worker,
      workerError,
      workerMutationOptions,
      workersManageTimesheets,
    ],
  )

  useEffect(() => {
    refreshCompanySettings()
  }, [refreshCompanySettings])

  useEffect(() => {
    if (
      workerLoading ||
      companyLoading ||
      effectiveSettingsLoading ||
      !companyReady ||
      !worker ||
      !effective
    ) {
      if (
        !workerLoading &&
        !companyLoading &&
        !effectiveSettingsLoading &&
        (!companyReady || !worker)
      ) {
        setIsLoading(false)
        setLoadError(
          membershipError ??
            workerError ??
            t('timesheets.errors.profileUnverified', {
              defaultValue: 'Your worker profile could not be verified.',
            }),
        )
      }
      return
    }
    void loadWeek(weekStart)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadWeek is stable enough for week/worker keys
  }, [
    companyLoading,
    companyReady,
    effective,
    effectiveSettingsLoading,
    membershipError,
    weekStart,
    worker,
    workerError,
    workerLoading,
    timesheetManagementScope,
    workersManageTimesheets,
  ])

  useEffect(() => {
    if (!isDirty) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  function confirmDiscardIfDirty(): boolean {
    if (!isDirty) return true
    return window.confirm(
      t('timesheets.discardUnsaved', {
        defaultValue:
          'You have unsaved timesheet changes. Leave this week without saving?',
      }),
    )
  }

  function updateEntry(
    dayDate: string,
    patch: Partial<
      Pick<
        TimesheetEntryInput,
        | 'startTime'
        | 'finishTime'
        | 'breakMinutes'
        | 'dailyComment'
        | 'additionalHours'
        | 'totalMinutes'
        | 'overtimeMinutes'
        | 'dayType'
      >
    >,
  ) {
    if (!editable) return

    setEntries((current) =>
      recalculateEntryInputs(
        current.map((entry) => {
          if (entry.dayDate !== dayDate) return entry
          if (
            patch.dayType === 'holiday' ||
            patch.dayType === 'holiday_am' ||
            patch.dayType === 'holiday_pm'
          ) {
            const portion = holidayPortionFromDayType(patch.dayType) ?? 'full'
            return applyHolidayDayHours(
              { ...entry, ...patch },
              effective?.defaultPaidHolidayHours ?? 0,
              portion,
            )
          }
          if (patch.dayType === 'work' && isHolidayDay(entry)) {
            return applyWorkDayType({ ...entry, ...patch }, defaultBreakMinutes)
          }
          return { ...entry, ...patch }
        }),
        {
          overtimeMode,
          overtimeRules,
          paidBreaks,
        },
      ),
    )
    setActionError(null)
    setActionMessage(null)
    setDaySaveState('idle')
  }

  /** Week-level draft persist: validates and upserts every day, reloads timesheet.
   * Kept for internal use (Submit Week) — no separate Worker "Save Draft" button. */
  async function persistWeekEntries(successMessage?: string | null): Promise<boolean> {
    if (!timesheet || !editable) return false

    const recalculated = recalculateEntryInputs(entries, {
      overtimeMode,
      overtimeRules,
      paidBreaks,
    })
    const validationError = validateEntriesForSave(recalculated)
    if (validationError) {
      setActionError(validationError)
      return false
    }

    await upsertTimesheetEntries(
      timesheet.id,
      recalculated,
      workerMutationOptions ?? { asWorkerSelfService: true },
    )
    const refreshed = await fetchTimesheetById(timesheet.id)
    if (refreshed.driverId !== worker?.id) {
      throw new Error('Timesheet does not belong to the signed-in worker.')
    }
    await applyLoadedTimesheet(refreshed, canWorkerEditTimesheet(refreshed.status))
    if (successMessage) {
      setActionMessage(successMessage)
    }
    return true
  }

  /**
   * Save Day: upsert only the selected day's entry.
   * Does not send or overwrite other dates, and does not reset local edits
   * on unsaved days.
   */
  async function handleSaveDay() {
    if (!timesheet || !editable || isSavingDay || isSubmitting) return

    const dayDate = selectedEntry?.dayDate ?? selectedDayDate
    const currentDay = entries.find((entry) => entry.dayDate === dayDate)
    if (!dayDate || !currentDay) {
      setDaySaveState('error')
      setActionError(
        t('timesheets.errors.selectDay', { defaultValue: 'Select a day to save.' }),
      )
      return
    }

    setIsSavingDay(true)
    setDaySaveState('saving')
    setActionError(null)
    setActionMessage(null)

    try {
      // Recalculate only this day so Automatic derived fields stay consistent.
      // Manual Basic / OT / Additional remain authoritative inside recalculateEntryInputs.
      const [recalculatedDay] = recalculateEntryInputs([currentDay], {
        overtimeMode,
        overtimeRules,
        paidBreaks,
      })

      const dayValidationError = validateEntriesForSave([recalculatedDay])
      if (dayValidationError) {
        setDaySaveState('error')
        setActionError(dayValidationError)
        return
      }

      const updatedTimesheet = await upsertTimesheetEntries(
        timesheet.id,
        [recalculatedDay],
        workerMutationOptions ?? { asWorkerSelfService: true },
      )
      if (updatedTimesheet.driverId !== worker?.id) {
        throw new Error('Timesheet does not belong to the signed-in worker.')
      }

      const serverDay = updatedTimesheet.entries.find(
        (entry) => entry.dayDate === dayDate,
      )
      const savedDay: TimesheetEntryInput = {
        ...recalculatedDay,
        id: serverDay?.id ?? recalculatedDay.id,
      }

      setEntries((current) => {
        const next = current.map((entry) =>
          entry.dayDate === dayDate ? savedDay : entry,
        )
        setSavedSnapshot((previous) =>
          mergeSavedDayIntoSnapshot(previous, next, dayDate),
        )
        return next
      })
      setTimesheet((previous) =>
        previous
          ? {
              ...previous,
              updatedAt: updatedTimesheet.updatedAt,
            }
          : previous,
      )
      setSelectedDayDate(dayDate)
      setActionMessage(t('timesheets.daySaved', { defaultValue: 'Day saved.' }))
      setDaySaveState('saved')
    } catch (error) {
      setDaySaveState('error')
      setActionError(
        workerCaughtTimesheetError(
          error,
          t,
          'timesheets.errors.saveFailed',
          'Failed to save day.',
        ),
      )
    } finally {
      setIsSavingDay(false)
    }
  }

  /** First press: validate only, then open confirmation. Never submits here. */
  function handleSubmitClick() {
    if (!timesheet || !editable || isSavingDay || isSubmitting) return

    setActionError(null)
    setActionMessage(null)
    setDaySaveState('idle')

    const recalculated = recalculateEntryInputs(entries, {
      overtimeMode,
      overtimeRules,
      paidBreaks,
    })
    const validationError = validateEntriesForSave(recalculated)
    if (validationError) {
      setActionError(validationError)
      setSubmitConfirmOpen(false)
      return
    }

    setSubmitConfirmOpen(true)
  }

  function handleSubmitDialogCancel() {
    if (isSubmitting) return
    setSubmitConfirmOpen(false)
  }

  /** Final confirmation — persist week draft entries, then submit for office review. */
  async function handleSubmitConfirm() {
    if (
      !timesheet ||
      !worker ||
      !editable ||
      isSavingDay ||
      isSubmitting ||
      submitLockRef.current
    ) {
      return
    }

    submitLockRef.current = true
    setIsSubmitting(true)
    setActionError(null)
    setActionMessage(null)
    setDaySaveState('idle')

    try {
      const saved = await persistWeekEntries(null)
      if (!saved) {
        setSubmitConfirmOpen(false)
        return
      }
      const submitted = await submitTimesheet(
        timesheet.id,
        {
          workerConfirmed: true,
          confirmedByDriverId: worker.id,
        },
        workerMutationOptions ?? { asWorkerSelfService: true },
      )
      const refreshed = await fetchTimesheetById(submitted.id)
      if (refreshed.driverId !== worker?.id) {
        throw new Error('Timesheet does not belong to the signed-in worker.')
      }
      await applyLoadedTimesheet(refreshed, false)
      setSubmitConfirmOpen(false)
      setActionMessage(
        t('timesheets.submittedReview', {
          defaultValue: 'Submitted for office review.',
        }),
      )
    } catch (error) {
      setActionError(
        workerCaughtTimesheetError(
          error,
          t,
          'timesheets.errors.submitFailed',
          'Failed to submit timesheet.',
        ),
      )
    } finally {
      setIsSubmitting(false)
      submitLockRef.current = false
    }
  }

  async function handleDownloadPdf() {
    if (!timesheet || !worker || isDownloadingPdf) return

    setIsDownloadingPdf(true)
    setActionError(null)

    try {
      const refreshed = await fetchTimesheetById(timesheet.id)
      if (refreshed.driverId !== worker.id) {
        throw new Error('Timesheet does not belong to the signed-in worker.')
      }
      await downloadTimesheetPdf(refreshed)
      setActionMessage(t('timesheets.pdfDownloaded', { defaultValue: 'PDF downloaded.' }))
    } catch (error) {
      setActionError(
        workerCaughtTimesheetError(
          error,
          t,
          'timesheets.errors.pdfFailed',
          'Failed to download PDF.',
        ),
      )
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  function handleWeekChange(deltaWeeks: number) {
    if (!confirmDiscardIfDirty()) return
    setWeekStart((current) => shiftWeekStart(current, deltaWeeks, weekSettings))
  }

  const handleOpenHistoryWeek = useCallback((timesheetId: string) => {
    setHistoryDetailId(timesheetId)
  }, [])

  const handleCloseHistoryDetail = useCallback(() => {
    setHistoryDetailId(null)
  }, [])

  if (workerLoading || companyLoading || (isLoading && !timesheet && !loadError)) {
    return (
      <div
        className="min-h-[50vh] rounded-[1.75rem] bg-white/60"
        aria-label={t('timesheets.loading', { defaultValue: 'Loading timesheet' })}
        role="status"
      />
    )
  }

  if (workerError || !worker) {
    return (
      <div className="rounded-[1.75rem] border border-rose-100 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-950">
          {t('timesheets.title', { defaultValue: 'My Timesheet' })}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {workerError ??
            t('home.profileMissing', {
              defaultValue:
                'We could not find a worker profile linked to your account. Please contact your manager.',
            })}
        </p>
      </div>
    )
  }

  if (loadError && !timesheet) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            {t('timesheets.title', { defaultValue: 'My Timesheet' })}
          </h1>
        </header>
        <div className="rounded-[1.75rem] border border-rose-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">{loadError}</p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => void loadWeek(weekStart)}
          >
            {t('timesheets.tryAgain', { defaultValue: 'Try again' })}
          </Button>
        </div>
      </div>
    )
  }

  const status = timesheet?.status ?? 'Draft'
  const busy = isSavingDay || isSubmitting || isLoading || isDownloadingPdf

  const dayFormProps = {
    editable,
    isManualMode,
    overtimeMode,
    overtimeRules,
    paidBreaks,
    onUpdate: updateEntry,
  } as const

  return (
    <div className="mx-auto max-w-md space-y-4 overflow-x-hidden lg:max-w-2xl">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              {t('timesheets.title', { defaultValue: 'My Timesheet' })}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {timesheet
                ? `${t('timesheets.weekTitle', {
                    weekNumber: timesheet.weekNumber,
                    defaultValue: `Timesheet Week ${timesheet.weekNumber}`,
                  })} · ${formatWorkerTimesheetWeekRange(timesheet.weekStart, i18n.language)}`
                : t('nav.timesheets', { defaultValue: 'Timesheets' })}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span
              className={cn(
                'inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
                getStatusBadgeClass(status),
              )}
            >
              {t(timesheetStatusI18nKey(status), { defaultValue: status })}
            </span>
            {timesheet ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDownloadPdf()}
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="size-3.5" aria-hidden="true" />
                {isDownloadingPdf
                  ? t('timesheets.pdfBusy', { defaultValue: 'PDF…' })
                  : t('timesheets.pdf', { defaultValue: 'PDF' })}
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-[1.5rem] border border-slate-100 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            aria-label={t('timesheets.previousWeek', { defaultValue: 'Previous week' })}
            disabled={busy}
            onClick={() => handleWeekChange(-1)}
            className="inline-flex size-11 items-center justify-center rounded-2xl text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold text-slate-950">
              {t('timesheets.weekNumber', {
                weekNumber: timesheet?.weekNumber ?? '—',
                defaultValue: `Week ${timesheet?.weekNumber ?? '—'}`,
              })}
            </p>
            <p className="truncate text-xs text-slate-500">
              {timesheet
                ? formatWorkerTimesheetWeekRange(timesheet.weekStart, i18n.language)
                : '—'}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('timesheets.nextWeek', { defaultValue: 'Next week' })}
            disabled={busy}
            onClick={() => handleWeekChange(1)}
            className="inline-flex size-11 items-center justify-center rounded-2xl text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </header>

      {actionError ? (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError}
        </p>
      ) : null}
      {actionMessage ? (
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {actionMessage}
        </p>
      ) : null}

      {!officeManagesTimesheets ? null : (
        <div className="rounded-2xl border border-[#BFE3F5] bg-[#F5FAFF] px-4 py-3">
          <p className="text-sm font-medium text-slate-700">
            {t('timesheets.officeManages', {
              defaultValue:
                'Your Office manages Timesheets. You can view yours here; only Office can create or edit them.',
            })}
          </p>
        </div>
      )}
      {!officeManagesTimesheets && timesheet && !editable ? (
        <div className="space-y-2 rounded-2xl border border-[#BFE3F5] bg-[#F5FAFF] px-4 py-3">
          <p className="text-sm font-medium text-slate-700">
            {t('timesheets.readOnlyBanner', {
              status: t(timesheetStatusI18nKey(status), { defaultValue: status }),
              defaultValue: `This timesheet is ${status} and is read-only. Editing historical Submitted or Approved records is not allowed.`,
            })}
          </p>
          <dl className="grid grid-cols-1 gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
            <div className="flex justify-between gap-2 sm:block">
              <dt className="font-semibold uppercase tracking-[0.08em] text-slate-400">
                {t('timesheets.submitted', { defaultValue: 'Submitted' })}
              </dt>
              <dd className="font-medium text-slate-700">
                {status === 'Draft' || !timesheet?.submittedAt
                  ? '—'
                  : formatWorkerTimesheetDateTime(
                      timesheet.submittedAt,
                      i18n.language,
                    ) ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <dt className="font-semibold uppercase tracking-[0.08em] text-slate-400">
                {t('timesheets.approved', { defaultValue: 'Approved' })}
              </dt>
              <dd className="font-medium text-slate-700">
                {status === 'Approved'
                  ? formatWorkerTimesheetDateTime(
                      timesheet?.approvedAt,
                      i18n.language,
                    ) ?? '—'
                  : '—'}
              </dd>
            </div>
            {timesheet?.workerConfirmed && timesheet.confirmedAt ? (
              <div className="flex justify-between gap-2 sm:col-span-2 sm:block">
                <dt className="font-semibold uppercase tracking-[0.08em] text-slate-400">
                  {t('timesheets.confirmation', { defaultValue: 'Confirmation' })}
                </dt>
                <dd className="font-medium text-slate-700">
                  {t('timesheets.confirmedBy', {
                    name: timesheet.driverName,
                    defaultValue: `Confirmed by ${timesheet.driverName}`,
                  })}
                  {formatWorkerTimesheetDateTime(
                    timesheet.confirmedAt,
                    i18n.language,
                  )
                    ? ` · ${formatWorkerTimesheetDateTime(timesheet.confirmedAt, i18n.language)}`
                    : ''}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      <div
        role="tablist"
        aria-label={t('timesheets.viewAria', { defaultValue: 'Timesheet view' })}
        className="grid grid-cols-2 gap-1 rounded-[1.25rem] border border-[#BFE3F5]/70 bg-white p-1.5 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'current'}
          onClick={() => {
            setActiveTab('current')
          }}
          className={cn(
            'h-10 rounded-2xl text-sm font-semibold transition-colors',
            activeTab === 'current'
              ? 'bg-[#2F80ED] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50',
          )}
        >
          {t('timesheets.currentWeek', { defaultValue: 'Current Week' })}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'history'}
          onClick={() => {
            if (!confirmDiscardIfDirty()) return
            setActiveTab('history')
          }}
          className={cn(
            'h-10 rounded-2xl text-sm font-semibold transition-colors',
            activeTab === 'history'
              ? 'bg-[#2F80ED] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50',
          )}
        >
          {t('timesheets.history', { defaultValue: 'History' })}
        </button>
      </div>

      {activeTab === 'current' ? (
        !timesheet ? (
          <div className="rounded-[1.75rem] border border-[#BFE3F5] bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">
              {workersManageTimesheets
                ? t('timesheets.noTimesheetSelf', {
                    defaultValue: 'No Timesheet is available for this week yet.',
                  })
                : t('timesheets.noTimesheetOffice', {
                    defaultValue:
                      'No Timesheet has been created for this week yet. Your Office will create it when ready.',
                  })}
            </p>
          </div>
        ) : (
        <>
          <section
            aria-label={t('timesheets.weekSummaryAria', {
              defaultValue: 'Week summary',
            })}
            className="grid grid-cols-3 gap-2.5"
          >
            <SummaryStat
              label={t('timesheets.worked', { defaultValue: 'Worked' })}
              value={formatHours(summary.workedHours)}
            />
            <SummaryStat
              label={t('timesheets.overtime', { defaultValue: 'Overtime' })}
              value={formatHours(summary.overtimeHours)}
            />
            <SummaryStat
              label={t('timesheets.total', { defaultValue: 'Total' })}
              value={formatTotalHours(summary.totalHours)}
            />
          </section>

          <div className="space-y-3 lg:hidden">
            <WorkerMobileDaySelector
              entries={entries}
              selectedDayDate={selectedEntry?.dayDate ?? selectedDayDate}
              todayDateString={todayDateString}
              onSelectDay={setSelectedDayDate}
            />

            {selectedEntry ? (
              <WorkerMobileSelectedDayCard
                entry={selectedEntry}
                isToday={selectedEntry.dayDate === todayDateString}
                onSaveDay={() => void handleSaveDay()}
                isSavingDay={isSavingDay}
                daySaveState={daySaveState}
                {...dayFormProps}
              />
            ) : null}
          </div>

          <div
            role="list"
            aria-label={t('timesheets.daysAria', { defaultValue: 'Days this week' })}
            className="hidden space-y-2 lg:block"
          >
            {entries.map((entry) => {
              const isExpanded = entry.dayDate === (selectedEntry?.dayDate ?? selectedDayDate)
              return (
                <WorkerDayAccordionRow
                  key={entry.dayDate}
                  entry={entry}
                  isExpanded={isExpanded}
                  isToday={entry.dayDate === todayDateString}
                  onToggle={() =>
                    setSelectedDayDate((current) =>
                      current === entry.dayDate ? current : entry.dayDate,
                    )
                  }
                  onSaveDay={() => void handleSaveDay()}
                  isSavingDay={isSavingDay}
                  daySaveState={isExpanded ? daySaveState : 'idle'}
                  {...dayFormProps}
                />
              )
            })}
          </div>

          {editable ? (
            <div className="pt-1 pb-2">
              <Button
                type="button"
                disabled={busy}
                className="h-12 w-full rounded-2xl bg-[#2F80ED] text-base font-semibold hover:bg-[#2569C7]"
                onClick={handleSubmitClick}
              >
                {isSubmitting
                  ? t('timesheets.submitting', { defaultValue: 'Submitting…' })
                  : status === 'Rejected'
                    ? t('timesheets.resubmitWeek', { defaultValue: 'Resubmit Week' })
                    : t('timesheets.submitWeek', { defaultValue: 'Submit Week' })}
              </Button>
            </div>
          ) : null}

          <p className="px-1 pb-2 text-center text-xs text-slate-400">
            {t('timesheets.settingsHint', {
              defaultValue: 'Company Timesheet rules are shown in Worker Settings.',
            })}
          </p>
        </>
        )
      ) : (
        <WorkerTimesheetHistoryList
          workerId={worker.id}
          onOpenWeek={(item) => handleOpenHistoryWeek(item.id)}
        />
      )}

      <WorkerSubmitTimesheetDialog
        open={submitConfirmOpen}
        weekNumber={timesheet?.weekNumber ?? '—'}
        weekRangeLabel={
          timesheet
            ? formatWorkerTimesheetWeekRange(timesheet.weekStart, i18n.language)
            : '—'
        }
        totalHoursLabel={formatTotalHours(summary.totalHours)}
        statusLabel={t(timesheetStatusI18nKey(status), { defaultValue: status })}
        isSubmitting={isSubmitting}
        onCancel={handleSubmitDialogCancel}
        onConfirm={() => void handleSubmitConfirm()}
      />

      <WorkerTimesheetHistoryDetailModal
        timesheetId={historyDetailId}
        overtimeMode={overtimeMode}
        overtimeRules={overtimeRules}
        paidBreaks={paidBreaks}
        onClose={handleCloseHistoryDetail}
      />
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#DCEEFF] bg-[#F5FAFF] px-3 py-3 text-center shadow-[0_1px_3px_rgba(33,142,231,0.06)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5499BF]">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold tabular-nums text-slate-950">{value}</p>
    </div>
  )
}

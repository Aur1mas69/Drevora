import { TimesheetDecimalHoursInput } from '@/components/timesheets/TimesheetDecimalHoursInput'
import { TimesheetTimeInput } from '@/components/timesheets/TimesheetTimeInput'
import { WorkerSubmitTimesheetDialog } from '@/components/timesheets/WorkerSubmitTimesheetDialog'
import { Button } from '@/components/ui/button'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { downloadTimesheetPdf } from '@/lib/export/modules/timesheetsExport'
import type { Timesheet, TimesheetEntryInput, TimesheetStatus } from '@/lib/timesheetTypes'
import {
  buildTimesheetOvertimeRules,
  decimalHoursToMinutes,
  formatDayLabel,
  formatHours,
  formatHoursFromMinutes,
  formatLocalDateString,
  formatTotalHours,
  getDefaultWeekStartMonday,
  getEntryPayableDisplayResult,
  getStatusBadgeClass,
  getStatusLabel,
  minutesToDecimalHours,
  normalizeWeekStartForCompany,
  parseLocalDate,
  prepareEntryInputs,
  recalculateEntryInputs,
  summarizeTimesheetEntries,
} from '@/lib/timesheetUtils'
import { cn } from '@/lib/utils'
import {
  createTimesheet,
  fetchTimesheetById,
  submitTimesheet,
  TimesheetsServiceError,
  upsertTimesheetEntries,
} from '@/services/timesheetsService'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const BREAK_OPTIONS = [0, 15, 30, 45, 60] as const

function canWorkerEditTimesheet(status: TimesheetStatus): boolean {
  return status === 'Draft' || status === 'Rejected'
}

function shiftWeekStart(weekStart: string, deltaWeeks: number): string {
  const date = parseLocalDate(weekStart)
  date.setDate(date.getDate() + deltaWeeks * 7)
  return normalizeWeekStartForCompany(formatLocalDateString(date))
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

function dayHasEnteredValues(entry: TimesheetEntryInput): boolean {
  return Boolean(
    entry.startTime ||
      entry.finishTime ||
      entry.totalMinutes > 0 ||
      entry.overtimeMinutes > 0 ||
      entry.additionalHours > 0 ||
      entry.dailyComment.trim(),
  )
}

function dayShortLabel(dayDate: string): string {
  return parseLocalDate(dayDate).toLocaleDateString('en-GB', { weekday: 'short' })
}

const workerFieldClass =
  'h-12 w-full rounded-2xl border border-slate-200 bg-[#F8FBFF] px-3 text-sm font-semibold tabular-nums text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/20 disabled:opacity-60'

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
      >
    >,
  ) => void
}

function WorkerDayForm({
  entry,
  editable,
  isManualMode,
  overtimeMode,
  overtimeRules,
  paidBreaks,
  onUpdate,
}: DayFormProps) {
  const payable = getEntryPayableDisplayResult(entry, {
    overtimeRules,
    paidBreaks,
    overtimeMode,
  })

  return (
    <article className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">
          {formatDayLabel(entry.dayDate)}
        </h2>
        <p className="text-xs font-medium tabular-nums text-slate-400">
          {formatTotalHours(payable.totalPaidHours)}
        </p>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Shift
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Start
            </span>
            {editable ? (
              <TimesheetTimeInput
                value={entry.startTime}
                onChange={(value) => onUpdate(entry.dayDate, { startTime: value })}
                timeFormat="24-hour"
                className={workerFieldClass}
              />
            ) : (
              <p className="flex h-12 items-center rounded-2xl border border-slate-100 bg-slate-50 px-3 text-sm font-semibold tabular-nums text-slate-700">
                {entry.startTime?.slice(0, 5) || '—'}
              </p>
            )}
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Finish
            </span>
            {editable ? (
              <TimesheetTimeInput
                value={entry.finishTime}
                onChange={(value) => onUpdate(entry.dayDate, { finishTime: value })}
                timeFormat="24-hour"
                className={workerFieldClass}
              />
            ) : (
              <p className="flex h-12 items-center rounded-2xl border border-slate-100 bg-slate-50 px-3 text-sm font-semibold tabular-nums text-slate-700">
                {entry.finishTime?.slice(0, 5) || '—'}
              </p>
            )}
          </label>
        </div>

        <label className="mt-3 block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Break
          </span>
          {editable ? (
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
                  {minutes === 0 ? '0m' : `${minutes}m`}
                </option>
              ))}
              {!BREAK_OPTIONS.includes(
                entry.breakMinutes as (typeof BREAK_OPTIONS)[number],
              ) ? (
                <option value={entry.breakMinutes}>{entry.breakMinutes}m</option>
              ) : null}
            </select>
          ) : (
            <p className="flex h-12 items-center rounded-2xl border border-slate-100 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
              {entry.breakMinutes}m
            </p>
          )}
        </label>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Paid hours
        </p>

        {isManualMode ? (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Basic Hours
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
                  aria-label={`Basic Hours for ${formatDayLabel(entry.dayDate)}`}
                />
              ) : (
                <p className="flex h-12 items-center rounded-2xl border border-slate-100 bg-slate-50 px-3 text-sm font-semibold tabular-nums text-slate-700">
                  {formatHours(payable.basicHours)}
                </p>
              )}
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Overtime
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
                  aria-label={`Overtime for ${formatDayLabel(entry.dayDate)}`}
                />
              ) : (
                <p className="flex h-12 items-center rounded-2xl border border-slate-100 bg-slate-50 px-3 text-sm font-semibold tabular-nums text-slate-700">
                  {formatHours(payable.overtimeDisplayHours)}
                </p>
              )}
            </label>
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-[#F6F9FF] px-3 py-3 text-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Basic
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-slate-950">
                {formatHours(payable.basicHours)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Overtime
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-slate-950">
                {formatHours(payable.overtimeDisplayHours)}
              </p>
            </div>
          </div>
        )}

        <label className="mt-3 block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Additional Hours
          </span>
          {editable ? (
            <TimesheetDecimalHoursInput
              value={entry.additionalHours}
              onChange={(hours) => onUpdate(entry.dayDate, { additionalHours: hours })}
              className={workerFieldClass}
              aria-label={`Additional Hours for ${formatDayLabel(entry.dayDate)}`}
            />
          ) : (
            <p className="flex h-12 items-center rounded-2xl border border-slate-100 bg-slate-50 px-3 text-sm font-semibold tabular-nums text-slate-700">
              {formatHours(payable.additionalHours)}
            </p>
          )}
          {!isManualMode &&
          !payable.weekendGuaranteeDay &&
          payable.additionalHours > entry.additionalHours ? (
            <p className="text-xs font-medium text-slate-500">
              Includes automatic paid break where enabled
            </p>
          ) : null}
        </label>

        <div className="mt-3 rounded-2xl bg-[#F6F9FF] px-3 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Total Hours
          </p>
          <p className="mt-1 text-base font-bold tabular-nums text-slate-950">
            {formatTotalHours(payable.totalPaidHours)}
          </p>
          {isManualMode ? (
            <p className="mt-0.5 text-[11px] text-slate-500">
              Read-only · Basic + OT + Additional
            </p>
          ) : null}
        </div>
      </div>

      <label className="mt-4 block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Daily note
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
                ? 'Required — e.g. Night-shift allowance'
                : 'Optional note'
            }
            className="h-12 w-full rounded-2xl border border-slate-200 bg-[#F8FBFF] px-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/20"
          />
        ) : (
          <p className="min-h-12 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            {entry.dailyComment.trim() || '—'}
          </p>
        )}
      </label>
    </article>
  )
}

export default function WorkerTimesheetsPage() {
  const { worker, isLoading: workerLoading, error: workerError } = useCurrentWorker()
  const { companyReady, companyLoading, membershipError } = useCompanyTenantGate()
  const {
    defaultBreakMinutes,
    overtimeMode,
    overtimeAfterHours,
    overtimeMultiplier,
    settings,
  } = useCompanySettings()

  const [weekStart, setWeekStart] = useState(() => getDefaultWeekStartMonday())
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null)
  const [entries, setEntries] = useState<TimesheetEntryInput[]>([])
  const [selectedDayDate, setSelectedDayDate] = useState('')
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingDay, setIsSavingDay] = useState(false)
  const [daySaveState, setDaySaveState] = useState<DaySaveState>('idle')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const loadGenerationRef = useRef(0)
  const submitLockRef = useRef(false)

  const paidBreaks = settings?.paidBreaks ?? false
  const overtimeRules = useMemo(
    () =>
      buildTimesheetOvertimeRules({
        overtimeAfterHours,
        overtimeMultiplier,
        saturdayOvertimeEnabled: settings?.saturdayOvertimeEnabled,
        saturdayOvertimeAfterHours: settings?.saturdayOvertimeAfterHours,
        saturdayOvertimeMultiplier: settings?.saturdayOvertimeMultiplier,
        saturdayGuaranteedPaidHours: settings?.saturdayGuaranteedPaidHours,
        sundayOvertimeEnabled: settings?.sundayOvertimeEnabled,
        sundayOvertimeAfterHours: settings?.sundayOvertimeAfterHours,
        sundayOvertimeMultiplier: settings?.sundayOvertimeMultiplier,
        sundayGuaranteedPaidHours: settings?.sundayGuaranteedPaidHours,
      }),
    [
      overtimeAfterHours,
      overtimeMultiplier,
      settings?.saturdayGuaranteedPaidHours,
      settings?.saturdayOvertimeAfterHours,
      settings?.saturdayOvertimeEnabled,
      settings?.saturdayOvertimeMultiplier,
      settings?.sundayGuaranteedPaidHours,
      settings?.sundayOvertimeAfterHours,
      settings?.sundayOvertimeEnabled,
      settings?.sundayOvertimeMultiplier,
    ],
  )

  const editable = timesheet ? canWorkerEditTimesheet(timesheet.status) : false
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
        return `Add a daily comment for ${formatDayLabel(entry.dayDate)} explaining the Additional Hours (for example night-shift allowance).`
      }
    }
    return null
  }

  const breakOptions = useMemo(
    () => ({
      saturdayUseCompanyDefaultBreak: settings?.saturdayUseCompanyDefaultBreak ?? true,
      sundayUseCompanyDefaultBreak: settings?.sundayUseCompanyDefaultBreak ?? true,
    }),
    [
      settings?.saturdayUseCompanyDefaultBreak,
      settings?.sundayUseCompanyDefaultBreak,
    ],
  )

  const applyLoadedTimesheet = useCallback(
    (loaded: Timesheet) => {
      const prepared = prepareEntryInputs(
        loaded.weekStart,
        loaded.entries,
        defaultBreakMinutes,
        breakOptions,
      )
      const nextEntries = canWorkerEditTimesheet(loaded.status)
        ? recalculateEntryInputs(prepared, {
            overtimeMode,
            overtimeRules,
            paidBreaks,
          })
        : prepared

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
    [breakOptions, defaultBreakMinutes, overtimeMode, overtimeRules, paidBreaks],
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
            'Your worker profile could not be verified.',
        )
        return
      }

      try {
        const normalizedWeek = normalizeWeekStartForCompany(targetWeekStart)
        const result = await createTimesheet({
          driverId: worker.id,
          weekStart: normalizedWeek,
          vehicleId: worker.defaultVehicleId,
        })

        if (generation !== loadGenerationRef.current) return

        if (result.timesheet.driverId !== worker.id) {
          throw new Error('Timesheet does not belong to the signed-in worker.')
        }

        applyLoadedTimesheet(result.timesheet)
      } catch (error) {
        if (generation !== loadGenerationRef.current) return
        setTimesheet(null)
        setEntries([])
        setSavedSnapshot('')
        setSelectedDayDate('')
        setLoadError(
          error instanceof TimesheetsServiceError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Unable to load your timesheet.',
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
      worker,
      workerError,
    ],
  )

  useEffect(() => {
    if (workerLoading || companyLoading || !companyReady || !worker) {
      if (!workerLoading && !companyLoading && (!companyReady || !worker)) {
        setIsLoading(false)
        setLoadError(
          membershipError ??
            workerError ??
            'Your worker profile could not be verified.',
        )
      }
      return
    }
    void loadWeek(weekStart)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadWeek is stable enough for week/worker keys
  }, [
    companyLoading,
    companyReady,
    membershipError,
    weekStart,
    worker,
    workerError,
    workerLoading,
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
      'You have unsaved timesheet changes. Leave this week without saving?',
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
      >
    >,
  ) {
    if (!editable) return

    setEntries((current) =>
      recalculateEntryInputs(
        current.map((entry) =>
          entry.dayDate === dayDate ? { ...entry, ...patch } : entry,
        ),
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

  /** Week-level save: persists every day and reloads the full timesheet. */
  async function persistWeekEntries(successMessage: string): Promise<boolean> {
    if (!timesheet || !editable) return false

    const recalculated = recalculateEntryInputs(entries, {
      overtimeMode,
      overtimeRules,
      paidBreaks,
    })
    const validationError = validateManualAdditional(recalculated)
    if (validationError) {
      setActionError(validationError)
      return false
    }

    await upsertTimesheetEntries(timesheet.id, recalculated)
    const refreshed = await fetchTimesheetById(timesheet.id)
    if (refreshed.driverId !== worker?.id) {
      throw new Error('Timesheet does not belong to the signed-in worker.')
    }
    applyLoadedTimesheet(refreshed)
    setActionMessage(successMessage)
    return true
  }

  /**
   * Save Day: upsert only the selected day's entry.
   * Does not send or overwrite other dates, and does not reset local edits
   * on unsaved days.
   */
  async function handleSaveDay() {
    if (!timesheet || !editable || isSaving || isSavingDay || isSubmitting) return

    const dayDate = selectedEntry?.dayDate ?? selectedDayDate
    const currentDay = entries.find((entry) => entry.dayDate === dayDate)
    if (!dayDate || !currentDay) {
      setDaySaveState('error')
      setActionError('Select a day to save.')
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

      if (
        recalculatedDay.additionalHours > 0 &&
        !recalculatedDay.dailyComment.trim()
      ) {
        setDaySaveState('error')
        setActionError(
          `Add a daily comment for ${formatDayLabel(recalculatedDay.dayDate)} explaining the Additional Hours (for example night-shift allowance).`,
        )
        return
      }

      const updatedTimesheet = await upsertTimesheetEntries(timesheet.id, [
        recalculatedDay,
      ])
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
      setActionMessage('Day saved.')
      setDaySaveState('saved')
    } catch (error) {
      setDaySaveState('error')
      setActionError(
        error instanceof TimesheetsServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to save day.',
      )
    } finally {
      setIsSavingDay(false)
    }
  }

  async function handleSaveDraft() {
    if (!timesheet || !editable || isSaving || isSavingDay || isSubmitting) return

    setIsSaving(true)
    setActionError(null)
    setActionMessage(null)
    setDaySaveState('idle')

    try {
      await persistWeekEntries(
        timesheet.status === 'Rejected' ? 'Changes saved.' : 'Draft saved.',
      )
    } catch (error) {
      setActionError(
        error instanceof TimesheetsServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to save timesheet.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  /** First press: validate only, then open confirmation. Never submits here. */
  function handleSubmitClick() {
    if (!timesheet || !editable || isSaving || isSavingDay || isSubmitting) return

    setActionError(null)
    setActionMessage(null)
    setDaySaveState('idle')

    const recalculated = recalculateEntryInputs(entries, {
      overtimeMode,
      overtimeRules,
      paidBreaks,
    })
    const validationError = validateManualAdditional(recalculated)
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

  /** Final confirmation only — existing week submission path. */
  async function handleSubmitConfirm() {
    if (
      !timesheet ||
      !editable ||
      isSaving ||
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
      const recalculated = recalculateEntryInputs(entries, {
        overtimeMode,
        overtimeRules,
        paidBreaks,
      })
      const validationError = validateManualAdditional(recalculated)
      if (validationError) {
        setActionError(validationError)
        setSubmitConfirmOpen(false)
        return
      }
      await upsertTimesheetEntries(timesheet.id, recalculated)
      const submitted = await submitTimesheet(timesheet.id)
      const refreshed = await fetchTimesheetById(submitted.id)
      if (refreshed.driverId !== worker?.id) {
        throw new Error('Timesheet does not belong to the signed-in worker.')
      }
      applyLoadedTimesheet(refreshed)
      setSubmitConfirmOpen(false)
      setActionMessage('Submitted for office review.')
    } catch (error) {
      setActionError(
        error instanceof TimesheetsServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to submit timesheet.',
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
      setActionMessage('PDF downloaded.')
    } catch (error) {
      setActionError(
        error instanceof TimesheetsServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to download PDF.',
      )
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  function handleWeekChange(deltaWeeks: number) {
    if (!confirmDiscardIfDirty()) return
    setWeekStart((current) => shiftWeekStart(current, deltaWeeks))
  }

  if (workerLoading || companyLoading || (isLoading && !timesheet && !loadError)) {
    return (
      <div
        className="min-h-[50vh] rounded-[1.75rem] bg-white/60"
        aria-label="Loading timesheet"
        role="status"
      />
    )
  }

  if (workerError || !worker) {
    return (
      <div className="rounded-[1.75rem] border border-rose-100 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-950">My Timesheet</h1>
        <p className="mt-2 text-sm text-slate-600">
          {workerError ??
            'We could not find a worker profile linked to your account.'}
        </p>
      </div>
    )
  }

  if (loadError && !timesheet) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            My Timesheet
          </h1>
        </header>
        <div className="rounded-[1.75rem] border border-rose-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">{loadError}</p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => void loadWeek(weekStart)}
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  const status = timesheet?.status ?? 'Draft'
  const busy = isSaving || isSavingDay || isSubmitting || isLoading || isDownloadingPdf

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
              My Timesheet
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {timesheet?.weekTitle ?? 'Timesheet'} ·{' '}
              {timesheet?.weekRangeLabel ?? timesheet?.weekLabel}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span
              className={cn(
                'inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
                getStatusBadgeClass(status),
              )}
            >
              {getStatusLabel(status)}
            </span>
            {timesheet ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDownloadPdf()}
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="size-3.5" aria-hidden="true" />
                {isDownloadingPdf ? 'PDF…' : 'PDF'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-[1.5rem] border border-slate-100 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            aria-label="Previous week"
            disabled={busy}
            onClick={() => handleWeekChange(-1)}
            className="inline-flex size-11 items-center justify-center rounded-2xl text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold text-slate-950">
              Week {timesheet?.weekNumber ?? '—'}
            </p>
            <p className="truncate text-xs text-slate-500">
              {timesheet?.weekRangeLabel}
            </p>
          </div>
          <button
            type="button"
            aria-label="Next week"
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

      {!editable ? (
        <p className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600">
          This timesheet is {status.toLowerCase()} and is read-only for Workers.
          Office reviews Submitted and Approved timesheets.
        </p>
      ) : null}

      {/* Mobile: compact day selector + one day form */}
      <div className="space-y-3 lg:hidden">
        <nav
          aria-label="Select day"
          className="grid grid-cols-7 gap-1 rounded-[1.25rem] border border-slate-100 bg-white p-1.5 shadow-sm"
        >
          {entries.map((entry) => {
            const selected = entry.dayDate === (selectedEntry?.dayDate ?? selectedDayDate)
            const hasValues = dayHasEnteredValues(entry)
            return (
              <button
                key={entry.dayDate}
                type="button"
                aria-pressed={selected}
                aria-label={`${formatDayLabel(entry.dayDate)}${hasValues ? ', has saved values' : ''}`}
                onClick={() => setSelectedDayDate(entry.dayDate)}
                className={cn(
                  'relative flex min-h-11 flex-col items-center justify-center rounded-xl px-0.5 py-1.5 text-[11px] font-semibold transition-colors',
                  selected
                    ? 'bg-[#2F80ED] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                <span>{dayShortLabel(entry.dayDate)}</span>
                {hasValues ? (
                  <span
                    className={cn(
                      'mt-1 size-1.5 rounded-full',
                      selected ? 'bg-white' : 'bg-[#2F80ED]',
                    )}
                    aria-hidden="true"
                  />
                ) : (
                  <span className="mt-1 size-1.5" aria-hidden="true" />
                )}
              </button>
            )
          })}
        </nav>

        {selectedEntry ? (
          <WorkerDayForm entry={selectedEntry} {...dayFormProps} />
        ) : null}

        {editable ? (
          <div className="space-y-2">
            <Button
              type="button"
              disabled={busy}
              className="h-12 w-full rounded-2xl bg-[#2F80ED] hover:bg-[#2569C7]"
              onClick={() => void handleSaveDay()}
            >
              {daySaveState === 'saving' || isSavingDay
                ? 'Saving…'
                : daySaveState === 'saved'
                  ? 'Saved'
                  : 'Save Day'}
            </Button>
            {daySaveState === 'error' ? (
              <p className="text-center text-xs font-medium text-rose-600">
                Could not save day. Try again.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Desktop: full week */}
      <section className="hidden space-y-3 lg:block">
        {entries.map((entry) => (
          <WorkerDayForm key={entry.dayDate} entry={entry} {...dayFormProps} />
        ))}
      </section>

      <section className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
          Weekly summary
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 min-[380px]:grid-cols-3">
          <SummaryStat label="Basic Hours" value={formatHours(summary.workedHours)} />
          <SummaryStat label="Break" value={formatHoursFromMinutes(summary.breakMinutes)} />
          <SummaryStat label="Overtime" value={formatHours(summary.overtimeHours)} />
          <SummaryStat
            label="Additional Hours"
            value={formatHours(summary.additionalHours)}
          />
          <SummaryStat label="Total Hours" value={formatTotalHours(summary.totalHours)} />
          <SummaryStat label="Status" value={getStatusLabel(status)} />
        </div>
      </section>

      {editable ? (
        <div className="grid gap-3 pb-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="h-12 rounded-2xl"
            onClick={() => void handleSaveDraft()}
          >
            {isSaving
              ? 'Saving…'
              : status === 'Rejected'
                ? 'Save Changes'
                : 'Save Draft'}
          </Button>
          <Button
            type="button"
            disabled={busy}
            className="h-12 rounded-2xl bg-[#2F80ED] hover:bg-[#2569C7]"
            onClick={handleSubmitClick}
          >
            {status === 'Rejected' ? 'Resubmit' : 'Submit'}
          </Button>
        </div>
      ) : null}

      <p className="px-1 pb-2 text-center text-xs text-slate-400">
        Company Timesheet rules are shown in Worker Settings.
      </p>

      <WorkerSubmitTimesheetDialog
        open={submitConfirmOpen}
        weekNumber={timesheet?.weekNumber ?? '—'}
        weekRangeLabel={timesheet?.weekRangeLabel ?? '—'}
        totalHoursLabel={formatTotalHours(summary.totalHours)}
        statusLabel={getStatusLabel(status)}
        isSubmitting={isSubmitting}
        onCancel={handleSubmitDialogCancel}
        onConfirm={() => void handleSubmitConfirm()}
      />
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#F6F9FF] px-3 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  )
}

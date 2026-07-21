import { TimesheetTimeInput } from '@/components/timesheets/TimesheetTimeInput'
import { Button } from '@/components/ui/button'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import type { Timesheet, TimesheetEntryInput, TimesheetStatus } from '@/lib/timesheetTypes'
import {
  buildTimesheetOvertimeRules,
  formatDayLabel,
  formatHours,
  formatHoursFromMinutes,
  formatLocalDateString,
  formatTotalHours,
  getDefaultWeekStartMonday,
  getEntryPayableDisplayResult,
  getStatusBadgeClass,
  getStatusLabel,
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
import { ChevronLeft, ChevronRight } from 'lucide-react'
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

function entriesSnapshot(entries: TimesheetEntryInput[]): string {
  return JSON.stringify(
    entries.map((entry) => ({
      id: entry.id ?? null,
      dayDate: entry.dayDate,
      startTime: entry.startTime,
      finishTime: entry.finishTime,
      breakMinutes: entry.breakMinutes,
      overtimeMinutes: entry.overtimeMinutes,
      additionalHours: entry.additionalHours,
      dailyComment: entry.dailyComment,
    })),
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
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  const summary = useMemo(
    () =>
      summarizeTimesheetEntries(entries, {
        overtimeRules,
        paidBreaks,
      }),
    [entries, overtimeRules, paidBreaks],
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

      if (!companyReady || !worker) {
        setTimesheet(null)
        setEntries([])
        setSavedSnapshot('')
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
    // Intentionally keyed by worker/company readiness and week only — avoid
    // reloading mid-edit when overtime rule object identities change.
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
  }

  async function handleSaveDraft() {
    if (!timesheet || !editable || isSaving || isSubmitting) return

    setIsSaving(true)
    setActionError(null)
    setActionMessage(null)

    try {
      const recalculated = recalculateEntryInputs(entries, {
        overtimeMode,
        overtimeRules,
        paidBreaks,
      })
      const validationError = validateManualAdditional(recalculated)
      if (validationError) {
        setActionError(validationError)
        return
      }
      await upsertTimesheetEntries(timesheet.id, recalculated)
      const refreshed = await fetchTimesheetById(timesheet.id)
      if (refreshed.driverId !== worker?.id) {
        throw new Error('Timesheet does not belong to the signed-in worker.')
      }
      applyLoadedTimesheet(refreshed)
      setActionMessage(
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

  async function handleSubmit() {
    if (!timesheet || !editable || isSaving || isSubmitting || submitLockRef.current) {
      return
    }

    submitLockRef.current = true
    setIsSubmitting(true)
    setActionError(null)
    setActionMessage(null)

    try {
      const recalculated = recalculateEntryInputs(entries, {
        overtimeMode,
        overtimeRules,
        paidBreaks,
      })
      const validationError = validateManualAdditional(recalculated)
      if (validationError) {
        setActionError(validationError)
        return
      }
      await upsertTimesheetEntries(timesheet.id, recalculated)
      const submitted = await submitTimesheet(timesheet.id)
      const refreshed = await fetchTimesheetById(submitted.id)
      if (refreshed.driverId !== worker?.id) {
        throw new Error('Timesheet does not belong to the signed-in worker.')
      }
      applyLoadedTimesheet(refreshed)
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
  const busy = isSaving || isSubmitting || isLoading

  return (
    <div className="mx-auto max-w-md space-y-4 lg:max-w-2xl">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              My Timesheet
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {timesheet?.weekTitle ?? 'Timesheet'} ·{' '}
              {timesheet?.weekRangeLabel ?? timesheet?.weekLabel}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
              getStatusBadgeClass(status),
            )}
          >
            {getStatusLabel(status)}
          </span>
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

      <section className="space-y-3">
        {entries.map((entry) => {
          const payable = getEntryPayableDisplayResult(entry, {
            overtimeRules,
            paidBreaks,
          })

          return (
          <article
            key={entry.dayDate}
            className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/50"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-950">
                {formatDayLabel(entry.dayDate)}
              </h2>
              <p className="text-xs font-medium text-slate-400">
                {payable.basicHours > 0 ? formatHours(payable.basicHours) : '—'}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Start
                </span>
                {editable ? (
                  <TimesheetTimeInput
                    value={entry.startTime}
                    onChange={(value) =>
                      updateEntry(entry.dayDate, { startTime: value })
                    }
                    timeFormat="24-hour"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-[#F8FBFF] px-3 text-sm font-semibold tabular-nums"
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
                    onChange={(value) =>
                      updateEntry(entry.dayDate, { finishTime: value })
                    }
                    timeFormat="24-hour"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-[#F8FBFF] px-3 text-sm font-semibold tabular-nums"
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
                    updateEntry(entry.dayDate, {
                      breakMinutes: Number(event.target.value),
                    })
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-[#F8FBFF] px-3 text-sm font-semibold text-slate-950"
                >
                  {BREAK_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutes
                    </option>
                  ))}
                  {!BREAK_OPTIONS.includes(
                    entry.breakMinutes as (typeof BREAK_OPTIONS)[number],
                  ) ? (
                    <option value={entry.breakMinutes}>
                      {entry.breakMinutes} minutes
                    </option>
                  ) : null}
                </select>
              ) : (
                <p className="flex h-12 items-center rounded-2xl border border-slate-100 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                  {entry.breakMinutes} minutes
                </p>
              )}
            </label>

            <label className="mt-3 block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Additional Hours
              </span>
              {editable ? (
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  value={entry.additionalHours > 0 ? entry.additionalHours : ''}
                  onChange={(event) =>
                    updateEntry(entry.dayDate, {
                      additionalHours: Math.max(
                        0,
                        Number.parseFloat(event.target.value) || 0,
                      ),
                    })
                  }
                  placeholder="0"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-[#F8FBFF] px-3 text-sm font-semibold tabular-nums text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/20"
                  aria-label={`Manual Additional Hours for ${formatDayLabel(entry.dayDate)}`}
                />
              ) : (
                <p className="flex h-12 items-center rounded-2xl border border-slate-100 bg-slate-50 px-3 text-sm font-semibold tabular-nums text-slate-700">
                  {payable.additionalHours > 0
                    ? formatHours(payable.additionalHours)
                    : '—'}
                </p>
              )}
              {!payable.weekendGuaranteeDay &&
              payable.additionalHours > entry.additionalHours ? (
                <p className="text-xs font-medium text-slate-500">
                  Includes automatic paid break where enabled
                </p>
              ) : null}
            </label>

            <label className="mt-3 block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Daily comment
              </span>
              {editable ? (
                <input
                  type="text"
                  value={entry.dailyComment}
                  onChange={(event) =>
                    updateEntry(entry.dayDate, {
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

            <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-[#F6F9FF] px-3 py-3 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Basic
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {payable.basicHours > 0 ? formatHours(payable.basicHours) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Overtime
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {payable.overtimeDisplayHours > 0
                    ? formatHours(payable.overtimeDisplayHours)
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Total
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {formatTotalHours(payable.totalPaidHours)}
                </p>
              </div>
            </div>
          </article>
          )
        })}
      </section>

      <section className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
          Weekly summary
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 min-[380px]:grid-cols-3">
          <SummaryStat label="Basic Hours" value={formatHours(summary.workedHours)} />
          <SummaryStat label="Break" value={formatHoursFromMinutes(summary.breakMinutes)} />
          <SummaryStat
            label="Overtime"
            value={formatHours(summary.overtimeHours)}
          />
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
            onClick={() => void handleSubmit()}
          >
            {isSubmitting
              ? 'Submitting…'
              : status === 'Rejected'
                ? 'Resubmit'
                : 'Submit'}
          </Button>
        </div>
      ) : null}

      <section className="rounded-[1.5rem] border border-dashed border-slate-200 bg-[#F6F9FF] p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">Timesheet settings</p>
        <p className="mt-1">
          Calculations use your company rules (breaks, overtime mode, weekend
          guaranteed hours and multipliers). Per-Worker editable settings are not
          stored yet, so Workers cannot change company-wide rules here. No Night
          Shift setting exists in DREVORA.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Mode: {overtimeMode} · Break default: {defaultBreakMinutes}m · After{' '}
          {overtimeAfterHours}h × {overtimeMultiplier}
        </p>
      </section>
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

import { TimesheetDecimalHoursInput } from '@/components/timesheets/TimesheetDecimalHoursInput'
import { TimesheetTimeInput } from '@/components/timesheets/TimesheetTimeInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { Timesheet, TimesheetEntryInput } from '@/lib/timesheetTypes'
import type { OvertimeMode, TimesheetOvertimeRules } from '@/lib/companySettingsTypes'
import type { CompanyTimeFormat } from '@/lib/dateTimeFormat'
import {
  applyViewModeEntryTotals,
  buildTimesheetOvertimeRules,
  canEditTimesheet,
  decimalHoursToMinutes,
  entryHasStartAndFinish,
  formatBreak,
  formatDayLabel,
  formatHours,
  formatHoursFromMinutes,
  formatTotalHours,
  formatTimesheetSubmittedAt,
  getEntryPaidBreakMinutes,
  getEntryPayableDisplayResult,
  getStatusBadgeClass,
  getStatusLabel,
  minutesToDecimalHours,
  prepareEntryInputs,
  recalculateEntryInputs,
  summarizeTimesheetEntries,
} from '@/lib/timesheetUtils'
import {
  adminText,
  adminTextMuted,
} from '@/lib/adminUiStyles'
import { Download, Loader2, MessageSquare, Pencil, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [locked])
}

type TimesheetDrawerProps = {
  timesheet: Timesheet | null
  mode: 'view' | 'edit'
  isSaving?: boolean
  saveError?: string | null
  isDownloadingPdf?: boolean
  onClose: () => void
  onEdit?: () => void
  onDownloadPdf?: () => void
  onSave?: (entries: TimesheetEntryInput[]) => Promise<void>
  onSubmit?: (entries: TimesheetEntryInput[]) => Promise<void>
}

const inputClassName =
  'h-8 rounded-[10px] border-[#D3E9FC] bg-[#F5FAFF] px-2.5 text-xs font-medium tabular-nums text-[#113C69] shadow-inner shadow-[#D3E9FC]/20 placeholder:text-[#5499BF] focus-visible:border-[#218EE7] focus-visible:ring-2 focus-visible:ring-[#218EE7]/30 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder:text-slate-500'
const dailyCommentInputClassName =
  'h-8 rounded-[10px] border-[#D3E9FC] bg-[#F5FAFF] px-2.5 text-xs font-medium text-[#113C69] shadow-inner shadow-[#D3E9FC]/20 placeholder:text-[#5499BF] focus-visible:border-[#218EE7] focus-visible:ring-2 focus-visible:ring-[#218EE7]/30 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder:text-slate-500'

const tableHeadClassName =
  'px-1.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#0D477F] sm:px-2'
const tableCellClassName = 'px-1.5 py-2 align-middle sm:px-2'
const dayColumnHeadClassName = `${tableHeadClassName} whitespace-nowrap`
const dayColumnCellClassName = `${tableCellClassName} whitespace-nowrap text-[12px] leading-tight font-semibold text-[#113C69] dark:text-slate-100`

function TimesheetDailyCommentField({
  dailyComment,
  editable,
  onDailyCommentChange,
  compact = false,
}: {
  dailyComment: string
  editable: boolean
  onDailyCommentChange: (nextValue: string) => void
  compact?: boolean
}) {
  if (!editable) {
    if (!dailyComment.trim()) {
      return <span className={`text-xs ${adminTextMuted}`}>—</span>
    }

    return (
      <p className={`text-xs leading-5 ${adminText}`} title={dailyComment}>
        {dailyComment}
      </p>
    )
  }

  return (
    <div className={compact ? 'space-y-1' : 'relative'}>
      {!compact ? (
        <MessageSquare
          className={`pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 ${
            dailyComment.trim() ? 'text-[#218EE7]' : 'text-[#89CFF0]'
          }`}
          aria-hidden="true"
        />
      ) : null}
      <Input
        type="text"
        maxLength={280}
        placeholder="Daily note…"
        value={dailyComment}
        onChange={(event) => onDailyCommentChange(event.target.value)}
        className={`${dailyCommentInputClassName} ${compact ? '' : 'pl-8'}`}
        aria-label="Daily note"
      />
    </div>
  )
}

export function TimesheetDrawer({
  timesheet,
  mode,
  isSaving = false,
  saveError = null,
  isDownloadingPdf = false,
  onClose,
  onEdit,
  onDownloadPdf,
  onSave,
  onSubmit,
}: TimesheetDrawerProps) {
  const {
    formatTime,
    timeFormat,
    overtimeAfterHours,
    overtimeMode,
    overtimeMultiplier,
    defaultBreakMinutes,
    settings,
  } = useCompanySettings()
  const [draftEntries, setDraftEntries] = useState<TimesheetEntryInput[]>([])
  const [localError, setLocalError] = useState<string | null>(null)

  const overtimeRules = useMemo(
    () =>
      buildTimesheetOvertimeRules({
        overtimeAfterHours,
        overtimeMultiplier,
        saturdayOvertimeEnabled: settings?.saturdayOvertimeEnabled ?? false,
        saturdayOvertimeAfterHours: settings?.saturdayOvertimeAfterHours ?? 6,
        saturdayOvertimeMultiplier: settings?.saturdayOvertimeMultiplier ?? 1.5,
        saturdayGuaranteedPaidHours: settings?.saturdayGuaranteedPaidHours ?? 10,
        sundayOvertimeEnabled: settings?.sundayOvertimeEnabled ?? false,
        sundayOvertimeAfterHours: settings?.sundayOvertimeAfterHours ?? 0,
        sundayOvertimeMultiplier: settings?.sundayOvertimeMultiplier ?? 2,
        sundayGuaranteedPaidHours: settings?.sundayGuaranteedPaidHours ?? 10,
      }),
    [overtimeAfterHours, overtimeMultiplier, settings],
  )

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

  const recalcOptions = useMemo(
    () => ({
      overtimeMode,
      overtimeRules,
      paidBreaks: settings?.paidBreaks ?? false,
    }),
    [overtimeMode, overtimeRules, settings?.paidBreaks],
  )

  useEffect(() => {
    if (!timesheet) return
    setDraftEntries(
      prepareEntryInputs(
        timesheet.weekStart,
        timesheet.entries,
        defaultBreakMinutes,
        breakOptions,
      ),
    )
  }, [timesheet?.id])

  const canEdit = timesheet ? canEditTimesheet(timesheet.status) : false
  const isEditable = mode === 'edit' && canEdit

  useBodyScrollLock(Boolean(timesheet))

  useEffect(() => {
    if (!timesheet) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) {
        onClose()
        return
      }

      if (isSaving) return

      if (
        isEditable &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 's'
      ) {
        event.preventDefault()
        void onSave?.(recalculateEntryInputs(draftEntries, recalcOptions))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [draftEntries, isEditable, isSaving, onClose, onSave, recalcOptions, timesheet])

  const displayEntries = useMemo(() => {
    if (!timesheet) return []

    if (!isEditable) {
      return applyViewModeEntryTotals(
        prepareEntryInputs(
          timesheet.weekStart,
          timesheet.entries,
          defaultBreakMinutes,
          breakOptions,
        ),
        {
          paidBreaks: recalcOptions.paidBreaks,
          overtimeMode: recalcOptions.overtimeMode,
        },
      )
    }

    return recalculateEntryInputs(draftEntries, recalcOptions)
  }, [breakOptions, defaultBreakMinutes, draftEntries, isEditable, recalcOptions, timesheet])

  const paidBreaks = recalcOptions.paidBreaks

  const summary = useMemo(() => {
    if (!timesheet) {
      return {
        workedMinutes: 0,
        workedHours: 0,
        breakMinutes: 0,
        breakHours: 0,
        overtimeHours: 0,
        additionalHours: 0,
        paidBreakMinutes: 0,
        manualAdditionalHours: 0,
        totalHours: 0,
      }
    }

    const entriesForSummary = displayEntries.map((entry) => ({
      dayDate: entry.dayDate,
      startTime: entry.startTime,
      breakMinutes: entry.breakMinutes,
      finishTime: entry.finishTime,
      totalMinutes: entry.totalMinutes,
      overtimeMinutes: entry.overtimeMinutes,
      additionalHours: entry.additionalHours,
    }))

    return summarizeTimesheetEntries(entriesForSummary, {
      overtimeRules,
      paidBreaks,
      overtimeMode,
    })
  }, [displayEntries, overtimeMode, overtimeRules, paidBreaks, timesheet])

  if (!timesheet) return null

  function updateEntry(dayDate: string, patch: Partial<TimesheetEntryInput>) {
    setLocalError(null)
    setDraftEntries((current) =>
      recalculateEntryInputs(
        current.map((entry) =>
          entry.dayDate === dayDate ? { ...entry, ...patch } : entry,
        ),
        recalcOptions,
      ),
    )
  }

  function validateManualAdditional(entries: TimesheetEntryInput[]): string | null {
    for (const entry of entries) {
      if (entry.additionalHours > 0 && !entry.dailyComment.trim()) {
        return `Add a daily note for ${formatDayLabel(entry.dayDate)} explaining the Additional Hours (for example night-shift allowance).`
      }
    }
    return null
  }

  async function handleSaveDraft() {
    const next = recalculateEntryInputs(draftEntries, recalcOptions)
    const validationError = validateManualAdditional(next)
    if (validationError) {
      setLocalError(validationError)
      return
    }
    setLocalError(null)
    await onSave?.(next)
  }

  async function handleSubmit() {
    const next = recalculateEntryInputs(draftEntries, recalcOptions)
    const validationError = validateManualAdditional(next)
    if (validationError) {
      setLocalError(validationError)
      return
    }
    setLocalError(null)
    await onSubmit?.(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden overscroll-none">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] touch-none"
        aria-label="Close timesheet drawer"
        onClick={onClose}
      />

      <aside
        className="relative flex max-h-[100dvh] w-full max-w-4xl min-h-0 flex-col self-start overflow-hidden border-l border-[#BDDDFB] bg-gradient-to-br from-[#F5FAFF] via-[#E8F3FE] to-[#D3E9FC] shadow-[-20px_0_60px_rgba(11,38,70,0.16)] dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/40 dark:backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="timesheet-drawer-title"
      >
        <div className="shrink-0 border-b border-[#BDDDFB]/80 bg-white/35 px-5 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95 sm:px-6">
          <div className="rounded-2xl border border-[#D3E9FC] bg-white/75 p-4 shadow-sm shadow-[#BDDDFB]/30 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#3D7A9C] dark:text-slate-400">
                {isEditable ? 'Edit timesheet' : 'View timesheet'}
                {isEditable ? ' · Ctrl+S to save' : ''}
              </p>
              <h2
                id="timesheet-drawer-title"
                className="mt-1.5 text-2xl font-bold tracking-[-0.03em] text-[#113C69] dark:text-slate-50 sm:text-[1.75rem]"
              >
                {timesheet.driverName}
              </h2>
              <p className="mt-2 text-lg font-bold tracking-[-0.02em] text-[#0D477F] dark:text-blue-300">
                {timesheet.weekTitle}
              </p>
              <p className="mt-1 text-sm font-medium text-[#3D7A9C] dark:text-slate-300">
                {timesheet.weekRangeLabel}
              </p>
              {timesheet.status !== 'Draft' && timesheet.submittedAt && isEditable ? (
                <p className="mt-2 text-sm font-medium text-[#3D7A9C] dark:text-slate-300">
                  Submitted to director:{' '}
                  {formatTimesheetSubmittedAt(timesheet.submittedAt, { separator: 'comma' })}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isSaving}
              className="size-10 shrink-0 rounded-[12px] text-[#0D477F] hover:bg-[#E8F3FE] dark:text-slate-400 dark:hover:bg-slate-800/50"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <HeaderBadge label={timesheet.driverRole ?? 'Worker'} />
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold ${getStatusBadgeClass(timesheet.status)}`}
            >
              {getStatusLabel(timesheet.status)}
            </span>
            {!isEditable && timesheet.status !== 'Draft' && timesheet.submittedAt ? (
              <span className="inline-flex items-center rounded-full border border-[#BDDDFB] bg-[#F5FAFF] px-3 py-1.5 text-[11px] font-medium text-[#3D7A9C] dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-300">
                Submitted to director:{' '}
                {formatTimesheetSubmittedAt(timesheet.submittedAt, { separator: 'comma' })}
              </span>
            ) : null}
            <HeaderBadge label={`OT mode: ${overtimeMode}`} />
            {canEdit ? (
              <span
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 ${
                  isEditable
                    ? 'border-[#83C1F6] bg-[#E1EEFD] text-[#218EE7] dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60'
                    : 'border-[#D3E9FC] bg-[#F5FAFF] text-[#3D7A9C] dark:bg-slate-800/70 dark:text-slate-400 dark:ring-white/10'
                }`}
              >
                {isEditable ? 'Editing' : 'Read-only'}
              </span>
            ) : null}
            {onDownloadPdf ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSaving || isDownloadingPdf}
                onClick={onDownloadPdf}
                className="h-8 rounded-full border-[#BDDDFB] bg-[#F5FAFF] px-3 text-[11px] font-semibold text-[#0D477F] dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-3.5" aria-hidden="true" />
                )}
                Download PDF
              </Button>
            ) : null}
          </div>
          </div>
        </div>

        {saveError || localError ? (
          <div className="mx-5 mt-3 shrink-0 rounded-[10px] bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60 sm:mx-6">
            {localError ?? saveError}
          </div>
        ) : null}

        {isEditable && timesheet.status === 'Approved' ? (
          <div className="mx-5 mt-3 shrink-0 rounded-[10px] bg-[#E8F3FE] px-3 py-2 text-xs font-medium text-[#0A539A] ring-1 ring-[#BDDDFB] dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/50 sm:mx-6">
            This timesheet is approved. Changes will update the approved record.
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pt-4 pb-2 touch-pan-y [-webkit-overflow-scrolling:touch] sm:px-6">
          {/* Mobile stacked day cards */}
          <div className="space-y-2.5 md:hidden">
            {displayEntries.map((entry, index) => (
              <TimesheetDayCard
                key={entry.dayDate}
                entry={entry}
                index={index}
                isEditable={isEditable}
                paidBreaks={paidBreaks}
                overtimeMode={overtimeMode}
                overtimeRules={overtimeRules}
                timeFormat={timeFormat}
                formatTime={formatTime}
                onUpdate={updateEntry}
              />
            ))}
          </div>

          {/* Desktop compact table — no horizontal scroll at normal drawer widths */}
          <div className="hidden max-w-full rounded-2xl border border-[#D3E9FC] bg-white/80 shadow-sm shadow-[#BDDDFB]/30 dark:border-white/10 dark:bg-slate-900/70 md:block">
            <table className="w-full table-fixed border-collapse text-left text-xs">
              <thead className="border-b border-[#BDDDFB] bg-[#E8F3FE]">
                <tr>
                  <th className={`${dayColumnHeadClassName} w-[16%]`}>Day</th>
                  <th className={`${tableHeadClassName} w-[18%]`}>Shift</th>
                  <th className={`${tableHeadClassName} w-[9%]`}>Break</th>
                  <th className={`${tableHeadClassName} w-[9%]`}>Basic</th>
                  <th className={`${tableHeadClassName} w-[9%]`}>OT</th>
                  <th className={`${tableHeadClassName} w-[13%]`}>Add. Hrs</th>
                  <th className={`${tableHeadClassName} w-[10%]`}>Total</th>
                  <th className={`${tableHeadClassName} w-[16%] text-center`}>
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayEntries.map((entry, index) => (
                  <TimesheetDayRow
                    key={entry.dayDate}
                    entry={entry}
                    index={index}
                    isEditable={isEditable}
                    paidBreaks={paidBreaks}
                    overtimeMode={overtimeMode}
                    overtimeRules={overtimeRules}
                    timeFormat={timeFormat}
                    formatTime={formatTime}
                    onUpdate={updateEntry}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 rounded-2xl border border-[#D3E9FC] bg-white/55 p-2.5 text-xs shadow-sm shadow-[#BDDDFB]/25 dark:border-white/10 dark:bg-slate-900/60 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryItem
              label="Basic Hours"
              value={summary.workedHours}
            />
            <SummaryItem label="Break" display={formatBreak(summary.breakMinutes)} />
            <SummaryItem label="Overtime" value={summary.overtimeHours} />
            <SummaryItem
              label="Additional Hours"
              value={summary.additionalHours}
              hint={
                summary.paidBreakMinutes > 0 || summary.manualAdditionalHours > 0
                  ? [
                      summary.paidBreakMinutes > 0
                        ? `Paid break: ${formatHoursFromMinutes(summary.paidBreakMinutes)}`
                        : null,
                      summary.manualAdditionalHours > 0
                        ? `Manual: ${formatHours(summary.manualAdditionalHours)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : undefined
              }
            />
            <SummaryItem
              label="Total Hours"
              display={formatTotalHours(summary.totalHours)}
              emphasized
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-[#BDDDFB]/80 bg-white/70 px-5 py-3.5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95 sm:px-6">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 rounded-[10px] px-3.5 text-xs font-semibold text-[#0D477F] hover:bg-[#E8F3FE] dark:text-slate-300 dark:hover:bg-slate-800/50"
            >
              Close
            </Button>

            {mode === 'view' && canEdit ? (
              <Button
                type="button"
                onClick={onEdit}
                disabled={isSaving}
                className="h-9 rounded-[10px] bg-white/80 px-3.5 text-xs font-semibold text-[#0B68BE] ring-1 ring-[#BDDDFB] hover:bg-[#E8F3FE] dark:bg-slate-800/70 dark:text-blue-300 dark:ring-white/10 dark:hover:bg-slate-700/50"
              >
                <Pencil className="mr-1.5 size-3.5" />
                Edit
              </Button>
            ) : null}

            {isEditable ? (
              <>
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSaveDraft()}
                  className="h-9 rounded-[10px] bg-white/80 px-3.5 text-xs font-semibold text-[#0B68BE] ring-1 ring-[#BDDDFB] hover:bg-[#E8F3FE] dark:bg-slate-800/70 dark:text-blue-300 dark:ring-white/10 dark:hover:bg-slate-700/50"
                >
                  {isSaving ? 'Saving…' : 'Save draft'}
                </Button>
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSubmit()}
                  className="h-9 rounded-[10px] bg-[#218EE7] px-3.5 text-xs font-semibold text-white shadow-sm shadow-[#218EE7]/25 hover:bg-[#0B68BE]"
                >
                  {isSaving ? 'Submitting…' : 'Submit'}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  )
}

function HeaderBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-[#BDDDFB] bg-[#E8F3FE] px-3 py-1.5 text-[11px] font-semibold text-[#0A539A] dark:border-white/10 dark:bg-slate-800/70 dark:text-blue-300"
    >
      {label}
    </span>
  )
}

function SummaryItem({
  label,
  value,
  valueMinutes,
  display,
  hint,
  emphasized = false,
}: {
  label: string
  value?: number
  valueMinutes?: number
  display?: string
  hint?: string
  emphasized?: boolean
}) {
  const resolvedDisplay =
    display ??
    (valueMinutes !== undefined
      ? formatHoursFromMinutes(valueMinutes)
      : formatHours(value ?? 0))

  return (
    <div
      className={`rounded-[12px] border px-3 py-2.5 shadow-sm dark:bg-slate-800/70 dark:ring-white/10 ${
        emphasized
          ? 'border-[#83C1F6] bg-gradient-to-br from-[#E1EEFD] to-[#BDDDFB] shadow-[#83C1F6]/25'
          : 'border-[#D3E9FC] bg-white/80 shadow-[#BDDDFB]/20'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#3D7A9C] dark:text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-base font-bold tabular-nums ${
          emphasized ? 'text-[#218EE7] dark:text-blue-300' : 'text-[#113C69] dark:text-slate-50'
        }`}
      >
        {resolvedDisplay}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[10px] font-medium leading-snug text-[#5499BF] dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function AdditionalHoursCell({
  entry,
  paidBreaks,
  overtimeMode,
  overtimeRules,
  isEditable,
  index,
  onUpdate,
  compact = false,
}: {
  entry: TimesheetEntryInput
  paidBreaks: boolean
  overtimeMode: OvertimeMode
  overtimeRules: TimesheetOvertimeRules
  isEditable: boolean
  index: number
  onUpdate: (dayDate: string, patch: Partial<TimesheetEntryInput>) => void
  compact?: boolean
}) {
  const payable = getEntryPayableDisplayResult(entry, {
    paidBreaks,
    overtimeMode,
    overtimeRules,
  })
  const paidBreakMinutes =
    overtimeMode === 'Manual' || payable.weekendGuaranteeDay
      ? 0
      : getEntryPaidBreakMinutes(entry, paidBreaks)
  const displayAdditional = payable.additionalHours
  const breakdownParts = [
    paidBreakMinutes > 0
      ? `Paid break: ${formatHoursFromMinutes(paidBreakMinutes)}`
      : null,
    entry.additionalHours > 0 ? `Manual: ${formatHours(entry.additionalHours)}` : null,
  ].filter(Boolean)
  const title =
    breakdownParts.length > 0
      ? `${breakdownParts.join(' · ')} · Add. Hrs total: ${formatHours(displayAdditional)}`
      : undefined

  return (
    <div className={compact ? 'space-y-1' : 'min-w-0'} title={title}>
      {isEditable ? (
        <TimesheetDecimalHoursInput
          value={entry.additionalHours}
          onChange={(hours) =>
            onUpdate(entry.dayDate, {
              additionalHours: hours,
            })
          }
          className={inputClassName}
          data-entry-index={index}
          data-field="additional-hours"
          aria-label={`Additional Hours for ${formatDayLabel(entry.dayDate)}`}
        />
      ) : (
        <span className="text-sm font-medium tabular-nums text-[#0D477F] dark:text-slate-200">
          {displayAdditional > 0 ? formatHours(displayAdditional) : '—'}
        </span>
      )}
      {paidBreakMinutes > 0 ? (
        <p className="text-[10px] font-medium leading-tight text-[#5499BF] dark:text-slate-400">
          +{formatHoursFromMinutes(paidBreakMinutes)} paid break
        </p>
      ) : null}
    </div>
  )
}

function NotesIndicator({
  entry,
  isEditable,
  onUpdate,
}: {
  entry: TimesheetEntryInput
  isEditable: boolean
  onUpdate: (dayDate: string, patch: Partial<TimesheetEntryInput>) => void
}) {
  const hasNote = entry.dailyComment.trim().length > 0

  if (isEditable) {
    return (
      <TimesheetDailyCommentField
        dailyComment={entry.dailyComment}
        editable
        compact
        onDailyCommentChange={(nextValue) =>
          onUpdate(entry.dayDate, { dailyComment: nextValue })
        }
      />
    )
  }

  if (!hasNote) {
    return <span className={`text-xs ${adminTextMuted}`}>—</span>
  }

  return (
    <span
      className="inline-flex justify-center text-[#218EE7] dark:text-blue-300"
      title={entry.dailyComment}
    >
      <MessageSquare className="size-3.5" aria-label={`Note: ${entry.dailyComment}`} />
    </span>
  )
}

function TimesheetDayRow({
  entry,
  index,
  isEditable,
  paidBreaks,
  overtimeMode,
  overtimeRules,
  timeFormat,
  formatTime,
  onUpdate,
}: {
  entry: TimesheetEntryInput
  index: number
  isEditable: boolean
  paidBreaks: boolean
  overtimeMode: OvertimeMode
  overtimeRules: TimesheetOvertimeRules
  timeFormat: CompanyTimeFormat
  formatTime: (value: string | null) => string
  onUpdate: (dayDate: string, patch: Partial<TimesheetEntryInput>) => void
}) {
  const isManualMode = overtimeMode === 'Manual'
  const payable = getEntryPayableDisplayResult(entry, {
    overtimeRules,
    paidBreaks,
    overtimeMode,
  })
  const dayTotal = payable.totalPaidHours
  const hasShift = entryHasStartAndFinish(entry)
  const canEditOt = isEditable && (isManualMode || !payable.weekendGuaranteeDay)
  const canEditBasic = isEditable && isManualMode

  return (
    <tr
      className={`border-b border-[#D3E9FC]/80 transition-colors last:border-b-0 hover:bg-[#E8F3FE]/80 ${
        index % 2 === 0 ? 'bg-[#F5FAFF]/80' : 'bg-white/70'
      } dark:border-white/10 dark:hover:bg-slate-800/70`}
    >
      <td className={dayColumnCellClassName}>{formatDayLabel(entry.dayDate)}</td>
      <td className={tableCellClassName}>
        {isEditable ? (
          <div className="flex min-w-0 flex-col gap-1">
            <TimesheetTimeInput
              value={entry.startTime}
              timeFormat={timeFormat}
              onChange={(nextValue) => onUpdate(entry.dayDate, { startTime: nextValue })}
              className={inputClassName}
              data-entry-index={index}
              data-field="start"
            />
            <TimesheetTimeInput
              value={entry.finishTime}
              timeFormat={timeFormat}
              onChange={(nextValue) => onUpdate(entry.dayDate, { finishTime: nextValue })}
              className={inputClassName}
              data-entry-index={index}
              data-field="finish"
            />
          </div>
        ) : (
          <span className="tabular-nums font-medium text-[#113C69] dark:text-slate-200">
            {hasShift
              ? `${formatTime(entry.startTime)}–${formatTime(entry.finishTime)}`
              : '—'}
          </span>
        )}
      </td>
      <td className={tableCellClassName}>
        {isEditable ? (
          <Input
            type="number"
            min={0}
            step={5}
            value={entry.breakMinutes}
            onChange={(event) =>
              onUpdate(entry.dayDate, {
                breakMinutes: Number(event.target.value) || 0,
              })
            }
            className={inputClassName}
            data-entry-index={index}
            data-field="break"
          />
        ) : (
          <span className="tabular-nums font-medium text-[#113C69] dark:text-slate-200">
            {hasShift ? formatBreak(entry.breakMinutes) : '—'}
          </span>
        )}
      </td>
      <td className={tableCellClassName}>
        {canEditBasic ? (
          <TimesheetDecimalHoursInput
            value={minutesToDecimalHours(entry.totalMinutes)}
            onChange={(hours) =>
              onUpdate(entry.dayDate, {
                totalMinutes: decimalHoursToMinutes(hours),
              })
            }
            className={inputClassName}
            data-entry-index={index}
            data-field="basic"
            aria-label={`Basic Hours for ${formatDayLabel(entry.dayDate)}`}
          />
        ) : (
          <span className="text-sm font-semibold tabular-nums text-[#113C69] dark:text-slate-100">
            {payable.basicHours > 0 ? formatHours(payable.basicHours) : '—'}
          </span>
        )}
      </td>
      <td className={tableCellClassName}>
        {canEditOt ? (
          <TimesheetDecimalHoursInput
            value={minutesToDecimalHours(entry.overtimeMinutes)}
            onChange={(hours) =>
              onUpdate(entry.dayDate, {
                overtimeMinutes: decimalHoursToMinutes(hours),
              })
            }
            className={inputClassName}
            data-entry-index={index}
            data-field="overtime"
            aria-label={`Overtime for ${formatDayLabel(entry.dayDate)}`}
          />
        ) : (
          <span className="text-sm font-semibold tabular-nums text-[#0B68BE] dark:text-blue-300">
            {payable.overtimeDisplayHours > 0
              ? formatHours(payable.overtimeDisplayHours)
              : '—'}
          </span>
        )}
      </td>
      <td className={tableCellClassName}>
        <AdditionalHoursCell
          entry={entry}
          paidBreaks={paidBreaks}
          overtimeMode={overtimeMode}
          overtimeRules={overtimeRules}
          isEditable={isEditable}
          index={index}
          onUpdate={onUpdate}
        />
      </td>
      <td
        className={`${tableCellClassName} text-sm font-bold tabular-nums text-[#0B68BE] dark:text-blue-300`}
      >
        {formatTotalHours(dayTotal)}
      </td>
      <td className={`${tableCellClassName} text-center`}>
        <NotesIndicator entry={entry} isEditable={isEditable} onUpdate={onUpdate} />
      </td>
    </tr>
  )
}

function TimesheetDayCard({
  entry,
  index,
  isEditable,
  paidBreaks,
  overtimeMode,
  overtimeRules,
  timeFormat,
  formatTime,
  onUpdate,
}: {
  entry: TimesheetEntryInput
  index: number
  isEditable: boolean
  paidBreaks: boolean
  overtimeMode: OvertimeMode
  overtimeRules: TimesheetOvertimeRules
  timeFormat: CompanyTimeFormat
  formatTime: (value: string | null) => string
  onUpdate: (dayDate: string, patch: Partial<TimesheetEntryInput>) => void
}) {
  const isManualMode = overtimeMode === 'Manual'
  const hasShift = entryHasStartAndFinish(entry)
  const payable = getEntryPayableDisplayResult(entry, {
    overtimeRules,
    paidBreaks,
    overtimeMode,
  })
  const paidBreakMinutes =
    isManualMode || payable.weekendGuaranteeDay
      ? 0
      : getEntryPaidBreakMinutes(entry, paidBreaks)
  const combinedAdditional = payable.additionalHours
  const dayTotal = payable.totalPaidHours
  const canEditOt = isEditable && (isManualMode || !payable.weekendGuaranteeDay)
  const canEditBasic = isEditable && isManualMode

  return (
    <article className="rounded-2xl border border-[#D3E9FC] bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[#113C69] dark:text-slate-100">
          {formatDayLabel(entry.dayDate)}
        </p>
        <p className="text-sm font-bold tabular-nums text-[#0B68BE] dark:text-blue-300">
          {formatTotalHours(dayTotal)}
        </p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="col-span-2">
          <p className="font-semibold uppercase tracking-[0.06em] text-[#5499BF]">Shift</p>
          {isEditable ? (
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <TimesheetTimeInput
                value={entry.startTime}
                timeFormat={timeFormat}
                onChange={(nextValue) => onUpdate(entry.dayDate, { startTime: nextValue })}
                className={inputClassName}
                data-entry-index={index}
                data-field="start"
              />
              <TimesheetTimeInput
                value={entry.finishTime}
                timeFormat={timeFormat}
                onChange={(nextValue) => onUpdate(entry.dayDate, { finishTime: nextValue })}
                className={inputClassName}
                data-entry-index={index}
                data-field="finish"
              />
            </div>
          ) : (
            <p className="mt-0.5 tabular-nums font-medium text-[#113C69] dark:text-slate-200">
              {hasShift
                ? `${formatTime(entry.startTime)}–${formatTime(entry.finishTime)}`
                : '—'}
            </p>
          )}
        </div>

        <div>
          <p className="font-semibold uppercase tracking-[0.06em] text-[#5499BF]">Break</p>
          {isEditable ? (
            <Input
              type="number"
              min={0}
              step={5}
              value={entry.breakMinutes}
              onChange={(event) =>
                onUpdate(entry.dayDate, {
                  breakMinutes: Number(event.target.value) || 0,
                })
              }
              className={`${inputClassName} mt-1`}
              data-entry-index={index}
              data-field="break"
            />
          ) : (
            <p className="mt-0.5 tabular-nums font-medium text-[#113C69]">
              {hasShift ? formatBreak(entry.breakMinutes) : '—'}
            </p>
          )}
        </div>

        <div>
          <p className="font-semibold uppercase tracking-[0.06em] text-[#5499BF]">Basic</p>
          {canEditBasic ? (
            <TimesheetDecimalHoursInput
              value={minutesToDecimalHours(entry.totalMinutes)}
              onChange={(hours) =>
                onUpdate(entry.dayDate, {
                  totalMinutes: decimalHoursToMinutes(hours),
                })
              }
              className={`${inputClassName} mt-1`}
              data-entry-index={index}
              data-field="basic"
              aria-label={`Basic Hours for ${formatDayLabel(entry.dayDate)}`}
            />
          ) : (
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#113C69]">
              {payable.basicHours > 0 ? formatHours(payable.basicHours) : '—'}
            </p>
          )}
        </div>

        <div>
          <p className="font-semibold uppercase tracking-[0.06em] text-[#5499BF]">OT</p>
          {canEditOt ? (
            <TimesheetDecimalHoursInput
              value={minutesToDecimalHours(entry.overtimeMinutes)}
              onChange={(hours) =>
                onUpdate(entry.dayDate, {
                  overtimeMinutes: decimalHoursToMinutes(hours),
                })
              }
              className={`${inputClassName} mt-1`}
              data-entry-index={index}
              data-field="overtime"
              aria-label={`Overtime for ${formatDayLabel(entry.dayDate)}`}
            />
          ) : (
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#0B68BE]">
              {payable.overtimeDisplayHours > 0
                ? formatHours(payable.overtimeDisplayHours)
                : '—'}
            </p>
          )}
        </div>

        <div>
          <p className="font-semibold uppercase tracking-[0.06em] text-[#5499BF]">Add. Hrs</p>
          <div className="mt-1">
            <AdditionalHoursCell
              entry={entry}
              paidBreaks={paidBreaks}
              overtimeMode={overtimeMode}
              overtimeRules={overtimeRules}
              isEditable={isEditable}
              index={index}
              onUpdate={onUpdate}
              compact
            />
          </div>
          {!isEditable && paidBreakMinutes > 0 && entry.additionalHours > 0 ? (
            <p className="mt-0.5 text-[10px] text-[#5499BF]">
              Total {formatHours(combinedAdditional)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-2 border-t border-[#D3E9FC]/70 pt-2 dark:border-white/10">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
          Notes
        </p>
        <TimesheetDailyCommentField
          dailyComment={entry.dailyComment}
          editable={isEditable}
          compact
          onDailyCommentChange={(nextValue) =>
            onUpdate(entry.dayDate, { dailyComment: nextValue })
          }
        />
      </div>
    </article>
  )
}

import { TimesheetTimeInput } from '@/components/timesheets/TimesheetTimeInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { Timesheet, TimesheetEntryInput } from '@/lib/timesheetTypes'
import {
  applyViewModeEntryTotals,
  buildTimesheetOvertimeRules,
  canEditTimesheet,
  formatBreak,
  formatDayLabel,
  formatHours,
  formatHoursFromMinutes,
  formatTotalHours,
  formatTimesheetSubmittedAt,
  getStatusBadgeClass,
  getStatusLabel,
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
  'px-2.5 py-3 text-[11px] font-bold uppercase tracking-[0.07em] text-[#0D477F]'
const tableCellClassName = 'px-2.5 py-2.5 align-middle'
const dayColumnHeadClassName = `${tableHeadClassName} w-[168px] min-w-[168px] pr-6`
const dayColumnCellClassName = `${tableCellClassName} w-[168px] min-w-[168px] pr-6 whitespace-nowrap text-[13px] leading-tight font-semibold text-[#113C69] dark:text-slate-100`

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
      prepareEntryInputs(timesheet.weekStart, timesheet.entries, defaultBreakMinutes),
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
        prepareEntryInputs(timesheet.weekStart, timesheet.entries, defaultBreakMinutes),
        { paidBreaks: recalcOptions.paidBreaks },
      )
    }

    return recalculateEntryInputs(draftEntries, recalcOptions)
  }, [defaultBreakMinutes, draftEntries, isEditable, recalcOptions, timesheet])

  const summary = useMemo(() => {
    if (!timesheet) {
      return {
        workedMinutes: 0,
        workedHours: 0,
        breakMinutes: 0,
        breakHours: 0,
        overtimeHours: 0,
        additionalHours: 0,
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

    return summarizeTimesheetEntries(entriesForSummary, { overtimeRules })
  }, [displayEntries, overtimeRules, timesheet])

  if (!timesheet) return null

  function updateEntry(dayDate: string, patch: Partial<TimesheetEntryInput>) {
    setDraftEntries((current) =>
      recalculateEntryInputs(
        current.map((entry) =>
          entry.dayDate === dayDate ? { ...entry, ...patch } : entry,
        ),
        recalcOptions,
      ),
    )
  }

  async function handleSaveDraft() {
    await onSave?.(recalculateEntryInputs(draftEntries, recalcOptions))
  }

  async function handleSubmit() {
    await onSubmit?.(recalculateEntryInputs(draftEntries, recalcOptions))
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

        {saveError ? (
          <div className="mx-5 mt-3 shrink-0 rounded-[10px] bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60 sm:mx-6">
            {saveError}
          </div>
        ) : null}

        {isEditable && timesheet.status === 'Approved' ? (
          <div className="mx-5 mt-3 shrink-0 rounded-[10px] bg-[#E8F3FE] px-3 py-2 text-xs font-medium text-[#0A539A] ring-1 ring-[#BDDDFB] dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/50 sm:mx-6">
            This timesheet is approved. Changes will update the approved record.
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pt-4 pb-2 touch-pan-y [-webkit-overflow-scrolling:touch] sm:px-6">
          <div className="max-w-full overflow-x-auto rounded-2xl border border-[#D3E9FC] bg-white/80 shadow-sm shadow-[#BDDDFB]/30 [scrollbar-color:#89CFF0_#F5FAFF] [scrollbar-width:thin] dark:border-white/10 dark:bg-slate-900/70">
            <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
              <thead className="border-b border-[#BDDDFB] bg-[#E8F3FE]">
                <tr>
                  <th className={dayColumnHeadClassName}>Day</th>
                  <th className={tableHeadClassName}>Start</th>
                  <th className={tableHeadClassName}>Break</th>
                  <th className={tableHeadClassName}>Finish</th>
                  <th className={tableHeadClassName}>Worked</th>
                  <th className={tableHeadClassName}>Overtime</th>
                  <th className={tableHeadClassName}>Add. hrs</th>
                  <th className={`${tableHeadClassName} min-w-[180px]`}>
                    Daily note
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayEntries.map((entry, index) => (
                  <tr
                    key={entry.dayDate}
                    className={`border-b border-[#D3E9FC]/80 transition-colors last:border-b-0 hover:bg-[#E8F3FE]/80 ${
                      index % 2 === 0 ? 'bg-[#F5FAFF]/80' : 'bg-white/70'
                    } dark:border-white/10 dark:hover:bg-slate-800/70`}
                  >
                      <td className={dayColumnCellClassName}>
                        {formatDayLabel(entry.dayDate)}
                      </td>
                      <td className={tableCellClassName}>
                        {isEditable ? (
                          <TimesheetTimeInput
                            value={entry.startTime}
                            timeFormat={timeFormat}
                            onChange={(nextValue) =>
                              updateEntry(entry.dayDate, { startTime: nextValue })
                            }
                            className={inputClassName}
                            data-entry-index={index}
                            data-field="start"
                          />
                        ) : (
                          <span className="tabular-nums font-medium text-[#113C69] dark:text-slate-200">
                            {formatTime(entry.startTime)}
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
                              updateEntry(entry.dayDate, {
                                breakMinutes: Number(event.target.value) || 0,
                              })
                            }
                            className={inputClassName}
                            data-entry-index={index}
                            data-field="break"
                          />
                        ) : (
                          <span className="tabular-nums font-medium text-[#113C69] dark:text-slate-200">
                            {formatBreak(entry.breakMinutes)}
                          </span>
                        )}
                      </td>
                      <td className={tableCellClassName}>
                        {isEditable ? (
                          <TimesheetTimeInput
                            value={entry.finishTime}
                            timeFormat={timeFormat}
                            onChange={(nextValue) =>
                              updateEntry(entry.dayDate, { finishTime: nextValue })
                            }
                            className={inputClassName}
                            data-entry-index={index}
                            data-field="finish"
                          />
                        ) : (
                          <span className="tabular-nums font-medium text-[#113C69] dark:text-slate-200">
                            {formatTime(entry.finishTime)}
                          </span>
                        )}
                      </td>
                      <td className={`${tableCellClassName} text-sm font-semibold tabular-nums text-[#113C69] dark:text-slate-100`}>
                        {formatHoursFromMinutes(entry.totalMinutes)}
                      </td>
                      <td className={tableCellClassName}>
                        {isEditable ? (
                          <Input
                            type="number"
                            min={0}
                            step={0.25}
                            value={
                              entry.overtimeMinutes > 0
                                ? Math.round((entry.overtimeMinutes / 60) * 100) / 100
                                : 0
                            }
                            onChange={(event) =>
                              updateEntry(entry.dayDate, {
                                overtimeMinutes: Math.round(
                                  (Number(event.target.value) || 0) * 60,
                                ),
                              })
                            }
                            className={inputClassName}
                            data-entry-index={index}
                            data-field="overtime"
                          />
                        ) : (
                          <span className="text-sm font-semibold tabular-nums text-[#0B68BE] dark:text-blue-300">
                            {entry.overtimeMinutes > 0
                              ? formatHoursFromMinutes(entry.overtimeMinutes)
                              : '—'}
                          </span>
                        )}
                      </td>
                      <td className={tableCellClassName}>
                        {isEditable ? (
                          <Input
                            type="number"
                            min={0}
                            step={0.25}
                            placeholder="0"
                            value={entry.additionalHours > 0 ? entry.additionalHours : ''}
                            onChange={(event) =>
                              updateEntry(entry.dayDate, {
                                additionalHours: Math.max(
                                  0,
                                  Number.parseFloat(event.target.value) || 0,
                                ),
                              })
                            }
                            className={inputClassName}
                            data-entry-index={index}
                            data-field="additional-hours"
                          />
                        ) : (
                          <span className="text-sm font-medium tabular-nums text-[#0D477F] dark:text-slate-200">
                            {entry.additionalHours > 0
                              ? formatHours(entry.additionalHours)
                              : '—'}
                          </span>
                        )}
                      </td>
                      <td className={tableCellClassName}>
                        <TimesheetDailyCommentField
                          dailyComment={entry.dailyComment}
                          editable={isEditable}
                          onDailyCommentChange={(nextValue) =>
                            updateEntry(entry.dayDate, { dailyComment: nextValue })
                          }
                        />
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 rounded-2xl border border-[#D3E9FC] bg-white/55 p-2.5 text-xs shadow-sm shadow-[#BDDDFB]/25 dark:border-white/10 dark:bg-slate-900/60 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryItem
              label="Worked Hours"
              value={summary.workedHours}
              valueMinutes={summary.workedMinutes}
            />
            <SummaryItem label="Break" display={formatBreak(summary.breakMinutes)} />
            <SummaryItem label="Overtime" value={summary.overtimeHours} />
            <SummaryItem label="Additional Hours" value={summary.additionalHours} />
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
  emphasized = false,
}: {
  label: string
  value?: number
  valueMinutes?: number
  display?: string
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
    </div>
  )
}

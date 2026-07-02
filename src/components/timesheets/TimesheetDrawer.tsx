import { TimesheetTimeInput } from '@/components/timesheets/TimesheetTimeInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { Timesheet, TimesheetEntryInput } from '@/lib/timesheetTypes'
import {
  buildTimesheetOvertimeRules,
  canEditTimesheet,
  formatBreak,
  formatDayLabel,
  formatHours,
  formatHoursFromMinutes,
  getStatusBadgeClass,
  getStatusLabel,
  prepareEntryInputs,
  recalculateEntryInputs,
  summarizeTimesheetEntries,
} from '@/lib/timesheetUtils'
import {
  adminHeading,
  adminInnerSoft,
  adminSearchInput,
  adminTableHeadText,
  adminTableHeader,
  adminTableRow,
  adminTableShellSm,
  adminText,
  adminTextMuted,
  adminTextStrong,
} from '@/lib/adminUiStyles'
import { MessageSquare, Pencil, X } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'

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
  onClose: () => void
  onEdit?: () => void
  onSave?: (entries: TimesheetEntryInput[]) => Promise<void>
  onSubmit?: (entries: TimesheetEntryInput[]) => Promise<void>
}

const inputClassName = `${adminSearchInput} h-8 px-2.5 text-xs tabular-nums`
const dailyCommentInputClassName = `${adminSearchInput} h-8 px-2.5 text-xs`

const tableHeadClassName = `${adminTableHeadText} px-2.5 py-3 text-[11px] font-bold uppercase tracking-[0.07em]`
const tableCellClassName = 'px-2.5 py-2 align-middle'

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
            dailyComment.trim() ? 'text-[#2563EB]' : 'text-slate-400'
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
  onClose,
  onEdit,
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
        sundayOvertimeEnabled: settings?.sundayOvertimeEnabled ?? false,
        sundayOvertimeAfterHours: settings?.sundayOvertimeAfterHours ?? 0,
        sundayOvertimeMultiplier: settings?.sundayOvertimeMultiplier ?? 2,
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
  }, [timesheet, defaultBreakMinutes])

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

    return isEditable
      ? recalculateEntryInputs(draftEntries, recalcOptions)
      : recalculateEntryInputs(
          prepareEntryInputs(timesheet.weekStart, timesheet.entries, defaultBreakMinutes),
          recalcOptions,
        )
  }, [defaultBreakMinutes, draftEntries, isEditable, recalcOptions, timesheet])

  const summary = useMemo(() => {
    if (!timesheet) {
      return {
        workedMinutes: 0,
        workedHours: 0,
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
        className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-4xl min-h-0 flex-col overflow-hidden border-l border-[rgba(75,120,220,0.12)] bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/40 dark:backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="timesheet-drawer-title"
      >
        <div className="shrink-0 border-b border-[rgba(75,120,220,0.10)] bg-gradient-to-b from-[#F8FBFF] to-white px-5 py-4 dark:border-white/10 dark:from-slate-900 dark:to-slate-900/95 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${adminTextMuted}`}>
                {isEditable ? 'Edit timesheet' : 'View timesheet'}
                {isEditable ? ' · Ctrl+S to save' : ''}
              </p>
              <h2
                id="timesheet-drawer-title"
                className={`mt-1.5 text-2xl font-bold tracking-[-0.03em] sm:text-[1.75rem] ${adminHeading}`}
              >
                {timesheet.driverName}
              </h2>
              <p className="mt-2 text-lg font-bold tracking-[-0.02em] text-[#2563EB] dark:text-blue-300">
                {timesheet.weekTitle}
              </p>
              <p className={`mt-1 text-sm font-medium ${adminText}`}>
                {timesheet.weekRangeLabel}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isSaving}
              className="size-10 shrink-0 rounded-[12px] text-slate-500 hover:bg-white/80 dark:text-slate-400 dark:hover:bg-slate-800/50"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <HeaderBadge label={timesheet.driverRole ?? 'Worker'} />
            <span
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 ${getStatusBadgeClass(timesheet.status)}`}
            >
              {getStatusLabel(timesheet.status)}
            </span>
            <HeaderBadge label={`OT mode: ${overtimeMode}`} />
            {canEdit ? (
              <span
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 ${
                  isEditable
                    ? 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60'
                    : 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-400 dark:ring-white/10'
                }`}
              >
                {isEditable ? 'Editing' : 'Read-only'}
              </span>
            ) : null}
          </div>
        </div>

        {saveError ? (
          <div className="mx-5 mt-3 shrink-0 rounded-[10px] bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60 sm:mx-6">
            {saveError}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4 touch-pan-y [-webkit-overflow-scrolling:touch] sm:px-6">
          <div className={`max-w-full overflow-x-auto ${adminTableShellSm}`}>
            <table className="w-full min-w-[860px] border-collapse text-left text-xs">
              <thead className={adminTableHeader}>
                <tr>
                  <th className={`${tableHeadClassName} min-w-[108px]`}>Day</th>
                  <th className={tableHeadClassName}>Start</th>
                  <th className={tableHeadClassName}>Break</th>
                  <th className={tableHeadClassName}>Finish</th>
                  <th className={tableHeadClassName}>Worked</th>
                  <th className={tableHeadClassName}>Overtime</th>
                  <th className={tableHeadClassName}>Add. hrs</th>
                  <th className={`${tableHeadClassName} hidden min-w-[140px] lg:table-cell`}>
                    Daily note
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayEntries.map((entry, index) => (
                  <Fragment key={entry.dayDate}>
                    <tr className={adminTableRow}>
                      <td className={`${tableCellClassName} font-semibold ${adminTextStrong}`}>
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
                          <span className={`tabular-nums ${adminText}`}>
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
                          <span className={`tabular-nums ${adminText}`}>
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
                          <span className={`tabular-nums ${adminText}`}>
                            {formatTime(entry.finishTime)}
                          </span>
                        )}
                      </td>
                      <td className={`${tableCellClassName} text-sm font-bold tabular-nums text-[#2A376F] dark:text-slate-100`}>
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
                          <span className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">
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
                          <span className={`text-sm font-medium tabular-nums ${adminText}`}>
                            {entry.additionalHours > 0
                              ? formatHours(entry.additionalHours)
                              : '—'}
                          </span>
                        )}
                      </td>
                      <td className={`${tableCellClassName} hidden lg:table-cell`}>
                        <TimesheetDailyCommentField
                          dailyComment={entry.dailyComment}
                          editable={isEditable}
                          onDailyCommentChange={(nextValue) =>
                            updateEntry(entry.dayDate, { dailyComment: nextValue })
                          }
                        />
                      </td>
                    </tr>
                    <tr
                      className={`${adminTableRow} border-b border-[rgba(75,120,220,0.08)] lg:hidden`}
                    >
                      <td colSpan={7} className="px-2.5 pb-2.5 pt-0">
                        <p className={`mb-1 text-[10px] font-bold uppercase tracking-[0.08em] ${adminTextMuted}`}>
                          Daily note
                        </p>
                        <TimesheetDailyCommentField
                          dailyComment={entry.dailyComment}
                          editable={isEditable}
                          onDailyCommentChange={(nextValue) =>
                            updateEntry(entry.dayDate, { dailyComment: nextValue })
                          }
                          compact
                        />
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`mt-5 grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-3 lg:grid-cols-5 ${adminInnerSoft}`}>
            <SummaryItem
              label="Worked Hours"
              value={summary.workedHours}
              valueMinutes={summary.workedMinutes}
            />
            <SummaryItem label="Break" value={summary.breakHours} />
            <SummaryItem label="Overtime" value={summary.overtimeHours} />
            <SummaryItem label="Additional Hours" value={summary.additionalHours} />
            <SummaryItem label="Total Hours" value={summary.totalHours} emphasized />
          </div>
        </div>

        <div className="shrink-0 border-t border-[rgba(75,120,220,0.08)] bg-white px-5 py-3.5 dark:border-white/10 dark:bg-slate-900/95 sm:px-6">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 rounded-[10px] px-3.5 text-xs font-semibold text-slate-600"
            >
              Close
            </Button>

            {mode === 'view' && canEdit ? (
              <Button
                type="button"
                onClick={onEdit}
                disabled={isSaving}
                className="h-9 rounded-[10px] bg-white px-3.5 text-xs font-semibold text-[#2563EB] ring-1 ring-[rgba(75,120,220,0.12)] hover:bg-[#F8FBFF] dark:bg-slate-800/70 dark:text-blue-300 dark:ring-white/10 dark:hover:bg-slate-700/50"
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
                  className="h-9 rounded-[10px] bg-white px-3.5 text-xs font-semibold text-[#2563EB] ring-1 ring-[rgba(75,120,220,0.12)] hover:bg-[#F8FBFF] dark:bg-slate-800/70 dark:text-blue-300 dark:ring-white/10 dark:hover:bg-slate-700/50"
                >
                  {isSaving ? 'Saving…' : 'Save draft'}
                </Button>
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSubmit()}
                  className="h-9 rounded-[10px] bg-[#2563EB] px-3.5 text-xs font-semibold text-white hover:bg-[#1d4ed8]"
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
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 ring-[rgba(75,120,220,0.10)] ${adminInnerSoft} ${adminText}`}
    >
      {label}
    </span>
  )
}

function SummaryItem({
  label,
  value,
  valueMinutes,
  emphasized = false,
}: {
  label: string
  value: number
  valueMinutes?: number
  emphasized?: boolean
}) {
  const display =
    valueMinutes !== undefined
      ? formatHoursFromMinutes(valueMinutes)
      : formatHours(value)

  return (
    <div className="rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-[rgba(75,120,220,0.08)] dark:bg-slate-800/70 dark:ring-white/10">
      <p className={`text-[10px] font-semibold uppercase tracking-[0.06em] ${adminTextMuted}`}>
        {label}
      </p>
      <p
        className={`mt-1 text-base font-bold tabular-nums ${
          emphasized ? 'text-[#2563EB] dark:text-blue-300' : adminHeading
        }`}
      >
        {display}
      </p>
    </div>
  )
}

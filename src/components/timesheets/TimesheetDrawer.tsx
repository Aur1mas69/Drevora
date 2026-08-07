import { TimesheetDecimalHoursInput } from '@/components/timesheets/TimesheetDecimalHoursInput'
import { TimesheetTimeInput } from '@/components/timesheets/TimesheetTimeInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { fetchApprovedHolidayDaysForWorkerWeek } from '@/lib/timesheetApprovedHolidays'
import {
  applyApprovedHolidaysToEntries,
  applyHolidayDayHours,
  applyWorkDayType,
  holidayDayCode,
  holidayPortionFromDayType,
  isFullHolidayDay,
  isHalfHolidayDay,
  isHolidayDay,
  validateHolidayWorkOverlap,
  type HolidayConflict,
} from '@/lib/timesheetHoliday'
import { resolveEffectiveTimesheetSettings } from '@/lib/resolveEffectiveTimesheetSettings'
import type { Timesheet, TimesheetDayType, TimesheetEntryInput } from '@/lib/timesheetTypes'
import type { OvertimeMode, TimesheetOvertimeRules } from '@/lib/companySettingsTypes'
import type { CompanyTimeFormat } from '@/lib/dateTimeFormat'
import type { EffectiveTimesheetSettings } from '@/lib/workerTimesheetSettingsTypes'
import { fetchDriverTimesheetSettingsByDriverIds } from '@/services/workerTimesheetSettingsService'
import {
  applyViewModeEntryTotals,
  buildTimesheetOvertimeRules,
  buildWeekDates,
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
  getMissingTimePairField,
  getStatusBadgeClass,
  getStatusLabel,
  isIncompleteTimePair,
  minutesToDecimalHours,
  prepareEntryInputs,
  recalculateEntryInputs,
  summarizeTimesheetEntries,
  TIMESHEET_TIME_PAIR_MESSAGE,
  validateTimesheetTimePairs,
} from '@/lib/timesheetUtils'
import {
  adminText,
  adminTextMuted,
} from '@/lib/adminUiStyles'
import { Download, Loader2, MessageSquare, Pencil, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

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
  'min-w-0 px-1.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#0D477F] sm:px-2'
const tableCellClassName = 'min-w-0 max-w-0 overflow-hidden px-1.5 py-2 align-middle sm:px-2'
const dayColumnHeadClassName = `${tableHeadClassName} whitespace-nowrap`
const dayColumnCellClassName = `${tableCellClassName} text-[12px] leading-tight font-semibold text-[#113C69] dark:text-slate-100`
const holidayBadgeClassName =
  'inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight tracking-[0.04em] text-sky-800 ring-1 ring-sky-200 break-words whitespace-normal dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900/60'
const cellTextClassName = 'block min-w-0 max-w-full break-words'

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
    formatDate,
    formatTime,
    timeFormat,
    settings,
  } = useCompanySettings()
  const [draftEntries, setDraftEntries] = useState<TimesheetEntryInput[]>([])
  const [localError, setLocalError] = useState<string | null>(null)
  const [holidayConflicts, setHolidayConflicts] = useState<HolidayConflict[]>([])
  const [effective, setEffective] = useState<EffectiveTimesheetSettings | null>(
    null,
  )

  useEffect(() => {
    if (!timesheet?.driverId) {
      setEffective(resolveEffectiveTimesheetSettings(settings, null))
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const map = await fetchDriverTimesheetSettingsByDriverIds([
          timesheet.driverId,
        ])
        if (cancelled) return
        setEffective(
          resolveEffectiveTimesheetSettings(
            settings,
            map.get(timesheet.driverId) ?? null,
          ),
        )
      } catch {
        if (!cancelled) {
          setEffective(resolveEffectiveTimesheetSettings(settings, null))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [settings, timesheet?.driverId])

  const overtimeMode = effective?.overtimeMode ?? 'Manual'
  const defaultBreakMinutes = effective?.defaultBreakMinutes ?? 30
  const overtimeRules = useMemo(
    () => buildTimesheetOvertimeRules(effective?.overtimeRules ?? {}),
    [effective?.overtimeRules],
  )

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

  const recalcOptions = useMemo(
    () => ({
      overtimeMode,
      overtimeRules,
      paidBreaks: effective?.paidBreaks ?? false,
    }),
    [effective?.paidBreaks, overtimeMode, overtimeRules],
  )

  useEffect(() => {
    if (!timesheet || !effective) return

    let cancelled = false
    const prepared = prepareEntryInputs(
      timesheet.weekStart,
      timesheet.entries,
      defaultBreakMinutes,
      breakOptions,
    )

    void (async () => {
      const weekDates = buildWeekDates(timesheet.weekStart)
      const weekEnd = weekDates[weekDates.length - 1] ?? timesheet.weekStart
      const approvedDays = await fetchApprovedHolidayDaysForWorkerWeek({
        workerId: timesheet.driverId,
        weekStart: timesheet.weekStart,
        weekEnd,
      })
      if (cancelled) return
      const applied = applyApprovedHolidaysToEntries(
        prepared,
        approvedDays,
        effective.defaultPaidHolidayHours,
      )
      setDraftEntries(applied.entries)
      setHolidayConflicts(applied.conflicts)
    })()

    return () => {
      cancelled = true
    }
  }, [breakOptions, defaultBreakMinutes, effective, timesheet?.id])

  const canEdit = timesheet ? canEditTimesheet(timesheet.status) : false
  const isEditable = mode === 'edit' && canEdit
  const retentionUntilLabel =
    timesheet?.retentionExpiresAt != null
      ? formatDate(timesheet.retentionExpiresAt.slice(0, 10))
      : null

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
      dayType: entry.dayType,
      holidayMinutes: entry.holidayMinutes,
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
            return applyWorkDayType(
              { ...entry, ...patch },
              defaultBreakMinutes,
            )
          }
          return { ...entry, ...patch }
        }),
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

  function validateEntriesForSave(entries: TimesheetEntryInput[]): string | null {
    for (const entry of entries) {
      const overlapError = validateHolidayWorkOverlap(entry)
      if (overlapError) return overlapError
    }
    return validateTimesheetTimePairs(entries) ?? validateManualAdditional(entries)
  }

  async function handleSaveDraft() {
    const next = recalculateEntryInputs(draftEntries, recalcOptions)
    const validationError = validateEntriesForSave(next)
    if (validationError) {
      setLocalError(validationError)
      return
    }
    setLocalError(null)
    await onSave?.(next)
  }

  async function handleSubmit() {
    const next = recalculateEntryInputs(draftEntries, recalcOptions)
    const validationError = validateEntriesForSave(next)
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
              {retentionUntilLabel ? (
                <p className="mt-1 text-sm font-medium text-[#3D7A9C] dark:text-slate-300">
                  Retained until {retentionUntilLabel}
                </p>
              ) : null}
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

        {holidayConflicts.length > 0 ? (
          <div className="mx-5 mt-3 shrink-0 rounded-[10px] bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900/50 sm:mx-6">
            Approved holiday conflicts with existing work hours on{' '}
            {holidayConflicts.map((item) => item.label).join(', ')}. Those days were not
            changed to Holiday.
          </div>
        ) : null}

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
    <div className={compact ? 'min-w-0 space-y-1' : 'min-w-0 max-w-full'} title={title}>
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
        <span className={`${cellTextClassName} text-sm font-medium tabular-nums text-[#0D477F] dark:text-slate-200`}>
          {displayAdditional > 0 ? formatHours(displayAdditional) : '—'}
        </span>
      )}
      {paidBreakMinutes > 0 ? (
        <p className={`${cellTextClassName} text-[10px] font-medium leading-tight text-[#5499BF] dark:text-slate-400`}>
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
  const [isNoteOpen, setIsNoteOpen] = useState(false)
  const noteTitleId = useId()
  const dayLabel = formatDayLabel(entry.dayDate)
  const noteText = entry.dailyComment.trim()
  const hasNote = noteText.length > 0

  useEffect(() => {
    if (!isNoteOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsNoteOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isNoteOpen])

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
    <>
      <button
        type="button"
        onClick={() => setIsNoteOpen(true)}
        className="inline-flex size-7 items-center justify-center rounded-lg text-[#218EE7] transition-colors hover:bg-[#E8F3FE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218EE7]/40 dark:text-blue-300 dark:hover:bg-slate-800/70"
        aria-haspopup="dialog"
        aria-expanded={isNoteOpen}
        aria-label={`View daily note for ${dayLabel}`}
        title="View daily note"
      >
        <MessageSquare className="size-3.5" aria-hidden="true" />
      </button>

      {isNoteOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm"
              onClick={() => setIsNoteOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-[20px] border border-[#D3E9FC] bg-white p-5 shadow-[0_30px_80px_rgba(11,38,70,0.18)] dark:border-white/10 dark:bg-slate-900 sm:p-6"
                role="dialog"
                aria-modal="true"
                aria-labelledby={noteTitleId}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2
                      id={noteTitleId}
                      className="text-lg font-semibold tracking-[-0.02em] text-[#113C69] dark:text-slate-50"
                    >
                      Daily note
                    </h2>
                    <p className={`mt-1 text-sm font-medium ${adminTextMuted}`}>
                      {dayLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNoteOpen(false)}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[#0D477F] hover:bg-[#E8F3FE] dark:text-slate-300 dark:hover:bg-slate-800/70"
                    aria-label="Close note"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>

                <p
                  className={`mt-4 max-h-[min(50vh,20rem)] overflow-y-auto whitespace-pre-wrap break-words rounded-[14px] border border-[#D3E9FC] bg-[#F5FAFF] px-4 py-3 text-sm leading-6 ${adminText} dark:border-white/10 dark:bg-slate-800/70`}
                >
                  {noteText}
                </p>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsNoteOpen(false)}
                    className="h-9 rounded-[10px] px-3.5 text-xs font-semibold text-[#0D477F] hover:bg-[#E8F3FE] dark:text-slate-300 dark:hover:bg-slate-800/50"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function DayTypeControl({
  dayType,
  editable,
  onChange,
}: {
  dayType: TimesheetDayType
  editable: boolean
  onChange: (next: TimesheetDayType) => void
}) {
  if (!editable) {
    if (dayType === 'holiday') {
      return <span className={holidayBadgeClassName}>H · Full day</span>
    }
    if (dayType === 'holiday_am') {
      return <span className={holidayBadgeClassName}>H-AM · First half</span>
    }
    if (dayType === 'holiday_pm') {
      return <span className={holidayBadgeClassName}>H-PM · Second half</span>
    }
    return (
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
        Work
      </span>
    )
  }

  return (
    <select
      value={dayType}
      onChange={(event) => onChange(event.target.value as TimesheetDayType)}
      className={`${inputClassName} h-7 min-w-[7.5rem]`}
      aria-label="Day type"
    >
      <option value="work">Work</option>
      <option value="holiday">Holiday (H)</option>
      <option value="holiday_am">First half (H-AM)</option>
      <option value="holiday_pm">Second half (H-PM)</option>
    </select>
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
  const isHoliday = isHolidayDay(entry)
  const isFullHoliday = isFullHolidayDay(entry)
  const isHalfHoliday = isHalfHolidayDay(entry)
  const holidayCode = holidayDayCode(entry.dayType ?? 'work')
  const isManualMode = overtimeMode === 'Manual'
  const payable = getEntryPayableDisplayResult(entry, {
    overtimeRules,
    paidBreaks,
    overtimeMode,
  })
  const incompletePair = !isFullHoliday && isIncompleteTimePair(entry)
  const missingField = isFullHoliday ? null : getMissingTimePairField(entry)
  const dayTotal = incompletePair ? 0 : payable.totalPaidHours
  const hasShift = !isFullHoliday && entryHasStartAndFinish(entry)
  const canEditOt =
    isEditable && !isFullHoliday && (isManualMode || !payable.weekendGuaranteeDay)
  const canEditBasic = isEditable && isManualMode && !isFullHoliday

  return (
    <tr
      className={`border-b border-[#D3E9FC]/80 transition-colors last:border-b-0 hover:bg-[#E8F3FE]/80 ${
        index % 2 === 0 ? 'bg-[#F5FAFF]/80' : 'bg-white/70'
      } dark:border-white/10 dark:hover:bg-slate-800/70`}
    >
      <td className={dayColumnCellClassName}>
        <div className="flex min-w-0 max-w-full flex-col gap-1">
          <span className="whitespace-nowrap">{formatDayLabel(entry.dayDate)}</span>
          <DayTypeControl
            dayType={entry.dayType ?? 'work'}
            editable={isEditable}
            onChange={(next) => onUpdate(entry.dayDate, { dayType: next })}
          />
        </div>
      </td>
      <td className={tableCellClassName}>
        {isFullHoliday ? (
          <span className={`${cellTextClassName} text-sm font-bold uppercase tracking-[0.08em] text-sky-800 dark:text-sky-200`}>
            {holidayCode}
          </span>
        ) : isEditable ? (
          <div className="flex min-w-0 flex-col gap-1">
            {isHalfHoliday && holidayCode ? (
              <span className={`${cellTextClassName} text-[11px] font-bold uppercase tracking-[0.06em] text-sky-800 dark:text-sky-200`}>
                {holidayCode} + Work
              </span>
            ) : null}
            <TimesheetTimeInput
              value={entry.startTime}
              timeFormat={timeFormat}
              onChange={(nextValue) => onUpdate(entry.dayDate, { startTime: nextValue })}
              className={inputClassName}
              invalid={missingField === 'start'}
              data-entry-index={index}
              data-field="start"
            />
            <TimesheetTimeInput
              value={entry.finishTime}
              timeFormat={timeFormat}
              onChange={(nextValue) => onUpdate(entry.dayDate, { finishTime: nextValue })}
              className={inputClassName}
              invalid={missingField === 'finish'}
              data-entry-index={index}
              data-field="finish"
            />
            {incompletePair ? (
              <p className="text-[11px] font-medium text-rose-600">
                {TIMESHEET_TIME_PAIR_MESSAGE}
              </p>
            ) : null}
          </div>
        ) : (
          <span className={`${cellTextClassName} tabular-nums font-medium text-[#113C69] dark:text-slate-200`}>
            {isHalfHoliday && holidayCode
              ? `${holidayCode}${hasShift ? ` · ${formatTime(entry.startTime)}–${formatTime(entry.finishTime)}` : ''}`
              : hasShift
                ? `${formatTime(entry.startTime)}–${formatTime(entry.finishTime)}`
                : '—'}
          </span>
        )}
      </td>
      <td className={tableCellClassName}>
        {isFullHoliday ? (
          <span className="text-xs font-semibold text-[#5499BF]">—</span>
        ) : isEditable ? (
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
          <span className={`text-sm font-semibold tabular-nums text-[#113C69] dark:text-slate-100 ${cellTextClassName}`}>
            {isHoliday ? (
              <span className="flex flex-col gap-0.5">
                {payable.holidayHours > 0 || isHoliday ? (
                  <span className={cellTextClassName}>
                    H {formatHours(payable.holidayHours)}
                    {payable.workBasicHours > 0
                      ? ` + Work ${formatHours(payable.workBasicHours)}`
                      : ''}
                  </span>
                ) : null}
              </span>
            ) : payable.basicHours > 0 ? (
              formatHours(payable.basicHours)
            ) : (
              '—'
            )}
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
          <span className={`${cellTextClassName} text-sm font-semibold tabular-nums text-[#0B68BE] dark:text-blue-300`}>
            {isFullHoliday
              ? formatHours(0)
              : payable.overtimeDisplayHours > 0
                ? formatHours(payable.overtimeDisplayHours)
                : '—'}
          </span>
        )}
      </td>
      <td className={tableCellClassName}>
        {isFullHoliday ? (
          <span className={`${cellTextClassName} text-xs font-semibold text-[#5499BF]`}>Holiday</span>
        ) : isHalfHoliday ? (
          <span className={`${cellTextClassName} text-xs font-semibold text-sky-800 dark:text-sky-200`}>
            {holidayCode} + Work
          </span>
        ) : (
          <AdditionalHoursCell
            entry={entry}
            paidBreaks={paidBreaks}
            overtimeMode={overtimeMode}
            overtimeRules={overtimeRules}
            isEditable={isEditable}
            index={index}
            onUpdate={onUpdate}
          />
        )}
      </td>
      <td
        className={`${tableCellClassName} text-sm font-bold tabular-nums text-[#0B68BE] dark:text-blue-300`}
      >
        <span className={cellTextClassName}>
          {incompletePair ? '—' : formatTotalHours(dayTotal)}
        </span>
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
  const isHoliday = isHolidayDay(entry)
  const isFullHoliday = isFullHolidayDay(entry)
  const isHalfHoliday = isHalfHolidayDay(entry)
  const holidayCode = holidayDayCode(entry.dayType ?? 'work')
  const isManualMode = overtimeMode === 'Manual'
  const hasShift = !isFullHoliday && entryHasStartAndFinish(entry)
  const payable = getEntryPayableDisplayResult(entry, {
    overtimeRules,
    paidBreaks,
    overtimeMode,
  })
  const incompletePair = !isFullHoliday && isIncompleteTimePair(entry)
  const missingField = isFullHoliday ? null : getMissingTimePairField(entry)
  const paidBreakMinutes =
    isFullHoliday || isManualMode || payable.weekendGuaranteeDay
      ? 0
      : getEntryPaidBreakMinutes(entry, paidBreaks)
  const combinedAdditional = payable.additionalHours
  const dayTotal = incompletePair ? 0 : payable.totalPaidHours
  const canEditOt =
    isEditable && !isFullHoliday && (isManualMode || !payable.weekendGuaranteeDay)
  const canEditBasic = isEditable && isManualMode && !isFullHoliday

  return (
    <article className="rounded-2xl border border-[#D3E9FC] bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-[#113C69] dark:text-slate-100">
            {formatDayLabel(entry.dayDate)}
          </p>
          <DayTypeControl
            dayType={entry.dayType ?? 'work'}
            editable={isEditable}
            onChange={(next) => onUpdate(entry.dayDate, { dayType: next })}
          />
        </div>
        <p className="text-sm font-bold tabular-nums text-[#0B68BE] dark:text-blue-300">
          {incompletePair ? '—' : formatTotalHours(dayTotal)}
        </p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="col-span-2">
          <p className="font-semibold uppercase tracking-[0.06em] text-[#5499BF]">Shift</p>
          {isFullHoliday ? (
            <p className="mt-0.5 text-sm font-bold uppercase tracking-[0.08em] text-sky-800 dark:text-sky-200">
              {holidayCode} — Full day holiday
            </p>
          ) : isEditable ? (
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {isHalfHoliday && holidayCode ? (
                <p className="col-span-2 text-[11px] font-bold uppercase tracking-[0.06em] text-sky-800">
                  {holidayCode} + Work
                </p>
              ) : null}
              <TimesheetTimeInput
                value={entry.startTime}
                timeFormat={timeFormat}
                onChange={(nextValue) => onUpdate(entry.dayDate, { startTime: nextValue })}
                className={inputClassName}
                invalid={missingField === 'start'}
                data-entry-index={index}
                data-field="start"
              />
              <TimesheetTimeInput
                value={entry.finishTime}
                timeFormat={timeFormat}
                onChange={(nextValue) => onUpdate(entry.dayDate, { finishTime: nextValue })}
                className={inputClassName}
                invalid={missingField === 'finish'}
                data-entry-index={index}
                data-field="finish"
              />
              {incompletePair ? (
                <p className="col-span-2 text-[11px] font-medium text-rose-600">
                  {TIMESHEET_TIME_PAIR_MESSAGE}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-0.5 tabular-nums font-medium text-[#113C69] dark:text-slate-200">
              {isHalfHoliday && holidayCode
                ? `${holidayCode}${hasShift ? ` · ${formatTime(entry.startTime)}–${formatTime(entry.finishTime)}` : ''}`
                : hasShift
                  ? `${formatTime(entry.startTime)}–${formatTime(entry.finishTime)}`
                  : '—'}
            </p>
          )}
        </div>

        <div>
          <p className="font-semibold uppercase tracking-[0.06em] text-[#5499BF]">Break</p>
          {isFullHoliday ? (
            <p className="mt-0.5 font-medium text-[#5499BF]">—</p>
          ) : isEditable ? (
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
              {isHoliday
                ? `H ${formatHours(payable.holidayHours)}${
                    payable.workBasicHours > 0
                      ? ` + Work ${formatHours(payable.workBasicHours)}`
                      : ''
                  }`
                : payable.basicHours > 0
                  ? formatHours(payable.basicHours)
                  : '—'}
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
              {isFullHoliday
                ? formatHours(0)
                : payable.overtimeDisplayHours > 0
                  ? formatHours(payable.overtimeDisplayHours)
                  : '—'}
            </p>
          )}
        </div>

        <div>
          <p className="font-semibold uppercase tracking-[0.06em] text-[#5499BF]">Add. Hrs</p>
          <div className="mt-1">
            {isFullHoliday ? (
              <p className="font-medium text-[#5499BF]">Holiday</p>
            ) : isHalfHoliday ? (
              <p className="font-medium text-sky-800">{holidayCode} + Work</p>
            ) : (
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
            )}
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

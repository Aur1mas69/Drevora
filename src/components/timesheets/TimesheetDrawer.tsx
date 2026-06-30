import { TimesheetTimeInput } from '@/components/timesheets/TimesheetTimeInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { Timesheet, TimesheetEntryInput } from '@/lib/timesheetTypes'
import {
  canEditTimesheet,
  formatBreak,
  formatDayLabel,
  formatHoursFromMinutes,
  getStatusBadgeClass,
  getStatusLabel,
  prepareEntryInputs,
  recalculateEntryInputs,
  summarizeTimesheetEntries,
} from '@/lib/timesheetUtils'
import { Pencil, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

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

const inputClassName =
  'h-8 rounded-[8px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-2 text-xs tabular-nums'

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
    defaultBreakMinutes,
  } = useCompanySettings()
  const [draftEntries, setDraftEntries] = useState<TimesheetEntryInput[]>([])

  const recalcOptions = useMemo(
    () => ({ overtimeMode, overtimeAfterHours }),
    [overtimeAfterHours, overtimeMode],
  )

  useEffect(() => {
    if (!timesheet) return
    setDraftEntries(
      prepareEntryInputs(timesheet.weekStart, timesheet.entries, defaultBreakMinutes),
    )
  }, [timesheet, defaultBreakMinutes])

  const canEdit = timesheet ? canEditTimesheet(timesheet.status) : false
  const isEditable = mode === 'edit' && canEdit

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
      return { workedHours: 0, breakHours: 0, overtimeHours: 0 }
    }

    const entriesForSummary = displayEntries.map((entry) => ({
      id: entry.id ?? entry.dayDate,
      timesheetId: timesheet?.id ?? '',
      dayDate: entry.dayDate,
      startTime: entry.startTime,
      breakMinutes: entry.breakMinutes,
      finishTime: entry.finishTime,
      totalMinutes: entry.totalMinutes,
      overtimeMinutes: entry.overtimeMinutes,
    }))

    return summarizeTimesheetEntries(entriesForSummary)
  }, [displayEntries, timesheet?.id])

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
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        aria-label="Close timesheet drawer"
        onClick={onClose}
      />

      <aside
        className="relative flex h-full w-full max-w-2xl flex-col border-l border-[rgba(75,120,220,0.12)] bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.12)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="timesheet-drawer-title"
      >
        <div className="border-b border-[rgba(75,120,220,0.08)] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {isEditable ? 'Edit timesheet' : 'View timesheet'}
                {isEditable ? ' · Ctrl+S to save' : ''}
              </p>
              <h2
                id="timesheet-drawer-title"
                className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#2A376F]"
              >
                {timesheet.driverName}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {timesheet.weekLabel}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isSaving}
              className="size-9 shrink-0 rounded-[12px] text-slate-500 hover:bg-slate-50"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[#F8FBFF] px-2.5 py-1 font-medium text-slate-600 ring-1 ring-[rgba(75,120,220,0.08)]">
              {timesheet.driverRole ?? 'Worker'}
            </span>
            <span className="rounded-full bg-[#F8FBFF] px-2.5 py-1 font-medium text-slate-600 ring-1 ring-[rgba(75,120,220,0.08)]">
              Vehicle: {timesheet.vehicleRegistration}
            </span>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${getStatusBadgeClass(timesheet.status)}`}
            >
              {getStatusLabel(timesheet.status)}
            </span>
            <span className="rounded-full bg-[#F8FBFF] px-2.5 py-1 font-medium text-slate-600 ring-1 ring-[rgba(75,120,220,0.08)]">
              OT mode: {overtimeMode}
            </span>
            {canEdit ? (
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${
                  isEditable
                    ? 'bg-blue-50 text-blue-700 ring-blue-100'
                    : 'bg-slate-100 text-slate-500 ring-slate-200'
                }`}
              >
                {isEditable ? 'Editing' : 'Read-only'}
              </span>
            ) : null}
          </div>
        </div>

        {saveError ? (
          <div className="mx-4 mt-3 rounded-[10px] bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-100">
            {saveError}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="overflow-hidden rounded-[12px] border border-[rgba(75,120,220,0.10)]">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-[#F4F8FF]">
                <tr className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  <th className="px-2 py-2">Day</th>
                  <th className="px-2 py-2">Start</th>
                  <th className="px-2 py-2">Break</th>
                  <th className="px-2 py-2">Finish</th>
                  <th className="px-2 py-2">Worked</th>
                  <th className="px-2 py-2">Overtime</th>
                </tr>
              </thead>
              <tbody>
                {displayEntries.map((entry, index) => (
                  <tr
                    key={entry.dayDate}
                    className="border-t border-[rgba(75,120,220,0.08)]"
                  >
                    <td className="px-2 py-1.5 font-medium text-slate-700">
                      {formatDayLabel(entry.dayDate)}
                    </td>
                    <td className="px-2 py-1.5">
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
                        <span className="tabular-nums text-slate-600">
                          {formatTime(entry.startTime)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
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
                        <span className="tabular-nums text-slate-600">
                          {formatBreak(entry.breakMinutes)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
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
                        <span className="tabular-nums text-slate-600">
                          {formatTime(entry.finishTime)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 font-semibold tabular-nums text-[#2A376F]">
                      {formatHoursFromMinutes(entry.totalMinutes)}
                    </td>
                    <td className="px-2 py-1.5">
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
                        <span className="tabular-nums text-amber-700">
                          {entry.overtimeMinutes > 0
                            ? formatHoursFromMinutes(entry.overtimeMinutes)
                            : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-[rgba(75,120,220,0.08)] bg-[#F8FBFF] px-4 py-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <SummaryItem label="Worked Hours" value={summary.workedHours} />
            <SummaryItem label="Break" value={summary.breakHours} />
            <SummaryItem label="Overtime" value={summary.overtimeHours} />
          </div>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
              className="h-8 rounded-[10px] px-3 text-xs font-semibold text-slate-600"
            >
              Close
            </Button>

            {mode === 'view' && canEdit ? (
              <Button
                type="button"
                onClick={onEdit}
                disabled={isSaving}
                className="h-8 rounded-[10px] bg-white px-3 text-xs font-semibold text-[#2563EB] ring-1 ring-[rgba(75,120,220,0.12)] hover:bg-[#F8FBFF]"
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
                  className="h-8 rounded-[10px] bg-white px-3 text-xs font-semibold text-[#2563EB] ring-1 ring-[rgba(75,120,220,0.12)] hover:bg-[#F8FBFF]"
                >
                  {isSaving ? 'Saving…' : 'Save draft'}
                </Button>
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSubmit()}
                  className="h-8 rounded-[10px] bg-[#2563EB] px-3 text-xs font-semibold text-white hover:bg-[#1d4ed8]"
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

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] bg-white px-2.5 py-2 ring-1 ring-[rgba(75,120,220,0.08)]">
      <p className="text-[10px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#2A376F]">
        {value.toFixed(1)}h
      </p>
    </div>
  )
}

import { Button } from '@/components/ui/button'
import { CURRENCY_OPTIONS } from '@/lib/companySettingsTypes'
import {
  validateWorkerTimesheetSettingsForm,
} from '@/lib/resolveEffectiveTimesheetSettings'
import { TIMESHEET_WEEK_START_DAY_OPTIONS } from '@/lib/timesheetWeekNumber'
import { cn } from '@/lib/utils'
import {
  WORKER_BREAK_MINUTES_OPTIONS,
  type EffectiveTimesheetSettings,
  type WeekendRulesScope,
  type WorkerTimesheetSettingsForm,
} from '@/lib/workerTimesheetSettingsTypes'
import {
  resetOwnDriverTimesheetSettings,
  saveOwnDriverTimesheetSettings,
  WorkerTimesheetSettingsServiceError,
} from '@/services/workerTimesheetSettingsService'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type Props = {
  driverId: string
  initialEffective: EffectiveTimesheetSettings
  onSaved: () => Promise<void> | void
}

function formFromEffective(effective: EffectiveTimesheetSettings): WorkerTimesheetSettingsForm {
  return {
    overtimeMode: effective.overtimeMode,
    overtimeCalculationMethod: effective.overtimeCalculationMethod,
    overtimeAfterHours: effective.overtimeAfterHours,
    weeklyOvertimeAfterHours: effective.weeklyOvertimeAfterHours,
    overtimeMultiplier: effective.overtimeMultiplier,
    defaultBreakMinutes: effective.defaultBreakMinutes,
    paidBreaks: effective.paidBreaks,
    roundTimeMinutes: effective.roundTimeMinutes,
    currency: effective.currency,
    timesheetWeekStartDay: effective.timesheetWeekStartDay,
    saturdayOvertimeEnabled: effective.saturdayOvertimeEnabled,
    saturdayOvertimeAfterHours: effective.saturdayOvertimeAfterHours,
    saturdayOvertimeMultiplier: effective.saturdayOvertimeMultiplier,
    saturdayGuaranteedPaidHours: effective.saturdayGuaranteedPaidHours,
    saturdayUseCompanyDefaultBreak: effective.saturdayUseCompanyDefaultBreak,
    sundayOvertimeEnabled: effective.sundayOvertimeEnabled,
    sundayOvertimeAfterHours: effective.sundayOvertimeAfterHours,
    sundayOvertimeMultiplier: effective.sundayOvertimeMultiplier,
    sundayGuaranteedPaidHours: effective.sundayGuaranteedPaidHours,
    sundayUseCompanyDefaultBreak: effective.sundayUseCompanyDefaultBreak,
    useCompanyDefaultHolidayHours: effective.useCompanyDefaultHolidayHours,
    defaultPaidHolidayHours: effective.defaultPaidHolidayHours,
  }
}

function snapshot(form: WorkerTimesheetSettingsForm): string {
  return JSON.stringify(form)
}

export function WorkerTimesheetSettingsForm({
  driverId,
  initialEffective,
  onSaved,
}: Props) {
  const [form, setForm] = useState(() => formFromEffective(initialEffective))
  const [baseline, setBaseline] = useState(() =>
    snapshot(formFromEffective(initialEffective)),
  )
  const [hasOverride, setHasOverride] = useState(initialEffective.hasWorkerOverride)
  const [weekendRulesScope, setWeekendRulesScope] = useState<WeekendRulesScope>(
    initialEffective.weekendRulesScope,
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const saveLockRef = useRef(false)
  const weekendEditable = weekendRulesScope === 'worker'

  useEffect(() => {
    const next = formFromEffective(initialEffective)
    setForm(next)
    setBaseline(snapshot(next))
    setHasOverride(initialEffective.hasWorkerOverride)
    setWeekendRulesScope(initialEffective.weekendRulesScope)
  }, [initialEffective])

  const validationError = useMemo(
    () => validateWorkerTimesheetSettingsForm(form),
    [form],
  )
  const isDirty = snapshot(form) !== baseline
  const canSave = isDirty && !validationError && !isSaving && !isResetting

  function patch(partial: Partial<WorkerTimesheetSettingsForm>) {
    setSuccess(null)
    setError(null)
    setForm((prev) => ({ ...prev, ...partial }))
  }

  async function handleSave() {
    if (!canSave || saveLockRef.current) return
    const message = validateWorkerTimesheetSettingsForm(form)
    if (message) {
      setError(message)
      return
    }

    saveLockRef.current = true
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await saveOwnDriverTimesheetSettings(driverId, form, weekendRulesScope)
      setBaseline(snapshot(form))
      setHasOverride(true)
      setSuccess('Timesheet settings saved.')
      await onSaved()
    } catch (saveError) {
      setError(
        saveError instanceof WorkerTimesheetSettingsServiceError
          ? saveError.message
          : saveError instanceof Error
            ? saveError.message
            : 'Unable to save Timesheet settings.',
      )
    } finally {
      setIsSaving(false)
      saveLockRef.current = false
    }
  }

  async function handleReset() {
    if (isSaving || isResetting || saveLockRef.current) return
    saveLockRef.current = true
    setIsResetting(true)
    setError(null)
    setSuccess(null)
    try {
      await resetOwnDriverTimesheetSettings(driverId)
      setHasOverride(false)
      setSuccess('Reset to company defaults.')
      await onSaved()
    } catch (resetError) {
      setError(
        resetError instanceof WorkerTimesheetSettingsServiceError
          ? resetError.message
          : resetError instanceof Error
            ? resetError.message
            : 'Unable to reset Timesheet settings.',
      )
    } finally {
      setIsResetting(false)
      saveLockRef.current = false
    }
  }

  return (
    <div className="space-y-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
      <div
        className={cn(
          'rounded-2xl border px-4 py-3 text-sm font-medium',
          hasOverride
            ? 'border-[color:var(--worker-primary)] bg-[color:var(--worker-primary-soft)] text-[color:var(--worker-text)]'
            : 'border-[color:var(--worker-border)] bg-[color:var(--worker-input)] text-[color:var(--worker-text)]',
        )}
      >
        {hasOverride ? 'Using personal settings' : 'Using company defaults'}
      </div>

      <SettingsCard
        title="Entry Mode"
        hint="Automatic calculates Basic and OT from your rules. Manual lets you enter hours yourself."
      >
        <Segmented
          value={form.overtimeMode}
          options={[
            { value: 'Automatic', label: 'Automatic' },
            { value: 'Manual', label: 'Manual' },
          ]}
          onChange={(value) =>
            patch({ overtimeMode: value as WorkerTimesheetSettingsForm['overtimeMode'] })
          }
        />
        {form.overtimeMode === 'Manual' ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Enter Basic, Additional, and OT worked hours on each day. Total uses OT ×
            multiplier.
          </p>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            The app calculates Basic and OT from Start/Finish using the rules below.
          </p>
        )}
      </SettingsCard>

      <SettingsCard
        title="Break Rules"
        hint="Unpaid break reduces worked time. Paid break goes to Additional Hours (not Basic, not OT)."
      >
        <FieldLabel>Default break (minutes)</FieldLabel>
        <Segmented
          value={String(form.defaultBreakMinutes)}
          options={WORKER_BREAK_MINUTES_OPTIONS.map((minutes) => ({
            value: String(minutes),
            label: String(minutes),
          }))}
          onChange={(value) =>
            patch({
              defaultBreakMinutes: Number(value) as WorkerTimesheetSettingsForm['defaultBreakMinutes'],
            })
          }
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">Paid breaks</p>
            <p className="text-xs text-slate-500">Add break minutes to Additional Hours</p>
          </div>
          <Switch
            checked={form.paidBreaks}
            onChange={(checked) => patch({ paidBreaks: checked })}
            label="Paid breaks"
          />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Holiday hours"
        hint="Hours credited when a Timesheet day is marked Holiday (H). 0 = unpaid holiday."
      >
        <Segmented
          value={form.useCompanyDefaultHolidayHours ? 'company' : 'custom'}
          options={[
            { value: 'company', label: 'Use company default' },
            { value: 'custom', label: 'Custom holiday hours' },
          ]}
          onChange={(value) =>
            patch({ useCompanyDefaultHolidayHours: value === 'company' })
          }
        />
        {form.useCompanyDefaultHolidayHours ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Using company default: {form.defaultPaidHolidayHours} h per Holiday day.
          </p>
        ) : (
          <div className="mt-4">
            <FieldLabel>Custom holiday hours per day</FieldLabel>
            <NumberInput
              value={form.defaultPaidHolidayHours}
              min={0}
              max={24}
              step={0.25}
              onChange={(value) => patch({ defaultPaidHolidayHours: value })}
            />
            <p className="mt-1 text-xs text-slate-500">
              Decimals allowed (e.g. 7.5). Use 0 for unpaid holiday.
            </p>
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        title="Overtime Rules"
        hint="Applies in Automatic mode. Manual mode still uses the multiplier for Total."
      >
        <Segmented
          value={form.overtimeCalculationMethod}
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'none', label: 'None' },
          ]}
          onChange={(value) =>
            patch({
              overtimeCalculationMethod:
                value as WorkerTimesheetSettingsForm['overtimeCalculationMethod'],
            })
          }
        />

        {form.overtimeCalculationMethod === 'daily' ? (
          <div className="mt-4">
            <FieldLabel>Daily threshold (hours)</FieldLabel>
            <NumberInput
              value={form.overtimeAfterHours}
              min={0}
              max={24}
              step={0.5}
              onChange={(value) => patch({ overtimeAfterHours: value })}
            />
            <p className="mt-1 text-xs text-slate-500">Example: 10.5 hours per day</p>
          </div>
        ) : null}

        {form.overtimeCalculationMethod === 'weekly' ? (
          <div className="mt-4">
            <FieldLabel>Weekly threshold (hours)</FieldLabel>
            <NumberInput
              value={form.weeklyOvertimeAfterHours}
              min={0}
              max={168}
              step={0.5}
              onChange={(value) => patch({ weeklyOvertimeAfterHours: value })}
            />
            <p className="mt-1 text-xs text-slate-500">Example: 45 hours per week</p>
          </div>
        ) : null}

        {form.overtimeCalculationMethod === 'none' ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Automatic mode will not create OT hours. You can still enter OT in Manual mode.
          </p>
        ) : null}

        <div className="mt-4">
          <FieldLabel>Overtime multiplier</FieldLabel>
          <NumberInput
            value={form.overtimeMultiplier}
            min={1}
            max={3}
            step={0.1}
            onChange={(value) => patch({ overtimeMultiplier: value })}
          />
          <p className="mt-1 text-xs text-slate-500">
            Common values: 1.0, 1.5, 2.0. OT display stays as worked hours.
          </p>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Weekend Rules"
        hint={
          weekendEditable
            ? 'Saturday and Sunday are independent.'
            : 'Managed by your company. Your Admin controls these values for everyone.'
        }
      >
        {weekendEditable ? (
          <>
            <WeekendDayEditor
              dayLabel="Saturday"
              enabled={form.saturdayOvertimeEnabled}
              afterHours={form.saturdayOvertimeAfterHours}
              multiplier={form.saturdayOvertimeMultiplier}
              guaranteed={form.saturdayGuaranteedPaidHours}
              useCompanyDefaultBreak={form.saturdayUseCompanyDefaultBreak}
              onEnabledChange={(enabled) => patch({ saturdayOvertimeEnabled: enabled })}
              onAfterHoursChange={(value) => patch({ saturdayOvertimeAfterHours: value })}
              onMultiplierChange={(value) => patch({ saturdayOvertimeMultiplier: value })}
              onGuaranteedChange={(value) => patch({ saturdayGuaranteedPaidHours: value })}
              onUseCompanyDefaultBreakChange={(checked) =>
                patch({ saturdayUseCompanyDefaultBreak: checked })
              }
            />
            <div className="my-4 border-t border-slate-100" />
            <WeekendDayEditor
              dayLabel="Sunday"
              enabled={form.sundayOvertimeEnabled}
              afterHours={form.sundayOvertimeAfterHours}
              multiplier={form.sundayOvertimeMultiplier}
              guaranteed={form.sundayGuaranteedPaidHours}
              useCompanyDefaultBreak={form.sundayUseCompanyDefaultBreak}
              onEnabledChange={(enabled) => patch({ sundayOvertimeEnabled: enabled })}
              onAfterHoursChange={(value) => patch({ sundayOvertimeAfterHours: value })}
              onMultiplierChange={(value) => patch({ sundayOvertimeMultiplier: value })}
              onGuaranteedChange={(value) => patch({ sundayGuaranteedPaidHours: value })}
              onUseCompanyDefaultBreakChange={(checked) =>
                patch({ sundayUseCompanyDefaultBreak: checked })
              }
            />
          </>
        ) : (
          <>
            <WeekendDayReadOnly
              dayLabel="Saturday"
              enabled={form.saturdayOvertimeEnabled}
              afterHours={form.saturdayOvertimeAfterHours}
              multiplier={form.saturdayOvertimeMultiplier}
              guaranteed={form.saturdayGuaranteedPaidHours}
              useCompanyDefaultBreak={form.saturdayUseCompanyDefaultBreak}
            />
            <div className="my-4 border-t border-slate-100" />
            <WeekendDayReadOnly
              dayLabel="Sunday"
              enabled={form.sundayOvertimeEnabled}
              afterHours={form.sundayOvertimeAfterHours}
              multiplier={form.sundayOvertimeMultiplier}
              guaranteed={form.sundayGuaranteedPaidHours}
              useCompanyDefaultBreak={form.sundayUseCompanyDefaultBreak}
            />
          </>
        )}
      </SettingsCard>

      <SettingsCard title="Week and Time Display" hint="Timesheet clocks stay in 24-hour format.">
        <FieldLabel>Week starts on</FieldLabel>
        <Segmented
          value={form.timesheetWeekStartDay}
          options={TIMESHEET_WEEK_START_DAY_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          onChange={(value) =>
            patch({
              timesheetWeekStartDay:
                value as WorkerTimesheetSettingsForm['timesheetWeekStartDay'],
            })
          }
        />

        <div className="mt-4">
          <FieldLabel>Time rounding</FieldLabel>
          <Segmented
            value={String(form.roundTimeMinutes)}
            options={[
              { value: '0', label: 'None' },
              { value: '5', label: '5 min' },
              { value: '15', label: '15 min' },
            ]}
            onChange={(value) =>
              patch({
                roundTimeMinutes: Number(
                  value,
                ) as WorkerTimesheetSettingsForm['roundTimeMinutes'],
              })
            }
          />
        </div>

        <div className="mt-4">
          <FieldLabel>Currency</FieldLabel>
          <Segmented
            value={form.currency}
            options={CURRENCY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.value,
            }))}
            onChange={(value) =>
              patch({ currency: value as WorkerTimesheetSettingsForm['currency'] })
            }
          />
        </div>
      </SettingsCard>

      <SettingsCard title="Reset to Company Defaults">
        <p className="text-sm text-slate-600">
          Remove your personal override and use the current company Timesheet settings.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-12 w-full rounded-2xl"
          disabled={!hasOverride || isSaving || isResetting}
          onClick={() => void handleReset()}
        >
          {isResetting ? 'Resetting…' : 'Reset to company defaults'}
        </Button>
      </SettingsCard>

      {validationError ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {validationError}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}

      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-20">
        <Button
          type="button"
          className="worker-btn-primary h-12 w-full rounded-2xl text-base font-semibold"
          disabled={!canSave}
          onClick={() => void handleSave()}
        >
          {isSaving ? 'Saving…' : 'Save Timesheet settings'}
        </Button>
      </div>
    </div>
  )
}

function SettingsCard({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="worker-card rounded-[1.75rem] p-4">
      <h2 className="text-base font-semibold text-[color:var(--worker-text)]">{title}</h2>
      {hint ? (
        <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">{hint}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-sm font-medium text-slate-600">{children}</p>
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-12 rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors',
              selected
                ? 'border-[color:var(--worker-primary)] bg-[color:var(--worker-primary-soft)] text-[color:var(--worker-text)]'
                : 'border-[color:var(--worker-border)] bg-[color:var(--worker-card)] text-[color:var(--worker-text)] hover:bg-[color:var(--worker-input)]',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-8 w-14 shrink-0 rounded-full transition-colors',
        checked ? 'bg-[color:var(--worker-primary)]' : 'bg-[color:var(--worker-border)]',
      )}
    >
      <span
        className={cn(
          'absolute top-1 h-6 w-6 rounded-full bg-[color:var(--worker-text)] shadow transition-transform',
          checked ? 'left-7' : 'left-1',
        )}
      />
    </button>
  )
}

function NumberInput({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={Number.isFinite(value) ? value : ''}
      onChange={(event) => {
        const next = Number.parseFloat(event.target.value)
        onChange(Number.isFinite(next) ? next : Number.NaN)
      }}
      className="worker-input h-12 w-full rounded-2xl px-4 text-base font-semibold outline-none focus:border-[color:var(--worker-primary)] focus:ring-2 focus:ring-[color:var(--worker-primary-soft)]"
    />
  )
}

function WeekendDayEditor({
  dayLabel,
  enabled,
  afterHours,
  multiplier,
  guaranteed,
  useCompanyDefaultBreak,
  onEnabledChange,
  onAfterHoursChange,
  onMultiplierChange,
  onGuaranteedChange,
  onUseCompanyDefaultBreakChange,
}: {
  dayLabel: string
  enabled: boolean
  afterHours: number
  multiplier: number
  guaranteed: number
  useCompanyDefaultBreak: boolean
  onEnabledChange: (enabled: boolean) => void
  onAfterHoursChange: (value: number) => void
  onMultiplierChange: (value: number) => void
  onGuaranteedChange: (value: number) => void
  onUseCompanyDefaultBreakChange: (checked: boolean) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{dayLabel} overtime</p>
          <p className="text-xs text-slate-500">Use weekend guaranteed-hours rules</p>
        </div>
        <Switch
          checked={enabled}
          onChange={onEnabledChange}
          label={`${dayLabel} overtime`}
        />
      </div>
      {enabled ? (
        <div className="mt-3 space-y-3">
          <div>
            <FieldLabel>Overtime threshold (hours)</FieldLabel>
            <NumberInput
              value={afterHours}
              min={0}
              max={24}
              step={0.5}
              onChange={onAfterHoursChange}
            />
          </div>
          <div>
            <FieldLabel>Overtime multiplier</FieldLabel>
            <NumberInput
              value={multiplier}
              min={1}
              max={3}
              step={0.1}
              onChange={onMultiplierChange}
            />
          </div>
          <div>
            <FieldLabel>Guaranteed paid hours</FieldLabel>
            <NumberInput
              value={guaranteed}
              min={0}
              max={24}
              step={0.5}
              onChange={onGuaranteedChange}
            />
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">Use company default break</p>
          <p className="text-xs text-slate-500">
            On: new {dayLabel} entries use the company default break. Off: they start with
            Break = 0 (still editable).
          </p>
        </div>
        <Switch
          checked={useCompanyDefaultBreak}
          onChange={onUseCompanyDefaultBreakChange}
          label={`Use company default break — ${dayLabel}`}
        />
      </div>
    </div>
  )
}

function WeekendDayReadOnly({
  dayLabel,
  enabled,
  afterHours,
  multiplier,
  guaranteed,
  useCompanyDefaultBreak,
}: {
  dayLabel: string
  enabled: boolean
  afterHours: number
  multiplier: number
  guaranteed: number
  useCompanyDefaultBreak: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-950">{dayLabel} overtime</p>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
            enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
          )}
        >
          {enabled ? 'On' : 'Off'}
        </span>
      </div>
      {enabled ? (
        <div className="mt-3 space-y-2">
          <ReadOnlyRow label="Overtime threshold" value={`${afterHours} hours`} />
          <ReadOnlyRow label="Overtime multiplier" value={`${multiplier}x`} />
          <ReadOnlyRow label="Guaranteed paid hours" value={`${guaranteed} hours`} />
        </div>
      ) : null}
      <div className="mt-3">
        <ReadOnlyRow
          label="Use company default break"
          value={useCompanyDefaultBreak ? 'On' : 'Off'}
        />
      </div>
      <p className="mt-2 text-xs font-medium text-slate-400">Managed by your company</p>
    </div>
  )
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-700">{value}</span>
    </div>
  )
}

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
    sundayOvertimeEnabled: effective.sundayOvertimeEnabled,
    sundayOvertimeAfterHours: effective.sundayOvertimeAfterHours,
    sundayOvertimeMultiplier: effective.sundayOvertimeMultiplier,
    sundayGuaranteedPaidHours: effective.sundayGuaranteedPaidHours,
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
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const saveLockRef = useRef(false)

  useEffect(() => {
    const next = formFromEffective(initialEffective)
    setForm(next)
    setBaseline(snapshot(next))
    setHasOverride(initialEffective.hasWorkerOverride)
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
      await saveOwnDriverTimesheetSettings(driverId, form)
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
            ? 'border-[#2F80ED]/40 bg-[#EAF4FF] text-[#1B4F8A]'
            : 'border-slate-200 bg-slate-50 text-slate-700',
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

      <SettingsCard title="Weekend Rules" hint="Saturday and Sunday are independent.">
        <WeekendDayEditor
          dayLabel="Saturday"
          enabled={form.saturdayOvertimeEnabled}
          afterHours={form.saturdayOvertimeAfterHours}
          multiplier={form.saturdayOvertimeMultiplier}
          guaranteed={form.saturdayGuaranteedPaidHours}
          onEnabledChange={(enabled) => patch({ saturdayOvertimeEnabled: enabled })}
          onAfterHoursChange={(value) => patch({ saturdayOvertimeAfterHours: value })}
          onMultiplierChange={(value) => patch({ saturdayOvertimeMultiplier: value })}
          onGuaranteedChange={(value) => patch({ saturdayGuaranteedPaidHours: value })}
        />
        <div className="my-4 border-t border-slate-100" />
        <WeekendDayEditor
          dayLabel="Sunday"
          enabled={form.sundayOvertimeEnabled}
          afterHours={form.sundayOvertimeAfterHours}
          multiplier={form.sundayOvertimeMultiplier}
          guaranteed={form.sundayGuaranteedPaidHours}
          onEnabledChange={(enabled) => patch({ sundayOvertimeEnabled: enabled })}
          onAfterHoursChange={(value) => patch({ sundayOvertimeAfterHours: value })}
          onMultiplierChange={(value) => patch({ sundayOvertimeMultiplier: value })}
          onGuaranteedChange={(value) => patch({ sundayGuaranteedPaidHours: value })}
        />
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
          className="h-12 w-full rounded-2xl bg-[#2F80ED] text-base font-semibold hover:bg-[#2569C7]"
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
    <section className="rounded-[1.75rem] border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
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
                ? 'border-[#2F80ED] bg-[#EAF4FF] text-[#1B4F8A]'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
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
        checked ? 'bg-[#2F80ED]' : 'bg-slate-300',
      )}
    >
      <span
        className={cn(
          'absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform',
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
      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/20"
    />
  )
}

function WeekendDayEditor({
  dayLabel,
  enabled,
  afterHours,
  multiplier,
  guaranteed,
  onEnabledChange,
  onAfterHoursChange,
  onMultiplierChange,
  onGuaranteedChange,
}: {
  dayLabel: string
  enabled: boolean
  afterHours: number
  multiplier: number
  guaranteed: number
  onEnabledChange: (enabled: boolean) => void
  onAfterHoursChange: (value: number) => void
  onMultiplierChange: (value: number) => void
  onGuaranteedChange: (value: number) => void
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
    </div>
  )
}

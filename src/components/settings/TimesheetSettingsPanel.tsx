import {
  SettingsChipGroup,
  SettingsChoiceGroup,
  SettingsField,
  SettingsPageIntro,
  SettingsSegmentedControl,
  SettingsToggle,
  settingsCardDescriptionClassName,
  settingsCardTitleClassName,
  settingsFieldHintClassName,
  settingsFieldLabelClassName,
  settingsSelectClassName,
} from '@/components/settings/SettingsControls'
import {
  OVERTIME_AFTER_HOURS_OPTIONS,
  OVERTIME_MULTIPLIER_OPTIONS,
  WEEKEND_OVERTIME_MULTIPLIER_OPTIONS,
  WEEKLY_OVERTIME_AFTER_HOURS_OPTIONS,
  formatOvertimeAfterHoursLabel,
  formatOvertimeMultiplierLabel,
  formatWeeklyOvertimeAfterHoursLabel,
  formatWeekendOvertimeMultiplierLabel,
  type CompanySettingsInput,
  type DefaultBreakMinutes,
  type OvertimeCalculationMethod,
  type OvertimeMode,
  type OvertimeMultiplier,
  type RoundTimeMinutes,
  type TimesheetManagementScope,
} from '@/lib/companySettingsTypes'
import {
  getDaysInMonth,
  MONTH_OPTIONS,
  TIMESHEET_WEEK_START_DAY_OPTIONS,
} from '@/lib/timesheetWeekNumber'
import { cn } from '@/lib/utils'
import { useEffect, useState, type ReactNode } from 'react'

type TimesheetSettingsPanelProps = {
  form: CompanySettingsInput
  onChange: (patch: Partial<CompanySettingsInput>) => void
}

const sectionCardClassName =
  'rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-[0_10px_30px_rgba(30,64,175,0.07)] sm:p-5 dark:border-slate-700 dark:bg-slate-900/60'

const weekendDayCardClassName =
  'flex h-full flex-col rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40'

function SectionCard({
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <section className={cn(sectionCardClassName, className)}>
      <div>
        <h3 className={settingsCardTitleClassName}>{title}</h3>
        {description ? (
          <p className={cn(settingsCardDescriptionClassName, 'mt-0.5')}>{description}</p>
        ) : null}
      </div>
      <div className={cn('mt-4 space-y-4', contentClassName)}>{children}</div>
    </section>
  )
}

function formatHolidayHoursDisplay(hours: number): string {
  const rounded = Math.round(hours * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

function holidayHalfDayHours(fullDayHours: number): number {
  return Math.round(fullDayHours * 50) / 100
}

function HolidayPayHelperText({ fullDayHours }: { fullDayHours: number }) {
  const halfDayHours = holidayHalfDayHours(fullDayHours)
  const fullLabel = formatHolidayHoursDisplay(fullDayHours)
  const halfLabel = formatHolidayHoursDisplay(halfDayHours)

  return (
    <div className={cn(settingsFieldHintClassName, 'mt-2 space-y-1')}>
      <p>
        A full day credits {fullLabel} {fullDayHours === 1 ? 'hour' : 'hours'}. A half day credits{' '}
        {halfLabel} {halfDayHours === 1 ? 'hour' : 'hours'}.
      </p>
      <p>Use 0 for unpaid leave.</p>
      <p>Individual Worker overrides are managed in the Worker profile.</p>
    </div>
  )
}

function WorkflowApprovalToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <div className="min-w-0">
        <p className={settingsFieldLabelClassName}>Require manager approval</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Submitted timesheets must be approved before payroll.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Require manager approval"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center justify-start overflow-hidden rounded-full transition-colors',
          checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  )
}

/**
 * Weekend decimal-hours input that allows clearing while typing (including to enter 0).
 * Keeps a string draft while focused; commits parseable non-negative numbers immediately
 * (nullish-safe so 0 is preserved). Empty/invalid draft restores the last committed value on blur.
 */
function WeekendDecimalHoursInput({
  value,
  onCommit,
  disabled = false,
}: {
  value: number
  onCommit: (next: number) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(() => String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      setDraft(String(value))
    }
  }, [focused, value])

  function tryParseNonNegative(raw: string): number | null {
    const trimmed = raw.trim()
    if (trimmed === '') return null
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) return null
    return parsed
  }

  return (
    <input
      type="number"
      min={0}
      step={0.25}
      value={draft}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        const raw = event.target.value
        setDraft(raw)
        const parsed = tryParseNonNegative(raw)
        if (parsed != null) {
          onCommit(parsed)
        }
      }}
      onBlur={() => {
        setFocused(false)
        const parsed = tryParseNonNegative(draft)
        if (parsed != null) {
          onCommit(parsed)
          setDraft(String(parsed))
          return
        }
        setDraft(String(value))
      }}
      className={cn(settingsSelectClassName, 'mt-1.5 h-10')}
    />
  )
}

function WeekendDaySection({
  dayLabel,
  overtimeEnabled,
  onOvertimeEnabledChange,
  guaranteedPaidHours,
  onGuaranteedPaidHoursChange,
  overtimeAfterHours,
  onOvertimeAfterHoursChange,
  overtimeMultiplier,
  onOvertimeMultiplierChange,
  useCompanyDefaultBreak,
  onUseCompanyDefaultBreakChange,
  breakDescription,
  multiplierKeyPrefix,
}: {
  dayLabel: string
  overtimeEnabled: boolean
  onOvertimeEnabledChange: (checked: boolean) => void
  guaranteedPaidHours: number
  onGuaranteedPaidHoursChange: (next: number) => void
  overtimeAfterHours: number
  onOvertimeAfterHoursChange: (next: number) => void
  overtimeMultiplier: number
  onOvertimeMultiplierChange: (next: number) => void
  useCompanyDefaultBreak: boolean
  onUseCompanyDefaultBreakChange: (checked: boolean) => void
  breakDescription: string
  multiplierKeyPrefix: string
}) {
  return (
    <div className={weekendDayCardClassName}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 pb-3 dark:border-slate-700">
        <h4 className="text-sm font-semibold tracking-[-0.02em] text-[#2A376F] dark:text-slate-100">
          {dayLabel}
        </h4>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]',
            overtimeEnabled
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800'
              : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
          )}
        >
          {overtimeEnabled ? 'OT on' : 'OT off'}
        </span>
      </div>

      <div className="mt-4 flex flex-1 flex-col space-y-4">
        <SettingsToggle
          label="Overtime enabled"
          description={`Apply weekend overtime rules for ${dayLabel}.`}
          checked={overtimeEnabled}
          onChange={onOvertimeEnabledChange}
        />

        {overtimeEnabled ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="Guaranteed paid hours">
              <WeekendDecimalHoursInput
                value={guaranteedPaidHours}
                onCommit={onGuaranteedPaidHoursChange}
              />
            </SettingsField>

            <SettingsField label="Starts after">
              <WeekendDecimalHoursInput
                value={overtimeAfterHours}
                onCommit={onOvertimeAfterHoursChange}
              />
            </SettingsField>

            <SettingsField label="Multiplier" span="full">
              <select
                value={overtimeMultiplier}
                onChange={(event) => onOvertimeMultiplierChange(Number(event.target.value))}
                className={cn(settingsSelectClassName, 'mt-1.5 h-10')}
              >
                {WEEKEND_OVERTIME_MULTIPLIER_OPTIONS.map((option) => (
                  <option key={`${multiplierKeyPrefix}-mult-${option.toFixed(1)}`} value={option}>
                    {formatWeekendOvertimeMultiplierLabel(option)}
                  </option>
                ))}
              </select>
            </SettingsField>
          </div>
        ) : null}

        <SettingsToggle
          label="Use company default break"
          description={breakDescription}
          checked={useCompanyDefaultBreak}
          onChange={onUseCompanyDefaultBreakChange}
        />
      </div>
    </div>
  )
}

export function TimesheetSettingsPanel({ form, onChange }: TimesheetSettingsPanelProps) {
  const isManual = form.overtimeMode === 'Manual'
  const isAutomatic = form.overtimeMode === 'Automatic'
  const otMethod = form.overtimeCalculationMethod
  const weeklyThresholdOptions = WEEKLY_OVERTIME_AFTER_HOURS_OPTIONS.includes(
    form.weeklyOvertimeAfterHours,
  )
    ? WEEKLY_OVERTIME_AFTER_HOURS_OPTIONS
    : [...WEEKLY_OVERTIME_AFTER_HOURS_OPTIONS, form.weeklyOvertimeAfterHours].sort(
        (a, b) => a - b,
      )

  return (
    <div className="space-y-6 pb-28 sm:col-span-2 sm:pb-6">
      <SettingsPageIntro
        title="Timesheets"
        description="Working time, overtime and approval rules for payroll."
      />

      <SectionCard
        title="Timesheet Workflow"
        description="Choose how Timesheets are created, managed and approved."
        className="p-3 sm:p-4"
        contentClassName="mt-2 space-y-2"
      >
        <div className="grid gap-2 lg:grid-cols-2 lg:items-center">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <SettingsSegmentedControl
              label="Timesheet mode"
              value={form.overtimeMode}
              options={[
                { value: 'Manual', label: 'Manual' },
                { value: 'Automatic', label: 'Automatic' },
              ]}
              onChange={(value) => onChange({ overtimeMode: value as OvertimeMode })}
            />
          </div>

          {isManual ? (
            <p
              className={cn(
                settingsFieldHintClassName,
                'min-w-0 lg:col-span-2 lg:row-start-2',
              )}
            >
              Workers enter Basic, Overtime, Break and Additional Hours manually; totals are
              calculated automatically.
            </p>
          ) : null}

          <div className="min-w-0 lg:col-start-2 lg:row-start-1">
            <WorkflowApprovalToggle
              checked={form.requireTimesheetApproval}
              onChange={(checked) => onChange({ requireTimesheetApproval: checked })}
            />
          </div>
        </div>

        <SettingsChoiceGroup<TimesheetManagementScope>
          legend="Who manages Timesheets"
          name="timesheet-management-scope"
          value={form.timesheetManagementScope}
          onChange={(value) => onChange({ timesheetManagementScope: value })}
          options={[
            {
              value: 'office',
              label: 'Office manages Timesheets',
              description:
                'Workers can view their Timesheets, but only Office can create or edit them.',
            },
            {
              value: 'worker',
              label: 'Workers manage their own Timesheets',
              description:
                'Workers can create, edit, save and submit their own Timesheets. Office reviews and approves them.',
            },
          ]}
        />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <SectionCard
          title="Time Entry Rules"
          description="Configure breaks and clock-time rounding."
          className="h-full"
        >
          <SettingsChipGroup<DefaultBreakMinutes>
            label="Default break"
            options={[
              { value: 30, label: '30 min' },
              { value: 45, label: '45 min' },
              { value: 60, label: '60 min' },
            ]}
            value={form.defaultBreakMinutes}
            onChange={(value) => onChange({ defaultBreakMinutes: value })}
          />

          <SettingsToggle
            label="Paid breaks"
            description="When enabled, break time is included in paid hours. When disabled, break time is deducted from total hours."
            checked={form.paidBreaks}
            onChange={(checked) => onChange({ paidBreaks: checked })}
          />

          <SettingsChipGroup<RoundTimeMinutes>
            label="Time rounding"
            hint="Round start and finish times to the nearest interval."
            options={[
              { value: 0, label: 'None' },
              { value: 5, label: '5 min' },
              { value: 15, label: '15 min' },
            ]}
            value={form.roundTimeMinutes}
            onChange={(value) => onChange({ roundTimeMinutes: value })}
          />
        </SectionCard>

        <SectionCard
          title="Week Setup"
          description="Set week boundaries and the annual Week 1 reset."
          className="h-full"
        >
          <SettingsChipGroup
            label="Week starts on"
            options={TIMESHEET_WEEK_START_DAY_OPTIONS}
            value={form.timesheetWeekStartDay}
            onChange={(value) => onChange({ timesheetWeekStartDay: value })}
          />

          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Week 1 reset
            </p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Week 1 begins in the week containing this date each year.
            </p>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
              <SettingsField label="Day">
                <select
                  value={form.timesheetWeekResetDay}
                  onChange={(event) =>
                    onChange({ timesheetWeekResetDay: Number.parseInt(event.target.value, 10) })
                  }
                  className={cn(settingsSelectClassName, 'mt-1.5 h-10')}
                >
                  {getDaysInMonth(form.timesheetWeekResetMonth).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </SettingsField>

              <SettingsField label="Month">
                <select
                  value={form.timesheetWeekResetMonth}
                  onChange={(event) => {
                    const month = Number.parseInt(event.target.value, 10)
                    const maxDay = getDaysInMonth(month).length
                    onChange({
                      timesheetWeekResetMonth: month,
                      timesheetWeekResetDay: Math.min(form.timesheetWeekResetDay, maxDay),
                    })
                  }}
                  className={cn(settingsSelectClassName, 'mt-1.5 h-10')}
                >
                  {MONTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </SettingsField>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Standard Overtime Rules"
        description="Set the normal overtime calculation used from Monday to Friday."
      >
        <SettingsChipGroup<OvertimeCalculationMethod>
          label="Overtime calculation"
          hint="Company default for Automatic mode. Workers may override personally."
          options={[
            { value: 'daily', label: 'Daily overtime' },
            { value: 'weekly', label: 'Weekly overtime' },
            { value: 'none', label: 'No automatic overtime' },
          ]}
          value={otMethod}
          onChange={(value) => onChange({ overtimeCalculationMethod: value })}
        />

        {otMethod === 'daily' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="Daily overtime threshold">
              <select
                value={form.overtimeAfterHours}
                onChange={(event) =>
                  onChange({ overtimeAfterHours: Number.parseFloat(event.target.value) })
                }
                className={cn(settingsSelectClassName, 'mt-1.5 h-10')}
              >
                {OVERTIME_AFTER_HOURS_OPTIONS.map((hours) => (
                  <option key={hours.toFixed(1)} value={hours}>
                    {formatOvertimeAfterHoursLabel(hours)}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Example: 10.5 hours per day
              </p>
            </SettingsField>

            <SettingsField label="Overtime multiplier">
              <select
                value={form.overtimeMultiplier}
                onChange={(event) =>
                  onChange({
                    overtimeMultiplier: Number(event.target.value) as OvertimeMultiplier,
                  })
                }
                className={cn(settingsSelectClassName, 'mt-1.5 h-10')}
              >
                {OVERTIME_MULTIPLIER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatOvertimeMultiplierLabel(option)}
                  </option>
                ))}
              </select>
            </SettingsField>
          </div>
        ) : null}

        {otMethod === 'weekly' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="Weekly overtime threshold">
              <select
                value={form.weeklyOvertimeAfterHours}
                onChange={(event) =>
                  onChange({
                    weeklyOvertimeAfterHours: Number.parseFloat(event.target.value),
                  })
                }
                className={cn(settingsSelectClassName, 'mt-1.5 h-10')}
              >
                {weeklyThresholdOptions.map((hours) => (
                  <option key={hours.toFixed(1)} value={hours}>
                    {formatWeeklyOvertimeAfterHoursLabel(hours)}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Example: 45 hours per week
              </p>
            </SettingsField>

            <SettingsField label="Overtime multiplier">
              <select
                value={form.overtimeMultiplier}
                onChange={(event) =>
                  onChange({
                    overtimeMultiplier: Number(event.target.value) as OvertimeMultiplier,
                  })
                }
                className={cn(settingsSelectClassName, 'mt-1.5 h-10')}
              >
                {OVERTIME_MULTIPLIER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatOvertimeMultiplierLabel(option)}
                  </option>
                ))}
              </select>
            </SettingsField>
          </div>
        ) : null}

        {otMethod === 'none' ? (
          <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
            <div className="rounded-xl border border-slate-200/60 bg-slate-50/60 px-3.5 py-3 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
              Automatic mode will not create OT hours. Manual OT entry remains available when
              Timesheet mode is Manual.
            </div>
            <SettingsField label="Overtime multiplier">
              <select
                value={form.overtimeMultiplier}
                onChange={(event) =>
                  onChange({
                    overtimeMultiplier: Number(event.target.value) as OvertimeMultiplier,
                  })
                }
                className={cn(settingsSelectClassName, 'mt-1.5 h-10')}
              >
                {OVERTIME_MULTIPLIER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatOvertimeMultiplierLabel(option)}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Used for Total when Manual OT is entered.
              </p>
            </SettingsField>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Holiday Pay Rules"
        description="Set the default paid hours credited for approved leave."
      >
        <SettingsField label="Default paid holiday hours per full day">
          <WeekendDecimalHoursInput
            value={form.defaultPaidHolidayHours}
            onCommit={(next) => onChange({ defaultPaidHolidayHours: next })}
          />
          <HolidayPayHelperText fullDayHours={form.defaultPaidHolidayHours} />
        </SettingsField>
      </SectionCard>

      {isAutomatic ? (
        <SectionCard
          title="Weekend Overtime Rules"
          description="Override the standard overtime rules for Saturday and Sunday."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <WeekendDaySection
              dayLabel="Saturday"
              overtimeEnabled={form.saturdayOvertimeEnabled}
              onOvertimeEnabledChange={(checked) =>
                onChange({ saturdayOvertimeEnabled: checked })
              }
              guaranteedPaidHours={form.saturdayGuaranteedPaidHours}
              onGuaranteedPaidHoursChange={(next) =>
                onChange({ saturdayGuaranteedPaidHours: next })
              }
              overtimeAfterHours={form.saturdayOvertimeAfterHours}
              onOvertimeAfterHoursChange={(next) =>
                onChange({ saturdayOvertimeAfterHours: next })
              }
              overtimeMultiplier={form.saturdayOvertimeMultiplier}
              onOvertimeMultiplierChange={(next) =>
                onChange({ saturdayOvertimeMultiplier: next })
              }
              useCompanyDefaultBreak={form.saturdayUseCompanyDefaultBreak}
              onUseCompanyDefaultBreakChange={(checked) =>
                onChange({ saturdayUseCompanyDefaultBreak: checked })
              }
              breakDescription="When enabled, new Saturday timesheet entries use the company default break. When disabled, they start with Break = 0 (still editable)."
              multiplierKeyPrefix="sat"
            />

            <WeekendDaySection
              dayLabel="Sunday"
              overtimeEnabled={form.sundayOvertimeEnabled}
              onOvertimeEnabledChange={(checked) => onChange({ sundayOvertimeEnabled: checked })}
              guaranteedPaidHours={form.sundayGuaranteedPaidHours}
              onGuaranteedPaidHoursChange={(next) =>
                onChange({ sundayGuaranteedPaidHours: next })
              }
              overtimeAfterHours={form.sundayOvertimeAfterHours}
              onOvertimeAfterHoursChange={(next) =>
                onChange({ sundayOvertimeAfterHours: next })
              }
              overtimeMultiplier={form.sundayOvertimeMultiplier}
              onOvertimeMultiplierChange={(next) =>
                onChange({ sundayOvertimeMultiplier: next })
              }
              useCompanyDefaultBreak={form.sundayUseCompanyDefaultBreak}
              onUseCompanyDefaultBreakChange={(checked) =>
                onChange({ sundayUseCompanyDefaultBreak: checked })
              }
              breakDescription="When enabled, new Sunday timesheet entries use the company default break. When disabled, they start with Break = 0 (still editable)."
              multiplierKeyPrefix="sun"
            />
          </div>
        </SectionCard>
      ) : null}
    </div>
  )
}

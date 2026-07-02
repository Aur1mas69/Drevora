import type { ReactNode } from 'react'
import {
  SettingsField,
  SettingsToggle,
  settingsSelectClassName,
} from '@/components/settings/SettingsControls'
import {
  CURRENCY_OPTIONS,
  OVERTIME_AFTER_HOURS_OPTIONS,
  OVERTIME_MULTIPLIER_OPTIONS,
  WEEKEND_OVERTIME_AFTER_HOURS_OPTIONS,
  WEEKEND_OVERTIME_MULTIPLIER_OPTIONS,
  formatOvertimeAfterHoursLabel,
  formatOvertimeMultiplierLabel,
  formatWeekendOvertimeAfterHoursLabel,
  formatWeekendOvertimeMultiplierLabel,
  type CompanyCurrency,
  type CompanySettingsInput,
  type DefaultBreakMinutes,
  type OvertimeMode,
  type OvertimeMultiplier,
  type RoundTimeMinutes,
} from '@/lib/companySettingsTypes'
import {
  getDaysInMonth,
  MONTH_OPTIONS,
  TIMESHEET_WEEK_START_DAY_OPTIONS,
} from '@/lib/timesheetWeekNumber'
import { cn } from '@/lib/utils'

type TimesheetSettingsPanelProps = {
  form: CompanySettingsInput
  onChange: (patch: Partial<CompanySettingsInput>) => void
}

function TimesheetSettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[18px] border border-[rgba(75,120,220,0.10)] bg-[#F8FBFF]/90 p-5 shadow-[0_4px_16px_rgba(40,80,140,0.04)] sm:p-6 dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
      <div>
        <h3 className="text-base font-semibold tracking-[-0.02em] text-[#2A376F] dark:text-slate-100">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function OptionButtonGroup<T extends string | number>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string
  hint?: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-[12px] px-3.5 py-2 text-sm font-semibold transition-colors ring-1',
                selected
                  ? 'bg-[#EAF4FF] text-[#2563EB] ring-[#BFDBFE] dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60'
                  : 'bg-white text-slate-600 ring-[rgba(75,120,220,0.12)] hover:bg-[#F8FBFF] dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-slate-800',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ModeToggle({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: OvertimeMode) => void
  options: { value: OvertimeMode; label: string }[]
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      <div className="mt-2.5 inline-flex rounded-[12px] bg-white p-1 ring-1 ring-[rgba(75,120,220,0.12)] dark:bg-slate-800/70 dark:ring-white/10">
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-[10px] px-4 py-2 text-sm font-semibold transition-colors',
                selected
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'text-slate-600 hover:text-[#2A376F] dark:text-slate-400 dark:hover:text-slate-100',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TimesheetSettingsPanel({ form, onChange }: TimesheetSettingsPanelProps) {
  return (
    <div className="space-y-4 sm:col-span-2">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100">
          Timesheets
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Working time, overtime and approval rules for payroll.
        </p>
      </div>

      <TimesheetSettingsSection title="Breaks">
        <OptionButtonGroup<DefaultBreakMinutes>
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
      </TimesheetSettingsSection>

      <TimesheetSettingsSection
        title="Overtime"
        description="Thresholds and multipliers applied to worked hours."
      >
        <ModeToggle
          label="Overtime mode"
          value={form.overtimeMode}
          onChange={(value) => onChange({ overtimeMode: value })}
          options={[
            { value: 'Manual', label: 'Manual' },
            { value: 'Automatic', label: 'Automatic' },
          ]}
        />

        <SettingsField label="Overtime after">
          <select
            value={form.overtimeAfterHours}
            onChange={(event) =>
              onChange({ overtimeAfterHours: Number.parseFloat(event.target.value) })
            }
            className={settingsSelectClassName}
          >
            {OVERTIME_AFTER_HOURS_OPTIONS.map((hours) => (
              <option key={hours.toFixed(1)} value={hours}>
                {formatOvertimeAfterHoursLabel(hours)}
              </option>
            ))}
          </select>
        </SettingsField>

        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField label="Overtime multiplier">
            <select
              value={form.overtimeMultiplier}
              onChange={(event) =>
                onChange({
                  overtimeMultiplier: Number(event.target.value) as OvertimeMultiplier,
                })
              }
              className={settingsSelectClassName}
            >
              {OVERTIME_MULTIPLIER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatOvertimeMultiplierLabel(option)}
                </option>
              ))}
            </select>
          </SettingsField>

          <SettingsField label="Currency">
            <select
              value={form.currency}
              onChange={(event) =>
                onChange({ currency: event.target.value as CompanyCurrency })
              }
              className={settingsSelectClassName}
            >
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </SettingsField>
        </div>
      </TimesheetSettingsSection>

      <TimesheetSettingsSection title="Approval">
        <SettingsToggle
          label="Require manager approval"
          description="Submitted timesheets must be approved before payroll."
          checked={form.requireTimesheetApproval}
          onChange={(checked) => onChange({ requireTimesheetApproval: checked })}
        />
      </TimesheetSettingsSection>

      <TimesheetSettingsSection title="Time rounding">
        <OptionButtonGroup<RoundTimeMinutes>
          label="Round clock times"
          hint="Round start and finish times to the nearest interval."
          options={[
            { value: 0, label: 'None' },
            { value: 5, label: '5 min' },
            { value: 15, label: '15 min' },
          ]}
          value={form.roundTimeMinutes}
          onChange={(value) => onChange({ roundTimeMinutes: value })}
        />
      </TimesheetSettingsSection>

      <TimesheetSettingsSection
        title="Week Numbering"
        description="Week boundaries and when week 1 starts each year."
      >
        <OptionButtonGroup
          label="Week starts on"
          options={TIMESHEET_WEEK_START_DAY_OPTIONS}
          value={form.timesheetWeekStartDay}
          onChange={(value) => onChange({ timesheetWeekStartDay: value })}
        />

        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Week 1 reset date
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Week 1 begins in the week containing this date each year.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <SettingsField label="Day">
              <select
                value={form.timesheetWeekResetDay}
                onChange={(event) =>
                  onChange({ timesheetWeekResetDay: Number.parseInt(event.target.value, 10) })
                }
                className={settingsSelectClassName}
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
                className={settingsSelectClassName}
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
      </TimesheetSettingsSection>

      <TimesheetSettingsSection
        title="Weekend rules"
        description="Override standard overtime for Saturday and Sunday."
      >
        <SettingsToggle
          label="Saturday overtime"
          checked={form.saturdayOvertimeEnabled}
          onChange={(checked) => onChange({ saturdayOvertimeEnabled: checked })}
        />

        {form.saturdayOvertimeEnabled ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="Starts after">
              <select
                value={form.saturdayOvertimeAfterHours}
                onChange={(event) =>
                  onChange({ saturdayOvertimeAfterHours: Number(event.target.value) })
                }
                className={settingsSelectClassName}
              >
                {WEEKEND_OVERTIME_AFTER_HOURS_OPTIONS.map((hours) => (
                  <option key={`sat-${hours.toFixed(1)}`} value={hours}>
                    {formatWeekendOvertimeAfterHoursLabel(hours)}
                  </option>
                ))}
              </select>
            </SettingsField>

            <SettingsField label="Multiplier">
              <select
                value={form.saturdayOvertimeMultiplier}
                onChange={(event) =>
                  onChange({ saturdayOvertimeMultiplier: Number(event.target.value) })
                }
                className={settingsSelectClassName}
              >
                {WEEKEND_OVERTIME_MULTIPLIER_OPTIONS.map((option) => (
                  <option key={`sat-mult-${option.toFixed(1)}`} value={option}>
                    {formatWeekendOvertimeMultiplierLabel(option)}
                  </option>
                ))}
              </select>
            </SettingsField>
          </div>
        ) : null}

        <SettingsToggle
          label="Sunday overtime"
          checked={form.sundayOvertimeEnabled}
          onChange={(checked) => onChange({ sundayOvertimeEnabled: checked })}
        />

        {form.sundayOvertimeEnabled ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="Starts after">
              <select
                value={form.sundayOvertimeAfterHours}
                onChange={(event) =>
                  onChange({ sundayOvertimeAfterHours: Number(event.target.value) })
                }
                className={settingsSelectClassName}
              >
                {WEEKEND_OVERTIME_AFTER_HOURS_OPTIONS.map((hours) => (
                  <option key={`sun-${hours.toFixed(1)}`} value={hours}>
                    {formatWeekendOvertimeAfterHoursLabel(hours)}
                  </option>
                ))}
              </select>
            </SettingsField>

            <SettingsField label="Multiplier">
              <select
                value={form.sundayOvertimeMultiplier}
                onChange={(event) =>
                  onChange({ sundayOvertimeMultiplier: Number(event.target.value) })
                }
                className={settingsSelectClassName}
              >
                {WEEKEND_OVERTIME_MULTIPLIER_OPTIONS.map((option) => (
                  <option key={`sun-mult-${option.toFixed(1)}`} value={option}>
                    {formatWeekendOvertimeMultiplierLabel(option)}
                  </option>
                ))}
              </select>
            </SettingsField>
          </div>
        ) : null}
      </TimesheetSettingsSection>
    </div>
  )
}

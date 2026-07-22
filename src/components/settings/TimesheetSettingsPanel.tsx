import {
  SettingsChipGroup,
  SettingsField,
  SettingsPageIntro,
  SettingsSegmentedControl,
  SettingsToggle,
  settingsCardDescriptionClassName,
  settingsCardTitleClassName,
  settingsSelectClassName,
} from '@/components/settings/SettingsControls'
import {
  CURRENCY_OPTIONS,
  OVERTIME_AFTER_HOURS_OPTIONS,
  OVERTIME_MULTIPLIER_OPTIONS,
  WEEKEND_OVERTIME_MULTIPLIER_OPTIONS,
  formatOvertimeAfterHoursLabel,
  formatOvertimeMultiplierLabel,
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
import { useEffect, useState, type ReactNode } from 'react'

type TimesheetSettingsPanelProps = {
  form: CompanySettingsInput
  onChange: (patch: Partial<CompanySettingsInput>) => void
}

const compactCardClassName =
  'rounded-[18px] border border-[rgba(75,120,220,0.14)] bg-[linear-gradient(160deg,rgba(255,255,255,0.96)_0%,rgba(245,250,255,0.94)_55%,rgba(236,246,255,0.92)_100%)] p-4 shadow-[0_8px_22px_rgba(30,64,175,0.07)] sm:p-5 dark:border-slate-700 dark:bg-slate-900/60'

function CompactCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn(compactCardClassName, className)}>
      <div>
        <h3 className={settingsCardTitleClassName}>{title}</h3>
        {description ? (
          <p className={cn(settingsCardDescriptionClassName, 'mt-0.5 text-xs leading-5')}>
            {description}
          </p>
        ) : null}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
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
    <div className="rounded-[16px] border border-[#D2E5F5] bg-white/75 p-3.5 dark:border-white/10 dark:bg-slate-800/50">
      <div className="flex items-center justify-between gap-3 border-b border-[#E4F0FA] pb-2.5 dark:border-white/10">
        <h4 className="text-sm font-semibold tracking-[-0.02em] text-[#2A376F] dark:text-slate-100">
          {dayLabel}
        </h4>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]',
            overtimeEnabled
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
              : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
          )}
        >
          {overtimeEnabled ? 'OT on' : 'OT off'}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <SettingsToggle
          label="Overtime enabled"
          description={`Apply weekend overtime rules for ${dayLabel}.`}
          checked={overtimeEnabled}
          onChange={onOvertimeEnabledChange}
        />

        {overtimeEnabled ? (
          <div className="grid gap-3 sm:grid-cols-2">
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

  return (
    <div className="space-y-3 sm:col-span-2 sm:space-y-3.5">
      <SettingsPageIntro
        title="Timesheets"
        description="Working time, overtime and approval rules for payroll."
      />

      {/* 1. Primary timesheet control card */}
      <CompactCard
        title="Timesheet controls"
        description="Mode, currency and approval for payroll timesheets."
      >
        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          <SettingsSegmentedControl
            label="Timesheet mode"
            value={form.overtimeMode}
            options={[
              { value: 'Manual', label: 'Manual' },
              { value: 'Automatic', label: 'Automatic' },
            ]}
            onChange={(value) => onChange({ overtimeMode: value as OvertimeMode })}
          />

          <SettingsField label="Currency">
            <select
              value={form.currency}
              onChange={(event) =>
                onChange({ currency: event.target.value as CompanyCurrency })
              }
              className={cn(settingsSelectClassName, 'mt-1.5 h-10')}
            >
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </SettingsField>

          <SettingsToggle
            label="Require manager approval"
            description="Submitted timesheets must be approved before payroll."
            checked={form.requireTimesheetApproval}
            onChange={(checked) => onChange({ requireTimesheetApproval: checked })}
          />
        </div>

        {isManual ? (
          <div className="rounded-[14px] border border-[#C7DAFF] bg-[#EEF4FF] px-3.5 py-3 text-sm leading-6 text-[#1E3A6E] dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
            Workers enter Basic, Overtime, Break and Additional Hours manually. Total Hours are
            calculated automatically.
          </div>
        ) : null}

        {isAutomatic ? (
          <div className="grid gap-3 border-t border-[rgba(75,120,220,0.12)] pt-3 sm:grid-cols-2 dark:border-slate-700">
            <SettingsField label="Overtime after">
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
      </CompactCard>

      {/* 2. Two-column rules section */}
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <CompactCard title="Time Entry Rules" description="Breaks and clock-time rounding.">
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
        </CompactCard>

        <CompactCard
          title="Week Setup"
          description="Week boundaries and when week 1 starts each year."
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
        </CompactCard>
      </div>

      {/* 3. Weekend rules — Automatic mode only (values preserved when hidden) */}
      {isAutomatic ? (
        <CompactCard
          title="Weekend Rules"
          description="Override standard overtime for Saturday and Sunday."
        >
          <div className="grid gap-3 lg:grid-cols-2">
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
        </CompactCard>
      ) : null}
    </div>
  )
}

import type { ChangeEvent, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DEFAULT_HOLIDAY_ENTITLEMENT_RULES,
  HOLIDAY_WORKING_DAY_OPTIONS,
  type CompanySettingsInput,
  type HolidayCountingMethod,
  type HolidayWorkingDay,
} from '@/lib/companySettingsTypes'
import { WORKER_EMPLOYMENT_TYPES } from '@/lib/workerProfileUtils'
import { cn } from '@/lib/utils'
import { Calendar, CalendarDays, CalendarRange, Sparkles } from 'lucide-react'

type HolidaySettingsPanelProps = {
  form: CompanySettingsInput
  onChange: (patch: Partial<CompanySettingsInput>) => void
  isDirty: boolean
  isSaving: boolean
  onSave: () => void
}

const holidayInputClass =
  'h-10 w-full rounded-[12px] border border-[#C5DFFB]/80 bg-white px-3 text-sm font-medium text-[#113C69] shadow-sm transition-all placeholder:text-[#5499BF]/70 hover:border-[#BFE3F5] focus-visible:border-[#89CFF0] focus-visible:ring-3 focus-visible:ring-[#BFE3F5]/70 focus-visible:outline-none'

const sectionCardClass =
  'rounded-[18px] border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF]/98 to-[#EEF6FF]/88 p-5 shadow-[0_4px_16px_rgba(33,142,231,0.06)] ring-1 ring-[#C5DFFB]/35 sm:p-6'

const COUNTING_METHOD_OPTIONS: {
  value: HolidayCountingMethod
  label: string
  description: string
  icon: typeof CalendarDays
}[] = [
  {
    value: 'working_days',
    label: 'Working days only',
    description: 'Deduct selected working days only. Default for Monday–Friday teams.',
    icon: CalendarDays,
  },
  {
    value: 'calendar_days',
    label: 'Calendar days',
    description: 'Deduct every calendar day from start to end date.',
    icon: Calendar,
  },
  {
    value: 'custom_working_week',
    label: 'Custom working week',
    description: 'Choose which days count for holiday allowance deduction.',
    icon: CalendarRange,
  },
]

function YesNoToggle({
  value,
  onChange,
  disabled = false,
}: {
  value: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        'inline-flex rounded-[10px] bg-white p-0.5 ring-1 ring-[#C5DFFB]/70',
        disabled && 'opacity-55',
      )}
    >
      {[
        { label: 'Yes', bool: true },
        { label: 'No', bool: false },
      ].map((option) => {
        const selected = value === option.bool
        return (
          <button
            key={option.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.bool)}
            className={cn(
              'min-w-[3rem] rounded-[8px] px-2.5 py-1.5 text-xs font-semibold transition-all',
              selected
                ? 'bg-gradient-to-br from-[#218EE7] to-[#0B68BE] text-white shadow-sm'
                : 'text-[#5499BF] hover:bg-[#F5FAFF] hover:text-[#0B68BE]',
            )}
            aria-pressed={selected}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
      {children}
    </span>
  )
}

export function HolidaySettingsPanel({
  form,
  onChange,
  isDirty,
  isSaving,
  onSave,
}: HolidaySettingsPanelProps) {
  function handleTextChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target
    onChange({ [name]: value } as Partial<CompanySettingsInput>)
  }

  function toggleHolidayWorkingDay(day: HolidayWorkingDay) {
    const current = new Set(form.holidayWorkingDays)

    if (current.has(day)) {
      if (current.size === 1) return
      current.delete(day)
    } else {
      current.add(day)
    }

    onChange({
      holidayWorkingDays: HOLIDAY_WORKING_DAY_OPTIONS.map((option) => option.value).filter(
        (value) => current.has(value),
      ),
    })
  }

  function updateHolidayEntitlementRule(
    employmentType: keyof typeof DEFAULT_HOLIDAY_ENTITLEMENT_RULES,
    patch: Partial<(typeof DEFAULT_HOLIDAY_ENTITLEMENT_RULES)[keyof typeof DEFAULT_HOLIDAY_ENTITLEMENT_RULES]>,
  ) {
    onChange({
      holidayEntitlementRules: {
        ...form.holidayEntitlementRules,
        [employmentType]: {
          ...form.holidayEntitlementRules[employmentType],
          ...patch,
        },
      },
    })
  }

  const workingDaysDisabled = form.holidayCountingMethod === 'calendar_days'

  return (
    <div className="mx-auto max-w-5xl space-y-5 sm:col-span-2">
      <div
        className={cn(
          sectionCardClass,
          'relative overflow-hidden bg-gradient-to-br from-[#F5FAFF] via-[#EEF6FF] to-[#E3F2FD]/90',
        )}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-[#218EE7]/8 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#218EE7] to-[#0B68BE] text-white shadow-[0_8px_20px_rgba(33,142,231,0.25)]">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#113C69]">
              Holiday Settings
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5499BF]">
              Configure holiday allowance and how DREVORA counts working days for requests.
            </p>
          </div>
        </div>
      </div>

      <section className={sectionCardClass}>
        <h3 className="text-sm font-semibold text-[#113C69]">Leave year &amp; allowance</h3>
        <p className="mt-1 text-xs leading-5 text-[#5499BF]">
          Set when your holiday year starts and the default annual leave allowance.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Holiday Year Start</FieldLabel>
            <Input
              name="holidayYearStart"
              value={form.holidayYearStart}
              onChange={handleTextChange}
              placeholder="01-01"
              className={`${holidayInputClass} mt-1.5`}
            />
            <p className="mt-1.5 text-xs text-[#5499BF]">Month and day when the leave year begins (MM-DD).</p>
          </label>

          <label className="block">
            <FieldLabel>Annual Leave Allowance</FieldLabel>
            <Input
              type="number"
              min={0}
              max={365}
              value={form.annualLeaveAllowance}
              onChange={(event) =>
                onChange({ annualLeaveAllowance: Number(event.target.value) || 0 })
              }
              className={`${holidayInputClass} mt-1.5`}
            />
            <p className="mt-1.5 text-xs text-[#5499BF]">Default paid days before employment-type rules apply.</p>
          </label>
        </div>
      </section>

      <section className={sectionCardClass}>
        <h3 className="text-sm font-semibold text-[#113C69]">Holiday counting method</h3>
        <p className="mt-1 text-xs leading-5 text-[#5499BF]">
          Choose how DREVORA deducts days when a worker books time off.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COUNTING_METHOD_OPTIONS.map((option) => {
            const selected = form.holidayCountingMethod === option.value
            const Icon = option.icon

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ holidayCountingMethod: option.value })}
                aria-pressed={selected}
                className={cn(
                  'group flex h-full flex-col rounded-[16px] border p-4 text-left transition-all duration-200',
                  selected
                    ? 'border-[#218EE7] bg-gradient-to-br from-[#EEF6FF] to-[#D3E9FC]/60 shadow-[0_8px_24px_rgba(33,142,231,0.14)] ring-2 ring-[#89CFF0]/50'
                    : 'border-[#C5DFFB]/80 bg-white/80 shadow-sm hover:-translate-y-0.5 hover:border-[#89CFF0] hover:bg-[#F8FBFF] hover:shadow-[0_8px_20px_rgba(33,142,231,0.08)] active:translate-y-0',
                )}
              >
                <div
                  className={cn(
                    'mb-3 flex size-9 items-center justify-center rounded-[12px] transition-colors',
                    selected
                      ? 'bg-gradient-to-br from-[#218EE7] to-[#0B68BE] text-white shadow-sm'
                      : 'bg-[#F5FAFF] text-[#0B68BE] ring-1 ring-[#D3E9FC]/70 group-hover:bg-[#EEF6FF]',
                  )}
                >
                  <Icon className="size-4.5" aria-hidden="true" />
                </div>
                <span className="text-sm font-semibold text-[#113C69]">{option.label}</span>
                <span className="mt-1 text-xs leading-5 text-[#5499BF]">{option.description}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className={sectionCardClass}>
        <h3 className="text-sm font-semibold text-[#113C69]">Working days selection</h3>
        <p className="mt-1 text-xs leading-5 text-[#5499BF]">
          These days are deducted when using Working days only or Custom working week. Keep
          Monday–Friday selected for a standard UK working week.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {HOLIDAY_WORKING_DAY_OPTIONS.map((day) => {
            const isSelected = form.holidayWorkingDays.includes(day.value)

            return (
              <button
                key={day.value}
                type="button"
                disabled={workingDaysDisabled}
                onClick={() => toggleHolidayWorkingDay(day.value)}
                aria-pressed={isSelected}
                className={cn(
                  'min-w-[5.5rem] rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200',
                  isSelected
                    ? 'border-[#218EE7] bg-gradient-to-br from-[#D3E9FC] to-[#BFE3F5]/80 text-[#0B477F] shadow-[0_4px_12px_rgba(33,142,231,0.15)]'
                    : 'border-[#C5DFFB]/90 bg-white/90 text-[#5499BF] hover:border-[#89CFF0] hover:bg-[#F8FBFF] hover:text-[#0B68BE]',
                  workingDaysDisabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {day.label.slice(0, 3)}
              </button>
            )
          })}
        </div>
      </section>

      <section className={sectionCardClass}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#113C69]">Holiday Entitlement Rules</h3>
            <p className="mt-1 text-xs leading-5 text-[#5499BF]">
              Defaults by employment type. Worker profile values override these rules.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {WORKER_EMPLOYMENT_TYPES.map((employmentType) => {
            const rule =
              form.holidayEntitlementRules[employmentType] ??
              DEFAULT_HOLIDAY_ENTITLEMENT_RULES[employmentType]
            const total = rule.paidHolidayEnabled
              ? rule.annualPaidHolidayDays + rule.bankHolidayEntitlementDays
              : 0

            return (
              <article
                key={employmentType}
                className="rounded-[14px] border border-[#C5DFFB]/70 bg-gradient-to-br from-white/95 to-[#F5FAFF]/90 p-3.5 shadow-sm ring-1 ring-[#D3E9FC]/40 transition-shadow hover:shadow-[0_6px_16px_rgba(33,142,231,0.08)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold leading-snug text-[#113C69]">
                    {employmentType}
                  </h4>
                  <span className="inline-flex shrink-0 rounded-full bg-[#EEF6FF] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[#0B68BE] ring-1 ring-[#C5DFFB]/80">
                    Total {total}
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel>Paid enabled</FieldLabel>
                    <YesNoToggle
                      value={rule.paidHolidayEnabled}
                      onChange={(paidHolidayEnabled) =>
                        updateHolidayEntitlementRule(employmentType, { paidHolidayEnabled })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <FieldLabel>Paid days</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        step="0.5"
                        value={rule.annualPaidHolidayDays}
                        disabled={!rule.paidHolidayEnabled}
                        onChange={(event) =>
                          updateHolidayEntitlementRule(employmentType, {
                            annualPaidHolidayDays: Number(event.target.value) || 0,
                          })
                        }
                        className={`${holidayInputClass} mt-1 h-9 text-xs`}
                      />
                    </label>

                    <label className="block">
                      <FieldLabel>Bank holidays</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        step="0.5"
                        value={rule.bankHolidayEntitlementDays}
                        disabled={!rule.paidHolidayEnabled}
                        onChange={(event) =>
                          updateHolidayEntitlementRule(employmentType, {
                            bankHolidayEntitlementDays: Number(event.target.value) || 0,
                          })
                        }
                        className={`${holidayInputClass} mt-1 h-9 text-xs`}
                      />
                    </label>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-[#D3E9FC]/60 pt-3">
                    <FieldLabel>Unpaid leave</FieldLabel>
                    <YesNoToggle
                      value={rule.unpaidLeaveAllowed}
                      onChange={(unpaidLeaveAllowed) =>
                        updateHolidayEntitlementRule(employmentType, { unpaidLeaveAllowed })
                      }
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-[18px] border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF] to-[#EEF6FF]/80 px-5 py-4 shadow-sm ring-1 ring-[#C5DFFB]/35 sm:flex-row sm:items-center sm:justify-between">
        <p
          className={cn(
            'text-sm font-medium',
            isDirty ? 'text-[#0B68BE]' : 'text-[#5499BF]',
          )}
        >
          {isDirty ? 'You have unsaved changes.' : 'All changes saved.'}
        </p>
        <Button
          type="button"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className={cn(
            'h-10 w-full rounded-[12px] bg-gradient-to-br from-[#218EE7] to-[#0B68BE] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(33,142,231,0.22)] transition-all sm:w-auto',
            'hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(33,142,231,0.28)] active:translate-y-0',
            'disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0',
          )}
        >
          {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

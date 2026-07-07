import type { ChangeEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  SettingsCard,
  SettingsChoiceGroup,
  SettingsField,
  SettingsMultiChipGroup,
  SettingsPageIntro,
  SettingsSegmentedControl,
  SettingsStatusFooter,
  settingsFieldClassName,
  settingsInnerCardClassName,
  settingsStatusTextClassName,
} from '@/components/settings/SettingsControls'
import {
  DEFAULT_HOLIDAY_ENTITLEMENT_RULES,
  HOLIDAY_WORKING_DAY_OPTIONS,
  type CompanySettingsInput,
  type HolidayCountingMethod,
  type HolidayEntitlementRule,
  type HolidayEntitlementRules,
  type HolidayWorkingDay,
} from '@/lib/companySettingsTypes'
import { WORKER_EMPLOYMENT_TYPES, type EmploymentType } from '@/lib/workerProfileUtils'
import { Calendar, CalendarDays, CalendarRange } from 'lucide-react'

type HolidaySettingsPanelProps = {
  form: CompanySettingsInput
  onChange: (patch: Partial<CompanySettingsInput>) => void
  isDirty: boolean
  isSaving: boolean
  onSave: () => void
}

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

function getEditorDefaultRule(employmentType: EmploymentType): HolidayEntitlementRule {
  if (employmentType === 'Full-time') {
    return { ...DEFAULT_HOLIDAY_ENTITLEMENT_RULES['Full-time'] }
  }

  return {
    paidHolidayEnabled: false,
    annualPaidHolidayDays: 0,
    bankHolidayEntitlementDays: 0,
    unpaidLeaveAllowed: true,
  }
}

function resolveEntitlementRule(
  rules: HolidayEntitlementRules,
  employmentType: EmploymentType,
): HolidayEntitlementRule {
  return rules[employmentType] ?? getEditorDefaultRule(employmentType)
}

function isPristineConfiguredRule(rule: HolidayEntitlementRule): boolean {
  return (
    !rule.paidHolidayEnabled &&
    rule.annualPaidHolidayDays === 0 &&
    rule.bankHolidayEntitlementDays === 0 &&
    rule.unpaidLeaveAllowed
  )
}

function listConfiguredEntitlementRules(rules: HolidayEntitlementRules) {
  return WORKER_EMPLOYMENT_TYPES.map((employmentType) => ({
    employmentType,
    rule: resolveEntitlementRule(rules, employmentType),
  })).filter(({ rule }) => !isPristineConfiguredRule(rule))
}

function rulesEqual(left: HolidayEntitlementRule, right: HolidayEntitlementRule): boolean {
  return (
    left.paidHolidayEnabled === right.paidHolidayEnabled &&
    left.annualPaidHolidayDays === right.annualPaidHolidayDays &&
    left.bankHolidayEntitlementDays === right.bankHolidayEntitlementDays &&
    left.unpaidLeaveAllowed === right.unpaidLeaveAllowed
  )
}

function formatYesNo(value: boolean): string {
  return value ? 'Yes' : 'No'
}

function formatConfiguredEntitlementRuleLine(
  employmentType: EmploymentType,
  rule: HolidayEntitlementRule,
): string {
  const parts = [`Paid: ${formatYesNo(rule.paidHolidayEnabled)}`]

  if (rule.paidHolidayEnabled) {
    parts.push(`${rule.annualPaidHolidayDays} days`)
    parts.push(`Bank holidays ${rule.bankHolidayEntitlementDays}`)
  }

  parts.push(`Unpaid leave ${formatYesNo(rule.unpaidLeaveAllowed)}`)

  return `${employmentType} — ${parts.join(' · ')}`
}

type HolidayEntitlementRulesSectionProps = {
  rules: HolidayEntitlementRules
  onUpdateRule: (employmentType: EmploymentType, patch: Partial<HolidayEntitlementRule>) => void
}

function HolidayEntitlementRulesSection({
  rules,
  onUpdateRule,
}: HolidayEntitlementRulesSectionProps) {
  const [selectedEmploymentType, setSelectedEmploymentType] =
    useState<EmploymentType>('Full-time')
  const [draft, setDraft] = useState<HolidayEntitlementRule>(() =>
    resolveEntitlementRule(rules, 'Full-time'),
  )
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const savedRule = resolveEntitlementRule(rules, selectedEmploymentType)
  const configuredRules = useMemo(() => listConfiguredEntitlementRules(rules), [rules])
  const isDraftDirty = !rulesEqual(draft, savedRule)

  useEffect(() => {
    setDraft(resolveEntitlementRule(rules, selectedEmploymentType))
    setSuccessMessage(null)
  }, [rules, selectedEmploymentType])

  function handleSaveRule() {
    onUpdateRule(selectedEmploymentType, { ...draft })
    setSuccessMessage(`Rule saved for ${selectedEmploymentType}.`)
  }

  function handleSelectConfigured(employmentType: EmploymentType) {
    setSelectedEmploymentType(employmentType)
    setSuccessMessage(null)
  }

  return (
    <SettingsCard
      title="Holiday Entitlement Rules"
      description="Set default holiday rules by employment type. Worker profile values override these rules."
    >
      <div className={settingsInnerCardClassName}>
        <div className="space-y-4">
          <SettingsField label="Employment type" span="full">
            <select
              value={selectedEmploymentType}
              onChange={(event) => {
                setSelectedEmploymentType(event.target.value as EmploymentType)
                setSuccessMessage(null)
              }}
              className={settingsFieldClassName}
            >
              {WORKER_EMPLOYMENT_TYPES.map((employmentType) => (
                <option key={employmentType} value={employmentType}>
                  {employmentType}
                </option>
              ))}
            </select>
          </SettingsField>

          <SettingsSegmentedControl
            label="Paid holiday enabled"
            value={draft.paidHolidayEnabled ? 'yes' : 'no'}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            onChange={(value) =>
              setDraft((current) => ({ ...current, paidHolidayEnabled: value === 'yes' }))
            }
          />

          {draft.paidHolidayEnabled ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField label="Paid days">
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={draft.annualPaidHolidayDays}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      annualPaidHolidayDays: Number(event.target.value) || 0,
                    }))
                  }
                  className={settingsFieldClassName}
                />
              </SettingsField>

              <SettingsField label="Bank holidays">
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={draft.bankHolidayEntitlementDays}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      bankHolidayEntitlementDays: Number(event.target.value) || 0,
                    }))
                  }
                  className={settingsFieldClassName}
                />
              </SettingsField>
            </div>
          ) : (
            <p className={settingsStatusTextClassName}>
              Paid holiday is disabled for this employment type.
            </p>
          )}

          <div className="border-t border-[rgba(75,120,220,0.12)] pt-4 dark:border-slate-700">
            <SettingsSegmentedControl
              label="Unpaid leave allowed"
              value={draft.unpaidLeaveAllowed ? 'yes' : 'no'}
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
              onChange={(value) =>
                setDraft((current) => ({ ...current, unpaidLeaveAllowed: value === 'yes' }))
              }
            />
          </div>

          {successMessage ? (
            <div className="rounded-[12px] bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
              {successMessage}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveRule}
              disabled={!isDraftDirty}
              className="h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-60"
            >
              Save rule
            </button>
          </div>
        </div>
      </div>

      {configuredRules.length > 0 ? (
        <div className="border-t border-[rgba(75,120,220,0.12)] pt-4 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Configured rules
          </p>
          <ul className="mt-2 space-y-1.5">
            {configuredRules.map(({ employmentType, rule }) => (
              <li key={employmentType}>
                <button
                  type="button"
                  onClick={() => handleSelectConfigured(employmentType)}
                  className="text-left text-sm font-medium leading-snug text-[#2A376F] transition-colors hover:text-[#2563EB] dark:text-slate-200"
                >
                  {formatConfiguredEntitlementRuleLine(employmentType, rule)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SettingsCard>
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
    employmentType: EmploymentType,
    patch: Partial<HolidayEntitlementRule>,
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
    <div className="space-y-4 sm:col-span-2">
      <SettingsPageIntro
        title="Holidays"
        description="Configure holiday allowance and how DREVORA counts working days for requests."
      />

      <SettingsCard
        title="Leave year & allowance"
        description="Set when your holiday year starts and the default annual leave allowance."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField
            label="Holiday year start"
            hint="Month and day when the leave year begins (MM-DD)."
          >
            <Input
              name="holidayYearStart"
              value={form.holidayYearStart}
              onChange={handleTextChange}
              placeholder="01-01"
              className={settingsFieldClassName}
            />
          </SettingsField>

          <SettingsField
            label="Annual leave allowance"
            hint="Default paid days before employment-type rules apply."
          >
            <Input
              type="number"
              min={0}
              max={365}
              value={form.annualLeaveAllowance}
              onChange={(event) =>
                onChange({ annualLeaveAllowance: Number(event.target.value) || 0 })
              }
              className={settingsFieldClassName}
            />
          </SettingsField>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Holiday counting method"
        description="Choose how DREVORA deducts days when a worker books time off."
      >
        <SettingsChoiceGroup
          value={form.holidayCountingMethod}
          options={COUNTING_METHOD_OPTIONS}
          onChange={(value) => onChange({ holidayCountingMethod: value })}
        />
      </SettingsCard>

      <SettingsCard
        title="Working days selection"
        description="These days are deducted when using Working days only or Custom working week. Keep Monday–Friday selected for a standard UK working week."
      >
        <SettingsMultiChipGroup
          label="Working days"
          options={HOLIDAY_WORKING_DAY_OPTIONS}
          selected={form.holidayWorkingDays}
          onToggle={toggleHolidayWorkingDay}
          disabled={workingDaysDisabled}
          formatLabel={(label) => label.slice(0, 3)}
        />
      </SettingsCard>

      <HolidayEntitlementRulesSection
        rules={form.holidayEntitlementRules}
        onUpdateRule={updateHolidayEntitlementRule}
      />

      <SettingsStatusFooter
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={onSave}
      />
    </div>
  )
}

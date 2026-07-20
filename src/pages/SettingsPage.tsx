import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { Lock } from 'lucide-react'
import AdminLayout from '@/layouts/AdminLayout'
import {
  SettingsField,
  SettingsRadioGroup,
  SettingsSection,
  SettingsTabs,
  SettingsToggle,
  settingsDividerClassName,
  settingsFieldClassName,
  settingsSaveButtonClassName,
  settingsSelectClassName,
  settingsStatusTextClassName,
} from '@/components/settings/SettingsControls'
import { ChangePasswordCard } from '@/components/settings/ChangePasswordCard'
import { SettingsPlanSummary } from '@/components/settings/SettingsPlanSummary'
import { ConsumablesDefaultPricesPanel } from '@/components/consumables/ConsumablesDefaultPricesPanel'
import { HolidaySettingsPanel } from '@/components/settings/HolidaySettingsPanel'
import { TimesheetSettingsPanel } from '@/components/settings/TimesheetSettingsPanel'
import { DocumentsSettingsPanel } from '@/components/settings/DocumentsSettingsPanel'
import { TwoFactorAuthComingLaterCard } from '@/components/settings/TwoFactorAuthComingLaterCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { adminCard, adminSkeletonPulse } from '@/lib/adminUiStyles'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'
import {
  COMPANY_SETTINGS_TABS,
  DEFAULT_COMPANY_SETTINGS,
  HOLIDAY_WORKING_DAY_OPTIONS,
  THEME_OPTIONS,
  type CompanyTheme,
  type CompanySettingsInput,
  type CompanySettingsTab,
} from '@/lib/companySettingsTypes'
import { useSearchParams } from 'react-router-dom'
import { formatClockTime, getDateFormatLabel, COMPANY_TIME_FORMAT_OPTIONS } from '@/lib/dateTimeFormat'

import { companySettingsService } from '@/services/companySettingsService'

const timezoneOptions = [
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Madrid',
  'Europe/Warsaw',
  'UTC',
]

function normalizeFormForCompare(value: CompanySettingsInput): CompanySettingsInput {
  const selectedDays = new Set(value.holidayWorkingDays)
  return {
    ...value,
    holidayWorkingDays: HOLIDAY_WORKING_DAY_OPTIONS.map((option) => option.value).filter((day) =>
      selectedDays.has(day),
    ),
  }
}

function formsEqual(left: CompanySettingsInput, right: CompanySettingsInput): boolean {
  return (
    JSON.stringify(normalizeFormForCompare(left)) === JSON.stringify(normalizeFormForCompare(right))
  )
}

function SettingsPage() {
  const [searchParams] = useSearchParams()
  const { settings, isLoading, isSaving, updateSettings, companyId } =
    useCompanySettings()
  const [activeTab, setActiveTab] = useState<CompanySettingsTab>('general')
  const [form, setForm] = useState<CompanySettingsInput>(DEFAULT_COMPANY_SETTINGS)
  const [savedForm, setSavedForm] = useState<CompanySettingsInput>(DEFAULT_COMPANY_SETTINGS)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const isDirtyRef = useRef(false)

  const isDirty = !formsEqual(form, savedForm)

  useUnsavedChangesWarning(isDirty)

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'consumables') {
      setActiveTab('consumables')
    }
  }, [searchParams])

  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  useEffect(() => {
    if (!settings || isDirtyRef.current) return
    const values = companySettingsService.companySettingsToFormValues(settings)
    setForm(values)
    setSavedForm(values)
  }, [settings])

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2400)
  }, [])

  function updateForm(patch: Partial<CompanySettingsInput>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  async function handleSave() {
    if (!isDirty || isSaving) return

    setSaveError(null)

    try {
      const updated = await updateSettings(form)
      const values = companySettingsService.companySettingsToFormValues(updated)
      setForm(values)
      setSavedForm(values)
      showToast('Settings saved')
    } catch (error) {
      console.error('Failed to save company settings:', error)
      setSaveError(
        error instanceof Error ? error.message : 'Unable to save settings. Please try again.',
      )
    }
  }

  function handleTextChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target
    if (name === 'name') return
    updateForm({ [name]: value } as Partial<CompanySettingsInput>)
  }

  function handleNumberChange(name: keyof CompanySettingsInput, value: number) {
    updateForm({ [name]: value } as Partial<CompanySettingsInput>)
  }

  const timeFormatExamples = useMemo(
    () =>
      Object.fromEntries(
        COMPANY_TIME_FORMAT_OPTIONS.map((option) => [
          option.value,
          formatClockTime('08:30', { timeFormat: option.value }),
        ]),
      ) as Record<(typeof COMPANY_TIME_FORMAT_OPTIONS)[number]['value'], string>,
    [],
  )

  if (isLoading && !settings) {
    return (
      <AdminLayout premiumBackground>
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-[16px] bg-[#EEF4FF]" />
          <div className={`h-96 rounded-[20px] ${adminSkeletonPulse}`} />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout premiumBackground>
      <div className="space-y-5 pb-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
            Administration
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100">
            Company Settings
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Global application preferences used by dashboard, workers, vehicles, timesheets,
            compliance and reports.
          </p>
        </div>

        <SettingsTabs tabs={COMPANY_SETTINGS_TABS} activeTab={activeTab} onChange={setActiveTab} />

        <Card className={`${adminCard} border border-[rgba(75,120,220,0.10)] dark:border-white/10`}>
          <CardContent className="p-6 sm:p-8">
            {saveError ? (
              <div className="mb-6 rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900">
                {saveError}
              </div>
            ) : null}

            {activeTab === 'general' ? (
              <>
              {companyId ? (
                <SettingsSection
                  title="Subscription plan"
                  description="Current plan and allowances stored for your company. Payment setup is completed separately."
                >
                  <div className="sm:col-span-2">
                    <SettingsPlanSummary companyId={companyId} />
                  </div>
                </SettingsSection>
              ) : null}

              <SettingsSection
                title="Company Profile"
                description="Organisation name and profile shown on the dashboard and fleet operations header."
              >
                <SettingsField
                  label="Company Name"
                  span="full"
                  hint="Company name is locked. Contact support to change it."
                >
                  <div className="relative">
                    <Input
                      name="name"
                      value={form.name}
                      readOnly
                      aria-readonly="true"
                      className={`${settingsFieldClassName} cursor-not-allowed bg-[#F8FBFF]/95 pr-10 text-[#113C69] ring-[#D3E9FC]/80`}
                    />
                    <Lock
                      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[#5499BF]"
                      aria-hidden="true"
                    />
                  </div>
                </SettingsField>

                <SettingsField
                  label="Company Logo"
                  span="full"
                  hint="Paste a logo URL. Displayed in headers and future PDF exports."
                >
                  <Input
                    name="logoUrl"
                    value={form.logoUrl}
                    onChange={handleTextChange}
                    placeholder="https://…"
                    className={settingsFieldClassName}
                  />
                  {form.logoUrl.trim() ? (
                    <img
                      src={form.logoUrl}
                      alt="Company logo preview"
                      className="mt-3 h-14 w-auto rounded-[12px] bg-[#F8FBFF] p-2 ring-1 ring-blue-100"
                    />
                  ) : null}
                </SettingsField>

                <SettingsField label="Address" span="full">
                  <Input
                    name="address"
                    value={form.address}
                    onChange={handleTextChange}
                    className={settingsFieldClassName}
                  />
                </SettingsField>

                <SettingsField label="City">
                  <Input
                    name="city"
                    value={form.city}
                    onChange={handleTextChange}
                    className={settingsFieldClassName}
                  />
                </SettingsField>

                <SettingsField label="Postcode">
                  <Input
                    name="postcode"
                    value={form.postcode}
                    onChange={handleTextChange}
                    className={settingsFieldClassName}
                  />
                </SettingsField>

                <SettingsField label="Country">
                  <Input
                    name="country"
                    value={form.country}
                    onChange={handleTextChange}
                    className={settingsFieldClassName}
                  />
                </SettingsField>

                <SettingsField label="Timezone">
                  <select
                    name="timezone"
                    value={form.timezone}
                    onChange={(event) => updateForm({ timezone: event.target.value })}
                    className={settingsSelectClassName}
                  >
                    {timezoneOptions.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                </SettingsField>

                <SettingsField label="Weather Location" span="full">
                  <Input
                    name="weatherLocation"
                    value={form.weatherLocation}
                    onChange={handleTextChange}
                    className={settingsFieldClassName}
                  />
                </SettingsField>
              </SettingsSection>
              </>
            ) : null}

            {activeTab === 'regional' ? (
              <SettingsSection
                title="Regional"
                description="Date, time and calendar preferences for all modules."
              >
                <SettingsRadioGroup
                  legend="Date Format"
                  name="dateFormat"
                  value={form.dateFormat}
                  onChange={(value) => updateForm({ dateFormat: value })}
                  options={[
                    { value: 'DMY', label: getDateFormatLabel('DMY') },
                    { value: 'MDY', label: getDateFormatLabel('MDY') },
                    { value: 'YMD', label: getDateFormatLabel('YMD') },
                  ]}
                />

                <SettingsRadioGroup
                  legend="Time Format"
                  name="timeFormat"
                  value={form.timeFormat}
                  onChange={(value) => updateForm({ timeFormat: value })}
                  options={COMPANY_TIME_FORMAT_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                    description: timeFormatExamples[option.value],
                  }))}
                />

                <SettingsRadioGroup
                  legend="Week Starts"
                  name="weekStarts"
                  value={form.weekStarts}
                  onChange={(value) => updateForm({ weekStarts: value })}
                  options={[
                    { value: 'monday', label: 'Monday' },
                    { value: 'sunday', label: 'Sunday' },
                  ]}
                />
              </SettingsSection>
            ) : null}

            {activeTab === 'timesheets' ? (
              <TimesheetSettingsPanel form={form} onChange={updateForm} />
            ) : null}

            {activeTab === 'holidays' ? (
              <HolidaySettingsPanel
                form={form}
                onChange={updateForm}
                isDirty={isDirty}
                isSaving={isSaving}
                onSave={() => void handleSave()}
              />
            ) : null}

            {activeTab === 'consumables' ? (
              <div className="sm:col-span-2">
                <ConsumablesDefaultPricesPanel embeddedInSettings />
              </div>
            ) : null}

            {activeTab === 'documents' ? (
              <div className="sm:col-span-2">
                <DocumentsSettingsPanel form={form} onChange={updateForm} />
              </div>
            ) : null}

            {activeTab === 'appearance' ? (
              <SettingsSection
                title="Appearance"
                description="Visual preferences across admin modules."
              >
                <SettingsField
                  label="Theme"
                  hint="Choose light, dark, or match your device system preference."
                  span="full"
                >
                  <select
                    value={form.theme}
                    onChange={(event) =>
                      updateForm({ theme: event.target.value as CompanyTheme })
                    }
                    className={settingsSelectClassName}
                  >
                    {THEME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </SettingsField>

                <SettingsToggle
                  label="Compact Tables"
                  description="Use denser rows in timesheets, workers, vehicles and reports."
                  checked={form.compactTables}
                  onChange={(checked) => updateForm({ compactTables: checked })}
                />
              </SettingsSection>
            ) : null}

            {activeTab === 'notifications' ? (
              <SettingsSection
                title="Notifications"
                description="Alert preferences for managers and workers."
              >
                <SettingsToggle
                  label="Email Notifications"
                  checked={form.emailNotifications}
                  onChange={(checked) => updateForm({ emailNotifications: checked })}
                />
                <SettingsToggle
                  label="Push Notifications"
                  checked={form.pushNotifications}
                  onChange={(checked) => updateForm({ pushNotifications: checked })}
                />
              </SettingsSection>
            ) : null}

            {activeTab === 'security' ? (
              <SettingsSection
                title="Security"
                description="Account authentication and session policies."
              >
                <div className="space-y-4 sm:col-span-2">
                  <ChangePasswordCard />
                  <TwoFactorAuthComingLaterCard />
                </div>

                <div className={`mt-4 ${settingsDividerClassName} pt-6 sm:col-span-2`}>
                  <SettingsField
                    label="Session Timeout"
                    hint="Minutes of inactivity before automatic sign-out."
                    span="full"
                  >
                    <Input
                      type="number"
                      min={15}
                      max={1440}
                      value={form.sessionTimeoutMinutes}
                      onChange={(event) =>
                        handleNumberChange(
                          'sessionTimeoutMinutes',
                          Number(event.target.value) || 480,
                        )
                      }
                      className={settingsFieldClassName}
                    />
                  </SettingsField>
                </div>
              </SettingsSection>
            ) : null}

            {activeTab !== 'holidays' && activeTab !== 'consumables' ? (
              <p className={`mt-8 ${settingsDividerClassName} pt-4 ${settingsStatusTextClassName}`}>
                {isDirty ? 'You have unsaved changes.' : 'All changes saved.'}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {activeTab !== 'holidays' && activeTab !== 'consumables' ? (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
          {toastMessage ? (
            <div className="rounded-[14px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(15,23,42,0.28)]">
              {toastMessage}
            </div>
          ) : null}
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isDirty || isSaving}
            className={settingsSaveButtonClassName}
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      ) : null}

      {activeTab === 'holidays' && toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-[14px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(15,23,42,0.28)]">
          {toastMessage}
        </div>
      ) : null}
    </AdminLayout>
  )
}

export default SettingsPage

import type { ReactNode } from 'react'

const inputClassName =
  'mt-2 h-11 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all focus:ring-3 focus:ring-blue-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:focus:ring-blue-500/40'

export const settingsFieldClassName = inputClassName
export const settingsSelectClassName = inputClassName

type SettingsSectionProps = {
  title: string
  description?: string
  children: ReactNode
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

type SettingsFieldProps = {
  label: string
  hint?: string
  span?: 'full' | 'half'
  children: ReactNode
}

export function SettingsField({
  label,
  hint,
  span = 'half',
  children,
}: SettingsFieldProps) {
  return (
    <label className={span === 'full' ? 'block sm:col-span-2' : 'block'}>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      {children}
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </label>
  )
}

type RadioOption<T extends string | number> = {
  value: T
  label: string
  description?: string
}

type SettingsRadioGroupProps<T extends string | number> = {
  legend: string
  hint?: string
  name: string
  value: T
  options: RadioOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
}

export function SettingsRadioGroup<T extends string | number>({
  legend,
  hint,
  name,
  value,
  options,
  onChange,
  disabled = false,
}: SettingsRadioGroupProps<T>) {
  return (
    <fieldset className="block sm:col-span-2">
      <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">{legend}</legend>
      {hint ? <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <label
            key={String(option.value)}
            className={`flex cursor-pointer items-start gap-3 rounded-[16px] border px-4 py-3 transition-colors ${
              value === option.value
                ? 'border-[#2563EB] bg-[#EEF4FF] dark:border-blue-500 dark:bg-blue-950/40'
                : 'border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] hover:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800'
            } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={String(option.value)}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled}
              className="mt-0.5 size-4 border-slate-300 text-[#2563EB]"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">{option.label}</span>
              {option.description ? (
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{option.description}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

type SettingsToggleProps = {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function SettingsToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: SettingsToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[16px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-4 py-3 sm:col-span-2 dark:border-slate-700 dark:bg-slate-800/60">
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center justify-start overflow-hidden rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

type SettingsTabsProps<T extends string> = {
  tabs: { id: T; label: string }[]
  activeTab: T
  onChange: (tab: T) => void
}

export function SettingsTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
}: SettingsTabsProps<T>) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto rounded-[16px] border border-[rgba(75,120,220,0.10)] bg-[#F8FBFF] p-1 dark:border-slate-700 dark:bg-slate-800/60"
      aria-label="Settings sections"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`shrink-0 rounded-[12px] px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${
            activeTab === tab.id
              ? 'bg-white text-[#2563EB] shadow-sm ring-1 ring-blue-100 dark:bg-slate-700 dark:text-blue-300 dark:ring-slate-600'
              : 'text-slate-600 hover:bg-white/70 hover:text-[#2A376F] dark:text-slate-400 dark:hover:bg-slate-700/70 dark:hover:text-slate-100'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const settingsPageTitleClassName =
  'text-lg font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100'

export const settingsPageDescriptionClassName =
  'mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400'

export const settingsCardTitleClassName =
  'text-base font-semibold tracking-[-0.02em] text-[#2A376F] dark:text-slate-100'

export const settingsCardDescriptionClassName =
  'mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400'

export const settingsFieldLabelClassName =
  'text-sm font-semibold text-slate-700 dark:text-slate-200'

export const settingsFieldHintClassName =
  'mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400'

export const settingsStatusTextClassName =
  'text-xs text-slate-500 dark:text-slate-400'

export const settingsDividerClassName =
  'border-t border-[rgba(75,120,220,0.12)] dark:border-slate-700'

export const settingsCardClassName =
  'rounded-[16px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]/90 p-5 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900/60'

export const settingsInnerCardClassName =
  'rounded-[16px] border border-[rgba(75,120,220,0.12)] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60'

const inputClassName =
  'mt-2 h-11 w-full rounded-[16px] border-0 bg-white px-3 text-sm font-medium text-[#2A376F] shadow-sm ring-1 ring-[rgba(75,120,220,0.12)] outline-none transition-all placeholder:text-slate-400 focus:ring-3 focus:ring-blue-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:placeholder:text-slate-500 dark:focus:ring-blue-500/40'

export const settingsFieldClassName = inputClassName
export const settingsSelectClassName = inputClassName

export const settingsSaveButtonClassName =
  'h-11 rounded-[14px] bg-[#2563EB] px-5 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(37,99,235,0.35)] hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50'

function settingsChoiceCardClass(selected: boolean, disabled = false) {
  return cn(
    'text-left transition-colors',
    selected
      ? 'border-[#2563EB] bg-[#EEF4FF] dark:border-blue-500 dark:bg-blue-950/40'
      : 'border-[rgba(75,120,220,0.12)] bg-white hover:bg-[#F8FBFF] dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800',
    disabled && 'pointer-events-none opacity-60',
  )
}

type SettingsPageIntroProps = {
  title: string
  description?: string
}

export function SettingsPageIntro({ title, description }: SettingsPageIntroProps) {
  return (
    <div>
      <h2 className={settingsPageTitleClassName}>{title}</h2>
      {description ? <p className={settingsPageDescriptionClassName}>{description}</p> : null}
    </div>
  )
}

type SettingsCardProps = {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function SettingsCard({ title, description, children, className }: SettingsCardProps) {
  return (
    <section className={cn(settingsCardClassName, className)}>
      <div>
        <h3 className={settingsCardTitleClassName}>{title}</h3>
        {description ? <p className={settingsCardDescriptionClassName}>{description}</p> : null}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

type SettingsSectionProps = {
  title: string
  description?: string
  children: ReactNode
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="space-y-4">
      <SettingsPageIntro title={title} description={description} />
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
      <span className={settingsFieldLabelClassName}>{label}</span>
      {children}
      {hint ? <p className={settingsFieldHintClassName}>{hint}</p> : null}
    </label>
  )
}

type ChoiceOption<T extends string> = {
  value: T
  label: string
  description?: string
  icon?: LucideIcon
}

type SettingsChoiceGroupProps<T extends string> = {
  legend?: string
  hint?: string
  name?: string
  value: T
  options: ChoiceOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
}

export function SettingsChoiceGroup<T extends string>({
  legend,
  hint,
  name,
  value,
  options,
  onChange,
  disabled = false,
}: SettingsChoiceGroupProps<T>) {
  const hasIcons = options.some((option) => option.icon)

  return (
    <fieldset className="block sm:col-span-2" disabled={disabled}>
      {legend ? <legend className={settingsFieldLabelClassName}>{legend}</legend> : null}
      {hint ? <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p> : null}
      <div
        className={cn(
          'mt-3 grid gap-2',
          hasIcons ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {options.map((option) => {
          const selected = value === option.value
          const Icon = option.icon

          if (hasIcons && Icon) {
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                aria-pressed={selected}
                className={cn(
                  'flex h-full flex-col rounded-[16px] border p-4',
                  settingsChoiceCardClass(selected, disabled),
                )}
              >
                <div
                  className={cn(
                    'mb-3 flex size-9 items-center justify-center rounded-[12px] transition-colors',
                    selected
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'bg-[#F8FBFF] text-[#2563EB] ring-1 ring-[rgba(75,120,220,0.12)] dark:bg-slate-800 dark:text-blue-300 dark:ring-slate-700',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </div>
                <span className="text-sm font-semibold text-[#2A376F] dark:text-slate-100">
                  {option.label}
                </span>
                {option.description ? (
                  <span className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {option.description}
                  </span>
                ) : null}
              </button>
            )
          }

          return (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-[16px] border px-4 py-3',
                settingsChoiceCardClass(selected, disabled),
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                disabled={disabled}
                className="mt-0.5 size-4 border-slate-300 text-[#2563EB]"
              />
              <span>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {option.label}
                </span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function SettingsRadioGroup<T extends string | number>(props: {
  legend: string
  hint?: string
  name: string
  value: T
  options: Array<{ value: T; label: string; description?: string }>
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <SettingsChoiceGroup
      legend={props.legend}
      hint={props.hint}
      name={props.name}
      value={String(props.value)}
      options={props.options.map((option) => ({
        value: String(option.value),
        label: option.label,
        description: option.description,
      }))}
      onChange={(value) => props.onChange(value as T)}
      disabled={props.disabled}
    />
  )
}

type SettingsChipGroupProps<T extends string | number> = {
  label: string
  hint?: string
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}

export function SettingsChipGroup<T extends string | number>({
  label,
  hint,
  options,
  value,
  onChange,
}: SettingsChipGroupProps<T>) {
  return (
    <div>
      <p className={settingsFieldLabelClassName}>{label}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p> : null}
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

type SettingsMultiChipGroupProps<T extends string> = {
  label: string
  hint?: string
  options: Array<{ value: T; label: string }>
  selected: T[]
  onToggle: (value: T) => void
  disabled?: boolean
  formatLabel?: (label: string) => string
}

export function SettingsMultiChipGroup<T extends string>({
  label,
  hint,
  options,
  selected,
  onToggle,
  disabled = false,
  formatLabel = (value) => value,
}: SettingsMultiChipGroupProps<T>) {
  return (
    <div>
      <p className={settingsFieldLabelClassName}>{label}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p> : null}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(option.value)}
              aria-pressed={isSelected}
              className={cn(
                'min-w-[5.5rem] rounded-full px-4 py-2 text-sm font-semibold transition-colors ring-1',
                isSelected
                  ? 'bg-[#EAF4FF] text-[#2563EB] ring-[#BFDBFE] dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60'
                  : 'bg-white text-slate-600 ring-[rgba(75,120,220,0.12)] hover:bg-[#F8FBFF] dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-slate-800',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              {formatLabel(option.label)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type SettingsSegmentedControlProps<T extends string> = {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  disabled?: boolean
}

export function SettingsSegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: SettingsSegmentedControlProps<T>) {
  return (
    <div>
      <p className={settingsFieldLabelClassName}>{label}</p>
      <div
        className={cn(
          'mt-2.5 inline-flex rounded-[12px] bg-white p-1 ring-1 ring-[rgba(75,120,220,0.12)] dark:bg-slate-800/70 dark:ring-white/10',
          disabled && 'opacity-60',
        )}
      >
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                'min-w-[3rem] rounded-[10px] px-4 py-2 text-sm font-semibold transition-colors',
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
    <div className="flex items-center justify-between gap-4 rounded-[16px] border border-[rgba(75,120,220,0.12)] bg-white px-4 py-3 sm:col-span-2 dark:border-slate-700 dark:bg-slate-800/60">
      <div>
        <p className={settingsFieldLabelClassName}>{label}</p>
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
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center justify-start overflow-hidden rounded-full transition-colors',
          checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700',
          disabled && 'opacity-60',
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

type SettingsStatusFooterProps = {
  isDirty: boolean
  isSaving?: boolean
  onSave?: () => void
  saveLabel?: string
  className?: string
}

export function SettingsStatusFooter({
  isDirty,
  isSaving = false,
  onSave,
  saveLabel = 'Save Changes',
  className,
}: SettingsStatusFooterProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[16px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]/90 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className={cn('text-sm font-medium', isDirty ? 'text-[#2563EB]' : settingsStatusTextClassName)}>
        {isDirty ? 'You have unsaved changes.' : 'All changes saved.'}
      </p>
      {onSave ? (
        <Button
          type="button"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className={cn(settingsSaveButtonClassName, 'w-full sm:w-auto')}
        >
          {isSaving ? 'Saving…' : saveLabel}
        </Button>
      ) : null}
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
          className={cn(
            'shrink-0 rounded-[12px] px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm',
            activeTab === tab.id
              ? 'bg-white text-[#2563EB] shadow-sm ring-1 ring-blue-100 dark:bg-slate-700 dark:text-blue-300 dark:ring-slate-600'
              : 'text-slate-600 hover:bg-white/70 hover:text-[#2A376F] dark:text-slate-400 dark:hover:bg-slate-700/70 dark:hover:text-slate-100',
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

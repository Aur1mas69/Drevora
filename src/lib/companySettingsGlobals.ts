import type { CompanySettings } from '@/lib/companySettingsTypes'
import { DEFAULT_OVERTIME_MULTIPLIER } from '@/lib/companySettingsTypes'
import { applyGlobalDateTimeSettings } from '@/lib/dateTimeFormat'

let globalSettings: CompanySettings | null = null

export function applyGlobalCompanySettings(settings: CompanySettings | null): void {
  globalSettings = settings

  if (!settings) return

  applyGlobalDateTimeSettings({
    timeFormat: settings.timeFormat,
    dateFormat: settings.dateFormat,
    weekStarts: settings.weekStarts,
    overtimeAfterHours: settings.overtimeAfterHours,
  })
}

export function getGlobalCompanySettings(): CompanySettings | null {
  return globalSettings
}

export function getGlobalOvertimeMultiplier(): number {
  return globalSettings?.overtimeMultiplier ?? DEFAULT_OVERTIME_MULTIPLIER
}

export function getSetting<K extends keyof CompanySettings>(key: K): CompanySettings[K] | null {
  return globalSettings?.[key] ?? null
}

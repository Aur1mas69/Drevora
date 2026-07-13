import type { CompanySettings, TimesheetWeekSettings } from '@/lib/companySettingsTypes'
import { DEFAULT_OVERTIME_MULTIPLIER, DEFAULT_TIMESHEET_WEEK_SETTINGS } from '@/lib/companySettingsTypes'
import { applyGlobalDateTimeSettings } from '@/lib/dateTimeFormat'

let globalSettings: CompanySettings | null = null
/** Company id verified via company_members for the current authenticated session. */
let verifiedCompanyId: string | null = null

export function applyGlobalCompanySettings(
  settings: CompanySettings | null,
  options?: { companyId?: string | null },
): void {
  if (!settings) {
    globalSettings = null
    verifiedCompanyId = null
    return
  }

  const nextCompanyId = options?.companyId?.trim() || settings.id?.trim() || null
  if (!nextCompanyId) {
    // Refuse to cache settings that are not tied to a verified company id.
    globalSettings = null
    verifiedCompanyId = null
    return
  }

  if (settings.id && settings.id !== nextCompanyId) {
    globalSettings = null
    verifiedCompanyId = null
    return
  }

  globalSettings = settings
  verifiedCompanyId = nextCompanyId

  applyGlobalDateTimeSettings({
    timeFormat: settings.timeFormat,
    dateFormat: settings.dateFormat,
    weekStarts: settings.weekStarts,
    overtimeAfterHours: settings.overtimeAfterHours,
  })
}

/** Clears cached company settings (logout, session expiry, membership failure). */
export function clearGlobalCompanySettings(): void {
  globalSettings = null
  verifiedCompanyId = null
}

export function getVerifiedCompanyId(): string | null {
  return verifiedCompanyId
}

export function getGlobalCompanySettings(): CompanySettings | null {
  if (!globalSettings || !verifiedCompanyId) {
    return null
  }
  if (globalSettings.id !== verifiedCompanyId) {
    return null
  }
  return globalSettings
}

export function getGlobalOvertimeMultiplier(): number {
  return getGlobalCompanySettings()?.overtimeMultiplier ?? DEFAULT_OVERTIME_MULTIPLIER
}

export function getGlobalPaidBreaks(): boolean {
  return getGlobalCompanySettings()?.paidBreaks ?? false
}

export function getTimesheetWeekSettings(): TimesheetWeekSettings {
  const settings = getGlobalCompanySettings()
  if (!settings) return DEFAULT_TIMESHEET_WEEK_SETTINGS

  return {
    timesheetWeekStartDay: settings.timesheetWeekStartDay,
    timesheetWeekResetMonth: settings.timesheetWeekResetMonth,
    timesheetWeekResetDay: settings.timesheetWeekResetDay,
  }
}

/** @deprecated Use getTimesheetWeekSettings */
export function getTimesheetWeekNumberingSettings(): TimesheetWeekSettings {
  return getTimesheetWeekSettings()
}

export function getSetting<K extends keyof CompanySettings>(key: K): CompanySettings[K] | null {
  return getGlobalCompanySettings()?.[key] ?? null
}

export function getCompanyTimezone(): string {
  return getGlobalCompanySettings()?.timezone?.trim() || 'Europe/London'
}

/** Company text stored on rows such as documents, drivers, vehicle_check_templates. */
export function resolveCompanyTextScope(
  settings?: CompanySettings | null,
): string | null {
  const fromSettings = settings?.name?.trim()
  if (fromSettings) return fromSettings
  return getGlobalCompanySettings()?.name?.trim() || null
}

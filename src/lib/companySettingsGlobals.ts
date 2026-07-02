import type { CompanySettings, TimesheetWeekSettings } from '@/lib/companySettingsTypes'
import { DEFAULT_OVERTIME_MULTIPLIER, DEFAULT_TIMESHEET_WEEK_SETTINGS } from '@/lib/companySettingsTypes'
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

export function getGlobalPaidBreaks(): boolean {
  return globalSettings?.paidBreaks ?? false
}

export function getTimesheetWeekSettings(): TimesheetWeekSettings {
  if (!globalSettings) return DEFAULT_TIMESHEET_WEEK_SETTINGS

  return {
    timesheetWeekStartDay: globalSettings.timesheetWeekStartDay,
    timesheetWeekResetMonth: globalSettings.timesheetWeekResetMonth,
    timesheetWeekResetDay: globalSettings.timesheetWeekResetDay,
  }
}

/** @deprecated Use getTimesheetWeekSettings */
export function getTimesheetWeekNumberingSettings(): TimesheetWeekSettings {
  return getTimesheetWeekSettings()
}

export function getSetting<K extends keyof CompanySettings>(key: K): CompanySettings[K] | null {
  return globalSettings?.[key] ?? null
}

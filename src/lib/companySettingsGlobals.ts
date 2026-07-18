import type {
  CompanySettings,
  TimesheetOvertimeRules,
  TimesheetWeekSettings,
} from '@/lib/companySettingsTypes'
import {
  DEFAULT_OVERTIME_MULTIPLIER,
  DEFAULT_TIMESHEET_OVERTIME_RULES,
  DEFAULT_TIMESHEET_WEEK_SETTINGS,
} from '@/lib/companySettingsTypes'
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

/**
 * Error thrown when a tenant-scoped query/mutation is attempted without a
 * membership-verified company id. Never fall back to company name or the
 * oldest company — fail closed instead.
 */
export class MissingCompanyContextError extends Error {
  constructor(
    message = 'Your account is not linked to an active company.',
  ) {
    super(message)
    this.name = 'MissingCompanyContextError'
  }
}

/**
 * Returns the membership-verified company id or throws MissingCompanyContextError.
 * Use for every tenant read/insert/update/delete filter. Never silently falls back.
 */
export function requireVerifiedCompanyId(): string {
  const id = verifiedCompanyId
  if (!id) {
    throw new MissingCompanyContextError()
  }
  return id
}

/**
 * Verified company display name for TRANSITIONAL legacy company-text writes only.
 * Returns null when the cached settings are not tied to the verified company id.
 * This must never be used as a security or query filter.
 */
export function getVerifiedCompanyName(): string | null {
  return getGlobalCompanySettings()?.name?.trim() || null
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

/** Company weekend + weekday overtime rules for payable Total Hours. */
export function getGlobalTimesheetOvertimeRules(): TimesheetOvertimeRules {
  const settings = getGlobalCompanySettings()
  if (!settings) return { ...DEFAULT_TIMESHEET_OVERTIME_RULES }

  return {
    overtimeAfterHours: settings.overtimeAfterHours,
    overtimeMultiplier: settings.overtimeMultiplier,
    saturdayOvertimeEnabled: settings.saturdayOvertimeEnabled,
    saturdayOvertimeAfterHours: settings.saturdayOvertimeAfterHours,
    saturdayOvertimeMultiplier: settings.saturdayOvertimeMultiplier,
    saturdayGuaranteedPaidHours: settings.saturdayGuaranteedPaidHours,
    sundayOvertimeEnabled: settings.sundayOvertimeEnabled,
    sundayOvertimeAfterHours: settings.sundayOvertimeAfterHours,
    sundayOvertimeMultiplier: settings.sundayOvertimeMultiplier,
    sundayGuaranteedPaidHours: settings.sundayGuaranteedPaidHours,
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

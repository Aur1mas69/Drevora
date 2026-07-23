import type { CompanySettings } from '@/lib/companySettingsTypes'
import {
  DEFAULT_OVERTIME_AFTER_HOURS,
  DEFAULT_OVERTIME_MULTIPLIER,
  DEFAULT_SATURDAY_GUARANTEED_PAID_HOURS,
  DEFAULT_SATURDAY_OVERTIME_AFTER_HOURS,
  DEFAULT_SATURDAY_OVERTIME_MULTIPLIER,
  DEFAULT_SUNDAY_GUARANTEED_PAID_HOURS,
  DEFAULT_SUNDAY_OVERTIME_AFTER_HOURS,
  DEFAULT_SUNDAY_OVERTIME_MULTIPLIER,
  type CompanyCurrency,
  type OvertimeCalculationMethod,
  type OvertimeMode,
  type RoundTimeMinutes,
  type TimesheetWeekStartDay,
} from '@/lib/companySettingsTypes'
import {
  DEFAULT_WEEKLY_OVERTIME_AFTER_HOURS,
  SAFE_FALLBACK_TIMESHEET_SETTINGS,
  WORKER_BREAK_MINUTES_OPTIONS,
  WORKER_OVERTIME_MULTIPLIER_MAX,
  WORKER_OVERTIME_MULTIPLIER_MIN,
  type DriverTimesheetSettingsOverride,
  type EffectiveTimesheetSettings,
  type WorkerBreakMinutes,
  type WorkerTimesheetSettingsForm,
} from '@/lib/workerTimesheetSettingsTypes'

function pickOverride<T>(override: T | null | undefined, fallback: T): T {
  return override === null || override === undefined ? fallback : override
}

function normalizeOvertimeMode(value: unknown, fallback: OvertimeMode): OvertimeMode {
  return value === 'Automatic' || value === 'Manual' ? value : fallback
}

function normalizeOtMethod(
  value: unknown,
  fallback: OvertimeCalculationMethod,
): OvertimeCalculationMethod {
  return value === 'daily' || value === 'weekly' || value === 'none' ? value : fallback
}

function normalizeBreakMinutes(value: unknown, fallback: WorkerBreakMinutes): WorkerBreakMinutes {
  const n = typeof value === 'number' ? value : Number(value)
  if (
    WORKER_BREAK_MINUTES_OPTIONS.includes(n as WorkerBreakMinutes)
  ) {
    return n as WorkerBreakMinutes
  }
  return fallback
}

function normalizeRoundMinutes(value: unknown, fallback: RoundTimeMinutes): RoundTimeMinutes {
  if (value === 0 || value === 5 || value === 15) return value
  return fallback
}

function normalizeCurrency(value: unknown, fallback: CompanyCurrency): CompanyCurrency {
  if (value === 'GBP' || value === 'EUR' || value === 'USD' || value === 'RUB') return value
  return fallback
}

function normalizeWeekStart(
  value: unknown,
  fallback: TimesheetWeekStartDay,
): TimesheetWeekStartDay {
  return value === 'monday' || value === 'sunday' ? value : fallback
}

function normalizePositiveHours(value: unknown, fallback: number, max = 168): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0 || n > max) return fallback
  return Math.round(n * 100) / 100
}

function normalizeMultiplier(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (
    !Number.isFinite(n) ||
    n < WORKER_OVERTIME_MULTIPLIER_MIN ||
    n > WORKER_OVERTIME_MULTIPLIER_MAX
  ) {
    return fallback
  }
  return Math.round(n * 100) / 100
}

/** Company row → concrete form defaults (never null). */
export function companySettingsToTimesheetForm(
  company: CompanySettings | null | undefined,
): WorkerTimesheetSettingsForm {
  if (!company) return { ...SAFE_FALLBACK_TIMESHEET_SETTINGS }

  return {
    overtimeMode: normalizeOvertimeMode(company.overtimeMode, 'Manual'),
    overtimeCalculationMethod: normalizeOtMethod(
      company.overtimeCalculationMethod,
      'daily',
    ),
    overtimeAfterHours: normalizePositiveHours(
      company.overtimeAfterHours,
      DEFAULT_OVERTIME_AFTER_HOURS,
      24,
    ),
    weeklyOvertimeAfterHours: normalizePositiveHours(
      company.weeklyOvertimeAfterHours,
      DEFAULT_WEEKLY_OVERTIME_AFTER_HOURS,
      168,
    ),
    overtimeMultiplier: normalizeMultiplier(
      company.overtimeMultiplier,
      DEFAULT_OVERTIME_MULTIPLIER,
    ),
    defaultBreakMinutes: normalizeBreakMinutes(company.defaultBreakMinutes, 30),
    paidBreaks: Boolean(company.paidBreaks),
    roundTimeMinutes: normalizeRoundMinutes(company.roundTimeMinutes, 0),
    currency: normalizeCurrency(company.currency, 'GBP'),
    timesheetWeekStartDay: normalizeWeekStart(company.timesheetWeekStartDay, 'monday'),
    saturdayOvertimeEnabled: Boolean(company.saturdayOvertimeEnabled),
    saturdayOvertimeAfterHours: normalizePositiveHours(
      company.saturdayOvertimeAfterHours,
      DEFAULT_SATURDAY_OVERTIME_AFTER_HOURS,
      24,
    ),
    saturdayOvertimeMultiplier: normalizeMultiplier(
      company.saturdayOvertimeMultiplier,
      DEFAULT_SATURDAY_OVERTIME_MULTIPLIER,
    ),
    saturdayGuaranteedPaidHours: normalizePositiveHours(
      company.saturdayGuaranteedPaidHours,
      DEFAULT_SATURDAY_GUARANTEED_PAID_HOURS,
      24,
    ),
    sundayOvertimeEnabled: Boolean(company.sundayOvertimeEnabled),
    sundayOvertimeAfterHours: normalizePositiveHours(
      company.sundayOvertimeAfterHours,
      DEFAULT_SUNDAY_OVERTIME_AFTER_HOURS,
      24,
    ),
    sundayOvertimeMultiplier: normalizeMultiplier(
      company.sundayOvertimeMultiplier,
      DEFAULT_SUNDAY_OVERTIME_MULTIPLIER,
    ),
    sundayGuaranteedPaidHours: normalizePositiveHours(
      company.sundayGuaranteedPaidHours,
      DEFAULT_SUNDAY_GUARANTEED_PAID_HOURS,
      24,
    ),
  }
}

/**
 * Resolve effective Timesheet settings:
 * worker override field → company default → safe application fallback.
 *
 * Presence of an override row means "Using personal settings" even when some
 * columns are null (those nulls still inherit company).
 */
export function resolveEffectiveTimesheetSettings(
  company: CompanySettings | null | undefined,
  override: DriverTimesheetSettingsOverride | null | undefined,
): EffectiveTimesheetSettings {
  const companyForm = companySettingsToTimesheetForm(company)
  const hasWorkerOverride = Boolean(override)

  const form: WorkerTimesheetSettingsForm = hasWorkerOverride && override
    ? {
        overtimeMode: normalizeOvertimeMode(
          pickOverride(override.overtimeMode, companyForm.overtimeMode),
          companyForm.overtimeMode,
        ),
        overtimeCalculationMethod: normalizeOtMethod(
          pickOverride(
            override.overtimeCalculationMethod,
            companyForm.overtimeCalculationMethod,
          ),
          companyForm.overtimeCalculationMethod,
        ),
        overtimeAfterHours: normalizePositiveHours(
          pickOverride(override.overtimeAfterHours, companyForm.overtimeAfterHours),
          companyForm.overtimeAfterHours,
          24,
        ),
        weeklyOvertimeAfterHours: normalizePositiveHours(
          pickOverride(
            override.weeklyOvertimeAfterHours,
            companyForm.weeklyOvertimeAfterHours,
          ),
          companyForm.weeklyOvertimeAfterHours,
          168,
        ),
        overtimeMultiplier: normalizeMultiplier(
          pickOverride(override.overtimeMultiplier, companyForm.overtimeMultiplier),
          companyForm.overtimeMultiplier,
        ),
        defaultBreakMinutes: normalizeBreakMinutes(
          pickOverride(override.defaultBreakMinutes, companyForm.defaultBreakMinutes),
          companyForm.defaultBreakMinutes,
        ),
        paidBreaks: Boolean(
          pickOverride(override.paidBreaks, companyForm.paidBreaks),
        ),
        roundTimeMinutes: normalizeRoundMinutes(
          pickOverride(override.roundTimeMinutes, companyForm.roundTimeMinutes),
          companyForm.roundTimeMinutes,
        ),
        currency: normalizeCurrency(
          pickOverride(override.currency, companyForm.currency),
          companyForm.currency,
        ),
        timesheetWeekStartDay: normalizeWeekStart(
          pickOverride(override.timesheetWeekStartDay, companyForm.timesheetWeekStartDay),
          companyForm.timesheetWeekStartDay,
        ),
        saturdayOvertimeEnabled: Boolean(
          pickOverride(
            override.saturdayOvertimeEnabled,
            companyForm.saturdayOvertimeEnabled,
          ),
        ),
        saturdayOvertimeAfterHours: normalizePositiveHours(
          pickOverride(
            override.saturdayOvertimeAfterHours,
            companyForm.saturdayOvertimeAfterHours,
          ),
          companyForm.saturdayOvertimeAfterHours,
          24,
        ),
        saturdayOvertimeMultiplier: normalizeMultiplier(
          pickOverride(
            override.saturdayOvertimeMultiplier,
            companyForm.saturdayOvertimeMultiplier,
          ),
          companyForm.saturdayOvertimeMultiplier,
        ),
        saturdayGuaranteedPaidHours: normalizePositiveHours(
          pickOverride(
            override.saturdayGuaranteedPaidHours,
            companyForm.saturdayGuaranteedPaidHours,
          ),
          companyForm.saturdayGuaranteedPaidHours,
          24,
        ),
        sundayOvertimeEnabled: Boolean(
          pickOverride(override.sundayOvertimeEnabled, companyForm.sundayOvertimeEnabled),
        ),
        sundayOvertimeAfterHours: normalizePositiveHours(
          pickOverride(
            override.sundayOvertimeAfterHours,
            companyForm.sundayOvertimeAfterHours,
          ),
          companyForm.sundayOvertimeAfterHours,
          24,
        ),
        sundayOvertimeMultiplier: normalizeMultiplier(
          pickOverride(
            override.sundayOvertimeMultiplier,
            companyForm.sundayOvertimeMultiplier,
          ),
          companyForm.sundayOvertimeMultiplier,
        ),
        sundayGuaranteedPaidHours: normalizePositiveHours(
          pickOverride(
            override.sundayGuaranteedPaidHours,
            companyForm.sundayGuaranteedPaidHours,
          ),
          companyForm.sundayGuaranteedPaidHours,
          24,
        ),
      }
    : companyForm

  const source: EffectiveTimesheetSettings['source'] = hasWorkerOverride
    ? 'worker'
    : company
      ? 'company'
      : 'fallback'

  return {
    ...form,
    hasWorkerOverride,
    source,
    overtimeRules: {
      overtimeAfterHours: form.overtimeAfterHours,
      overtimeMultiplier: form.overtimeMultiplier,
      saturdayOvertimeEnabled: form.saturdayOvertimeEnabled,
      saturdayOvertimeAfterHours: form.saturdayOvertimeAfterHours,
      saturdayOvertimeMultiplier: form.saturdayOvertimeMultiplier,
      saturdayGuaranteedPaidHours: form.saturdayGuaranteedPaidHours,
      sundayOvertimeEnabled: form.sundayOvertimeEnabled,
      sundayOvertimeAfterHours: form.sundayOvertimeAfterHours,
      sundayOvertimeMultiplier: form.sundayOvertimeMultiplier,
      sundayGuaranteedPaidHours: form.sundayGuaranteedPaidHours,
      overtimeCalculationMethod: form.overtimeCalculationMethod,
      weeklyOvertimeAfterHours: form.weeklyOvertimeAfterHours,
    },
  }
}

export function validateWorkerTimesheetSettingsForm(
  form: WorkerTimesheetSettingsForm,
): string | null {
  if (form.overtimeMode !== 'Manual' && form.overtimeMode !== 'Automatic') {
    return 'Choose Automatic or Manual entry mode.'
  }
  if (
    form.overtimeCalculationMethod !== 'daily' &&
    form.overtimeCalculationMethod !== 'weekly' &&
    form.overtimeCalculationMethod !== 'none'
  ) {
    return 'Choose a valid overtime calculation method.'
  }
  if (
    !Number.isFinite(form.overtimeAfterHours) ||
    form.overtimeAfterHours < 0 ||
    form.overtimeAfterHours > 24
  ) {
    return 'Daily overtime threshold must be between 0 and 24 hours.'
  }
  if (
    !Number.isFinite(form.weeklyOvertimeAfterHours) ||
    form.weeklyOvertimeAfterHours < 0 ||
    form.weeklyOvertimeAfterHours > 168
  ) {
    return 'Weekly overtime threshold must be between 0 and 168 hours.'
  }
  if (
    !Number.isFinite(form.overtimeMultiplier) ||
    form.overtimeMultiplier < WORKER_OVERTIME_MULTIPLIER_MIN ||
    form.overtimeMultiplier > WORKER_OVERTIME_MULTIPLIER_MAX
  ) {
    return `Overtime multiplier must be between ${WORKER_OVERTIME_MULTIPLIER_MIN} and ${WORKER_OVERTIME_MULTIPLIER_MAX}.`
  }
  if (
    !WORKER_BREAK_MINUTES_OPTIONS.includes(form.defaultBreakMinutes as WorkerBreakMinutes)
  ) {
    return 'Default break must be 0, 15, 30, 45, or 60 minutes.'
  }
  if (
    form.roundTimeMinutes !== 0 &&
    form.roundTimeMinutes !== 5 &&
    form.roundTimeMinutes !== 15
  ) {
    return 'Time rounding must be None, 5, or 15 minutes.'
  }
  return null
}

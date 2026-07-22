import type {
  CompanyCurrency,
  OvertimeCalculationMethod,
  OvertimeMode,
  RoundTimeMinutes,
  TimesheetOvertimeRules,
  TimesheetWeekStartDay,
} from '@/lib/companySettingsTypes'
import {
  DEFAULT_OVERTIME_AFTER_HOURS,
  DEFAULT_OVERTIME_MULTIPLIER,
  DEFAULT_TIMESHEET_OVERTIME_RULES,
} from '@/lib/companySettingsTypes'

export type { OvertimeCalculationMethod }

export const DEFAULT_WEEKLY_OVERTIME_AFTER_HOURS = 45

export const WORKER_BREAK_MINUTES_OPTIONS = [0, 15, 30, 45, 60] as const
export type WorkerBreakMinutes = (typeof WORKER_BREAK_MINUTES_OPTIONS)[number]

export const WORKER_OVERTIME_MULTIPLIER_MIN = 1.0
export const WORKER_OVERTIME_MULTIPLIER_MAX = 3.0

/** Persisted worker override row (null field = inherit company for that field). */
export type DriverTimesheetSettingsOverride = {
  driverId: string
  companyId: string
  createdAt: string
  updatedAt: string
  overtimeMode: OvertimeMode | null
  overtimeCalculationMethod: OvertimeCalculationMethod | null
  overtimeAfterHours: number | null
  weeklyOvertimeAfterHours: number | null
  overtimeMultiplier: number | null
  defaultBreakMinutes: number | null
  paidBreaks: boolean | null
  roundTimeMinutes: RoundTimeMinutes | null
  currency: CompanyCurrency | null
  timesheetWeekStartDay: TimesheetWeekStartDay | null
  saturdayOvertimeEnabled: boolean | null
  saturdayOvertimeAfterHours: number | null
  saturdayOvertimeMultiplier: number | null
  saturdayGuaranteedPaidHours: number | null
  sundayOvertimeEnabled: boolean | null
  sundayOvertimeAfterHours: number | null
  sundayOvertimeMultiplier: number | null
  sundayGuaranteedPaidHours: number | null
}

/** Full editable form values (always concrete; never null). */
export type WorkerTimesheetSettingsForm = {
  overtimeMode: OvertimeMode
  overtimeCalculationMethod: OvertimeCalculationMethod
  overtimeAfterHours: number
  weeklyOvertimeAfterHours: number
  overtimeMultiplier: number
  defaultBreakMinutes: WorkerBreakMinutes
  paidBreaks: boolean
  roundTimeMinutes: RoundTimeMinutes
  currency: CompanyCurrency
  timesheetWeekStartDay: TimesheetWeekStartDay
  saturdayOvertimeEnabled: boolean
  saturdayOvertimeAfterHours: number
  saturdayOvertimeMultiplier: number
  saturdayGuaranteedPaidHours: number
  sundayOvertimeEnabled: boolean
  sundayOvertimeAfterHours: number
  sundayOvertimeMultiplier: number
  sundayGuaranteedPaidHours: number
}

/** Resolved settings used by Timesheet calculations. */
export type EffectiveTimesheetSettings = WorkerTimesheetSettingsForm & {
  /** True when a personal override row exists. */
  hasWorkerOverride: boolean
  source: 'worker' | 'company' | 'fallback'
  overtimeRules: TimesheetOvertimeRules
}

export const SAFE_FALLBACK_TIMESHEET_SETTINGS: WorkerTimesheetSettingsForm = {
  overtimeMode: 'Manual',
  overtimeCalculationMethod: 'daily',
  overtimeAfterHours: DEFAULT_OVERTIME_AFTER_HOURS,
  weeklyOvertimeAfterHours: DEFAULT_WEEKLY_OVERTIME_AFTER_HOURS,
  overtimeMultiplier: DEFAULT_OVERTIME_MULTIPLIER,
  defaultBreakMinutes: 30,
  paidBreaks: false,
  roundTimeMinutes: 0,
  currency: 'GBP',
  timesheetWeekStartDay: 'monday',
  saturdayOvertimeEnabled: DEFAULT_TIMESHEET_OVERTIME_RULES.saturdayOvertimeEnabled,
  saturdayOvertimeAfterHours: DEFAULT_TIMESHEET_OVERTIME_RULES.saturdayOvertimeAfterHours,
  saturdayOvertimeMultiplier: DEFAULT_TIMESHEET_OVERTIME_RULES.saturdayOvertimeMultiplier,
  saturdayGuaranteedPaidHours: DEFAULT_TIMESHEET_OVERTIME_RULES.saturdayGuaranteedPaidHours,
  sundayOvertimeEnabled: DEFAULT_TIMESHEET_OVERTIME_RULES.sundayOvertimeEnabled,
  sundayOvertimeAfterHours: DEFAULT_TIMESHEET_OVERTIME_RULES.sundayOvertimeAfterHours,
  sundayOvertimeMultiplier: DEFAULT_TIMESHEET_OVERTIME_RULES.sundayOvertimeMultiplier,
  sundayGuaranteedPaidHours: DEFAULT_TIMESHEET_OVERTIME_RULES.sundayGuaranteedPaidHours,
}

/**
 * Focused verification for Worker effective Timesheet settings resolver
 * and weekly / none / daily automatic OT selection.
 * Run: npx tsx scripts/verify-worker-timesheet-settings.ts
 */
import type { CompanySettings } from '../src/lib/companySettingsTypes.ts'
import { resolveEffectiveTimesheetSettings } from '../src/lib/resolveEffectiveTimesheetSettings.ts'
import {
  calculateTotalPayableHours,
  getEntryPayableDisplayResult,
  recalculateEntryInputs,
} from '../src/lib/timesheetUtils.ts'
import type { DriverTimesheetSettingsOverride } from '../src/lib/workerTimesheetSettingsTypes.ts'

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`)
  }
}

const company = {
  id: 'company-1',
  overtimeMode: 'Automatic',
  overtimeAfterHours: 10.5,
  overtimeMultiplier: 1.5,
  defaultBreakMinutes: 30,
  paidBreaks: false,
  roundTimeMinutes: 0,
  currency: 'GBP',
  timesheetWeekStartDay: 'monday',
  saturdayOvertimeEnabled: false,
  saturdayOvertimeAfterHours: 6,
  saturdayOvertimeMultiplier: 1.5,
  saturdayGuaranteedPaidHours: 10,
  sundayOvertimeEnabled: false,
  sundayOvertimeAfterHours: 0,
  sundayOvertimeMultiplier: 2,
  sundayGuaranteedPaidHours: 10,
} as unknown as CompanySettings

// 1) No override → company defaults
const noOverride = resolveEffectiveTimesheetSettings(company, null)
assertEqual(noOverride.hasWorkerOverride, false, 'no override flag')
assertEqual(noOverride.source, 'company', 'no override source')
assertEqual(noOverride.overtimeMode, 'Automatic', 'company mode')
assertEqual(noOverride.overtimeAfterHours, 10.5, 'company daily threshold')

// 2) Override Manual mode
const override: DriverTimesheetSettingsOverride = {
  driverId: 'driver-1',
  companyId: 'company-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  overtimeMode: 'Manual',
  overtimeCalculationMethod: 'daily',
  overtimeAfterHours: 10.5,
  weeklyOvertimeAfterHours: 45,
  overtimeMultiplier: 1.5,
  defaultBreakMinutes: 30,
  paidBreaks: true,
  roundTimeMinutes: 0,
  currency: 'GBP',
  timesheetWeekStartDay: 'monday',
  saturdayOvertimeEnabled: false,
  saturdayOvertimeAfterHours: 6,
  saturdayOvertimeMultiplier: 1.5,
  saturdayGuaranteedPaidHours: 10,
  sundayOvertimeEnabled: false,
  sundayOvertimeAfterHours: 0,
  sundayOvertimeMultiplier: 2,
  sundayGuaranteedPaidHours: 10,
}

const withOverride = resolveEffectiveTimesheetSettings(company, override)
assertEqual(withOverride.hasWorkerOverride, true, 'override flag')
assertEqual(withOverride.source, 'worker', 'override source')
assertEqual(withOverride.overtimeMode, 'Manual', 'worker manual mode')
assertEqual(withOverride.paidBreaks, true, 'worker paid breaks')

// 3) Manual OT display + Total formula
const manualDisplay = getEntryPayableDisplayResult(
  {
    dayDate: '2026-07-20',
    startTime: '08:00',
    finishTime: '18:00',
    totalMinutes: 10 * 60,
    overtimeMinutes: 90,
    additionalHours: 0.5,
    breakMinutes: 0,
  },
  {
    overtimeMode: 'Manual',
    overtimeRules: { overtimeMultiplier: 1.5 },
    paidBreaks: false,
  },
)
assertEqual(manualDisplay.overtimeDisplayHours, 1.5, 'manual OT display is worked hours')
assertEqual(manualDisplay.basicHours, 10, 'manual basic')
assertEqual(manualDisplay.additionalHours, 0.5, 'manual additional')
assertEqual(
  Math.round(manualDisplay.totalPaidHours * 100) / 100,
  12.75,
  'manual total 10 + 0.5 + 1.5*1.5',
)

// 4) Daily OT
const dailyEntries = recalculateEntryInputs(
  [
    {
      dayDate: '2026-07-20',
      startTime: '06:00',
      finishTime: '18:00',
      breakMinutes: 0,
      totalMinutes: 0,
      overtimeMinutes: 0,
      additionalHours: 0,
      dailyComment: '',
    },
  ],
  {
    overtimeMode: 'Automatic',
    paidBreaks: false,
    overtimeRules: {
      overtimeCalculationMethod: 'daily',
      overtimeAfterHours: 10.5,
      overtimeMultiplier: 1.5,
      saturdayOvertimeEnabled: false,
      sundayOvertimeEnabled: false,
    },
  },
)
assertEqual(dailyEntries[0].totalMinutes, 12 * 60, 'daily total minutes')
assertEqual(dailyEntries[0].overtimeMinutes, 90, 'daily OT minutes (1.5h)')

// 5) Weekly OT — 5×9h = 45h, day 6 pushes OT
const weekDays = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25']
const weeklyEntries = recalculateEntryInputs(
  weekDays.map((dayDate) => ({
    dayDate,
    startTime: '08:00',
    finishTime: '17:00',
    breakMinutes: 0,
    totalMinutes: 0,
    overtimeMinutes: 0,
    additionalHours: 0,
    dailyComment: '',
  })),
  {
    overtimeMode: 'Automatic',
    paidBreaks: false,
    overtimeRules: {
      overtimeCalculationMethod: 'weekly',
      weeklyOvertimeAfterHours: 45,
      overtimeAfterHours: 10.5,
      overtimeMultiplier: 1.5,
      saturdayOvertimeEnabled: false,
      sundayOvertimeEnabled: false,
    },
  },
)
const weeklyOtTotal = weeklyEntries.reduce((sum, entry) => sum + entry.overtimeMinutes, 0)
assertEqual(weeklyOtTotal, 9 * 60, 'weekly OT is only the 6th day (9h)')
assertEqual(weeklyEntries[5].overtimeMinutes, 9 * 60, 'OT allocated to day past threshold')
assertEqual(weeklyEntries[0].overtimeMinutes, 0, 'first day not OT under weekly')

// 6) No automatic OT
const noneEntries = recalculateEntryInputs(
  [
    {
      dayDate: '2026-07-20',
      startTime: '06:00',
      finishTime: '18:00',
      breakMinutes: 0,
      totalMinutes: 0,
      overtimeMinutes: 0,
      additionalHours: 0,
      dailyComment: '',
    },
  ],
  {
    overtimeMode: 'Automatic',
    paidBreaks: false,
    overtimeRules: {
      overtimeCalculationMethod: 'none',
      overtimeAfterHours: 10.5,
      saturdayOvertimeEnabled: false,
      sundayOvertimeEnabled: false,
    },
  },
)
assertEqual(noneEntries[0].overtimeMinutes, 0, 'none method creates no OT')

// 7) Paid break → Additional, not Basic, not multiplied
const paidBreakDisplay = getEntryPayableDisplayResult(
  {
    dayDate: '2026-07-20',
    startTime: '08:00',
    finishTime: '18:30',
    totalMinutes: 10 * 60,
    overtimeMinutes: 0,
    additionalHours: 0,
    breakMinutes: 30,
  },
  {
    overtimeMode: 'Automatic',
    paidBreaks: true,
    overtimeRules: {
      overtimeAfterHours: 10.5,
      overtimeMultiplier: 1.5,
      saturdayOvertimeEnabled: false,
      sundayOvertimeEnabled: false,
    },
  },
)
assertEqual(paidBreakDisplay.basicHours, 10, 'paid break not in basic')
assertEqual(paidBreakDisplay.additionalHours, 0.5, 'paid break in additional')
assertEqual(paidBreakDisplay.overtimeDisplayHours, 0, 'paid break not OT')
assertEqual(
  Math.round(paidBreakDisplay.totalPaidHours * 100) / 100,
  10.5,
  'paid break at 1:1',
)

// 8) Shared Total formula sanity
assertEqual(
  calculateTotalPayableHours(10, 0.5, 1.5, 1.5),
  12.75,
  'shared total formula',
)

console.log('verify-worker-timesheet-settings: all checks passed')

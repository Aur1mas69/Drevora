/**
 * Focused verification for Saturday/Sunday guaranteed paid hours (decimal hours).
 * Run: npm run verify:weekend-guaranteed-hours
 */
import {
  calculateGrossShiftHours,
  calculateWeekendGuaranteedPaidHours,
  calculateWeekendPayableBreakdown,
  formatTotalHours,
  getEntryPayableDisplayResult,
  roundHoursTwoDecimals,
  summarizeTimesheetEntries,
} from '../src/lib/timesheetUtils.ts'

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`)
  }
}

// 2026-07-18 is a Saturday; 2026-07-19 is a Sunday; 2026-07-15 is a Wednesday.
const SATURDAY = '2026-07-18'
const SUNDAY = '2026-07-19'
const WEDNESDAY = '2026-07-15'

type WeekendCase = {
  name: string
  dayDate: string
  grossHours: number
  guaranteedPaidHours: number
  overtimeStartsAfter: number
  multiplier: number
  expectedBasic: number
  /** Actual OT worked hours (shown in OT column). */
  expectedOtWorked: number
  /** OT worked × multiplier (used in Total only). */
  expectedOtPaid: number
  expectedTotal: number
}

const saturdayCases: WeekendCase[] = [
  {
    name: 'Saturday gross 5.0 below threshold → pay gross only',
    dayDate: SATURDAY,
    grossHours: 5,
    guaranteedPaidHours: 10,
    overtimeStartsAfter: 6.5,
    multiplier: 1.5,
    expectedBasic: 5,
    expectedOtWorked: 0,
    expectedOtPaid: 0,
    expectedTotal: 5,
  },
  {
    name: 'Saturday gross 6.5 at threshold → guarantee, no OT',
    dayDate: SATURDAY,
    grossHours: 6.5,
    guaranteedPaidHours: 10,
    overtimeStartsAfter: 6.5,
    multiplier: 1.5,
    expectedBasic: 10,
    expectedOtWorked: 0,
    expectedOtPaid: 0,
    expectedTotal: 10,
  },
  {
    name: 'Saturday gross 7.5 → guarantee + 1.0×1.5 OT',
    dayDate: SATURDAY,
    grossHours: 7.5,
    guaranteedPaidHours: 10,
    overtimeStartsAfter: 6.5,
    multiplier: 1.5,
    expectedBasic: 10,
    expectedOtWorked: 1,
    expectedOtPaid: 1.5,
    expectedTotal: 11.5,
  },
  {
    name: 'Saturday gross 9.0 (06:30–15:30) → 13.75 total',
    dayDate: SATURDAY,
    grossHours: 9,
    guaranteedPaidHours: 10,
    overtimeStartsAfter: 6.5,
    multiplier: 1.5,
    expectedBasic: 10,
    expectedOtWorked: 2.5,
    expectedOtPaid: 3.75,
    expectedTotal: 13.75,
  },
]

const sundayCase: WeekendCase = {
  name: 'Sunday gross 8, guarantee 8, threshold 0, 2.0x',
  dayDate: SUNDAY,
  grossHours: 8,
  guaranteedPaidHours: 8,
  overtimeStartsAfter: 0,
  multiplier: 2,
  expectedBasic: 8,
  expectedOtWorked: 8,
  expectedOtPaid: 16,
  expectedTotal: 24,
}

for (const testCase of [...saturdayCases, sundayCase]) {
  const breakdown = calculateWeekendPayableBreakdown(
    testCase.grossHours,
    testCase.guaranteedPaidHours,
    testCase.overtimeStartsAfter,
    testCase.multiplier,
  )
  const direct = calculateWeekendGuaranteedPaidHours(
    testCase.grossHours,
    testCase.guaranteedPaidHours,
    testCase.overtimeStartsAfter,
    testCase.multiplier,
  )

  assertEqual(breakdown.basicHours, testCase.expectedBasic, `${testCase.name}: basicHours`)
  assertEqual(
    breakdown.overtimeWorkedHours,
    testCase.expectedOtWorked,
    `${testCase.name}: overtimeWorkedHours`,
  )
  assertEqual(
    breakdown.overtimePaidHours,
    testCase.expectedOtPaid,
    `${testCase.name}: overtimePaidHours`,
  )
  assertEqual(
    roundHoursTwoDecimals(direct),
    testCase.expectedTotal,
    `${testCase.name}: calculateWeekendGuaranteedPaidHours`,
  )

  const isSaturday = testCase.dayDate === SATURDAY
  // Synthetic times that match grossHours for summarize (ignore break for weekend payable).
  const startTime = '06:30'
  const finishMinutes = 6 * 60 + 30 + Math.round(testCase.grossHours * 60)
  const finishHours = Math.floor(finishMinutes / 60) % 24
  const finishMins = finishMinutes % 60
  const finishTime = `${String(finishHours).padStart(2, '0')}:${String(finishMins).padStart(2, '0')}`

  const summary = summarizeTimesheetEntries(
    [
      {
        dayDate: testCase.dayDate,
        // Stored worked minutes may subtract break — weekend payable must use gross start/finish.
        totalMinutes: Math.round((testCase.grossHours - 0.75) * 60),
        breakMinutes: 45,
        overtimeMinutes: 0,
        additionalHours: 0,
        startTime,
        finishTime,
      },
    ],
    {
      overtimeMode: 'Automatic',
      overtimeRules: {
        saturdayOvertimeEnabled: isSaturday,
        saturdayOvertimeAfterHours: testCase.overtimeStartsAfter,
        saturdayOvertimeMultiplier: testCase.multiplier,
        saturdayGuaranteedPaidHours: testCase.guaranteedPaidHours,
        sundayOvertimeEnabled: !isSaturday,
        sundayOvertimeAfterHours: testCase.overtimeStartsAfter,
        sundayOvertimeMultiplier: testCase.multiplier,
        sundayGuaranteedPaidHours: testCase.guaranteedPaidHours,
      },
      paidBreaks: true,
    },
  )

  assertEqual(
    summary.workedHours,
    roundHoursTwoDecimals(testCase.expectedBasic),
    `${testCase.name}: summarize Basic Hours`,
  )
  assertEqual(
    summary.overtimeHours,
    roundHoursTwoDecimals(testCase.expectedOtWorked),
    `${testCase.name}: summarize OT worked hours`,
  )
  assertEqual(
    summary.additionalHours,
    0,
    `${testCase.name}: break must not become Additional Hours`,
  )
  assertEqual(
    summary.totalHours,
    testCase.expectedTotal,
    `${testCase.name}: summarizeTimesheetEntries totalHours`,
  )

  console.log(
    `PASS  ${testCase.name} → Basic ${summary.workedHours} OT ${summary.overtimeHours} Total ${summary.totalHours} (${formatTotalHours(summary.totalHours)})`,
  )
}

// Required regression: 06:30–15:30 → exactly 13.75
{
  const name = 'Regression 06:30–15:30 → 13.75'
  const gross = calculateGrossShiftHours('06:30', '15:30')
  assertEqual(gross, 9, `${name}: grossShiftHours`)

  const breakdown = calculateWeekendPayableBreakdown(gross, 10, 6.5, 1.5)
  assertEqual(breakdown.basicHours, 10, `${name}: basicHours`)
  assertEqual(breakdown.overtimeWorkedHours, 2.5, `${name}: overtimeWorkedHours`)
  assertEqual(breakdown.overtimePaidHours, 3.75, `${name}: overtimePaidHours`)

  const total = calculateWeekendGuaranteedPaidHours(gross, 10, 6.5, 1.5, 0)
  assertEqual(total, 13.75, `${name}: totalPaidHours decimal`)
  assertEqual(roundHoursTwoDecimals(total), 13.75, `${name}: rounded total`)
  assertEqual(formatTotalHours(total), '13.75', `${name}: display`)

  const payable = getEntryPayableDisplayResult(
    {
      dayDate: SATURDAY,
      startTime: '06:30',
      finishTime: '15:30',
      totalMinutes: Math.round(8.25 * 60),
      overtimeMinutes: 0,
      additionalHours: 0,
      breakMinutes: 45,
    },
    {
      overtimeMode: 'Automatic',
      paidBreaks: true,
      overtimeRules: {
        saturdayOvertimeEnabled: true,
        saturdayOvertimeAfterHours: 6.5,
        saturdayOvertimeMultiplier: 1.5,
        saturdayGuaranteedPaidHours: 10,
      },
    },
  )

  assertEqual(payable.basicHours, 10, `${name}: display basic`)
  assertEqual(payable.overtimeDisplayHours, 2.5, `${name}: display OT worked`)
  assertEqual(payable.additionalHours, 0, `${name}: display Add. Hrs`)
  assertEqual(payable.totalPaidHours, 13.75, `${name}: display Total`)

  console.log(`PASS  ${name}`)
}

// Weekend overtime disabled → fall back to standard weekday/company calculation.
{
  const name = 'Weekend OT disabled falls back to standard logic'
  const actualHours = 10
  const overtimeHours = 2
  const multiplier = 1.5
  const expected = 11

  const summary = summarizeTimesheetEntries(
    [
      {
        dayDate: SATURDAY,
        totalMinutes: Math.round(actualHours * 60),
        breakMinutes: 30,
        overtimeMinutes: Math.round(overtimeHours * 60),
        additionalHours: 0,
        startTime: '06:00',
        finishTime: '17:00',
      },
    ],
    {
      overtimeMode: 'Automatic',
      overtimeRules: {
        overtimeAfterHours: 8,
        overtimeMultiplier: multiplier,
        saturdayOvertimeEnabled: false,
        saturdayGuaranteedPaidHours: 10,
        saturdayOvertimeAfterHours: 6.5,
        saturdayOvertimeMultiplier: 1.5,
      },
    },
  )

  assertEqual(summary.totalHours, expected, `${name}: Saturday with OT disabled`)

  const weekday = summarizeTimesheetEntries(
    [
      {
        dayDate: WEDNESDAY,
        totalMinutes: Math.round(actualHours * 60),
        breakMinutes: 30,
        overtimeMinutes: Math.round(overtimeHours * 60),
        additionalHours: 0,
        startTime: '06:00',
        finishTime: '17:00',
      },
    ],
    {
      overtimeMode: 'Automatic',
      overtimeRules: {
        overtimeAfterHours: 8,
        overtimeMultiplier: multiplier,
        saturdayOvertimeEnabled: true,
        saturdayGuaranteedPaidHours: 10,
        saturdayOvertimeAfterHours: 6.5,
        saturdayOvertimeMultiplier: 1.5,
      },
    },
  )

  assertEqual(weekday.totalHours, expected, `${name}: weekday ignores Saturday guarantee`)
  console.log(`PASS  ${name} → ${formatTotalHours(summary.totalHours)}`)
}

// Regression: do not stack actual + guarantee.
{
  const name = 'Guarantee is base only (no actual + guarantee stack)'
  const paid = calculateWeekendGuaranteedPaidHours(6.5, 10, 6.5, 1.5)
  assertEqual(roundHoursTwoDecimals(paid), 10, name)
  if (paid === 16.5) {
    throw new Error(`${name}: incorrectly stacked actual + guarantee`)
  }
  console.log(`PASS  ${name}`)
}

console.log('\nAll weekend guaranteed paid hours scenarios passed.')

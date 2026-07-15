/**
 * Focused verification for Saturday/Sunday guaranteed paid hours overtime rules.
 * Run: npm run verify:weekend-guaranteed-hours
 */
import {
  calculateWeekendGuaranteedPaidHours,
  formatTotalHours,
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
  actualHours: number
  guaranteedPaidHours: number
  overtimeStartsAfter: number
  multiplier: number
  expected: number
}

const saturdayCases: WeekendCase[] = [
  {
    name: 'Saturday 6.5 actual, guarantee 10, threshold 6.5, 1.5x',
    dayDate: SATURDAY,
    actualHours: 6.5,
    guaranteedPaidHours: 10,
    overtimeStartsAfter: 6.5,
    multiplier: 1.5,
    expected: 10,
  },
  {
    name: 'Saturday 7.5 actual, guarantee 10, threshold 6.5, 1.5x',
    dayDate: SATURDAY,
    actualHours: 7.5,
    guaranteedPaidHours: 10,
    overtimeStartsAfter: 6.5,
    multiplier: 1.5,
    expected: 11.5,
  },
  {
    name: 'Saturday 10 actual, guarantee 10, threshold 6.5, 1.5x',
    dayDate: SATURDAY,
    actualHours: 10,
    guaranteedPaidHours: 10,
    overtimeStartsAfter: 6.5,
    multiplier: 1.5,
    expected: 15.25,
  },
]

const sundayCase: WeekendCase = {
  name: 'Sunday 8 actual, guarantee 8, threshold 0, 2.0x',
  dayDate: SUNDAY,
  actualHours: 8,
  guaranteedPaidHours: 8,
  overtimeStartsAfter: 0,
  multiplier: 2,
  // OT = 8 - 0 = 8; paid = 8 + 8 * 2 = 24
  expected: 24,
}

for (const testCase of [...saturdayCases, sundayCase]) {
  const direct = calculateWeekendGuaranteedPaidHours(
    testCase.actualHours,
    testCase.guaranteedPaidHours,
    testCase.overtimeStartsAfter,
    testCase.multiplier,
  )

  assertEqual(
    roundHoursTwoDecimals(direct),
    testCase.expected,
    `${testCase.name}: calculateWeekendGuaranteedPaidHours`,
  )
  assertEqual(
    formatTotalHours(direct),
    testCase.expected.toFixed(2),
    `${testCase.name}: decimal Total Hours display`,
  )

  const isSaturday = testCase.dayDate === SATURDAY
  const summary = summarizeTimesheetEntries(
    [
      {
        dayDate: testCase.dayDate,
        totalMinutes: Math.round(testCase.actualHours * 60),
        breakMinutes: 30,
        overtimeMinutes: Math.max(
          0,
          Math.round((testCase.actualHours - testCase.overtimeStartsAfter) * 60),
        ),
        additionalHours: 0,
        startTime: '06:00',
        finishTime: '18:00',
      },
    ],
    {
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
    },
  )

  assertEqual(
    summary.totalHours,
    testCase.expected,
    `${testCase.name}: summarizeTimesheetEntries totalHours`,
  )

  console.log(`PASS  ${testCase.name} → ${formatTotalHours(summary.totalHours)}`)
}

// Weekend overtime disabled → fall back to standard weekday/company calculation.
{
  const name = 'Weekend OT disabled falls back to standard logic'
  const actualHours = 10
  const overtimeHours = 2
  const multiplier = 1.5
  // standard: normal 8 + OT 2 * 1.5 = 11
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

// Regression: do not add actual worked hours on top of the guarantee.
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

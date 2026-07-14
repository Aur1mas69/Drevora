/**
 * Focused verification for decimal Total Hours (payable hours, two decimal places).
 * Run: npm run verify:timesheet-total-hours
 */
import {
  calculateEntryPaidEquivalentHours,
  formatHours,
  formatTotalHours,
  roundHoursTwoDecimals,
  summarizeTimesheetEntries,
  summarizeTimesheetEntriesFromTotals,
} from '../src/lib/timesheetUtils.ts'

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`)
  }
}

type Case = {
  name: string
  workedMinutes: number
  overtimeMinutes: number
  additionalHours: number
  multiplier: number
  expectedValue: number
  expectedDisplay: string
}

const cases: Case[] = [
  {
    name: '13h worked, 2h 30m OT at 1.5x',
    workedMinutes: 13 * 60,
    overtimeMinutes: 2 * 60 + 30,
    additionalHours: 0,
    multiplier: 1.5,
    expectedValue: 14.25,
    expectedDisplay: '14.25',
  },
  {
    name: '10h worked, 1h OT at 1.5x',
    workedMinutes: 10 * 60,
    overtimeMinutes: 60,
    additionalHours: 0,
    multiplier: 1.5,
    expectedValue: 10.5,
    expectedDisplay: '10.50',
  },
  {
    name: '8h worked, no OT',
    workedMinutes: 8 * 60,
    overtimeMinutes: 0,
    additionalHours: 0,
    multiplier: 1.5,
    expectedValue: 8,
    expectedDisplay: '8.00',
  },
]

for (const testCase of cases) {
  const paidHours = calculateEntryPaidEquivalentHours(
    {
      totalMinutes: testCase.workedMinutes,
      overtimeMinutes: testCase.overtimeMinutes,
      additionalHours: testCase.additionalHours,
    },
    testCase.multiplier,
  )

  assertEqual(
    roundHoursTwoDecimals(paidHours),
    testCase.expectedValue,
    `${testCase.name}: payable hours value`,
  )
  assertEqual(
    formatTotalHours(paidHours),
    testCase.expectedDisplay,
    `${testCase.name}: decimal display`,
  )

  // Must not use Xh Ym for Total Hours.
  const hms = formatHours(paidHours)
  if (formatTotalHours(paidHours) === hms) {
    throw new Error(`${testCase.name}: formatTotalHours must not match formatHours (${hms})`)
  }
  if (testCase.expectedDisplay.includes('h') || testCase.expectedDisplay.includes('m')) {
    throw new Error(`${testCase.name}: expected display must be decimal, not Xh Ym`)
  }

  const drawerSummary = summarizeTimesheetEntries(
    [
      {
        dayDate: '2026-07-13',
        totalMinutes: testCase.workedMinutes,
        breakMinutes: 30,
        overtimeMinutes: testCase.overtimeMinutes,
        additionalHours: testCase.additionalHours,
        startTime: '06:00',
        finishTime: '20:00',
      },
    ],
    {
      overtimeRules: {
        overtimeMultiplier: testCase.multiplier,
      },
    },
  )

  assertEqual(
    drawerSummary.totalHours,
    testCase.expectedValue,
    `${testCase.name}: summarizeTimesheetEntries totalHours`,
  )
  assertEqual(
    formatTotalHours(drawerSummary.totalHours),
    testCase.expectedDisplay,
    `${testCase.name}: drawer/PDF display`,
  )

  // List/table path uses global default multiplier (1.5).
  if (testCase.multiplier === 1.5) {
    const listSummary = summarizeTimesheetEntriesFromTotals({
      workedMinutes: testCase.workedMinutes,
      breakMinutes: 30,
      overtimeMinutes: testCase.overtimeMinutes,
      additionalHours: testCase.additionalHours,
    })

    assertEqual(
      listSummary.totalHours,
      testCase.expectedValue,
      `${testCase.name}: summarizeTimesheetEntriesFromTotals totalHours`,
    )
    assertEqual(
      formatTotalHours(listSummary.totalHours),
      testCase.expectedDisplay,
      `${testCase.name}: table display`,
    )
  }

  // Regression: 1-dp round must not produce 14.3 / 14h 18m.
  if (testCase.expectedValue === 14.25) {
    assertEqual(drawerSummary.totalHours, 14.25, 'must keep 14.25, not 14.3')
    assertEqual(formatTotalHours(14.3), '14.30', 'sanity: 14.3 formats as 14.30 if ever passed')
  }

  console.log(`PASS  ${testCase.name} → ${testCase.expectedDisplay}`)
}

console.log('\nAll decimal Total Hours scenarios passed.')

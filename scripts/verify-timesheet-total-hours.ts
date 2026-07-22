/**
 * Focused verification for decimal Total Hours (payable hours, two decimal places).
 * Run: npm run verify:timesheet-total-hours
 */
import {
  calculateEntryPaidEquivalentHours,
  calculateTotalPayableHours,
  formatHours,
  formatTotalHours,
  getEntryPayableDisplayResult,
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

  // Payroll formatters must show decimal hours, never Xh Ym.
  assertEqual(
    formatHours(paidHours),
    testCase.expectedDisplay,
    `${testCase.name}: formatHours decimal display`,
  )
  if (testCase.expectedDisplay.includes('h') || testCase.expectedDisplay.includes('m')) {
    throw new Error(`${testCase.name}: expected display must be decimal, not Xh Ym`)
  }

  // These cases store gross worked minutes (Basic+OT); Automatic mode applies.
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
      overtimeMode: 'Automatic',
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

  // Automatic weekday must display Basic without OT, and OT without multiplier.
  const otWorked = testCase.overtimeMinutes / 60
  const expectedBasic = Math.max(0, testCase.workedMinutes / 60 - otWorked)
  assertEqual(
    drawerSummary.workedHours,
    roundHoursTwoDecimals(expectedBasic),
    `${testCase.name}: Automatic Basic excludes OT`,
  )
  assertEqual(
    drawerSummary.overtimeHours,
    roundHoursTwoDecimals(otWorked),
    `${testCase.name}: Automatic OT displays worked hours`,
  )

  console.log(`PASS  ${testCase.name} → ${testCase.expectedDisplay}`)
}

// Shared Total formula + Manual/Automatic display cases from business rules.
type SharedCase = {
  name: string
  mode: 'Manual' | 'Automatic'
  basicHours: number
  additionalHours: number
  otWorkedHours: number
  multiplier: number
  expectedTotal: number
}

const sharedCases: SharedCase[] = [
  {
    name: 'Case 1 — Manual OT',
    mode: 'Manual',
    basicHours: 10,
    additionalHours: 0,
    otWorkedHours: 1.5,
    multiplier: 1.5,
    expectedTotal: 12.25,
  },
  {
    name: 'Case 2 — Automatic OT',
    mode: 'Automatic',
    basicHours: 10,
    additionalHours: 0.5,
    otWorkedHours: 1.5,
    multiplier: 1.5,
    expectedTotal: 12.75,
  },
  {
    name: 'Case 3 — Double time',
    mode: 'Manual',
    basicHours: 8,
    additionalHours: 0,
    otWorkedHours: 2,
    multiplier: 2,
    expectedTotal: 12,
  },
  {
    name: 'Case 4 — No OT',
    mode: 'Manual',
    basicHours: 8,
    additionalHours: 0.5,
    otWorkedHours: 0,
    multiplier: 1.5,
    expectedTotal: 8.5,
  },
  {
    name: 'Case 5 — Additional remains 1:1',
    mode: 'Manual',
    basicHours: 10,
    additionalHours: 1,
    otWorkedHours: 1,
    multiplier: 1.5,
    expectedTotal: 12.5,
  },
]

for (const testCase of sharedCases) {
  const sharedTotal = calculateTotalPayableHours(
    testCase.basicHours,
    testCase.additionalHours,
    testCase.otWorkedHours,
    testCase.multiplier,
  )
  assertEqual(
    roundHoursTwoDecimals(sharedTotal),
    testCase.expectedTotal,
    `${testCase.name}: shared Total formula`,
  )

  // Manual stores Basic in total_minutes; Automatic stores gross (Basic+OT).
  const totalMinutes =
    testCase.mode === 'Manual'
      ? Math.round(testCase.basicHours * 60)
      : Math.round((testCase.basicHours + testCase.otWorkedHours) * 60)

  const payable = getEntryPayableDisplayResult(
    {
      dayDate: '2026-07-13',
      startTime: '06:00',
      finishTime: '20:00',
      totalMinutes,
      overtimeMinutes: Math.round(testCase.otWorkedHours * 60),
      additionalHours: testCase.additionalHours,
      breakMinutes: 0,
    },
    {
      overtimeMode: testCase.mode,
      paidBreaks: false,
      overtimeRules: {
        overtimeMultiplier: testCase.multiplier,
      },
    },
  )

  assertEqual(
    roundHoursTwoDecimals(payable.basicHours),
    roundHoursTwoDecimals(testCase.basicHours),
    `${testCase.name}: Basic display`,
  )
  assertEqual(
    roundHoursTwoDecimals(payable.overtimeDisplayHours),
    roundHoursTwoDecimals(testCase.otWorkedHours),
    `${testCase.name}: OT display (worked, not multiplied)`,
  )
  assertEqual(
    roundHoursTwoDecimals(payable.additionalHours),
    roundHoursTwoDecimals(testCase.additionalHours),
    `${testCase.name}: Additional display`,
  )
  assertEqual(
    roundHoursTwoDecimals(payable.totalPaidHours),
    testCase.expectedTotal,
    `${testCase.name}: Total display`,
  )

  console.log(
    `PASS  ${testCase.name} → OT ${payable.overtimeDisplayHours} Total ${payable.totalPaidHours}`,
  )
}

console.log('\nAll decimal Total Hours scenarios passed.')

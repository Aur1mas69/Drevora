/**
 * Start/Finish pair validation and incomplete-pair calculation guards.
 * Run: npx tsx scripts/verify-timesheet-time-pairs.ts
 */
import {
  calculateEntryTotalMinutes,
  calculateGrossShiftHours,
  getEntryPayableDisplayResult,
  isIncompleteTimePair,
  parseTimeToMinutes,
  recalculateEntryInputs,
  validateTimesheetTimePairs,
} from '../src/lib/timesheetUtils.ts'

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`)
  }
}

function assertNull(actual: unknown, message: string) {
  if (actual !== null) {
    throw new Error(`${message} (expected null, got ${String(actual)})`)
  }
}

// Empty must never become midnight.
assertNull(parseTimeToMinutes(null), 'null time')
assertNull(parseTimeToMinutes(''), 'empty string')
assertNull(parseTimeToMinutes('   '), 'whitespace')
assertNull(parseTimeToMinutes('12:60'), 'invalid minute 60')
assertNull(parseTimeToMinutes('24:00'), 'invalid hour 24')
assertEqual(parseTimeToMinutes('06:05'), 6 * 60 + 5, '06:05')
assertEqual(parseTimeToMinutes('23:59'), 23 * 60 + 59, '23:59')

assertEqual(
  calculateEntryTotalMinutes({
    startTime: null,
    finishTime: '05:00',
    breakMinutes: 0,
  }),
  0,
  'Finish-only must not calculate minutes',
)
assertEqual(calculateGrossShiftHours(null, '05:00'), 0, 'Finish-only gross')
assertEqual(calculateGrossShiftHours('20:00', '05:00'), 9, 'overnight gross')

const finishOnly = {
  dayDate: '2026-07-13',
  startTime: null as string | null,
  finishTime: '05:00',
  breakMinutes: 0,
  totalMinutes: 0,
  overtimeMinutes: 0,
  additionalHours: 0,
  dailyComment: '',
}

assertEqual(isIncompleteTimePair(finishOnly), true, 'finish-only incomplete')
assertEqual(
  validateTimesheetTimePairs([finishOnly])?.includes('Enter both start and finish times.'),
  true,
  'validation message',
)

const autoPayable = getEntryPayableDisplayResult(finishOnly, {
  overtimeMode: 'Automatic',
})
assertEqual(autoPayable.totalPaidHours, 0, 'Case 3: Finish-only Total must be 0')
assertEqual(autoPayable.basicHours, 0, 'Case 3: Finish-only Basic must be 0')

const recalc = recalculateEntryInputs(
  [{ ...finishOnly, totalMinutes: 300 }],
  { overtimeMode: 'Automatic' },
)[0]
assertEqual(recalc.totalMinutes, 0, 'recalc clears stale minutes for incomplete pair')
assertEqual(recalc.overtimeMinutes, 0, 'recalc clears OT for incomplete pair')

const emptyDay = {
  ...finishOnly,
  finishTime: null,
}
assertEqual(isIncompleteTimePair(emptyDay), false, 'both empty is not incomplete')
assertNull(validateTimesheetTimePairs([emptyDay]), 'empty day allowed')

const startOnly = { ...finishOnly, startTime: '06:30', finishTime: null }
assertEqual(isIncompleteTimePair(startOnly), true, 'start-only incomplete')
assertEqual(
  getEntryPayableDisplayResult(startOnly, { overtimeMode: 'Automatic' }).totalPaidHours,
  0,
  'Case 2: Start-only Total 0',
)

const complete = {
  ...finishOnly,
  startTime: '06:30',
  finishTime: '15:00',
}
const completeRecalc = recalculateEntryInputs([complete], {
  overtimeMode: 'Automatic',
  overtimeRules: { overtimeAfterHours: 10 },
})[0]
assertEqual(completeRecalc.totalMinutes > 0, true, 'Case 4: complete day calculates')

const overnight = recalculateEntryInputs(
  [
    {
      ...finishOnly,
      startTime: '20:00',
      finishTime: '05:00',
      breakMinutes: 0,
    },
  ],
  { overtimeMode: 'Automatic', overtimeRules: { overtimeAfterHours: 12 } },
)[0]
assertEqual(overnight.totalMinutes, 9 * 60, 'Case 5: overnight 9h')

console.log('PASS  all Start/Finish pair validation cases')

import {
  calculateEntryTotalMinutes,
  formatHours,
  formatHoursFromMinutes,
  recalculateEntryInputs,
  summarizeTimesheetEntries,
  summarizeTimesheetEntriesFromTotals,
} from '../src/lib/timesheetUtils.ts'

const sampleEntry = {
  dayDate: '2026-06-30',
  startTime: '07:00',
  finishTime: '17:00',
  breakMinutes: 45,
  overtimeMinutes: 0,
  additionalHours: 0,
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function runScenario(paidBreaks: boolean) {
  const minutes = calculateEntryTotalMinutes(sampleEntry, { paidBreaks })
  const recalculated = recalculateEntryInputs(
    [{ ...sampleEntry, totalMinutes: 0 }],
    { paidBreaks },
  )[0]
  const summary = summarizeTimesheetEntries([
    {
      ...sampleEntry,
      totalMinutes: minutes,
    },
  ])
  const listSummary = summarizeTimesheetEntriesFromTotals({
    workedMinutes: minutes,
    breakMinutes: sampleEntry.breakMinutes,
    overtimeMinutes: 0,
  })

  return { minutes, recalculated, summary, listSummary }
}

const off = runScenario(false)
const on = runScenario(true)

console.log('paidBreaks OFF')
console.log('  entry minutes:', off.minutes, '=>', formatHoursFromMinutes(off.minutes))
console.log('  edit recalc:', off.recalculated.totalMinutes)
console.log('  drawer summary:', formatHoursFromMinutes(off.summary.workedMinutes))
console.log('  table total:', formatHours(off.listSummary.workedHours))

console.log('paidBreaks ON')
console.log('  entry minutes:', on.minutes, '=>', formatHoursFromMinutes(on.minutes))
console.log('  edit recalc:', on.recalculated.totalMinutes)
console.log('  drawer summary:', formatHoursFromMinutes(on.summary.workedMinutes))
console.log('  table total:', formatHours(on.listSummary.workedHours))

assert(off.minutes === 555, `OFF expected 555 minutes, got ${off.minutes}`)
assert(on.minutes === 600, `ON expected 600 minutes, got ${on.minutes}`)
assert(off.recalculated.totalMinutes === 555, 'Edit OFF recalc mismatch')
assert(on.recalculated.totalMinutes === 600, 'Edit ON recalc mismatch')
assert(off.summary.workedMinutes === 555, 'Summary OFF minutes mismatch')
assert(on.summary.workedMinutes === 600, 'Summary ON minutes mismatch')
assert(formatHoursFromMinutes(555) === '9h 15m', 'Display OFF should be 9h 15m')
assert(formatHoursFromMinutes(600) === '10h', 'Display ON should be 10h')
assert(formatHours(off.listSummary.workedHours) === '9h 15m', 'Table OFF should be 9h 15m')
assert(formatHours(on.listSummary.workedHours) === '10h', 'Table ON should be 10h')

function normalizePaidBreaks(value: boolean | null | undefined): boolean {
  return value === true
}

assert(normalizePaidBreaks(false) === false, 'paid_breaks false -> paidBreaks false')
assert(normalizePaidBreaks(true) === true, 'paid_breaks true -> paidBreaks true')
assert(normalizePaidBreaks(null) === false, 'paid_breaks null -> paidBreaks false')

console.log('\nAll paidBreaks scenarios passed.')

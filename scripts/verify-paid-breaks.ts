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
  const summary = summarizeTimesheetEntries(
    [
      {
        ...sampleEntry,
        totalMinutes: minutes,
      },
    ],
    { paidBreaks },
  )
  const listSummary = summarizeTimesheetEntriesFromTotals(
    {
      workedMinutes: minutes,
      breakMinutes: sampleEntry.breakMinutes,
      overtimeMinutes: 0,
    },
    { paidBreaks },
  )

  return { minutes, recalculated, summary, listSummary }
}

const off = runScenario(false)
const on = runScenario(true)

console.log('paidBreaks OFF')
console.log('  entry minutes:', off.minutes, '=>', formatHoursFromMinutes(off.minutes))
console.log('  edit recalc:', off.recalculated.totalMinutes)
console.log('  drawer Basic:', formatHours(off.summary.workedHours))
console.log('  drawer Add. Hrs:', formatHours(off.summary.additionalHours))
console.log('  table Basic:', formatHours(off.listSummary.workedHours))

console.log('paidBreaks ON')
console.log('  entry minutes:', on.minutes, '=>', formatHoursFromMinutes(on.minutes))
console.log('  edit recalc:', on.recalculated.totalMinutes)
console.log('  drawer Basic:', formatHours(on.summary.workedHours))
console.log('  drawer Add. Hrs:', formatHours(on.summary.additionalHours))
console.log('  table Basic:', formatHours(on.listSummary.workedHours))

// Basic Hours always = shift − break (paid break is Additional Hours, not Basic).
assert(off.minutes === 555, `OFF expected 555 minutes, got ${off.minutes}`)
assert(on.minutes === 555, `ON expected 555 minutes, got ${on.minutes}`)
assert(off.recalculated.totalMinutes === 555, 'Edit OFF recalc mismatch')
assert(on.recalculated.totalMinutes === 555, 'Edit ON recalc mismatch')
assert(off.summary.workedHours === 9.25, 'Summary OFF Basic mismatch')
assert(on.summary.workedHours === 9.25, 'Summary ON Basic mismatch')
assert(off.summary.additionalHours === 0, 'Summary OFF Add. Hrs should be 0')
assert(on.summary.additionalHours === 0.75, 'Summary ON Add. Hrs should be 0.75 paid break')
assert(formatHoursFromMinutes(555) === '9h 15m', 'Break/duration display may stay h/m')
assert(formatHours(off.summary.workedHours) === '9.25', 'Payroll Basic OFF should be 9.25')
assert(formatHours(on.summary.workedHours) === '9.25', 'Payroll Basic ON should be 9.25')
assert(formatHours(on.summary.additionalHours) === '0.75', 'Payroll Add. Hrs ON should be 0.75')
assert(formatHours(off.listSummary.workedHours) === '9.25', 'Table OFF should be 9.25')
assert(formatHours(on.listSummary.workedHours) === '9.25', 'Table ON Basic should be 9.25')

function normalizePaidBreaks(value: boolean | null | undefined): boolean {
  return value === true
}

assert(normalizePaidBreaks(false) === false, 'paid_breaks false -> paidBreaks false')
assert(normalizePaidBreaks(true) === true, 'paid_breaks true -> paidBreaks true')
assert(normalizePaidBreaks(null) === false, 'paid_breaks null -> paidBreaks false')

console.log('\nAll paidBreaks scenarios passed.')

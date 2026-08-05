/**
 * Regression coverage for Timesheet Holiday full-day + half-day leave.
 * Run: npm run verify:timesheet-holiday-half-day
 *
 * H-AM / H-PM are leave portions only — no fixed 12:00 clock boundary.
 */
import { calculateHolidayDayBreakdown } from '../src/lib/holidayRequestUtils.ts'
import {
  applyApprovedHolidaysToEntries,
  applyHolidayDayHours,
  formatHolidayExportLine,
  holidayDayCode,
  holidayHoursToMinutes,
  resolveHolidayPayableHours,
  validateHolidayWorkOverlap,
} from '../src/lib/timesheetHoliday.ts'
import type { TimesheetEntryInput } from '../src/lib/timesheetTypes.ts'
import { getEntryPayableDisplayResult } from '../src/lib/timesheetUtils.ts'

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`)
  }
}

function assertTrue(value: boolean, message: string) {
  if (!value) throw new Error(message)
}

function emptyEntry(dayDate: string): TimesheetEntryInput {
  return {
    dayDate,
    startTime: null,
    finishTime: null,
    breakMinutes: 0,
    totalMinutes: 0,
    overtimeMinutes: 0,
    additionalHours: 0,
    dailyComment: '',
    dayType: 'work',
    holidayMinutes: 0,
  }
}

let passed = 0

function run(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}

// 1. H-AM with early or late work shift is accepted
run('1. H-AM with early or late work shift is accepted', () => {
  assertEqual(resolveHolidayPayableHours(10, 'first_half'), 5, '50% of 10')

  const earlyWork: TimesheetEntryInput = {
    ...applyHolidayDayHours(emptyEntry('2026-08-04'), 10, 'first_half'),
    startTime: '05:00',
    finishTime: '09:00',
    breakMinutes: 15,
    totalMinutes: 4 * 60,
  }
  assertEqual(earlyWork.dayType, 'holiday_am', 'day type')
  assertEqual(holidayDayCode(earlyWork.dayType), 'H-AM', 'label')
  assertEqual(validateHolidayWorkOverlap(earlyWork), null, 'early shift accepted with H-AM')
  assertEqual(earlyWork.breakMinutes, 15, 'break preserved')

  const lateWork: TimesheetEntryInput = {
    ...applyHolidayDayHours(emptyEntry('2026-08-04'), 10, 'first_half'),
    startTime: '14:00',
    finishTime: '22:00',
    breakMinutes: 30,
    totalMinutes: 7.5 * 60,
  }
  assertEqual(validateHolidayWorkOverlap(lateWork), null, 'late shift accepted with H-AM')
  assertEqual(lateWork.startTime, '14:00', 'start preserved')
  assertEqual(lateWork.finishTime, '22:00', 'finish preserved')

  const payable = getEntryPayableDisplayResult(lateWork, { overtimeMode: 'Manual' })
  assertEqual(payable.holidayHours, 5, 'holiday hours')
  assertEqual(payable.workBasicHours, 7.5, 'work basic separate')
  assertEqual(payable.totalPaidHours, 12.5, 'total = holiday + work')
  assertEqual(
    formatHolidayExportLine(lateWork, payable.workBasicHours),
    'Tuesday — H-AM — First half holiday — 5.00 h + Work — 7.50 h',
    'export line',
  )
})

// 2. H-PM with early or late work shift is accepted
run('2. H-PM with early or late work shift is accepted', () => {
  const earlyWork: TimesheetEntryInput = {
    ...applyHolidayDayHours(emptyEntry('2026-08-05'), 10, 'second_half'),
    startTime: '04:30',
    finishTime: '11:00',
    breakMinutes: 0,
    totalMinutes: Math.round(6.5 * 60),
  }
  assertEqual(earlyWork.dayType, 'holiday_pm', 'day type')
  assertEqual(holidayDayCode(earlyWork.dayType), 'H-PM', 'label')
  assertEqual(validateHolidayWorkOverlap(earlyWork), null, 'early shift accepted with H-PM')

  const lateWork: TimesheetEntryInput = {
    ...applyHolidayDayHours(emptyEntry('2026-08-05'), 10, 'second_half'),
    startTime: '15:00',
    finishTime: '23:00',
    totalMinutes: 8 * 60,
  }
  assertEqual(validateHolidayWorkOverlap(lateWork), null, 'late shift accepted with H-PM')

  const applied = applyApprovedHolidaysToEntries(
    [
      {
        ...emptyEntry('2026-08-05'),
        startTime: '06:00',
        finishTime: '14:00',
        breakMinutes: 20,
        totalMinutes: 7.5 * 60,
      },
    ],
    [{ dayDate: '2026-08-05', portion: 'second_half' }],
    10,
  )
  assertEqual(applied.changed, true, 'half-day applied with existing work')
  assertEqual(applied.conflicts.length, 0, 'no midday conflict')
  assertEqual(applied.entries[0].dayType, 'holiday_pm', 'H-PM applied')
  assertEqual(applied.entries[0].startTime, '06:00', 'start not altered')
  assertEqual(applied.entries[0].finishTime, '14:00', 'finish not altered')
  assertEqual(applied.entries[0].breakMinutes, 20, 'break not altered')
  assertEqual(
    formatHolidayExportLine(applied.entries[0]),
    'Wednesday — H-PM — Second half holiday — 5.00 h',
    'export line',
  )
})

// 3. Full-day Holiday with work remains a conflict
run('3. Full-day Holiday with work remains a conflict', () => {
  const worked: TimesheetEntryInput = {
    ...emptyEntry('2026-08-03'),
    startTime: '08:00',
    finishTime: '16:00',
    breakMinutes: 30,
    totalMinutes: 8 * 60,
  }
  const fullConflict = applyApprovedHolidaysToEntries(
    [worked],
    [{ dayDate: '2026-08-03', portion: 'full' }],
    10,
  )
  assertEqual(fullConflict.changed, false, 'full day does not overwrite work')
  assertEqual(fullConflict.conflicts.length, 1, 'conflict flagged for admin')
  assertEqual(fullConflict.entries[0].dayType, 'work', 'work preserved')
  assertEqual(fullConflict.entries[0].startTime, '08:00', 'start unchanged')
  assertEqual(fullConflict.entries[0].finishTime, '16:00', 'finish unchanged')
  assertEqual(fullConflict.entries[0].breakMinutes, 30, 'break unchanged')

  const fullWithClocks = {
    ...applyHolidayDayHours(emptyEntry('2026-08-03'), 10, 'full'),
    startTime: '09:00',
    finishTime: '17:00',
    totalMinutes: 8 * 60,
  }
  assertTrue(
    Boolean(validateHolidayWorkOverlap(fullWithClocks)),
    'full-day + work rejected on save',
  )
})

// 4. Holiday hours never create overtime
run('4. Holiday hours never create overtime', () => {
  const full = applyHolidayDayHours(emptyEntry('2026-08-03'), 10, 'full')
  assertEqual(
    getEntryPayableDisplayResult(full, { overtimeMode: 'Manual' }).overtimeDisplayHours,
    0,
    'full holiday OT = 0',
  )

  const halfWithWorkOt: TimesheetEntryInput = {
    ...applyHolidayDayHours(emptyEntry('2026-08-04'), 10, 'first_half'),
    startTime: '05:00',
    finishTime: '12:00',
    totalMinutes: 5 * 60,
    overtimeMinutes: 60,
  }
  const payable = getEntryPayableDisplayResult(halfWithWorkOt, {
    overtimeMode: 'Manual',
    overtimeRules: { overtimeMultiplier: 1.5 },
  })
  assertEqual(payable.holidayHours, 5, 'holiday hours')
  assertEqual(payable.workBasicHours, 5, 'work basic')
  assertEqual(payable.overtimeDisplayHours, 1, 'OT from work only')
  assertEqual(payable.totalPaidHours, 5 + 5 + 1 * 1.5, 'total = holiday + work + OT×mult')

  assertEqual(resolveHolidayPayableHours(7.5, 'first_half'), 3.75, 'decimal half-day')
  assertEqual(holidayHoursToMinutes(3.75), 225, '3.75h → 225 minutes')
  assertEqual(
    calculateHolidayDayBreakdown(
      '2026-08-03',
      '2026-08-05',
      { holidayCountingMethod: 'calendar_days', holidayWorkingDays: [] },
      'first_half',
      'second_half',
    ).holidayDaysDeducted,
    3,
    'multi-day entitlement all full days',
  )
})

console.log(`\nAll ${passed} holiday half-day regression checks passed.`)

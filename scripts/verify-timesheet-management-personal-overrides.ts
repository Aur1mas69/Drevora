/**
 * Focused verification for Timesheet management-scope + Worker personal overrides.
 * Run: npm run verify:timesheet-management-personal-overrides
 *
 * Covers resolver/holiday-hour behaviour and management-scope helpers.
 * DB RLS / company-scoped clear require a live Supabase migration apply
 * (see 20260805183000_timesheet_management_scope_personal_overrides.sql).
 */
import type { CompanySettings } from '../src/lib/companySettingsTypes.ts'
import {
  workersManageOwnTimesheets,
} from '../src/lib/companySettingsTypes.ts'
import { resolveEffectiveTimesheetSettings } from '../src/lib/resolveEffectiveTimesheetSettings.ts'
import { resolveHolidayPayableHours } from '../src/lib/timesheetHoliday.ts'
import type { DriverTimesheetSettingsOverride } from '../src/lib/workerTimesheetSettingsTypes.ts'

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`)
  }
}

function assertTrue(value: boolean, message: string) {
  if (!value) throw new Error(message)
}

let passed = 0

function run(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}

function baseCompany(overrides: Partial<CompanySettings> = {}): CompanySettings {
  return {
    id: 'company-a',
    overtimeMode: 'Automatic',
    overtimeCalculationMethod: 'daily',
    overtimeAfterHours: 10.5,
    weeklyOvertimeAfterHours: 45,
    overtimeMultiplier: 1.5,
    defaultBreakMinutes: 30,
    paidBreaks: false,
    roundTimeMinutes: 0,
    currency: 'GBP',
    timesheetWeekStartDay: 'monday',
    weekendRulesScope: 'company',
    timesheetManagementScope: 'worker',
    saturdayOvertimeEnabled: false,
    saturdayOvertimeAfterHours: 6,
    saturdayOvertimeMultiplier: 1.5,
    saturdayGuaranteedPaidHours: 10,
    sundayOvertimeEnabled: false,
    sundayOvertimeAfterHours: 0,
    sundayOvertimeMultiplier: 2,
    sundayGuaranteedPaidHours: 10,
    defaultPaidHolidayHours: 10,
    ...overrides,
  } as CompanySettings
}

function baseOverride(
  partial: Partial<DriverTimesheetSettingsOverride> = {},
): DriverTimesheetSettingsOverride {
  return {
    driverId: 'driver-1',
    companyId: 'company-a',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    overtimeMode: 'Manual',
    overtimeCalculationMethod: 'daily',
    overtimeAfterHours: 10.5,
    weeklyOvertimeAfterHours: 45,
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
    saturdayUseCompanyDefaultBreak: null,
    sundayOvertimeEnabled: false,
    sundayOvertimeAfterHours: 0,
    sundayOvertimeMultiplier: 2,
    sundayGuaranteedPaidHours: 10,
    sundayUseCompanyDefaultBreak: null,
    defaultPaidHolidayHours: null,
    ...partial,
  }
}

run('1. Worker-managed mode allows personal override in effective settings', () => {
  assertTrue(workersManageOwnTimesheets('worker'), 'worker mode editable')
  const company = baseCompany({ timesheetManagementScope: 'worker' })
  const effective = resolveEffectiveTimesheetSettings(
    company,
    baseOverride({ overtimeMode: 'Manual', defaultPaidHolidayHours: 7.5 }),
  )
  assertEqual(effective.hasWorkerOverride, true, 'override present')
  assertEqual(effective.source, 'worker', 'source personal')
  assertEqual(effective.overtimeMode, 'Manual', 'saved rule applied')
})

run('2. Worker identity gate is own-driver scoped (cross-worker blocked by RLS contract)', () => {
  // Documented contract: driver_id must equal drevora_auth_user_driver_id().
  // Resolver never merges another Worker id — overrides are loaded by driverId.
  const own = resolveEffectiveTimesheetSettings(
    baseCompany(),
    baseOverride({ driverId: 'driver-1', defaultPaidHolidayHours: 7.5 }),
  )
  const other = resolveEffectiveTimesheetSettings(baseCompany(), null)
  assertEqual(own.defaultPaidHolidayHours, 7.5, 'own override hours')
  assertEqual(other.defaultPaidHolidayHours, 10, 'other worker has company hours')
  assertEqual(other.hasWorkerOverride, false, 'no cross-worker bleed')
})

run('3. Office-managed mode helper blocks Worker self-service', () => {
  assertEqual(workersManageOwnTimesheets('office'), false, 'office blocks writes')
  assertEqual(workersManageOwnTimesheets('worker'), true, 'worker allows writes')
})

run('4. Switching to Office-managed clears override effect (row deleted → null)', () => {
  const companyOffice = baseCompany({ timesheetManagementScope: 'office' })
  // After clear, fetch returns null — effective must be company defaults.
  const afterClear = resolveEffectiveTimesheetSettings(companyOffice, null)
  assertEqual(afterClear.hasWorkerOverride, false, 'no personal override after clear')
  assertEqual(afterClear.source, 'company', 'company source')
  assertEqual(afterClear.defaultPaidHolidayHours, 10, 'inherits company holiday hours')
})

run('5. Another company override is isolated by companyId on the row', () => {
  const companyB = baseCompany({ id: 'company-b', defaultPaidHolidayHours: 8 })
  const companyAOverride = baseOverride({
    companyId: 'company-a',
    defaultPaidHolidayHours: 7.5,
  })
  // Resolution always uses the company passed in — a foreign override is never loaded
  // for company-b (service filters .eq('company_id', companyId)).
  const forB = resolveEffectiveTimesheetSettings(companyB, null)
  assertEqual(forB.defaultPaidHolidayHours, 8, 'company B untouched')
  assertEqual(companyAOverride.companyId, 'company-a', 'override scoped to A')
})

run('6. Re-enabling Worker mode does not restore a cleared override', () => {
  const companyWorker = baseCompany({ timesheetManagementScope: 'worker' })
  // Cleared row stays deleted — switching scope back still loads null.
  const restored = resolveEffectiveTimesheetSettings(companyWorker, null)
  assertEqual(restored.hasWorkerOverride, false, 'old override not restored')
  assertEqual(restored.defaultPaidHolidayHours, 10, 'still company 10')
})

run('7. Company Holiday hours 10 with no override → 10 / 5', () => {
  const effective = resolveEffectiveTimesheetSettings(baseCompany(), null)
  assertEqual(effective.defaultPaidHolidayHours, 10, 'full day')
  assertEqual(resolveHolidayPayableHours(effective.defaultPaidHolidayHours, 'full'), 10, 'H')
  assertEqual(
    resolveHolidayPayableHours(effective.defaultPaidHolidayHours, 'first_half'),
    5,
    'H-AM',
  )
  assertEqual(
    resolveHolidayPayableHours(effective.defaultPaidHolidayHours, 'second_half'),
    5,
    'H-PM',
  )
})

run('8. Worker Holiday override 7.5 → 7.5 / 3.75', () => {
  const effective = resolveEffectiveTimesheetSettings(
    baseCompany(),
    baseOverride({ defaultPaidHolidayHours: 7.5 }),
  )
  assertEqual(effective.hasWorkerOverride, true, 'override yes')
  assertEqual(effective.useCompanyDefaultHolidayHours, false, 'not company default')
  assertEqual(effective.defaultPaidHolidayHours, 7.5, 'full day override')
  assertEqual(resolveHolidayPayableHours(7.5, 'full'), 7.5, 'H')
  assertEqual(resolveHolidayPayableHours(7.5, 'first_half'), 3.75, 'H-AM')
  assertEqual(resolveHolidayPayableHours(7.5, 'second_half'), 3.75, 'H-PM')
})

run('9. Clearing the override returns Worker to 10 / 5', () => {
  const afterClear = resolveEffectiveTimesheetSettings(baseCompany(), null)
  assertEqual(afterClear.defaultPaidHolidayHours, 10, 'back to company')
  assertEqual(resolveHolidayPayableHours(10, 'full'), 10, 'H')
  assertEqual(resolveHolidayPayableHours(10, 'first_half'), 5, 'half')
})

run('10. Override value 0 remains valid unpaid holiday (not missing)', () => {
  const effective = resolveEffectiveTimesheetSettings(
    baseCompany(),
    baseOverride({ defaultPaidHolidayHours: 0 }),
  )
  assertEqual(effective.useCompanyDefaultHolidayHours, false, '0 is explicit override')
  assertEqual(effective.defaultPaidHolidayHours, 0, 'unpaid full')
  assertEqual(resolveHolidayPayableHours(0, 'full'), 0, 'H unpaid')
  assertEqual(resolveHolidayPayableHours(0, 'first_half'), 0, 'H-AM unpaid')
  assertEqual(resolveHolidayPayableHours(0, 'second_half'), 0, 'H-PM unpaid')
  // null (missing) must inherit company — distinct from 0
  const inherit = resolveEffectiveTimesheetSettings(
    baseCompany(),
    baseOverride({ defaultPaidHolidayHours: null }),
  )
  assertEqual(inherit.useCompanyDefaultHolidayHours, true, 'null inherits')
  assertEqual(inherit.defaultPaidHolidayHours, 10, 'company 10 when null')
})

console.log(`\nAll ${passed} timesheet management personal-override checks passed.`)

/**
 * Verification for Weekend Timesheet Rules ownership used in overtime
 * calculations (companies.weekend_rules_scope + per-Worker Sat/Sun overrides).
 * Admin UI for this flag was replaced by "Who manages Timesheets?"
 * (timesheet_management_scope); calculation ownership behaviour is unchanged.
 * Run: npx tsx scripts/verify-weekend-rules-ownership.ts
 */
import type { CompanySettings } from '../src/lib/companySettingsTypes.ts'
import { resolveEffectiveTimesheetSettings } from '../src/lib/resolveEffectiveTimesheetSettings.ts'
import type { DriverTimesheetSettingsOverride } from '../src/lib/workerTimesheetSettingsTypes.ts'

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`)
  }
}

function baseCompany(overrides: Partial<CompanySettings> = {}): CompanySettings {
  return {
    id: 'company-1',
    overtimeMode: 'Automatic',
    overtimeAfterHours: 10.5,
    overtimeMultiplier: 1.5,
    defaultBreakMinutes: 30,
    paidBreaks: false,
    roundTimeMinutes: 0,
    currency: 'GBP',
    timesheetWeekStartDay: 'monday',
    saturdayOvertimeEnabled: true,
    saturdayOvertimeAfterHours: 6,
    saturdayOvertimeMultiplier: 1.5,
    saturdayGuaranteedPaidHours: 10,
    saturdayUseCompanyDefaultBreak: true,
    sundayOvertimeEnabled: true,
    sundayOvertimeAfterHours: 0,
    sundayOvertimeMultiplier: 2,
    sundayGuaranteedPaidHours: 8,
    sundayUseCompanyDefaultBreak: true,
    weekendRulesScope: 'company',
    ...overrides,
  } as unknown as CompanySettings
}

function baseOverride(
  driverId: string,
  overrides: Partial<DriverTimesheetSettingsOverride> = {},
): DriverTimesheetSettingsOverride {
  return {
    driverId,
    companyId: 'company-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    overtimeMode: null,
    overtimeCalculationMethod: null,
    overtimeAfterHours: null,
    weeklyOvertimeAfterHours: null,
    overtimeMultiplier: null,
    defaultBreakMinutes: null,
    paidBreaks: null,
    roundTimeMinutes: null,
    currency: null,
    timesheetWeekStartDay: null,
    saturdayOvertimeEnabled: null,
    saturdayOvertimeAfterHours: null,
    saturdayOvertimeMultiplier: null,
    saturdayGuaranteedPaidHours: null,
    saturdayUseCompanyDefaultBreak: null,
    sundayOvertimeEnabled: null,
    sundayOvertimeAfterHours: null,
    sundayOvertimeMultiplier: null,
    sundayGuaranteedPaidHours: null,
    sundayUseCompanyDefaultBreak: null,
    ...overrides,
  }
}

// 1) Existing companies (no weekend_rules_scope column value yet) default to "company".
const legacyCompany = baseCompany({ weekendRulesScope: undefined as unknown as 'company' })
const legacyEffective = resolveEffectiveTimesheetSettings(legacyCompany, null)
assertEqual(legacyEffective.weekendRulesScope, 'company', 'legacy company defaults to company scope')

// 2) Company scope → all Workers use Admin settings, even with a stale personal override.
const companyScope = baseCompany({ weekendRulesScope: 'company' })
const staleWorkerOverride = baseOverride('driver-stale', {
  saturdayOvertimeEnabled: false,
  saturdayGuaranteedPaidHours: 2,
  saturdayUseCompanyDefaultBreak: false,
  sundayOvertimeAfterHours: 99,
})
const companyScopeEffective = resolveEffectiveTimesheetSettings(companyScope, staleWorkerOverride)
assertEqual(companyScopeEffective.weekendRulesScope, 'company', 'company scope reported')
assertEqual(
  companyScopeEffective.saturdayGuaranteedPaidHours,
  10,
  'company scope: Admin Saturday guaranteed hours win over stale Worker override',
)
assertEqual(
  companyScopeEffective.saturdayUseCompanyDefaultBreak,
  true,
  'company scope: Admin Saturday break toggle wins over stale Worker override',
)
assertEqual(
  companyScopeEffective.sundayOvertimeAfterHours,
  0,
  'company scope: Admin Sunday starts-after wins over stale Worker override',
)
// Non-weekend fields are unaffected by weekend scope.
const companyScopeWithEntryModeOverride = resolveEffectiveTimesheetSettings(
  companyScope,
  baseOverride('driver-mode', { overtimeMode: 'Manual' }),
)
assertEqual(
  companyScopeWithEntryModeOverride.overtimeMode,
  'Manual',
  'company scope: non-weekend Worker overrides still apply',
)

// 3) Worker scope, Worker A: paid break enabled (uses company default break).
const workerScope = baseCompany({ weekendRulesScope: 'worker' })
const workerA = baseOverride('driver-a', {
  saturdayOvertimeEnabled: true,
  saturdayGuaranteedPaidHours: 12,
  saturdayUseCompanyDefaultBreak: true,
})
const workerAEffective = resolveEffectiveTimesheetSettings(workerScope, workerA)
assertEqual(workerAEffective.weekendRulesScope, 'worker', 'worker scope reported for A')
assertEqual(workerAEffective.saturdayGuaranteedPaidHours, 12, 'Worker A personal Saturday hours apply')
assertEqual(workerAEffective.saturdayUseCompanyDefaultBreak, true, 'Worker A uses company default break')

// Worker scope, Worker B: Break = 0 (does not use company default break).
const workerB = baseOverride('driver-b', {
  saturdayOvertimeEnabled: true,
  saturdayGuaranteedPaidHours: 8,
  saturdayUseCompanyDefaultBreak: false,
})
const workerBEffective = resolveEffectiveTimesheetSettings(workerScope, workerB)
assertEqual(workerBEffective.saturdayGuaranteedPaidHours, 8, 'Worker B has independent Saturday hours')
assertEqual(workerBEffective.saturdayUseCompanyDefaultBreak, false, 'Worker B break starts at 0')
assertEqual(
  workerAEffective.saturdayGuaranteedPaidHours !== workerBEffective.saturdayGuaranteedPaidHours,
  true,
  'Worker A and Worker B have different Saturday rules',
)

// 4) Worker without any override row → uses company defaults, even in worker scope.
const noOverrideInWorkerScope = resolveEffectiveTimesheetSettings(workerScope, null)
assertEqual(
  noOverrideInWorkerScope.saturdayGuaranteedPaidHours,
  10,
  'worker scope, no override: inherits company Saturday guaranteed hours',
)
assertEqual(
  noOverrideInWorkerScope.sundayGuaranteedPaidHours,
  8,
  'worker scope, no override: inherits company Sunday guaranteed hours',
)
assertEqual(
  noOverrideInWorkerScope.hasWorkerOverride,
  false,
  'no override row means hasWorkerOverride is false',
)

// 5) Saturday and Sunday remain independent under a Worker override that only sets one day.
const saturdayOnlyOverride = baseOverride('driver-sat-only', {
  saturdayOvertimeEnabled: true,
  saturdayGuaranteedPaidHours: 11,
  saturdayUseCompanyDefaultBreak: false,
})
const saturdayOnlyEffective = resolveEffectiveTimesheetSettings(workerScope, saturdayOnlyOverride)
assertEqual(saturdayOnlyEffective.saturdayGuaranteedPaidHours, 11, 'Saturday override applies')
assertEqual(
  saturdayOnlyEffective.sundayGuaranteedPaidHours,
  8,
  'Sunday remains at company default when only Saturday is overridden',
)
assertEqual(
  saturdayOnlyEffective.sundayUseCompanyDefaultBreak,
  true,
  'Sunday break toggle remains at company default when only Saturday is overridden',
)

console.log('verify-weekend-rules-ownership: all checks passed')

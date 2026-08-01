/**
 * Verifies company-wide Timesheet management scope helper.
 * Run: npx tsx scripts/verify-timesheet-management-scope.ts
 */
import {
  DEFAULT_TIMESHEET_MANAGEMENT_SCOPE,
  workersManageOwnTimesheets,
} from '../src/lib/companySettingsTypes'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

assert(
  DEFAULT_TIMESHEET_MANAGEMENT_SCOPE === 'worker',
  'default management scope must preserve Worker self-service',
)
assert(
  workersManageOwnTimesheets('worker') === true,
  'worker scope allows Worker self-service',
)
assert(
  workersManageOwnTimesheets('office') === false,
  'office scope blocks Worker self-service',
)
assert(
  workersManageOwnTimesheets(undefined) === true,
  'missing scope defaults to Worker self-service',
)
assert(
  workersManageOwnTimesheets(null) === true,
  'null scope defaults to Worker self-service',
)

console.log('verify-timesheet-management-scope: all checks passed')

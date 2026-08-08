/**
 * Focused verification: Worker form job roles vs Office system access roles.
 * Run: npm run verify:worker-job-roles
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  WORKER_INVITATION_MEMBERSHIP_ROLE,
  WORKER_JOB_ROLES,
  WORKER_LEGACY_OPERATIONAL_ROLES,
  buildInviteWorkerRequestBody,
  isWorkerJobRole,
  isWorkerLegacyOperationalRole,
  resolveWorkerFormRoleOptions,
  validateWorkerInvitationProfile,
} from '../src/lib/workerInvitation.ts'

let passed = 0

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`)
  }
}

function assertTrue(value: boolean, message: string) {
  if (!value) throw new Error(message)
}

function run(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}

const formModalSource = readFileSync(
  resolve('src/components/workers/WorkerFormModal.tsx'),
  'utf8',
)
const driversPageSource = readFileSync(resolve('src/pages/DriversPage.tsx'), 'utf8')
const inviteFnSource = readFileSync(
  resolve('supabase/functions/invite-worker/index.ts'),
  'utf8',
)

run('1. Add Worker dropdown options are exactly the six job roles', () => {
  assertEqual(WORKER_JOB_ROLES.length, 6, 'six job roles')
  assertEqual(
    WORKER_JOB_ROLES.join('|'),
    'Driver|Mechanic|Warehouse|Yardman|Cleaner|Other',
    'job role order/values',
  )
  const addOptions = resolveWorkerFormRoleOptions(null)
  assertEqual(addOptions.join('|'), WORKER_JOB_ROLES.join('|'), 'new Worker options')
  for (const legacy of WORKER_LEGACY_OPERATIONAL_ROLES) {
    assertTrue(!addOptions.includes(legacy), `${legacy} not offered for new Worker`)
  }
})

run('2. Office/system roles are not selectable for a new Worker', () => {
  for (const role of [
    'Admin',
    'Transport Manager',
    'Office Staff',
    'Supervisor',
    'Planner',
  ] as const) {
    assertTrue(isWorkerLegacyOperationalRole(role), `${role} marked legacy`)
    assertTrue(!isWorkerJobRole(role), `${role} not a job role`)
    const validated = validateWorkerInvitationProfile({
      email: 'worker@example.com',
      firstName: 'Sam',
      lastName: 'Worker',
      operationalRole: role,
    })
    assertEqual(validated.ok, false, `${role} rejected by invite profile validation`)
  }
})

run('3. Worker creation cannot grant Office access through this field', () => {
  assertEqual(
    WORKER_INVITATION_MEMBERSHIP_ROLE,
    'Driver',
    'membership always Driver',
  )
  assertTrue(
    inviteFnSource.includes("const WORKER_MEMBERSHIP_ROLE = 'Driver'"),
    'Edge Function membership constant is Driver',
  )
  assertTrue(
    inviteFnSource.includes('membershipRole: WORKER_MEMBERSHIP_ROLE'),
    'Edge Function returns membership as Driver',
  )

  const body = buildInviteWorkerRequestBody({
    email: 'worker@example.com',
    firstName: 'Sam',
    lastName: 'Worker',
    role: 'Mechanic',
    status: 'Off Duty',
  })
  assertEqual(body.operationalRole, 'Mechanic', 'job role maps to operationalRole')
  assertTrue(
    !Object.prototype.hasOwnProperty.call(body, 'membershipRole'),
    'client never sends membershipRole',
  )
  assertTrue(
    !Object.prototype.hasOwnProperty.call(body, 'companyId'),
    'client never sends companyId',
  )
})

run('4. Existing legacy role data is kept readable and not silently overwritten', () => {
  const editOptions = resolveWorkerFormRoleOptions('Admin')
  assertTrue(editOptions.includes('Admin'), 'legacy Admin remains selectable while editing')
  assertEqual(
    editOptions.filter((role) => role === 'Admin').length,
    1,
    'legacy value not duplicated',
  )
  for (const job of WORKER_JOB_ROLES) {
    assertTrue(editOptions.includes(job), `${job} still offered alongside legacy`)
  }

  const unchanged = resolveWorkerFormRoleOptions('Transport Manager')
  assertTrue(
    unchanged.includes('Transport Manager'),
    'legacy Transport Manager kept for edit',
  )
  assertEqual(
    resolveWorkerFormRoleOptions('Driver').join('|'),
    WORKER_JOB_ROLES.join('|'),
    'current job role does not inject extras',
  )
})

run('5. Normal Worker invitation flow wiring remains unchanged', () => {
  assertTrue(
    driversPageSource.includes('inviteWorker(form)'),
    'Add Worker still calls inviteWorker',
  )
  assertTrue(
    driversPageSource.includes('resolveWorkerFormRoleOptions(editingDriver?.role)'),
    'form options use resolveWorkerFormRoleOptions',
  )
  assertTrue(
    formModalSource.includes('Job role only. System access is managed separately.'),
    'helper text present',
  )
  assertTrue(
    formModalSource.includes('Role <span className="text-rose-500">*</span>'),
    'Role label preserved',
  )
})

console.log(`\nverify-worker-job-roles: ${passed} checks passed`)

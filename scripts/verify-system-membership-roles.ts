/**
 * Focused verification for MVP system membership roles.
 * Run: npm run verify:system-membership-roles
 *
 * Proves Office access gates treat Admin/Manager/Office/Supervisor equally,
 * Driver is excluded, stored names stay distinct, and Worker job roles
 * remain separate from company_members.role.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ALL_OFFICE_MEMBERSHIP_ROLES,
  LEGACY_OFFICE_MEMBERSHIP_ROLES,
  OFFICE_MEMBERSHIP_ROLES,
  SYSTEM_MEMBERSHIP_ROLES,
  WORKER_MEMBERSHIP_ROLE,
  isCanonicalOfficeMembershipRole,
  isOfficeMembershipRole,
  isSystemMembershipRole,
  isWorkerMembershipRole,
} from '../src/lib/membershipRoles.ts'
import {
  WORKER_INVITATION_MEMBERSHIP_ROLE,
  WORKER_JOB_ROLES,
  isWorkerJobRole,
  resolveWorkerFormRoleOptions,
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

const membershipSource = readFileSync(
  resolve('src/lib/membershipRoles.ts'),
  'utf8',
)
const migrationSource = readFileSync(
  resolve('supabase/migrations/20260808140000_mvp_system_membership_roles.sql'),
  'utf8',
)
const inviteFnSource = readFileSync(
  resolve('supabase/functions/invite-worker/index.ts'),
  'utf8',
)

run('1. Canonical MVP Office roles are Admin/Manager/Office/Supervisor', () => {
  assertEqual(
    OFFICE_MEMBERSHIP_ROLES.join('|'),
    'Admin|Manager|Office|Supervisor',
    'canonical Office roles',
  )
  assertEqual(
    SYSTEM_MEMBERSHIP_ROLES.join('|'),
    'Admin|Manager|Office|Supervisor|Driver',
    'full MVP system roles',
  )
  assertTrue(isSystemMembershipRole('Manager'), 'Manager is system role')
  assertTrue(isSystemMembershipRole('Office'), 'Office is system role')
  assertTrue(isCanonicalOfficeMembershipRole('Office'), 'Office is canonical Office')
  assertTrue(!isCanonicalOfficeMembershipRole('Office Staff'), 'Office Staff not canonical')
})

run('2. Admin, Manager, Office and Supervisor all pass Office access gates', () => {
  for (const role of OFFICE_MEMBERSHIP_ROLES) {
    assertTrue(isOfficeMembershipRole(role), `${role} has Office access`)
    assertTrue(!isWorkerMembershipRole(role), `${role} is not Worker`)
  }
})

run('3. Driver does not pass Office access gates', () => {
  assertEqual(WORKER_MEMBERSHIP_ROLE, 'Driver', 'Worker membership is Driver')
  assertTrue(isWorkerMembershipRole('Driver'), 'Driver is Worker')
  assertTrue(!isOfficeMembershipRole('Driver'), 'Driver excluded from Office')
  assertTrue(isSystemMembershipRole('Driver'), 'Driver remains a system role')
})

run('4. Stored role names remain distinct (not collapsed to Admin)', () => {
  assertTrue(
    OFFICE_MEMBERSHIP_ROLES.includes('Manager'),
    'Manager stored as Manager',
  )
  assertTrue(OFFICE_MEMBERSHIP_ROLES.includes('Office'), 'Office stored as Office')
  assertTrue(
    OFFICE_MEMBERSHIP_ROLES.includes('Supervisor'),
    'Supervisor stored as Supervisor',
  )
  assertTrue(
    !membershipSource.includes("Manager = 'Admin'") &&
      !membershipSource.includes('normalizeToAdmin') &&
      !membershipSource.includes('mapRoleToAdmin'),
    'no Admin collapse helpers',
  )
  assertTrue(
    migrationSource.includes("'Manager'") && migrationSource.includes("'Office'"),
    'migration allows Manager and Office on company_members.role',
  )
  assertTrue(
    migrationSource.includes('never collapsed to Admin') ||
      migrationSource.includes('stored distinctly'),
    'migration documents distinct storage',
  )
})

run('5. Legacy Office membership roles still pass gates (not rewritten)', () => {
  assertEqual(
    LEGACY_OFFICE_MEMBERSHIP_ROLES.join('|'),
    'Transport Manager|Planner|Office Staff',
    'legacy Office roles',
  )
  for (const role of LEGACY_OFFICE_MEMBERSHIP_ROLES) {
    assertTrue(isOfficeMembershipRole(role), `${role} still has Office access`)
    assertTrue(!isCanonicalOfficeMembershipRole(role), `${role} not offered as new`)
  }
  assertEqual(ALL_OFFICE_MEMBERSHIP_ROLES.length, 7, 'canonical + legacy Office set')
})

run('6. Worker job roles remain unaffected and separate from system roles', () => {
  assertEqual(
    WORKER_JOB_ROLES.join('|'),
    'Driver|Mechanic|Warehouse|Yardman|Cleaner|Other',
    'job roles unchanged',
  )
  assertTrue(isWorkerJobRole('Mechanic'), 'Mechanic is job role')
  assertTrue(!isOfficeMembershipRole('Mechanic'), 'Mechanic is not system Office')
  assertTrue(!isSystemMembershipRole('Mechanic'), 'Mechanic is not system membership')
  assertEqual(
    resolveWorkerFormRoleOptions(null).join('|'),
    WORKER_JOB_ROLES.join('|'),
    'Add Worker form still job-roles only',
  )
  assertTrue(
    !WORKER_JOB_ROLES.includes('Manager' as never),
    'Manager is not a Worker job role',
  )
  assertTrue(
    !WORKER_JOB_ROLES.includes('Office' as never),
    'Office is not a Worker job role',
  )
})

run('7. Worker invitation still creates membership role Driver', () => {
  assertEqual(
    WORKER_INVITATION_MEMBERSHIP_ROLE,
    'Driver',
    'invite membership role constant',
  )
  assertTrue(
    inviteFnSource.includes("const WORKER_MEMBERSHIP_ROLE = 'Driver'"),
    'Edge Function membership is Driver',
  )
  assertTrue(
    inviteFnSource.includes('membershipRole: WORKER_MEMBERSHIP_ROLE'),
    'Edge Function returns Driver membership',
  )
  assertTrue(
    inviteFnSource.includes("'Manager'") && inviteFnSource.includes("'Office'"),
    'invite Edge Function accepts Manager/Office actors',
  )
})

console.log(`\nverify-system-membership-roles: ${passed} checks passed`)

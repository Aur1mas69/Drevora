/**
 * Focused verification for Office-user invitation contracts.
 * Run: npm run verify:office-invitation
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  OFFICE_INVITATION_TARGET_ROLES,
  OFFICE_INVITE_AUTH_USER_LOCK_NAMESPACE,
  USER_ALREADY_LINKED_TO_ANOTHER_COMPANY,
  buildInviteOfficeUserRequestBody,
  buildOfficeInviteEmailDeliveryOutcome,
  buildOfficeInviteRedirectTo,
  classifyInvitedOfficeAuthMembership,
  decideNewOfficeAuthUserCleanup,
  OFFICE_INVITE_FORBIDDEN_AUTH_EXISTENCE_PROBES,
  inviteOfficeUserRequestContainsForbiddenIds,
  isOfficeInvitationTargetRole,
  mapOfficeInviteDatabaseError,
  officeInviteCreatesAuthUserVia,
  officeInviteCreatesDriversRow,
  officeInviteExistingAuthLookupCreatesUsers,
  validateOfficeInvitationInput,
  workerInviteMembershipRoleUnchanged,
} from '../src/lib/officeInvitation.ts'
import {
  WORKER_INVITATION_MEMBERSHIP_ROLE,
  WORKER_JOB_ROLES,
} from '../src/lib/workerInvitation.ts'
import {
  OFFICE_MEMBERSHIP_ROLES,
  WORKER_MEMBERSHIP_ROLE,
  isOfficeMembershipRole,
  isWorkerMembershipRole,
} from '../src/lib/membershipRoles.ts'

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

const edgeSource = readFileSync(
  resolve('supabase/functions/invite-office-user/index.ts'),
  'utf8',
)
const migrationSource = readFileSync(
  resolve(
    'supabase/migrations/20260808150000_office_user_invitation_foundation.sql',
  ),
  'utf8',
)
const workerInviteSource = readFileSync(
  resolve('supabase/functions/invite-worker/index.ts'),
  'utf8',
)

run('1. Only Admin/Manager/Office/Supervisor target roles accepted', () => {
  assertEqual(
    OFFICE_INVITATION_TARGET_ROLES.join('|'),
    'Admin|Manager|Office|Supervisor',
    'canonical target roles',
  )
  for (const role of OFFICE_MEMBERSHIP_ROLES) {
    assertTrue(isOfficeInvitationTargetRole(role), `${role} accepted`)
    const ok = validateOfficeInvitationInput({
      email: 'office@example.com',
      role,
    })
    assertTrue(ok.ok, `${role} validates`)
    if (ok.ok) assertEqual(ok.role, role, `${role} preserved`)
  }
})

run('2. Driver rejected as Office invite target', () => {
  assertTrue(!isOfficeInvitationTargetRole('Driver'), 'Driver not a target role')
  const rejected = validateOfficeInvitationInput({
    email: 'worker@example.com',
    role: 'Driver',
  })
  assertEqual(rejected.ok, false, 'Driver rejected')
  if (!rejected.ok) {
    assertEqual(rejected.code, 'invalid_role', 'invalid_role code')
  }
  assertTrue(
    edgeSource.includes("role === 'Driver'") ||
      edgeSource.includes('!TARGET_OFFICE_ROLES.has(role)'),
    'Edge Function rejects Driver',
  )
  assertTrue(
    migrationSource.includes("v_role = 'Driver'") ||
      migrationSource.includes("not in ('Admin', 'Manager', 'Office', 'Supervisor')"),
    'RPC rejects non-Office target roles',
  )
})

run('3. Company resolved server-side; browser IDs forbidden', () => {
  const body = buildInviteOfficeUserRequestBody({
    email: 'Office@Example.com',
    role: 'Manager',
    fullName: 'Sam Office',
    companyId: 'should-not-appear',
    userId: 'should-not-appear',
  })
  assertEqual(
    inviteOfficeUserRequestContainsForbiddenIds(body),
    false,
    'request body has no company/user ids',
  )
  assertEqual(body.email, 'office@example.com', 'email normalised')
  assertEqual(body.role, 'Manager', 'role kept distinct')
  assertTrue(
    edgeSource.includes('ignored_client_ids') ||
      edgeSource.includes('body.companyId != null'),
    'Edge ignores client company/user ids',
  )
  assertTrue(
    edgeSource.includes('.eq(\'user_id\', user.id)') &&
      edgeSource.includes('company_id'),
    'Edge resolves company from caller membership',
  )
})

run('4. No drivers row created by Office invite', () => {
  assertEqual(officeInviteCreatesDriversRow(), false, 'contract false')
  assertTrue(
    !migrationSource.toLowerCase().includes('insert into public.drivers'),
    'RPC does not insert drivers',
  )
  assertTrue(
    !edgeSource.includes("from('drivers')") &&
      !edgeSource.includes('driverId') &&
      !edgeSource.includes('driver_id'),
    'Edge Function does not touch drivers',
  )
  assertTrue(
    migrationSource.includes('company_members') &&
      migrationSource.includes('drevora_link_invited_office_user'),
    'RPC links company_members only',
  )
})

run('5. Duplicate membership / cross-company conflicts protected', () => {
  assertEqual(
    classifyInvitedOfficeAuthMembership({
      targetCompanyId: 'co-1',
      activeMembershipCompanyIds: ['co-2'],
    }),
    'other_company',
    'other company classified',
  )
  assertEqual(
    classifyInvitedOfficeAuthMembership({
      targetCompanyId: 'co-1',
      activeMembershipCompanyIds: ['co-1'],
    }),
    'same_company',
    'same company classified',
  )
  assertEqual(
    mapOfficeInviteDatabaseError('USER_ALREADY_LINKED_TO_ANOTHER_COMPANY').code,
    USER_ALREADY_LINKED_TO_ANOTHER_COMPANY,
    'cross-company mapped',
  )
  assertEqual(
    mapOfficeInviteDatabaseError('OFFICE_INVITE_EMAIL_CONFLICT').code,
    'email_conflict',
    'email conflict mapped',
  )
  assertEqual(
    mapOfficeInviteDatabaseError('OFFICE_INVITE_DUPLICATE_MEMBERSHIP').code,
    'duplicate_membership',
    'duplicate mapped',
  )
  assertEqual(
    OFFICE_INVITE_AUTH_USER_LOCK_NAMESPACE,
    872014552,
    'distinct advisory lock namespace',
  )
  assertTrue(
    migrationSource.includes('872014552') &&
      migrationSource.includes('USER_ALREADY_LINKED_TO_ANOTHER_COMPANY'),
    'RPC uses lock + cross-company reject',
  )
})

run('6. Stored target role remains distinct (not collapsed to Admin)', () => {
  for (const role of ['Admin', 'Manager', 'Office', 'Supervisor'] as const) {
    const ok = validateOfficeInvitationInput({
      email: 'a@b.co',
      role,
    })
    assertTrue(ok.ok && ok.role === role, `${role} stays ${role}`)
  }
  assertTrue(
    migrationSource.includes("role = v_role") ||
      migrationSource.includes('v_role,'),
    'RPC stores invited role value',
  )
  assertTrue(
    !migrationSource.includes("role = 'Admin'") ||
      migrationSource.includes("'Admin', 'Manager', 'Office', 'Supervisor'"),
    'no forced Admin assignment for all invites',
  )
  assertTrue(isOfficeMembershipRole('Manager'), 'Manager has Office access')
  assertTrue(isOfficeMembershipRole('Office'), 'Office has Office access')
  assertTrue(!isWorkerMembershipRole('Manager'), 'Manager is not Worker')
})

run('7. Worker invitation flow remains unchanged', () => {
  assertEqual(
    workerInviteMembershipRoleUnchanged(),
    'Driver',
    'Worker membership still Driver',
  )
  assertEqual(
    WORKER_INVITATION_MEMBERSHIP_ROLE,
    WORKER_MEMBERSHIP_ROLE,
    'shared Worker constant',
  )
  assertEqual(
    WORKER_JOB_ROLES.join('|'),
    'Driver|Mechanic|Warehouse|Yardman|Cleaner|Other',
    'Worker job roles untouched',
  )
  assertTrue(
    workerInviteSource.includes("const WORKER_MEMBERSHIP_ROLE = 'Driver'"),
    'invite-worker still Driver membership',
  )
  assertTrue(
    workerInviteSource.includes('drevora_link_invited_worker'),
    'invite-worker still uses Worker link RPC',
  )
  assertTrue(
    !workerInviteSource.includes('drevora_link_invited_office_user'),
    'invite-worker does not call Office link RPC',
  )
})

run('8. Auth flow: no generateLink probe; listUsers read-only; invite once; recovery after link', () => {
  assertEqual(officeInviteExistingAuthLookupCreatesUsers(), false, 'lookup never creates')
  assertEqual(
    officeInviteCreatesAuthUserVia(),
    'inviteUserByEmail',
    'new users via inviteUserByEmail only',
  )
  assertEqual(
    buildOfficeInviteRedirectTo(null),
    'https://app.drevora.app/reset-password',
    'default redirect',
  )

  for (const probe of OFFICE_INVITE_FORBIDDEN_AUTH_EXISTENCE_PROBES) {
    assertTrue(!edgeSource.includes(probe), `no ${probe} in Edge Function`)
  }
  assertTrue(!edgeSource.includes('generateLink'), 'no generateLink identifier')
  assertTrue(
    !edgeSource.includes("type: 'recovery'") &&
      !edgeSource.includes('type: "recovery"') &&
      !edgeSource.includes('.generateLink('),
    'no recovery-link generation as Auth probe',
  )
  assertTrue(!edgeSource.includes('.otp('), 'no OTP existence probe')
  assertTrue(
    !edgeSource.includes('admin.auth.admin.createUser') &&
      !edgeSource.includes('.createUser('),
    'existing-user path must not create Auth users',
  )

  assertTrue(
    edgeSource.includes('resolveExistingAuthUserIdByListUsers') &&
      edgeSource.includes('admin.auth.admin.listUsers') &&
      edgeSource.includes('page') &&
      edgeSource.includes('perPage'),
    'existing Auth resolved via paginated listUsers',
  )
  assertTrue(
    edgeSource.includes('.toLowerCase()') &&
      edgeSource.includes('row.email'),
    'listUsers match is case-insensitive email',
  )
  assertTrue(
    edgeSource.includes('inviteUserByEmail'),
    'new Auth user invited via inviteUserByEmail',
  )
  assertEqual(
    (edgeSource.match(/\.inviteUserByEmail\(/g) ?? []).length,
    1,
    'inviteUserByEmail called once in source',
  )
  assertTrue(
    edgeSource.includes('resetPasswordForEmail'),
    'existing users get resetPasswordForEmail after link',
  )
  assertTrue(
    edgeSource.includes('createdAuthUserThisRequest = true') &&
      edgeSource.includes('createdAuthUserThisRequest = false'),
    'tracks whether this request created the Auth user',
  )

  const newUser = buildOfficeInviteEmailDeliveryOutcome({
    alreadyExisted: false,
    linkCode: 'linked',
    inviteApiAccepted: true,
    recoveryEmailAccepted: null,
  })
  assertEqual(newUser.inviteSent, true, 'new user invite counted')
  const existing = buildOfficeInviteEmailDeliveryOutcome({
    alreadyExisted: true,
    linkCode: 'linked',
    inviteApiAccepted: false,
    recoveryEmailAccepted: true,
  })
  assertEqual(existing.inviteSent, true, 'existing user recovery counted')
})

run('9. Auth orphan cleanup only for users created this request', () => {
  assertEqual(
    decideNewOfficeAuthUserCleanup({
      createdAuthUserThisRequest: false,
      membershipQueryOk: true,
      activeMembershipCount: 0,
      anyMembershipCount: 0,
    }).action,
    'skip',
    'pre-existing Auth skipped',
  )
  assertEqual(
    decideNewOfficeAuthUserCleanup({
      createdAuthUserThisRequest: true,
      membershipQueryOk: true,
      activeMembershipCount: 0,
      anyMembershipCount: 0,
    }).action,
    'delete',
    'orphan after link failure deleted',
  )
  assertEqual(
    decideNewOfficeAuthUserCleanup({
      createdAuthUserThisRequest: true,
      membershipQueryOk: true,
      activeMembershipCount: 1,
      anyMembershipCount: 1,
    }).action,
    'skip',
    'linked membership skipped',
  )
})

run('10. Audit table/RPC present for Office invites', () => {
  assertTrue(
    migrationSource.includes('office_user_invitation_events'),
    'audit table created',
  )
  assertTrue(
    migrationSource.includes('invited_email') &&
      migrationSource.includes('invited_role') &&
      migrationSource.includes('actor_user_id') &&
      migrationSource.includes('created_at') &&
      migrationSource.includes('status'),
    'audit columns present',
  )
  assertTrue(
    edgeSource.includes('drevora_insert_office_user_invitation_event') ||
      edgeSource.includes('recordInviteEvent'),
    'Edge records failure audits',
  )
})

console.log(`\nverify-office-invitation: ${passed} checks passed`)

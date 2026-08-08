/**
 * Focused verification for Settings → Office Users UI wiring.
 * Run: npm run verify:office-users-ui
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  OFFICE_USERS_INVITE_ROLE_OPTIONS,
  USER_ALREADY_LINKED_TO_ANOTHER_COMPANY,
  buildInviteOfficeUserRequestBody,
  filterOfficeUsersListRows,
  formatInviteOfficeUserUserMessage,
  inviteOfficeUserRequestContainsForbiddenIds,
  isOfficeUsersListMembershipRole,
  mapOfficeUserListRpcRow,
  validateOfficeInvitationInput,
  workerInviteMembershipRoleUnchanged,
} from '../src/lib/officeInvitation.ts'
import {
  WORKER_INVITATION_MEMBERSHIP_ROLE,
  WORKER_JOB_ROLES,
} from '../src/lib/workerInvitation.ts'
import { OFFICE_MEMBERSHIP_ROLES } from '../src/lib/membershipRoles.ts'

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

const settingsPageSource = readFileSync(resolve('src/pages/SettingsPage.tsx'), 'utf8')
const panelSource = readFileSync(
  resolve('src/components/settings/OfficeUsersPanel.tsx'),
  'utf8',
)
const modalSource = readFileSync(
  resolve('src/components/settings/InviteOfficeUserModal.tsx'),
  'utf8',
)
const serviceSource = readFileSync(
  resolve('src/services/officeInvitationService.ts'),
  'utf8',
)
const migrationSource = readFileSync(
  resolve('supabase/migrations/20260808160000_list_office_users.sql'),
  'utf8',
)
const workerInviteSource = readFileSync(
  resolve('supabase/functions/invite-worker/index.ts'),
  'utf8',
)
const typesSource = readFileSync(
  resolve('src/lib/companySettingsTypes.ts'),
  'utf8',
)

run('1. Office Users list excludes Driver memberships', () => {
  assertTrue(!isOfficeUsersListMembershipRole('Driver'), 'Driver excluded')
  assertTrue(isOfficeUsersListMembershipRole('Admin'), 'Admin included')
  assertTrue(isOfficeUsersListMembershipRole('Manager'), 'Manager included')
  assertEqual(
    filterOfficeUsersListRows([
      { role: 'Admin' },
      { role: 'Driver' },
      { role: 'Office' },
      { role: 'Supervisor' },
    ]).map((row) => row.role).join('|'),
    'Admin|Office|Supervisor',
    'filter drops Driver',
  )
  assertEqual(
    mapOfficeUserListRpcRow({
      membership_id: 'm1',
      role: 'Driver',
      email: 'w@example.com',
      is_active: true,
    }),
    null,
    'RPC mapper rejects Driver',
  )
  assertTrue(
    migrationSource.includes("role is distinct from 'Driver'") &&
      migrationSource.includes('drevora_is_office_membership_role'),
    'SQL excludes Driver',
  )
  assertTrue(
    panelSource.includes('filterOfficeUsersListRows'),
    'panel filters list rows',
  )
})

run('2. Invite role options are exactly Admin/Manager/Office/Supervisor', () => {
  assertEqual(
    OFFICE_USERS_INVITE_ROLE_OPTIONS.join('|'),
    OFFICE_MEMBERSHIP_ROLES.join('|'),
    'matches canonical Office roles',
  )
  assertEqual(
    OFFICE_USERS_INVITE_ROLE_OPTIONS.join('|'),
    'Admin|Manager|Office|Supervisor',
    'exact options',
  )
  assertTrue(
    modalSource.includes('OFFICE_USERS_INVITE_ROLE_OPTIONS'),
    'modal uses invite role options',
  )
  assertTrue(!modalSource.includes("'Driver'"), 'modal source has no Driver option literal')
})

run('3. Driver cannot be selected / validated', () => {
  const rejected = validateOfficeInvitationInput({
    email: 'office@example.com',
    role: 'Driver',
  })
  assertEqual(rejected.ok, false, 'Driver rejected')
  if (!rejected.ok) {
    assertEqual(rejected.code, 'invalid_role', 'invalid_role')
  }
})

run('4. Request payload contains only email / role / fullName', () => {
  const body = buildInviteOfficeUserRequestBody({
    email: 'Office@Example.com',
    role: 'Manager',
    fullName: 'Sam Office',
    companyId: 'should-not-appear',
    userId: 'should-not-appear',
  })
  assertEqual(
    Object.keys(body).sort().join('|'),
    'email|fullName|role',
    'only allowed keys',
  )
  assertEqual(body.email, 'office@example.com', 'email normalised')
  assertEqual(body.role, 'Manager', 'role kept')
  assertEqual(body.fullName, 'Sam Office', 'fullName kept')
})

run('5. No companyId / userId / membershipId / authUserId sent', () => {
  const body = buildInviteOfficeUserRequestBody({
    email: 'a@b.co',
    role: 'Office',
    fullName: 'A',
  })
  assertEqual(
    inviteOfficeUserRequestContainsForbiddenIds({
      ...body,
      companyId: 'x',
    }),
    true,
    'detects companyId',
  )
  assertEqual(
    inviteOfficeUserRequestContainsForbiddenIds({
      ...body,
      authUserId: 'x',
    }),
    true,
    'detects authUserId',
  )
  assertEqual(inviteOfficeUserRequestContainsForbiddenIds(body), false, 'clean body ok')
  assertTrue(
    serviceSource.includes("functions.invoke('invite-office-user'") &&
      serviceSource.includes('inviteOfficeUserRequestContainsForbiddenIds') &&
      serviceSource.includes("allowedKeys = new Set(['email', 'role', 'fullName'])"),
    'service enforces payload keys',
  )
})

run('6. Successful invite refreshes list', () => {
  assertTrue(
    panelSource.includes('onInvited') &&
      panelSource.includes('void loadUsers()') &&
      panelSource.includes('setInviteOpen(false)'),
    'panel closes modal and reloads list',
  )
  assertTrue(
    panelSource.includes('listOfficeUsers') &&
      serviceSource.includes("rpc('drevora_list_office_users')"),
    'list uses list RPC',
  )
})

run('7. Structured errors are mapped safely', () => {
  assertEqual(
    formatInviteOfficeUserUserMessage(USER_ALREADY_LINKED_TO_ANOTHER_COMPANY),
    'This email already belongs to an active account in another company.',
    'cross-company',
  )
  assertEqual(
    formatInviteOfficeUserUserMessage('email_conflict'),
    'This email is already used by a Worker or non-Office account in your company.',
    'email conflict',
  )
  assertEqual(
    formatInviteOfficeUserUserMessage('invalid_role'),
    'Select Admin, Manager, Office, or Supervisor.',
    'invalid role',
  )
  assertEqual(
    formatInviteOfficeUserUserMessage('unauthenticated'),
    'Your session has expired. Sign in again and try inviting the Office user.',
    'unauthenticated',
  )
  assertEqual(
    formatInviteOfficeUserUserMessage('forbidden'),
    'Only Office roles can invite Office users.',
    'forbidden',
  )
  assertEqual(
    formatInviteOfficeUserUserMessage('server_failure', 'relation "x" does not exist SQLSTATE'),
    'Unable to invite Office user right now. Please try again.',
    'DB noise stripped',
  )
  assertTrue(
    modalSource.includes('isOfficeInvitationServiceError') &&
      serviceSource.includes('formatInviteOfficeUserUserMessage'),
    'UI uses safe error mapping',
  )
})

run('8. Settings route/tab wires Office Users panel', () => {
  assertTrue(
    typesSource.includes("'office-users'") &&
      typesSource.includes("label: 'Office Users'"),
    'tab registered',
  )
  assertTrue(
    settingsPageSource.includes('OfficeUsersPanel') &&
      settingsPageSource.includes("activeTab === 'office-users'"),
    'SettingsPage renders panel',
  )
  assertTrue(
    settingsPageSource.includes("tab === 'office-users'") ||
      settingsPageSource.includes("tab === 'consumables' || tab === 'office-users'"),
    'deep link supported',
  )
})

run('9. Worker invitation flow remains unchanged', () => {
  assertEqual(
    workerInviteMembershipRoleUnchanged(),
    WORKER_INVITATION_MEMBERSHIP_ROLE,
    'Worker membership still Driver',
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
    !workerInviteSource.includes('drevora_list_office_users') &&
      !workerInviteSource.includes('drevora_link_invited_office_user'),
    'invite-worker unrelated to Office Users UI',
  )
  assertTrue(
    !panelSource.includes('invite-worker') &&
      !modalSource.includes('invite-worker'),
    'Office UI does not call Worker invite',
  )
})

console.log(`\nverify-office-users-ui: ${passed} checks passed`)

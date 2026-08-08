/**
 * Focused verification: Office WRITE paths require AAL2 at the correct boundary.
 * Run: npm run verify:office-mfa-write-aal2
 *
 * Proves static hardening without calling Supabase / applying SQL.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let passed = 0

function assertTrue(value: boolean, message: string) {
  if (!value) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`)
  }
}

function run(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}

function read(relative: string): string {
  return readFileSync(resolve(relative), 'utf8').replace(/\r\n/g, '\n')
}

/** Slice one CREATE OR REPLACE function body (through closing $$;). */
function functionBody(sql: string, createMarker: string): string {
  const start = sql.indexOf(createMarker)
  assertTrue(start >= 0, `missing ${createMarker}`)
  const close = '\n' + '$' + '$;'
  const end = sql.indexOf(close, start)
  assertTrue(end > start, `unclosed ${createMarker}`)
  return sql.slice(start, end + close.length)
}

/** AAL2 appears before office-role check inside an Office-only RPC. */
function assertAal2BeforeOfficeRole(body: string, label: string) {
  const aal = body.indexOf('perform public.drevora_auth_require_aal2();')
  const office = body.indexOf('drevora_auth_user_has_office_role_for_company')
  assertTrue(aal > 0, `${label}: AAL2 present`)
  assertTrue(office > 0, `${label}: office role present`)
  assertTrue(aal < office, `${label}: AAL2 before office role`)
}

const shared = read('supabase/functions/_shared/requireAal2.ts')
const inviteWorker = read('supabase/functions/invite-worker/index.ts')
const inviteOffice = read('supabase/functions/invite-office-user/index.ts')
const changeEmail = read('supabase/functions/change-worker-login-email/index.ts')
const accessEmail = read('supabase/functions/send-worker-access-email/index.ts')
const deleteAccount = read('supabase/functions/delete-account/index.ts')
const migration = read(
  'supabase/migrations/20260808190000_office_write_require_aal2.sql',
)
const officeMfa = read('src/lib/officeMfa.ts')
const appRouter = read('src/router/AppRouter.tsx')

const OFFICE_ONLY_DIRECT_WRITES = [
  'drevora_office_soft_delete_tyre_check',
  'drevora_office_apply_tyre_check_correction',
  'drevora_archive_driver',
  'drevora_restore_driver',
  'drevora_archive_vehicle',
  'drevora_restore_vehicle',
  'drevora_approve_timesheets',
  'drevora_reject_timesheets',
  'drevora_clean_timesheets_current_view',
  'drevora_clear_company_driver_timesheet_settings',
  'drevora_save_worker_core_document',
  'drevora_review_worker_document_submission',
  'drevora_update_worker_document_submission_metadata',
  'drevora_soft_delete_worker_document_submission',
  'drevora_restore_worker_document_submission',
] as const

run('1. Shared helper rejects non-aal2 and never reads body.aal', () => {
  assertTrue(shared.includes('MFA_REQUIRED'), 'MFA_REQUIRED code')
  assertTrue(shared.includes('getAuthenticatorAssuranceLevel'), 'uses MFA assurance API')
  assertTrue(shared.includes('readAalClaimFromAccessToken'), 'reads JWT claim')
  assertTrue(shared.includes('httpStatus: 403'), 'HTTP 403')
  assertTrue(!shared.includes('body.aal'), 'no body.aal')
  assertTrue(!shared.includes('body?.aal'), 'no body?.aal')
  assertTrue(
    shared.includes('Never trust an `aal` value from the request body') ||
      shared.includes('Never trust an aal value from the request body') ||
      shared.includes('never from request body'),
    'documents no body trust',
  )
})

run('2. invite-worker requires AAL2 after Office role (Edge boundary)', () => {
  assertTrue(
    inviteWorker.includes("from '../_shared/requireAal2.ts'"),
    'imports shared helper',
  )
  assertTrue(inviteWorker.includes('requireCallerAal2(userClient, token)'), 'checks caller')
  assertTrue(inviteWorker.includes('code: aal2.code'), 'returns MFA_REQUIRED code')
  const officeIdx = inviteWorker.indexOf('Only Office roles can invite Workers.')
  const aalIdx = inviteWorker.indexOf('requireCallerAal2(userClient, token)')
  assertTrue(officeIdx > 0 && aalIdx > officeIdx, 'AAL2 after Office role gate')
})

run('3. invite-office-user requires AAL2 after Office role', () => {
  assertTrue(inviteOffice.includes('requireCallerAal2(userClient, token)'), 'checks caller')
  const officeIdx = inviteOffice.indexOf('Only Office roles can invite Office users.')
  const aalIdx = inviteOffice.indexOf('requireCallerAal2(userClient, token)')
  assertTrue(officeIdx > 0 && aalIdx > officeIdx, 'AAL2 after Office role gate')
})

run('4. change-worker-login-email requires AAL2 after Office role', () => {
  assertTrue(changeEmail.includes('requireCallerAal2(userClient, token)'), 'checks caller')
  const officeIdx = changeEmail.indexOf('Only Office roles can change Worker login email.')
  const aalIdx = changeEmail.indexOf('requireCallerAal2(userClient, token)')
  assertTrue(officeIdx > 0 && aalIdx > officeIdx, 'AAL2 after Office role gate')
})

run('5. send-worker-access-email requires AAL2 after Office role', () => {
  assertTrue(accessEmail.includes('requireCallerAal2(userClient, token)'), 'checks caller')
  const officeIdx = accessEmail.indexOf(
    'Only Office roles can send Worker account access email.',
  )
  const aalIdx = accessEmail.indexOf('requireCallerAal2(userClient, token)')
  assertTrue(officeIdx > 0 && aalIdx > officeIdx, 'AAL2 after Office role gate')
})

run('6. delete-account requires AAL2 for Office branch only (Driver stays AAL1)', () => {
  assertTrue(deleteAccount.includes('requireCallerAal2(userClient, token)'), 'checks caller')
  const officeBranch = deleteAccount.indexOf('const hasOfficeRole = memberships.some')
  const aalIdx = deleteAccount.indexOf('requireCallerAal2(userClient, token)')
  const workerHandler = deleteAccount.indexOf('handleWorkerRequest({')
  assertTrue(officeBranch > 0 && aalIdx > officeBranch, 'AAL2 inside Office branch area')
  assertTrue(workerHandler > aalIdx, 'Worker handler still present after Office AAL2')
  const afterOfficeIf = deleteAccount.slice(aalIdx)
  assertTrue(
    afterOfficeIf.includes('handleWorkerRequest({'),
    'Worker request path remains',
  )
})

run('7. Migration helpers use auth.jwt aal (end-user only)', () => {
  assertTrue(migration.includes('drevora_auth_require_aal2()'), 'require helper')
  assertTrue(migration.includes('drevora_auth_session_is_aal2'), 'session is aal2 helper')
  assertTrue(migration.includes("auth.jwt() ->> 'aal'"), 'uses auth.jwt aal claim')
  assertTrue(
    migration.includes('not for service_role') ||
      migration.includes('not for service_role Edge'),
    'documents service_role exclusion',
  )
})

run('8. Every Office-only direct WRITE has AAL2 before office-role check', () => {
  for (const name of OFFICE_ONLY_DIRECT_WRITES) {
    const body = functionBody(
      migration,
      `create or replace function public.${name}`,
    )
    assertAal2BeforeOfficeRole(body, name)
  }
})

run('9. Office AAL1 is rejected conceptually (require raises MFA_REQUIRED unless aal2)', () => {
  const helper = functionBody(
    migration,
    'create or replace function public.drevora_auth_require_aal2()',
  )
  assertTrue(helper.includes('MFA_REQUIRED'), 'safe MFA_REQUIRED error')
  assertTrue(helper.includes('drevora_auth_session_is_aal2()'), 'delegates to session helper')
  const session = functionBody(
    migration,
    'create or replace function public.drevora_auth_session_is_aal2()',
  )
  assertTrue(session.includes("= 'aal2'"), 'aal1/empty fails equality')
  assertTrue(!session.includes('service_role'), 'session helper is JWT-only')
})

run('10. drevora_set_vehicle_tyre_layout: Worker AAL1-compatible; Office requires AAL2', () => {
  const body = functionBody(
    migration,
    'create or replace function public.drevora_set_vehicle_tyre_layout',
  )
  const workerAuth = body.indexOf('v_worker_id := public.drevora_auth_user_driver_id();')
  const officeAalComment = body.indexOf(
    'Office/Admin path requires AAL2; Worker path above remains AAL1-compatible.',
  )
  const aal = body.indexOf('perform public.drevora_auth_require_aal2();')
  assertTrue(workerAuth > 0, 'Worker auth path present')
  assertTrue(officeAalComment > workerAuth, 'AAL2 comment after Worker attempt')
  assertTrue(aal > workerAuth, 'AAL2 after Worker attempt')
  // Must NOT require AAL2 immediately after auth.uid() (would block Workers)
  const uidBlockEnd = body.indexOf('end if;', body.indexOf('auth.uid() is null'))
  assertTrue(uidBlockEnd > 0, 'uid check present')
  const betweenUidAndWorker = body.slice(uidBlockEnd, workerAuth)
  assertTrue(
    !betweenUidAndWorker.includes('drevora_auth_require_aal2'),
    'no blanket AAL2 before Worker path',
  )
})

run('11. Service-role Edge RPC paths do not call auth.jwt AAL helpers', () => {
  for (const [name, source] of [
    ['invite-worker', inviteWorker],
    ['invite-office-user', inviteOffice],
    ['change-worker-login-email', changeEmail],
    ['send-worker-access-email', accessEmail],
  ] as const) {
    assertTrue(
      !source.includes("rpc('drevora_auth_require_aal2'") &&
        !source.includes('rpc("drevora_auth_require_aal2"'),
      `${name} does not RPC aal2 helper under service_role`,
    )
    assertTrue(
      source.includes('createAdminClient') || source.includes('privilegedKey'),
      `${name} still uses privileged/service path after boundary check`,
    )
  }
})

run('12. No browser-controlled aal field in hardened Edge Function request bodies', () => {
  for (const [name, source] of [
    ['invite-worker', inviteWorker],
    ['invite-office-user', inviteOffice],
    ['change-worker-login-email', changeEmail],
    ['send-worker-access-email', accessEmail],
    ['delete-account', deleteAccount],
  ] as const) {
    assertTrue(!source.includes('body.aal'), `${name}: no body.aal`)
    assertTrue(!source.includes("body['aal']"), `${name}: no body['aal']`)
  }
})

run('13. JWT claim reader treats aal1 as blocked (shared helper contract)', () => {
  assertTrue(shared.includes("!== 'aal2'"), 'rejects non-aal2')
  assertEqual(shared.includes('requireCallerAal2'), true, 'exports requireCallerAal2')
})

run('14. Office read / MFA routing remains AAL1-compatible (client gate)', () => {
  assertTrue(officeMfa.includes("'enroll'") || officeMfa.includes('"enroll"'), 'enroll state')
  assertTrue(
    officeMfa.includes("'challenge'") || officeMfa.includes('"challenge"'),
    'challenge state',
  )
  assertTrue(officeMfa.includes("'allow'") || officeMfa.includes('"allow"'), 'allow state')
  assertTrue(
    appRouter.includes('RequireOfficeMfa') || appRouter.includes('useOfficeMfaGate'),
    'router wires MFA gate',
  )
  // This migration must not AAL2-gate Office list/read RPCs used during login routing.
  assertTrue(
    !migration.includes('create or replace function public.drevora_list_office_users'),
    'does not redefine list_office_users',
  )
})

run('15. Listed direct writes are not invoked via Edge service_role', () => {
  const edgeIndexPaths = [
    'supabase/functions/invite-worker/index.ts',
    'supabase/functions/invite-office-user/index.ts',
    'supabase/functions/change-worker-login-email/index.ts',
    'supabase/functions/send-worker-access-email/index.ts',
    'supabase/functions/delete-account/index.ts',
  ]
  const edgeSources = edgeIndexPaths.map((p) => read(p)).join('\n')
  for (const name of [
    ...OFFICE_ONLY_DIRECT_WRITES,
    'drevora_set_vehicle_tyre_layout',
  ]) {
    assertTrue(
      !edgeSources.includes(`rpc('${name}'`) && !edgeSources.includes(`rpc("${name}"`),
      `${name} not called from hardened Edge Functions`,
    )
  }
})

/** Slice one CREATE POLICY body through its closing ); before next statement. */
function policyBody(sql: string, policyName: string): string {
  const start = sql.indexOf(`create policy ${policyName}`)
  assertTrue(start >= 0, `missing policy ${policyName}`)
  const after = sql.slice(start)
  const endMatch = after.match(/\n\s*\);\s*\n/)
  assertTrue(!!endMatch && endMatch.index != null, `unclosed policy ${policyName}`)
  return after.slice(0, endMatch!.index! + endMatch![0].length)
}

function assertOfficeWritePolicyHasRoleAndAal2(policyName: string) {
  const body = policyBody(migration, policyName)
  assertTrue(
    body.includes('drevora_auth_user_has_office_role_for_company'),
    `${policyName}: keeps office role`,
  )
  assertTrue(
    body.includes('drevora_auth_session_is_aal2()'),
    `${policyName}: requires AAL2`,
  )
  // Must not be AAL2-only without role
  const aalIdx = body.indexOf('drevora_auth_session_is_aal2()')
  const roleIdx = body.indexOf('drevora_auth_user_has_office_role_for_company')
  assertTrue(roleIdx >= 0 && aalIdx >= 0, `${policyName}: role+AAL2 present`)
}

const OFFICE_WRITE_RLS_POLICIES = [
  'documents_office_insert',
  'documents_office_update',
  'companies_office_update',
  'drivers_office_insert',
  'drivers_office_update',
  'vehicles_office_insert',
  'vehicles_office_update',
  'timesheets_office_insert',
  'timesheets_office_update',
  'timesheets_office_delete',
  'timesheet_entries_office_insert',
  'timesheet_entries_office_update',
  'timesheet_entries_office_delete',
  'holiday_requests_office_insert',
  'holiday_requests_office_update',
  'holiday_requests_office_delete',
  'vehicle_checks_office_insert',
  'vehicle_checks_office_update',
  'vehicle_checks_office_delete',
  'vehicle_check_items_office_insert',
  'vehicle_check_items_office_update',
  'vehicle_check_items_office_delete',
  'driver_reports_office_insert',
  'driver_reports_office_update',
  'driver_reports_office_delete',
  'contacts_office_insert',
  'contacts_office_update',
  'contacts_office_delete',
  'consumables_office_insert',
  'consumables_office_update',
  'consumables_office_delete',
  'dashboard_notes_office_insert',
  'dashboard_notes_office_update',
  'dashboard_notes_office_delete',
  'vehicle_availability_office_insert',
  'vehicle_availability_office_update',
  'vehicle_availability_office_delete',
  'worker_compliance_office_insert',
  'worker_compliance_office_update',
  'worker_compliance_office_delete',
  'vehicle_compliance_office_insert',
  'vehicle_compliance_office_update',
  'vehicle_compliance_office_delete',
  'vehicle_check_templates_office_insert',
  'vehicle_check_templates_office_update',
  'vehicle_check_templates_office_delete',
  'vehicle_check_template_items_office_insert',
  'vehicle_check_template_items_office_update',
  'vehicle_check_template_items_office_delete',
] as const

run('16. documents_office_update requires office role AND AAL2 (soft-delete/restore path)', () => {
  assertOfficeWritePolicyHasRoleAndAal2('documents_office_update')
  assertOfficeWritePolicyHasRoleAndAal2('documents_office_insert')
  const update = policyBody(migration, 'documents_office_update')
  // Conceptual: AAL1 fails session_is_aal2; AAL2 passes subject to office role
  assertTrue(update.includes('drevora_auth_session_is_aal2()'), 'AAL1 rejected via helper')
  assertTrue(
    update.includes('drevora_auth_user_has_office_role_for_company'),
    'AAL2 alone insufficient',
  )
})

run('17. Every Office WRITE RLS policy requires role + AAL2', () => {
  for (const name of OFFICE_WRITE_RLS_POLICIES) {
    assertOfficeWritePolicyHasRoleAndAal2(name)
  }
})

run('18. Worker/Driver document and shared write policies remain AAL1 (not redefined)', () => {
  assertTrue(
    !migration.includes('create policy documents_worker_'),
    'does not redefine documents worker policies',
  )
  assertTrue(
    !migration.includes('create policy timesheets_worker_'),
    'does not redefine timesheets worker policies',
  )
  assertTrue(
    !migration.includes('create policy holiday_requests_worker_'),
    'does not redefine holiday worker policies',
  )
  assertTrue(
    !migration.includes('create policy consumables_worker_'),
    'does not redefine consumables worker policies',
  )
  assertTrue(
    !migration.includes('create policy vehicle_checks_worker_'),
    'does not redefine vehicle_checks worker policies',
  )
  assertTrue(
    !migration.includes('create policy driver_reports_worker_'),
    'does not redefine driver_reports worker policies',
  )
  // Soft-delete/restore still go through documentsService direct UPDATE
  const docsService = read('src/services/documentsService.ts')
  assertTrue(docsService.includes('softDeleteDocument'), 'softDeleteDocument exists')
  assertTrue(docsService.includes('restoreDocument'), 'restoreDocument exists')
  assertTrue(
    docsService.includes(".from('documents')") && docsService.includes('.update('),
    'documents soft-delete/restore remain direct table UPDATE (RLS-gated)',
  )
})

run('19. Office SELECT / company_members read paths remain without AAL2 in this migration', () => {
  assertTrue(
    !migration.includes('create policy documents_office_select'),
    'does not redefine documents_office_select',
  )
  assertTrue(
    !migration.includes('create policy company_members_'),
    'does not redefine company_members policies',
  )
  assertTrue(
    !migration.includes('create policy companies_office_select') &&
      !migration.includes('create policy companies_member_select'),
    'does not redefine companies SELECT',
  )
})

run('20. notification_reads intentionally left AAL1 (low-impact read-state UX)', () => {
  assertTrue(
    !migration.includes('create policy notification_reads_'),
    'does not AAL2-gate notification_reads',
  )
})

console.log(`\nAll ${passed} checks passed.`)

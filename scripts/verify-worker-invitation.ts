/**
 * Focused verification for Admin Worker invitation contracts.
 * Run: npm run verify:worker-invitation
 *
 * Covers shared validation / redirect / error mapping used by invite-worker.
 * Live Auth invite + RPC require applying migration
 * 20260805210000_worker_invitation_foundation.sql and deploying the Edge Function.
 */
import {
  DREVORA_PRODUCTION_APP_ORIGIN,
  USER_ALREADY_LINKED_TO_ANOTHER_COMPANY,
  WORKER_INVITATION_MEMBERSHIP_ROLE,
  WORKER_INVITATION_OFFICE_ROLES,
  WORKER_INVITE_AUTH_USER_LOCK_NAMESPACE,
  buildAuthCleanupMetadata,
  buildInviteEmailDeliveryOutcome,
  buildWorkerInviteRedirectTo,
  classifyInvitedAuthMembership,
  decideNewAuthUserCleanup,
  describeWorkerInviteRpcConcurrencyGuard,
  doesGenerateLinkSendEmail,
  isAuthDeleteNotFoundError,
  isWorkerInvitationOfficeRole,
  isWorkerOperationalRole,
  mapInviteDatabaseError,
  normalizeInvitationEmail,
  resolveWorkerInviteAppOrigin,
  sanitizeAuthCleanupError,
  validateWorkerInvitationProfile,
} from '../src/lib/workerInvitation.ts'
import {
  generateWorkerCodeCandidate,
  isValidWorkerCode,
} from '../src/lib/workerCodeUtils.ts'
import { countActiveWorkersForPlan } from '../src/lib/workerPlanSlots.ts'
import { buildWorkerAllowanceSnapshot } from '../src/lib/workerAllowance.ts'
import type { Driver } from '../src/services/driversService.ts'
import type { CompanyPlanRecord } from '../src/services/companyPlanService.ts'

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

run('1. Email is normalised to lowercase and validated', () => {
  assertEqual(normalizeInvitationEmail('  Sam.Worker@Example.COM '), 'sam.worker@example.com', 'trim+lower')
  assertEqual(normalizeInvitationEmail('not-an-email'), null, 'reject invalid')
  assertEqual(normalizeInvitationEmail(''), null, 'reject empty')
})

run('2. Membership role for invited Workers is always Driver', () => {
  assertEqual(WORKER_INVITATION_MEMBERSHIP_ROLE, 'Driver', 'membership role')
})

run('3. Only Office roles may invite', () => {
  assertEqual(WORKER_INVITATION_OFFICE_ROLES.length, 5, 'five office roles')
  assertTrue(isWorkerInvitationOfficeRole('Admin'), 'Admin allowed')
  assertTrue(isWorkerInvitationOfficeRole('Transport Manager'), 'TM allowed')
  assertTrue(!isWorkerInvitationOfficeRole('Driver'), 'Driver blocked')
  assertTrue(!isWorkerInvitationOfficeRole('Warehouse'), 'Warehouse blocked')
})

run('4. Operational role validation matches drivers.role vocabulary', () => {
  assertTrue(isWorkerOperationalRole('Driver'), 'Driver ok')
  assertTrue(isWorkerOperationalRole('Yardman'), 'Yardman ok')
  assertTrue(!isWorkerOperationalRole('Superuser'), 'unknown rejected')
})

run('5. Profile validation requires email, names, and role', () => {
  const badEmail = validateWorkerInvitationProfile({
    email: 'bad',
    firstName: 'A',
    lastName: 'B',
    operationalRole: 'Driver',
  })
  assertEqual(badEmail.ok, false, 'bad email fails')

  const ok = validateWorkerInvitationProfile({
    email: 'Worker@Example.com',
    firstName: ' Sam ',
    lastName: ' Worker ',
    operationalRole: 'Mechanic',
    status: 'Off Duty',
  })
  assertTrue(ok.ok, 'valid profile')
  if (ok.ok) {
    assertEqual(ok.email, 'worker@example.com', 'email normalised')
    assertEqual(ok.firstName, 'Sam', 'first trimmed')
    assertEqual(ok.lastName, 'Worker', 'last trimmed')
    assertEqual(ok.operationalRole, 'Mechanic', 'operational role kept')
  }
})

run('6. Invite redirect uses production origin by default (never localhost)', () => {
  assertEqual(
    resolveWorkerInviteAppOrigin(null),
    DREVORA_PRODUCTION_APP_ORIGIN,
    'default origin',
  )
  assertEqual(
    buildWorkerInviteRedirectTo(undefined),
    'https://app.drevora.app/reset-password',
    'default redirect',
  )
  assertEqual(
    buildWorkerInviteRedirectTo('https://staging.example.com/'),
    'https://staging.example.com/reset-password',
    'env origin without trailing slash double',
  )
  assertTrue(
    !buildWorkerInviteRedirectTo(null).includes('localhost'),
    'no localhost default',
  )
})

run('7. Database exception mapping returns structured codes', () => {
  assertEqual(
    mapInviteDatabaseError('WORKER_PLAN_LIMIT_REACHED').code,
    'plan_limit_reached',
    'limit',
  )
  assertEqual(
    mapInviteDatabaseError('SUBSCRIPTION_PLAN_EXPIRED').code,
    'subscription_expired',
    'expired',
  )
  assertEqual(
    mapInviteDatabaseError('INVITE_DUPLICATE_WORKER').code,
    'duplicate_worker',
    'duplicate',
  )
  assertEqual(
    mapInviteDatabaseError('INVITE_FORBIDDEN').httpStatus,
    403,
    'forbidden status',
  )
})

run('8. Worker code generator still produces valid 5-char codes', () => {
  for (let i = 0; i < 20; i += 1) {
    const code = generateWorkerCodeCandidate()
    assertTrue(isValidWorkerCode(code), `candidate ${code}`)
  }
})

run('9. Plan seat counting still ignores archived Workers', () => {
  const drivers = [
    { archivedAt: null },
    { archivedAt: null },
    { archivedAt: '2026-01-01T00:00:00.000Z' },
  ] as Driver[]
  assertEqual(countActiveWorkersForPlan(drivers), 2, 'active seats')

  const plan: CompanyPlanRecord = {
    planCode: 'starter',
    planSelectedAt: null,
    trialStartedAt: null,
    subscriptionStatus: 'trial',
    subscriptionValidUntil: null,
    definition: {
      code: 'starter',
      displayName: 'Starter Fleet',
      vehicleLimit: 10,
      activeWorkerLimit: 20,
      priceDisplay: '£69.99 / month',
      priceMonthlyGbp: 69.99,
    },
  }

  const snapshot = buildWorkerAllowanceSnapshot({ drivers, plan })
  assertTrue(snapshot.canAddWorker, 'starter with 2/20 can add')
  assertEqual(snapshot.activeCount, 2, 'snapshot active')
})

run('10. Existing Auth user without membership is allowed', () => {
  assertEqual(
    classifyInvitedAuthMembership({
      targetCompanyId: 'company-a',
      activeMembershipCompanyIds: [],
    }),
    'none',
    'no active membership → allow link + recovery email',
  )
})

run('11. Existing Auth user in the same company is idempotent', () => {
  assertEqual(
    classifyInvitedAuthMembership({
      targetCompanyId: 'company-a',
      activeMembershipCompanyIds: ['company-a'],
    }),
    'same_company',
    'same company → idempotent path',
  )
})

run('12. Existing Auth user active in another company is rejected', () => {
  assertEqual(
    classifyInvitedAuthMembership({
      targetCompanyId: 'company-a',
      activeMembershipCompanyIds: ['company-b'],
    }),
    'other_company',
    'other company blocked',
  )
  assertEqual(
    mapInviteDatabaseError('USER_ALREADY_LINKED_TO_ANOTHER_COMPANY').code,
    USER_ALREADY_LINKED_TO_ANOTHER_COMPANY,
    'structured reject code',
  )
  assertEqual(
    mapInviteDatabaseError('USER_ALREADY_LINKED_TO_ANOTHER_COMPANY').httpStatus,
    409,
    'conflict status',
  )
})

run('13. generateLink is never counted as an email being sent', () => {
  assertEqual(doesGenerateLinkSendEmail(), false, 'generateLink ≠ email')
  const afterLookupOnly = buildInviteEmailDeliveryOutcome({
    alreadyExisted: true,
    linkCode: 'linked',
    inviteApiAccepted: false,
    recoveryEmailAccepted: null,
  })
  assertEqual(afterLookupOnly.inviteSent, false, 'no recovery yet → not sent')
  assertTrue(afterLookupOnly.emailDeliveryFailed, 'missing recovery = failed delivery flag')
})

run('14. Recovery email failure after successful linking keeps linkingSucceeded', () => {
  const outcome = buildInviteEmailDeliveryOutcome({
    alreadyExisted: true,
    linkCode: 'linked',
    inviteApiAccepted: false,
    recoveryEmailAccepted: false,
  })
  assertEqual(outcome.linkingSucceeded, true, 'link kept')
  assertEqual(outcome.inviteSent, false, 'email not sent')
  assertTrue(outcome.emailDeliveryFailed, 'delivery failed flag')
  assertEqual(outcome.code, 'linked_email_failed', 'email failed code')
  assertTrue(
    outcome.message.toLowerCase().includes('linking succeeded'),
    'message says linking succeeded',
  )
})

run('15. RPC documents advisory lock + authoritative cross-company reject', () => {
  const guard = describeWorkerInviteRpcConcurrencyGuard()
  assertEqual(guard.lockKind, 'pg_advisory_xact_lock', 'lock kind')
  assertEqual(
    guard.namespace,
    WORKER_INVITE_AUTH_USER_LOCK_NAMESPACE,
    'lock namespace',
  )
  assertEqual(
    guard.rejectsOtherCompanyCode,
    USER_ALREADY_LINKED_TO_ANOTHER_COMPANY,
    'rpc reject code',
  )
})

run('16. New Auth user + RPC success → Auth user is not deleted', () => {
  const decision = decideNewAuthUserCleanup({
    createdAuthUserThisRequest: true,
    linkingSucceeded: true,
    membershipQueryOk: true,
    activeMembershipCount: 1,
    anyMembershipCount: 1,
    profileQueryOk: true,
    linkedProfileEvidence: true,
  })
  assertEqual(decision.action, 'skip', 'no delete after success')
  if (decision.action === 'skip') {
    assertEqual(decision.reason, 'linking_succeeded', 'skip reason')
  }
})

run('17. New Auth user + RPC failure + no membership/profile → delete attempted', () => {
  const decision = decideNewAuthUserCleanup({
    createdAuthUserThisRequest: true,
    linkingSucceeded: false,
    membershipQueryOk: true,
    activeMembershipCount: 0,
    anyMembershipCount: 0,
    profileQueryOk: true,
    linkedProfileEvidence: false,
  })
  assertEqual(decision.action, 'delete', 'delete orphan')

  const meta = buildAuthCleanupMetadata({
    decision,
    deleteAttempted: true,
    deleteSucceeded: true,
    deleteNotFound: false,
    deleteErrorMessage: null,
  })
  assertTrue(meta.authCleanupAttempted, 'attempted')
  assertTrue(meta.authCleanupSucceeded, 'succeeded')
  assertEqual(meta.authCleanupSkipped, false, 'not skipped')
  assertEqual(meta.authCleanupError, null, 'no error')
})

run('18. Existing Auth user + RPC failure → deleteUser never attempted', () => {
  const decision = decideNewAuthUserCleanup({
    createdAuthUserThisRequest: false,
    linkingSucceeded: false,
    membershipQueryOk: true,
    activeMembershipCount: 0,
    anyMembershipCount: 0,
    profileQueryOk: true,
    linkedProfileEvidence: false,
  })
  assertEqual(decision.action, 'skip', 'skip existing')
  if (decision.action === 'skip') {
    assertEqual(decision.reason, 'not_created_this_request', 'reason')
  }
  const meta = buildAuthCleanupMetadata({
    decision,
    deleteAttempted: false,
    deleteSucceeded: false,
    deleteNotFound: false,
    deleteErrorMessage: null,
  })
  assertEqual(meta.authCleanupAttempted, false, 'never attempted')
  assertTrue(meta.authCleanupSkipped, 'skipped')
})

run('19. New Auth user + RPC failure + active membership → cleanup skipped', () => {
  const decision = decideNewAuthUserCleanup({
    createdAuthUserThisRequest: true,
    linkingSucceeded: false,
    membershipQueryOk: true,
    activeMembershipCount: 1,
    anyMembershipCount: 1,
    profileQueryOk: true,
    linkedProfileEvidence: false,
  })
  assertEqual(decision.action, 'skip', 'skip with membership')
  if (decision.action === 'skip') {
    assertEqual(decision.reason, 'active_membership_present', 'reason')
  }
})

run('20. Cleanup safety query fails → Auth user not deleted', () => {
  const membershipFail = decideNewAuthUserCleanup({
    createdAuthUserThisRequest: true,
    linkingSucceeded: false,
    membershipQueryOk: false,
    activeMembershipCount: null,
    anyMembershipCount: null,
    profileQueryOk: true,
    linkedProfileEvidence: null,
  })
  assertEqual(membershipFail.action, 'skip', 'membership query fail')
  if (membershipFail.action === 'skip') {
    assertEqual(membershipFail.reason, 'membership_query_failed', 'reason')
  }

  const profileFail = decideNewAuthUserCleanup({
    createdAuthUserThisRequest: true,
    linkingSucceeded: false,
    membershipQueryOk: true,
    activeMembershipCount: 0,
    anyMembershipCount: 0,
    profileQueryOk: false,
    linkedProfileEvidence: null,
  })
  assertEqual(profileFail.action, 'skip', 'profile query fail')
  if (profileFail.action === 'skip') {
    assertEqual(profileFail.reason, 'profile_query_failed', 'reason')
  }
})

run('21. deleteUser failure preserves original linking error metadata shape', () => {
  const decision = decideNewAuthUserCleanup({
    createdAuthUserThisRequest: true,
    linkingSucceeded: false,
    membershipQueryOk: true,
    activeMembershipCount: 0,
    anyMembershipCount: 0,
    profileQueryOk: true,
    linkedProfileEvidence: false,
  })
  const meta = buildAuthCleanupMetadata({
    decision,
    deleteAttempted: true,
    deleteSucceeded: false,
    deleteNotFound: false,
    deleteErrorMessage: 'Auth delete failed: bearer eyJhbGciOi service_role secret',
  })
  assertTrue(meta.authCleanupAttempted, 'attempted')
  assertEqual(meta.authCleanupSucceeded, false, 'failed')
  assertEqual(meta.authCleanupSkipped, false, 'not skipped')
  assertEqual(meta.authCleanupError, 'Auth cleanup failed.', 'sanitized')
  assertTrue(
    !meta.authCleanupError?.toLowerCase().includes('service_role'),
    'no secrets',
  )
  // Original linking error remains the primary response (tested as contract).
  const linking = mapInviteDatabaseError('WORKER_PLAN_LIMIT_REACHED')
  assertEqual(linking.code, 'plan_limit_reached', 'original code kept')
})

run('22. deleteUser not-found is treated as successful cleanup', () => {
  assertTrue(isAuthDeleteNotFoundError('User not found'), 'not found')
  const decision = decideNewAuthUserCleanup({
    createdAuthUserThisRequest: true,
    linkingSucceeded: false,
    membershipQueryOk: true,
    activeMembershipCount: 0,
    anyMembershipCount: 0,
    profileQueryOk: true,
    linkedProfileEvidence: false,
  })
  const meta = buildAuthCleanupMetadata({
    decision,
    deleteAttempted: true,
    deleteSucceeded: false,
    deleteNotFound: true,
    deleteErrorMessage: 'User not found',
  })
  assertTrue(meta.authCleanupSucceeded, 'not-found = success')
  assertEqual(meta.authCleanupError, null, 'no error on not-found')
})

run('23. Structured cleanup metadata has no secrets', () => {
  assertEqual(
    sanitizeAuthCleanupError('forbidden jwt bearer token service_role'),
    'Auth cleanup failed.',
    'secrets stripped',
  )
  const meta = buildAuthCleanupMetadata({
    decision: { action: 'delete', reason: 'safe_orphan_after_link_failure' },
    deleteAttempted: true,
    deleteSucceeded: false,
    deleteNotFound: false,
    deleteErrorMessage: 'apikey leaked',
  })
  assertEqual(meta.authCleanupError, 'Auth cleanup failed.', 'safe message')
  assertTrue(!JSON.stringify(meta).includes('apikey'), 'json safe')
})

console.log(`\nAll ${passed} worker invitation checks passed.`)

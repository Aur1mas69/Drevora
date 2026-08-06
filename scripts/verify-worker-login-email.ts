/**
 * Focused verification for Worker login email change backend.
 * Run: npm run verify:worker-login-email
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  WORKER_LOGIN_EMAIL_CHANGE_REQUIRED,
  WORKER_LOGIN_EMAIL_ERROR_CODES,
  buildChangeWorkerLoginEmailRequestBody,
  changeWorkerLoginEmailRequestContainsForbiddenKeys,
  describeLoginEmailChangeSequence,
  mapWorkerLoginEmailDatabaseError,
  normalizeLoginEmail,
  validateChangeWorkerLoginEmailInput,
} from '../src/lib/workerLoginEmail.ts'

const MIGRATION =
  'supabase/migrations/20260806220000_worker_login_email_change.sql'
const SCHEMA = 'supabase/schema.sql'
const POLICIES = 'supabase/policies.sql'
const EDGE = 'supabase/functions/change-worker-login-email/index.ts'
const README = 'supabase/functions/change-worker-login-email/README.md'

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

function read(path: string): string {
  return readFileSync(resolve(path), 'utf8').replace(/\r\n/g, '\n')
}

const migration = read(MIGRATION)
const schema = read(SCHEMA)
const policies = read(POLICIES)
const edge = read(EDGE)
const readme = read(README)

run('1. Email normalisation trims and lowercases', () => {
  assertEqual(
    normalizeLoginEmail('  Sam.Worker@Example.COM '),
    'sam.worker@example.com',
    'normalise',
  )
  assertEqual(normalizeLoginEmail('bad'), null, 'reject invalid')
})

run('2. samePersonConfirmed and reason are required', () => {
  const missingConfirm = validateChangeWorkerLoginEmailInput({
    workerId: '11111111-1111-1111-1111-111111111111',
    newEmail: 'a@b.co',
    reason: 'Typo',
    samePersonConfirmed: false,
  })
  assertEqual(missingConfirm.ok, false, 'confirm required')
  if (!missingConfirm.ok) {
    assertEqual(
      missingConfirm.code,
      'SAME_PERSON_CONFIRMATION_REQUIRED',
      'confirm code',
    )
  }

  const missingReason = validateChangeWorkerLoginEmailInput({
    workerId: '11111111-1111-1111-1111-111111111111',
    newEmail: 'a@b.co',
    reason: '   ',
    samePersonConfirmed: true,
  })
  assertEqual(missingReason.ok, false, 'reason required')
})

run('3. Request body never includes companyId or authUserId', () => {
  const body = buildChangeWorkerLoginEmailRequestBody({
    workerId: '11111111-1111-1111-1111-111111111111',
    newEmail: 'new@example.com',
    reason: 'Legal name email update',
    samePersonConfirmed: true,
  })
  assertEqual(
    changeWorkerLoginEmailRequestContainsForbiddenKeys(body),
    false,
    'no forbidden keys',
  )
  assertTrue(!('companyId' in body) && !('authUserId' in body), 'keys absent')
})

run('4. Auth-first then finalize RPC; rollback on finalize failure', () => {
  const seq = describeLoginEmailChangeSequence()
  assertEqual(seq.authFirst, true, 'auth first')
  assertEqual(
    seq.thenFinalizeRpc,
    'drevora_finalize_worker_login_email_change',
    'rpc',
  )
  assertEqual(
    seq.rollbackOnFinalizeFailure,
    'restore_old_auth_email',
    'rollback',
  )
  assertEqual(seq.neverCreatesAuthUser, true, 'no new auth')
  assertEqual(seq.neverRebindsAuthUserId, true, 'no rebind')
  assertTrue(
    edge.includes('updateUserById') &&
      edge.includes('drevora_finalize_worker_login_email_change') &&
      edge.includes('restoreAuthEmail'),
    'edge implements sequence',
  )
})

run('5. Migration blocks direct linked email edits', () => {
  assertTrue(
    migration.includes('WORKER_LOGIN_EMAIL_CHANGE_REQUIRED'),
    'error code',
  )
  assertTrue(
    migration.includes('drevora_drivers_login_email_guard') &&
      migration.includes('before update of email'),
    'email guard trigger',
  )
  assertTrue(
    migration.includes("set_config('drevora.allow_worker_login_email_change', 'on', true)"),
    'privileged allow flag',
  )
  assertTrue(
    schema.includes('drevora_drivers_login_email_guard'),
    'schema synced guard',
  )
  assertTrue(
    policies.includes('WORKER_LOGIN_EMAIL') ||
      policies.includes('drivers_login_email_guard') ||
      policies.includes('allow_worker_login_email_change'),
    'policies document protection',
  )
})

run('6. Unchanged email must not fail (guard compares normalised emails)', () => {
  assertTrue(
    migration.includes(
      "lower(btrim(coalesce(new.email, ''))) = lower(btrim(coalesce(old.email, '')))",
    ),
    'same email early return',
  )
})

run('7. Finalize RPC keeps same auth_user_id and writes login_email_changed', () => {
  assertTrue(
    migration.includes('login_email_changed') &&
      migration.includes('drevora_finalize_worker_login_email_change'),
    'rpc + event type',
  )
  assertTrue(
    migration.includes('auth_user_id is distinct from p_expected_auth_user_id') &&
      migration.includes('WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'),
    'rejects rebind',
  )
  assertTrue(
    schema.includes("'login_email_changed'"),
    'schema event type',
  )
})

run('8. Structured error mapping covers required codes', () => {
  for (const code of [
    'WORKER_NOT_FOUND',
    'WORKER_ARCHIVED',
    'WORKER_AUTH_NOT_LINKED',
    'EMAIL_ALREADY_IN_USE',
    'SAME_PERSON_CONFIRMATION_REQUIRED',
    'INVALID_EMAIL',
    'FORBIDDEN',
    'UNAUTHENTICATED',
    'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED',
    WORKER_LOGIN_EMAIL_CHANGE_REQUIRED,
  ] as const) {
    assertTrue(
      (WORKER_LOGIN_EMAIL_ERROR_CODES as readonly string[]).includes(code),
      `code list has ${code}`,
    )
    assertEqual(
      mapWorkerLoginEmailDatabaseError(code).code,
      code,
      `map ${code}`,
    )
  }
  assertTrue(edge.includes('EMAIL_ALREADY_IN_USE'), 'edge conflict')
  assertTrue(edge.includes('SAME_PERSON_CONFIRMATION_REQUIRED'), 'edge confirm')
})

run('9. Edge never trusts browser companyId/authUserId; never inviteUserByEmail', () => {
  assertTrue(
    edge.includes('ignored_client_identity_fields') ||
      edge.includes('companyId != null') ||
      edge.includes('authUserId != null'),
    'ignores client identity fields',
  )
  assertTrue(!edge.includes('inviteUserByEmail'), 'never creates Auth user')
  assertTrue(edge.includes('getUserById'), 'resolves existing Auth user')
})

run('10. README documents apply order and rollback', () => {
  assertTrue(readme.includes('20260806220000_worker_login_email_change.sql'), 'migration')
  assertTrue(readme.includes('restore old Auth email'), 'rollback docs')
  assertTrue(readme.includes('samePersonConfirmed'), 'confirm docs')
})

console.log(`\nverify-worker-login-email: ${passed} passed`)

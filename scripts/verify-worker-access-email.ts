/**
 * Focused verification for Worker account access email backend.
 * Run: npm run verify:worker-access-email
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  WORKER_ACCESS_EMAIL_COOLDOWN_SECONDS,
  WORKER_ACCESS_EMAIL_ERROR_CODES,
  WORKER_ACCESS_EMAIL_PENDING_TTL_SECONDS,
  WORKER_ACCESS_EMAIL_REDIRECT_TO,
  buildSendWorkerAccessEmailRequestBody,
  describeWorkerAccessEmailSequence,
  mapWorkerAccessEmailDatabaseError,
  normalizeAccessEmail,
  sendWorkerAccessEmailRequestContainsForbiddenKeys,
  validateSendWorkerAccessEmailInput,
} from '../src/lib/workerAccessEmail.ts'

const MIGRATION = 'supabase/migrations/20260806240000_worker_access_email.sql'
const HARDENING =
  'supabase/migrations/20260808200000_harden_server_only_audit_tables.sql'
const EDGE = 'supabase/functions/send-worker-access-email/index.ts'
const README = 'supabase/functions/send-worker-access-email/README.md'

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
const hardening = read(HARDENING)
const edge = read(EDGE)
const readme = read(README)

run('1. Email normalisation + request validation', () => {
  assertEqual(
    normalizeAccessEmail('  Sam.Worker@Example.COM '),
    'sam.worker@example.com',
    'normalise',
  )
  const missingConfirm = validateSendWorkerAccessEmailInput({
    workerId: '11111111-1111-4111-8111-111111111111',
    expectedEmail: 'a@b.co',
    emailConfirmed: false,
  })
  assertEqual(missingConfirm.ok, false, 'confirm required')
  if (!missingConfirm.ok) {
    assertEqual(missingConfirm.code, 'EMAIL_CONFIRMATION_MISMATCH', 'confirm code')
  }
})

run('2. Request body never includes companyId or authUserId', () => {
  const body = buildSendWorkerAccessEmailRequestBody({
    workerId: '11111111-1111-4111-8111-111111111111',
    expectedEmail: 'worker@example.com',
    emailConfirmed: true,
  })
  assertEqual(
    sendWorkerAccessEmailRequestContainsForbiddenKeys(body),
    false,
    'no forbidden keys',
  )
})

run('3. Sequence uses reservation begin → send → finalize/fail', () => {
  const seq = describeWorkerAccessEmailSequence()
  assertEqual(seq.beginReservationBeforeSend, true, 'begin')
  assertEqual(seq.finalizeAfterAcceptedSend, true, 'finalize')
  assertEqual(seq.failWithoutAuditOnSendError, true, 'fail')
  assertEqual(seq.auditOnlyAfterAcceptedSend, true, 'audit after')
  assertEqual(seq.cooldownSeconds, WORKER_ACCESS_EMAIL_COOLDOWN_SECONDS, '900')
  assertEqual(seq.pendingTtlSeconds, WORKER_ACCESS_EMAIL_PENDING_TTL_SECONDS, '300')
  assertEqual(seq.redirectTo, WORKER_ACCESS_EMAIL_REDIRECT_TO, 'redirect')
  assertEqual(seq.neverUsesGenerateLink, true, 'no generateLink')
})

run('4. Private dispatch table + no browser access', () => {
  assertTrue(
    migration.includes('create table if not exists public.worker_access_email_dispatches'),
    'table',
  )
  assertTrue(
    migration.includes("status in ('pending', 'sent', 'failed', 'expired')"),
    'statuses',
  )
  assertTrue(
    hardening.includes(
      'alter table public.worker_access_email_dispatches enable row level security',
    ),
    'final RLS enabled',
  )
  assertTrue(
    hardening.includes(
      'revoke all on table public.worker_access_email_dispatches from public',
    ),
    'final revoke public',
  )
  assertTrue(
    hardening.includes(
      'revoke all on table public.worker_access_email_dispatches from anon',
    ),
    'final revoke anon',
  )
  assertTrue(
    hardening.includes(
      'revoke all on table public.worker_access_email_dispatches from authenticated',
    ),
    'final revoke authenticated',
  )
  assertTrue(
    hardening.includes(
      'grant all on table public.worker_access_email_dispatches to service_role',
    ),
    'final service_role table access',
  )
  assertTrue(
    !hardening.includes(
      'grant select on table public.worker_access_email_dispatches to authenticated',
    ) &&
      !migration.includes(
        'grant select on table public.worker_access_email_dispatches to authenticated',
      ),
    'no authenticated select',
  )
  const denyStart = hardening.indexOf(
    'create policy worker_access_email_dispatches_deny_client_access',
  )
  assertTrue(denyStart >= 0, 'deny-client policy created')
  const denySlice = hardening.slice(denyStart, denyStart + 450)
  assertTrue(
    denySlice.includes('on public.worker_access_email_dispatches'),
    'deny policy on dispatch table',
  )
  assertTrue(denySlice.includes('for all'), 'deny for all')
  assertTrue(denySlice.includes('to anon, authenticated'), 'deny client roles')
  assertTrue(denySlice.includes('using (false)'), 'using false')
  assertTrue(denySlice.includes('with check (false)'), 'with check false')
  assertTrue(!denySlice.includes('using (true)'), 'not permissive true')
  assertTrue(!denySlice.includes('with check (true)'), 'not permissive check true')
})

run('5. Begin uses advisory lock; concurrent pending blocked; stale pending expires', () => {
  assertTrue(
    migration.includes('drevora_begin_worker_access_email_send'),
    'begin rpc',
  )
  assertTrue(migration.includes('pg_advisory_xact_lock'), 'advisory lock')
  assertTrue(
    migration.includes('worker_access_email_dispatches_one_pending_per_driver_idx'),
    'unique pending index',
  )
  assertTrue(
    migration.includes("status = 'expired'") &&
      migration.includes('p_pending_ttl_seconds integer default 300'),
    'expire stale pending',
  )
  assertTrue(
    migration.includes("d.status = 'pending'") &&
      migration.includes('ACCESS_EMAIL_RATE_LIMITED'),
    'reject live pending',
  )
  assertTrue(
    !migration.includes('drevora_assert_worker_access_email_allowed') ||
      migration.includes('drop function if exists public.drevora_assert_worker_access_email_allowed'),
    'old assert dropped',
  )
})

run('6. Successful send starts 900s cooldown; failed send does not', () => {
  assertTrue(
    migration.includes("d.status = 'sent'") &&
      migration.includes('p_cooldown_seconds integer default 900'),
    'cooldown from sent only',
  )
  const beginFn = migration.slice(
    migration.indexOf('drevora_begin_worker_access_email_send'),
    migration.indexOf('drevora_finalize_worker_access_email_send'),
  )
  assertTrue(
    beginFn.includes("status = 'sent'") && !beginFn.includes("status = 'failed'"),
    'begin cooldown ignores failed',
  )
  assertTrue(
    migration.includes('drevora_fail_worker_access_email_send') &&
      migration.includes("status = 'failed'"),
    'fail rpc',
  )
  assertTrue(
    migration.includes('Does not write access_email_sent and does not start the success cooldown'),
    'fail comment',
  )
})

run('7. Finalize writes exactly one audit; duplicate finalize idempotent', () => {
  assertTrue(
    migration.includes('drevora_finalize_worker_access_email_send'),
    'finalize rpc',
  )
  assertTrue(
    migration.includes("'access_email_sent'") &&
      migration.includes('drevora_insert_worker_identity_event'),
    'writes audit',
  )
  assertTrue(
    migration.includes('access_email_already_finalized') &&
      migration.includes("'duplicate', true"),
    'idempotent duplicate finalize',
  )
  const finalizeFn = migration.slice(
    migration.indexOf('drevora_finalize_worker_access_email_send'),
    migration.indexOf('drevora_fail_worker_access_email_send'),
  )
  assertEqual(
    (finalizeFn.match(/drevora_insert_worker_identity_event/g) ?? []).length,
    1,
    'exactly one audit insert path',
  )
})

run('8. Edge order begin → send → finalize/fail; Auth email target preserved', () => {
  const beginIdx = edge.indexOf("rpc('drevora_begin_worker_access_email_send'")
  const sendIdx = edge.indexOf('await sendAccessEmail({')
  const failIdx = edge.indexOf("rpc('drevora_fail_worker_access_email_send'")
  const finalizeIdx = edge.indexOf(
    "rpc(\n    'drevora_finalize_worker_access_email_send'",
  )
  assertTrue(beginIdx >= 0, 'begin call')
  assertTrue(sendIdx >= 0, 'send call')
  assertTrue(failIdx >= 0, 'fail call')
  assertTrue(finalizeIdx >= 0, 'finalize call')
  assertTrue(beginIdx < sendIdx, 'begin before send')
  assertTrue(sendIdx < failIdx && sendIdx < finalizeIdx, 'send before outcomes')
  assertTrue(edge.includes('expectedEmail !== authEmail'), 'confirm only')
  assertTrue(edge.includes('email: authEmail'), 'send auth email')
  assertTrue(!edge.includes('.generateLink('), 'no generateLink')
  assertTrue(!edge.includes('inviteUserByEmail'), 'no invite')
  assertTrue(edge.includes('resetPasswordForEmail'), 'resetPasswordForEmail')
})

run('9. Structured errors + service_role-only RPC grants', () => {
  for (const code of [
    'WORKER_NOT_FOUND',
    'WORKER_ARCHIVED',
    'WORKER_AUTH_NOT_LINKED',
    'WORKER_LOGIN_EMAIL_OUT_OF_SYNC',
    'EMAIL_CONFIRMATION_MISMATCH',
    'ACCESS_EMAIL_RATE_LIMITED',
    'FORBIDDEN',
    'UNAUTHENTICATED',
  ] as const) {
    assertTrue(
      (WORKER_ACCESS_EMAIL_ERROR_CODES as readonly string[]).includes(code),
      `list ${code}`,
    )
    assertEqual(mapWorkerAccessEmailDatabaseError(code).code, code, `map ${code}`)
    assertTrue(edge.includes(code), `edge ${code}`)
  }
  assertTrue(
    migration.includes(
      'create or replace function public.drevora_begin_worker_access_email_send(',
    ) &&
      migration.includes(
        'create or replace function public.drevora_finalize_worker_access_email_send(',
      ) &&
      migration.includes(
        'create or replace function public.drevora_fail_worker_access_email_send(',
      ),
    'begin/finalize/fail RPCs defined',
  )
  const beginGrant =
    'grant execute on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) to service_role'
  const beginAuthGrant =
    'grant execute on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) to authenticated'
  assertTrue(hardening.includes(beginGrant), 'final begin service_role execute')
  assertTrue(!hardening.includes(beginAuthGrant), 'final no authenticated begin')
  assertTrue(
    hardening.includes(
      'revoke all on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) from public',
    ) &&
      hardening.includes(
        'revoke all on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) from anon',
      ) &&
      hardening.includes(
        'revoke all on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) from authenticated',
      ),
    'final begin revoke public/anon/authenticated',
  )
  assertTrue(
    hardening.includes(
      'revoke all on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) from public',
    ) &&
      hardening.includes(
        'grant execute on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) to service_role',
      ),
    'final finalize service_role only',
  )
  assertTrue(
    hardening.includes(
      'revoke all on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) from public',
    ) &&
      hardening.includes(
        'grant execute on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) to service_role',
      ),
    'final fail service_role only',
  )
})

run('10. README documents concurrency reservation flow', () => {
  assertTrue(readme.includes('pg_advisory_xact_lock') || readme.includes('advisory lock'), 'lock docs')
  assertTrue(readme.includes('worker_access_email_dispatches'), 'table docs')
  assertTrue(readme.includes('900'), 'cooldown')
  assertTrue(readme.includes('5 minutes') || readme.includes('300'), 'ttl')
  assertTrue(readme.includes('failed') && readme.includes('cooldown'), 'failed no cooldown')
  assertTrue(readme.includes('generateLink'), 'forbids generateLink')
})

console.log(`\nverify-worker-access-email: ${passed} passed`)

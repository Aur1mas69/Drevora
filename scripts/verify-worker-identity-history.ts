/**
 * Focused verification for Worker Identity & Access History (Admin UI + list RPC).
 * Run: npm run verify:worker-identity-history
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  formatWorkerIdentityEventLabel,
  mapWorkerIdentityEventRow,
  sanitizeWorkerIdentityActorLabel,
  sanitizeWorkerIdentityEmail,
  sortWorkerIdentityEventsNewestFirst,
  workerIdentityHistoryExposesForbiddenContent,
  type WorkerIdentityEvent,
} from '../src/lib/workerIdentityEvents.ts'

const MIGRATION =
  'supabase/migrations/20260806230000_worker_identity_events_list_rpc.sql'
const SERVICE = 'src/services/workerIdentityEventsService.ts'
const COMPONENT = 'src/components/workers/WorkerIdentityAccessHistory.tsx'
const DETAILS = 'src/pages/DriverDetailsPage.tsx'

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
const service = read(SERVICE)
const component = read(COMPONENT)
const details = read(DETAILS)

run('1. Migration RPC scopes by Office + company membership', () => {
  assertTrue(
    migration.includes(
      'create or replace function public.drevora_list_worker_identity_events(\n  p_driver_id uuid\n)',
    ),
    'rpc exists with p_driver_id uuid signature',
  )
  assertTrue(
    migration.includes('from public.company_members cm'),
    'company_members check',
  )
  assertTrue(
    migration.includes('drevora_auth_user_has_office_role_for_company(v_company_id)'),
    'office role',
  )
  assertTrue(
    migration.includes('select d.company_id') &&
      migration.includes('from public.drivers d') &&
      migration.includes('where d.id = p_driver_id'),
    'company from worker row',
  )
  assertTrue(!migration.includes('p_company_id'), 'no browser company param')
  assertTrue(
    migration.includes("raise exception 'UNAUTHENTICATED'") &&
      migration.includes("raise exception 'FORBIDDEN'") &&
      migration.includes("raise exception 'WORKER_NOT_FOUND'"),
    'auth errors',
  )
})

run('2. RPC returns only safe fields and never raw JSON/auth IDs', () => {
  assertTrue(migration.includes('actor_label text'), 'actor_label')
  assertTrue(migration.includes('old_email text'), 'old_email')
  assertTrue(migration.includes('new_email text'), 'new_email')
  assertTrue(migration.includes('order by e.created_at desc'), 'newest first')

  const returnsBlock = migration.slice(
    migration.indexOf('returns table ('),
    migration.indexOf('language plpgsql'),
  )
  assertTrue(returnsBlock.includes('actor_label text'), 'returns actor_label')
  assertTrue(returnsBlock.includes('old_email text'), 'returns old_email')
  assertTrue(returnsBlock.includes('new_email text'), 'returns new_email')
  assertTrue(!returnsBlock.includes('auth_user_id'), 'returns no auth_user_id')
  assertTrue(!returnsBlock.includes('actor_user_id'), 'returns no actor_user_id')
  assertTrue(!returnsBlock.includes('old_values'), 'returns no old_values')
  assertTrue(!returnsBlock.includes('new_values'), 'returns no new_values')
  assertTrue(!returnsBlock.includes('company_id'), 'returns no company_id')

  assertTrue(migration.includes('left join auth.users actor_auth'), 'server-side actor email')
  assertTrue(
    migration.includes("e.old_values->>'email'") &&
      migration.includes("e.new_values->>'email'"),
    'extracts emails server-side only',
  )
  assertTrue(
    migration.includes(
      'grant execute on function public.drevora_list_worker_identity_events(uuid) to authenticated',
    ),
    'authenticated execute granted',
  )
  assertTrue(
    migration.includes(
      'revoke all on function public.drevora_list_worker_identity_events(uuid) from public',
    ),
    'public execute revoked',
  )
  assertTrue(
    migration.includes(
      'revoke all on function public.drevora_list_worker_identity_events(uuid) from anon',
    ),
    'anon execute revoked',
  )
})

run('3. Service uses RPC only — no auth.users or mutations', () => {
  assertTrue(
    service.includes("drevora_list_worker_identity_events"),
    'calls list rpc',
  )
  assertTrue(service.includes('p_driver_id'), 'driver id only')
  assertTrue(
    !service.includes(".from('auth.users')") &&
      !service.includes('.from("auth.users")') &&
      !service.includes("schema('auth')"),
    'no browser auth.users query',
  )
  assertTrue(!service.includes(".from('worker_identity_events')"), 'no direct table')
  assertTrue(
    !service.includes('.insert(') &&
      !service.includes('.update(') &&
      !service.includes('.delete('),
    'no mutations',
  )
  assertTrue(
    !service.includes('companyId:') &&
      !service.includes('company_id:') &&
      !service.includes('p_company_id'),
    'no companyId argument',
  )
})

run('4. Safe labels including unknown event types', () => {
  assertEqual(
    formatWorkerIdentityEventLabel('login_email_changed'),
    'Login email changed',
    'login email',
  )
  assertEqual(
    formatWorkerIdentityEventLabel('auth_user_backfilled'),
    'Auth user backfilled',
    'backfill',
  )
  assertEqual(
    formatWorkerIdentityEventLabel('access_email_sent'),
    'Account access email sent',
    'access email',
  )
  assertEqual(
    formatWorkerIdentityEventLabel('name_corrected'),
    'Name corrected',
    'name',
  )
  assertEqual(
    formatWorkerIdentityEventLabel('identity_locked'),
    'Identity locked',
    'locked',
  )
  assertEqual(
    formatWorkerIdentityEventLabel('replacement_blocked'),
    'Identity replacement blocked',
    'replacement',
  )
  assertEqual(
    formatWorkerIdentityEventLabel('identity_replacement_blocked'),
    'Identity replacement blocked',
    'db alias',
  )
  assertEqual(
    formatWorkerIdentityEventLabel('archived'),
    'Worker archived',
    'archived',
  )
  assertEqual(
    formatWorkerIdentityEventLabel('restored'),
    'Worker restored',
    'restored',
  )
  assertEqual(
    formatWorkerIdentityEventLabel('something_new_and_unknown'),
    'Identity or access change',
    'unknown safe',
  )
})

run('5. Email/reason/actor sanitisation + newest-first', () => {
  assertEqual(
    sanitizeWorkerIdentityEmail('  Old@Example.COM '),
    'old@example.com',
    'email',
  )
  assertEqual(sanitizeWorkerIdentityEmail('not-an-email'), null, 'bad email')
  assertEqual(
    sanitizeWorkerIdentityActorLabel('11111111-1111-4111-8111-111111111111'),
    null,
    'uuid actor blocked',
  )
  assertEqual(
    sanitizeWorkerIdentityActorLabel('Sam Office'),
    'Sam Office',
    'actor name',
  )

  const mapped = mapWorkerIdentityEventRow({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    event_type: 'login_email_changed',
    created_at: '2026-08-06T12:00:00.000Z',
    reason: 'Typo fix',
    actor_label: 'Sam Office',
    old_email: 'old@example.com',
    new_email: 'new@example.com',
    auth_user_id: 'should-be-ignored',
    old_values: { email: 'leak' },
  })
  assertTrue(mapped !== null, 'mapped')
  assertEqual(mapped?.oldEmail, 'old@example.com', 'old email')
  assertEqual(mapped?.newEmail, 'new@example.com', 'new email')
  assertEqual(mapped?.reason, 'Typo fix', 'reason')
  assertEqual(mapped?.actorLabel, 'Sam Office', 'actor')
  assertTrue(
    !Object.prototype.hasOwnProperty.call(mapped as object, 'auth_user_id'),
    'no auth id on mapped',
  )
  assertTrue(
    !Object.prototype.hasOwnProperty.call(mapped as object, 'old_values'),
    'no old_values on mapped',
  )

  const sorted = sortWorkerIdentityEventsNewestFirst([
    {
      id: '1',
      eventType: 'a',
      createdAt: '2026-01-01T00:00:00.000Z',
      reason: null,
      actorLabel: null,
      oldEmail: null,
      newEmail: null,
    },
    {
      id: '2',
      eventType: 'b',
      createdAt: '2026-08-01T00:00:00.000Z',
      reason: null,
      actorLabel: null,
      oldEmail: null,
      newEmail: null,
    },
  ] satisfies WorkerIdentityEvent[])
  assertEqual(sorted[0]?.id, '2', 'newest first')
})

run('6. UI is read-only on Worker details (not in form)', () => {
  assertTrue(
    details.includes('WorkerIdentityAccessHistory'),
    'details page mounts section',
  )
  assertTrue(
    details.includes('<WorkerIdentityAccessHistory'),
    'component usage',
  )
  assertTrue(
    !details.includes('WorkerIdentityAccessHistory') ||
      !read('src/components/workers/WorkerFormModal.tsx').includes(
        'WorkerIdentityAccessHistory',
      ),
    'not in form modal',
  )
  assertTrue(component.includes('Identity & Access History'), 'title')
  assertTrue(
    component.includes('No identity or access changes recorded.'),
    'empty state',
  )
  assertTrue(component.includes('Retry'), 'retry')
  assertTrue(component.includes('Loading identity history'), 'loading')
  assertTrue(component.includes('Login email changed') || component.includes('formatWorkerIdentityEventLabel'), 'label helper')
  assertTrue(component.includes('Changed by'), 'actor field')
  assertTrue(component.includes('From') && component.includes('To'), 'email fields')
  assertTrue(component.includes('Reason'), 'reason')
  assertTrue(
    !component.includes('.insert(') &&
      !component.includes('Delete') &&
      !component.includes('Edit event'),
    'no mutation controls',
  )
  assertTrue(
    !workerIdentityHistoryExposesForbiddenContent(component),
    'component source clean',
  )
})

run('7. Actor fallback and forbidden content helpers', () => {
  assertEqual(
    sanitizeWorkerIdentityActorLabel(null),
    null,
    'missing actor',
  )
  assertTrue(
    workerIdentityHistoryExposesForbiddenContent('auth_user_id leaked'),
    'detects auth_user_id',
  )
  assertTrue(
    workerIdentityHistoryExposesForbiddenContent('old_values dump'),
    'detects old_values',
  )
  assertTrue(
    !workerIdentityHistoryExposesForbiddenContent('Login email changed'),
    'safe copy ok',
  )
})

console.log(`\nverify-worker-identity-history: ${passed} passed`)

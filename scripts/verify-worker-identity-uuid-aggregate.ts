/**
 * Focused verification for Worker identity UUID aggregate hotfix.
 * Run: npm run verify:worker-identity-uuid-aggregate
 *
 * Proves:
 * - foundation historically used min(d.id) on UUID driver IDs
 * - hotfix replaces drevora_auth_user_driver_id with UUID-safe array_agg
 * - hotfix does not pass UUID to min()/max()
 * - exact-one Auth match returns that UUID
 * - zero or multiple matches return null (no silent pick)
 * - Auth match remains preferred over email fallback
 *
 * Canonical SQL sources: foundation + hotfix migrations only.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const HOTFIX =
  'supabase/migrations/20260806210000_hotfix_auth_user_driver_id_uuid_aggregate.sql'
const FOUNDATION =
  'supabase/migrations/20260806200000_worker_identity_foundation.sql'

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

/** Strip SQL comments so documentation cannot false-positive. */
function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')
}

/** Mirror hotfix SQL: only return when count === 1. */
function pickExactOneUuid(ids: string[]): string | null {
  if (ids.length !== 1) return null
  return ids[0] ?? null
}

/** Mirror drevora_auth_user_driver_id Auth-first + email fallback. */
function resolveWorkerIdForAuthUser(input: {
  linkedActiveDriverIds: string[]
  unlinkedEmailMatchDriverIds: string[]
}): string | null {
  if (input.linkedActiveDriverIds.length === 1) {
    return input.linkedActiveDriverIds[0] ?? null
  }
  if (input.linkedActiveDriverIds.length > 1) return null
  if (input.unlinkedEmailMatchDriverIds.length === 1) {
    return input.unlinkedEmailMatchDriverIds[0] ?? null
  }
  return null
}

function extractAuthUserDriverIdBody(sql: string): string {
  const start = sql.indexOf(
    'create or replace function public.drevora_auth_user_driver_id()',
  )
  assertTrue(start >= 0, 'drevora_auth_user_driver_id definition present')
  const end = sql.indexOf(
    'comment on function public.drevora_auth_user_driver_id()',
    start,
  )
  assertTrue(end > start, 'function body bounded by comment')
  return sql.slice(start, end)
}

const hotfix = read(HOTFIX)
const foundation = read(FOUNDATION)
const hotfixBody = extractAuthUserDriverIdBody(hotfix)
const hotfixSql = stripSqlComments(hotfixBody)

run('1. Hotfix migration exists and replaces drevora_auth_user_driver_id', () => {
  assertTrue(
    hotfix.includes('create or replace function public.drevora_auth_user_driver_id()'),
    'create or replace present',
  )
  assertTrue(hotfix.includes('array_agg'), 'documents UUID-safe aggregate')
})

run('2. Hotfix does not pass UUID to min()/max()', () => {
  assertTrue(!/\bmin\s*\(\s*d\.id\s*\)/.test(hotfixSql), 'hotfix no min(d.id)')
  assertTrue(!/\bmax\s*\(\s*d\.id\s*\)/.test(hotfixSql), 'hotfix no max(d.id)')
  assertTrue(!/\bmin\s*\(/.test(hotfixSql), 'hotfix has no min(…)')
  assertTrue(!/\bmax\s*\(/.test(hotfixSql), 'hotfix has no max(…)')
})

run('3. Hotfix uses count + array_agg UUID-safe exact-one pattern', () => {
  assertTrue(
    hotfixSql.includes('(array_agg(d.id order by d.id))[1]'),
    'array_agg ordered pick',
  )
  assertTrue(hotfixSql.includes('count(*)::integer'), 'count present')
})

run('4. Exact-one Auth match returns that UUID', () => {
  const only = '11111111-1111-1111-1111-111111111111'
  assertEqual(pickExactOneUuid([only]), only, 'exact-one returns uuid')
  assertEqual(
    resolveWorkerIdForAuthUser({
      linkedActiveDriverIds: [only],
      unlinkedEmailMatchDriverIds: ['22222222-2222-2222-2222-222222222222'],
    }),
    only,
    'Auth preferred over email',
  )
})

run('5. Zero or multiple matches return null (no silent pick)', () => {
  assertEqual(pickExactOneUuid([]), null, 'zero → null')
  assertEqual(
    pickExactOneUuid([
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    ]),
    null,
    'multiple → null',
  )
  assertEqual(
    resolveWorkerIdForAuthUser({
      linkedActiveDriverIds: [
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
      ],
      unlinkedEmailMatchDriverIds: [],
    }),
    null,
    'ambiguous Auth → null',
  )
  assertTrue(
    hotfixSql.includes('v_count > 1') && hotfixBody.includes('return null'),
    'SQL returns null on ambiguous Auth',
  )
})

run('6. Email fallback remains only for null auth_user_id rows', () => {
  assertTrue(
    hotfixSql.includes('where d.auth_user_id is null'),
    'email fallback gated',
  )
  assertEqual(
    resolveWorkerIdForAuthUser({
      linkedActiveDriverIds: [],
      unlinkedEmailMatchDriverIds: ['33333333-3333-3333-3333-333333333333'],
    }),
    '33333333-3333-3333-3333-333333333333',
    'single email fallback ok',
  )
  assertEqual(
    resolveWorkerIdForAuthUser({
      linkedActiveDriverIds: [],
      unlinkedEmailMatchDriverIds: [
        '33333333-3333-3333-3333-333333333333',
        '44444444-4444-4444-4444-444444444444',
      ],
    }),
    null,
    'ambiguous email → null',
  )
})

run('7. Foundation migration left intact (no rollback)', () => {
  assertTrue(
    foundation.includes('min(d.id)'),
    'historical foundation still documents original min(d.id)',
  )
  assertTrue(
    !hotfix.includes('drop function public.drevora_auth_user_driver_id'),
    'hotfix does not drop function',
  )
})

console.log(`\nverify-worker-identity-uuid-aggregate: ${passed} passed`)

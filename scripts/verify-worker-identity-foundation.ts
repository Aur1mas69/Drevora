/**
 * Focused verification for Worker identity database foundation contracts.
 * Run: npm run verify:worker-identity-foundation
 *
 * Covers migration/schema/policies source contracts and pure backfill / resolution rules.
 * Live DB apply + runtime checks require:
 *   supabase/diagnostics/20260806_preflight_worker_identity_foundation.sql
 *   supabase/migrations/20260806200000_worker_identity_foundation.sql
 *   supabase/diagnostics/20260806_verify_worker_identity_foundation.sql
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MIGRATION = 'supabase/migrations/20260806200000_worker_identity_foundation.sql'
const SCHEMA = 'supabase/schema.sql'
const POLICIES = 'supabase/policies.sql'
const PREFLIGHT =
  'supabase/diagnostics/20260806_preflight_worker_identity_foundation.sql'
const LIVE_VERIFY =
  'supabase/diagnostics/20260806_verify_worker_identity_foundation.sql'

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

export type BackfillCandidate = {
  driverId: string
  authUserId: string
  companyId: string
  driverEmail: string
  authEmail: string
}

/** Mirror migration backfill matching: same company + normalised email. */
export function isUnambiguousEmailMatch(
  driverEmail: string,
  authEmail: string,
): boolean {
  return (
    driverEmail.trim().toLowerCase() === authEmail.trim().toLowerCase() &&
    driverEmail.trim() !== ''
  )
}

export function findBackfillAmbiguities(candidates: BackfillCandidate[]): {
  ambiguousDriverIds: string[]
  ambiguousAuthUserIds: string[]
} {
  const byDriver = new Map<string, Set<string>>()
  const byAuth = new Map<string, Set<string>>()

  for (const c of candidates) {
    if (!isUnambiguousEmailMatch(c.driverEmail, c.authEmail)) continue
    if (!byDriver.has(c.driverId)) byDriver.set(c.driverId, new Set())
    byDriver.get(c.driverId)!.add(c.authUserId)
    if (!byAuth.has(c.authUserId)) byAuth.set(c.authUserId, new Set())
    byAuth.get(c.authUserId)!.add(c.driverId)
  }

  return {
    ambiguousDriverIds: [...byDriver.entries()]
      .filter(([, set]) => set.size > 1)
      .map(([id]) => id),
    ambiguousAuthUserIds: [...byAuth.entries()]
      .filter(([, set]) => set.size > 1)
      .map(([id]) => id),
  }
}

export function selectUnambiguousBackfill(
  candidates: BackfillCandidate[],
): BackfillCandidate[] {
  const ambiguities = findBackfillAmbiguities(candidates)
  if (
    ambiguities.ambiguousDriverIds.length > 0 ||
    ambiguities.ambiguousAuthUserIds.length > 0
  ) {
    throw new Error('WORKER_IDENTITY_BACKFILL_AMBIGUOUS')
  }

  const seenDrivers = new Set<string>()
  const out: BackfillCandidate[] = []
  for (const c of candidates) {
    if (!isUnambiguousEmailMatch(c.driverEmail, c.authEmail)) continue
    if (seenDrivers.has(c.driverId)) continue
    seenDrivers.add(c.driverId)
    out.push(c)
  }
  return out
}

/** Mirror drevora_auth_user_driver_id Auth-first + email fallback. */
export function resolveWorkerIdForAuthUser(input: {
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

export function assertAuthUserRebindAllowed(input: {
  existingAuthUserId: string | null
  nextAuthUserId: string
}): 'ok' | 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED' {
  if (
    input.existingAuthUserId != null &&
    input.existingAuthUserId !== input.nextAuthUserId
  ) {
    return 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
  }
  return 'ok'
}

export function assertAuthUserUniqueActiveBind(input: {
  authUserId: string
  targetDriverId: string
  activeDriverIdsAlreadyLinkedToAuthUser: string[]
}): 'ok' | 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED' {
  const others = input.activeDriverIdsAlreadyLinkedToAuthUser.filter(
    (id) => id !== input.targetDriverId,
  )
  if (others.length > 0) return 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
  return 'ok'
}

const migration = read(MIGRATION)
const schema = read(SCHEMA)
const policies = read(POLICIES)

run('1. Migration adds nullable drivers.auth_user_id FK to auth.users', () => {
  assertTrue(
    migration.includes('add column if not exists auth_user_id uuid references auth.users'),
    'auth_user_id column',
  )
  assertTrue(schema.includes('add column if not exists auth_user_id uuid'), 'schema column')
})

run('2. Partial unique index: one active Worker per Auth user', () => {
  assertTrue(
    migration.includes('drivers_auth_user_id_active_unique_idx'),
    'migration unique index name',
  )
  assertTrue(
    migration.includes('where auth_user_id is not null') &&
      migration.includes('and archived_at is null'),
    'active-only partial unique',
  )
  assertTrue(schema.includes('drivers_auth_user_id_active_unique_idx'), 'schema unique index')
})

run('3. Safe unambiguous backfill rule (membership + email)', () => {
  const ok = selectUnambiguousBackfill([
    {
      driverId: 'd1',
      authUserId: 'a1',
      companyId: 'c1',
      driverEmail: '  Sam@Example.com ',
      authEmail: 'sam@example.com',
    },
  ])
  assertEqual(ok.length, 1, 'one link')
  assertEqual(ok[0]?.authUserId, 'a1', 'auth id')
  assertTrue(
    migration.includes("cm.role = 'Driver'") &&
      migration.includes('cm.is_active is true') &&
      migration.includes('lower(btrim(d.email)) = lower(btrim(coalesce(u.email, \'\')))'),
    'SQL backfill predicates',
  )
})

run('4. Ambiguous backfill is rejected (never guess)', () => {
  let threw = false
  try {
    selectUnambiguousBackfill([
      {
        driverId: 'd1',
        authUserId: 'a1',
        companyId: 'c1',
        driverEmail: 'same@example.com',
        authEmail: 'same@example.com',
      },
      {
        driverId: 'd1',
        authUserId: 'a2',
        companyId: 'c1',
        driverEmail: 'same@example.com',
        authEmail: 'same@example.com',
      },
    ])
  } catch (error) {
    threw = error instanceof Error && error.message === 'WORKER_IDENTITY_BACKFILL_AMBIGUOUS'
  }
  assertTrue(threw, 'throws ambiguous')
  assertTrue(
    migration.includes('WORKER_IDENTITY_BACKFILL_AMBIGUOUS'),
    'migration fails on ambiguous',
  )
})

run('5. Auth-first Worker resolution', () => {
  assertEqual(
    resolveWorkerIdForAuthUser({
      linkedActiveDriverIds: ['linked-1'],
      unlinkedEmailMatchDriverIds: ['email-1'],
    }),
    'linked-1',
    'prefers auth link',
  )
  assertTrue(
    migration.includes('d.auth_user_id = auth.uid()'),
    'SQL prefers auth_user_id',
  )
})

run('6. Transitional email fallback only for unlinked rows', () => {
  assertEqual(
    resolveWorkerIdForAuthUser({
      linkedActiveDriverIds: [],
      unlinkedEmailMatchDriverIds: ['email-only'],
    }),
    'email-only',
    'email fallback',
  )
  assertEqual(
    resolveWorkerIdForAuthUser({
      linkedActiveDriverIds: [],
      unlinkedEmailMatchDriverIds: ['e1', 'e2'],
    }),
    null,
    'ambiguous email fallback denied',
  )
  assertTrue(
    migration.includes('where d.auth_user_id is null') &&
      migration.includes('Transitional email fallback'),
    'SQL email fallback gated on null auth_user_id',
  )
})

run('7. Same Auth user cannot bind to another active Worker', () => {
  assertEqual(
    assertAuthUserUniqueActiveBind({
      authUserId: 'a1',
      targetDriverId: 'd2',
      activeDriverIdsAlreadyLinkedToAuthUser: ['d1'],
    }),
    'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED',
    'blocked second bind',
  )
  assertTrue(
    migration.includes('drivers_auth_user_id_active_unique_idx'),
    'unique index enforces',
  )
})

run('8. Existing Worker cannot be rebound to another Auth user', () => {
  assertEqual(
    assertAuthUserRebindAllowed({
      existingAuthUserId: 'a1',
      nextAuthUserId: 'a2',
    }),
    'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED',
    'rebind blocked',
  )
  assertEqual(
    assertAuthUserRebindAllowed({
      existingAuthUserId: null,
      nextAuthUserId: 'a1',
    }),
    'ok',
    'initial link allowed',
  )
  assertTrue(
    migration.includes("raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'"),
    'SQL exception code',
  )
  assertTrue(
    migration.includes('drevora_drivers_auth_user_id_guard'),
    'update guard trigger',
  )
})

run('9. Invite RPC always writes drivers.auth_user_id', () => {
  assertTrue(
    migration.includes('auth_user_id') &&
      migration.includes('p_auth_user_id') &&
      migration.includes('coalesce(auth_user_id, p_auth_user_id)'),
    'link path sets auth_user_id',
  )
  assertTrue(
    schema.includes('auth_user_id = coalesce(auth_user_id, p_auth_user_id)'),
    'schema link synced',
  )
})

run('10. Audit table + office SELECT / no client writes', () => {
  assertTrue(migration.includes('create table if not exists public.worker_identity_events'), 'table')
  assertTrue(schema.includes('create table if not exists public.worker_identity_events'), 'schema table')
  assertTrue(
    policies.includes('worker_identity_events_office_select_company'),
    'office select policy',
  )
  assertTrue(
    policies.includes('No INSERT/UPDATE/DELETE policies for authenticated'),
    'no client write policies note',
  )
  assertTrue(
    migration.includes('drevora_insert_worker_identity_event') &&
      migration.includes('grant execute on function public.drevora_insert_worker_identity_event') &&
      migration.includes('to service_role'),
    'security-definer writer for service_role',
  )
  assertTrue(
    !policies.includes('grant insert on table public.worker_identity_events to authenticated'),
    'no authenticated insert grant',
  )
})

run('11. Preflight + live verify diagnostics exist', () => {
  const preflight = read(PREFLIGHT)
  const live = read(LIVE_VERIFY)
  assertTrue(
    preflight.includes('ambiguous_driver_to_many_auth') &&
      preflight.includes('ambiguous_auth_to_many_drivers'),
    'preflight ambiguity checks',
  )
  assertTrue(
    preflight.includes("to_jsonb(d)->>'auth_user_id'") &&
      preflight.includes("to_jsonb(linked)->>'auth_user_id'"),
    'preflight uses to_jsonb extraction (safe before column exists)',
  )
  // Ban static column references that fail when the Auth-link column is absent.
  // Strip SQL comments so documentation text cannot false-positive.
  const preflightSql = preflight
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '')
  assertTrue(
    !/\bd\.auth_user_id\b/.test(preflightSql) &&
      !/\blinked\.auth_user_id\b/.test(preflightSql) &&
      !/\bdrivers\.auth_user_id\b/.test(preflightSql) &&
      !/\bwhere\s+auth_user_id\b/i.test(preflightSql) &&
      !/\bgroup by\s+auth_user_id\b/i.test(preflightSql),
    'preflight has no direct static drivers.auth_user_id column reference',
  )
  assertTrue(live.includes('drevora_auth_user_driver_id'), 'live resolve check')
  assertTrue(live.includes('worker_identity_events'), 'live audit permissions')
  assertTrue(
    live.includes('WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'),
    'live replacement guard check',
  )
})

run('12. auth_user_id excluded from client drivers UPDATE allowlist', () => {
  const updateGrant = policies.slice(
    policies.indexOf('grant update ('),
    policies.indexOf(') on table public.drivers to authenticated;'),
  )
  assertTrue(!updateGrant.includes('auth_user_id'), 'auth_user_id not updatable by client')
  assertTrue(
    policies.includes('auth_user_id') &&
      policies.includes('RPC / security-definer writes only'),
    'comment documents RPC-only',
  )
})

console.log(`\nverify-worker-identity-foundation: ${passed} passed`)

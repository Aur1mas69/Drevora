/**
 * Focused verification: Security Advisor Batch 5A — holiday helpers
 * relocated from public to drevora_private, with a single caller-body
 * schema-prefix fix.
 * Run: npm run verify:holiday-helpers-private
 *
 * Helpers (pure ALTER FUNCTION ... SET SCHEMA, no body rewrite):
 *   drevora_calculate_holiday_day_breakdown(uuid, date, date)
 *   drevora_worker_holiday_leave_type(uuid)
 *
 * Only caller body updated (same-signature CREATE OR REPLACE):
 *   public.drevora_enforce_holiday_request_worker_write()
 *
 * Static / deterministic — does not call Supabase or apply SQL.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let passed = 0

function assertTrue(value: boolean, message: string) {
  if (!value) throw new Error(message)
}

function run(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}

function read(relative: string): string {
  return readFileSync(resolve(relative), 'utf8').replace(/\r\n/g, '\n')
}

const HELPERS = [
  'drevora_calculate_holiday_day_breakdown',
  'drevora_worker_holiday_leave_type',
] as const

const TRIGGER_FN = 'drevora_enforce_holiday_request_worker_write'

const MIGRATION_PATH =
  'supabase/migrations/20260810210000_move_holiday_helpers_private.sql'
const migration = read(MIGRATION_PATH)

const migrationCode = migration
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')

const CANONICAL_TRIGGER_PATH =
  'supabase/migrations/20260715210000_enable_full_tenant_rls.sql'
const canonical = read(CANONICAL_TRIGGER_PATH)

function extractFunctionBody(src: string, fnName: string): string {
  const re = new RegExp(
    `create or replace function public\\.${fnName}\\(\\)[\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`,
    'i',
  )
  const m = re.exec(src)
  if (!m) throw new Error(`could not extract body for ${fnName}`)
  return m[1]
}

run('1. Exactly 2 helpers move via ALTER FUNCTION ... SET SCHEMA drevora_private', () => {
  const moveRe =
    /alter function public\.([a-z0-9_]+)\([^)]*\)\s*set schema drevora_private;/gi
  const moved = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = moveRe.exec(migrationCode)) !== null) {
    moved.add(m[1])
  }
  assertTrue(moved.size === 2, `exactly 2 helpers moved, got ${moved.size}: ${[...moved].join(', ')}`)
  for (const fn of HELPERS) {
    assertTrue(moved.has(fn), `${fn} has ALTER FUNCTION ... SET SCHEMA`)
  }
})

run('2. Helpers are not body-rewritten; only the holiday enforce trigger is CREATE OR REPLACE', () => {
  for (const fn of HELPERS) {
    assertTrue(
      !new RegExp(`create\\s+or\\s+replace\\s+function\\s+\\S*${fn}\\s*\\(`, 'i').test(
        migrationCode,
      ),
      `${fn} body is not recreated`,
    )
  }
  assertTrue(!/drop\s+function/i.test(migrationCode), 'no DROP FUNCTION')
  const createRe =
    /create\s+or\s+replace\s+function\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi
  const created = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = createRe.exec(migrationCode)) !== null) {
    created.add(m[1])
  }
  assertTrue(
    created.size === 1 && created.has(TRIGGER_FN),
    `exactly one CREATE OR REPLACE (the trigger), got: ${[...created].join(', ')}`,
  )
})

run('3. Trigger rewrite changes ONLY the two helper schema prefixes', () => {
  const canonicalBody = extractFunctionBody(canonical, TRIGGER_FN)
  // Use the full migration text (not comment-stripped) so in-body SQL comments
  // that are part of the canonical trigger source are preserved for comparison.
  const migrationBody = extractFunctionBody(migration, TRIGGER_FN)

  const normalize = (body: string) =>
    body
      .replace(/drevora_private\.drevora_calculate_holiday_day_breakdown/g, 'public.drevora_calculate_holiday_day_breakdown')
      .replace(/drevora_private\.drevora_worker_holiday_leave_type/g, 'public.drevora_worker_holiday_leave_type')
      .replace(/\s+/g, ' ')
      .trim()

  assertTrue(
    normalize(migrationBody) === normalize(canonicalBody),
    'after rewriting private->public schema prefixes, trigger body matches canonical 20260715210000 body',
  )

  const privateLeave = (migrationBody.match(/drevora_private\.drevora_worker_holiday_leave_type/g) || [])
    .length
  const privateBreakdown = (
    migrationBody.match(/drevora_private\.drevora_calculate_holiday_day_breakdown/g) || []
  ).length
  assertTrue(privateLeave === 2, `expected 2 private leave_type calls, got ${privateLeave}`)
  assertTrue(
    privateBreakdown === 2,
    `expected 2 private calculate_holiday_day_breakdown calls, got ${privateBreakdown}`,
  )
  assertTrue(
    !/public\.drevora_worker_holiday_leave_type/.test(migrationBody),
    'no stale public.drevora_worker_holiday_leave_type in rewritten body',
  )
  assertTrue(
    !/public\.drevora_calculate_holiday_day_breakdown/.test(migrationBody),
    'no stale public.drevora_calculate_holiday_day_breakdown in rewritten body',
  )
  assertTrue(
    /public\.drevora_is_trusted_tenant_writer/.test(migrationBody) &&
      /public\.drevora_auth_user_has_office_role_for_company/.test(migrationBody) &&
      /public\.drevora_auth_user_driver_id/.test(migrationBody),
    'unrelated public.* helper references preserved',
  )
  assertTrue(
    /security invoker/i.test(migrationCode) &&
      /set search_path = public/.test(
        migrationCode.slice(
          migrationCode.search(/create or replace function public\.drevora_enforce_holiday_request_worker_write/i),
        ),
      ),
    'trigger retains SECURITY INVOKER and search_path = public',
  )
})

run('4. Migration captures OIDs and asserts helper + trigger OID preservation', () => {
  assertTrue(
    /create temporary table drevora_batch5a_captured_oids/.test(migrationCode),
    'captures OIDs into temporary table',
  )
  for (const fn of [...HELPERS, TRIGGER_FN]) {
    assertTrue(migration.includes(`'${fn}'`), `OID capture/assertion references ${fn}`)
  }
  assertTrue(
    /calculate_holiday_day_breakdown OID changed/.test(migration),
    'asserts calculate_holiday_day_breakdown OID equality',
  )
  assertTrue(
    /worker_holiday_leave_type OID changed/.test(migration),
    'asserts worker_holiday_leave_type OID equality',
  )
  assertTrue(
    /enforce_holiday_request_worker_write OID changed/.test(migration),
    'asserts trigger function OID equality after same-signature REPLACE',
  )
})

run('5. Migration asserts helper final posture and zero pg_policy dependencies', () => {
  assertTrue(/prosecdef/.test(migrationCode), 'asserts SECURITY DEFINER retained on helpers')
  assertTrue(/provolatile = .s./.test(migrationCode), "asserts volatility remains 'stable'")
  assertTrue(
    /alter function drevora_private\.drevora_calculate_holiday_day_breakdown\(uuid, date, date\)\s*set search_path = ''/i.test(
      migrationCode,
    ),
    'hardens calculate_holiday_day_breakdown search_path to empty string',
  )
  assertTrue(
    /alter function drevora_private\.drevora_worker_holiday_leave_type\(uuid\)\s*set search_path = ''/i.test(
      migrationCode,
    ),
    'hardens worker_holiday_leave_type search_path to empty string',
  )
  assertTrue(
    /has_function_privilege\('authenticated'/.test(migrationCode),
    'asserts authenticated EXECUTE',
  )
  assertTrue(
    /has_function_privilege\('public'/.test(migrationCode) &&
      /has_function_privilege\('anon'/.test(migrationCode),
    'asserts PUBLIC/anon EXECUTE absent',
  )
  const depCount = (migrationCode.match(/classid = 'pg_policy'::regclass/g) || []).length
  assertTrue(depCount >= 2, `expected precondition + post-move pg_policy checks, found ${depCount}`)
})

run('6. Migration asserts trigger attachment unchanged and stale public helper refs absent', () => {
  assertTrue(
    /tgname = 'drevora_enforce_holiday_request_worker_write'/.test(migrationCode),
    'checks trigger name on holiday_requests',
  )
  assertTrue(
    /c\.relname = 'holiday_requests'/.test(migrationCode),
    'checks trigger is attached to public.holiday_requests',
  )
  assertTrue(
    /stale public\.drevora_worker_holiday_leave_type/.test(migration),
    'rejects stale public leave_type reference in trigger prosrc',
  )
  assertTrue(
    /stale public\.drevora_calculate_holiday_day_breakdown/.test(migration),
    'rejects stale public breakdown reference in trigger prosrc',
  )
  assertTrue(
    /missing drevora_private\.drevora_worker_holiday_leave_type/.test(migration),
    'requires private leave_type reference in trigger prosrc',
  )
  assertTrue(
    /missing drevora_private\.drevora_calculate_holiday_day_breakdown/.test(migration),
    'requires private breakdown reference in trigger prosrc',
  )
})

run('7. No RLS policy changes; no unrelated schema/privilege churn; no service_role grant', () => {
  assertTrue(!/drop\s+policy\b/i.test(migrationCode), 'no DROP POLICY')
  assertTrue(!/create\s+policy\b/i.test(migrationCode), 'no CREATE POLICY')
  assertTrue(!/alter\s+policy\b/i.test(migrationCode), 'no ALTER POLICY')
  assertTrue(!/create schema/i.test(migrationCode), 'does not (re)create drevora_private')
  assertTrue(
    !/grant\s+(usage|create)\s+on\s+schema\s+drevora_private/i.test(migrationCode),
    'does not modify schema-level privileges',
  )
  assertTrue(!/to\s+service_role/i.test(migrationCode), 'no service_role grant added')
  assertTrue(
    !/drevora_is_trusted_tenant_writer\(\)\s*set schema/i.test(migrationCode) &&
      !/drevora_company_workers_manage_timesheets/i.test(migrationCode.match(/alter function[\s\S]+?set schema/gi)?.join('\n') || ''),
    'does not move unrelated Batch 5 candidates',
  )
})

run('8. Migration is wrapped in one explicit transaction and reloads PostgREST schema cache', () => {
  assertTrue(migrationCode.includes('begin;'), 'wrapped in a transaction')
  assertTrue(migrationCode.includes('commit;'), 'transaction committed')
  assertTrue(
    migrationCode.includes("notify pgrst, 'reload schema';"),
    'notifies PostgREST to reload its schema cache',
  )
})

console.log(`\nAll ${passed} checks passed.`)

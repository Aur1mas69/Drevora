/**
 * Focused verification: Security Advisor Batch 5B — Timesheet-management
 * helper relocated from public to drevora_private, with its 2 known trigger
 * callers' single call-site schema-prefix fix.
 * Run: npm run verify:timesheet-management-helper-private
 *
 * Helper (pure ALTER FUNCTION ... SET SCHEMA, no body rewrite):
 *   drevora_company_workers_manage_timesheets(uuid)
 *
 * Only caller bodies updated (same-signature CREATE OR REPLACE, one call
 * site each):
 *   public.drevora_enforce_timesheet_worker_write()
 *   public.drevora_enforce_timesheet_entry_worker_write()
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

const HELPER = 'drevora_company_workers_manage_timesheets'
const TRIGGER_FNS = [
  'drevora_enforce_timesheet_worker_write',
  'drevora_enforce_timesheet_entry_worker_write',
] as const

const EXPECTED_POLICIES = [
  'driver_timesheet_settings_worker_delete_own',
  'driver_timesheet_settings_worker_insert_own',
  'driver_timesheet_settings_worker_update_own',
  'timesheet_entries_worker_insert_own',
  'timesheet_entries_worker_update_own',
  'timesheets_worker_insert_own',
  'timesheets_worker_update_own',
] as const

const MIGRATION_PATH =
  'supabase/migrations/20260810220000_move_timesheet_management_helper_private.sql'
const migration = read(MIGRATION_PATH)

const migrationCode = migration
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')

const CANONICAL_PATH =
  'supabase/migrations/20260804180000_timesheet_management_scope_worker_writes.sql'
const canonical = read(CANONICAL_PATH)

function extractFunctionBody(src: string, fnName: string): string {
  const re = new RegExp(
    `create or replace function public\\.${fnName}\\(\\)[\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`,
    'i',
  )
  const m = re.exec(src)
  if (!m) throw new Error(`could not extract body for ${fnName}`)
  return m[1]
}

run('1. Exactly 1 helper moves via ALTER FUNCTION ... SET SCHEMA drevora_private', () => {
  const moveRe =
    /alter function public\.([a-z0-9_]+)\([^)]*\)\s*set schema drevora_private;/gi
  const moved = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = moveRe.exec(migrationCode)) !== null) {
    moved.add(m[1])
  }
  assertTrue(moved.size === 1, `exactly 1 helper moved, got ${moved.size}: ${[...moved].join(', ')}`)
  assertTrue(moved.has(HELPER), `${HELPER} has ALTER FUNCTION ... SET SCHEMA`)
})

run('2. Helper is not body-rewritten; only the 2 trigger functions are CREATE OR REPLACE', () => {
  assertTrue(
    !new RegExp(`create\\s+or\\s+replace\\s+function\\s+\\S*${HELPER}\\s*\\(`, 'i').test(
      migrationCode,
    ),
    `${HELPER} body is not recreated`,
  )
  assertTrue(!/drop\s+function/i.test(migrationCode), 'no DROP FUNCTION')
  const createRe =
    /create\s+or\s+replace\s+function\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi
  const created = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = createRe.exec(migrationCode)) !== null) {
    created.add(m[1])
  }
  assertTrue(
    created.size === 2 && TRIGGER_FNS.every((fn) => created.has(fn)),
    `exactly the 2 trigger functions are CREATE OR REPLACE, got: ${[...created].join(', ')}`,
  )
})

run('3. Trigger rewrites change ONLY the helper schema prefix at their single call site', () => {
  for (const fn of TRIGGER_FNS) {
    const canonicalBody = extractFunctionBody(canonical, fn)
    const migrationBody = extractFunctionBody(migration, fn)

    const normalize = (body: string) =>
      body
        .replace(
          new RegExp(`drevora_private\\.${HELPER}`, 'g'),
          `public.${HELPER}`,
        )
        .replace(/\s+/g, ' ')
        .trim()

    assertTrue(
      normalize(migrationBody) === normalize(canonicalBody),
      `after rewriting private->public schema prefix, ${fn} body matches canonical 20260804180000 body`,
    )

    const privateCalls = (
      migrationBody.match(new RegExp(`drevora_private\\.${HELPER}`, 'g')) || []
    ).length
    assertTrue(privateCalls === 1, `expected exactly 1 private ${HELPER} call in ${fn}, got ${privateCalls}`)
    assertTrue(
      !new RegExp(`public\\.${HELPER}`).test(migrationBody),
      `no stale public.${HELPER} reference in rewritten ${fn} body`,
    )
    assertTrue(
      /public\.drevora_is_trusted_tenant_writer/.test(migrationBody) &&
        /public\.drevora_auth_user_has_office_role_for_company/.test(migrationBody) &&
        /public\.drevora_auth_user_driver_id/.test(migrationBody),
      `unrelated public.* helper references preserved in ${fn}`,
    )
  }

  assertTrue(
    /public\.timesheets t/.test(
      extractFunctionBody(migration, 'drevora_enforce_timesheet_entry_worker_write'),
    ),
    'drevora_enforce_timesheet_entry_worker_write still reads from public.timesheets',
  )

  for (const fn of TRIGGER_FNS) {
    const fnSlice = migrationCode.slice(
      migrationCode.search(new RegExp(`create or replace function public\\.${fn}`, 'i')),
    )
    assertTrue(
      /security invoker/i.test(fnSlice.slice(0, fnSlice.indexOf('as $$'))) &&
        /set search_path = public/.test(fnSlice.slice(0, fnSlice.indexOf('as $$'))),
      `${fn} retains SECURITY INVOKER and search_path = public`,
    )
  }
})

run('4. Migration captures OIDs and asserts helper + both trigger OID preservation', () => {
  assertTrue(
    /create temporary table drevora_batch5b_captured_oids/.test(migrationCode),
    'captures OIDs into temporary table',
  )
  for (const fn of [HELPER, ...TRIGGER_FNS]) {
    assertTrue(migration.includes(`'${fn}'`), `OID capture/assertion references ${fn}`)
  }
  assertTrue(/helper OID changed/.test(migration), 'asserts helper OID equality')
  assertTrue(
    /drevora_enforce_timesheet_worker_write OID changed/.test(migration),
    'asserts drevora_enforce_timesheet_worker_write OID equality after same-signature REPLACE',
  )
  assertTrue(
    /drevora_enforce_timesheet_entry_worker_write OID changed/.test(migration),
    'asserts drevora_enforce_timesheet_entry_worker_write OID equality after same-signature REPLACE',
  )
})

run('5. Migration asserts helper final posture (SECURITY DEFINER, stable, search_path="", privileges)', () => {
  assertTrue(/prosecdef/.test(migrationCode), 'asserts SECURITY DEFINER retained on helper')
  assertTrue(/provolatile = .s./.test(migrationCode), "asserts volatility remains 'stable'")
  assertTrue(
    /alter function drevora_private\.drevora_company_workers_manage_timesheets\(uuid\)\s*set search_path = ''/i.test(
      migrationCode,
    ),
    'hardens helper search_path to empty string',
  )
  assertTrue(
    /search_path=""/.test(migrationCode),
    'asserts canonical empty search_path form post-move',
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
})

run('6. Migration proves exactly 7 DISTINCT policy dependents (10 raw pg_depend rows) before and after', () => {
  const rawCountAssertions = (migrationCode.match(/v_raw_dep_count <> 10/g) || []).length
  const distinctCountAssertions = (migrationCode.match(/v_distinct_policy_count <> 7/g) || []).length
  assertTrue(rawCountAssertions >= 2, `expected precondition + post-move raw (10-row) checks, found ${rawCountAssertions}`)
  assertTrue(
    distinctCountAssertions >= 2,
    `expected precondition + post-move DISTINCT (7-policy) checks, found ${distinctCountAssertions}`,
  )
  assertTrue(
    /count\(distinct pol\.oid\)/i.test(migrationCode),
    'uses DISTINCT policy OID counting (not raw pg_depend row counting) to derive the 7-policy figure',
  )
  for (const policy of EXPECTED_POLICIES) {
    assertTrue(migration.includes(`'${policy}'`), `expected policy set includes ${policy}`)
  }
  const expectedArrayOccurrences = (migrationCode.match(/v_expected_names constant text\[\]/g) || []).length
  assertTrue(expectedArrayOccurrences === 2, `expected 2 declarations of the expected-policy-name array (precondition + assertion), found ${expectedArrayOccurrences}`)
})

run('7. Migration asserts trigger attachments unchanged and stale/required references correctly checked', () => {
  assertTrue(
    /tgname = 'drevora_enforce_timesheet_worker_write'/.test(migrationCode) &&
      /c\.relname = 'timesheets'/.test(migrationCode),
    'checks drevora_enforce_timesheet_worker_write trigger is attached to public.timesheets',
  )
  assertTrue(
    /tgname = 'drevora_enforce_timesheet_entry_worker_write'/.test(migrationCode) &&
      /c\.relname = 'timesheet_entries'/.test(migrationCode),
    'checks drevora_enforce_timesheet_entry_worker_write trigger is attached to public.timesheet_entries',
  )
  assertTrue(
    /still contains a stale public\.drevora_company_workers_manage_timesheets reference/.test(migration),
    'rejects stale public.drevora_company_workers_manage_timesheets reference in both trigger bodies',
  )
  assertTrue(
    /missing required drevora_private\.drevora_company_workers_manage_timesheets reference/.test(migration),
    'requires drevora_private.drevora_company_workers_manage_timesheets reference in both trigger bodies',
  )
})

run('8. No RLS policy changes; no unrelated schema/privilege churn; no service_role grant', () => {
  assertTrue(!/drop\s+policy\b/i.test(migrationCode), 'no DROP POLICY')
  assertTrue(!/create\s+policy\b/i.test(migrationCode), 'no CREATE POLICY')
  assertTrue(!/alter\s+policy\b/i.test(migrationCode), 'no ALTER POLICY')
  assertTrue(!/create schema/i.test(migrationCode), 'does not (re)create drevora_private')
  assertTrue(
    !/grant\s+(usage|create)\s+on\s+schema\s+drevora_private/i.test(migrationCode),
    'does not modify schema-level privileges',
  )
  assertTrue(!/to\s+service_role/i.test(migrationCode), 'no service_role grant added')
})

run('9. Migration is wrapped in one explicit transaction and reloads PostgREST schema cache', () => {
  assertTrue(migrationCode.includes('begin;'), 'wrapped in a transaction')
  assertTrue(migrationCode.includes('commit;'), 'transaction committed')
  assertTrue(
    migrationCode.includes("notify pgrst, 'reload schema';"),
    'notifies PostgREST to reload its schema cache',
  )
})

console.log(`\nAll ${passed} checks passed.`)

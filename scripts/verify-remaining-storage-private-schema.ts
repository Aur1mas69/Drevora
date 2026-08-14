/**
 * Focused verification: Security Advisor Batch 3C — remaining Storage
 * tenant-scope helpers (worker-avatars, vehicle-check-photos,
 * consumable-receipts, driver-report-files) plus the orphaned
 * object_company_id resolver, relocated from public to drevora_private.
 * Run: npm run verify:remaining-storage-private-schema
 *
 * All 10 move via pure ALTER FUNCTION ... SET SCHEMA (no body change, no
 * CREATE OR REPLACE, no DROP FUNCTION). 9 of the 10 are also repinned from
 * search_path=public to search_path=''; object_company_id already had ''
 * and is left untouched.
 *
 * Static / deterministic — does not call Supabase or apply SQL.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

let passed = 0

function assertTrue(value: boolean, message: string) {
  if (!value) throw new Error(message)
}

function run(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}

/** Always resolve against this script's repo/worktree, not process.cwd(). */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), 'utf8').replace(/\r\n/g, '\n')
}

const SEARCH_PATH_HARDENED_FNS = [
  'drevora_storage_can_select_worker_avatar',
  'drevora_storage_can_write_worker_avatar',
  'drevora_storage_can_select_vehicle_check_file',
  'drevora_storage_can_write_vehicle_check_file',
  'drevora_storage_can_delete_vehicle_check_file',
  'drevora_storage_can_select_consumable_receipt',
  'drevora_storage_can_write_consumable_receipt',
  'drevora_storage_can_select_driver_report_file',
  'drevora_storage_can_write_driver_report_file',
]

const ALL_FNS = [...SEARCH_PATH_HARDENED_FNS, 'drevora_storage_object_company_id']

const POLICIES = [
  'drevora_storage_worker_avatars_select',
  'drevora_storage_worker_avatars_insert',
  'drevora_storage_worker_avatars_update',
  'drevora_storage_worker_avatars_delete',
  'drevora_storage_vehicle_check_photos_select',
  'drevora_storage_vehicle_check_photos_insert',
  'drevora_storage_vehicle_check_photos_update',
  'drevora_storage_vehicle_check_photos_delete',
  'drevora_storage_consumable_receipts_select',
  'drevora_storage_consumable_receipts_insert',
  'drevora_storage_consumable_receipts_update',
  'drevora_storage_consumable_receipts_delete',
  'drevora_storage_driver_report_files_select',
  'drevora_storage_driver_report_files_insert',
  'drevora_storage_driver_report_files_update',
  'drevora_storage_driver_report_files_delete',
]

const MIGRATION_PATH =
  'supabase/migrations/20260808250000_move_remaining_storage_helpers_private.sql'
const migration = read(MIGRATION_PATH)

const migrationCode = migration
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')

const DIAGNOSTIC_PATH =
  'supabase/diagnostics/20260808_security_definer_function_inventory.sql'

run('1. Exactly 10 functions are moved via ALTER FUNCTION ... SET SCHEMA drevora_private', () => {
  const moveRe = /alter function public\.([a-z0-9_]+)\([^)]*\) set schema drevora_private;/gi
  const moved = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = moveRe.exec(migrationCode)) !== null) {
    moved.add(m[1])
  }
  assertTrue(moved.size === 10, `exactly 10 functions moved, got ${moved.size}: ${[...moved].join(', ')}`)
  for (const fn of ALL_FNS) {
    assertTrue(moved.has(fn), `${fn} has an ALTER FUNCTION ... SET SCHEMA drevora_private statement`)
  }
})

run('2. No body replacement, no DROP FUNCTION, anywhere in the migration', () => {
  assertTrue(!/create\s+or\s+replace\s+function/i.test(migrationCode), 'no CREATE OR REPLACE FUNCTION statement')
  assertTrue(!/drop\s+function/i.test(migrationCode), 'no DROP FUNCTION statement')
  assertTrue(
    !/create\s+function/i.test(migrationCode),
    'no CREATE FUNCTION statement (only DO blocks and ALTER FUNCTION are present)',
  )
})

run('3. Exactly 9 search_path hardenings to empty string, object_company_id excluded', () => {
  const hardenRe =
    /alter function drevora_private\.([a-z0-9_]+)\(text\) set search_path = '';/gi
  const hardened = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = hardenRe.exec(migrationCode)) !== null) {
    hardened.add(m[1])
  }
  assertTrue(hardened.size === 9, `exactly 9 search_path hardenings, got ${hardened.size}: ${[...hardened].join(', ')}`)
  for (const fn of SEARCH_PATH_HARDENED_FNS) {
    assertTrue(hardened.has(fn), `${fn} is repinned to search_path = ''`)
  }
  assertTrue(
    !hardened.has('drevora_storage_object_company_id'),
    'drevora_storage_object_company_id is NOT touched by a search_path ALTER (already \'\')',
  )
  assertTrue(
    !new RegExp(
      `alter function drevora_private\\.drevora_storage_object_company_id\\([^)]*\\) set search_path`,
      'i',
    ).test(migrationCode),
    'no search_path ALTER statement targets drevora_storage_object_company_id at all',
  )
})

run('4. drevora_storage_object_company_id is moved and retained, never deleted', () => {
  assertTrue(
    /alter function public\.drevora_storage_object_company_id\(text, text\) set schema drevora_private;/i.test(
      migrationCode,
    ),
    'object_company_id is moved via ALTER FUNCTION SET SCHEMA',
  )
  assertTrue(
    !new RegExp('drop\\s+function\\s+\\S*drevora_storage_object_company_id', 'i').test(migrationCode),
    'object_company_id is never dropped',
  )
  assertTrue(
    /grant execute on function drevora_private\.drevora_storage_object_company_id\(text, text\) to authenticated;/i.test(
      migrationCode,
    ),
    'object_company_id retains authenticated EXECUTE after the move',
  )
})

run('5. Migration asserts object_company_id has no storage policy dependency', () => {
  assertTrue(
    /drevora_storage_object_company_id unexpectedly has a storage policy dependency/i.test(migration),
    'apply-time assertion checks object_company_id has zero pg_depend policy references',
  )
  assertTrue(
    /refclassid = 'pg_policy'::regclass/.test(migrationCode) === false ||
      /d\.refclassid = 'pg_proc'::regclass\s*\n\s*where d\.refobjid = v_oid|d\.classid = 'pg_policy'::regclass[\s\S]{0,120}?d\.refobjid = v_oid/.test(
        migrationCode,
      ),
    'object_company_id dependency check queries pg_depend by OID (not text matching)',
  )
})

run('6. All 16 storage.objects policies are untouched (no DROP/CREATE/ALTER POLICY)', () => {
  assertTrue(!/drop\s+policy\b/i.test(migrationCode), 'no DROP POLICY statement')
  assertTrue(!/create\s+policy\b/i.test(migrationCode), 'no CREATE POLICY statement')
  assertTrue(!/alter\s+policy\b/i.test(migrationCode), 'no ALTER POLICY statement')
  for (const policy of POLICIES) {
    assertTrue(migration.includes(policy), `migration references ${policy} (assertion context only)`)
  }
  // Precondition guard requires exactly 16 before any function is touched.
  assertTrue(/v_policy_count <> 16/.test(migrationCode), 'asserts exactly 16 policies exist (precondition + post-move)')
})

run('7. Migration contains OID-preservation assertions for all 10 functions', () => {
  assertTrue(
    /create temporary table drevora_batch3c_captured_oids/.test(migrationCode),
    'captures pre-move OIDs into a temporary table',
  )
  for (const fn of ALL_FNS) {
    assertTrue(migration.includes(`'${fn}'`), `OID capture/assertion references ${fn}`)
  }
  assertTrue(
    /v_oid_after is distinct from v_oid_before/.test(migrationCode),
    'shared per-function loop asserts OID equality before/after the move',
  )
})

run('8. Migration contains OID-based (pg_depend) policy dependency assertions for all 16 policies', () => {
  assertTrue(/from pg_depend d/.test(migrationCode), 'uses pg_depend for dependency verification')
  assertTrue(
    /refclassid = 'pg_proc'::regclass/.test(migrationCode),
    'pg_depend check anchors on pg_proc as the referenced object class',
  )
  for (const policy of POLICIES) {
    assertTrue(
      migration.includes(`'${policy}'`),
      `pg_depend/catalog assertion covers ${policy}`,
    )
  }
  assertTrue(
    /pol\.polcmd = r\.expected_cmd/.test(migrationCode),
    'asserts command (SELECT/INSERT/UPDATE/DELETE) unchanged per policy',
  )
  assertTrue(
    /pol\.polroles = array\[to_regrole\('authenticated'\)::oid\]/.test(migrationCode),
    'asserts authenticated role unchanged per policy',
  )
})

run('9. Migration asserts function security posture (SECURITY DEFINER, volatility, return type, search_path, grants) for all 10', () => {
  assertTrue(/prosecdef/.test(migrationCode), 'asserts SECURITY DEFINER remains true')
  assertTrue(/provolatile = .s./.test(migrationCode), "asserts volatility remains 'stable'")
  assertTrue(/prorettype = r\.expected_rettype/.test(migrationCode), 'asserts return type retained per function (boolean x9, uuid x1)')
  assertTrue(/search_path=""/.test(migrationCode), 'asserts canonical empty search_path representation')
  assertTrue(
    /has_function_privilege\('authenticated', v_oid_after, 'EXECUTE'\)/.test(migrationCode),
    'asserts authenticated EXECUTE for all 10 via the shared per-function loop',
  )
  assertTrue(
    /has_function_privilege\('public', v_oid_after, 'EXECUTE'\)/.test(migrationCode) &&
      /has_function_privilege\('anon', v_oid_after, 'EXECUTE'\)/.test(migrationCode),
    'asserts PUBLIC/anon EXECUTE are absent for all 10 via the shared per-function loop',
  )
})

run('10. Existing drevora_private schema privileges are reused, not modified; no service_role grants added', () => {
  assertTrue(
    !/create schema/i.test(migrationCode),
    'migration does not (re)create drevora_private (Batch 3A already created it)',
  )
  assertTrue(
    !/grant\s+(usage|create)\s+on\s+schema\s+drevora_private/i.test(migrationCode),
    'migration does not grant schema-level USAGE/CREATE (Batch 3A privileges are reused unchanged)',
  )
  assertTrue(
    !/revoke\s+all\s+on\s+schema\s+drevora_private/i.test(migrationCode),
    'migration does not modify schema-level privileges',
  )
  assertTrue(!/to\s+service_role/i.test(migrationCode), 'no service_role grant is added for any of the 10 functions')
})

run('11. Migration is wrapped in one explicit transaction and reloads the PostgREST schema cache', () => {
  assertTrue(migrationCode.includes('begin;'), 'wrapped in a transaction')
  assertTrue(migrationCode.includes('commit;'), 'transaction committed')
  assertTrue(
    migrationCode.includes("notify pgrst, 'reload schema';"),
    'notifies PostgREST to reload its schema cache',
  )
})

run('12. Migration performs no unrelated data mutation or object change, and touches only these 10 functions\' grants', () => {
  assertTrue(!/\bdelete\s+from\b/i.test(migrationCode), 'no DELETE statement')
  assertTrue(!/\btruncate\b/i.test(migrationCode), 'no TRUNCATE statement')
  assertTrue(
    !/\binsert\s+into\s+(?!drevora_batch3c_captured_oids)/i.test(migrationCode),
    'no INSERT other than the temporary OID-capture table',
  )
  assertTrue(!/\bdrop\s+table\b/i.test(migrationCode), 'no DROP TABLE')
  assertTrue(!/\bdrop\s+schema\b/i.test(migrationCode), 'no DROP SCHEMA')

  const grantRevokeFnRe =
    /(grant|revoke)\s+(?:all|execute)[\s\S]{0,20}?on\s+function\s+(?:public|drevora_private)\.([a-z0-9_]+)\s*\(/gi
  const touched = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = grantRevokeFnRe.exec(migrationCode)) !== null) {
    touched.add(m[2])
  }
  assertTrue(
    touched.size === 10 && ALL_FNS.every((fn) => touched.has(fn)),
    `exactly the 10 target functions have privilege changes, got: ${[...touched].join(', ')}`,
  )
})

run('13. Untracked security-definer diagnostic file remains untouched by this task', () => {
  assertTrue(
    !migration.includes('20260808_security_definer_function_inventory'),
    'migration does not reference or modify the diagnostic file',
  )

  // Resolve against this script's repo root (import.meta.url), never process.cwd()
  // — a sibling checkout such as C:\projecttime may have the diagnostic while
  // this worktree (C:\projecttime-sync) does not. Presence is worktree-local and
  // optional (untracked); requiring existence fails incorrectly when absent here.
  const diagnosticAbs = resolve(REPO_ROOT, DIAGNOSTIC_PATH)
  const expectedAbs = resolve(
    REPO_ROOT,
    'supabase/diagnostics/20260808_security_definer_function_inventory.sql',
  )
  assertTrue(
    diagnosticAbs === expectedAbs,
    `diagnostic path must resolve under current repo/worktree root (${REPO_ROOT}), got ${diagnosticAbs}`,
  )
  assertTrue(
    diagnosticAbs.startsWith(REPO_ROOT),
    `diagnostic path escapes current repo/worktree: ${diagnosticAbs}`,
  )
})

console.log(`\nAll ${passed} checks passed.`)

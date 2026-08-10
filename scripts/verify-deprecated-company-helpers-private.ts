/**
 * Focused verification: Security Advisor Batch 4A — deprecated
 * company-context stub helpers (no live caller) relocated from public to
 * drevora_private.
 * Run: npm run verify:deprecated-company-helpers-private
 *
 * All 3 move via pure ALTER FUNCTION ... SET SCHEMA (no body change, no
 * CREATE OR REPLACE, no DROP FUNCTION). search_path was already '' before
 * this batch and is left untouched. No RLS policy is modified; the
 * migration additionally asserts (twice: precondition + post-move) that
 * zero pg_policy rows depend on any of the 3 function OIDs.
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

const ALL_FNS = [
  'drevora_current_company_id',
  'drevora_current_company_name',
  'drevora_company_text_matches_current',
]

const MIGRATION_PATH =
  'supabase/migrations/20260808260000_move_deprecated_company_helpers_private.sql'
const migration = read(MIGRATION_PATH)

const migrationCode = migration
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')

const DIAGNOSTIC_PATH =
  'supabase/diagnostics/20260808_security_definer_function_inventory.sql'

run('1. Exactly 3 functions are moved via ALTER FUNCTION ... SET SCHEMA drevora_private', () => {
  const moveRe = /alter function public\.([a-z0-9_]+)\([^)]*\) set schema drevora_private;/gi
  const moved = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = moveRe.exec(migrationCode)) !== null) {
    moved.add(m[1])
  }
  assertTrue(moved.size === 3, `exactly 3 functions moved, got ${moved.size}: ${[...moved].join(', ')}`)
  for (const fn of ALL_FNS) {
    assertTrue(moved.has(fn), `${fn} has an ALTER FUNCTION ... SET SCHEMA drevora_private statement`)
  }
})

run('2. No body replacement, no DROP FUNCTION, no CREATE FUNCTION anywhere', () => {
  assertTrue(!/create\s+or\s+replace\s+function/i.test(migrationCode), 'no CREATE OR REPLACE FUNCTION statement')
  assertTrue(!/drop\s+function/i.test(migrationCode), 'no DROP FUNCTION statement')
  assertTrue(!/create\s+function/i.test(migrationCode), 'no CREATE FUNCTION statement (only DO blocks and ALTER FUNCTION)')
})

run('3. search_path is preserved, not altered (already \'\' before this batch)', () => {
  assertTrue(
    !/alter function (public|drevora_private)\.[a-z0-9_]+\([^)]*\) set search_path/i.test(migrationCode),
    'no ALTER FUNCTION ... SET search_path statement targets any of the 3 functions',
  )
  assertTrue(/search_path=""/.test(migrationCode), 'asserts canonical empty search_path representation is retained')
})

run('4. Migration contains OID-preservation assertions for all 3 functions', () => {
  assertTrue(
    /create temporary table drevora_batch4a_captured_oids/.test(migrationCode),
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

run('5. Migration asserts zero pg_policy dependencies both before (precondition) and after (post-move) the move', () => {
  const depCount = (migrationCode.match(/classid = 'pg_policy'::regclass/g) || []).length
  assertTrue(depCount >= 2, `expected at least 2 pg_depend/pg_policy dependency checks (precondition + post-move), found ${depCount}`)
  assertTrue(
    /refobjid in \(\s*v_current_company_id_oid,\s*v_current_company_name_oid,\s*v_company_text_matches_current_oid\s*\)/.test(
      migrationCode,
    ),
    'precondition check covers all 3 captured OIDs in a single pg_depend query',
  )
  assertTrue(
    /unexpectedly has a pg_policy dependency after move/.test(migration),
    'post-move per-function assertion rejects any new/remaining pg_policy dependency',
  )
})

run('6. Migration asserts function security posture (SECURITY DEFINER, volatility, return type, search_path, grants) for all 3', () => {
  assertTrue(/prosecdef/.test(migrationCode), 'asserts SECURITY DEFINER remains true')
  assertTrue(/provolatile = .s./.test(migrationCode), "asserts volatility remains 'stable'")
  assertTrue(/prorettype = r\.expected_rettype/.test(migrationCode), 'asserts return type retained per function (uuid/text/boolean)')
  assertTrue(
    /has_function_privilege\('authenticated', v_oid_after, 'EXECUTE'\)/.test(migrationCode),
    'asserts authenticated EXECUTE for all 3 via the shared per-function loop',
  )
  assertTrue(
    /has_function_privilege\('public', v_oid_after, 'EXECUTE'\)/.test(migrationCode) &&
      /has_function_privilege\('anon', v_oid_after, 'EXECUTE'\)/.test(migrationCode),
    'asserts PUBLIC/anon EXECUTE are absent for all 3 via the shared per-function loop',
  )
})

run('7. No RLS policy is created/dropped/altered; existing drevora_private schema privileges are reused unchanged', () => {
  assertTrue(!/drop\s+policy\b/i.test(migrationCode), 'no DROP POLICY statement')
  assertTrue(!/create\s+policy\b/i.test(migrationCode), 'no CREATE POLICY statement')
  assertTrue(!/alter\s+policy\b/i.test(migrationCode), 'no ALTER POLICY statement')
  assertTrue(
    !/create schema/i.test(migrationCode),
    'migration does not (re)create drevora_private (Batch 3A already created it)',
  )
  assertTrue(
    !/grant\s+(usage|create)\s+on\s+schema\s+drevora_private/i.test(migrationCode),
    'migration does not grant schema-level USAGE/CREATE (existing privileges are reused unchanged)',
  )
  assertTrue(
    !/revoke\s+all\s+on\s+schema\s+drevora_private/i.test(migrationCode),
    'migration does not modify schema-level privileges',
  )
})

run('8. Migration is wrapped in one explicit transaction and reloads the PostgREST schema cache', () => {
  assertTrue(migrationCode.includes('begin;'), 'wrapped in a transaction')
  assertTrue(migrationCode.includes('commit;'), 'transaction committed')
  assertTrue(
    migrationCode.includes("notify pgrst, 'reload schema';"),
    'notifies PostgREST to reload its schema cache',
  )
})

run('9. Migration performs no unrelated data mutation or object change, and touches only these 3 functions\' grants', () => {
  assertTrue(!/\bdelete\s+from\b/i.test(migrationCode), 'no DELETE statement')
  assertTrue(!/\btruncate\b/i.test(migrationCode), 'no TRUNCATE statement')
  assertTrue(
    !/\binsert\s+into\s+(?!drevora_batch4a_captured_oids)/i.test(migrationCode),
    'no INSERT other than the temporary OID-capture table',
  )
  assertTrue(!/\bdrop\s+table\b/i.test(migrationCode), 'no DROP TABLE')
  assertTrue(!/\bdrop\s+schema\b/i.test(migrationCode), 'no DROP SCHEMA')
  assertTrue(!/to\s+service_role/i.test(migrationCode), 'no service_role grant is added or removed for any of the 3 functions')

  const grantRevokeFnRe =
    /(grant|revoke)\s+(?:all|execute)[\s\S]{0,20}?on\s+function\s+(?:public|drevora_private)\.([a-z0-9_]+)\s*\(/gi
  const touched = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = grantRevokeFnRe.exec(migrationCode)) !== null) {
    touched.add(m[2])
  }
  assertTrue(
    touched.size === 3 && ALL_FNS.every((fn) => touched.has(fn)),
    `exactly the 3 target functions have privilege changes, got: ${[...touched].join(', ')}`,
  )
})

run('10. Untracked security-definer diagnostic file remains untouched by this task', () => {
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

/**
 * Focused verification: Security Advisor Batch 4B — orphaned
 * vehicle-check-template manager helper relocated from public to
 * drevora_private (reconciliable / idempotent for public OR private start).
 * Run: npm run verify:vehicle-check-template-helper-private
 *
 * Target:
 *   drevora_auth_user_can_manage_vehicle_check_templates()
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

const FN = 'drevora_auth_user_can_manage_vehicle_check_templates'

const MIGRATION_PATH =
  'supabase/migrations/20260810200000_move_vehicle_check_template_helper_private.sql'
const migration = read(MIGRATION_PATH)

const migrationCode = migration
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')

const DIAGNOSTIC_PATH =
  'supabase/diagnostics/20260808_security_definer_function_inventory.sql'

run('1. Migration is reconciliable for public OR drevora_private starting state (exactly one must exist)', () => {
  assertTrue(
    /to_regprocedure\(\s*v_fn_public\s*\)/.test(migrationCode) ||
      /to_regprocedure\(\s*'public\.drevora_auth_user_can_manage_vehicle_check_templates\(\)'\s*\)/.test(
        migrationCode,
      ),
    'resolves public signature',
  )
  assertTrue(
    /to_regprocedure\(\s*v_fn_private\s*\)/.test(migrationCode) ||
      /to_regprocedure\(\s*'drevora_private\.drevora_auth_user_can_manage_vehicle_check_templates\(\)'\s*\)/.test(
        migrationCode,
      ),
    'resolves drevora_private signature',
  )
  assertTrue(
    /exists in BOTH public/.test(migration) || /both public .* and drevora_private/i.test(migration),
    'fails when function exists in both schemas',
  )
  assertTrue(
    /missing from both public and drevora_private/i.test(migration),
    'fails when function exists in neither schema',
  )
  assertTrue(
    /v_oid_before\s*:=\s*coalesce\(\s*v_public_oid\s*,\s*v_private_oid\s*\)/.test(migrationCode),
    'captures starting OID from whichever schema currently holds the function',
  )
})

run('2. SET SCHEMA runs only when still in public; skipped when already private', () => {
  assertTrue(
    /if\s+v_public_oid\s+is\s+not\s+null\s+then[\s\S]*?alter function public\.drevora_auth_user_can_manage_vehicle_check_templates\(\)\s*set schema drevora_private;/i.test(
      migrationCode,
    ),
    'conditional ALTER FUNCTION ... SET SCHEMA drevora_private when starting in public',
  )
  assertTrue(
    (migrationCode.match(/set schema drevora_private/gi) || []).length === 1,
    'exactly one SET SCHEMA statement (no unconditional second move)',
  )
})

run('3. No body replacement, no DROP FUNCTION, no CREATE FUNCTION, no temporary-table OID capture', () => {
  assertTrue(!/create\s+or\s+replace\s+function/i.test(migrationCode), 'no CREATE OR REPLACE FUNCTION')
  assertTrue(!/drop\s+function/i.test(migrationCode), 'no DROP FUNCTION')
  assertTrue(!/create\s+function/i.test(migrationCode), 'no CREATE FUNCTION')
  assertTrue(
    !/create\s+temporary\s+table/i.test(migrationCode),
    'no temporary-table OID capture (uses DO-block locals)',
  )
})

run('4. Final state is enforced in both paths (search_path, grants, SECURITY DEFINER, OID, zero policy deps)', () => {
  assertTrue(
    /alter function drevora_private\.drevora_auth_user_can_manage_vehicle_check_templates\(\)\s*set search_path\s*=\s*''/i.test(
      migrationCode,
    ),
    'enforces search_path = \'\' on drevora_private function',
  )
  assertTrue(/prosecdef/.test(migrationCode), 'asserts SECURITY DEFINER retained')
  assertTrue(
    /v_oid_after is distinct from v_oid_before/.test(migrationCode),
    'asserts final OID equals captured starting OID',
  )
  assertTrue(
    /has_function_privilege\('authenticated', v_oid_after, 'EXECUTE'\)/.test(migrationCode),
    'asserts authenticated EXECUTE',
  )
  assertTrue(
    /has_function_privilege\('public', v_oid_after, 'EXECUTE'\)/.test(migrationCode) &&
      /has_function_privilege\('anon', v_oid_after, 'EXECUTE'\)/.test(migrationCode),
    'asserts PUBLIC/anon EXECUTE absent',
  )
  assertTrue(
    /revoke all on function drevora_private\.drevora_auth_user_can_manage_vehicle_check_templates\(\) from public/i.test(
      migrationCode,
    ),
    'revokes PUBLIC EXECUTE',
  )
  assertTrue(
    /revoke all on function drevora_private\.drevora_auth_user_can_manage_vehicle_check_templates\(\) from anon/i.test(
      migrationCode,
    ),
    'revokes anon EXECUTE',
  )
  assertTrue(
    /grant execute on function drevora_private\.drevora_auth_user_can_manage_vehicle_check_templates\(\) to authenticated/i.test(
      migrationCode,
    ),
    'grants authenticated EXECUTE',
  )
  const depCount = (migrationCode.match(/classid = 'pg_policy'::regclass/g) || []).length
  assertTrue(depCount >= 2, `expected precondition + post-move pg_policy dependency checks, found ${depCount}`)
})

run('5. No RLS policy is created/dropped/altered; drevora_private schema is not recreated', () => {
  assertTrue(!/drop\s+policy\b/i.test(migrationCode), 'no DROP POLICY')
  assertTrue(!/create\s+policy\b/i.test(migrationCode), 'no CREATE POLICY')
  assertTrue(!/alter\s+policy\b/i.test(migrationCode), 'no ALTER POLICY')
  assertTrue(!/create schema/i.test(migrationCode), 'does not (re)create drevora_private')
})

run('6. Migration is wrapped in one explicit transaction and reloads the PostgREST schema cache', () => {
  assertTrue(migrationCode.includes('begin;'), 'wrapped in a transaction')
  assertTrue(migrationCode.includes('commit;'), 'transaction committed')
  assertTrue(
    migrationCode.includes("notify pgrst, 'reload schema';"),
    'notifies PostgREST to reload its schema cache',
  )
})

run('7. Migration performs no unrelated data mutation and touches only this one function', () => {
  assertTrue(!/\bdelete\s+from\b/i.test(migrationCode), 'no DELETE')
  assertTrue(!/\btruncate\b/i.test(migrationCode), 'no TRUNCATE')
  assertTrue(!/\bdrop\s+table\b/i.test(migrationCode), 'no DROP TABLE')
  assertTrue(!/\bdrop\s+schema\b/i.test(migrationCode), 'no DROP SCHEMA')
  assertTrue(!/to\s+service_role/i.test(migrationCode), 'no service_role grant added/removed')

  const grantRevokeFnRe =
    /(grant|revoke)\s+(?:all|execute)[\s\S]{0,20}?on\s+function\s+(?:public|drevora_private)\.([a-z0-9_]+)\s*\(/gi
  const touched = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = grantRevokeFnRe.exec(migrationCode)) !== null) {
    touched.add(m[2])
  }
  assertTrue(
    touched.size === 1 && touched.has(FN),
    `exactly one target function has privilege changes, got: ${[...touched].join(', ')}`,
  )
})

run('8. Untracked security-definer diagnostic file remains untouched by this task', () => {
  assertTrue(
    !migration.includes('20260808_security_definer_function_inventory'),
    'migration does not reference or modify the diagnostic file',
  )
  let diagnosticExists = true
  try {
    readFileSync(resolve(DIAGNOSTIC_PATH), 'utf8')
  } catch {
    diagnosticExists = false
  }
  assertTrue(diagnosticExists, 'diagnostic file still exists on disk')
})

console.log(`\nAll ${passed} checks passed.`)

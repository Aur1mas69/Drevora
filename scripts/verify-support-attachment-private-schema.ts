/**
 * Focused verification: Security Advisor Batch 3A — support-attachment
 * storage helpers relocated from public to drevora_private via
 * ALTER FUNCTION ... SET SCHEMA (no body recreation, no DROP).
 * Run: npm run verify:support-attachment-private-schema
 *
 * Targets:
 *   public.drevora_storage_can_access_support_attachment(text)
 *   public.drevora_storage_can_write_support_attachment(text)
 *   -> drevora_private.*
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

const ACCESS_FN = 'drevora_storage_can_access_support_attachment'
const WRITE_FN = 'drevora_storage_can_write_support_attachment'
const ACCESS_SIG = `${ACCESS_FN}(text)`
const WRITE_SIG = `${WRITE_FN}(text)`

const POLICIES = [
  'support_attachments_select_own',
  'support_attachments_insert_own',
  'support_attachments_delete_own',
]

const MIGRATION_PATH =
  'supabase/migrations/20260808230000_move_support_storage_helpers_private.sql'
const migration = read(MIGRATION_PATH)

const DIAGNOSTIC_PATH =
  'supabase/diagnostics/20260808_security_definer_function_inventory.sql'

run('1. Migration uses ALTER FUNCTION ... SET SCHEMA for both helpers', () => {
  assertTrue(
    new RegExp(
      `alter function public\\.${ACCESS_FN}\\(text\\)\\s*\\n\\s*set schema drevora_private`,
    ).test(migration),
    'ALTER FUNCTION ... SET SCHEMA present for the access helper',
  )
  assertTrue(
    new RegExp(
      `alter function public\\.${WRITE_FN}\\(text\\)\\s*\\n\\s*set schema drevora_private`,
    ).test(migration),
    'ALTER FUNCTION ... SET SCHEMA present for the write helper',
  )
})

run('2. No CREATE OR REPLACE body recreation for either function', () => {
  assertTrue(
    !new RegExp(`create\\s+or\\s+replace\\s+function\\s+\\S*${ACCESS_FN}\\s*\\(`, 'i').test(
      migration,
    ),
    'access helper body is not recreated',
  )
  assertTrue(
    !new RegExp(`create\\s+or\\s+replace\\s+function\\s+\\S*${WRITE_FN}\\s*\\(`, 'i').test(
      migration,
    ),
    'write helper body is not recreated',
  )
})

run('3. No DROP FUNCTION for either function', () => {
  assertTrue(
    !new RegExp(`drop\\s+function[\\s\\S]{0,20}${ACCESS_FN}\\s*\\(`, 'i').test(migration),
    'access helper is not dropped',
  )
  assertTrue(
    !new RegExp(`drop\\s+function[\\s\\S]{0,20}${WRITE_FN}\\s*\\(`, 'i').test(migration),
    'write helper is not dropped',
  )
})

run('4. Both functions target drevora_private (post-move references)', () => {
  assertTrue(
    migration.includes(`drevora_private.${ACCESS_SIG}`),
    'migration references drevora_private.drevora_storage_can_access_support_attachment(text)',
  )
  assertTrue(
    migration.includes(`drevora_private.${WRITE_SIG}`),
    'migration references drevora_private.drevora_storage_can_write_support_attachment(text)',
  )
})

run('5. Both functions are repinned to search_path = \'\' via ALTER FUNCTION', () => {
  assertTrue(
    new RegExp(
      `alter function drevora_private\\.${ACCESS_FN}\\(text\\)\\s*\\n\\s*set search_path = ''`,
    ).test(migration),
    'access helper search_path pinned to empty string',
  )
  assertTrue(
    new RegExp(
      `alter function drevora_private\\.${WRITE_FN}\\(text\\)\\s*\\n\\s*set search_path = ''`,
    ).test(migration),
    'write helper search_path pinned to empty string',
  )
})

run('6. authenticated retains EXECUTE on both relocated functions', () => {
  assertTrue(
    new RegExp(
      `grant execute on function drevora_private\\.${ACCESS_FN}\\(text\\)\\s*\\n\\s*to authenticated`,
    ).test(migration),
    'authenticated granted EXECUTE on access helper',
  )
  assertTrue(
    new RegExp(
      `grant execute on function drevora_private\\.${WRITE_FN}\\(text\\)\\s*\\n\\s*to authenticated`,
    ).test(migration),
    'authenticated granted EXECUTE on write helper',
  )
})

run('7. PUBLIC and anon do not retain EXECUTE on either relocated function', () => {
  for (const fn of [ACCESS_FN, WRITE_FN]) {
    assertTrue(
      new RegExp(
        `revoke all on function drevora_private\\.${fn}\\(text\\)\\s*\\n\\s*from public`,
      ).test(migration),
      `PUBLIC EXECUTE revoked on ${fn}`,
    )
    assertTrue(
      new RegExp(
        `revoke all on function drevora_private\\.${fn}\\(text\\)\\s*\\n\\s*from anon`,
      ).test(migration),
      `anon EXECUTE revoked on ${fn}`,
    )
    assertTrue(
      !new RegExp(`grant\\s+(all|execute)[\\s\\S]{0,10}on function drevora_private\\.${fn}\\(text\\)\\s*\\n\\s*to (public|anon)`, 'i').test(
        migration,
      ),
      `no grant of EXECUTE to public/anon on ${fn}`,
    )
  }
})

run('8. authenticated gets schema USAGE but not CREATE on drevora_private', () => {
  assertTrue(
    /grant usage on schema drevora_private to authenticated/.test(migration),
    'authenticated granted USAGE on drevora_private',
  )
  assertTrue(
    !/grant\s+(all|create)[\s\S]{0,10}on schema drevora_private to authenticated/i.test(migration),
    'authenticated is never granted CREATE on drevora_private',
  )
})

run('9. anon / PUBLIC / authenticator do not get CREATE (or USAGE for anon) on drevora_private', () => {
  assertTrue(
    /revoke all on schema drevora_private from public/.test(migration),
    'PUBLIC privileges on drevora_private explicitly revoked',
  )
  assertTrue(
    /revoke all on schema drevora_private from anon/.test(migration),
    'anon privileges on drevora_private explicitly revoked',
  )
  assertTrue(
    /revoke all on schema drevora_private from authenticator/.test(migration),
    'authenticator privileges on drevora_private explicitly revoked (guarded by to_regrole check)',
  )
  assertTrue(
    !/grant\s+(all|create)[\s\S]{0,10}on schema drevora_private to (anon|public|authenticator)/i.test(
      migration,
    ),
    'no CREATE granted on drevora_private to anon/public/authenticator',
  )
  assertTrue(
    !/grant\s+(all|usage)[\s\S]{0,10}on schema drevora_private to anon/i.test(migration),
    'no USAGE granted on drevora_private to anon',
  )
})

run('10. None of the 3 support-attachment policies are dropped, recreated, or altered', () => {
  assertTrue(
    !/drop\s+policy\b/i.test(migration),
    'migration contains no DROP POLICY statement',
  )
  assertTrue(
    !/create\s+policy\b/i.test(migration),
    'migration contains no CREATE POLICY statement',
  )
  assertTrue(
    !/alter\s+policy\b/i.test(migration),
    'migration contains no ALTER POLICY statement',
  )
  for (const policy of POLICIES) {
    assertTrue(
      migration.includes(policy),
      `migration references ${policy} (read-only assertion context only)`,
    )
  }
})

run('11. Migration contains OID-preservation assertions', () => {
  assertTrue(
    /create temporary table drevora_batch3a_captured_oids/.test(migration),
    'captures pre-move OIDs into a temporary table',
  )
  assertTrue(
    /oid_before/.test(migration) && /v_access_oid_after is distinct from v_access_oid_before/.test(migration),
    'asserts access helper OID unchanged before/after the move',
  )
  assertTrue(
    /v_write_oid_after is distinct from v_write_oid_before/.test(migration),
    'asserts write helper OID unchanged before/after the move',
  )
})

run('12. Migration contains OID-based policy dependency assertions (pg_depend)', () => {
  assertTrue(
    /from pg_depend d/.test(migration),
    'uses pg_depend for dependency verification',
  )
  assertTrue(
    /refclassid = 'pg_proc'::regclass/.test(migration),
    'pg_depend check anchors on pg_proc as the referenced object class',
  )
  for (const policy of POLICIES) {
    assertTrue(
      new RegExp(`pol\\.polname = '${policy}'`).test(migration),
      `pg_depend assertion covers ${policy}`,
    )
  }
  // Secondary-only confirmation via pg_policies/pg_get_expr text, not the
  // sole source of truth.
  assertTrue(
    /from pg_policies/.test(migration),
    'includes a secondary pg_policies text confirmation',
  )
})

run('13. Migration also asserts function security posture and schema ownership', () => {
  assertTrue(/prosecdef/.test(migration), 'asserts SECURITY DEFINER remains true')
  assertTrue(
    /search_path=""/.test(migration),
    'asserts canonical empty search_path representation',
  )
  assertTrue(
    /v_schema_owner in \('anon', 'authenticated', 'authenticator'\)/.test(migration),
    'fails closed if drevora_private is owned by an untrusted role',
  )
  assertTrue(
    /has_schema_privilege\('authenticated', 'drevora_private', 'CREATE'\)/.test(migration),
    'asserts authenticated has no CREATE on drevora_private',
  )
  assertTrue(
    /has_schema_privilege\('authenticated', 'drevora_private', 'USAGE'\)/.test(migration),
    'asserts authenticated has USAGE on drevora_private',
  )
})

run('14. Migration is wrapped in one explicit transaction and reloads PostgREST schema cache', () => {
  assertTrue(migration.includes('begin;'), 'wrapped in a transaction')
  assertTrue(migration.includes('commit;'), 'transaction committed')
  assertTrue(
    migration.includes("notify pgrst, 'reload schema';"),
    'notifies PostgREST to reload its schema cache',
  )
})

run('15. Migration performs no unrelated data mutation or object change', () => {
  assertTrue(!/\bdelete\s+from\b/i.test(migration), 'no DELETE statement')
  assertTrue(!/\btruncate\b/i.test(migration), 'no TRUNCATE statement')
  assertTrue(
    !/\binsert\s+into\s+(?!drevora_batch3a_captured_oids)/i.test(migration),
    'no INSERT other than the temporary OID-capture table',
  )
  assertTrue(!/\bdrop\s+table\b/i.test(migration), 'no DROP TABLE')
  assertTrue(!/\bdrop\s+schema\b/i.test(migration), 'no DROP SCHEMA')

  const grantRevokeFnRe =
    /(grant|revoke)\s+(?:all|execute)[\s\S]{0,20}?on\s+function\s+(?:public|drevora_private)\.([a-z0-9_]+)\s*\(/gi
  const touched = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = grantRevokeFnRe.exec(migration)) !== null) {
    touched.add(m[2])
  }
  assertTrue(
    touched.size === 2 && touched.has(ACCESS_FN) && touched.has(WRITE_FN),
    `exactly the two target functions have privilege changes, got: ${[...touched].join(', ')}`,
  )
})

run('16. Untracked security-definer diagnostic file remains untouched by this task', () => {
  // This verifier only asserts the diagnostic file still exists and is not
  // referenced/modified by the migration itself; it does not assert file
  // contents, since the diagnostic is intentionally a standalone artifact.
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

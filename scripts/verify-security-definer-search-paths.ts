/**
 * Focused verification: Security Advisor Batch 7 — search_path hardening
 * (SET search_path = public -> '') for 7 already-KEEP-classified SECURITY
 * DEFINER browser RPCs. Pure ALTER FUNCTION ... SET search_path only:
 * no CREATE OR REPLACE, no SET SCHEMA, no signature/body change, no
 * EXECUTE privilege change (authenticated stays true, anon/PUBLIC false).
 *
 * Run: npm run verify:security-definer-search-paths
 *
 * Targets (7):
 *   drevora_accept_customer_legal_documents(uuid,boolean,boolean,boolean,boolean,text,text,text,text,text)
 *   drevora_accept_worker_legal_documents(uuid,boolean,boolean,text,text,text,text,text)
 *   drevora_clear_company_driver_timesheet_settings(uuid)
 *   drevora_get_customer_legal_status(uuid)
 *   drevora_get_worker_legal_status(uuid)
 *   drevora_office_apply_tyre_check_correction(uuid,text,text,jsonb)
 *   drevora_office_soft_delete_tyre_check(uuid,text)
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

const TARGET_FNS = [
  'drevora_accept_customer_legal_documents',
  'drevora_accept_worker_legal_documents',
  'drevora_clear_company_driver_timesheet_settings',
  'drevora_get_customer_legal_status',
  'drevora_get_worker_legal_status',
  'drevora_office_apply_tyre_check_correction',
  'drevora_office_soft_delete_tyre_check',
] as const

const TARGET_SIGNATURES = [
  'public.drevora_accept_customer_legal_documents(uuid,boolean,boolean,boolean,boolean,text,text,text,text,text)',
  'public.drevora_accept_worker_legal_documents(uuid,boolean,boolean,text,text,text,text,text)',
  'public.drevora_clear_company_driver_timesheet_settings(uuid)',
  'public.drevora_get_customer_legal_status(uuid)',
  'public.drevora_get_worker_legal_status(uuid)',
  'public.drevora_office_apply_tyre_check_correction(uuid,text,text,jsonb)',
  'public.drevora_office_soft_delete_tyre_check(uuid,text)',
] as const

const MIGRATION_PATH =
  'supabase/migrations/20260810230000_harden_remaining_security_definer_search_paths.sql'
const migration = read(MIGRATION_PATH)

const migrationCode = migration
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')

run('1. Migration targets exactly the 7 expected function signatures', () => {
  for (const sig of TARGET_SIGNATURES) {
    assertTrue(
      migration.includes(`'${sig}'`),
      `precondition target array includes ${sig}`,
    )
  }
  const arrayMatch = /v_targets constant text\[\] := array\(?\[([\s\S]*?)\];/.exec(
    migrationCode,
  )
  assertTrue(!!arrayMatch, 'finds the v_targets array literal')
  const entries = (arrayMatch![1].match(/'public\.[^']+'/g) || []).length
  assertTrue(entries === 7, `v_targets array has exactly 7 entries, found ${entries}`)
})

run('2. Uses ALTER FUNCTION ... SET search_path = \'\' for all 7 (no CREATE OR REPLACE, no SET SCHEMA)', () => {
  for (const fn of TARGET_FNS) {
    const alterRe = new RegExp(
      `alter function public\\.${fn}\\([\\s\\S]*?\\)\\s*set search_path = '';`,
      'i',
    )
    assertTrue(alterRe.test(migrationCode), `${fn} is altered via ALTER FUNCTION ... SET search_path = ''`)
  }

  const alterCount = (migrationCode.match(/alter function public\.\w+\(/gi) || []).length
  assertTrue(alterCount === 7, `expected exactly 7 ALTER FUNCTION statements, found ${alterCount}`)

  assertTrue(
    !new RegExp(`create\\s+or\\s+replace\\s+function`, 'i').test(migrationCode),
    'does not use CREATE OR REPLACE FUNCTION anywhere',
  )
  assertTrue(!/drop\s+function/i.test(migrationCode), 'no DROP FUNCTION')
  assertTrue(!/set\s+schema/i.test(migrationCode), 'does not SET SCHEMA (no move to drevora_private or elsewhere)')
})

run('3. Does not grant anon/PUBLIC EXECUTE; preserves authenticated EXECUTE', () => {
  for (const fn of TARGET_FNS) {
    const grantRe = new RegExp(
      `grant execute on function public\\.${fn}\\([\\s\\S]*?\\)\\s*to authenticated;`,
      'i',
    )
    assertTrue(grantRe.test(migrationCode), `${fn} grants EXECUTE to authenticated`)
  }
  assertTrue(!/grant\s+execute[\s\S]*?to\s+anon/i.test(migrationCode), 'never grants EXECUTE to anon')
  assertTrue(
    !/grant\s+execute[\s\S]*?to\s+public\b/i.test(migrationCode),
    'never grants EXECUTE to PUBLIC',
  )
  assertTrue(!/to\s+service_role/i.test(migrationCode), 'no service_role grant added')

  for (const fn of TARGET_FNS) {
    const revokePublicRe = new RegExp(
      `revoke all on function public\\.${fn}\\([\\s\\S]*?\\)\\s*from public;`,
      'i',
    )
    const revokeAnonRe = new RegExp(
      `revoke all on function public\\.${fn}\\([\\s\\S]*?\\)\\s*from anon;`,
      'i',
    )
    assertTrue(revokePublicRe.test(migrationCode), `${fn} revokes ALL from public`)
    assertTrue(revokeAnonRe.test(migrationCode), `${fn} revokes ALL from anon`)
  }
})

run('4. Contains OID, SECURITY DEFINER, and search_path assertions (pre and post)', () => {
  assertTrue(
    /create temporary table drevora_batch7_captured/.test(migrationCode),
    'captures pre-change OID/body/return type/language/volatility into a temp table',
  )
  assertTrue(/to_regprocedure\(v_sig\)/.test(migrationCode), 'resolves each target signature via to_regprocedure')
  assertTrue(
    /BATCH7_PRECONDITION: % does not resolve/.test(migration),
    'fails closed if any target signature is missing before the change',
  )
  assertTrue(
    /BATCH7_PRECONDITION: % is not a public-schema SECURITY DEFINER function/.test(migration),
    'asserts SECURITY DEFINER + public schema before the change',
  )
  assertTrue(
    /BATCH7_PRECONDITION: % does not currently have search_path=public/.test(migration),
    'asserts current search_path=public before the change',
  )
  assertTrue(
    /BATCH7_ASSERT: % OID changed/.test(migration),
    'asserts OID preservation after ALTER FUNCTION for every target',
  )
  assertTrue(
    /BATCH7_ASSERT: % lost SECURITY DEFINER/.test(migration),
    'asserts SECURITY DEFINER retained after the change',
  )
  assertTrue(
    /BATCH7_ASSERT: % body\/return type\/language\/volatility changed unexpectedly/.test(migration),
    'asserts body/return type/language/volatility are byte-identical after the change (proves no recreation)',
  )
  assertTrue(
    /search_path=""/.test(migrationCode),
    'asserts canonical empty search_path form after hardening',
  )
  assertTrue(
    /has_function_privilege\('authenticated'/.test(migrationCode) &&
      /has_function_privilege\('anon'/.test(migrationCode) &&
      /has_function_privilege\('public'/.test(migrationCode),
    'asserts authenticated/anon/PUBLIC EXECUTE state both before and after',
  )
})

run('5. Postcondition block checks all 7 captured functions (no silent skip)', () => {
  assertTrue(
    /v_checked <> 7/.test(migrationCode),
    'asserts exactly 7 functions were checked in the postcondition loop',
  )
  assertTrue(
    /for r in select \* from drevora_batch7_captured loop/.test(migrationCode),
    'iterates every captured function in the postcondition block',
  )
})

run('6. No RLS/policy changes, no schema creation, no unrelated privilege churn', () => {
  assertTrue(!/drop\s+policy\b/i.test(migrationCode), 'no DROP POLICY')
  assertTrue(!/create\s+policy\b/i.test(migrationCode), 'no CREATE POLICY')
  assertTrue(!/alter\s+policy\b/i.test(migrationCode), 'no ALTER POLICY')
  assertTrue(!/create schema/i.test(migrationCode), 'does not create any schema')
})

run('7. Migration is wrapped in one explicit transaction and reloads PostgREST schema cache', () => {
  assertTrue(migrationCode.includes('begin;'), 'wrapped in a transaction')
  assertTrue(migrationCode.includes('commit;'), 'transaction committed')
  assertTrue(
    migrationCode.includes("notify pgrst, 'reload schema';"),
    'notifies PostgREST to reload its schema cache',
  )
})

console.log(`\nAll ${passed} checks passed.`)

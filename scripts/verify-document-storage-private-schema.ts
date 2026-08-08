/**
 * Focused verification: Security Advisor Batch 3B — document / worker-
 * submission storage helpers relocated from public to drevora_private.
 * Run: npm run verify:document-storage-private-schema
 *
 * Two leaf helpers move via pure ALTER FUNCTION ... SET SCHEMA (no body
 * change). Three dependent helpers are corrected via CREATE OR REPLACE
 * (sibling schema prefix only, no authorization/logic change) before also
 * being moved via ALTER FUNCTION ... SET SCHEMA.
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

const LEAF_FNS = [
  'drevora_storage_can_select_worker_submission_file',
  'drevora_storage_can_write_worker_submission_file',
]

const EDITED_FNS = [
  'drevora_storage_can_select_document_file',
  'drevora_storage_can_write_document_file',
  'drevora_storage_can_delete_worker_submission_staging_file',
]

const ALL_FNS = [...LEAF_FNS, ...EDITED_FNS]

const POLICIES = [
  'drevora_storage_document_files_select',
  'drevora_storage_document_files_insert',
  'drevora_storage_document_files_update',
  'drevora_storage_document_files_delete',
]

const MIGRATION_PATH =
  'supabase/migrations/20260808240000_move_document_storage_helpers_private.sql'
const migration = read(MIGRATION_PATH)

// Strip full-line SQL comments so checks for actual DDL statements (e.g.
// "no DROP/CREATE/ALTER POLICY") are not tripped up by explanatory prose in
// the migration's header comments (which legitimately discuss what
// CREATE POLICY does elsewhere in the system, in prose form).
const migrationCode = migration
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')

const DIAGNOSTIC_PATH =
  'supabase/diagnostics/20260808_security_definer_function_inventory.sql'

run('1. The two leaf helpers use pure ALTER FUNCTION ... SET SCHEMA (no CREATE OR REPLACE)', () => {
  for (const fn of LEAF_FNS) {
    assertTrue(
      new RegExp(`alter function public\\.${fn}\\(text\\)\\s*\\n\\s*set schema drevora_private`).test(
        migration,
      ),
      `${fn} moved via ALTER FUNCTION ... SET SCHEMA`,
    )
    assertTrue(
      !new RegExp(`create\\s+or\\s+replace\\s+function\\s+\\S*${fn}\\s*\\(`, 'i').test(migration),
      `${fn} body is never recreated`,
    )
  }
})

run('2. Exactly 3 body replacements, and only for the dependent helpers', () => {
  const createOrReplaceRe = /create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)\s*\(/gi
  const replaced = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = createOrReplaceRe.exec(migration)) !== null) {
    replaced.add(m[1])
  }
  assertTrue(replaced.size === 3, `exactly 3 functions recreated, got: ${[...replaced].join(', ')}`)
  for (const fn of EDITED_FNS) {
    assertTrue(replaced.has(fn), `${fn} is one of the recreated functions`)
  }
  for (const fn of LEAF_FNS) {
    assertTrue(!replaced.has(fn), `${fn} (leaf) is not recreated`)
  }
})

run('3. Each of the 3 replacements changes only the sibling schema prefix (no authorization/logic edits)', () => {
  // can_select_document_file: only the select-sibling call is drevora_private-qualified;
  // every other reference in the body stays public.-qualified.
  const selectDocMatch = migration.match(
    /create or replace function public\.drevora_storage_can_select_document_file\(p_name text\)[\s\S]*?\$\$;/,
  )
  assertTrue(!!selectDocMatch, 'can_select_document_file replacement body found')
  const selectDocBody = selectDocMatch![0]
  assertTrue(
    selectDocBody.includes('drevora_private.drevora_storage_can_select_worker_submission_file(p_name)'),
    'can_select_document_file calls the moved sibling via drevora_private.*',
  )
  assertTrue(
    !selectDocBody.includes('public.drevora_storage_can_select_worker_submission_file'),
    'can_select_document_file no longer calls public.drevora_storage_can_select_worker_submission_file',
  )
  assertTrue(
    selectDocBody.includes('public.documents') &&
      selectDocBody.includes('public.drevora_storage_try_parse_uuid') &&
      selectDocBody.includes('public.drevora_auth_user_has_office_role_for_company') &&
      selectDocBody.includes('public.drevora_auth_user_belongs_to_company_id') &&
      selectDocBody.includes('public.drevora_auth_user_driver_id'),
    'can_select_document_file keeps every other reference public.-qualified (unchanged)',
  )
  assertTrue(
    /returns boolean\s*\nlanguage sql\s*\nstable\s*\nsecurity definer\s*\nset search_path = ''/.test(
      selectDocBody,
    ),
    'can_select_document_file keeps return type/language/volatility/SECURITY DEFINER/search_path unchanged',
  )

  // can_write_document_file
  const writeDocMatch = migration.match(
    /create or replace function public\.drevora_storage_can_write_document_file\(p_name text\)[\s\S]*?\$\$;/,
  )
  assertTrue(!!writeDocMatch, 'can_write_document_file replacement body found')
  const writeDocBody = writeDocMatch![0]
  assertTrue(
    writeDocBody.includes('drevora_private.drevora_storage_can_write_worker_submission_file(p_name)'),
    'can_write_document_file calls the moved sibling via drevora_private.*',
  )
  assertTrue(
    !writeDocBody.includes('public.drevora_storage_can_write_worker_submission_file'),
    'can_write_document_file no longer calls public.drevora_storage_can_write_worker_submission_file',
  )
  assertTrue(
    writeDocBody.includes('public.documents') &&
      writeDocBody.includes('public.drevora_auth_user_has_office_role_for_company'),
    'can_write_document_file keeps every other reference public.-qualified (unchanged)',
  )
  assertTrue(
    /returns boolean\s*\nlanguage sql\s*\nstable\s*\nsecurity definer\s*\nset search_path = ''/.test(
      writeDocBody,
    ),
    'can_write_document_file keeps return type/language/volatility/SECURITY DEFINER/search_path unchanged',
  )

  // can_delete_worker_submission_staging_file
  const deleteStagingMatch = migration.match(
    /create or replace function public\.drevora_storage_can_delete_worker_submission_staging_file\(p_name text\)[\s\S]*?\$\$;/,
  )
  assertTrue(!!deleteStagingMatch, 'can_delete_worker_submission_staging_file replacement body found')
  const deleteStagingBody = deleteStagingMatch![0]
  assertTrue(
    deleteStagingBody.includes(
      'select drevora_private.drevora_storage_can_write_worker_submission_file(p_name);',
    ),
    'can_delete_worker_submission_staging_file body is exactly a passthrough call to the moved sibling',
  )
  assertTrue(
    !deleteStagingBody.includes('public.drevora_storage_can_write_worker_submission_file'),
    'can_delete_worker_submission_staging_file no longer calls public.drevora_storage_can_write_worker_submission_file',
  )
  assertTrue(
    /returns boolean\s*\nlanguage sql\s*\nstable\s*\nsecurity definer\s*\nset search_path = ''/.test(
      deleteStagingBody,
    ),
    'can_delete_worker_submission_staging_file keeps return type/language/volatility/SECURITY DEFINER/search_path unchanged',
  )
})

run('4. All 5 functions end up moved to drevora_private via ALTER FUNCTION ... SET SCHEMA', () => {
  for (const fn of ALL_FNS) {
    assertTrue(
      new RegExp(`alter function public\\.${fn}\\(text\\)\\s*\\n\\s*set schema drevora_private`).test(
        migration,
      ),
      `${fn} has an ALTER FUNCTION ... SET SCHEMA drevora_private statement`,
    )
  }
})

run('5. Leaf helpers are moved before the dependent helpers are corrected/moved', () => {
  const leafMoveIdx = ALL_FNS.slice(0, 2).map((fn) =>
    migration.indexOf(`alter function public.${fn}(text)\n  set schema drevora_private`),
  )
  const firstEditedReplaceIdx = migration.indexOf(
    'create or replace function public.drevora_storage_can_select_document_file',
  )
  assertTrue(
    leafMoveIdx.every((idx) => idx !== -1 && idx < firstEditedReplaceIdx),
    'both leaf helpers are moved before the first dependent-helper CREATE OR REPLACE',
  )
})

run('6. Migration contains OID-preservation assertions for all 5 functions', () => {
  assertTrue(
    /create temporary table drevora_batch3b_captured_oids/.test(migration),
    'captures pre-move OIDs into a temporary table',
  )
  for (const fn of ALL_FNS) {
    assertTrue(
      migration.includes(`'${fn}'`),
      `OID capture/assertion references ${fn}`,
    )
  }
  assertTrue(
    /is distinct from v_select_doc_before/.test(migration) &&
      /is distinct from v_write_doc_before/.test(migration) &&
      /is distinct from v_select_sub_before/.test(migration) &&
      /is distinct from v_write_sub_before/.test(migration) &&
      /is distinct from v_delete_staging_before/.test(migration),
    'OID-unchanged assertion present for all 5 functions',
  )
})

run('7. Migration rejects stale public.* sibling references in the 3 edited bodies (apply-time assertion)', () => {
  assertTrue(
    /v_src like '%public\.drevora_storage_can_select_worker_submission_file%'/.test(migration),
    'apply-time assertion rejects a stale public.* reference in can_select_document_file',
  )
  assertTrue(
    (migration.match(/v_src like '%public\.drevora_storage_can_write_worker_submission_file%'/g) || [])
      .length === 2,
    'apply-time assertion rejects a stale public.* reference in both can_write_document_file and can_delete_worker_submission_staging_file',
  )
  assertTrue(
    /v_src not like '%drevora_private\.drevora_storage_can_select_worker_submission_file%'/.test(
      migration,
    ) &&
      (migration.match(
        /v_src not like '%drevora_private\.drevora_storage_can_write_worker_submission_file%'/g,
      ) || []).length === 2,
    'apply-time assertion requires the drevora_private.* sibling reference to be present in all 3 edited bodies',
  )
})

run('8. The 4 document-files policies are not dropped/recreated/altered', () => {
  assertTrue(!/drop\s+policy\b/i.test(migrationCode), 'migration contains no DROP POLICY statement')
  assertTrue(!/create\s+policy\b/i.test(migrationCode), 'migration contains no CREATE POLICY statement')
  assertTrue(!/alter\s+policy\b/i.test(migrationCode), 'migration contains no ALTER POLICY statement')
  for (const policy of POLICIES) {
    assertTrue(migration.includes(policy), `migration references ${policy} (assertion context only)`)
  }
})

run('9. Migration contains OID-based policy dependency assertions (pg_depend) for the 3 directly-referenced functions', () => {
  assertTrue(/from pg_depend d/.test(migration), 'uses pg_depend for dependency verification')
  assertTrue(
    /refclassid = 'pg_proc'::regclass/.test(migration),
    'pg_depend check anchors on pg_proc as the referenced object class',
  )
  for (const policy of POLICIES) {
    assertTrue(
      new RegExp(`pol\\.polname = '${policy}'`).test(migration),
      `pg_depend/catalog assertion covers ${policy}`,
    )
  }
  // The delete policy has two OR'd branches; both callee OIDs must be checked.
  assertTrue(
    (migration.match(/refobjid = v_write_doc_oid[\s\S]{0,200}?polname = 'drevora_storage_document_files_delete'/) || [])
      .length >= 1,
    'delete policy dependency check covers the can_write_document_file branch',
  )
  assertTrue(
    /refobjid = v_delete_staging_oid/.test(migration),
    'delete policy dependency check covers the can_delete_worker_submission_staging_file branch',
  )
  assertTrue(/from pg_policies/.test(migration), 'includes a secondary pg_policies text confirmation')
})

run('10. Migration asserts function security posture (SECURITY DEFINER, volatility, return type, search_path, grants) for all 5', () => {
  assertTrue(/prosecdef/.test(migration), 'asserts SECURITY DEFINER remains true')
  assertTrue(/provolatile = .s./.test(migration), "asserts volatility remains 'stable'")
  assertTrue(/prorettype = v_boolean_type/.test(migration), 'asserts return type remains boolean')
  assertTrue(/search_path=""/.test(migration), 'asserts canonical empty search_path representation')
  assertTrue(
    /has_function_privilege\('authenticated', v_oid, 'EXECUTE'\)/.test(migration),
    'asserts authenticated EXECUTE for all 5 via the shared per-function loop',
  )
  assertTrue(
    /has_function_privilege\('public', v_oid, 'EXECUTE'\)/.test(migration) &&
      /has_function_privilege\('anon', v_oid, 'EXECUTE'\)/.test(migration),
    'asserts PUBLIC/anon EXECUTE are absent for all 5 via the shared per-function loop',
  )
})

run('11. Existing drevora_private schema privileges are reused, not modified', () => {
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
})

run('12. Migration is wrapped in one explicit transaction and reloads the PostgREST schema cache', () => {
  assertTrue(migration.includes('begin;'), 'wrapped in a transaction')
  assertTrue(migration.includes('commit;'), 'transaction committed')
  assertTrue(
    migration.includes("notify pgrst, 'reload schema';"),
    'notifies PostgREST to reload its schema cache',
  )
})

run('13. Migration performs no unrelated data mutation or object change, and touches only these 5 functions\' grants', () => {
  assertTrue(!/\bdelete\s+from\b/i.test(migrationCode), 'no DELETE statement')
  assertTrue(!/\btruncate\b/i.test(migrationCode), 'no TRUNCATE statement')
  assertTrue(
    !/\binsert\s+into\s+(?!drevora_batch3b_captured_oids)/i.test(migrationCode),
    'no INSERT other than the temporary OID-capture table',
  )
  assertTrue(!/\bdrop\s+table\b/i.test(migrationCode), 'no DROP TABLE')
  assertTrue(!/\bdrop\s+schema\b/i.test(migrationCode), 'no DROP SCHEMA')
  assertTrue(!/\bdrop\s+function\b/i.test(migrationCode), 'no DROP FUNCTION anywhere')

  const grantRevokeFnRe =
    /(grant|revoke)\s+(?:all|execute)[\s\S]{0,20}?on\s+function\s+(?:public|drevora_private)\.([a-z0-9_]+)\s*\(/gi
  const touched = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = grantRevokeFnRe.exec(migrationCode)) !== null) {
    touched.add(m[2])
  }
  assertTrue(
    touched.size === 5 && ALL_FNS.every((fn) => touched.has(fn)),
    `exactly the 5 target functions have privilege changes, got: ${[...touched].join(', ')}`,
  )
})

run('14. Untracked security-definer diagnostic file remains untouched by this task', () => {
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

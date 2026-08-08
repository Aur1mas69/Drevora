/**
 * Focused verification: Security Advisor Batch 1 — single trigger function
 * privilege hardening.
 * Run: npm run verify:security-definer-trigger-privileges
 *
 * Target:
 *   public.drevora_clear_driver_timesheet_settings_on_office_scope()
 *
 * Static / deterministic — does not call Supabase or apply SQL.
 */
import { readFileSync, readdirSync } from 'node:fs'
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

const FN = 'drevora_clear_driver_timesheet_settings_on_office_scope'
const FN_SIG = `${FN}()`
const TRIGGER_NAME = FN

const migration = read(
  'supabase/migrations/20260808210000_harden_timesheet_scope_trigger_privileges.sql',
)
const originalFoundation = read(
  'supabase/migrations/20260805183000_timesheet_management_scope_personal_overrides.sql',
)
const migrationsDir = 'supabase/migrations'
const migrationFiles = readdirSync(resolve(migrationsDir))
  .filter((f: string) => f.endsWith('.sql'))
  .sort()

function readAllMigrations(): string {
  return migrationFiles
    .map((f: string) => read(`${migrationsDir}/${f}`))
    .join('\n')
}

run('1. Trigger function still defined in repository SQL', () => {
  assertTrue(
    originalFoundation.includes(`create or replace function public.${FN_SIG}`) ||
      originalFoundation.includes(`create or replace function public.${FN}(`),
    'foundation migration still defines the function',
  )
  assertTrue(
    originalFoundation.includes('returns trigger'),
    'function still returns trigger',
  )
  assertTrue(
    originalFoundation.includes('security definer'),
    'function is still SECURITY DEFINER',
  )
})

run('2. Trigger attachment still exists and is untouched by the hardening migration', () => {
  assertTrue(
    originalFoundation.includes(`create trigger ${TRIGGER_NAME}`),
    'foundation migration still creates the trigger',
  )
  assertTrue(
    originalFoundation.includes('after insert or update of timesheet_management_scope'),
    'trigger still fires after insert/update of timesheet_management_scope',
  )
  assertTrue(
    originalFoundation.includes('on public.companies'),
    'trigger still attached to public.companies',
  )
  assertTrue(
    originalFoundation.includes(`execute function public.${FN_SIG}`),
    'trigger still executes the target function',
  )
  assertTrue(
    !migration.includes('create trigger'),
    'hardening migration does not create/recreate the trigger',
  )
  assertTrue(
    !migration.includes('drop trigger'),
    'hardening migration does not drop the trigger',
  )
})

run('3. Hardening migration revokes EXECUTE from PUBLIC, anon, authenticated, service_role', () => {
  const roles = ['public', 'anon', 'authenticated', 'service_role']
  for (const role of roles) {
    assertTrue(
      migration.includes(
        `revoke all on function public.${FN_SIG}\n  from ${role}`,
      ),
      `revokes EXECUTE from ${role}`,
    )
  }
})

run('4. Hardening migration does not grant EXECUTE back to any role', () => {
  assertTrue(
    !new RegExp(`grant\\s+(all|execute)[\\s\\S]{0,10}on\\s+function\\s+public\\.${FN}\\s*\\(`, 'i').test(
      migration,
    ),
    'no grant execute statement for the trigger function anywhere in the migration',
  )
})

run('5. No unrelated SECURITY DEFINER function privileges are changed', () => {
  const grantRevokeRe =
    /(grant|revoke)\s+(?:all|execute)[\s\S]{0,20}?on\s+function\s+public\.([a-z0-9_]+)\s*\(/gi
  const touched = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = grantRevokeRe.exec(migration)) !== null) {
    touched.add(m[2])
  }
  assertTrue(touched.size === 1, `exactly one function touched, got: ${[...touched].join(', ')}`)
  assertTrue(touched.has(FN), 'the touched function is the trigger target')
})

run('6. search_path change (if present) is safe and scoped to this function only', () => {
  const alterRe =
    /alter\s+function\s+public\.([a-z0-9_]+)\s*\([^)]*\)\s*set\s+search_path/gi
  const altered = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = alterRe.exec(migration)) !== null) {
    altered.add(m[1])
  }
  assertTrue(
    altered.size === 0 || (altered.size === 1 && altered.has(FN)),
    `only the trigger function may have search_path altered, got: ${[...altered].join(', ')}`,
  )
  if (altered.has(FN)) {
    assertTrue(
      migration.includes(`alter function public.${FN_SIG}`) &&
        /alter function public\.drevora_clear_driver_timesheet_settings_on_office_scope\(\)\s*\n\s*set search_path = ''/.test(
          migration,
        ),
      "search_path repinned to '' via ALTER FUNCTION (body left untouched)",
    )
    assertTrue(
      !migration.includes(`create or replace function public.${FN_SIG}`),
      'function body not recreated when only search_path changes',
    )
  }
})

run('7. Migration includes in-transaction assertions for the revoke and trigger integrity', () => {
  assertTrue(migration.includes('begin;'), 'wrapped in a transaction')
  assertTrue(migration.includes('commit;'), 'transaction committed')
  assertTrue(
    migration.includes("has_function_privilege('public'") ||
      migration.includes('has_function_privilege(\'public\''),
    'asserts PUBLIC EXECUTE is actually revoked',
  )
  assertTrue(
    migration.toLowerCase().includes("has_function_privilege('anon'"),
    'asserts anon EXECUTE is actually revoked',
  )
  assertTrue(
    migration.toLowerCase().includes("has_function_privilege('authenticated'"),
    'asserts authenticated EXECUTE is actually revoked',
  )
  assertTrue(
    migration.toLowerCase().includes("has_function_privilege('service_role'"),
    'asserts service_role EXECUTE is actually revoked',
  )
  assertTrue(
    migration.includes('pg_trigger'),
    'asserts trigger attachment is unchanged',
  )
})

run('8. Migration performs no data mutation, drop, or unrelated table change', () => {
  assertTrue(!/\bdelete\s+from\b/i.test(migration), 'no DELETE statement')
  assertTrue(!/\btruncate\b/i.test(migration), 'no TRUNCATE statement')
  assertTrue(!/\binsert\s+into\b/i.test(migration), 'no INSERT statement')
  assertTrue(!/\bupdate\s+public\./i.test(migration), 'no UPDATE on any table')
  assertTrue(!/\bdrop\s+table\b/i.test(migration), 'no DROP TABLE')
  assertTrue(!/\bdrop\s+policy\b/i.test(migration), 'no DROP POLICY')
  assertTrue(!/\bcreate\s+policy\b/i.test(migration), 'no CREATE POLICY')
})

run('9. Trigger does not depend on direct EXECUTE grants (documented + structurally true)', () => {
  assertTrue(
    /trigger function.*without requiring EXECUTE/i.test(migration) ||
      /does not require EXECUTE/i.test(migration) ||
      /invoke.*trigger.*without.*execute/i.test(migration),
    'migration documents that trigger firing does not require EXECUTE on the firing role',
  )
  // Structural corroboration across the whole migrations directory: no other
  // migration ever grants EXECUTE on this function to any role.
  const allMigrations = readAllMigrations()
  assertTrue(
    !new RegExp(`grant\\s+(all|execute)[\\s\\S]{0,10}on\\s+function\\s+public\\.${FN}\\s*\\(`, 'i').test(
      allMigrations,
    ),
    'no migration in the repository grants EXECUTE on this function to any role',
  )
})

console.log(`\nAll ${passed} checks passed.`)

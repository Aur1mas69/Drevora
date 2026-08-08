/**
 * Focused verification: Security Batch 2 — AAL2 for expiry notification scan RPC.
 * Run: npm run verify:expiry-notifications-aal2
 *
 * Target:
 *   public.drevora_generate_expiry_notifications()
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

/** Slice one CREATE OR REPLACE function body (through closing $$;). */
function functionBody(sql: string, createMarker: string): string {
  const start = sql.indexOf(createMarker)
  assertTrue(start >= 0, `missing ${createMarker}`)
  const close = '\n$$;'
  const end = sql.indexOf(close, start)
  assertTrue(end > start, `unclosed ${createMarker}`)
  return sql.slice(start, end + close.length)
}

const FN = 'drevora_generate_expiry_notifications'
const CREATE =
  'create or replace function public.drevora_generate_expiry_notifications()'

const migration = read(
  'supabase/migrations/20260808220000_require_aal2_for_expiry_notifications.sql',
)
const foundation = read(
  'supabase/migrations/20260718020000_create_admin_notifications.sql',
)
const aal2Foundation = read(
  'supabase/migrations/20260808190000_office_write_require_aal2.sql',
)
const adminService = read('src/services/adminNotificationsService.ts')

const body = functionBody(migration, CREATE)
const beginIdx = body.indexOf('\nbegin\n')
assertTrue(beginIdx > 0, 'function begin block found')
const impl = body.slice(beginIdx)

run('1. Function remains SECURITY DEFINER, zero-arg, returns integer', () => {
  assertTrue(body.includes('security definer'), 'SECURITY DEFINER')
  assertTrue(
    body.startsWith(CREATE + '\nreturns integer'),
    'zero-arg signature returning integer',
  )
  assertTrue(!/drevora_generate_expiry_notifications\([^)]+\)/.test(body), 'no args')
})

run('2. search_path is pinned to empty string', () => {
  assertTrue(/set search_path = ''/.test(body), "SET search_path = ''")
  assertTrue(!/set search_path = public/.test(body), 'not search_path = public')
})

run('3. authenticated EXECUTE remains intentional; PUBLIC/anon revoked', () => {
  assertTrue(
    migration.includes(
      `revoke all on function public.${FN}() from public`,
    ),
    'revoke PUBLIC',
  )
  assertTrue(
    migration.includes(`revoke all on function public.${FN}() from anon`),
    'revoke anon',
  )
  assertTrue(
    migration.includes(
      `grant execute on function public.${FN}() to authenticated`,
    ),
    'grant authenticated',
  )
  assertTrue(
    !migration.includes(
      `grant execute on function public.${FN}() to anon`,
    ),
    'no grant anon',
  )
  assertTrue(
    !migration.includes(
      `grant execute on function public.${FN}() to public`,
    ),
    'no grant PUBLIC',
  )
})

run('4. drevora_auth_require_aal2() is enforced before Office checks and writes', () => {
  assertTrue(
    aal2Foundation.includes('create or replace function public.drevora_auth_require_aal2()'),
    'AAL2 helper exists in foundation migration',
  )
  const aal = impl.indexOf('perform public.drevora_auth_require_aal2();')
  const office = impl.indexOf('drevora_auth_user_has_office_role()')
  const insert = impl.indexOf('drevora_insert_admin_notification')
  assertTrue(aal >= 0, 'AAL2 perform present')
  assertTrue(office >= 0, 'Office role check present')
  assertTrue(insert >= 0, 'notification insert present')
  assertTrue(aal < office, 'AAL2 before Office role check')
  assertTrue(aal < insert, 'AAL2 before notification writes')
})

run('5. Office / company membership checks remain', () => {
  assertTrue(
    impl.includes('public.drevora_auth_user_has_office_role()'),
    'office role helper',
  )
  assertTrue(
    impl.includes('public.drevora_auth_user_has_office_role_for_company(v_company_id)'),
    'company office role helper',
  )
  assertTrue(impl.includes('from public.company_members cm'), 'company_members lookup')
  assertTrue(impl.includes('cm.user_id = auth.uid()'), 'tenant from auth.uid()')
  assertTrue(impl.includes('Office access required'), 'office exception text')
  assertTrue(
    impl.includes('Verified company membership required'),
    'company membership exception text',
  )
})

run('6. Tenant scope remains derived from authenticated membership (no caller args)', () => {
  assertTrue(
    impl.includes('into v_company_id'),
    'company id selected into local',
  )
  assertTrue(
    impl.includes('where d.company_id = v_company_id') ||
      impl.includes('d.company_id = v_company_id'),
    'documents/drivers scoped to v_company_id',
  )
  assertTrue(
    impl.includes('v.company_id = v_company_id'),
    'vehicles scoped to v_company_id',
  )
  assertTrue(
    !CREATE.includes('(p_') && !body.includes('p_company_id'),
    'no caller-controlled company argument',
  )
})

run('7. Notification generation behavior preserved (not removed)', () => {
  assertTrue(impl.includes('document_expiry'), 'document_expiry type')
  assertTrue(impl.includes('from public.documents d'), 'documents scan')
  assertTrue(
    impl.includes('from public.worker_compliance_records r'),
    'worker compliance scan',
  )
  assertTrue(
    impl.includes('from public.vehicle_compliance_records r'),
    'vehicle compliance scan',
  )
  assertTrue(
    impl.includes('public.drevora_notification_vehicle_label'),
    'vehicle label helper',
  )
  assertTrue(impl.includes('return v_inserted'), 'returns insert count')
  // Foundation still defines original helper used by this RPC
  assertTrue(
    foundation.includes('create or replace function public.drevora_insert_admin_notification'),
    'insert helper still defined in foundation',
  )
})

run('8. Migration applies only this function and includes apply-time assertions', () => {
  const createCount = (
    migration.match(/create or replace function public\./gi) || []
  ).length
  assertTrue(createCount === 1, `exactly one CREATE OR REPLACE function, got ${createCount}`)
  assertTrue(migration.includes('EXPIRY_NOTIFICATIONS_AAL2_ASSERT'), 'assert marker')
  assertTrue(
    migration.includes("is distinct from 'search_path=\"\"'") ||
      migration.includes('search_path=""'),
    'asserts canonical empty search_path',
  )
  assertTrue(
    migration.includes("has_function_privilege('authenticated'"),
    'asserts authenticated EXECUTE',
  )
  assertTrue(
    migration.includes("has_function_privilege('anon'"),
    'asserts anon no EXECUTE',
  )
  assertTrue(
    migration.includes("has_function_privilege('public'"),
    'asserts PUBLIC no EXECUTE',
  )
  assertTrue(migration.includes('begin;'), 'transaction begin')
  assertTrue(migration.includes('commit;'), 'transaction commit')
})

run('9. Frontend still calls this RPC (intentional client path)', () => {
  assertTrue(
    adminService.includes("rpc('drevora_generate_expiry_notifications')") ||
      adminService.includes('drevora_generate_expiry_notifications'),
    'adminNotificationsService still invokes RPC',
  )
})

console.log(`\nAll ${passed} checks passed.`)

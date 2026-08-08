/**
 * Focused verification: server-only audit/dispatch table hardening.
 * Run: npm run verify:server-only-table-security
 *
 * Covers:
 *   public.office_user_invitation_events
 *   public.worker_access_email_dispatches
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

const migration = read(
  'supabase/migrations/20260808200000_harden_server_only_audit_tables.sql',
)
const schema = read('supabase/schema.sql')
const policies = read('supabase/policies.sql')
const inviteOfficeEdge = read('supabase/functions/invite-office-user/index.ts')
const accessEmailEdge = read('supabase/functions/send-worker-access-email/index.ts')
const officeInviteFoundation = read(
  'supabase/migrations/20260808150000_office_user_invitation_foundation.sql',
)
const accessEmailFoundation = read(
  'supabase/migrations/20260806240000_worker_access_email.sql',
)
const listOfficeUsers = read('supabase/migrations/20260808160000_list_office_users.sql')
const officeInvitationService = read('src/services/officeInvitationService.ts')
const workerAccessEmailService = read('src/services/workerAccessEmailService.ts')

const TABLES = [
  'office_user_invitation_events',
  'worker_access_email_dispatches',
] as const

function policyName(table: (typeof TABLES)[number]): string {
  return `${table}_deny_client_access`
}

function assertDenyPolicy(source: string, table: (typeof TABLES)[number], label: string) {
  const name = policyName(table)
  assertTrue(source.includes(`drop policy if exists ${name}`), `${label}: drop ${name}`)
  assertTrue(source.includes(`create policy ${name}`), `${label}: create ${name}`)
  const start = source.indexOf(`create policy ${name}`)
  assertTrue(start >= 0, `${label}: policy block start`)
  const slice = source.slice(start, start + 450)
  assertTrue(slice.includes(`on public.${table}`), `${label}: on table`)
  assertTrue(slice.includes('for all'), `${label}: for all`)
  assertTrue(slice.includes('to anon, authenticated'), `${label}: client roles`)
  assertTrue(slice.includes('using (false)'), `${label}: using false`)
  assertTrue(slice.includes('with check (false)'), `${label}: with check false`)
  assertTrue(!slice.includes('using (true)'), `${label}: not permissive true`)
  assertTrue(!slice.includes('to service_role'), `${label}: no service_role policy`)
}

run('1. Hardening migration exists and targets both tables only', () => {
  assertTrue(
    migration.includes('harden_server_only_audit_tables') ||
      migration.includes('rls_enabled_no_policy'),
    'advisor intent documented',
  )
  for (const table of TABLES) {
    assertTrue(migration.includes(`public.${table}`), `mentions ${table}`)
    assertTrue(
      migration.includes(`alter table public.${table} enable row level security`),
      `RLS enabled ${table}`,
    )
  }
})

run('2. Both tables retain RLS + revoke client grants + grant service_role', () => {
  for (const table of TABLES) {
    assertTrue(
      migration.includes(`revoke all on table public.${table} from anon`),
      `revoke anon ${table}`,
    )
    assertTrue(
      migration.includes(`revoke all on table public.${table} from authenticated`),
      `revoke authenticated ${table}`,
    )
    assertTrue(
      migration.includes(`grant all on table public.${table} to service_role`),
      `grant service_role ${table}`,
    )
    assertTrue(
      !migration.includes(`grant select on table public.${table} to authenticated`),
      `no auth select ${table}`,
    )
    assertTrue(
      !migration.includes(`grant insert on table public.${table} to authenticated`),
      `no auth insert ${table}`,
    )
    assertTrue(
      !migration.includes(`grant update on table public.${table} to authenticated`),
      `no auth update ${table}`,
    )
    assertTrue(
      !migration.includes(`grant delete on table public.${table} to authenticated`),
      `no auth delete ${table}`,
    )
  }
})

run('3. Explicit deny policies for anon/authenticated (not service_role)', () => {
  for (const table of TABLES) {
    assertDenyPolicy(migration, table, 'migration')
    assertDenyPolicy(schema, table, 'schema')
    assertDenyPolicy(policies, table, 'policies')
  }
})

run('4. No permissive client policies created for these tables', () => {
  for (const table of TABLES) {
    const name = policyName(table)
    for (const [label, source] of [
      ['migration', migration],
      ['schema', schema],
      ['policies', policies],
    ] as const) {
      const start = source.indexOf(`create policy ${name}`)
      const slice = source.slice(start, start + 450)
      assertTrue(!/using\s*\(\s*true\s*\)/i.test(slice), `${label} ${table}: no using true`)
      assertTrue(
        !slice.includes('auth.uid()'),
        `${label} ${table}: deny policy is not a membership grant`,
      )
    }
  }
})

run('5. Frontend never queries either table directly', () => {
  assertTrue(
    !officeInvitationService.includes(".from('office_user_invitation_events')"),
    'office service no direct from',
  )
  assertTrue(
    !officeInvitationService.includes('.from("office_user_invitation_events")'),
    'office service no direct from dq',
  )
  assertTrue(
    !workerAccessEmailService.includes(".from('worker_access_email_dispatches')"),
    'access email service no direct from',
  )
  assertTrue(
    officeInvitationService.includes("rpc('drevora_list_office_users')") ||
      officeInvitationService.includes('drevora_list_office_users'),
    'office list uses RPC',
  )
  assertTrue(
    workerAccessEmailService.includes("functions.invoke('send-worker-access-email'") ||
      workerAccessEmailService.includes('send-worker-access-email'),
    'access email uses Edge Function',
  )
})

run('6. Edge paths remain service_role RPC (not direct client table writes)', () => {
  assertTrue(
    inviteOfficeEdge.includes("rpc('drevora_link_invited_office_user'") ||
      inviteOfficeEdge.includes('drevora_link_invited_office_user'),
    'invite-office-user links via RPC',
  )
  assertTrue(
    inviteOfficeEdge.includes('drevora_insert_office_user_invitation_event'),
    'invite-office-user audits via RPC',
  )
  assertTrue(
    accessEmailEdge.includes('drevora_begin_worker_access_email_send'),
    'begin RPC',
  )
  assertTrue(
    accessEmailEdge.includes('drevora_finalize_worker_access_email_send') ||
      accessEmailEdge.includes('drevora_fail_worker_access_email_send'),
    'finalize/fail RPC',
  )
  assertTrue(
    !accessEmailEdge.includes(".from('worker_access_email_dispatches')"),
    'edge does not touch table directly',
  )
  assertTrue(
    !inviteOfficeEdge.includes(".from('office_user_invitation_events')"),
    'invite edge does not touch table directly',
  )
})

run('7. Writer RPCs remain service_role EXECUTE only', () => {
  const writers = [
    'drevora_link_invited_office_user(uuid, uuid, uuid, text, text, text)',
    'drevora_insert_office_user_invitation_event(uuid, text, text, uuid, uuid, uuid, text, text, jsonb)',
    'drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer)',
    'drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text)',
    'drevora_fail_worker_access_email_send(uuid, uuid, text)',
  ]
  for (const sig of writers) {
    assertTrue(
      migration.includes(`revoke all on function public.${sig} from authenticated`),
      `revoke authenticated ${sig}`,
    )
    assertTrue(
      migration.includes(`grant execute on function public.${sig} to service_role`),
      `grant service_role ${sig}`,
    )
    assertTrue(
      officeInviteFoundation.includes(`security definer`) ||
        accessEmailFoundation.includes(`security definer`),
      'foundation uses security definer',
    )
  }
  assertTrue(
    officeInviteFoundation.includes('security definer'),
    'office invite RPCs security definer',
  )
  assertTrue(
    accessEmailFoundation.includes('security definer'),
    'access email RPCs security definer',
  )
})

run('8. list_office_users still authenticated EXECUTE (SECURITY DEFINER read path)', () => {
  assertTrue(listOfficeUsers.includes('security definer'), 'list is security definer')
  assertTrue(
    listOfficeUsers.includes('from public.office_user_invitation_events'),
    'list may read invitation events',
  )
  assertTrue(
    migration.includes(
      'grant execute on function public.drevora_list_office_users() to authenticated',
    ),
    'authenticated execute preserved',
  )
  assertTrue(
    migration.includes(
      'revoke all on function public.drevora_list_office_users() from anon',
    ),
    'anon cannot execute list',
  )
})

run('9. No service_role policy invented for linter appeasement', () => {
  assertTrue(
    !migration.includes('to service_role\n  using'),
    'no service_role using policy',
  )
  assertTrue(
    !migration.includes('create policy') ||
      !/create policy[\s\S]{0,200}to service_role/.test(migration),
    'no create policy targeting service_role',
  )
})

console.log(`\nAll ${passed} checks passed.`)

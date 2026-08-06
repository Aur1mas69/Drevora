-- DREVORA — Worker access email (send account access) backend
-- File: supabase/migrations/20260806240000_worker_access_email.sql
--
-- Purpose:
--   1) Allow worker_identity_events.event_type = access_email_sent
--   2) Private worker_access_email_dispatches reservation table
--   3) Atomic begin / finalize / fail RPCs (service_role) with advisory lock
--
-- Edge Function (deploy separately): send-worker-access-email
--   Uses anon resetPasswordForEmail against the server-resolved Auth email.
--   Never trusts browser companyId/authUserId/email as the send target.
--
-- Concurrent-send protection:
--   begin acquires pg_advisory_xact_lock keyed by driver_id, expires stale
--   pending (>5 min), enforces 900s cooldown from successful sends only,
--   inserts exactly one pending reservation.
--
-- Idempotent. Does NOT apply itself — run manually after review.
-- Does not create/rebind Auth users. Does not change drivers.email.

begin;

-- -----------------------------------------------------------------------------
-- 1) Event type allowlist
-- -----------------------------------------------------------------------------
alter table public.worker_identity_events
  drop constraint if exists worker_identity_events_event_type_check;

alter table public.worker_identity_events
  add constraint worker_identity_events_event_type_check check (
    event_type in (
      'auth_user_backfilled',
      'auth_user_linked',
      'identity_replacement_blocked',
      'login_email_changed',
      'access_email_sent'
    )
  );

create index if not exists worker_identity_events_driver_access_email_sent_idx
  on public.worker_identity_events (driver_id, created_at desc)
  where event_type = 'access_email_sent';

-- -----------------------------------------------------------------------------
-- 2) Private dispatch reservation table (no browser access)
-- -----------------------------------------------------------------------------
create table if not exists public.worker_access_email_dispatches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  driver_id uuid not null references public.drivers (id) on delete restrict,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  status text not null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null,
  failure_code text null,
  constraint worker_access_email_dispatches_status_check check (
    status in ('pending', 'sent', 'failed', 'expired')
  ),
  constraint worker_access_email_dispatches_completed_check check (
    (status = 'pending' and completed_at is null)
    or (status <> 'pending' and completed_at is not null)
  )
);

comment on table public.worker_access_email_dispatches is
  'Private access-email send reservations. No browser SELECT/INSERT/UPDATE/DELETE. Writers are service-role SECURITY DEFINER RPCs only.';

create index if not exists worker_access_email_dispatches_driver_created_at_idx
  on public.worker_access_email_dispatches (driver_id, created_at desc);

create index if not exists worker_access_email_dispatches_driver_sent_completed_idx
  on public.worker_access_email_dispatches (driver_id, completed_at desc)
  where status = 'sent';

-- At most one live pending reservation per Worker (stale rows are expired first).
create unique index if not exists worker_access_email_dispatches_one_pending_per_driver_idx
  on public.worker_access_email_dispatches (driver_id)
  where status = 'pending';

alter table public.worker_access_email_dispatches enable row level security;

revoke all on table public.worker_access_email_dispatches from public;
revoke all on table public.worker_access_email_dispatches from anon;
revoke all on table public.worker_access_email_dispatches from authenticated;
grant all on table public.worker_access_email_dispatches to service_role;

-- No authenticated policies — browser has no access.

-- Drop superseded assert/record helpers if a prior draft of this migration existed.
drop function if exists public.drevora_assert_worker_access_email_allowed(uuid, uuid, integer);
drop function if exists public.drevora_record_worker_access_email_sent(uuid, uuid, uuid, text, text);

-- -----------------------------------------------------------------------------
-- 3) Begin: atomic reservation (service_role)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_begin_worker_access_email_send(
  p_actor_user_id uuid,
  p_driver_id uuid,
  p_expected_auth_user_id uuid,
  p_cooldown_seconds integer default 900,
  p_pending_ttl_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.drivers%rowtype;
  v_actor_role text;
  v_cooldown integer := greatest(coalesce(p_cooldown_seconds, 900), 60);
  v_pending_ttl integer := greatest(coalesce(p_pending_ttl_seconds, 300), 60);
  v_last_sent_at timestamptz;
  v_retry_after integer;
  v_pending_count integer := 0;
  v_dispatch_id uuid;
  v_now timestamptz := timezone('utc', now());
begin
  if p_actor_user_id is null or p_driver_id is null or p_expected_auth_user_id is null then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0001',
            hint = 'actor_user_id, driver_id and expected_auth_user_id are required.';
  end if;

  -- Serialize concurrent begin attempts for the same Worker.
  perform pg_advisory_xact_lock(
    8742001,
    hashtext(p_driver_id::text)
  );

  select d.*
  into v_driver
  from public.drivers d
  where d.id = p_driver_id
  for update;

  if not found then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker was not found.';
  end if;

  if v_driver.company_id is null then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker has no company.';
  end if;

  select cm.role
  into v_actor_role
  from public.company_members cm
  where cm.user_id = p_actor_user_id
    and cm.company_id = v_driver.company_id
    and cm.is_active = true;

  if v_actor_role is null or v_actor_role not in (
    'Admin',
    'Transport Manager',
    'Supervisor',
    'Planner',
    'Office Staff'
  ) then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only Office membership roles may send Worker access email.';
  end if;

  if v_driver.archived_at is not null then
    raise exception 'WORKER_ARCHIVED'
      using errcode = 'P0001',
            hint = 'Archived Workers cannot receive access email.';
  end if;

  if v_driver.auth_user_id is null then
    raise exception 'WORKER_AUTH_NOT_LINKED'
      using errcode = 'P0001',
            hint = 'Worker has no immutable Auth link.';
  end if;

  if v_driver.auth_user_id is distinct from p_expected_auth_user_id then
    raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
      using errcode = 'P0001',
            hint = 'Auth user id does not match the linked Worker profile.';
  end if;

  -- Expire stale pending reservations (>5 minutes by default).
  update public.worker_access_email_dispatches d
  set
    status = 'expired',
    completed_at = v_now,
    failure_code = coalesce(d.failure_code, 'pending_expired')
  where d.driver_id = v_driver.id
    and d.status = 'pending'
    and d.created_at <= v_now - make_interval(secs => v_pending_ttl);

  select count(*)::integer
  into v_pending_count
  from public.worker_access_email_dispatches d
  where d.driver_id = v_driver.id
    and d.status = 'pending';

  if v_pending_count > 0 then
    raise exception 'ACCESS_EMAIL_RATE_LIMITED'
      using errcode = 'P0001',
            hint = 'An access email send is already in progress for this Worker.';
  end if;

  -- Cooldown from successful sends only (failed/expired do not count).
  select d.completed_at
  into v_last_sent_at
  from public.worker_access_email_dispatches d
  where d.driver_id = v_driver.id
    and d.status = 'sent'
    and d.completed_at is not null
  order by d.completed_at desc, d.id desc
  limit 1;

  if v_last_sent_at is not null
     and v_last_sent_at > v_now - make_interval(secs => v_cooldown)
  then
    v_retry_after := greatest(
      1,
      ceil(
        extract(
          epoch from (
            (v_last_sent_at + make_interval(secs => v_cooldown)) - v_now
          )
        )
      )::integer
    );
    raise exception 'ACCESS_EMAIL_RATE_LIMITED'
      using errcode = 'P0001',
            hint = format('Retry after %s seconds.', v_retry_after);
  end if;

  insert into public.worker_access_email_dispatches (
    company_id,
    driver_id,
    actor_user_id,
    status
  )
  values (
    v_driver.company_id,
    v_driver.id,
    p_actor_user_id,
    'pending'
  )
  returning id into v_dispatch_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'access_email_dispatch_pending',
    'dispatch_id', v_dispatch_id,
    'driver_id', v_driver.id,
    'company_id', v_driver.company_id,
    'auth_user_id', v_driver.auth_user_id,
    'profile_email', lower(btrim(coalesce(v_driver.email, ''))),
    'cooldown_seconds', v_cooldown,
    'pending_ttl_seconds', v_pending_ttl
  );
end;
$$;

comment on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) is
  'Service-role: atomically reserve a pending Worker access-email dispatch under an advisory lock. Enforces Office scope, Auth link, pending TTL and 900s success cooldown.';

revoke all on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) from public;
revoke all on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) from anon;
revoke all on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) from authenticated;
grant execute on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) to service_role;

-- -----------------------------------------------------------------------------
-- 4) Finalize: pending → sent + one access_email_sent audit
-- -----------------------------------------------------------------------------
create or replace function public.drevora_finalize_worker_access_email_send(
  p_actor_user_id uuid,
  p_dispatch_id uuid,
  p_expected_auth_user_id uuid,
  p_email text,
  p_reason text default 'office_send_account_access_email'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispatch public.worker_access_email_dispatches%rowtype;
  v_driver public.drivers%rowtype;
  v_actor_role text;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_event_id uuid;
  v_now timestamptz := timezone('utc', now());
begin
  if p_actor_user_id is null or p_dispatch_id is null or p_expected_auth_user_id is null then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0001',
            hint = 'actor_user_id, dispatch_id and expected_auth_user_id are required.';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'INVALID_EMAIL'
      using errcode = 'P0001',
            hint = 'A valid email is required for the audit record.';
  end if;

  if v_reason is null then
    v_reason := 'office_send_account_access_email';
  end if;

  select d.*
  into v_dispatch
  from public.worker_access_email_dispatches d
  where d.id = p_dispatch_id
  for update;

  if not found then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Access email dispatch was not found.';
  end if;

  perform pg_advisory_xact_lock(
    8742001,
    hashtext(v_dispatch.driver_id::text)
  );

  -- Idempotent duplicate finalize: already sent for this dispatch.
  if v_dispatch.status = 'sent' then
    if v_dispatch.actor_user_id is distinct from p_actor_user_id then
      raise exception 'FORBIDDEN'
        using errcode = 'P0001',
              hint = 'Dispatch actor mismatch.';
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'access_email_already_finalized',
      'dispatch_id', v_dispatch.id,
      'driver_id', v_dispatch.driver_id,
      'auth_user_id', p_expected_auth_user_id,
      'email', v_email,
      'event_id', null,
      'duplicate', true
    );
  end if;

  if v_dispatch.status <> 'pending' then
    raise exception 'ACCESS_EMAIL_RATE_LIMITED'
      using errcode = 'P0001',
            hint = format('Dispatch is %s and cannot be finalized.', v_dispatch.status);
  end if;

  if v_dispatch.actor_user_id is distinct from p_actor_user_id then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only the reserving Office actor may finalize this dispatch.';
  end if;

  select d.*
  into v_driver
  from public.drivers d
  where d.id = v_dispatch.driver_id
  for update;

  if not found or v_driver.company_id is distinct from v_dispatch.company_id then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker was not found for this dispatch.';
  end if;

  select cm.role
  into v_actor_role
  from public.company_members cm
  where cm.user_id = p_actor_user_id
    and cm.company_id = v_driver.company_id
    and cm.is_active = true;

  if v_actor_role is null or v_actor_role not in (
    'Admin',
    'Transport Manager',
    'Supervisor',
    'Planner',
    'Office Staff'
  ) then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only Office membership roles may finalize access email sends.';
  end if;

  if v_driver.archived_at is not null then
    raise exception 'WORKER_ARCHIVED'
      using errcode = 'P0001',
            hint = 'Archived Workers cannot receive access email.';
  end if;

  if v_driver.auth_user_id is null then
    raise exception 'WORKER_AUTH_NOT_LINKED'
      using errcode = 'P0001',
            hint = 'Worker has no immutable Auth link.';
  end if;

  if v_driver.auth_user_id is distinct from p_expected_auth_user_id then
    raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
      using errcode = 'P0001',
            hint = 'Auth user id does not match the linked Worker profile.';
  end if;

  if lower(btrim(coalesce(v_driver.email, ''))) is distinct from v_email then
    raise exception 'WORKER_LOGIN_EMAIL_OUT_OF_SYNC'
      using errcode = 'P0001',
            hint = 'Worker profile email no longer matches the access email.';
  end if;

  update public.worker_access_email_dispatches d
  set
    status = 'sent',
    completed_at = v_now,
    failure_code = null
  where d.id = v_dispatch.id
    and d.status = 'pending';

  if not found then
    raise exception 'ACCESS_EMAIL_RATE_LIMITED'
      using errcode = 'P0001',
            hint = 'Dispatch was no longer pending.';
  end if;

  v_event_id := public.drevora_insert_worker_identity_event(
    v_driver.company_id,
    v_driver.id,
    v_driver.auth_user_id,
    p_actor_user_id,
    'access_email_sent',
    jsonb_build_object(
      'email', v_email
    ),
    jsonb_build_object(
      'email', v_email,
      'source', 'send_worker_access_email',
      'redirect', 'https://app.drevora.app/reset-password',
      'dispatch_id', v_dispatch.id
    ),
    v_reason
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'access_email_sent',
    'dispatch_id', v_dispatch.id,
    'driver_id', v_driver.id,
    'auth_user_id', v_driver.auth_user_id,
    'email', v_email,
    'event_id', v_event_id,
    'duplicate', false
  );
end;
$$;

comment on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) is
  'Service-role: mark a pending access-email dispatch as sent and write exactly one access_email_sent audit. Duplicate finalize is idempotent.';

revoke all on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) from public;
revoke all on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) from anon;
revoke all on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) from authenticated;
grant execute on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- 5) Fail: pending → failed (no success audit / no cooldown)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_fail_worker_access_email_send(
  p_actor_user_id uuid,
  p_dispatch_id uuid,
  p_failure_code text default 'server_failure'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispatch public.worker_access_email_dispatches%rowtype;
  v_code text := lower(btrim(coalesce(nullif(btrim(coalesce(p_failure_code, '')), ''), 'server_failure')));
  v_now timestamptz := timezone('utc', now());
begin
  if p_actor_user_id is null or p_dispatch_id is null then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0001',
            hint = 'actor_user_id and dispatch_id are required.';
  end if;

  -- Keep failure codes short and non-sensitive.
  if length(v_code) > 64
     or v_code ~ '[^a-z0-9_]'
     or v_code ~ '(sql|stack|service_role|jwt|password|secret)'
  then
    v_code := 'server_failure';
  end if;

  select d.*
  into v_dispatch
  from public.worker_access_email_dispatches d
  where d.id = p_dispatch_id
  for update;

  if not found then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Access email dispatch was not found.';
  end if;

  perform pg_advisory_xact_lock(
    8742001,
    hashtext(v_dispatch.driver_id::text)
  );

  if v_dispatch.status = 'failed' then
    return jsonb_build_object(
      'ok', true,
      'code', 'access_email_already_failed',
      'dispatch_id', v_dispatch.id,
      'driver_id', v_dispatch.driver_id,
      'failure_code', v_dispatch.failure_code,
      'duplicate', true
    );
  end if;

  if v_dispatch.status <> 'pending' then
    raise exception 'ACCESS_EMAIL_RATE_LIMITED'
      using errcode = 'P0001',
            hint = format('Dispatch is %s and cannot be failed.', v_dispatch.status);
  end if;

  if v_dispatch.actor_user_id is distinct from p_actor_user_id then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only the reserving Office actor may fail this dispatch.';
  end if;

  update public.worker_access_email_dispatches d
  set
    status = 'failed',
    completed_at = v_now,
    failure_code = v_code
  where d.id = v_dispatch.id
    and d.status = 'pending';

  if not found then
    raise exception 'ACCESS_EMAIL_RATE_LIMITED'
      using errcode = 'P0001',
            hint = 'Dispatch was no longer pending.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'access_email_failed',
    'dispatch_id', v_dispatch.id,
    'driver_id', v_dispatch.driver_id,
    'failure_code', v_code,
    'duplicate', false
  );
end;
$$;

comment on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) is
  'Service-role: mark a pending access-email dispatch as failed. Does not write access_email_sent and does not start the success cooldown.';

revoke all on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) from public;
revoke all on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) from anon;
revoke all on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) from authenticated;
grant execute on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';

commit;

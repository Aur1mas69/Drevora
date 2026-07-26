-- DREVORA — Holiday Requests created_at hardening + retention lifecycle
-- File: supabase/migrations/20260726210000_holiday_requests_retention_lifecycle.sql
--
-- Purpose (atomic):
--   1) Make created_at database-authoritative on every INSERT
--      (ignore client-supplied values; assign transaction_timestamp()).
--   2) Make created_at immutable on authenticated client UPDATE.
--   3) Add retention_expires_at = created_at + interval '6 years'.
--   4) Backfill existing rows with valid created_at.
--   5) Guard overwrites any client-supplied retention_expires_at.
--
-- Trigger architecture:
--   Existing: drevora_enforce_holiday_request_worker_write
--             (BEFORE INSERT OR UPDATE OR DELETE; name order first)
--   New:      holiday_requests_created_at_retention_guard
--             (BEFORE INSERT OR UPDATE; alphabetical after "drevora_enforce…")
--   Safe order: worker allowlist runs first; this guard then forces
--   created_at + retention for Worker and Office clients alike.
--
-- Does not purge, cron, hard-delete, or alter Worker Archive.
-- Does NOT apply itself — run manually in the Supabase SQL editor after review.
-- Idempotent.

-- =============================================================================
-- 0) Pre-apply diagnostics (commented)
-- =============================================================================
-- select column_name, data_type, column_default, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'holiday_requests'
--   and column_name in ('created_at', 'retention_expires_at', 'status', 'company_id')
-- order by column_name;
--
-- select count(*) as null_created_at
-- from public.holiday_requests
-- where created_at is null;

begin;

-- =============================================================================
-- 1) Preflight — refuse invented created_at
-- =============================================================================
do $$
declare
  v_null_count integer;
begin
  select count(*)::integer
  into v_null_count
  from public.holiday_requests
  where created_at is null;

  if v_null_count > 0 then
    raise exception
      'HOLIDAY_CREATED_AT_REQUIRED: % Holiday Request row(s) have created_at IS NULL. Manual data review is required before retention backfill. Do not invent created_at.',
      v_null_count
      using errcode = 'P0001';
  end if;
end;
$$;

-- =============================================================================
-- 2) Column
-- =============================================================================
alter table public.holiday_requests
  add column if not exists retention_expires_at timestamptz;

comment on column public.holiday_requests.retention_expires_at is
  'Final retention metadata for the Holiday Request parent: created_at + 6 calendar years. Derived only from database-authoritative created_at. Does not auto-delete.';

comment on column public.holiday_requests.created_at is
  'Database-authoritative create timestamp. On INSERT always set to transaction_timestamp(); immutable after INSERT for authenticated clients.';

-- =============================================================================
-- 3) Pure calculator
-- =============================================================================
create or replace function public.drevora_holiday_request_retention_expires_at(
  p_created_at timestamptz
)
returns timestamptz
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_created_at + interval '6 years';
$$;

comment on function public.drevora_holiday_request_retention_expires_at(timestamptz) is
  'Holiday Request retention deadline: created_at plus six calendar years (timestamptz semantics preserved).';

revoke all on function public.drevora_holiday_request_retention_expires_at(timestamptz) from public;
revoke all on function public.drevora_holiday_request_retention_expires_at(timestamptz) from anon;
grant execute on function public.drevora_holiday_request_retention_expires_at(timestamptz) to authenticated;

-- =============================================================================
-- 4) Backfill existing valid rows
-- =============================================================================
update public.holiday_requests h
set retention_expires_at = public.drevora_holiday_request_retention_expires_at(h.created_at)
where h.created_at is not null
  and (
    h.retention_expires_at is null
    or h.retention_expires_at is distinct from
      public.drevora_holiday_request_retention_expires_at(h.created_at)
  );

-- =============================================================================
-- 5) Dedicated created_at + retention guard (all authenticated writers)
-- =============================================================================
create or replace function public.drevora_holiday_requests_created_at_retention_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected timestamptz;
begin
  -- Trusted writers (service_role / migration helpers) may adjust rows without
  -- anti-spoof enforcement. Normal authenticated clients never get this path.
  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    -- Ignore any client-supplied created_at (DEFAULT alone is insufficient).
    new.created_at := transaction_timestamp();
    v_expected := public.drevora_holiday_request_retention_expires_at(new.created_at);
    new.retention_expires_at := v_expected;
  elsif tg_op = 'UPDATE' then
    if new.created_at is distinct from old.created_at then
      raise exception 'HOLIDAY_CREATED_AT_IMMUTABLE'
        using errcode = 'P0001',
              hint = 'Holiday Request created_at cannot be changed after insert.';
    end if;

    new.created_at := old.created_at;
    v_expected := public.drevora_holiday_request_retention_expires_at(old.created_at);
    -- Ignore client-supplied retention; never restart from updated_at / dates.
    new.retention_expires_at := v_expected;
  end if;

  if new.created_at is null then
    raise exception 'HOLIDAY_CREATED_AT_REQUIRED'
      using errcode = 'P0001',
            hint = 'Holiday Request created_at is required.';
  end if;

  if new.retention_expires_at is null then
    raise exception 'HOLIDAY_RETENTION_REQUIRED'
      using errcode = 'P0001',
            hint = 'Holiday Request retention_expires_at is required.';
  end if;

  if new.retention_expires_at <= new.created_at then
    raise exception 'HOLIDAY_RETENTION_INVALID'
      using errcode = 'P0001',
            hint = 'retention_expires_at must be after created_at.';
  end if;

  if new.retention_expires_at is distinct from
       public.drevora_holiday_request_retention_expires_at(new.created_at) then
    raise exception 'HOLIDAY_RETENTION_INVALID'
      using errcode = 'P0001',
            hint = 'retention_expires_at must equal created_at plus six calendar years.';
  end if;

  return new;
end;
$$;

comment on function public.drevora_holiday_requests_created_at_retention_guard() is
  'Forces authoritative created_at on INSERT; immutability on UPDATE; retention_expires_at = created_at + 6 years. SECURITY INVOKER.';

drop trigger if exists holiday_requests_created_at_retention_guard on public.holiday_requests;
-- Name sorts after drevora_enforce_holiday_request_worker_write so allowlist runs first.
create trigger holiday_requests_created_at_retention_guard
  before insert or update
  on public.holiday_requests
  for each row
  execute function public.drevora_holiday_requests_created_at_retention_guard();

revoke all on function public.drevora_holiday_requests_created_at_retention_guard() from public;
revoke all on function public.drevora_holiday_requests_created_at_retention_guard() from anon;
revoke all on function public.drevora_holiday_requests_created_at_retention_guard() from authenticated;

-- =============================================================================
-- 6) Column REVOKE (defense-in-depth only; table GRANT may still confer access)
-- =============================================================================
-- holiday_requests uses table-level INSERT/UPDATE for authenticated.
-- has_column_privilege() reports effective access; column REVOKE does not override
-- a broader table-level grant. Authoritative anti-spoofing is the guard above.
revoke insert (created_at) on table public.holiday_requests from anon;
revoke update (created_at) on table public.holiday_requests from anon;
revoke insert (retention_expires_at) on table public.holiday_requests from anon;
revoke update (retention_expires_at) on table public.holiday_requests from anon;

revoke insert (created_at) on table public.holiday_requests from authenticated;
revoke update (created_at) on table public.holiday_requests from authenticated;
revoke insert (retention_expires_at) on table public.holiday_requests from authenticated;
revoke update (retention_expires_at) on table public.holiday_requests from authenticated;

revoke insert (created_at) on table public.holiday_requests from public;
revoke update (created_at) on table public.holiday_requests from public;
revoke insert (retention_expires_at) on table public.holiday_requests from public;
revoke update (retention_expires_at) on table public.holiday_requests from public;

commit;

-- =============================================================================
-- 7) Post-apply diagnostics (commented — after COMMIT only)
-- =============================================================================
-- -- Null created_at (expect 0):
-- select count(*) as null_created_at
-- from public.holiday_requests
-- where created_at is null;
--
-- -- Missing retention (expect 0):
-- select count(*) as missing_retention
-- from public.holiday_requests
-- where retention_expires_at is null;
--
-- -- Non-canonical deadlines (expect 0):
-- select count(*) as retention_mismatch
-- from public.holiday_requests
-- where retention_expires_at is distinct from
--   public.drevora_holiday_request_retention_expires_at(created_at);
--
-- -- Deadlines <= created_at (expect 0):
-- select count(*) as retention_not_after_created
-- from public.holiday_requests
-- where retention_expires_at <= created_at;
--
-- -- Example timestamps:
-- select id, created_at, retention_expires_at,
--        public.drevora_holiday_request_retention_expires_at(created_at) as canonical
-- from public.holiday_requests
-- order by created_at desc
-- limit 5;
--
-- -- Counts by status:
-- select status, count(*) as n
-- from public.holiday_requests
-- group by status
-- order by status;
--
-- -- Linked to archived Workers:
-- select count(*) as holiday_requests_for_archived_workers
-- from public.holiday_requests h
-- join public.drivers d on d.id = h.worker_id
-- where d.archived_at is not null;
--
-- -- Effective privileges (interpret table + column together):
-- select
--   has_table_privilege('authenticated', 'public.holiday_requests', 'INSERT') as auth_table_insert,
--   has_table_privilege('authenticated', 'public.holiday_requests', 'UPDATE') as auth_table_update,
--   has_table_privilege('authenticated', 'public.holiday_requests', 'DELETE') as auth_table_delete,
--   has_column_privilege('authenticated', 'public.holiday_requests', 'created_at', 'INSERT')
--     as auth_col_ins_created_at,
--   has_column_privilege('authenticated', 'public.holiday_requests', 'created_at', 'UPDATE')
--     as auth_col_upd_created_at,
--   has_column_privilege('authenticated', 'public.holiday_requests', 'retention_expires_at', 'INSERT')
--     as auth_col_ins_retention,
--   has_column_privilege('authenticated', 'public.holiday_requests', 'retention_expires_at', 'UPDATE')
--     as auth_col_upd_retention,
--   has_column_privilege('authenticated', 'public.holiday_requests', 'retention_expires_at', 'SELECT')
--     as auth_col_sel_retention;
--
-- select
--   has_table_privilege('anon', 'public.holiday_requests', 'INSERT') as anon_table_insert,
--   has_table_privilege('anon', 'public.holiday_requests', 'UPDATE') as anon_table_update,
--   has_column_privilege('anon', 'public.holiday_requests', 'created_at', 'INSERT')
--     as anon_col_ins_created_at,
--   has_column_privilege('anon', 'public.holiday_requests', 'retention_expires_at', 'UPDATE')
--     as anon_col_upd_retention;
--
-- select grantee, privilege_type, is_grantable
-- from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'holiday_requests'
--   and grantee in ('authenticated', 'anon', 'PUBLIC')
-- order by grantee, privilege_type;
--
-- select grantee, column_name, privilege_type
-- from information_schema.column_privileges
-- where table_schema = 'public' and table_name = 'holiday_requests'
--   and column_name in ('created_at', 'retention_expires_at')
--   and grantee in ('authenticated', 'anon', 'PUBLIC')
-- order by grantee, column_name, privilege_type;
--
-- -- RLS mutation policies:
-- select policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public' and tablename = 'holiday_requests'
-- order by policyname;
--
-- -- Trigger inventory and order (tgname alphabetical for same timing):
-- select t.tgname, pg_get_triggerdef(t.oid) as definition
-- from pg_trigger t
-- join pg_class c on c.oid = t.tgrelid
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relname = 'holiday_requests'
--   and not t.tgisinternal
-- order by t.tgname;
-- -- Expected BEFORE INSERT/UPDATE order:
-- --   1) drevora_enforce_holiday_request_worker_write
-- --   2) holiday_requests_created_at_retention_guard
--
-- select
--   p.proname,
--   p.prosecdef as security_definer,
--   pg_get_function_identity_arguments(p.oid) as args,
--   (
--     select string_agg(cfg, ', ' order by cfg)
--     from unnest(coalesce(p.proconfig, array[]::text[])) as cfg
--   ) as config_including_search_path
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'drevora_holiday_request_retention_expires_at',
--     'drevora_holiday_requests_created_at_retention_guard',
--     'drevora_enforce_holiday_request_worker_write'
--   )
-- order by p.proname;
--
-- -- Manual spoof checks (Office/Worker session; replace <id>):
-- -- INSERT with spoofed created_at / retention must persist transaction time + +6y.
-- -- UPDATE created_at must raise HOLIDAY_CREATED_AT_IMMUTABLE.
-- -- UPDATE retention_expires_at to 2099 must restore created_at + 6 years.

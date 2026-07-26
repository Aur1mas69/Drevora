-- DREVORA — Worker Archive / Restore lifecycle + tenant RLS hardening
-- File: supabase/migrations/20260726190000_worker_archive_restore_lifecycle.sql
--
-- Purpose:
--   1) Add retention_expires_at (72 calendar months / 6 years from archive).
--   2) Office-only SECURITY DEFINER RPCs for Worker archive + restore.
--   3) On archive: clear drivers.default_vehicle_id and same-company
--      vehicles.current_driver_id pointing at the Worker (atomic with archive).
--   4) Make drevora_auth_user_driver_id() resolve ACTIVE Workers only so
--      archived Workers lose Worker-app DB access without deleting Auth users.
--   5) Access-status RPC for clear frontend archived messaging.
--   6) Enable tenant-safe drivers RLS; Office UPDATE only when active;
--      column INSERT/UPDATE allowlists excluding archived_at and
--      retention_expires_at; revoke client hard DELETE.
--
-- Idempotent. Does not modify historical operational rows, Storage, or Auth users.
-- Does NOT apply itself — run manually in the Supabase SQL editor after review.
-- Does NOT purge or hard-delete Workers when retention expires.
--
-- Plan limits: companies.plan_code → drevora_active_worker_limit_for_plan
-- Active seat rule: drivers.archived_at IS NULL (existing trigger).
-- Restore never recreates Vehicle assignments.
-- Retention: archived_at + 6 calendar years → retention_expires_at (profile shell only).
--
-- Helpers required (from 20260715210000):
--   drevora_auth_user_has_office_role_for_company(uuid)
--   drevora_auth_user_belongs_to_company_id(uuid)
--   drevora_vehicle_in_company(uuid, uuid)

-- =============================================================================
-- 0) Pre-apply diagnostics (commented)
-- =============================================================================
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'drivers'
--   and column_name in (
--     'archived_at', 'retention_expires_at', 'company_id', 'default_vehicle_id'
--   )
-- order by column_name;
--
-- select count(*) filter (where archived_at is not null) as archived_workers,
--        count(*) filter (
--          where archived_at is not null and retention_expires_at is null
--        ) as archived_missing_retention
-- from public.drivers;
--
-- select has_table_privilege('authenticated', 'public.drivers', 'DELETE') as auth_can_delete;

begin;

-- =============================================================================
-- 1) retention_expires_at column + backfill + lifecycle guard
-- =============================================================================
alter table public.drivers
  add column if not exists retention_expires_at timestamptz;

comment on column public.drivers.retention_expires_at is
  'UTC deadline for minimum archived Worker profile shell retention (archived_at + 6 calendar years / 72 months). NULL when active. Does not auto-delete.';

-- Deterministic backfill for already-archived Workers only.
update public.drivers d
set retention_expires_at = d.archived_at + interval '6 years'
where d.archived_at is not null
  and d.retention_expires_at is null;

create or replace function public.drevora_drivers_retention_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.archived_at is null then
    if new.retention_expires_at is not null then
      raise exception 'WORKER_RETENTION_INVALID'
        using errcode = 'P0001',
              hint = 'Active Workers cannot have a retention deadline.';
    end if;
    new.retention_expires_at := null;
  else
    if new.retention_expires_at is null then
      raise exception 'WORKER_RETENTION_REQUIRED'
        using errcode = 'P0001',
              hint = 'Archived Workers require retention_expires_at.';
    end if;
    if new.retention_expires_at <= new.archived_at then
      raise exception 'WORKER_RETENTION_INVALID'
        using errcode = 'P0001',
              hint = 'retention_expires_at must be after archived_at.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists drivers_retention_guard on public.drivers;
create trigger drivers_retention_guard
  before insert or update of archived_at, retention_expires_at
  on public.drivers
  for each row
  execute function public.drevora_drivers_retention_guard();

revoke all on function public.drevora_drivers_retention_guard() from public;
revoke all on function public.drevora_drivers_retention_guard() from anon;

-- =============================================================================
-- 2) Active-only Worker identity helper (blocks archived Worker-app access)
-- =============================================================================
create or replace function public.drevora_auth_user_driver_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  -- Exact-one membership + exact-one active email match in that company.
  with matches as (
    select d.id
    from public.drivers d
    inner join auth.users u on u.id = auth.uid()
    where lower(trim(coalesce(d.email, ''))) = lower(trim(coalesce(u.email, '')))
      and d.company_id is not null
      and d.archived_at is null
      and coalesce(trim(d.email), '') <> ''
      and public.drevora_auth_user_belongs_to_company_id(d.company_id)
  )
  select m.id
  from matches m
  where (select count(*)::integer from matches) = 1;
$$;

comment on function public.drevora_auth_user_driver_id() is
  'Returns active Worker drivers.id only when exact-one membership and exact-one email match exist. Archived Workers resolve to NULL (Worker-app access denied). Office history uses office-role helpers, not this function.';

revoke all on function public.drevora_auth_user_driver_id() from public;
revoke all on function public.drevora_auth_user_driver_id() from anon;
grant execute on function public.drevora_auth_user_driver_id() to authenticated;

-- =============================================================================
-- 3) Access-status RPC (safe message for archived Workers)
-- =============================================================================
create or replace function public.drevora_auth_worker_access_status()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_active_count integer := 0;
  v_archived_count integer := 0;
begin
  if auth.uid() is null then
    return 'none';
  end if;

  if (
    select count(*)::integer
    from public.company_members cm
    where cm.user_id = auth.uid()
      and cm.is_active is true
  ) <> 1 then
    return 'none';
  end if;

  select
    count(*) filter (where d.archived_at is null)::integer,
    count(*) filter (where d.archived_at is not null)::integer
  into v_active_count, v_archived_count
  from public.drivers d
  inner join auth.users u on u.id = auth.uid()
  where lower(trim(coalesce(d.email, ''))) = lower(trim(coalesce(u.email, '')))
    and d.company_id is not null
    and coalesce(trim(d.email), '') <> ''
    and public.drevora_auth_user_belongs_to_company_id(d.company_id);

  if v_active_count = 1 then
    return 'active';
  end if;

  if v_active_count = 0 and v_archived_count = 1 then
    return 'archived';
  end if;

  return 'none';
end;
$$;

comment on function public.drevora_auth_worker_access_status() is
  'Returns active | archived | none for auth.uid() Worker link. Exposes no Worker/company row data.';

revoke all on function public.drevora_auth_worker_access_status() from public;
revoke all on function public.drevora_auth_worker_access_status() from anon;
grant execute on function public.drevora_auth_worker_access_status() to authenticated;

-- =============================================================================
-- 4) Archive RPC
-- =============================================================================
create or replace function public.drevora_archive_driver(p_driver_id uuid)
returns public.drivers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.drivers%rowtype;
  v_archived_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'WORKER_ARCHIVE_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  if p_driver_id is null then
    raise exception 'WORKER_ARCHIVE_INVALID'
      using errcode = '22023',
            hint = 'Worker id is required.';
  end if;

  select *
  into v_row
  from public.drivers d
  where d.id = p_driver_id
  for update;

  if not found then
    raise exception 'WORKER_ARCHIVE_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker not found.';
  end if;

  if v_row.company_id is null
    or not public.drevora_auth_user_has_office_role_for_company(v_row.company_id) then
    raise exception 'WORKER_ARCHIVE_FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  if v_row.archived_at is not null then
    raise exception 'WORKER_ALREADY_ARCHIVED'
      using errcode = 'P0001',
            hint = 'This Worker is already archived.';
  end if;

  v_archived_at := timezone('utc', now());

  -- Clear current Vehicle assignments (same company only). History keeps worker_id refs.
  update public.vehicles v
  set current_driver_id = null
  where v.current_driver_id = p_driver_id
    and v.company_id = v_row.company_id;

  update public.drivers d
  set
    default_vehicle_id = null,
    archived_at = v_archived_at,
    retention_expires_at = v_archived_at + interval '6 years'
  where d.id = p_driver_id
    and d.company_id = v_row.company_id
  returning * into v_row;

  if not found then
    raise exception 'WORKER_ARCHIVE_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker could not be archived for this company.';
  end if;

  return v_row;
end;
$$;

comment on function public.drevora_archive_driver(uuid) is
  'Office-only soft-archive: clears current Vehicle assignment pointers, sets archived_at and retention_expires_at (+6 years). Never deletes the Worker or Auth user.';

-- =============================================================================
-- 5) Restore RPC
-- =============================================================================
create or replace function public.drevora_restore_driver(p_driver_id uuid)
returns public.drivers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.drivers%rowtype;
  v_plan_code text;
  v_limit integer;
  v_active_count integer;
begin
  if auth.uid() is null then
    raise exception 'WORKER_RESTORE_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  if p_driver_id is null then
    raise exception 'WORKER_RESTORE_INVALID'
      using errcode = '22023',
            hint = 'Worker id is required.';
  end if;

  select *
  into v_row
  from public.drivers d
  where d.id = p_driver_id
  for update;

  if not found then
    raise exception 'WORKER_RESTORE_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker not found.';
  end if;

  if v_row.company_id is null
    or not public.drevora_auth_user_has_office_role_for_company(v_row.company_id) then
    raise exception 'WORKER_RESTORE_FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  if v_row.archived_at is null then
    raise exception 'WORKER_NOT_ARCHIVED'
      using errcode = 'P0001',
            hint = 'This Worker is already active.';
  end if;

  select c.plan_code
  into v_plan_code
  from public.companies c
  where c.id = v_row.company_id
  for update;

  if not found then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Company not found for Worker plan allowance check.';
  end if;

  v_limit := public.drevora_active_worker_limit_for_plan(v_plan_code);
  if v_limit is null then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Assign a valid starter/growing/pro plan before restoring Workers.';
  end if;

  select count(*)::integer
  into v_active_count
  from public.drivers d
  where d.company_id = v_row.company_id
    and d.archived_at is null;

  if v_active_count >= v_limit then
    raise exception 'WORKER_PLAN_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = 'Your Worker limit has been reached. Archive another Worker or upgrade your plan before restoring this Worker.';
  end if;

  -- Clear archive + retention deadline. Do not restore Vehicle assignments.
  update public.drivers d
  set
    archived_at = null,
    retention_expires_at = null
  where d.id = p_driver_id
    and d.company_id = v_row.company_id
  returning * into v_row;

  if not found then
    raise exception 'WORKER_RESTORE_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker could not be restored for this company.';
  end if;

  return v_row;
end;
$$;

comment on function public.drevora_restore_driver(uuid) is
  'Office-only restore when an active Worker plan seat is available. Clears archived_at and retention_expires_at. Does not recreate Vehicle assignments.';

revoke all on function public.drevora_archive_driver(uuid) from public;
revoke all on function public.drevora_archive_driver(uuid) from anon;
revoke all on function public.drevora_restore_driver(uuid) from public;
revoke all on function public.drevora_restore_driver(uuid) from anon;

grant execute on function public.drevora_archive_driver(uuid) to authenticated;
grant execute on function public.drevora_restore_driver(uuid) to authenticated;

-- =============================================================================
-- 6) Enable drivers RLS (not FORCE)
-- =============================================================================
alter table public.drivers enable row level security;

do $$
declare
  r record;
begin
  for r in
    select pol.polname as policy_name
    from pg_policy pol
    join pg_class cls on cls.oid = pol.polrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'drivers'
  loop
    execute format(
      'drop policy if exists %I on public.drivers',
      r.policy_name
    );
  end loop;
end $$;

create policy drivers_office_select
  on public.drivers
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

-- Active Worker can read own row; archived Worker identity helper returns NULL.
create policy drivers_worker_select_own
  on public.drivers
  for select
  to authenticated
  using (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and id = public.drevora_auth_user_driver_id()
  );

create policy drivers_office_insert
  on public.drivers
  for insert
  to authenticated
  with check (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      default_vehicle_id is null
      or public.drevora_vehicle_in_company(default_vehicle_id, company_id)
    )
  );

create policy drivers_office_update
  on public.drivers
  for update
  to authenticated
  using (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      default_vehicle_id is null
      or public.drevora_vehicle_in_company(default_vehicle_id, company_id)
    )
  );

-- No DELETE policy.

-- =============================================================================
-- 7) Client grants — column allowlists; no hard DELETE
-- =============================================================================
revoke all on table public.drivers from anon;
revoke all on table public.drivers from public;

revoke delete on table public.drivers from authenticated;
revoke insert on table public.drivers from authenticated;
revoke update on table public.drivers from authenticated;

grant select on table public.drivers to authenticated;

-- INSERT allowlist = createDriver payload (+ company_id, worker_code, avatar_url).
-- Excludes: id, created_at, archived_at, retention_expires_at.
grant insert (
  company_id,
  worker_code,
  first_name,
  last_name,
  email,
  phone,
  company,
  role,
  status,
  employment_type,
  paid_holiday_enabled,
  annual_paid_holiday_days,
  bank_holiday_entitlement_days,
  unpaid_leave_allowed,
  holiday_entitlement_notes,
  licence_categories,
  driving_licence_expiry,
  tacho_card_number,
  cpc_expiry,
  driver_card_expiry,
  medical_expiry,
  default_vehicle_id,
  start_date,
  emergency_contact_name,
  emergency_contact_phone,
  emergency_contact_relationship,
  address_line_1,
  address_line_2,
  town_city,
  county,
  postcode,
  country,
  avatar_url
) on table public.drivers to authenticated;

-- UPDATE allowlist for Office Edit / avatar / holiday entitlement.
-- Excludes: id, company_id, created_at, archived_at, retention_expires_at.
grant update (
  worker_code,
  first_name,
  last_name,
  email,
  phone,
  company,
  role,
  status,
  employment_type,
  paid_holiday_enabled,
  annual_paid_holiday_days,
  bank_holiday_entitlement_days,
  unpaid_leave_allowed,
  holiday_entitlement_notes,
  licence_categories,
  driving_licence_expiry,
  tacho_card_number,
  cpc_expiry,
  driver_card_expiry,
  medical_expiry,
  adr_expiry,
  hiab_expiry,
  default_vehicle_id,
  start_date,
  emergency_contact_name,
  emergency_contact_phone,
  emergency_contact_relationship,
  address_line_1,
  address_line_2,
  town_city,
  county,
  postcode,
  country,
  avatar_url,
  assigned_vehicle
) on table public.drivers to authenticated;

commit;

-- =============================================================================
-- 8) Post-apply diagnostics (commented — after COMMIT only)
-- =============================================================================
-- select c.relname, c.relrowsecurity, c.relforcerowsecurity
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname = 'drivers';
--
-- select policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'drivers' order by policyname;
-- -- Expected exactly four policies; zero DELETE
--
-- select
--   has_column_privilege('authenticated', 'public.drivers', 'archived_at', 'UPDATE') as can_upd_archived_at,
--   has_column_privilege('authenticated', 'public.drivers', 'retention_expires_at', 'UPDATE') as can_upd_retention,
--   has_column_privilege('authenticated', 'public.drivers', 'archived_at', 'INSERT') as can_ins_archived_at,
--   has_column_privilege('authenticated', 'public.drivers', 'retention_expires_at', 'INSERT') as can_ins_retention,
--   has_table_privilege('authenticated', 'public.drivers', 'DELETE') as can_delete;
-- -- Expected: lifecycle write privileges false; DELETE false
--
-- -- Invalid lifecycle combinations (expect zero rows):
-- select count(*) as active_with_retention
-- from public.drivers
-- where archived_at is null and retention_expires_at is not null;
--
-- select count(*) as archived_missing_retention
-- from public.drivers
-- where archived_at is not null and retention_expires_at is null;
--
-- select count(*) as archived_retention_not_six_years
-- from public.drivers
-- where archived_at is not null
--   and retention_expires_at is distinct from (archived_at + interval '6 years');
--
-- select
--   count(*) filter (where archived_at is null) as active_workers,
--   count(*) filter (where archived_at is not null) as archived_workers
-- from public.drivers;
--
-- select
--   p.proname,
--   p.prosecdef as security_definer,
--   pg_get_function_identity_arguments(p.oid) as args,
--   pg_get_function_result(p.oid) as result_type,
--   (
--     select string_agg(cfg, ', ' order by cfg)
--     from unnest(coalesce(p.proconfig, array[]::text[])) as cfg
--   ) as config_including_search_path
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'drevora_archive_driver',
--     'drevora_restore_driver',
--     'drevora_drivers_retention_guard',
--     'drevora_auth_user_driver_id',
--     'drevora_auth_worker_access_status'
--   )
-- order by p.proname;
-- -- Archive/Restore: security_definer true, search_path=''
-- -- Retention guard: security_definer false (invoker), search_path=''
--
-- select public.drevora_auth_worker_access_status();
--
-- -- Archive clears assignments + sets retention:
-- -- select id, default_vehicle_id, archived_at, retention_expires_at
-- -- from public.drivers where id = '<id>';
-- -- select id, current_driver_id from public.vehicles where current_driver_id = '<id>';

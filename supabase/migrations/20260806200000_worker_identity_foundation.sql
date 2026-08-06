-- Worker identity foundation (immutable Auth↔Worker link + audit).
-- Idempotent. Does NOT change Admin UI name/email locks or Edge email flows.
-- Apply manually on the Supabase project after running the preflight diagnostic.
--
-- Adds:
--   1) drivers.auth_user_id (nullable FK → auth.users)
--   2) Unambiguous backfill from active Driver membership + normalised email
--   3) Partial unique index: one active Worker per Auth user
--   4) worker_identity_events audit table (office SELECT; no client writes)
--   5) Auth-first drevora_auth_user_driver_id() with email fallback for unlinked rows
--   6) drevora_link_invited_worker writes auth_user_id; blocks rebinding
--   7) BEFORE UPDATE guard: WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED

-- -----------------------------------------------------------------------------
-- 0) Production preflight note (operator must run diagnostic before apply)
-- -----------------------------------------------------------------------------
-- See: supabase/diagnostics/20260806_preflight_worker_identity_foundation.sql
-- Migration fails clearly on ambiguous membership/email matches (never guesses).

-- -----------------------------------------------------------------------------
-- 1) Column + indexes
-- -----------------------------------------------------------------------------
alter table public.drivers
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

comment on column public.drivers.auth_user_id is
  'Immutable Auth user link for this Worker profile once set. Null only for legacy/unlinked rows. Rebinding to a different Auth user is forbidden.';

create index if not exists drivers_auth_user_id_idx
  on public.drivers (auth_user_id)
  where auth_user_id is not null;

-- One active Worker profile per Auth user (archived shells may retain historical link).
do $$
declare
  v_dup_count integer;
begin
  select count(*)::integer
  into v_dup_count
  from (
    select auth_user_id
    from public.drivers
    where auth_user_id is not null
      and archived_at is null
    group by auth_user_id
    having count(*) > 1
  ) dups;

  if v_dup_count > 0 then
    raise exception
      'Cannot create drivers_auth_user_id_active_unique_idx: % Auth user(s) already linked to multiple active Worker profiles. Resolve before applying this migration.',
      v_dup_count;
  end if;
end $$;

create unique index if not exists drivers_auth_user_id_active_unique_idx
  on public.drivers (auth_user_id)
  where auth_user_id is not null
    and archived_at is null;

comment on index public.drivers_auth_user_id_active_unique_idx is
  'At most one active Worker profile per Auth user.';

-- -----------------------------------------------------------------------------
-- 2) Audit table
-- -----------------------------------------------------------------------------
create table if not exists public.worker_identity_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  driver_id uuid not null references public.drivers (id) on delete restrict,
  auth_user_id uuid null references auth.users (id) on delete set null,
  actor_user_id uuid null references auth.users (id) on delete set null,
  event_type text not null,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  reason text null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint worker_identity_events_event_type_check check (
    event_type in (
      'auth_user_backfilled',
      'auth_user_linked',
      'identity_replacement_blocked'
    )
  )
);

comment on table public.worker_identity_events is
  'Append-only Worker identity audit. Client inserts/updates/deletes are forbidden; writers use security-definer helpers.';

create index if not exists worker_identity_events_company_id_created_at_idx
  on public.worker_identity_events (company_id, created_at desc);

create index if not exists worker_identity_events_driver_id_created_at_idx
  on public.worker_identity_events (driver_id, created_at desc);

create index if not exists worker_identity_events_auth_user_id_idx
  on public.worker_identity_events (auth_user_id)
  where auth_user_id is not null;

alter table public.worker_identity_events enable row level security;

revoke all on table public.worker_identity_events from public;
revoke all on table public.worker_identity_events from anon;
revoke all on table public.worker_identity_events from authenticated;

grant select on table public.worker_identity_events to authenticated;
grant all on table public.worker_identity_events to service_role;

drop policy if exists worker_identity_events_office_select_company
  on public.worker_identity_events;
create policy worker_identity_events_office_select_company
  on public.worker_identity_events
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

-- No INSERT/UPDATE/DELETE policies for authenticated — client writes forbidden.

-- -----------------------------------------------------------------------------
-- 3) Security-definer audit writer
-- -----------------------------------------------------------------------------
create or replace function public.drevora_insert_worker_identity_event(
  p_company_id uuid,
  p_driver_id uuid,
  p_auth_user_id uuid,
  p_actor_user_id uuid,
  p_event_type text,
  p_old_values jsonb default '{}'::jsonb,
  p_new_values jsonb default '{}'::jsonb,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_company_id is null or p_driver_id is null or nullif(btrim(coalesce(p_event_type, '')), '') is null then
    raise exception 'WORKER_IDENTITY_EVENT_INVALID'
      using errcode = 'P0001',
            hint = 'company_id, driver_id and event_type are required.';
  end if;

  insert into public.worker_identity_events (
    company_id,
    driver_id,
    auth_user_id,
    actor_user_id,
    event_type,
    old_values,
    new_values,
    reason
  )
  values (
    p_company_id,
    p_driver_id,
    p_auth_user_id,
    p_actor_user_id,
    btrim(p_event_type),
    coalesce(p_old_values, '{}'::jsonb),
    coalesce(p_new_values, '{}'::jsonb),
    nullif(btrim(coalesce(p_reason, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.drevora_insert_worker_identity_event(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text) is
  'Security-definer append-only writer for worker_identity_events. Not granted to authenticated.';

revoke all on function public.drevora_insert_worker_identity_event(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text) from public;
revoke all on function public.drevora_insert_worker_identity_event(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text) from anon;
revoke all on function public.drevora_insert_worker_identity_event(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text) from authenticated;
grant execute on function public.drevora_insert_worker_identity_event(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text) to service_role;

-- -----------------------------------------------------------------------------
-- 4) Unambiguous backfill (fail loudly on ambiguity)
-- -----------------------------------------------------------------------------
do $$
declare
  v_ambiguous_driver_count integer := 0;
  v_ambiguous_auth_count integer := 0;
  v_conflict_count integer := 0;
  v_linked_count integer := 0;
  r record;
begin
  -- Candidate set: same company, active Driver membership, matching normalised email,
  -- and driver.auth_user_id still null.
  create temporary table tmp_worker_identity_backfill_candidates on commit drop as
  select
    d.id as driver_id,
    d.company_id,
    d.email as driver_email,
    cm.user_id as auth_user_id,
    u.email as auth_email
  from public.drivers d
  inner join public.company_members cm
    on cm.company_id = d.company_id
   and cm.is_active is true
   and cm.role = 'Driver'
  inner join auth.users u
    on u.id = cm.user_id
  where d.auth_user_id is null
    and d.company_id is not null
    and d.archived_at is null
    and nullif(btrim(coalesce(d.email, '')), '') is not null
    and lower(btrim(d.email)) = lower(btrim(coalesce(u.email, '')));

  select count(*)::integer
  into v_ambiguous_driver_count
  from (
    select driver_id
    from tmp_worker_identity_backfill_candidates
    group by driver_id
    having count(distinct auth_user_id) > 1
  ) x;

  if v_ambiguous_driver_count > 0 then
    raise exception
      'WORKER_IDENTITY_BACKFILL_AMBIGUOUS: % Worker profile(s) match multiple Auth users via company membership + email. Resolve manually; migration will not guess.',
      v_ambiguous_driver_count;
  end if;

  select count(*)::integer
  into v_ambiguous_auth_count
  from (
    select auth_user_id
    from tmp_worker_identity_backfill_candidates
    group by auth_user_id
    having count(distinct driver_id) > 1
  ) x;

  if v_ambiguous_auth_count > 0 then
    raise exception
      'WORKER_IDENTITY_BACKFILL_AMBIGUOUS: % Auth user(s) match multiple Worker profiles via company membership + email. Resolve manually; migration will not guess.',
      v_ambiguous_auth_count;
  end if;

  -- Refuse to overwrite or collide with an already-linked active Worker.
  select count(*)::integer
  into v_conflict_count
  from tmp_worker_identity_backfill_candidates c
  where exists (
    select 1
    from public.drivers d
    where d.auth_user_id = c.auth_user_id
      and d.archived_at is null
      and d.id is distinct from c.driver_id
  );

  if v_conflict_count > 0 then
    raise exception
      'WORKER_IDENTITY_BACKFILL_CONFLICT: % candidate link(s) collide with an already-linked active Worker. Resolve manually; migration will not guess.',
      v_conflict_count;
  end if;

  for r in
    select distinct on (driver_id)
      driver_id,
      company_id,
      auth_user_id,
      driver_email,
      auth_email
    from tmp_worker_identity_backfill_candidates
    order by driver_id, auth_user_id
  loop
    update public.drivers d
    set auth_user_id = r.auth_user_id
    where d.id = r.driver_id
      and d.auth_user_id is null;

    if found then
      perform public.drevora_insert_worker_identity_event(
        r.company_id,
        r.driver_id,
        r.auth_user_id,
        null,
        'auth_user_backfilled',
        jsonb_build_object(
          'auth_user_id', null,
          'email', r.driver_email
        ),
        jsonb_build_object(
          'auth_user_id', r.auth_user_id,
          'email', r.auth_email
        ),
        'Unambiguous migration backfill from active Driver membership + normalised email match.'
      );
      v_linked_count := v_linked_count + 1;
    end if;
  end loop;

  raise notice
    'worker_identity_foundation: backfilled auth_user_id on % Worker profile(s).',
    v_linked_count;
end $$;

-- -----------------------------------------------------------------------------
-- 5) Prevent rebinding auth_user_id once set to a different Auth user
-- -----------------------------------------------------------------------------
create or replace function public.drevora_drivers_auth_user_id_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.auth_user_id is not null
     and new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
      using errcode = 'P0001',
            hint = 'This Worker profile is already linked to an Auth user. Archive and create a new Worker for a different person.';
  end if;

  return new;
end;
$$;

comment on function public.drevora_drivers_auth_user_id_guard() is
  'BEFORE UPDATE: reject rebinding drivers.auth_user_id to a different Auth user.';

drop trigger if exists drivers_auth_user_id_guard on public.drivers;
create trigger drivers_auth_user_id_guard
  before update of auth_user_id
  on public.drivers
  for each row
  execute function public.drevora_drivers_auth_user_id_guard();

-- -----------------------------------------------------------------------------
-- 6) Auth-first Worker resolution (email fallback for unlinked rows only)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_auth_user_driver_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_id uuid := null;
begin
  if auth.uid() is null then
    return null;
  end if;

  -- Prefer immutable Auth link (exact-one active linked profile in membership company).
  select count(*)::integer, min(d.id)
  into v_count, v_id
  from public.drivers d
  where d.auth_user_id = auth.uid()
    and d.company_id is not null
    and d.archived_at is null
    and public.drevora_auth_user_belongs_to_company_id(d.company_id);

  if v_count = 1 then
    return v_id;
  end if;

  if v_count > 1 then
    return null;
  end if;

  -- Transitional email fallback only for rows not yet linked (auth_user_id is null).
  select count(*)::integer, min(d.id)
  into v_count, v_id
  from public.drivers d
  inner join auth.users u on u.id = auth.uid()
  where d.auth_user_id is null
    and lower(trim(coalesce(d.email, ''))) = lower(trim(coalesce(u.email, '')))
    and d.company_id is not null
    and d.archived_at is null
    and coalesce(trim(d.email), '') <> ''
    and public.drevora_auth_user_belongs_to_company_id(d.company_id);

  if v_count = 1 then
    return v_id;
  end if;

  return null;
end;
$$;

comment on function public.drevora_auth_user_driver_id() is
  'Returns active Worker drivers.id. Prefers drivers.auth_user_id = auth.uid(); email match is temporary fallback only when auth_user_id is null. Exact-one match required. Archived Workers resolve to NULL.';

revoke all on function public.drevora_auth_user_driver_id() from public;
revoke all on function public.drevora_auth_user_driver_id() from anon;
grant execute on function public.drevora_auth_user_driver_id() to authenticated;
grant execute on function public.drevora_auth_user_driver_id() to service_role;

-- -----------------------------------------------------------------------------
-- 7) Invite link RPC: always write auth_user_id; block replacement
-- -----------------------------------------------------------------------------
create or replace function public.drevora_link_invited_worker(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_auth_user_id uuid,
  p_email text,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_first_name text := nullif(btrim(coalesce(p_profile ->> 'first_name', '')), '');
  v_last_name text := nullif(btrim(coalesce(p_profile ->> 'last_name', '')), '');
  v_role text := nullif(btrim(coalesce(p_profile ->> 'operational_role', '')), '');
  v_status text := coalesce(nullif(btrim(coalesce(p_profile ->> 'status', '')), ''), 'Off Duty');
  v_phone text := nullif(btrim(coalesce(p_profile ->> 'phone', '')), '');
  v_employment_type text := nullif(btrim(coalesce(p_profile ->> 'employment_type', '')), '');
  v_company_name text;
  v_actor_role text;
  v_membership public.company_members%rowtype;
  v_driver public.drivers%rowtype;
  v_created_membership boolean := false;
  v_reactivated_membership boolean := false;
  v_created_driver boolean := false;
  v_auth_linked boolean := false;
  v_previous_auth_user_id uuid := null;
  v_default_vehicle_id uuid := null;
  v_paid_holiday_enabled boolean := null;
  v_annual_paid_holiday_days numeric := null;
  v_bank_holiday_entitlement_days numeric := null;
  v_unpaid_leave_allowed boolean := true;
  v_holiday_entitlement_notes text := null;
  v_licence_categories text[] := null;
  v_driving_licence_expiry date := null;
  v_tacho_card_number text := null;
  v_cpc_expiry date := null;
  v_driver_card_expiry date := null;
  v_medical_expiry date := null;
  v_start_date date := null;
  v_emergency_contact_name text := null;
  v_emergency_contact_phone text := null;
  v_emergency_contact_relationship text := null;
  v_address_line_1 text := null;
  v_address_line_2 text := null;
  v_town_city text := null;
  v_county text := null;
  v_postcode text := null;
  v_country text := null;
  v_other_active integer := 0;
  v_other_driver_id uuid := null;
begin
  if p_actor_user_id is null or p_company_id is null or p_auth_user_id is null then
    raise exception 'INVITE_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'actor_user_id, company_id and auth_user_id are required.';
  end if;

  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    raise exception 'INVITE_INVALID_EMAIL'
      using errcode = 'P0001',
            hint = 'A valid Worker email is required.';
  end if;

  if v_first_name is null or v_last_name is null then
    raise exception 'INVITE_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'first_name and last_name are required.';
  end if;

  if v_role is null or v_role not in (
    'Admin',
    'Driver',
    'Yardman',
    'Cleaner',
    'Supervisor',
    'Mechanic',
    'Transport Manager',
    'Planner',
    'Office Staff',
    'Warehouse',
    'Other'
  ) then
    raise exception 'INVITE_INVALID_ROLE'
      using errcode = 'P0001',
            hint = 'operational_role must be a known Worker profile role.';
  end if;

  if v_status not in ('Working', 'Off Duty', 'Holiday', 'Suspended') then
    raise exception 'INVITE_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'status must be Working, Off Duty, Holiday, or Suspended.';
  end if;

  select cm.role
  into v_actor_role
  from public.company_members cm
  where cm.user_id = p_actor_user_id
    and cm.company_id = p_company_id
    and cm.is_active = true;

  if v_actor_role is null or v_actor_role not in (
    'Admin',
    'Transport Manager',
    'Supervisor',
    'Planner',
    'Office Staff'
  ) then
    raise exception 'INVITE_FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only Office membership roles may invite Workers.';
  end if;

  select c.name
  into v_company_name
  from public.companies c
  where c.id = p_company_id;

  if not found then
    raise exception 'INVITE_COMPANY_NOT_FOUND'
      using errcode = 'P0001',
            hint = 'Company was not found.';
  end if;

  v_company_name := nullif(trim(v_company_name), '');

  perform pg_advisory_xact_lock(
    872014551,
    hashtext(p_auth_user_id::text)
  );

  select count(*)::integer
  into v_other_active
  from public.company_members cm
  where cm.user_id = p_auth_user_id
    and cm.is_active = true
    and cm.company_id is distinct from p_company_id;

  if v_other_active > 0 then
    raise exception 'USER_ALREADY_LINKED_TO_ANOTHER_COMPANY'
      using errcode = 'P0001',
            hint = 'This Auth user already has an active membership in another company.';
  end if;

  -- Same Auth user must not already own a different active Worker profile (any company).
  select d.id
  into v_other_driver_id
  from public.drivers d
  where d.auth_user_id = p_auth_user_id
    and d.archived_at is null
  limit 1;

  if p_profile ? 'default_vehicle_id'
     and nullif(btrim(coalesce(p_profile ->> 'default_vehicle_id', '')), '') is not null then
    begin
      v_default_vehicle_id := (p_profile ->> 'default_vehicle_id')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'INVITE_INVALID_ARGUMENT'
          using errcode = 'P0001',
                hint = 'default_vehicle_id must be a UUID.';
    end;

    if to_regprocedure('public.drevora_vehicle_in_company(uuid,uuid)') is not null
       and not public.drevora_vehicle_in_company(v_default_vehicle_id, p_company_id) then
      raise exception 'INVITE_INVALID_ARGUMENT'
        using errcode = 'P0001',
              hint = 'default_vehicle_id must belong to the same company.';
    end if;
  end if;

  if p_profile ? 'paid_holiday_enabled'
     and p_profile ->> 'paid_holiday_enabled' is not null
     and btrim(p_profile ->> 'paid_holiday_enabled') <> '' then
    v_paid_holiday_enabled := (p_profile ->> 'paid_holiday_enabled')::boolean;
  end if;

  if nullif(btrim(coalesce(p_profile ->> 'annual_paid_holiday_days', '')), '') is not null then
    v_annual_paid_holiday_days := (p_profile ->> 'annual_paid_holiday_days')::numeric;
  end if;

  if nullif(btrim(coalesce(p_profile ->> 'bank_holiday_entitlement_days', '')), '') is not null then
    v_bank_holiday_entitlement_days := (p_profile ->> 'bank_holiday_entitlement_days')::numeric;
  end if;

  if p_profile ? 'unpaid_leave_allowed'
     and p_profile ->> 'unpaid_leave_allowed' is not null
     and btrim(p_profile ->> 'unpaid_leave_allowed') <> '' then
    v_unpaid_leave_allowed := (p_profile ->> 'unpaid_leave_allowed')::boolean;
  end if;

  v_holiday_entitlement_notes := nullif(btrim(coalesce(p_profile ->> 'holiday_entitlement_notes', '')), '');
  v_tacho_card_number := nullif(btrim(coalesce(p_profile ->> 'tacho_card_number', '')), '');
  v_emergency_contact_name := nullif(btrim(coalesce(p_profile ->> 'emergency_contact_name', '')), '');
  v_emergency_contact_phone := nullif(btrim(coalesce(p_profile ->> 'emergency_contact_phone', '')), '');
  v_emergency_contact_relationship := nullif(
    btrim(coalesce(p_profile ->> 'emergency_contact_relationship', '')),
    ''
  );
  v_address_line_1 := nullif(btrim(coalesce(p_profile ->> 'address_line_1', '')), '');
  v_address_line_2 := nullif(btrim(coalesce(p_profile ->> 'address_line_2', '')), '');
  v_town_city := nullif(btrim(coalesce(p_profile ->> 'town_city', '')), '');
  v_county := nullif(btrim(coalesce(p_profile ->> 'county', '')), '');
  v_postcode := nullif(btrim(coalesce(p_profile ->> 'postcode', '')), '');
  v_country := coalesce(
    nullif(btrim(coalesce(p_profile ->> 'country', '')), ''),
    'United Kingdom'
  );

  if p_profile ? 'licence_categories' and jsonb_typeof(p_profile -> 'licence_categories') = 'array' then
    select array_agg(value)
    into v_licence_categories
    from (
      select nullif(btrim(elem), '') as value
      from jsonb_array_elements_text(p_profile -> 'licence_categories') as elem
    ) cleaned
    where value is not null;
  end if;

  if nullif(btrim(coalesce(p_profile ->> 'driving_licence_expiry', '')), '') is not null then
    v_driving_licence_expiry := (p_profile ->> 'driving_licence_expiry')::date;
  end if;
  if nullif(btrim(coalesce(p_profile ->> 'cpc_expiry', '')), '') is not null then
    v_cpc_expiry := (p_profile ->> 'cpc_expiry')::date;
  end if;
  if nullif(btrim(coalesce(p_profile ->> 'driver_card_expiry', '')), '') is not null then
    v_driver_card_expiry := (p_profile ->> 'driver_card_expiry')::date;
  end if;
  if nullif(btrim(coalesce(p_profile ->> 'medical_expiry', '')), '') is not null then
    v_medical_expiry := (p_profile ->> 'medical_expiry')::date;
  end if;
  if nullif(btrim(coalesce(p_profile ->> 'start_date', '')), '') is not null then
    v_start_date := (p_profile ->> 'start_date')::date;
  end if;

  select d.*
  into v_driver
  from public.drivers d
  where d.company_id = p_company_id
    and d.archived_at is null
    and lower(btrim(d.email)) = v_email
  limit 1;

  -- Prefer the Auth-linked active profile when email lookup misses / differs.
  if v_other_driver_id is not null then
    if v_driver.id is not null and v_driver.id is distinct from v_other_driver_id then
      raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
        using errcode = 'P0001',
              hint = 'This Auth user is already linked to a different active Worker profile. Archive and create a new Worker for a different person.';
    end if;

    if v_driver.id is null then
      select d.*
      into v_driver
      from public.drivers d
      where d.id = v_other_driver_id;
    end if;
  end if;

  if v_driver.id is not null
     and v_driver.auth_user_id is not null
     and v_driver.auth_user_id is distinct from p_auth_user_id then
    raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
      using errcode = 'P0001',
            hint = 'This Worker profile is already linked to a different Auth user. Archive and create a new Worker for a different person.';
  end if;

  select cm.*
  into v_membership
  from public.company_members cm
  where cm.user_id = p_auth_user_id
    and cm.company_id = p_company_id
  limit 1;

  if v_membership.id is not null then
    if v_membership.is_active
       and v_membership.role = 'Driver'
       and v_driver.id is not null then
      if v_driver.auth_user_id is null then
        update public.drivers
        set auth_user_id = p_auth_user_id
        where id = v_driver.id
          and auth_user_id is null
        returning * into v_driver;
        v_auth_linked := true;

        perform public.drevora_insert_worker_identity_event(
          p_company_id,
          v_driver.id,
          p_auth_user_id,
          p_actor_user_id,
          'auth_user_linked',
          jsonb_build_object('auth_user_id', null, 'email', v_driver.email),
          jsonb_build_object('auth_user_id', p_auth_user_id, 'email', v_email),
          'Idempotent invite linked existing membership/profile to Auth user.'
        );
      elsif v_driver.auth_user_id is distinct from p_auth_user_id then
        raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
          using errcode = 'P0001',
                hint = 'This Worker profile is already linked to a different Auth user. Archive and create a new Worker for a different person.';
      end if;

      return jsonb_build_object(
        'ok', true,
        'code', 'already_linked',
        'membership_id', v_membership.id,
        'driver_id', v_driver.id,
        'worker_code', v_driver.worker_code,
        'auth_user_id', v_driver.auth_user_id,
        'created_membership', false,
        'reactivated_membership', false,
        'created_driver', false,
        'auth_user_linked', v_auth_linked
      );
    end if;

    if v_membership.is_active and v_membership.role <> 'Driver' then
      raise exception 'INVITE_EMAIL_CONFLICT'
        using errcode = 'P0001',
              hint = 'This Auth user already has a non-Worker membership in this company.';
    end if;

    if not v_membership.is_active or v_membership.role <> 'Driver' then
      update public.company_members
      set
        role = 'Driver',
        is_active = true,
        updated_at = now()
      where id = v_membership.id
      returning * into v_membership;
      v_reactivated_membership := true;
    end if;
  else
    insert into public.company_members (
      user_id,
      company_id,
      role,
      is_active
    )
    values (
      p_auth_user_id,
      p_company_id,
      'Driver',
      true
    )
    returning * into v_membership;
    v_created_membership := true;
  end if;

  if v_driver.id is null then
    perform public.drevora_assert_company_can_add_worker(p_company_id);

    insert into public.drivers (
      company_id,
      company,
      email,
      first_name,
      last_name,
      phone,
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
      archived_at,
      auth_user_id
    )
    values (
      p_company_id,
      v_company_name,
      v_email,
      v_first_name,
      v_last_name,
      v_phone,
      v_role,
      v_status,
      v_employment_type,
      v_paid_holiday_enabled,
      v_annual_paid_holiday_days,
      v_bank_holiday_entitlement_days,
      v_unpaid_leave_allowed,
      v_holiday_entitlement_notes,
      v_licence_categories,
      v_driving_licence_expiry,
      v_tacho_card_number,
      v_cpc_expiry,
      v_driver_card_expiry,
      v_medical_expiry,
      v_default_vehicle_id,
      v_start_date,
      v_emergency_contact_name,
      v_emergency_contact_phone,
      v_emergency_contact_relationship,
      v_address_line_1,
      v_address_line_2,
      v_town_city,
      v_county,
      v_postcode,
      v_country,
      null,
      p_auth_user_id
    )
    returning * into v_driver;
    v_created_driver := true;
    v_auth_linked := true;

    perform public.drevora_insert_worker_identity_event(
      p_company_id,
      v_driver.id,
      p_auth_user_id,
      p_actor_user_id,
      'auth_user_linked',
      jsonb_build_object('auth_user_id', null),
      jsonb_build_object('auth_user_id', p_auth_user_id, 'email', v_email),
      'Invitation created Worker profile with Auth user link.'
    );
  else
    v_previous_auth_user_id := v_driver.auth_user_id;

    if v_previous_auth_user_id is not null
       and v_previous_auth_user_id is distinct from p_auth_user_id then
      raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
        using errcode = 'P0001',
              hint = 'This Worker profile is already linked to a different Auth user. Archive and create a new Worker for a different person.';
    end if;

    update public.drivers
    set
      first_name = v_first_name,
      last_name = v_last_name,
      role = v_role,
      phone = coalesce(v_phone, phone),
      status = v_status,
      auth_user_id = coalesce(auth_user_id, p_auth_user_id)
    where id = v_driver.id
    returning * into v_driver;

    if v_previous_auth_user_id is null and v_driver.auth_user_id = p_auth_user_id then
      v_auth_linked := true;
      perform public.drevora_insert_worker_identity_event(
        p_company_id,
        v_driver.id,
        p_auth_user_id,
        p_actor_user_id,
        'auth_user_linked',
        jsonb_build_object('auth_user_id', null, 'email', v_driver.email),
        jsonb_build_object('auth_user_id', p_auth_user_id, 'email', v_email),
        'Invitation linked Auth user to existing Worker profile.'
      );
    end if;
  end if;

  if v_membership.is_active is distinct from true
     or v_membership.role is distinct from 'Driver'
     or v_driver.id is null
     or v_driver.archived_at is not null
     or v_driver.auth_user_id is distinct from p_auth_user_id then
    raise exception 'INVITE_PARTIAL_LINK_FAILED'
      using errcode = 'P0001',
            hint = 'Invitation link left an inconsistent membership/profile state.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', case
      when v_created_membership or v_created_driver or v_reactivated_membership then 'linked'
      else 'already_linked'
    end,
    'membership_id', v_membership.id,
    'driver_id', v_driver.id,
    'worker_code', v_driver.worker_code,
    'auth_user_id', v_driver.auth_user_id,
    'created_membership', v_created_membership,
    'reactivated_membership', v_reactivated_membership,
    'created_driver', v_created_driver,
    'auth_user_linked', v_auth_linked
  );
exception
  when unique_violation then
    if sqlerrm ilike '%drivers_auth_user_id_active_unique_idx%'
       or sqlerrm ilike '%auth_user_id%' then
      raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
        using errcode = 'P0001',
              hint = 'This Auth user is already linked to another active Worker profile.';
    end if;
    raise exception 'INVITE_DUPLICATE_WORKER'
      using errcode = 'P0001',
            hint = 'An active Worker with this email already exists in the company.';
end;
$$;

comment on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) is
  'Service-role: atomically ensure Driver company_members + active drivers row with drivers.auth_user_id set. Rejects Auth rebinding (WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED).';

revoke all on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) from public;
revoke all on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) from anon;
revoke all on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) from authenticated;
grant execute on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) to service_role;

notify pgrst, 'reload schema';

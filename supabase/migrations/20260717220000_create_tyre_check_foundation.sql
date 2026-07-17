-- =============================================================================
-- DREVORA — Tyre Check foundation (tables, derived tread/wear, RLS)
-- File: supabase/migrations/20260717220000_create_tyre_check_foundation.sql
-- =============================================================================
-- PURPOSE
--   Create the first durable backend for Tyre Checks:
--     - vehicles.trailer_number (internal UK trailer identity, not a plate)
--     - public.tyre_checks (parent)
--     - public.tyre_check_items (per-tyre child)
--     - wear % + tread_status derivation
--     - parent summary / overall_result refresh
--     - submission validation
--     - tenant RLS (Office read; Driver own draft/in_progress write)
--
-- LIFECYCLE (MVP)
--   Allowed statuses only: draft → in_progress → submitted.
--   After submitted the check and items are locked. No further lifecycle status exists.
--
-- SECURITY
--   Reuses committed helpers from 20260715210000_enable_full_tenant_rls.sql:
--     drevora_auth_user_belongs_to_company_id
--     drevora_auth_user_has_office_role_for_company
--     drevora_auth_user_driver_id  (exact-one membership + exact-one email→drivers.id)
--     drevora_driver_in_company / drevora_vehicle_in_company
--     drevora_is_trusted_tenant_writer
--     drevora_set_updated_at
--   No anon access. No PUBLIC execute on internal calculators.
--   No oldest-company fallback.
--   Summary-refresh GUC bypass requires trusted writer + nested trigger depth.
--
-- SCOPE
--   Does NOT alter vehicle_checks / vehicle_check_items.
--   Does NOT create Storage buckets or UI wiring.
--   REVIEW ONLY until operator applies. Not executed by the authoring agent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Prerequisites
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.drevora_auth_user_driver_id()') is null then
    raise exception
      'DREVORA STOP: public.drevora_auth_user_driver_id() is missing. Apply 20260715210000_enable_full_tenant_rls.sql before this migration.';
  end if;
  if to_regprocedure('public.drevora_auth_user_has_office_role_for_company(uuid)') is null then
    raise exception
      'DREVORA STOP: office role helper missing. Apply 20260715210000_enable_full_tenant_rls.sql before this migration.';
  end if;
  if to_regprocedure('public.drevora_set_updated_at()') is null then
    raise exception
      'DREVORA STOP: public.drevora_set_updated_at() is missing.';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vehicles'
      and column_name = 'company_id'
  ) then
    raise exception
      'DREVORA STOP: vehicles.company_id is missing. Apply tenant foundation migrations first.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1) vehicles.trailer_number
--    No existing dedicated trailer-number column found. fleet_number is shared
--    fleet identity and is NOT reused. vehicle_type already classifies trailers.
-- -----------------------------------------------------------------------------
alter table public.vehicles
  add column if not exists trailer_number text;

comment on column public.vehicles.trailer_number is
  'Internal UK trailer identity (e.g. PVG4546). Not a registration plate. Empty strings normalised to NULL.';

create or replace function public.drevora_normalize_vehicle_trailer_number()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.trailer_number is not null then
    new.trailer_number := nullif(btrim(new.trailer_number), '');
  end if;
  return new;
end;
$$;

drop trigger if exists vehicles_normalize_trailer_number on public.vehicles;
create trigger vehicles_normalize_trailer_number
  before insert or update of trailer_number on public.vehicles
  for each row
  execute function public.drevora_normalize_vehicle_trailer_number();

-- Case-insensitive unique trailer numbers per tenant (non-empty only).
create unique index if not exists vehicles_company_trailer_number_ci_uidx
  on public.vehicles (company_id, lower(trailer_number))
  where trailer_number is not null
    and company_id is not null;

-- -----------------------------------------------------------------------------
-- 2) Immutable tread helpers (internal; used by generated columns / triggers)
-- -----------------------------------------------------------------------------

-- Wear % from confirmed reference scale with linear interpolation.
create or replace function public.drevora_tyre_wear_percent(p_depth numeric)
returns numeric
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  depths constant numeric[] := array[8.0, 7.0, 6.0, 5.0, 4.0, 3.0, 2.0, 1.6];
  wears constant numeric[] := array[0.0, 16.0, 31.0, 47.0, 62.0, 78.0, 94.0, 100.0];
  i integer;
  d_hi numeric;
  d_lo numeric;
  w_hi numeric;
  w_lo numeric;
  result numeric;
begin
  if p_depth is null then
    return null;
  end if;

  if p_depth >= 8.0 then
    return 0.00;
  end if;

  if p_depth <= 1.6 then
    return 100.00;
  end if;

  for i in 1..7 loop
    if p_depth = depths[i] then
      return round(wears[i], 2);
    end if;

    if p_depth < depths[i] and p_depth > depths[i + 1] then
      d_hi := depths[i];
      d_lo := depths[i + 1];
      w_hi := wears[i];
      w_lo := wears[i + 1];
      result := w_hi + ((d_hi - p_depth) / (d_hi - d_lo)) * (w_lo - w_hi);
      result := greatest(0.0, least(100.0, result));
      return round(result, 2);
    end if;
  end loop;

  if p_depth = depths[8] then
    return 100.00;
  end if;

  return null;
end;
$$;

-- Tread status only (Dirty/Defect are separate booleans).
create or replace function public.drevora_tyre_tread_status(p_depth numeric)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_depth is null then 'not_checked'
    when p_depth >= 6.0 then 'good'
    when p_depth >= 4.0 then 'attention'
    else 'critical'
  end;
$$;

comment on function public.drevora_tyre_wear_percent(numeric) is
  'Tyre wear % from tread depth mm using the DREVORA 8.0→1.6 reference scale with linear interpolation.';

comment on function public.drevora_tyre_tread_status(numeric) is
  'Derived tread_status only: not_checked / good (>=6.0) / attention (4.0–5.9) / critical (<4.0).';

revoke all on function public.drevora_tyre_wear_percent(numeric) from public;
revoke all on function public.drevora_tyre_wear_percent(numeric) from anon;
revoke all on function public.drevora_tyre_wear_percent(numeric) from authenticated;
grant execute on function public.drevora_tyre_wear_percent(numeric) to authenticated;

revoke all on function public.drevora_tyre_tread_status(numeric) from public;
revoke all on function public.drevora_tyre_tread_status(numeric) from anon;
revoke all on function public.drevora_tyre_tread_status(numeric) from authenticated;
grant execute on function public.drevora_tyre_tread_status(numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- 3) tyre_checks (parent)
-- -----------------------------------------------------------------------------
create table if not exists public.tyre_checks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  trailer_vehicle_id uuid null references public.vehicles (id) on delete restrict,
  trailer_number_snapshot text null,
  worker_id uuid not null references public.drivers (id) on delete restrict,
  status text not null default 'draft',
  overall_result text not null default 'incomplete',
  truck_axle_count smallint not null,
  trailer_axle_count smallint null,
  inspection_started_at timestamptz null,
  inspection_completed_at timestamptz null,
  submitted_at timestamptz null,
  duration_seconds integer null,
  odometer integer null,
  odometer_unit text not null default 'miles',
  notes text null,
  signature_url text null,
  signed_at timestamptz null,
  good_count integer not null default 0,
  attention_count integer not null default 0,
  critical_count integer not null default 0,
  dirty_count integer not null default 0,
  defect_count integer not null default 0,
  not_checked_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tyre_checks_status_check check (
    status in ('draft', 'in_progress', 'submitted')
  ),
  constraint tyre_checks_overall_result_check check (
    overall_result in ('incomplete', 'pass', 'attention', 'fail')
  ),
  constraint tyre_checks_odometer_unit_check check (
    odometer_unit in ('miles', 'km')
  ),
  constraint tyre_checks_truck_axle_count_check check (
    truck_axle_count between 1 and 6
  ),
  constraint tyre_checks_trailer_axle_count_check check (
    trailer_axle_count is null
    or trailer_axle_count between 1 and 6
  ),
  constraint tyre_checks_duration_seconds_non_negative check (
    duration_seconds is null or duration_seconds >= 0
  ),
  constraint tyre_checks_summary_counts_non_negative check (
    good_count >= 0
    and attention_count >= 0
    and critical_count >= 0
    and dirty_count >= 0
    and defect_count >= 0
    and not_checked_count >= 0
  ),
  constraint tyre_checks_trailer_consistency_check check (
    (
      trailer_vehicle_id is null
      and trailer_axle_count is null
      and trailer_number_snapshot is null
    )
    or (
      trailer_vehicle_id is not null
      and trailer_axle_count between 1 and 6
      and trailer_number_snapshot is not null
      and btrim(trailer_number_snapshot) <> ''
    )
  ),
  constraint tyre_checks_truck_trailer_distinct_check check (
    trailer_vehicle_id is null
    or trailer_vehicle_id <> vehicle_id
  )
);

comment on table public.tyre_checks is
  'Parent tyre inspection record. Truck required; trailer optional (also a vehicles row). Lifecycle: draft → in_progress → submitted.';

comment on column public.tyre_checks.trailer_number_snapshot is
  'Frozen trailer_number at check time so history stays stable if the vehicle row is edited later.';

-- Idempotent status constraint (corrects a prior partial run with an older status list).
alter table public.tyre_checks
  drop constraint if exists tyre_checks_status_check;

alter table public.tyre_checks
  add constraint tyre_checks_status_check check (
    status in ('draft', 'in_progress', 'submitted')
  );

-- -----------------------------------------------------------------------------
-- 4) tyre_check_items (child)
-- -----------------------------------------------------------------------------
create table if not exists public.tyre_check_items (
  id uuid primary key default gen_random_uuid(),
  tyre_check_id uuid not null references public.tyre_checks (id) on delete cascade,
  unit text not null,
  axle_number smallint not null,
  axle_type text not null,
  position text not null,
  tread_depth_mm numeric(4, 1) null,
  wear_percent numeric(5, 2)
    generated always as (public.drevora_tyre_wear_percent(tread_depth_mm)) stored,
  tread_status text
    generated always as (public.drevora_tyre_tread_status(tread_depth_mm)) stored,
  is_dirty boolean not null default false,
  has_defect boolean not null default false,
  defect_notes text null,
  notes text null,
  photo_paths text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tyre_check_items_unit_check check (
    unit in ('vehicle', 'trailer')
  ),
  constraint tyre_check_items_axle_type_check check (
    axle_type in ('steer', 'drive', 'trailer')
  ),
  constraint tyre_check_items_position_check check (
    position in (
      'left',
      'right',
      'outer_left',
      'inner_left',
      'inner_right',
      'outer_right'
    )
  ),
  constraint tyre_check_items_unit_axle_type_check check (
    (unit = 'vehicle' and axle_type in ('steer', 'drive'))
    or (unit = 'trailer' and axle_type = 'trailer')
  ),
  constraint tyre_check_items_axle_type_position_check check (
    (axle_type = 'steer' and position in ('left', 'right'))
    or (
      axle_type in ('drive', 'trailer')
      and position in ('outer_left', 'inner_left', 'inner_right', 'outer_right')
    )
  ),
  constraint tyre_check_items_axle_number_check check (
    axle_number between 1 and 6
  ),
  constraint tyre_check_items_tread_depth_range_check check (
    tread_depth_mm is null
    or (
      tread_depth_mm >= 0
      and tread_depth_mm <= 30.0
    )
  ),
  -- Accept multiples of 0.5 mm, or the exact special value 1.6 mm.
  constraint tyre_check_items_tread_depth_step_check check (
    tread_depth_mm is null
    or tread_depth_mm = 1.6
    or (tread_depth_mm * 2) = trunc(tread_depth_mm * 2)
  )
);

comment on table public.tyre_check_items is
  'Per-tyre measurements for a tyre_checks parent. tread_status/wear_percent are derived; Dirty/Defect are separate flags.';

create unique index if not exists tyre_check_items_position_uidx
  on public.tyre_check_items (tyre_check_id, unit, axle_number, position);

create index if not exists tyre_check_items_tyre_check_id_idx
  on public.tyre_check_items (tyre_check_id);

-- -----------------------------------------------------------------------------
-- 5) Parent indexes
-- -----------------------------------------------------------------------------
create index if not exists tyre_checks_company_created_at_idx
  on public.tyre_checks (company_id, created_at desc);

create index if not exists tyre_checks_company_vehicle_created_at_idx
  on public.tyre_checks (company_id, vehicle_id, created_at desc);

create index if not exists tyre_checks_company_trailer_created_at_idx
  on public.tyre_checks (company_id, trailer_vehicle_id, created_at desc);

create index if not exists tyre_checks_company_worker_created_at_idx
  on public.tyre_checks (company_id, worker_id, created_at desc);

create index if not exists tyre_checks_company_status_created_at_idx
  on public.tyre_checks (company_id, status, created_at desc);

-- -----------------------------------------------------------------------------
-- 6) updated_at triggers
-- -----------------------------------------------------------------------------
drop trigger if exists tyre_checks_set_updated_at on public.tyre_checks;
create trigger tyre_checks_set_updated_at
  before update on public.tyre_checks
  for each row
  execute function public.drevora_set_updated_at();

drop trigger if exists tyre_check_items_set_updated_at on public.tyre_check_items;
create trigger tyre_check_items_set_updated_at
  before update on public.tyre_check_items
  for each row
  execute function public.drevora_set_updated_at();

-- -----------------------------------------------------------------------------
-- 7) Expected layout helpers + summary / overall_result
-- -----------------------------------------------------------------------------
create or replace function public.drevora_tyre_check_expected_item_count(
  p_truck_axle_count smallint,
  p_trailer_axle_count smallint
)
returns integer
language sql
immutable
set search_path = public
as $$
  select
    -- Axle 1 steer (L/R) + remaining truck axles × 4 duals
    (2 + greatest(p_truck_axle_count - 1, 0) * 4)
    + case
        when p_trailer_axle_count is null then 0
        else p_trailer_axle_count * 4
      end;
$$;

create or replace function public.drevora_tyre_check_has_complete_layout(p_tyre_check_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_truck smallint;
  v_trailer smallint;
  v_has_trailer boolean;
  v_axle smallint;
  v_expected integer;
  v_actual integer;
begin
  select
    tc.truck_axle_count,
    tc.trailer_axle_count,
    (tc.trailer_vehicle_id is not null)
  into v_truck, v_trailer, v_has_trailer
  from public.tyre_checks tc
  where tc.id = p_tyre_check_id;

  if v_truck is null then
    return false;
  end if;

  v_expected := public.drevora_tyre_check_expected_item_count(v_truck, v_trailer);

  select count(*)::integer
  into v_actual
  from public.tyre_check_items i
  where i.tyre_check_id = p_tyre_check_id;

  if v_actual is distinct from v_expected then
    return false;
  end if;

  -- Vehicle steer axle 1
  if (
    select count(*)::integer
    from public.tyre_check_items i
    where i.tyre_check_id = p_tyre_check_id
      and i.unit = 'vehicle'
      and i.axle_number = 1
      and i.axle_type = 'steer'
      and i.position in ('left', 'right')
  ) <> 2 then
    return false;
  end if;

  -- Vehicle drive axles 2..n
  if v_truck >= 2 then
    for v_axle in 2..v_truck loop
      if (
        select count(*)::integer
        from public.tyre_check_items i
        where i.tyre_check_id = p_tyre_check_id
          and i.unit = 'vehicle'
          and i.axle_number = v_axle
          and i.axle_type = 'drive'
          and i.position in ('outer_left', 'inner_left', 'inner_right', 'outer_right')
      ) <> 4 then
        return false;
      end if;
    end loop;
  end if;

  if v_has_trailer then
    for v_axle in 1..v_trailer loop
      if (
        select count(*)::integer
        from public.tyre_check_items i
        where i.tyre_check_id = p_tyre_check_id
          and i.unit = 'trailer'
          and i.axle_number = v_axle
          and i.axle_type = 'trailer'
          and i.position in ('outer_left', 'inner_left', 'inner_right', 'outer_right')
      ) <> 4 then
        return false;
      end if;
    end loop;
  else
    if exists (
      select 1
      from public.tyre_check_items i
      where i.tyre_check_id = p_tyre_check_id
        and i.unit = 'trailer'
    ) then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.drevora_tyre_check_compute_overall_result(
  p_good integer,
  p_attention integer,
  p_critical integer,
  p_dirty integer,
  p_defect integer,
  p_not_checked integer,
  p_item_count integer,
  p_expected_count integer,
  p_layout_complete boolean
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_item_count = 0
      or p_not_checked > 0
      or not p_layout_complete
      or p_item_count <> p_expected_count
      then 'incomplete'
    when p_critical > 0 or p_defect > 0
      then 'fail'
    when p_attention > 0 or p_dirty > 0
      then 'attention'
    when p_good = p_item_count
      and p_dirty = 0
      and p_defect = 0
      and p_not_checked = 0
      then 'pass'
    else 'incomplete'
  end;
$$;

-- True only for nested internal summary refresh (not a client-settable auth bypass).
-- Requires the GUC marker, trusted writer context, and nested trigger depth so a
-- client cannot spoof authorization via set_config('drevora.tyre_summary_refresh', ...).
create or replace function public.drevora_tyre_summary_refresh_active()
returns boolean
language sql
stable
set search_path = public
as $$
  select
    current_setting('drevora.tyre_summary_refresh', true) = '1'
    and public.drevora_is_trusted_tenant_writer()
    and pg_trigger_depth() > 1;
$$;

create or replace function public.drevora_tyre_check_refresh_summary(p_tyre_check_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_good integer := 0;
  v_attention integer := 0;
  v_critical integer := 0;
  v_dirty integer := 0;
  v_defect integer := 0;
  v_not_checked integer := 0;
  v_item_count integer := 0;
  v_truck smallint;
  v_trailer smallint;
  v_expected integer;
  v_layout_complete boolean;
  v_overall text;
  v_prev_setting text;
begin
  if p_tyre_check_id is null then
    return;
  end if;

  -- Serialize concurrent child updates against the parent row.
  perform 1
  from public.tyre_checks tc
  where tc.id = p_tyre_check_id
  for update;

  select tc.truck_axle_count, tc.trailer_axle_count
  into v_truck, v_trailer
  from public.tyre_checks tc
  where tc.id = p_tyre_check_id;

  if v_truck is null then
    return;
  end if;

  select
    count(*)::integer,
    count(*) filter (where i.tread_status = 'good')::integer,
    count(*) filter (where i.tread_status = 'attention')::integer,
    count(*) filter (where i.tread_status = 'critical')::integer,
    count(*) filter (where i.is_dirty)::integer,
    count(*) filter (where i.has_defect)::integer,
    count(*) filter (where i.tread_status = 'not_checked')::integer
  into
    v_item_count,
    v_good,
    v_attention,
    v_critical,
    v_dirty,
    v_defect,
    v_not_checked
  from public.tyre_check_items i
  where i.tyre_check_id = p_tyre_check_id;

  v_expected := public.drevora_tyre_check_expected_item_count(v_truck, v_trailer);
  v_layout_complete := public.drevora_tyre_check_has_complete_layout(p_tyre_check_id);
  v_overall := public.drevora_tyre_check_compute_overall_result(
    v_good,
    v_attention,
    v_critical,
    v_dirty,
    v_defect,
    v_not_checked,
    v_item_count,
    v_expected,
    v_layout_complete
  );

  -- Marker is active only around the internal parent summary update.
  v_prev_setting := current_setting('drevora.tyre_summary_refresh', true);
  begin
    perform set_config('drevora.tyre_summary_refresh', '1', true);

    update public.tyre_checks tc
    set
      good_count = v_good,
      attention_count = v_attention,
      critical_count = v_critical,
      dirty_count = v_dirty,
      defect_count = v_defect,
      not_checked_count = v_not_checked,
      overall_result = v_overall,
      updated_at = now()
    where tc.id = p_tyre_check_id;

    perform set_config(
      'drevora.tyre_summary_refresh',
      coalesce(nullif(v_prev_setting, ''), '0'),
      true
    );
  exception
    when others then
      perform set_config(
        'drevora.tyre_summary_refresh',
        coalesce(nullif(v_prev_setting, ''), '0'),
        true
      );
      raise;
  end;
end;
$$;

create or replace function public.drevora_tyre_check_items_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- tyre_check_id is immutable; refresh the (single) parent.
  if tg_op = 'DELETE' then
    perform public.drevora_tyre_check_refresh_summary(old.tyre_check_id);
    return old;
  end if;

  perform public.drevora_tyre_check_refresh_summary(new.tyre_check_id);
  return new;
end;
$$;

drop trigger if exists tyre_check_items_refresh_summary on public.tyre_check_items;
create trigger tyre_check_items_refresh_summary
  after insert or update or delete on public.tyre_check_items
  for each row
  execute function public.drevora_tyre_check_items_after_change();

-- -----------------------------------------------------------------------------
-- 8) Parent validate + submission rules
-- -----------------------------------------------------------------------------

-- Validates truck / trailer vehicle_type roles, company match, and trailer snapshot.
-- Returns the trimmed trailer_number to store in trailer_number_snapshot (or NULL).
create or replace function public.drevora_tyre_check_resolve_trailer_snapshot(
  p_company_id uuid,
  p_vehicle_id uuid,
  p_trailer_vehicle_id uuid,
  p_trailer_axle_count smallint
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_truck_type text;
  v_trailer_type text;
  v_trailer_number text;
begin
  if p_vehicle_id is null then
    raise exception 'DREVORA: vehicle_id is required.';
  end if;

  select nullif(btrim(v.vehicle_type), '')
  into v_truck_type
  from public.vehicles v
  where v.id = p_vehicle_id;

  if not found then
    raise exception 'DREVORA: vehicle_id does not reference an existing vehicle.';
  end if;

  if v_truck_type is null then
    raise exception 'DREVORA: vehicle_id must reference a non-Trailer vehicle.';
  end if;

  if v_truck_type = 'Trailer' then
    raise exception 'DREVORA: vehicle_id must reference a non-Trailer vehicle.';
  end if;

  if not public.drevora_vehicle_in_company(p_vehicle_id, p_company_id) then
    raise exception 'DREVORA: vehicle_id does not belong to company_id.';
  end if;

  if p_trailer_vehicle_id is null then
    return null;
  end if;

  if p_trailer_vehicle_id = p_vehicle_id then
    raise exception 'DREVORA: Truck and Trailer cannot be the same vehicle.';
  end if;

  if p_trailer_axle_count is null
     or p_trailer_axle_count < 1
     or p_trailer_axle_count > 6 then
    raise exception 'DREVORA: trailer_axle_count must be between 1 and 6 when a trailer is selected.';
  end if;

  select
    nullif(btrim(v.vehicle_type), ''),
    nullif(btrim(v.trailer_number), '')
  into v_trailer_type, v_trailer_number
  from public.vehicles v
  where v.id = p_trailer_vehicle_id;

  if not found then
    raise exception 'DREVORA: trailer_vehicle_id does not reference an existing vehicle.';
  end if;

  if v_trailer_type is distinct from 'Trailer' then
    raise exception 'DREVORA: trailer_vehicle_id must reference a Trailer vehicle.';
  end if;

  if not public.drevora_vehicle_in_company(p_trailer_vehicle_id, p_company_id) then
    raise exception 'DREVORA: trailer_vehicle_id does not belong to company_id.';
  end if;

  if v_trailer_number is null then
    raise exception
      'DREVORA: Selected trailer vehicle has no trailer_number. Set vehicles.trailer_number before creating the check.';
  end if;

  return v_trailer_number;
end;
$$;

create or replace function public.drevora_tyre_checks_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trailer_snapshot text;
  v_item_count integer;
  v_missing_defect_notes integer;
  v_layout_complete boolean;
  v_good integer;
  v_attention integer;
  v_critical integer;
  v_dirty integer;
  v_defect integer;
  v_not_checked integer;
  v_becoming_final boolean;
  v_duration integer;
begin
  -- Internal summary refresh only (GUC + trusted writer + nested trigger depth).
  if public.drevora_tyre_summary_refresh_active() then
    return new;
  end if;

  if new.trailer_vehicle_id is null then
    new.trailer_axle_count := null;
    new.trailer_number_snapshot := null;
  else
    v_trailer_snapshot := public.drevora_tyre_check_resolve_trailer_snapshot(
      new.company_id,
      new.vehicle_id,
      new.trailer_vehicle_id,
      new.trailer_axle_count
    );
    new.trailer_number_snapshot := v_trailer_snapshot;
  end if;

  -- Always re-validate truck type / company even when no trailer.
  if new.trailer_vehicle_id is null then
    perform public.drevora_tyre_check_resolve_trailer_snapshot(
      new.company_id,
      new.vehicle_id,
      null,
      null
    );
  end if;

  if not public.drevora_driver_in_company(new.worker_id, new.company_id) then
    raise exception 'DREVORA: worker_id does not belong to company_id.';
  end if;

  -- Identity immutability for non-trusted writers
  if not public.drevora_is_trusted_tenant_writer() then
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.worker_id is distinct from old.worker_id
       or new.created_at is distinct from old.created_at then
      raise exception 'DREVORA: company_id / worker_id / id are immutable on tyre_checks.';
    end if;
  end if;

  if new.duration_seconds is not null and new.duration_seconds < 0 then
    raise exception 'DREVORA: duration_seconds cannot be negative.';
  end if;

  -- While draft/in_progress, discard client-spoofed summary fields; keep DB values.
  if new.status in ('draft', 'in_progress')
     and old.status in ('draft', 'in_progress') then
    new.good_count := old.good_count;
    new.attention_count := old.attention_count;
    new.critical_count := old.critical_count;
    new.dirty_count := old.dirty_count;
    new.defect_count := old.defect_count;
    new.not_checked_count := old.not_checked_count;
    new.overall_result := old.overall_result;
    return new;
  end if;

  v_becoming_final :=
    new.status = 'submitted'
    and old.status is distinct from new.status
    and old.status in ('draft', 'in_progress');

  if new.status = 'submitted'
     and old.status = 'submitted' then
    raise exception 'DREVORA: Workers may not alter a submitted Tyre Check.';
  end if;

  if new.status = 'submitted'
     and old.status not in ('draft', 'in_progress') then
    raise exception 'DREVORA: Only draft or in_progress Tyre Checks may be submitted.';
  end if;

  -- Submission gate (aggregate in-place; do not UPDATE self).
  if v_becoming_final then
    select
      count(*)::integer,
      count(*) filter (where i.tread_status = 'good')::integer,
      count(*) filter (where i.tread_status = 'attention')::integer,
      count(*) filter (where i.tread_status = 'critical')::integer,
      count(*) filter (where i.is_dirty)::integer,
      count(*) filter (where i.has_defect)::integer,
      count(*) filter (where i.tread_status = 'not_checked')::integer
    into
      v_item_count,
      v_good,
      v_attention,
      v_critical,
      v_dirty,
      v_defect,
      v_not_checked
    from public.tyre_check_items i
    where i.tyre_check_id = new.id;

    if v_item_count < 1 then
      raise exception 'DREVORA: Cannot submit a Tyre Check with no tyre items.';
    end if;

    v_layout_complete := public.drevora_tyre_check_has_complete_layout(new.id);
    if not v_layout_complete then
      raise exception 'DREVORA: Cannot submit: expected axle/position layout is incomplete.';
    end if;

    if v_not_checked > 0 then
      raise exception 'DREVORA: Cannot submit while any tyre is not_checked.';
    end if;

    select count(*)::integer
    into v_missing_defect_notes
    from public.tyre_check_items i
    where i.tyre_check_id = new.id
      and i.has_defect = true
      and nullif(btrim(coalesce(i.defect_notes, '')), '') is null;

    if v_missing_defect_notes > 0 then
      raise exception 'DREVORA: Every defect tyre requires non-empty defect_notes before submit.';
    end if;

    new.good_count := v_good;
    new.attention_count := v_attention;
    new.critical_count := v_critical;
    new.dirty_count := v_dirty;
    new.defect_count := v_defect;
    new.not_checked_count := v_not_checked;

    new.overall_result := public.drevora_tyre_check_compute_overall_result(
      v_good,
      v_attention,
      v_critical,
      v_dirty,
      v_defect,
      v_not_checked,
      v_item_count,
      public.drevora_tyre_check_expected_item_count(new.truck_axle_count, new.trailer_axle_count),
      true
    );

    if new.overall_result = 'incomplete' then
      raise exception 'DREVORA: Cannot submit an incomplete Tyre Check.';
    end if;

    -- Server-controlled submission timestamps (ignore client submitted_at).
    new.submitted_at := now();

    if new.inspection_completed_at is null then
      new.inspection_completed_at := now();
    end if;

    if new.inspection_started_at is not null
       and new.inspection_completed_at is not null then
      if new.inspection_completed_at < new.inspection_started_at then
        raise exception
          'DREVORA: inspection_completed_at cannot be earlier than inspection_started_at.';
      end if;

      v_duration := floor(
        extract(
          epoch from (new.inspection_completed_at - new.inspection_started_at)
        )
      )::integer;

      if v_duration < 0 then
        raise exception
          'DREVORA: inspection_completed_at cannot be earlier than inspection_started_at.';
      end if;

      new.duration_seconds := v_duration;
    else
      -- No start time: do not invent one; leave duration unset.
      new.duration_seconds := null;
    end if;
  end if;

  return new;
end;
$$;

-- Insert path: validate tenant + trailer snapshot (no child summary yet).
create or replace function public.drevora_tyre_checks_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trailer_snapshot text;
begin
  if new.trailer_vehicle_id is null then
    new.trailer_axle_count := null;
    new.trailer_number_snapshot := null;
    perform public.drevora_tyre_check_resolve_trailer_snapshot(
      new.company_id,
      new.vehicle_id,
      null,
      null
    );
  else
    v_trailer_snapshot := public.drevora_tyre_check_resolve_trailer_snapshot(
      new.company_id,
      new.vehicle_id,
      new.trailer_vehicle_id,
      new.trailer_axle_count
    );
    new.trailer_number_snapshot := v_trailer_snapshot;
  end if;

  if not public.drevora_driver_in_company(new.worker_id, new.company_id) then
    raise exception 'DREVORA: worker_id does not belong to company_id.';
  end if;

  -- New checks start incomplete until items exist.
  new.overall_result := 'incomplete';
  new.good_count := 0;
  new.attention_count := 0;
  new.critical_count := 0;
  new.dirty_count := 0;
  new.defect_count := 0;
  new.not_checked_count := 0;

  if new.status = 'submitted' then
    raise exception 'DREVORA: Tyre Checks cannot be inserted as submitted.';
  end if;

  if new.status not in ('draft', 'in_progress') then
    new.status := 'draft';
  end if;

  return new;
end;
$$;

drop trigger if exists tyre_checks_before_insert on public.tyre_checks;
create trigger tyre_checks_before_insert
  before insert on public.tyre_checks
  for each row
  execute function public.drevora_tyre_checks_before_insert();

drop trigger if exists tyre_checks_before_update on public.tyre_checks;
create trigger tyre_checks_before_update
  before update on public.tyre_checks
  for each row
  execute function public.drevora_tyre_checks_before_write();

-- -----------------------------------------------------------------------------
-- 9) Child row validation against parent axle layout
-- -----------------------------------------------------------------------------
create or replace function public.drevora_tyre_check_items_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_truck smallint;
  v_trailer smallint;
  v_trailer_vehicle uuid;
  v_status text;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.tyre_check_id is distinct from old.tyre_check_id
       or new.created_at is distinct from old.created_at then
      raise exception
        'DREVORA: tyre_check_items id, tyre_check_id and created_at are immutable.';
    end if;
  end if;

  select
    tc.truck_axle_count,
    tc.trailer_axle_count,
    tc.trailer_vehicle_id,
    tc.status
  into v_truck, v_trailer, v_trailer_vehicle, v_status
  from public.tyre_checks tc
  where tc.id = new.tyre_check_id
  for update;

  if v_truck is null then
    raise exception 'DREVORA: Parent tyre_check not found.';
  end if;

  if v_status not in ('draft', 'in_progress')
     and not public.drevora_is_trusted_tenant_writer() then
    raise exception 'DREVORA: Tyre items are locked after submit.';
  end if;

  if new.unit = 'vehicle' then
    if new.axle_number > v_truck then
      raise exception 'DREVORA: axle_number exceeds truck_axle_count.';
    end if;
    if new.axle_number = 1 and new.axle_type is distinct from 'steer' then
      raise exception 'DREVORA: Vehicle axle 1 must be axle_type = steer.';
    end if;
    if new.axle_number >= 2 and new.axle_type is distinct from 'drive' then
      raise exception 'DREVORA: Vehicle axles 2–6 must be axle_type = drive.';
    end if;
  elsif new.unit = 'trailer' then
    if v_trailer_vehicle is null then
      raise exception 'DREVORA: Trailer items are not allowed when the parent has no trailer.';
    end if;
    if v_trailer is null or new.axle_number > v_trailer then
      raise exception 'DREVORA: axle_number exceeds trailer_axle_count.';
    end if;
    if new.axle_type is distinct from 'trailer' then
      raise exception 'DREVORA: Trailer items must use axle_type = trailer.';
    end if;
  end if;

  if new.has_defect
     and nullif(btrim(coalesce(new.defect_notes, '')), '') is null
     and v_status = 'submitted' then
    raise exception 'DREVORA: defect_notes required when has_defect is true on a submitted check.';
  end if;

  return new;
end;
$$;

drop trigger if exists tyre_check_items_before_write on public.tyre_check_items;
create trigger tyre_check_items_before_write
  before insert or update on public.tyre_check_items
  for each row
  execute function public.drevora_tyre_check_items_before_write();

-- -----------------------------------------------------------------------------
-- 10) Worker write enforcement (identity + editable lifecycle)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_tyre_check_is_worker_editable(p_status text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_status in ('draft', 'in_progress');
$$;

create or replace function public.drevora_enforce_tyre_check_worker_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_worker_id uuid;
  v_company_id uuid;
begin
  -- Internal summary refresh only (GUC + trusted writer + nested trigger depth).
  if public.drevora_tyre_summary_refresh_active() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_company_id := case when tg_op = 'DELETE' then old.company_id else new.company_id end;

  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Office is read-only for Tyre Checks (review only). No office writes.
  if public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    raise exception 'DREVORA: Office users have read-only access to Tyre Checks.';
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null then
    raise exception 'DREVORA: Tyre Check write denied (no exact Worker link).';
  end if;

  if tg_op = 'INSERT' then
    new.worker_id := v_worker_id;
    if new.company_id is null
       or not public.drevora_auth_user_belongs_to_company_id(new.company_id) then
      raise exception 'DREVORA: Workers may only create Tyre Checks in their own company.';
    end if;
    if new.status not in ('draft', 'in_progress') then
      new.status := 'draft';
    end if;
    new.signature_url := null;
    new.signed_at := null;
    new.submitted_at := null;
    new.inspection_completed_at := null;
    new.duration_seconds := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.worker_id is distinct from v_worker_id
       or new.worker_id is distinct from v_worker_id then
      raise exception 'DREVORA: Workers may only update their own Tyre Checks.';
    end if;

    if new.company_id is distinct from old.company_id then
      raise exception 'DREVORA: Workers may not change company_id.';
    end if;

    if not public.drevora_tyre_check_is_worker_editable(old.status) then
      raise exception 'DREVORA: Workers may not alter a submitted Tyre Check.';
    end if;

    -- Allow transition draft/in_progress → submitted (validated by before_write).
    if new.status not in ('draft', 'in_progress', 'submitted') then
      raise exception 'DREVORA: Invalid Tyre Check status.';
    end if;

    return new;
  end if;

  -- DELETE
  if old.worker_id is distinct from v_worker_id then
    raise exception 'DREVORA: Workers may only delete their own Tyre Checks.';
  end if;
  if not public.drevora_tyre_check_is_worker_editable(old.status) then
    raise exception 'DREVORA: Workers may not delete a submitted Tyre Check.';
  end if;
  return old;
end;
$$;

create or replace function public.drevora_enforce_tyre_check_item_worker_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid;
  v_worker_id uuid;
  v_owner uuid;
  v_status text;
  v_check_id uuid;
begin
  v_check_id := case when tg_op = 'DELETE' then old.tyre_check_id else new.tyre_check_id end;

  select tc.company_id, tc.worker_id, tc.status
  into v_company_id, v_owner, v_status
  from public.tyre_checks tc
  where tc.id = v_check_id;

  if v_company_id is null then
    raise exception 'DREVORA: Parent tyre_check not found for item write.';
  end if;

  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    raise exception 'DREVORA: Office users have read-only access to Tyre Check items.';
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null or v_owner is distinct from v_worker_id then
    raise exception 'DREVORA: Workers may only modify items on their own Tyre Checks.';
  end if;

  if not public.drevora_tyre_check_is_worker_editable(v_status) then
    raise exception 'DREVORA: Tyre Check items are locked after submit.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists drevora_enforce_tyre_check_worker_write on public.tyre_checks;
create trigger drevora_enforce_tyre_check_worker_write
  before insert or update or delete on public.tyre_checks
  for each row
  execute function public.drevora_enforce_tyre_check_worker_write();

drop trigger if exists drevora_enforce_tyre_check_item_worker_write on public.tyre_check_items;
create trigger drevora_enforce_tyre_check_item_worker_write
  before insert or update or delete on public.tyre_check_items
  for each row
  execute function public.drevora_enforce_tyre_check_item_worker_write();

-- -----------------------------------------------------------------------------
-- 11) Function ACL (internal helpers + enforcers)
-- -----------------------------------------------------------------------------
revoke all on function public.drevora_normalize_vehicle_trailer_number() from public;
revoke all on function public.drevora_normalize_vehicle_trailer_number() from anon;
revoke all on function public.drevora_normalize_vehicle_trailer_number() from authenticated;

revoke all on function public.drevora_tyre_check_expected_item_count(smallint, smallint) from public;
revoke all on function public.drevora_tyre_check_expected_item_count(smallint, smallint) from anon;
revoke all on function public.drevora_tyre_check_expected_item_count(smallint, smallint) from authenticated;

revoke all on function public.drevora_tyre_check_has_complete_layout(uuid) from public;
revoke all on function public.drevora_tyre_check_has_complete_layout(uuid) from anon;
revoke all on function public.drevora_tyre_check_has_complete_layout(uuid) from authenticated;

revoke all on function public.drevora_tyre_check_compute_overall_result(integer, integer, integer, integer, integer, integer, integer, integer, boolean) from public;
revoke all on function public.drevora_tyre_check_compute_overall_result(integer, integer, integer, integer, integer, integer, integer, integer, boolean) from anon;
revoke all on function public.drevora_tyre_check_compute_overall_result(integer, integer, integer, integer, integer, integer, integer, integer, boolean) from authenticated;

revoke all on function public.drevora_tyre_summary_refresh_active() from public;
revoke all on function public.drevora_tyre_summary_refresh_active() from anon;
revoke all on function public.drevora_tyre_summary_refresh_active() from authenticated;
grant execute on function public.drevora_tyre_summary_refresh_active() to authenticated;

revoke all on function public.drevora_tyre_check_resolve_trailer_snapshot(uuid, uuid, uuid, smallint) from public;
revoke all on function public.drevora_tyre_check_resolve_trailer_snapshot(uuid, uuid, uuid, smallint) from anon;
revoke all on function public.drevora_tyre_check_resolve_trailer_snapshot(uuid, uuid, uuid, smallint) from authenticated;

revoke all on function public.drevora_tyre_check_refresh_summary(uuid) from public;
revoke all on function public.drevora_tyre_check_refresh_summary(uuid) from anon;
revoke all on function public.drevora_tyre_check_refresh_summary(uuid) from authenticated;

revoke all on function public.drevora_tyre_check_items_after_change() from public;
revoke all on function public.drevora_tyre_check_items_after_change() from anon;
revoke all on function public.drevora_tyre_check_items_after_change() from authenticated;

revoke all on function public.drevora_tyre_checks_before_write() from public;
revoke all on function public.drevora_tyre_checks_before_write() from anon;
revoke all on function public.drevora_tyre_checks_before_write() from authenticated;

revoke all on function public.drevora_tyre_checks_before_insert() from public;
revoke all on function public.drevora_tyre_checks_before_insert() from anon;
revoke all on function public.drevora_tyre_checks_before_insert() from authenticated;

revoke all on function public.drevora_tyre_check_items_before_write() from public;
revoke all on function public.drevora_tyre_check_items_before_write() from anon;
revoke all on function public.drevora_tyre_check_items_before_write() from authenticated;

revoke all on function public.drevora_tyre_check_is_worker_editable(text) from public;
revoke all on function public.drevora_tyre_check_is_worker_editable(text) from anon;
revoke all on function public.drevora_tyre_check_is_worker_editable(text) from authenticated;

revoke all on function public.drevora_enforce_tyre_check_worker_write() from public;
revoke all on function public.drevora_enforce_tyre_check_worker_write() from anon;
revoke all on function public.drevora_enforce_tyre_check_worker_write() from authenticated;

revoke all on function public.drevora_enforce_tyre_check_item_worker_write() from public;
revoke all on function public.drevora_enforce_tyre_check_item_worker_write() from anon;
revoke all on function public.drevora_enforce_tyre_check_item_worker_write() from authenticated;

-- Readable helper for policy expressions
grant execute on function public.drevora_tyre_check_is_worker_editable(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 12) RLS + grants
-- -----------------------------------------------------------------------------
alter table public.tyre_checks enable row level security;
alter table public.tyre_check_items enable row level security;

revoke all on table public.tyre_checks from public;
revoke all on table public.tyre_checks from anon;
revoke all on table public.tyre_check_items from public;
revoke all on table public.tyre_check_items from anon;

grant select, insert, update, delete on table public.tyre_checks to authenticated;
grant select, insert, update, delete on table public.tyre_check_items to authenticated;

-- Office: company-wide read
drop policy if exists tyre_checks_office_select on public.tyre_checks;
create policy tyre_checks_office_select
  on public.tyre_checks
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

-- Driver: own rows only
drop policy if exists tyre_checks_worker_select_own on public.tyre_checks;
create policy tyre_checks_worker_select_own
  on public.tyre_checks
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
  );

drop policy if exists tyre_checks_worker_insert_own on public.tyre_checks;
create policy tyre_checks_worker_insert_own
  on public.tyre_checks
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_vehicle_in_company(vehicle_id, company_id)
    and (
      trailer_vehicle_id is null
      or public.drevora_vehicle_in_company(trailer_vehicle_id, company_id)
    )
    and public.drevora_driver_in_company(worker_id, company_id)
    and status in ('draft', 'in_progress')
  );

drop policy if exists tyre_checks_worker_update_own on public.tyre_checks;
create policy tyre_checks_worker_update_own
  on public.tyre_checks
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_tyre_check_is_worker_editable(status)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_vehicle_in_company(vehicle_id, company_id)
    and (
      trailer_vehicle_id is null
      or public.drevora_vehicle_in_company(trailer_vehicle_id, company_id)
    )
    and public.drevora_driver_in_company(worker_id, company_id)
    and status in ('draft', 'in_progress', 'submitted')
  );

drop policy if exists tyre_checks_worker_delete_own on public.tyre_checks;
create policy tyre_checks_worker_delete_own
  on public.tyre_checks
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_tyre_check_is_worker_editable(status)
  );

-- Child policies (via parent)
drop policy if exists tyre_check_items_office_select on public.tyre_check_items;
create policy tyre_check_items_office_select
  on public.tyre_check_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tyre_checks tc
      where tc.id = tyre_check_id
        and tc.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(tc.company_id)
    )
  );

drop policy if exists tyre_check_items_worker_select_own on public.tyre_check_items;
create policy tyre_check_items_worker_select_own
  on public.tyre_check_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tyre_checks tc
      where tc.id = tyre_check_id
        and tc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(tc.company_id)
        and tc.worker_id = public.drevora_auth_user_driver_id()
    )
  );

drop policy if exists tyre_check_items_worker_insert_own on public.tyre_check_items;
create policy tyre_check_items_worker_insert_own
  on public.tyre_check_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tyre_checks tc
      where tc.id = tyre_check_id
        and tc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(tc.company_id)
        and tc.worker_id = public.drevora_auth_user_driver_id()
        and public.drevora_tyre_check_is_worker_editable(tc.status)
    )
  );

drop policy if exists tyre_check_items_worker_update_own on public.tyre_check_items;
create policy tyre_check_items_worker_update_own
  on public.tyre_check_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.tyre_checks tc
      where tc.id = tyre_check_id
        and tc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(tc.company_id)
        and tc.worker_id = public.drevora_auth_user_driver_id()
        and public.drevora_tyre_check_is_worker_editable(tc.status)
    )
  )
  with check (
    exists (
      select 1
      from public.tyre_checks tc
      where tc.id = tyre_check_id
        and tc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(tc.company_id)
        and tc.worker_id = public.drevora_auth_user_driver_id()
        and public.drevora_tyre_check_is_worker_editable(tc.status)
    )
  );

drop policy if exists tyre_check_items_worker_delete_own on public.tyre_check_items;
create policy tyre_check_items_worker_delete_own
  on public.tyre_check_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.tyre_checks tc
      where tc.id = tyre_check_id
        and tc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(tc.company_id)
        and tc.worker_id = public.drevora_auth_user_driver_id()
        and public.drevora_tyre_check_is_worker_editable(tc.status)
    )
  );

-- -----------------------------------------------------------------------------
-- 13) Static self-checks (no data mutation)
-- -----------------------------------------------------------------------------
do $$
begin
  if public.drevora_tyre_wear_percent(8.0) is distinct from 0.00 then
    raise exception 'Wear scale check failed for 8.0 mm';
  end if;
  if public.drevora_tyre_wear_percent(1.6) is distinct from 100.00 then
    raise exception 'Wear scale check failed for 1.6 mm';
  end if;
  if public.drevora_tyre_wear_percent(5.5) is distinct from 39.00 then
    raise exception 'Wear scale interpolation check failed for 5.5 mm (expected 39.00, got %)',
      public.drevora_tyre_wear_percent(5.5);
  end if;
  if public.drevora_tyre_tread_status(null) is distinct from 'not_checked' then
    raise exception 'Tread status null check failed';
  end if;
  if public.drevora_tyre_tread_status(6.0) is distinct from 'good' then
    raise exception 'Tread status good check failed';
  end if;
  if public.drevora_tyre_tread_status(4.0) is distinct from 'attention' then
    raise exception 'Tread status attention check failed';
  end if;
  if public.drevora_tyre_tread_status(3.9) is distinct from 'critical' then
    raise exception 'Tread status critical check failed';
  end if;

  if to_regclass('public.tyre_checks') is null
     or to_regclass('public.tyre_check_items') is null then
    raise exception 'Tyre Check tables were not created.';
  end if;
end;
$$;

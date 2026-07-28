-- =============================================================================
-- DREVORA migration: 20260728220000_fix_tyre_layout_rpc_and_position_constraint
-- =============================================================================
-- PURPOSE (live compatibility fix for per-axle Single/Dual)
--   Fixes the two Worker Tyre Check start errors seen when
--   20260728090000 was present in the repo but not applied on the project:
--     1) PGRST202 — missing public.drevora_set_vehicle_tyre_layout(uuid, text[])
--     2) 23514 — tyre_check_items_axle_type_position_check still enforcing the
--        old steer=single / drive+trailer=dual coupling
--
-- Frontend contract (do not change without updating the app):
--   rpc('drevora_set_vehicle_tyre_layout', {
--     p_vehicle_id: uuid string,
--     p_axle_layouts: ('single'|'dual')[]
--   }) → jsonb { vehicle_id, axle_count, axle_layouts }
--   Item positions written via tyreChecksService:
--     Single → left, right
--     Dual   → outer_left, inner_left, inner_right, outer_right
--     axle_type remains steer (vehicle axle 1) / drive (vehicle 2+) / trailer
--
-- CHANGES (idempotent; safe if 20260728090000 already applied)
--   - Replace tyre_check_items_axle_type_position_check so any axle_type may
--     use Single positions {left,right} OR Dual positions
--     {outer_left,inner_left,inner_right,outer_right}. Arbitrary text is still
--     rejected (also by tyre_check_items_position_check).
--   - Ensure structural Single/Dual completeness via
--     drevora_tyre_check_has_complete_layout (and matching summary/submit).
--   - Ensure public.vehicle_tyre_layouts +
--     public.drevora_set_vehicle_tyre_layout(p_vehicle_id uuid,
--     p_axle_layouts text[]) exist with company/auth checks.
--   - NOTIFY pgrst to reload the PostgREST schema cache.
--
-- SAFETY
--   - No data deleted/truncated; historical tyre_check_items untouched.
--   - EXECUTE on the RPC: authenticated (+ service_role when present);
--     PUBLIC and anon revoked.
--   - Apply manually after review. Do not auto-apply.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0) Preflight
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.tyre_checks') is null
     or to_regclass('public.tyre_check_items') is null then
    raise exception
      'DREVORA STOP 20260728220000: tyre_checks / tyre_check_items missing. Apply 20260717220000 first.';
  end if;

  if to_regclass('public.vehicles') is null
     or to_regclass('public.companies') is null
     or to_regclass('public.drivers') is null then
    raise exception 'DREVORA STOP 20260728220000: vehicles / companies / drivers missing.';
  end if;

  if to_regprocedure('public.drevora_tyre_check_has_complete_layout(uuid)') is null
     or to_regprocedure('public.drevora_tyre_check_refresh_summary(uuid)') is null
     or to_regprocedure('public.drevora_tyre_checks_before_write()') is null then
    raise exception
      'DREVORA STOP 20260728220000: expected tyre check functions missing. Apply 20260717220000 first.';
  end if;

  if to_regprocedure('public.drevora_auth_user_driver_id()') is null
     or to_regprocedure('public.drevora_auth_user_has_office_role_for_company(uuid)') is null
     or to_regprocedure('public.drevora_auth_user_belongs_to_company_id(uuid)') is null
     or to_regprocedure('public.drevora_vehicle_in_company(uuid, uuid)') is null
     or to_regprocedure('public.drevora_set_updated_at()') is null then
    raise exception
      'DREVORA STOP 20260728220000: tenant helper functions missing. Apply 20260715210000 first.';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1) Replace tyre_check_items_axle_type_position_check
--    axle_type remains steer/drive/trailer (enforced elsewhere). Single vs Dual
--    is a free per-axle choice: allow the exact frontend position values for
--    either layout on any axle_type. Mixed/incomplete axle sets are rejected
--    later by drevora_tyre_check_has_complete_layout at submit.
-- -----------------------------------------------------------------------------
alter table public.tyre_check_items
  drop constraint if exists tyre_check_items_axle_type_position_check;

alter table public.tyre_check_items
  add constraint tyre_check_items_axle_type_position_check check (
    -- Single layout positions (frontend: Left / Right → left / right)
    position in ('left', 'right')
    -- Dual layout positions (frontend: Outer/Inner Left/Right)
    or position in (
      'outer_left',
      'inner_left',
      'inner_right',
      'outer_right'
    )
  );

comment on table public.tyre_check_items is
  'Per-tyre measurements for a tyre_checks parent. Single/Dual is a free per-axle choice (2 or 4 recorded positions); tread_status/wear_percent are derived; Dirty/Defect are separate flags.';

comment on constraint tyre_check_items_axle_type_position_check on public.tyre_check_items is
  'Allows Single {left,right} or Dual {outer_left,inner_left,inner_right,outer_right} on any axle_type. Does not accept arbitrary position text.';

-- -----------------------------------------------------------------------------
-- 2) Layout completeness: structural, per-axle, no axle_type assumption
-- -----------------------------------------------------------------------------
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
  v_positions text[];
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

  -- Vehicle axles: each must be exactly Single {left,right} or exactly
  -- Dual {outer_left,inner_left,inner_right,outer_right}. Any other shape
  -- (missing, mixed, or duplicate positions) is incomplete.
  for v_axle in 1..v_truck loop
    select array_agg(i.position order by i.position)
    into v_positions
    from public.tyre_check_items i
    where i.tyre_check_id = p_tyre_check_id
      and i.unit = 'vehicle'
      and i.axle_number = v_axle;

    if v_positions is distinct from array['left', 'right']
       and v_positions is distinct from array['inner_left', 'inner_right', 'outer_left', 'outer_right'] then
      return false;
    end if;
  end loop;

  if exists (
    select 1
    from public.tyre_check_items i
    where i.tyre_check_id = p_tyre_check_id
      and i.unit = 'vehicle'
      and i.axle_number > v_truck
  ) then
    return false;
  end if;

  if v_has_trailer then
    if v_trailer is null then
      return false;
    end if;

    for v_axle in 1..v_trailer loop
      select array_agg(i.position order by i.position)
      into v_positions
      from public.tyre_check_items i
      where i.tyre_check_id = p_tyre_check_id
        and i.unit = 'trailer'
        and i.axle_number = v_axle;

      if v_positions is distinct from array['left', 'right']
         and v_positions is distinct from array['inner_left', 'inner_right', 'outer_left', 'outer_right'] then
        return false;
      end if;
    end loop;

    if exists (
      select 1
      from public.tyre_check_items i
      where i.tyre_check_id = p_tyre_check_id
        and i.unit = 'trailer'
        and i.axle_number > v_trailer
    ) then
      return false;
    end if;
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

comment on function public.drevora_tyre_check_has_complete_layout(uuid) is
  'Per-axle structural check: every configured axle has exactly a Single {left,right} or Dual {outer/inner left/right} position set, with no extraneous axles. Single/Dual is a free per-axle choice, independent of axle_type.';

-- -----------------------------------------------------------------------------
-- 3) Expected item count once complete = actual item count (no fixed formula)
-- -----------------------------------------------------------------------------
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

  v_layout_complete := public.drevora_tyre_check_has_complete_layout(p_tyre_check_id);
  -- Single/Dual is a free per-axle choice: once the layout is structurally
  -- complete, the actual item count IS the expected count. There is no
  -- separate axle-count formula to compare against any more.
  v_expected := v_item_count;
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

    -- Single/Dual is a free per-axle choice: layout is already verified
    -- structurally complete above, so the true "expected" count is simply
    -- the actual item count (no fixed steer-single/drive-dual formula).
    new.overall_result := public.drevora_tyre_check_compute_overall_result(
      v_good,
      v_attention,
      v_critical,
      v_dirty,
      v_defect,
      v_not_checked,
      v_item_count,
      v_item_count,
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

-- -----------------------------------------------------------------------------
-- 4) vehicle_tyre_layouts: one persisted default layout per Vehicle
-- -----------------------------------------------------------------------------
create table if not exists public.vehicle_tyre_layouts (
  vehicle_id uuid primary key references public.vehicles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete restrict,
  axle_count smallint not null,
  axle_layouts text[] not null,
  updated_by_driver_id uuid null references public.drivers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_tyre_layouts_axle_count_check check (
    axle_count between 1 and 6
  ),
  constraint vehicle_tyre_layouts_axle_layouts_length_check check (
    array_length(axle_layouts, 1) = axle_count
  ),
  constraint vehicle_tyre_layouts_axle_layouts_values_check check (
    axle_layouts <@ array['single', 'dual']::text[]
  )
);

comment on table public.vehicle_tyre_layouts is
  'Persisted default per-axle Single/Dual wheel layout for one Vehicle (truck or trailer). Read by Worker setup and Admin Configuration as the starting default only. Each Tyre Check keeps its own tyre_check_items rows as the permanent historical layout; changes here never alter a completed check.';

create index if not exists vehicle_tyre_layouts_company_id_idx
  on public.vehicle_tyre_layouts (company_id);

drop trigger if exists vehicle_tyre_layouts_set_updated_at on public.vehicle_tyre_layouts;
create trigger vehicle_tyre_layouts_set_updated_at
  before update on public.vehicle_tyre_layouts
  for each row
  execute function public.drevora_set_updated_at();

alter table public.vehicle_tyre_layouts enable row level security;

revoke all on table public.vehicle_tyre_layouts from public;
revoke all on table public.vehicle_tyre_layouts from anon;
grant select on table public.vehicle_tyre_layouts to authenticated;

drop policy if exists vehicle_tyre_layouts_company_select on public.vehicle_tyre_layouts;
create policy vehicle_tyre_layouts_company_select
  on public.vehicle_tyre_layouts
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
  );

-- No INSERT/UPDATE/DELETE policies or grants for authenticated: all writes go
-- through drevora_set_vehicle_tyre_layout below (SECURITY DEFINER).

-- -----------------------------------------------------------------------------
-- 5) RPC: save a Vehicle's default axle layout (Worker own-company or Office)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_set_vehicle_tyre_layout(
  p_vehicle_id uuid,
  p_axle_layouts text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker_id uuid;
  v_worker_company_id uuid;
  v_vehicle_company_id uuid;
  v_vehicle_archived_at timestamptz;
  v_axle_count smallint;
  v_layout text;
  v_authorised boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_vehicle_id is null then
    raise exception 'Vehicle is required';
  end if;

  if p_axle_layouts is null or array_length(p_axle_layouts, 1) is null then
    raise exception 'At least one axle layout is required';
  end if;

  v_axle_count := array_length(p_axle_layouts, 1);
  if v_axle_count < 1 or v_axle_count > 6 then
    raise exception 'Axle count must be between 1 and 6';
  end if;

  foreach v_layout in array p_axle_layouts loop
    if v_layout is null or v_layout not in ('single', 'dual') then
      raise exception 'Each axle layout must be single or dual';
    end if;
  end loop;

  -- Lock the exact Vehicle row before authorising the write, so this
  -- serializes with Vehicle Archive and cannot race past an unlocked read.
  select v.company_id, v.archived_at
  into v_vehicle_company_id, v_vehicle_archived_at
  from public.vehicles v
  where v.id = p_vehicle_id
  for update;

  if not found or v_vehicle_company_id is null then
    raise exception 'Vehicle not found or not active in your company';
  end if;

  if v_vehicle_archived_at is not null then
    raise exception 'Vehicle not found or not active in your company';
  end if;

  if not public.drevora_vehicle_in_company(p_vehicle_id, v_vehicle_company_id) then
    raise exception 'Vehicle not found or not active in your company';
  end if;

  -- Authorise: same-company active Worker, or Office/Admin of that company.
  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is not null then
    select d.company_id
    into v_worker_company_id
    from public.drivers d
    where d.id = v_worker_id
      and d.archived_at is null
    for update;

    if v_worker_company_id is not null and v_worker_company_id = v_vehicle_company_id then
      v_authorised := true;
    end if;
  end if;

  if not v_authorised then
    v_authorised := public.drevora_auth_user_has_office_role_for_company(v_vehicle_company_id);
  end if;

  if not v_authorised then
    raise exception 'Not authorised to configure this vehicle';
  end if;

  insert into public.vehicle_tyre_layouts (
    vehicle_id, company_id, axle_count, axle_layouts, updated_by_driver_id
  ) values (
    p_vehicle_id, v_vehicle_company_id, v_axle_count, p_axle_layouts, v_worker_id
  )
  on conflict (vehicle_id) do update
  set
    company_id = excluded.company_id,
    axle_count = excluded.axle_count,
    axle_layouts = excluded.axle_layouts,
    updated_by_driver_id = excluded.updated_by_driver_id,
    updated_at = now();

  return jsonb_build_object(
    'vehicle_id', p_vehicle_id,
    'axle_count', v_axle_count,
    'axle_layouts', to_jsonb(p_axle_layouts)
  );
end;
$$;

comment on function public.drevora_set_vehicle_tyre_layout(uuid, text[]) is
  'Worker (own company, active) or Office/Admin: save the default per-axle Single/Dual layout for one Vehicle. Locks the Vehicle row before writing. Never touches tyre_checks / tyre_check_items, so completed historical checks are unaffected.';

revoke all on function public.drevora_set_vehicle_tyre_layout(uuid, text[]) from public;
revoke all on function public.drevora_set_vehicle_tyre_layout(uuid, text[]) from anon;
grant execute on function public.drevora_set_vehicle_tyre_layout(uuid, text[]) to authenticated;

do $$
begin
  if to_regrole('service_role') is not null then
    execute 'grant execute on function public.drevora_set_vehicle_tyre_layout(uuid, text[]) to service_role';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 6) Static self-checks (no data mutation)
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.vehicle_tyre_layouts') is null then
    raise exception 'DREVORA STOP 20260728220000: vehicle_tyre_layouts was not created.';
  end if;

  if to_regprocedure('public.drevora_set_vehicle_tyre_layout(uuid, text[])') is null then
    raise exception
      'DREVORA STOP 20260728220000: drevora_set_vehicle_tyre_layout(uuid, text[]) missing.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tyre_check_items'::regclass
      and conname = 'tyre_check_items_axle_type_position_check'
  ) then
    raise exception
      'DREVORA STOP 20260728220000: tyre_check_items_axle_type_position_check was not recreated.';
  end if;
end $$;

commit;

-- Reload PostgREST so rpc('drevora_set_vehicle_tyre_layout', …) is visible
-- immediately after this migration is applied.
notify pgrst, 'reload schema';

-- =============================================================================
-- Manual verification (do not execute as part of migration):
--
-- select public.drevora_set_vehicle_tyre_layout(
--   '<vehicle-uuid>'::uuid,
--   array['dual','single','single']
-- );
-- select * from public.vehicle_tyre_layouts where vehicle_id = '<vehicle-uuid>'::uuid;
-- -- Item insert shapes that must now pass the row CHECK:
-- -- steer + outer_left (Dual on axle 1), drive + left (Single on axle 2+)
-- =============================================================================

-- =============================================================================
-- DREVORA migration: 20260807220000_tyre_check_pressure_and_corrections
--
-- Purpose:
--   1) Optional tyre pressure per position + one pressure unit (bar|psi) per check
--   2) Office-only Admin correction audit for submitted Tyre Checks
--      (preserves original values; applies corrected live measurements via RPC)
--
-- Apply manually on the Supabase project after review. Do not auto-apply.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Preflight
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.tyre_checks') is null then
    raise exception 'DREVORA STOP 20260807220000: public.tyre_checks is missing';
  end if;

  if to_regclass('public.tyre_check_items') is null then
    raise exception 'DREVORA STOP 20260807220000: public.tyre_check_items is missing';
  end if;

  if to_regprocedure('public.drevora_auth_user_has_office_role_for_company(uuid)') is null then
    raise exception
      'DREVORA STOP 20260807220000: drevora_auth_user_has_office_role_for_company(uuid) is missing';
  end if;

  if to_regprocedure('public.drevora_tyre_checks_before_write()') is null then
    raise exception
      'DREVORA STOP 20260807220000: drevora_tyre_checks_before_write() is missing';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1) Optional pressure unit (whole check) + per-item pressure value
-- -----------------------------------------------------------------------------
alter table public.tyre_checks
  add column if not exists pressure_unit text null;

alter table public.tyre_checks
  drop constraint if exists tyre_checks_pressure_unit_check;

alter table public.tyre_checks
  add constraint tyre_checks_pressure_unit_check check (
    pressure_unit is null or pressure_unit in ('bar', 'psi')
  );

comment on column public.tyre_checks.pressure_unit is
  'Optional whole-check tyre pressure unit: bar or psi. NULL when never chosen; empty pressures stay NULL.';

alter table public.tyre_check_items
  add column if not exists pressure_value numeric(6, 2) null;

alter table public.tyre_check_items
  drop constraint if exists tyre_check_items_pressure_value_check;

alter table public.tyre_check_items
  add constraint tyre_check_items_pressure_value_check check (
    pressure_value is null
    or (pressure_value >= 0 and pressure_value <= 200)
  );

comment on column public.tyre_check_items.pressure_value is
  'Optional tyre pressure for this position. NULL when not recorded (never coerced to zero). Unit is tyre_checks.pressure_unit.';

-- -----------------------------------------------------------------------------
-- 2) Correction / audit tables (Office SELECT only; writes via SECURITY DEFINER RPC)
-- -----------------------------------------------------------------------------
create table if not exists public.tyre_check_corrections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  tyre_check_id uuid not null references public.tyre_checks (id) on delete restrict,
  correction_reason text not null,
  corrected_by uuid not null references auth.users (id) on delete restrict,
  corrected_at timestamptz not null default now(),
  old_pressure_unit text null,
  new_pressure_unit text null,
  created_at timestamptz not null default now(),
  constraint tyre_check_corrections_reason_nonblank_check check (
    length(btrim(correction_reason)) > 0
  ),
  constraint tyre_check_corrections_old_pressure_unit_check check (
    old_pressure_unit is null or old_pressure_unit in ('bar', 'psi')
  ),
  constraint tyre_check_corrections_new_pressure_unit_check check (
    new_pressure_unit is null or new_pressure_unit in ('bar', 'psi')
  )
);

comment on table public.tyre_check_corrections is
  'Office Admin corrections for submitted Tyre Checks. Original check identity stays; measurement history is preserved in child change rows.';

create index if not exists tyre_check_corrections_check_corrected_at_idx
  on public.tyre_check_corrections (tyre_check_id, corrected_at desc);

create index if not exists tyre_check_corrections_company_corrected_at_idx
  on public.tyre_check_corrections (company_id, corrected_at desc);

create table if not exists public.tyre_check_correction_item_changes (
  id uuid primary key default gen_random_uuid(),
  correction_id uuid not null references public.tyre_check_corrections (id) on delete cascade,
  tyre_check_item_id uuid not null references public.tyre_check_items (id) on delete restrict,
  unit text not null,
  axle_number smallint not null,
  position text not null,
  old_tread_depth_mm numeric(4, 1) null,
  new_tread_depth_mm numeric(4, 1) null,
  old_pressure_value numeric(6, 2) null,
  new_pressure_value numeric(6, 2) null,
  created_at timestamptz not null default now(),
  constraint tyre_check_correction_item_changes_unit_check check (
    unit in ('vehicle', 'trailer')
  ),
  constraint tyre_check_correction_item_changes_position_check check (
    position in (
      'left',
      'right',
      'outer_left',
      'inner_left',
      'inner_right',
      'outer_right'
    )
  ),
  constraint tyre_check_correction_item_changes_must_change_check check (
    old_tread_depth_mm is distinct from new_tread_depth_mm
    or old_pressure_value is distinct from new_pressure_value
  )
);

comment on table public.tyre_check_correction_item_changes is
  'Per-position old/new tread depth and pressure for a Tyre Check correction. Original values remain auditable.';

create index if not exists tyre_check_correction_item_changes_correction_idx
  on public.tyre_check_correction_item_changes (correction_id);

-- -----------------------------------------------------------------------------
-- 3) RLS: Office SELECT for corrections; no authenticated INSERT/UPDATE/DELETE
-- -----------------------------------------------------------------------------
alter table public.tyre_check_corrections enable row level security;
alter table public.tyre_check_correction_item_changes enable row level security;

revoke all on table public.tyre_check_corrections from public;
revoke all on table public.tyre_check_corrections from anon;
revoke all on table public.tyre_check_correction_item_changes from public;
revoke all on table public.tyre_check_correction_item_changes from anon;

grant select on table public.tyre_check_corrections to authenticated;
grant select on table public.tyre_check_correction_item_changes to authenticated;

drop policy if exists tyre_check_corrections_office_select on public.tyre_check_corrections;
create policy tyre_check_corrections_office_select
  on public.tyre_check_corrections
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

drop policy if exists tyre_check_correction_item_changes_office_select
  on public.tyre_check_correction_item_changes;
create policy tyre_check_correction_item_changes_office_select
  on public.tyre_check_correction_item_changes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tyre_check_corrections c
      where c.id = correction_id
        and c.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(c.company_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 4) Allow office correction RPC to update pressure_unit on submitted parents
--    (auth.uid() office check — clients cannot spoof via GUC alone)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_tyre_office_correction_active(p_company_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    current_setting('drevora.tyre_office_correction', true) = '1'
    and auth.uid() is not null
    and p_company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(p_company_id);
$$;

revoke all on function public.drevora_tyre_office_correction_active(uuid) from public;
revoke all on function public.drevora_tyre_office_correction_active(uuid) from anon;
grant execute on function public.drevora_tyre_office_correction_active(uuid) to authenticated;

-- Patch submitted-lock in before_write (preserve latest submit gate from
-- 20260728220000, adding office-correction escape for pressure_unit only).

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

  -- Office correction RPC: allow pressure_unit change on submitted parents only.
  if tg_op = 'UPDATE'
     and old.status = 'submitted'
     and new.status = 'submitted'
     and public.drevora_tyre_office_correction_active(new.company_id) then
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.worker_id is distinct from old.worker_id
       or new.vehicle_id is distinct from old.vehicle_id
       or new.trailer_vehicle_id is distinct from old.trailer_vehicle_id
       or new.trailer_number_snapshot is distinct from old.trailer_number_snapshot
       or new.status is distinct from old.status
       or new.truck_axle_count is distinct from old.truck_axle_count
       or new.trailer_axle_count is distinct from old.trailer_axle_count
       or new.inspection_started_at is distinct from old.inspection_started_at
       or new.inspection_completed_at is distinct from old.inspection_completed_at
       or new.submitted_at is distinct from old.submitted_at
       or new.duration_seconds is distinct from old.duration_seconds
       or new.odometer is distinct from old.odometer
       or new.odometer_unit is distinct from old.odometer_unit
       or new.notes is distinct from old.notes
       or new.signature_url is distinct from old.signature_url
       or new.signed_at is distinct from old.signed_at
       or new.created_at is distinct from old.created_at
       or new.good_count is distinct from old.good_count
       or new.attention_count is distinct from old.attention_count
       or new.critical_count is distinct from old.critical_count
       or new.dirty_count is distinct from old.dirty_count
       or new.defect_count is distinct from old.defect_count
       or new.not_checked_count is distinct from old.not_checked_count
       or new.overall_result is distinct from old.overall_result then
      raise exception
        'DREVORA: Office Tyre Check correction may only change pressure_unit on the parent.';
    end if;
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
-- 5) Office RPC: apply correction (audit + live measurement update)
-- p_items: jsonb array of
--   { "item_id": uuid, "tread_depth_mm": number|null, "pressure_value": number|null }
-- -----------------------------------------------------------------------------
create or replace function public.drevora_office_apply_tyre_check_correction(
  p_tyre_check_id uuid,
  p_reason text,
  p_pressure_unit text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_status text;
  v_old_unit text;
  v_new_unit text;
  v_correction_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_old_tread numeric(4, 1);
  v_new_tread numeric(4, 1);
  v_old_pressure numeric(6, 2);
  v_new_pressure numeric(6, 2);
  v_unit text;
  v_axle smallint;
  v_position text;
  v_changed integer := 0;
  v_prev_guc text;
begin
  if v_uid is null then
    raise exception 'DREVORA: Authentication required.';
  end if;

  if p_tyre_check_id is null then
    raise exception 'DREVORA: tyre_check_id is required.';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'DREVORA: Correction reason is required.';
  end if;

  if p_pressure_unit is not null and p_pressure_unit not in ('bar', 'psi') then
    raise exception 'DREVORA: pressure_unit must be bar or psi.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'DREVORA: Correction items are required.';
  end if;

  select tc.company_id, tc.status, tc.pressure_unit
  into v_company_id, v_status, v_old_unit
  from public.tyre_checks tc
  where tc.id = p_tyre_check_id
  for update;

  if v_company_id is null then
    raise exception 'DREVORA: Tyre Check not found.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    raise exception 'DREVORA: Only office roles can correct Tyre Checks.';
  end if;

  if v_status is distinct from 'submitted' then
    raise exception 'DREVORA: Only submitted Tyre Checks can be corrected.';
  end if;

  v_new_unit := p_pressure_unit;

  insert into public.tyre_check_corrections (
    company_id,
    tyre_check_id,
    correction_reason,
    corrected_by,
    old_pressure_unit,
    new_pressure_unit
  )
  values (
    v_company_id,
    p_tyre_check_id,
    btrim(p_reason),
    v_uid,
    v_old_unit,
    v_new_unit
  )
  returning id into v_correction_id;

  v_prev_guc := current_setting('drevora.tyre_office_correction', true);
  perform set_config('drevora.tyre_office_correction', '1', true);

  begin
    if v_new_unit is distinct from v_old_unit then
      update public.tyre_checks
      set pressure_unit = v_new_unit,
          updated_at = now()
      where id = p_tyre_check_id;
      v_changed := v_changed + 1;
    end if;

    for v_item in
      select value from jsonb_array_elements(p_items)
    loop
      begin
        v_item_id := (v_item ->> 'item_id')::uuid;
      exception
        when others then
          raise exception 'DREVORA: Each correction item requires a valid item_id.';
      end;

      if v_item_id is null then
        raise exception 'DREVORA: Each correction item requires item_id.';
      end if;

      if v_item ? 'tread_depth_mm'
         and v_item ->> 'tread_depth_mm' is not null
         and btrim(v_item ->> 'tread_depth_mm') <> '' then
        v_new_tread := (v_item ->> 'tread_depth_mm')::numeric(4, 1);
      else
        v_new_tread := null;
      end if;

      if v_item ? 'pressure_value'
         and v_item ->> 'pressure_value' is not null
         and btrim(v_item ->> 'pressure_value') <> '' then
        v_new_pressure := (v_item ->> 'pressure_value')::numeric(6, 2);
      else
        v_new_pressure := null;
      end if;

      if v_new_tread is not null then
        if v_new_tread < 0 or v_new_tread > 30 then
          raise exception 'DREVORA: tread_depth_mm must be between 0 and 30.';
        end if;
        if v_new_tread is distinct from 1.6
           and (v_new_tread * 2) <> round(v_new_tread * 2) then
          raise exception 'DREVORA: tread_depth_mm must use 0.5 mm steps or exact 1.6.';
        end if;
      end if;

      if v_new_pressure is not null
         and (v_new_pressure < 0 or v_new_pressure > 200) then
        raise exception 'DREVORA: pressure_value must be between 0 and 200.';
      end if;

      select
        i.tread_depth_mm,
        i.pressure_value,
        i.unit,
        i.axle_number,
        i.position
      into
        v_old_tread,
        v_old_pressure,
        v_unit,
        v_axle,
        v_position
      from public.tyre_check_items i
      where i.id = v_item_id
        and i.tyre_check_id = p_tyre_check_id
      for update;

      if v_unit is null then
        raise exception
          'DREVORA: Correction item % does not belong to this Tyre Check.',
          v_item_id;
      end if;

      if v_new_tread is not distinct from v_old_tread
         and v_new_pressure is not distinct from v_old_pressure then
        continue;
      end if;

      update public.tyre_check_items
      set
        tread_depth_mm = v_new_tread,
        pressure_value = v_new_pressure,
        updated_at = now()
      where id = v_item_id;

      insert into public.tyre_check_correction_item_changes (
        correction_id,
        tyre_check_item_id,
        unit,
        axle_number,
        position,
        old_tread_depth_mm,
        new_tread_depth_mm,
        old_pressure_value,
        new_pressure_value
      )
      values (
        v_correction_id,
        v_item_id,
        v_unit,
        v_axle,
        v_position,
        v_old_tread,
        v_new_tread,
        v_old_pressure,
        v_new_pressure
      );

      v_changed := v_changed + 1;
    end loop;

    if v_changed = 0 then
      raise exception 'DREVORA: Correction must change at least one value.';
    end if;
  exception
    when others then
      perform set_config(
        'drevora.tyre_office_correction',
        coalesce(v_prev_guc, ''),
        true
      );
      raise;
  end;

  perform set_config(
    'drevora.tyre_office_correction',
    coalesce(v_prev_guc, ''),
    true
  );

  return v_correction_id;
end;
$$;

revoke all on function public.drevora_office_apply_tyre_check_correction(uuid, text, text, jsonb)
  from public;
revoke all on function public.drevora_office_apply_tyre_check_correction(uuid, text, text, jsonb)
  from anon;
grant execute on function public.drevora_office_apply_tyre_check_correction(uuid, text, text, jsonb)
  to authenticated;

comment on function public.drevora_office_apply_tyre_check_correction(uuid, text, text, jsonb) is
  'Office-only: apply a Tyre Check measurement correction with mandatory reason and old/new audit rows. Does not delete the original check.';

commit;

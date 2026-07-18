-- Vehicle Check defect manager-review fields.
-- Separates inspection result / completion from Transport Manager operational decisions.
-- Idempotent. Does not rewrite historical Worker checklist answers.

alter table public.vehicle_checks
  add column if not exists defect_review_status text,
  add column if not exists defect_reviewed_at timestamptz,
  add column if not exists defect_reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists defect_reviewed_by_name text,
  add column if not exists defect_review_notes text;

alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_defect_review_status_check;

alter table public.vehicle_checks
  add constraint vehicle_checks_defect_review_status_check check (
    defect_review_status is null
    or defect_review_status in (
      'awaiting_review',
      'safe_to_operate',
      'repair_required',
      'vehicle_off_road',
      'resolved'
    )
  );

create index if not exists vehicle_checks_defect_review_status_idx
  on public.vehicle_checks (defect_review_status);

-- Correct stale Pass results when Advisory (Defect) items exist.
update public.vehicle_checks vc
set overall_result = 'Advisory',
    updated_at = now()
where vc.overall_result = 'Pass'
  and exists (
    select 1
    from public.vehicle_check_items i
    where i.vehicle_check_id = vc.id
      and i.result = 'Advisory'
  );

-- Backfill manager review for inspections that already contain defects.
update public.vehicle_checks vc
set defect_review_status = 'awaiting_review',
    updated_at = now()
where vc.defect_review_status is null
  and exists (
    select 1
    from public.vehicle_check_items i
    where i.vehicle_check_id = vc.id
      and i.result = 'Advisory'
  );

-- Notify only when real Defect (Advisory) items exist. N/A is stored as Fail and must not alert.
create or replace function public.drevora_notify_vehicle_check_attention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_worker text;
  v_vehicle text;
  v_defect_items integer := 0;
  v_message text;
  v_is_final boolean;
begin
  v_is_final :=
    new.status = 'Completed'
    or new.inspection_completed_at is not null
    or new.signed_at is not null;

  if not v_is_final then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (
      old.status = 'Completed'
      or old.inspection_completed_at is not null
      or old.signed_at is not null
    ) then
      return new;
    end if;
  end if;

  select count(*) filter (where i.result = 'Advisory')
  into v_defect_items
  from public.vehicle_check_items i
  where i.vehicle_check_id = new.id;

  if coalesce(v_defect_items, 0) = 0
     and new.overall_result is distinct from 'Advisory' then
    return new;
  end if;

  if coalesce(v_defect_items, 0) = 0 then
    return new;
  end if;

  v_company_id := public.drevora_notification_resolve_company_id(
    null,
    new.worker_id,
    new.vehicle_id
  );
  if v_company_id is null then
    return new;
  end if;

  v_worker := coalesce(public.drevora_notification_worker_label(new.worker_id), 'a worker');
  v_vehicle := coalesce(public.drevora_notification_vehicle_label(new.vehicle_id), 'a vehicle');
  v_message :=
    v_vehicle || ' — ' || v_worker
    || ': ' || v_defect_items::text
    || case when v_defect_items = 1 then ' defect' else ' defects' end
    || ' found. Awaiting review.';

  perform public.drevora_insert_admin_notification(
    v_company_id,
    'vehicle_check_attention',
    'warning',
    'Vehicle check defects found',
    v_message,
    'vehicle_check',
    new.id,
    '/admin/vehicle-checks',
    'vehicle_check_attention:' || new.id::text,
    jsonb_build_object(
      'overall_result', new.overall_result,
      'defect_items', coalesce(v_defect_items, 0),
      'defect_review_status', new.defect_review_status
    )
  );

  return new;
end;
$$;

drop trigger if exists drevora_notify_vehicle_check_attention on public.vehicle_checks;
create trigger drevora_notify_vehicle_check_attention
  after insert or update of status, overall_result, inspection_completed_at, signed_at
  on public.vehicle_checks
  for each row
  execute function public.drevora_notify_vehicle_check_attention();

-- MVP grants (matches existing vehicle_checks pattern).
grant select, insert, update, delete on public.vehicle_checks to anon, authenticated;

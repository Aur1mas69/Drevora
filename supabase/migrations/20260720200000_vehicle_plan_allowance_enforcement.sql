-- Vehicle plan allowance enforcement (no Stripe).
-- 1) Soft-archive lifecycle on vehicles (archived_at)
-- 2) BEFORE INSERT/UPDATE trigger: lock company row, count active Vehicles,
--    enforce trusted starter/growing/pro vehicle limits. Idempotent where practical.

-- -----------------------------------------------------------------------------
-- 1) Soft-archive lifecycle
-- -----------------------------------------------------------------------------
alter table public.vehicles
  add column if not exists archived_at timestamptz;

comment on column public.vehicles.archived_at is
  'When set, the Vehicle is archived/former and does not occupy an active plan seat. Operational status (Off Road, Maintenance, etc.) is unrelated.';

create index if not exists vehicles_company_id_archived_at_idx
  on public.vehicles (company_id, archived_at);

create index if not exists vehicles_company_id_active_idx
  on public.vehicles (company_id)
  where archived_at is null;

-- -----------------------------------------------------------------------------
-- 2) Trusted active-Vehicle limits (server-side; never from the browser)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_active_vehicle_limit_for_plan(p_plan_code text)
returns integer
language sql
immutable
as $$
  select case lower(trim(coalesce(p_plan_code, '')))
    when 'starter' then 10
    when 'growing' then 25
    when 'pro' then 50
    else null
  end;
$$;

comment on function public.drevora_active_vehicle_limit_for_plan(text) is
  'Trusted active Vehicle allowances for starter/growing/pro. Custom and unknown return null.';

-- -----------------------------------------------------------------------------
-- 3) Enforce on create (insert) and reactivate (archived_at cleared)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_enforce_vehicle_plan_allowance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_plan_code text;
  v_limit integer;
  v_active_count integer;
  v_becoming_active boolean := false;
begin
  if tg_op = 'INSERT' then
    v_becoming_active := (new.archived_at is null);
  elsif tg_op = 'UPDATE' then
    v_becoming_active :=
      (old.archived_at is not null and new.archived_at is null)
      or (
        new.archived_at is null
        and old.company_id is distinct from new.company_id
      );
  end if;

  if not v_becoming_active then
    return new;
  end if;

  v_company_id := new.company_id;
  if v_company_id is null then
    raise exception 'VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Vehicle company_id is required for plan allowance checks.';
  end if;

  select c.plan_code
  into v_plan_code
  from public.companies c
  where c.id = v_company_id
  for update;

  if not found then
    raise exception 'VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Company not found for Vehicle plan allowance check.';
  end if;

  v_limit := public.drevora_active_vehicle_limit_for_plan(v_plan_code);

  if v_limit is null then
    raise exception 'VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Assign a valid starter/growing/pro plan, or configure a trusted Custom Fleet Vehicle limit.';
  end if;

  select count(*)::integer
  into v_active_count
  from public.vehicles v
  where v.company_id = v_company_id
    and v.archived_at is null
    and (tg_op = 'INSERT' or v.id is distinct from new.id);

  if v_active_count >= v_limit then
    raise exception 'VEHICLE_PLAN_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = format(
              'Active Vehicles %s / %s. Archive an inactive Vehicle or change the company plan.',
              v_active_count,
              v_limit
            );
  end if;

  return new;
end;
$$;

comment on function public.drevora_enforce_vehicle_plan_allowance() is
  'Prevents creating or reactivating Vehicles above the company active-Vehicle plan allowance.';

drop trigger if exists vehicles_enforce_vehicle_plan_allowance on public.vehicles;
create trigger vehicles_enforce_vehicle_plan_allowance
  before insert or update of archived_at, company_id
  on public.vehicles
  for each row
  execute function public.drevora_enforce_vehicle_plan_allowance();

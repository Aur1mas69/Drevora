-- Worker plan allowance enforcement (no Stripe).
-- 1) Soft-archive lifecycle on drivers (archived_at)
-- 2) BEFORE INSERT/UPDATE trigger: lock company row, count active Workers,
--    enforce trusted starter/growing/pro limits. Idempotent where practical.

-- -----------------------------------------------------------------------------
-- 1) Soft-archive lifecycle
-- -----------------------------------------------------------------------------
alter table public.drivers
  add column if not exists archived_at timestamptz;

comment on column public.drivers.archived_at is
  'When set, the Worker is archived/former and does not occupy an active plan seat. Duty status is unrelated.';

create index if not exists drivers_company_id_archived_at_idx
  on public.drivers (company_id, archived_at);

create index if not exists drivers_company_id_active_idx
  on public.drivers (company_id)
  where archived_at is null;

-- -----------------------------------------------------------------------------
-- 2) Trusted active-Worker limits (server-side; never from the browser)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_active_worker_limit_for_plan(p_plan_code text)
returns integer
language sql
immutable
as $$
  select case lower(trim(coalesce(p_plan_code, '')))
    when 'starter' then 20
    when 'growing' then 50
    when 'pro' then 100
    else null
  end;
$$;

comment on function public.drevora_active_worker_limit_for_plan(text) is
  'Trusted active Worker allowances for starter/growing/pro. Custom and unknown return null.';

-- -----------------------------------------------------------------------------
-- 3) Enforce on create (insert) and reactivate (archived_at cleared)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_enforce_worker_plan_allowance()
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
    -- Reactivation, or moving an active Worker into another company.
    -- Archiving and duty-status edits do not consume a seat.
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
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Worker company_id is required for plan allowance checks.';
  end if;

  -- Serialise creates/reactivations for this company (concurrency-safe).
  select c.plan_code
  into v_plan_code
  from public.companies c
  where c.id = v_company_id
  for update;

  if not found then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Company not found for Worker plan allowance check.';
  end if;

  v_limit := public.drevora_active_worker_limit_for_plan(v_plan_code);

  -- Unknown plan or Custom Fleet without a trusted numeric limit: block writes.
  if v_limit is null then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Assign a valid starter/growing/pro plan, or configure a trusted Custom Fleet limit.';
  end if;

  select count(*)::integer
  into v_active_count
  from public.drivers d
  where d.company_id = v_company_id
    and d.archived_at is null
    and (tg_op = 'INSERT' or d.id is distinct from new.id);

  if v_active_count >= v_limit then
    raise exception 'WORKER_PLAN_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = format(
              'Active Workers %s / %s. Archive an inactive Worker or change the company plan.',
              v_active_count,
              v_limit
            );
  end if;

  return new;
end;
$$;

comment on function public.drevora_enforce_worker_plan_allowance() is
  'Prevents creating or reactivating Workers above the company active-Worker plan allowance.';

drop trigger if exists drivers_enforce_worker_plan_allowance on public.drivers;
create trigger drivers_enforce_worker_plan_allowance
  before insert or update of archived_at, company_id
  on public.drivers
  for each row
  execute function public.drevora_enforce_worker_plan_allowance();

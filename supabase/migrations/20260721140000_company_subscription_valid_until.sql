-- =============================================================================
-- DREVORA — Company subscription / trial valid-until (idempotent)
-- File: supabase/migrations/20260721140000_company_subscription_valid_until.sql
-- =============================================================================
-- PURPOSE
--   Add nullable subscription_valid_until for 30-day trial/plan expiry.
--   Does not backfill existing companies (null = current behaviour, not expired).
--   New companies created via drevora_create_company_with_trial_plan get now()+30 days.
--   Vehicle/Worker create/reactivate triggers block when expired (distinct error).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Column
-- -----------------------------------------------------------------------------
alter table public.companies
  add column if not exists subscription_valid_until timestamptz;

comment on column public.companies.subscription_valid_until is
  'When the company trial/plan access for creating new Vehicles/Workers ends. NULL means no expiry is stored (existing behaviour). Compare with timestamptz now(); do not rewrite subscription_status on expiry.';

-- -----------------------------------------------------------------------------
-- 2) Protect plan columns (include valid-until) from ordinary UPDATE
-- -----------------------------------------------------------------------------
create or replace function public.drevora_protect_company_plan_columns()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if current_setting('drevora.allow_plan_write', true) is distinct from 'on' then
      new.plan_code := old.plan_code;
      new.plan_selected_at := old.plan_selected_at;
      new.trial_started_at := old.trial_started_at;
      new.subscription_status := old.subscription_status;
      new.subscription_valid_until := old.subscription_valid_until;
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) New company trial: set valid-until to now() + 30 days
-- -----------------------------------------------------------------------------
create or replace function public.drevora_create_company_with_trial_plan(
  p_company_name text,
  p_plan_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_name text := nullif(trim(coalesce(p_company_name, '')), '');
  v_plan_code text := lower(trim(coalesce(p_plan_code, '')));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_name is null or char_length(v_name) < 2 then
    raise exception 'Company name is required';
  end if;

  if char_length(v_name) > 120 then
    raise exception 'Company name is too long';
  end if;

  if v_plan_code not in ('starter', 'growing', 'pro') then
    raise exception 'Invalid plan code';
  end if;

  if exists (
    select 1
    from public.company_members cm
    where cm.user_id = v_user_id
      and cm.is_active = true
  ) then
    raise exception 'User already belongs to a company';
  end if;

  perform set_config('drevora.allow_plan_write', 'on', true);

  insert into public.companies (
    name,
    plan_code,
    plan_selected_at,
    trial_started_at,
    subscription_status,
    subscription_valid_until
  )
  values (
    v_name,
    v_plan_code,
    now(),
    now(),
    'trial',
    now() + interval '30 days'
  )
  returning id into v_company_id;

  insert into public.company_members (
    user_id,
    company_id,
    role,
    is_active
  )
  values (
    v_user_id,
    v_company_id,
    'Admin',
    true
  );

  return v_company_id;
end;
$$;

revoke all on function public.drevora_create_company_with_trial_plan(text, text) from public;
revoke all on function public.drevora_create_company_with_trial_plan(text, text) from anon;
grant execute on function public.drevora_create_company_with_trial_plan(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Vehicle create/reactivate: block when plan expired (before seat count)
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
  v_valid_until timestamptz;
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

  select c.plan_code, c.subscription_valid_until
  into v_plan_code, v_valid_until
  from public.companies c
  where c.id = v_company_id
  for update;

  if not found then
    raise exception 'VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Company not found for Vehicle plan allowance check.';
  end if;

  -- Null valid-until preserves prior behaviour (no expiry block).
  if v_valid_until is not null and now() >= v_valid_until then
    raise exception 'SUBSCRIPTION_PLAN_EXPIRED'
      using errcode = 'P0001',
            hint = format(
              'Your trial expired on %s. Existing records remain available. Contact DREVORA to renew your plan.',
              to_char(v_valid_until at time zone 'UTC', 'DD Mon YYYY')
            );
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

-- -----------------------------------------------------------------------------
-- 5) Worker create/reactivate: block when plan expired (before seat count)
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
  v_valid_until timestamptz;
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
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Worker company_id is required for plan allowance checks.';
  end if;

  select c.plan_code, c.subscription_valid_until
  into v_plan_code, v_valid_until
  from public.companies c
  where c.id = v_company_id
  for update;

  if not found then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Company not found for Worker plan allowance check.';
  end if;

  if v_valid_until is not null and now() >= v_valid_until then
    raise exception 'SUBSCRIPTION_PLAN_EXPIRED'
      using errcode = 'P0001',
            hint = format(
              'Your trial expired on %s. Existing records remain available. Contact DREVORA to renew your plan.',
              to_char(v_valid_until at time zone 'UTC', 'DD Mon YYYY')
            );
  end if;

  v_limit := public.drevora_active_worker_limit_for_plan(v_plan_code);

  if v_limit is null then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Assign a valid starter/growing/pro plan, or configure a trusted Custom Fleet Worker limit.';
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

notify pgrst, 'reload schema';

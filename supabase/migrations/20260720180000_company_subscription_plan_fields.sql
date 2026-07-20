-- Company subscription plan fields for free-trial preparation (no Stripe).
-- Idempotent. Do not invent payment/Stripe columns here.

-- -----------------------------------------------------------------------------
-- 1) Plan columns on companies
-- -----------------------------------------------------------------------------
alter table public.companies
  add column if not exists plan_code text;

alter table public.companies
  add column if not exists plan_selected_at timestamptz;

alter table public.companies
  add column if not exists trial_started_at timestamptz;

alter table public.companies
  add column if not exists subscription_status text;

alter table public.companies
  drop constraint if exists companies_plan_code_check;

alter table public.companies
  add constraint companies_plan_code_check
  check (
    plan_code is null
    or plan_code in ('starter', 'growing', 'pro', 'custom')
  );

alter table public.companies
  drop constraint if exists companies_subscription_status_check;

alter table public.companies
  add constraint companies_subscription_status_check
  check (
    subscription_status is null
    or subscription_status in ('trial')
  );

comment on column public.companies.plan_code is
  'Trusted plan code (starter|growing|pro|custom). Set via controlled onboarding RPC only.';

comment on column public.companies.plan_selected_at is
  'When the company plan was first selected during onboarding.';

comment on column public.companies.trial_started_at is
  'When the free trial period started. Payment setup is separate.';

comment on column public.companies.subscription_status is
  'Initial trial preparation status only. No Stripe/payment statuses here.';

-- -----------------------------------------------------------------------------
-- 2) Protect plan columns from ordinary office UPDATE (session GUC gate)
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
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists companies_protect_plan_columns on public.companies;
create trigger companies_protect_plan_columns
  before update on public.companies
  for each row
  execute function public.drevora_protect_company_plan_columns();

-- -----------------------------------------------------------------------------
-- 3) Create company + Admin membership with validated plan (unlinked users only)
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

  -- Reject custom and any client-invented codes. Limits are not accepted from the client.
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
    subscription_status
  )
  values (
    v_name,
    v_plan_code,
    now(),
    now(),
    'trial'
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

comment on function public.drevora_create_company_with_trial_plan(text, text) is
  'Creates a company and Admin membership for an unlinked authenticated user with a validated trial plan. No Stripe.';

revoke all on function public.drevora_create_company_with_trial_plan(text, text) from public;
revoke all on function public.drevora_create_company_with_trial_plan(text, text) from anon;
grant execute on function public.drevora_create_company_with_trial_plan(text, text) to authenticated;

-- =============================================================================
-- DREVORA — Ensure company subscription plan columns (idempotent repair)
-- File: supabase/migrations/20260721130000_ensure_company_subscription_plan_columns.sql
-- =============================================================================
-- PURPOSE
--   Live projects may be missing the subscription-plan columns added by
--   20260720180000_company_subscription_plan_fields.sql. When missing, PostgREST
--   returns 400 for:
--     plan_code, plan_selected_at, trial_started_at, subscription_status
--
--   This repair only adds those columns if absent. It does not invent or backfill
--   a subscription plan — existing companies keep NULL plan fields.
--
-- RULES
--   - ADD COLUMN IF NOT EXISTS only
--   - No destructive drops/renames
--   - No fake plan values inserted
-- =============================================================================

alter table public.companies
  add column if not exists plan_code text;

alter table public.companies
  add column if not exists plan_selected_at timestamptz;

alter table public.companies
  add column if not exists trial_started_at timestamptz;

alter table public.companies
  add column if not exists subscription_status text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_plan_code_check'
  ) then
    alter table public.companies
      add constraint companies_plan_code_check
      check (
        plan_code is null
        or plan_code in ('starter', 'growing', 'pro', 'custom')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_subscription_status_check'
  ) then
    alter table public.companies
      add constraint companies_subscription_status_check
      check (
        subscription_status is null
        or subscription_status in ('trial')
      );
  end if;
end $$;

comment on column public.companies.plan_code is
  'Trusted plan code (starter|growing|pro|custom). Set via controlled onboarding RPC only.';

comment on column public.companies.plan_selected_at is
  'When the company plan was first selected during onboarding.';

comment on column public.companies.trial_started_at is
  'When the free trial period started. Payment setup is separate.';

comment on column public.companies.subscription_status is
  'Initial trial preparation status only. No Stripe/payment statuses here.';

notify pgrst, 'reload schema';

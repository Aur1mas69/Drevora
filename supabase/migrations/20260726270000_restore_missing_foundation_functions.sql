-- =============================================================================
-- DREVORA — Restore missing foundation functions (repair, review-only)
-- File: supabase/migrations/20260726270000_restore_missing_foundation_functions.sql
-- =============================================================================
-- PURPOSE
--   The live project is missing 10 canonical foundation functions (confirmed
--   by the 20260726260000 preflight, which aborted and rolled back without
--   applying anything). This migration restores exactly those 10 functions
--   with their latest repository-canonical bodies, their canonical triggers
--   (only when absent and no equivalent exists), and their security grants.
--
-- RESTORED FUNCTIONS (latest canonical source in parentheses)
--   SECURITY DEFINER:
--     1) public.drevora_create_company_with_trial_plan(text,text)
--          (20260721140000; search_path hardened to '' — body fully qualified)
--     2) public.drevora_enforce_vehicle_plan_allowance()   (20260721140000)
--     3) public.drevora_enforce_worker_plan_allowance()    (20260721140000)
--   SECURITY INVOKER:
--     4) public.drevora_active_vehicle_limit_for_plan(text) (20260720200000)
--     5) public.drevora_active_worker_limit_for_plan(text)  (20260720190000)
--     6) public.drevora_protect_company_plan_columns()      (20260721140000)
--     7) public.drivers_set_worker_code()                   (20260705290000)
--     8) public.generate_unique_worker_code(text)           (20260705290000)
--     9) public.generate_worker_code()                      (20260705300000)
--    10) public.set_vehicle_check_template_updated_at()     (20260707204700)
--
-- NOT RECREATED (live-confirmed present):
--   public.drevora_set_updated_at()
--   public.drevora_normalize_worker_core_document_type(text)
--   public.drevora_worker_core_document_status(date)
--   public.set_contacts_updated_at()
--   public.set_documents_updated_at()
--   public.set_driver_reports_updated_at()
--
-- CANONICAL TRIGGERS (created only when absent; abort on conflicting equivalents)
--   drivers_set_worker_code_trigger            BEFORE INSERT ON public.drivers
--   drivers_enforce_worker_plan_allowance      BEFORE INSERT OR UPDATE OF archived_at, company_id ON public.drivers
--   vehicles_enforce_vehicle_plan_allowance    BEFORE INSERT OR UPDATE OF archived_at, company_id ON public.vehicles
--   companies_protect_plan_columns             BEFORE UPDATE ON public.companies
--   vehicle_check_templates_updated_at         BEFORE UPDATE ON public.vehicle_check_templates
--     (skipped with a NOTICE if an equivalent drevora_set_updated_at trigger
--      already maintains vehicle_check_templates.updated_at)
--
-- GUARANTEES
--   - One BEGIN / one COMMIT; no executable SQL after COMMIT.
--   - Idempotent (CREATE OR REPLACE + guarded trigger creation).
--   - No INSERT/UPDATE/DELETE against business tables; all rows/UUIDs preserved.
--   - No Auth users, Storage objects, RLS flags, policies or table grants touched.
--   - No tables or application columns created; aborts if prerequisites missing.
--   - All functions get a fixed search_path = '' with fully qualified bodies.
--   - Verified plan limits preserved: Workers 20/50/100, Vehicles 10/25/50.
--   - Worker-code format preserved: 5 chars, >=1 letter + >=1 digit from
--     ABCDEFGHJKLMNPQRSTUVWXYZ / 23456789; uniqueness scoped per legacy
--     drivers.company text value (coalesce(company, '')); no backfill here.
--
-- REVIEW ONLY — do not auto-apply.
-- Manual apply order: 270000 first, verify diagnostics, then re-run 260000.
-- =============================================================================

begin;

-- =============================================================================
-- 1) Preflight (abort before any mutation)
-- =============================================================================
do $$
declare
  v_tbl text;
  v_col record;
  v_fn record;
  v_expected jsonb := jsonb_build_object(
    'drevora_create_company_with_trial_plan', 'public.drevora_create_company_with_trial_plan(text,text)',
    'drevora_enforce_vehicle_plan_allowance', 'public.drevora_enforce_vehicle_plan_allowance()',
    'drevora_enforce_worker_plan_allowance', 'public.drevora_enforce_worker_plan_allowance()',
    'drevora_active_vehicle_limit_for_plan', 'public.drevora_active_vehicle_limit_for_plan(text)',
    'drevora_active_worker_limit_for_plan', 'public.drevora_active_worker_limit_for_plan(text)',
    'drevora_protect_company_plan_columns', 'public.drevora_protect_company_plan_columns()',
    'drivers_set_worker_code', 'public.drivers_set_worker_code()',
    'generate_unique_worker_code', 'public.generate_unique_worker_code(text)',
    'generate_worker_code', 'public.generate_worker_code()',
    'set_vehicle_check_template_updated_at', 'public.set_vehicle_check_template_updated_at()'
  );
  v_sig text;
  v_reg regprocedure;
begin
  -- 1a) Required tables
  foreach v_tbl in array array[
    'public.companies',
    'public.company_members',
    'public.drivers',
    'public.vehicles',
    'public.vehicle_check_templates'
  ] loop
    if to_regclass(v_tbl) is null then
      raise exception
        'DREVORA STOP 20260726270000: required table % is missing; apply its base migration first',
        v_tbl;
    end if;
  end loop;

  -- 1b) Required columns (do not create application columns in this repair)
  for v_col in
    select *
    from (values
      ('companies', 'id'),
      ('companies', 'name'),
      ('companies', 'plan_code'),
      ('companies', 'plan_selected_at'),
      ('companies', 'trial_started_at'),
      ('companies', 'subscription_status'),
      ('companies', 'subscription_valid_until'),
      ('company_members', 'user_id'),
      ('company_members', 'company_id'),
      ('company_members', 'role'),
      ('company_members', 'is_active'),
      ('drivers', 'id'),
      ('drivers', 'company'),
      ('drivers', 'company_id'),
      ('drivers', 'worker_code'),
      ('drivers', 'archived_at'),
      ('vehicles', 'id'),
      ('vehicles', 'company_id'),
      ('vehicles', 'archived_at'),
      ('vehicle_check_templates', 'updated_at')
    ) as req(tbl, col)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_attribute a
      where a.attrelid = to_regclass('public.' || v_col.tbl)
        and a.attname = v_col.col
        and a.attnum > 0
        and not a.attisdropped
    ) then
      raise exception
        'DREVORA STOP 20260726270000: required column public.%.% is missing; apply its base migration first',
        v_col.tbl, v_col.col;
    end if;
  end loop;

  -- 1c) Ambiguous overloads: every existing public function sharing one of the
  --     10 names must be exactly the audited signature.
  for v_fn in
    select p.oid,
           p.proname,
           format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) as live_sig
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and v_expected ? p.proname
  loop
    v_sig := v_expected ->> v_fn.proname;
    v_reg := to_regprocedure(v_sig);
    if v_reg is null or v_fn.oid <> v_reg::oid then
      raise exception
        'DREVORA STOP 20260726270000: unexpected overload % conflicts with audited signature %',
        v_fn.live_sig, v_sig;
    end if;
  end loop;

  -- 1d) Conflicting equivalent triggers (fail closed; never attach duplicates)
  if exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = to_regclass('public.drivers')
      and not t.tgisinternal
      and p.proname like '%plan_allowance%'
      and t.tgname <> 'drivers_enforce_worker_plan_allowance'
  ) then
    raise exception
      'DREVORA STOP 20260726270000: a non-canonical Worker plan-allowance trigger already exists on public.drivers';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = to_regclass('public.vehicles')
      and not t.tgisinternal
      and p.proname like '%plan_allowance%'
      and t.tgname <> 'vehicles_enforce_vehicle_plan_allowance'
  ) then
    raise exception
      'DREVORA STOP 20260726270000: a non-canonical Vehicle plan-allowance trigger already exists on public.vehicles';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = to_regclass('public.companies')
      and not t.tgisinternal
      and p.proname like '%protect%plan%'
      and t.tgname <> 'companies_protect_plan_columns'
  ) then
    raise exception
      'DREVORA STOP 20260726270000: a non-canonical plan-column protection trigger already exists on public.companies';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = to_regclass('public.drivers')
      and not t.tgisinternal
      and p.proname like '%worker_code%'
      and t.tgname <> 'drivers_set_worker_code_trigger'
  ) then
    raise exception
      'DREVORA STOP 20260726270000: a non-canonical worker-code trigger already exists on public.drivers';
  end if;

  -- Canonical trigger names must not already point at a different function.
  for v_fn in
    select t.tgname, p.proname
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
    where not t.tgisinternal
      and (
        (t.tgrelid = to_regclass('public.drivers')
          and t.tgname = 'drivers_enforce_worker_plan_allowance'
          and p.proname <> 'drevora_enforce_worker_plan_allowance')
        or (t.tgrelid = to_regclass('public.drivers')
          and t.tgname = 'drivers_set_worker_code_trigger'
          and p.proname <> 'drivers_set_worker_code')
        or (t.tgrelid = to_regclass('public.vehicles')
          and t.tgname = 'vehicles_enforce_vehicle_plan_allowance'
          and p.proname <> 'drevora_enforce_vehicle_plan_allowance')
        or (t.tgrelid = to_regclass('public.companies')
          and t.tgname = 'companies_protect_plan_columns'
          and p.proname <> 'drevora_protect_company_plan_columns')
        or (t.tgrelid = to_regclass('public.vehicle_check_templates')
          and t.tgname = 'vehicle_check_templates_updated_at'
          and p.proname not in ('set_vehicle_check_template_updated_at', 'drevora_set_updated_at'))
      )
  loop
    raise exception
      'DREVORA STOP 20260726270000: trigger % already exists but calls unexpected function %',
      v_fn.tgname, v_fn.proname;
  end loop;
end;
$$;

-- =============================================================================
-- 2) Worker-code generation (SECURITY INVOKER)
--    Canonical: 20260705290000 + 20260705300000 (mixed-alphanumeric format),
--    with the repository-pinned fixed search_path = ''.
--    Format: 5 chars, at least one letter + one digit, alphabet without
--    ambiguous 0/O/1/I. Uniqueness scope: per legacy drivers.company text
--    value via coalesce(company, ''). No backfill and no code rewrites here.
-- =============================================================================
create or replace function public.generate_worker_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  digits constant text := '23456789';
  chars text[] := array[]::text[];
  result text;
begin
  chars := array[
    substr(letters, 1 + floor(random() * length(letters))::int, 1),
    substr(digits, 1 + floor(random() * length(digits))::int, 1)
  ];

  while coalesce(array_length(chars, 1), 0) < 5 loop
    if random() < 0.5 then
      chars := array_append(
        chars,
        substr(letters, 1 + floor(random() * length(letters))::int, 1)
      );
    else
      chars := array_append(
        chars,
        substr(digits, 1 + floor(random() * length(digits))::int, 1)
      );
    end if;
  end loop;

  select string_agg(ch, '' order by random())
  into result
  from unnest(chars) as ch;

  return result;
end;
$$;

comment on function public.generate_worker_code() is
  'Generates a 5-char Worker code with at least one letter and one digit (no ambiguous 0/O/1/I).';

create or replace function public.generate_unique_worker_code(p_company text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  candidate text;
  attempts int := 0;
begin
  loop
    candidate := public.generate_worker_code();
    if not exists (
      select 1
      from public.drivers d
      where coalesce(d.company, '') = coalesce(p_company, '')
        and d.worker_code = candidate
    ) then
      return candidate;
    end if;
    attempts := attempts + 1;
    if attempts >= 100 then
      raise exception 'Could not generate unique worker_code for company after 100 attempts';
    end if;
  end loop;
end;
$$;

comment on function public.generate_unique_worker_code(text) is
  'Returns a Worker code unique within the legacy drivers.company text scope.';

create or replace function public.drivers_set_worker_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.worker_code is null or btrim(new.worker_code) = '' then
    new.worker_code := public.generate_unique_worker_code(new.company);
  end if;
  return new;
end;
$$;

comment on function public.drivers_set_worker_code() is
  'BEFORE INSERT trigger helper: assigns a unique Worker code when none is provided.';

-- =============================================================================
-- 3) Vehicle Check template updated_at (SECURITY INVOKER)
--    Canonical: 20260707204700. Relation-free NEW.updated_at assignment only.
-- =============================================================================
create or replace function public.set_vehicle_check_template_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_vehicle_check_template_updated_at() is
  'BEFORE UPDATE trigger helper: maintains vehicle_check_templates.updated_at.';

-- =============================================================================
-- 4) Company plan-column protection (SECURITY INVOKER)
--    Canonical: 20260721140000 (includes subscription_valid_until).
--    Trusted-writer mechanism: session GUC drevora.allow_plan_write = 'on',
--    set only by trusted server/database workflows (e.g. the trial RPC below).
-- =============================================================================
create or replace function public.drevora_protect_company_plan_columns()
returns trigger
language plpgsql
set search_path = ''
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

comment on function public.drevora_protect_company_plan_columns() is
  'Reverts ordinary UPDATEs to protected subscription/plan columns unless the trusted drevora.allow_plan_write GUC is on.';

-- =============================================================================
-- 5) Trusted plan limits (SECURITY INVOKER, IMMUTABLE)
--    Canonical: 20260720190000 / 20260720200000.
--    Workers: starter 20, growing 50, pro 100. Vehicles: starter 10,
--    growing 25, pro 50. Custom/unknown return null (blocked upstream).
-- =============================================================================
create or replace function public.drevora_active_worker_limit_for_plan(p_plan_code text)
returns integer
language sql
immutable
set search_path = ''
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

create or replace function public.drevora_active_vehicle_limit_for_plan(p_plan_code text)
returns integer
language sql
immutable
set search_path = ''
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

-- =============================================================================
-- 6) Plan allowance enforcement (SECURITY DEFINER, internal trigger-only)
--    Canonical: 20260721140000 (expiry-aware). Locks the company row
--    (FOR UPDATE) to serialise creates/reactivations; counts only rows with
--    archived_at IS NULL in the same company. Bodies fully schema-qualified;
--    search_path hardened to '' (pg_catalog builtins remain available).
-- =============================================================================
create or replace function public.drevora_enforce_worker_plan_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
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

comment on function public.drevora_enforce_worker_plan_allowance() is
  'Prevents creating or reactivating Workers above the company active-Worker plan allowance.';

create or replace function public.drevora_enforce_vehicle_plan_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
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

comment on function public.drevora_enforce_vehicle_plan_allowance() is
  'Prevents creating or reactivating Vehicles above the company active-Vehicle plan allowance.';

-- =============================================================================
-- 7) Trial company creation RPC (SECURITY DEFINER, authenticated allowlist)
--    Canonical: 20260721140000. Returns uuid (companyPlanService expects the
--    new company id as a string). Verifies auth.uid(), rejects users already
--    holding an active membership (cannot create/mutate another user's
--    company), validates starter/growing/pro only, sets the 30-day trial
--    valid-until, and uses the trusted GUC for the protected plan columns.
-- =============================================================================
create or replace function public.drevora_create_company_with_trial_plan(
  p_company_name text,
  p_plan_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
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

comment on function public.drevora_create_company_with_trial_plan(text, text) is
  'Creates a company and Admin membership for an unlinked authenticated user with a validated trial plan. No Stripe.';

-- =============================================================================
-- 8) EXECUTE privileges (matches the 20260726260000 hardening model)
-- =============================================================================

-- Authenticated RPC: trial company creation only.
revoke all on function public.drevora_create_company_with_trial_plan(text, text) from public;
revoke all on function public.drevora_create_company_with_trial_plan(text, text) from anon;
grant execute on function public.drevora_create_company_with_trial_plan(text, text) to authenticated;
grant execute on function public.drevora_create_company_with_trial_plan(text, text) to service_role;

-- Worker-code helpers: authenticated needed for the INVOKER trigger call chain
-- (drivers_set_worker_code runs as the inserting role and calls these).
revoke all on function public.generate_worker_code() from public;
revoke all on function public.generate_worker_code() from anon;
grant execute on function public.generate_worker_code() to authenticated;
grant execute on function public.generate_worker_code() to service_role;

revoke all on function public.generate_unique_worker_code(text) from public;
revoke all on function public.generate_unique_worker_code(text) from anon;
grant execute on function public.generate_unique_worker_code(text) to authenticated;
grant execute on function public.generate_unique_worker_code(text) to service_role;

-- Internal trigger/limit helpers: no client EXECUTE (not frontend RPCs).
revoke all on function public.drivers_set_worker_code() from public;
revoke all on function public.drivers_set_worker_code() from anon;
revoke all on function public.drivers_set_worker_code() from authenticated;
grant execute on function public.drivers_set_worker_code() to service_role;

revoke all on function public.set_vehicle_check_template_updated_at() from public;
revoke all on function public.set_vehicle_check_template_updated_at() from anon;
revoke all on function public.set_vehicle_check_template_updated_at() from authenticated;
grant execute on function public.set_vehicle_check_template_updated_at() to service_role;

revoke all on function public.drevora_protect_company_plan_columns() from public;
revoke all on function public.drevora_protect_company_plan_columns() from anon;
revoke all on function public.drevora_protect_company_plan_columns() from authenticated;
grant execute on function public.drevora_protect_company_plan_columns() to service_role;

revoke all on function public.drevora_active_worker_limit_for_plan(text) from public;
revoke all on function public.drevora_active_worker_limit_for_plan(text) from anon;
revoke all on function public.drevora_active_worker_limit_for_plan(text) from authenticated;
grant execute on function public.drevora_active_worker_limit_for_plan(text) to service_role;

revoke all on function public.drevora_active_vehicle_limit_for_plan(text) from public;
revoke all on function public.drevora_active_vehicle_limit_for_plan(text) from anon;
revoke all on function public.drevora_active_vehicle_limit_for_plan(text) from authenticated;
grant execute on function public.drevora_active_vehicle_limit_for_plan(text) to service_role;

revoke all on function public.drevora_enforce_worker_plan_allowance() from public;
revoke all on function public.drevora_enforce_worker_plan_allowance() from anon;
revoke all on function public.drevora_enforce_worker_plan_allowance() from authenticated;
grant execute on function public.drevora_enforce_worker_plan_allowance() to service_role;

revoke all on function public.drevora_enforce_vehicle_plan_allowance() from public;
revoke all on function public.drevora_enforce_vehicle_plan_allowance() from anon;
revoke all on function public.drevora_enforce_vehicle_plan_allowance() from authenticated;
grant execute on function public.drevora_enforce_vehicle_plan_allowance() to service_role;

-- =============================================================================
-- 9) Canonical triggers (create only when absent; preflight already rejected
--    conflicting equivalents)
-- =============================================================================
do $$
begin
  -- 9a) Worker-code assignment (canonical: 20260705290000)
  if not exists (
    select 1
    from pg_catalog.pg_trigger t
    where t.tgrelid = to_regclass('public.drivers')
      and not t.tgisinternal
      and t.tgname = 'drivers_set_worker_code_trigger'
  ) then
    create trigger drivers_set_worker_code_trigger
      before insert on public.drivers
      for each row
      execute function public.drivers_set_worker_code();
    raise notice 'DREVORA 20260726270000: created trigger drivers_set_worker_code_trigger on public.drivers';
  end if;

  -- 9b) Worker plan allowance (canonical: 20260720190000)
  if not exists (
    select 1
    from pg_catalog.pg_trigger t
    where t.tgrelid = to_regclass('public.drivers')
      and not t.tgisinternal
      and t.tgname = 'drivers_enforce_worker_plan_allowance'
  ) then
    create trigger drivers_enforce_worker_plan_allowance
      before insert or update of archived_at, company_id
      on public.drivers
      for each row
      execute function public.drevora_enforce_worker_plan_allowance();
    raise notice 'DREVORA 20260726270000: created trigger drivers_enforce_worker_plan_allowance on public.drivers';
  end if;

  -- 9c) Vehicle plan allowance (canonical: 20260720200000)
  if not exists (
    select 1
    from pg_catalog.pg_trigger t
    where t.tgrelid = to_regclass('public.vehicles')
      and not t.tgisinternal
      and t.tgname = 'vehicles_enforce_vehicle_plan_allowance'
  ) then
    create trigger vehicles_enforce_vehicle_plan_allowance
      before insert or update of archived_at, company_id
      on public.vehicles
      for each row
      execute function public.drevora_enforce_vehicle_plan_allowance();
    raise notice 'DREVORA 20260726270000: created trigger vehicles_enforce_vehicle_plan_allowance on public.vehicles';
  end if;

  -- 9d) Plan-column protection (canonical: 20260720180000)
  if not exists (
    select 1
    from pg_catalog.pg_trigger t
    where t.tgrelid = to_regclass('public.companies')
      and not t.tgisinternal
      and t.tgname = 'companies_protect_plan_columns'
  ) then
    create trigger companies_protect_plan_columns
      before update on public.companies
      for each row
      execute function public.drevora_protect_company_plan_columns();
    raise notice 'DREVORA 20260726270000: created trigger companies_protect_plan_columns on public.companies';
  end if;

  -- 9e) Vehicle Check template updated_at (canonical: 20260707204700).
  --     If an equivalent drevora_set_updated_at() trigger already maintains
  --     updated_at on this table, keep it and do not attach a second trigger.
  if exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = to_regclass('public.vehicle_check_templates')
      and not t.tgisinternal
      and p.proname = 'drevora_set_updated_at'
  ) then
    raise notice
      'DREVORA 20260726270000: public.vehicle_check_templates already maintains updated_at via drevora_set_updated_at(); canonical trigger not attached (function restored for migration compatibility only)';
  elsif not exists (
    select 1
    from pg_catalog.pg_trigger t
    where t.tgrelid = to_regclass('public.vehicle_check_templates')
      and not t.tgisinternal
      and t.tgname = 'vehicle_check_templates_updated_at'
  ) then
    create trigger vehicle_check_templates_updated_at
      before update on public.vehicle_check_templates
      for each row
      execute function public.set_vehicle_check_template_updated_at();
    raise notice 'DREVORA 20260726270000: created trigger vehicle_check_templates_updated_at on public.vehicle_check_templates';
  end if;
end;
$$;

-- =============================================================================
-- 10) In-transaction assertions (abort = full rollback)
-- =============================================================================
do $$
declare
  r record;
  v_oid oid;
  v_count integer;
begin
  -- 10a) All 10 signatures resolve with the expected security mode,
  --      language, return type, volatility and a fixed search_path.
  for r in
    select *
    from (values
      ('public.drevora_create_company_with_trial_plan(text,text)', true,  'plpgsql', 'uuid',    'v'),
      ('public.drevora_enforce_worker_plan_allowance()',           true,  'plpgsql', 'trigger', 'v'),
      ('public.drevora_enforce_vehicle_plan_allowance()',          true,  'plpgsql', 'trigger', 'v'),
      ('public.drevora_active_worker_limit_for_plan(text)',        false, 'sql',     'integer', 'i'),
      ('public.drevora_active_vehicle_limit_for_plan(text)',       false, 'sql',     'integer', 'i'),
      ('public.drevora_protect_company_plan_columns()',            false, 'plpgsql', 'trigger', 'v'),
      ('public.drivers_set_worker_code()',                         false, 'plpgsql', 'trigger', 'v'),
      ('public.generate_unique_worker_code(text)',                 false, 'plpgsql', 'text',    'v'),
      ('public.generate_worker_code()',                            false, 'plpgsql', 'text',    'v'),
      ('public.set_vehicle_check_template_updated_at()',           false, 'plpgsql', 'trigger', 'v')
    ) as exp(sig, is_definer, lang, ret, volat)
  loop
    if to_regprocedure(r.sig) is null then
      raise exception
        'DREVORA STOP 20260726270000: % was not restored', r.sig;
    end if;
    v_oid := to_regprocedure(r.sig)::oid;

    perform 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_language l on l.oid = p.prolang
    where p.oid = v_oid
      and p.prosecdef = r.is_definer
      and l.lanname = r.lang
      and pg_catalog.format_type(p.prorettype, null) =
          case r.ret when 'trigger' then 'trigger' else r.ret end
      and p.provolatile = r.volat
      and exists (
        select 1
        from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
        where cfg like 'search_path=%'
      );
    if not found then
      raise exception
        'DREVORA STOP 20260726270000: % restored with unexpected mode/lang/return/volatility/search_path', r.sig;
    end if;

    -- 10b) ACLs: PUBLIC and anon must have no effective EXECUTE anywhere.
    if exists (
      select 1
      from pg_catalog.pg_proc p
      cross join lateral pg_catalog.aclexplode(
        coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
      ) acl
      where p.oid = v_oid
        and acl.privilege_type = 'EXECUTE'
        and acl.grantee = 0
    ) then
      raise exception
        'DREVORA STOP 20260726270000: PUBLIC EXECUTE remains on %', r.sig;
    end if;
    if has_function_privilege('anon', v_oid, 'execute') then
      raise exception
        'DREVORA STOP 20260726270000: anon EXECUTE remains on %', r.sig;
    end if;

    -- authenticated: allowed only on the trial RPC and worker-code helpers.
    if r.sig in (
      'public.drevora_create_company_with_trial_plan(text,text)',
      'public.generate_worker_code()',
      'public.generate_unique_worker_code(text)'
    ) then
      if not has_function_privilege('authenticated', v_oid, 'execute') then
        raise exception
          'DREVORA STOP 20260726270000: authenticated lost required EXECUTE on %', r.sig;
      end if;
    else
      if has_function_privilege('authenticated', v_oid, 'execute') then
        raise exception
          'DREVORA STOP 20260726270000: authenticated must not EXECUTE internal helper %', r.sig;
      end if;
    end if;

    if not has_function_privilege('service_role', v_oid, 'execute') then
      raise exception
        'DREVORA STOP 20260726270000: service_role EXECUTE missing on %', r.sig;
    end if;
  end loop;

  -- 10c) Exact plan limits stay verified.
  if public.drevora_active_worker_limit_for_plan('starter') is distinct from 20
     or public.drevora_active_worker_limit_for_plan('growing') is distinct from 50
     or public.drevora_active_worker_limit_for_plan('pro') is distinct from 100
     or public.drevora_active_worker_limit_for_plan('custom') is not null then
    raise exception
      'DREVORA STOP 20260726270000: Worker plan limits are not 20/50/100 (custom null)';
  end if;
  if public.drevora_active_vehicle_limit_for_plan('starter') is distinct from 10
     or public.drevora_active_vehicle_limit_for_plan('growing') is distinct from 25
     or public.drevora_active_vehicle_limit_for_plan('pro') is distinct from 50
     or public.drevora_active_vehicle_limit_for_plan('custom') is not null then
    raise exception
      'DREVORA STOP 20260726270000: Vehicle plan limits are not 10/25/50 (custom null)';
  end if;

  -- 10d) Canonical triggers exist exactly once, enabled, correct shape.
  for r in
    select *
    from (values
      ('public.drivers',   'drivers_set_worker_code_trigger',         'drivers_set_worker_code',
        '%before insert on public.drivers%'),
      ('public.drivers',   'drivers_enforce_worker_plan_allowance',   'drevora_enforce_worker_plan_allowance',
        '%before insert or update of archived_at, company_id on public.drivers%'),
      ('public.vehicles',  'vehicles_enforce_vehicle_plan_allowance', 'drevora_enforce_vehicle_plan_allowance',
        '%before insert or update of archived_at, company_id on public.vehicles%'),
      ('public.companies', 'companies_protect_plan_columns',          'drevora_protect_company_plan_columns',
        '%before update on public.companies%')
    ) as exp(tbl, tgname, fn, defpattern)
  loop
    select count(*) into v_count
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = to_regclass(r.tbl)
      and not t.tgisinternal
      and t.tgname = r.tgname
      and p.proname = r.fn
      and t.tgenabled = 'O'
      and lower(pg_catalog.pg_get_triggerdef(t.oid)) like r.defpattern;
    if v_count <> 1 then
      raise exception
        'DREVORA STOP 20260726270000: expected exactly one enabled trigger % on % calling %; found %',
        r.tgname, r.tbl, r.fn, v_count;
    end if;
  end loop;

  -- 10e) vehicle_check_templates: exactly one updated_at maintenance trigger
  --      (either the canonical one or an equivalent drevora_set_updated_at).
  select count(*) into v_count
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_proc p on p.oid = t.tgfoid
  where t.tgrelid = to_regclass('public.vehicle_check_templates')
    and not t.tgisinternal
    and t.tgenabled = 'O'
    and p.proname in ('set_vehicle_check_template_updated_at', 'drevora_set_updated_at');
  if v_count <> 1 then
    raise exception
      'DREVORA STOP 20260726270000: expected exactly one updated_at trigger on public.vehicle_check_templates; found %',
      v_count;
  end if;

  -- 10f) No duplicate plan-allowance or worker-code triggers anywhere on the
  --      affected tables.
  select count(*) into v_count
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal
    and t.tgrelid in (to_regclass('public.drivers'), to_regclass('public.vehicles'))
    and p.proname like '%plan_allowance%';
  if v_count <> 2 then
    raise exception
      'DREVORA STOP 20260726270000: expected exactly 2 plan-allowance triggers (drivers + vehicles); found %',
      v_count;
  end if;

  select count(*) into v_count
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal
    and t.tgrelid = to_regclass('public.drivers')
    and p.proname like '%worker_code%';
  if v_count <> 1 then
    raise exception
      'DREVORA STOP 20260726270000: expected exactly 1 worker-code trigger on public.drivers; found %',
      v_count;
  end if;

  raise notice
    'DREVORA 20260726270000 OK: 10 foundation functions restored (3 DEFINER + 7 INVOKER); canonical triggers verified; plan limits 20/50/100 and 10/25/50 confirmed; no rows changed';
end;
$$;

-- Restored RPC signature must be visible to PostgREST.
notify pgrst, 'reload schema';

commit;

-- =============================================================================
-- POST-APPLY DIAGNOSTICS (read-only — copy/run manually after apply)
-- All statements below are complete and runnable. Uncomment a block to run it.
-- =============================================================================
--
-- -----------------------------------------------------------------------------
-- 1+2+3+4) All 10 signatures: PRESENT, security mode, language, return type,
--          volatility and fixed search_path
-- -----------------------------------------------------------------------------
-- with expected(sig, expect_definer) as (
--   values
--     ('public.drevora_create_company_with_trial_plan(text,text)', true),
--     ('public.drevora_enforce_vehicle_plan_allowance()', true),
--     ('public.drevora_enforce_worker_plan_allowance()', true),
--     ('public.drevora_active_vehicle_limit_for_plan(text)', false),
--     ('public.drevora_active_worker_limit_for_plan(text)', false),
--     ('public.drevora_protect_company_plan_columns()', false),
--     ('public.drivers_set_worker_code()', false),
--     ('public.generate_unique_worker_code(text)', false),
--     ('public.generate_worker_code()', false),
--     ('public.set_vehicle_check_template_updated_at()', false)
-- )
-- select
--   e.sig,
--   case when p.oid is null then 'MISSING' else 'PRESENT' end as presence,
--   case when p.oid is null then null
--        when p.prosecdef then 'DEFINER' else 'INVOKER' end as security_mode,
--   e.expect_definer,
--   l.lanname as language,
--   pg_catalog.format_type(p.prorettype, null) as return_type,
--   p.provolatile as volatility,
--   p.proconfig
-- from expected e
-- left join pg_catalog.pg_proc p on p.oid = to_regprocedure(e.sig)
-- left join pg_catalog.pg_language l on l.oid = p.prolang
-- order by e.sig;
-- -- Expect: all PRESENT; DEFINER matches expect_definer; every row has a
-- -- search_path entry in proconfig; limit fns are language sql, volatility i.
--
-- -----------------------------------------------------------------------------
-- 5+6+7) EXECUTE matrix for the 10 restored functions
-- -----------------------------------------------------------------------------
-- with expected(sig) as (
--   values
--     ('public.drevora_create_company_with_trial_plan(text,text)'),
--     ('public.drevora_enforce_vehicle_plan_allowance()'),
--     ('public.drevora_enforce_worker_plan_allowance()'),
--     ('public.drevora_active_vehicle_limit_for_plan(text)'),
--     ('public.drevora_active_worker_limit_for_plan(text)'),
--     ('public.drevora_protect_company_plan_columns()'),
--     ('public.drivers_set_worker_code()'),
--     ('public.generate_unique_worker_code(text)'),
--     ('public.generate_worker_code()'),
--     ('public.set_vehicle_check_template_updated_at()')
-- )
-- select
--   e.sig,
--   exists (
--     select 1
--     from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
--     where acl.privilege_type = 'EXECUTE' and acl.grantee = 0
--   ) as public_exec,
--   has_function_privilege('anon', p.oid, 'execute') as anon_exec,
--   has_function_privilege('authenticated', p.oid, 'execute') as authenticated_exec,
--   has_function_privilege('service_role', p.oid, 'execute') as service_role_exec
-- from expected e
-- join pg_catalog.pg_proc p on p.oid = to_regprocedure(e.sig)
-- order by e.sig;
-- -- Expect: public_exec=false, anon_exec=false everywhere;
-- -- authenticated_exec=true ONLY for drevora_create_company_with_trial_plan,
-- -- generate_worker_code, generate_unique_worker_code; service_role_exec=true.
--
-- -----------------------------------------------------------------------------
-- 8+9) Exact plan limits
-- -----------------------------------------------------------------------------
-- select
--   public.drevora_active_worker_limit_for_plan('starter')  as workers_starter,   -- 20
--   public.drevora_active_worker_limit_for_plan('growing')  as workers_growing,   -- 50
--   public.drevora_active_worker_limit_for_plan('pro')      as workers_pro,       -- 100
--   public.drevora_active_worker_limit_for_plan('custom')   as workers_custom,    -- null
--   public.drevora_active_vehicle_limit_for_plan('starter') as vehicles_starter,  -- 10
--   public.drevora_active_vehicle_limit_for_plan('growing') as vehicles_growing,  -- 25
--   public.drevora_active_vehicle_limit_for_plan('pro')     as vehicles_pro,      -- 50
--   public.drevora_active_vehicle_limit_for_plan('custom')  as vehicles_custom;   -- null
--
-- -----------------------------------------------------------------------------
-- 10) Active seat counts exclude archived rows (read-only sanity)
-- -----------------------------------------------------------------------------
-- select
--   count(*) filter (where archived_at is null)     as active_workers,
--   count(*) filter (where archived_at is not null) as archived_workers
-- from public.drivers;
--
-- select
--   count(*) filter (where archived_at is null)     as active_vehicles,
--   count(*) filter (where archived_at is not null) as archived_vehicles
-- from public.vehicles;
--
-- -----------------------------------------------------------------------------
-- 11+12) Canonical triggers exist exactly once, enabled, no duplicates
-- -----------------------------------------------------------------------------
-- select c.relname as table_name,
--        t.tgname,
--        p.proname as function_name,
--        t.tgenabled,
--        pg_catalog.pg_get_triggerdef(t.oid) as definition
-- from pg_catalog.pg_trigger t
-- join pg_catalog.pg_class c on c.oid = t.tgrelid
-- join pg_catalog.pg_namespace n on n.oid = c.relnamespace
-- join pg_catalog.pg_proc p on p.oid = t.tgfoid
-- where n.nspname = 'public'
--   and not t.tgisinternal
--   and c.relname in ('drivers', 'vehicles', 'companies', 'vehicle_check_templates')
--   and p.proname in (
--     'drivers_set_worker_code',
--     'drevora_enforce_worker_plan_allowance',
--     'drevora_enforce_vehicle_plan_allowance',
--     'drevora_protect_company_plan_columns',
--     'set_vehicle_check_template_updated_at',
--     'drevora_set_updated_at'
--   )
-- order by c.relname, t.tgname;
-- -- Expect exactly:
-- --   companies:               companies_protect_plan_columns (tgenabled O)
-- --   drivers:                 drivers_enforce_worker_plan_allowance,
-- --                            drivers_set_worker_code_trigger
-- --   vehicles:                vehicles_enforce_vehicle_plan_allowance
-- --   vehicle_check_templates: exactly one updated_at trigger
-- --     (vehicle_check_templates_updated_at OR an equivalent
-- --      drevora_set_updated_at trigger — never both)
--
-- -----------------------------------------------------------------------------
-- 13) Trial RPC signature matches companyPlanService
--     (rpc name + named args p_company_name/p_plan_code, returns uuid)
-- -----------------------------------------------------------------------------
-- select p.proname,
--        pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_args,
--        pg_catalog.pg_get_function_arguments(p.oid) as named_args,
--        pg_catalog.format_type(p.prorettype, null) as return_type
-- from pg_catalog.pg_proc p
-- join pg_catalog.pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname = 'drevora_create_company_with_trial_plan';
-- -- Expect: named_args = 'p_company_name text, p_plan_code text', return uuid.
--
-- -----------------------------------------------------------------------------
-- 14) No business rows were modified (compare before/after apply)
-- -----------------------------------------------------------------------------
-- select 'companies'::text as t, count(*)::bigint as n from public.companies
-- union all select 'company_members', count(*) from public.company_members
-- union all select 'drivers', count(*) from public.drivers
-- union all select 'vehicles', count(*) from public.vehicles
-- union all select 'vehicle_check_templates', count(*) from public.vehicle_check_templates;
--
-- select count(*) as workers_missing_code
-- from public.drivers
-- where worker_code is null or btrim(worker_code) = '';
-- -- Expect the same value before and after apply (no backfill performed).
--
-- -----------------------------------------------------------------------------
-- 15) RLS flags unchanged on affected tables
-- -----------------------------------------------------------------------------
-- select c.relname, c.relrowsecurity, c.relforcerowsecurity
-- from pg_catalog.pg_class c
-- join pg_catalog.pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relkind = 'r'
--   and c.relname in ('companies', 'company_members', 'drivers', 'vehicles', 'vehicle_check_templates')
-- order by 1;
-- -- Compare with the pre-apply snapshot; values must be identical.
--
-- -----------------------------------------------------------------------------
-- Manual apply order:
--   1) Apply 20260726270000 (this file); run the diagnostics above.
--   2) Re-run 20260726260000 (function-security hardening); its preflight
--      should now resolve all 65 supported DEFINER signatures.
--   3) Refresh Supabase Security Advisor.
--   4) Product smoke tests: company onboarding with trial plan, Worker
--      create (worker_code assigned), Vehicle create, archive/restore,
--      Vehicle Check template edit (updated_at maintained).
-- =============================================================================

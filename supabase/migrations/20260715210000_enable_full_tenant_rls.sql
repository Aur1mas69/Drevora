-- =============================================================================
-- DREVORA Phase 3 — Enable full multi-tenant RLS
-- File: supabase/migrations/20260715210000_enable_full_tenant_rls.sql
-- =============================================================================
-- REVIEW ONLY — do not apply until approved. Do not run automatically.
--
-- Goals:
--   1) Fail-closed auth helpers (exact-one membership; exact-one Worker email link)
--   2) Enable RLS on all private tenant-owned application tables
--   3) Replace obsolete / permissive / company-text / oldest-company policies
--   4) Revoke anon access; grant authenticated only required DML
--   5) Office roles manage same-company data; workers get minimum self-service
--   6) Child tables scoped via verified parents; FK tenant consistency on write
--   7) company_id NULL legacy rows remain stored but invisible/unwritable via clients
--   8) SECURITY INVOKER triggers enforce Worker column/transition restrictions
--   9) company_id changes blocked for authenticated via RLS; trusted repair remains possible
--
-- PRODUCT COMPATIBILITY NOTE (Vehicle Checks):
--   Worker writes are allowed only while status is Pending/In Progress and unsigned.
--   App create flow must be: In Progress → items (+ photos) → signature upload →
--   one final parent UPDATE to Completed with signed_at / completion fields.
--   No item writes after Completed. Do not loosen these rules for a completion window.
--
-- Does NOT:
--   - Modify Storage bucket policies (deferred)
--   - Delete / reassign / backfill business rows
--   - Set company_id NOT NULL
--   - Use FORCE ROW LEVEL SECURITY
--   - Trust company text, oldest company, sessionStorage, or raw_user_meta_data
--   - Install unconditional company_id immutability triggers
--   - Treat missing JWT identity as trusted (fail closed unless verified DB role)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0) Preflight — fail closed before any policy/grant mutation
--    Assert only columns that exist on the verified live schema.
-- -----------------------------------------------------------------------------
do $$
declare
  missing text[] := array[]::text[];
  required_tables text[] := array[
    'companies',
    'company_members',
    'drivers',
    'vehicles',
    'timesheets',
    'timesheet_entries',
    'holiday_requests',
    'vehicle_checks',
    'vehicle_check_items',
    'driver_reports',
    'documents',
    'contacts',
    'consumables',
    'vehicle_availability',
    'worker_compliance_records',
    'vehicle_compliance_records',
    'vehicle_check_templates',
    'vehicle_check_template_items',
    'dashboard_notes'
  ];
  -- table.column pairs that this migration references
  required_columns text[][] := array[
    array['companies', 'id'],
    array['company_members', 'user_id'],
    array['company_members', 'company_id'],
    array['company_members', 'role'],
    array['company_members', 'is_active'],
    array['drivers', 'id'],
    array['drivers', 'company_id'],
    array['drivers', 'email'],
    array['drivers', 'default_vehicle_id'],
    array['vehicles', 'id'],
    array['vehicles', 'company_id'],
    array['vehicles', 'current_driver_id'],
    array['timesheets', 'id'],
    array['timesheets', 'company_id'],
    array['timesheets', 'driver_id'],
    array['timesheets', 'vehicle_id'],
    array['timesheet_entries', 'id'],
    array['timesheet_entries', 'timesheet_id'],
    array['holiday_requests', 'id'],
    array['holiday_requests', 'company_id'],
    array['holiday_requests', 'worker_id'],
    array['vehicle_checks', 'id'],
    array['vehicle_checks', 'company_id'],
    array['vehicle_checks', 'vehicle_id'],
    array['vehicle_checks', 'worker_id'],
    array['vehicle_check_items', 'id'],
    array['vehicle_check_items', 'vehicle_check_id'],
    array['driver_reports', 'id'],
    array['driver_reports', 'company_id'],
    array['driver_reports', 'worker_id'],
    array['driver_reports', 'vehicle_id'],
    array['documents', 'id'],
    array['documents', 'company_id'],
    array['documents', 'worker_id'],
    array['documents', 'vehicle_id'],
    array['contacts', 'id'],
    array['contacts', 'company_id'],
    array['consumables', 'id'],
    array['consumables', 'company_id'],
    array['consumables', 'worker_id'],
    array['consumables', 'vehicle_id'],
    array['vehicle_availability', 'id'],
    array['vehicle_availability', 'vehicle_id'],
    array['worker_compliance_records', 'id'],
    array['worker_compliance_records', 'worker_id'],
    array['vehicle_compliance_records', 'id'],
    array['vehicle_compliance_records', 'vehicle_id'],
    array['vehicle_check_templates', 'id'],
    array['vehicle_check_templates', 'company_id'],
    array['vehicle_check_templates', 'is_active'],
    array['vehicle_check_template_items', 'id'],
    array['vehicle_check_template_items', 'template_id'],
    array['dashboard_notes', 'id'],
    array['dashboard_notes', 'company_id'],
    array['timesheets', 'status'],
    array['timesheets', 'notes'],
    array['timesheets', 'week_start'],
    array['timesheets', 'bonus_amount'],
    array['timesheets', 'submitted_at'],
    array['timesheets', 'approved_at'],
    array['timesheets', 'rejected_at'],
    array['timesheets', 'deleted_at'],
    array['timesheets', 'deleted_by'],
    array['timesheets', 'delete_reason'],
    array['timesheets', 'cleaned_at'],
    array['timesheet_entries', 'deleted_at'],
    array['timesheet_entries', 'deleted_by'],
    array['timesheet_entries', 'delete_reason'],
    array['holiday_requests', 'status'],
    array['holiday_requests', 'manager_note'],
    array['holiday_requests', 'leave_type'],
    array['holiday_requests', 'is_paid_leave'],
    array['holiday_requests', 'holiday_days_deducted'],
    array['holiday_requests', 'calendar_days_total'],
    array['holiday_requests', 'non_working_days_excluded'],
    array['holiday_requests', 'total_days'],
    array['holiday_requests', 'start_date'],
    array['holiday_requests', 'end_date'],
    array['holiday_requests', 'reason'],
    array['driver_reports', 'status'],
    array['driver_reports', 'priority'],
    array['driver_reports', 'office_notes'],
    array['driver_reports', 'cleaned_at'],
    array['driver_reports', 'title'],
    array['driver_reports', 'report_type'],
    array['vehicle_checks', 'status'],
    array['vehicle_checks', 'overall_result'],
    array['vehicle_checks', 'odometer'],
    array['vehicle_checks', 'notes'],
    array['vehicle_checks', 'signature_url'],
    array['vehicle_checks', 'signed_at'],
    array['vehicle_checks', 'inspection_started_at'],
    array['vehicle_checks', 'inspection_completed_at'],
    array['vehicle_checks', 'duration_seconds'],
    array['consumables', 'deleted_at'],
    array['consumables', 'deleted_by'],
    array['consumables', 'delete_reason'],
    array['consumables', 'cleaned_at'],
    array['consumables', 'consumable_type'],
    array['consumables', 'quantity'],
    array['consumables', 'entry_date'],
    array['companies', 'holiday_counting_method'],
    array['companies', 'holiday_working_days'],
    array['drivers', 'paid_holiday_enabled']
  ];
  t text;
  i integer;
  tbl text;
  col text;
  multi_membership_users integer;
  ambiguous_worker_links integer;
begin
  foreach t in array required_tables loop
    if to_regclass('public.' || t) is null then
      missing := array_append(missing, t);
    end if;
  end loop;

  if cardinality(missing) > 0 then
    raise exception
      'DREVORA Phase 3 STOP: missing required table(s): %. No policies or grants were changed.',
      array_to_string(missing, ', ');
  end if;

  for i in 1 .. array_length(required_columns, 1) loop
    tbl := required_columns[i][1];
    col := required_columns[i][2];
    if not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = tbl
        and c.column_name = col
    ) then
      missing := array_append(missing, tbl || '.' || col);
    end if;
  end loop;

  if cardinality(missing) > 0 then
    raise exception
      'DREVORA Phase 3 STOP: missing required column(s): %. No policies or grants were changed.',
      array_to_string(missing, ', ');
  end if;

  -- Exact-one active membership required before enabling Phase 3 helpers.
  select count(*)::integer into multi_membership_users
  from (
    select cm.user_id
    from public.company_members cm
    where cm.is_active = true
    group by cm.user_id
    having count(*) > 1
  ) multi;

  if multi_membership_users > 0 then
    raise exception
      'DREVORA Phase 3 STOP: % auth user(s) have multiple active company_members rows. Exact-one membership is required. No policies or grants were changed.',
      multi_membership_users;
  end if;

  -- Exact-one Worker email match inside a company for authenticated emails.
  select count(*)::integer into ambiguous_worker_links
  from (
    select d.company_id, lower(trim(d.email)) as email_key
    from public.drivers d
    inner join auth.users u
      on lower(trim(coalesce(u.email, ''))) = lower(trim(coalesce(d.email, '')))
    where d.company_id is not null
      and coalesce(trim(d.email), '') <> ''
    group by d.company_id, lower(trim(d.email))
    having count(*) > 1
  ) amb;

  if ambiguous_worker_links > 0 then
    raise exception
      'DREVORA Phase 3 STOP: % company/email Worker identity collision(s) for authenticated emails. Exact-one Worker link is required. No policies or grants were changed.',
      ambiguous_worker_links;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1) Helpers — membership UUID only
--    Exact office roles from company_members_role_check / Phase 1:
--    Admin, Transport Manager, Supervisor, Planner, Office Staff
-- -----------------------------------------------------------------------------

-- Fail-closed: zero or >1 active memberships => no tenant access.
create or replace function public.drevora_auth_user_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select cm.company_id
  from public.company_members cm
  where cm.user_id = auth.uid()
    and cm.is_active = true
    and (
      select count(*)::integer
      from public.company_members x
      where x.user_id = auth.uid()
        and x.is_active = true
    ) = 1;
$$;

create or replace function public.drevora_auth_user_belongs_to_company_id(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_company_id is not null
    and (
      select count(*)::integer
      from public.company_members x
      where x.user_id = auth.uid()
        and x.is_active = true
    ) = 1
    and exists (
      select 1
      from public.company_members cm
      where cm.user_id = auth.uid()
        and cm.is_active = true
        and cm.company_id = p_company_id
    );
$$;

create or replace function public.drevora_auth_user_has_office_role_for_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_company_id is not null
    and (
      select count(*)::integer
      from public.company_members x
      where x.user_id = auth.uid()
        and x.is_active = true
    ) = 1
    and exists (
      select 1
      from public.company_members cm
      where cm.user_id = auth.uid()
        and cm.is_active = true
        and cm.company_id = p_company_id
        and cm.role in (
          'Admin',
          'Transport Manager',
          'Supervisor',
          'Planner',
          'Office Staff'
        )
    );
$$;

create or replace function public.drevora_auth_user_has_office_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      select count(*)::integer
      from public.company_members x
      where x.user_id = auth.uid()
        and x.is_active = true
    ) = 1
    and exists (
      select 1
      from public.company_members cm
      where cm.user_id = auth.uid()
        and cm.is_active = true
        and cm.role in (
          'Admin',
          'Transport Manager',
          'Supervisor',
          'Planner',
          'Office Staff'
        )
    );
$$;

create or replace function public.drevora_auth_user_driver_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  -- Fail-closed Worker link: exact-one membership + exact-one email match in that company.
  -- No ORDER BY / LIMIT 1 newest-row selection.
  with matches as (
    select d.id
    from public.drivers d
    inner join auth.users u on u.id = auth.uid()
    where lower(trim(coalesce(d.email, ''))) = lower(trim(coalesce(u.email, '')))
      and d.company_id is not null
      and coalesce(trim(d.email), '') <> ''
      and public.drevora_auth_user_belongs_to_company_id(d.company_id)
  )
  select m.id
  from matches m
  where (select count(*)::integer from matches) = 1;
$$;

create or replace function public.drevora_driver_in_company(p_driver_id uuid, p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_driver_id is not null
    and p_company_id is not null
    and exists (
      select 1
      from public.drivers d
      where d.id = p_driver_id
        and d.company_id = p_company_id
        and d.company_id is not null
    );
$$;

create or replace function public.drevora_vehicle_in_company(p_vehicle_id uuid, p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_vehicle_id is not null
    and p_company_id is not null
    and exists (
      select 1
      from public.vehicles v
      where v.id = p_vehicle_id
        and v.company_id = p_company_id
        and v.company_id is not null
    );
$$;

-- Trusted writers: JWT service_role, or direct SQL as postgres/supabase_admin.
-- anon / authenticated / unknown NULL-auth callers are NOT trusted.
-- Never treat a missing JWT identity as trusted; use drevora_is_trusted_tenant_writer().
create or replace function public.drevora_is_trusted_tenant_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.role(), '') = 'service_role'
    or current_user in ('postgres', 'supabase_admin')
    or session_user in ('postgres', 'supabase_admin');
$$;

-- Worker-editable Vehicle Check parent states (schema: Pending | In Progress | Completed).
-- Workers may write only while Pending/In Progress. Completed (or signed) is final.
create or replace function public.drevora_vehicle_check_is_worker_editable(
  p_status text,
  p_signed_at timestamptz
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    p_status in ('Pending', 'In Progress')
    and p_signed_at is null;
$$;

-- Finalised for Worker: Completed and/or signed. No Worker parent/item mutation.
create or replace function public.drevora_vehicle_check_is_worker_final(
  p_status text,
  p_signed_at timestamptz
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    p_status = 'Completed'
    or p_signed_at is not null
    or p_status not in ('Pending', 'In Progress', 'Completed');
$$;

-- Trusted holiday day breakdown from companies.holiday_* settings (not client payload).
create or replace function public.drevora_calculate_holiday_day_breakdown(
  p_company_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  calendar_days_total numeric,
  holiday_days_deducted numeric,
  non_working_days_excluded numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_method text;
  v_working_days text[];
  v_calendar integer;
  v_deducted integer := 0;
  v_day date;
  v_dow text;
begin
  if p_company_id is null or p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    return query select 0::numeric, 0::numeric, 0::numeric;
    return;
  end if;

  select
    coalesce(c.holiday_counting_method, 'working_days'),
    coalesce(
      nullif(c.holiday_working_days, '{}'::text[]),
      array['monday','tuesday','wednesday','thursday','friday']::text[]
    )
  into v_method, v_working_days
  from public.companies c
  where c.id = p_company_id;

  if v_method is null then
    v_method := 'working_days';
    v_working_days := array['monday','tuesday','wednesday','thursday','friday']::text[];
  end if;

  v_calendar := (p_end_date - p_start_date) + 1;

  if v_method = 'calendar_days' then
    return query select v_calendar::numeric, v_calendar::numeric, 0::numeric;
    return;
  end if;

  v_day := p_start_date;
  while v_day <= p_end_date loop
    v_dow := case extract(dow from v_day)::integer
      when 0 then 'sunday'
      when 1 then 'monday'
      when 2 then 'tuesday'
      when 3 then 'wednesday'
      when 4 then 'thursday'
      when 5 then 'friday'
      when 6 then 'saturday'
    end;
    if v_dow = any (v_working_days) then
      v_deducted := v_deducted + 1;
    end if;
    v_day := v_day + 1;
  end loop;

  return query
    select
      v_calendar::numeric,
      v_deducted::numeric,
      (v_calendar - v_deducted)::numeric;
end;
$$;

-- Derive Worker leave classification from drivers.paid_holiday_enabled (not client).
create or replace function public.drevora_worker_holiday_leave_type(p_worker_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when d.paid_holiday_enabled = false then 'unpaid_leave'
    else 'paid_holiday'
  end
  from public.drivers d
  where d.id = p_worker_id;
$$;

-- Neutralize unsafe oldest-company / company-text helpers used by legacy policies.
create or replace function public.drevora_current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  -- DEPRECATED. Never returns oldest company. Returns NULL so leftover policies deny.
  select null::uuid;
$$;

create or replace function public.drevora_current_company_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select null::text;
$$;

create or replace function public.drevora_company_text_matches_current(company_value text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select false;
$$;

-- company_id mutation is enforced by RLS USING/WITH CHECK for authenticated clients.
-- Trusted service_role / SQL Editor repairs of legacy NULL company_id remain possible.
-- Do NOT install an unconditional immutability trigger.
drop function if exists public.drevora_prevent_company_id_mutation() cascade;

revoke all on function public.drevora_auth_user_company_ids() from public;
revoke all on function public.drevora_auth_user_belongs_to_company_id(uuid) from public;
revoke all on function public.drevora_auth_user_has_office_role() from public;
revoke all on function public.drevora_auth_user_has_office_role_for_company(uuid) from public;
revoke all on function public.drevora_auth_user_driver_id() from public;
revoke all on function public.drevora_driver_in_company(uuid, uuid) from public;
revoke all on function public.drevora_vehicle_in_company(uuid, uuid) from public;
revoke all on function public.drevora_is_trusted_tenant_writer() from public;
revoke all on function public.drevora_calculate_holiday_day_breakdown(uuid, date, date) from public;
revoke all on function public.drevora_worker_holiday_leave_type(uuid) from public;
revoke all on function public.drevora_vehicle_check_is_worker_editable(text, timestamptz) from public;
revoke all on function public.drevora_vehicle_check_is_worker_final(text, timestamptz) from public;
revoke all on function public.drevora_current_company_id() from public;
revoke all on function public.drevora_current_company_name() from public;
revoke all on function public.drevora_company_text_matches_current(text) from public;

grant execute on function public.drevora_auth_user_company_ids() to authenticated;
grant execute on function public.drevora_auth_user_belongs_to_company_id(uuid) to authenticated;
grant execute on function public.drevora_auth_user_has_office_role() to authenticated;
grant execute on function public.drevora_auth_user_has_office_role_for_company(uuid) to authenticated;
grant execute on function public.drevora_auth_user_driver_id() to authenticated;
grant execute on function public.drevora_driver_in_company(uuid, uuid) to authenticated;
grant execute on function public.drevora_vehicle_in_company(uuid, uuid) to authenticated;
grant execute on function public.drevora_is_trusted_tenant_writer() to authenticated;
grant execute on function public.drevora_calculate_holiday_day_breakdown(uuid, date, date) to authenticated;
grant execute on function public.drevora_worker_holiday_leave_type(uuid) to authenticated;
grant execute on function public.drevora_vehicle_check_is_worker_editable(text, timestamptz) to authenticated;
grant execute on function public.drevora_vehicle_check_is_worker_final(text, timestamptz) to authenticated;
-- Deprecated helpers: execute granted so leftover policy expressions do not error; they deny.
grant execute on function public.drevora_current_company_id() to authenticated;
grant execute on function public.drevora_current_company_name() to authenticated;
grant execute on function public.drevora_company_text_matches_current(text) to authenticated;

comment on function public.drevora_auth_user_has_office_role_for_company(uuid) is
  'True when auth.uid() has exactly one active membership and that membership is an office role for the company.';

comment on function public.drevora_auth_user_company_ids() is
  'Returns the single active company_id for auth.uid(), or empty when membership count is not exactly one.';

comment on function public.drevora_auth_user_driver_id() is
  'Returns Worker drivers.id only when exact-one membership and exact-one email match exist in that company.';

comment on function public.drevora_current_company_id() is
  'DEPRECATED unsafe helper neutralized. Always NULL. Do not use for RLS.';

-- -----------------------------------------------------------------------------
-- 2) Drop ALL existing policies on target tables (idempotent)
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
  target text[] := array[
    'companies',
    'company_members',
    'drivers',
    'vehicles',
    'timesheets',
    'timesheet_entries',
    'holiday_requests',
    'vehicle_checks',
    'vehicle_check_items',
    'driver_reports',
    'documents',
    'contacts',
    'consumables',
    'vehicle_availability',
    'worker_compliance_records',
    'vehicle_compliance_records',
    'vehicle_check_templates',
    'vehicle_check_template_items',
    'dashboard_notes'
  ];
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (target)
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname,
      r.schemaname,
      r.tablename
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 3) Enable RLS + revoke anon + grant authenticated (service_role unchanged)
-- -----------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.timesheets enable row level security;
alter table public.timesheet_entries enable row level security;
alter table public.holiday_requests enable row level security;
alter table public.vehicle_checks enable row level security;
alter table public.vehicle_check_items enable row level security;
alter table public.driver_reports enable row level security;
alter table public.documents enable row level security;
alter table public.contacts enable row level security;
alter table public.consumables enable row level security;
alter table public.vehicle_availability enable row level security;
alter table public.worker_compliance_records enable row level security;
alter table public.vehicle_compliance_records enable row level security;
alter table public.vehicle_check_templates enable row level security;
alter table public.vehicle_check_template_items enable row level security;
alter table public.dashboard_notes enable row level security;

revoke all on table public.companies from anon;
revoke all on table public.company_members from anon;
revoke all on table public.drivers from anon;
revoke all on table public.vehicles from anon;
revoke all on table public.timesheets from anon;
revoke all on table public.timesheet_entries from anon;
revoke all on table public.holiday_requests from anon;
revoke all on table public.vehicle_checks from anon;
revoke all on table public.vehicle_check_items from anon;
revoke all on table public.driver_reports from anon;
revoke all on table public.documents from anon;
revoke all on table public.contacts from anon;
revoke all on table public.consumables from anon;
revoke all on table public.vehicle_availability from anon;
revoke all on table public.worker_compliance_records from anon;
revoke all on table public.vehicle_compliance_records from anon;
revoke all on table public.vehicle_check_templates from anon;
revoke all on table public.vehicle_check_template_items from anon;
revoke all on table public.dashboard_notes from anon;

revoke all on table public.companies from authenticated;
revoke all on table public.company_members from authenticated;
revoke all on table public.drivers from authenticated;
revoke all on table public.vehicles from authenticated;
revoke all on table public.timesheets from authenticated;
revoke all on table public.timesheet_entries from authenticated;
revoke all on table public.holiday_requests from authenticated;
revoke all on table public.vehicle_checks from authenticated;
revoke all on table public.vehicle_check_items from authenticated;
revoke all on table public.driver_reports from authenticated;
revoke all on table public.documents from authenticated;
revoke all on table public.contacts from authenticated;
revoke all on table public.consumables from authenticated;
revoke all on table public.vehicle_availability from authenticated;
revoke all on table public.worker_compliance_records from authenticated;
revoke all on table public.vehicle_compliance_records from authenticated;
revoke all on table public.vehicle_check_templates from authenticated;
revoke all on table public.vehicle_check_template_items from authenticated;
revoke all on table public.dashboard_notes from authenticated;

grant select, update on table public.companies to authenticated;
grant select on table public.company_members to authenticated;
grant select, insert, update, delete on table public.drivers to authenticated;
grant select, insert, update, delete on table public.vehicles to authenticated;
grant select, insert, update, delete on table public.timesheets to authenticated;
grant select, insert, update, delete on table public.timesheet_entries to authenticated;
grant select, insert, update, delete on table public.holiday_requests to authenticated;
grant select, insert, update, delete on table public.vehicle_checks to authenticated;
grant select, insert, update, delete on table public.vehicle_check_items to authenticated;
grant select, insert, update, delete on table public.driver_reports to authenticated;
grant select, insert, update, delete on table public.documents to authenticated;
grant select, insert, update, delete on table public.contacts to authenticated;
grant select, insert, update, delete on table public.consumables to authenticated;
grant select, insert, update, delete on table public.vehicle_availability to authenticated;
grant select, insert, update, delete on table public.worker_compliance_records to authenticated;
grant select, insert, update, delete on table public.vehicle_compliance_records to authenticated;
grant select, insert, update, delete on table public.vehicle_check_templates to authenticated;
grant select, insert, update, delete on table public.vehicle_check_template_items to authenticated;
grant select, insert, update, delete on table public.dashboard_notes to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Remove legacy company_id immutability triggers (trusted repair must remain possible)
--    Authenticated clients cannot move rows between companies: RLS requires
--    company_id is not null and membership/office checks on USING + WITH CHECK.
--    service_role / SQL Editor bypass RLS and may repair legacy NULL company_id.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'drivers',
    'vehicles',
    'timesheets',
    'holiday_requests',
    'vehicle_checks',
    'driver_reports',
    'documents',
    'contacts',
    'consumables',
    'vehicle_check_templates',
    'dashboard_notes'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists drevora_prevent_company_id_mutation on public.%I', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 5) Policies — companies / company_members
-- -----------------------------------------------------------------------------

create policy companies_member_select
  on public.companies
  for select
  to authenticated
  using (public.drevora_auth_user_belongs_to_company_id(id));

create policy companies_office_update
  on public.companies
  for update
  to authenticated
  using (public.drevora_auth_user_has_office_role_for_company(id))
  with check (public.drevora_auth_user_has_office_role_for_company(id));

-- No INSERT / DELETE policies for authenticated on companies.

create policy company_members_select_own
  on public.company_members
  for select
  to authenticated
  using (user_id = auth.uid() and is_active = true);

-- No INSERT / UPDATE / DELETE for authenticated on company_members.

-- -----------------------------------------------------------------------------
-- 6) Policies — drivers
-- -----------------------------------------------------------------------------

create policy drivers_office_select
  on public.drivers
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy drivers_worker_select_own
  on public.drivers
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and id = public.drevora_auth_user_driver_id()
  );

create policy drivers_office_insert
  on public.drivers
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      default_vehicle_id is null
      or public.drevora_vehicle_in_company(default_vehicle_id, company_id)
    )
  );

create policy drivers_office_update
  on public.drivers
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      default_vehicle_id is null
      or public.drevora_vehicle_in_company(default_vehicle_id, company_id)
    )
  );

-- Worker UPDATE on drivers is intentionally omitted.
-- Worker portal profile edit is not live; avatar updates are office-managed.
-- Do not grant unrestricted Worker UPDATE (RLS is row-level, not column-level).

create policy drivers_office_delete
  on public.drivers
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

-- -----------------------------------------------------------------------------
-- 7) Policies — vehicles
-- -----------------------------------------------------------------------------

create policy vehicles_office_select
  on public.vehicles
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy vehicles_worker_select_company
  on public.vehicles
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and public.drevora_auth_user_driver_id() is not null
    and not public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy vehicles_office_insert
  on public.vehicles
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      current_driver_id is null
      or public.drevora_driver_in_company(current_driver_id, company_id)
    )
  );

create policy vehicles_office_update
  on public.vehicles
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      current_driver_id is null
      or public.drevora_driver_in_company(current_driver_id, company_id)
    )
  );

create policy vehicles_office_delete
  on public.vehicles
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

-- -----------------------------------------------------------------------------
-- 8) Policies — timesheets + timesheet_entries
-- -----------------------------------------------------------------------------

create policy timesheets_office_select
  on public.timesheets
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy timesheets_worker_select_own
  on public.timesheets
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
  );

create policy timesheets_office_insert
  on public.timesheets
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_driver_in_company(driver_id, company_id)
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

create policy timesheets_worker_insert_own
  on public.timesheets
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_driver_in_company(driver_id, company_id)
    and status = 'Draft'
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

create policy timesheets_office_update
  on public.timesheets
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_driver_in_company(driver_id, company_id)
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

create policy timesheets_worker_update_own
  on public.timesheets
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
    and deleted_at is null
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_driver_in_company(driver_id, company_id)
    and deleted_at is null
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

create policy timesheets_office_delete
  on public.timesheets
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy timesheet_entries_office_select
  on public.timesheet_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
    )
  );

create policy timesheet_entries_worker_select_own
  on public.timesheet_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(t.company_id)
        and t.driver_id = public.drevora_auth_user_driver_id()
    )
  );

create policy timesheet_entries_office_insert
  on public.timesheet_entries
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
    )
  );

create policy timesheet_entries_worker_insert_own
  on public.timesheet_entries
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(t.company_id)
        and t.driver_id = public.drevora_auth_user_driver_id()
    )
  );

create policy timesheet_entries_office_update
  on public.timesheet_entries
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
    )
  )
  with check (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
    )
  );

create policy timesheet_entries_worker_update_own
  on public.timesheet_entries
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(t.company_id)
        and t.driver_id = public.drevora_auth_user_driver_id()
    )
  )
  with check (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(t.company_id)
        and t.driver_id = public.drevora_auth_user_driver_id()
    )
  );

create policy timesheet_entries_office_delete
  on public.timesheet_entries
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 9) Policies — holiday_requests
-- -----------------------------------------------------------------------------

create policy holiday_requests_office_select
  on public.holiday_requests
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy holiday_requests_worker_select_own
  on public.holiday_requests
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
  );

create policy holiday_requests_office_insert
  on public.holiday_requests
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_driver_in_company(worker_id, company_id)
  );

create policy holiday_requests_worker_insert_own
  on public.holiday_requests
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_driver_in_company(worker_id, company_id)
    and status = 'Pending'
    and manager_note is null
    -- leave_type / is_paid_leave / day totals are assigned only by trusted trigger logic
  );

create policy holiday_requests_office_update
  on public.holiday_requests
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_driver_in_company(worker_id, company_id)
  );

create policy holiday_requests_worker_update_own
  on public.holiday_requests
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and status = 'Pending'
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_driver_in_company(worker_id, company_id)
    and status in ('Pending', 'Cancelled')
  );

create policy holiday_requests_office_delete
  on public.holiday_requests
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

-- -----------------------------------------------------------------------------
-- 10) Policies — vehicle_checks + vehicle_check_items
-- -----------------------------------------------------------------------------

create policy vehicle_checks_office_select
  on public.vehicle_checks
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy vehicle_checks_worker_select_own
  on public.vehicle_checks
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
  );

create policy vehicle_checks_office_insert
  on public.vehicle_checks
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_vehicle_in_company(vehicle_id, company_id)
    and public.drevora_driver_in_company(worker_id, company_id)
  );

create policy vehicle_checks_worker_insert_own
  on public.vehicle_checks
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_vehicle_in_company(vehicle_id, company_id)
    and public.drevora_driver_in_company(worker_id, company_id)
  );

create policy vehicle_checks_office_update
  on public.vehicle_checks
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_vehicle_in_company(vehicle_id, company_id)
    and public.drevora_driver_in_company(worker_id, company_id)
  );

create policy vehicle_checks_worker_update_own
  on public.vehicle_checks
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_vehicle_check_is_worker_editable(status, signed_at)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_vehicle_in_company(vehicle_id, company_id)
    and public.drevora_driver_in_company(worker_id, company_id)
  );

create policy vehicle_checks_office_delete
  on public.vehicle_checks
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy vehicle_check_items_office_select
  on public.vehicle_check_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(vc.company_id)
    )
  );

create policy vehicle_check_items_worker_select_own
  on public.vehicle_check_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(vc.company_id)
        and vc.worker_id = public.drevora_auth_user_driver_id()
    )
  );

create policy vehicle_check_items_office_insert
  on public.vehicle_check_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(vc.company_id)
    )
  );

-- Worker item INSERT only while parent is Pending/In Progress (never after Completed/signed).
create policy vehicle_check_items_worker_insert_own
  on public.vehicle_check_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(vc.company_id)
        and vc.worker_id = public.drevora_auth_user_driver_id()
        and public.drevora_vehicle_check_is_worker_editable(vc.status, vc.signed_at)
    )
  );

create policy vehicle_check_items_office_update
  on public.vehicle_check_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(vc.company_id)
    )
  )
  with check (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(vc.company_id)
    )
  );

create policy vehicle_check_items_worker_update_own
  on public.vehicle_check_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(vc.company_id)
        and vc.worker_id = public.drevora_auth_user_driver_id()
        and public.drevora_vehicle_check_is_worker_editable(vc.status, vc.signed_at)
    )
  )
  with check (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(vc.company_id)
        and vc.worker_id = public.drevora_auth_user_driver_id()
        and public.drevora_vehicle_check_is_worker_editable(vc.status, vc.signed_at)
    )
  );

create policy vehicle_check_items_office_delete
  on public.vehicle_check_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(vc.company_id)
    )
  );

-- Worker item DELETE only while check is still editable (Pending/In Progress, unsigned).
create policy vehicle_check_items_worker_delete_own
  on public.vehicle_check_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(vc.company_id)
        and vc.worker_id = public.drevora_auth_user_driver_id()
        and public.drevora_vehicle_check_is_worker_editable(vc.status, vc.signed_at)
    )
  );

-- -----------------------------------------------------------------------------
-- 11) Policies — driver_reports
-- -----------------------------------------------------------------------------

create policy driver_reports_office_select
  on public.driver_reports
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy driver_reports_worker_select_own
  on public.driver_reports
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
  );

create policy driver_reports_office_insert
  on public.driver_reports
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      worker_id is null
      or public.drevora_driver_in_company(worker_id, company_id)
    )
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

create policy driver_reports_worker_insert_own
  on public.driver_reports
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_driver_in_company(worker_id, company_id)
    and status = 'New'
    and office_notes is null
    and cleaned_at is null
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

create policy driver_reports_office_update
  on public.driver_reports
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      worker_id is null
      or public.drevora_driver_in_company(worker_id, company_id)
    )
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

create policy driver_reports_worker_update_own
  on public.driver_reports
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and status = 'New'
    and cleaned_at is null
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_driver_in_company(worker_id, company_id)
    and status = 'New'
    and office_notes is null
    and cleaned_at is null
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

create policy driver_reports_office_delete
  on public.driver_reports
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

-- -----------------------------------------------------------------------------
-- 12) Policies — documents
-- -----------------------------------------------------------------------------

create policy documents_office_select
  on public.documents
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy documents_worker_select_own
  on public.documents
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
  );

create policy documents_office_insert
  on public.documents
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      worker_id is null
      or public.drevora_driver_in_company(worker_id, company_id)
    )
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

create policy documents_office_update
  on public.documents
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      worker_id is null
      or public.drevora_driver_in_company(worker_id, company_id)
    )
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

create policy documents_office_delete
  on public.documents
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

-- -----------------------------------------------------------------------------
-- 13) Policies — contacts / consumables / dashboard_notes (office only)
-- -----------------------------------------------------------------------------

create policy contacts_office_select
  on public.contacts
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy contacts_office_insert
  on public.contacts
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy contacts_office_update
  on public.contacts
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy contacts_office_delete
  on public.contacts
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy consumables_office_select
  on public.consumables
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy consumables_worker_select_own
  on public.consumables
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and deleted_at is null
  );

create policy consumables_office_insert
  on public.consumables
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      worker_id is null
      or public.drevora_driver_in_company(worker_id, company_id)
    )
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

create policy consumables_worker_insert_own
  on public.consumables
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_driver_in_company(worker_id, company_id)
    and deleted_at is null
    and deleted_by is null
    and delete_reason is null
    and cleaned_at is null
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

create policy consumables_office_update
  on public.consumables
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      worker_id is null
      or public.drevora_driver_in_company(worker_id, company_id)
    )
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

create policy consumables_worker_update_own
  on public.consumables
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and deleted_at is null
    and cleaned_at is null
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_driver_in_company(worker_id, company_id)
    and deleted_at is null
    and deleted_by is null
    and delete_reason is null
    and cleaned_at is null
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

create policy consumables_office_delete
  on public.consumables
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy dashboard_notes_office_select
  on public.dashboard_notes
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy dashboard_notes_office_insert
  on public.dashboard_notes
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy dashboard_notes_office_update
  on public.dashboard_notes
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy dashboard_notes_office_delete
  on public.dashboard_notes
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

-- -----------------------------------------------------------------------------
-- 14) Policies — vehicle_availability (via vehicles)
-- -----------------------------------------------------------------------------

create policy vehicle_availability_office_select
  on public.vehicle_availability
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
    )
  );

create policy vehicle_availability_worker_select_company
  on public.vehicle_availability
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(v.company_id)
        and public.drevora_auth_user_driver_id() is not null
        and not public.drevora_auth_user_has_office_role_for_company(v.company_id)
    )
  );

create policy vehicle_availability_office_insert
  on public.vehicle_availability
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
    )
  );

create policy vehicle_availability_office_update
  on public.vehicle_availability
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
    )
  )
  with check (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
    )
  );

create policy vehicle_availability_office_delete
  on public.vehicle_availability
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 15) Policies — compliance records
-- -----------------------------------------------------------------------------

create policy worker_compliance_office_select
  on public.worker_compliance_records
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.drivers d
      where d.id = worker_id
        and d.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(d.company_id)
    )
  );

create policy worker_compliance_worker_select_own
  on public.worker_compliance_records
  for select
  to authenticated
  using (worker_id = public.drevora_auth_user_driver_id());

create policy worker_compliance_office_insert
  on public.worker_compliance_records
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.drivers d
      where d.id = worker_id
        and d.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(d.company_id)
    )
  );

create policy worker_compliance_office_update
  on public.worker_compliance_records
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.drivers d
      where d.id = worker_id
        and d.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(d.company_id)
    )
  )
  with check (
    exists (
      select 1
      from public.drivers d
      where d.id = worker_id
        and d.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(d.company_id)
    )
  );

create policy worker_compliance_office_delete
  on public.worker_compliance_records
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.drivers d
      where d.id = worker_id
        and d.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(d.company_id)
    )
  );

create policy vehicle_compliance_office_select
  on public.vehicle_compliance_records
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
    )
  );

create policy vehicle_compliance_office_insert
  on public.vehicle_compliance_records
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
    )
  );

create policy vehicle_compliance_office_update
  on public.vehicle_compliance_records
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
    )
  )
  with check (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
    )
  );

create policy vehicle_compliance_office_delete
  on public.vehicle_compliance_records
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 16) Policies — vehicle_check_templates (+ items)
--     company_id NULL is NOT treated as global (no system-template flag exists).
--     App Basic DVSA in-memory fallback remains unchanged.
-- -----------------------------------------------------------------------------

create policy vehicle_check_templates_office_select
  on public.vehicle_check_templates
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy vehicle_check_templates_worker_select_active
  on public.vehicle_check_templates
  for select
  to authenticated
  using (
    company_id is not null
    and is_active = true
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and public.drevora_auth_user_driver_id() is not null
    and not public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy vehicle_check_templates_office_insert
  on public.vehicle_check_templates
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy vehicle_check_templates_office_update
  on public.vehicle_check_templates
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy vehicle_check_templates_office_delete
  on public.vehicle_check_templates
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy vehicle_check_template_items_office_select
  on public.vehicle_check_template_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_check_templates t
      where t.id = template_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
    )
  );

create policy vehicle_check_template_items_worker_select_active
  on public.vehicle_check_template_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_check_templates t
      where t.id = template_id
        and t.company_id is not null
        and t.is_active = true
        and public.drevora_auth_user_belongs_to_company_id(t.company_id)
        and public.drevora_auth_user_driver_id() is not null
        and not public.drevora_auth_user_has_office_role_for_company(t.company_id)
    )
  );

create policy vehicle_check_template_items_office_insert
  on public.vehicle_check_template_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.vehicle_check_templates t
      where t.id = template_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
    )
  );

create policy vehicle_check_template_items_office_update
  on public.vehicle_check_template_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_check_templates t
      where t.id = template_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
    )
  )
  with check (
    exists (
      select 1
      from public.vehicle_check_templates t
      where t.id = template_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
    )
  );

create policy vehicle_check_template_items_office_delete
  on public.vehicle_check_template_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_check_templates t
      where t.id = template_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 17) Worker column / transition enforcement (SECURITY INVOKER triggers)
--     Strict allowlists. Trusted bypass: drevora_is_trusted_tenant_writer() only.
-- -----------------------------------------------------------------------------

create or replace function public.drevora_enforce_timesheet_worker_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_worker_id uuid;
  v_company_id uuid;
begin
  v_company_id := case when tg_op = 'DELETE' then old.company_id else new.company_id end;

  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Reopen consistency for all authenticated writers.
  if tg_op = 'UPDATE' and new.status in ('Draft', 'Submitted') then
    new.approved_at := null;
    new.rejected_at := null;
  end if;

  if public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null then
    raise exception 'DREVORA: Timesheet write denied (no exact Worker link / not office).';
  end if;

  if tg_op = 'INSERT' then
    if new.driver_id is distinct from v_worker_id then
      raise exception 'DREVORA: Workers may only create their own Timesheets.';
    end if;
    -- Force non-allowlisted fields.
    new.driver_id := v_worker_id;
    new.status := 'Draft';
    new.bonus_amount := 0;
    new.submitted_at := null;
    new.approved_at := null;
    new.rejected_at := null;
    new.deleted_at := null;
    new.deleted_by := null;
    new.delete_reason := null;
    new.cleaned_at := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Strict allowlist: only vehicle_id, week_start, notes, status, submitted_at, updated_at
    -- may differ (approved_at/rejected_at forced null above when Draft/Submitted).
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.driver_id is distinct from old.driver_id
       or new.driver_id is distinct from v_worker_id
       or old.driver_id is distinct from v_worker_id
       or new.created_at is distinct from old.created_at
       or new.bonus_amount is distinct from old.bonus_amount
       or new.deleted_at is distinct from old.deleted_at
       or new.deleted_by is distinct from old.deleted_by
       or new.delete_reason is distinct from old.delete_reason
       or new.cleaned_at is distinct from old.cleaned_at then
      raise exception 'DREVORA: Workers may not change immutable Timesheet fields.';
    end if;

    if new.vehicle_id is not distinct from old.vehicle_id
       and new.week_start is not distinct from old.week_start
       and new.notes is not distinct from old.notes
       and new.status is not distinct from old.status
       and new.submitted_at is not distinct from old.submitted_at
       and new.updated_at is not distinct from old.updated_at
       and new.approved_at is not distinct from old.approved_at
       and new.rejected_at is not distinct from old.rejected_at then
      return new;
    end if;

    if new.status is distinct from old.status then
      if new.status in ('Approved', 'Rejected') then
        raise exception 'DREVORA: Workers may not approve or reject Timesheets.';
      end if;
      if not (
        (old.status = 'Draft' and new.status = 'Submitted')
        or (old.status in ('Rejected', 'Approved') and new.status in ('Draft', 'Submitted'))
        or (old.status = 'Submitted' and new.status = 'Draft')
      ) then
        raise exception
          'DREVORA: Invalid Worker Timesheet status transition % -> %.',
          old.status, new.status;
      end if;
    end if;

    if new.submitted_at is distinct from old.submitted_at then
      if not (
        old.submitted_at is null
        and new.submitted_at is not null
        and new.status = 'Submitted'
      ) then
        raise exception 'DREVORA: Workers may only set submitted_at when submitting.';
      end if;
    end if;

    if new.status in ('Draft', 'Submitted')
       and (new.approved_at is not null or new.rejected_at is not null) then
      raise exception 'DREVORA: Draft/Submitted Timesheets cannot retain approval timestamps.';
    end if;

    return new;
  end if;

  return new;
end;
$$;

create or replace function public.drevora_enforce_timesheet_entry_worker_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid;
  v_driver_id uuid;
  v_worker_id uuid;
begin
  select t.company_id, t.driver_id
    into v_company_id, v_driver_id
  from public.timesheets t
  where t.id = case when tg_op = 'DELETE' then old.timesheet_id else new.timesheet_id end;

  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null or v_driver_id is distinct from v_worker_id then
    raise exception 'DREVORA: Workers may only write entries on their own Timesheets.';
  end if;

  if tg_op = 'INSERT' then
    -- Allowlist: timesheet_id, day_date, start_time, break_minutes, finish_time,
    -- total_minutes, overtime_minutes, payroll_minutes, additional_hours, daily_comment.
    new.deleted_at := null;
    new.deleted_by := null;
    new.delete_reason := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.timesheet_id is distinct from old.timesheet_id
       or new.deleted_at is distinct from old.deleted_at
       or new.deleted_by is distinct from old.deleted_by
       or new.delete_reason is distinct from old.delete_reason then
      raise exception 'DREVORA: Workers may not change immutable Timesheet entry fields.';
    end if;
    return new;
  end if;

  raise exception 'DREVORA: Workers may not delete Timesheet entries.';
end;
$$;

create or replace function public.drevora_enforce_holiday_request_worker_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_worker_id uuid;
  v_company_id uuid;
  v_leave_type text;
  v_calc record;
begin
  v_company_id := case when tg_op = 'DELETE' then old.company_id else new.company_id end;

  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null then
    raise exception 'DREVORA: Holiday write denied (no exact Worker link / not office).';
  end if;

  if tg_op = 'INSERT' then
    -- Client may supply only: company_id, worker_id, start_date, end_date, reason.
    -- Classification + calculated fields assigned only by trusted DB logic.
    if new.worker_id is distinct from v_worker_id then
      raise exception 'DREVORA: Workers may only create their own Holiday Requests.';
    end if;
    if new.start_date is null or new.end_date is null or new.end_date < new.start_date then
      raise exception 'DREVORA: Holiday Request dates are invalid.';
    end if;

    v_leave_type := public.drevora_worker_holiday_leave_type(v_worker_id);
    if v_leave_type is null then
      raise exception 'DREVORA: Unable to derive Worker leave type.';
    end if;

    select * into v_calc
    from public.drevora_calculate_holiday_day_breakdown(
      new.company_id, new.start_date, new.end_date
    );

    new.worker_id := v_worker_id;
    new.status := 'Pending';
    new.manager_note := null;
    new.leave_type := v_leave_type;
    new.is_paid_leave := (v_leave_type = 'paid_holiday');
    new.calendar_days_total := v_calc.calendar_days_total;
    new.holiday_days_deducted := v_calc.holiday_days_deducted;
    new.non_working_days_excluded := v_calc.non_working_days_excluded;
    new.total_days := v_calc.holiday_days_deducted;
    new.updated_at := coalesce(new.updated_at, now());
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.worker_id is distinct from v_worker_id
       or new.worker_id is distinct from v_worker_id
       or new.company_id is distinct from old.company_id
       or new.id is distinct from old.id
       or new.created_at is distinct from old.created_at then
      raise exception 'DREVORA: Workers may not change immutable Holiday Request identity fields.';
    end if;
    if old.status is distinct from 'Pending' then
      raise exception 'DREVORA: Workers may only update Pending Holiday Requests.';
    end if;

    -- Allowlist only: start_date, end_date, reason, status (Pending|Cancelled), updated_at.
    -- Force classification + calculated + manager fields from trusted logic / OLD.
    if new.status is distinct from old.status and new.status is distinct from 'Cancelled' then
      raise exception 'DREVORA: Workers may only cancel Pending Holiday Requests.';
    end if;
    if new.status in ('Approved', 'Rejected') then
      raise exception 'DREVORA: Workers may not approve or reject Holiday Requests.';
    end if;

    v_leave_type := public.drevora_worker_holiday_leave_type(v_worker_id);
    new.leave_type := v_leave_type;
    new.is_paid_leave := (v_leave_type = 'paid_holiday');
    new.manager_note := old.manager_note;
    new.updated_at := now();

    if new.status = 'Cancelled' then
      new.total_days := old.total_days;
      new.holiday_days_deducted := old.holiday_days_deducted;
      new.calendar_days_total := old.calendar_days_total;
      new.non_working_days_excluded := old.non_working_days_excluded;
      new.start_date := old.start_date;
      new.end_date := old.end_date;
      new.reason := old.reason;
      return new;
    end if;

    select * into v_calc
    from public.drevora_calculate_holiday_day_breakdown(
      new.company_id, new.start_date, new.end_date
    );
    new.calendar_days_total := v_calc.calendar_days_total;
    new.holiday_days_deducted := v_calc.holiday_days_deducted;
    new.non_working_days_excluded := v_calc.non_working_days_excluded;
    new.total_days := v_calc.holiday_days_deducted;
    return new;
  end if;

  raise exception 'DREVORA: Workers may not delete Holiday Requests.';
end;
$$;

create or replace function public.drevora_enforce_driver_report_worker_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_worker_id uuid;
  v_company_id uuid;
begin
  v_company_id := case when tg_op = 'DELETE' then old.company_id else new.company_id end;

  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null then
    raise exception 'DREVORA: Driver Report write denied (no exact Worker link / not office).';
  end if;

  if tg_op = 'INSERT' then
    -- Allowlist: company_id, worker_id, vehicle_id, title, report_type, priority,
    -- description, location, issue_datetime, attachment_url, attachment_path.
    if new.worker_id is distinct from v_worker_id then
      raise exception 'DREVORA: Workers may only create their own Driver Reports.';
    end if;
    new.status := 'New';
    new.office_notes := null;
    new.cleaned_at := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.worker_id is distinct from old.worker_id
       or new.worker_id is distinct from v_worker_id
       or old.worker_id is distinct from v_worker_id
       or new.created_at is distinct from old.created_at
       or new.office_notes is distinct from old.office_notes
       or new.cleaned_at is distinct from old.cleaned_at
       or new.status is distinct from 'New'
       or old.status is distinct from 'New' then
      raise exception 'DREVORA: Workers may only edit New Driver Reports with allowlisted fields.';
    end if;
    -- Allowlist mutable: title, report_type, priority, description, location,
    -- issue_datetime, vehicle_id, attachment_url, attachment_path, updated_at.
    new.office_notes := old.office_notes;
    new.cleaned_at := old.cleaned_at;
    new.status := 'New';
    return new;
  end if;

  raise exception 'DREVORA: Workers may not delete Driver Reports.';
end;
$$;

create or replace function public.drevora_enforce_vehicle_check_worker_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_worker_id uuid;
  v_company_id uuid;
begin
  v_company_id := case when tg_op = 'DELETE' then old.company_id else new.company_id end;

  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null then
    raise exception 'DREVORA: Vehicle Check write denied (no exact Worker link / not office).';
  end if;

  if tg_op = 'INSERT' then
    if new.worker_id is distinct from v_worker_id then
      raise exception 'DREVORA: Workers may only create their own Vehicle Checks.';
    end if;
    -- Workers may only open checks in Pending/In Progress. Never insert as Completed/signed.
    new.worker_id := v_worker_id;
    if new.status is distinct from 'Pending' and new.status is distinct from 'In Progress' then
      new.status := 'In Progress';
    end if;
    new.signature_url := null;
    new.signed_at := null;
    new.inspection_completed_at := null;
    new.duration_seconds := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.worker_id is distinct from old.worker_id
       or new.worker_id is distinct from v_worker_id
       or old.worker_id is distinct from v_worker_id
       or new.created_at is distinct from old.created_at then
      raise exception 'DREVORA: Workers may not change immutable Vehicle Check identity fields.';
    end if;

    if not public.drevora_vehicle_check_is_worker_editable(old.status, old.signed_at) then
      raise exception 'DREVORA: Workers may not alter a finalised Vehicle Check.';
    end if;

    -- Completion transition: In Progress/Pending → Completed with signature in one update.
    if new.status = 'Completed' then
      if new.signature_url is null or new.signed_at is null then
        raise exception 'DREVORA: Completing a Vehicle Check requires signature_url and signed_at.';
      end if;
      -- Allowlisted completion fields already on NEW; identity fields locked above.
      return new;
    end if;

    -- Remain in Pending/In Progress: operational fields only; no signature/final timestamps.
    if new.status not in ('Pending', 'In Progress') then
      raise exception 'DREVORA: Workers may only keep Vehicle Checks in Pending/In Progress until completion.';
    end if;
    if new.signature_url is distinct from old.signature_url
       or new.signed_at is distinct from old.signed_at
       or new.inspection_completed_at is distinct from old.inspection_completed_at
       or new.duration_seconds is distinct from old.duration_seconds then
      raise exception 'DREVORA: Signature/completion fields are only set when status becomes Completed.';
    end if;
    return new;
  end if;

  raise exception 'DREVORA: Workers may not delete Vehicle Checks.';
end;
$$;

create or replace function public.drevora_enforce_vehicle_check_item_worker_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid;
  v_worker_id uuid;
  v_status text;
  v_owner uuid;
  v_signed_at timestamptz;
  v_check_id uuid;
begin
  v_check_id := case when tg_op = 'DELETE' then old.vehicle_check_id else new.vehicle_check_id end;

  select vc.company_id, vc.worker_id, vc.status, vc.signed_at
    into v_company_id, v_owner, v_status, v_signed_at
  from public.vehicle_checks vc
  where vc.id = v_check_id;

  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null or v_owner is distinct from v_worker_id then
    raise exception 'DREVORA: Workers may only write items on their own Vehicle Checks.';
  end if;

  if public.drevora_vehicle_check_is_worker_final(v_status, v_signed_at)
     or not public.drevora_vehicle_check_is_worker_editable(v_status, v_signed_at) then
    raise exception 'DREVORA: Workers may not INSERT/UPDATE/DELETE items on a finalised Vehicle Check.';
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.vehicle_check_id is distinct from old.vehicle_check_id then
      raise exception 'DREVORA: Workers may not reassign Vehicle Check items.';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.drevora_enforce_consumable_worker_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_worker_id uuid;
  v_company_id uuid;
begin
  v_company_id := case when tg_op = 'DELETE' then old.company_id else new.company_id end;

  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null then
    raise exception 'DREVORA: Consumable write denied (no exact Worker link / not office).';
  end if;

  if tg_op = 'INSERT' then
    -- Allowlist: company_id, vehicle_id, worker_id, consumable_type, item_name, quantity,
    -- unit, cost, supplier, site, odometer, receipt_url, notes, entry_date, entry_time.
    if new.worker_id is distinct from v_worker_id then
      raise exception 'DREVORA: Workers may only create their own Consumables.';
    end if;
    new.worker_id := v_worker_id;
    new.created_by := null;
    new.deleted_at := null;
    new.deleted_by := null;
    new.delete_reason := null;
    new.cleaned_at := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.worker_id is distinct from old.worker_id
       or new.worker_id is distinct from v_worker_id
       or old.worker_id is distinct from v_worker_id
       or new.created_at is distinct from old.created_at
       or new.created_by is distinct from old.created_by
       or new.deleted_at is distinct from old.deleted_at
       or new.deleted_by is distinct from old.deleted_by
       or new.delete_reason is distinct from old.delete_reason
       or new.cleaned_at is distinct from old.cleaned_at then
      raise exception 'DREVORA: Workers may not change immutable Consumable fields.';
    end if;
    return new;
  end if;

  raise exception 'DREVORA: Workers may not hard-delete Consumables.';
end;
$$;

drop trigger if exists drevora_enforce_timesheet_worker_write on public.timesheets;
create trigger drevora_enforce_timesheet_worker_write
  before insert or update on public.timesheets
  for each row
  execute function public.drevora_enforce_timesheet_worker_write();

drop trigger if exists drevora_enforce_timesheet_entry_worker_write on public.timesheet_entries;
create trigger drevora_enforce_timesheet_entry_worker_write
  before insert or update or delete on public.timesheet_entries
  for each row
  execute function public.drevora_enforce_timesheet_entry_worker_write();

drop trigger if exists drevora_enforce_holiday_request_worker_write on public.holiday_requests;
create trigger drevora_enforce_holiday_request_worker_write
  before insert or update or delete on public.holiday_requests
  for each row
  execute function public.drevora_enforce_holiday_request_worker_write();

drop trigger if exists drevora_enforce_driver_report_worker_write on public.driver_reports;
create trigger drevora_enforce_driver_report_worker_write
  before insert or update or delete on public.driver_reports
  for each row
  execute function public.drevora_enforce_driver_report_worker_write();

drop trigger if exists drevora_enforce_vehicle_check_worker_write on public.vehicle_checks;
create trigger drevora_enforce_vehicle_check_worker_write
  before insert or update or delete on public.vehicle_checks
  for each row
  execute function public.drevora_enforce_vehicle_check_worker_write();

drop trigger if exists drevora_enforce_vehicle_check_item_worker_write on public.vehicle_check_items;
create trigger drevora_enforce_vehicle_check_item_worker_write
  before insert or update or delete on public.vehicle_check_items
  for each row
  execute function public.drevora_enforce_vehicle_check_item_worker_write();

drop trigger if exists drevora_enforce_consumable_worker_write on public.consumables;
create trigger drevora_enforce_consumable_worker_write
  before insert or update or delete on public.consumables
  for each row
  execute function public.drevora_enforce_consumable_worker_write();

-- Trigger functions: SECURITY INVOKER + search_path. EXECUTE is revoked from
-- PUBLIC, anon, and authenticated so they are not callable as public RPC.
-- PostgreSQL checks EXECUTE on trigger functions at CREATE TRIGGER time (migration
-- role), not at runtime for attached triggers.
revoke all on function public.drevora_enforce_timesheet_worker_write() from public;
revoke all on function public.drevora_enforce_timesheet_entry_worker_write() from public;
revoke all on function public.drevora_enforce_holiday_request_worker_write() from public;
revoke all on function public.drevora_enforce_driver_report_worker_write() from public;
revoke all on function public.drevora_enforce_vehicle_check_worker_write() from public;
revoke all on function public.drevora_enforce_vehicle_check_item_worker_write() from public;
revoke all on function public.drevora_enforce_consumable_worker_write() from public;

revoke all on function public.drevora_enforce_timesheet_worker_write() from anon;
revoke all on function public.drevora_enforce_timesheet_entry_worker_write() from anon;
revoke all on function public.drevora_enforce_holiday_request_worker_write() from anon;
revoke all on function public.drevora_enforce_driver_report_worker_write() from anon;
revoke all on function public.drevora_enforce_vehicle_check_worker_write() from anon;
revoke all on function public.drevora_enforce_vehicle_check_item_worker_write() from anon;
revoke all on function public.drevora_enforce_consumable_worker_write() from anon;

revoke all on function public.drevora_enforce_timesheet_worker_write() from authenticated;
revoke all on function public.drevora_enforce_timesheet_entry_worker_write() from authenticated;
revoke all on function public.drevora_enforce_holiday_request_worker_write() from authenticated;
revoke all on function public.drevora_enforce_driver_report_worker_write() from authenticated;
revoke all on function public.drevora_enforce_vehicle_check_worker_write() from authenticated;
revoke all on function public.drevora_enforce_vehicle_check_item_worker_write() from authenticated;
revoke all on function public.drevora_enforce_consumable_worker_write() from authenticated;

-- -----------------------------------------------------------------------------
-- 18) Supporting indexes (idempotent)
-- -----------------------------------------------------------------------------
create index if not exists drivers_company_id_idx on public.drivers (company_id);
create index if not exists vehicles_company_id_idx on public.vehicles (company_id);
create index if not exists timesheets_company_id_idx on public.timesheets (company_id);
create index if not exists holiday_requests_company_id_idx on public.holiday_requests (company_id);
create index if not exists vehicle_checks_company_id_idx on public.vehicle_checks (company_id);
create index if not exists driver_reports_company_id_idx on public.driver_reports (company_id);
create index if not exists documents_company_id_idx on public.documents (company_id);
create index if not exists contacts_company_id_idx on public.contacts (company_id);
create index if not exists consumables_company_id_idx on public.consumables (company_id);
create index if not exists vehicle_check_templates_company_id_idx on public.vehicle_check_templates (company_id);
create index if not exists dashboard_notes_company_id_idx on public.dashboard_notes (company_id);
create index if not exists company_members_user_active_idx on public.company_members (user_id, is_active);

notify pgrst, 'reload schema';

commit;

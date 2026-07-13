-- =============================================================================
-- DREVORA — Multi-tenant RLS FOUNDATION (Phase 1)
-- File: supabase/migrations/20260712220000_rls_tenant_membership_foundation.sql
-- =============================================================================
-- REVIEW ONLY — do not apply until approved. Do not run automatically.
--
-- Phase 1 goals:
--   1) Create public.company_members (auth.users ↔ companies.id)
--   2) Add nullable company_id uuid to tenant root/operational tables
--   3) Unambiguous backfill from legacy company TEXT / mandatory parents
--   4) Auth-bound helpers for a future Phase 2 RLS policy migration
--   5) Report unresolved legacy/demo rows (company_id remains NULL)
--
-- Phase 1 does NOT:
--   - Enable RLS on Security Advisor business tables
--   - Set company_id NOT NULL
--   - Delete / reset / recreate / rename / reassign existing business rows
--   - Assign unmatched rows to the oldest company or by created_at
--   - Guess Cardinalis / Sofosmagnatas / unassigned vehicles into a tenant
--   - Fail solely because unmatched legacy/demo rows remain NULL
--   - Use raw_user_meta_data / sessionStorage for authorization
--   - Bootstrap a specific admin user (see supabase/bootstrap/)
--
-- Phase 1 STILL STOPS for dangerous conditions:
--   - Ambiguous duplicate company name matches (2+ companies with same normalised name)
--   - A row that uniquely resolves to two different companies (worker vs vehicle conflict)
--   - An existing non-null company_id that conflicts with unambiguous text resolution
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: resolve companies.id from a legacy company text name
-- Returns the id only when EXACTLY one companies.name matches (case-insensitive).
-- Returns NULL when empty, unmatched, or ambiguous (2+ matches).
-- -----------------------------------------------------------------------------
create or replace function public.drevora_resolve_unique_company_id(p_company_text text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text := nullif(lower(trim(coalesce(p_company_text, ''))), '');
  match_count integer;
  resolved_id uuid;
begin
  if normalized is null then
    return null;
  end if;

  select count(*)::integer
  into match_count
  from public.companies c
  where lower(trim(coalesce(c.name, ''))) = normalized;

  if match_count <> 1 then
    return null;
  end if;

  select c.id
  into resolved_id
  from public.companies c
  where lower(trim(coalesce(c.name, ''))) = normalized
  limit 1;

  return resolved_id;
end;
$$;

comment on function public.drevora_resolve_unique_company_id(text) is
  'Maps legacy company text to companies.id only when the name match is unique. Never guesses.';

-- -----------------------------------------------------------------------------
-- 1) company_members — authoritative auth → tenant membership
-- -----------------------------------------------------------------------------
create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  -- Exact existing drivers.role vocabulary (no new role names).
  role text not null default 'Driver',
  is_active boolean not null default true,
  constraint company_members_user_company_unique unique (user_id, company_id),
  constraint company_members_role_check check (
    role in (
      'Admin',
      'Driver',
      'Yardman',
      'Cleaner',
      'Supervisor',
      'Mechanic',
      'Transport Manager',
      'Planner',
      'Office Staff',
      'Warehouse',
      'Other'
    )
  )
);

create index if not exists company_members_user_id_idx
  on public.company_members (user_id);

create index if not exists company_members_company_id_idx
  on public.company_members (company_id);

create index if not exists company_members_user_active_idx
  on public.company_members (user_id, is_active);

comment on table public.company_members is
  'Authoritative multi-tenant membership. Phase 2 RLS must use company_id from this table via auth.uid().';

comment on column public.company_members.role is
  'Existing DREVORA roles: Admin, Driver, Yardman, Cleaner, Supervisor, Mechanic, Transport Manager, Planner, Office Staff, Warehouse, Other.';

drop trigger if exists company_members_set_updated_at on public.company_members;
create trigger company_members_set_updated_at
  before update on public.company_members
  for each row
  execute function public.drevora_set_updated_at();

alter table public.company_members enable row level security;

revoke all on public.company_members from anon;
revoke all on public.company_members from authenticated;

drop policy if exists company_members_select_own on public.company_members;
create policy company_members_select_own
  on public.company_members
  for select
  to authenticated
  using (user_id = auth.uid() and is_active = true);

-- No INSERT / UPDATE / DELETE policies for authenticated or anon.
-- Membership writes: service_role / SQL Editor / controlled bootstrap only.
grant select on public.company_members to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Add nullable company_id to tenant ROOT / operational tables
--    Child tables use mandatory parent FKs (no company_id column here).
-- -----------------------------------------------------------------------------

alter table public.drivers
  add column if not exists company_id uuid references public.companies (id) on delete restrict;
create index if not exists drivers_company_id_idx on public.drivers (company_id);

alter table public.vehicles
  add column if not exists company_id uuid references public.companies (id) on delete restrict;
create index if not exists vehicles_company_id_idx on public.vehicles (company_id);

alter table public.documents
  add column if not exists company_id uuid references public.companies (id) on delete restrict;
create index if not exists documents_company_id_idx on public.documents (company_id);

alter table public.driver_reports
  add column if not exists company_id uuid references public.companies (id) on delete restrict;
create index if not exists driver_reports_company_id_idx on public.driver_reports (company_id);

alter table public.contacts
  add column if not exists company_id uuid references public.companies (id) on delete restrict;
create index if not exists contacts_company_id_idx on public.contacts (company_id);

alter table public.consumables
  add column if not exists company_id uuid references public.companies (id) on delete restrict;
create index if not exists consumables_company_id_idx on public.consumables (company_id);

alter table public.timesheets
  add column if not exists company_id uuid references public.companies (id) on delete restrict;
create index if not exists timesheets_company_id_idx on public.timesheets (company_id);

alter table public.holiday_requests
  add column if not exists company_id uuid references public.companies (id) on delete restrict;
create index if not exists holiday_requests_company_id_idx on public.holiday_requests (company_id);

alter table public.vehicle_checks
  add column if not exists company_id uuid references public.companies (id) on delete restrict;
create index if not exists vehicle_checks_company_id_idx on public.vehicle_checks (company_id);

comment on column public.drivers.company_id is 'Immutable tenant key. Legacy drivers.company text is transitional only.';
comment on column public.vehicles.company_id is 'Immutable tenant key. Do not introduce vehicles.company text.';
comment on column public.documents.company_id is 'Immutable tenant key. Legacy documents.company text is transitional only.';
comment on column public.driver_reports.company_id is 'Immutable tenant key. Legacy driver_reports.company text is transitional only.';
comment on column public.contacts.company_id is 'Immutable tenant key. Legacy contacts.company text is transitional only.';
comment on column public.consumables.company_id is 'Immutable tenant key. Required because vehicle_id/worker_id may be null.';
comment on column public.timesheets.company_id is 'Denormalised tenant key for RLS; keep aligned with drivers.company_id.';
comment on column public.holiday_requests.company_id is 'Denormalised tenant key for RLS; keep aligned with drivers.company_id.';
comment on column public.vehicle_checks.company_id is 'Denormalised tenant key for RLS; keep aligned with vehicles/drivers.company_id.';

-- Child tables WITHOUT company_id (Phase 2 scopes via parent.company_id):
--   timesheet_entries         → timesheets.id
--   vehicle_check_items       → vehicle_checks.id
--   vehicle_availability      → vehicles.id
--   worker_compliance_records → drivers.id
--   vehicle_compliance_records → vehicles.id

-- Parent FK indexes used later by RLS joins (idempotent)
create index if not exists timesheet_entries_timesheet_id_idx
  on public.timesheet_entries (timesheet_id);
create index if not exists vehicle_check_items_check_id_idx
  on public.vehicle_check_items (vehicle_check_id);
create index if not exists vehicle_availability_vehicle_id_idx
  on public.vehicle_availability (vehicle_id);
create index if not exists worker_compliance_records_worker_id_idx
  on public.worker_compliance_records (worker_id);
create index if not exists vehicle_compliance_records_vehicle_id_idx
  on public.vehicle_compliance_records (vehicle_id);

-- -----------------------------------------------------------------------------
-- 3) Safe backfill — only unambiguous company name / parent maps
-- -----------------------------------------------------------------------------

-- Dangerous: existing non-null company_id conflicts with unambiguous text resolution
do $$
declare
  conflict_count integer := 0;
begin
  select count(*)::integer into conflict_count
  from (
    select 1
    from public.drivers d
    where d.company_id is not null
      and public.drevora_resolve_unique_company_id(d.company) is not null
      and d.company_id <> public.drevora_resolve_unique_company_id(d.company)
    union all
    select 1
    from public.documents d
    where d.company_id is not null
      and public.drevora_resolve_unique_company_id(d.company) is not null
      and d.company_id <> public.drevora_resolve_unique_company_id(d.company)
    union all
    select 1
    from public.driver_reports r
    where r.company_id is not null
      and public.drevora_resolve_unique_company_id(r.company) is not null
      and r.company_id <> public.drevora_resolve_unique_company_id(r.company)
    union all
    select 1
    from public.contacts c
    where c.company_id is not null
      and public.drevora_resolve_unique_company_id(c.company) is not null
      and c.company_id <> public.drevora_resolve_unique_company_id(c.company)
  ) conflicts;

  if conflict_count > 0 then
    raise exception
      'DREVORA Phase 1 STOP: % row(s) have existing company_id conflicting with unambiguous legacy company text. No data was deleted. Resolve conflicts before re-running.',
      conflict_count;
  end if;
end $$;

-- ----- drivers -----
update public.drivers d
set company_id = public.drevora_resolve_unique_company_id(d.company)
where d.company_id is null
  and nullif(trim(coalesce(d.company, '')), '') is not null
  and public.drevora_resolve_unique_company_id(d.company) is not null;

-- ----- documents -----
update public.documents d
set company_id = public.drevora_resolve_unique_company_id(d.company)
where d.company_id is null
  and nullif(trim(coalesce(d.company, '')), '') is not null
  and public.drevora_resolve_unique_company_id(d.company) is not null;

-- ----- driver_reports -----
update public.driver_reports r
set company_id = public.drevora_resolve_unique_company_id(r.company)
where r.company_id is null
  and nullif(trim(coalesce(r.company, '')), '') is not null
  and public.drevora_resolve_unique_company_id(r.company) is not null;

-- ----- contacts -----
update public.contacts c
set company_id = public.drevora_resolve_unique_company_id(c.company)
where c.company_id is null
  and nullif(trim(coalesce(c.company, '')), '') is not null
  and public.drevora_resolve_unique_company_id(c.company) is not null;

-- ----- vehicles via current_driver.company_id (after drivers backfill) -----
-- Unassigned / demo vehicles with no resolvable worker stay company_id NULL.
update public.vehicles v
set company_id = d.company_id
from public.drivers d
where v.company_id is null
  and v.current_driver_id = d.id
  and d.company_id is not null;

-- ----- vehicles via current_driver.company text (unique name only) -----
update public.vehicles v
set company_id = public.drevora_resolve_unique_company_id(d.company)
from public.drivers d
where v.company_id is null
  and v.current_driver_id = d.id
  and public.drevora_resolve_unique_company_id(d.company) is not null;

-- Dangerous: consumables that uniquely resolve to TWO different companies
do $$
declare
  conflict_count integer := 0;
begin
  select count(*)::integer into conflict_count
  from public.consumables x
  inner join public.drivers dw on dw.id = x.worker_id
  inner join public.vehicles v on v.id = x.vehicle_id
  where dw.company_id is not null
    and v.company_id is not null
    and dw.company_id <> v.company_id;

  if conflict_count > 0 then
    raise exception
      'DREVORA Phase 1 STOP: % consumable row(s) resolve to two different companies via worker vs vehicle. Leave unresolved manually; do not auto-guess.',
      conflict_count;
  end if;
end $$;

-- ----- consumables via worker.company_id -----
update public.consumables x
set company_id = d.company_id
from public.drivers d
where x.company_id is null
  and x.worker_id = d.id
  and d.company_id is not null;

-- ----- consumables via vehicle.company_id (only when still null) -----
update public.consumables x
set company_id = v.company_id
from public.vehicles v
where x.company_id is null
  and x.vehicle_id = v.id
  and v.company_id is not null;

-- Dangerous: vehicle_checks that uniquely resolve to TWO different companies
do $$
declare
  conflict_count integer := 0;
begin
  select count(*)::integer into conflict_count
  from public.vehicle_checks vc
  inner join public.vehicles v on v.id = vc.vehicle_id
  inner join public.drivers d on d.id = vc.worker_id
  where v.company_id is not null
    and d.company_id is not null
    and v.company_id <> d.company_id;

  if conflict_count > 0 then
    raise exception
      'DREVORA Phase 1 STOP: % vehicle_check row(s) resolve to two different companies via vehicle vs worker. Leave unresolved manually; do not auto-guess.',
      conflict_count;
  end if;
end $$;

-- ----- timesheets via driver.company_id -----
update public.timesheets t
set company_id = d.company_id
from public.drivers d
where t.company_id is null
  and t.driver_id = d.id
  and d.company_id is not null;

-- ----- holiday_requests via worker.company_id -----
update public.holiday_requests h
set company_id = d.company_id
from public.drivers d
where h.company_id is null
  and h.worker_id = d.id
  and d.company_id is not null;

-- ----- vehicle_checks via vehicle.company_id, else worker.company_id -----
update public.vehicle_checks vc
set company_id = v.company_id
from public.vehicles v
where vc.company_id is null
  and vc.vehicle_id = v.id
  and v.company_id is not null;

update public.vehicle_checks vc
set company_id = d.company_id
from public.drivers d
where vc.company_id is null
  and vc.worker_id = d.id
  and d.company_id is not null;

-- NOTE: No automatic company_members insert here.
-- Link the current admin via supabase/bootstrap/20260713_link_current_admin_to_jagstransltd.sql

-- -----------------------------------------------------------------------------
-- 4) Auth-bound helpers for Phase 2 (company UUID based)
--    Bind membership to auth.uid() + company_members only.
--    Never return the oldest company. Never trust browser-supplied company.
-- -----------------------------------------------------------------------------
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
    and cm.is_active = true;
$$;

create or replace function public.drevora_auth_user_belongs_to_company_id(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.user_id = auth.uid()
      and cm.is_active = true
      and cm.company_id = p_company_id
  );
$$;

create or replace function public.drevora_auth_user_has_office_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
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
  -- Transitional worker link via email. Prefer drivers.user_id FK in a later migration.
  select d.id
  from public.drivers d
  inner join auth.users u on u.id = auth.uid()
  where lower(trim(coalesce(d.email, ''))) = lower(trim(coalesce(u.email, '')))
  order by d.created_at desc nulls last
  limit 1;
$$;

revoke all on function public.drevora_auth_user_company_ids() from public;
revoke all on function public.drevora_auth_user_belongs_to_company_id(uuid) from public;
revoke all on function public.drevora_auth_user_has_office_role() from public;
revoke all on function public.drevora_auth_user_driver_id() from public;
revoke all on function public.drevora_resolve_unique_company_id(text) from public;

grant execute on function public.drevora_auth_user_company_ids() to authenticated;
grant execute on function public.drevora_auth_user_belongs_to_company_id(uuid) to authenticated;
grant execute on function public.drevora_auth_user_has_office_role() to authenticated;
grant execute on function public.drevora_auth_user_driver_id() to authenticated;
grant execute on function public.drevora_resolve_unique_company_id(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5) Validation report
--    Unmatched legacy/demo rows → company_id NULL + RAISE NOTICE (Phase 1 continues).
--    Ambiguous company names → RAISE EXCEPTION (dangerous).
-- -----------------------------------------------------------------------------
do $$
declare
  ambiguous_name_count integer;
  drivers_total integer; drivers_matched integer; drivers_unmatched integer; drivers_ambiguous integer;
  documents_total integer; documents_matched integer; documents_unmatched integer; documents_ambiguous integer;
  reports_total integer; reports_matched integer; reports_unmatched integer; reports_ambiguous integer;
  contacts_total integer; contacts_matched integer; contacts_unmatched integer; contacts_ambiguous integer;
  vehicles_total integer; vehicles_matched integer; vehicles_unmatched integer;
  consumables_total integer; consumables_matched integer; consumables_unmatched integer;
  timesheets_total integer; timesheets_matched integer; timesheets_unmatched integer;
  holidays_total integer; holidays_matched integer; holidays_unmatched integer;
  checks_total integer; checks_matched integer; checks_unmatched integer;
  unmatched_total integer;
begin
  select count(*)::integer into ambiguous_name_count
  from (
    select 1
    from public.companies c
    where nullif(trim(coalesce(c.name, '')), '') is not null
    group by lower(trim(coalesce(c.name, '')))
    having count(*) > 1
  ) ambiguous_names;

  select count(*)::integer into drivers_total from public.drivers;
  select count(*)::integer into drivers_matched from public.drivers where company_id is not null;
  select count(*)::integer into drivers_ambiguous
  from public.drivers d
  where d.company_id is null
    and nullif(trim(coalesce(d.company, '')), '') is not null
    and (
      select count(*)::integer
      from public.companies c
      where lower(trim(coalesce(c.name, ''))) = lower(trim(d.company))
    ) > 1;
  drivers_unmatched := drivers_total - drivers_matched;

  select count(*)::integer into documents_total from public.documents;
  select count(*)::integer into documents_matched from public.documents where company_id is not null;
  select count(*)::integer into documents_ambiguous
  from public.documents d
  where d.company_id is null
    and nullif(trim(coalesce(d.company, '')), '') is not null
    and (
      select count(*)::integer
      from public.companies c
      where lower(trim(coalesce(c.name, ''))) = lower(trim(d.company))
    ) > 1;
  documents_unmatched := documents_total - documents_matched;

  select count(*)::integer into reports_total from public.driver_reports;
  select count(*)::integer into reports_matched from public.driver_reports where company_id is not null;
  select count(*)::integer into reports_ambiguous
  from public.driver_reports r
  where r.company_id is null
    and nullif(trim(coalesce(r.company, '')), '') is not null
    and (
      select count(*)::integer
      from public.companies c
      where lower(trim(coalesce(c.name, ''))) = lower(trim(r.company))
    ) > 1;
  reports_unmatched := reports_total - reports_matched;

  select count(*)::integer into contacts_total from public.contacts;
  select count(*)::integer into contacts_matched from public.contacts where company_id is not null;
  select count(*)::integer into contacts_ambiguous
  from public.contacts c
  where c.company_id is null
    and nullif(trim(coalesce(c.company, '')), '') is not null
    and (
      select count(*)::integer
      from public.companies x
      where lower(trim(coalesce(x.name, ''))) = lower(trim(c.company))
    ) > 1;
  contacts_unmatched := contacts_total - contacts_matched;

  select count(*)::integer into vehicles_total from public.vehicles;
  select count(*)::integer into vehicles_matched from public.vehicles where company_id is not null;
  vehicles_unmatched := vehicles_total - vehicles_matched;

  select count(*)::integer into consumables_total from public.consumables;
  select count(*)::integer into consumables_matched from public.consumables where company_id is not null;
  consumables_unmatched := consumables_total - consumables_matched;

  select count(*)::integer into timesheets_total from public.timesheets;
  select count(*)::integer into timesheets_matched from public.timesheets where company_id is not null;
  timesheets_unmatched := timesheets_total - timesheets_matched;

  select count(*)::integer into holidays_total from public.holiday_requests;
  select count(*)::integer into holidays_matched from public.holiday_requests where company_id is not null;
  holidays_unmatched := holidays_total - holidays_matched;

  select count(*)::integer into checks_total from public.vehicle_checks;
  select count(*)::integer into checks_matched from public.vehicle_checks where company_id is not null;
  checks_unmatched := checks_total - checks_matched;

  unmatched_total :=
      drivers_unmatched
    + documents_unmatched
    + reports_unmatched
    + contacts_unmatched
    + vehicles_unmatched
    + consumables_unmatched
    + timesheets_unmatched
    + holidays_unmatched
    + checks_unmatched;

  raise notice 'DREVORA Phase 1 backfill report';
  raise notice 'ambiguous company names in companies table: %', ambiguous_name_count;
  raise notice 'drivers: total=%, matched=%, unmatched_null_company_id=%, ambiguous_text=%',
    drivers_total, drivers_matched, drivers_unmatched, drivers_ambiguous;
  raise notice 'documents: total=%, matched=%, unmatched_null_company_id=%, ambiguous_text=%',
    documents_total, documents_matched, documents_unmatched, documents_ambiguous;
  raise notice 'driver_reports: total=%, matched=%, unmatched_null_company_id=%, ambiguous_text=%',
    reports_total, reports_matched, reports_unmatched, reports_ambiguous;
  raise notice 'contacts: total=%, matched=%, unmatched_null_company_id=%, ambiguous_text=%',
    contacts_total, contacts_matched, contacts_unmatched, contacts_ambiguous;
  raise notice 'vehicles: total=%, matched=%, unmatched_null_company_id=% (unassigned/demo stay NULL)',
    vehicles_total, vehicles_matched, vehicles_unmatched;
  raise notice 'consumables: total=%, matched=%, unmatched_null_company_id=%',
    consumables_total, consumables_matched, consumables_unmatched;
  raise notice 'timesheets: total=%, matched=%, unmatched_null_company_id=%',
    timesheets_total, timesheets_matched, timesheets_unmatched;
  raise notice 'holiday_requests: total=%, matched=%, unmatched_null_company_id=%',
    holidays_total, holidays_matched, holidays_unmatched;
  raise notice 'vehicle_checks: total=%, matched=%, unmatched_null_company_id=%',
    checks_total, checks_matched, checks_unmatched;
  raise notice 'unmatched legacy/demo rows left as company_id NULL (not deleted): %', unmatched_total;

  -- Dangerous: duplicate normalised company names make unique resolution impossible.
  if ambiguous_name_count > 0 then
    raise exception
      'DREVORA Phase 1 STOP: % ambiguous normalised company name(s) in public.companies. Rename/merge duplicates so each lower(trim(name)) is unique, then re-run. Unmatched demo rows alone do not block Phase 1.',
      ambiguous_name_count;
  end if;

  -- Ambiguous text on rows that could not be resolved because of those duplicates
  -- (defensive — should already be covered by ambiguous_name_count > 0)
  if drivers_ambiguous > 0
     or documents_ambiguous > 0
     or reports_ambiguous > 0
     or contacts_ambiguous > 0 then
    raise exception
      'DREVORA Phase 1 STOP: rows reference ambiguous company text (drivers=%, documents=%, reports=%, contacts=%). Fix company name uniqueness first.',
      drivers_ambiguous, documents_ambiguous, reports_ambiguous, contacts_ambiguous;
  end if;

  raise notice 'DREVORA Phase 1 foundation OK: unambiguous matches filled; unmatched legacy/demo rows remain company_id NULL. Business-table RLS still disabled. Run bootstrap SQL separately to link the current admin.';
end $$;

-- -----------------------------------------------------------------------------
-- 6) Intentionally NOT enabling RLS on Security Advisor business tables
-- -----------------------------------------------------------------------------
-- companies, drivers, vehicles, documents, driver_reports, contacts, consumables,
-- timesheets, timesheet_entries, holiday_requests, vehicle_checks,
-- vehicle_check_items, vehicle_availability, worker_compliance_records,
-- vehicle_compliance_records → remain RLS-disabled until Phase 2.
-- Existing anon/authenticated grants on those tables are NOT revoked in Phase 1.
-- Security Advisor findings are NOT fixed by this migration alone.

notify pgrst, 'reload schema';

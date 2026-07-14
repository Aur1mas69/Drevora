-- =============================================================================
-- DREVORA — Phase 1 RLS PREFLIGHT (READ-ONLY)
-- File: supabase/diagnostics/20260712_rls_phase1_preflight.sql
-- =============================================================================
-- PURPOSE
--   Simulate whether supabase/migrations/20260712220000_rls_tenant_membership_foundation.sql
--   WOULD PASS or WOULD FAIL against the LIVE schema, without changing any data.
--
-- RULES
--   Read-only only: SELECT / WITH / joins / aggregates.
--   No CREATE, ALTER, DROP, INSERT, UPDATE, DELETE, TRUNCATE,
--   GRANT, REVOKE, TEMP TABLE, DO blocks, functions, triggers, or policies.
--
-- HOW TO RUN
--   Paste into Supabase SQL Editor and run section-by-section, or run the whole file.
--   Review each result set carefully before applying Phase 1.
-- =============================================================================


-- =============================================================================
-- 0) COLUMN PRESENCE (company_id / cleaned_at) — no schema changes
-- =============================================================================
select
  c.table_name,
  bool_or(c.column_name = 'company_id') as has_company_id,
  bool_or(c.column_name = 'company') as has_company_text,
  bool_or(c.column_name = 'cleaned_at') as has_cleaned_at
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'companies',
    'drivers',
    'vehicles',
    'documents',
    'driver_reports',
    'contacts',
    'consumables',
    'timesheets',
    'timesheet_entries',
    'holiday_requests',
    'vehicle_checks',
    'vehicle_check_items',
    'vehicle_availability',
    'worker_compliance_records',
    'vehicle_compliance_records',
    'company_members'
  )
group by c.table_name
order by c.table_name;


-- =============================================================================
-- 1) COMPANIES — exact + normalised names; duplicates; Jagstrans-like rows
-- =============================================================================

-- 1a) All companies
select
  c.id,
  c.name as exact_name,
  lower(trim(coalesce(c.name, ''))) as normalised_name,
  c.created_at
from public.companies c
order by lower(trim(coalesce(c.name, ''))), c.created_at nulls last, c.id;

-- 1b) Exact-name duplicates (same exact name string, count > 1)
select
  c.name as exact_name,
  count(*)::integer as row_count,
  array_agg(c.id order by c.created_at nulls last) as company_ids
from public.companies c
where c.name is not null
group by c.name
having count(*) > 1
order by c.name;

-- 1c) Normalised-name duplicates (lower(trim(name)), count > 1)
select
  lower(trim(coalesce(c.name, ''))) as normalised_name,
  count(*)::integer as row_count,
  array_agg(c.id order by c.created_at nulls last) as company_ids,
  array_agg(c.name order by c.created_at nulls last) as exact_names
from public.companies c
where nullif(trim(coalesce(c.name, '')), '') is not null
group by lower(trim(coalesce(c.name, '')))
having count(*) > 1
order by normalised_name;

-- 1d) Similar Jagstrans company records (do not auto-pick oldest)
select
  c.id,
  c.name as exact_name,
  lower(trim(coalesce(c.name, ''))) as normalised_name,
  c.created_at
from public.companies c
where lower(trim(coalesce(c.name, ''))) like '%jagstran%'
order by c.created_at nulls last, c.id;


-- =============================================================================
-- 2) EXISTING ROLE VALUES
-- =============================================================================

-- 2a) Distinct roles currently stored on drivers (workers)
select
  coalesce(nullif(trim(d.role), ''), '(null/blank)') as role_value,
  count(*)::integer as row_count
from public.drivers d
group by coalesce(nullif(trim(d.role), ''), '(null/blank)')
order by row_count desc, role_value;

-- 2b) Is the exact string 'Admin' present in live drivers.role values?
select
  exists (
    select 1
    from public.drivers d
    where d.role = 'Admin'
  ) as admin_role_present_in_drivers,
  (
    select count(*)::integer
    from public.drivers d
    where d.role = 'Admin'
  ) as admin_role_row_count;

-- 2c) Check constraints on public.drivers (role enum check if any)
select
  tc.constraint_type,
  tc.constraint_name,
  cc.check_clause
from information_schema.table_constraints tc
left join information_schema.check_constraints cc
  on cc.constraint_schema = tc.constraint_schema
 and cc.constraint_name = tc.constraint_name
where tc.table_schema = 'public'
  and tc.table_name = 'drivers'
  and (
    tc.constraint_type in ('CHECK', 'UNIQUE')
    or lower(coalesce(cc.check_clause, '')) like '%role%'
  )
order by tc.constraint_type, tc.constraint_name;

-- NOTE (application / TypeScript — not queried from Postgres):
--   src/services/driversService.ts DriverRole includes exact value 'Admin'.
--   src/lib/workerRoleSummary.ts WORKER_OFFICE_ROLES includes 'Admin'.
--   Live DB may still have zero drivers with role = 'Admin'; confirm 2b.


-- =============================================================================
-- 3) AUTH USERS (no secrets) — identify intended Jagstransltd admin manually
-- =============================================================================
-- Replace the email filter in the optional query with the verified admin email.
-- Do not guess from company created_at.

select
  u.id as auth_user_id,
  u.email,
  u.email_confirmed_at is not null as email_confirmed,
  u.email_confirmed_at,
  u.created_at,
  u.last_sign_in_at,
  case
    when lower(trim(coalesce(u.email, ''))) like '%jagstran%' then 'email_mentions_jagstran'
    else 'review_manually'
  end as jagstrans_hint
from auth.users u
order by u.created_at nulls last, u.email;

-- Optional focused filter (edit email then run):
-- select
--   u.id as auth_user_id,
--   u.email,
--   u.email_confirmed_at is not null as email_confirmed,
--   u.created_at
-- from auth.users u
-- where lower(trim(u.email)) = lower(trim('YOUR_VERIFIED_ADMIN_EMAIL@example.com'));


-- =============================================================================
-- 4a) ROOT / OPERATIONAL TABLE BACKFILL SIMULATION
-- =============================================================================
with
company_name_stats as (
  select
    lower(trim(coalesce(c.name, ''))) as normalised_name,
    count(*)::integer as name_count,
    min(c.id::text)::uuid as sample_id
  from public.companies c
  where nullif(trim(coalesce(c.name, '')), '') is not null
  group by lower(trim(coalesce(c.name, '')))
),
unique_company_names as (
  select normalised_name, sample_id as company_id
  from company_name_stats
  where name_count = 1
),
ambiguous_company_names as (
  select normalised_name, name_count
  from company_name_stats
  where name_count > 1
),
driver_resolution as (
  select
    d.id as driver_id,
    nullif(trim(coalesce(d.company, '')), '') as company_text,
    case
      when nullif(trim(coalesce(d.company, '')), '') is null then 'unmatched_empty_text'
      when exists (
        select 1 from ambiguous_company_names a
        where a.normalised_name = lower(trim(coalesce(d.company, '')))
      ) then 'ambiguous'
      when exists (
        select 1 from unique_company_names u
        where u.normalised_name = lower(trim(coalesce(d.company, '')))
      ) then 'unique'
      else 'unmatched_no_company_row'
    end as resolve_status,
    (
      select u.company_id
      from unique_company_names u
      where u.normalised_name = lower(trim(coalesce(d.company, '')))
      limit 1
    ) as simulated_company_id
  from public.drivers d
),
vehicle_resolution as (
  select
    v.id as vehicle_id,
    v.registration,
    v.current_driver_id,
    case
      when v.current_driver_id is null then 'unassigned_no_driver'
      when not exists (
        select 1 from public.drivers d where d.id = v.current_driver_id
      ) then 'broken_driver_fk'
      else 'has_driver'
    end as driver_link_status,
    dr.resolve_status as driver_resolve_status,
    dr.simulated_company_id
  from public.vehicles v
  left join driver_resolution dr on dr.driver_id = v.current_driver_id
),
document_resolution as (
  select
    d.id,
    case
      when nullif(trim(coalesce(d.company, '')), '') is null then 'unmatched_empty_text'
      when exists (
        select 1 from ambiguous_company_names a
        where a.normalised_name = lower(trim(coalesce(d.company, '')))
      ) then 'ambiguous'
      when exists (
        select 1 from unique_company_names u
        where u.normalised_name = lower(trim(coalesce(d.company, '')))
      ) then 'unique'
      else 'unmatched_no_company_row'
    end as resolve_status
  from public.documents d
),
report_resolution as (
  select
    r.id,
    case
      when nullif(trim(coalesce(r.company, '')), '') is null then 'unmatched_empty_text'
      when exists (
        select 1 from ambiguous_company_names a
        where a.normalised_name = lower(trim(coalesce(r.company, '')))
      ) then 'ambiguous'
      when exists (
        select 1 from unique_company_names u
        where u.normalised_name = lower(trim(coalesce(r.company, '')))
      ) then 'unique'
      else 'unmatched_no_company_row'
    end as resolve_status
  from public.driver_reports r
),
contact_resolution as (
  select
    c.id,
    case
      when nullif(trim(coalesce(c.company, '')), '') is null then 'unmatched_empty_text'
      when exists (
        select 1 from ambiguous_company_names a
        where a.normalised_name = lower(trim(coalesce(c.company, '')))
      ) then 'ambiguous'
      when exists (
        select 1 from unique_company_names u
        where u.normalised_name = lower(trim(coalesce(c.company, '')))
      ) then 'unique'
      else 'unmatched_no_company_row'
    end as resolve_status
  from public.contacts c
),
consumable_resolution as (
  select
    x.id,
    x.worker_id,
    x.vehicle_id,
    dr.simulated_company_id as worker_company_id,
    vr.simulated_company_id as vehicle_company_id,
    case
      when x.worker_id is not null
       and not exists (select 1 from public.drivers d where d.id = x.worker_id)
        then 'broken_worker_fk'
      when x.vehicle_id is not null
       and not exists (select 1 from public.vehicles v where v.id = x.vehicle_id)
        then 'broken_vehicle_fk'
      when dr.simulated_company_id is not null
       and vr.simulated_company_id is not null
       and dr.simulated_company_id <> vr.simulated_company_id
        then 'worker_vehicle_company_conflict'
      when coalesce(dr.simulated_company_id, vr.simulated_company_id) is not null
        then 'unique'
      when x.worker_id is null and x.vehicle_id is null
        then 'unmatched_no_parent'
      when x.worker_id is not null and dr.resolve_status = 'ambiguous'
        then 'ambiguous'
      when x.vehicle_id is not null and vr.driver_resolve_status = 'ambiguous'
        then 'ambiguous'
      else 'unmatched'
    end as resolve_status
  from public.consumables x
  left join driver_resolution dr on dr.driver_id = x.worker_id
  left join vehicle_resolution vr on vr.vehicle_id = x.vehicle_id
),
timesheet_resolution as (
  select
    t.id,
    t.driver_id,
    case
      when not exists (select 1 from public.drivers d where d.id = t.driver_id)
        then 'broken_driver_fk'
      when dr.resolve_status = 'unique' then 'unique'
      when dr.resolve_status = 'ambiguous' then 'ambiguous'
      else 'unmatched'
    end as resolve_status
  from public.timesheets t
  left join driver_resolution dr on dr.driver_id = t.driver_id
),
holiday_resolution as (
  select
    h.id,
    h.worker_id,
    case
      when not exists (select 1 from public.drivers d where d.id = h.worker_id)
        then 'broken_worker_fk'
      when dr.resolve_status = 'unique' then 'unique'
      when dr.resolve_status = 'ambiguous' then 'ambiguous'
      else 'unmatched'
    end as resolve_status
  from public.holiday_requests h
  left join driver_resolution dr on dr.driver_id = h.worker_id
),
vehicle_check_resolution as (
  select
    vc.id,
    vc.vehicle_id,
    vc.worker_id,
    vr.simulated_company_id as vehicle_company_id,
    dr.simulated_company_id as worker_company_id,
    case
      when not exists (select 1 from public.vehicles v where v.id = vc.vehicle_id)
        then 'broken_vehicle_fk'
      when not exists (select 1 from public.drivers d where d.id = vc.worker_id)
        then 'broken_worker_fk'
      when vr.simulated_company_id is not null
       and dr.simulated_company_id is not null
       and vr.simulated_company_id <> dr.simulated_company_id
        then 'worker_vehicle_company_conflict'
      when vr.simulated_company_id is not null then 'unique_via_vehicle'
      when dr.simulated_company_id is not null then 'unique_via_worker'
      when vr.driver_resolve_status = 'ambiguous' or dr.resolve_status = 'ambiguous'
        then 'ambiguous'
      else 'unmatched'
    end as resolve_status
  from public.vehicle_checks vc
  left join vehicle_resolution vr on vr.vehicle_id = vc.vehicle_id
  left join driver_resolution dr on dr.driver_id = vc.worker_id
)
select * from (
  select
    'drivers'::text as table_name,
    count(*)::integer as total_rows,
    count(*) filter (where resolve_status = 'unique')::integer as uniquely_resolvable,
    count(*) filter (where resolve_status like 'unmatched%')::integer as unmatched_rows,
    count(*) filter (where resolve_status = 'ambiguous')::integer as ambiguous_rows,
    0::integer as broken_or_missing_parent,
    0::integer as worker_vehicle_conflicts
  from driver_resolution
  union all
  select
    'vehicles',
    count(*)::integer,
    count(*) filter (where driver_link_status = 'has_driver' and driver_resolve_status = 'unique')::integer,
    count(*) filter (
      where driver_link_status in ('unassigned_no_driver', 'broken_driver_fk')
         or driver_resolve_status like 'unmatched%'
         or driver_resolve_status is null
    )::integer,
    count(*) filter (where driver_resolve_status = 'ambiguous')::integer,
    count(*) filter (where driver_link_status = 'broken_driver_fk')::integer,
    0
  from vehicle_resolution
  union all
  select
    'documents',
    count(*)::integer,
    count(*) filter (where resolve_status = 'unique')::integer,
    count(*) filter (where resolve_status like 'unmatched%')::integer,
    count(*) filter (where resolve_status = 'ambiguous')::integer,
    0, 0
  from document_resolution
  union all
  select
    'driver_reports',
    count(*)::integer,
    count(*) filter (where resolve_status = 'unique')::integer,
    count(*) filter (where resolve_status like 'unmatched%')::integer,
    count(*) filter (where resolve_status = 'ambiguous')::integer,
    0, 0
  from report_resolution
  union all
  select
    'contacts',
    count(*)::integer,
    count(*) filter (where resolve_status = 'unique')::integer,
    count(*) filter (where resolve_status like 'unmatched%')::integer,
    count(*) filter (where resolve_status = 'ambiguous')::integer,
    0, 0
  from contact_resolution
  union all
  select
    'consumables',
    count(*)::integer,
    count(*) filter (where resolve_status = 'unique')::integer,
    count(*) filter (where resolve_status in ('unmatched', 'unmatched_no_parent'))::integer,
    count(*) filter (where resolve_status = 'ambiguous')::integer,
    count(*) filter (where resolve_status like 'broken_%')::integer,
    count(*) filter (where resolve_status = 'worker_vehicle_company_conflict')::integer
  from consumable_resolution
  union all
  select
    'timesheets',
    count(*)::integer,
    count(*) filter (where resolve_status = 'unique')::integer,
    count(*) filter (where resolve_status = 'unmatched')::integer,
    count(*) filter (where resolve_status = 'ambiguous')::integer,
    count(*) filter (where resolve_status = 'broken_driver_fk')::integer,
    0
  from timesheet_resolution
  union all
  select
    'holiday_requests',
    count(*)::integer,
    count(*) filter (where resolve_status = 'unique')::integer,
    count(*) filter (where resolve_status = 'unmatched')::integer,
    count(*) filter (where resolve_status = 'ambiguous')::integer,
    count(*) filter (where resolve_status = 'broken_worker_fk')::integer,
    0
  from holiday_resolution
  union all
  select
    'vehicle_checks',
    count(*)::integer,
    count(*) filter (where resolve_status like 'unique%')::integer,
    count(*) filter (where resolve_status = 'unmatched')::integer,
    count(*) filter (where resolve_status = 'ambiguous')::integer,
    count(*) filter (where resolve_status like 'broken_%')::integer,
    count(*) filter (where resolve_status = 'worker_vehicle_company_conflict')::integer
  from vehicle_check_resolution
) root_summary
order by table_name;


-- =============================================================================
-- 4b) CHILD TABLES VIA PARENT
-- =============================================================================
with
company_name_stats as (
  select
    lower(trim(coalesce(c.name, ''))) as normalised_name,
    count(*)::integer as name_count,
    min(c.id::text)::uuid as sample_id
  from public.companies c
  where nullif(trim(coalesce(c.name, '')), '') is not null
  group by lower(trim(coalesce(c.name, '')))
),
unique_company_names as (
  select normalised_name, sample_id as company_id
  from company_name_stats
  where name_count = 1
),
driver_resolution as (
  select
    d.id as driver_id,
    case
      when nullif(trim(coalesce(d.company, '')), '') is null then 'unmatched_empty_text'
      when (
        select count(*) from public.companies c
        where lower(trim(coalesce(c.name, ''))) = lower(trim(coalesce(d.company, '')))
      ) > 1 then 'ambiguous'
      when exists (
        select 1 from unique_company_names u
        where u.normalised_name = lower(trim(coalesce(d.company, '')))
      ) then 'unique'
      else 'unmatched_no_company_row'
    end as resolve_status,
    (
      select u.company_id from unique_company_names u
      where u.normalised_name = lower(trim(coalesce(d.company, '')))
      limit 1
    ) as simulated_company_id
  from public.drivers d
),
vehicle_resolution as (
  select
    v.id as vehicle_id,
    v.current_driver_id,
    case
      when v.current_driver_id is null then 'unassigned_no_driver'
      when not exists (select 1 from public.drivers d where d.id = v.current_driver_id)
        then 'broken_driver_fk'
      else 'has_driver'
    end as driver_link_status,
    dr.resolve_status as driver_resolve_status,
    dr.simulated_company_id
  from public.vehicles v
  left join driver_resolution dr on dr.driver_id = v.current_driver_id
),
timesheet_resolution as (
  select
    t.id,
    case
      when not exists (select 1 from public.drivers d where d.id = t.driver_id)
        then 'broken_driver_fk'
      when dr.resolve_status = 'unique' then 'unique'
      when dr.resolve_status = 'ambiguous' then 'ambiguous'
      else 'unmatched'
    end as resolve_status
  from public.timesheets t
  left join driver_resolution dr on dr.driver_id = t.driver_id
),
vehicle_check_resolution as (
  select
    vc.id,
    case
      when not exists (select 1 from public.vehicles v where v.id = vc.vehicle_id)
        then 'broken_vehicle_fk'
      when not exists (select 1 from public.drivers d where d.id = vc.worker_id)
        then 'broken_worker_fk'
      when vr.simulated_company_id is not null
       and dr.simulated_company_id is not null
       and vr.simulated_company_id <> dr.simulated_company_id
        then 'worker_vehicle_company_conflict'
      when vr.simulated_company_id is not null then 'unique_via_vehicle'
      when dr.simulated_company_id is not null then 'unique_via_worker'
      when vr.driver_resolve_status = 'ambiguous' or dr.resolve_status = 'ambiguous'
        then 'ambiguous'
      else 'unmatched'
    end as resolve_status
  from public.vehicle_checks vc
  left join vehicle_resolution vr on vr.vehicle_id = vc.vehicle_id
  left join driver_resolution dr on dr.driver_id = vc.worker_id
)
select * from (
  select
    'timesheet_entries'::text as table_name,
    count(*)::integer as total_rows,
    count(*) filter (where te.timesheet_id is null)::integer as null_parent_id,
    count(*) filter (
      where te.timesheet_id is not null
        and not exists (select 1 from public.timesheets t where t.id = te.timesheet_id)
    )::integer as missing_parent_row,
    count(*) filter (
      where exists (
        select 1 from timesheet_resolution tr
        where tr.id = te.timesheet_id and tr.resolve_status = 'unique'
      )
    )::integer as parent_uniquely_resolvable,
    count(*) filter (
      where exists (
        select 1 from timesheet_resolution tr
        where tr.id = te.timesheet_id and tr.resolve_status = 'unmatched'
      )
    )::integer as parent_unmatched,
    count(*) filter (
      where exists (
        select 1 from timesheet_resolution tr
        where tr.id = te.timesheet_id and tr.resolve_status = 'ambiguous'
      )
    )::integer as parent_ambiguous
  from public.timesheet_entries te
  union all
  select
    'vehicle_check_items',
    count(*)::integer,
    count(*) filter (where i.vehicle_check_id is null)::integer,
    count(*) filter (
      where i.vehicle_check_id is not null
        and not exists (select 1 from public.vehicle_checks vc where vc.id = i.vehicle_check_id)
    )::integer,
    count(*) filter (
      where exists (
        select 1 from vehicle_check_resolution r
        where r.id = i.vehicle_check_id and r.resolve_status like 'unique%'
      )
    )::integer,
    count(*) filter (
      where exists (
        select 1 from vehicle_check_resolution r
        where r.id = i.vehicle_check_id and r.resolve_status = 'unmatched'
      )
    )::integer,
    count(*) filter (
      where exists (
        select 1 from vehicle_check_resolution r
        where r.id = i.vehicle_check_id
          and r.resolve_status in ('ambiguous', 'worker_vehicle_company_conflict')
      )
    )::integer
  from public.vehicle_check_items i
  union all
  select
    'vehicle_availability',
    count(*)::integer,
    count(*) filter (where a.vehicle_id is null)::integer,
    count(*) filter (
      where a.vehicle_id is not null
        and not exists (select 1 from public.vehicles v where v.id = a.vehicle_id)
    )::integer,
    count(*) filter (
      where exists (
        select 1 from vehicle_resolution vr
        where vr.vehicle_id = a.vehicle_id
          and vr.driver_link_status = 'has_driver'
          and vr.driver_resolve_status = 'unique'
      )
    )::integer,
    count(*) filter (
      where exists (
        select 1 from vehicle_resolution vr
        where vr.vehicle_id = a.vehicle_id
          and (
            vr.driver_link_status <> 'has_driver'
            or vr.driver_resolve_status like 'unmatched%'
            or vr.driver_resolve_status is null
          )
      )
    )::integer,
    count(*) filter (
      where exists (
        select 1 from vehicle_resolution vr
        where vr.vehicle_id = a.vehicle_id and vr.driver_resolve_status = 'ambiguous'
      )
    )::integer
  from public.vehicle_availability a
  union all
  select
    'worker_compliance_records',
    count(*)::integer,
    count(*) filter (where w.worker_id is null)::integer,
    count(*) filter (
      where w.worker_id is not null
        and not exists (select 1 from public.drivers d where d.id = w.worker_id)
    )::integer,
    count(*) filter (
      where exists (
        select 1 from driver_resolution dr
        where dr.driver_id = w.worker_id and dr.resolve_status = 'unique'
      )
    )::integer,
    count(*) filter (
      where exists (
        select 1 from driver_resolution dr
        where dr.driver_id = w.worker_id and dr.resolve_status like 'unmatched%'
      )
    )::integer,
    count(*) filter (
      where exists (
        select 1 from driver_resolution dr
        where dr.driver_id = w.worker_id and dr.resolve_status = 'ambiguous'
      )
    )::integer
  from public.worker_compliance_records w
  union all
  select
    'vehicle_compliance_records',
    count(*)::integer,
    count(*) filter (where vc.vehicle_id is null)::integer,
    count(*) filter (
      where vc.vehicle_id is not null
        and not exists (select 1 from public.vehicles v where v.id = vc.vehicle_id)
    )::integer,
    count(*) filter (
      where exists (
        select 1 from vehicle_resolution vr
        where vr.vehicle_id = vc.vehicle_id
          and vr.driver_link_status = 'has_driver'
          and vr.driver_resolve_status = 'unique'
      )
    )::integer,
    count(*) filter (
      where exists (
        select 1 from vehicle_resolution vr
        where vr.vehicle_id = vc.vehicle_id
          and (
            vr.driver_link_status <> 'has_driver'
            or vr.driver_resolve_status like 'unmatched%'
            or vr.driver_resolve_status is null
          )
      )
    )::integer,
    count(*) filter (
      where exists (
        select 1 from vehicle_resolution vr
        where vr.vehicle_id = vc.vehicle_id and vr.driver_resolve_status = 'ambiguous'
      )
    )::integer
  from public.vehicle_compliance_records vc
) child_summary
order by table_name;


-- =============================================================================
-- 5) VEHICLES SPECIAL AUDIT
-- =============================================================================
with
company_name_stats as (
  select
    lower(trim(coalesce(c.name, ''))) as normalised_name,
    count(*)::integer as name_count,
    min(c.id::text)::uuid as sample_id
  from public.companies c
  where nullif(trim(coalesce(c.name, '')), '') is not null
  group by lower(trim(coalesce(c.name, '')))
),
unique_company_names as (
  select normalised_name, sample_id as company_id
  from company_name_stats
  where name_count = 1
),
driver_resolution as (
  select
    d.id as driver_id,
    case
      when nullif(trim(coalesce(d.company, '')), '') is null then 'unmatched_empty_text'
      when (
        select count(*) from public.companies c
        where lower(trim(coalesce(c.name, ''))) = lower(trim(coalesce(d.company, '')))
      ) > 1 then 'ambiguous'
      when exists (
        select 1 from unique_company_names u
        where u.normalised_name = lower(trim(coalesce(d.company, '')))
      ) then 'unique'
      else 'unmatched_no_company_row'
    end as resolve_status,
    (
      select u.company_id from unique_company_names u
      where u.normalised_name = lower(trim(coalesce(d.company, '')))
      limit 1
    ) as simulated_company_id
  from public.drivers d
)
select
  count(*)::integer as total_vehicles,
  count(*) filter (where v.current_driver_id is not null)::integer as with_current_driver,
  count(*) filter (
    where v.current_driver_id is not null
      and exists (
        select 1 from driver_resolution dr
        where dr.driver_id = v.current_driver_id and dr.resolve_status = 'unique'
      )
  )::integer as worker_resolves_uniquely,
  count(*) filter (where v.current_driver_id is null)::integer as unassigned_vehicles,
  count(*) filter (
    where v.current_driver_id is not null
      and not exists (select 1 from public.drivers d where d.id = v.current_driver_id)
  )::integer as missing_worker_references,
  count(*) filter (
    where v.current_driver_id is null
       or not exists (select 1 from public.drivers d where d.id = v.current_driver_id)
       or exists (
         select 1 from driver_resolution dr
         where dr.driver_id = v.current_driver_id
           and dr.resolve_status <> 'unique'
       )
  )::integer as cannot_assign_safely
from public.vehicles v;

-- Sample unresolved vehicles (max 20)
with
company_name_stats as (
  select
    lower(trim(coalesce(c.name, ''))) as normalised_name,
    count(*)::integer as name_count,
    min(c.id::text)::uuid as sample_id
  from public.companies c
  where nullif(trim(coalesce(c.name, '')), '') is not null
  group by lower(trim(coalesce(c.name, '')))
),
unique_company_names as (
  select normalised_name, sample_id as company_id
  from company_name_stats
  where name_count = 1
),
driver_resolution as (
  select
    d.id as driver_id,
    d.company as driver_company_text,
    case
      when nullif(trim(coalesce(d.company, '')), '') is null then 'unmatched_empty_text'
      when (
        select count(*) from public.companies c
        where lower(trim(coalesce(c.name, ''))) = lower(trim(coalesce(d.company, '')))
      ) > 1 then 'ambiguous'
      when exists (
        select 1 from unique_company_names u
        where u.normalised_name = lower(trim(coalesce(d.company, '')))
      ) then 'unique'
      else 'unmatched_no_company_row'
    end as resolve_status
  from public.drivers d
)
select
  v.id as vehicle_id,
  v.registration,
  v.current_driver_id,
  dr.resolve_status as driver_company_resolve_status,
  dr.driver_company_text,
  case
    when v.current_driver_id is null then 'unassigned_no_driver'
    when not exists (select 1 from public.drivers d where d.id = v.current_driver_id)
      then 'broken_driver_fk'
    when dr.resolve_status <> 'unique' then 'driver_company_not_unique'
    else 'resolvable'
  end as issue
from public.vehicles v
left join driver_resolution dr on dr.driver_id = v.current_driver_id
where
  v.current_driver_id is null
  or not exists (select 1 from public.drivers d where d.id = v.current_driver_id)
  or coalesce(dr.resolve_status, 'unmatched') <> 'unique'
order by v.registration nulls last, v.id
limit 20;


-- =============================================================================
-- 6) CONFLICT SAMPLES — consumables & vehicle_checks (max 50 each)
-- =============================================================================
with
company_name_stats as (
  select
    lower(trim(coalesce(c.name, ''))) as normalised_name,
    count(*)::integer as name_count,
    min(c.id::text)::uuid as sample_id
  from public.companies c
  where nullif(trim(coalesce(c.name, '')), '') is not null
  group by lower(trim(coalesce(c.name, '')))
),
unique_company_names as (
  select normalised_name, sample_id as company_id
  from company_name_stats
  where name_count = 1
),
driver_resolution as (
  select
    d.id as driver_id,
    (
      select u.company_id from unique_company_names u
      where u.normalised_name = lower(trim(coalesce(d.company, '')))
      limit 1
    ) as simulated_company_id,
    d.company as company_text
  from public.drivers d
),
vehicle_resolution as (
  select
    v.id as vehicle_id,
    dr.simulated_company_id,
    dr.company_text as driver_company_text
  from public.vehicles v
  left join driver_resolution dr on dr.driver_id = v.current_driver_id
)
select
  x.id as consumable_id,
  x.worker_id,
  x.vehicle_id,
  dw.simulated_company_id as worker_company_id,
  dw.company_text as worker_company_text,
  vv.simulated_company_id as vehicle_company_id,
  vv.driver_company_text as vehicle_via_driver_company_text
from public.consumables x
left join driver_resolution dw on dw.driver_id = x.worker_id
left join vehicle_resolution vv on vv.vehicle_id = x.vehicle_id
where dw.simulated_company_id is not null
  and vv.simulated_company_id is not null
  and dw.simulated_company_id <> vv.simulated_company_id
order by x.id
limit 50;

with
company_name_stats as (
  select
    lower(trim(coalesce(c.name, ''))) as normalised_name,
    count(*)::integer as name_count,
    min(c.id::text)::uuid as sample_id
  from public.companies c
  where nullif(trim(coalesce(c.name, '')), '') is not null
  group by lower(trim(coalesce(c.name, '')))
),
unique_company_names as (
  select normalised_name, sample_id as company_id
  from company_name_stats
  where name_count = 1
),
driver_resolution as (
  select
    d.id as driver_id,
    (
      select u.company_id from unique_company_names u
      where u.normalised_name = lower(trim(coalesce(d.company, '')))
      limit 1
    ) as simulated_company_id,
    d.company as company_text
  from public.drivers d
),
vehicle_resolution as (
  select
    v.id as vehicle_id,
    dr.simulated_company_id,
    dr.company_text as driver_company_text
  from public.vehicles v
  left join driver_resolution dr on dr.driver_id = v.current_driver_id
)
select
  vc.id as vehicle_check_id,
  vc.worker_id,
  vc.vehicle_id,
  dw.simulated_company_id as worker_company_id,
  dw.company_text as worker_company_text,
  vv.simulated_company_id as vehicle_company_id,
  vv.driver_company_text as vehicle_via_driver_company_text
from public.vehicle_checks vc
left join driver_resolution dw on dw.driver_id = vc.worker_id
left join vehicle_resolution vv on vv.vehicle_id = vc.vehicle_id
where dw.simulated_company_id is not null
  and vv.simulated_company_id is not null
  and dw.simulated_company_id <> vv.simulated_company_id
order by vc.id
limit 50;


-- =============================================================================
-- 7) MIGRATION OUTCOME PREDICTION (WOULD PASS / WOULD FAIL)
-- =============================================================================
with
company_name_stats as (
  select
    lower(trim(coalesce(c.name, ''))) as normalised_name,
    count(*)::integer as name_count
  from public.companies c
  where nullif(trim(coalesce(c.name, '')), '') is not null
  group by lower(trim(coalesce(c.name, '')))
),
ambiguous_name_count as (
  select count(*)::integer as n from company_name_stats where name_count > 1
),
unique_company_names as (
  select
    normalised_name,
    (
      select min(c.id::text)::uuid
      from public.companies c
      where lower(trim(coalesce(c.name, ''))) = company_name_stats.normalised_name
    ) as company_id
  from company_name_stats
  where name_count = 1
),
driver_resolution as (
  select
    d.id as driver_id,
    case
      when nullif(trim(coalesce(d.company, '')), '') is null then 'unmatched_empty_text'
      when exists (
        select 1 from company_name_stats s
        where s.normalised_name = lower(trim(coalesce(d.company, ''))) and s.name_count > 1
      ) then 'ambiguous'
      when exists (
        select 1 from unique_company_names u
        where u.normalised_name = lower(trim(coalesce(d.company, '')))
      ) then 'unique'
      else 'unmatched_no_company_row'
    end as resolve_status,
    (
      select u.company_id from unique_company_names u
      where u.normalised_name = lower(trim(coalesce(d.company, '')))
      limit 1
    ) as simulated_company_id
  from public.drivers d
),
vehicle_resolution as (
  select
    v.id as vehicle_id,
    case
      when v.current_driver_id is null then 'unassigned_no_driver'
      when not exists (select 1 from public.drivers d where d.id = v.current_driver_id)
        then 'broken_driver_fk'
      when dr.resolve_status = 'unique' then 'unique'
      when dr.resolve_status = 'ambiguous' then 'ambiguous'
      else 'unmatched'
    end as resolve_status,
    dr.simulated_company_id
  from public.vehicles v
  left join driver_resolution dr on dr.driver_id = v.current_driver_id
),
counts as (
  select
    (select n from ambiguous_name_count) as ambiguous_company_names,
    (select count(*) from driver_resolution where resolve_status <> 'unique')::integer as drivers_not_unique,
    (select count(*) from vehicle_resolution where resolve_status <> 'unique')::integer as vehicles_not_unique,
    (select count(*) from public.documents d
      where nullif(trim(coalesce(d.company, '')), '') is null
         or not exists (
           select 1 from unique_company_names u
           where u.normalised_name = lower(trim(coalesce(d.company, '')))
         ))::integer as documents_not_unique,
    (select count(*) from public.driver_reports r
      where nullif(trim(coalesce(r.company, '')), '') is null
         or not exists (
           select 1 from unique_company_names u
           where u.normalised_name = lower(trim(coalesce(r.company, '')))
         ))::integer as driver_reports_not_unique,
    (select count(*) from public.contacts c
      where nullif(trim(coalesce(c.company, '')), '') is null
         or not exists (
           select 1 from unique_company_names u
           where u.normalised_name = lower(trim(coalesce(c.company, '')))
         ))::integer as contacts_not_unique,
    (select count(*) from public.consumables x
      left join driver_resolution dr on dr.driver_id = x.worker_id
      left join vehicle_resolution vr on vr.vehicle_id = x.vehicle_id
      where coalesce(dr.simulated_company_id, vr.simulated_company_id) is null
         or (
           dr.simulated_company_id is not null
           and vr.simulated_company_id is not null
           and dr.simulated_company_id <> vr.simulated_company_id
         ))::integer as consumables_not_unique_or_conflict,
    (select count(*) from public.timesheets t
      left join driver_resolution dr on dr.driver_id = t.driver_id
      where coalesce(dr.resolve_status, 'unmatched') <> 'unique')::integer as timesheets_not_unique,
    (select count(*) from public.holiday_requests h
      left join driver_resolution dr on dr.driver_id = h.worker_id
      where coalesce(dr.resolve_status, 'unmatched') <> 'unique')::integer as holidays_not_unique,
    (select count(*) from public.vehicle_checks vc
      left join vehicle_resolution vr on vr.vehicle_id = vc.vehicle_id
      left join driver_resolution dr on dr.driver_id = vc.worker_id
      where
        (vr.simulated_company_id is not null
         and dr.simulated_company_id is not null
         and vr.simulated_company_id <> dr.simulated_company_id)
        or (vr.simulated_company_id is null and coalesce(dr.resolve_status, 'unmatched') <> 'unique')
    )::integer as vehicle_checks_not_unique_or_conflict
)
select
  case
    when ambiguous_company_names = 0
     and drivers_not_unique = 0
     and vehicles_not_unique = 0
     and documents_not_unique = 0
     and driver_reports_not_unique = 0
     and contacts_not_unique = 0
     and consumables_not_unique_or_conflict = 0
     and timesheets_not_unique = 0
     and holidays_not_unique = 0
     and vehicle_checks_not_unique_or_conflict = 0
    then 'WOULD PASS'
    else 'WOULD FAIL'
  end as phase1_migration_prediction,
  ambiguous_company_names,
  drivers_not_unique,
  vehicles_not_unique,
  documents_not_unique,
  driver_reports_not_unique,
  contacts_not_unique,
  consumables_not_unique_or_conflict,
  timesheets_not_unique,
  holidays_not_unique,
  vehicle_checks_not_unique_or_conflict,
  (
    ambiguous_company_names
    + drivers_not_unique
    + vehicles_not_unique
    + documents_not_unique
    + driver_reports_not_unique
    + contacts_not_unique
    + consumables_not_unique_or_conflict
    + timesheets_not_unique
    + holidays_not_unique
    + vehicle_checks_not_unique_or_conflict
  ) as failure_signal_total
from counts;


-- =============================================================================
-- 8) MANUAL DECISIONS REQUIRED (counts only; no assignments)
-- =============================================================================
with
company_name_stats as (
  select
    lower(trim(coalesce(c.name, ''))) as normalised_name,
    count(*)::integer as name_count
  from public.companies c
  where nullif(trim(coalesce(c.name, '')), '') is not null
  group by lower(trim(coalesce(c.name, '')))
)
select * from (
  select
    'ambiguous_company_names'::text as decision_category,
    (select count(*)::integer from company_name_stats where name_count > 1) as item_count,
    'Rename or merge companies rows so each lower(trim(name)) is unique'::text as required_action
  union all
  select
    'drivers_with_blank_company',
    (select count(*)::integer from public.drivers where nullif(trim(coalesce(company, '')), '') is null),
    'Set drivers.company to a unique companies.name or assign company_id manually after Phase 1 columns exist'
  union all
  select
    'drivers_with_unknown_company_text',
    (
      select count(*)::integer from public.drivers d
      where nullif(trim(coalesce(d.company, '')), '') is not null
        and not exists (
          select 1 from public.companies c
          where lower(trim(coalesce(c.name, ''))) = lower(trim(d.company))
        )
    ),
    'Fix drivers.company spelling or create the matching companies row'
  union all
  select
    'vehicles_unassigned_or_unresolvable',
    (
      select count(*)::integer from public.vehicles v
      where v.current_driver_id is null
         or not exists (select 1 from public.drivers d where d.id = v.current_driver_id)
         or exists (
           select 1 from public.drivers d
           where d.id = v.current_driver_id
             and (
               nullif(trim(coalesce(d.company, '')), '') is null
               or (
                 select count(*) from public.companies c
                 where lower(trim(coalesce(c.name, ''))) = lower(trim(d.company))
               ) <> 1
             )
         )
    ),
    'Assign current_driver with unique company text, or set vehicles.company_id manually after column exists'
  union all
  select
    'consumables_worker_vehicle_conflicts',
    (
      select count(*)::integer
      from public.consumables x
      join public.drivers dw on dw.id = x.worker_id
      join public.vehicles v on v.id = x.vehicle_id
      join public.drivers dv on dv.id = v.current_driver_id
      where nullif(trim(coalesce(dw.company, '')), '') is not null
        and nullif(trim(coalesce(dv.company, '')), '') is not null
        and lower(trim(dw.company)) <> lower(trim(dv.company))
        and (
          select count(*) from public.companies c
          where lower(trim(coalesce(c.name, ''))) = lower(trim(dw.company))
        ) = 1
        and (
          select count(*) from public.companies c
          where lower(trim(coalesce(c.name, ''))) = lower(trim(dv.company))
        ) = 1
    ),
    'Manually choose Company A or B for each conflicting consumable; do not auto-guess'
  union all
  select
    'vehicle_checks_worker_vehicle_conflicts',
    (
      select count(*)::integer
      from public.vehicle_checks vc
      join public.drivers dw on dw.id = vc.worker_id
      join public.vehicles v on v.id = vc.vehicle_id
      join public.drivers dv on dv.id = v.current_driver_id
      where nullif(trim(coalesce(dw.company, '')), '') is not null
        and nullif(trim(coalesce(dv.company, '')), '') is not null
        and lower(trim(dw.company)) <> lower(trim(dv.company))
        and (
          select count(*) from public.companies c
          where lower(trim(coalesce(c.name, ''))) = lower(trim(dw.company))
        ) = 1
        and (
          select count(*) from public.companies c
          where lower(trim(coalesce(c.name, ''))) = lower(trim(dv.company))
        ) = 1
    ),
    'Manually choose Company A or B for each conflicting vehicle check; do not auto-guess'
) decisions
where item_count > 0
order by decision_category;


-- =============================================================================
-- 9) DRIVER REPORTS cleaned_at — exists on live schema?
-- =============================================================================
select
  exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'driver_reports'
      and c.column_name = 'cleaned_at'
  ) as cleaned_at_column_exists,
  (
    select c.data_type
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'driver_reports'
      and c.column_name = 'cleaned_at'
  ) as cleaned_at_data_type;

-- Repo note (not a live DB fact):
--   Migration file 20260712210000_add_driver_reports_cleaned_at.sql is currently
--   ABSENT from the repository working tree. Trust information_schema above for live.

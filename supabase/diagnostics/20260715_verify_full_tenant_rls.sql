-- =============================================================================
-- DREVORA Phase 3 — Full tenant RLS verification (READ-ONLY)
-- File: supabase/diagnostics/20260715_verify_full_tenant_rls.sql
-- =============================================================================
-- PURPOSE
--   Verify 20260715210000_enable_full_tenant_rls.sql (before or after apply):
--   RLS, policies, grants, identity ambiguity, Worker enforcement pairing,
--   Consumables Worker policies, SECURITY DEFINER helpers, PASS/FAIL summary.
--
-- RULES
--   Read-only only: SELECT / WITH / CTE.
--   No CREATE, ALTER, DROP, INSERT, UPDATE, DELETE, TRUNCATE,
--   GRANT, REVOKE, TEMP TABLE, DO blocks, functions, or triggers.
--
-- PRIVACY
--   Counts and IDs only. Do not select emails, names, or row contents.
-- =============================================================================

-- Target private tables expected by Phase 3 (19 application tables)
with target_tables as (
  select unnest(array[
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
  ]) as table_name
)

-- =============================================================================
-- 1) RLS status for every target table
-- =============================================================================
select
  t.table_name,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  coalesce(c.relforcerowsecurity, false) as rls_forced,
  case
    when c.oid is null then 'MISSING_TABLE'
    when c.relrowsecurity then 'OK_RLS_ON'
    else 'FAIL_RLS_OFF'
  end as status
from target_tables t
left join pg_class c
  on c.relname = t.table_name
 and c.relnamespace = 'public'::regnamespace
order by t.table_name;


-- =============================================================================
-- 2) Exact policies: command, roles, USING, WITH CHECK
-- =============================================================================
select
  p.tablename as table_name,
  p.policyname,
  p.cmd as command,
  p.roles,
  p.qual as using_expression,
  p.with_check as with_check_expression,
  p.permissive
from pg_policies p
where p.schemaname = 'public'
  and p.tablename in (
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
  )
order by p.tablename, p.cmd, p.policyname;


-- =============================================================================
-- 3) Grants for anon and authenticated
-- =============================================================================
select
  table_schema,
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in (
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
  )
group by table_schema, table_name, grantee
order by table_name, grantee;


-- =============================================================================
-- 4) Missing expected policies (Phase 3 naming)
-- =============================================================================
with expected(policyname, tablename) as (
  values
    ('companies_member_select', 'companies'),
    ('companies_office_update', 'companies'),
    ('company_members_select_own', 'company_members'),
    ('drivers_office_select', 'drivers'),
    ('drivers_worker_select_own', 'drivers'),
    ('drivers_office_insert', 'drivers'),
    ('drivers_office_update', 'drivers'),
    ('drivers_office_delete', 'drivers'),
    ('vehicles_office_select', 'vehicles'),
    ('vehicles_worker_select_company', 'vehicles'),
    ('vehicles_office_insert', 'vehicles'),
    ('vehicles_office_update', 'vehicles'),
    ('vehicles_office_delete', 'vehicles'),
    ('timesheets_office_select', 'timesheets'),
    ('timesheets_worker_select_own', 'timesheets'),
    ('timesheets_office_insert', 'timesheets'),
    ('timesheets_worker_insert_own', 'timesheets'),
    ('timesheets_office_update', 'timesheets'),
    ('timesheets_worker_update_own', 'timesheets'),
    ('timesheets_office_delete', 'timesheets'),
    ('timesheet_entries_office_select', 'timesheet_entries'),
    ('timesheet_entries_worker_select_own', 'timesheet_entries'),
    ('timesheet_entries_office_insert', 'timesheet_entries'),
    ('timesheet_entries_worker_insert_own', 'timesheet_entries'),
    ('timesheet_entries_office_update', 'timesheet_entries'),
    ('timesheet_entries_worker_update_own', 'timesheet_entries'),
    ('timesheet_entries_office_delete', 'timesheet_entries'),
    ('holiday_requests_office_select', 'holiday_requests'),
    ('holiday_requests_worker_select_own', 'holiday_requests'),
    ('holiday_requests_office_insert', 'holiday_requests'),
    ('holiday_requests_worker_insert_own', 'holiday_requests'),
    ('holiday_requests_office_update', 'holiday_requests'),
    ('holiday_requests_worker_update_own', 'holiday_requests'),
    ('holiday_requests_office_delete', 'holiday_requests'),
    ('vehicle_checks_office_select', 'vehicle_checks'),
    ('vehicle_checks_worker_select_own', 'vehicle_checks'),
    ('vehicle_checks_office_insert', 'vehicle_checks'),
    ('vehicle_checks_worker_insert_own', 'vehicle_checks'),
    ('vehicle_checks_office_update', 'vehicle_checks'),
    ('vehicle_checks_worker_update_own', 'vehicle_checks'),
    ('vehicle_checks_office_delete', 'vehicle_checks'),
    ('vehicle_check_items_office_select', 'vehicle_check_items'),
    ('vehicle_check_items_worker_select_own', 'vehicle_check_items'),
    ('vehicle_check_items_office_insert', 'vehicle_check_items'),
    ('vehicle_check_items_worker_insert_own', 'vehicle_check_items'),
    ('vehicle_check_items_office_update', 'vehicle_check_items'),
    ('vehicle_check_items_worker_update_own', 'vehicle_check_items'),
    ('vehicle_check_items_office_delete', 'vehicle_check_items'),
    ('vehicle_check_items_worker_delete_own', 'vehicle_check_items'),
    ('driver_reports_office_select', 'driver_reports'),
    ('driver_reports_worker_select_own', 'driver_reports'),
    ('driver_reports_office_insert', 'driver_reports'),
    ('driver_reports_worker_insert_own', 'driver_reports'),
    ('driver_reports_office_update', 'driver_reports'),
    ('driver_reports_worker_update_own', 'driver_reports'),
    ('driver_reports_office_delete', 'driver_reports'),
    ('documents_office_select', 'documents'),
    ('documents_worker_select_own', 'documents'),
    ('documents_office_insert', 'documents'),
    ('documents_office_update', 'documents'),
    ('documents_office_delete', 'documents'),
    ('contacts_office_select', 'contacts'),
    ('contacts_office_insert', 'contacts'),
    ('contacts_office_update', 'contacts'),
    ('contacts_office_delete', 'contacts'),
    ('consumables_office_select', 'consumables'),
    ('consumables_worker_select_own', 'consumables'),
    ('consumables_office_insert', 'consumables'),
    ('consumables_worker_insert_own', 'consumables'),
    ('consumables_office_update', 'consumables'),
    ('consumables_worker_update_own', 'consumables'),
    ('consumables_office_delete', 'consumables'),
    ('dashboard_notes_office_select', 'dashboard_notes'),
    ('dashboard_notes_office_insert', 'dashboard_notes'),
    ('dashboard_notes_office_update', 'dashboard_notes'),
    ('dashboard_notes_office_delete', 'dashboard_notes'),
    ('vehicle_availability_office_select', 'vehicle_availability'),
    ('vehicle_availability_worker_select_company', 'vehicle_availability'),
    ('vehicle_availability_office_insert', 'vehicle_availability'),
    ('vehicle_availability_office_update', 'vehicle_availability'),
    ('vehicle_availability_office_delete', 'vehicle_availability'),
    ('worker_compliance_office_select', 'worker_compliance_records'),
    ('worker_compliance_worker_select_own', 'worker_compliance_records'),
    ('worker_compliance_office_insert', 'worker_compliance_records'),
    ('worker_compliance_office_update', 'worker_compliance_records'),
    ('worker_compliance_office_delete', 'worker_compliance_records'),
    ('vehicle_compliance_office_select', 'vehicle_compliance_records'),
    ('vehicle_compliance_office_insert', 'vehicle_compliance_records'),
    ('vehicle_compliance_office_update', 'vehicle_compliance_records'),
    ('vehicle_compliance_office_delete', 'vehicle_compliance_records'),
    ('vehicle_check_templates_office_select', 'vehicle_check_templates'),
    ('vehicle_check_templates_worker_select_active', 'vehicle_check_templates'),
    ('vehicle_check_templates_office_insert', 'vehicle_check_templates'),
    ('vehicle_check_templates_office_update', 'vehicle_check_templates'),
    ('vehicle_check_templates_office_delete', 'vehicle_check_templates'),
    ('vehicle_check_template_items_office_select', 'vehicle_check_template_items'),
    ('vehicle_check_template_items_worker_select_active', 'vehicle_check_template_items'),
    ('vehicle_check_template_items_office_insert', 'vehicle_check_template_items'),
    ('vehicle_check_template_items_office_update', 'vehicle_check_template_items'),
    ('vehicle_check_template_items_office_delete', 'vehicle_check_template_items')
)
select
  e.tablename,
  e.policyname,
  case when p.policyname is null then 'MISSING' else 'PRESENT' end as status
from expected e
left join pg_policies p
  on p.schemaname = 'public'
 and p.tablename = e.tablename
 and p.policyname = e.policyname
order by status desc, e.tablename, e.policyname;


-- =============================================================================
-- 5) Overly permissive true policies + legacy company-text / oldest-company
-- =============================================================================
select
  p.tablename,
  p.policyname,
  p.cmd,
  p.qual as using_expression,
  p.with_check as with_check_expression,
  case
    when coalesce(p.qual, '') in ('true', '(true)')
      or coalesce(p.with_check, '') in ('true', '(true)')
      then 'PERMISSIVE_TRUE'
    when coalesce(p.qual, '') ilike '%drevora_current_company_id%'
      or coalesce(p.with_check, '') ilike '%drevora_current_company_id%'
      or coalesce(p.qual, '') ilike '%drevora_current_company_name%'
      or coalesce(p.with_check, '') ilike '%drevora_current_company_name%'
      or coalesce(p.qual, '') ilike '%drevora_company_text_matches_current%'
      or coalesce(p.with_check, '') ilike '%drevora_company_text_matches_current%'
      then 'LEGACY_OLDEST_OR_TEXT_HELPER'
    else 'REVIEW'
  end as risk_class
from pg_policies p
where p.schemaname = 'public'
  and p.tablename in (
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
  )
  and (
    coalesce(p.qual, '') in ('true', '(true)')
    or coalesce(p.with_check, '') in ('true', '(true)')
    or coalesce(p.qual, '') ilike '%drevora_current_company_id%'
    or coalesce(p.with_check, '') ilike '%drevora_current_company_id%'
    or coalesce(p.qual, '') ilike '%drevora_current_company_name%'
    or coalesce(p.with_check, '') ilike '%drevora_current_company_name%'
    or coalesce(p.qual, '') ilike '%drevora_company_text_matches_current%'
    or coalesce(p.with_check, '') ilike '%drevora_company_text_matches_current%'
  )
order by risk_class, p.tablename, p.policyname;


-- =============================================================================
-- 6) Legacy company-text / oldest-company policies (dedicated view)
-- =============================================================================
select
  p.tablename,
  p.policyname,
  p.cmd,
  'LEGACY_HELPER_REFERENCE' as finding
from pg_policies p
where p.schemaname = 'public'
  and (
    coalesce(p.qual, '') ilike '%drevora_current_company_id%'
    or coalesce(p.with_check, '') ilike '%drevora_current_company_id%'
    or coalesce(p.qual, '') ilike '%drevora_current_company_name%'
    or coalesce(p.with_check, '') ilike '%drevora_current_company_name%'
    or coalesce(p.qual, '') ilike '%drevora_company_text_matches_current%'
    or coalesce(p.with_check, '') ilike '%drevora_company_text_matches_current%'
    or coalesce(p.qual, '') ilike '%company_text%'
    or coalesce(p.with_check, '') ilike '%company_text%'
  )
order by p.tablename, p.policyname;


-- =============================================================================
-- 7) Root rows with company_id NULL (counts only)
-- =============================================================================
select 'drivers' as table_name,
  count(*)::integer as total_rows,
  count(*) filter (where company_id is null)::integer as null_company_id_rows
from public.drivers
union all
select 'vehicles', count(*)::integer, count(*) filter (where company_id is null)::integer
from public.vehicles
union all
select 'timesheets', count(*)::integer, count(*) filter (where company_id is null)::integer
from public.timesheets
union all
select 'holiday_requests', count(*)::integer, count(*) filter (where company_id is null)::integer
from public.holiday_requests
union all
select 'vehicle_checks', count(*)::integer, count(*) filter (where company_id is null)::integer
from public.vehicle_checks
union all
select 'driver_reports', count(*)::integer, count(*) filter (where company_id is null)::integer
from public.driver_reports
union all
select 'documents', count(*)::integer, count(*) filter (where company_id is null)::integer
from public.documents
union all
select 'contacts', count(*)::integer, count(*) filter (where company_id is null)::integer
from public.contacts
union all
select 'consumables', count(*)::integer, count(*) filter (where company_id is null)::integer
from public.consumables
union all
select 'vehicle_check_templates', count(*)::integer, count(*) filter (where company_id is null)::integer
from public.vehicle_check_templates
union all
select 'dashboard_notes', count(*)::integer, count(*) filter (where company_id is null)::integer
from public.dashboard_notes
order by table_name;


-- =============================================================================
-- 8) Cross-company root relationship conflicts (counts only)
-- =============================================================================
select 'vehicles.current_driver_id cross-company' as conflict_type,
  count(*)::integer as conflict_count
from public.vehicles v
inner join public.drivers d on d.id = v.current_driver_id
where v.company_id is not null
  and d.company_id is not null
  and v.company_id <> d.company_id

union all
select 'drivers.default_vehicle_id cross-company',
  count(*)::integer
from public.drivers d
inner join public.vehicles v on v.id = d.default_vehicle_id
where d.company_id is not null
  and v.company_id is not null
  and d.company_id <> v.company_id

union all
select 'timesheets.driver cross-company',
  count(*)::integer
from public.timesheets t
inner join public.drivers d on d.id = t.driver_id
where t.company_id is not null
  and d.company_id is not null
  and t.company_id <> d.company_id

union all
select 'timesheets.vehicle cross-company',
  count(*)::integer
from public.timesheets t
inner join public.vehicles v on v.id = t.vehicle_id
where t.company_id is not null
  and v.company_id is not null
  and t.company_id <> v.company_id

union all
select 'holiday_requests.worker cross-company',
  count(*)::integer
from public.holiday_requests h
inner join public.drivers d on d.id = h.worker_id
where h.company_id is not null
  and d.company_id is not null
  and h.company_id <> d.company_id

union all
select 'vehicle_checks.worker cross-company',
  count(*)::integer
from public.vehicle_checks vc
inner join public.drivers d on d.id = vc.worker_id
where vc.company_id is not null
  and d.company_id is not null
  and vc.company_id <> d.company_id

union all
select 'vehicle_checks.vehicle cross-company',
  count(*)::integer
from public.vehicle_checks vc
inner join public.vehicles v on v.id = vc.vehicle_id
where vc.company_id is not null
  and v.company_id is not null
  and vc.company_id <> v.company_id

union all
select 'driver_reports.worker cross-company',
  count(*)::integer
from public.driver_reports r
inner join public.drivers d on d.id = r.worker_id
where r.company_id is not null
  and d.company_id is not null
  and r.company_id <> d.company_id

union all
select 'driver_reports.vehicle cross-company',
  count(*)::integer
from public.driver_reports r
inner join public.vehicles v on v.id = r.vehicle_id
where r.company_id is not null
  and v.company_id is not null
  and r.company_id <> v.company_id

union all
select 'documents.worker cross-company',
  count(*)::integer
from public.documents doc
inner join public.drivers d on d.id = doc.worker_id
where doc.company_id is not null
  and d.company_id is not null
  and doc.company_id <> d.company_id

union all
select 'documents.vehicle cross-company',
  count(*)::integer
from public.documents doc
inner join public.vehicles v on v.id = doc.vehicle_id
where doc.company_id is not null
  and v.company_id is not null
  and doc.company_id <> v.company_id

union all
select 'consumables.worker cross-company',
  count(*)::integer
from public.consumables x
inner join public.drivers d on d.id = x.worker_id
where x.company_id is not null
  and d.company_id is not null
  and x.company_id <> d.company_id

union all
select 'consumables.vehicle cross-company',
  count(*)::integer
from public.consumables x
inner join public.vehicles v on v.id = x.vehicle_id
where x.company_id is not null
  and v.company_id is not null
  and x.company_id <> v.company_id

union all
select 'contacts.null_company_id_rows',
  count(*)::integer
from public.contacts c
where c.company_id is null

order by conflict_type;


-- =============================================================================
-- 9) Orphan child rows (counts only)
-- =============================================================================
select 'vehicle_availability parent null/missing company' as orphan_type,
  count(*)::integer as orphan_count
from public.vehicle_availability a
left join public.vehicles v on v.id = a.vehicle_id
where v.id is null or v.company_id is null

union all
select 'worker_compliance parent null/missing company',
  count(*)::integer
from public.worker_compliance_records wcr
left join public.drivers d on d.id = wcr.worker_id
where d.id is null or d.company_id is null

union all
select 'vehicle_compliance parent null/missing company',
  count(*)::integer
from public.vehicle_compliance_records vcr
left join public.vehicles v on v.id = vcr.vehicle_id
where v.id is null or v.company_id is null

union all
select 'timesheet_entries orphan parent',
  count(*)::integer
from public.timesheet_entries te
left join public.timesheets t on t.id = te.timesheet_id
where t.id is null

union all
select 'vehicle_check_items orphan parent',
  count(*)::integer
from public.vehicle_check_items vci
left join public.vehicle_checks vc on vc.id = vci.vehicle_check_id
where vc.id is null

union all
select 'vehicle_check_template_items orphan parent',
  count(*)::integer
from public.vehicle_check_template_items ti
left join public.vehicle_check_templates t on t.id = ti.template_id
where t.id is null

order by orphan_type;


-- =============================================================================
-- 10) Multiple active memberships by user (counts / user_id only)
-- =============================================================================
select
  cm.user_id,
  count(*)::integer as active_membership_count
from public.company_members cm
where cm.is_active = true
group by cm.user_id
having count(*) > 1
order by active_membership_count desc, cm.user_id;


-- =============================================================================
-- 11) Duplicate authenticated-email Worker matches inside a company
--     (company_id + match_count only; no emails)
-- =============================================================================
select
  d.company_id,
  count(*)::integer as matching_driver_rows
from public.drivers d
inner join auth.users u
  on lower(trim(coalesce(u.email, ''))) = lower(trim(coalesce(d.email, '')))
where d.company_id is not null
  and coalesce(trim(d.email), '') <> ''
group by d.company_id, lower(trim(d.email))
having count(*) > 1
order by matching_driver_rows desc, d.company_id;


-- =============================================================================
-- 12) Worker UPDATE policies without paired column/transition enforcement trigger
-- =============================================================================
with worker_update_policies as (
  select p.tablename, p.policyname
  from pg_policies p
  where p.schemaname = 'public'
    and p.cmd = 'UPDATE'
    and p.policyname like '%worker%update%'
    and p.tablename in (
      'timesheets',
      'timesheet_entries',
      'holiday_requests',
      'driver_reports',
      'vehicle_checks',
      'vehicle_check_items',
      'consumables'
    )
),
expected_triggers(tablename, trigger_name) as (
  values
    ('timesheets', 'drevora_enforce_timesheet_worker_write'),
    ('timesheet_entries', 'drevora_enforce_timesheet_entry_worker_write'),
    ('holiday_requests', 'drevora_enforce_holiday_request_worker_write'),
    ('driver_reports', 'drevora_enforce_driver_report_worker_write'),
    ('vehicle_checks', 'drevora_enforce_vehicle_check_worker_write'),
    ('vehicle_check_items', 'drevora_enforce_vehicle_check_item_worker_write'),
    ('consumables', 'drevora_enforce_consumable_worker_write')
)
select
  w.tablename,
  w.policyname,
  e.trigger_name as expected_trigger,
  case
    when t.tgname is null then 'FAIL_MISSING_ENFORCEMENT_TRIGGER'
    else 'OK_PAIRED'
  end as status
from worker_update_policies w
join expected_triggers e on e.tablename = w.tablename
left join pg_trigger t
  on t.tgname = e.trigger_name
 and t.tgrelid = ('public.' || w.tablename)::regclass
 and not t.tgisinternal
order by status desc, w.tablename, w.policyname;


-- =============================================================================
-- 12b) Holiday calculated-field enforcement present?
-- =============================================================================
select
  p.proname as function_name,
  case
    when pg_get_functiondef(p.oid) ilike '%drevora_calculate_holiday_day_breakdown%'
     and pg_get_functiondef(p.oid) ilike '%drevora_worker_holiday_leave_type%'
     and pg_get_functiondef(p.oid) not ilike '%auth.uid() is null%'
      then 'OK_TRUSTED_HOLIDAY_CALC'
    when pg_get_functiondef(p.oid) ilike '%auth.uid() is null%'
      then 'FAIL_BROAD_NULL_AUTH_BYPASS'
    else 'FAIL_MISSING_TRUSTED_HOLIDAY_CALC'
  end as status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'drevora_enforce_holiday_request_worker_write';


-- =============================================================================
-- 12c) Completed Vehicle Check Worker editability (policy expressions)
-- =============================================================================
select
  p.policyname,
  p.cmd,
  case
    when p.policyname like 'vehicle_check_items_worker_%'
     and (
       coalesce(p.qual, '') ilike '%drevora_vehicle_check_is_worker_editable%'
       or coalesce(p.with_check, '') ilike '%drevora_vehicle_check_is_worker_editable%'
     )
      then 'OK_PARENT_STATE_GATED'
    when p.policyname = 'vehicle_checks_worker_update_own'
     and coalesce(p.qual, '') ilike '%drevora_vehicle_check_is_worker_editable%'
      then 'OK_PARENT_STATE_GATED'
    when p.policyname like '%worker%'
      and (
        coalesce(p.qual, '') ilike '%Completed%'
        or coalesce(p.with_check, '') ilike '%Completed%'
        or coalesce(p.qual, '') ilike '%drevora_vehicle_check_is_worker_final%'
        or coalesce(p.with_check, '') ilike '%drevora_vehicle_check_is_worker_final%'
      )
      then 'FAIL_COMPLETED_STILL_EDITABLE'
    when p.policyname like '%worker%'
      then 'FAIL_MISSING_PARENT_STATE_GATE'
    else 'REVIEW'
  end as status
from pg_policies p
where p.schemaname = 'public'
  and p.tablename in ('vehicle_checks', 'vehicle_check_items')
  and p.policyname like '%worker%'
  and p.cmd in ('UPDATE', 'INSERT', 'DELETE')
order by status desc, p.tablename, p.cmd, p.policyname;


-- =============================================================================
-- 12d) Worker trigger functions using broad auth.uid() IS NULL bypass
-- =============================================================================
select
  p.proname as function_name,
  'FAIL_BROAD_NULL_AUTH_BYPASS' as status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'drevora_enforce_%'
  and pg_get_functiondef(p.oid) ~* 'auth\.uid\(\)\s+is\s+null'
order by p.proname;


-- =============================================================================
-- 12e) Trigger function EXECUTE grants (PUBLIC / anon / authenticated must be absent)
-- =============================================================================
select
  p.proname as function_name,
  rp.grantee,
  rp.privilege_type,
  'FAIL_OVERBROAD_EXECUTE' as status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join information_schema.routine_privileges rp
  on rp.routine_schema = 'public'
 and rp.routine_name = p.proname
where n.nspname = 'public'
  and p.proname like 'drevora_enforce_%'
  and rp.privilege_type = 'EXECUTE'
  and lower(rp.grantee) in ('public', 'anon', 'authenticated')
order by function_name, grantee;


-- =============================================================================
-- 12e2) Enforcement function security attributes (DEFINER / search_path / null-auth)
-- =============================================================================
select
  p.proname as function_name,
  p.prosecdef as is_security_definer,
  p.proconfig as config_settings,
  case
    when p.prosecdef then 'FAIL_SECURITY_DEFINER'
    when p.proconfig is null
      or not exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) cfg
        where cfg like 'search_path=%'
      )
      then 'FAIL_MISSING_SEARCH_PATH'
    when pg_get_functiondef(p.oid) ~* 'auth\.uid\(\)\s+is\s+null'
      then 'FAIL_BROAD_NULL_AUTH_BYPASS'
    when p.proname = 'drevora_enforce_holiday_request_worker_write'
     and (
       pg_get_functiondef(p.oid) not ilike '%drevora_calculate_holiday_day_breakdown%'
       or pg_get_functiondef(p.oid) not ilike '%drevora_worker_holiday_leave_type%'
     )
      then 'FAIL_HOLIDAY_CALC_NOT_ENFORCED'
    when p.proname = 'drevora_enforce_vehicle_check_worker_write'
     and pg_get_functiondef(p.oid) not ilike '%drevora_vehicle_check_is_worker_editable%'
      then 'FAIL_VEHICLE_CHECK_EDITABLE_HELPER_MISSING'
    else 'OK_SAFE'
  end as status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'drevora_enforce_%'
order by status desc, function_name;


-- =============================================================================
-- 12f) Stale Timesheet approval/rejection timestamp combinations (counts)
-- =============================================================================
select
  'draft_or_submitted_with_approved_at' as stale_type,
  count(*)::integer as row_count
from public.timesheets
where status in ('Draft', 'Submitted')
  and approved_at is not null
  and deleted_at is null

union all
select
  'draft_or_submitted_with_rejected_at',
  count(*)::integer
from public.timesheets
where status in ('Draft', 'Submitted')
  and rejected_at is not null
  and deleted_at is null

order by stale_type;


-- =============================================================================
-- 13) Worker Consumables policies exist?
-- =============================================================================
select
  expected.policyname,
  case when p.policyname is null then 'MISSING' else 'PRESENT' end as status
from (
  values
    ('consumables_worker_select_own'),
    ('consumables_worker_insert_own'),
    ('consumables_worker_update_own')
) as expected(policyname)
left join pg_policies p
  on p.schemaname = 'public'
 and p.tablename = 'consumables'
 and p.policyname = expected.policyname
order by status desc, expected.policyname;


-- =============================================================================
-- 14) SECURITY DEFINER helpers: ownership, EXECUTE grants, search_path
-- =============================================================================
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  r.rolname as owner,
  p.prosecdef as is_security_definer,
  p.proconfig as config_settings,
  (
    select string_agg(grantee || ':' || privilege_type, ', ' order by grantee)
    from information_schema.routine_privileges rp
    where rp.routine_schema = 'public'
      and rp.routine_name = p.proname
      and rp.grantee in ('anon', 'authenticated', 'public')
  ) as execute_grants,
  case
    when p.prosecdef
      and (
        p.proconfig is null
        or not exists (
          select 1
          from unnest(coalesce(p.proconfig, array[]::text[])) cfg
          where cfg like 'search_path=%'
        )
      )
      then 'FAIL_MISSING_SEARCH_PATH'
    when p.proname in (
      'drevora_current_company_id',
      'drevora_current_company_name',
      'drevora_company_text_matches_current'
    )
      then 'NEUTRALIZED_LEGACY_HELPER'
    when p.proname like 'drevora_auth_%'
      or p.proname like 'drevora_driver_%'
      or p.proname like 'drevora_vehicle_%'
      or p.proname like 'drevora_enforce_%'
      then 'OK_AUTH_OR_ENFORCE_HELPER'
    when p.proname = 'drevora_prevent_company_id_mutation'
      then 'FAIL_UNEXPECTED_IMMUTABILITY_TRIGGER_FN'
    else 'REVIEW'
  end as review_status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public'
  and (
    p.proname like 'drevora_%'
  )
order by review_status, function_name;


-- =============================================================================
-- 14b) Enforcement trigger presence
-- =============================================================================
select
  e.trigger_name,
  e.tablename,
  case when t.tgname is null then 'MISSING' else 'PRESENT' end as status
from (
  values
    ('drevora_enforce_timesheet_worker_write', 'timesheets'),
    ('drevora_enforce_timesheet_entry_worker_write', 'timesheet_entries'),
    ('drevora_enforce_holiday_request_worker_write', 'holiday_requests'),
    ('drevora_enforce_driver_report_worker_write', 'driver_reports'),
    ('drevora_enforce_vehicle_check_worker_write', 'vehicle_checks'),
    ('drevora_enforce_vehicle_check_item_worker_write', 'vehicle_check_items'),
    ('drevora_enforce_consumable_worker_write', 'consumables')
) as e(trigger_name, tablename)
left join pg_trigger t
  on t.tgname = e.trigger_name
 and t.tgrelid = ('public.' || e.tablename)::regclass
 and not t.tgisinternal
order by status desc, e.tablename;


-- =============================================================================
-- 14c) company_id immutability triggers should be ABSENT
-- =============================================================================
select
  c.relname as table_name,
  t.tgname as trigger_name,
  'UNEXPECTED_COMPANY_ID_IMMUTABILITY_TRIGGER' as finding
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and t.tgname = 'drevora_prevent_company_id_mutation'
order by c.relname;


-- =============================================================================
-- 15) Final PASS / FAIL summary
-- =============================================================================
with
rls_off as (
  select count(*)::integer as n
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'companies','company_members','drivers','vehicles','timesheets','timesheet_entries',
      'holiday_requests','vehicle_checks','vehicle_check_items','driver_reports','documents',
      'contacts','consumables','vehicle_availability','worker_compliance_records',
      'vehicle_compliance_records','vehicle_check_templates','vehicle_check_template_items',
      'dashboard_notes'
    )
    and coalesce(c.relrowsecurity, false) = false
),
anon_grants as (
  select count(*)::integer as n
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and table_name in (
      'companies','company_members','drivers','vehicles','timesheets','timesheet_entries',
      'holiday_requests','vehicle_checks','vehicle_check_items','driver_reports','documents',
      'contacts','consumables','vehicle_availability','worker_compliance_records',
      'vehicle_compliance_records','vehicle_check_templates','vehicle_check_template_items',
      'dashboard_notes'
    )
),
unsafe_policies as (
  select count(*)::integer as n
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in (
      'companies','company_members','drivers','vehicles','timesheets','timesheet_entries',
      'holiday_requests','vehicle_checks','vehicle_check_items','driver_reports','documents',
      'contacts','consumables','vehicle_availability','worker_compliance_records',
      'vehicle_compliance_records','vehicle_check_templates','vehicle_check_template_items',
      'dashboard_notes'
    )
    and (
      coalesce(p.qual, '') in ('true', '(true)')
      or coalesce(p.with_check, '') in ('true', '(true)')
      or coalesce(p.qual, '') ilike '%drevora_current_company_id%'
      or coalesce(p.with_check, '') ilike '%drevora_current_company_id%'
      or coalesce(p.qual, '') ilike '%drevora_current_company_name%'
      or coalesce(p.with_check, '') ilike '%drevora_current_company_name%'
      or coalesce(p.qual, '') ilike '%drevora_company_text_matches_current%'
      or coalesce(p.with_check, '') ilike '%drevora_company_text_matches_current%'
    )
),
missing_helpers as (
  select count(*)::integer as n
  from (
    values
      ('drevora_auth_user_company_ids'),
      ('drevora_auth_user_belongs_to_company_id'),
      ('drevora_auth_user_has_office_role_for_company'),
      ('drevora_auth_user_has_office_role'),
      ('drevora_auth_user_driver_id'),
      ('drevora_driver_in_company'),
      ('drevora_vehicle_in_company'),
      ('drevora_is_trusted_tenant_writer'),
      ('drevora_calculate_holiday_day_breakdown'),
      ('drevora_worker_holiday_leave_type'),
      ('drevora_vehicle_check_is_worker_editable'),
      ('drevora_vehicle_check_is_worker_final'),
      ('drevora_enforce_timesheet_worker_write'),
      ('drevora_enforce_timesheet_entry_worker_write'),
      ('drevora_enforce_holiday_request_worker_write'),
      ('drevora_enforce_driver_report_worker_write'),
      ('drevora_enforce_vehicle_check_worker_write'),
      ('drevora_enforce_vehicle_check_item_worker_write'),
      ('drevora_enforce_consumable_worker_write')
  ) expected(name)
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = expected.name
  )
),
missing_enforcement_triggers as (
  select count(*)::integer as n
  from (
    values
      ('drevora_enforce_timesheet_worker_write', 'timesheets'),
      ('drevora_enforce_timesheet_entry_worker_write', 'timesheet_entries'),
      ('drevora_enforce_holiday_request_worker_write', 'holiday_requests'),
      ('drevora_enforce_driver_report_worker_write', 'driver_reports'),
      ('drevora_enforce_vehicle_check_worker_write', 'vehicle_checks'),
      ('drevora_enforce_vehicle_check_item_worker_write', 'vehicle_check_items'),
      ('drevora_enforce_consumable_worker_write', 'consumables')
  ) e(trigger_name, tablename)
  where not exists (
    select 1
    from pg_trigger t
    where t.tgname = e.trigger_name
      and t.tgrelid = ('public.' || e.tablename)::regclass
      and not t.tgisinternal
  )
),
broad_null_auth_bypass as (
  select count(*)::integer as n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like 'drevora_enforce_%'
    and pg_get_functiondef(p.oid) ~* 'auth\.uid\(\)\s+is\s+null'
),
overbroad_trigger_execute as (
  select count(*)::integer as n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join information_schema.routine_privileges rp
    on rp.routine_schema = 'public'
   and rp.routine_name = p.proname
  where n.nspname = 'public'
    and p.proname like 'drevora_enforce_%'
    and rp.privilege_type = 'EXECUTE'
    and lower(rp.grantee) in ('public', 'anon', 'authenticated')
),
unsafe_enforce_function_attrs as (
  select count(*)::integer as n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like 'drevora_enforce_%'
    and (
      p.prosecdef
      or p.proconfig is null
      or not exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) cfg
        where cfg like 'search_path=%'
      )
      or pg_get_functiondef(p.oid) ~* 'auth\.uid\(\)\s+is\s+null'
      or (
        p.proname = 'drevora_enforce_holiday_request_worker_write'
        and (
          pg_get_functiondef(p.oid) not ilike '%drevora_calculate_holiday_day_breakdown%'
          or pg_get_functiondef(p.oid) not ilike '%drevora_worker_holiday_leave_type%'
        )
      )
      or (
        p.proname = 'drevora_enforce_vehicle_check_worker_write'
        and pg_get_functiondef(p.oid) not ilike '%drevora_vehicle_check_is_worker_editable%'
      )
    )
),
missing_vehicle_check_item_enforcement as (
  select case
    when exists (
      select 1
      from pg_trigger t
      where t.tgname = 'drevora_enforce_vehicle_check_item_worker_write'
        and t.tgrelid = 'public.vehicle_check_items'::regclass
        and not t.tgisinternal
    )
    and exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'drevora_enforce_vehicle_check_item_worker_write'
    )
    then 0 else 1
  end::integer as n
),
completed_vc_still_worker_writable as (
  select count(*)::integer as n
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in ('vehicle_checks', 'vehicle_check_items')
    and p.policyname like '%worker%'
    and p.cmd in ('UPDATE', 'INSERT', 'DELETE')
    and (
      (
        p.policyname like 'vehicle_check_items_worker_%'
        and coalesce(p.qual, '') not ilike '%drevora_vehicle_check_is_worker_editable%'
        and coalesce(p.with_check, '') not ilike '%drevora_vehicle_check_is_worker_editable%'
      )
      or (
        p.policyname = 'vehicle_checks_worker_update_own'
        and coalesce(p.qual, '') not ilike '%drevora_vehicle_check_is_worker_editable%'
      )
      or coalesce(p.qual, '') ilike '%drevora_vehicle_check_is_worker_final%'
      or coalesce(p.with_check, '') ilike '%drevora_vehicle_check_is_worker_final%'
    )
),
stale_timesheet_timestamps as (
  select count(*)::integer as n
  from public.timesheets
  where deleted_at is null
    and status in ('Draft', 'Submitted')
    and (approved_at is not null or rejected_at is not null)
),
unexpected_immutability_triggers as (
  select count(*)::integer as n
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and not t.tgisinternal
    and t.tgname = 'drevora_prevent_company_id_mutation'
),
missing_consumables_worker_policies as (
  select count(*)::integer as n
  from (
    values
      ('consumables_worker_select_own'),
      ('consumables_worker_insert_own'),
      ('consumables_worker_update_own')
  ) e(policyname)
  where not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'consumables'
      and p.policyname = e.policyname
  )
),
multi_membership_users as (
  select count(*)::integer as n
  from (
    select cm.user_id
    from public.company_members cm
    where cm.is_active = true
    group by cm.user_id
    having count(*) > 1
  ) x
),
ambiguous_worker_links as (
  select count(*)::integer as n
  from (
    select d.company_id, lower(trim(d.email)) as email_key
    from public.drivers d
    inner join auth.users u
      on lower(trim(coalesce(u.email, ''))) = lower(trim(coalesce(d.email, '')))
    where d.company_id is not null
      and coalesce(trim(d.email), '') <> ''
    group by d.company_id, lower(trim(d.email))
    having count(*) > 1
  ) y
),
fk_conflicts as (
  select (
    (select count(*) from public.vehicles v
      join public.drivers d on d.id = v.current_driver_id
     where v.company_id is not null and d.company_id is not null and v.company_id <> d.company_id)
    +
    (select count(*) from public.timesheets t
      join public.drivers d on d.id = t.driver_id
     where t.company_id is not null and d.company_id is not null and t.company_id <> d.company_id)
    +
    (select count(*) from public.holiday_requests h
      join public.drivers d on d.id = h.worker_id
     where h.company_id is not null and d.company_id is not null and h.company_id <> d.company_id)
    +
    (select count(*) from public.vehicle_checks vc
      join public.vehicles v on v.id = vc.vehicle_id
     where vc.company_id is not null and v.company_id is not null and vc.company_id <> v.company_id)
    +
    (select count(*) from public.vehicle_checks vc
      join public.drivers d on d.id = vc.worker_id
     where vc.company_id is not null and d.company_id is not null and vc.company_id <> d.company_id)
  )::integer as n
)
select
  (select n from rls_off) as tables_with_rls_off,
  (select n from anon_grants) as anon_privilege_grants,
  (select n from unsafe_policies) as unsafe_or_legacy_helper_policies,
  (select n from missing_helpers) as missing_required_helpers,
  (select n from missing_enforcement_triggers) as missing_worker_enforcement_triggers,
  (select n from unexpected_immutability_triggers) as unexpected_company_id_immutability_triggers,
  (select n from missing_consumables_worker_policies) as missing_consumables_worker_policies,
  (select n from broad_null_auth_bypass) as enforce_fns_with_null_auth_bypass,
  (select n from overbroad_trigger_execute) as enforce_fns_execute_public_anon_or_authenticated,
  (select n from unsafe_enforce_function_attrs) as unsafe_enforce_function_attributes,
  (select n from missing_vehicle_check_item_enforcement) as missing_vehicle_check_item_enforcement,
  (select n from completed_vc_still_worker_writable) as completed_vc_still_worker_writable_policies,
  (select n from stale_timesheet_timestamps) as stale_timesheet_approval_timestamps,
  (select n from multi_membership_users) as users_with_multiple_active_memberships,
  (select n from ambiguous_worker_links) as ambiguous_worker_email_collisions,
  (select n from fk_conflicts) as cross_company_fk_conflicts,
  case
    when (select n from rls_off) > 0 then 'FAIL'
    when (select n from anon_grants) > 0 then 'FAIL'
    when (select n from unsafe_policies) > 0 then 'FAIL'
    when (select n from missing_helpers) > 0 then 'FAIL'
    when (select n from missing_enforcement_triggers) > 0 then 'FAIL'
    when (select n from unexpected_immutability_triggers) > 0 then 'FAIL'
    when (select n from missing_consumables_worker_policies) > 0 then 'FAIL'
    when (select n from broad_null_auth_bypass) > 0 then 'FAIL'
    when (select n from overbroad_trigger_execute) > 0 then 'FAIL'
    when (select n from unsafe_enforce_function_attrs) > 0 then 'FAIL'
    when (select n from missing_vehicle_check_item_enforcement) > 0 then 'FAIL'
    when (select n from completed_vc_still_worker_writable) > 0 then 'FAIL'
    when (select n from multi_membership_users) > 0 then 'FAIL_IDENTITY_AMBIGUITY'
    when (select n from ambiguous_worker_links) > 0 then 'FAIL_IDENTITY_AMBIGUITY'
    when (select n from stale_timesheet_timestamps) > 0 then 'FAIL_DATA_CONFLICTS_REVIEW'
    when (select n from fk_conflicts) > 0 then 'FAIL_DATA_CONFLICTS_REVIEW'
    else 'PASS'
  end as final_verdict,
  case
    when (select n from broad_null_auth_bypass) > 0
      or (select n from unsafe_enforce_function_attrs) > 0
      then 'Worker enforce functions failed safety inspection (null-auth bypass, DEFINER, search_path, or holiday/VC helpers).'
    when (select n from overbroad_trigger_execute) > 0
      then 'Enforce functions still grant EXECUTE to PUBLIC, anon, or authenticated.'
    when (select n from missing_vehicle_check_item_enforcement) > 0
      then 'vehicle_check_items Worker enforcement trigger/function is missing.'
    when (select n from completed_vc_still_worker_writable) > 0
      then 'Worker Vehicle Check policies still allow writes after Completed/final state.'
    when (select n from multi_membership_users) > 0
      or (select n from ambiguous_worker_links) > 0
      then 'Resolve exact-one membership / Worker identity collisions before relying on Phase 3.'
    when (select n from stale_timesheet_timestamps) > 0
      then 'Draft/Submitted timesheets still have approved_at/rejected_at; review before rely-on-write.'
    when (select n from fk_conflicts) > 0
      then 'RLS may be OK but existing cross-company FK rows need manual review.'
    else 'No blocking findings in this diagnostic summary.'
  end as notes;

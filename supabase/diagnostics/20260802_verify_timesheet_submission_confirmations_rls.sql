-- =============================================================================
-- DREVORA — timesheet_submission_confirmations RLS verification (READ-ONLY)
-- File: supabase/diagnostics/20260802_verify_timesheet_submission_confirmations_rls.sql
-- =============================================================================
-- PURPOSE
--   Verify 20260802140000_timesheet_submission_confirmations_rls.sql:
--   RLS on, explicit INSERT policies, anon denied, no UPDATE/DELETE policies,
--   SELECT not granted to clients, helpers present, reject RPC unchanged.
--
-- RULES
--   Read-only only: SELECT / WITH / CTE.
--   No CREATE, ALTER, DROP, INSERT, UPDATE, DELETE, TRUNCATE,
--   GRANT, REVOKE, TEMP TABLE, or mutating DO blocks.
--
-- PRIVACY
--   Counts and metadata only. Do not select confirmation row contents.
--
-- DO NOT EXECUTE as part of automated agent apply — operator runs manually
-- after applying the migration on the Supabase project.
-- =============================================================================

-- =============================================================================
-- 1) Table + RLS status
-- =============================================================================
select
  c.relname as table_name,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  coalesce(c.relforcerowsecurity, false) as rls_forced,
  case
    when c.oid is null then 'MISSING_TABLE'
    when c.relrowsecurity then 'OK_RLS_ON'
    else 'FAIL_RLS_OFF'
  end as status
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname = 'timesheet_submission_confirmations';

-- =============================================================================
-- 2) Policies (expect INSERT only — worker_own + office)
-- =============================================================================
select
  p.policyname,
  p.cmd as command,
  p.roles,
  p.permissive,
  p.qual as using_expression,
  p.with_check as with_check_expression,
  case
    when p.cmd = 'INSERT'
      and p.policyname in (
        'timesheet_submission_confirmations_worker_insert_own',
        'timesheet_submission_confirmations_office_insert'
      )
      then 'OK_EXPECTED_INSERT_POLICY'
    when p.cmd in ('UPDATE', 'DELETE', 'ALL') then 'FAIL_UNEXPECTED_MUTATION_POLICY'
    when p.cmd = 'SELECT' then 'WARN_SELECT_POLICY_PRESENT'
    else 'REVIEW'
  end as classification
from pg_policies p
where p.schemaname = 'public'
  and p.tablename = 'timesheet_submission_confirmations'
order by p.cmd, p.policyname;

select
  count(*) filter (
    where policyname = 'timesheet_submission_confirmations_worker_insert_own'
      and cmd = 'INSERT'
  ) as worker_insert_policy_count,
  count(*) filter (
    where policyname = 'timesheet_submission_confirmations_office_insert'
      and cmd = 'INSERT'
  ) as office_insert_policy_count,
  count(*) as total_policy_count,
  case
    when count(*) filter (
      where policyname = 'timesheet_submission_confirmations_worker_insert_own'
        and cmd = 'INSERT'
    ) = 1
    and count(*) filter (
      where policyname = 'timesheet_submission_confirmations_office_insert'
        and cmd = 'INSERT'
    ) = 1
    and count(*) filter (where cmd in ('UPDATE', 'DELETE', 'ALL')) = 0
      then 'OK_MIN_INSERT_POLICIES'
    when count(*) = 0 then 'FAIL_NO_POLICIES'
    else 'FAIL_POLICY_SET_UNEXPECTED'
  end as status
from pg_policies
where schemaname = 'public'
  and tablename = 'timesheet_submission_confirmations';

-- =============================================================================
-- 3) Grants — anon must have none; authenticated INSERT only
-- =============================================================================
select
  grantee,
  privilege_type,
  case
    when grantee = 'anon' then 'FAIL_ANON_HAS_PRIVILEGE'
    when grantee = 'authenticated' and privilege_type = 'INSERT' then 'OK_AUTH_INSERT'
    when grantee = 'authenticated' and privilege_type in ('SELECT', 'UPDATE', 'DELETE', 'TRUNCATE')
      then 'FAIL_AUTH_EXTRA_PRIVILEGE'
    when grantee = 'public' then 'FAIL_PUBLIC_HAS_PRIVILEGE'
    else 'REVIEW'
  end as classification
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'timesheet_submission_confirmations'
  and grantee in ('anon', 'authenticated', 'public')
order by grantee, privilege_type;

select
  case
    when not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'timesheet_submission_confirmations'
        and grantee = 'anon'
    )
    and exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'timesheet_submission_confirmations'
        and grantee = 'authenticated'
        and privilege_type = 'INSERT'
    )
    and not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'timesheet_submission_confirmations'
        and grantee = 'authenticated'
        and privilege_type in ('SELECT', 'UPDATE', 'DELETE', 'TRUNCATE')
    )
      then 'OK_GRANTS'
    else 'FAIL_GRANTS'
  end as grants_status;

-- =============================================================================
-- 4) Tenant helper functions required by WITH CHECK
-- =============================================================================
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  case
    when p.prosecdef then 'SECURITY_DEFINER'
    else 'SECURITY_INVOKER'
  end as security,
  coalesce(p.proconfig::text, '') as config,
  case
    when p.oid is null then 'MISSING'
    else 'OK_PRESENT'
  end as status
from (
  values
    ('drevora_auth_user_belongs_to_company_id'::text, 1),
    ('drevora_auth_user_has_office_role_for_company', 1),
    ('drevora_auth_user_driver_id', 0),
    ('drevora_driver_in_company', 2)
) as expected(name, nargs)
left join pg_proc p
  on p.proname = expected.name
 and p.pronamespace = 'public'::regnamespace
 and p.pronargs = expected.nargs
order by expected.name;

-- =============================================================================
-- 5) Reject RPC still present (must not rewrite audit history)
-- =============================================================================
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  case when p.prosecdef then 'SECURITY_DEFINER' else 'SECURITY_INVOKER' end as security,
  obj_description(p.oid, 'pg_proc') as comment,
  case
    when p.oid is null then 'MISSING_REJECT_RPC'
    when not p.prosecdef then 'WARN_NOT_SECURITY_DEFINER'
    when coalesce(obj_description(p.oid, 'pg_proc'), '') not like '%timesheet_submission_confirmations%'
      then 'WARN_COMMENT_MISSING_AUDIT_NOTE'
    else 'OK_REJECT_RPC'
  end as status
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname = 'drevora_reject_timesheets'
  and pg_get_function_identity_arguments(p.oid) = 'uuid, uuid[]';

-- =============================================================================
-- 6) Advisor-style summary: RLS on + >=1 policy + anon locked out
-- =============================================================================
with rls as (
  select coalesce(c.relrowsecurity, false) as rls_enabled
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relname = 'timesheet_submission_confirmations'
),
pols as (
  select count(*)::integer as policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'timesheet_submission_confirmations'
),
anon_grants as (
  select count(*)::integer as anon_grant_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'timesheet_submission_confirmations'
    and grantee = 'anon'
)
select
  rls.rls_enabled,
  pols.policy_count,
  anon_grants.anon_grant_count,
  case
    when rls.rls_enabled
     and pols.policy_count >= 1
     and anon_grants.anon_grant_count = 0
      then 'PASS_ADVISOR_RLS_ENABLED_NO_POLICY_SHOULD_CLEAR'
    else 'FAIL_ADVISOR_CONDITION_REMAINS'
  end as advisor_expectation
from rls, pols, anon_grants;

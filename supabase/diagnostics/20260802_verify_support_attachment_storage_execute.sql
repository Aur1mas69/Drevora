-- =============================================================================
-- DREVORA — Verify anon cannot EXECUTE support-attachment storage helpers
-- File: supabase/diagnostics/20260802_verify_support_attachment_storage_execute.sql
-- =============================================================================
-- PURPOSE
--   Verify 20260802150000_revoke_anon_support_attachment_storage_execute.sql:
--   both helpers exist, remain SECURITY DEFINER, anon/public have no EXECUTE,
--   authenticated retains EXECUTE, support-attachments storage policies intact.
--
-- RULES
--   Read-only only: SELECT / WITH / CTE.
--   No CREATE, ALTER, DROP, INSERT, UPDATE, DELETE, TRUNCATE,
--   GRANT, REVOKE, or mutating DO blocks.
--
-- DO NOT EXECUTE as part of automated agent apply — operator runs manually
-- after applying the migration on the Supabase project.
-- =============================================================================

-- =============================================================================
-- 1) Function existence + SECURITY DEFINER + search_path
-- =============================================================================
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  case when p.prosecdef then 'SECURITY_DEFINER' else 'SECURITY_INVOKER' end as security,
  coalesce(p.proconfig::text, '') as config,
  obj_description(p.oid, 'pg_proc') as comment,
  case
    when p.oid is null then 'MISSING'
    when not p.prosecdef then 'FAIL_NOT_SECURITY_DEFINER'
    else 'OK_PRESENT_SECURITY_DEFINER'
  end as status
from (
  values
    ('drevora_storage_can_access_support_attachment'::text),
    ('drevora_storage_can_write_support_attachment')
) as expected(name)
left join pg_proc p
  on p.proname = expected.name
 and p.pronamespace = 'public'::regnamespace
 and pg_get_function_identity_arguments(p.oid) = 'text'
order by expected.name;

-- =============================================================================
-- 2) EXECUTE privileges for anon / public / authenticated / service_role
-- =============================================================================
select
  expected.name as function_name,
  role_name,
  has_function_privilege(role_name, p.oid, 'EXECUTE') as has_execute,
  case
    when role_name = 'anon' and has_function_privilege(role_name, p.oid, 'EXECUTE')
      then 'FAIL_ANON_EXECUTE'
    when role_name = 'public' and has_function_privilege(role_name, p.oid, 'EXECUTE')
      then 'FAIL_PUBLIC_EXECUTE'
    when role_name = 'authenticated' and has_function_privilege(role_name, p.oid, 'EXECUTE')
      then 'OK_AUTHENTICATED_EXECUTE'
    when role_name = 'authenticated' and not has_function_privilege(role_name, p.oid, 'EXECUTE')
      then 'FAIL_AUTHENTICATED_MISSING_EXECUTE'
    when role_name = 'service_role' and has_function_privilege(role_name, p.oid, 'EXECUTE')
      then 'OK_SERVICE_ROLE_EXECUTE_OR_SUPERUSER'
    when role_name = 'service_role' and not has_function_privilege(role_name, p.oid, 'EXECUTE')
      then 'INFO_SERVICE_ROLE_NO_EXPLICIT_EXECUTE'
    else 'REVIEW'
  end as classification
from (
  values
    ('drevora_storage_can_access_support_attachment'::text),
    ('drevora_storage_can_write_support_attachment')
) as expected(name)
cross join (
  values ('anon'::text), ('public'), ('authenticated'), ('service_role')
) as roles(role_name)
left join pg_proc p
  on p.proname = expected.name
 and p.pronamespace = 'public'::regnamespace
 and pg_get_function_identity_arguments(p.oid) = 'text'
where p.oid is not null
order by expected.name, role_name;

-- =============================================================================
-- 3) Advisor-style check: anon must not execute either function
-- =============================================================================
select
  count(*) filter (
    where has_function_privilege('anon', p.oid, 'EXECUTE')
  )::integer as anon_executable_count,
  count(*) filter (
    where has_function_privilege('public', p.oid, 'EXECUTE')
  )::integer as public_executable_count,
  count(*) filter (
    where has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )::integer as authenticated_executable_count,
  case
    when count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE')) = 0
     and count(*) filter (where has_function_privilege('public', p.oid, 'EXECUTE')) = 0
     and count(*) filter (where has_function_privilege('authenticated', p.oid, 'EXECUTE')) = 2
      then 'PASS_ANON_SECURITY_DEFINER_EXECUTABLE_SHOULD_CLEAR'
    else 'FAIL_ADVISOR_CONDITION_REMAINS'
  end as advisor_expectation
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in (
    'drevora_storage_can_access_support_attachment',
    'drevora_storage_can_write_support_attachment'
  )
  and pg_get_function_identity_arguments(p.oid) = 'text';

-- =============================================================================
-- 4) Storage policies still reference helpers and target authenticated only
-- =============================================================================
select
  pol.policyname,
  pol.cmd as command,
  pol.roles,
  pol.qual as using_expression,
  pol.with_check as with_check_expression,
  case
    when pol.policyname = 'support_attachments_select_own'
     and pol.cmd = 'SELECT'
     and 'authenticated' = any (pol.roles)
     and coalesce(pol.qual, '') like '%drevora_storage_can_access_support_attachment%'
      then 'OK_SELECT_POLICY'
    when pol.policyname = 'support_attachments_insert_own'
     and pol.cmd = 'INSERT'
     and 'authenticated' = any (pol.roles)
     and coalesce(pol.with_check, '') like '%drevora_storage_can_write_support_attachment%'
      then 'OK_INSERT_POLICY'
    when pol.policyname = 'support_attachments_delete_own'
     and pol.cmd = 'DELETE'
     and 'authenticated' = any (pol.roles)
     and coalesce(pol.qual, '') like '%drevora_storage_can_write_support_attachment%'
      then 'OK_DELETE_POLICY'
    when 'anon' = any (pol.roles) then 'FAIL_ANON_ROLE_ON_POLICY'
    else 'REVIEW_POLICY'
  end as classification
from pg_policies pol
where pol.schemaname = 'storage'
  and pol.tablename = 'objects'
  and pol.policyname in (
    'support_attachments_select_own',
    'support_attachments_insert_own',
    'support_attachments_delete_own'
  )
order by pol.policyname;

select
  case
    when count(*) = 3
     and count(*) filter (where 'anon' = any (roles)) = 0
      then 'OK_SUPPORT_ATTACHMENT_POLICIES_INTACT'
    when count(*) < 3 then 'FAIL_MISSING_SUPPORT_ATTACHMENT_POLICIES'
    else 'FAIL_POLICY_SET_UNEXPECTED'
  end as storage_policies_status
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'support_attachments_select_own',
    'support_attachments_insert_own',
    'support_attachments_delete_own'
  );

-- =============================================================================
-- 5) Bucket remains private
-- =============================================================================
select
  b.id as bucket_id,
  b.public as is_public,
  case
    when b.id is null then 'MISSING_BUCKET'
    when b.public then 'FAIL_BUCKET_PUBLIC'
    else 'OK_PRIVATE_BUCKET'
  end as status
from storage.buckets b
where b.id = 'support-attachments';

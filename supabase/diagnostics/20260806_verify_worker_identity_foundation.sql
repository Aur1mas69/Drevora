-- =============================================================================
-- DREVORA — Verify Worker identity foundation (post-apply)
-- File: supabase/diagnostics/20260806_verify_worker_identity_foundation.sql
-- =============================================================================
-- PURPOSE
--   Run AFTER applying 20260806200000_worker_identity_foundation.sql.
--   Read-only operator checks for column/index/RPC/RLS/grant shape.
-- =============================================================================

-- 1) Column present
select
  'drivers.auth_user_id' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'drivers'
      and column_name = 'auth_user_id'
  ) as ok;

-- 2) Partial unique index present
select
  'drivers_auth_user_id_active_unique_idx' as check_name,
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'drivers_auth_user_id_active_unique_idx'
  ) as ok;

-- 3) Audit table present
select
  'worker_identity_events' as check_name,
  to_regclass('public.worker_identity_events') is not null as ok;

-- 4) Auth-first resolver source contains auth_user_id preference
select
  'drevora_auth_user_driver_id_auth_first' as check_name,
  position('auth_user_id = auth.uid()' in pg_get_functiondef('public.drevora_auth_user_driver_id()'::regprocedure)) > 0
    as ok;

-- 5) Email fallback still present for unlinked rows
select
  'drevora_auth_user_driver_id_email_fallback' as check_name,
  position('auth_user_id is null' in pg_get_functiondef('public.drevora_auth_user_driver_id()'::regprocedure)) > 0
    as ok;

-- 6) Invite RPC mentions replacement protection
select
  'link_invited_worker_replacement_guard' as check_name,
  position(
    'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
    in pg_get_functiondef(
      'public.drevora_link_invited_worker(uuid,uuid,uuid,text,jsonb)'::regprocedure
    )
  ) > 0 as ok;

-- 7) Audit table grants: authenticated SELECT only (no INSERT/UPDATE/DELETE)
select
  'worker_identity_events_grants' as check_name,
  has_table_privilege('authenticated', 'public.worker_identity_events', 'SELECT') as authenticated_select,
  has_table_privilege('authenticated', 'public.worker_identity_events', 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', 'public.worker_identity_events', 'UPDATE') as authenticated_update,
  has_table_privilege('authenticated', 'public.worker_identity_events', 'DELETE') as authenticated_delete,
  has_table_privilege('service_role', 'public.worker_identity_events', 'INSERT') as service_role_insert;

-- Expected:
--   authenticated_select = true
--   authenticated_insert/update/delete = false
--   service_role_insert = true

-- 8) Office SELECT policy exists
select
  'worker_identity_events_office_select_policy' as check_name,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'worker_identity_events'
      and policyname = 'worker_identity_events_office_select_company'
      and cmd = 'SELECT'
  ) as ok;

-- 9) No authenticated write policies on audit table
select
  'worker_identity_events_no_write_policies' as check_name,
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'worker_identity_events'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) as ok;

-- 10) Insert helper not executable by authenticated
select
  'insert_event_helper_execute' as check_name,
  not has_function_privilege(
    'authenticated',
    'public.drevora_insert_worker_identity_event(uuid,uuid,uuid,uuid,text,jsonb,jsonb,text)',
    'EXECUTE'
  ) as authenticated_execute_revoked,
  has_function_privilege(
    'service_role',
    'public.drevora_insert_worker_identity_event(uuid,uuid,uuid,uuid,text,jsonb,jsonb,text)',
    'EXECUTE'
  ) as service_role_execute;

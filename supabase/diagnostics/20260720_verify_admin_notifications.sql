-- =============================================================================
-- DREVORA — Admin notifications verification (READ-ONLY)
-- File: supabase/diagnostics/20260720_verify_admin_notifications.sql
-- =============================================================================
-- PURPOSE
--   Verify public.notifications + public.notification_reads after applying:
--     20260718020000_create_admin_notifications.sql
--     20260720230000_ensure_admin_notifications.sql
--
-- RULES
--   Read-only only: SELECT / WITH / CTE.
--   No CREATE, ALTER, DROP, INSERT, UPDATE, DELETE, TRUNCATE,
--   GRANT, REVOKE, TEMP TABLE, DO blocks that mutate, or functions.
--
-- DO NOT EXECUTE as part of automated agent apply — operator runs manually.
-- =============================================================================

-- =============================================================================
-- 1) Tables exist
-- =============================================================================
select
  t.table_name,
  case when c.oid is null then 'FAIL_MISSING_TABLE' else 'OK_TABLE_EXISTS' end as status
from (
  values
    ('notifications'::text),
    ('notification_reads'::text)
) as t(table_name)
left join pg_class c
  on c.relname = t.table_name
 and c.relnamespace = 'public'::regnamespace
order by t.table_name;

-- =============================================================================
-- 2) Required columns
-- =============================================================================
with required_columns(table_name, column_name) as (
  values
    ('notifications', 'id'),
    ('notifications', 'company_id'),
    ('notifications', 'notification_type'),
    ('notifications', 'severity'),
    ('notifications', 'title'),
    ('notifications', 'message'),
    ('notifications', 'entity_type'),
    ('notifications', 'entity_id'),
    ('notifications', 'target_path'),
    ('notifications', 'metadata'),
    ('notifications', 'dedupe_key'),
    ('notifications', 'created_at'),
    ('notification_reads', 'notification_id'),
    ('notification_reads', 'user_id'),
    ('notification_reads', 'read_at')
)
select
  r.table_name,
  r.column_name,
  case
    when c.column_name is null then 'FAIL_MISSING_COLUMN'
    else 'OK_COLUMN'
  end as status
from required_columns r
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = r.table_name
 and c.column_name = r.column_name
order by r.table_name, r.column_name;

-- =============================================================================
-- 3) RLS enabled
-- =============================================================================
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  case
    when c.oid is null then 'FAIL_MISSING_TABLE'
    when c.relrowsecurity then 'OK_RLS_ON'
    else 'FAIL_RLS_OFF'
  end as status
from (
  values ('notifications'::text), ('notification_reads'::text)
) as t(table_name)
left join pg_class c
  on c.relname = t.table_name
 and c.relnamespace = 'public'::regnamespace
order by t.table_name;

-- =============================================================================
-- 4) Expected policies
-- =============================================================================
with expected_policies(table_name, policyname, cmd) as (
  values
    ('notifications', 'notifications_select_office_company', 'SELECT'),
    ('notification_reads', 'notification_reads_select_own', 'SELECT'),
    ('notification_reads', 'notification_reads_insert_own', 'INSERT'),
    ('notification_reads', 'notification_reads_update_own', 'UPDATE'),
    ('notification_reads', 'notification_reads_delete_own', 'DELETE')
)
select
  e.table_name,
  e.policyname,
  e.cmd as expected_cmd,
  case
    when p.policyname is null then 'FAIL_MISSING_POLICY'
    when upper(p.cmd) <> e.cmd then 'FAIL_WRONG_CMD'
    when coalesce(p.qual, '') = 'true' or coalesce(p.with_check, '') = 'true'
      then 'FAIL_INSECURE_TRUE'
    else 'OK_POLICY'
  end as status,
  p.qual as using_expression,
  p.with_check as with_check_expression
from expected_policies e
left join pg_policies p
  on p.schemaname = 'public'
 and p.tablename = e.table_name
 and p.policyname = e.policyname
order by e.table_name, e.cmd, e.policyname;

-- =============================================================================
-- 5) Expected indexes
-- =============================================================================
with expected_indexes(index_name) as (
  values
    ('notifications_company_id_idx'),
    ('notifications_created_at_desc_idx'),
    ('notifications_company_created_idx'),
    ('notification_reads_user_id_idx'),
    ('notification_reads_notification_id_idx')
)
select
  e.index_name,
  case when i.indexname is null then 'FAIL_MISSING_INDEX' else 'OK_INDEX' end as status
from expected_indexes e
left join pg_indexes i
  on i.schemaname = 'public'
 and i.indexname = e.index_name
order by e.index_name;

-- =============================================================================
-- 6) Anonymous access must not be granted
-- =============================================================================
select
  table_name,
  privilege_type,
  grantee,
  'FAIL_ANON_GRANT' as status
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('notifications', 'notification_reads')
  and grantee = 'anon'
order by table_name, privilege_type;

-- Expect zero rows above. Explicit OK marker when none:
select
  case
    when exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in ('notifications', 'notification_reads')
        and grantee = 'anon'
    )
      then 'FAIL_ANON_HAS_GRANTS'
    else 'OK_ANON_NO_GRANTS'
  end as anon_grant_status;

-- =============================================================================
-- 7) Realtime publication (required by frontend subscribe)
-- =============================================================================
select
  case
    when not exists (select 1 from pg_publication where pubname = 'supabase_realtime')
      then 'WARN_REALTIME_PUBLICATION_MISSING'
    when exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    )
      then 'OK_IN_REALTIME_PUBLICATION'
    else 'FAIL_NOT_IN_REALTIME_PUBLICATION'
  end as realtime_status;

-- =============================================================================
-- 8) Canonical RPCs (from 20260718020000)
-- =============================================================================
select
  'drevora_generate_expiry_notifications' as function_name,
  case
    when to_regprocedure('public.drevora_generate_expiry_notifications()') is null
      then 'FAIL_MISSING_RPC'
    else 'OK_RPC'
  end as status;

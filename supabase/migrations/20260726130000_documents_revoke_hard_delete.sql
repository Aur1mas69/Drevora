-- DREVORA — Documents: close authenticated hard-delete path
-- File: supabase/migrations/20260726130000_documents_revoke_hard_delete.sql
--
-- Soft delete / restore continue via UPDATE of deleted_at, deleted_by, delete_reason
-- (see 20260726120000_documents_soft_delete.sql). Authenticated Office users must
-- not be able to physically DELETE public.documents rows.
--
-- Idempotent. Does not modify document rows, Storage, or SELECT/INSERT/UPDATE policies.
-- Preserves service_role / maintenance role privileges (not revoked here).

-- -----------------------------------------------------------------------------
-- 1) Drop Office hard-delete RLS policy
-- -----------------------------------------------------------------------------
drop policy if exists documents_office_delete
  on public.documents;

-- -----------------------------------------------------------------------------
-- 2) Audit current DELETE table privileges (commented; run manually after apply)
-- -----------------------------------------------------------------------------
-- select
--   grantee,
--   privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'documents'
--   and privilege_type = 'DELETE'
-- order by grantee;
--
-- select
--   has_table_privilege('authenticated', 'public.documents', 'DELETE')
--     as authenticated_can_delete,
--   has_table_privilege('anon', 'public.documents', 'DELETE')
--     as anon_can_delete;

-- -----------------------------------------------------------------------------
-- 3) Revoke DELETE from client roles
--    PostgreSQL REVOKE is a no-op when the privilege is not currently granted.
--    Live tenant RLS grants DELETE to authenticated; anon was previously
--    revoked in 20260715210000 but may still hold DELETE on older projects.
--    PUBLIC is revoked only as a defensive cleanup of default/legacy grants.
-- -----------------------------------------------------------------------------
revoke delete on table public.documents from authenticated;
revoke delete on table public.documents from anon;
revoke delete on table public.documents from public;

-- Ensure Office soft-delete / restore via UPDATE remain possible.
-- Re-assert required client privileges without DELETE (idempotent).
grant select, insert, update on table public.documents to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Post-apply validation (commented; expect zero DELETE policies for clients)
-- -----------------------------------------------------------------------------
-- select policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'documents'
-- order by policyname;
--
-- Expected policies present:
--   documents_office_select   (SELECT)
--   documents_office_insert   (INSERT)
--   documents_office_update   (UPDATE)
--   documents_worker_select_own (SELECT)
-- Expected absent:
--   documents_office_delete   (DELETE)
--
-- select policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'documents'
--   and cmd = 'DELETE';
-- -- Expected: zero rows
--
-- select
--   has_table_privilege('authenticated', 'public.documents', 'DELETE')
--     as authenticated_can_delete,
--   has_table_privilege('anon', 'public.documents', 'DELETE')
--     as anon_can_delete;
-- -- Expected: authenticated_can_delete = false, anon_can_delete = false
--
-- select
--   has_table_privilege('authenticated', 'public.documents', 'SELECT') as authenticated_can_select,
--   has_table_privilege('authenticated', 'public.documents', 'INSERT') as authenticated_can_insert,
--   has_table_privilege('authenticated', 'public.documents', 'UPDATE') as authenticated_can_update;
-- -- Expected: all true
--
-- Row count must be unchanged by this migration (no DML against documents):
-- select count(*) from public.documents;

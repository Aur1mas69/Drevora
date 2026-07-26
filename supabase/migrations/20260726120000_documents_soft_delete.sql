-- DREVORA — Documents soft delete (review-only; do not auto-apply)
-- File: supabase/migrations/20260726120000_documents_soft_delete.sql
--
-- Adds the minimum soft-delete lifecycle columns to public.documents so Admin
-- Documents can archive/restore rows without SQL DELETE or Storage removal.
-- Follows the timesheets soft-delete convention: deleted_at / deleted_by / delete_reason.

-- -----------------------------------------------------------------------------
-- 1) Soft-delete columns
-- -----------------------------------------------------------------------------
alter table public.documents
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid null,
  add column if not exists delete_reason text null;

comment on column public.documents.deleted_at is
  'Soft-delete timestamp. NULL = active document in the default Documents list.';
comment on column public.documents.deleted_by is
  'auth.users.id of the office user who soft-deleted the row, when available.';
comment on column public.documents.delete_reason is
  'Optional free-text reason for the soft delete.';

-- -----------------------------------------------------------------------------
-- 2) Indexes (active list + archived lookups)
-- -----------------------------------------------------------------------------
create index if not exists documents_company_id_deleted_at_idx
  on public.documents (company_id, deleted_at);

create index if not exists documents_deleted_at_idx
  on public.documents (deleted_at)
  where deleted_at is not null;

-- -----------------------------------------------------------------------------
-- 3) Verification queries (run after applying; expect expected shapes)
-- -----------------------------------------------------------------------------
-- Columns present:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'documents'
--   and column_name in ('deleted_at', 'deleted_by', 'delete_reason')
-- order by column_name;
--
-- Active vs archived counts (company-scoped in app; global here):
-- select
--   count(*) filter (where deleted_at is null) as active_count,
--   count(*) filter (where deleted_at is not null) as archived_count
-- from public.documents;
--
-- No hard-delete required for archive:
-- update public.documents
-- set deleted_at = now(), deleted_by = auth.uid(), delete_reason = 'verification'
-- where id = '<document-uuid>' and company_id = '<company-uuid>' and deleted_at is null;
--
-- Restore:
-- update public.documents
-- set deleted_at = null, deleted_by = null, delete_reason = null, updated_at = now()
-- where id = '<document-uuid>' and company_id = '<company-uuid>' and deleted_at is not null;

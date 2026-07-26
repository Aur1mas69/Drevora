-- DREVORA — Worker Document Submissions lifecycle (review-only; do not auto-apply)
-- File: supabase/migrations/20260726160000_worker_document_submissions_lifecycle.sql
--
-- Extends public.worker_document_submissions with soft-delete columns and
-- Office-only SECURITY DEFINER RPCs for metadata edit, soft delete and restore.
-- Does NOT edit 20260726150000. No SQL DELETE. No Storage object changes.
--
-- Apply on Supabase after review. Do not auto-apply from the app.

begin;

-- -----------------------------------------------------------------------------
-- 1) Soft-delete columns
-- -----------------------------------------------------------------------------
alter table public.worker_document_submissions
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid null,
  add column if not exists delete_reason text null;

comment on column public.worker_document_submissions.deleted_at is
  'Soft-delete timestamp. NULL = active Worker upload; NOT NULL = archived.';
comment on column public.worker_document_submissions.deleted_by is
  'auth.users.id of the office user who soft-deleted the submission, when available.';
comment on column public.worker_document_submissions.delete_reason is
  'Optional free-text reason for the soft delete.';

create index if not exists worker_document_submissions_company_id_deleted_at_idx
  on public.worker_document_submissions (company_id, deleted_at);

create index if not exists worker_document_submissions_deleted_at_idx
  on public.worker_document_submissions (deleted_at)
  where deleted_at is not null;

-- -----------------------------------------------------------------------------
-- 2) Re-assert SELECT-only table grants (mutations via SECURITY DEFINER RPCs)
-- -----------------------------------------------------------------------------
alter table public.worker_document_submissions enable row level security;

revoke all on table public.worker_document_submissions from anon;
revoke all on table public.worker_document_submissions from public;
revoke all on table public.worker_document_submissions from authenticated;
grant select on table public.worker_document_submissions to authenticated;

-- -----------------------------------------------------------------------------
-- 3) Review RPC — preserve signature; block archived rows
-- -----------------------------------------------------------------------------
create or replace function public.drevora_review_worker_document_submission(
  p_submission_id uuid,
  p_company_id uuid,
  p_review_status text,
  p_rejection_reason text default null
)
returns public.worker_document_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.worker_document_submissions;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_submission_id is null or p_company_id is null then
    raise exception 'submission_id and company_id are required';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'Not authorised for this company';
  end if;

  if p_review_status not in ('reviewed', 'rejected') then
    raise exception 'Invalid review status';
  end if;

  if p_review_status = 'rejected' then
    v_reason := nullif(trim(p_rejection_reason), '');
    if v_reason is null then
      raise exception 'A rejection reason is required';
    end if;
  else
    v_reason := null;
  end if;

  select *
  into v_row
  from public.worker_document_submissions s
  where s.id = p_submission_id
    and s.company_id = p_company_id
  for update;

  if v_row.id is null then
    raise exception 'Submission could not be reviewed for your company';
  end if;

  if v_row.deleted_at is not null then
    raise exception 'Restore this submission before reviewing it';
  end if;

  if v_row.review_status <> 'pending_review' then
    raise exception 'Submission could not be reviewed for your company';
  end if;

  update public.worker_document_submissions s
  set
    review_status = p_review_status,
    rejection_reason = v_reason,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where s.id = v_row.id
    and s.company_id = p_company_id
    and s.deleted_at is null
    and s.review_status = 'pending_review'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Submission could not be reviewed for your company';
  end if;

  return v_row;
end;
$$;

revoke all on function public.drevora_review_worker_document_submission(
  uuid, uuid, text, text
) from public;
revoke all on function public.drevora_review_worker_document_submission(
  uuid, uuid, text, text
) from anon;
grant execute on function public.drevora_review_worker_document_submission(
  uuid, uuid, text, text
) to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Edit metadata RPC
-- -----------------------------------------------------------------------------
create or replace function public.drevora_update_worker_document_submission_metadata(
  p_submission_id uuid,
  p_company_id uuid,
  p_document_type text,
  p_custom_document_name text,
  p_reference_number text,
  p_notes text
)
returns public.worker_document_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.worker_document_submissions;
  v_type text;
  v_custom_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_submission_id is null or p_company_id is null then
    raise exception 'submission_id and company_id are required';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'Not authorised for this company';
  end if;

  v_type := nullif(trim(p_document_type), '');
  if v_type is null
     or v_type not in (
       'CMR',
       'POD / Delivery Note',
       'Receipt',
       'Vehicle / Load Document',
       'Other'
     )
  then
    raise exception 'Invalid document type';
  end if;

  if v_type = 'Other' then
    v_custom_name := nullif(trim(p_custom_document_name), '');
    if v_custom_name is null then
      raise exception 'A custom document name is required when type is Other';
    end if;
  else
    v_custom_name := null;
  end if;

  select *
  into v_row
  from public.worker_document_submissions s
  where s.id = p_submission_id
    and s.company_id = p_company_id
  for update;

  if v_row.id is null then
    raise exception 'Submission could not be updated for your company';
  end if;

  if v_row.deleted_at is not null then
    raise exception 'Restore this submission before editing it';
  end if;

  update public.worker_document_submissions s
  set
    document_type = v_type,
    custom_document_name = v_custom_name,
    reference_number = nullif(trim(p_reference_number), ''),
    notes = nullif(trim(p_notes), ''),
    updated_at = now()
  where s.id = v_row.id
    and s.company_id = p_company_id
    and s.deleted_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Submission could not be updated for your company';
  end if;

  return v_row;
end;
$$;

revoke all on function public.drevora_update_worker_document_submission_metadata(
  uuid, uuid, text, text, text, text
) from public;
revoke all on function public.drevora_update_worker_document_submission_metadata(
  uuid, uuid, text, text, text, text
) from anon;
grant execute on function public.drevora_update_worker_document_submission_metadata(
  uuid, uuid, text, text, text, text
) to authenticated;

-- -----------------------------------------------------------------------------
-- 5) Soft-delete RPC
-- -----------------------------------------------------------------------------
create or replace function public.drevora_soft_delete_worker_document_submission(
  p_submission_id uuid,
  p_company_id uuid,
  p_delete_reason text default null
)
returns public.worker_document_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.worker_document_submissions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_submission_id is null or p_company_id is null then
    raise exception 'submission_id and company_id are required';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'Not authorised for this company';
  end if;

  select *
  into v_row
  from public.worker_document_submissions s
  where s.id = p_submission_id
    and s.company_id = p_company_id
  for update;

  if v_row.id is null then
    raise exception 'Submission could not be archived for your company';
  end if;

  if v_row.deleted_at is not null then
    raise exception 'Submission is already archived';
  end if;

  update public.worker_document_submissions s
  set
    deleted_at = now(),
    deleted_by = auth.uid(),
    delete_reason = nullif(trim(p_delete_reason), ''),
    updated_at = now()
  where s.id = v_row.id
    and s.company_id = p_company_id
    and s.deleted_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Submission could not be archived for your company';
  end if;

  return v_row;
end;
$$;

revoke all on function public.drevora_soft_delete_worker_document_submission(
  uuid, uuid, text
) from public;
revoke all on function public.drevora_soft_delete_worker_document_submission(
  uuid, uuid, text
) from anon;
grant execute on function public.drevora_soft_delete_worker_document_submission(
  uuid, uuid, text
) to authenticated;

-- -----------------------------------------------------------------------------
-- 6) Restore RPC
-- -----------------------------------------------------------------------------
create or replace function public.drevora_restore_worker_document_submission(
  p_submission_id uuid,
  p_company_id uuid
)
returns public.worker_document_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.worker_document_submissions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_submission_id is null or p_company_id is null then
    raise exception 'submission_id and company_id are required';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'Not authorised for this company';
  end if;

  select *
  into v_row
  from public.worker_document_submissions s
  where s.id = p_submission_id
    and s.company_id = p_company_id
  for update;

  if v_row.id is null then
    raise exception 'Submission could not be restored for your company';
  end if;

  if v_row.deleted_at is null then
    raise exception 'Submission is not archived';
  end if;

  update public.worker_document_submissions s
  set
    deleted_at = null,
    deleted_by = null,
    delete_reason = null,
    updated_at = now()
  where s.id = v_row.id
    and s.company_id = p_company_id
    and s.deleted_at is not null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Submission could not be restored for your company';
  end if;

  return v_row;
end;
$$;

revoke all on function public.drevora_restore_worker_document_submission(
  uuid, uuid
) from public;
revoke all on function public.drevora_restore_worker_document_submission(
  uuid, uuid
) from anon;
grant execute on function public.drevora_restore_worker_document_submission(
  uuid, uuid
) to authenticated;

commit;

-- -----------------------------------------------------------------------------
-- Diagnostics (run after apply; commented)
-- -----------------------------------------------------------------------------
-- -- Columns
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'worker_document_submissions'
--   and column_name in ('deleted_at', 'deleted_by', 'delete_reason')
-- order by column_name;
--
-- -- Active vs archived counts
-- select
--   count(*) filter (where deleted_at is null) as active_count,
--   count(*) filter (where deleted_at is not null) as archived_count
-- from public.worker_document_submissions;
--
-- -- Table grants (authenticated SELECT only expected)
-- select
--   grantee,
--   privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'worker_document_submissions'
--   and grantee in ('anon', 'authenticated', 'PUBLIC', 'public')
-- order by grantee, privilege_type;
--
-- -- Mutation policies only (INSERT/UPDATE/DELETE/ALL). Expect zero rows.
-- select pol.polname, pol.polcmd::text as cmd
-- from pg_policy pol
-- join pg_class cls on cls.oid = pol.polrelid
-- join pg_namespace nsp on nsp.oid = cls.relnamespace
-- where nsp.nspname = 'public'
--   and cls.relname = 'worker_document_submissions'
--   and pol.polcmd in ('a', 'w', 'd', '*')
-- order by pol.polname;
--
-- -- RPC signatures + SECURITY DEFINER + search_path / proconfig (text[])
-- select
--   p.proname,
--   pg_get_function_identity_arguments(p.oid) as args,
--   p.prosecdef as security_definer,
--   coalesce(array_to_string(p.proconfig, ', '), '') as config
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'drevora_review_worker_document_submission',
--     'drevora_update_worker_document_submission_metadata',
--     'drevora_soft_delete_worker_document_submission',
--     'drevora_restore_worker_document_submission'
--   )
-- order by p.proname;
--
-- -- Explicit function ACL entries, including PUBLIC as grantee OID 0
-- select
--   p.proname,
--   case when acl.grantee = 0 then 'PUBLIC' else role.rolname end as grantee,
--   acl.privilege_type
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- cross join lateral aclexplode(
--   coalesce(p.proacl, acldefault('f', p.proowner))
-- ) as acl
-- left join pg_roles role on role.oid = acl.grantee
-- where n.nspname = 'public'
--   and p.proname in (
--     'drevora_review_worker_document_submission',
--     'drevora_update_worker_document_submission_metadata',
--     'drevora_soft_delete_worker_document_submission',
--     'drevora_restore_worker_document_submission'
--   )
--   and acl.privilege_type = 'EXECUTE'
-- order by p.proname, grantee;
--
-- -- Effective EXECUTE for anon / authenticated (expect false / true)
-- select
--   p.proname,
--   has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
--   has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'drevora_review_worker_document_submission',
--     'drevora_update_worker_document_submission_metadata',
--     'drevora_soft_delete_worker_document_submission',
--     'drevora_restore_worker_document_submission'
--   )
-- order by p.proname;
--
-- -- Authenticated must NOT have direct INSERT/UPDATE/DELETE
-- select
--   has_table_privilege('authenticated', 'public.worker_document_submissions', 'INSERT') as can_insert,
--   has_table_privilege('authenticated', 'public.worker_document_submissions', 'UPDATE') as can_update,
--   has_table_privilege('authenticated', 'public.worker_document_submissions', 'DELETE') as can_delete;
--
-- -- No DELETE policy
-- select count(*) = 0 as no_delete_policy
-- from pg_policy pol
-- join pg_class cls on cls.oid = pol.polrelid
-- join pg_namespace nsp on nsp.oid = cls.relnamespace
-- where nsp.nspname = 'public'
--   and cls.relname = 'worker_document_submissions'
--   and pol.polcmd = 'd';
--
-- -- Attachment row count (record before/after lifecycle RPC tests; do not mutate)
-- select count(*) as attachment_rows
-- from public.worker_document_submission_attachments;
--
-- -- Worker submission Storage object count (record before/after; do not mutate)
-- select count(*) as worker_submission_storage_objects
-- from storage.objects
-- where bucket_id = 'document-files'
--   and name like 'worker-submissions/%';
--
-- -- Manual checks (replace UUIDs):
-- -- select public.drevora_update_worker_document_submission_metadata(...);
-- -- select public.drevora_soft_delete_worker_document_submission(...);
-- -- select public.drevora_restore_worker_document_submission(...);
-- -- Archived review must fail:
-- -- select public.drevora_review_worker_document_submission('<archived-id>', '<company-id>', 'reviewed', null);
-- -- Cross-company mutation must fail with Not authorised / could not be ... for your company.

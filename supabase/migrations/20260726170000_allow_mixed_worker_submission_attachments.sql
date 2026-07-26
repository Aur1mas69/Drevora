-- =============================================================================
-- File: supabase/migrations/20260726170000_allow_mixed_worker_submission_attachments.sql
--
-- Allow any mixture of PDF and image attachments within the existing 1–5
-- attachment limit for Worker Document Submissions.
--
-- REVIEW ONLY — do not apply until reviewed.
-- Applied migrations 150000 / 160000 must remain unchanged.
--
-- Preserved:
--   - 1–5 attachments total
--   - 10 MB per attachment (table check)
--   - MIME allow-list (table check)
--   - sort_order 1–5 + uniqueness
--   - unique file_path
--   - FK ON DELETE RESTRICT
--   - deferred constraint triggers (same function names)
--   - no table/trigger recreation
--   - no RLS / grant / Storage policy changes
--   - no hard delete / Storage deletion
--   - create RPC unchanged (already accepts 1–5 of any allowed MIME)
--
-- Removed composition rules only:
--   - cannot mix PDF and images
--   - at most one PDF
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Attachment-set validation (constraint trigger on attachments)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_validate_worker_submission_attachments()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_submission_id uuid;
  v_count integer;
  v_pdf_count integer;
  v_image_count integer;
begin
  if TG_OP = 'DELETE' then
    v_submission_id := old.submission_id;
  else
    v_submission_id := new.submission_id;
  end if;

  select
    count(*)::integer,
    count(*) filter (where mime_type = 'application/pdf')::integer,
    count(*) filter (where mime_type in ('image/jpeg', 'image/png', 'image/webp'))::integer
  into v_count, v_pdf_count, v_image_count
  from public.worker_document_submission_attachments
  where submission_id = v_submission_id;

  if v_count = 0 then
    if exists (
      select 1
      from public.worker_document_submissions s
      where s.id = v_submission_id
    ) then
      raise exception 'A submission must have at least one attachment';
    end if;
    if TG_OP = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if v_count > 5 then
    raise exception 'A submission may have at most five attachments';
  end if;

  -- Any mixture of allowed PDF/image MIME types is valid.
  -- Reject only if some row is outside the allowed MIME set.
  if v_pdf_count + v_image_count <> v_count then
    raise exception 'Unsupported attachment type';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Parent completeness validation (deferred constraint trigger on submissions)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_validate_worker_submission_completeness()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
  v_pdf_count integer;
  v_image_count integer;
begin
  select
    count(*)::integer,
    count(*) filter (where mime_type = 'application/pdf')::integer,
    count(*) filter (where mime_type in ('image/jpeg', 'image/png', 'image/webp'))::integer
  into v_count, v_pdf_count, v_image_count
  from public.worker_document_submission_attachments
  where submission_id = new.id;

  if v_count < 1 then
    raise exception 'A submission must have at least one attachment';
  end if;

  if v_count > 5 then
    raise exception 'A submission may have at most five attachments';
  end if;

  if v_pdf_count + v_image_count <> v_count then
    raise exception 'Unsupported attachment type';
  end if;

  return new;
end;
$$;

commit;

-- -----------------------------------------------------------------------------
-- Diagnostics (run after apply; commented — do not mutate data)
-- -----------------------------------------------------------------------------
-- -- Validation function signatures + security + search_path
-- select
--   p.proname,
--   pg_get_function_identity_arguments(p.oid) as args,
--   p.prosecdef as security_definer,
--   coalesce(array_to_string(p.proconfig, ', '), '') as config
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'drevora_validate_worker_submission_attachments',
--     'drevora_validate_worker_submission_completeness'
--   )
-- order by p.proname;
--
-- -- Constraint triggers still attached and enabled
-- select
--   c.relname as table_name,
--   t.tgname,
--   t.tgenabled,
--   pg_get_triggerdef(t.oid) as definition
-- from pg_trigger t
-- join pg_class c on c.oid = t.tgrelid
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and not t.tgisinternal
--   and t.tgname in (
--     'worker_document_submission_attachments_validate_ai',
--     'worker_document_submission_attachments_validate_au',
--     'worker_document_submission_attachments_validate_ad',
--     'worker_document_submissions_validate_completeness'
--   )
-- order by c.relname, t.tgname;
--
-- -- Invalid zero-attachment parents (expect 0)
-- select s.id
-- from public.worker_document_submissions s
-- left join public.worker_document_submission_attachments a
--   on a.submission_id = s.id
-- group by s.id
-- having count(a.id) = 0;
--
-- -- Over-five attachment sets (expect 0)
-- select submission_id, count(*) as attachment_count
-- from public.worker_document_submission_attachments
-- group by submission_id
-- having count(*) > 5;
--
-- -- Current mixed sets (informational; should be allowed after apply)
-- select
--   submission_id,
--   count(*) filter (where mime_type = 'application/pdf') as pdf_count,
--   count(*) filter (
--     where mime_type in ('image/jpeg', 'image/png', 'image/webp')
--   ) as image_count,
--   count(*) as total_count
-- from public.worker_document_submission_attachments
-- group by submission_id
-- having count(*) filter (where mime_type = 'application/pdf') > 0
--    and count(*) filter (
--      where mime_type in ('image/jpeg', 'image/png', 'image/webp')
--    ) > 0
-- order by submission_id;
--
-- -- Per-MIME counts (informational)
-- select mime_type, count(*) as row_count
-- from public.worker_document_submission_attachments
-- group by mime_type
-- order by mime_type;
--
-- -- Table constraints still present
-- select conname, contype, pg_get_constraintdef(oid) as definition
-- from pg_constraint
-- where conrelid in (
--   'public.worker_document_submissions'::regclass,
--   'public.worker_document_submission_attachments'::regclass
-- )
-- order by conrelid::regclass::text, conname;
--
-- -- Direct mutation grants unchanged (authenticated SELECT only expected)
-- select
--   table_name,
--   grantee,
--   privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name in (
--     'worker_document_submissions',
--     'worker_document_submission_attachments'
--   )
--   and grantee in ('anon', 'authenticated', 'PUBLIC', 'public')
-- order by table_name, grantee, privilege_type;
--
-- select
--   has_table_privilege('authenticated', 'public.worker_document_submissions', 'INSERT') as submissions_insert,
--   has_table_privilege('authenticated', 'public.worker_document_submissions', 'UPDATE') as submissions_update,
--   has_table_privilege('authenticated', 'public.worker_document_submissions', 'DELETE') as submissions_delete,
--   has_table_privilege('authenticated', 'public.worker_document_submission_attachments', 'INSERT') as attachments_insert,
--   has_table_privilege('authenticated', 'public.worker_document_submission_attachments', 'UPDATE') as attachments_update,
--   has_table_privilege('authenticated', 'public.worker_document_submission_attachments', 'DELETE') as attachments_delete;
--
-- -- No DELETE policy on either table
-- select
--   cls.relname,
--   count(*) filter (where pol.polcmd = 'd') as delete_policy_count
-- from pg_class cls
-- join pg_namespace nsp on nsp.oid = cls.relnamespace
-- left join pg_policy pol on pol.polrelid = cls.oid
-- where nsp.nspname = 'public'
--   and cls.relname in (
--     'worker_document_submissions',
--     'worker_document_submission_attachments'
--   )
-- group by cls.relname
-- order by cls.relname;
--
-- -- Attachment and Storage counts (record before/after; do not mutate)
-- select count(*) as attachment_rows
-- from public.worker_document_submission_attachments;
--
-- select count(*) as worker_submission_storage_objects
-- from storage.objects
-- where bucket_id = 'document-files'
--   and name like 'worker-submissions/%';
--
-- -- Manual test guidance (do NOT run as seed data in this migration):
-- -- 1) One PDF — must succeed
-- -- 2) Five PDFs — must succeed
-- -- 3) One PDF + four images — must succeed
-- -- 4) Two PDFs + three images — must succeed
-- -- 5) Six total files — must fail
-- -- 6) Unsupported MIME — must fail
-- -- Prefer exercising via Worker UI / create RPC after apply rather than
-- -- inserting synthetic rows here.

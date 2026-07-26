-- DREVORA — Worker Document Submissions (security-hardened; review-only; do not auto-apply)
-- File: supabase/migrations/20260726150000_create_worker_document_submissions.sql
--
-- Parent + attachment tables for Worker multi-file submissions shown in Admin Documents.
-- Reuses private document-files bucket under worker-submissions/... paths.
-- Mutations only via SECURITY DEFINER RPCs. No hard DELETE. No Storage scheduler.
--
-- Storage metadata convention (Supabase storage.objects):
--   metadata->>'mimetype'
--   metadata->>'size'

begin;

-- -----------------------------------------------------------------------------
-- 1) Tables
-- -----------------------------------------------------------------------------
create table if not exists public.worker_document_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  worker_id uuid not null references public.drivers (id),
  document_type text not null,
  custom_document_name text null,
  reference_number text null,
  notes text null,
  review_status text not null default 'pending_review',
  rejection_reason text null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_document_submissions_type_check check (
    document_type in (
      'CMR',
      'POD / Delivery Note',
      'Receipt',
      'Vehicle / Load Document',
      'Other'
    )
  ),
  constraint worker_document_submissions_other_name_check check (
    (document_type = 'Other' and nullif(trim(custom_document_name), '') is not null)
    or (document_type <> 'Other' and custom_document_name is null)
  ),
  constraint worker_document_submissions_status_check check (
    review_status in ('pending_review', 'reviewed', 'rejected')
  ),
  constraint worker_document_submissions_rejection_check check (
    (
      review_status = 'rejected'
      and nullif(trim(rejection_reason), '') is not null
    )
    or (
      review_status <> 'rejected'
      and rejection_reason is null
    )
  )
);

create index if not exists worker_document_submissions_company_id_idx
  on public.worker_document_submissions (company_id);
create index if not exists worker_document_submissions_worker_id_idx
  on public.worker_document_submissions (worker_id);
create index if not exists worker_document_submissions_status_idx
  on public.worker_document_submissions (company_id, review_status);
create index if not exists worker_document_submissions_submitted_at_idx
  on public.worker_document_submissions (company_id, submitted_at desc);

create table if not exists public.worker_document_submission_attachments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.worker_document_submissions (id) on delete restrict,
  file_path text not null,
  original_file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint worker_document_submission_attachments_mime_check check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  constraint worker_document_submission_attachments_size_check check (
    file_size_bytes > 0 and file_size_bytes <= 10485760
  ),
  constraint worker_document_submission_attachments_sort_check check (
    sort_order >= 1 and sort_order <= 5
  ),
  constraint worker_document_submission_attachments_sort_unique
    unique (submission_id, sort_order),
  constraint worker_document_submission_attachments_path_unique
    unique (file_path)
);

create index if not exists worker_document_submission_attachments_submission_id_idx
  on public.worker_document_submission_attachments (submission_id);

drop trigger if exists worker_document_submissions_set_updated_at
  on public.worker_document_submissions;
create trigger worker_document_submissions_set_updated_at
  before update on public.worker_document_submissions
  for each row
  execute function public.drevora_set_updated_at();

-- Attachment-set rules + non-empty set while parent exists.
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

  if v_pdf_count > 0 and v_image_count > 0 then
    raise exception 'A submission cannot mix PDF and image attachments';
  end if;

  if v_pdf_count > 1 then
    raise exception 'A submission may contain only one PDF';
  end if;

  if v_pdf_count = 0 and v_image_count = 0 then
    raise exception 'Unsupported attachment type';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Deferred parent completeness: parent insert without attachments fails at commit.
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

  if v_pdf_count > 0 and v_image_count > 0 then
    raise exception 'A submission cannot mix PDF and image attachments';
  end if;

  if v_pdf_count > 1 then
    raise exception 'A submission may contain only one PDF';
  end if;

  if v_pdf_count = 0 and v_image_count = 0 then
    raise exception 'Unsupported attachment type';
  end if;

  return new;
end;
$$;

drop trigger if exists worker_document_submission_attachments_validate_ai
  on public.worker_document_submission_attachments;
drop trigger if exists worker_document_submission_attachments_validate_au
  on public.worker_document_submission_attachments;
drop trigger if exists worker_document_submission_attachments_validate_ad
  on public.worker_document_submission_attachments;
drop trigger if exists worker_document_submissions_validate_completeness
  on public.worker_document_submissions;

create constraint trigger worker_document_submission_attachments_validate_ai
  after insert on public.worker_document_submission_attachments
  deferrable initially deferred
  for each row
  execute function public.drevora_validate_worker_submission_attachments();

create constraint trigger worker_document_submission_attachments_validate_au
  after update on public.worker_document_submission_attachments
  deferrable initially deferred
  for each row
  execute function public.drevora_validate_worker_submission_attachments();

create constraint trigger worker_document_submission_attachments_validate_ad
  after delete on public.worker_document_submission_attachments
  deferrable initially deferred
  for each row
  execute function public.drevora_validate_worker_submission_attachments();

create constraint trigger worker_document_submissions_validate_completeness
  after insert on public.worker_document_submissions
  deferrable initially deferred
  for each row
  execute function public.drevora_validate_worker_submission_completeness();

-- -----------------------------------------------------------------------------
-- 2) RLS — SELECT only for authenticated (mutations via SECURITY DEFINER RPCs)
-- -----------------------------------------------------------------------------
alter table public.worker_document_submissions enable row level security;
alter table public.worker_document_submission_attachments enable row level security;

revoke all on table public.worker_document_submissions from anon;
revoke all on table public.worker_document_submissions from public;
revoke all on table public.worker_document_submissions from authenticated;
revoke all on table public.worker_document_submission_attachments from anon;
revoke all on table public.worker_document_submission_attachments from public;
revoke all on table public.worker_document_submission_attachments from authenticated;

grant select on table public.worker_document_submissions to authenticated;
grant select on table public.worker_document_submission_attachments to authenticated;

drop policy if exists worker_document_submissions_worker_select_own
  on public.worker_document_submissions;
drop policy if exists worker_document_submissions_office_select
  on public.worker_document_submissions;
drop policy if exists worker_document_submissions_worker_insert_own
  on public.worker_document_submissions;
drop policy if exists worker_document_submissions_office_update
  on public.worker_document_submissions;
drop policy if exists worker_document_submission_attachments_worker_select_own
  on public.worker_document_submission_attachments;
drop policy if exists worker_document_submission_attachments_office_select
  on public.worker_document_submission_attachments;
drop policy if exists worker_document_submission_attachments_worker_insert_own
  on public.worker_document_submission_attachments;

create policy worker_document_submissions_worker_select_own
  on public.worker_document_submissions
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
  );

create policy worker_document_submissions_office_select
  on public.worker_document_submissions
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy worker_document_submission_attachments_worker_select_own
  on public.worker_document_submission_attachments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.worker_document_submissions s
      where s.id = submission_id
        and public.drevora_auth_user_belongs_to_company_id(s.company_id)
        and s.worker_id = public.drevora_auth_user_driver_id()
    )
  );

create policy worker_document_submission_attachments_office_select
  on public.worker_document_submission_attachments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.worker_document_submissions s
      where s.id = submission_id
        and public.drevora_auth_user_has_office_role_for_company(s.company_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 3) Atomic create + office review RPCs (SECURITY DEFINER)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_create_worker_document_submission(
  p_submission_id uuid,
  p_company_id uuid,
  p_document_type text,
  p_custom_document_name text,
  p_reference_number text,
  p_notes text,
  p_attachments jsonb
)
returns public.worker_document_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker_id uuid;
  v_row public.worker_document_submissions;
  v_item jsonb;
  v_count integer;
  v_path text;
  v_expected_prefix text;
  v_attachment_id uuid;
  v_file_segment text;
  v_expected_file_prefix text;
  v_sort_order integer;
  v_original_name text;
  v_mime text;
  v_size bigint;
  v_seen_ids uuid[] := array[]::uuid[];
  v_seen_paths text[] := array[]::text[];
  v_seen_sorts integer[] := array[]::integer[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_submission_id is null or p_company_id is null then
    raise exception 'submission_id and company_id are required';
  end if;

  if not public.drevora_auth_user_belongs_to_company_id(p_company_id) then
    raise exception 'Not authorised for this company';
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null then
    raise exception 'Worker profile not found';
  end if;

  if not public.drevora_driver_in_company(v_worker_id, p_company_id) then
    raise exception 'Worker does not belong to this company';
  end if;

  if p_attachments is null or jsonb_typeof(p_attachments) <> 'array' then
    raise exception 'Attachments are required';
  end if;

  v_count := jsonb_array_length(p_attachments);
  if v_count < 1 or v_count > 5 then
    raise exception 'A submission requires between 1 and 5 attachments';
  end if;

  v_expected_prefix :=
    'worker-submissions/'
    || p_company_id::text
    || '/'
    || v_worker_id::text
    || '/'
    || p_submission_id::text
    || '/';

  insert into public.worker_document_submissions (
    id,
    company_id,
    worker_id,
    document_type,
    custom_document_name,
    reference_number,
    notes,
    review_status,
    rejection_reason,
    reviewed_at,
    reviewed_by,
    submitted_at
  )
  values (
    p_submission_id,
    p_company_id,
    v_worker_id,
    p_document_type,
    case
      when p_document_type = 'Other' then nullif(trim(p_custom_document_name), '')
      else null
    end,
    nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''),
    'pending_review',
    null,
    null,
    null,
    now()
  )
  returning * into v_row;

  for v_item in
    select value
    from jsonb_array_elements(p_attachments) as t(value)
  loop
    begin
      v_attachment_id := (v_item ->> 'id')::uuid;
    exception
      when others then
        raise exception 'Invalid attachment id';
    end;

    if v_attachment_id is null then
      raise exception 'Attachment id is required';
    end if;

    if v_attachment_id = any (v_seen_ids) then
      raise exception 'Duplicate attachment id';
    end if;
    v_seen_ids := array_append(v_seen_ids, v_attachment_id);

    v_path := nullif(trim(v_item ->> 'file_path'), '');
    if v_path is null then
      raise exception 'Attachment file_path is required';
    end if;

    if v_path = any (v_seen_paths) then
      raise exception 'Duplicate attachment path';
    end if;
    v_seen_paths := array_append(v_seen_paths, v_path);

    if left(v_path, length(v_expected_prefix)) is distinct from v_expected_prefix then
      raise exception 'Invalid attachment storage path';
    end if;

    if split_part(v_path, '/', 4) is distinct from p_submission_id::text then
      raise exception 'Attachment path submission id mismatch';
    end if;

    v_file_segment := split_part(v_path, '/', 5);
    v_expected_file_prefix := v_attachment_id::text || '-';
    if v_file_segment is null
       or left(v_file_segment, length(v_expected_file_prefix))
          is distinct from v_expected_file_prefix then
      raise exception 'Attachment path does not match attachment id';
    end if;

    begin
      v_sort_order := (v_item ->> 'sort_order')::integer;
    exception
      when others then
        raise exception 'Invalid attachment sort_order';
    end;

    if v_sort_order is null or v_sort_order < 1 or v_sort_order > 5 then
      raise exception 'Invalid attachment sort_order';
    end if;

    if v_sort_order = any (v_seen_sorts) then
      raise exception 'Duplicate attachment sort_order';
    end if;
    v_seen_sorts := array_append(v_seen_sorts, v_sort_order);

    v_original_name := coalesce(nullif(trim(v_item ->> 'original_file_name'), ''), 'file');

    -- Verify real Storage object; never trust client MIME/size.
    select
      lower(nullif(trim(o.metadata ->> 'mimetype'), '')),
      nullif(trim(o.metadata ->> 'size'), '')::bigint
    into v_mime, v_size
    from storage.objects o
    where o.bucket_id = 'document-files'
      and o.name = v_path;

    if v_mime is null or v_size is null then
      raise exception 'Attachment storage object missing or incomplete: %', v_path;
    end if;

    if v_mime not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Unsupported attachment MIME type';
    end if;

    if v_size <= 0 or v_size > 10485760 then
      raise exception 'Attachment exceeds maximum size of 10 MB';
    end if;

    insert into public.worker_document_submission_attachments (
      id,
      submission_id,
      file_path,
      original_file_name,
      mime_type,
      file_size_bytes,
      sort_order
    )
    values (
      v_attachment_id,
      p_submission_id,
      v_path,
      v_original_name,
      v_mime,
      v_size,
      v_sort_order
    );
  end loop;

  return v_row;
end;
$$;

revoke all on function public.drevora_create_worker_document_submission(
  uuid, uuid, text, text, text, text, jsonb
) from public;
revoke all on function public.drevora_create_worker_document_submission(
  uuid, uuid, text, text, text, text, jsonb
) from anon;
grant execute on function public.drevora_create_worker_document_submission(
  uuid, uuid, text, text, text, text, jsonb
) to authenticated;

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

  update public.worker_document_submissions s
  set
    review_status = p_review_status,
    rejection_reason = v_reason,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where s.id = p_submission_id
    and s.company_id = p_company_id
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
-- 4) Storage helpers + policy updates (document-files bucket)
-- -----------------------------------------------------------------------------
-- Extend document-files resolution with worker-submissions/... while preserving
-- every other bucket branch from 20260716120000_secure_storage_tenant_policies
-- (latest pre-task repository definition; no later migration replaces this helper).
create or replace function public.drevora_storage_object_company_id(
  p_bucket_id text,
  p_name text
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_seg1 text := split_part(coalesce(p_name, ''), '/', 1);
  v_seg2 text := split_part(coalesce(p_name, ''), '/', 2);
  v_seg3 text := split_part(coalesce(p_name, ''), '/', 3);
  v_seg4 text := split_part(coalesce(p_name, ''), '/', 4);
  v_company_id uuid;
  v_worker_id uuid;
  v_vehicle_id uuid;
  v_check_id uuid;
  v_record_id uuid;
begin
  if p_bucket_id is null or coalesce(trim(p_name), '') = '' then
    return null;
  end if;

  -- worker-avatars: resolve via path layout + drivers row (never trust slug alone).
  if p_bucket_id = 'worker-avatars' then
    -- Canonical: <company_uuid>/worker-avatars/<worker_uuid>/<filename>
    if v_seg2 = 'worker-avatars' then
      v_company_id := public.drevora_storage_try_parse_uuid(v_seg1);
      v_worker_id := public.drevora_storage_try_parse_uuid(v_seg3);
      if v_company_id is null or v_worker_id is null then
        return null;
      end if;
      select d.company_id into v_company_id
      from public.drivers d
      where d.id = v_worker_id
        and d.company_id = v_company_id
        and d.company_id is not null;
      return v_company_id;
    end if;

    -- Legacy: <companySlug>/<worker_uuid>/<filename> — company from Worker row only.
    v_worker_id := public.drevora_storage_try_parse_uuid(v_seg2);
    if v_worker_id is null then
      return null;
    end if;
    select d.company_id into v_company_id
    from public.drivers d
    where d.id = v_worker_id
      and d.company_id is not null;
    return v_company_id;
  end if;

  -- Do not trust a bare first-segment UUID without a known layout + relational bind.
  -- Current non-avatar buckets use resource-prefix layouts (vehicles/, consumables/, …).

  if p_bucket_id = 'vehicle-check-photos' then
    -- vehicles/{vehicleId}/checks/{checkId}/...
    if v_seg1 is distinct from 'vehicles' or v_seg3 is distinct from 'checks' then
      return null;
    end if;
    v_vehicle_id := public.drevora_storage_try_parse_uuid(v_seg2);
    v_check_id := public.drevora_storage_try_parse_uuid(v_seg4);
    if v_vehicle_id is null or v_check_id is null then
      return null;
    end if;
    select vc.company_id into v_company_id
    from public.vehicle_checks vc
    where vc.id = v_check_id
      and vc.vehicle_id = v_vehicle_id
      and vc.company_id is not null;
    return v_company_id;
  end if;

  if p_bucket_id = 'consumable-receipts' then
    -- consumables/{companyId}/{consumableId}/...
    if v_seg1 is distinct from 'consumables' then
      return null;
    end if;
    v_company_id := public.drevora_storage_try_parse_uuid(v_seg2);
    v_record_id := public.drevora_storage_try_parse_uuid(v_seg3);
    if v_company_id is null or v_record_id is null then
      return null;
    end if;
    if exists (
      select 1
      from public.consumables c
      where c.id = v_record_id
        and c.company_id = v_company_id
    ) then
      return v_company_id;
    end if;
    return null;
  end if;

  if p_bucket_id = 'document-files' then
    -- NEW: worker-submissions/{companyId}/{workerId}/{submissionId}/...
    if v_seg1 = 'worker-submissions' then
      v_company_id := public.drevora_storage_try_parse_uuid(v_seg2);
      v_worker_id := public.drevora_storage_try_parse_uuid(v_seg3);
      v_record_id := public.drevora_storage_try_parse_uuid(v_seg4);
      if v_company_id is null or v_worker_id is null or v_record_id is null then
        return null;
      end if;
      if exists (
        select 1
        from public.drivers d
        where d.id = v_worker_id
          and d.company_id = v_company_id
      ) then
        return v_company_id;
      end if;
      return null;
    end if;

    -- documents/{companyId}/{documentId}/...
    if v_seg1 is distinct from 'documents' then
      return null;
    end if;
    v_company_id := public.drevora_storage_try_parse_uuid(v_seg2);
    v_record_id := public.drevora_storage_try_parse_uuid(v_seg3);
    if v_company_id is null or v_record_id is null then
      return null;
    end if;
    if exists (
      select 1
      from public.documents d
      where d.id = v_record_id
        and d.company_id = v_company_id
    ) then
      return v_company_id;
    end if;
    return null;
  end if;

  if p_bucket_id = 'driver-report-files' then
    -- driver-reports/{companyId}/{reportId}/...
    if v_seg1 is distinct from 'driver-reports' then
      return null;
    end if;
    v_company_id := public.drevora_storage_try_parse_uuid(v_seg2);
    v_record_id := public.drevora_storage_try_parse_uuid(v_seg3);
    if v_company_id is null or v_record_id is null then
      return null;
    end if;
    if exists (
      select 1
      from public.driver_reports r
      where r.id = v_record_id
        and r.company_id = v_company_id
    ) then
      return v_company_id;
    end if;
    return null;
  end if;

  return null;
end;
$$;

create or replace function public.drevora_storage_can_select_worker_submission_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    split_part(coalesce(p_name, ''), '/', 1) = 'worker-submissions'
    and exists (
      select 1
      from public.worker_document_submission_attachments a
      join public.worker_document_submissions s on s.id = a.submission_id
      where a.file_path = p_name
        and s.company_id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 2))
        and (
          public.drevora_auth_user_has_office_role_for_company(s.company_id)
          or (
            public.drevora_auth_user_belongs_to_company_id(s.company_id)
            and s.worker_id = public.drevora_auth_user_driver_id()
          )
        )
    );
$$;

create or replace function public.drevora_storage_can_write_worker_submission_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Staging upload/overwrite only: own Worker path, not yet linked as an attachment.
  select
    split_part(coalesce(p_name, ''), '/', 1) = 'worker-submissions'
    and public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 2)) is not null
    and public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 3)) is not null
    and public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 4)) is not null
    and nullif(trim(split_part(p_name, '/', 5)), '') is not null
    and public.drevora_auth_user_belongs_to_company_id(
      public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 2))
    )
    and public.drevora_auth_user_driver_id()
      = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 3))
    and public.drevora_driver_in_company(
      public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 3)),
      public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 2))
    )
    and not exists (
      select 1
      from public.worker_document_submission_attachments a
      where a.file_path = p_name
    );
$$;

create or replace function public.drevora_storage_can_delete_worker_submission_staging_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Compensation cleanup only: own staging path and not yet linked as an attachment.
  select public.drevora_storage_can_write_worker_submission_file(p_name);
$$;

create or replace function public.drevora_storage_can_select_document_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.drevora_storage_can_select_worker_submission_file(p_name)
    or exists (
      select 1
      from public.documents d
      where split_part(coalesce(p_name, ''), '/', 1) = 'documents'
        and d.id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 3))
        and d.company_id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 2))
        and d.company_id is not null
        and (
          public.drevora_auth_user_has_office_role_for_company(d.company_id)
          or (
            public.drevora_auth_user_belongs_to_company_id(d.company_id)
            and d.worker_id = public.drevora_auth_user_driver_id()
          )
        )
    );
$$;

create or replace function public.drevora_storage_can_write_document_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Office manage for documents/... OR Worker staging write for worker-submissions/...
  select
    public.drevora_storage_can_write_worker_submission_file(p_name)
    or exists (
      select 1
      from public.documents d
      where split_part(coalesce(p_name, ''), '/', 1) = 'documents'
        and d.id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 3))
        and d.company_id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 2))
        and d.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(d.company_id)
    );
$$;

revoke all on function public.drevora_storage_can_select_worker_submission_file(text) from public;
revoke all on function public.drevora_storage_can_select_worker_submission_file(text) from anon;
revoke all on function public.drevora_storage_can_write_worker_submission_file(text) from public;
revoke all on function public.drevora_storage_can_write_worker_submission_file(text) from anon;
revoke all on function public.drevora_storage_can_delete_worker_submission_staging_file(text) from public;
revoke all on function public.drevora_storage_can_delete_worker_submission_staging_file(text) from anon;
revoke all on function public.drevora_storage_can_select_document_file(text) from public;
revoke all on function public.drevora_storage_can_select_document_file(text) from anon;
revoke all on function public.drevora_storage_can_write_document_file(text) from public;
revoke all on function public.drevora_storage_can_write_document_file(text) from anon;
revoke all on function public.drevora_storage_object_company_id(text, text) from public;
revoke all on function public.drevora_storage_object_company_id(text, text) from anon;

grant execute on function public.drevora_storage_can_select_worker_submission_file(text) to authenticated;
grant execute on function public.drevora_storage_can_write_worker_submission_file(text) to authenticated;
grant execute on function public.drevora_storage_can_delete_worker_submission_staging_file(text) to authenticated;
grant execute on function public.drevora_storage_can_select_document_file(text) to authenticated;
grant execute on function public.drevora_storage_can_write_document_file(text) to authenticated;
grant execute on function public.drevora_storage_object_company_id(text, text) to authenticated;

-- Recreate all document-files object policies so SELECT/INSERT/UPDATE/DELETE
-- use the corrected helpers (staging write; linked-file write/delete denied).
drop policy if exists drevora_storage_document_files_select on storage.objects;
create policy drevora_storage_document_files_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'document-files'
    and public.drevora_storage_can_select_document_file(name)
  );

drop policy if exists drevora_storage_document_files_insert on storage.objects;
create policy drevora_storage_document_files_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'document-files'
    and public.drevora_storage_can_write_document_file(name)
  );

drop policy if exists drevora_storage_document_files_update on storage.objects;
create policy drevora_storage_document_files_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'document-files'
    and public.drevora_storage_can_write_document_file(name)
  )
  with check (
    bucket_id = 'document-files'
    and public.drevora_storage_can_write_document_file(name)
  );

drop policy if exists drevora_storage_document_files_delete on storage.objects;
create policy drevora_storage_document_files_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'document-files'
    and (
      (
        split_part(name, '/', 1) = 'documents'
        and public.drevora_storage_can_write_document_file(name)
      )
      or public.drevora_storage_can_delete_worker_submission_staging_file(name)
    )
  );

commit;

-- =============================================================================
-- Diagnostics (commented — run after apply; not part of the mutating transaction)
-- =============================================================================
--
-- -- Table grants
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name in (
--     'worker_document_submissions',
--     'worker_document_submission_attachments'
--   )
-- order by table_name, grantee, privilege_type;
--
-- -- RLS status
-- select c.relname, c.relrowsecurity, c.relforcerrowsecurity
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relname in (
--     'worker_document_submissions',
--     'worker_document_submission_attachments'
--   );
--
-- -- Policies
-- select schemaname, tablename, policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where tablename like 'worker_document_submission%'
-- order by tablename, policyname;
--
-- -- RPC SECURITY DEFINER + EXECUTE grants
-- select
--   p.proname,
--   p.prosecdef as security_definer,
--   pg_get_function_identity_arguments(p.oid) as args,
--   array(
--     select r.rolname
--     from aclexplode(coalesce(p.proacl, acldefault('function', p.proowner))) a
--     join pg_roles r on r.oid = a.grantee
--     where a.privilege_type = 'EXECUTE'
--   ) as execute_grantees
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'drevora_create_worker_document_submission',
--     'drevora_review_worker_document_submission'
--   );
--
-- -- Empty / invalid attachment sets (should be zero rows)
-- select s.id, count(a.id) as attachment_count
-- from public.worker_document_submissions s
-- left join public.worker_document_submission_attachments a on a.submission_id = s.id
-- group by s.id
-- having count(a.id) = 0
--     or count(a.id) > 5
--     or (
--       count(*) filter (where a.mime_type = 'application/pdf') > 0
--       and count(*) filter (where a.mime_type in ('image/jpeg','image/png','image/webp')) > 0
--     );
--
-- -- Storage policy inventory (document-files)
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'storage'
--   and tablename = 'objects'
--   and policyname like 'drevora_storage_document_files_%'
-- order by policyname;
--
-- -- document-files bucket must remain private
-- select id, name, public, file_size_limit, allowed_mime_types
-- from storage.buckets
-- where id = 'document-files';
--
-- -- Cross-company access assumptions (manual with two tenants):
-- -- 1) Worker A create RPC with company B id -> fail
-- -- 2) Office A select submission of company B -> zero rows
-- -- 3) Worker A signed URL for Worker B linked path -> fail
-- -- 4) Direct insert/update/delete on submission tables as authenticated -> fail

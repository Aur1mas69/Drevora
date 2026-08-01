-- DREVORA Worker Help & Support — support_requests + private support-attachments bucket.
-- Idempotent; safe to re-run. Do not auto-apply from the app.

-- -----------------------------------------------------------------------------
-- 1) Table
-- -----------------------------------------------------------------------------

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  request_type text not null,
  category text not null,
  title text not null,
  description text not null,
  steps_to_reproduce text null,
  rating smallint null,
  status text not null default 'submitted',
  support_response text null,
  responded_at timestamptz null,
  resolved_at timestamptz null,
  reference text not null,
  app_version text not null,
  platform text not null,
  route text null,
  network_state text not null default 'online',
  device_metadata jsonb not null default '{}'::jsonb,
  attachment_paths text[] not null default '{}'::text[],
  constraint support_requests_type_check check (
    request_type in ('bug', 'feedback')
  ),
  constraint support_requests_status_check check (
    status in ('submitted', 'in_progress', 'resolved', 'closed')
  ),
  constraint support_requests_rating_check check (
    rating is null or (rating >= 1 and rating <= 5)
  ),
  constraint support_requests_title_len_check check (
    char_length(trim(title)) >= 1 and char_length(title) <= 200
  ),
  constraint support_requests_description_len_check check (
    char_length(trim(description)) >= 1 and char_length(description) <= 4000
  ),
  constraint support_requests_steps_len_check check (
    steps_to_reproduce is null or char_length(steps_to_reproduce) <= 4000
  ),
  constraint support_requests_reference_unique unique (reference),
  constraint support_requests_network_state_check check (
    network_state in ('online', 'offline')
  ),
  constraint support_requests_platform_check check (
    platform in ('android', 'web', 'pwa')
  ),
  constraint support_requests_bug_rating_null_check check (
    request_type <> 'bug' or rating is null
  ),
  constraint support_requests_attachments_len_check check (
    cardinality(attachment_paths) <= 3
  )
);

create index if not exists support_requests_driver_created_idx
  on public.support_requests (driver_id, created_at desc);

create index if not exists support_requests_company_status_idx
  on public.support_requests (company_id, status);

create index if not exists support_requests_company_created_idx
  on public.support_requests (company_id, created_at desc);

drop trigger if exists support_requests_set_updated_at on public.support_requests;
create trigger support_requests_set_updated_at
  before update on public.support_requests
  for each row
  execute function public.drevora_set_updated_at();

-- -----------------------------------------------------------------------------
-- 2) RLS
-- -----------------------------------------------------------------------------

alter table public.support_requests enable row level security;

revoke all on table public.support_requests from anon;
revoke all on table public.support_requests from authenticated;

grant select, insert on table public.support_requests to authenticated;

drop policy if exists support_requests_worker_select_own on public.support_requests;
create policy support_requests_worker_select_own
  on public.support_requests
  for select
  to authenticated
  using (
    driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_auth_user_belongs_to_company_id(company_id)
  );

drop policy if exists support_requests_worker_insert_own on public.support_requests;
create policy support_requests_worker_insert_own
  on public.support_requests
  for insert
  to authenticated
  with check (
    driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and status = 'submitted'
    and support_response is null
    and responded_at is null
    and resolved_at is null
  );

-- Workers cannot update or delete support requests (no policies for update/delete).

-- -----------------------------------------------------------------------------
-- 3) Private storage bucket
-- Path: {companyId}/{driverId}/{requestId}/{uuid}.{ext}
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.drevora_storage_can_access_support_attachment(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_driver_id uuid;
  v_request_id uuid;
  v_auth_driver uuid;
begin
  v_company_id := public.drevora_storage_try_parse_uuid(split_part(coalesce(p_name, ''), '/', 1));
  v_driver_id := public.drevora_storage_try_parse_uuid(split_part(coalesce(p_name, ''), '/', 2));
  v_request_id := public.drevora_storage_try_parse_uuid(split_part(coalesce(p_name, ''), '/', 3));
  v_auth_driver := public.drevora_auth_user_driver_id();

  if v_company_id is null or v_driver_id is null or v_request_id is null then
    return false;
  end if;

  if v_auth_driver is null or v_auth_driver <> v_driver_id then
    return false;
  end if;

  if not public.drevora_auth_user_belongs_to_company_id(v_company_id) then
    return false;
  end if;

  return exists (
    select 1
    from public.support_requests sr
    where sr.id = v_request_id
      and sr.driver_id = v_driver_id
      and sr.company_id = v_company_id
  );
end;
$$;

revoke all on function public.drevora_storage_can_access_support_attachment(text) from public;
grant execute on function public.drevora_storage_can_access_support_attachment(text) to authenticated;

-- Upload before the row exists: allow write when path driver/company match auth identity.
create or replace function public.drevora_storage_can_write_support_attachment(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_driver_id uuid;
  v_request_id uuid;
  v_auth_driver uuid;
begin
  v_company_id := public.drevora_storage_try_parse_uuid(split_part(coalesce(p_name, ''), '/', 1));
  v_driver_id := public.drevora_storage_try_parse_uuid(split_part(coalesce(p_name, ''), '/', 2));
  v_request_id := public.drevora_storage_try_parse_uuid(split_part(coalesce(p_name, ''), '/', 3));
  v_auth_driver := public.drevora_auth_user_driver_id();

  if v_company_id is null or v_driver_id is null or v_request_id is null then
    return false;
  end if;

  if v_auth_driver is null or v_auth_driver <> v_driver_id then
    return false;
  end if;

  return public.drevora_auth_user_belongs_to_company_id(v_company_id);
end;
$$;

revoke all on function public.drevora_storage_can_write_support_attachment(text) from public;
grant execute on function public.drevora_storage_can_write_support_attachment(text) to authenticated;

drop policy if exists support_attachments_select_own on storage.objects;
create policy support_attachments_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'support-attachments'
    and public.drevora_storage_can_access_support_attachment(name)
  );

drop policy if exists support_attachments_insert_own on storage.objects;
create policy support_attachments_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'support-attachments'
    and public.drevora_storage_can_write_support_attachment(name)
  );

drop policy if exists support_attachments_delete_own on storage.objects;
create policy support_attachments_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'support-attachments'
    and public.drevora_storage_can_write_support_attachment(name)
  );

notify pgrst, 'reload schema';

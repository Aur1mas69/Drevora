-- Unified documents module (company, worker, vehicle)

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company text,
  document_name text not null,
  document_type text not null,
  applies_to text not null,
  worker_id uuid references public.drivers (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete cascade,
  reference_number text,
  issue_date date,
  expiry_date date,
  file_url text,
  file_path text,
  notes text,
  status text not null default 'valid',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint documents_applies_to_check check (
    applies_to in ('company', 'worker', 'vehicle')
  ),
  constraint documents_status_check check (
    status in ('valid', 'expiring_soon', 'expired', 'no_expiry')
  ),
  constraint documents_worker_scope_check check (
    applies_to <> 'worker' or worker_id is not null
  ),
  constraint documents_vehicle_scope_check check (
    applies_to <> 'vehicle' or vehicle_id is not null
  )
);

create index if not exists documents_company_idx on public.documents (company);
create index if not exists documents_applies_to_idx on public.documents (applies_to);
create index if not exists documents_worker_id_idx on public.documents (worker_id);
create index if not exists documents_vehicle_id_idx on public.documents (vehicle_id);
create index if not exists documents_document_type_idx on public.documents (document_type);
create index if not exists documents_expiry_date_idx on public.documents (expiry_date);
create index if not exists documents_status_idx on public.documents (status);

drop trigger if exists documents_set_updated_at on public.documents;

create trigger documents_set_updated_at
  before update on public.documents
  for each row
  execute function public.drevora_set_updated_at();

alter table public.documents disable row level security;

grant select, insert, update, delete on public.documents to anon, authenticated;

-- Ensure worker compliance reference_number exists (older projects)
alter table public.worker_compliance_records
  add column if not exists reference_number text;

-- Storage bucket for document attachments
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document-files',
  'document-files',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Backfill worker compliance records (preserve ids)
insert into public.documents (
  id,
  company,
  document_name,
  document_type,
  applies_to,
  worker_id,
  reference_number,
  issue_date,
  expiry_date,
  file_url,
  notes,
  status,
  created_at,
  updated_at
)
select
  wcr.id,
  d.company,
  coalesce(nullif(trim(wcr.document_name), ''), wcr.document_type),
  wcr.document_type,
  'worker',
  wcr.worker_id,
  wcr.reference_number,
  wcr.issue_date,
  wcr.expiry_date,
  wcr.file_url,
  wcr.notes,
  case
    when wcr.expiry_date is null then 'no_expiry'
    when wcr.expiry_date < current_date then 'expired'
    when wcr.expiry_date <= current_date + interval '30 days' then 'expiring_soon'
    else 'valid'
  end,
  wcr.created_at,
  wcr.updated_at
from public.worker_compliance_records wcr
left join public.drivers d on d.id = wcr.worker_id
on conflict (id) do nothing;

-- Backfill vehicle compliance records (preserve ids)
insert into public.documents (
  id,
  company,
  document_name,
  document_type,
  applies_to,
  vehicle_id,
  reference_number,
  issue_date,
  expiry_date,
  file_url,
  notes,
  status,
  created_at,
  updated_at
)
select
  vcr.id,
  null,
  coalesce(nullif(trim(vcr.document_name), ''), vcr.document_type),
  vcr.document_type,
  'vehicle',
  vcr.vehicle_id,
  vcr.reference_number,
  vcr.issue_date,
  vcr.expiry_date,
  vcr.file_url,
  vcr.notes,
  case
    when vcr.expiry_date is null then 'no_expiry'
    when vcr.expiry_date < current_date then 'expired'
    when vcr.expiry_date <= current_date + interval '30 days' then 'expiring_soon'
    else 'valid'
  end,
  vcr.created_at,
  vcr.updated_at
from public.vehicle_compliance_records vcr
on conflict (id) do nothing;

-- Assign company name to migrated rows missing company scope
update public.documents
set company = (
  select name from public.companies order by created_at asc limit 1
)
where company is null
  and exists (select 1 from public.companies where name is not null);

-- Vehicle compliance documents (extends legacy vehicle expiry fields)

create table if not exists public.vehicle_compliance_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  document_type text not null,
  document_name text,
  issue_date date,
  expiry_date date,
  status text not null default 'Valid',
  reference_number text,
  notes text,
  file_url text,
  constraint vehicle_compliance_records_status_check check (
    status in ('Valid', 'Expiring Soon', 'Expired', 'Not Added')
  )
);

create index if not exists vehicle_compliance_records_vehicle_id_idx
  on public.vehicle_compliance_records (vehicle_id);

create index if not exists vehicle_compliance_records_document_type_idx
  on public.vehicle_compliance_records (document_type);

create index if not exists vehicle_compliance_records_expiry_date_idx
  on public.vehicle_compliance_records (expiry_date);

create index if not exists vehicle_compliance_records_status_idx
  on public.vehicle_compliance_records (status);

alter table public.vehicle_compliance_records disable row level security;

grant select, insert, update, delete on public.vehicle_compliance_records to anon, authenticated;

-- Reference number on worker compliance records
alter table public.worker_compliance_records
  add column if not exists reference_number text;

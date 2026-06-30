create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  company text,
  assigned_vehicle text,
  status text default 'Off Duty',
  driving_licence_expiry date,
  cpc_expiry date,
  avatar_url text
);

create index if not exists drivers_status_idx on public.drivers (status);
create index if not exists drivers_company_idx on public.drivers (company);
create index if not exists drivers_email_idx on public.drivers (email);

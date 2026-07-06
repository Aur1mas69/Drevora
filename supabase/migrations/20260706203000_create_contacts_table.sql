-- Business contacts directory (customers, suppliers, garages, etc.)

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  company text,
  name text,
  organisation text,
  category text not null default 'other',
  phone text,
  email text,
  website text,
  role_title text,
  vat_number text,
  account_reference text,
  address_line_1 text,
  address_line_2 text,
  town_city text,
  county text,
  postcode text,
  country text default 'United Kingdom',
  notes text,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint contacts_category_check check (
    category in (
      'customer',
      'supplier',
      'garage_workshop',
      'site_plant',
      'insurance',
      'accountant',
      'emergency',
      'other'
    )
  ),
  constraint contacts_status_check check (status in ('active', 'inactive'))
);

create index if not exists contacts_company_idx on public.contacts (company);
create index if not exists contacts_category_idx on public.contacts (category);
create index if not exists contacts_status_idx on public.contacts (status);
create index if not exists contacts_name_idx on public.contacts (name);
create index if not exists contacts_organisation_idx on public.contacts (organisation);

drop trigger if exists contacts_set_updated_at on public.contacts;

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row
  execute function public.drevora_set_updated_at();

alter table public.contacts disable row level security;

grant select, insert, update, delete on public.contacts to anon, authenticated;

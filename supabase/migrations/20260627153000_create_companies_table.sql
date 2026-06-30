create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text,
  address text,
  city text,
  postcode text,
  country text,
  timezone text default 'Europe/London',
  weather_location text
);

create index if not exists companies_created_at_idx on public.companies (created_at);

alter table public.companies disable row level security;

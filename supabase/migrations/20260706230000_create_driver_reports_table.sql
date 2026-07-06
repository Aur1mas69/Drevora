-- Worker/driver operational reports for office review

create table if not exists public.driver_reports (
  id uuid primary key default gen_random_uuid(),
  company text,
  worker_id uuid references public.drivers (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  title text not null,
  report_type text not null default 'Other',
  priority text not null default 'Medium',
  status text not null default 'New',
  description text,
  location text,
  issue_datetime timestamptz,
  office_notes text,
  attachment_url text,
  attachment_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_reports_report_type_check check (
    report_type in (
      'Vehicle issue',
      'Damage',
      'Load / cargo issue',
      'Site / customer issue',
      'Health & safety',
      'Delay / operational issue',
      'Other'
    )
  ),
  constraint driver_reports_priority_check check (
    priority in ('Low', 'Medium', 'High', 'Critical')
  ),
  constraint driver_reports_status_check check (
    status in ('New', 'In Progress', 'Closed')
  )
);

create index if not exists driver_reports_company_idx on public.driver_reports (company);
create index if not exists driver_reports_worker_id_idx on public.driver_reports (worker_id);
create index if not exists driver_reports_vehicle_id_idx on public.driver_reports (vehicle_id);
create index if not exists driver_reports_status_idx on public.driver_reports (status);
create index if not exists driver_reports_priority_idx on public.driver_reports (priority);
create index if not exists driver_reports_report_type_idx on public.driver_reports (report_type);
create index if not exists driver_reports_created_at_idx on public.driver_reports (created_at desc);

drop trigger if exists driver_reports_set_updated_at on public.driver_reports;

create trigger driver_reports_set_updated_at
  before update on public.driver_reports
  for each row
  execute function public.drevora_set_updated_at();

alter table public.driver_reports disable row level security;

grant select, insert, update, delete on public.driver_reports to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver-report-files',
  'driver-report-files',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

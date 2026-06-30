-- Holiday leave requests for workers

create table if not exists public.holiday_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  worker_id uuid not null references public.drivers (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  total_days numeric not null default 0,
  reason text,
  status text not null default 'Pending',
  manager_note text,
  constraint holiday_requests_end_after_start check (end_date >= start_date),
  constraint holiday_requests_status_check check (
    status in ('Pending', 'Approved', 'Rejected', 'Cancelled')
  )
);

create index if not exists holiday_requests_worker_id_idx
  on public.holiday_requests (worker_id);

create index if not exists holiday_requests_status_idx
  on public.holiday_requests (status);

create index if not exists holiday_requests_start_date_idx
  on public.holiday_requests (start_date);

create index if not exists holiday_requests_end_date_idx
  on public.holiday_requests (end_date);

create index if not exists holiday_requests_dates_idx
  on public.holiday_requests (start_date, end_date);

alter table public.holiday_requests disable row level security;

grant select, insert, update, delete on public.holiday_requests to anon, authenticated;

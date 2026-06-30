-- Timesheets and daily entries for driver hours tracking

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  week_start date not null,
  status text not null default 'Draft',
  notes text
);

create table if not exists public.timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid not null references public.timesheets (id) on delete cascade,
  day_date date not null,
  start_time time,
  break_minutes integer not null default 0,
  finish_time time,
  total_minutes integer not null default 0
);

create index if not exists timesheets_driver_id_idx on public.timesheets (driver_id);
create index if not exists timesheets_vehicle_id_idx on public.timesheets (vehicle_id);
create index if not exists timesheets_week_start_idx on public.timesheets (week_start);
create index if not exists timesheets_status_idx on public.timesheets (status);
create unique index if not exists timesheets_driver_week_unique_idx
  on public.timesheets (driver_id, week_start);

create index if not exists timesheet_entries_timesheet_id_idx
  on public.timesheet_entries (timesheet_id);
create index if not exists timesheet_entries_day_date_idx
  on public.timesheet_entries (day_date);
create unique index if not exists timesheet_entries_timesheet_day_unique_idx
  on public.timesheet_entries (timesheet_id, day_date);

alter table public.timesheets disable row level security;
alter table public.timesheet_entries disable row level security;

grant select, insert, update, delete on public.timesheets to anon, authenticated;
grant select, insert, update, delete on public.timesheet_entries to anon, authenticated;

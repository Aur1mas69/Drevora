alter table public.timesheets
add column if not exists deleted_at timestamptz null,
add column if not exists deleted_by uuid null,
add column if not exists delete_reason text null;

alter table public.timesheet_entries
add column if not exists deleted_at timestamptz null,
add column if not exists deleted_by uuid null,
add column if not exists delete_reason text null;

drop index if exists timesheets_driver_week_unique_idx;

create unique index if not exists timesheets_driver_week_unique_idx
on public.timesheets (driver_id, week_start)
where deleted_at is null;

create index if not exists idx_timesheets_not_deleted
on public.timesheets(week_start, deleted_at);

create index if not exists idx_timesheet_entries_not_deleted
on public.timesheet_entries(timesheet_id, deleted_at);

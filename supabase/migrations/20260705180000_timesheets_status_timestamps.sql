alter table public.timesheets
add column if not exists submitted_at timestamptz null,
add column if not exists approved_at timestamptz null,
add column if not exists rejected_at timestamptz null;

create index if not exists idx_timesheets_submitted_at
on public.timesheets(submitted_at);

create index if not exists idx_timesheets_status_submitted_at
on public.timesheets(status, submitted_at);

notify pgrst, 'reload schema';

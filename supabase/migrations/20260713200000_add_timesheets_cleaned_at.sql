-- Soft-clean marker for Timesheets Current week view.
-- Idempotent: safe if cleaned_at already exists.
-- Does not touch timesheet_entries.

alter table public.timesheets
  add column if not exists cleaned_at timestamptz null;

create index if not exists idx_timesheets_cleaned_at
  on public.timesheets (cleaned_at);

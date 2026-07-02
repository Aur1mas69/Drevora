alter table public.timesheet_entries
add column if not exists daily_comment text;

notify pgrst, 'reload schema';

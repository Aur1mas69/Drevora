alter table public.timesheet_entries
add column if not exists additional_hours numeric not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'timesheet_entries_additional_hours_check'
  ) then
    alter table public.timesheet_entries
    add constraint timesheet_entries_additional_hours_check
    check (additional_hours >= 0);
  end if;
end $$;

create unique index if not exists timesheet_entries_timesheet_day_unique_idx
  on public.timesheet_entries (timesheet_id, day_date);

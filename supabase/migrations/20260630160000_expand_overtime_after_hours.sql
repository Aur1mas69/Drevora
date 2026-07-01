-- Expand overtime_after_hours range from 8–10 to 5–15 hours.

alter table public.companies
  add column if not exists overtime_after_hours integer not null default 8;

update public.companies
set overtime_after_hours = 8
where overtime_after_hours is null;

alter table public.companies drop constraint if exists companies_overtime_after_check;
alter table public.companies drop constraint if exists companies_overtime_after_hours_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_overtime_after_hours_check'
  ) then
    alter table public.companies
      add constraint companies_overtime_after_hours_check
      check (overtime_after_hours >= 5 and overtime_after_hours <= 15);
  end if;
end $$;

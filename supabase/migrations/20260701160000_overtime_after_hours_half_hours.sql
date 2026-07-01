alter table public.companies
drop constraint if exists companies_overtime_after_hours_check;

alter table public.companies
drop constraint if exists companies_overtime_after_check;

alter table public.companies
alter column overtime_after_hours type numeric
using overtime_after_hours::numeric;

alter table public.companies
alter column overtime_after_hours set default 10.5;

update public.companies
set overtime_after_hours = 10.5
where overtime_after_hours is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_overtime_after_hours_check'
  ) then
    alter table public.companies
    add constraint companies_overtime_after_hours_check
    check (
      overtime_after_hours >= 5.5
      and overtime_after_hours <= 15.5
      and (overtime_after_hours * 2) = floor(overtime_after_hours * 2)
    );
  end if;
end $$;

notify pgrst, 'reload schema';

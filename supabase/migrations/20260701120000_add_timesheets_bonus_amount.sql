alter table public.timesheets
add column if not exists bonus_amount numeric not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'timesheets_bonus_amount_check'
  ) then
    alter table public.timesheets
    add constraint timesheets_bonus_amount_check
    check (bonus_amount >= 0);
  end if;
end $$;

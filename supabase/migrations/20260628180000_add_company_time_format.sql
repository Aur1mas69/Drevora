alter table public.companies
  add column if not exists time_format text not null default '24h';

alter table public.companies
  drop constraint if exists companies_time_format_check;

alter table public.companies
  add constraint companies_time_format_check
  check (time_format in ('24h', '12h'));

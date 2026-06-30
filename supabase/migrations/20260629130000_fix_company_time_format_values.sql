-- Normalize companies.time_format to match DB constraint: 24-hour | 12-hour

update public.companies
set time_format = '12-hour'
where lower(trim(time_format)) in ('12-hour', '12h', '12 hour', '12');

update public.companies
set time_format = '24-hour'
where time_format is null
   or lower(trim(time_format)) in ('24-hour', '24h', '24 hour', '24');

alter table public.companies alter column time_format set default '24-hour';

alter table public.companies drop constraint if exists companies_time_format_check;
alter table public.companies
  add constraint companies_time_format_check
  check (time_format in ('24-hour', '12-hour'));

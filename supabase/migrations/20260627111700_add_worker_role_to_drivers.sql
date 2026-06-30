alter table public.drivers
add column if not exists role text default 'Driver';

update public.drivers
set role = 'Driver'
where role is null;

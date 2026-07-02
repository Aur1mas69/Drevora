alter table public.companies
add column if not exists paid_breaks boolean not null default false;

notify pgrst, 'reload schema';

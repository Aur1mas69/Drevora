-- Per-day control for whether company default break is auto-applied on Saturday/Sunday.
-- Default true preserves existing behaviour for all companies.

alter table public.companies
add column if not exists saturday_use_company_default_break boolean not null default true;

alter table public.companies
add column if not exists sunday_use_company_default_break boolean not null default true;

notify pgrst, 'reload schema';

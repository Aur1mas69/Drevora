-- Theme setting: light, dark, or system (follow device preference).
-- Uses existing companies.theme column; migrates legacy "auto" to "system".

update public.companies
set theme = 'system'
where theme = 'auto';

alter table public.companies
  add column if not exists theme text not null default 'light';

update public.companies
set theme = 'light'
where theme is null or trim(theme) = '';

alter table public.companies drop constraint if exists companies_theme_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_theme_check'
  ) then
    alter table public.companies
      add constraint companies_theme_check
      check (theme in ('light', 'dark', 'system'));
  end if;
end $$;

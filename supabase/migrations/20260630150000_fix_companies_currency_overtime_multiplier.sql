-- Fix Settings: ensure companies.currency and companies.overtime_multiplier exist.
-- Safe to re-run (IF NOT EXISTS + conditional constraints).

alter table public.companies
  add column if not exists currency text not null default 'GBP';

alter table public.companies
  add column if not exists overtime_multiplier numeric not null default 1.5;

update public.companies
set currency = 'GBP'
where currency is null or trim(currency) = '';

-- Map legacy multiplier values to the supported 1.1–2.5 range when present.
update public.companies
set overtime_multiplier = 1.1
where overtime_multiplier = 1;

update public.companies
set overtime_multiplier = 1.2
where overtime_multiplier = 1.25;

update public.companies
set overtime_multiplier = 1.8
where overtime_multiplier = 1.75;

alter table public.companies drop constraint if exists companies_currency_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_currency_check'
  ) then
    alter table public.companies
      add constraint companies_currency_check
      check (currency in ('GBP', 'EUR', 'USD', 'RUB'));
  end if;
end $$;

alter table public.companies drop constraint if exists companies_overtime_multiplier_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_overtime_multiplier_check'
  ) then
    alter table public.companies
      add constraint companies_overtime_multiplier_check
      check (overtime_multiplier >= 1.1 and overtime_multiplier <= 2.5);
  end if;
end $$;

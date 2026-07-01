-- Timesheet rules: expanded overtime multiplier range + currency setting

-- Map legacy multiplier values to the new 0.1-step scale (1.1–2.5)
update public.companies
set overtime_multiplier = 1.1
where overtime_multiplier = 1;

update public.companies
set overtime_multiplier = 1.2
where overtime_multiplier = 1.25;

update public.companies
set overtime_multiplier = 1.8
where overtime_multiplier = 1.75;

alter table public.companies drop constraint if exists companies_overtime_multiplier_check;

alter table public.companies
  add constraint companies_overtime_multiplier_check
  check (
    overtime_multiplier >= 1.1
    and overtime_multiplier <= 2.5
    and mod((overtime_multiplier * 10)::numeric, 1) = 0
  );

alter table public.companies
  add column if not exists currency text not null default 'GBP';

update public.companies
set currency = 'GBP'
where currency is null or trim(currency) = '';

alter table public.companies drop constraint if exists companies_currency_check;

alter table public.companies
  add constraint companies_currency_check
  check (currency in ('GBP', 'EUR', 'USD', 'RUB'));

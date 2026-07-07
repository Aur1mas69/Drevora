alter table public.companies
  add column if not exists consumable_default_prices jsonb not null default '{}'::jsonb;

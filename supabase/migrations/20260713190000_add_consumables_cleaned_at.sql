-- Soft-clean marker for Consumables Current view.
-- Idempotent: safe if cleaned_at already exists.

alter table public.consumables
  add column if not exists cleaned_at timestamptz null;

create index if not exists idx_consumables_cleaned_at
  on public.consumables (cleaned_at);

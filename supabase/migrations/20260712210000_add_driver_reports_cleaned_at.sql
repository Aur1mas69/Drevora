-- Soft-clean marker for Driver Reports Current view.
-- Idempotent: safe if cleaned_at was already added manually in Supabase.

alter table public.driver_reports
add column if not exists cleaned_at timestamptz null;

create index if not exists idx_driver_reports_cleaned_at
on public.driver_reports (cleaned_at);

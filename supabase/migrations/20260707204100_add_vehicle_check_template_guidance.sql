-- Add compact checklist guidance/configuration fields.
-- Safe to re-run: no data is deleted and existing template labels are preserved.

alter table public.vehicle_check_templates
  add column if not exists guidance text,
  add column if not exists allow_notes boolean not null default true,
  add column if not exists allow_photo boolean not null default false,
  add column if not exists fail_on_defect boolean not null default true,
  add column if not exists is_custom boolean not null default false;

alter table public.vehicle_check_items
  add column if not exists guidance text,
  add column if not exists allow_notes boolean not null default true,
  add column if not exists allow_photo boolean not null default false,
  add column if not exists fail_on_defect boolean not null default true;

alter table public.vehicle_check_templates disable row level security;

grant select, insert, update, delete on public.vehicle_check_templates to anon, authenticated;

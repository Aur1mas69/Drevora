-- Allow reading global MVP vehicle check templates under RLS.
-- Global templates use company_id IS NULL.

alter table public.vehicle_check_templates
  add column if not exists company_id uuid references public.companies (id) on delete cascade;

create index if not exists vehicle_check_templates_company_id_idx
  on public.vehicle_check_templates (company_id);

alter table public.vehicle_check_templates enable row level security;

grant select on public.vehicle_check_templates to anon, authenticated;

drop policy if exists vehicle_check_templates_select_global on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_select_company on public.vehicle_check_templates;

create policy vehicle_check_templates_select_global
  on public.vehicle_check_templates
  for select
  to anon, authenticated
  using (is_active = true and company_id is null);

create policy vehicle_check_templates_select_company
  on public.vehicle_check_templates
  for select
  to anon, authenticated
  using (is_active = true and company_id is not null);

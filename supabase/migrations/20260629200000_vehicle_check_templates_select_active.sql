-- Allow anon/authenticated clients to read active vehicle check templates under RLS.

alter table public.vehicle_check_templates enable row level security;

drop policy if exists vehicle_check_templates_select_global on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_select_company on public.vehicle_check_templates;
drop policy if exists "Read active vehicle check templates" on public.vehicle_check_templates;

create policy "Read active vehicle check templates"
  on public.vehicle_check_templates
  for select
  to anon, authenticated
  using (is_active = true);

grant select on public.vehicle_check_templates to anon, authenticated;

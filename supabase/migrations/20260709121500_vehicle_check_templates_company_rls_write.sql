-- Company-scoped write access for vehicle check templates under RLS.
-- Matches dashboard_notes pattern via public.drevora_current_company_id().

alter table public.vehicle_check_templates
  add column if not exists company_id uuid references public.companies (id) on delete cascade;

create index if not exists vehicle_check_templates_company_id_idx
  on public.vehicle_check_templates (company_id);

alter table public.vehicle_check_templates enable row level security;
alter table public.vehicle_check_template_items enable row level security;

grant select, insert, update, delete on public.vehicle_check_templates to anon, authenticated;
grant select, insert, update, delete on public.vehicle_check_template_items to anon, authenticated;

drop policy if exists vehicle_check_templates_select_global on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_select_company on public.vehicle_check_templates;
drop policy if exists "Read active vehicle check templates" on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_company_select on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_company_insert on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_company_update on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_company_delete on public.vehicle_check_templates;

create policy vehicle_check_templates_company_select
  on public.vehicle_check_templates
  for select
  to anon, authenticated
  using (
    is_active = true
    and (
      company_id is null
      or company_id = public.drevora_current_company_id()
    )
  );

create policy vehicle_check_templates_company_insert
  on public.vehicle_check_templates
  for insert
  to anon, authenticated
  with check (
    company_id = public.drevora_current_company_id()
    and is_active = true
  );

create policy vehicle_check_templates_company_update
  on public.vehicle_check_templates
  for update
  to anon, authenticated
  using (company_id = public.drevora_current_company_id())
  with check (company_id = public.drevora_current_company_id());

create policy vehicle_check_templates_company_delete
  on public.vehicle_check_templates
  for delete
  to anon, authenticated
  using (company_id = public.drevora_current_company_id());

drop policy if exists vehicle_check_template_items_company_select on public.vehicle_check_template_items;
drop policy if exists vehicle_check_template_items_company_insert on public.vehicle_check_template_items;
drop policy if exists vehicle_check_template_items_company_update on public.vehicle_check_template_items;
drop policy if exists vehicle_check_template_items_company_delete on public.vehicle_check_template_items;

create policy vehicle_check_template_items_company_select
  on public.vehicle_check_template_items
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.is_active = true
        and (
          template.company_id is null
          or template.company_id = public.drevora_current_company_id()
        )
    )
  );

create policy vehicle_check_template_items_company_insert
  on public.vehicle_check_template_items
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.company_id = public.drevora_current_company_id()
    )
  );

create policy vehicle_check_template_items_company_update
  on public.vehicle_check_template_items
  for update
  to anon, authenticated
  using (
    exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.company_id = public.drevora_current_company_id()
    )
  )
  with check (
    exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.company_id = public.drevora_current_company_id()
    )
  );

create policy vehicle_check_template_items_company_delete
  on public.vehicle_check_template_items
  for delete
  to anon, authenticated
  using (
    exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.company_id = public.drevora_current_company_id()
    )
  );

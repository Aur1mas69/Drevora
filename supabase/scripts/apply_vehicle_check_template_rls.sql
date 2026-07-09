-- =============================================================================
-- DREVORA — Vehicle Check Template RLS (multi-company safe)
-- Paste into Supabase SQL Editor. Safe to re-run.
-- Only: vehicle_check_templates, vehicle_check_template_items
-- Uses: vehicle_check_templates.company (text) — NOT company_id
-- =============================================================================

-- Current user's company text from public.drivers (auth.users.email = drivers.email).
create or replace function public.drevora_auth_user_driver_company_text()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(trim(d.company), '')
  from public.drivers d
  inner join auth.users u on u.id = auth.uid()
  where lower(trim(coalesce(d.email, ''))) = lower(trim(coalesce(u.email, '')))
  order by d.created_at desc nulls last
  limit 1;
$$;

-- Office/admin template managers only (must have a drivers row with company + allowed role).
create or replace function public.drevora_auth_user_can_manage_vehicle_check_templates()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.drivers d
    inner join auth.users u on u.id = auth.uid()
    where lower(trim(coalesce(d.email, ''))) = lower(trim(coalesce(u.email, '')))
      and nullif(trim(d.company), '') is not null
      and d.role in (
        'Admin',
        'Transport Manager',
        'Supervisor',
        'Planner',
        'Office Staff'
      )
  );
$$;

-- True when template.company belongs to the authenticated user's company.
-- Matches drivers.company and companies.name when both align for the same tenant.
create or replace function public.drevora_vehicle_check_company_matches_auth_user(company_value text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  user_company text;
begin
  if company_value is null then
    return true;
  end if;

  user_company := public.drevora_auth_user_driver_company_text();
  if user_company is null then
    return false;
  end if;

  if lower(trim(company_value)) = lower(trim(user_company)) then
    return true;
  end if;

  return exists (
    select 1
    from public.companies c
    where lower(trim(coalesce(c.name, ''))) = lower(trim(company_value))
      and lower(trim(coalesce(c.name, ''))) = lower(trim(user_company))
  );
end;
$$;

alter table public.vehicle_check_templates enable row level security;
alter table public.vehicle_check_template_items enable row level security;

revoke all on public.vehicle_check_templates from anon;
revoke all on public.vehicle_check_template_items from anon;

grant select, insert, update, delete on public.vehicle_check_templates to authenticated;
grant select, insert, update, delete on public.vehicle_check_template_items to authenticated;

drop policy if exists vehicle_check_templates_select_global on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_select_company on public.vehicle_check_templates;
drop policy if exists "Read active vehicle check templates" on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_company_select on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_company_insert on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_company_update on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_company_delete on public.vehicle_check_templates;

drop policy if exists vehicle_check_template_items_company_select on public.vehicle_check_template_items;
drop policy if exists vehicle_check_template_items_company_insert on public.vehicle_check_template_items;
drop policy if exists vehicle_check_template_items_company_update on public.vehicle_check_template_items;
drop policy if exists vehicle_check_template_items_company_delete on public.vehicle_check_template_items;

-- vehicle_check_templates
-- Frontend insert: company, name, vehicle_type, description, is_active

create policy vehicle_check_templates_company_select
  on public.vehicle_check_templates
  for select
  to authenticated
  using (
    is_active = true
    and (
      company is null
      or public.drevora_vehicle_check_company_matches_auth_user(company)
    )
  );

create policy vehicle_check_templates_company_insert
  on public.vehicle_check_templates
  for insert
  to authenticated
  with check (
    public.drevora_auth_user_can_manage_vehicle_check_templates()
    and company is not null
    and public.drevora_vehicle_check_company_matches_auth_user(company)
    and coalesce(is_active, true) = true
  );

create policy vehicle_check_templates_company_update
  on public.vehicle_check_templates
  for update
  to authenticated
  using (
    public.drevora_auth_user_can_manage_vehicle_check_templates()
    and company is not null
    and public.drevora_vehicle_check_company_matches_auth_user(company)
  )
  with check (
    public.drevora_auth_user_can_manage_vehicle_check_templates()
    and company is not null
    and public.drevora_vehicle_check_company_matches_auth_user(company)
  );

create policy vehicle_check_templates_company_delete
  on public.vehicle_check_templates
  for delete
  to authenticated
  using (
    public.drevora_auth_user_can_manage_vehicle_check_templates()
    and company is not null
    and public.drevora_vehicle_check_company_matches_auth_user(company)
  );

-- vehicle_check_template_items (parent: template_id → vehicle_check_templates.id)

create policy vehicle_check_template_items_company_select
  on public.vehicle_check_template_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.is_active = true
        and (
          template.company is null
          or public.drevora_vehicle_check_company_matches_auth_user(template.company)
        )
    )
  );

create policy vehicle_check_template_items_company_insert
  on public.vehicle_check_template_items
  for insert
  to authenticated
  with check (
    public.drevora_auth_user_can_manage_vehicle_check_templates()
    and exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.company is not null
        and public.drevora_vehicle_check_company_matches_auth_user(template.company)
    )
  );

create policy vehicle_check_template_items_company_update
  on public.vehicle_check_template_items
  for update
  to authenticated
  using (
    public.drevora_auth_user_can_manage_vehicle_check_templates()
    and exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.company is not null
        and public.drevora_vehicle_check_company_matches_auth_user(template.company)
    )
  )
  with check (
    public.drevora_auth_user_can_manage_vehicle_check_templates()
    and exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.company is not null
        and public.drevora_vehicle_check_company_matches_auth_user(template.company)
    )
  );

create policy vehicle_check_template_items_company_delete
  on public.vehicle_check_template_items
  for delete
  to authenticated
  using (
    public.drevora_auth_user_can_manage_vehicle_check_templates()
    and exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.company is not null
        and public.drevora_vehicle_check_company_matches_auth_user(template.company)
    )
  );

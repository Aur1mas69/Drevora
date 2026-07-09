-- Fix vehicle check template RLS for company text (not company_id).
-- Safe to re-run. Only touches vehicle_check_templates + vehicle_check_template_items.

create or replace function public.drevora_current_company_name()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  company_id uuid;
  resolved text;
begin
  select c.id
  into company_id
  from public.companies c
  order by c.created_at asc nulls last
  limit 1;

  if company_id is null then
    return null;
  end if;

  select nullif(trim(c.name), '')
  into resolved
  from public.companies c
  where c.id = company_id;

  if resolved is not null then
    return resolved;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'company_name'
  ) then
    execute
      'select nullif(trim(company_name), '''') from public.companies where id = $1'
      into resolved
      using company_id;

    if resolved is not null then
      return resolved;
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'organisation_name'
  ) then
    execute
      'select nullif(trim(organisation_name), '''') from public.companies where id = $1'
      into resolved
      using company_id;

    if resolved is not null then
      return resolved;
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.drevora_company_text_matches_current(company_value text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    company_value is null
    or (
      nullif(trim(company_value), '') is not null
      and lower(trim(company_value)) = lower(trim(coalesce(public.drevora_current_company_name(), '')))
    );
$$;

-- Office/admin management: authenticated session plus company text isolation.
-- Matches dashboard_notes MVP pattern (no profiles table); UI limits access to admin vehicles screens.
create or replace function public.drevora_auth_user_can_manage_vehicle_check_templates()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

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
      company is null
      or public.drevora_company_text_matches_current(company)
    )
  );

create policy vehicle_check_templates_company_insert
  on public.vehicle_check_templates
  for insert
  to authenticated
  with check (
    public.drevora_auth_user_can_manage_vehicle_check_templates()
    and company is not null
    and public.drevora_company_text_matches_current(company)
    and is_active = true
  );

create policy vehicle_check_templates_company_update
  on public.vehicle_check_templates
  for update
  to authenticated
  using (
    public.drevora_auth_user_can_manage_vehicle_check_templates()
    and company is not null
    and public.drevora_company_text_matches_current(company)
  )
  with check (
    public.drevora_auth_user_can_manage_vehicle_check_templates()
    and company is not null
    and public.drevora_company_text_matches_current(company)
  );

create policy vehicle_check_templates_company_delete
  on public.vehicle_check_templates
  for delete
  to authenticated
  using (
    public.drevora_auth_user_can_manage_vehicle_check_templates()
    and company is not null
    and public.drevora_company_text_matches_current(company)
  );

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
          template.company is null
          or public.drevora_company_text_matches_current(template.company)
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
        and public.drevora_company_text_matches_current(template.company)
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
        and public.drevora_company_text_matches_current(template.company)
    )
  )
  with check (
    public.drevora_auth_user_can_manage_vehicle_check_templates()
    and exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.company is not null
        and public.drevora_company_text_matches_current(template.company)
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
        and public.drevora_company_text_matches_current(template.company)
    )
  );

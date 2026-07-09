-- Vehicle check template RLS scoped by company text (not company_id).
-- Read: global templates (company is null) + current company templates.
-- Write: authenticated office/admin users for the current company only.

create or replace function public.drevora_current_company_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(trim(c.name), '')
  from public.companies c
  order by c.created_at asc nulls last
  limit 1;
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

create or replace function public.drevora_auth_user_can_manage_vehicle_check_templates()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and (
        not exists (
          select 1
          from public.drivers d
          where lower(trim(coalesce(d.email, ''))) = lower(trim(coalesce(u.email, '')))
        )
        or exists (
          select 1
          from public.drivers d
          where lower(trim(coalesce(d.email, ''))) = lower(trim(coalesce(u.email, '')))
            and d.role in (
              'Admin',
              'Transport Manager',
              'Supervisor',
              'Planner',
              'Office Staff'
            )
        )
      )
  );
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

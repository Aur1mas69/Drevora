-- Normalize vehicle check templates into template headers + template items.
-- Existing legacy rows in public.vehicle_check_templates are preserved by copying
-- their item data into public.vehicle_check_template_items.

create table if not exists public.vehicle_check_templates (
  id uuid primary key default gen_random_uuid(),
  company text,
  name text not null,
  vehicle_type text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vehicle_check_templates
  add column if not exists company text,
  add column if not exists name text,
  add column if not exists vehicle_type text,
  add column if not exists description text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.vehicle_check_templates
  alter column name drop not null,
  alter column vehicle_type drop not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vehicle_check_templates'
      and column_name = 'section'
  ) then
    alter table public.vehicle_check_templates alter column section drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vehicle_check_templates'
      and column_name = 'item_name'
  ) then
    alter table public.vehicle_check_templates alter column item_name drop not null;
  end if;
end;
$$;

update public.vehicle_check_templates
set name = coalesce(name, vehicle_type || ' Daily Vehicle Check', 'Vehicle Check Template')
where name is null;

alter table public.vehicle_check_templates
  alter column name set not null;

create table if not exists public.vehicle_check_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.vehicle_check_templates (id) on delete cascade,
  section text not null,
  label text not null,
  description text,
  sort_order integer not null default 0,
  is_required boolean not null default true,
  allow_notes boolean not null default true,
  allow_photo boolean not null default false,
  fail_on_defect boolean not null default true,
  is_active boolean not null default true,
  is_custom boolean not null default false,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vehicle_check_templates'
      and column_name = 'section'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vehicle_check_templates'
      and column_name = 'item_name'
  ) then
    alter table public.vehicle_check_templates
      add column if not exists guidance text,
      add column if not exists allow_notes boolean not null default true,
      add column if not exists allow_photo boolean not null default false,
      add column if not exists fail_on_defect boolean not null default true,
      add column if not exists is_custom boolean not null default false;

    insert into public.vehicle_check_templates (
      company,
      name,
      vehicle_type,
      description,
      is_active,
      created_at,
      updated_at
    )
    select
      null,
      legacy.vehicle_type || ' Daily Vehicle Check',
      legacy.vehicle_type,
      null,
      true,
      min(coalesce(legacy.created_at, now())),
      now()
    from public.vehicle_check_templates legacy
    where legacy.vehicle_type is not null
      and legacy.section is not null
      and legacy.item_name is not null
      and not exists (
        select 1
        from public.vehicle_check_templates existing
        where existing.vehicle_type = legacy.vehicle_type
          and existing.section is null
          and existing.item_name is null
      )
    group by legacy.vehicle_type;

    insert into public.vehicle_check_template_items (
      template_id,
      section,
      label,
      description,
      sort_order,
      is_required,
      allow_notes,
      allow_photo,
      fail_on_defect,
      is_active,
      is_custom,
      created_at
    )
    select
      header.id,
      legacy.section,
      legacy.item_name,
      legacy.guidance,
      coalesce(legacy.sort_order, 0),
      coalesce(legacy.is_required, true),
      coalesce(legacy.allow_notes, true),
      coalesce(legacy.allow_photo, false),
      coalesce(legacy.fail_on_defect, true),
      coalesce(legacy.is_active, true),
      coalesce(legacy.is_custom, false),
      coalesce(legacy.created_at, now())
    from public.vehicle_check_templates legacy
    join public.vehicle_check_templates header
      on header.vehicle_type = legacy.vehicle_type
      and header.section is null
      and header.item_name is null
    where legacy.section is not null
      and legacy.item_name is not null
      and not exists (
        select 1
        from public.vehicle_check_template_items existing
        where existing.template_id = header.id
          and existing.section = legacy.section
          and existing.label = legacy.item_name
      );

    update public.vehicle_check_templates
    set is_active = false
    where section is not null
      and item_name is not null;
  end if;
end;
$$;

create index if not exists vehicle_check_templates_company_idx
  on public.vehicle_check_templates (company);

create index if not exists vehicle_check_templates_vehicle_type_idx
  on public.vehicle_check_templates (vehicle_type);

create index if not exists vehicle_check_templates_is_active_idx
  on public.vehicle_check_templates (is_active);

create index if not exists vehicle_check_template_items_template_id_idx
  on public.vehicle_check_template_items (template_id);

create index if not exists vehicle_check_template_items_sort_order_idx
  on public.vehicle_check_template_items (sort_order);

create index if not exists vehicle_check_template_items_is_active_idx
  on public.vehicle_check_template_items (is_active);

create or replace function public.set_vehicle_check_template_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicle_check_templates_updated_at on public.vehicle_check_templates;

create trigger vehicle_check_templates_updated_at
  before update on public.vehicle_check_templates
  for each row
  execute function public.set_vehicle_check_template_updated_at();

alter table public.vehicle_check_templates disable row level security;
alter table public.vehicle_check_template_items disable row level security;

grant select, insert, update, delete on public.vehicle_check_templates to anon, authenticated;
grant select, insert, update, delete on public.vehicle_check_template_items to anon, authenticated;

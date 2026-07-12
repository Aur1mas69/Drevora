import { writeFileSync } from 'node:fs'
import {
  DEFAULT_DVSA_VEHICLE_CHECK_ITEMS,
  DVSA_VEHICLE_CHECK_LABEL_ALIASES,
} from '../../src/lib/defaultDvsaVehicleCheckItems.ts'

function q(tag, value) {
  return `$${tag}$${value}$${tag}$`
}

const values = DEFAULT_DVSA_VEHICLE_CHECK_ITEMS.map((item) => {
  const aliases = DVSA_VEHICLE_CHECK_LABEL_ALIASES[item.label] ?? [item.label]
  const aliasArray = `ARRAY[${aliases.map((alias) => q('a', alias)).join(', ')}]::text[]`
  return `  (${item.sortOrder}, ${q('s', item.section)}, ${q('l', item.label)}, ${q('d', item.description)}, ${aliasArray})`
}).join(',\n')

const sql = `-- Restore DVSA HGV walkaround guidance on Basic / vehicle-type check templates.
-- Guidance field used by the Worker UI: public.vehicle_check_template_items.description
-- (mapped in app as templateItem.description).
-- Idempotent: updates matched items in place (preserves ids); inserts only missing DVSA rows.
-- Does not delete custom templates, extra checks, or completed vehicle checks.

alter table public.vehicle_check_template_items
  add column if not exists description text;

create temporary table if not exists tmp_dvsa_walkaround_items (
  sort_order integer primary key,
  section text not null,
  label text not null,
  description text not null,
  aliases text[] not null
) on commit drop;

truncate tmp_dvsa_walkaround_items;

insert into tmp_dvsa_walkaround_items (sort_order, section, label, description, aliases)
values
${values};

create temporary table if not exists tmp_dvsa_target_templates (
  template_id uuid primary key
) on commit drop;

truncate tmp_dvsa_target_templates;

-- Ensure a normalized template header exists for vehicle types that only have legacy flat rows.
insert into public.vehicle_check_templates (
  company,
  name,
  vehicle_type,
  description,
  is_active,
  section,
  item_name,
  sort_order,
  created_at,
  updated_at
)
select
  legacy.company,
  coalesce(nullif(trim(legacy.vehicle_type), ''), 'Vehicle') || ' Daily Vehicle Check',
  legacy.vehicle_type,
  'Default DREVORA DVSA-style daily vehicle check template.',
  true,
  'Extra checks',
  'Template header',
  0,
  now(),
  now()
from (
  select distinct
    vehicle_type,
    company
  from public.vehicle_check_templates
  where is_active = true
    and vehicle_type is not null
    and section is not null
    and item_name is not null
    and item_name <> 'Template header'
) as legacy
where not exists (
  select 1
  from public.vehicle_check_templates header
  where header.is_active = true
    and header.vehicle_type is not distinct from legacy.vehicle_type
    and header.company is not distinct from legacy.company
    and (
      header.section is null
      or header.item_name is null
      or header.item_name = 'Template header'
    )
);

-- Normalized template headers (Daily Vehicle Check / Basic DVSA style).
insert into tmp_dvsa_target_templates (template_id)
select t.id
from public.vehicle_check_templates t
where t.is_active = true
  and t.vehicle_type is not null
  and (
    t.section is null
    or t.item_name is null
    or t.item_name = 'Template header'
  )
on conflict do nothing;

-- Templates that already contain DVSA-like basic items.
insert into tmp_dvsa_target_templates (template_id)
select distinct i.template_id
from public.vehicle_check_template_items i
join public.vehicle_check_templates t on t.id = i.template_id
where t.is_active = true
  and coalesce(i.is_custom, false) = false
  and coalesce(i.sort_order, 0) <= 100
  and (
    lower(i.label) like '%front view%'
    or lower(i.label) like '%windscreen wipers%'
    or lower(i.label) like '%tyres and wheel%'
    or lower(i.label) like '%security of load%'
  )
on conflict do nothing;

-- Update matched existing DVSA items; keep row ids.
update public.vehicle_check_template_items as item
set
  section = seed.section,
  label = seed.label,
  description = seed.description,
  sort_order = seed.sort_order,
  is_required = true,
  allow_notes = true,
  allow_photo = false,
  fail_on_defect = true,
  is_active = true,
  is_custom = false
from tmp_dvsa_walkaround_items as seed
where item.template_id in (select template_id from tmp_dvsa_target_templates)
  and coalesce(item.is_custom, false) = false
  and coalesce(item.sort_order, 0) <= 100
  and (
    item.sort_order = seed.sort_order
    or lower(trim(item.label)) = any (
      select lower(trim(alias)) from unnest(seed.aliases) as alias
    )
  );

-- Insert missing DVSA rows only.
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
  is_custom
)
select
  target.template_id,
  seed.section,
  seed.label,
  seed.description,
  seed.sort_order,
  true,
  true,
  false,
  true,
  true,
  false
from tmp_dvsa_target_templates as target
cross join tmp_dvsa_walkaround_items as seed
where not exists (
  select 1
  from public.vehicle_check_template_items existing
  where existing.template_id = target.template_id
    and coalesce(existing.is_custom, false) = false
    and coalesce(existing.sort_order, 0) <= 100
    and (
      existing.sort_order = seed.sort_order
      or lower(trim(existing.label)) = lower(trim(seed.label))
      or lower(trim(existing.label)) = any (
        select lower(trim(alias)) from unnest(seed.aliases) as alias
      )
    )
);

-- Prefer normalized DVSA templates over legacy flat rows with empty guidance.
-- Soft-deactivate only legacy flat item rows when a normalized guided template exists
-- for the same vehicle_type. No deletes.
update public.vehicle_check_templates as legacy
set is_active = false
where legacy.is_active = true
  and legacy.section is not null
  and legacy.item_name is not null
  and legacy.item_name <> 'Template header'
  and exists (
    select 1
    from public.vehicle_check_templates header
    join public.vehicle_check_template_items item
      on item.template_id = header.id
    where header.is_active = true
      and header.vehicle_type is not distinct from legacy.vehicle_type
      and (
        header.section is null
        or header.item_name is null
        or header.item_name = 'Template header'
      )
      and coalesce(item.is_custom, false) = false
      and item.sort_order between 1 and 27
      and item.description is not null
      and length(trim(item.description)) > 0
  );
`

writeFileSync(
  new URL('../migrations/20260712183000_restore_dvsa_walkaround_guidance.sql', import.meta.url),
  sql,
)
console.log('Wrote migration bytes', sql.length)

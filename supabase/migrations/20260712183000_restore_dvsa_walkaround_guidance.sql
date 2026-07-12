-- Restore DVSA HGV walkaround guidance on Basic / vehicle-type check templates.
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
  (1, $s$Inside cab / front view$s$, $l$Front view (mirrors, cameras, and glass)$l$, $d$Check that no objects get in the way of your front view.

As a general rule, there should be nothing in the swept area of the windscreen wipers.

Some official stickers and road safety items are allowed, as long as they do not seriously block your view of the road, for example, operator licence disc.

Mirrors, cameras and glass

Check that the windscreen is not:
- cracked
- scratched
- discoloured

Check that the windscreen and front side windows are not excessively tinted.

Check that all mirrors are in place and not:
- damaged or missing glass
- obscured
- insecure

If a camera system is used instead of a mirror, check that it works and the view is correct.$d$, ARRAY[$a$Front view, mirrors, cameras and glass$a$, $a$Front view (mirrors, cameras, and glass)$a$]::text[]),
  (2, $s$Inside cab / front view$s$, $l$Windscreen wipers and washers$l$, $d$Make sure the windscreen wipers work. Check that they are not:
- missing
- damaged or worn

Make sure the windscreen washer is working.$d$, ARRAY[$a$Windscreen wipers and washers$a$]::text[]),
  (3, $s$Inside cab / front view$s$, $l$Dashboard warning lights and gauges$l$, $d$Check that all of these are working correctly:
- instruments
- gauges
- warning lights, including the engine warning, emissions system, anti-lock braking system (ABS) and electronic braking system (EBS)$d$, ARRAY[$a$Dashboard warning lights and gauges$a$]::text[]),
  (4, $s$Inside cab / front view$s$, $l$Steering$l$, $d$Check that the steering wheel:
- moves properly and that the power-assisted steering works correctly
- has no excessive play
- does not jam

Check that there is no excessive lift or movement in the steering column.$d$, ARRAY[$a$Steering$a$]::text[]),
  (5, $s$Inside cab / front view$s$, $l$Horn$l$, $d$Check that the horn works and is easily accessible from the driver’s seat.$d$, ARRAY[$a$Horn$a$]::text[]),
  (6, $s$Inside cab / front view$s$, $l$Brakes and air build-up$l$, $d$Check that:
- the air builds up correctly and the warning system works
- there are no air leaks
- the footwell is clear
- the service brake operates both the tractor and trailer brakes
- the parking brake for the tractor works
- the service brake pedal does not have excessive side play or missing, loose or incomplete anti-slip tread$d$, ARRAY[$a$Brakes and air build-up$a$]::text[]),
  (7, $s$Inside cab / front view$s$, $l$Height marker$l$, $d$Check the correct vehicle height is displayed on the vehicle height marker in the cab.

Remember, the height can change, for example, when the fifth wheel is adjusted, or if the trailer is loaded, unloaded or reloaded.$d$, ARRAY[$a$Height marker$a$]::text[]),
  (8, $s$Inside cab / front view$s$, $l$Seatbelts$l$, $d$Check that seatbelts:
- do not have any cuts, damage or fraying that may stop them from working
- stay secure when you plug them in
- retract against you when fitted, and fully retract when you take them off$d$, ARRAY[$a$Seatbelts$a$]::text[]),
  (9, $s$Inside cab / front view$s$, $l$Security and condition of cab, doors and steps$l$, $d$Check that:
- cab mountings and tilt devices are secure
- body panels are secure and not likely to fall off
- all doors operate as required and secure when closed
- steps are secure and safe to use$d$, ARRAY[$a$Cab, doors and steps$a$, $a$Security and condition of cab, doors and steps$a$]::text[]),
  (10, $s$Outside vehicle$s$, $l$Lights and indicators$l$, $d$Check that:
- all lights and indicators work correctly
- all lenses are fitted, clean and the right colour
- stop lamps come on when you apply the service brake and go out when you release it
- marker lights are fitted and work$d$, ARRAY[$a$Lights and indicators$a$]::text[]),
  (11, $s$Outside vehicle$s$, $l$Fuel and oil leaks$l$, $d$Check that the fuel filler cap is fitted correctly.

Turn on the engine and check underneath the vehicle for any fuel or oil leaks.$d$, ARRAY[$a$Fuel and oil leaks$a$]::text[]),
  (12, $s$Outside vehicle$s$, $l$Security of body and wings$l$, $d$Check that:
- all fastening devices work
- cab doors and trailer doors are secure when closed
- body panels on tractor or trailer are secure and not likely to fall off
- landing legs, if fitted, are secure and not likely to fall off while driving
- sideguards and rear under-run guards are fitted if required, and that they are not insecure or damaged$d$, ARRAY[$a$Body, wings and guards security$a$, $a$Security of body and wings$a$]::text[]),
  (13, $s$Outside vehicle$s$, $l$Battery security and condition$l$, $d$Check that your battery is:
- secure
- in good condition
- not leaking$d$, ARRAY[$a$Battery security and condition$a$]::text[]),
  (14, $s$Outside vehicle$s$, $l$Diesel exhaust fluid (AdBlue)$l$, $d$Check that your diesel vehicle has enough AdBlue diesel exhaust fluid and top up if necessary.$d$, ARRAY[$a$Diesel exhaust fluid / AdBlue$a$, $a$Diesel exhaust fluid (AdBlue)$a$]::text[]),
  (15, $s$Outside vehicle$s$, $l$Excessive engine exhaust smoke$l$, $d$Check that the exhaust does not emit an excessive amount of smoke.$d$, ARRAY[$a$Excessive engine exhaust smoke$a$]::text[]),
  (16, $s$Outside vehicle$s$, $l$High voltage emergency cut-off switch$l$, $d$Check that:
- you know where the high voltage emergency cut-off switch is located
- the high voltage emergency cut-off switch operates correctly
- all high voltage electrical components are secure and not damaged$d$, ARRAY[$a$High voltage emergency cut-off switch$a$]::text[]),
  (17, $s$Outside vehicle$s$, $l$Alternative fuel systems and isolation$l$, $d$Check that:
- you know where the fuel isolation switch is located
- there are no leaks from the system
- all visible components are in good condition$d$, ARRAY[$a$Alternative fuel systems and isolation$a$]::text[]),
  (18, $s$Outside vehicle$s$, $l$Spray suppression$l$, $d$If spray suppression flaps are required, check that they are:
- fitted
- secure
- not damaged
- not clogged with mud or debris$d$, ARRAY[$a$Spray suppression$a$]::text[]),
  (19, $s$Outside vehicle$s$, $l$Tyres and wheel fixing$l$, $d$Check that:
- the tyres and wheels are secure
- the tyres have a tread depth of at least 1mm
- the tyres are inflated correctly
- there are no deep cuts in the tyre’s sidewall
- there is no cord visible anywhere on the tyre
- all wheel nuts are tight enough; check whether wheel nut indicators, if fitted, have moved
- there are no objects or debris trapped between twin wheels$d$, ARRAY[$a$Tyres and wheel fixing$a$]::text[]),
  (20, $s$Outside vehicle$s$, $l$Brake lines and trailer parking brake$l$, $d$Check that:
- couplings are free from debris and are in the right place
- there are no leaks
- there is no damage or wear to the brake lines
- the parking brake for the trailer works

After the initial brake test, leave the engine running so pressure can build up. This will make it easier to hear any leaks as you carry out the rest of the walkaround check.$d$, ARRAY[$a$Brake lines and trailer parking brake$a$]::text[]),
  (21, $s$Outside vehicle$s$, $l$Electrical connections$l$, $d$Check each connection and make sure that:
- visible wiring is insulated
- visible wiring is not likely to get caught or damaged
- all electrical trailer couplings are connected securely
- all electrical switches work correctly$d$, ARRAY[$a$Electrical connections$a$]::text[]),
  (22, $s$Outside vehicle$s$, $l$Coupling security$l$, $d$Check that your vehicle is securely attached to your trailer and that:
- the trailer is located correctly in the fifth wheel or coupling
- secondary locking devices are in the correct position$d$, ARRAY[$a$Coupling security$a$]::text[]),
  (23, $s$Outside vehicle$s$, $l$Security of load$l$, $d$Check that the load does not move and is not likely to move.

Make sure you use the right type of load-securing system for the load.

If you are not happy with how the load is secured or how stable it is, ask the person in charge of vehicle safety to:
- get a competent person to assess it
- reload or resecure it if necessary$d$, ARRAY[$a$Security of load$a$]::text[]),
  (24, $s$Outside vehicle$s$, $l$Number plate$l$, $d$Check that the number plate is not:
- broken or incomplete
- incorrect or spaced incorrectly
- dirty
- faded
- covered over by anything$d$, ARRAY[$a$Number plate$a$]::text[]),
  (25, $s$Outside vehicle$s$, $l$Reflectors$l$, $d$Check that reflectors, including side reflectors, are not:
- missing
- broken
- insecure
- fitted incorrectly
- the wrong colour
- obscured by dirt or other objects$d$, ARRAY[$a$Reflectors$a$]::text[]),
  (26, $s$Outside vehicle$s$, $l$Markings and warning plates$l$, $d$Check that the vehicle’s markings, including conspicuity markings, are:
- the right colour
- visible
- securely fastened
- not obscured by dirt or other objects

If the vehicle is carrying dangerous goods, check that the hazard information panels:
- show the correct information for the load
- are visible
- are securely fastened
- are not obscured by dirt or other objects$d$, ARRAY[$a$Markings and warning plates$a$]::text[]),
  (27, $s$Outside vehicle$s$, $l$Other equipment$l$, $d$Check any other items specific to the vehicle, for example loading equipment or specialised equipment.$d$, ARRAY[$a$Other equipment$a$]::text[]);

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

-- =============================================================================
-- DREVORA Database Schema — SINGLE SOURCE OF TRUTH
-- =============================================================================
-- All database structure changes belong in this file first.
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS and ADD COLUMN IF NOT EXISTS.
-- Does not drop tables or delete data.
--
-- After editing this file, also update when needed:
--   supabase/migrations/   incremental migration (existing DBs)
--   supabase/policies.sql  if RLS changes
--   supabase/seed.sql      if demo seed data changes
--   supabase/README.md     if setup steps change
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Workers
-- Table name "drivers" is kept for backward compatibility with the React app.
-- -----------------------------------------------------------------------------

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  company text,
  assigned_vehicle text,
  role text default 'Driver',
  status text default 'Off Duty',
  avatar_url text
);

-- Ensure all worker columns exist on databases created before later migrations
alter table public.drivers
  add column if not exists created_at timestamptz default now(),
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists company text,
  add column if not exists assigned_vehicle text,
  add column if not exists role text default 'Driver',
  add column if not exists status text default 'Off Duty',
  add column if not exists avatar_url text,
  add column if not exists worker_code text;

update public.drivers
set role = 'Driver'
where role is null;

create index if not exists drivers_status_idx on public.drivers (status);
create index if not exists drivers_company_idx on public.drivers (company);
create index if not exists drivers_email_idx on public.drivers (email);
create index if not exists drivers_role_idx on public.drivers (role);

create unique index if not exists drivers_company_worker_code_unique_idx
  on public.drivers (coalesce(company, ''), worker_code);


-- -----------------------------------------------------------------------------
-- Compliance Fields
-- Managed in the Compliance module; not required on the basic Add Worker form.
-- -----------------------------------------------------------------------------

alter table public.drivers
  add column if not exists driving_licence_expiry date,
  add column if not exists cpc_expiry date,
  add column if not exists driver_card_expiry date,
  add column if not exists medical_expiry date,
  add column if not exists adr_expiry date,
  add column if not exists hiab_expiry date;

alter table public.drivers
  add column if not exists licence_categories text[],
  add column if not exists tacho_card_number text,
  add column if not exists default_vehicle_id uuid references public.vehicles (id) on delete set null,
  add column if not exists start_date date,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists emergency_contact_relationship text;

alter table public.drivers
  add column if not exists employment_type text;

alter table public.drivers
  add column if not exists paid_holiday_enabled boolean,
  add column if not exists annual_paid_holiday_days numeric,
  add column if not exists bank_holiday_entitlement_days numeric,
  add column if not exists unpaid_leave_allowed boolean not null default true,
  add column if not exists holiday_entitlement_notes text;

alter table public.drivers
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists town_city text,
  add column if not exists county text,
  add column if not exists postcode text,
  add column if not exists country text default 'United Kingdom';

create index if not exists drivers_default_vehicle_id_idx
  on public.drivers (default_vehicle_id);

create or replace function public.generate_worker_code()
returns text
language plpgsql
volatile
as $$
declare
  letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  digits constant text := '23456789';
  chars text[] := array[]::text[];
  result text;
begin
  chars := array[
    substr(letters, 1 + floor(random() * length(letters))::int, 1),
    substr(digits, 1 + floor(random() * length(digits))::int, 1)
  ];

  while coalesce(array_length(chars, 1), 0) < 5 loop
    if random() < 0.5 then
      chars := array_append(
        chars,
        substr(letters, 1 + floor(random() * length(letters))::int, 1)
      );
    else
      chars := array_append(
        chars,
        substr(digits, 1 + floor(random() * length(digits))::int, 1)
      );
    end if;
  end loop;

  select string_agg(ch, '' order by random())
  into result
  from unnest(chars) as ch;

  return result;
end;
$$;

create or replace function public.generate_unique_worker_code(p_company text)
returns text
language plpgsql
volatile
as $$
declare
  candidate text;
  attempts int := 0;
begin
  loop
    candidate := public.generate_worker_code();
    if not exists (
      select 1
      from public.drivers d
      where coalesce(d.company, '') = coalesce(p_company, '')
        and d.worker_code = candidate
    ) then
      return candidate;
    end if;
    attempts := attempts + 1;
    if attempts >= 100 then
      raise exception 'Could not generate unique worker_code for company after 100 attempts';
    end if;
  end loop;
end;
$$;

create or replace function public.drivers_set_worker_code()
returns trigger
language plpgsql
as $$
begin
  if new.worker_code is null or btrim(new.worker_code) = '' then
    new.worker_code := public.generate_unique_worker_code(new.company);
  end if;
  return new;
end;
$$;

drop trigger if exists drivers_set_worker_code_trigger on public.drivers;

create trigger drivers_set_worker_code_trigger
  before insert on public.drivers
  for each row
  execute function public.drivers_set_worker_code();


-- -----------------------------------------------------------------------------
-- Vehicles
-- -----------------------------------------------------------------------------

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  registration text not null,
  fleet_number text,
  make text not null,
  model text not null,
  year integer,
  vin text,
  current_odometer integer,
  status text default 'Available',
  availability_status text default 'Available',
  current_driver_id uuid references public.drivers (id) on delete set null,
  insurance_expiry date,
  mot_expiry date,
  road_tax_expiry date,
  tachograph_expiry date,
  notes text
);

-- Ensure all vehicle columns exist on databases created before later migrations
alter table public.vehicles
  add column if not exists created_at timestamptz default now(),
  add column if not exists registration text,
  add column if not exists fleet_number text,
  add column if not exists make text,
  add column if not exists model text,
  add column if not exists year integer,
  add column if not exists vin text,
  add column if not exists current_odometer integer,
  add column if not exists status text default 'Available',
  add column if not exists availability_status text default 'Available',
  add column if not exists current_driver_id uuid references public.drivers (id) on delete set null,
  add column if not exists insurance_expiry date,
  add column if not exists mot_expiry date,
  add column if not exists road_tax_expiry date,
  add column if not exists tachograph_expiry date,
  add column if not exists notes text,
  add column if not exists vehicle_type text;

-- Off-road fields (legacy vehicle-level scheduling; also used in Add/Edit Vehicle modal)
alter table public.vehicles
  add column if not exists off_road_reason text,
  add column if not exists off_road_start_date date,
  add column if not exists off_road_expected_return_date date,
  add column if not exists off_road_start date,
  add column if not exists off_road_return date,
  add column if not exists off_road_notes text;

create index if not exists vehicles_registration_idx on public.vehicles (registration);
create index if not exists vehicles_status_idx on public.vehicles (status);
create index if not exists vehicles_availability_status_idx on public.vehicles (availability_status);
create index if not exists vehicles_current_driver_idx on public.vehicles (current_driver_id);
create index if not exists vehicles_mot_expiry_idx on public.vehicles (mot_expiry);
create index if not exists vehicles_insurance_expiry_idx on public.vehicles (insurance_expiry);
create index if not exists vehicles_vehicle_type_idx on public.vehicles (vehicle_type);


-- -----------------------------------------------------------------------------
-- Vehicle Availability
-- Date-based status records (Off Road, Workshop, Maintenance, etc.)
-- Current status is calculated from active records for today's date.
-- -----------------------------------------------------------------------------

create table if not exists public.vehicle_availability (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  status text not null,
  start_date date not null,
  end_date date,
  reason text,
  notes text
);

alter table public.vehicle_availability
  add column if not exists created_at timestamptz default now(),
  add column if not exists vehicle_id uuid references public.vehicles (id) on delete cascade,
  add column if not exists status text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists reason text,
  add column if not exists notes text;

create index if not exists vehicle_availability_vehicle_id_idx
  on public.vehicle_availability (vehicle_id);

create index if not exists vehicle_availability_date_range_idx
  on public.vehicle_availability (start_date, end_date);

create index if not exists vehicle_availability_status_idx
  on public.vehicle_availability (status);


-- -----------------------------------------------------------------------------
-- Companies
-- -----------------------------------------------------------------------------

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text,
  address text,
  city text,
  postcode text,
  country text,
  timezone text default 'Europe/London',
  weather_location text,
  time_format text not null default '24-hour',
  logo_url text,
  date_format text not null default 'DMY',
  week_starts_on text not null default 'monday',
  fleet_number_prefix text not null default '',
  default_vehicle_status text not null default 'Available',
  default_driver_role text not null default 'Driver',
  default_break_minutes integer not null default 30,
  paid_breaks boolean not null default false,
  overtime_after_hours numeric not null default 10.5,
  round_time_minutes integer not null default 0,
  require_manager_approval boolean not null default true,
  holiday_year_start text not null default '01-01',
  annual_leave_allowance integer not null default 28,
  theme text not null default 'light',
  compact_tables boolean not null default false,
  email_notifications boolean not null default true,
  push_notifications boolean not null default false,
  session_timeout_minutes integer not null default 480,
  require_mfa boolean not null default false,
  overtime_mode text not null default 'Manual',
  overtime_multiplier numeric not null default 1.5,
  currency text not null default 'GBP',
  saturday_overtime_enabled boolean not null default false,
  saturday_overtime_after_hours numeric not null default 6.0,
  saturday_overtime_multiplier numeric not null default 1.5,
  sunday_overtime_enabled boolean not null default false,
  sunday_overtime_after_hours numeric not null default 0.0,
  sunday_overtime_multiplier numeric not null default 2.0,
  timesheet_week_start_day text not null default 'monday',
  timesheet_week_reset_month integer not null default 4,
  timesheet_week_reset_day integer not null default 5,
  holiday_counting_method text not null default 'working_days',
  holiday_working_days text[] not null default array[
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday'
  ]::text[],
  holiday_entitlement_rules jsonb not null default '{
    "Full-time": { "paidHolidayEnabled": true, "annualPaidHolidayDays": 20, "bankHolidayEntitlementDays": 8, "unpaidLeaveAllowed": true },
    "Part-time": { "paidHolidayEnabled": true, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true },
    "Umbrella": { "paidHolidayEnabled": false, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true },
    "Agency": { "paidHolidayEnabled": false, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true },
    "Self-employed / Contractor": { "paidHolidayEnabled": false, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true },
    "Zero-hours": { "paidHolidayEnabled": false, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true },
    "Temporary": { "paidHolidayEnabled": false, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true },
    "Casual": { "paidHolidayEnabled": false, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true },
    "Other": { "paidHolidayEnabled": true, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true }
  }'::jsonb,
  consumable_default_prices jsonb not null default '{}'::jsonb,
  constraint companies_time_format_check check (time_format in ('24-hour', '12-hour')),
  constraint companies_date_format_check check (date_format in ('DMY', 'MDY', 'YMD')),
  constraint companies_week_starts_on_check check (week_starts_on in ('monday', 'sunday')),
  constraint companies_theme_check check (theme in ('light', 'dark', 'system')),
  constraint companies_default_break_check check (default_break_minutes in (30, 45, 60)),
  constraint companies_overtime_after_hours_check check (
    overtime_after_hours >= 5.5
    and overtime_after_hours <= 15.5
    and (overtime_after_hours * 2) = floor(overtime_after_hours * 2)
  ),
  constraint companies_round_time_check check (round_time_minutes in (0, 5, 15)),
  constraint companies_overtime_mode_check check (overtime_mode in ('Manual', 'Automatic')),
  constraint companies_overtime_multiplier_check check (
    overtime_multiplier >= 1.1
    and overtime_multiplier <= 2.5
    and mod((overtime_multiplier * 10)::numeric, 1) = 0
  ),
  constraint companies_currency_check check (currency in ('GBP', 'EUR', 'USD', 'RUB')),
  constraint companies_saturday_overtime_after_hours_check check (
    saturday_overtime_after_hours >= 0
    and saturday_overtime_after_hours <= 15.5
    and (saturday_overtime_after_hours * 2) = floor(saturday_overtime_after_hours * 2)
  ),
  constraint companies_sunday_overtime_after_hours_check check (
    sunday_overtime_after_hours >= 0
    and sunday_overtime_after_hours <= 15.5
    and (sunday_overtime_after_hours * 2) = floor(sunday_overtime_after_hours * 2)
  ),
  constraint companies_saturday_overtime_multiplier_check check (
    saturday_overtime_multiplier >= 1.0
    and saturday_overtime_multiplier <= 2.5
    and (saturday_overtime_multiplier * 10) = floor(saturday_overtime_multiplier * 10)
  ),
  constraint companies_sunday_overtime_multiplier_check check (
    sunday_overtime_multiplier >= 1.0
    and sunday_overtime_multiplier <= 2.5
    and (sunday_overtime_multiplier * 10) = floor(sunday_overtime_multiplier * 10)
  ),
  constraint companies_timesheet_week_start_day_check check (
    timesheet_week_start_day in ('monday', 'sunday')
  ),
  constraint companies_timesheet_week_reset_month_check check (
    timesheet_week_reset_month >= 1 and timesheet_week_reset_month <= 12
  ),
  constraint companies_timesheet_week_reset_day_check check (
    timesheet_week_reset_day >= 1 and timesheet_week_reset_day <= 31
  ),
  constraint companies_holiday_counting_method_check check (
    holiday_counting_method in ('working_days', 'calendar_days', 'custom_working_week')
  ),
  constraint companies_holiday_working_days_check check (
    holiday_working_days <@ array[
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    ]::text[]
  )
);

create index if not exists companies_created_at_idx on public.companies (created_at);


-- -----------------------------------------------------------------------------
-- Timesheets
-- Driver weekly hours with daily entries (Mon–Sun)
-- -----------------------------------------------------------------------------

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  week_start date not null,
  status text not null default 'Draft',
  notes text,
  bonus_amount numeric not null default 0,
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz
);

create table if not exists public.timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid not null references public.timesheets (id) on delete cascade,
  day_date date not null,
  start_time time,
  break_minutes integer not null default 0,
  finish_time time,
  total_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  payroll_minutes integer not null default 0,
  additional_hours numeric not null default 0,
  daily_comment text,
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text
);

alter table public.timesheets
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists driver_id uuid references public.drivers (id) on delete cascade,
  add column if not exists vehicle_id uuid references public.vehicles (id) on delete set null,
  add column if not exists week_start date,
  add column if not exists status text default 'Draft',
  add column if not exists notes text,
  add column if not exists bonus_amount numeric not null default 0,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists delete_reason text,
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz;

alter table public.timesheet_entries
  add column if not exists timesheet_id uuid references public.timesheets (id) on delete cascade,
  add column if not exists day_date date,
  add column if not exists start_time time,
  add column if not exists break_minutes integer default 0,
  add column if not exists finish_time time,
  add column if not exists total_minutes integer default 0,
  add column if not exists overtime_minutes integer not null default 0,
  add column if not exists payroll_minutes integer not null default 0,
  add column if not exists additional_hours numeric not null default 0,
  add column if not exists daily_comment text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists delete_reason text;

create index if not exists timesheets_driver_id_idx on public.timesheets (driver_id);
create index if not exists timesheets_vehicle_id_idx on public.timesheets (vehicle_id);
create index if not exists timesheets_week_start_idx on public.timesheets (week_start);
create index if not exists timesheets_status_idx on public.timesheets (status);
create index if not exists idx_timesheets_not_deleted
  on public.timesheets (week_start, deleted_at);
create index if not exists idx_timesheets_submitted_at
  on public.timesheets (submitted_at);
create index if not exists idx_timesheets_status_submitted_at
  on public.timesheets (status, submitted_at);
create unique index if not exists timesheets_driver_week_unique_idx
  on public.timesheets (driver_id, week_start)
  where deleted_at is null;

create index if not exists timesheet_entries_timesheet_id_idx
  on public.timesheet_entries (timesheet_id);
create index if not exists timesheet_entries_day_date_idx
  on public.timesheet_entries (day_date);
create index if not exists idx_timesheet_entries_not_deleted
  on public.timesheet_entries (timesheet_id, deleted_at);
create unique index if not exists timesheet_entries_timesheet_day_unique_idx
  on public.timesheet_entries (timesheet_id, day_date);


-- Holiday leave requests
create table if not exists public.holiday_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  worker_id uuid not null references public.drivers (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  total_days numeric not null default 0,
  reason text,
  status text not null default 'Pending',
  manager_note text,
  leave_type text not null default 'paid_holiday',
  is_paid_leave boolean not null default true,
  holiday_days_deducted numeric,
  calendar_days_total numeric,
  non_working_days_excluded numeric,
  constraint holiday_requests_end_after_start check (end_date >= start_date),
  constraint holiday_requests_status_check check (
    status in ('Pending', 'Approved', 'Rejected', 'Cancelled')
  ),
  constraint holiday_requests_leave_type_check check (
    leave_type in ('paid_holiday', 'unpaid_leave', 'bank_holiday')
  )
);

create index if not exists holiday_requests_worker_id_idx
  on public.holiday_requests (worker_id);
create index if not exists holiday_requests_status_idx
  on public.holiday_requests (status);
create index if not exists holiday_requests_start_date_idx
  on public.holiday_requests (start_date);
create index if not exists holiday_requests_end_date_idx
  on public.holiday_requests (end_date);
create index if not exists holiday_requests_dates_idx
  on public.holiday_requests (start_date, end_date);

alter table public.holiday_requests disable row level security;
grant select, insert, update, delete on public.holiday_requests to anon, authenticated;

-- Vehicle inspections
create table if not exists public.vehicle_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  worker_id uuid not null references public.drivers (id) on delete cascade,
  inspection_date date not null,
  odometer integer,
  odometer_unit text not null default 'miles',
  status text not null default 'Completed',
  overall_result text not null default 'Pass',
  notes text,
  signature_url text,
  signed_at timestamptz,
  inspection_started_at timestamptz,
  inspection_completed_at timestamptz,
  duration_seconds integer,
  constraint vehicle_checks_status_check check (
    status in ('Completed', 'Pending', 'In Progress')
  ),
  constraint vehicle_checks_overall_result_check check (
    overall_result in ('Pass', 'Advisory', 'Fail')
  ),
  constraint vehicle_checks_odometer_unit_check check (
    odometer_unit in ('miles', 'km')
  )
);

alter table public.vehicle_checks
  add column if not exists odometer_unit text,
  add column if not exists signature_url text,
  add column if not exists signed_at timestamptz,
  add column if not exists inspection_started_at timestamptz,
  add column if not exists inspection_completed_at timestamptz,
  add column if not exists duration_seconds integer;

update public.vehicle_checks
set odometer_unit = 'miles'
where odometer_unit is null;

alter table public.vehicle_checks
  alter column odometer_unit set default 'miles';

alter table public.vehicle_checks
  alter column odometer_unit set not null;

alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_odometer_unit_check;

alter table public.vehicle_checks
  add constraint vehicle_checks_odometer_unit_check check (
    odometer_unit in ('miles', 'km')
  );

alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_duration_seconds_non_negative;

alter table public.vehicle_checks
  add constraint vehicle_checks_duration_seconds_non_negative check (
    duration_seconds is null or duration_seconds >= 0
  );

create table if not exists public.vehicle_check_items (
  id uuid primary key default gen_random_uuid(),
  vehicle_check_id uuid not null references public.vehicle_checks (id) on delete cascade,
  category text not null,
  item_name text not null,
  result text not null default 'Pass',
  comment text,
  photo_url text,
  guidance text,
  allow_notes boolean not null default true,
  allow_photo boolean not null default false,
  fail_on_defect boolean not null default true,
  constraint vehicle_check_items_result_check check (
    result in ('Pass', 'Advisory', 'Fail')
  )
);

alter table public.vehicle_check_items
  add column if not exists guidance text,
  add column if not exists allow_notes boolean not null default true,
  add column if not exists allow_photo boolean not null default false,
  add column if not exists fail_on_defect boolean not null default true;

create index if not exists vehicle_checks_vehicle_id_idx on public.vehicle_checks (vehicle_id);
create index if not exists vehicle_checks_worker_id_idx on public.vehicle_checks (worker_id);
create index if not exists vehicle_checks_inspection_date_idx on public.vehicle_checks (inspection_date);
create index if not exists vehicle_checks_status_idx on public.vehicle_checks (status);
create index if not exists vehicle_checks_overall_result_idx on public.vehicle_checks (overall_result);
create index if not exists vehicle_check_items_check_id_idx on public.vehicle_check_items (vehicle_check_id);
create index if not exists vehicle_check_items_result_idx on public.vehicle_check_items (result);

alter table public.vehicle_checks disable row level security;
alter table public.vehicle_check_items disable row level security;
grant select, insert, update, delete on public.vehicle_checks to anon, authenticated;
grant select, insert, update, delete on public.vehicle_check_items to anon, authenticated;

-- Vehicle check templates (flexible company/vehicle-type checklists)
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

alter table public.vehicle_check_templates enable row level security;
alter table public.vehicle_check_template_items enable row level security;

grant select, insert, update, delete on public.vehicle_check_templates to anon, authenticated;
grant select, insert, update, delete on public.vehicle_check_template_items to anon, authenticated;

drop policy if exists vehicle_check_templates_select_global on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_select_company on public.vehicle_check_templates;
drop policy if exists "Read active vehicle check templates" on public.vehicle_check_templates;

grant select, insert, update, delete on public.worker_compliance_records to anon, authenticated;

-- Worker compliance / training records
create table if not exists public.worker_compliance_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  worker_id uuid not null references public.drivers (id) on delete cascade,
  document_type text not null,
  document_name text,
  issue_date date,
  expiry_date date,
  status text not null default 'Valid',
  reference_number text,
  notes text,
  file_url text,
  constraint worker_compliance_records_status_check check (
    status in ('Valid', 'Expiring Soon', 'Expired', 'Not Added')
  )
);

create index if not exists worker_compliance_records_worker_id_idx
  on public.worker_compliance_records (worker_id);
create index if not exists worker_compliance_records_document_type_idx
  on public.worker_compliance_records (document_type);
create index if not exists worker_compliance_records_expiry_date_idx
  on public.worker_compliance_records (expiry_date);
create index if not exists worker_compliance_records_status_idx
  on public.worker_compliance_records (status);

alter table public.worker_compliance_records disable row level security;
grant select, insert, update, delete on public.worker_compliance_records to anon, authenticated;

-- Vehicle compliance documents (extends legacy vehicle expiry fields)
create table if not exists public.vehicle_compliance_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  document_type text not null,
  document_name text,
  issue_date date,
  expiry_date date,
  status text not null default 'Valid',
  reference_number text,
  notes text,
  file_url text,
  constraint vehicle_compliance_records_status_check check (
    status in ('Valid', 'Expiring Soon', 'Expired', 'Not Added')
  )
);

create index if not exists vehicle_compliance_records_vehicle_id_idx
  on public.vehicle_compliance_records (vehicle_id);
create index if not exists vehicle_compliance_records_document_type_idx
  on public.vehicle_compliance_records (document_type);
create index if not exists vehicle_compliance_records_expiry_date_idx
  on public.vehicle_compliance_records (expiry_date);
create index if not exists vehicle_compliance_records_status_idx
  on public.vehicle_compliance_records (status);

alter table public.vehicle_compliance_records disable row level security;
grant select, insert, update, delete on public.vehicle_compliance_records to anon, authenticated;


-- -----------------------------------------------------------------------------
-- Documents (company, worker, vehicle)
-- -----------------------------------------------------------------------------

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company text,
  document_name text not null,
  document_type text not null,
  applies_to text not null,
  worker_id uuid references public.drivers (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete cascade,
  reference_number text,
  issue_date date,
  expiry_date date,
  file_url text,
  file_path text,
  notes text,
  status text not null default 'valid',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint documents_applies_to_check check (
    applies_to in ('company', 'worker', 'vehicle')
  ),
  constraint documents_status_check check (
    status in ('valid', 'expiring_soon', 'expired', 'no_expiry')
  ),
  constraint documents_worker_scope_check check (
    applies_to <> 'worker' or worker_id is not null
  ),
  constraint documents_vehicle_scope_check check (
    applies_to <> 'vehicle' or vehicle_id is not null
  )
);

create index if not exists documents_company_idx on public.documents (company);
create index if not exists documents_applies_to_idx on public.documents (applies_to);
create index if not exists documents_worker_id_idx on public.documents (worker_id);
create index if not exists documents_vehicle_id_idx on public.documents (vehicle_id);
create index if not exists documents_document_type_idx on public.documents (document_type);
create index if not exists documents_expiry_date_idx on public.documents (expiry_date);
create index if not exists documents_status_idx on public.documents (status);

drop trigger if exists documents_set_updated_at on public.documents;

create trigger documents_set_updated_at
  before update on public.documents
  for each row
  execute function public.drevora_set_updated_at();

alter table public.documents disable row level security;
grant select, insert, update, delete on public.documents to anon, authenticated;


-- -----------------------------------------------------------------------------
-- Driver Reports
-- -----------------------------------------------------------------------------

create table if not exists public.driver_reports (
  id uuid primary key default gen_random_uuid(),
  company text,
  worker_id uuid references public.drivers (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  title text not null,
  report_type text not null default 'Other',
  priority text not null default 'Medium',
  status text not null default 'New',
  description text,
  location text,
  issue_datetime timestamptz,
  office_notes text,
  attachment_url text,
  attachment_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_reports_report_type_check check (
    report_type in (
      'Vehicle issue',
      'Damage',
      'Load / cargo issue',
      'Site / customer issue',
      'Health & safety',
      'Delay / operational issue',
      'Other'
    )
  ),
  constraint driver_reports_priority_check check (
    priority in ('Low', 'Medium', 'High', 'Critical')
  ),
  constraint driver_reports_status_check check (
    status in ('New', 'In Progress', 'Closed')
  )
);

create index if not exists driver_reports_company_idx on public.driver_reports (company);
create index if not exists driver_reports_worker_id_idx on public.driver_reports (worker_id);
create index if not exists driver_reports_vehicle_id_idx on public.driver_reports (vehicle_id);
create index if not exists driver_reports_status_idx on public.driver_reports (status);
create index if not exists driver_reports_priority_idx on public.driver_reports (priority);
create index if not exists driver_reports_report_type_idx on public.driver_reports (report_type);
create index if not exists driver_reports_created_at_idx on public.driver_reports (created_at desc);

drop trigger if exists driver_reports_set_updated_at on public.driver_reports;

create trigger driver_reports_set_updated_at
  before update on public.driver_reports
  for each row
  execute function public.drevora_set_updated_at();

alter table public.driver_reports disable row level security;
grant select, insert, update, delete on public.driver_reports to anon, authenticated;


-- -----------------------------------------------------------------------------
-- Consumables
-- Fuel, fluids, AdBlue, oils and other vehicle-related consumables.
-- -----------------------------------------------------------------------------

create table if not exists public.consumables (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles (id) on delete set null,
  worker_id uuid references public.drivers (id) on delete set null,
  consumable_type text not null,
  item_name text,
  quantity numeric not null,
  unit text not null default 'L',
  cost numeric,
  supplier text,
  site text,
  odometer numeric,
  receipt_url text,
  notes text,
  entry_date date not null,
  entry_time time,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text,
  constraint consumables_type_check check (
    consumable_type in (
      'Diesel',
      'Petrol',
      'AdBlue',
      'Engine Oil',
      'Coolant',
      'Screenwash',
      'Hydraulic Oil',
      'Grease',
      'Admixture',
      'Concrete Additive',
      'Other'
    )
  ),
  constraint consumables_unit_check check (
    unit in ('L', 'ml', 'kg', 'pcs', 'other')
  ),
  constraint consumables_quantity_non_negative check (quantity >= 0),
  constraint consumables_cost_non_negative check (cost is null or cost >= 0),
  constraint consumables_odometer_non_negative check (odometer is null or odometer >= 0)
);

create index if not exists consumables_entry_date_idx
  on public.consumables (entry_date);

create index if not exists consumables_type_idx
  on public.consumables (consumable_type);

create index if not exists consumables_vehicle_id_idx
  on public.consumables (vehicle_id);

create index if not exists consumables_worker_id_idx
  on public.consumables (worker_id);

create index if not exists consumables_not_deleted_idx
  on public.consumables (entry_date, deleted_at);

alter table public.consumables disable row level security;
grant select, insert, update, delete on public.consumables to anon, authenticated;


-- -----------------------------------------------------------------------------
-- Dashboard notes / plans
-- Quick operational reminders on the admin dashboard.
-- -----------------------------------------------------------------------------

create table if not exists public.dashboard_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid,
  note text not null,
  status text not null default 'open',
  priority text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_notes_status_check check (status in ('open', 'done')),
  constraint dashboard_notes_note_not_empty check (char_length(trim(note)) > 0)
);

create index if not exists dashboard_notes_company_id_idx
  on public.dashboard_notes (company_id);

create index if not exists dashboard_notes_status_idx
  on public.dashboard_notes (status);

create index if not exists dashboard_notes_due_date_idx
  on public.dashboard_notes (due_date)
  where due_date is not null;

create index if not exists dashboard_notes_company_status_idx
  on public.dashboard_notes (company_id, status);

create index if not exists dashboard_notes_company_updated_idx
  on public.dashboard_notes (company_id, updated_at desc);

create or replace function public.drevora_current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.companies c
  order by c.created_at asc nulls last
  limit 1;
$$;

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
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  company_id uuid;
  insert_value text;
  candidate text;
begin
  if company_value is null then
    return true;
  end if;

  insert_value := nullif(trim(company_value), '');
  if insert_value is null then
    return false;
  end if;

  select c.id
  into company_id
  from public.companies c
  order by c.created_at asc nulls last
  limit 1;

  if company_id is null then
    return false;
  end if;

  select nullif(trim(c.name), '')
  into candidate
  from public.companies c
  where c.id = company_id;

  if candidate is not null and lower(insert_value) = lower(candidate) then
    return true;
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
      into candidate
      using company_id;

    if candidate is not null and lower(insert_value) = lower(candidate) then
      return true;
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
      into candidate
      using company_id;

    if candidate is not null and lower(insert_value) = lower(candidate) then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.drevora_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dashboard_notes_set_updated_at on public.dashboard_notes;

create trigger dashboard_notes_set_updated_at
  before update on public.dashboard_notes
  for each row
  execute function public.drevora_set_updated_at();

alter table public.dashboard_notes enable row level security;
grant select, insert, update, delete on public.dashboard_notes to anon, authenticated;


-- -----------------------------------------------------------------------------
-- Contacts
-- Business directory: customers, suppliers, garages, sites, etc.
-- -----------------------------------------------------------------------------

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  company text,
  name text,
  organisation text,
  category text not null default 'other',
  phone text,
  email text,
  website text,
  role_title text,
  vat_number text,
  account_reference text,
  address_line_1 text,
  address_line_2 text,
  town_city text,
  county text,
  postcode text,
  country text default 'United Kingdom',
  notes text,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint contacts_category_check check (
    category in (
      'customer',
      'supplier',
      'garage_workshop',
      'site_plant',
      'insurance',
      'accountant',
      'emergency',
      'other'
    )
  ),
  constraint contacts_status_check check (status in ('active', 'inactive'))
);

create index if not exists contacts_company_idx on public.contacts (company);
create index if not exists contacts_category_idx on public.contacts (category);
create index if not exists contacts_status_idx on public.contacts (status);
create index if not exists contacts_name_idx on public.contacts (name);
create index if not exists contacts_organisation_idx on public.contacts (organisation);

drop trigger if exists contacts_set_updated_at on public.contacts;

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row
  execute function public.drevora_set_updated_at();

alter table public.contacts disable row level security;
grant select, insert, update, delete on public.contacts to anon, authenticated;


-- -----------------------------------------------------------------------------
-- Next steps
-- 1. Run policies.sql  — RLS configuration (MVP: disabled)
-- 2. Run seed.sql      — optional demo data (local/dev only)
-- -----------------------------------------------------------------------------

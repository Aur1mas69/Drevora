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
  add column if not exists avatar_url text;

update public.drivers
set role = 'Driver'
where role is null;

create index if not exists drivers_status_idx on public.drivers (status);
create index if not exists drivers_company_idx on public.drivers (company);
create index if not exists drivers_email_idx on public.drivers (email);
create index if not exists drivers_role_idx on public.drivers (role);


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
  overtime_after_hours integer not null default 8,
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
  constraint companies_time_format_check check (time_format in ('24-hour', '12-hour')),
  constraint companies_date_format_check check (date_format in ('DMY', 'MDY', 'YMD')),
  constraint companies_week_starts_on_check check (week_starts_on in ('monday', 'sunday')),
  constraint companies_theme_check check (theme in ('light', 'dark', 'system')),
  constraint companies_default_break_check check (default_break_minutes in (30, 45, 60)),
  constraint companies_overtime_after_hours_check check (
    overtime_after_hours >= 5 and overtime_after_hours <= 15
  ),
  constraint companies_round_time_check check (round_time_minutes in (0, 5, 15)),
  constraint companies_overtime_mode_check check (overtime_mode in ('Manual', 'Automatic')),
  constraint companies_overtime_multiplier_check check (
    overtime_multiplier >= 1.1
    and overtime_multiplier <= 2.5
    and mod((overtime_multiplier * 10)::numeric, 1) = 0
  ),
  constraint companies_currency_check check (currency in ('GBP', 'EUR', 'USD', 'RUB'))
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
  notes text
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
  payroll_minutes integer not null default 0
);

alter table public.timesheets
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists driver_id uuid references public.drivers (id) on delete cascade,
  add column if not exists vehicle_id uuid references public.vehicles (id) on delete set null,
  add column if not exists week_start date,
  add column if not exists status text default 'Draft',
  add column if not exists notes text;

alter table public.timesheet_entries
  add column if not exists timesheet_id uuid references public.timesheets (id) on delete cascade,
  add column if not exists day_date date,
  add column if not exists start_time time,
  add column if not exists break_minutes integer default 0,
  add column if not exists finish_time time,
  add column if not exists total_minutes integer default 0,
  add column if not exists overtime_minutes integer not null default 0,
  add column if not exists payroll_minutes integer not null default 0;

create index if not exists timesheets_driver_id_idx on public.timesheets (driver_id);
create index if not exists timesheets_vehicle_id_idx on public.timesheets (vehicle_id);
create index if not exists timesheets_week_start_idx on public.timesheets (week_start);
create index if not exists timesheets_status_idx on public.timesheets (status);
create unique index if not exists timesheets_driver_week_unique_idx
  on public.timesheets (driver_id, week_start);

create index if not exists timesheet_entries_timesheet_id_idx
  on public.timesheet_entries (timesheet_id);
create index if not exists timesheet_entries_day_date_idx
  on public.timesheet_entries (day_date);
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
  constraint holiday_requests_end_after_start check (end_date >= start_date),
  constraint holiday_requests_status_check check (
    status in ('Pending', 'Approved', 'Rejected', 'Cancelled')
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
  status text not null default 'Completed',
  overall_result text not null default 'Pass',
  notes text,
  constraint vehicle_checks_status_check check (
    status in ('Completed', 'Pending', 'In Progress')
  ),
  constraint vehicle_checks_overall_result_check check (
    overall_result in ('Pass', 'Advisory', 'Fail')
  )
);

create table if not exists public.vehicle_check_items (
  id uuid primary key default gen_random_uuid(),
  vehicle_check_id uuid not null references public.vehicle_checks (id) on delete cascade,
  category text not null,
  item_name text not null,
  result text not null default 'Pass',
  comment text,
  photo_url text,
  constraint vehicle_check_items_result_check check (
    result in ('Pass', 'Advisory', 'Fail')
  )
);

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

-- Vehicle check templates (type-based checklists)
create table if not exists public.vehicle_check_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  vehicle_type text not null,
  section text not null,
  item_name text not null,
  sort_order integer default 0,
  is_required boolean default true,
  is_active boolean default true
);

create index if not exists vehicle_check_templates_vehicle_type_idx
  on public.vehicle_check_templates (vehicle_type);
create index if not exists vehicle_check_templates_section_idx
  on public.vehicle_check_templates (section);
create index if not exists vehicle_check_templates_is_active_idx
  on public.vehicle_check_templates (is_active);

alter table public.vehicle_check_templates enable row level security;

grant select on public.vehicle_check_templates to anon, authenticated;

drop policy if exists vehicle_check_templates_select_global on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_select_company on public.vehicle_check_templates;
drop policy if exists "Read active vehicle check templates" on public.vehicle_check_templates;

create policy "Read active vehicle check templates"
  on public.vehicle_check_templates
  for select
  to anon, authenticated
  using (is_active = true);

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
-- Next steps
-- 1. Run policies.sql  — RLS configuration (MVP: disabled)
-- 2. Run seed.sql      — optional demo data (local/dev only)
-- -----------------------------------------------------------------------------

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

alter table public.drivers
  add column if not exists company_id uuid references public.companies (id) on delete restrict;

alter table public.drivers
  add column if not exists archived_at timestamptz;

comment on column public.drivers.archived_at is
  'Timestamp when the Worker was archived. NULL means active.';

alter table public.drivers
  add column if not exists retention_expires_at timestamptz;

comment on column public.drivers.retention_expires_at is
  'UTC deadline for minimum archived Worker profile shell retention (archived_at + 6 calendar years / 72 months). NULL when active. Does not auto-delete.';

alter table public.drivers
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

comment on column public.drivers.auth_user_id is
  'Immutable Auth user link for this Worker profile once set. Null only for legacy/unlinked rows. Rebinding to a different Auth user is forbidden.';

-- Tenant RLS for Workers (policies + column allowlists live in policies.sql
-- and migration 20260726190000). Do not FORCE RLS — Archive/Restore SECURITY DEFINER RPCs.
alter table public.drivers enable row level security;

create index if not exists drivers_default_vehicle_id_idx
  on public.drivers (default_vehicle_id);

create index if not exists drivers_company_id_idx
  on public.drivers (company_id);

create index if not exists drivers_company_id_archived_at_idx
  on public.drivers (company_id, archived_at);

create index if not exists drivers_company_id_active_idx
  on public.drivers (company_id)
  where archived_at is null;

create index if not exists drivers_auth_user_id_idx
  on public.drivers (auth_user_id)
  where auth_user_id is not null;

-- One active Worker profile per Auth user (canonical: 20260806200000_worker_identity_foundation.sql).
create unique index if not exists drivers_auth_user_id_active_unique_idx
  on public.drivers (auth_user_id)
  where auth_user_id is not null
    and archived_at is null;

-- One active Worker profile per company email (invitation foundation).
-- Canonical migration: 20260805210000_worker_invitation_foundation.sql
create unique index if not exists drivers_company_active_email_unique_idx
  on public.drivers (company_id, lower(btrim(email)))
  where archived_at is null
    and company_id is not null
    and nullif(btrim(email), '') is not null;

create or replace function public.generate_worker_code()
returns text
language plpgsql
volatile
set search_path = ''
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
set search_path = ''
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
set search_path = ''
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

alter table public.vehicles
  add column if not exists company_id uuid references public.companies (id) on delete restrict;

alter table public.vehicles
  add column if not exists trailer_number text;

comment on column public.vehicles.trailer_number is
  'Internal UK trailer identity (e.g. PVG4546). Not a registration plate. Empty strings normalised to NULL.';

create unique index if not exists vehicles_company_trailer_number_ci_uidx
  on public.vehicles (company_id, lower(trailer_number))
  where trailer_number is not null
    and company_id is not null;

alter table public.vehicles
  add column if not exists trailer_type text;

comment on column public.vehicles.trailer_type is
  'Trailer subtype (Curtainsider, Box, Reefer, Bulk, Tanker, Tipper, Flatbed, Low Loader, Other). '
  'Only set when vehicle_type = Trailer. NULL for all other vehicle types. '
  'Distinct from the powered vehicle_type option "Low Loader" — that option does '
  'not make a row a Trailer fleet asset.';

alter table public.vehicles
  drop constraint if exists vehicles_trailer_type_matches_vehicle_type;

alter table public.vehicles
  add constraint vehicles_trailer_type_matches_vehicle_type
  check (
    (
      vehicle_type is not null
      and btrim(vehicle_type) = 'Trailer'
      and trailer_type is not null
      and btrim(trailer_type) <> ''
    )
    or (
      coalesce(btrim(vehicle_type), '') is distinct from 'Trailer'
      and trailer_type is null
    )
  );

comment on constraint vehicles_trailer_type_matches_vehicle_type on public.vehicles is
  'trailer_type is required and non-empty when vehicle_type = Trailer, and must be NULL for every other vehicle_type.';

alter table public.vehicles
  add column if not exists archived_at timestamptz;

comment on column public.vehicles.archived_at is
  'Timestamp when the Vehicle was archived. NULL means active.';

alter table public.vehicles
  add column if not exists archive_reason text;

comment on column public.vehicles.archive_reason is
  'Why the Vehicle was archived (Sold, Returned to lease, Written off, Other). NULL when active. Legacy archived rows may retain NULL until re-archived via RPC.';

alter table public.vehicles
  add column if not exists retention_expires_at timestamptz;

comment on column public.vehicles.retention_expires_at is
  'UTC deadline for minimum archived Vehicle profile retention (archived_at + 6 calendar years / 72 months). Applies only to the minimal archived Vehicle profile shell. Metadata for a future reviewed retention workflow — does not cause automatic deletion. NULL when active.';

-- Tenant RLS for Vehicles (policies + column UPDATE allowlist live in policies.sql
-- and migration 20260726180000). Do not FORCE RLS — Archive/Restore SECURITY DEFINER RPCs.
alter table public.vehicles enable row level security;

create index if not exists vehicles_company_id_idx on public.vehicles (company_id);
create index if not exists vehicles_company_id_archived_at_idx
  on public.vehicles (company_id, archived_at);
create index if not exists vehicles_company_id_active_idx
  on public.vehicles (company_id)
  where archived_at is null;

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
  default_paid_holiday_hours numeric not null default 8,
  paid_breaks boolean not null default false,
  allow_medical_document_uploads boolean not null default false,
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
  overtime_calculation_method text not null default 'daily',
  overtime_multiplier numeric not null default 1.5,
  weekly_overtime_after_hours numeric not null default 45,
  currency text not null default 'GBP',
  saturday_overtime_enabled boolean not null default false,
  saturday_overtime_after_hours numeric not null default 6.0,
  saturday_overtime_multiplier numeric not null default 1.5,
  saturday_guaranteed_paid_hours numeric not null default 10.0,
  saturday_use_company_default_break boolean not null default true,
  sunday_overtime_enabled boolean not null default false,
  sunday_overtime_after_hours numeric not null default 0.0,
  sunday_overtime_multiplier numeric not null default 2.0,
  sunday_guaranteed_paid_hours numeric not null default 10.0,
  sunday_use_company_default_break boolean not null default true,
  weekend_rules_scope text not null default 'company',
  timesheet_management_scope text not null default 'worker',
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
  plan_code text,
  plan_selected_at timestamptz,
  trial_started_at timestamptz,
  subscription_status text,
  subscription_valid_until timestamptz,
  constraint companies_time_format_check check (time_format in ('24-hour', '12-hour')),
  constraint companies_plan_code_check check (
    plan_code is null
    or plan_code in ('starter', 'growing', 'pro', 'custom')
  ),
  constraint companies_subscription_status_check check (
    subscription_status is null
    or subscription_status in ('trial')
  ),
  constraint companies_date_format_check check (date_format in ('DMY', 'MDY', 'YMD')),
  constraint companies_week_starts_on_check check (week_starts_on in ('monday', 'sunday')),
  constraint companies_theme_check check (theme in ('light', 'dark', 'system')),
  constraint companies_default_break_check check (default_break_minutes in (30, 45, 60)),
  constraint companies_default_paid_holiday_hours_check check (
    default_paid_holiday_hours >= 0
    and default_paid_holiday_hours <= 24
  ),
  constraint companies_overtime_after_hours_check check (
    overtime_after_hours >= 5.5
    and overtime_after_hours <= 15.5
    and (overtime_after_hours * 2) = floor(overtime_after_hours * 2)
  ),
  constraint companies_round_time_check check (round_time_minutes in (0, 5, 15)),
  constraint companies_overtime_mode_check check (overtime_mode in ('Manual', 'Automatic')),
  constraint companies_overtime_calculation_method_check check (
    overtime_calculation_method in ('daily', 'weekly', 'none')
  ),
  constraint companies_overtime_multiplier_check check (
    overtime_multiplier >= 1.1
    and overtime_multiplier <= 2.5
    and mod((overtime_multiplier * 10)::numeric, 1) = 0
  ),
  constraint companies_weekly_overtime_after_hours_check check (
    weekly_overtime_after_hours >= 0
    and weekly_overtime_after_hours <= 168
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
  constraint companies_saturday_guaranteed_paid_hours_check check (
    saturday_guaranteed_paid_hours >= 0
  ),
  constraint companies_sunday_guaranteed_paid_hours_check check (
    sunday_guaranteed_paid_hours >= 0
  ),
  constraint companies_weekend_rules_scope_check check (
    weekend_rules_scope in ('company', 'worker')
  ),
  constraint companies_timesheet_management_scope_check check (
    timesheet_management_scope in ('office', 'worker')
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
-- Worker Timesheet settings overrides
-- Row presence = personal override. Missing row = company defaults.
-- Canonical migration: 20260722190000_create_driver_timesheet_settings.sql
-- -----------------------------------------------------------------------------

create table if not exists public.driver_timesheet_settings (
  driver_id uuid primary key references public.drivers (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  overtime_mode text null,
  overtime_calculation_method text null,
  overtime_after_hours numeric null,
  weekly_overtime_after_hours numeric null,
  overtime_multiplier numeric null,
  default_break_minutes integer null,
  paid_breaks boolean null,
  round_time_minutes integer null,
  currency text null,
  timesheet_week_start_day text null,
  saturday_overtime_enabled boolean null,
  saturday_overtime_after_hours numeric null,
  saturday_overtime_multiplier numeric null,
  saturday_guaranteed_paid_hours numeric null,
  sunday_overtime_enabled boolean null,
  sunday_overtime_after_hours numeric null,
  sunday_overtime_multiplier numeric null,
  sunday_guaranteed_paid_hours numeric null,
  saturday_use_company_default_break boolean null,
  sunday_use_company_default_break boolean null,
  default_paid_holiday_hours numeric null,
  constraint driver_timesheet_settings_overtime_mode_check
    check (overtime_mode is null or overtime_mode in ('Manual', 'Automatic')),
  constraint driver_timesheet_settings_ot_method_check
    check (
      overtime_calculation_method is null
      or overtime_calculation_method in ('daily', 'weekly', 'none')
    ),
  constraint driver_timesheet_settings_currency_check
    check (currency is null or currency in ('GBP', 'EUR', 'USD', 'RUB')),
  constraint driver_timesheet_settings_week_start_check
    check (
      timesheet_week_start_day is null
      or timesheet_week_start_day in ('monday', 'sunday')
    ),
  constraint driver_timesheet_settings_break_check
    check (
      default_break_minutes is null
      or default_break_minutes in (0, 15, 30, 45, 60)
    ),
  constraint driver_timesheet_settings_round_check
    check (
      round_time_minutes is null
      or round_time_minutes in (0, 5, 15)
    ),
  constraint driver_timesheet_settings_daily_ot_check
    check (
      overtime_after_hours is null
      or (
        overtime_after_hours >= 0
        and overtime_after_hours <= 24
      )
    ),
  constraint driver_timesheet_settings_weekly_ot_check
    check (
      weekly_overtime_after_hours is null
      or (
        weekly_overtime_after_hours >= 0
        and weekly_overtime_after_hours <= 168
      )
    ),
  constraint driver_timesheet_settings_multiplier_check
    check (
      overtime_multiplier is null
      or (
        overtime_multiplier >= 1.0
        and overtime_multiplier <= 3.0
      )
    ),
  constraint driver_timesheet_settings_holiday_hours_check
    check (
      default_paid_holiday_hours is null
      or (
        default_paid_holiday_hours >= 0
        and default_paid_holiday_hours <= 24
      )
    )
);

create index if not exists driver_timesheet_settings_company_id_idx
  on public.driver_timesheet_settings (company_id);


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
  rejected_at timestamptz,
  cleaned_at timestamptz,
  retention_expires_at timestamptz
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
  day_type text not null default 'work',
  holiday_minutes integer not null default 0,
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text,
  constraint timesheet_entries_day_type_check check (
    day_type in ('work', 'holiday', 'holiday_am', 'holiday_pm')
  ),
  constraint timesheet_entries_holiday_minutes_check check (holiday_minutes >= 0)
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
  add column if not exists rejected_at timestamptz,
  add column if not exists cleaned_at timestamptz,
  add column if not exists retention_expires_at timestamptz,
  add column if not exists worker_confirmed boolean not null default false,
  add column if not exists confirmed_by_driver_id uuid references public.drivers (id) on delete set null,
  add column if not exists confirmed_at timestamptz;

comment on column public.timesheets.retention_expires_at is
  'Final included UTC retention instant for the Timesheet parent: start of (week_start + 7 days) + 6 calendar years − 1 microsecond. Preserves the full final work-week day and the full six-year period. Metadata only; does not auto-delete.';

comment on column public.timesheets.worker_confirmed is
  'True when the Worker has confirmed the current submission. Cleared when Office returns/rejects for correction.';
comment on column public.timesheets.confirmed_by_driver_id is
  'drivers.id of the Worker who confirmed the current submission. Cleared on return/reject.';
comment on column public.timesheets.confirmed_at is
  'Timestamp of the current Worker confirmation. Cleared on return/reject; prior values live in timesheet_submission_confirmations.';

create table if not exists public.timesheet_submission_confirmations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id) on delete cascade,
  timesheet_id uuid not null references public.timesheets (id) on delete cascade,
  confirmed_by_driver_id uuid not null references public.drivers (id) on delete restrict,
  confirmed_at timestamptz not null,
  week_start date not null
);

comment on table public.timesheet_submission_confirmations is
  'Append-only audit of Worker Timesheet submission confirmations. Survives Office return/reject resets of timesheets.worker_confirmed. RLS: authenticated INSERT only (Worker own / Office company); no client SELECT/UPDATE/DELETE.';

create index if not exists timesheet_submission_confirmations_timesheet_id_idx
  on public.timesheet_submission_confirmations (timesheet_id);
create index if not exists timesheet_submission_confirmations_company_id_idx
  on public.timesheet_submission_confirmations (company_id);
create index if not exists timesheet_submission_confirmations_confirmed_at_idx
  on public.timesheet_submission_confirmations (timesheet_id, confirmed_at desc);
create index if not exists timesheets_confirmed_by_driver_id_idx
  on public.timesheets (confirmed_by_driver_id)
  where confirmed_by_driver_id is not null;
create index if not exists timesheets_confirmed_at_idx
  on public.timesheets (confirmed_at)
  where confirmed_at is not null;

alter table public.timesheet_submission_confirmations enable row level security;

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
  add column if not exists day_type text not null default 'work',
  add column if not exists holiday_minutes integer not null default 0,
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
create index if not exists idx_timesheets_cleaned_at
  on public.timesheets (cleaned_at);
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

create or replace function public.drevora_enforce_timesheet_entries_immutable_when_locked()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_timesheet_id uuid;
begin
  v_timesheet_id := coalesce(new.timesheet_id, old.timesheet_id);

  select t.status
  into v_status
  from public.timesheets t
  where t.id = v_timesheet_id
  for share;

  if v_status in ('Submitted', 'Approved') then
    raise exception 'TIMESHEET_ENTRIES_LOCKED'
      using errcode = 'P0001',
            hint = 'Submitted and Approved Timesheets are read-only. Return/reject the Timesheet before editing days.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists timesheet_entries_immutable_when_locked
  on public.timesheet_entries;

create trigger timesheet_entries_immutable_when_locked
  before insert or update or delete
  on public.timesheet_entries
  for each row
  execute function public.drevora_enforce_timesheet_entries_immutable_when_locked();

-- Timesheet retention calculator + guard (see 20260726200000).
create or replace function public.drevora_timesheet_retention_expires_at(p_week_start date)
returns timestamptz
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- Final included instant: start of week_start+7 + 6 years − 1 microsecond (UTC).
  select ((p_week_start + 7)::timestamp at time zone 'UTC')
    + interval '6 years'
    - interval '1 microsecond';
$$;

create or replace function public.drevora_timesheets_retention_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected timestamptz;
  v_week_final_included timestamptz;
begin
  if new.week_start is null then
    raise exception 'TIMESHEET_WEEK_REQUIRED'
      using errcode = 'P0001',
            hint = 'Timesheet week_start is required to calculate retention.';
  end if;

  v_expected := public.drevora_timesheet_retention_expires_at(new.week_start);
  v_week_final_included :=
    ((new.week_start + 7)::timestamp at time zone 'UTC') - interval '1 microsecond';

  -- Never trust a client-supplied retention date.
  new.retention_expires_at := v_expected;

  if new.retention_expires_at is null then
    raise exception 'TIMESHEET_RETENTION_REQUIRED'
      using errcode = 'P0001',
            hint = 'Timesheet retention_expires_at could not be calculated.';
  end if;

  if new.retention_expires_at <= v_week_final_included then
    raise exception 'TIMESHEET_RETENTION_INVALID'
      using errcode = 'P0001',
            hint = 'retention_expires_at must be after the Timesheet work-week final included instant.';
  end if;

  if new.retention_expires_at is distinct from v_expected then
    raise exception 'TIMESHEET_RETENTION_INVALID'
      using errcode = 'P0001',
            hint = 'retention_expires_at must equal the canonical final included six-year deadline.';
  end if;

  return new;
end;
$$;

drop trigger if exists timesheets_retention_guard on public.timesheets;
drop trigger if exists timesheets_retention_guard_insert on public.timesheets;
create trigger timesheets_retention_guard
  before insert or update of week_start, retention_expires_at
  on public.timesheets
  for each row
  execute function public.drevora_timesheets_retention_guard();

revoke all on function public.drevora_timesheet_retention_expires_at(date) from public;
revoke all on function public.drevora_timesheet_retention_expires_at(date) from anon;
grant execute on function public.drevora_timesheet_retention_expires_at(date) to authenticated;

revoke all on function public.drevora_timesheets_retention_guard() from public;
revoke all on function public.drevora_timesheets_retention_guard() from anon;
revoke all on function public.drevora_timesheets_retention_guard() from authenticated;


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
  start_day_portion text not null default 'full',
  end_day_portion text not null default 'full',
  retention_expires_at timestamptz,
  constraint holiday_requests_end_after_start check (end_date >= start_date),
  constraint holiday_requests_status_check check (
    status in ('Pending', 'Approved', 'Rejected', 'Cancelled')
  ),
  constraint holiday_requests_leave_type_check check (
    leave_type in ('paid_holiday', 'unpaid_leave', 'bank_holiday')
  ),
  constraint holiday_requests_start_day_portion_check check (
    start_day_portion in ('full', 'first_half', 'second_half')
  ),
  constraint holiday_requests_end_day_portion_check check (
    end_day_portion in ('full', 'first_half', 'second_half')
  )
);

alter table public.holiday_requests
  add column if not exists retention_expires_at timestamptz;

alter table public.holiday_requests
  add column if not exists start_day_portion text not null default 'full';

alter table public.holiday_requests
  add column if not exists end_day_portion text not null default 'full';

comment on column public.holiday_requests.created_at is
  'Database-authoritative create timestamp. On INSERT always set to transaction_timestamp(); immutable after INSERT for authenticated clients.';

comment on column public.holiday_requests.retention_expires_at is
  'Final retention metadata for the Holiday Request parent: created_at + 6 calendar years. Derived only from database-authoritative created_at. Does not auto-delete.';

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

-- Holiday Request created_at hardening + retention (see 20260726210000).
create or replace function public.drevora_holiday_request_retention_expires_at(
  p_created_at timestamptz
)
returns timestamptz
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_created_at + interval '6 years';
$$;

create or replace function public.drevora_holiday_requests_created_at_retention_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected timestamptz;
begin
  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    new.created_at := transaction_timestamp();
    v_expected := public.drevora_holiday_request_retention_expires_at(new.created_at);
    new.retention_expires_at := v_expected;
  elsif tg_op = 'UPDATE' then
    if new.created_at is distinct from old.created_at then
      raise exception 'HOLIDAY_CREATED_AT_IMMUTABLE'
        using errcode = 'P0001',
              hint = 'Holiday Request created_at cannot be changed after insert.';
    end if;

    new.created_at := old.created_at;
    v_expected := public.drevora_holiday_request_retention_expires_at(old.created_at);
    new.retention_expires_at := v_expected;
  end if;

  if new.created_at is null then
    raise exception 'HOLIDAY_CREATED_AT_REQUIRED'
      using errcode = 'P0001',
            hint = 'Holiday Request created_at is required.';
  end if;

  if new.retention_expires_at is null then
    raise exception 'HOLIDAY_RETENTION_REQUIRED'
      using errcode = 'P0001',
            hint = 'Holiday Request retention_expires_at is required.';
  end if;

  if new.retention_expires_at <= new.created_at then
    raise exception 'HOLIDAY_RETENTION_INVALID'
      using errcode = 'P0001',
            hint = 'retention_expires_at must be after created_at.';
  end if;

  if new.retention_expires_at is distinct from
       public.drevora_holiday_request_retention_expires_at(new.created_at) then
    raise exception 'HOLIDAY_RETENTION_INVALID'
      using errcode = 'P0001',
            hint = 'retention_expires_at must equal created_at plus six calendar years.';
  end if;

  return new;
end;
$$;

drop trigger if exists holiday_requests_created_at_retention_guard on public.holiday_requests;
create trigger holiday_requests_created_at_retention_guard
  before insert or update
  on public.holiday_requests
  for each row
  execute function public.drevora_holiday_requests_created_at_retention_guard();

revoke all on function public.drevora_holiday_request_retention_expires_at(timestamptz) from public;
revoke all on function public.drevora_holiday_request_retention_expires_at(timestamptz) from anon;
grant execute on function public.drevora_holiday_request_retention_expires_at(timestamptz) to authenticated;

revoke all on function public.drevora_holiday_requests_created_at_retention_guard() from public;
revoke all on function public.drevora_holiday_requests_created_at_retention_guard() from anon;
revoke all on function public.drevora_holiday_requests_created_at_retention_guard() from authenticated;

alter table public.holiday_requests disable row level security;
grant select, insert, update, delete on public.holiday_requests to anon, authenticated;
-- Defense-in-depth only; table GRANT may still confer effective column access.
-- Authoritative anti-spoofing: holiday_requests_created_at_retention_guard (20260726210000).
revoke insert (created_at) on table public.holiday_requests from anon;
revoke update (created_at) on table public.holiday_requests from anon;
revoke insert (retention_expires_at) on table public.holiday_requests from anon;
revoke update (retention_expires_at) on table public.holiday_requests from anon;
revoke insert (created_at) on table public.holiday_requests from authenticated;
revoke update (created_at) on table public.holiday_requests from authenticated;
revoke insert (retention_expires_at) on table public.holiday_requests from authenticated;
revoke update (retention_expires_at) on table public.holiday_requests from authenticated;

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
  defect_review_status text,
  defect_reviewed_at timestamptz,
  defect_reviewed_by uuid references auth.users (id) on delete set null,
  defect_reviewed_by_name text,
  defect_review_notes text,
  started_latitude double precision,
  started_longitude double precision,
  started_location_accuracy double precision,
  started_location_at timestamptz,
  completed_latitude double precision,
  completed_longitude double precision,
  completed_location_accuracy double precision,
  completed_location_at timestamptz,
  vehicle_registration_snapshot text,
  vehicle_fleet_number_snapshot text,
  trailer_source text not null default 'none',
  trailer_vehicle_id uuid references public.vehicles (id) on delete restrict,
  trailer_number_snapshot text,
  trailer_registration_snapshot text,
  trailer_type_snapshot text,
  trailer_label_snapshot text,
  constraint vehicle_checks_status_check check (
    status in ('Completed', 'Pending', 'In Progress')
  ),
  constraint vehicle_checks_overall_result_check check (
    overall_result in ('Pass', 'Advisory', 'Fail')
  ),
  constraint vehicle_checks_odometer_unit_check check (
    odometer_unit in ('miles', 'km')
  ),
  constraint vehicle_checks_defect_review_status_check check (
    defect_review_status is null
    or defect_review_status in (
      'awaiting_review',
      'safe_to_operate',
      'repair_required',
      'vehicle_off_road',
      'resolved'
    )
  )
);

alter table public.vehicle_checks
  add column if not exists odometer_unit text,
  add column if not exists signature_url text,
  add column if not exists signed_at timestamptz,
  add column if not exists inspection_started_at timestamptz,
  add column if not exists inspection_completed_at timestamptz,
  add column if not exists duration_seconds integer,
  add column if not exists defect_review_status text,
  add column if not exists defect_reviewed_at timestamptz,
  add column if not exists defect_reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists defect_reviewed_by_name text,
  add column if not exists defect_review_notes text,
  add column if not exists original_check_id uuid references public.vehicle_checks (id) on delete restrict,
  add column if not exists correction_reason text,
  add column if not exists correction_created_by uuid references auth.users (id) on delete set null,
  add column if not exists correction_created_at timestamptz,
  add column if not exists started_latitude double precision,
  add column if not exists started_longitude double precision,
  add column if not exists started_location_accuracy double precision,
  add column if not exists started_location_at timestamptz,
  add column if not exists completed_latitude double precision,
  add column if not exists completed_longitude double precision,
  add column if not exists completed_location_accuracy double precision,
  add column if not exists completed_location_at timestamptz,
  add column if not exists vehicle_registration_snapshot text,
  add column if not exists vehicle_fleet_number_snapshot text,
  add column if not exists trailer_source text not null default 'none',
  add column if not exists trailer_vehicle_id uuid
    references public.vehicles (id) on delete restrict,
  add column if not exists trailer_number_snapshot text,
  add column if not exists trailer_registration_snapshot text,
  add column if not exists trailer_type_snapshot text,
  add column if not exists trailer_label_snapshot text;

alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_trailer_source_check;

alter table public.vehicle_checks
  add constraint vehicle_checks_trailer_source_check
  check (trailer_source in ('none', 'company', 'third_party'));

alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_truck_trailer_distinct_check;

alter table public.vehicle_checks
  add constraint vehicle_checks_truck_trailer_distinct_check
  check (
    trailer_vehicle_id is null
    or trailer_vehicle_id <> vehicle_id
  );

alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_trailer_attachment_consistency_check;

alter table public.vehicle_checks
  add constraint vehicle_checks_trailer_attachment_consistency_check
  check (
    (
      trailer_source = 'none'
      and trailer_vehicle_id is null
      and trailer_number_snapshot is null
      and trailer_registration_snapshot is null
      and trailer_type_snapshot is null
      and trailer_label_snapshot is null
    )
    or (
      trailer_source = 'company'
      and trailer_vehicle_id is not null
      and (
        (
          trailer_number_snapshot is not null
          and btrim(trailer_number_snapshot) <> ''
        )
        or (
          trailer_label_snapshot is not null
          and btrim(trailer_label_snapshot) <> ''
        )
      )
    )
    or (
      trailer_source = 'third_party'
      and trailer_vehicle_id is null
      and (
        (
          trailer_number_snapshot is not null
          and btrim(trailer_number_snapshot) <> ''
        )
        or (
          trailer_label_snapshot is not null
          and btrim(trailer_label_snapshot) <> ''
        )
      )
    )
  );

create index if not exists vehicle_checks_trailer_vehicle_id_idx
  on public.vehicle_checks (trailer_vehicle_id)
  where trailer_vehicle_id is not null;

create index if not exists vehicle_checks_company_trailer_source_idx
  on public.vehicle_checks (company_id, trailer_source);

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

alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_defect_review_status_check;

alter table public.vehicle_checks
  add constraint vehicle_checks_defect_review_status_check check (
    defect_review_status is null
    or defect_review_status in (
      'awaiting_review',
      'safe_to_operate',
      'repair_required',
      'vehicle_off_road',
      'resolved'
    )
  );

alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_correction_reason_required;

alter table public.vehicle_checks
  add constraint vehicle_checks_correction_reason_required check (
    original_check_id is null
    or (
      correction_reason is not null
      and length(trim(correction_reason)) > 0
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
  guidance text,
  allow_notes boolean not null default true,
  allow_photo boolean not null default false,
  fail_on_defect boolean not null default true,
  asset_scope text not null default 'vehicle',
  constraint vehicle_check_items_result_check check (
    result in ('Pass', 'Advisory', 'Fail')
  ),
  constraint vehicle_check_items_asset_scope_check check (
    asset_scope in ('vehicle', 'trailer', 'combination')
  )
);

alter table public.vehicle_check_items
  add column if not exists guidance text,
  add column if not exists allow_notes boolean not null default true,
  add column if not exists allow_photo boolean not null default false,
  add column if not exists fail_on_defect boolean not null default true,
  add column if not exists asset_scope text not null default 'vehicle';

alter table public.vehicle_check_items
  drop constraint if exists vehicle_check_items_asset_scope_check;

alter table public.vehicle_check_items
  add constraint vehicle_check_items_asset_scope_check
  check (asset_scope in ('vehicle', 'trailer', 'combination'));

create index if not exists vehicle_checks_vehicle_id_idx on public.vehicle_checks (vehicle_id);
create index if not exists vehicle_checks_worker_id_idx on public.vehicle_checks (worker_id);
create index if not exists vehicle_checks_inspection_date_idx on public.vehicle_checks (inspection_date);
create index if not exists vehicle_checks_status_idx on public.vehicle_checks (status);
create index if not exists vehicle_checks_overall_result_idx on public.vehicle_checks (overall_result);
create index if not exists vehicle_checks_defect_review_status_idx on public.vehicle_checks (defect_review_status);
create index if not exists vehicle_checks_original_check_id_idx
  on public.vehicle_checks (original_check_id)
  where original_check_id is not null;
create index if not exists vehicle_check_items_check_id_idx on public.vehicle_check_items (vehicle_check_id);
create index if not exists vehicle_check_items_result_idx on public.vehicle_check_items (result);

-- Completed Vehicle Check immutability + correction workflow helpers
-- (canonical: 20260724220000_vehicle_checks_completed_immutable_and_corrections.sql)
create or replace function public.drevora_vehicle_check_is_final(
  p_status text,
  p_signed_at timestamptz
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    p_status = 'Completed'
    or p_signed_at is not null;
$$;

revoke all on function public.drevora_vehicle_check_is_final(text, timestamptz) from public;
grant execute on function public.drevora_vehicle_check_is_final(text, timestamptz) to authenticated;

create or replace function public.drevora_enforce_vehicle_check_completed_immutable()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    if public.drevora_vehicle_check_is_final(old.status, old.signed_at) then
      raise exception 'DREVORA: Completed Vehicle Checks cannot be deleted. Create a correction instead.';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and public.drevora_vehicle_check_is_final(old.status, old.signed_at) then
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.vehicle_id is distinct from old.vehicle_id
       or new.worker_id is distinct from old.worker_id
       or new.inspection_date is distinct from old.inspection_date
       or new.odometer is distinct from old.odometer
       or new.odometer_unit is distinct from old.odometer_unit
       or new.status is distinct from old.status
       or new.overall_result is distinct from old.overall_result
       or new.notes is distinct from old.notes
       or new.signature_url is distinct from old.signature_url
       or new.signed_at is distinct from old.signed_at
       or new.inspection_started_at is distinct from old.inspection_started_at
       or new.inspection_completed_at is distinct from old.inspection_completed_at
       or new.duration_seconds is distinct from old.duration_seconds
       or new.original_check_id is distinct from old.original_check_id
       or new.correction_reason is distinct from old.correction_reason
       or new.correction_created_by is distinct from old.correction_created_by
       or new.correction_created_at is distinct from old.correction_created_at
       or new.created_at is distinct from old.created_at
       or new.started_latitude is distinct from old.started_latitude
       or new.started_longitude is distinct from old.started_longitude
       or new.started_location_accuracy is distinct from old.started_location_accuracy
       or new.started_location_at is distinct from old.started_location_at
       or new.completed_latitude is distinct from old.completed_latitude
       or new.completed_longitude is distinct from old.completed_longitude
       or new.completed_location_accuracy is distinct from old.completed_location_accuracy
       or new.completed_location_at is distinct from old.completed_location_at
       or new.vehicle_registration_snapshot is distinct from old.vehicle_registration_snapshot
       or new.vehicle_fleet_number_snapshot is distinct from old.vehicle_fleet_number_snapshot
       or new.trailer_source is distinct from old.trailer_source
       or new.trailer_vehicle_id is distinct from old.trailer_vehicle_id
       or new.trailer_number_snapshot is distinct from old.trailer_number_snapshot
       or new.trailer_registration_snapshot is distinct from old.trailer_registration_snapshot
       or new.trailer_type_snapshot is distinct from old.trailer_type_snapshot
       or new.trailer_label_snapshot is distinct from old.trailer_label_snapshot then
      raise exception 'DREVORA: Completed Vehicle Checks are read-only. Create a correction to amend.';
    end if;
  end if;

  return new;
end;
$$;

-- (canonical: 20260729180000_vehicle_checks_gps_capture.sql — GPS fields;
--  20260811220000_vehicle_checks_trailer_attachment_foundation.sql — trailer
--  identity snapshots + trailer_source / trailer_vehicle_id protected above)

drop trigger if exists drevora_enforce_vehicle_check_completed_immutable
  on public.vehicle_checks;

create trigger drevora_enforce_vehicle_check_completed_immutable
  before update or delete on public.vehicle_checks
  for each row
  execute function public.drevora_enforce_vehicle_check_completed_immutable();

revoke all on function public.drevora_enforce_vehicle_check_completed_immutable() from public;
revoke all on function public.drevora_enforce_vehicle_check_completed_immutable() from anon;
revoke all on function public.drevora_enforce_vehicle_check_completed_immutable() from authenticated;

-- Trailer attachment resolve + before-write
-- (canonical: 20260811220000_vehicle_checks_trailer_attachment_foundation.sql)
create or replace function public.drevora_vehicle_check_apply_trailer_attachment(
  p_company_id uuid,
  p_vehicle_id uuid,
  p_trailer_source text,
  p_trailer_vehicle_id uuid,
  p_trailer_number_snapshot text,
  p_trailer_registration_snapshot text,
  p_trailer_type_snapshot text,
  p_trailer_label_snapshot text
)
returns table (
  trailer_source text,
  trailer_vehicle_id uuid,
  trailer_number_snapshot text,
  trailer_registration_snapshot text,
  trailer_type_snapshot text,
  trailer_label_snapshot text,
  vehicle_registration_snapshot text,
  vehicle_fleet_number_snapshot text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_source text := coalesce(nullif(btrim(p_trailer_source), ''), 'none');
  v_truck_type text;
  v_truck_registration text;
  v_truck_fleet text;
  v_trailer_type text;
  v_trailer_number text;
  v_trailer_registration text;
  v_trailer_trailer_type text;
  v_trailer_label text;
  v_in_number text := nullif(btrim(coalesce(p_trailer_number_snapshot, '')), '');
  v_in_registration text := nullif(btrim(coalesce(p_trailer_registration_snapshot, '')), '');
  v_in_type text := nullif(btrim(coalesce(p_trailer_type_snapshot, '')), '');
  v_in_label text := nullif(btrim(coalesce(p_trailer_label_snapshot, '')), '');
begin
  if p_vehicle_id is null then
    raise exception 'DREVORA: vehicle_id is required.';
  end if;

  if p_company_id is null then
    raise exception 'DREVORA: company_id is required.';
  end if;

  if v_source not in ('none', 'company', 'third_party') then
    raise exception
      'DREVORA: trailer_source must be none, company, or third_party.';
  end if;

  select
    nullif(btrim(v.vehicle_type), ''),
    nullif(btrim(v.registration), ''),
    nullif(btrim(v.fleet_number), '')
  into v_truck_type, v_truck_registration, v_truck_fleet
  from public.vehicles v
  where v.id = p_vehicle_id;

  if not found then
    raise exception 'DREVORA: vehicle_id does not reference an existing vehicle.';
  end if;

  if not public.drevora_vehicle_in_company(p_vehicle_id, p_company_id) then
    raise exception 'DREVORA: vehicle_id does not belong to company_id.';
  end if;

  if v_truck_type is not distinct from 'Trailer' then
    raise exception
      'DREVORA: vehicle_id must reference the towing (non-Trailer) vehicle.';
  end if;

  if v_source = 'none' then
    return query select
      'none'::text,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::text,
      v_truck_registration,
      v_truck_fleet;
    return;
  end if;

  if v_source = 'third_party' then
    if p_trailer_vehicle_id is not null then
      raise exception
        'DREVORA: third_party trailers must not set trailer_vehicle_id (do not create a vehicles row).';
    end if;

    if v_in_number is null and v_in_label is null then
      raise exception
        'DREVORA: third_party trailer requires trailer_number_snapshot or trailer_label_snapshot.';
    end if;

    v_trailer_label := coalesce(v_in_label, v_in_number);

    return query select
      'third_party'::text,
      null::uuid,
      v_in_number,
      v_in_registration,
      v_in_type,
      v_trailer_label,
      v_truck_registration,
      v_truck_fleet;
    return;
  end if;

  if p_trailer_vehicle_id is null then
    raise exception
      'DREVORA: company trailer_source requires trailer_vehicle_id.';
  end if;

  if p_trailer_vehicle_id = p_vehicle_id then
    raise exception 'DREVORA: Towing vehicle and trailer cannot be the same row.';
  end if;

  select
    nullif(btrim(v.vehicle_type), ''),
    nullif(btrim(v.trailer_number), ''),
    nullif(btrim(v.registration), ''),
    nullif(btrim(v.trailer_type), '')
  into
    v_trailer_type,
    v_trailer_number,
    v_trailer_registration,
    v_trailer_trailer_type
  from public.vehicles v
  where v.id = p_trailer_vehicle_id;

  if not found then
    raise exception
      'DREVORA: trailer_vehicle_id does not reference an existing vehicle.';
  end if;

  if v_trailer_type is distinct from 'Trailer' then
    raise exception
      'DREVORA: trailer_vehicle_id must reference a Trailer vehicle.';
  end if;

  if not public.drevora_vehicle_in_company(p_trailer_vehicle_id, p_company_id) then
    raise exception
      'DREVORA: trailer_vehicle_id does not belong to company_id.';
  end if;

  if v_trailer_number is null then
    raise exception
      'DREVORA: Selected company trailer has no trailer_number. Set vehicles.trailer_number before attaching it.';
  end if;

  v_trailer_label := coalesce(
    v_in_label,
    v_trailer_number,
    v_trailer_registration,
    'Trailer'
  );

  return query select
    'company'::text,
    p_trailer_vehicle_id,
    v_trailer_number,
    v_trailer_registration,
    coalesce(v_trailer_trailer_type, v_in_type),
    v_trailer_label,
    v_truck_registration,
    v_truck_fleet;
end;
$$;

revoke all on function public.drevora_vehicle_check_apply_trailer_attachment(
  uuid, uuid, text, uuid, text, text, text, text
) from public;
revoke all on function public.drevora_vehicle_check_apply_trailer_attachment(
  uuid, uuid, text, uuid, text, text, text, text
) from anon;
revoke all on function public.drevora_vehicle_check_apply_trailer_attachment(
  uuid, uuid, text, uuid, text, text, text, text
) from authenticated;

create or replace function public.drevora_vehicle_checks_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resolved record;
begin
  if tg_op = 'UPDATE'
     and public.drevora_vehicle_check_is_final(old.status, old.signed_at) then
    return new;
  end if;

  select *
  into v_resolved
  from public.drevora_vehicle_check_apply_trailer_attachment(
    new.company_id,
    new.vehicle_id,
    new.trailer_source,
    new.trailer_vehicle_id,
    new.trailer_number_snapshot,
    new.trailer_registration_snapshot,
    new.trailer_type_snapshot,
    new.trailer_label_snapshot
  );

  new.trailer_source := v_resolved.trailer_source;
  new.trailer_vehicle_id := v_resolved.trailer_vehicle_id;
  new.trailer_number_snapshot := v_resolved.trailer_number_snapshot;
  new.trailer_registration_snapshot := v_resolved.trailer_registration_snapshot;
  new.trailer_type_snapshot := v_resolved.trailer_type_snapshot;
  new.trailer_label_snapshot := v_resolved.trailer_label_snapshot;
  new.vehicle_registration_snapshot := v_resolved.vehicle_registration_snapshot;
  new.vehicle_fleet_number_snapshot := v_resolved.vehicle_fleet_number_snapshot;

  return new;
end;
$$;

drop trigger if exists vehicle_checks_before_write on public.vehicle_checks;
create trigger vehicle_checks_before_write
  before insert or update on public.vehicle_checks
  for each row
  execute function public.drevora_vehicle_checks_before_write();

revoke all on function public.drevora_vehicle_checks_before_write() from public;
revoke all on function public.drevora_vehicle_checks_before_write() from anon;
revoke all on function public.drevora_vehicle_checks_before_write() from authenticated;

create or replace function public.drevora_enforce_vehicle_check_item_completed_immutable()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_parent_id uuid;
  v_status text;
  v_signed_at timestamptz;
begin
  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_parent_id := case
    when tg_op = 'DELETE' then old.vehicle_check_id
    else new.vehicle_check_id
  end;

  select vc.status, vc.signed_at
    into v_status, v_signed_at
  from public.vehicle_checks vc
  where vc.id = v_parent_id;

  if public.drevora_vehicle_check_is_final(v_status, v_signed_at) then
    raise exception 'DREVORA: Checklist items on a completed Vehicle Check cannot be changed.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists drevora_enforce_vehicle_check_item_completed_immutable
  on public.vehicle_check_items;

create trigger drevora_enforce_vehicle_check_item_completed_immutable
  before insert or update or delete on public.vehicle_check_items
  for each row
  execute function public.drevora_enforce_vehicle_check_item_completed_immutable();

revoke all on function public.drevora_enforce_vehicle_check_item_completed_immutable() from public;
revoke all on function public.drevora_enforce_vehicle_check_item_completed_immutable() from anon;
revoke all on function public.drevora_enforce_vehicle_check_item_completed_immutable() from authenticated;

alter table public.vehicle_checks disable row level security;
alter table public.vehicle_check_items disable row level security;
grant select, insert, update, delete on public.vehicle_checks to anon, authenticated;
grant select, insert, update, delete on public.vehicle_check_items to anon, authenticated;

-- =============================================================================
-- Tyre Checks (canonical: 20260717220000_create_tyre_check_foundation.sql
--              + 20260718000000_limit_tyre_check_total_axles.sql
--              + 20260728090000_tyre_check_configurable_axle_layout.sql)
-- RLS/grants for these tables live in policies.sql (authenticated only; anon revoked).
-- Single vs Dual is a free per-axle choice (see 20260728090000); axle_type
-- remains a steer/drive/trailer label only and no longer constrains position.
-- =============================================================================

create or replace function public.drevora_tyre_wear_percent(p_depth numeric)
returns numeric
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  depths constant numeric[] := array[8.0, 7.0, 6.0, 5.0, 4.0, 3.0, 2.0, 1.6];
  wears constant numeric[] := array[0.0, 16.0, 31.0, 47.0, 62.0, 78.0, 94.0, 100.0];
  i integer;
  d_hi numeric;
  d_lo numeric;
  w_hi numeric;
  w_lo numeric;
  result numeric;
begin
  if p_depth is null then
    return null;
  end if;

  if p_depth >= 8.0 then
    return 0.00;
  end if;

  if p_depth <= 1.6 then
    return 100.00;
  end if;

  for i in 1..7 loop
    if p_depth = depths[i] then
      return round(wears[i], 2);
    end if;

    if p_depth < depths[i] and p_depth > depths[i + 1] then
      d_hi := depths[i];
      d_lo := depths[i + 1];
      w_hi := wears[i];
      w_lo := wears[i + 1];
      result := w_hi + ((d_hi - p_depth) / (d_hi - d_lo)) * (w_lo - w_hi);
      result := greatest(0.0, least(100.0, result));
      return round(result, 2);
    end if;
  end loop;

  if p_depth = depths[8] then
    return 100.00;
  end if;

  return null;
end;
$$;

create or replace function public.drevora_tyre_tread_status(p_depth numeric)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_depth is null then 'not_checked'
    when p_depth >= 6.0 then 'good'
    when p_depth >= 3.0 then 'attention'
    else 'critical'
  end;
$$;

comment on function public.drevora_tyre_wear_percent(numeric) is
  'Tyre wear % from tread depth mm using the DREVORA 8.0→1.6 reference scale with linear interpolation.';

comment on function public.drevora_tyre_tread_status(numeric) is
  'Derived tread_status only: not_checked / good (>=6.0) / attention (3.0–5.9) / critical (<3.0).';

create table if not exists public.tyre_checks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  trailer_vehicle_id uuid null references public.vehicles (id) on delete restrict,
  trailer_number_snapshot text null,
  worker_id uuid not null references public.drivers (id) on delete restrict,
  status text not null default 'draft',
  overall_result text not null default 'incomplete',
  truck_axle_count smallint not null,
  trailer_axle_count smallint null,
  inspection_started_at timestamptz null,
  inspection_completed_at timestamptz null,
  submitted_at timestamptz null,
  duration_seconds integer null,
  odometer integer null,
  odometer_unit text not null default 'miles',
  notes text null,
  signature_url text null,
  signed_at timestamptz null,
  good_count integer not null default 0,
  attention_count integer not null default 0,
  critical_count integer not null default 0,
  dirty_count integer not null default 0,
  defect_count integer not null default 0,
  not_checked_count integer not null default 0,
  pressure_unit text null,
  deleted_at timestamptz null,
  deleted_by uuid null references auth.users (id) on delete restrict,
  delete_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tyre_checks_status_check check (
    status in ('draft', 'in_progress', 'submitted')
  ),
  constraint tyre_checks_overall_result_check check (
    overall_result in ('incomplete', 'pass', 'attention', 'fail')
  ),
  constraint tyre_checks_odometer_unit_check check (
    odometer_unit in ('miles', 'km')
  ),
  constraint tyre_checks_pressure_unit_check check (
    pressure_unit is null or pressure_unit in ('bar', 'psi')
  ),
  constraint tyre_checks_delete_reason_when_deleted_check check (
    (
      deleted_at is null
      and deleted_by is null
      and delete_reason is null
    )
    or (
      deleted_at is not null
      and deleted_by is not null
      and delete_reason is not null
      and length(btrim(delete_reason)) > 0
    )
  ),
  constraint tyre_checks_truck_axle_count_check check (
    truck_axle_count between 1 and 6
  ),
  constraint tyre_checks_trailer_axle_count_check check (
    trailer_axle_count is null
    or trailer_axle_count between 1 and 6
  ),
  constraint tyre_checks_total_axle_count_max_6_chk check (
    truck_axle_count + coalesce(trailer_axle_count, 0) <= 6
  ),
  constraint tyre_checks_duration_seconds_non_negative check (
    duration_seconds is null or duration_seconds >= 0
  ),
  constraint tyre_checks_summary_counts_non_negative check (
    good_count >= 0
    and attention_count >= 0
    and critical_count >= 0
    and dirty_count >= 0
    and defect_count >= 0
    and not_checked_count >= 0
  ),
  constraint tyre_checks_trailer_consistency_check check (
    (
      trailer_vehicle_id is null
      and trailer_axle_count is null
      and trailer_number_snapshot is null
    )
    or (
      trailer_vehicle_id is not null
      and trailer_axle_count between 1 and 6
      and trailer_number_snapshot is not null
      and btrim(trailer_number_snapshot) <> ''
    )
  ),
  constraint tyre_checks_truck_trailer_distinct_check check (
    trailer_vehicle_id is null
    or trailer_vehicle_id <> vehicle_id
  )
);

comment on table public.tyre_checks is
  'Parent tyre inspection record. Truck required; trailer optional (also a vehicles row). Lifecycle: draft → in_progress → submitted.';

comment on column public.tyre_checks.trailer_number_snapshot is
  'Frozen trailer_number at check time so history stays stable if the vehicle row is edited later.';

comment on column public.tyre_checks.pressure_unit is
  'Optional whole-check tyre pressure unit: bar or psi. NULL when never chosen; empty pressures stay NULL.';

comment on column public.tyre_checks.deleted_at is
  'Office soft-delete timestamp. NULL = active in normal lists. Never hard-delete submitted checks.';

comment on column public.tyre_checks.deleted_by is
  'auth.users id of the Office user who soft-deleted the check.';

comment on column public.tyre_checks.delete_reason is
  'Mandatory Office soft-delete reason. Preserved for audit; check rows and items stay stored.';

comment on constraint tyre_checks_total_axle_count_max_6_chk on public.tyre_checks is
  'Truck + Trailer combined axle count is limited to six axles. Truck-only checks use trailer_axle_count NULL and may still have 1–6 truck axles.';

create table if not exists public.tyre_check_items (
  id uuid primary key default gen_random_uuid(),
  tyre_check_id uuid not null references public.tyre_checks (id) on delete cascade,
  unit text not null,
  axle_number smallint not null,
  axle_type text not null,
  position text not null,
  tread_depth_mm numeric(4, 1) null,
  pressure_value numeric(6, 2) null,
  wear_percent numeric(5, 2)
    generated always as (public.drevora_tyre_wear_percent(tread_depth_mm)) stored,
  tread_status text
    generated always as (public.drevora_tyre_tread_status(tread_depth_mm)) stored,
  is_dirty boolean not null default false,
  has_defect boolean not null default false,
  defect_notes text null,
  notes text null,
  photo_paths text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tyre_check_items_unit_check check (
    unit in ('vehicle', 'trailer')
  ),
  constraint tyre_check_items_axle_type_check check (
    axle_type in ('steer', 'drive', 'trailer')
  ),
  constraint tyre_check_items_position_check check (
    position in (
      'left',
      'right',
      'outer_left',
      'inner_left',
      'inner_right',
      'outer_right'
    )
  ),
  constraint tyre_check_items_unit_axle_type_check check (
    (unit = 'vehicle' and axle_type in ('steer', 'drive'))
    or (unit = 'trailer' and axle_type = 'trailer')
  ),
  constraint tyre_check_items_axle_number_check check (
    axle_number between 1 and 6
  ),
  constraint tyre_check_items_tread_depth_range_check check (
    tread_depth_mm is null
    or (
      tread_depth_mm >= 0
      and tread_depth_mm <= 30.0
    )
  ),
  constraint tyre_check_items_tread_depth_step_check check (
    tread_depth_mm is null
    or tread_depth_mm = 1.6
    or (tread_depth_mm * 2) = trunc(tread_depth_mm * 2)
  ),
  constraint tyre_check_items_pressure_value_check check (
    pressure_value is null
    or (pressure_value >= 0 and pressure_value <= 200)
  )
);

comment on table public.tyre_check_items is
  'Per-tyre measurements for a tyre_checks parent. Single/Dual is a free per-axle choice (2 or 4 recorded positions); tread_status/wear_percent are derived; Dirty/Defect are separate flags.';

comment on column public.tyre_check_items.pressure_value is
  'Optional tyre pressure for this position. NULL when not recorded (never coerced to zero). Unit is tyre_checks.pressure_unit.';

-- Idempotent: replaces the old steer=single / drive+trailer=dual coupling
-- (canonical: 20260728220000_fix_tyre_layout_rpc_and_position_constraint.sql).
-- Any axle_type may use Single {left,right} or Dual outer/inner positions.
alter table public.tyre_check_items
  drop constraint if exists tyre_check_items_axle_type_position_check;

alter table public.tyre_check_items
  add constraint tyre_check_items_axle_type_position_check check (
    position in ('left', 'right')
    or position in (
      'outer_left',
      'inner_left',
      'inner_right',
      'outer_right'
    )
  );

create unique index if not exists tyre_check_items_position_uidx
  on public.tyre_check_items (tyre_check_id, unit, axle_number, position);

create index if not exists tyre_check_items_tyre_check_id_idx
  on public.tyre_check_items (tyre_check_id);

create index if not exists tyre_checks_company_created_at_idx
  on public.tyre_checks (company_id, created_at desc);

create index if not exists tyre_checks_company_vehicle_created_at_idx
  on public.tyre_checks (company_id, vehicle_id, created_at desc);

create index if not exists tyre_checks_company_trailer_created_at_idx
  on public.tyre_checks (company_id, trailer_vehicle_id, created_at desc);

create index if not exists tyre_checks_company_worker_created_at_idx
  on public.tyre_checks (company_id, worker_id, created_at desc);

create index if not exists tyre_checks_company_status_created_at_idx
  on public.tyre_checks (company_id, status, created_at desc);

create index if not exists tyre_checks_company_active_created_at_idx
  on public.tyre_checks (company_id, created_at desc)
  where deleted_at is null;

create index if not exists tyre_checks_company_deleted_at_idx
  on public.tyre_checks (company_id, deleted_at desc)
  where deleted_at is not null;

-- Office Admin Tyre Check corrections (canonical:
-- 20260807220000_tyre_check_pressure_and_corrections.sql).
create table if not exists public.tyre_check_corrections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  tyre_check_id uuid not null references public.tyre_checks (id) on delete restrict,
  correction_reason text not null,
  corrected_by uuid not null references auth.users (id) on delete restrict,
  corrected_at timestamptz not null default now(),
  old_pressure_unit text null,
  new_pressure_unit text null,
  created_at timestamptz not null default now(),
  constraint tyre_check_corrections_reason_nonblank_check check (
    length(btrim(correction_reason)) > 0
  ),
  constraint tyre_check_corrections_old_pressure_unit_check check (
    old_pressure_unit is null or old_pressure_unit in ('bar', 'psi')
  ),
  constraint tyre_check_corrections_new_pressure_unit_check check (
    new_pressure_unit is null or new_pressure_unit in ('bar', 'psi')
  )
);

comment on table public.tyre_check_corrections is
  'Office Admin corrections for submitted Tyre Checks. Original check identity stays; measurement history is preserved in child change rows.';

create index if not exists tyre_check_corrections_check_corrected_at_idx
  on public.tyre_check_corrections (tyre_check_id, corrected_at desc);

create index if not exists tyre_check_corrections_company_corrected_at_idx
  on public.tyre_check_corrections (company_id, corrected_at desc);

create table if not exists public.tyre_check_correction_item_changes (
  id uuid primary key default gen_random_uuid(),
  correction_id uuid not null references public.tyre_check_corrections (id) on delete cascade,
  tyre_check_item_id uuid not null references public.tyre_check_items (id) on delete restrict,
  unit text not null,
  axle_number smallint not null,
  position text not null,
  old_tread_depth_mm numeric(4, 1) null,
  new_tread_depth_mm numeric(4, 1) null,
  old_pressure_value numeric(6, 2) null,
  new_pressure_value numeric(6, 2) null,
  created_at timestamptz not null default now(),
  constraint tyre_check_correction_item_changes_unit_check check (
    unit in ('vehicle', 'trailer')
  ),
  constraint tyre_check_correction_item_changes_position_check check (
    position in (
      'left',
      'right',
      'outer_left',
      'inner_left',
      'inner_right',
      'outer_right'
    )
  ),
  constraint tyre_check_correction_item_changes_must_change_check check (
    old_tread_depth_mm is distinct from new_tread_depth_mm
    or old_pressure_value is distinct from new_pressure_value
  )
);

comment on table public.tyre_check_correction_item_changes is
  'Per-position old/new tread depth and pressure for a Tyre Check correction. Original values remain auditable.';

create index if not exists tyre_check_correction_item_changes_correction_idx
  on public.tyre_check_correction_item_changes (correction_id);

-- Persisted default per-axle Single/Dual layout for one Vehicle (canonical:
-- 20260728090000_tyre_check_configurable_axle_layout.sql). Read by Worker
-- setup and Admin Configuration as the starting default only — each Tyre
-- Check keeps using its own tyre_check_items rows as the permanent
-- historical layout, so edits here never alter a completed check.
-- RLS/grants live in policies.sql. Write RPC:
-- drevora_set_vehicle_tyre_layout(uuid, text[])
-- (see 20260728090000 / 20260728220000).
create table if not exists public.vehicle_tyre_layouts (
  vehicle_id uuid primary key references public.vehicles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete restrict,
  axle_count smallint not null,
  axle_layouts text[] not null,
  updated_by_driver_id uuid null references public.drivers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_tyre_layouts_axle_count_check check (
    axle_count between 1 and 6
  ),
  constraint vehicle_tyre_layouts_axle_layouts_length_check check (
    array_length(axle_layouts, 1) = axle_count
  ),
  constraint vehicle_tyre_layouts_axle_layouts_values_check check (
    axle_layouts <@ array['single', 'dual']::text[]
  )
);

comment on table public.vehicle_tyre_layouts is
  'Persisted default per-axle Single/Dual wheel layout for one Vehicle (truck or trailer). Read as the starting default only; each Tyre Check keeps its own tyre_check_items rows as the permanent historical layout.';

create index if not exists vehicle_tyre_layouts_company_id_idx
  on public.vehicle_tyre_layouts (company_id);

drop trigger if exists vehicle_tyre_layouts_set_updated_at on public.vehicle_tyre_layouts;
create trigger vehicle_tyre_layouts_set_updated_at
  before update on public.vehicle_tyre_layouts
  for each row
  execute function public.drevora_set_updated_at();

-- Vehicle check templates (flexible company/vehicle-type checklists)
create table if not exists public.vehicle_check_templates (
  id uuid primary key default gen_random_uuid(),
  company text,
  company_id uuid references public.companies (id) on delete restrict,
  name text not null,
  vehicle_type text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vehicle_check_templates
  add column if not exists company text,
  add column if not exists company_id uuid references public.companies (id) on delete restrict,
  add column if not exists name text,
  add column if not exists vehicle_type text,
  add column if not exists description text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Compact checklist guidance / flags (canonical:
-- 20260707204100_add_vehicle_check_template_guidance.sql). Nullable guidance;
-- after normalize, Worker UI guidance text lives on
-- vehicle_check_template_items.description for header+items templates.
alter table public.vehicle_check_templates
  add column if not exists guidance text,
  add column if not exists allow_notes boolean not null default true,
  add column if not exists allow_photo boolean not null default false,
  add column if not exists fail_on_defect boolean not null default true,
  add column if not exists is_custom boolean not null default false;

comment on column public.vehicle_check_templates.guidance is
  'Optional legacy flat-row checklist guidance text. Nullable. Prefer vehicle_check_template_items.description on normalized templates.';

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
create index if not exists vehicle_check_templates_company_id_idx
  on public.vehicle_check_templates (company_id);
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
set search_path = ''
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

-- Soft-delete lifecycle (20260726120000_documents_soft_delete.sql)
alter table public.documents
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid null,
  add column if not exists delete_reason text null;

create index if not exists documents_deleted_at_idx
  on public.documents (deleted_at)
  where deleted_at is not null;

-- Worker core materialisation provenance (20260726140000_materialise_worker_core_documents.sql)
alter table public.documents
  add column if not exists source_kind text null,
  add column if not exists source_key text null,
  add column if not exists source_record_id uuid null;

create unique index if not exists documents_company_source_provenance_uidx
  on public.documents (company_id, source_kind, source_key)
  where source_kind is not null
    and source_key is not null
    and company_id is not null;

drop trigger if exists documents_set_updated_at on public.documents;

create trigger documents_set_updated_at
  before update on public.documents
  for each row
  execute function public.drevora_set_updated_at();

alter table public.documents disable row level security;
-- Hard DELETE closed for client roles (20260726130000_documents_revoke_hard_delete.sql).
-- Soft delete / restore use UPDATE of deleted_at / deleted_by / delete_reason.
-- Live tenant RLS: documents_office_delete is dropped; no replacement DELETE policy.
grant select, insert, update on public.documents to authenticated;
revoke delete on table public.documents from authenticated;
revoke delete on table public.documents from anon;
revoke delete on table public.documents from public;


-- -----------------------------------------------------------------------------
-- Worker Document Submissions (20260726150000 + 20260726160000 lifecycle)
-- Live tenant RLS enabled. Authenticated has SELECT only.
-- Create/review/edit/soft-delete/restore only via SECURITY DEFINER RPCs.
-- -----------------------------------------------------------------------------

create table if not exists public.worker_document_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  worker_id uuid not null references public.drivers (id),
  document_type text not null,
  custom_document_name text null,
  reference_number text null,
  notes text null,
  review_status text not null default 'pending_review',
  rejection_reason text null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  deleted_by uuid null,
  delete_reason text null,
  constraint worker_document_submissions_type_check check (
    document_type in (
      'CMR',
      'POD / Delivery Note',
      'Receipt',
      'Vehicle / Load Document',
      'Other'
    )
  ),
  constraint worker_document_submissions_other_name_check check (
    (document_type = 'Other' and nullif(trim(custom_document_name), '') is not null)
    or (document_type <> 'Other' and custom_document_name is null)
  ),
  constraint worker_document_submissions_status_check check (
    review_status in ('pending_review', 'reviewed', 'rejected')
  ),
  constraint worker_document_submissions_rejection_check check (
    (
      review_status = 'rejected'
      and nullif(trim(rejection_reason), '') is not null
    )
    or (
      review_status <> 'rejected'
      and rejection_reason is null
    )
  )
);

create index if not exists worker_document_submissions_company_id_idx
  on public.worker_document_submissions (company_id);
create index if not exists worker_document_submissions_worker_id_idx
  on public.worker_document_submissions (worker_id);
create index if not exists worker_document_submissions_status_idx
  on public.worker_document_submissions (company_id, review_status);
create index if not exists worker_document_submissions_submitted_at_idx
  on public.worker_document_submissions (company_id, submitted_at desc);
create index if not exists worker_document_submissions_company_id_deleted_at_idx
  on public.worker_document_submissions (company_id, deleted_at);
create index if not exists worker_document_submissions_deleted_at_idx
  on public.worker_document_submissions (deleted_at)
  where deleted_at is not null;

create table if not exists public.worker_document_submission_attachments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.worker_document_submissions (id) on delete restrict,
  file_path text not null,
  original_file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint worker_document_submission_attachments_mime_check check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  constraint worker_document_submission_attachments_size_check check (
    file_size_bytes > 0 and file_size_bytes <= 10485760
  ),
  constraint worker_document_submission_attachments_sort_check check (
    sort_order >= 1 and sort_order <= 5
  ),
  constraint worker_document_submission_attachments_sort_unique
    unique (submission_id, sort_order),
  constraint worker_document_submission_attachments_path_unique
    unique (file_path)
);

create index if not exists worker_document_submission_attachments_submission_id_idx
  on public.worker_document_submission_attachments (submission_id);

alter table public.worker_document_submissions enable row level security;
alter table public.worker_document_submission_attachments enable row level security;
revoke all on table public.worker_document_submissions from anon, public, authenticated;
revoke all on table public.worker_document_submission_attachments from anon, public, authenticated;
grant select on table public.worker_document_submissions to authenticated;
grant select on table public.worker_document_submission_attachments to authenticated;

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
  cleaned_at timestamptz,
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
create index if not exists idx_driver_reports_cleaned_at on public.driver_reports (cleaned_at);

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
  cleaned_at timestamptz,
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

create index if not exists idx_consumables_cleaned_at
  on public.consumables (cleaned_at);

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
set search_path = ''
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
  visible_to_workers boolean not null default false,
  worker_id uuid references public.drivers (id) on delete set null,
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
      'worker',
      'other'
    )
  ),
  constraint contacts_status_check check (status in ('active', 'inactive'))
);

comment on column public.contacts.visible_to_workers is
  'When true, authenticated Workers (Drivers) in the same company may SELECT this active contact. Defaults false; Admins/Office must enable explicitly. No automatic backfill.';

create index if not exists contacts_company_idx on public.contacts (company);
create index if not exists contacts_category_idx on public.contacts (category);
create index if not exists contacts_status_idx on public.contacts (status);
create index if not exists contacts_name_idx on public.contacts (name);
create index if not exists contacts_organisation_idx on public.contacts (organisation);
create index if not exists contacts_worker_id_idx on public.contacts (worker_id);
create unique index if not exists contacts_worker_id_unique_idx
  on public.contacts (worker_id)
  where worker_id is not null;
-- Partial index contacts_company_visible_to_workers_idx (company_id) is created in
-- migration 20260728230000 after company_id exists on live projects.

drop trigger if exists contacts_set_updated_at on public.contacts;

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row
  execute function public.drevora_set_updated_at();

alter table public.contacts disable row level security;
grant select, insert, update, delete on public.contacts to anon, authenticated;


-- -----------------------------------------------------------------------------
-- Admin notifications
-- Canonical: 20260718020000_create_admin_notifications.sql
-- Ensure/repair: 20260720230000_ensure_admin_notifications.sql
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  notification_type text not null,
  severity text not null,
  title text not null,
  message text,
  entity_type text,
  entity_id uuid,
  target_path text,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  constraint notifications_severity_check check (
    severity in ('info', 'warning', 'critical')
  ),
  constraint notifications_type_check check (
    notification_type in (
      'timesheet_submitted',
      'holiday_request_created',
      'vehicle_check_attention',
      'tyre_check_critical',
      'driver_report_created',
      'document_expiry'
    )
  ),
  constraint notifications_company_dedupe_unique unique (company_id, dedupe_key)
);

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists notifications_company_id_idx
  on public.notifications (company_id);
create index if not exists notifications_created_at_desc_idx
  on public.notifications (created_at desc);
create index if not exists notifications_severity_idx
  on public.notifications (severity);
create index if not exists notifications_type_idx
  on public.notifications (notification_type);
create index if not exists notifications_company_created_idx
  on public.notifications (company_id, created_at desc);
create index if not exists notification_reads_user_id_idx
  on public.notification_reads (user_id);
create index if not exists notification_reads_notification_id_idx
  on public.notification_reads (notification_id);


-- -----------------------------------------------------------------------------
-- Company subscription plan helpers (trial preparation — no Stripe)
-- Canonical definition: migrations/20260720180000_company_subscription_plan_fields.sql
-- -----------------------------------------------------------------------------

create or replace function public.drevora_protect_company_plan_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if current_setting('drevora.allow_plan_write', true) is distinct from 'on' then
      new.plan_code := old.plan_code;
      new.plan_selected_at := old.plan_selected_at;
      new.trial_started_at := old.trial_started_at;
      new.subscription_status := old.subscription_status;
      new.subscription_valid_until := old.subscription_valid_until;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists companies_protect_plan_columns on public.companies;
create trigger companies_protect_plan_columns
  before update on public.companies
  for each row
  execute function public.drevora_protect_company_plan_columns();

create or replace function public.drevora_create_company_with_trial_plan(
  p_company_name text,
  p_plan_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_name text := nullif(trim(coalesce(p_company_name, '')), '');
  v_plan_code text := lower(trim(coalesce(p_plan_code, '')));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_name is null or char_length(v_name) < 2 then
    raise exception 'Company name is required';
  end if;

  if char_length(v_name) > 120 then
    raise exception 'Company name is too long';
  end if;

  if v_plan_code not in ('starter', 'growing', 'pro') then
    raise exception 'Invalid plan code';
  end if;

  if exists (
    select 1
    from public.company_members cm
    where cm.user_id = v_user_id
      and cm.is_active = true
  ) then
    raise exception 'User already belongs to a company';
  end if;

  perform set_config('drevora.allow_plan_write', 'on', true);

  insert into public.companies (
    name,
    plan_code,
    plan_selected_at,
    trial_started_at,
    subscription_status,
    subscription_valid_until
  )
  values (
    v_name,
    v_plan_code,
    now(),
    now(),
    'trial',
    now() + interval '30 days'
  )
  returning id into v_company_id;

  insert into public.company_members (
    user_id,
    company_id,
    role,
    is_active
  )
  values (
    v_user_id,
    v_company_id,
    'Admin',
    true
  );

  return v_company_id;
end;
$$;

revoke all on function public.drevora_create_company_with_trial_plan(text, text) from public;
revoke all on function public.drevora_create_company_with_trial_plan(text, text) from anon;
grant execute on function public.drevora_create_company_with_trial_plan(text, text) to authenticated;


-- -----------------------------------------------------------------------------
-- Worker plan allowance enforcement (no Stripe)
-- Canonical definition: migrations/20260720190000_worker_plan_allowance_enforcement.sql
-- -----------------------------------------------------------------------------

create or replace function public.drevora_active_worker_limit_for_plan(p_plan_code text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case lower(trim(coalesce(p_plan_code, '')))
    when 'starter' then 20
    when 'growing' then 50
    when 'pro' then 100
    else null
  end;
$$;

create or replace function public.drevora_enforce_worker_plan_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_plan_code text;
  v_valid_until timestamptz;
  v_limit integer;
  v_active_count integer;
  v_becoming_active boolean := false;
begin
  if tg_op = 'INSERT' then
    v_becoming_active := (new.archived_at is null);
  elsif tg_op = 'UPDATE' then
    v_becoming_active :=
      (old.archived_at is not null and new.archived_at is null)
      or (
        new.archived_at is null
        and old.company_id is distinct from new.company_id
      );
  end if;

  if not v_becoming_active then
    return new;
  end if;

  v_company_id := new.company_id;
  if v_company_id is null then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Worker company_id is required for plan allowance checks.';
  end if;

  select c.plan_code, c.subscription_valid_until
  into v_plan_code, v_valid_until
  from public.companies c
  where c.id = v_company_id
  for update;

  if not found then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Company not found for Worker plan allowance check.';
  end if;

  if v_valid_until is not null and now() >= v_valid_until then
    raise exception 'SUBSCRIPTION_PLAN_EXPIRED'
      using errcode = 'P0001',
            hint = format(
              'Your trial expired on %s. Existing records remain available. Contact DREVORA to renew your plan.',
              to_char(v_valid_until at time zone 'UTC', 'DD Mon YYYY')
            );
  end if;

  v_limit := public.drevora_active_worker_limit_for_plan(v_plan_code);

  if v_limit is null then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Assign a valid starter/growing/pro plan, or configure a trusted Custom Fleet limit.';
  end if;

  select count(*)::integer
  into v_active_count
  from public.drivers d
  where d.company_id = v_company_id
    and d.archived_at is null
    and (tg_op = 'INSERT' or d.id is distinct from new.id);

  if v_active_count >= v_limit then
    raise exception 'WORKER_PLAN_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = format(
              'Active Workers %s / %s. Archive an inactive Worker or change the company plan.',
              v_active_count,
              v_limit
            );
  end if;

  return new;
end;
$$;

drop trigger if exists drivers_enforce_worker_plan_allowance on public.drivers;
create trigger drivers_enforce_worker_plan_allowance
  before insert or update of archived_at, company_id
  on public.drivers
  for each row
  execute function public.drevora_enforce_worker_plan_allowance();

-- -----------------------------------------------------------------------------
-- Worker invitation foundation (manual migration 20260805210000)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_assert_company_can_add_worker(
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_code text;
  v_valid_until timestamptz;
  v_limit integer;
  v_active_count integer;
begin
  if p_company_id is null then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Worker company_id is required for plan allowance checks.';
  end if;

  select c.plan_code, c.subscription_valid_until
  into v_plan_code, v_valid_until
  from public.companies c
  where c.id = p_company_id
  for update;

  if not found then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Company not found for Worker plan allowance check.';
  end if;

  if v_valid_until is not null and now() >= v_valid_until then
    raise exception 'SUBSCRIPTION_PLAN_EXPIRED'
      using errcode = 'P0001',
            hint = format(
              'Your trial expired on %s. Existing records remain available. Contact DREVORA to renew your plan.',
              to_char(v_valid_until at time zone 'UTC', 'DD Mon YYYY')
            );
  end if;

  v_limit := public.drevora_active_worker_limit_for_plan(v_plan_code);

  if v_limit is null then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Assign a valid starter/growing/pro plan, or configure a trusted Custom Fleet Worker limit.';
  end if;

  select count(*)::integer
  into v_active_count
  from public.drivers d
  where d.company_id = p_company_id
    and d.archived_at is null;

  if v_active_count >= v_limit then
    raise exception 'WORKER_PLAN_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = format(
              'Active Workers %s / %s. Archive an inactive Worker or change the company plan.',
              v_active_count,
              v_limit
            );
  end if;
end;
$$;

revoke all on function public.drevora_assert_company_can_add_worker(uuid) from public;
revoke all on function public.drevora_assert_company_can_add_worker(uuid) from anon;
revoke all on function public.drevora_assert_company_can_add_worker(uuid) from authenticated;
grant execute on function public.drevora_assert_company_can_add_worker(uuid) to service_role;

-- Worker identity audit events (canonical: 20260806200000_worker_identity_foundation.sql).
create table if not exists public.worker_identity_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  driver_id uuid not null references public.drivers (id) on delete restrict,
  auth_user_id uuid null references auth.users (id) on delete set null,
  actor_user_id uuid null references auth.users (id) on delete set null,
  event_type text not null,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  reason text null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint worker_identity_events_event_type_check check (
    event_type in (
      'auth_user_backfilled',
      'auth_user_linked',
      'identity_replacement_blocked',
      'login_email_changed',
      'access_email_sent'
    )
  )
);

comment on table public.worker_identity_events is
  'Append-only Worker identity audit. Client inserts/updates/deletes are forbidden; writers use security-definer helpers.';

create index if not exists worker_identity_events_company_id_created_at_idx
  on public.worker_identity_events (company_id, created_at desc);

create index if not exists worker_identity_events_driver_id_created_at_idx
  on public.worker_identity_events (driver_id, created_at desc);

create index if not exists worker_identity_events_auth_user_id_idx
  on public.worker_identity_events (auth_user_id)
  where auth_user_id is not null;

create index if not exists worker_identity_events_driver_access_email_sent_idx
  on public.worker_identity_events (driver_id, created_at desc)
  where event_type = 'access_email_sent';

create or replace function public.drevora_link_invited_worker(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_auth_user_id uuid,
  p_email text,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_first_name text := nullif(btrim(coalesce(p_profile ->> 'first_name', '')), '');
  v_last_name text := nullif(btrim(coalesce(p_profile ->> 'last_name', '')), '');
  v_role text := nullif(btrim(coalesce(p_profile ->> 'operational_role', '')), '');
  v_status text := coalesce(nullif(btrim(coalesce(p_profile ->> 'status', '')), ''), 'Off Duty');
  v_phone text := nullif(btrim(coalesce(p_profile ->> 'phone', '')), '');
  v_employment_type text := nullif(btrim(coalesce(p_profile ->> 'employment_type', '')), '');
  v_company_name text;
  v_actor_role text;
  v_membership public.company_members%rowtype;
  v_driver public.drivers%rowtype;
  v_created_membership boolean := false;
  v_reactivated_membership boolean := false;
  v_created_driver boolean := false;
  v_auth_linked boolean := false;
  v_previous_auth_user_id uuid := null;
  v_default_vehicle_id uuid := null;
  v_paid_holiday_enabled boolean := null;
  v_annual_paid_holiday_days numeric := null;
  v_bank_holiday_entitlement_days numeric := null;
  v_unpaid_leave_allowed boolean := true;
  v_holiday_entitlement_notes text := null;
  v_licence_categories text[] := null;
  v_driving_licence_expiry date := null;
  v_tacho_card_number text := null;
  v_cpc_expiry date := null;
  v_driver_card_expiry date := null;
  v_medical_expiry date := null;
  v_start_date date := null;
  v_emergency_contact_name text := null;
  v_emergency_contact_phone text := null;
  v_emergency_contact_relationship text := null;
  v_address_line_1 text := null;
  v_address_line_2 text := null;
  v_town_city text := null;
  v_county text := null;
  v_postcode text := null;
  v_country text := null;
  v_other_active integer := 0;
  v_other_driver_id uuid := null;
begin
  if p_actor_user_id is null or p_company_id is null or p_auth_user_id is null then
    raise exception 'INVITE_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'actor_user_id, company_id and auth_user_id are required.';
  end if;

  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    raise exception 'INVITE_INVALID_EMAIL'
      using errcode = 'P0001',
            hint = 'A valid Worker email is required.';
  end if;

  if v_first_name is null or v_last_name is null then
    raise exception 'INVITE_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'first_name and last_name are required.';
  end if;

  if v_role is null or v_role not in (
    'Admin',
    'Driver',
    'Yardman',
    'Cleaner',
    'Supervisor',
    'Mechanic',
    'Transport Manager',
    'Planner',
    'Office Staff',
    'Warehouse',
    'Other'
  ) then
    raise exception 'INVITE_INVALID_ROLE'
      using errcode = 'P0001',
            hint = 'operational_role must be a known Worker profile role.';
  end if;

  if v_status not in ('Working', 'Off Duty', 'Holiday', 'Suspended') then
    raise exception 'INVITE_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'status must be Working, Off Duty, Holiday, or Suspended.';
  end if;

  select cm.role
  into v_actor_role
  from public.company_members cm
  where cm.user_id = p_actor_user_id
    and cm.company_id = p_company_id
    and cm.is_active = true;

  if v_actor_role is null or v_actor_role not in (
    'Admin',
    'Manager',
    'Office',
    'Supervisor',
    'Transport Manager',
    'Planner',
    'Office Staff'
  ) then
    raise exception 'INVITE_FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only Office membership roles may invite Workers.';
  end if;

  select c.name
  into v_company_name
  from public.companies c
  where c.id = p_company_id;

  if not found then
    raise exception 'INVITE_COMPANY_NOT_FOUND'
      using errcode = 'P0001',
            hint = 'Company was not found.';
  end if;

  v_company_name := nullif(trim(v_company_name), '');

  perform pg_advisory_xact_lock(
    872014551,
    hashtext(p_auth_user_id::text)
  );

  select count(*)::integer
  into v_other_active
  from public.company_members cm
  where cm.user_id = p_auth_user_id
    and cm.is_active = true
    and cm.company_id is distinct from p_company_id;

  if v_other_active > 0 then
    raise exception 'USER_ALREADY_LINKED_TO_ANOTHER_COMPANY'
      using errcode = 'P0001',
            hint = 'This Auth user already has an active membership in another company.';
  end if;

  -- Same Auth user must not already own a different active Worker profile (any company).
  select d.id
  into v_other_driver_id
  from public.drivers d
  where d.auth_user_id = p_auth_user_id
    and d.archived_at is null
  limit 1;

  if p_profile ? 'default_vehicle_id'
     and nullif(btrim(coalesce(p_profile ->> 'default_vehicle_id', '')), '') is not null then
    begin
      v_default_vehicle_id := (p_profile ->> 'default_vehicle_id')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'INVITE_INVALID_ARGUMENT'
          using errcode = 'P0001',
                hint = 'default_vehicle_id must be a UUID.';
    end;

    if to_regprocedure('public.drevora_vehicle_in_company(uuid,uuid)') is not null
       and not public.drevora_vehicle_in_company(v_default_vehicle_id, p_company_id) then
      raise exception 'INVITE_INVALID_ARGUMENT'
        using errcode = 'P0001',
              hint = 'default_vehicle_id must belong to the same company.';
    end if;
  end if;

  if p_profile ? 'paid_holiday_enabled'
     and p_profile ->> 'paid_holiday_enabled' is not null
     and btrim(p_profile ->> 'paid_holiday_enabled') <> '' then
    v_paid_holiday_enabled := (p_profile ->> 'paid_holiday_enabled')::boolean;
  end if;

  if nullif(btrim(coalesce(p_profile ->> 'annual_paid_holiday_days', '')), '') is not null then
    v_annual_paid_holiday_days := (p_profile ->> 'annual_paid_holiday_days')::numeric;
  end if;

  if nullif(btrim(coalesce(p_profile ->> 'bank_holiday_entitlement_days', '')), '') is not null then
    v_bank_holiday_entitlement_days := (p_profile ->> 'bank_holiday_entitlement_days')::numeric;
  end if;

  if p_profile ? 'unpaid_leave_allowed'
     and p_profile ->> 'unpaid_leave_allowed' is not null
     and btrim(p_profile ->> 'unpaid_leave_allowed') <> '' then
    v_unpaid_leave_allowed := (p_profile ->> 'unpaid_leave_allowed')::boolean;
  end if;

  v_holiday_entitlement_notes := nullif(btrim(coalesce(p_profile ->> 'holiday_entitlement_notes', '')), '');
  v_tacho_card_number := nullif(btrim(coalesce(p_profile ->> 'tacho_card_number', '')), '');
  v_emergency_contact_name := nullif(btrim(coalesce(p_profile ->> 'emergency_contact_name', '')), '');
  v_emergency_contact_phone := nullif(btrim(coalesce(p_profile ->> 'emergency_contact_phone', '')), '');
  v_emergency_contact_relationship := nullif(
    btrim(coalesce(p_profile ->> 'emergency_contact_relationship', '')),
    ''
  );
  v_address_line_1 := nullif(btrim(coalesce(p_profile ->> 'address_line_1', '')), '');
  v_address_line_2 := nullif(btrim(coalesce(p_profile ->> 'address_line_2', '')), '');
  v_town_city := nullif(btrim(coalesce(p_profile ->> 'town_city', '')), '');
  v_county := nullif(btrim(coalesce(p_profile ->> 'county', '')), '');
  v_postcode := nullif(btrim(coalesce(p_profile ->> 'postcode', '')), '');
  v_country := coalesce(
    nullif(btrim(coalesce(p_profile ->> 'country', '')), ''),
    'United Kingdom'
  );

  if p_profile ? 'licence_categories' and jsonb_typeof(p_profile -> 'licence_categories') = 'array' then
    select array_agg(value)
    into v_licence_categories
    from (
      select nullif(btrim(elem), '') as value
      from jsonb_array_elements_text(p_profile -> 'licence_categories') as elem
    ) cleaned
    where value is not null;
  end if;

  if nullif(btrim(coalesce(p_profile ->> 'driving_licence_expiry', '')), '') is not null then
    v_driving_licence_expiry := (p_profile ->> 'driving_licence_expiry')::date;
  end if;
  if nullif(btrim(coalesce(p_profile ->> 'cpc_expiry', '')), '') is not null then
    v_cpc_expiry := (p_profile ->> 'cpc_expiry')::date;
  end if;
  if nullif(btrim(coalesce(p_profile ->> 'driver_card_expiry', '')), '') is not null then
    v_driver_card_expiry := (p_profile ->> 'driver_card_expiry')::date;
  end if;
  if nullif(btrim(coalesce(p_profile ->> 'medical_expiry', '')), '') is not null then
    v_medical_expiry := (p_profile ->> 'medical_expiry')::date;
  end if;
  if nullif(btrim(coalesce(p_profile ->> 'start_date', '')), '') is not null then
    v_start_date := (p_profile ->> 'start_date')::date;
  end if;

  select d.*
  into v_driver
  from public.drivers d
  where d.company_id = p_company_id
    and d.archived_at is null
    and lower(btrim(d.email)) = v_email
  limit 1;

  -- Prefer the Auth-linked active profile when email lookup misses / differs.
  if v_other_driver_id is not null then
    if v_driver.id is not null and v_driver.id is distinct from v_other_driver_id then
      raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
        using errcode = 'P0001',
              hint = 'This Auth user is already linked to a different active Worker profile. Archive and create a new Worker for a different person.';
    end if;

    if v_driver.id is null then
      select d.*
      into v_driver
      from public.drivers d
      where d.id = v_other_driver_id;
    end if;
  end if;

  if v_driver.id is not null
     and v_driver.auth_user_id is not null
     and v_driver.auth_user_id is distinct from p_auth_user_id then
    raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
      using errcode = 'P0001',
            hint = 'This Worker profile is already linked to a different Auth user. Archive and create a new Worker for a different person.';
  end if;

  select cm.*
  into v_membership
  from public.company_members cm
  where cm.user_id = p_auth_user_id
    and cm.company_id = p_company_id
  limit 1;

  if v_membership.id is not null then
    if v_membership.is_active
       and v_membership.role = 'Driver'
       and v_driver.id is not null then
      if v_driver.auth_user_id is null then
        update public.drivers
        set auth_user_id = p_auth_user_id
        where id = v_driver.id
          and auth_user_id is null
        returning * into v_driver;
        v_auth_linked := true;

        perform public.drevora_insert_worker_identity_event(
          p_company_id,
          v_driver.id,
          p_auth_user_id,
          p_actor_user_id,
          'auth_user_linked',
          jsonb_build_object('auth_user_id', null, 'email', v_driver.email),
          jsonb_build_object('auth_user_id', p_auth_user_id, 'email', v_email),
          'Idempotent invite linked existing membership/profile to Auth user.'
        );
      elsif v_driver.auth_user_id is distinct from p_auth_user_id then
        raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
          using errcode = 'P0001',
                hint = 'This Worker profile is already linked to a different Auth user. Archive and create a new Worker for a different person.';
      end if;

      return jsonb_build_object(
        'ok', true,
        'code', 'already_linked',
        'membership_id', v_membership.id,
        'driver_id', v_driver.id,
        'worker_code', v_driver.worker_code,
        'auth_user_id', v_driver.auth_user_id,
        'created_membership', false,
        'reactivated_membership', false,
        'created_driver', false,
        'auth_user_linked', v_auth_linked
      );
    end if;

    if v_membership.is_active and v_membership.role <> 'Driver' then
      raise exception 'INVITE_EMAIL_CONFLICT'
        using errcode = 'P0001',
              hint = 'This Auth user already has a non-Worker membership in this company.';
    end if;

    if not v_membership.is_active or v_membership.role <> 'Driver' then
      update public.company_members
      set
        role = 'Driver',
        is_active = true,
        updated_at = now()
      where id = v_membership.id
      returning * into v_membership;
      v_reactivated_membership := true;
    end if;
  else
    insert into public.company_members (
      user_id,
      company_id,
      role,
      is_active
    )
    values (
      p_auth_user_id,
      p_company_id,
      'Driver',
      true
    )
    returning * into v_membership;
    v_created_membership := true;
  end if;

  if v_driver.id is null then
    perform public.drevora_assert_company_can_add_worker(p_company_id);

    insert into public.drivers (
      company_id,
      company,
      email,
      first_name,
      last_name,
      phone,
      role,
      status,
      employment_type,
      paid_holiday_enabled,
      annual_paid_holiday_days,
      bank_holiday_entitlement_days,
      unpaid_leave_allowed,
      holiday_entitlement_notes,
      licence_categories,
      driving_licence_expiry,
      tacho_card_number,
      cpc_expiry,
      driver_card_expiry,
      medical_expiry,
      default_vehicle_id,
      start_date,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      address_line_1,
      address_line_2,
      town_city,
      county,
      postcode,
      country,
      archived_at,
      auth_user_id
    )
    values (
      p_company_id,
      v_company_name,
      v_email,
      v_first_name,
      v_last_name,
      v_phone,
      v_role,
      v_status,
      v_employment_type,
      v_paid_holiday_enabled,
      v_annual_paid_holiday_days,
      v_bank_holiday_entitlement_days,
      v_unpaid_leave_allowed,
      v_holiday_entitlement_notes,
      v_licence_categories,
      v_driving_licence_expiry,
      v_tacho_card_number,
      v_cpc_expiry,
      v_driver_card_expiry,
      v_medical_expiry,
      v_default_vehicle_id,
      v_start_date,
      v_emergency_contact_name,
      v_emergency_contact_phone,
      v_emergency_contact_relationship,
      v_address_line_1,
      v_address_line_2,
      v_town_city,
      v_county,
      v_postcode,
      v_country,
      null,
      p_auth_user_id
    )
    returning * into v_driver;
    v_created_driver := true;
    v_auth_linked := true;

    perform public.drevora_insert_worker_identity_event(
      p_company_id,
      v_driver.id,
      p_auth_user_id,
      p_actor_user_id,
      'auth_user_linked',
      jsonb_build_object('auth_user_id', null),
      jsonb_build_object('auth_user_id', p_auth_user_id, 'email', v_email),
      'Invitation created Worker profile with Auth user link.'
    );
  else
    v_previous_auth_user_id := v_driver.auth_user_id;

    if v_previous_auth_user_id is not null
       and v_previous_auth_user_id is distinct from p_auth_user_id then
      raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
        using errcode = 'P0001',
              hint = 'This Worker profile is already linked to a different Auth user. Archive and create a new Worker for a different person.';
    end if;

    update public.drivers
    set
      first_name = v_first_name,
      last_name = v_last_name,
      role = v_role,
      phone = coalesce(v_phone, phone),
      status = v_status,
      auth_user_id = coalesce(auth_user_id, p_auth_user_id)
    where id = v_driver.id
    returning * into v_driver;

    if v_previous_auth_user_id is null and v_driver.auth_user_id = p_auth_user_id then
      v_auth_linked := true;
      perform public.drevora_insert_worker_identity_event(
        p_company_id,
        v_driver.id,
        p_auth_user_id,
        p_actor_user_id,
        'auth_user_linked',
        jsonb_build_object('auth_user_id', null, 'email', v_driver.email),
        jsonb_build_object('auth_user_id', p_auth_user_id, 'email', v_email),
        'Invitation linked Auth user to existing Worker profile.'
      );
    end if;
  end if;

  if v_membership.is_active is distinct from true
     or v_membership.role is distinct from 'Driver'
     or v_driver.id is null
     or v_driver.archived_at is not null
     or v_driver.auth_user_id is distinct from p_auth_user_id then
    raise exception 'INVITE_PARTIAL_LINK_FAILED'
      using errcode = 'P0001',
            hint = 'Invitation link left an inconsistent membership/profile state.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', case
      when v_created_membership or v_created_driver or v_reactivated_membership then 'linked'
      else 'already_linked'
    end,
    'membership_id', v_membership.id,
    'driver_id', v_driver.id,
    'worker_code', v_driver.worker_code,
    'auth_user_id', v_driver.auth_user_id,
    'created_membership', v_created_membership,
    'reactivated_membership', v_reactivated_membership,
    'created_driver', v_created_driver,
    'auth_user_linked', v_auth_linked
  );
exception
  when unique_violation then
    if sqlerrm ilike '%drivers_auth_user_id_active_unique_idx%'
       or sqlerrm ilike '%auth_user_id%' then
      raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
        using errcode = 'P0001',
              hint = 'This Auth user is already linked to another active Worker profile.';
    end if;
    raise exception 'INVITE_DUPLICATE_WORKER'
      using errcode = 'P0001',
            hint = 'An active Worker with this email already exists in the company.';
end;
$$;

comment on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) is
  'Service-role: atomically ensure Driver company_members + active drivers row with drivers.auth_user_id set. Rejects Auth rebinding (WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED).';

revoke all on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) from public;
revoke all on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) from anon;
revoke all on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) from authenticated;
grant execute on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) to service_role;

-- Worker identity foundation helpers (canonical: 20260806200000).
create or replace function public.drevora_auth_user_driver_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_id uuid := null;
begin
  if auth.uid() is null then
    return null;
  end if;

  -- Prefer immutable Auth link (exact-one active linked profile in membership company).
  -- UUID-safe exact-one pick: count(*) + (array_agg(... order by ...))[1]. Never min(uuid).
  select
    count(*)::integer,
    (array_agg(d.id order by d.id))[1]
  into v_count, v_id
  from public.drivers d
  where d.auth_user_id = auth.uid()
    and d.company_id is not null
    and d.archived_at is null
    and public.drevora_auth_user_belongs_to_company_id(d.company_id);

  if v_count = 1 then
    return v_id;
  end if;

  if v_count > 1 then
    -- Ambiguous Auth link — do not silently choose a Worker.
    return null;
  end if;

  -- Transitional email fallback only for rows not yet linked (auth_user_id is null).
  select
    count(*)::integer,
    (array_agg(d.id order by d.id))[1]
  into v_count, v_id
  from public.drivers d
  inner join auth.users u on u.id = auth.uid()
  where d.auth_user_id is null
    and lower(trim(coalesce(d.email, ''))) = lower(trim(coalesce(u.email, '')))
    and d.company_id is not null
    and d.archived_at is null
    and coalesce(trim(d.email), '') <> ''
    and public.drevora_auth_user_belongs_to_company_id(d.company_id);

  if v_count = 1 then
    return v_id;
  end if;

  -- Zero or multiple email matches — safe null (no silent pick).
  return null;
end;
$$;

comment on function public.drevora_auth_user_driver_id() is
  'Returns active Worker drivers.id. Prefers drivers.auth_user_id = auth.uid(); email match is temporary fallback only when auth_user_id is null. Exact-one match required (UUID-safe array_agg). Archived Workers resolve to NULL.';

revoke all on function public.drevora_auth_user_driver_id() from public;
revoke all on function public.drevora_auth_user_driver_id() from anon;
grant execute on function public.drevora_auth_user_driver_id() to authenticated;
grant execute on function public.drevora_auth_user_driver_id() to service_role;

create or replace function public.drevora_drivers_auth_user_id_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.auth_user_id is not null
     and new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
      using errcode = 'P0001',
            hint = 'This Worker profile is already linked to an Auth user. Archive and create a new Worker for a different person.';
  end if;

  return new;
end;
$$;

comment on function public.drevora_drivers_auth_user_id_guard() is
  'BEFORE UPDATE: reject rebinding drivers.auth_user_id to a different Auth user.';

drop trigger if exists drivers_auth_user_id_guard on public.drivers;
create trigger drivers_auth_user_id_guard
  before update of auth_user_id
  on public.drivers
  for each row
  execute function public.drevora_drivers_auth_user_id_guard();

-- Linked Worker login email changes (canonical: 20260806220000_worker_login_email_change.sql).
create or replace function public.drevora_drivers_login_email_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_allow text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if lower(btrim(coalesce(new.email, ''))) = lower(btrim(coalesce(old.email, ''))) then
    return new;
  end if;

  if old.auth_user_id is null then
    return new;
  end if;

  v_allow := nullif(
    current_setting('drevora.allow_worker_login_email_change', true),
    ''
  );

  if v_allow is not distinct from 'on' then
    return new;
  end if;

  raise exception 'WORKER_LOGIN_EMAIL_CHANGE_REQUIRED'
    using errcode = 'P0001',
          hint = 'Login email for a linked Worker must be changed via the secure change-worker-login-email backend.';
end;
$$;

comment on function public.drevora_drivers_login_email_guard() is
  'BEFORE UPDATE OF email: linked Workers (auth_user_id set) cannot change email unless drevora.allow_worker_login_email_change=on for this transaction.';

drop trigger if exists drivers_login_email_guard on public.drivers;
create trigger drivers_login_email_guard
  before update of email
  on public.drivers
  for each row
  execute function public.drevora_drivers_login_email_guard();

create or replace function public.drevora_finalize_worker_login_email_change(
  p_actor_user_id uuid,
  p_driver_id uuid,
  p_expected_auth_user_id uuid,
  p_old_email text,
  p_new_email text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_email text := lower(btrim(coalesce(p_old_email, '')));
  v_new_email text := lower(btrim(coalesce(p_new_email, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_actor_role text;
  v_driver public.drivers%rowtype;
  v_other_count integer := 0;
  v_event_id uuid;
begin
  if p_actor_user_id is null or p_driver_id is null or p_expected_auth_user_id is null then
    raise exception 'LOGIN_EMAIL_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'actor_user_id, driver_id and expected_auth_user_id are required.';
  end if;

  if v_old_email = '' or position('@' in v_old_email) = 0
     or v_new_email = '' or position('@' in v_new_email) = 0 then
    raise exception 'INVALID_EMAIL'
      using errcode = 'P0001',
            hint = 'A valid old and new login email are required.';
  end if;

  if v_reason is null then
    raise exception 'LOGIN_EMAIL_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'A non-empty reason is required.';
  end if;

  select d.*
  into v_driver
  from public.drivers d
  where d.id = p_driver_id
  for update;

  if not found then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker was not found.';
  end if;

  if v_driver.company_id is null then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker has no company.';
  end if;

  select cm.role
  into v_actor_role
  from public.company_members cm
  where cm.user_id = p_actor_user_id
    and cm.company_id = v_driver.company_id
    and cm.is_active = true;

  if v_actor_role is null or v_actor_role not in (
    'Admin',
    'Manager',
    'Office',
    'Supervisor',
    'Transport Manager',
    'Planner',
    'Office Staff'
  ) then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only Office membership roles may change Worker login email.';
  end if;

  if v_driver.archived_at is not null then
    raise exception 'WORKER_ARCHIVED'
      using errcode = 'P0001',
            hint = 'Archived Workers cannot change login email.';
  end if;

  if v_driver.auth_user_id is null then
    raise exception 'WORKER_AUTH_NOT_LINKED'
      using errcode = 'P0001',
            hint = 'Worker has no immutable Auth link.';
  end if;

  if v_driver.auth_user_id is distinct from p_expected_auth_user_id then
    raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
      using errcode = 'P0001',
            hint = 'Auth user id does not match the linked Worker profile.';
  end if;

  if lower(btrim(coalesce(v_driver.email, ''))) = v_new_email then
    return jsonb_build_object(
      'ok', true,
      'code', 'already_same_email',
      'driver_id', v_driver.id,
      'auth_user_id', v_driver.auth_user_id,
      'email', v_new_email,
      'changed', false
    );
  end if;

  if lower(btrim(coalesce(v_driver.email, ''))) is distinct from v_old_email then
    raise exception 'LOGIN_EMAIL_STATE_MISMATCH'
      using errcode = 'P0001',
            hint = 'Worker profile email no longer matches the Auth email snapshot.';
  end if;

  select count(*)::integer
  into v_other_count
  from public.drivers d
  where d.company_id = v_driver.company_id
    and d.archived_at is null
    and d.id is distinct from v_driver.id
    and lower(btrim(d.email)) = v_new_email;

  if v_other_count > 0 then
    raise exception 'EMAIL_ALREADY_IN_USE'
      using errcode = 'P0001',
            hint = 'An active Worker already uses this email in the company.';
  end if;

  perform set_config('drevora.allow_worker_login_email_change', 'on', true);

  update public.drivers d
  set email = v_new_email
  where d.id = v_driver.id
    and d.auth_user_id = p_expected_auth_user_id
    and d.archived_at is null
  returning * into v_driver;

  if not found then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker could not be updated.';
  end if;

  if v_driver.auth_user_id is distinct from p_expected_auth_user_id then
    raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
      using errcode = 'P0001',
            hint = 'Auth user id must remain unchanged.';
  end if;

  v_event_id := public.drevora_insert_worker_identity_event(
    v_driver.company_id,
    v_driver.id,
    v_driver.auth_user_id,
    p_actor_user_id,
    'login_email_changed',
    jsonb_build_object(
      'email', v_old_email,
      'auth_user_id', p_expected_auth_user_id
    ),
    jsonb_build_object(
      'email', v_new_email,
      'auth_user_id', p_expected_auth_user_id
    ),
    v_reason
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'login_email_changed',
    'driver_id', v_driver.id,
    'auth_user_id', v_driver.auth_user_id,
    'email', v_new_email,
    'old_email', v_old_email,
    'event_id', v_event_id,
    'changed', true
  );
exception
  when unique_violation then
    raise exception 'EMAIL_ALREADY_IN_USE'
      using errcode = 'P0001',
            hint = 'An active Worker already uses this email in the company.';
end;
$$;

comment on function public.drevora_finalize_worker_login_email_change(uuid, uuid, uuid, text, text, text) is
  'Service-role: atomically update drivers.email for a linked Worker and write login_email_changed audit. Does not touch Auth. Never rebinds auth_user_id.';

revoke all on function public.drevora_finalize_worker_login_email_change(uuid, uuid, uuid, text, text, text) from public;
revoke all on function public.drevora_finalize_worker_login_email_change(uuid, uuid, uuid, text, text, text) from anon;
revoke all on function public.drevora_finalize_worker_login_email_change(uuid, uuid, uuid, text, text, text) from authenticated;
grant execute on function public.drevora_finalize_worker_login_email_change(uuid, uuid, uuid, text, text, text) to service_role;

create or replace function public.drevora_insert_worker_identity_event(
  p_company_id uuid,
  p_driver_id uuid,
  p_auth_user_id uuid,
  p_actor_user_id uuid,
  p_event_type text,
  p_old_values jsonb default '{}'::jsonb,
  p_new_values jsonb default '{}'::jsonb,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_company_id is null or p_driver_id is null or nullif(btrim(coalesce(p_event_type, '')), '') is null then
    raise exception 'WORKER_IDENTITY_EVENT_INVALID'
      using errcode = 'P0001',
            hint = 'company_id, driver_id and event_type are required.';
  end if;

  insert into public.worker_identity_events (
    company_id,
    driver_id,
    auth_user_id,
    actor_user_id,
    event_type,
    old_values,
    new_values,
    reason
  )
  values (
    p_company_id,
    p_driver_id,
    p_auth_user_id,
    p_actor_user_id,
    btrim(p_event_type),
    coalesce(p_old_values, '{}'::jsonb),
    coalesce(p_new_values, '{}'::jsonb),
    nullif(btrim(coalesce(p_reason, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.drevora_insert_worker_identity_event(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text) is
  'Security-definer append-only writer for worker_identity_events. Not granted to authenticated.';

revoke all on function public.drevora_insert_worker_identity_event(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text) from public;
revoke all on function public.drevora_insert_worker_identity_event(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text) from anon;
revoke all on function public.drevora_insert_worker_identity_event(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text) from authenticated;
grant execute on function public.drevora_insert_worker_identity_event(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text) to service_role;

-- Office-safe Worker identity history list (canonical: 20260806230000_worker_identity_events_list_rpc.sql).
create or replace function public.drevora_list_worker_identity_events(
  p_driver_id uuid
)
returns table (
  id uuid,
  event_type text,
  created_at timestamptz,
  reason text,
  actor_label text,
  old_email text,
  new_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  if p_driver_id is null then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = '22023',
            hint = 'Worker id is required.';
  end if;

  select d.company_id
  into v_company_id
  from public.drivers d
  where d.id = p_driver_id;

  if not found or v_company_id is null then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker not found.';
  end if;

  if not exists (
    select 1
    from public.company_members cm
    where cm.user_id = auth.uid()
      and cm.company_id = v_company_id
      and cm.is_active is true
  ) then
    raise exception 'FORBIDDEN'
      using errcode = '42501',
            hint = 'Active company membership is required.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    raise exception 'FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  return query
  select
    e.id,
    e.event_type,
    e.created_at,
    e.reason,
    nullif(
      btrim(
        coalesce(
          nullif(
            btrim(
              concat_ws(
                ' ',
                nullif(btrim(coalesce(actor_driver.first_name, '')), ''),
                nullif(btrim(coalesce(actor_driver.last_name, '')), '')
              )
            ),
            ''
          ),
          nullif(btrim(coalesce(actor_auth.email::text, '')), '')
        )
      ),
      ''
    ) as actor_label,
    case
      when coalesce(e.old_values->>'email', '') ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
        then lower(btrim(e.old_values->>'email'))
      else null
    end as old_email,
    case
      when coalesce(e.new_values->>'email', '') ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
        then lower(btrim(e.new_values->>'email'))
      else null
    end as new_email
  from public.worker_identity_events e
  left join lateral (
    select d.first_name, d.last_name
    from public.drivers d
    where d.company_id = v_company_id
      and e.actor_user_id is not null
      and d.auth_user_id = e.actor_user_id
    order by d.archived_at nulls first, d.id
    limit 1
  ) actor_driver on true
  left join auth.users actor_auth
    on actor_auth.id = e.actor_user_id
  where e.driver_id = p_driver_id
    and e.company_id = v_company_id
  order by e.created_at desc, e.id desc;
end;
$$;

comment on function public.drevora_list_worker_identity_events(uuid) is
  'Office-only: list safe Worker identity/access events for one Worker in the caller company. Never trusts browser companyId. Never returns auth IDs, raw JSON, or tokens.';

revoke all on function public.drevora_list_worker_identity_events(uuid) from public;
revoke all on function public.drevora_list_worker_identity_events(uuid) from anon;
grant execute on function public.drevora_list_worker_identity_events(uuid) to authenticated;
grant execute on function public.drevora_list_worker_identity_events(uuid) to service_role;

-- Worker access email dispatch reservations (canonical: 20260806240000_worker_access_email.sql).
-- -----------------------------------------------------------------------------
-- 2) Private dispatch reservation table (no browser access)
-- -----------------------------------------------------------------------------
create table if not exists public.worker_access_email_dispatches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  driver_id uuid not null references public.drivers (id) on delete restrict,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  status text not null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null,
  failure_code text null,
  constraint worker_access_email_dispatches_status_check check (
    status in ('pending', 'sent', 'failed', 'expired')
  ),
  constraint worker_access_email_dispatches_completed_check check (
    (status = 'pending' and completed_at is null)
    or (status <> 'pending' and completed_at is not null)
  )
);

comment on table public.worker_access_email_dispatches is
  'Private access-email send reservations. No browser SELECT/INSERT/UPDATE/DELETE. Writers are service-role SECURITY DEFINER RPCs only. Explicit deny policy for anon/authenticated.';

create index if not exists worker_access_email_dispatches_driver_created_at_idx
  on public.worker_access_email_dispatches (driver_id, created_at desc);

create index if not exists worker_access_email_dispatches_driver_sent_completed_idx
  on public.worker_access_email_dispatches (driver_id, completed_at desc)
  where status = 'sent';

-- At most one live pending reservation per Worker (stale rows are expired first).
create unique index if not exists worker_access_email_dispatches_one_pending_per_driver_idx
  on public.worker_access_email_dispatches (driver_id)
  where status = 'pending';

alter table public.worker_access_email_dispatches enable row level security;

revoke all on table public.worker_access_email_dispatches from public;
revoke all on table public.worker_access_email_dispatches from anon;
revoke all on table public.worker_access_email_dispatches from authenticated;
grant all on table public.worker_access_email_dispatches to service_role;

drop policy if exists worker_access_email_dispatches_deny_client_access
  on public.worker_access_email_dispatches;

create policy worker_access_email_dispatches_deny_client_access
  on public.worker_access_email_dispatches
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Drop superseded assert/record helpers if a prior draft of this migration existed.
drop function if exists public.drevora_assert_worker_access_email_allowed(uuid, uuid, integer);
drop function if exists public.drevora_record_worker_access_email_sent(uuid, uuid, uuid, text, text);

-- -----------------------------------------------------------------------------
-- 3) Begin: atomic reservation (service_role)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_begin_worker_access_email_send(
  p_actor_user_id uuid,
  p_driver_id uuid,
  p_expected_auth_user_id uuid,
  p_cooldown_seconds integer default 900,
  p_pending_ttl_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.drivers%rowtype;
  v_actor_role text;
  v_cooldown integer := greatest(coalesce(p_cooldown_seconds, 900), 60);
  v_pending_ttl integer := greatest(coalesce(p_pending_ttl_seconds, 300), 60);
  v_last_sent_at timestamptz;
  v_retry_after integer;
  v_pending_count integer := 0;
  v_dispatch_id uuid;
  v_now timestamptz := timezone('utc', now());
begin
  if p_actor_user_id is null or p_driver_id is null or p_expected_auth_user_id is null then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0001',
            hint = 'actor_user_id, driver_id and expected_auth_user_id are required.';
  end if;

  -- Serialize concurrent begin attempts for the same Worker.
  perform pg_advisory_xact_lock(
    8742001,
    hashtext(p_driver_id::text)
  );

  select d.*
  into v_driver
  from public.drivers d
  where d.id = p_driver_id
  for update;

  if not found then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker was not found.';
  end if;

  if v_driver.company_id is null then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker has no company.';
  end if;

  select cm.role
  into v_actor_role
  from public.company_members cm
  where cm.user_id = p_actor_user_id
    and cm.company_id = v_driver.company_id
    and cm.is_active = true;

  if v_actor_role is null or v_actor_role not in (
    'Admin',
    'Manager',
    'Office',
    'Supervisor',
    'Transport Manager',
    'Planner',
    'Office Staff'
  ) then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only Office membership roles may send Worker access email.';
  end if;

  if v_driver.archived_at is not null then
    raise exception 'WORKER_ARCHIVED'
      using errcode = 'P0001',
            hint = 'Archived Workers cannot receive access email.';
  end if;

  if v_driver.auth_user_id is null then
    raise exception 'WORKER_AUTH_NOT_LINKED'
      using errcode = 'P0001',
            hint = 'Worker has no immutable Auth link.';
  end if;

  if v_driver.auth_user_id is distinct from p_expected_auth_user_id then
    raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
      using errcode = 'P0001',
            hint = 'Auth user id does not match the linked Worker profile.';
  end if;

  -- Expire stale pending reservations (>5 minutes by default).
  update public.worker_access_email_dispatches d
  set
    status = 'expired',
    completed_at = v_now,
    failure_code = coalesce(d.failure_code, 'pending_expired')
  where d.driver_id = v_driver.id
    and d.status = 'pending'
    and d.created_at <= v_now - make_interval(secs => v_pending_ttl);

  select count(*)::integer
  into v_pending_count
  from public.worker_access_email_dispatches d
  where d.driver_id = v_driver.id
    and d.status = 'pending';

  if v_pending_count > 0 then
    raise exception 'ACCESS_EMAIL_RATE_LIMITED'
      using errcode = 'P0001',
            hint = 'An access email send is already in progress for this Worker.';
  end if;

  -- Cooldown from successful sends only (failed/expired do not count).
  select d.completed_at
  into v_last_sent_at
  from public.worker_access_email_dispatches d
  where d.driver_id = v_driver.id
    and d.status = 'sent'
    and d.completed_at is not null
  order by d.completed_at desc, d.id desc
  limit 1;

  if v_last_sent_at is not null
     and v_last_sent_at > v_now - make_interval(secs => v_cooldown)
  then
    v_retry_after := greatest(
      1,
      ceil(
        extract(
          epoch from (
            (v_last_sent_at + make_interval(secs => v_cooldown)) - v_now
          )
        )
      )::integer
    );
    raise exception 'ACCESS_EMAIL_RATE_LIMITED'
      using errcode = 'P0001',
            hint = format('Retry after %s seconds.', v_retry_after);
  end if;

  insert into public.worker_access_email_dispatches (
    company_id,
    driver_id,
    actor_user_id,
    status
  )
  values (
    v_driver.company_id,
    v_driver.id,
    p_actor_user_id,
    'pending'
  )
  returning id into v_dispatch_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'access_email_dispatch_pending',
    'dispatch_id', v_dispatch_id,
    'driver_id', v_driver.id,
    'company_id', v_driver.company_id,
    'auth_user_id', v_driver.auth_user_id,
    'profile_email', lower(btrim(coalesce(v_driver.email, ''))),
    'cooldown_seconds', v_cooldown,
    'pending_ttl_seconds', v_pending_ttl
  );
end;
$$;

comment on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) is
  'Service-role: atomically reserve a pending Worker access-email dispatch under an advisory lock. Enforces Office scope, Auth link, pending TTL and 900s success cooldown.';

revoke all on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) from public;
revoke all on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) from anon;
revoke all on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) from authenticated;
grant execute on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) to service_role;

-- -----------------------------------------------------------------------------
-- 4) Finalize: pending → sent + one access_email_sent audit
-- -----------------------------------------------------------------------------
create or replace function public.drevora_finalize_worker_access_email_send(
  p_actor_user_id uuid,
  p_dispatch_id uuid,
  p_expected_auth_user_id uuid,
  p_email text,
  p_reason text default 'office_send_account_access_email'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispatch public.worker_access_email_dispatches%rowtype;
  v_driver public.drivers%rowtype;
  v_actor_role text;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_event_id uuid;
  v_now timestamptz := timezone('utc', now());
begin
  if p_actor_user_id is null or p_dispatch_id is null or p_expected_auth_user_id is null then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0001',
            hint = 'actor_user_id, dispatch_id and expected_auth_user_id are required.';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'INVALID_EMAIL'
      using errcode = 'P0001',
            hint = 'A valid email is required for the audit record.';
  end if;

  if v_reason is null then
    v_reason := 'office_send_account_access_email';
  end if;

  select d.*
  into v_dispatch
  from public.worker_access_email_dispatches d
  where d.id = p_dispatch_id
  for update;

  if not found then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Access email dispatch was not found.';
  end if;

  perform pg_advisory_xact_lock(
    8742001,
    hashtext(v_dispatch.driver_id::text)
  );

  -- Idempotent duplicate finalize: already sent for this dispatch.
  if v_dispatch.status = 'sent' then
    if v_dispatch.actor_user_id is distinct from p_actor_user_id then
      raise exception 'FORBIDDEN'
        using errcode = 'P0001',
              hint = 'Dispatch actor mismatch.';
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'access_email_already_finalized',
      'dispatch_id', v_dispatch.id,
      'driver_id', v_dispatch.driver_id,
      'auth_user_id', p_expected_auth_user_id,
      'email', v_email,
      'event_id', null,
      'duplicate', true
    );
  end if;

  if v_dispatch.status <> 'pending' then
    raise exception 'ACCESS_EMAIL_RATE_LIMITED'
      using errcode = 'P0001',
            hint = format('Dispatch is %s and cannot be finalized.', v_dispatch.status);
  end if;

  if v_dispatch.actor_user_id is distinct from p_actor_user_id then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only the reserving Office actor may finalize this dispatch.';
  end if;

  select d.*
  into v_driver
  from public.drivers d
  where d.id = v_dispatch.driver_id
  for update;

  if not found or v_driver.company_id is distinct from v_dispatch.company_id then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker was not found for this dispatch.';
  end if;

  select cm.role
  into v_actor_role
  from public.company_members cm
  where cm.user_id = p_actor_user_id
    and cm.company_id = v_driver.company_id
    and cm.is_active = true;

  if v_actor_role is null or v_actor_role not in (
    'Admin',
    'Manager',
    'Office',
    'Supervisor',
    'Transport Manager',
    'Planner',
    'Office Staff'
  ) then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only Office membership roles may finalize access email sends.';
  end if;

  if v_driver.archived_at is not null then
    raise exception 'WORKER_ARCHIVED'
      using errcode = 'P0001',
            hint = 'Archived Workers cannot receive access email.';
  end if;

  if v_driver.auth_user_id is null then
    raise exception 'WORKER_AUTH_NOT_LINKED'
      using errcode = 'P0001',
            hint = 'Worker has no immutable Auth link.';
  end if;

  if v_driver.auth_user_id is distinct from p_expected_auth_user_id then
    raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
      using errcode = 'P0001',
            hint = 'Auth user id does not match the linked Worker profile.';
  end if;

  if lower(btrim(coalesce(v_driver.email, ''))) is distinct from v_email then
    raise exception 'WORKER_LOGIN_EMAIL_OUT_OF_SYNC'
      using errcode = 'P0001',
            hint = 'Worker profile email no longer matches the access email.';
  end if;

  update public.worker_access_email_dispatches d
  set
    status = 'sent',
    completed_at = v_now,
    failure_code = null
  where d.id = v_dispatch.id
    and d.status = 'pending';

  if not found then
    raise exception 'ACCESS_EMAIL_RATE_LIMITED'
      using errcode = 'P0001',
            hint = 'Dispatch was no longer pending.';
  end if;

  v_event_id := public.drevora_insert_worker_identity_event(
    v_driver.company_id,
    v_driver.id,
    v_driver.auth_user_id,
    p_actor_user_id,
    'access_email_sent',
    jsonb_build_object(
      'email', v_email
    ),
    jsonb_build_object(
      'email', v_email,
      'source', 'send_worker_access_email',
      'redirect', 'https://app.drevora.app/reset-password',
      'dispatch_id', v_dispatch.id
    ),
    v_reason
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'access_email_sent',
    'dispatch_id', v_dispatch.id,
    'driver_id', v_driver.id,
    'auth_user_id', v_driver.auth_user_id,
    'email', v_email,
    'event_id', v_event_id,
    'duplicate', false
  );
end;
$$;

comment on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) is
  'Service-role: mark a pending access-email dispatch as sent and write exactly one access_email_sent audit. Duplicate finalize is idempotent.';

revoke all on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) from public;
revoke all on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) from anon;
revoke all on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) from authenticated;
grant execute on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- 5) Fail: pending → failed (no success audit / no cooldown)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_fail_worker_access_email_send(
  p_actor_user_id uuid,
  p_dispatch_id uuid,
  p_failure_code text default 'server_failure'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispatch public.worker_access_email_dispatches%rowtype;
  v_code text := lower(btrim(coalesce(nullif(btrim(coalesce(p_failure_code, '')), ''), 'server_failure')));
  v_now timestamptz := timezone('utc', now());
begin
  if p_actor_user_id is null or p_dispatch_id is null then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0001',
            hint = 'actor_user_id and dispatch_id are required.';
  end if;

  -- Keep failure codes short and non-sensitive.
  if length(v_code) > 64
     or v_code ~ '[^a-z0-9_]'
     or v_code ~ '(sql|stack|service_role|jwt|password|secret)'
  then
    v_code := 'server_failure';
  end if;

  select d.*
  into v_dispatch
  from public.worker_access_email_dispatches d
  where d.id = p_dispatch_id
  for update;

  if not found then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Access email dispatch was not found.';
  end if;

  perform pg_advisory_xact_lock(
    8742001,
    hashtext(v_dispatch.driver_id::text)
  );

  if v_dispatch.status = 'failed' then
    return jsonb_build_object(
      'ok', true,
      'code', 'access_email_already_failed',
      'dispatch_id', v_dispatch.id,
      'driver_id', v_dispatch.driver_id,
      'failure_code', v_dispatch.failure_code,
      'duplicate', true
    );
  end if;

  if v_dispatch.status <> 'pending' then
    raise exception 'ACCESS_EMAIL_RATE_LIMITED'
      using errcode = 'P0001',
            hint = format('Dispatch is %s and cannot be failed.', v_dispatch.status);
  end if;

  if v_dispatch.actor_user_id is distinct from p_actor_user_id then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only the reserving Office actor may fail this dispatch.';
  end if;

  update public.worker_access_email_dispatches d
  set
    status = 'failed',
    completed_at = v_now,
    failure_code = v_code
  where d.id = v_dispatch.id
    and d.status = 'pending';

  if not found then
    raise exception 'ACCESS_EMAIL_RATE_LIMITED'
      using errcode = 'P0001',
            hint = 'Dispatch was no longer pending.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'access_email_failed',
    'dispatch_id', v_dispatch.id,
    'driver_id', v_dispatch.driver_id,
    'failure_code', v_code,
    'duplicate', false
  );
end;
$$;

comment on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) is
  'Service-role: mark a pending access-email dispatch as failed. Does not write access_email_sent and does not start the success cooldown.';

revoke all on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) from public;
revoke all on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) from anon;
revoke all on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) from authenticated;
grant execute on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) to service_role;

-- Archived Worker profile retention consistency (see 20260726190000).
create or replace function public.drevora_drivers_retention_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.archived_at is null then
    if new.retention_expires_at is not null then
      raise exception 'WORKER_RETENTION_INVALID'
        using errcode = 'P0001',
              hint = 'Active Workers cannot have a retention deadline.';
    end if;
    new.retention_expires_at := null;
  else
    if new.retention_expires_at is null then
      raise exception 'WORKER_RETENTION_REQUIRED'
        using errcode = 'P0001',
              hint = 'Archived Workers require retention_expires_at.';
    end if;
    if new.retention_expires_at <= new.archived_at then
      raise exception 'WORKER_RETENTION_INVALID'
        using errcode = 'P0001',
              hint = 'retention_expires_at must be after archived_at.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists drivers_retention_guard on public.drivers;
create trigger drivers_retention_guard
  before insert or update of archived_at, retention_expires_at
  on public.drivers
  for each row
  execute function public.drevora_drivers_retention_guard();

revoke all on function public.drevora_drivers_retention_guard() from public;
revoke all on function public.drevora_drivers_retention_guard() from anon;


-- -----------------------------------------------------------------------------
-- Vehicle archive / retention lifecycle guard (see 20260726180000)
-- Single trigger: vehicles_archive_reason_guard
-- BEFORE INSERT OR UPDATE OF archived_at, archive_reason, retention_expires_at
-- Archive/Restore RPCs live in the migration (SECURITY DEFINER, search_path = '').
-- -----------------------------------------------------------------------------

create or replace function public.drevora_vehicles_archive_reason_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.archived_at is null then
    if new.archive_reason is not null
      or new.retention_expires_at is not null then
      raise exception 'VEHICLE_LIFECYCLE_INVALID'
        using errcode = 'P0001',
              hint = 'Active Vehicles cannot have archive_reason or retention_expires_at.';
    end if;
    -- Already null: do not assign RPC-only lifecycle columns (see 20260811240000).
    return new;
  else
    if new.archive_reason is null
      or btrim(new.archive_reason) = '' then
      raise exception 'VEHICLE_ARCHIVE_REASON_REQUIRED'
        using errcode = 'P0001',
              hint = 'An archive reason is required when archiving a Vehicle.';
    end if;
    if new.retention_expires_at is null then
      raise exception 'VEHICLE_RETENTION_REQUIRED'
        using errcode = 'P0001',
              hint = 'Archived Vehicles require retention_expires_at.';
    end if;
    if new.retention_expires_at <= new.archived_at then
      raise exception 'VEHICLE_RETENTION_INVALID'
        using errcode = 'P0001',
              hint = 'retention_expires_at must be after archived_at.';
    end if;
    if new.retention_expires_at is distinct from (new.archived_at + interval '6 years') then
      raise exception 'VEHICLE_RETENTION_INVALID'
        using errcode = 'P0001',
              hint = 'retention_expires_at must equal archived_at + 6 calendar years.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vehicles_archive_reason_guard on public.vehicles;
drop trigger if exists vehicles_lifecycle_guard on public.vehicles;
create trigger vehicles_archive_reason_guard
  before insert or update of archived_at, archive_reason, retention_expires_at
  on public.vehicles
  for each row
  execute function public.drevora_vehicles_archive_reason_guard();

revoke all on function public.drevora_vehicles_archive_reason_guard() from public;
revoke all on function public.drevora_vehicles_archive_reason_guard() from anon;


-- -----------------------------------------------------------------------------
-- Vehicle plan allowance enforcement (no Stripe)
-- Canonical definition: migrations/20260720200000_vehicle_plan_allowance_enforcement.sql
-- -----------------------------------------------------------------------------

create or replace function public.drevora_active_vehicle_limit_for_plan(p_plan_code text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case lower(trim(coalesce(p_plan_code, '')))
    when 'starter' then 10
    when 'growing' then 25
    when 'pro' then 50
    else null
  end;
$$;

create or replace function public.drevora_enforce_vehicle_plan_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_plan_code text;
  v_valid_until timestamptz;
  v_limit integer;
  v_active_count integer;
  v_becoming_active boolean := false;
  v_new_is_trailer boolean;
  v_old_is_trailer boolean;
begin
  v_new_is_trailer := coalesce(btrim(new.vehicle_type), '') = 'Trailer';
  v_old_is_trailer := tg_op = 'UPDATE' and coalesce(btrim(old.vehicle_type), '') = 'Trailer';

  if tg_op = 'INSERT' then
    v_becoming_active := (new.archived_at is null);
  elsif tg_op = 'UPDATE' then
    v_becoming_active :=
      (old.archived_at is not null and new.archived_at is null)
      or (
        new.archived_at is null
        and old.company_id is distinct from new.company_id
      );

    -- Trailer -> non-Trailer while remaining active must be checked even
    -- when neither archived_at nor company_id changed — it starts
    -- consuming a powered-vehicle slot from this point on.
    if new.archived_at is null and v_old_is_trailer and not v_new_is_trailer then
      v_becoming_active := true;
    end if;
  end if;

  if not v_becoming_active then
    return new;
  end if;

  v_company_id := new.company_id;
  if v_company_id is null then
    raise exception 'VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Vehicle company_id is required for plan allowance checks.';
  end if;

  select c.plan_code, c.subscription_valid_until
  into v_plan_code, v_valid_until
  from public.companies c
  where c.id = v_company_id
  for update;

  if not found then
    raise exception 'VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Company not found for Vehicle plan allowance check.';
  end if;

  if v_valid_until is not null and now() >= v_valid_until then
    raise exception 'SUBSCRIPTION_PLAN_EXPIRED'
      using errcode = 'P0001',
            hint = format(
              'Your trial expired on %s. Existing records remain available. Contact DREVORA to renew your plan.',
              to_char(v_valid_until at time zone 'UTC', 'DD Mon YYYY')
            );
  end if;

  -- Trailers never consume or require a powered-vehicle plan slot. The
  -- subscription itself must still be valid (checked above), but no slot
  -- is resolved, counted, or enforced for a Trailer-typed row.
  if v_new_is_trailer then
    return new;
  end if;

  v_limit := public.drevora_active_vehicle_limit_for_plan(v_plan_code);

  if v_limit is null then
    raise exception 'VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Assign a valid starter/growing/pro plan, or configure a trusted Custom Fleet Vehicle limit.';
  end if;

  select count(*)::integer
  into v_active_count
  from public.vehicles v
  where v.company_id = v_company_id
    and v.archived_at is null
    and coalesce(btrim(v.vehicle_type), '') is distinct from 'Trailer'
    and (tg_op = 'INSERT' or v.id is distinct from new.id);

  if v_active_count >= v_limit then
    raise exception 'VEHICLE_PLAN_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = format(
              'Active Vehicles %s / %s. Archive an inactive Vehicle or change the company plan.',
              v_active_count,
              v_limit
            );
  end if;

  return new;
end;
$$;

comment on function public.drevora_enforce_vehicle_plan_allowance() is
  'Prevents creating or reactivating non-Trailer Vehicles above the company active-Vehicle plan allowance. Trailers (vehicle_type = Trailer) are exempt — they never consume or require a slot.';

drop trigger if exists vehicles_enforce_vehicle_plan_allowance on public.vehicles;
create trigger vehicles_enforce_vehicle_plan_allowance
  before insert or update of archived_at, company_id, vehicle_type
  on public.vehicles
  for each row
  execute function public.drevora_enforce_vehicle_plan_allowance();


-- -----------------------------------------------------------------------------
-- Worker Support Requests (Help & Support)
-- Canonical migration: 20260801130000_create_support_requests.sql
-- -----------------------------------------------------------------------------

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  request_type text not null,
  category text not null,
  title text not null,
  description text not null,
  steps_to_reproduce text null,
  rating smallint null,
  status text not null default 'submitted',
  support_response text null,
  responded_at timestamptz null,
  resolved_at timestamptz null,
  reference text not null,
  app_version text not null,
  platform text not null,
  route text null,
  network_state text not null default 'online',
  device_metadata jsonb not null default '{}'::jsonb,
  attachment_paths text[] not null default '{}'::text[],
  constraint support_requests_type_check check (
    request_type in ('bug', 'feedback')
  ),
  constraint support_requests_status_check check (
    status in ('submitted', 'in_progress', 'resolved', 'closed')
  ),
  constraint support_requests_rating_check check (
    rating is null or (rating >= 1 and rating <= 5)
  ),
  constraint support_requests_title_len_check check (
    char_length(trim(title)) >= 1 and char_length(title) <= 200
  ),
  constraint support_requests_description_len_check check (
    char_length(trim(description)) >= 1 and char_length(description) <= 4000
  ),
  constraint support_requests_steps_len_check check (
    steps_to_reproduce is null or char_length(steps_to_reproduce) <= 4000
  ),
  constraint support_requests_reference_unique unique (reference),
  constraint support_requests_network_state_check check (
    network_state in ('online', 'offline')
  ),
  constraint support_requests_platform_check check (
    platform in ('android', 'web', 'pwa')
  ),
  constraint support_requests_bug_rating_null_check check (
    request_type <> 'bug' or rating is null
  ),
  constraint support_requests_attachments_len_check check (
    cardinality(attachment_paths) <= 3
  )
);

create index if not exists support_requests_driver_created_idx
  on public.support_requests (driver_id, created_at desc);

create index if not exists support_requests_company_status_idx
  on public.support_requests (company_id, status);

create index if not exists support_requests_company_created_idx
  on public.support_requests (company_id, created_at desc);


-- -----------------------------------------------------------------------------
-- Legal documents + company legal controller fields
-- Canonical: migrations/20260801140000_legal_documents_and_acceptances.sql
-- Hardening: migrations/20260801150000_harden_legal_acceptance_audit.sql
-- Customer ACCEPT requires Admin (drevora_auth_user_has_admin_role_for_company);
-- status read remains office-role. Published metadata/hashes + acceptances immutable.
-- -----------------------------------------------------------------------------

alter table public.companies
  add column if not exists default_paid_holiday_hours numeric not null default 8;

alter table public.companies
  add column if not exists legal_company_name text,
  add column if not exists business_address_line_1 text,
  add column if not exists business_address_line_2 text,
  add column if not exists county text,
  add column if not exists privacy_contact_email text,
  add column if not exists worker_privacy_notice_url text,
  add column if not exists worker_privacy_notice_content text,
  add column if not exists worker_privacy_notice_version text,
  add column if not exists worker_privacy_notice_updated_at timestamptz;

create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  version text not null,
  title text not null,
  effective_date date not null,
  content_hash text not null,
  audience text not null,
  is_current boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint legal_document_versions_document_type_check check (
    document_type in ('customer_terms', 'dpa', 'privacy_policy', 'worker_terms')
  ),
  constraint legal_document_versions_audience_check check (
    audience in ('customer_admin', 'worker', 'both')
  ),
  constraint legal_document_versions_content_hash_check check (
    content_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint legal_document_versions_type_version_unique unique (document_type, version)
);

create unique index if not exists legal_document_versions_one_current_per_type_idx
  on public.legal_document_versions (document_type)
  where is_current = true;

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  acceptance_batch_id uuid not null,
  created_at timestamptz not null default now(),
  document_version_id uuid not null references public.legal_document_versions (id),
  document_type text not null,
  document_version text not null,
  document_hash text not null,
  subject_type text not null,
  company_id uuid null references public.companies (id),
  driver_id uuid null references public.drivers (id),
  accepted_by_auth_user_id uuid not null,
  accepted_by_name text not null,
  accepted_by_email text not null,
  confirmed_company_authority boolean not null default false,
  acceptance_action text not null,
  acceptance_source text not null,
  platform text not null,
  route text null,
  user_agent text null,
  legal_entity_snapshot jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null default now(),
  constraint legal_acceptances_document_type_check check (
    document_type in ('customer_terms', 'dpa', 'privacy_policy', 'worker_terms')
  ),
  constraint legal_acceptances_subject_type_check check (
    subject_type in ('customer_admin', 'worker')
  ),
  constraint legal_acceptances_acceptance_action_check check (
    acceptance_action in ('accepted', 'acknowledged')
  ),
  constraint legal_acceptances_action_for_document_check check (
    (
      document_type in ('customer_terms', 'dpa', 'worker_terms')
      and acceptance_action = 'accepted'
    )
    or (
      document_type = 'privacy_policy'
      and acceptance_action = 'acknowledged'
    )
  ),
  constraint legal_acceptances_acceptance_source_check check (
    acceptance_source in (
      'onboarding',
      'trial',
      'subscription',
      'office_login',
      'worker_first_login',
      'legal_update'
    )
  ),
  constraint legal_acceptances_subject_source_check check (
    (
      subject_type = 'customer_admin'
      and acceptance_source in (
        'onboarding',
        'trial',
        'subscription',
        'office_login',
        'legal_update'
      )
    )
    or (
      subject_type = 'worker'
      and acceptance_source in ('worker_first_login', 'legal_update')
    )
  ),
  constraint legal_acceptances_platform_check check (
    platform in ('android', 'web', 'pwa')
  ),
  constraint legal_acceptances_document_hash_check check (
    document_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint legal_acceptances_accepted_by_name_check check (
    char_length(btrim(accepted_by_name)) > 0
  ),
  constraint legal_acceptances_accepted_by_email_check check (
    char_length(btrim(accepted_by_email)) > 0
  ),
  constraint legal_acceptances_subject_refs_check check (
    (
      subject_type = 'customer_admin'
      and company_id is not null
      and driver_id is null
      and confirmed_company_authority = true
    )
    or (
      subject_type = 'worker'
      and company_id is not null
      and driver_id is not null
      and confirmed_company_authority = false
    )
  ),
  constraint legal_acceptances_doc_subject_check check (
    (
      document_type in ('customer_terms', 'dpa')
      and subject_type = 'customer_admin'
    )
    or (
      document_type = 'worker_terms'
      and subject_type = 'worker'
    )
    or (
      document_type = 'privacy_policy'
      and subject_type in ('customer_admin', 'worker')
    )
  ),
  constraint legal_acceptances_batch_document_type_unique unique (
    acceptance_batch_id,
    document_type
  )
);

create index if not exists legal_acceptances_company_type_accepted_idx
  on public.legal_acceptances (company_id, document_type, accepted_at);

create index if not exists legal_acceptances_driver_type_idx
  on public.legal_acceptances (driver_id, document_type);

create index if not exists legal_acceptances_batch_idx
  on public.legal_acceptances (acceptance_batch_id);

-- Account deletion requests (Worker self-service; Edge Function writes).
-- Canonical: migrations/20260803180000_create_account_deletion_requests.sql
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  company_id uuid not null references public.companies (id) on delete restrict,
  driver_id uuid null references public.drivers (id) on delete set null,
  role_context text not null,
  status text not null,
  requested_at timestamptz not null default timezone('utc', now()),
  scheduled_for timestamptz not null,
  processed_at timestamptz null,
  cancelled_at timestamptz null,
  processing_error text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint account_deletion_requests_role_context_check check (
    role_context in ('worker', 'office')
  ),
  constraint account_deletion_requests_status_check check (
    status in ('pending', 'processing', 'completed', 'cancelled', 'failed')
  ),
  constraint account_deletion_requests_scheduled_after_requested_check check (
    scheduled_for >= requested_at
  )
);

create unique index if not exists account_deletion_requests_one_active_per_user_idx
  on public.account_deletion_requests (auth_user_id)
  where status in ('pending', 'processing');

create index if not exists account_deletion_requests_pending_scheduled_idx
  on public.account_deletion_requests (scheduled_for)
  where status = 'pending';

create index if not exists account_deletion_requests_company_id_idx
  on public.account_deletion_requests (company_id);

create index if not exists account_deletion_requests_auth_user_id_idx
  on public.account_deletion_requests (auth_user_id);

drop trigger if exists account_deletion_requests_set_updated_at
  on public.account_deletion_requests;
create trigger account_deletion_requests_set_updated_at
  before update on public.account_deletion_requests
  for each row
  execute function public.drevora_set_updated_at();


-- -----------------------------------------------------------------------------
-- Worker Private Notes (Worker-only personal work notes)
-- Canonical migration: 20260807210000_create_worker_private_notes.sql
-- -----------------------------------------------------------------------------

create table if not exists public.worker_private_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  title text not null,
  content text not null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_private_notes_title_len_check check (
    char_length(trim(title)) >= 1 and char_length(title) <= 120
  ),
  constraint worker_private_notes_content_len_check check (
    char_length(trim(content)) >= 1 and char_length(content) <= 4000
  )
);

create index if not exists worker_private_notes_driver_pinned_updated_idx
  on public.worker_private_notes (driver_id, is_pinned desc, updated_at desc);

create index if not exists worker_private_notes_company_driver_idx
  on public.worker_private_notes (company_id, driver_id);

comment on table public.worker_private_notes is
  'Private Worker personal work notes. Own-row RLS only via drevora_auth_user_driver_id(); no Office policies.';

drop trigger if exists worker_private_notes_set_updated_at on public.worker_private_notes;
create trigger worker_private_notes_set_updated_at
  before update on public.worker_private_notes
  for each row
  execute function public.drevora_set_updated_at();


-- -----------------------------------------------------------------------------
-- Office-user invitation audit + link RPC
-- Canonical: migrations/20260808150000_office_user_invitation_foundation.sql
-- Prerequisite: migrations/20260808140000_mvp_system_membership_roles.sql
-- -----------------------------------------------------------------------------

create table if not exists public.office_user_invitation_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  invited_email text not null,
  invited_role text not null,
  actor_user_id uuid null references auth.users (id) on delete set null,
  auth_user_id uuid null references auth.users (id) on delete set null,
  membership_id uuid null references public.company_members (id) on delete set null,
  full_name text null,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint office_user_invitation_events_invited_role_check check (
    invited_role in ('Admin', 'Manager', 'Office', 'Supervisor')
  ),
  constraint office_user_invitation_events_status_check check (
    status in (
      'linked',
      'already_linked',
      'link_failed',
      'invite_send_failed',
      'email_failed'
    )
  )
);

comment on table public.office_user_invitation_events is
  'Append-only Office-user invitation audit. No browser SELECT/INSERT/UPDATE/DELETE. Writers are service-role / security-definer only. Explicit deny policy for anon/authenticated.';

create index if not exists office_user_invitation_events_company_created_at_idx
  on public.office_user_invitation_events (company_id, created_at desc);

create index if not exists office_user_invitation_events_email_created_at_idx
  on public.office_user_invitation_events (lower(invited_email), created_at desc);

create index if not exists office_user_invitation_events_auth_user_id_idx
  on public.office_user_invitation_events (auth_user_id)
  where auth_user_id is not null;

alter table public.office_user_invitation_events enable row level security;

revoke all on table public.office_user_invitation_events from public;
revoke all on table public.office_user_invitation_events from anon;
revoke all on table public.office_user_invitation_events from authenticated;
grant all on table public.office_user_invitation_events to service_role;

drop policy if exists office_user_invitation_events_deny_client_access
  on public.office_user_invitation_events;

create policy office_user_invitation_events_deny_client_access
  on public.office_user_invitation_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- RPC bodies: see migrations/20260808150000_office_user_invitation_foundation.sql
-- Apply that migration for drevora_link_invited_office_user +
-- drevora_insert_office_user_invitation_event (service_role only).


-- -----------------------------------------------------------------------------
-- Next steps
-- 1. Run policies.sql  — RLS configuration (MVP: disabled)
-- 2. Run seed.sql      — optional demo data (local/dev only)
-- Worker default-vehicle RPC: apply migration
--   20260727200000_worker_set_default_vehicle_rpc.sql
-- Tyre Check configurable axle layout + save-layout RPC: apply migration
--   20260728090000_tyre_check_configurable_axle_layout.sql
-- Support requests: apply migration
--   20260801130000_create_support_requests.sql
-- Support-attachment storage helpers: revoke anon EXECUTE
--   20260802150000_revoke_anon_support_attachment_storage_execute.sql
-- Auth/company helper EXECUTE restriction + search_path harden:
--   20260802160000_restrict_internal_auth_company_helper_execute.sql
-- Worker identity foundation (auth_user_id + audit):
--   20260806200000_worker_identity_foundation.sql
-- Worker login email change (guard + finalize RPC):
--   20260806220000_worker_login_email_change.sql
-- Legal documents + acceptances: apply migration
--   20260801140000_legal_documents_and_acceptances.sql
-- Legal acceptance audit hardening (Admin accept, immutability, constraints):
--   20260801150000_harden_legal_acceptance_audit.sql
-- Office-user invitation foundation (membership-only, no drivers):
--   20260808150000_office_user_invitation_foundation.sql
-- Office users list RPC (Settings → Office Users):
--   20260808160000_list_office_users.sql
-- Timesheet submission confirmations RLS (INSERT-only Model B):
--   20260802140000_timesheet_submission_confirmations_rls.sql
-- Account deletion requests (Worker self-service, SELECT-own only):
--   20260803180000_create_account_deletion_requests.sql
-- Worker private notes (own-row RLS, no Office policies):
--   20260807210000_create_worker_private_notes.sql
-- Office WRITE AAL2 helpers + high-impact Office WRITE RPC aal2 gates +
-- Office WRITE RLS (direct table INSERT/UPDATE/DELETE) aal2 gates:
--   20260808190000_office_write_require_aal2.sql
--   (tyre correction/delete; driver/vehicle archive/restore; timesheet approve/reject/
--    clean/clear overrides; tyre layout Office branch; worker core + submission docs;
--    Office RLS on documents/companies/drivers/vehicles/timesheets/holidays/contacts/
--    consumables/compliance/vehicle_checks/templates/driver_reports/dashboard_notes/
--    vehicle_availability)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Office WRITE AAL2 helpers (canonical: 20260808190000_office_write_require_aal2.sql)
-- End-user JWT sessions only — not for service_role Edge Function callers.
-- -----------------------------------------------------------------------------
create or replace function public.drevora_auth_session_is_aal2()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function public.drevora_auth_require_aal2()
returns void
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if not public.drevora_auth_session_is_aal2() then
    raise exception 'DREVORA: MFA_REQUIRED Two-factor authentication is required.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- List Office users (canonical: migrations/20260808160000_list_office_users.sql)
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER RPC public.drevora_list_office_users()
-- Returns: membership_id, full_name, email, role, is_active, created_at
-- Excludes Driver. Company resolved from caller Office membership.
-- Execute grants: authenticated + service_role (see policies.sql).

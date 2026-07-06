-- Holiday entitlement rules and per-worker leave entitlement overrides.

alter table public.companies
  add column if not exists holiday_entitlement_rules jsonb not null default '{
    "Full-time": { "paidHolidayEnabled": true, "annualPaidHolidayDays": 20, "bankHolidayEntitlementDays": 8, "unpaidLeaveAllowed": true },
    "Part-time": { "paidHolidayEnabled": true, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true },
    "Umbrella": { "paidHolidayEnabled": false, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true },
    "Agency": { "paidHolidayEnabled": false, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true },
    "Self-employed / Contractor": { "paidHolidayEnabled": false, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true },
    "Zero-hours": { "paidHolidayEnabled": false, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true },
    "Temporary": { "paidHolidayEnabled": false, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true },
    "Casual": { "paidHolidayEnabled": false, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true },
    "Other": { "paidHolidayEnabled": true, "annualPaidHolidayDays": 0, "bankHolidayEntitlementDays": 0, "unpaidLeaveAllowed": true }
  }'::jsonb;

alter table public.drivers
  add column if not exists paid_holiday_enabled boolean,
  add column if not exists annual_paid_holiday_days numeric,
  add column if not exists bank_holiday_entitlement_days numeric,
  add column if not exists unpaid_leave_allowed boolean not null default true,
  add column if not exists holiday_entitlement_notes text;

alter table public.holiday_requests
  add column if not exists leave_type text not null default 'paid_holiday',
  add column if not exists is_paid_leave boolean not null default true,
  add column if not exists holiday_days_deducted numeric,
  add column if not exists calendar_days_total numeric,
  add column if not exists non_working_days_excluded numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'holiday_requests_leave_type_check'
  ) then
    alter table public.holiday_requests
      add constraint holiday_requests_leave_type_check
      check (leave_type in ('paid_holiday', 'unpaid_leave', 'bank_holiday'));
  end if;
end $$;

update public.holiday_requests
set
  leave_type = coalesce(leave_type, 'paid_holiday'),
  is_paid_leave = coalesce(is_paid_leave, true),
  holiday_days_deducted = coalesce(holiday_days_deducted, total_days),
  calendar_days_total = coalesce(calendar_days_total, total_days),
  non_working_days_excluded = coalesce(non_working_days_excluded, 0);

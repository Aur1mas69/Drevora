-- Composite indexes for common timesheet list queries at scale

create index if not exists timesheets_week_status_idx
  on public.timesheets (week_start, status);

create index if not exists timesheets_week_driver_idx
  on public.timesheets (week_start, driver_id);

create index if not exists timesheets_week_vehicle_idx
  on public.timesheets (week_start, vehicle_id);

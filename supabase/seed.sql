-- =============================================================================
-- DREVORA Seed Data (optional)
-- =============================================================================
-- Run after schema.sql and policies.sql for local/demo environments.
-- Safe to re-run: only inserts when no company row exists.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Company profile (dashboard header demo data)
-- -----------------------------------------------------------------------------

insert into public.companies (
  name,
  address,
  city,
  postcode,
  country,
  timezone,
  weather_location
)
select
  'Jagstrans Ltd',
  '12 Industrial Estate',
  'Peterborough',
  'PE1 1AA',
  'UK',
  'Europe/London',
  'Peterborough, UK'
where not exists (
  select 1 from public.companies
);

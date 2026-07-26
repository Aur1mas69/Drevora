-- DREVORA — Timesheets retention lifecycle metadata (72 calendar months)
-- File: supabase/migrations/20260726200000_timesheets_retention_lifecycle.sql
--
-- Purpose:
--   1) Add retention_expires_at on public.timesheets (parent only).
--   2) Work week: week_start … week_start + 6 (seven calendar days).
--   3) retention_expires_at = final included UTC instant of that week, plus 6 years.
--   4) Backfill existing rows; set on every INSERT/UPDATE from the database.
--   5) Document effective privileges; guard overwrites any client-supplied value.
--
-- Semantic of retention_expires_at:
--   FINAL INCLUDED RETENTION TIMESTAMP (not an exclusive eligibility boundary).
--   Canonical UTC expression:
--     ((week_start + 7)::timestamp AT TIME ZONE 'UTC')
--       + interval '6 years'
--       - interval '1 microsecond'
--   Example: week_start = 2026-07-20 (Mon)
--     → final work day 2026-07-26 (Sun)
--     → retention_expires_at = 2032-07-26 23:59:59.999999+00
--     → Admin “Retained until” date = 2032-07-26 (full Sunday retained)
--     → deletion eligibility only after that instant
--
-- Independent of Worker Archive / Restore. Does not modify Worker rows.
-- Does not purge, hard-delete, cron, or anonymise Timesheets.
-- Does NOT apply itself — run manually in the Supabase SQL editor after review.
--
-- Idempotent. Preserves status, hours, cleaned_at, soft-delete, and week dates.

-- =============================================================================
-- 0) Pre-apply diagnostics (commented)
-- =============================================================================
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'timesheets'
--   and column_name in ('week_start', 'retention_expires_at', 'cleaned_at', 'deleted_at')
-- order by column_name;
--
-- select count(*) as timesheets_total,
--        count(*) filter (where retention_expires_at is null) as missing_retention
-- from public.timesheets;

begin;

-- =============================================================================
-- 1) Column
-- =============================================================================
alter table public.timesheets
  add column if not exists retention_expires_at timestamptz;

comment on column public.timesheets.retention_expires_at is
  'Final included UTC retention instant for the Timesheet parent: start of (week_start + 7 days) + 6 calendar years − 1 microsecond. Preserves the full final work-week day and the full six-year period. Metadata only; does not auto-delete.';

-- =============================================================================
-- 2) Pure calculator (week_start → retention_expires_at)
-- =============================================================================
create or replace function public.drevora_timesheet_retention_expires_at(p_week_start date)
returns timestamptz
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- Final included instant of the work week is immediately before week_start + 7.
  -- Then retain for six complete calendar years (still as a final included instant).
  select ((p_week_start + 7)::timestamp at time zone 'UTC')
    + interval '6 years'
    - interval '1 microsecond';
$$;

comment on function public.drevora_timesheet_retention_expires_at(date) is
  'Final included Timesheet retention timestamp: ((week_start + 7) UTC midnight + 6 years) − 1 microsecond.';

revoke all on function public.drevora_timesheet_retention_expires_at(date) from public;
revoke all on function public.drevora_timesheet_retention_expires_at(date) from anon;
grant execute on function public.drevora_timesheet_retention_expires_at(date) to authenticated;

-- =============================================================================
-- 3) Backfill / correct existing rows (deterministic; does not change week_start)
-- =============================================================================
update public.timesheets t
set retention_expires_at = public.drevora_timesheet_retention_expires_at(t.week_start)
where t.week_start is not null
  and (
    t.retention_expires_at is null
    or t.retention_expires_at is distinct from
      public.drevora_timesheet_retention_expires_at(t.week_start)
  );

-- =============================================================================
-- 4) BEFORE INSERT/UPDATE guard — always derive from week_start
-- =============================================================================
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

  -- Never trust a client-supplied retention date (overwrite always).
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

comment on function public.drevora_timesheets_retention_guard() is
  'Forces timesheets.retention_expires_at from week_start via drevora_timesheet_retention_expires_at. Overwrites client values. SECURITY INVOKER.';

drop trigger if exists timesheets_retention_guard on public.timesheets;
drop trigger if exists timesheets_retention_guard_insert on public.timesheets;
-- INSERT always fires; UPDATE fires when week_start or retention_expires_at is targeted.
create trigger timesheets_retention_guard
  before insert or update of week_start, retention_expires_at
  on public.timesheets
  for each row
  execute function public.drevora_timesheets_retention_guard();

revoke all on function public.drevora_timesheets_retention_guard() from public;
revoke all on function public.drevora_timesheets_retention_guard() from anon;
revoke all on function public.drevora_timesheets_retention_guard() from authenticated;

-- =============================================================================
-- 5) Column REVOKE (defense in depth — not sufficient alone if table GRANT exists)
-- =============================================================================
-- Timesheets currently use table-level INSERT/UPDATE grants (see policies.sql and
-- 20260715210000). In PostgreSQL, has_column_privilege() reports the *effective*
-- privilege: a table-level INSERT/UPDATE grant still confers column access even
-- after REVOKE INSERT/UPDATE (column). Do not treat column REVOKE as proof that
-- clients cannot name retention_expires_at. Authoritative protection is the guard
-- trigger above, which overwrites any supplied value from week_start.
revoke insert (retention_expires_at) on table public.timesheets from anon;
revoke update (retention_expires_at) on table public.timesheets from anon;
revoke insert (retention_expires_at) on table public.timesheets from authenticated;
revoke update (retention_expires_at) on table public.timesheets from authenticated;
revoke insert (retention_expires_at) on table public.timesheets from public;
revoke update (retention_expires_at) on table public.timesheets from public;

commit;

-- =============================================================================
-- 6) Post-apply diagnostics (commented — after COMMIT only)
-- =============================================================================
-- -- Missing retention (expect 0):
-- select count(*) as missing_retention
-- from public.timesheets
-- where retention_expires_at is null;
--
-- -- Deadlines not equal to canonical final-included formula (expect 0):
-- select count(*) as retention_mismatch
-- from public.timesheets
-- where retention_expires_at is distinct from
--   public.drevora_timesheet_retention_expires_at(week_start);
--
-- -- Retention earlier than or equal to final included work-week instant (expect 0):
-- select count(*) as retention_not_after_week_end
-- from public.timesheets
-- where retention_expires_at <=
--   (((week_start + 7)::timestamp at time zone 'UTC') - interval '1 microsecond');
--
-- -- Example week boundary (expect retained_until_date = 2032-07-26):
-- select
--   date '2026-07-20' as week_start,
--   date '2026-07-20' + 6 as final_work_day,
--   public.drevora_timesheet_retention_expires_at(date '2026-07-20') as retention_expires_at,
--   (public.drevora_timesheet_retention_expires_at(date '2026-07-20') at time zone 'UTC')::date
--     as retained_until_utc_date;
--
-- -- Counts by status:
-- select status, count(*) as n
-- from public.timesheets
-- group by status
-- order by status;
--
-- -- Timesheets linked to archived Workers:
-- select count(*) as timesheets_for_archived_workers
-- from public.timesheets t
-- join public.drivers d on d.id = t.driver_id
-- where d.archived_at is not null;
--
-- -- Effective privileges (table + column). Interpret together:
-- -- table INSERT/UPDATE true + column INSERT/UPDATE true  → client may name the column
-- -- table INSERT/UPDATE true + column INSERT/UPDATE false → unusual; still verify
-- -- Column REVOKE alone does NOT override a broader table-level grant.
-- select
--   has_table_privilege('authenticated', 'public.timesheets', 'INSERT') as auth_table_insert,
--   has_table_privilege('authenticated', 'public.timesheets', 'UPDATE') as auth_table_update,
--   has_table_privilege('authenticated', 'public.timesheets', 'DELETE') as auth_table_delete,
--   has_column_privilege('authenticated', 'public.timesheets', 'retention_expires_at', 'INSERT')
--     as auth_col_ins_retention,
--   has_column_privilege('authenticated', 'public.timesheets', 'retention_expires_at', 'UPDATE')
--     as auth_col_upd_retention,
--   has_column_privilege('authenticated', 'public.timesheets', 'retention_expires_at', 'SELECT')
--     as auth_col_sel_retention;
--
-- select
--   has_table_privilege('anon', 'public.timesheets', 'INSERT') as anon_table_insert,
--   has_table_privilege('anon', 'public.timesheets', 'UPDATE') as anon_table_update,
--   has_column_privilege('anon', 'public.timesheets', 'retention_expires_at', 'INSERT')
--     as anon_col_ins_retention,
--   has_column_privilege('anon', 'public.timesheets', 'retention_expires_at', 'UPDATE')
--     as anon_col_upd_retention;
--
-- select grantee, privilege_type, is_grantable
-- from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'timesheets'
--   and grantee in ('authenticated', 'anon', 'PUBLIC')
-- order by grantee, privilege_type;
--
-- select grantee, column_name, privilege_type
-- from information_schema.column_privileges
-- where table_schema = 'public' and table_name = 'timesheets'
--   and column_name = 'retention_expires_at'
--   and grantee in ('authenticated', 'anon', 'PUBLIC')
-- order by grantee, privilege_type;
--
-- -- Manual spoof check (Office session; replace <id>):
-- --   update public.timesheets
-- --   set retention_expires_at = timestamptz '2099-01-01 00:00:00+00'
-- --   where id = '<id>';
-- --   select id, week_start, retention_expires_at,
-- --          public.drevora_timesheet_retention_expires_at(week_start) as canonical
-- --   from public.timesheets where id = '<id>';
-- -- Expect: persisted retention_expires_at = canonical (client 2099 value discarded).
-- -- If the UPDATE errors on column privilege, that is also acceptable; either way the
-- -- arbitrary value must not persist.
--
-- select
--   p.proname,
--   p.prosecdef as security_definer,
--   pg_get_function_identity_arguments(p.oid) as args,
--   (
--     select string_agg(cfg, ', ' order by cfg)
--     from unnest(coalesce(p.proconfig, array[]::text[])) as cfg
--   ) as config_including_search_path
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'drevora_timesheet_retention_expires_at',
--     'drevora_timesheets_retention_guard'
--   )
-- order by p.proname;
-- -- Guard: security_definer false (invoker), search_path=''
--
-- -- Cross-company policy inventory (office vs worker):
-- select policyname, cmd, qual is not null as has_using, with_check is not null as has_with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('timesheets', 'timesheet_entries')
-- order by tablename, policyname;

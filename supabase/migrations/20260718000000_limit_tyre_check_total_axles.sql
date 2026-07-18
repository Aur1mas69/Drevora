-- =============================================================================
-- DREVORA — Limit Truck + Trailer combined axle count to 6
-- File: supabase/migrations/20260718000000_limit_tyre_check_total_axles.sql
-- =============================================================================
-- PURPOSE
--   Enforce truck_axle_count + coalesce(trailer_axle_count, 0) <= 6 on
--   public.tyre_checks. Truck-only checks may still use 1–6 truck axles with
--   trailer_axle_count NULL. Truck + Trailer combinations must leave at least
--   one axle for each unit and must not exceed six combined axles.
--
-- SCOPE
--   Adds one CHECK constraint on public.tyre_checks only.
--   Does NOT alter RLS, lifecycle, wear helpers, triggers, or UI columns.
--
-- PREFLIGHT
--   Fails closed if any existing row already exceeds the combined maximum.
--   Does not delete, rewrite, or invent axle values.
--
-- REVIEW ONLY until operator applies. Not executed by the authoring agent.
-- =============================================================================

do $$
begin
  if to_regclass('public.tyre_checks') is null then
    raise exception 'DREVORA STOP: public.tyre_checks is missing.';
  end if;
end;
$$;

do $$
declare
  v_bad_count integer;
begin
  select count(*)::integer
  into v_bad_count
  from public.tyre_checks
  where truck_axle_count + coalesce(trailer_axle_count, 0) > 6;

  if v_bad_count > 0 then
    raise exception
      'DREVORA STOP: % tyre_checks row(s) exceed the maximum combined axle count of 6.',
      v_bad_count;
  end if;
end;
$$;

alter table public.tyre_checks
  drop constraint if exists tyre_checks_total_axle_count_max_6_chk;

alter table public.tyre_checks
  add constraint tyre_checks_total_axle_count_max_6_chk
  check (truck_axle_count + coalesce(trailer_axle_count, 0) <= 6);

comment on constraint tyre_checks_total_axle_count_max_6_chk on public.tyre_checks is
  'Truck + Trailer combined axle count is limited to six axles. Truck-only checks use trailer_axle_count NULL and may still have 1–6 truck axles.';

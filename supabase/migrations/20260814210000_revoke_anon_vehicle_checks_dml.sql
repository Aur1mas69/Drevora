-- =============================================================================
-- DREVORA — Revoke leftover anon DML on public.vehicle_checks
-- File: supabase/migrations/20260814210000_revoke_anon_vehicle_checks_dml.sql
-- =============================================================================
-- PURPOSE
--   Live production audit confirmed leftover table grants from
--   20260718100000_vehicle_check_defect_review.sql:
--     GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_checks TO anon
--   RLS policies are TO authenticated only, so anonymous access is already
--   denied at the policy layer. These grants are unnecessary and are removed
--   as defense in depth.
--
-- SCOPE
--   Exactly: REVOKE SELECT, INSERT, UPDATE, DELETE ON public.vehicle_checks
--   FROM anon.
--
-- DOES NOT
--   - disable or alter RLS
--   - change authenticated privileges
--   - change any RLS policy
--   - change triggers
--   - modify other tables
--
-- Idempotent. REVOKE is a no-op if the privilege is already absent.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.vehicle_checks') is null then
    raise exception
      'VEHICLE_CHECKS_ANON_REVOKE_PRECONDITION: public.vehicle_checks missing';
  end if;
end $$;

revoke select, insert, update, delete
  on table public.vehicle_checks
  from anon;

notify pgrst, 'reload schema';

commit;

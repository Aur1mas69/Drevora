-- =============================================================================
-- DREVORA — Preflight: Worker identity foundation
-- File: supabase/diagnostics/20260806_preflight_worker_identity_foundation.sql
-- =============================================================================
-- PURPOSE
--   Run BEFORE applying 20260806200000_worker_identity_foundation.sql.
--   Read-only. Must show PASS for every blocker check (result_count = 0).
--
-- SAFE BEFORE COLUMN EXISTS
--   Do not use a static Worker Auth-link column reference (it may not exist yet).
--   Use to_jsonb(row) ->> 'auth_user_id' instead. Missing key → NULL, so
--   existing-link checks correctly return zero rows pre-migration.
--
-- FINAL OUTPUT
--   One consolidated result table: check_name, result_count, status.
--   Blockers → PASS when count is 0; unambiguous candidates → INFO.
-- =============================================================================

with ambiguous_driver_to_many_auth as (
  select d.id as driver_id
  from public.drivers d
  inner join public.company_members cm
    on cm.company_id = d.company_id
   and cm.is_active is true
   and cm.role = 'Driver'
  inner join auth.users u
    on u.id = cm.user_id
  where to_jsonb(d)->>'auth_user_id' is null
    and d.company_id is not null
    and d.archived_at is null
    and nullif(btrim(coalesce(d.email, '')), '') is not null
    and lower(btrim(d.email)) = lower(btrim(coalesce(u.email, '')))
  group by d.id, d.company_id, lower(btrim(d.email))
  having count(distinct cm.user_id) > 1
),
ambiguous_auth_to_many_drivers as (
  select cm.user_id as matched_auth_user_id
  from public.drivers d
  inner join public.company_members cm
    on cm.company_id = d.company_id
   and cm.is_active is true
   and cm.role = 'Driver'
  inner join auth.users u
    on u.id = cm.user_id
  where to_jsonb(d)->>'auth_user_id' is null
    and d.company_id is not null
    and d.archived_at is null
    and nullif(btrim(coalesce(d.email, '')), '') is not null
    and lower(btrim(d.email)) = lower(btrim(coalesce(u.email, '')))
  group by cm.user_id, d.company_id, lower(btrim(d.email))
  having count(distinct d.id) > 1
),
backfill_collision_with_existing_link as (
  -- Pre-migration: to_jsonb(linked) has no auth_user_id key → zero rows.
  select d.id as candidate_driver_id
  from public.drivers d
  inner join public.company_members cm
    on cm.company_id = d.company_id
   and cm.is_active is true
   and cm.role = 'Driver'
  inner join auth.users u
    on u.id = cm.user_id
  inner join public.drivers linked
    on (to_jsonb(linked)->>'auth_user_id')::uuid = cm.user_id
   and linked.archived_at is null
   and linked.id is distinct from d.id
  where to_jsonb(d)->>'auth_user_id' is null
    and d.company_id is not null
    and d.archived_at is null
    and nullif(btrim(coalesce(d.email, '')), '') is not null
    and lower(btrim(d.email)) = lower(btrim(coalesce(u.email, '')))
),
existing_active_auth_user_duplicates as (
  -- Pre-migration: key absent → expression is null → zero rows.
  select to_jsonb(d)->>'auth_user_id' as linked_auth_user_id
  from public.drivers d
  where to_jsonb(d)->>'auth_user_id' is not null
    and d.archived_at is null
  group by to_jsonb(d)->>'auth_user_id'
  having count(*) > 1
),
unambiguous_backfill_candidates as (
  select d.id
  from public.drivers d
  inner join public.company_members cm
    on cm.company_id = d.company_id
   and cm.is_active is true
   and cm.role = 'Driver'
  inner join auth.users u
    on u.id = cm.user_id
  where to_jsonb(d)->>'auth_user_id' is null
    and d.company_id is not null
    and d.archived_at is null
    and nullif(btrim(coalesce(d.email, '')), '') is not null
    and lower(btrim(d.email)) = lower(btrim(coalesce(u.email, '')))
  group by d.id
  having count(distinct cm.user_id) = 1
)
select
  v.check_name,
  v.result_count,
  case
    when v.check_name = 'unambiguous_backfill_candidates' then 'INFO'
    when v.result_count = 0 then 'PASS'
    else 'FAIL'
  end as status
from (
  values
    (
      'ambiguous_driver_to_many_auth',
      (select count(*)::integer from ambiguous_driver_to_many_auth)
    ),
    (
      'ambiguous_auth_to_many_drivers',
      (select count(*)::integer from ambiguous_auth_to_many_drivers)
    ),
    (
      'backfill_collision_with_existing_link',
      (select count(*)::integer from backfill_collision_with_existing_link)
    ),
    (
      'existing_active_auth_user_duplicates',
      (select count(*)::integer from existing_active_auth_user_duplicates)
    ),
    (
      'unambiguous_backfill_candidates',
      (select count(*)::integer from unambiguous_backfill_candidates)
    )
) as v(check_name, result_count)
order by
  case v.check_name
    when 'ambiguous_driver_to_many_auth' then 1
    when 'ambiguous_auth_to_many_drivers' then 2
    when 'backfill_collision_with_existing_link' then 3
    when 'existing_active_auth_user_duplicates' then 4
    when 'unambiguous_backfill_candidates' then 5
    else 99
  end;

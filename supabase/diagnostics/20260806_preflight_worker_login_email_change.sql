-- =============================================================================
-- DREVORA — Preflight: Worker login email change
-- File: supabase/diagnostics/20260806_preflight_worker_login_email_change.sql
-- =============================================================================
-- PURPOSE
--   Run BEFORE applying 20260806220000_worker_login_email_change.sql.
--   Read-only. Confirm identity foundation is present.
-- =============================================================================

select
  check_name,
  result_count,
  case when result_count = 1 then 'PASS' else 'FAIL' end as status
from (
  values
    (
      'drivers_auth_user_id_column',
      (
        select count(*)::integer
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'drivers'
          and column_name = 'auth_user_id'
      )
    ),
    (
      'worker_identity_events_table',
      (
        select case
          when to_regclass('public.worker_identity_events') is null then 0
          else 1
        end
      )
    ),
    (
      'drevora_insert_worker_identity_event_fn',
      (
        select case
          when to_regprocedure(
            'public.drevora_insert_worker_identity_event(uuid,uuid,uuid,uuid,text,jsonb,jsonb,text)'
          ) is null then 0
          else 1
        end
      )
    ),
    (
      'drevora_auth_user_driver_id_fn',
      (
        select case
          when to_regprocedure('public.drevora_auth_user_driver_id()') is null then 0
          else 1
        end
      )
    )
) as v(check_name, result_count)
order by check_name;

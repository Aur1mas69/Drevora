-- Align tyre tread_status bands with the shared UI wear legend:
--   >= 6.0 mm → good
--   >= 3.0 mm → attention  (3.0 must be Attention, not Critical)
--   <  3.0 mm → critical
--   null     → not_checked
-- Idempotent: CREATE OR REPLACE + regenerate stored column + refresh parent summaries.

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

comment on function public.drevora_tyre_tread_status(numeric) is
  'Derived tread_status only: not_checked / good (>=6.0) / attention (3.0–5.9) / critical (<3.0).';

-- Recreate the generated column so existing stored values recompute under the new bands.
alter table public.tyre_check_items
  drop column if exists tread_status;

alter table public.tyre_check_items
  add column tread_status text
  generated always as (public.drevora_tyre_tread_status(tread_depth_mm)) stored;

-- Refresh parent summary counts / overall_result from recomputed item statuses.
do $$
declare
  r record;
begin
  if to_regprocedure('public.drevora_tyre_check_refresh_summary(uuid)') is null then
    return;
  end if;

  for r in
    select tc.id
    from public.tyre_checks tc
  loop
    perform public.drevora_tyre_check_refresh_summary(r.id);
  end loop;
end;
$$;

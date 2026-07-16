-- =============================================================================
-- DREVORA — Confirm ownership for one consumable with NULL company_id (READ-ONLY)
-- File: supabase/diagnostics/20260716_confirm_consumable_ownership.sql
-- =============================================================================
-- TARGET
--   consumable id:  8b6cdbf4-bda6-4753-8332-024ba575be79
--   receipt path company (from Storage path): 60370bdb-843c-41a8-a751-2326c85f2e85
--   current consumables.company_id: NULL (do not update in this diagnostic)
--
-- PURPOSE
--   Gather anonymised relational evidence to decide whether company_id can be
--   set to the receipt path company without moving the Storage object.
--
-- RULES
--   Read-only only: SELECT / WITH / CTE.
--   No CREATE, ALTER, DROP, INSERT, UPDATE, DELETE, TRUNCATE,
--   GRANT, REVOKE, TEMP TABLE, DO, CALL, MERGE, or SELECT INTO.
--
-- PRIVACY
--   UUIDs, counts, booleans, md5(receipt_url) only.
--   Do NOT select Worker names, registration numbers, suppliers, costs,
--   notes, or receipt filenames.
--
-- SAFE UUID PARSING
--   CASE WHEN <seg> ~* uuid-regex THEN <seg>::uuid ELSE NULL END.
--
-- CTE SCOPE
--   Every CTE is local to the single statement that follows its WITH clause.
--
-- DO NOT EXECUTE as part of automated agent apply — operator runs manually.
-- =============================================================================

-- =============================================================================
-- 1) Target consumable
-- =============================================================================
with target as (
  select
    '8b6cdbf4-bda6-4753-8332-024ba575be79'::uuid as consumable_id,
    '60370bdb-843c-41a8-a751-2326c85f2e85'::uuid as known_path_company_id
)
select
  c.id as consumable_id,
  c.company_id,
  c.worker_id,
  c.vehicle_id,
  c.created_at,
  c.updated_at,
  case
    when c.receipt_url is null or trim(c.receipt_url) = '' then null
    else md5(trim(c.receipt_url))
  end as receipt_url_hash,
  exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'consumable-receipts'
      and c.receipt_url is not null
      and trim(c.receipt_url) = o.name
      and split_part(o.name, '/', 1) = 'consumables'
      and (
        case
          when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then split_part(o.name, '/', 2)::uuid
          else null
        end
      ) = t.known_path_company_id
      and (
        case
          when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then split_part(o.name, '/', 3)::uuid
          else null
        end
      ) = c.id
  ) as receipt_url_matches_known_storage_object
from target t
left join public.consumables c on c.id = t.consumable_id;


-- =============================================================================
-- 2) Related ownership (Worker / Vehicle / path company)
-- =============================================================================
with target as (
  select
    '8b6cdbf4-bda6-4753-8332-024ba575be79'::uuid as consumable_id,
    '60370bdb-843c-41a8-a751-2326c85f2e85'::uuid as known_path_company_id
)
select
  c.id as consumable_id,
  c.worker_id,
  c.vehicle_id,
  d.company_id as worker_company_id,
  v.company_id as vehicle_company_id,
  t.known_path_company_id as path_company_id,
  (
    d.company_id is not null
    and v.company_id is not null
    and d.company_id = v.company_id
  ) as worker_and_vehicle_company_ids_match,
  exists (
    select 1 from public.companies co where co.id = d.company_id
  ) as worker_company_exists,
  exists (
    select 1 from public.companies co where co.id = v.company_id
  ) as vehicle_company_exists,
  exists (
    select 1 from public.companies co where co.id = t.known_path_company_id
  ) as path_company_exists,
  (d.company_id is not distinct from t.known_path_company_id) as worker_company_equals_path_company,
  (v.company_id is not distinct from t.known_path_company_id) as vehicle_company_equals_path_company
from target t
left join public.consumables c on c.id = t.consumable_id
left join public.drivers d on d.id = c.worker_id
left join public.vehicles v on v.id = c.vehicle_id;


-- =============================================================================
-- 3a) Historical evidence — all-time grouped counts by company_id
--     (same worker_id and/or same vehicle_id as target; anonymised counts only)
-- =============================================================================
with target as (
  select
    c.id as consumable_id,
    c.worker_id,
    c.vehicle_id,
    c.created_at
  from public.consumables c
  where c.id = '8b6cdbf4-bda6-4753-8332-024ba575be79'::uuid
),
related as (
  select
    x.company_id,
    count(*)::integer as row_count
  from public.consumables x
  cross join target t
  where x.id is distinct from t.consumable_id
    and (
      (t.worker_id is not null and x.worker_id = t.worker_id)
      or (t.vehicle_id is not null and x.vehicle_id = t.vehicle_id)
    )
  group by x.company_id
)
select
  'all_time' as window_label,
  r.company_id,
  r.row_count,
  (r.company_id is null) as is_null_company_id
from related r
order by (r.company_id is null), r.row_count desc, r.company_id;


-- =============================================================================
-- 3b) Historical evidence — ±30 days around target created_at
-- =============================================================================
with target as (
  select
    c.id as consumable_id,
    c.worker_id,
    c.vehicle_id,
    c.created_at
  from public.consumables c
  where c.id = '8b6cdbf4-bda6-4753-8332-024ba575be79'::uuid
),
related as (
  select
    x.company_id,
    count(*)::integer as row_count
  from public.consumables x
  cross join target t
  where x.id is distinct from t.consumable_id
    and (
      (t.worker_id is not null and x.worker_id = t.worker_id)
      or (t.vehicle_id is not null and x.vehicle_id = t.vehicle_id)
    )
    and t.created_at is not null
    and x.created_at is not null
    and x.created_at >= (t.created_at - interval '30 days')
    and x.created_at <= (t.created_at + interval '30 days')
  group by x.company_id
)
select
  'within_30_days_of_target_created_at' as window_label,
  r.company_id,
  r.row_count,
  (r.company_id is null) as is_null_company_id
from related r
order by (r.company_id is null), r.row_count desc, r.company_id;


-- =============================================================================
-- 3c) Historical evidence — NULL company_id count + most frequent non-null
-- =============================================================================
with target as (
  select
    c.id as consumable_id,
    c.worker_id,
    c.vehicle_id
  from public.consumables c
  where c.id = '8b6cdbf4-bda6-4753-8332-024ba575be79'::uuid
),
related as (
  select x.company_id
  from public.consumables x
  cross join target t
  where x.id is distinct from t.consumable_id
    and (
      (t.worker_id is not null and x.worker_id = t.worker_id)
      or (t.vehicle_id is not null and x.vehicle_id = t.vehicle_id)
    )
),
null_count as (
  select count(*)::integer as n
  from related r
  where r.company_id is null
),
mode_non_null as (
  select
    r.company_id,
    count(*)::integer as row_count
  from related r
  where r.company_id is not null
  group by r.company_id
  order by count(*) desc, r.company_id
  limit 1
)
select
  nc.n as related_rows_with_null_company_id,
  mn.company_id as most_frequent_non_null_company_id,
  mn.row_count as most_frequent_non_null_row_count
from null_count nc
left join mode_non_null mn on true;


-- =============================================================================
-- 4) Relationship checks
-- =============================================================================
with target as (
  select
    '8b6cdbf4-bda6-4753-8332-024ba575be79'::uuid as consumable_id,
    '60370bdb-843c-41a8-a751-2326c85f2e85'::uuid as known_path_company_id
)
select
  c.id as consumable_id,
  (
    d.company_id is not null
    and v.company_id is not null
    and d.company_id = v.company_id
  ) as worker_belongs_to_vehicle_company,
  (
    d.company_id is not null
    and v.company_id is not null
    and v.company_id = d.company_id
  ) as vehicle_belongs_to_worker_company,
  (
    d.company_id is not distinct from t.known_path_company_id
    or v.company_id is not distinct from t.known_path_company_id
  ) as path_company_related_to_worker_or_vehicle,
  exists (
    select 1
    from public.consumables x
    where x.id is distinct from c.id
      and c.worker_id is not null
      and c.vehicle_id is not null
      and x.worker_id = c.worker_id
      and x.vehicle_id = c.vehicle_id
      and x.company_id is not null
  ) as other_same_worker_vehicle_has_non_null_company_id,
  (
    select x.company_id
    from public.consumables x
    where x.id is distinct from c.id
      and c.worker_id is not null
      and c.vehicle_id is not null
      and x.worker_id = c.worker_id
      and x.vehicle_id = c.vehicle_id
      and x.company_id is not null
    group by x.company_id
    order by count(*) desc, x.company_id
    limit 1
  ) as other_same_worker_vehicle_top_company_id
from target t
left join public.consumables c on c.id = t.consumable_id
left join public.drivers d on d.id = c.worker_id
left join public.vehicles v on v.id = c.vehicle_id;


-- =============================================================================
-- 5) Candidate ownership verdict (single classification)
-- =============================================================================
with target as (
  select
    '8b6cdbf4-bda6-4753-8332-024ba575be79'::uuid as consumable_id,
    '60370bdb-843c-41a8-a751-2326c85f2e85'::uuid as known_path_company_id
),
base as (
  select
    c.id as consumable_id,
    c.company_id as current_company_id,
    c.worker_id,
    c.vehicle_id,
    d.company_id as worker_company_id,
    v.company_id as vehicle_company_id,
    t.known_path_company_id as path_company_id,
    exists (
      select 1 from public.companies co where co.id = d.company_id
    ) as worker_company_exists,
    exists (
      select 1 from public.companies co where co.id = v.company_id
    ) as vehicle_company_exists,
    exists (
      select 1 from public.companies co where co.id = t.known_path_company_id
    ) as path_company_exists,
    exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'consumable-receipts'
        and c.receipt_url is not null
        and trim(c.receipt_url) = o.name
        and (
          case
            when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then split_part(o.name, '/', 2)::uuid
            else null
          end
        ) = t.known_path_company_id
    ) as receipt_object_under_path_company
  from target t
  left join public.consumables c on c.id = t.consumable_id
  left join public.drivers d on d.id = c.worker_id
  left join public.vehicles v on v.id = c.vehicle_id
),
hist_mode as (
  select
    x.company_id,
    count(*)::integer as row_count
  from public.consumables x
  inner join base b on true
  where x.id is distinct from b.consumable_id
    and x.company_id is not null
    and (
      (b.worker_id is not null and x.worker_id = b.worker_id)
      or (b.vehicle_id is not null and x.vehicle_id = b.vehicle_id)
    )
  group by x.company_id
  order by count(*) desc, x.company_id
  limit 1
),
decided as (
  select
    b.*,
    hm.company_id as historical_mode_company_id,
    hm.row_count as historical_mode_row_count,
    case
      when b.worker_company_id is not null
        and b.vehicle_company_id is not null
        and b.worker_company_id is distinct from b.vehicle_company_id
        then 'CONFLICTING_RELATIONSHIPS'
      when b.worker_company_id is not null
        and b.vehicle_company_id is not null
        and b.worker_company_id = b.vehicle_company_id
        and b.worker_company_exists
        and b.vehicle_company_exists
        then 'RELATED_WORKER_AND_VEHICLE_COMPANY_CONFIRMED'
      when b.worker_company_id is not null
        and b.worker_company_exists
        and b.vehicle_company_id is null
        then 'WORKER_COMPANY_ONLY'
      when b.vehicle_company_id is not null
        and b.vehicle_company_exists
        and b.worker_company_id is null
        then 'VEHICLE_COMPANY_ONLY'
      when b.path_company_exists
        and (
          b.worker_company_id is not distinct from b.path_company_id
          or b.vehicle_company_id is not distinct from b.path_company_id
          or hm.company_id is not distinct from b.path_company_id
          or b.receipt_object_under_path_company
        )
        and not (
          b.worker_company_id is not null
          and b.vehicle_company_id is not null
          and b.worker_company_id is distinct from b.vehicle_company_id
        )
        then 'PATH_COMPANY_SUPPORTED'
      else 'INSUFFICIENT_EVIDENCE'
    end as classification
  from base b
  left join hist_mode hm on true
)
select
  d.classification,
  case d.classification
    when 'RELATED_WORKER_AND_VEHICLE_COMPANY_CONFIRMED' then d.worker_company_id
    when 'WORKER_COMPANY_ONLY' then d.worker_company_id
    when 'VEHICLE_COMPANY_ONLY' then d.vehicle_company_id
    when 'PATH_COMPANY_SUPPORTED' then d.path_company_id
    when 'CONFLICTING_RELATIONSHIPS' then null
    else null
  end as candidate_company_id,
  concat_ws(
    '; ',
    'current_company_id=' || coalesce(d.current_company_id::text, 'NULL'),
    'worker_company_id=' || coalesce(d.worker_company_id::text, 'NULL'),
    'vehicle_company_id=' || coalesce(d.vehicle_company_id::text, 'NULL'),
    'path_company_id=' || coalesce(d.path_company_id::text, 'NULL'),
    'historical_mode_company_id=' || coalesce(d.historical_mode_company_id::text, 'NULL')
      || case when d.historical_mode_row_count is null then '' else ' (n=' || d.historical_mode_row_count::text || ')' end,
    'receipt_object_under_path_company=' || d.receipt_object_under_path_company::text
  ) as evidence_summary,
  (
    case d.classification
      when 'RELATED_WORKER_AND_VEHICLE_COMPANY_CONFIRMED' then d.worker_company_id
      when 'WORKER_COMPANY_ONLY' then d.worker_company_id
      when 'VEHICLE_COMPANY_ONLY' then d.vehicle_company_id
      when 'PATH_COMPANY_SUPPORTED' then d.path_company_id
      else null
    end
  ) is not distinct from d.path_company_id
    and d.path_company_exists
    and d.receipt_object_under_path_company
  as can_set_company_id_without_moving_receipt,
  (
    case d.classification
      when 'RELATED_WORKER_AND_VEHICLE_COMPANY_CONFIRMED' then d.worker_company_id
      when 'WORKER_COMPANY_ONLY' then d.worker_company_id
      when 'VEHICLE_COMPANY_ONLY' then d.vehicle_company_id
      when 'PATH_COMPANY_SUPPORTED' then d.path_company_id
      else null
    end
  ) is distinct from d.path_company_id
    and (
      case d.classification
        when 'RELATED_WORKER_AND_VEHICLE_COMPANY_CONFIRMED' then d.worker_company_id
        when 'WORKER_COMPANY_ONLY' then d.worker_company_id
        when 'VEHICLE_COMPANY_ONLY' then d.vehicle_company_id
        when 'PATH_COMPANY_SUPPORTED' then d.path_company_id
        else null
      end
    ) is not null
  as receipt_path_needs_controlled_correction
from decided d;

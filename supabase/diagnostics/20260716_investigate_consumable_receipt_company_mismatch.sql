-- =============================================================================
-- DREVORA — Consumable receipt path/company mismatch investigation (READ-ONLY)
-- File: supabase/diagnostics/20260716_investigate_consumable_receipt_company_mismatch.sql
-- =============================================================================
-- PURPOSE
--   Investigate the confirmed case where a storage.objects row in bucket
--   consumable-receipts has path layout:
--     consumables/<path_company_uuid>/<consumable_uuid>/<filename>
--   and <path_company_uuid> differs from public.consumables.company_id.
--
-- CONTEXT (static app analysis — not executed here)
--   Path builder: src/lib/consumableReceiptStorage.ts
--     buildConsumableReceiptPath(companyId, consumableId, fileName)
--     → consumables/{companyId}/{consumableId}/{timestamp}-{safeName}
--   Upload company source: ConsumablesPage handleFormSubmit uses
--     companySettings?.id (UI company settings), then
--     applyConsumableReceiptChanges → uploadConsumableReceipt.
--   Row company_id: consumablesService create/update uses
--     requireVerifiedCompanyId() for public.consumables.company_id.
--   receipt_url stores the Storage path string (not a signed URL).
--   Replacement: applyConsumableReceiptChanges uploads new path then deletes
--     the previous path when different.
--
-- RULES
--   Read-only only: SELECT / WITH / CTE.
--   No CREATE, ALTER, DROP, INSERT, UPDATE, DELETE, TRUNCATE,
--   GRANT, REVOKE, TEMP TABLE, DO blocks, CALL, MERGE, or SELECT INTO.
--
-- PRIVACY
--   Counts, UUIDs, and md5(object name) only.
--   Do NOT select object filenames, supplier, cost, notes, Worker names,
--   emails, or signed URL values.
--
-- SAFE UUID PARSING
--   Always: CASE WHEN <seg> ~* <uuid-regex> THEN <seg>::uuid ELSE NULL END.
--
-- CTE SCOPE
--   Every CTE is local to the single statement that follows its WITH clause.
--   Do not reuse a CTE after a terminating semicolon.
--
-- DO NOT EXECUTE as part of automated agent apply — operator runs manually.
-- =============================================================================

-- =============================================================================
-- 1) Mismatch count
-- =============================================================================
with parsed as (
  select
    o.bucket_id,
    o.name as object_name,
    case
      when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 2)::uuid
      else null
    end as path_company_id,
    case
      when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 3)::uuid
      else null
    end as path_consumable_id
  from storage.objects o
  where o.bucket_id = 'consumable-receipts'
    and split_part(o.name, '/', 1) = 'consumables'
    and nullif(trim(split_part(o.name, '/', 4)), '') is not null
)
select
  'mismatch_count' as check_name,
  count(*)::integer as mismatch_count,
  case when count(*) = 0 then 'PASS' else 'FAIL_PATH_COMPANY_DIFFERS_FROM_ROW' end as status
from parsed p
inner join public.consumables c on c.id = p.path_consumable_id
where p.path_company_id is not null
  and p.path_consumable_id is not null
  and c.company_id is distinct from p.path_company_id;


-- =============================================================================
-- 2) Anonymised mismatch details
-- =============================================================================
with parsed as (
  select
    o.bucket_id,
    o.name as object_name,
    o.created_at as object_created_at,
    o.updated_at as object_updated_at,
    case
      when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 2)::uuid
      else null
    end as path_company_id,
    case
      when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 3)::uuid
      else null
    end as path_consumable_id
  from storage.objects o
  where o.bucket_id = 'consumable-receipts'
    and split_part(o.name, '/', 1) = 'consumables'
    and nullif(trim(split_part(o.name, '/', 4)), '') is not null
)
select
  p.bucket_id,
  md5(p.object_name) as object_name_hash,
  p.path_company_id,
  p.path_consumable_id,
  c.company_id as row_company_id,
  exists (
    select 1 from public.companies co where co.id = p.path_company_id
  ) as path_company_exists,
  exists (
    select 1 from public.companies co where co.id = c.company_id
  ) as row_company_exists,
  (
    c.receipt_url is not null
    and trim(c.receipt_url) = p.object_name
  ) as receipt_url_exact_match,
  (
    select count(*)::integer
    from public.consumables c2
    where c2.receipt_url is not null
      and trim(c2.receipt_url) = p.object_name
  ) as db_rows_referencing_same_path,
  p.object_created_at,
  p.object_updated_at,
  c.created_at as consumable_created_at,
  c.updated_at as consumable_updated_at,
  'PATH_COMPANY_DIFFERS_FROM_ROW' as classification
from parsed p
inner join public.consumables c on c.id = p.path_consumable_id
where p.path_company_id is not null
  and p.path_consumable_id is not null
  and c.company_id is distinct from p.path_company_id
order by p.object_created_at nulls last;


-- =============================================================================
-- 3) Reference integrity (for mismatched objects)
-- =============================================================================
with parsed as (
  select
    o.name as object_name,
    case
      when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 2)::uuid
      else null
    end as path_company_id,
    case
      when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 3)::uuid
      else null
    end as path_consumable_id
  from storage.objects o
  where o.bucket_id = 'consumable-receipts'
    and split_part(o.name, '/', 1) = 'consumables'
    and nullif(trim(split_part(o.name, '/', 4)), '') is not null
),
mismatches as (
  select
    p.object_name,
    p.path_company_id,
    p.path_consumable_id,
    c.id as consumable_id,
    c.company_id as row_company_id,
    c.receipt_url
  from parsed p
  inner join public.consumables c on c.id = p.path_consumable_id
  where p.path_company_id is not null
    and p.path_consumable_id is not null
    and c.company_id is distinct from p.path_company_id
)
select
  md5(m.object_name) as object_name_hash,
  m.path_consumable_id,
  m.consumable_id,
  (
    select count(*)::integer
    from public.consumables c2
    where c2.receipt_url is not null
      and trim(c2.receipt_url) = m.object_name
  ) as referencing_row_count,
  case
    when (
      select count(*)::integer
      from public.consumables c2
      where c2.receipt_url is not null
        and trim(c2.receipt_url) = m.object_name
    ) = 0 then 'ZERO_REFERENCES'
    when (
      select count(*)::integer
      from public.consumables c2
      where c2.receipt_url is not null
        and trim(c2.receipt_url) = m.object_name
    ) = 1 then 'ONE_REFERENCE'
    else 'MULTIPLE_REFERENCES'
  end as reference_cardinality,
  exists (
    select 1
    from public.consumables c3
    where c3.id is distinct from m.consumable_id
      and c3.receipt_url is not null
      and trim(c3.receipt_url) = m.object_name
  ) as another_consumable_references_same_object,
  (
    select count(*)::integer
    from public.consumables c4
    where c4.id = m.path_consumable_id
  ) = 1 as consumable_id_exists_once,
  (m.path_consumable_id = m.consumable_id) as path_consumable_id_matches_row_id,
  case
    when m.receipt_url is null or trim(m.receipt_url) = '' then 'EMPTY_OR_NULL'
    when m.receipt_url ~* '^https?://' then 'ABSOLUTE_HTTP_URL'
    else 'STORAGE_PATH_LIKE'
  end as receipt_url_shape,
  (
    coalesce(m.receipt_url, '') ilike '%token=%'
    or coalesce(m.receipt_url, '') ilike '%X-Amz-%'
    or coalesce(m.receipt_url, '') ilike '%/object/sign/%'
    or coalesce(m.receipt_url, '') ilike '%signature=%'
  ) as receipt_url_looks_signed
from mismatches m
order by object_name_hash;


-- =============================================================================
-- 4) Correct-path comparison (expected prefix for mismatched rows)
-- =============================================================================
with parsed as (
  select
    o.name as object_name,
    case
      when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 2)::uuid
      else null
    end as path_company_id,
    case
      when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 3)::uuid
      else null
    end as path_consumable_id
  from storage.objects o
  where o.bucket_id = 'consumable-receipts'
    and split_part(o.name, '/', 1) = 'consumables'
    and nullif(trim(split_part(o.name, '/', 4)), '') is not null
),
mismatched_rows as (
  select distinct
    c.id as consumable_id,
    c.company_id as expected_company_id,
    c.receipt_url
  from parsed p
  inner join public.consumables c on c.id = p.path_consumable_id
  where p.path_company_id is not null
    and p.path_consumable_id is not null
    and c.company_id is distinct from p.path_company_id
    and c.company_id is not null
)
select
  m.expected_company_id,
  m.consumable_id,
  (
    select count(*)::integer
    from storage.objects o2
    where o2.bucket_id = 'consumable-receipts'
      and o2.name like (
        'consumables/'
        || m.expected_company_id::text
        || '/'
        || m.consumable_id::text
        || '/%'
      )
  ) as objects_under_expected_prefix,
  (
    select coalesce(array_agg(md5(o2.name) order by o2.created_at, o2.name), '{}'::text[])
    from storage.objects o2
    where o2.bucket_id = 'consumable-receipts'
      and o2.name like (
        'consumables/'
        || m.expected_company_id::text
        || '/'
        || m.consumable_id::text
        || '/%'
      )
  ) as expected_prefix_object_name_hashes,
  exists (
    select 1
    from storage.objects o3
    where o3.bucket_id = 'consumable-receipts'
      and o3.name like (
        'consumables/'
        || m.expected_company_id::text
        || '/'
        || m.consumable_id::text
        || '/%'
      )
      and m.receipt_url is not null
      and trim(m.receipt_url) = o3.name
  ) as receipt_url_references_expected_prefix_object
from mismatched_rows m
order by m.consumable_id;


-- =============================================================================
-- 5) Path-company investigation (DB relationships only)
-- =============================================================================
-- Application conclusion (static, not SQL): upload path companyId comes from
-- companySettings?.id at save time; consumables.company_id comes from
-- requireVerifiedCompanyId(). A mismatch implies those two sources diverged
-- historically, or receipt_url/path was written outside the current flow.
with parsed as (
  select
    o.name as object_name,
    case
      when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 2)::uuid
      else null
    end as path_company_id,
    case
      when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 3)::uuid
      else null
    end as path_consumable_id
  from storage.objects o
  where o.bucket_id = 'consumable-receipts'
    and split_part(o.name, '/', 1) = 'consumables'
    and nullif(trim(split_part(o.name, '/', 4)), '') is not null
),
mismatches as (
  select
    p.object_name,
    p.path_company_id,
    p.path_consumable_id,
    c.id as consumable_id,
    c.company_id as row_company_id,
    c.worker_id,
    c.vehicle_id,
    c.receipt_url
  from parsed p
  inner join public.consumables c on c.id = p.path_consumable_id
  where p.path_company_id is not null
    and p.path_consumable_id is not null
    and c.company_id is distinct from p.path_company_id
)
select
  md5(m.object_name) as object_name_hash,
  m.path_company_id,
  m.row_company_id,
  m.consumable_id,
  exists (
    select 1 from public.companies co where co.id = m.path_company_id
  ) as path_company_is_real_company,
  (m.path_company_id = m.row_company_id) as path_company_equals_row_company,
  -- Cannot assert live auth.uid() company in a sessionless diagnostic.
  -- Closest DB proxies for "related company sources" on the consumable row:
  exists (
    select 1
    from public.drivers d
    where d.id = m.worker_id
      and d.company_id is not null
      and d.company_id = m.path_company_id
  ) as path_company_equals_worker_company_id,
  exists (
    select 1
    from public.vehicles v
    where v.id = m.vehicle_id
      and v.company_id is not null
      and v.company_id = m.path_company_id
  ) as path_company_equals_vehicle_company_id,
  exists (
    select 1
    from public.consumables c2
    where c2.id is distinct from m.consumable_id
      and c2.company_id = m.path_company_id
      and c2.receipt_url is not null
      and trim(c2.receipt_url) = m.object_name
  ) as other_row_same_path_company_and_path,
  exists (
    select 1
    from public.consumables c3
    where c3.id is distinct from m.consumable_id
      and c3.receipt_url is not null
      and trim(c3.receipt_url) = m.object_name
  ) as other_row_shares_receipt_path
from mismatches m
order by object_name_hash;


-- =============================================================================
-- 6) Scope check (bucket-wide counts)
-- =============================================================================
with classified as (
  select
    o.name as object_name,
    case
      when split_part(o.name, '/', 1) = 'consumables'
        and split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and nullif(trim(split_part(o.name, '/', 4)), '') is not null
      then 'recognised'
      else 'malformed'
    end as path_class,
    case
      when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 2)::uuid
      else null
    end as path_company_id,
    case
      when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 3)::uuid
      else null
    end as path_consumable_id
  from storage.objects o
  where o.bucket_id = 'consumable-receipts'
)
select
  count(*) filter (where path_class = 'recognised')::integer as recognised_objects,
  count(*) filter (
    where path_class = 'recognised'
      and exists (
        select 1
        from public.consumables c
        where c.id = classified.path_consumable_id
          and c.company_id is not distinct from classified.path_company_id
      )
  )::integer as matching_path_and_row_company,
  count(*) filter (
    where path_class = 'recognised'
      and exists (
        select 1
        from public.consumables c
        where c.id = classified.path_consumable_id
          and c.company_id is distinct from classified.path_company_id
      )
  )::integer as mismatched_path_vs_row_company,
  count(*) filter (where path_class = 'malformed')::integer as malformed_objects,
  count(*) filter (
    where path_class = 'recognised'
      and path_consumable_id is not null
      and not exists (
        select 1 from public.consumables c where c.id = classified.path_consumable_id
      )
  )::integer as missing_consumable_rows,
  count(*) filter (
    where not exists (
      select 1
      from public.consumables c
      where c.receipt_url is not null
        and trim(c.receipt_url) = classified.object_name
    )
  )::integer as unreferenced_objects
from classified;

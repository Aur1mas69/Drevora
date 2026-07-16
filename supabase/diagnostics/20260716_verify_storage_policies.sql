-- =============================================================================
-- DREVORA Storage Security Phase 1 — Verification (READ-ONLY)
-- File: supabase/diagnostics/20260716_verify_storage_policies.sql
-- =============================================================================
-- PURPOSE
--   Audit storage buckets, storage.objects policies, path formats, helper
--   grants, and tenant isolation readiness for:
--     20260716120000_secure_storage_tenant_policies.sql
--
-- App-aligned Worker Avatar expectations (post signed-URL app change):
--   Canonical: <company_uuid>/worker-avatars/<worker_uuid>/<filename>
--   Legacy:    <company_slug>/<worker_uuid>/<filename> (SELECT only)
--   Bucket:    worker-avatars.public = false
--
-- RULES
--   Read-only only: SELECT / WITH / CTE.
--   No CREATE, ALTER, DROP, INSERT, UPDATE, DELETE, TRUNCATE,
--   GRANT, REVOKE, TEMP TABLE, DO blocks that mutate, or functions.
--
-- PRIVACY
--   Counts and metadata only.
--   Do NOT select object names, file contents, signed URLs, emails, or secrets.
--
-- SAFE UUID PARSING
--   Never cast path segments with bare ::uuid guarded only by AND regex checks
--   (PostgreSQL does not guarantee boolean short-circuit). Always use
--   CASE WHEN <regex> THEN <text>::uuid ELSE NULL END.
--
-- DO NOT EXECUTE as part of automated agent apply — operator runs manually.
-- =============================================================================

-- =============================================================================
-- 1) All buckets and public/private flags
-- =============================================================================
-- Note: PostgreSQL CTEs are statement-scoped. Repeat target_buckets on every
-- independent statement that needs the fixed DREVORA bucket list.
with target_buckets(bucket_id) as (
  values
    ('worker-avatars'::text),
    ('vehicle-check-photos'::text),
    ('consumable-receipts'::text),
    ('document-files'::text),
    ('driver-report-files'::text)
)
select
  b.id as bucket_id,
  b.name as bucket_name,
  b.public as is_public,
  b.file_size_limit,
  b.allowed_mime_types,
  case
    when t.bucket_id is null then 'UNKNOWN_EXTRA_BUCKET'
    when b.public then 'FAIL_PRIVATE_BUCKET_IS_PUBLIC'
    else 'OK_PRIVATE'
  end as classification_hint
from storage.buckets b
left join target_buckets t on t.bucket_id = b.id
order by b.id;

-- Missing expected buckets
with target_buckets(bucket_id) as (
  values
    ('worker-avatars'::text),
    ('vehicle-check-photos'::text),
    ('consumable-receipts'::text),
    ('document-files'::text),
    ('driver-report-files'::text)
)
select
  t.bucket_id,
  'MISSING_BUCKET' as status
from target_buckets t
left join storage.buckets b on b.id = t.bucket_id
where b.id is null
order by t.bucket_id;

-- Explicit worker-avatars privacy check
select
  b.id as bucket_id,
  b.public as is_public,
  case
    when b.id is null then 'FAIL_MISSING_BUCKET'
    when b.public then 'FAIL_WORKER_AVATARS_STILL_PUBLIC'
    else 'PASS_WORKER_AVATARS_PRIVATE'
  end as status
from (select 'worker-avatars'::text as id) t
left join storage.buckets b on b.id = t.id;


-- =============================================================================
-- 2) All storage.objects policies: name, command, roles, USING, WITH CHECK
-- =============================================================================
select
  p.policyname,
  p.cmd as command,
  p.roles,
  p.qual as using_expression,
  p.with_check as with_check_expression,
  p.permissive
from pg_policies p
where p.schemaname = 'storage'
  and p.tablename = 'objects'
order by p.policyname, p.cmd;


-- =============================================================================
-- 3) Any policy with USING(true) or WITH CHECK(true)
-- =============================================================================
select
  p.policyname,
  p.cmd as command,
  p.roles,
  case
    when coalesce(p.qual, '') in ('true', '(true)') then 'USING_TRUE'
    else null
  end as using_issue,
  case
    when coalesce(p.with_check, '') in ('true', '(true)') then 'WITH_CHECK_TRUE'
    else null
  end as with_check_issue
from pg_policies p
where p.schemaname = 'storage'
  and p.tablename = 'objects'
  and (
    coalesce(p.qual, '') in ('true', '(true)')
    or coalesce(p.with_check, '') in ('true', '(true)')
  )
order by p.policyname;


-- =============================================================================
-- 4) Any private bucket accessible by anon
-- =============================================================================
select
  p.policyname,
  p.cmd as command,
  p.roles,
  p.qual as using_expression,
  p.with_check as with_check_expression,
  'FAIL_ANON_ON_STORAGE_POLICY' as status
from pg_policies p
where p.schemaname = 'storage'
  and p.tablename = 'objects'
  and (
    'anon' = any (p.roles)
    or p.roles = '{anon}'
    or p.roles::text ilike '%anon%'
  )
order by p.policyname;


-- =============================================================================
-- 5) Private-bucket policies scoped only by bucket_id (no path/tenant check)
-- =============================================================================
select
  p.policyname,
  p.cmd as command,
  p.roles,
  p.qual as using_expression,
  p.with_check as with_check_expression,
  'FAIL_BUCKET_ONLY_POLICY' as status
from pg_policies p
where p.schemaname = 'storage'
  and p.tablename = 'objects'
  and (
    (
      coalesce(p.qual, '') ~* 'bucket_id\s*=\s*''[^'']+'''
      and coalesce(p.qual, '') !~* 'drevora_storage_'
      and coalesce(p.qual, '') !~* 'company'
      and coalesce(p.qual, '') !~* 'foldername'
      and coalesce(p.qual, '') !~* 'split_part'
      and length(coalesce(p.qual, '')) < 80
    )
    or (
      coalesce(p.with_check, '') ~* 'bucket_id\s*=\s*''[^'']+'''
      and coalesce(p.with_check, '') !~* 'drevora_storage_'
      and coalesce(p.with_check, '') !~* 'company'
      and coalesce(p.with_check, '') !~* 'foldername'
      and coalesce(p.with_check, '') !~* 'split_part'
      and length(coalesce(p.with_check, '')) < 80
    )
  )
order by p.policyname;


-- =============================================================================
-- 5b) UPDATE policies missing WITH CHECK
-- =============================================================================
select
  p.policyname,
  p.cmd as command,
  case
    when coalesce(trim(p.with_check), '') = '' then 'FAIL_UPDATE_MISSING_WITH_CHECK'
    else 'OK'
  end as status
from pg_policies p
where p.schemaname = 'storage'
  and p.tablename = 'objects'
  and p.cmd = 'UPDATE'
  and p.policyname like 'drevora_storage_%'
order by p.policyname;


-- =============================================================================
-- 6) Object path format counts (no names returned)
-- =============================================================================
with objects_meta as (
  select
    o.bucket_id,
    case
      when o.bucket_id = 'worker-avatars'
        and split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and split_part(o.name, '/', 2) = 'worker-avatars'
        and split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and nullif(trim(split_part(o.name, '/', 4)), '') is not null
        then 'worker_avatar_canonical_uuid_first'
      when o.bucket_id = 'worker-avatars'
        and not (
          split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and split_part(o.name, '/', 2) = 'worker-avatars'
        )
        and split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and nullif(trim(split_part(o.name, '/', 3)), '') is not null
        then 'worker_avatar_legacy_slug_first'
      when split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then 'canonical_company_uuid_first'
      when o.bucket_id = 'vehicle-check-photos'
        and split_part(o.name, '/', 1) = 'vehicles'
        and split_part(o.name, '/', 3) = 'checks'
        and split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and split_part(o.name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then 'vehicle_check_vehicleid_checkid'
      when o.bucket_id = 'consumable-receipts'
        and split_part(o.name, '/', 1) = 'consumables'
        and split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then 'consumable_prefix_company_uuid'
      when o.bucket_id = 'document-files'
        and split_part(o.name, '/', 1) = 'documents'
        and split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then 'document_prefix_company_uuid'
      when o.bucket_id = 'driver-report-files'
        and split_part(o.name, '/', 1) = 'driver-reports'
        and split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then 'driver_report_prefix_company_uuid'
      else 'unresolved_or_other'
    end as path_format
  from storage.objects o
  where o.bucket_id in (
    'worker-avatars',
    'vehicle-check-photos',
    'consumable-receipts',
    'document-files',
    'driver-report-files'
  )
)
select
  bucket_id,
  path_format,
  count(*)::integer as object_count
from objects_meta
group by bucket_id, path_format
order by bucket_id, path_format;


-- =============================================================================
-- 7) Worker Avatar — drivers.avatar_url inventory (counts only)
-- =============================================================================
with avatar_classified as (
  select
    d.id as driver_id,
    d.company_id,
    d.avatar_url,
    case
      when d.avatar_url is null or trim(d.avatar_url) = '' then 'empty_or_null'
      when d.avatar_url ~* '^https?://' then 'absolute_external_url'
      when d.avatar_url ~* '^(blob:|data:)' then 'local_preview_url_unexpected'
      when
        split_part(d.avatar_url, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and split_part(d.avatar_url, '/', 2) = 'worker-avatars'
        and split_part(d.avatar_url, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and nullif(trim(split_part(d.avatar_url, '/', 4)), '') is not null
        then 'canonical_storage_path'
      when
        d.avatar_url !~* '^https?://'
        and d.avatar_url !~* '^(blob:|data:)'
        and not (
          split_part(d.avatar_url, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and split_part(d.avatar_url, '/', 2) = 'worker-avatars'
        )
        and split_part(d.avatar_url, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and nullif(trim(split_part(d.avatar_url, '/', 3)), '') is not null
        then 'legacy_slug_storage_path'
      else 'invalid_unrecognised'
    end as avatar_class
  from public.drivers d
)
select
  avatar_class,
  count(*)::integer as row_count
from avatar_classified
group by avatar_class
order by avatar_class;

-- Canonical path mismatches vs driver row
select
  'canonical_company_mismatch' as check_name,
  count(*)::integer as issue_count,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.drivers d
where d.avatar_url is not null
  and trim(d.avatar_url) <> ''
  and split_part(d.avatar_url, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(d.avatar_url, '/', 2) = 'worker-avatars'
  and split_part(d.avatar_url, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (
    d.company_id is distinct from (
      case
        when split_part(d.avatar_url, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(d.avatar_url, '/', 1)::uuid
        else null
      end
    )
    or d.id is distinct from (
      case
        when split_part(d.avatar_url, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(d.avatar_url, '/', 3)::uuid
        else null
      end
    )
  );

-- Legacy path worker UUID mismatch vs driver row
select
  'legacy_worker_uuid_mismatch' as check_name,
  count(*)::integer as issue_count,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.drivers d
where d.avatar_url is not null
  and trim(d.avatar_url) <> ''
  and d.avatar_url !~* '^https?://'
  and d.avatar_url !~* '^(blob:|data:)'
  and not (
    split_part(d.avatar_url, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and split_part(d.avatar_url, '/', 2) = 'worker-avatars'
  )
  and split_part(d.avatar_url, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and d.id is distinct from (
    case
      when split_part(d.avatar_url, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(d.avatar_url, '/', 2)::uuid
      else null
    end
  );

-- Paths that look like signed URLs persisted in DB (token/query markers)
select
  'avatar_url_looks_like_signed_url' as check_name,
  count(*)::integer as issue_count,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.drivers d
where d.avatar_url is not null
  and (
    d.avatar_url ilike '%token=%'
    or d.avatar_url ilike '%X-Amz-%'
    or d.avatar_url ilike '%/object/sign/%'
    or d.avatar_url ilike '%signature=%'
  );

-- Duplicate avatar paths shared by multiple workers
select
  'duplicate_avatar_path_multi_worker' as check_name,
  count(*)::integer as duplicate_path_groups,
  case when count(*) = 0 then 'PASS' else 'WARN' end as status
from (
  select trim(d.avatar_url) as avatar_path
  from public.drivers d
  where d.avatar_url is not null
    and trim(d.avatar_url) <> ''
    and d.avatar_url !~* '^https?://'
    and d.avatar_url !~* '^(blob:|data:)'
  group by trim(d.avatar_url)
  having count(*) > 1
) dup;

-- Local preview URLs unexpectedly persisted
select
  'avatar_url_blob_or_data_persisted' as check_name,
  count(*)::integer as issue_count,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.drivers d
where d.avatar_url ~* '^(blob:|data:)';


-- =============================================================================
-- 8) Worker Avatar — storage.objects inventory (counts only)
-- =============================================================================
with wa as (
  select
    o.name,
    case
      when
        split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and split_part(o.name, '/', 2) = 'worker-avatars'
        and split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and nullif(trim(split_part(o.name, '/', 4)), '') is not null
        then 'canonical'
      when
        split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and nullif(trim(split_part(o.name, '/', 3)), '') is not null
        and not (
          split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and split_part(o.name, '/', 2) = 'worker-avatars'
        )
        then 'legacy'
      else 'malformed'
    end as object_class,
    case
      when split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and split_part(o.name, '/', 2) = 'worker-avatars'
        then split_part(o.name, '/', 1)::uuid
      else null
    end as path_company_id,
    case
      when split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and split_part(o.name, '/', 2) = 'worker-avatars'
        and split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(o.name, '/', 3)::uuid
      when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(o.name, '/', 2)::uuid
      else null
    end as path_worker_id
  from storage.objects o
  where o.bucket_id = 'worker-avatars'
)
select
  object_class,
  count(*)::integer as object_count
from wa
group by object_class
order by object_class;

select
  'canonical_company_missing' as check_name,
  count(*)::integer as issue_count,
  case when count(*) = 0 then 'PASS' else 'WARN' end as status
from storage.objects o
where o.bucket_id = 'worker-avatars'
  and split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(o.name, '/', 2) = 'worker-avatars'
  and not exists (
    select 1 from public.companies c
    where c.id = (
      case
        when split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(o.name, '/', 1)::uuid
        else null
      end
    )
  );

select
  'canonical_worker_missing' as check_name,
  count(*)::integer as issue_count,
  case when count(*) = 0 then 'PASS' else 'WARN' end as status
from storage.objects o
where o.bucket_id = 'worker-avatars'
  and split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(o.name, '/', 2) = 'worker-avatars'
  and split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and not exists (
    select 1 from public.drivers d
    where d.id = (
      case
        when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(o.name, '/', 3)::uuid
        else null
      end
    )
  );

select
  'canonical_company_worker_mismatch' as check_name,
  count(*)::integer as issue_count,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from storage.objects o
inner join public.drivers d
  on d.id = (
    case
      when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 3)::uuid
      else null
    end
  )
where o.bucket_id = 'worker-avatars'
  and split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(o.name, '/', 2) = 'worker-avatars'
  and split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and d.company_id is distinct from (
    case
      when split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 1)::uuid
      else null
    end
  );

select
  'legacy_worker_missing' as check_name,
  count(*)::integer as issue_count,
  case when count(*) = 0 then 'PASS' else 'WARN' end as status
from storage.objects o
where o.bucket_id = 'worker-avatars'
  and not (
    split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and split_part(o.name, '/', 2) = 'worker-avatars'
  )
  and split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and not exists (
    select 1 from public.drivers d
    where d.id = (
      case
        when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(o.name, '/', 2)::uuid
        else null
      end
    )
  );

-- Objects not referenced by any drivers.avatar_url (informational; orphans OK until backfill)
select
  'worker_avatar_object_unreferenced' as check_name,
  count(*)::integer as unreferenced_count,
  'INFO' as status
from storage.objects o
where o.bucket_id = 'worker-avatars'
  and not exists (
    select 1
    from public.drivers d
    where d.avatar_url is not null
      and trim(d.avatar_url) = o.name
  );


-- =============================================================================
-- 9) Cross-company / orphan checks — other private buckets
-- =============================================================================

select
  'consumable-receipts' as bucket_id,
  count(*)::integer as conflict_count,
  'CROSS_COMPANY_PATH_VS_RECORD' as status
from storage.objects o
inner join public.consumables c
  on c.id = (
    case
      when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 3)::uuid
      else null
    end
  )
where o.bucket_id = 'consumable-receipts'
  and split_part(o.name, '/', 1) = 'consumables'
  and split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and c.company_id is distinct from (
    case
      when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 2)::uuid
      else null
    end
  );

select
  'document-files' as bucket_id,
  count(*)::integer as conflict_count,
  'CROSS_COMPANY_PATH_VS_RECORD' as status
from storage.objects o
inner join public.documents d
  on d.id = (
    case
      when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 3)::uuid
      else null
    end
  )
where o.bucket_id = 'document-files'
  and split_part(o.name, '/', 1) = 'documents'
  and split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and d.company_id is distinct from (
    case
      when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 2)::uuid
      else null
    end
  );

select
  'driver-report-files' as bucket_id,
  count(*)::integer as conflict_count,
  'CROSS_COMPANY_PATH_VS_RECORD' as status
from storage.objects o
inner join public.driver_reports r
  on r.id = (
    case
      when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 3)::uuid
      else null
    end
  )
where o.bucket_id = 'driver-report-files'
  and split_part(o.name, '/', 1) = 'driver-reports'
  and split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and r.company_id is distinct from (
    case
      when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 2)::uuid
      else null
    end
  );

select
  'vehicle-check-photos' as bucket_id,
  count(*)::integer as conflict_count,
  'PATH_VEHICLE_MISMATCH_VS_CHECK' as status
from storage.objects o
inner join public.vehicle_checks vc
  on vc.id = (
    case
      when split_part(o.name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 4)::uuid
      else null
    end
  )
where o.bucket_id = 'vehicle-check-photos'
  and split_part(o.name, '/', 1) = 'vehicles'
  and split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and vc.vehicle_id is distinct from (
    case
      when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(o.name, '/', 2)::uuid
      else null
    end
  );

select
  'vehicle-check-photos' as bucket_id,
  count(*)::integer as orphan_count,
  'ORPHAN_CHECK_ID' as status
from storage.objects o
where o.bucket_id = 'vehicle-check-photos'
  and split_part(o.name, '/', 1) = 'vehicles'
  and split_part(o.name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and not exists (
    select 1
    from public.vehicle_checks vc
    where vc.id = (
      case
        when split_part(o.name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(o.name, '/', 4)::uuid
        else null
      end
    )
  );

select
  'consumable-receipts' as bucket_id,
  count(*)::integer as orphan_count,
  'ORPHAN_CONSUMABLE_ID' as status
from storage.objects o
where o.bucket_id = 'consumable-receipts'
  and split_part(o.name, '/', 1) = 'consumables'
  and split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and not exists (
    select 1
    from public.consumables c
    where c.id = (
      case
        when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(o.name, '/', 3)::uuid
        else null
      end
    )
  );

select
  'document-files' as bucket_id,
  count(*)::integer as orphan_count,
  'ORPHAN_DOCUMENT_ID' as status
from storage.objects o
where o.bucket_id = 'document-files'
  and split_part(o.name, '/', 1) = 'documents'
  and split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and not exists (
    select 1
    from public.documents d
    where d.id = (
      case
        when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(o.name, '/', 3)::uuid
        else null
      end
    )
  );

select
  'driver-report-files' as bucket_id,
  count(*)::integer as orphan_count,
  'ORPHAN_REPORT_ID' as status
from storage.objects o
where o.bucket_id = 'driver-report-files'
  and split_part(o.name, '/', 1) = 'driver-reports'
  and split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and not exists (
    select 1
    from public.driver_reports r
    where r.id = (
      case
        when split_part(o.name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(o.name, '/', 3)::uuid
        else null
      end
    )
  );


-- =============================================================================
-- 10) Public private-file URL risk summary (DB fields; counts only)
-- =============================================================================

select
  'drivers.avatar_url' as field_ref,
  count(*) filter (where avatar_url is not null and trim(avatar_url) <> '')::integer as non_null_count,
  count(*) filter (where avatar_url ~* '^https?://')::integer as absolute_http_url_count,
  count(*) filter (
    where avatar_url is not null
      and trim(avatar_url) <> ''
      and avatar_url !~* '^https?://'
      and avatar_url !~* '^(blob:|data:)'
  )::integer as storage_path_like_count,
  'SHOULD_BE_PATH_PLUS_SIGNED_URL_AT_DISPLAY' as risk_note
from public.drivers;

select
  'vehicle_check_items.photo_url' as field_ref,
  count(*) filter (where photo_url is not null and trim(photo_url) <> '')::integer as non_null_count,
  count(*) filter (where photo_url ~* '^https?://')::integer as absolute_http_url_count,
  count(*) filter (
    where photo_url is not null
      and trim(photo_url) <> ''
      and photo_url !~* '^https?://'
  )::integer as storage_path_like_count,
  'SHOULD_BE_PATH_PLUS_SIGNED_URL' as risk_note
from public.vehicle_check_items;

select
  'vehicle_checks.signature_url' as field_ref,
  count(*) filter (where signature_url is not null and trim(signature_url) <> '')::integer as non_null_count,
  count(*) filter (where signature_url ~* '^https?://')::integer as absolute_http_url_count,
  count(*) filter (
    where signature_url is not null
      and trim(signature_url) <> ''
      and signature_url !~* '^https?://'
  )::integer as storage_path_like_count,
  'SHOULD_BE_PATH_PLUS_SIGNED_URL' as risk_note
from public.vehicle_checks;

select
  'consumables.receipt_url' as field_ref,
  count(*) filter (where receipt_url is not null and trim(receipt_url) <> '')::integer as non_null_count,
  count(*) filter (where receipt_url ~* '^https?://')::integer as absolute_http_url_count,
  count(*) filter (
    where receipt_url is not null
      and trim(receipt_url) <> ''
      and receipt_url !~* '^https?://'
  )::integer as storage_path_like_count,
  'SHOULD_BE_PATH_PLUS_SIGNED_URL' as risk_note
from public.consumables;

select
  'documents.file_url' as field_ref,
  count(*) filter (where file_url is not null and trim(file_url) <> '')::integer as non_null_count,
  count(*) filter (where file_url ~* '^https?://')::integer as absolute_http_url_count,
  count(*) filter (
    where file_url is not null
      and trim(file_url) <> ''
      and file_url !~* '^https?://'
  )::integer as storage_path_like_count,
  'SHOULD_BE_PATH_PLUS_SIGNED_URL' as risk_note
from public.documents;

select
  'driver_reports.attachment_url' as field_ref,
  count(*) filter (where attachment_url is not null and trim(attachment_url) <> '')::integer as non_null_count,
  count(*) filter (where attachment_url ~* '^https?://')::integer as absolute_http_url_count,
  count(*) filter (
    where attachment_url is not null
      and trim(attachment_url) <> ''
      and attachment_url !~* '^https?://'
  )::integer as storage_path_like_count,
  'LEGACY_URL_FIELD_RISK' as risk_note
from public.driver_reports;

select
  'driver_reports.attachment_path' as field_ref,
  count(*) filter (where attachment_path is not null and trim(attachment_path) <> '')::integer as non_null_count,
  count(*) filter (where attachment_path ~* '^https?://')::integer as absolute_http_url_count,
  count(*) filter (
    where attachment_path is not null
      and trim(attachment_path) <> ''
      and attachment_path !~* '^https?://'
  )::integer as storage_path_like_count,
  'PREFERRED_PATH_FIELD' as risk_note
from public.driver_reports;

select
  'companies.logo_url' as field_ref,
  count(*) filter (where logo_url is not null and trim(logo_url) <> '')::integer as non_null_count,
  count(*) filter (where logo_url ~* '^https?://')::integer as absolute_http_url_count,
  0::integer as storage_path_like_count,
  'EXTERNAL_URL_TEXT_NOT_STORAGE_BUCKET' as risk_note
from public.companies;

-- Unexpected public buckets among DREVORA targets
select
  b.id as bucket_id,
  count(o.id)::integer as object_count_in_public_bucket,
  'FAIL_PUBLIC_DREVORA_BUCKET' as risk_note
from storage.buckets b
left join storage.objects o on o.bucket_id = b.id
where b.public = true
  and b.id in (
    'worker-avatars',
    'vehicle-check-photos',
    'consumable-receipts',
    'document-files',
    'driver-report-files'
  )
group by b.id
order by b.id;


-- =============================================================================
-- 11) Expected policies missing + legacy unsafe still present
-- =============================================================================
with expected as (
  select * from (values
    ('drevora_storage_worker_avatars_select', 'SELECT'),
    ('drevora_storage_worker_avatars_insert', 'INSERT'),
    ('drevora_storage_worker_avatars_update', 'UPDATE'),
    ('drevora_storage_worker_avatars_delete', 'DELETE'),
    ('drevora_storage_vehicle_check_photos_select', 'SELECT'),
    ('drevora_storage_vehicle_check_photos_insert', 'INSERT'),
    ('drevora_storage_vehicle_check_photos_update', 'UPDATE'),
    ('drevora_storage_vehicle_check_photos_delete', 'DELETE'),
    ('drevora_storage_consumable_receipts_select', 'SELECT'),
    ('drevora_storage_consumable_receipts_insert', 'INSERT'),
    ('drevora_storage_consumable_receipts_update', 'UPDATE'),
    ('drevora_storage_consumable_receipts_delete', 'DELETE'),
    ('drevora_storage_document_files_select', 'SELECT'),
    ('drevora_storage_document_files_insert', 'INSERT'),
    ('drevora_storage_document_files_update', 'UPDATE'),
    ('drevora_storage_document_files_delete', 'DELETE'),
    ('drevora_storage_driver_report_files_select', 'SELECT'),
    ('drevora_storage_driver_report_files_insert', 'INSERT'),
    ('drevora_storage_driver_report_files_update', 'UPDATE'),
    ('drevora_storage_driver_report_files_delete', 'DELETE')
  ) as v(policyname, command)
)
select
  e.policyname,
  e.command,
  case when p.policyname is null then 'MISSING_EXPECTED_POLICY' else 'OK_PRESENT' end as status
from expected e
left join pg_policies p
  on p.schemaname = 'storage'
 and p.tablename = 'objects'
 and p.policyname = e.policyname
 and p.cmd = e.command
order by e.policyname;

-- Legacy unsafe policy names still present?
-- Consumable: both short names and live "Authenticated users can …" names must FAIL
-- if present (eight names). Permissive policies combine with OR.
select
  p.policyname,
  p.cmd as command,
  'LEGACY_UNSAFE_POLICY_STILL_PRESENT' as status
from pg_policies p
where p.schemaname = 'storage'
  and p.tablename = 'objects'
  and p.policyname in (
    'worker avatars select',
    'worker avatars insert',
    'worker avatars update',
    'worker avatars delete',
    'vehicle check photos select',
    'vehicle check photos insert',
    'vehicle check photos update',
    'vehicle check photos delete',
    'consumable receipts select',
    'consumable receipts insert',
    'consumable receipts update',
    'consumable receipts delete',
    'Authenticated users can view consumable receipts',
    'Authenticated users can upload consumable receipts',
    'Authenticated users can update consumable receipts',
    'Authenticated users can delete consumable receipts'
  )
order by p.policyname;

-- Worker avatar write helpers must deny legacy (helper definition smoke check)
select
  p.proname,
  case
    when p.oid is null then 'MISSING_FUNCTION'
    when p.proname = 'drevora_storage_can_write_worker_avatar'
      and pg_get_functiondef(p.oid) ilike '%worker_avatar_is_canonical%'
      then 'OK_CANONICAL_WRITE_GATE'
    when p.proname = 'drevora_storage_can_select_worker_avatar'
      and pg_get_functiondef(p.oid) ilike '%worker_avatar_is_legacy%'
      then 'OK_LEGACY_SELECT_COMPAT'
    when p.proname in (
      'drevora_storage_can_write_vehicle_check_file',
      'drevora_storage_can_delete_vehicle_check_file'
    )
      and pg_get_functiondef(p.oid) ilike '%drevora_vehicle_check_is_worker_editable%'
      then 'OK_VC_EDITABILITY_ENFORCED'
    else 'WARN_REVIEW_HELPER_BODY'
  end as status
from (
  select unnest(array[
    'drevora_storage_can_write_worker_avatar',
    'drevora_storage_can_select_worker_avatar',
    'drevora_storage_can_write_vehicle_check_file',
    'drevora_storage_can_delete_vehicle_check_file'
  ]) as proname
) e
left join pg_proc p
  on p.proname = e.proname
 and p.pronamespace = 'public'::regnamespace
order by e.proname;


-- =============================================================================
-- 12) Helper function ownership / search_path / EXECUTE grants
-- =============================================================================
with expected_fns as (
  select unnest(array[
    'drevora_storage_try_parse_uuid',
    'drevora_storage_path_company_id',
    'drevora_storage_object_company_id',
    'drevora_storage_worker_avatar_is_canonical',
    'drevora_storage_worker_avatar_is_legacy',
    'drevora_storage_worker_avatar_worker_id',
    'drevora_storage_can_select_worker_avatar',
    'drevora_storage_can_write_worker_avatar',
    'drevora_storage_vehicle_check_ids_from_path',
    'drevora_storage_path_is_vehicle_check_signature',
    'drevora_storage_can_select_vehicle_check_file',
    'drevora_storage_can_write_vehicle_check_file',
    'drevora_storage_can_delete_vehicle_check_file',
    'drevora_storage_can_select_consumable_receipt',
    'drevora_storage_can_write_consumable_receipt',
    'drevora_storage_can_select_document_file',
    'drevora_storage_can_write_document_file',
    'drevora_storage_can_select_driver_report_file',
    'drevora_storage_can_write_driver_report_file',
    'drevora_auth_user_company_ids',
    'drevora_auth_user_belongs_to_company_id',
    'drevora_auth_user_has_office_role',
    'drevora_auth_user_has_office_role_for_company',
    'drevora_auth_user_driver_id',
    'drevora_vehicle_check_is_worker_editable'
  ]) as proname
)
select
  e.proname,
  p.pronamespace::regnamespace::text as schema_name,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as is_security_definer,
  coalesce(p.proconfig::text, '') as config_incl_search_path,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
  case
    when p.oid is null then 'MISSING_FUNCTION'
    when has_function_privilege('anon', p.oid, 'EXECUTE') then 'FAIL_ANON_EXECUTE'
    when coalesce(p.proconfig::text, '') not ilike '%search_path%'
      and e.proname like 'drevora_storage_%'
      then 'WARN_NO_EXPLICIT_SEARCH_PATH'
    else 'OK'
  end as status
from expected_fns e
left join pg_proc p
  on p.proname = e.proname
 and p.pronamespace = 'public'::regnamespace
order by e.proname;


-- =============================================================================
-- 13) Final PASS / FAIL summary
-- =============================================================================
with
legacy_unsafe as (
  select count(*)::integer as n
  from pg_policies p
  where p.schemaname = 'storage'
    and p.tablename = 'objects'
    and p.policyname in (
      'worker avatars select', 'worker avatars insert', 'worker avatars update', 'worker avatars delete',
      'vehicle check photos select', 'vehicle check photos insert', 'vehicle check photos update', 'vehicle check photos delete',
      'consumable receipts select', 'consumable receipts insert', 'consumable receipts update', 'consumable receipts delete',
      'Authenticated users can view consumable receipts',
      'Authenticated users can upload consumable receipts',
      'Authenticated users can update consumable receipts',
      'Authenticated users can delete consumable receipts'
    )
),
true_policies as (
  select count(*)::integer as n
  from pg_policies p
  where p.schemaname = 'storage'
    and p.tablename = 'objects'
    and (
      coalesce(p.qual, '') in ('true', '(true)')
      or coalesce(p.with_check, '') in ('true', '(true)')
    )
),
anon_policies as (
  select count(*)::integer as n
  from pg_policies p
  where p.schemaname = 'storage'
    and p.tablename = 'objects'
    and p.roles::text ilike '%anon%'
),
bucket_only as (
  select count(*)::integer as n
  from pg_policies p
  where p.schemaname = 'storage'
    and p.tablename = 'objects'
    and (
      (
        coalesce(p.qual, '') ~* 'bucket_id\s*=\s*''[^'']+'''
        and coalesce(p.qual, '') !~* 'drevora_storage_'
        and length(coalesce(p.qual, '')) < 80
      )
      or (
        coalesce(p.with_check, '') ~* 'bucket_id\s*=\s*''[^'']+'''
        and coalesce(p.with_check, '') !~* 'drevora_storage_'
        and length(coalesce(p.with_check, '')) < 80
      )
    )
),
update_missing_check as (
  select count(*)::integer as n
  from pg_policies p
  where p.schemaname = 'storage'
    and p.tablename = 'objects'
    and p.cmd = 'UPDATE'
    and p.policyname like 'drevora_storage_%'
    and coalesce(trim(p.with_check), '') = ''
),
expected as (
  select * from (values
    ('drevora_storage_worker_avatars_select'),
    ('drevora_storage_worker_avatars_insert'),
    ('drevora_storage_worker_avatars_update'),
    ('drevora_storage_worker_avatars_delete'),
    ('drevora_storage_vehicle_check_photos_select'),
    ('drevora_storage_vehicle_check_photos_insert'),
    ('drevora_storage_vehicle_check_photos_update'),
    ('drevora_storage_vehicle_check_photos_delete'),
    ('drevora_storage_consumable_receipts_select'),
    ('drevora_storage_consumable_receipts_insert'),
    ('drevora_storage_consumable_receipts_update'),
    ('drevora_storage_consumable_receipts_delete'),
    ('drevora_storage_document_files_select'),
    ('drevora_storage_document_files_insert'),
    ('drevora_storage_document_files_update'),
    ('drevora_storage_document_files_delete'),
    ('drevora_storage_driver_report_files_select'),
    ('drevora_storage_driver_report_files_insert'),
    ('drevora_storage_driver_report_files_update'),
    ('drevora_storage_driver_report_files_delete')
  ) as v(policyname)
),
missing_expected as (
  select count(*)::integer as n
  from expected e
  left join pg_policies p
    on p.schemaname = 'storage'
   and p.tablename = 'objects'
   and p.policyname = e.policyname
  where p.policyname is null
),
private_public as (
  select count(*)::integer as n
  from storage.buckets b
  where b.id in (
    'worker-avatars',
    'vehicle-check-photos',
    'consumable-receipts',
    'document-files',
    'driver-report-files'
  )
    and b.public = true
),
missing_buckets as (
  select count(*)::integer as n
  from (
    select unnest(array[
      'worker-avatars',
      'vehicle-check-photos',
      'consumable-receipts',
      'document-files',
      'driver-report-files'
    ]) as bucket_id
  ) t
  left join storage.buckets b on b.id = t.bucket_id
  where b.id is null
),
helper_missing as (
  select count(*)::integer as n
  from (
    select unnest(array[
      'drevora_storage_try_parse_uuid',
      'drevora_storage_path_company_id',
      'drevora_storage_object_company_id',
      'drevora_storage_worker_avatar_is_canonical',
      'drevora_storage_worker_avatar_is_legacy',
      'drevora_storage_worker_avatar_worker_id',
      'drevora_storage_can_select_worker_avatar',
      'drevora_storage_can_write_worker_avatar',
      'drevora_storage_can_select_vehicle_check_file',
      'drevora_storage_can_write_vehicle_check_file',
      'drevora_storage_can_delete_vehicle_check_file',
      'drevora_storage_can_select_consumable_receipt',
      'drevora_storage_can_write_consumable_receipt',
      'drevora_storage_can_select_document_file',
      'drevora_storage_can_write_document_file',
      'drevora_storage_can_select_driver_report_file',
      'drevora_storage_can_write_driver_report_file'
    ]) as proname
  ) e
  left join pg_proc p
    on p.proname = e.proname
   and p.pronamespace = 'public'::regnamespace
  where p.oid is null
),
anon_helper_exec as (
  select count(*)::integer as n
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname like 'drevora_storage_%'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
)
select
  l.n as legacy_unsafe_policies,
  t.n as using_or_check_true_policies,
  a.n as anon_storage_policies,
  b.n as bucket_only_scoped_policies,
  u.n as update_policies_missing_with_check,
  m.n as missing_expected_drevora_policies,
  pp.n as private_buckets_marked_public,
  mb.n as missing_expected_buckets,
  h.n as missing_storage_helpers,
  ae.n as storage_helpers_executable_by_anon,
  case
    when mb.n > 0 then 'FAIL'
    when l.n > 0 then 'FAIL'
    when t.n > 0 then 'FAIL'
    when a.n > 0 then 'FAIL'
    when b.n > 0 then 'FAIL'
    when u.n > 0 then 'FAIL'
    when m.n > 0 then 'FAIL'
    when pp.n > 0 then 'FAIL'
    when h.n > 0 then 'FAIL'
    when ae.n > 0 then 'FAIL'
    else 'PASS'
  end as final_verdict,
  case
    when pp.n > 0
      then 'One or more DREVORA buckets (including worker-avatars) are still public. Apply migration public=false update.'
    when l.n > 0 or t.n > 0 or a.n > 0 or b.n > 0 or m.n > 0 or u.n > 0
      then 'Apply or finish 20260716120000_secure_storage_tenant_policies.sql after review.'
    else 'Storage tenant policies look healthy (private buckets + tenant-bound policies).'
  end as summary_note
from legacy_unsafe l
cross join true_policies t
cross join anon_policies a
cross join bucket_only b
cross join update_missing_check u
cross join missing_expected m
cross join private_public pp
cross join missing_buckets mb
cross join helper_missing h
cross join anon_helper_exec ae;

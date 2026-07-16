-- =============================================================================
-- DREVORA — Guarded single-row consumable company_id backfill
-- File: supabase/migrations/20260716200000_backfill_single_consumable_company_id.sql
-- =============================================================================
-- PURPOSE
--   Set public.consumables.company_id for exactly one legacy row where
--   company_id is NULL but ownership was confirmed by:
--     - receipt Storage path company UUID
--     - exact matching storage.objects row in bucket consumable-receipts
--   (see supabase/diagnostics/20260716_confirm_consumable_ownership.sql results:
--    classification PATH_COMPANY_SUPPORTED).
--
-- TARGET (hard-coded; do not broaden):
--   consumable id: 8b6cdbf4-bda6-4753-8332-024ba575be79
--   company id:    60370bdb-843c-41a8-a751-2326c85f2e85
--
-- SAFETY
--   One atomic DO block. Any failed precondition raises and performs no update.
--   Does NOT move/copy/delete Storage objects.
--   Does NOT change receipt_url, worker_id, vehicle_id, or any other row.
--   Does NOT backfill other NULL company_id consumables.
-- =============================================================================

do $$
declare
  v_consumable_id uuid := '8b6cdbf4-bda6-4753-8332-024ba575be79';
  v_company_id uuid := '60370bdb-843c-41a8-a751-2326c85f2e85';
  v_receipt_url text;
  v_expected_prefix text;
  v_ref_count integer;
  v_object_count integer;
  v_updated integer;
begin
  -- 1) Confirmed company must exist
  if not exists (
    select 1
    from public.companies c
    where c.id = v_company_id
  ) then
    raise exception
      'DREVORA backfill aborted: company % does not exist in public.companies',
      v_company_id;
  end if;

  -- 2) Target consumable must exist; lock only that PK row for the block
  --    Valid PL/pgSQL form: SELECT <exprs> INTO <vars> FROM ... WHERE ... FOR UPDATE;
  select c.receipt_url
  into v_receipt_url
  from public.consumables c
  where c.id = v_consumable_id
  for update;

  if not found then
    raise exception
      'DREVORA backfill aborted: consumable % does not exist',
      v_consumable_id;
  end if;

  -- 3) Current company_id must still be NULL (do not overwrite a non-null value)
  if exists (
    select 1
    from public.consumables c
    where c.id = v_consumable_id
      and c.company_id is not null
  ) then
    raise exception
      'DREVORA backfill aborted: consumable % already has company_id set (expected NULL)',
      v_consumable_id;
  end if;

  -- 4) receipt_url must be a Storage path (not HTTP / signed / blob / data)
  if v_receipt_url is null or trim(v_receipt_url) = '' then
    raise exception
      'DREVORA backfill aborted: consumable % has empty receipt_url',
      v_consumable_id;
  end if;

  v_receipt_url := trim(v_receipt_url);

  if v_receipt_url ~* '^https?://'
     or v_receipt_url ~* '^(blob:|data:)'
     or v_receipt_url ilike '%token=%'
     or v_receipt_url ilike '%X-Amz-%'
     or v_receipt_url ilike '%/object/sign/%'
     or v_receipt_url ilike '%signature=%'
  then
    raise exception
      'DREVORA backfill aborted: consumable % receipt_url is not a plain Storage path',
      v_consumable_id;
  end if;

  -- 5) Exact path structure (exactly four segments):
  --    consumables/<confirmed-company-id>/<target-consumable-id>/<non-empty-filename>
  --    Rejects wrong/leading segments, wrong UUIDs, missing filename, directory-only,
  --    and any 5th segment after the filename.
  v_expected_prefix :=
    'consumables/' || v_company_id::text || '/' || v_consumable_id::text || '/';

  if split_part(v_receipt_url, '/', 1) is distinct from 'consumables'
     or split_part(v_receipt_url, '/', 2) is distinct from v_company_id::text
     or split_part(v_receipt_url, '/', 3) is distinct from v_consumable_id::text
     or nullif(trim(split_part(v_receipt_url, '/', 4)), '') is null
     or nullif(trim(split_part(v_receipt_url, '/', 5)), '') is not null
     or position(v_expected_prefix in v_receipt_url) <> 1
     or length(v_receipt_url) <= length(v_expected_prefix)
  then
    raise exception
      'DREVORA backfill aborted: consumable % receipt_url path structure does not match expected company/consumable prefix',
      v_consumable_id;
  end if;

  -- 6) Exactly one matching Storage object
  select count(*)::integer
  into v_object_count
  from storage.objects o
  where o.bucket_id = 'consumable-receipts'
    and o.name = v_receipt_url;

  if v_object_count is distinct from 1 then
    raise exception
      'DREVORA backfill aborted: expected exactly 1 storage.objects row in consumable-receipts for receipt_url, found %',
      v_object_count;
  end if;

  -- 7) Exactly one consumable row references this receipt_url
  select count(*)::integer
  into v_ref_count
  from public.consumables c
  where c.receipt_url is not null
    and trim(c.receipt_url) = v_receipt_url;

  if v_ref_count is distinct from 1 then
    raise exception
      'DREVORA backfill aborted: expected exactly 1 consumable referencing receipt path, found %',
      v_ref_count;
  end if;

  -- 8) Update only the target row (company_id + updated_at only)
  update public.consumables c
  set
    company_id = v_company_id,
    updated_at = now()
  where c.id = v_consumable_id
    and c.company_id is null
    and c.receipt_url is not null
    and trim(c.receipt_url) = v_receipt_url
    and split_part(trim(c.receipt_url), '/', 1) = 'consumables'
    and split_part(trim(c.receipt_url), '/', 2) = v_company_id::text
    and split_part(trim(c.receipt_url), '/', 3) = v_consumable_id::text
    and nullif(trim(split_part(trim(c.receipt_url), '/', 4)), '') is not null
    and nullif(trim(split_part(trim(c.receipt_url), '/', 5)), '') is null;

  -- 9) Require exactly one updated row
  get diagnostics v_updated = row_count;

  if v_updated is distinct from 1 then
    raise exception
      'DREVORA backfill aborted: expected exactly 1 updated row, got % (no partial apply)',
      v_updated;
  end if;
end;
$$;

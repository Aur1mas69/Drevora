-- =============================================================================
-- DREVORA Storage Security Phase 1 — Tenant-isolated storage.objects policies
-- File: supabase/migrations/20260716120000_secure_storage_tenant_policies.sql
-- =============================================================================
-- REVIEW ONLY — DO NOT APPLY until Application Compatibility Report is green.
-- This migration was prepared for review. It was NOT executed by the authoring agent.
--
-- APPLY GATE (must all be true before production apply):
--   0. Prerequisite: 20260715210000_enable_full_tenant_rls.sql already applied
--      (drevora_auth_* + drevora_vehicle_check_is_worker_editable/final must exist).
--   1. Run supabase/diagnostics/20260716_verify_storage_policies.sql (before).
--   2. Confirm Worker Avatar app uses createSignedUrl (not getPublicUrl).
--   3. Confirm new avatar uploads use canonical UUID-first paths.
--   4. Confirm path layouts below still match production app code.
--   5. Confirm live consumable-receipts bucket-only policies are dropped by name
--      (including "Authenticated users can … consumable receipts").
--   6. Confirm consumable path/company conflicts are understood: helpers require
--      path company UUID = consumables.company_id. Do NOT weaken policies for
--      mismatched objects; remediate path or row data in a later controlled task.
--   7. Re-run diagnostic after apply; expect PASS (including worker-avatars.public=false).
--
-- CURRENT PATH LAYOUTS (from application code — do not guess):
--   worker-avatars:
--     CANONICAL (new uploads):
--       {companyId}/worker-avatars/{workerId}/{timestamp}.{ext}
--     LEGACY (read-only compatibility; slug is NOT a tenant key):
--       {companySlug}/{workerId}/{timestamp}.{ext}
--   vehicle-check-photos:
--     vehicles/{vehicleId}/checks/{checkId}/{itemKey}/{timestamp}-{file}
--     vehicles/{vehicleId}/checks/{checkId}/signature/{timestamp}-worker-signature.jpg
--     No company UUID in path. Policies bind via vehicle_checks.id.
--   consumable-receipts:
--     consumables/{companyId}/{consumableId}/{timestamp}-{file}
--   document-files:
--     documents/{companyId}/{documentId}/{timestamp}-{file}
--   driver-report-files:
--     driver-reports/{companyId}/{reportId}/{timestamp}-{file}
--
-- BUCKET PUBLIC FLAGS (this migration forces private for all five):
--   worker-avatars        public=false
--   vehicle-check-photos  public=false
--   consumable-receipts   public=false
--   document-files        public=false
--   driver-report-files   public=false
--
-- UNSAFE POLICIES REPLACED (bucket-only + anon/authenticated write/read):
--   "worker avatars select|insert|update|delete"
--   "vehicle check photos select|insert|update|delete"
--   "consumable receipts select|insert|update|delete" (repo / non-live names)
--   "Authenticated users can view|upload|update|delete consumable receipts"
--     (live production names — MUST be dropped or tenant policies are defeated)
--   (document-files / driver-report-files had no repo policies — added here)
--
-- IDEMPOTENT: safe to re-run (drop policy if exists / create or replace function).
-- DOES NOT move, rename, or delete storage objects.
--
-- REQUIRES REVIEW (non-blocking for Worker Avatar private-bucket apply):
--   - vehicle-check-photos paths still lack company UUID; policies bind via
--     vehicle_checks.id + vehicle_id. Path rewrite is a later task.
--   - Legacy worker-avatar Storage objects may remain after replace/remove;
--     controlled backfill cleanup is a later task.
--   - Pre-apply diagnostic found consumable path company UUID ≠ row company_id
--     for at least one object. Policies intentionally deny mismatch; fix data later.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Helpers — safe UUID parse + path company extraction
-- -----------------------------------------------------------------------------

create or replace function public.drevora_storage_try_parse_uuid(p_text text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_text is null or length(trim(p_text)) = 0 then
    return null;
  end if;
  if trim(p_text) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return trim(p_text)::uuid;
exception
  when others then
    return null;
end;
$$;

comment on function public.drevora_storage_try_parse_uuid(text) is
  'Returns uuid only for a well-formed UUID string; otherwise NULL. Never casts untrusted text blindly.';

-- Canonical helper: company UUID as FIRST path segment.
-- Returns NULL for current non-canonical layouts (slug / resource-prefix first).
create or replace function public.drevora_storage_path_company_id(p_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select public.drevora_storage_try_parse_uuid(split_part(coalesce(p_name, ''), '/', 1));
$$;

comment on function public.drevora_storage_path_company_id(text) is
  'Canonical tenant path: first segment must be company UUID. NULL if missing/invalid.';

-- Resolve tenant company_id from CURRENT (non-canonical) object paths.
-- SECURITY DEFINER: read record tables for path→tenant binding without RLS dead-ends.
create or replace function public.drevora_storage_object_company_id(
  p_bucket_id text,
  p_name text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_seg1 text := split_part(coalesce(p_name, ''), '/', 1);
  v_seg2 text := split_part(coalesce(p_name, ''), '/', 2);
  v_seg3 text := split_part(coalesce(p_name, ''), '/', 3);
  v_seg4 text := split_part(coalesce(p_name, ''), '/', 4);
  v_company_id uuid;
  v_worker_id uuid;
  v_vehicle_id uuid;
  v_check_id uuid;
  v_record_id uuid;
begin
  if p_bucket_id is null or coalesce(trim(p_name), '') = '' then
    return null;
  end if;

  -- worker-avatars: resolve via path layout + drivers row (never trust slug alone).
  if p_bucket_id = 'worker-avatars' then
    -- Canonical: <company_uuid>/worker-avatars/<worker_uuid>/<filename>
    if v_seg2 = 'worker-avatars' then
      v_company_id := public.drevora_storage_try_parse_uuid(v_seg1);
      v_worker_id := public.drevora_storage_try_parse_uuid(v_seg3);
      if v_company_id is null or v_worker_id is null then
        return null;
      end if;
      select d.company_id into v_company_id
      from public.drivers d
      where d.id = v_worker_id
        and d.company_id = v_company_id
        and d.company_id is not null;
      return v_company_id;
    end if;

    -- Legacy: <companySlug>/<worker_uuid>/<filename> — company from Worker row only.
    v_worker_id := public.drevora_storage_try_parse_uuid(v_seg2);
    if v_worker_id is null then
      return null;
    end if;
    select d.company_id into v_company_id
    from public.drivers d
    where d.id = v_worker_id
      and d.company_id is not null;
    return v_company_id;
  end if;

  -- Do not trust a bare first-segment UUID without a known layout + relational bind.
  -- Current non-avatar buckets use resource-prefix layouts (vehicles/, consumables/, …).

  if p_bucket_id = 'vehicle-check-photos' then
    -- vehicles/{vehicleId}/checks/{checkId}/...
    if v_seg1 is distinct from 'vehicles' or v_seg3 is distinct from 'checks' then
      return null;
    end if;
    v_vehicle_id := public.drevora_storage_try_parse_uuid(v_seg2);
    v_check_id := public.drevora_storage_try_parse_uuid(v_seg4);
    if v_vehicle_id is null or v_check_id is null then
      return null;
    end if;
    select vc.company_id into v_company_id
    from public.vehicle_checks vc
    where vc.id = v_check_id
      and vc.vehicle_id = v_vehicle_id
      and vc.company_id is not null;
    return v_company_id;
  end if;

  if p_bucket_id = 'consumable-receipts' then
    -- consumables/{companyId}/{consumableId}/...
    if v_seg1 is distinct from 'consumables' then
      return null;
    end if;
    v_company_id := public.drevora_storage_try_parse_uuid(v_seg2);
    v_record_id := public.drevora_storage_try_parse_uuid(v_seg3);
    if v_company_id is null or v_record_id is null then
      return null;
    end if;
    if exists (
      select 1
      from public.consumables c
      where c.id = v_record_id
        and c.company_id = v_company_id
    ) then
      return v_company_id;
    end if;
    return null;
  end if;

  if p_bucket_id = 'document-files' then
    -- documents/{companyId}/{documentId}/...
    if v_seg1 is distinct from 'documents' then
      return null;
    end if;
    v_company_id := public.drevora_storage_try_parse_uuid(v_seg2);
    v_record_id := public.drevora_storage_try_parse_uuid(v_seg3);
    if v_company_id is null or v_record_id is null then
      return null;
    end if;
    if exists (
      select 1
      from public.documents d
      where d.id = v_record_id
        and d.company_id = v_company_id
    ) then
      return v_company_id;
    end if;
    return null;
  end if;

  if p_bucket_id = 'driver-report-files' then
    -- driver-reports/{companyId}/{reportId}/...
    if v_seg1 is distinct from 'driver-reports' then
      return null;
    end if;
    v_company_id := public.drevora_storage_try_parse_uuid(v_seg2);
    v_record_id := public.drevora_storage_try_parse_uuid(v_seg3);
    if v_company_id is null or v_record_id is null then
      return null;
    end if;
    if exists (
      select 1
      from public.driver_reports r
      where r.id = v_record_id
        and r.company_id = v_company_id
    ) then
      return v_company_id;
    end if;
    return null;
  end if;

  return null;
end;
$$;

comment on function public.drevora_storage_object_company_id(text, text) is
  'Resolves company_id from storage object path using canonical first-segment UUID or known DREVORA layouts. NULL if unsafe/unresolvable.';

-- -----------------------------------------------------------------------------
-- 2) Resource access helpers (fail closed)
-- -----------------------------------------------------------------------------

-- Canonical Worker Avatar object path (new uploads):
--   <company_uuid>/worker-avatars/<worker_uuid>/<filename>
create or replace function public.drevora_storage_worker_avatar_is_canonical(p_name text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    public.drevora_storage_try_parse_uuid(split_part(coalesce(p_name, ''), '/', 1)) is not null
    and split_part(coalesce(p_name, ''), '/', 2) = 'worker-avatars'
    and public.drevora_storage_try_parse_uuid(split_part(coalesce(p_name, ''), '/', 3)) is not null
    and nullif(trim(split_part(coalesce(p_name, ''), '/', 4)), '') is not null;
$$;

comment on function public.drevora_storage_worker_avatar_is_canonical(text) is
  'True when path is <company_uuid>/worker-avatars/<worker_uuid>/<filename>.';

-- Legacy Worker Avatar object path (read-only compatibility):
--   <companySlug>/<worker_uuid>/<filename>
-- Slug is never used as a tenant key.
create or replace function public.drevora_storage_worker_avatar_is_legacy(p_name text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    not public.drevora_storage_worker_avatar_is_canonical(p_name)
    and nullif(trim(split_part(coalesce(p_name, ''), '/', 1)), '') is not null
    and public.drevora_storage_try_parse_uuid(split_part(coalesce(p_name, ''), '/', 2)) is not null
    and nullif(trim(split_part(coalesce(p_name, ''), '/', 3)), '') is not null;
$$;

comment on function public.drevora_storage_worker_avatar_is_legacy(text) is
  'True for legacy slug-first avatar paths. Slug is not trusted for ownership.';

-- Worker UUID from path: segment 3 (canonical) or segment 2 (legacy). NULL otherwise.
create or replace function public.drevora_storage_worker_avatar_worker_id(p_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when public.drevora_storage_worker_avatar_is_canonical(p_name) then
      public.drevora_storage_try_parse_uuid(split_part(coalesce(p_name, ''), '/', 3))
    when public.drevora_storage_worker_avatar_is_legacy(p_name) then
      public.drevora_storage_try_parse_uuid(split_part(coalesce(p_name, ''), '/', 2))
    else null
  end;
$$;

-- SELECT: office (same company) or Worker (own avatar only).
-- Canonical: path company UUID must match drivers.company_id.
-- Legacy: company from drivers row only (slug ignored).
create or replace function public.drevora_storage_can_select_worker_avatar(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.drivers d
    where d.id = public.drevora_storage_worker_avatar_worker_id(p_name)
      and d.company_id is not null
      and (
        (
          public.drevora_storage_worker_avatar_is_canonical(p_name)
          and d.company_id = public.drevora_storage_try_parse_uuid(
            split_part(coalesce(p_name, ''), '/', 1)
          )
        )
        or public.drevora_storage_worker_avatar_is_legacy(p_name)
      )
      and public.drevora_auth_user_belongs_to_company_id(d.company_id)
      and (
        public.drevora_auth_user_has_office_role_for_company(d.company_id)
        or d.id = public.drevora_auth_user_driver_id()
      )
  );
$$;

-- INSERT/UPDATE/DELETE: office only, CANONICAL paths only.
-- Denies legacy slug-first writes/deletes. Path company UUID must match Worker.company_id.
create or replace function public.drevora_storage_can_write_worker_avatar(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.drevora_storage_worker_avatar_is_canonical(p_name)
    and exists (
      select 1
      from public.drivers d
      where d.id = public.drevora_storage_try_parse_uuid(
          split_part(coalesce(p_name, ''), '/', 3)
        )
        and d.company_id is not null
        and d.company_id = public.drevora_storage_try_parse_uuid(
          split_part(coalesce(p_name, ''), '/', 1)
        )
        and public.drevora_auth_user_has_office_role_for_company(d.company_id)
    );
$$;

create or replace function public.drevora_storage_vehicle_check_ids_from_path(p_name text)
returns table (vehicle_id uuid, check_id uuid)
language sql
immutable
set search_path = public
as $$
  select
    public.drevora_storage_try_parse_uuid(split_part(coalesce(p_name, ''), '/', 2)) as vehicle_id,
    public.drevora_storage_try_parse_uuid(split_part(coalesce(p_name, ''), '/', 4)) as check_id
  where split_part(coalesce(p_name, ''), '/', 1) = 'vehicles'
    and split_part(coalesce(p_name, ''), '/', 3) = 'checks';
$$;

create or replace function public.drevora_storage_path_is_vehicle_check_signature(p_name text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select split_part(coalesce(p_name, ''), '/', 5) = 'signature';
$$;

create or replace function public.drevora_storage_can_select_vehicle_check_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.drevora_storage_vehicle_check_ids_from_path(p_name) p
    inner join public.vehicle_checks vc
      on vc.id = p.check_id
     and vc.vehicle_id = p.vehicle_id
    where vc.company_id is not null
      and (
        public.drevora_auth_user_has_office_role_for_company(vc.company_id)
        or (
          public.drevora_auth_user_belongs_to_company_id(vc.company_id)
          and vc.worker_id = public.drevora_auth_user_driver_id()
        )
      )
  );
$$;

create or replace function public.drevora_storage_can_write_vehicle_check_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.drevora_storage_vehicle_check_ids_from_path(p_name) p
    inner join public.vehicle_checks vc
      on vc.id = p.check_id
     and vc.vehicle_id = p.vehicle_id
    where vc.company_id is not null
      and (
        public.drevora_auth_user_has_office_role_for_company(vc.company_id)
        or (
          public.drevora_auth_user_belongs_to_company_id(vc.company_id)
          and vc.worker_id = public.drevora_auth_user_driver_id()
          and public.drevora_vehicle_check_is_worker_editable(vc.status, vc.signed_at)
        )
      )
  );
$$;

create or replace function public.drevora_storage_can_delete_vehicle_check_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.drevora_storage_vehicle_check_ids_from_path(p_name) p
    inner join public.vehicle_checks vc
      on vc.id = p.check_id
     and vc.vehicle_id = p.vehicle_id
    where vc.company_id is not null
      and (
        public.drevora_auth_user_has_office_role_for_company(vc.company_id)
        or (
          public.drevora_auth_user_belongs_to_company_id(vc.company_id)
          and vc.worker_id = public.drevora_auth_user_driver_id()
          and public.drevora_vehicle_check_is_worker_editable(vc.status, vc.signed_at)
          -- Worker must not delete final signature objects after sign-off path segment
          and not (
            public.drevora_storage_path_is_vehicle_check_signature(p_name)
            and public.drevora_vehicle_check_is_worker_final(vc.status, vc.signed_at)
          )
        )
      )
  );
$$;

create or replace function public.drevora_storage_can_select_consumable_receipt(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.consumables c
    where split_part(coalesce(p_name, ''), '/', 1) = 'consumables'
      and c.id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 3))
      and c.company_id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 2))
      and c.company_id is not null
      and (
        public.drevora_auth_user_has_office_role_for_company(c.company_id)
        or (
          public.drevora_auth_user_belongs_to_company_id(c.company_id)
          and c.worker_id = public.drevora_auth_user_driver_id()
          and c.deleted_at is null
        )
      )
  );
$$;

create or replace function public.drevora_storage_can_write_consumable_receipt(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.consumables c
    where split_part(coalesce(p_name, ''), '/', 1) = 'consumables'
      and c.id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 3))
      and c.company_id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 2))
      and c.company_id is not null
      and (
        public.drevora_auth_user_has_office_role_for_company(c.company_id)
        or (
          public.drevora_auth_user_belongs_to_company_id(c.company_id)
          and c.worker_id = public.drevora_auth_user_driver_id()
          and c.deleted_at is null
          and c.cleaned_at is null
        )
      )
  );
$$;

create or replace function public.drevora_storage_can_select_document_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documents d
    where split_part(coalesce(p_name, ''), '/', 1) = 'documents'
      and d.id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 3))
      and d.company_id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 2))
      and d.company_id is not null
      and (
        public.drevora_auth_user_has_office_role_for_company(d.company_id)
        or (
          public.drevora_auth_user_belongs_to_company_id(d.company_id)
          and d.worker_id = public.drevora_auth_user_driver_id()
        )
      )
  );
$$;

create or replace function public.drevora_storage_can_write_document_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Office manage only (matches documents table RLS).
  select exists (
    select 1
    from public.documents d
    where split_part(coalesce(p_name, ''), '/', 1) = 'documents'
      and d.id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 3))
      and d.company_id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 2))
      and d.company_id is not null
      and public.drevora_auth_user_has_office_role_for_company(d.company_id)
  );
$$;

create or replace function public.drevora_storage_can_select_driver_report_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.driver_reports r
    where split_part(coalesce(p_name, ''), '/', 1) = 'driver-reports'
      and r.id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 3))
      and r.company_id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 2))
      and r.company_id is not null
      and (
        public.drevora_auth_user_has_office_role_for_company(r.company_id)
        or (
          public.drevora_auth_user_belongs_to_company_id(r.company_id)
          and r.worker_id = public.drevora_auth_user_driver_id()
        )
      )
  );
$$;

create or replace function public.drevora_storage_can_write_driver_report_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.driver_reports r
    where split_part(coalesce(p_name, ''), '/', 1) = 'driver-reports'
      and r.id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 3))
      and r.company_id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 2))
      and r.company_id is not null
      and (
        public.drevora_auth_user_has_office_role_for_company(r.company_id)
        or (
          public.drevora_auth_user_belongs_to_company_id(r.company_id)
          and r.worker_id = public.drevora_auth_user_driver_id()
          and r.cleaned_at is null
        )
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- 3) Grants — helpers callable by authenticated (policy evaluation); deny anon
-- -----------------------------------------------------------------------------

revoke all on function public.drevora_storage_try_parse_uuid(text) from public;
revoke all on function public.drevora_storage_path_company_id(text) from public;
revoke all on function public.drevora_storage_object_company_id(text, text) from public;
revoke all on function public.drevora_storage_worker_avatar_is_canonical(text) from public;
revoke all on function public.drevora_storage_worker_avatar_is_legacy(text) from public;
revoke all on function public.drevora_storage_worker_avatar_worker_id(text) from public;
revoke all on function public.drevora_storage_can_select_worker_avatar(text) from public;
revoke all on function public.drevora_storage_can_write_worker_avatar(text) from public;
revoke all on function public.drevora_storage_vehicle_check_ids_from_path(text) from public;
revoke all on function public.drevora_storage_path_is_vehicle_check_signature(text) from public;
revoke all on function public.drevora_storage_can_select_vehicle_check_file(text) from public;
revoke all on function public.drevora_storage_can_write_vehicle_check_file(text) from public;
revoke all on function public.drevora_storage_can_delete_vehicle_check_file(text) from public;
revoke all on function public.drevora_storage_can_select_consumable_receipt(text) from public;
revoke all on function public.drevora_storage_can_write_consumable_receipt(text) from public;
revoke all on function public.drevora_storage_can_select_document_file(text) from public;
revoke all on function public.drevora_storage_can_write_document_file(text) from public;
revoke all on function public.drevora_storage_can_select_driver_report_file(text) from public;
revoke all on function public.drevora_storage_can_write_driver_report_file(text) from public;

grant execute on function public.drevora_storage_try_parse_uuid(text) to authenticated;
grant execute on function public.drevora_storage_path_company_id(text) to authenticated;
grant execute on function public.drevora_storage_object_company_id(text, text) to authenticated;
grant execute on function public.drevora_storage_worker_avatar_is_canonical(text) to authenticated;
grant execute on function public.drevora_storage_worker_avatar_is_legacy(text) to authenticated;
grant execute on function public.drevora_storage_worker_avatar_worker_id(text) to authenticated;
grant execute on function public.drevora_storage_can_select_worker_avatar(text) to authenticated;
grant execute on function public.drevora_storage_can_write_worker_avatar(text) to authenticated;
grant execute on function public.drevora_storage_vehicle_check_ids_from_path(text) to authenticated;
grant execute on function public.drevora_storage_path_is_vehicle_check_signature(text) to authenticated;
grant execute on function public.drevora_storage_can_select_vehicle_check_file(text) to authenticated;
grant execute on function public.drevora_storage_can_write_vehicle_check_file(text) to authenticated;
grant execute on function public.drevora_storage_can_delete_vehicle_check_file(text) to authenticated;
grant execute on function public.drevora_storage_can_select_consumable_receipt(text) to authenticated;
grant execute on function public.drevora_storage_can_write_consumable_receipt(text) to authenticated;
grant execute on function public.drevora_storage_can_select_document_file(text) to authenticated;
grant execute on function public.drevora_storage_can_write_document_file(text) to authenticated;
grant execute on function public.drevora_storage_can_select_driver_report_file(text) to authenticated;
grant execute on function public.drevora_storage_can_write_driver_report_file(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Ensure buckets exist (idempotent) and force private flags
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'worker-avatars',
    'worker-avatars',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'vehicle-check-photos',
    'vehicle-check-photos',
    false,
    3145728,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'consumable-receipts',
    'consumable-receipts',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
  ),
  (
    'document-files',
    'document-files',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'driver-report-files',
    'driver-report-files',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
  )
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
  -- public is forced false below for all DREVORA private buckets (including worker-avatars).

-- Force private: do not leave worker-avatars world-readable via public CDN.
update storage.buckets
set public = false
where id in (
  'worker-avatars',
  'vehicle-check-photos',
  'consumable-receipts',
  'document-files',
  'driver-report-files'
);

-- -----------------------------------------------------------------------------
-- 5) Drop unsafe legacy storage.objects policies
-- -----------------------------------------------------------------------------

drop policy if exists "worker avatars select" on storage.objects;
drop policy if exists "worker avatars insert" on storage.objects;
drop policy if exists "worker avatars update" on storage.objects;
drop policy if exists "worker avatars delete" on storage.objects;

drop policy if exists "vehicle check photos select" on storage.objects;
drop policy if exists "vehicle check photos insert" on storage.objects;
drop policy if exists "vehicle check photos update" on storage.objects;
drop policy if exists "vehicle check photos delete" on storage.objects;

-- Idempotent drops for new policy names (re-apply)
drop policy if exists drevora_storage_worker_avatars_select on storage.objects;
drop policy if exists drevora_storage_worker_avatars_insert on storage.objects;
drop policy if exists drevora_storage_worker_avatars_update on storage.objects;
drop policy if exists drevora_storage_worker_avatars_delete on storage.objects;

drop policy if exists drevora_storage_vehicle_check_photos_select on storage.objects;
drop policy if exists drevora_storage_vehicle_check_photos_insert on storage.objects;
drop policy if exists drevora_storage_vehicle_check_photos_update on storage.objects;
drop policy if exists drevora_storage_vehicle_check_photos_delete on storage.objects;

drop policy if exists drevora_storage_consumable_receipts_select on storage.objects;
drop policy if exists drevora_storage_consumable_receipts_insert on storage.objects;
drop policy if exists drevora_storage_consumable_receipts_update on storage.objects;
drop policy if exists drevora_storage_consumable_receipts_delete on storage.objects;

drop policy if exists drevora_storage_document_files_select on storage.objects;
drop policy if exists drevora_storage_document_files_insert on storage.objects;
drop policy if exists drevora_storage_document_files_update on storage.objects;
drop policy if exists drevora_storage_document_files_delete on storage.objects;

drop policy if exists drevora_storage_driver_report_files_select on storage.objects;
drop policy if exists drevora_storage_driver_report_files_insert on storage.objects;
drop policy if exists drevora_storage_driver_report_files_update on storage.objects;
drop policy if exists drevora_storage_driver_report_files_delete on storage.objects;

-- -----------------------------------------------------------------------------
-- 6) New tenant policies — authenticated only; no anon on private buckets
-- -----------------------------------------------------------------------------

-- ===== worker-avatars (private tenant bucket) =====
-- SELECT: canonical + legacy (relational Worker ownership; slug never trusted).
-- INSERT/UPDATE/DELETE: canonical only, office role for Worker.company_id.
-- UPDATE USING + WITH CHECK both require canonical write → blocks move to other
-- company/worker/legacy path/bucket.
-- Workers cannot INSERT/UPDATE/DELETE. Legacy objects are read-only in Storage.

create policy drevora_storage_worker_avatars_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'worker-avatars'
    and public.drevora_storage_can_select_worker_avatar(name)
  );

create policy drevora_storage_worker_avatars_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'worker-avatars'
    and public.drevora_storage_can_write_worker_avatar(name)
  );

create policy drevora_storage_worker_avatars_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'worker-avatars'
    and public.drevora_storage_can_write_worker_avatar(name)
  )
  with check (
    bucket_id = 'worker-avatars'
    and public.drevora_storage_can_write_worker_avatar(name)
  );

create policy drevora_storage_worker_avatars_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'worker-avatars'
    and public.drevora_storage_can_write_worker_avatar(name)
  );

-- ===== vehicle-check-photos (private compliance) =====

create policy drevora_storage_vehicle_check_photos_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'vehicle-check-photos'
    and public.drevora_storage_can_select_vehicle_check_file(name)
  );

create policy drevora_storage_vehicle_check_photos_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'vehicle-check-photos'
    and public.drevora_storage_can_write_vehicle_check_file(name)
  );

create policy drevora_storage_vehicle_check_photos_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'vehicle-check-photos'
    and public.drevora_storage_can_write_vehicle_check_file(name)
  )
  with check (
    bucket_id = 'vehicle-check-photos'
    and public.drevora_storage_can_write_vehicle_check_file(name)
  );

create policy drevora_storage_vehicle_check_photos_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'vehicle-check-photos'
    and public.drevora_storage_can_delete_vehicle_check_file(name)
  );

-- ===== consumable-receipts =====
-- Drop both historical short names and live "Authenticated users can …" names.
-- Both variants must be removed: permissive policies combine with OR, so any
-- surviving bucket-only policy would defeat the tenant-bound replacements below.
--
-- REQUIRES MANUAL INVESTIGATION BEFORE APPLY: one receipt Storage path company
-- UUID differs from public.consumables.company_id. Do not weaken these policies
-- or add fallback access for that object; remediate path/row data separately.

drop policy if exists "consumable receipts select" on storage.objects;
drop policy if exists "consumable receipts insert" on storage.objects;
drop policy if exists "consumable receipts update" on storage.objects;
drop policy if exists "consumable receipts delete" on storage.objects;

drop policy if exists "Authenticated users can view consumable receipts"
  on storage.objects;
drop policy if exists "Authenticated users can upload consumable receipts"
  on storage.objects;
drop policy if exists "Authenticated users can update consumable receipts"
  on storage.objects;
drop policy if exists "Authenticated users can delete consumable receipts"
  on storage.objects;

create policy drevora_storage_consumable_receipts_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'consumable-receipts'
    and public.drevora_storage_can_select_consumable_receipt(name)
  );

create policy drevora_storage_consumable_receipts_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'consumable-receipts'
    and public.drevora_storage_can_write_consumable_receipt(name)
  );

create policy drevora_storage_consumable_receipts_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'consumable-receipts'
    and public.drevora_storage_can_write_consumable_receipt(name)
  )
  with check (
    bucket_id = 'consumable-receipts'
    and public.drevora_storage_can_write_consumable_receipt(name)
  );

create policy drevora_storage_consumable_receipts_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'consumable-receipts'
    and public.drevora_storage_can_write_consumable_receipt(name)
  );

-- ===== document-files =====

create policy drevora_storage_document_files_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'document-files'
    and public.drevora_storage_can_select_document_file(name)
  );

create policy drevora_storage_document_files_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'document-files'
    and public.drevora_storage_can_write_document_file(name)
  );

create policy drevora_storage_document_files_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'document-files'
    and public.drevora_storage_can_write_document_file(name)
  )
  with check (
    bucket_id = 'document-files'
    and public.drevora_storage_can_write_document_file(name)
  );

create policy drevora_storage_document_files_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'document-files'
    and public.drevora_storage_can_write_document_file(name)
  );

-- ===== driver-report-files =====

create policy drevora_storage_driver_report_files_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'driver-report-files'
    and public.drevora_storage_can_select_driver_report_file(name)
  );

create policy drevora_storage_driver_report_files_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'driver-report-files'
    and public.drevora_storage_can_write_driver_report_file(name)
  );

create policy drevora_storage_driver_report_files_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'driver-report-files'
    and public.drevora_storage_can_write_driver_report_file(name)
  )
  with check (
    bucket_id = 'driver-report-files'
    and public.drevora_storage_can_write_driver_report_file(name)
  );

create policy drevora_storage_driver_report_files_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'driver-report-files'
    and public.drevora_storage_can_write_driver_report_file(name)
  );

-- =============================================================================
-- END — no object moves/deletes. Re-run diagnostic after apply.
-- =============================================================================

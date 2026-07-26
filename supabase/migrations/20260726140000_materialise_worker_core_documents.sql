-- DREVORA — Materialise CPC / D4-Medical / Driving Licence / Tachograph into public.documents
-- File: supabase/migrations/20260726140000_materialise_worker_core_documents.sql
--
-- Review-only; do not auto-apply.
-- Converts eligible synthetic/compliance Worker document rows into real public.documents
-- records with durable provenance, and adds an office-only security-invoker RPC that
-- updates the document and synchronises Worker profile expiry fields atomically.
--
-- Preserves:
--   - all existing documents IDs / rows
--   - worker_compliance_records
--   - drivers expiry columns
--   - soft-delete columns
--   - RLS enabled; documents_office_delete absent; no client DELETE privilege
--
-- No hard DELETE. No Storage operations.
-- New compliance materialisations use independent document UUIDs (never reuse wcr.id).

begin;

-- -----------------------------------------------------------------------------
-- 0) Helpers — canonical type normalisation / status
-- -----------------------------------------------------------------------------
create or replace function public.drevora_normalize_worker_core_document_type(p_type text)
returns text
language sql
immutable
as $$
  select case trim(both from coalesce(p_type, ''))
    when 'Driving Licence' then 'Driving Licence'
    when 'CPC' then 'CPC'
    when 'Tachograph Card' then 'Tachograph Card'
    when 'Tacho Card' then 'Tachograph Card'
    when 'D4 / Medical' then 'D4 / Medical'
    when 'Medical' then 'D4 / Medical'
    when 'Medical Certificate' then 'D4 / Medical'
    else null
  end;
$$;

revoke all on function public.drevora_normalize_worker_core_document_type(text) from public;
grant execute on function public.drevora_normalize_worker_core_document_type(text) to authenticated;

-- Uses current_date — must be STABLE, not IMMUTABLE.
create or replace function public.drevora_worker_core_document_status(p_expiry date)
returns text
language sql
stable
as $$
  select case
    when p_expiry is null then 'no_expiry'
    when p_expiry < current_date then 'expired'
    when p_expiry <= (current_date + 30) then 'expiring_soon'
    else 'valid'
  end;
$$;

revoke all on function public.drevora_worker_core_document_status(date) from public;
grant execute on function public.drevora_worker_core_document_status(date) to authenticated;

-- -----------------------------------------------------------------------------
-- 1) Provenance columns (nullable; reuse if already present)
-- -----------------------------------------------------------------------------
alter table public.documents
  add column if not exists source_kind text null,
  add column if not exists source_key text null,
  add column if not exists source_record_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_source_kind_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_source_kind_check
      check (
        source_kind is null
        or source_kind in ('legacy_worker', 'worker_compliance')
      );
  end if;
end $$;

comment on column public.documents.source_kind is
  'Provenance kind for materialised Worker core documents: legacy_worker | worker_compliance.';
comment on column public.documents.source_key is
  'Stable provenance key. legacy_worker: {worker_id}:{canonical_type}. worker_compliance: compliance uuid text.';
comment on column public.documents.source_record_id is
  'Optional source row id (worker_compliance_records.id when source_kind = worker_compliance).';

-- Idempotent materialisation: one provenance key per company.
create unique index if not exists documents_company_source_provenance_uidx
  on public.documents (company_id, source_kind, source_key)
  where source_kind is not null
    and source_key is not null
    and company_id is not null;

-- Index uses only IMMUTABLE normalize helper (not status / current_date).
create index if not exists documents_worker_core_type_idx
  on public.documents (company_id, worker_id, document_type)
  where applies_to = 'worker'
    and worker_id is not null
    and public.drevora_normalize_worker_core_document_type(document_type) is not null;

-- -----------------------------------------------------------------------------
-- 2) Attach provenance to existing unambiguous public.documents matches
--    Historical rows that already share an ID with compliance are preserved.
-- -----------------------------------------------------------------------------

-- 2a) Compliance-origin rows that already share the compliance UUID (prior backfill)
update public.documents d
set
  source_kind = 'worker_compliance',
  source_key = d.id::text,
  source_record_id = d.id,
  document_type = public.drevora_normalize_worker_core_document_type(d.document_type)
where d.source_kind is null
  and d.applies_to = 'worker'
  and d.company_id is not null
  and d.worker_id is not null
  and public.drevora_normalize_worker_core_document_type(d.document_type) is not null
  and exists (
    select 1
    from public.worker_compliance_records wcr
    where wcr.id = d.id
      and wcr.worker_id = d.worker_id
      and public.drevora_normalize_worker_core_document_type(wcr.document_type)
        = public.drevora_normalize_worker_core_document_type(d.document_type)
  )
  and (
    select count(*)::integer
    from public.documents x
    where x.company_id = d.company_id
      and x.worker_id = d.worker_id
      and x.applies_to = 'worker'
      and public.drevora_normalize_worker_core_document_type(x.document_type)
        = public.drevora_normalize_worker_core_document_type(d.document_type)
  ) = 1;

-- 2b) Unambiguous documents matched to exactly one compliance row by worker + type
update public.documents d
set
  source_kind = 'worker_compliance',
  source_key = wcr.id::text,
  source_record_id = wcr.id,
  document_type = public.drevora_normalize_worker_core_document_type(d.document_type)
from public.worker_compliance_records wcr
where d.source_kind is null
  and d.applies_to = 'worker'
  and d.company_id is not null
  and d.worker_id is not null
  and d.worker_id = wcr.worker_id
  and public.drevora_normalize_worker_core_document_type(d.document_type) is not null
  and public.drevora_normalize_worker_core_document_type(d.document_type)
    = public.drevora_normalize_worker_core_document_type(wcr.document_type)
  and (
    select count(*)::integer
    from public.documents x
    where x.company_id = d.company_id
      and x.worker_id = d.worker_id
      and x.applies_to = 'worker'
      and public.drevora_normalize_worker_core_document_type(x.document_type)
        = public.drevora_normalize_worker_core_document_type(d.document_type)
  ) = 1
  and (
    select count(*)::integer
    from public.worker_compliance_records y
    where y.worker_id = d.worker_id
      and public.drevora_normalize_worker_core_document_type(y.document_type)
        = public.drevora_normalize_worker_core_document_type(d.document_type)
  ) = 1;

-- 2c) Unambiguous documents matched only to a legacy driver expiry field
update public.documents d
set
  source_kind = 'legacy_worker',
  source_key = d.worker_id::text
    || ':'
    || public.drevora_normalize_worker_core_document_type(d.document_type),
  source_record_id = null,
  document_type = public.drevora_normalize_worker_core_document_type(d.document_type)
from public.drivers dr
where d.source_kind is null
  and d.applies_to = 'worker'
  and d.company_id is not null
  and d.worker_id is not null
  and dr.id = d.worker_id
  and dr.company_id = d.company_id
  and public.drevora_normalize_worker_core_document_type(d.document_type) is not null
  and (
    select count(*)::integer
    from public.documents x
    where x.company_id = d.company_id
      and x.worker_id = d.worker_id
      and x.applies_to = 'worker'
      and public.drevora_normalize_worker_core_document_type(x.document_type)
        = public.drevora_normalize_worker_core_document_type(d.document_type)
  ) = 1
  and not exists (
    select 1
    from public.worker_compliance_records wcr
    where wcr.worker_id = d.worker_id
      and public.drevora_normalize_worker_core_document_type(wcr.document_type)
        = public.drevora_normalize_worker_core_document_type(d.document_type)
  )
  and (
    (
      public.drevora_normalize_worker_core_document_type(d.document_type) = 'Driving Licence'
      and dr.driving_licence_expiry is not null
    )
    or (
      public.drevora_normalize_worker_core_document_type(d.document_type) = 'CPC'
      and dr.cpc_expiry is not null
    )
    or (
      public.drevora_normalize_worker_core_document_type(d.document_type) = 'Tachograph Card'
      and dr.driver_card_expiry is not null
    )
    or (
      public.drevora_normalize_worker_core_document_type(d.document_type) = 'D4 / Medical'
      and dr.medical_expiry is not null
    )
  );

-- -----------------------------------------------------------------------------
-- 3) Insert from worker_compliance_records when no matching document exists
--    New rows use an independent documents.id (table default gen_random_uuid()).
--    Compliance UUID is stored only in source_record_id / source_key.
-- -----------------------------------------------------------------------------
insert into public.documents (
  company_id,
  company,
  document_name,
  document_type,
  applies_to,
  worker_id,
  vehicle_id,
  reference_number,
  issue_date,
  expiry_date,
  file_url,
  file_path,
  notes,
  status,
  created_at,
  updated_at,
  source_kind,
  source_key,
  source_record_id
)
select
  dr.company_id,
  coalesce(nullif(trim(dr.company), ''), c.name),
  coalesce(nullif(trim(wcr.document_name), ''), canon.canonical_type),
  canon.canonical_type,
  'worker',
  wcr.worker_id,
  null,
  null::text,
  wcr.issue_date,
  wcr.expiry_date,
  wcr.file_url,
  null,
  wcr.notes,
  public.drevora_worker_core_document_status(wcr.expiry_date),
  coalesce(wcr.created_at, now()),
  coalesce(wcr.updated_at, now()),
  'worker_compliance',
  wcr.id::text,
  wcr.id
from public.worker_compliance_records wcr
inner join public.drivers dr
  on dr.id = wcr.worker_id
inner join lateral (
  select public.drevora_normalize_worker_core_document_type(wcr.document_type) as canonical_type
) canon on canon.canonical_type is not null
left join public.companies c
  on c.id = dr.company_id
where dr.company_id is not null
  -- Exactly one compliance row for this worker + canonical type
  and (
    select count(*)::integer
    from public.worker_compliance_records y
    where y.worker_id = wcr.worker_id
      and public.drevora_normalize_worker_core_document_type(y.document_type) = canon.canonical_type
  ) = 1
  -- No existing document for worker + canonical type (active or soft-deleted)
  and not exists (
    select 1
    from public.documents d
    where d.company_id = dr.company_id
      and d.worker_id = wcr.worker_id
      and d.applies_to = 'worker'
      and public.drevora_normalize_worker_core_document_type(d.document_type) = canon.canonical_type
  )
  -- Provenance key not already materialised
  and not exists (
    select 1
    from public.documents d
    where d.company_id = dr.company_id
      and d.source_kind = 'worker_compliance'
      and d.source_key = wcr.id::text
  )
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 4) Insert from legacy drivers expiry fields when no document / compliance match
-- -----------------------------------------------------------------------------
insert into public.documents (
  company_id,
  company,
  document_name,
  document_type,
  applies_to,
  worker_id,
  vehicle_id,
  reference_number,
  issue_date,
  expiry_date,
  file_url,
  file_path,
  notes,
  status,
  created_at,
  updated_at,
  source_kind,
  source_key,
  source_record_id
)
select
  dr.company_id,
  coalesce(nullif(trim(dr.company), ''), c.name),
  src.canonical_type,
  src.canonical_type,
  'worker',
  dr.id,
  null,
  case
    when src.canonical_type = 'Tachograph Card'
      then nullif(trim(dr.tacho_card_number), '')
    else null
  end,
  null,
  src.expiry_date,
  null,
  null,
  null,
  public.drevora_worker_core_document_status(src.expiry_date),
  now(),
  now(),
  'legacy_worker',
  dr.id::text || ':' || src.canonical_type,
  null
from public.drivers dr
left join public.companies c
  on c.id = dr.company_id
cross join lateral (
  values
    ('Driving Licence', dr.driving_licence_expiry),
    ('CPC', dr.cpc_expiry),
    ('Tachograph Card', dr.driver_card_expiry),
    ('D4 / Medical', dr.medical_expiry)
) as src(canonical_type, expiry_date)
where dr.company_id is not null
  and src.expiry_date is not null
  and not exists (
    select 1
    from public.documents d
    where d.company_id = dr.company_id
      and d.worker_id = dr.id
      and d.applies_to = 'worker'
      and public.drevora_normalize_worker_core_document_type(d.document_type) = src.canonical_type
  )
  and not exists (
    select 1
    from public.worker_compliance_records wcr
    where wcr.worker_id = dr.id
      and public.drevora_normalize_worker_core_document_type(wcr.document_type) = src.canonical_type
  )
  and not exists (
    select 1
    from public.documents d
    where d.company_id = dr.company_id
      and d.source_kind = 'legacy_worker'
      and d.source_key = dr.id::text || ':' || src.canonical_type
  )
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 5) Atomic office save + mandatory Worker expiry synchronisation (security invoker)
-- -----------------------------------------------------------------------------
drop function if exists public.drevora_save_worker_core_document(
  text, uuid, uuid, text, text, uuid, text, date, date, text, text, boolean, boolean
);
drop function if exists public.drevora_save_worker_core_document(
  text, uuid, uuid, text, text, uuid, text, date, date, text, text, boolean
);

create or replace function public.drevora_save_worker_core_document(
  p_mode text,
  p_company_id uuid,
  p_document_id uuid,
  p_document_name text,
  p_document_type text,
  p_worker_id uuid,
  p_reference_number text,
  p_issue_date date,
  p_expiry_date date,
  p_notes text,
  p_file_path text default null,
  p_update_file_path boolean default false
)
returns public.documents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_canonical text;
  v_stored_canonical text;
  v_row public.documents;
  v_existing public.documents;
  v_company_name text;
  v_worker_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_company_id is null then
    raise exception 'company_id is required';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'Not authorised for this company';
  end if;

  if p_mode not in ('create', 'update') then
    raise exception 'Invalid mode';
  end if;

  if p_worker_id is null then
    raise exception 'worker_id is required';
  end if;

  if not public.drevora_driver_in_company(p_worker_id, p_company_id) then
    raise exception 'Worker does not belong to this company';
  end if;

  v_canonical := public.drevora_normalize_worker_core_document_type(p_document_type);
  if v_canonical is null then
    raise exception 'Document type is not a synchronised Worker core type';
  end if;

  select nullif(trim(name), '') into v_company_name
  from public.companies
  where id = p_company_id;

  if p_mode = 'create' then
    v_worker_id := p_worker_id;

    insert into public.documents (
      company_id,
      company,
      document_name,
      document_type,
      applies_to,
      worker_id,
      vehicle_id,
      reference_number,
      issue_date,
      expiry_date,
      file_path,
      notes,
      status
    )
    values (
      p_company_id,
      v_company_name,
      coalesce(nullif(trim(p_document_name), ''), v_canonical),
      v_canonical,
      'worker',
      v_worker_id,
      null,
      nullif(trim(p_reference_number), ''),
      p_issue_date,
      p_expiry_date,
      case when p_update_file_path then p_file_path else null end,
      nullif(trim(p_notes), ''),
      public.drevora_worker_core_document_status(p_expiry_date)
    )
    returning * into v_row;
  else
    if p_document_id is null then
      raise exception 'document_id is required for update';
    end if;

    select *
    into v_existing
    from public.documents d
    where d.id = p_document_id
      and d.company_id = p_company_id
    for update;

    if not found then
      raise exception 'Document could not be updated for your company';
    end if;

    if v_existing.deleted_at is not null then
      raise exception 'Restore this document before editing';
    end if;

    if v_existing.applies_to is distinct from 'worker' then
      raise exception 'Applies to cannot be changed for this document';
    end if;

    v_stored_canonical := public.drevora_normalize_worker_core_document_type(v_existing.document_type);
    if v_stored_canonical is null then
      raise exception 'Document type is not a synchronised Worker core type';
    end if;

    if v_canonical is distinct from v_stored_canonical then
      raise exception 'Document type cannot be changed after creation';
    end if;

    if p_worker_id is distinct from v_existing.worker_id then
      raise exception 'Worker cannot be changed after creation';
    end if;

    v_worker_id := v_existing.worker_id;
    v_canonical := v_stored_canonical;

    update public.documents d
    set
      document_name = coalesce(nullif(trim(p_document_name), ''), v_canonical),
      -- worker_id, document_type, applies_to, and provenance intentionally unchanged
      reference_number = nullif(trim(p_reference_number), ''),
      issue_date = p_issue_date,
      expiry_date = p_expiry_date,
      notes = nullif(trim(p_notes), ''),
      status = public.drevora_worker_core_document_status(p_expiry_date),
      file_path = case
        when p_update_file_path then p_file_path
        else d.file_path
      end,
      updated_at = now()
    where d.id = v_existing.id
      and d.company_id = p_company_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'Document could not be updated for your company';
    end if;
  end if;

  -- Mandatory expiry synchronisation (no caller bypass).
  if v_canonical = 'Driving Licence' then
    update public.drivers
    set driving_licence_expiry = p_expiry_date
    where id = v_worker_id
      and company_id = p_company_id;
  elsif v_canonical = 'CPC' then
    update public.drivers
    set cpc_expiry = p_expiry_date
    where id = v_worker_id
      and company_id = p_company_id;
  elsif v_canonical = 'Tachograph Card' then
    update public.drivers
    set driver_card_expiry = p_expiry_date
    where id = v_worker_id
      and company_id = p_company_id;
  elsif v_canonical = 'D4 / Medical' then
    update public.drivers
    set medical_expiry = p_expiry_date
    where id = v_worker_id
      and company_id = p_company_id;
  end if;

  if not found then
    raise exception 'Worker profile expiry could not be synchronised';
  end if;

  -- Compliance sync: same record, same worker, same company via drivers.
  if v_row.source_kind = 'worker_compliance' and v_row.source_record_id is not null then
    update public.worker_compliance_records wcr
    set
      expiry_date = p_expiry_date,
      updated_at = now()
    from public.drivers dr
    where wcr.id = v_row.source_record_id
      and wcr.worker_id = v_worker_id
      and dr.id = wcr.worker_id
      and dr.company_id = p_company_id;

    if not found then
      raise exception 'Worker compliance expiry could not be synchronised';
    end if;
  end if;

  return v_row;
end;
$$;

revoke all on function public.drevora_save_worker_core_document(
  text, uuid, uuid, text, text, uuid, text, date, date, text, text, boolean
) from public;
grant execute on function public.drevora_save_worker_core_document(
  text, uuid, uuid, text, text, uuid, text, date, date, text, text, boolean
) to authenticated;

-- Preserve hard-delete closure (idempotent; does not reintroduce DELETE).
drop policy if exists documents_office_delete on public.documents;
revoke delete on table public.documents from authenticated;
revoke delete on table public.documents from anon;
revoke delete on table public.documents from public;
grant select, insert, update on table public.documents to authenticated;

commit;

-- -----------------------------------------------------------------------------
-- Validation / diagnostic queries (commented — run before/after apply; outside txn)
-- -----------------------------------------------------------------------------
-- 1) Eligible legacy rows:
-- select dr.company_id, dr.id as worker_id, src.canonical_type, src.expiry_date
-- from public.drivers dr
-- cross join lateral (
--   values
--     ('Driving Licence', dr.driving_licence_expiry),
--     ('CPC', dr.cpc_expiry),
--     ('Tachograph Card', dr.driver_card_expiry),
--     ('D4 / Medical', dr.medical_expiry)
-- ) as src(canonical_type, expiry_date)
-- where dr.company_id is not null and src.expiry_date is not null;
--
-- 2) Eligible compliance rows:
-- select wcr.id, dr.company_id, wcr.worker_id,
--        public.drevora_normalize_worker_core_document_type(wcr.document_type) as canonical_type,
--        wcr.expiry_date
-- from public.worker_compliance_records wcr
-- join public.drivers dr on dr.id = wcr.worker_id
-- where public.drevora_normalize_worker_core_document_type(wcr.document_type) is not null;
--
-- 3) Existing real document matches:
-- select id, company_id, worker_id, document_type, deleted_at, source_kind, source_key, source_record_id
-- from public.documents
-- where applies_to = 'worker'
--   and public.drevora_normalize_worker_core_document_type(document_type) is not null;
--
-- 4) Rows that would be inserted (compliance, no existing worker+type doc / provenance):
-- select wcr.id as compliance_id, dr.company_id, wcr.worker_id,
--        public.drevora_normalize_worker_core_document_type(wcr.document_type) as canonical_type
-- from public.worker_compliance_records wcr
-- join public.drivers dr on dr.id = wcr.worker_id
-- where dr.company_id is not null
--   and public.drevora_normalize_worker_core_document_type(wcr.document_type) is not null
--   and not exists (
--     select 1 from public.documents d
--     where d.company_id = dr.company_id
--       and d.worker_id = wcr.worker_id
--       and d.applies_to = 'worker'
--       and public.drevora_normalize_worker_core_document_type(d.document_type)
--         = public.drevora_normalize_worker_core_document_type(wcr.document_type)
--   )
--   and not exists (
--     select 1 from public.documents d
--     where d.company_id = dr.company_id
--       and d.source_kind = 'worker_compliance'
--       and d.source_key = wcr.id::text
--   );
--
-- 5) Ambiguous rows skipped (multiple documents / compliance per worker+type):
-- select company_id, worker_id,
--        public.drevora_normalize_worker_core_document_type(document_type) as canonical_type,
--        count(*) as document_count
-- from public.documents
-- where applies_to = 'worker'
--   and worker_id is not null
--   and public.drevora_normalize_worker_core_document_type(document_type) is not null
-- group by 1, 2, 3
-- having count(*) > 1;
--
-- select worker_id,
--        public.drevora_normalize_worker_core_document_type(document_type) as canonical_type,
--        count(*) as compliance_count
-- from public.worker_compliance_records
-- where public.drevora_normalize_worker_core_document_type(document_type) is not null
-- group by 1, 2
-- having count(*) > 1;
--
-- 6) Duplicate provenance keys:
-- select company_id, source_kind, source_key, count(*)
-- from public.documents
-- where source_kind is not null and source_key is not null
-- group by 1, 2, 3
-- having count(*) > 1;
--
-- 7) Logical Worker/type duplicates — same as ambiguous documents query above.
--
-- 8) Cross-table ID collisions (historical; report separately from new inserts):
-- select d.id, d.company_id, d.worker_id, d.document_type, d.source_kind, d.source_record_id
-- from public.documents d
-- join public.worker_compliance_records wcr on wcr.id = d.id;
--
-- 9) Newly materialised compliance docs must use independent UUIDs:
-- select d.id as document_id, d.source_record_id as compliance_id
-- from public.documents d
-- where d.source_kind = 'worker_compliance'
--   and d.source_record_id is not null
--   and d.id = d.source_record_id;
-- -- Expected for NEW materialisations: zero rows (historical shared-ID backfills may remain).
-- -- Distinguish historical collisions via query (8). New inserts omit documents.id so default UUID applies.
--
-- 10) Missing company_id / worker_id:
-- select id, company_id, worker_id, document_type, source_kind
-- from public.documents
-- where applies_to = 'worker'
--   and public.drevora_normalize_worker_core_document_type(document_type) is not null
--   and (company_id is null or worker_id is null);
--
-- 11) Post-migration counts by source and type:
-- select coalesce(source_kind, 'manual_or_unlinked') as source_kind, document_type, count(*)
-- from public.documents
-- where applies_to = 'worker'
--   and public.drevora_normalize_worker_core_document_type(document_type) is not null
-- group by 1, 2
-- order by 1, 2;
--
-- 12) RLS enabled:
-- select c.relrowsecurity
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname = 'documents';
-- -- Expected: true
--
-- 13) Zero DELETE policies:
-- select policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'documents' and cmd = 'DELETE';
--
-- 14) Client DELETE privileges false:
-- select
--   has_table_privilege('authenticated', 'public.documents', 'DELETE') as authenticated_can_delete,
--   has_table_privilege('anon', 'public.documents', 'DELETE') as anon_can_delete;
--
-- Status helper volatility:
-- select p.proname, p.provolatile
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'drevora_worker_core_document_status',
--     'drevora_normalize_worker_core_document_type'
--   );
-- -- Expected: status = 's' (STABLE), normalize = 'i' (IMMUTABLE)

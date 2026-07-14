-- =============================================================================
-- DREVORA Phase 2B-3 — Vehicle Check Templates company_id UUID ownership
-- File: supabase/migrations/20260714220000_add_vehicle_check_templates_company_id.sql
-- =============================================================================
-- REVIEW ONLY — do not apply until approved. Do not run automatically.
--
-- Goals:
--   1) Add nullable company_id uuid to public.vehicle_check_templates
--   2) Unambiguous backfill from legacy company TEXT → companies.id
--   3) Leave unresolved / genuinely unscoped templates as company_id NULL
--
-- This migration does NOT:
--   - Enable or rewrite RLS policies (existing company-text RLS stays until a later phase)
--   - Delete, merge, recreate or reset templates
--   - Change template items, order, guidance or Basic DVSA content
--   - Alter historical vehicle_checks / vehicle_check_items
--   - Assign unmatched names (Cardinalis, cordinalis, Sofosmagnatas, unknowns) by guessing
--   - Select the oldest company as a fallback
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Add nullable company_id (idempotent)
--    ON DELETE RESTRICT matches other tenant root tables from Phase 1.
-- -----------------------------------------------------------------------------
alter table public.vehicle_check_templates
  add column if not exists company_id uuid references public.companies (id) on delete restrict;

create index if not exists vehicle_check_templates_company_id_idx
  on public.vehicle_check_templates (company_id);

comment on column public.vehicle_check_templates.company_id is
  'Immutable tenant key for company-owned templates. Legacy company text is transitional only. NULL = unresolved legacy or unscoped template — not automatically treated as public/global.';

-- Preserve existing company text column (transitional compatibility writes / existing RLS).
-- No drop of company text in this migration.

-- -----------------------------------------------------------------------------
-- 2) Dangerous: existing non-null company_id conflicts with unambiguous text resolution
-- -----------------------------------------------------------------------------
do $$
declare
  conflict_count integer := 0;
begin
  select count(*)::integer
  into conflict_count
  from public.vehicle_check_templates t
  where t.company_id is not null
    and public.drevora_resolve_unique_company_id(t.company) is not null
    and t.company_id <> public.drevora_resolve_unique_company_id(t.company);

  if conflict_count > 0 then
    raise exception
      'DREVORA Phase 2B-3 STOP: % vehicle_check_templates row(s) have existing company_id conflicting with unambiguous legacy company text. No templates were deleted or changed. Resolve conflicts before re-running.',
      conflict_count;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3) Dangerous: ambiguous duplicate company names block unique resolution
-- -----------------------------------------------------------------------------
do $$
declare
  ambiguous_name_count integer;
begin
  select count(*)::integer
  into ambiguous_name_count
  from (
    select 1
    from public.companies c
    where nullif(trim(coalesce(c.name, '')), '') is not null
    group by lower(trim(coalesce(c.name, '')))
    having count(*) > 1
  ) ambiguous_names;

  if ambiguous_name_count > 0 then
    raise exception
      'DREVORA Phase 2B-3 STOP: % ambiguous normalised company name(s) in public.companies. Rename/merge duplicates so each lower(trim(name)) is unique, then re-run. Unmatched template company text alone does not block when names are unique.',
      ambiguous_name_count;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4) Safe backfill — only unambiguous company name matches
--    Uses public.drevora_resolve_unique_company_id (Phase 1 helper):
--    returns id only when EXACTLY one companies.name matches (case-insensitive).
-- -----------------------------------------------------------------------------
update public.vehicle_check_templates t
set company_id = public.drevora_resolve_unique_company_id(t.company)
where t.company_id is null
  and nullif(trim(coalesce(t.company, '')), '') is not null
  and public.drevora_resolve_unique_company_id(t.company) is not null;

-- -----------------------------------------------------------------------------
-- 5) Validation report (NOTICE only for unmatched; STOP already raised for ambiguous)
-- -----------------------------------------------------------------------------
do $$
declare
  templates_total integer;
  templates_matched integer;
  templates_unmatched integer;
  templates_null_text integer;
  templates_ambiguous_text integer;
begin
  select count(*)::integer into templates_total from public.vehicle_check_templates;

  select count(*)::integer into templates_matched
  from public.vehicle_check_templates
  where company_id is not null;

  select count(*)::integer into templates_null_text
  from public.vehicle_check_templates
  where company_id is null
    and nullif(trim(coalesce(company, '')), '') is null;

  select count(*)::integer into templates_ambiguous_text
  from public.vehicle_check_templates t
  where t.company_id is null
    and nullif(trim(coalesce(t.company, '')), '') is not null
    and (
      select count(*)::integer
      from public.companies c
      where lower(trim(coalesce(c.name, ''))) = lower(trim(t.company))
    ) > 1;

  templates_unmatched := templates_total - templates_matched;

  raise notice 'DREVORA Phase 2B-3 vehicle_check_templates company_id backfill report';
  raise notice 'total=% matched_company_id=% unmatched_null_company_id=% (null/empty company text=%; would-be ambiguous text=%)',
    templates_total,
    templates_matched,
    templates_unmatched,
    templates_null_text,
    templates_ambiguous_text;
  raise notice 'Unmatched rows left as company_id NULL (not deleted, not auto-assigned).';
  raise notice 'Basic DVSA content is application in-memory fallback + company-owned template items — not identified by a system flag column.';
  raise notice 'RLS policies were NOT changed in this migration (still company-text based until a later phase).';

  -- Defensive: ambiguous text on rows should already be blocked by companies-table uniqueness check.
  if templates_ambiguous_text > 0 then
    raise exception
      'DREVORA Phase 2B-3 STOP: % template row(s) reference ambiguous company text. Fix company name uniqueness first.',
      templates_ambiguous_text;
  end if;

  raise notice 'DREVORA Phase 2B-3 OK: unambiguous matches filled; unresolved templates remain company_id NULL.';
end $$;

notify pgrst, 'reload schema';

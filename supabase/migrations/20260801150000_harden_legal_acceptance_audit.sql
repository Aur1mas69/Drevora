-- Harden legal acceptance audit (constraints, immutability, Admin accept, RPC security).
-- Idempotent. Safe after 20260801140000_legal_documents_and_acceptances.sql.
-- Does NOT drop tables, delete acceptance rows, or create a legal-archive bucket.
--
-- ROLE DECISION (customer Terms + DPA acceptance):
--   company_members roles include Admin, Transport Manager, Supervisor, Planner,
--   Office Staff (office) and Driver (worker). There is NO Owner/Director role.
--   Strongest authorised company role = 'Admin'.
--   Customer Terms + DPA acceptance RPCs require active company_members.role = 'Admin'
--   (exact-one membership pattern) AND confirmed_company_authority = true.
--   Status read remains office-role so TM/Office can see incomplete state;
--   only ACCEPT requires Admin.

begin;

-- -----------------------------------------------------------------------------
-- 0) Preconditions
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.legal_document_versions') is null
     or to_regclass('public.legal_acceptances') is null then
    raise exception 'LEGAL_HARDEN_PRECONDITION: apply 20260801140000_legal_documents_and_acceptances.sql first';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1) Validate canonical seeded document versions (do not alter evidence)
-- -----------------------------------------------------------------------------

do $$
declare
  v_mismatch text;
begin
  select string_agg(
    format(
      '%s@%s (title=%s, date=%s, audience=%s, hash=%s)',
      e.document_type,
      e.version,
      coalesce(v.title, '<missing>'),
      coalesce(v.effective_date::text, '<missing>'),
      coalesce(v.audience, '<missing>'),
      coalesce(v.content_hash, '<missing>')
    ),
    '; '
    order by e.document_type
  )
  into v_mismatch
  from (
    values
      (
        'customer_terms'::text,
        '0.2'::text,
        'DREVORA Customer Terms & Conditions'::text,
        date '2026-08-01',
        'customer_admin'::text,
        '683e5e8fb1aca9bc706a3117d4bc371fc9a3911d5a8a9234e88c09a275168b8e'::text
      ),
      (
        'dpa',
        '0.2',
        'DREVORA Data Processing Agreement',
        date '2026-08-01',
        'customer_admin',
        '1f2bf8a87c60b3155cfea449e968bbabaf964adc18eb6e7574b4b9f3c8d2551b'
      ),
      (
        'privacy_policy',
        '0.2',
        'DREVORA Privacy Policy',
        date '2026-08-01',
        'both',
        'f638026e4c4d1289fdfc87592b7e887006507c2ec313bb7cb5442abc79107597'
      ),
      (
        'worker_terms',
        '0.1',
        'DREVORA Worker Terms of Use',
        date '2026-08-01',
        'worker',
        '996d470e6de922853b3dac9c1ff610a6116cc878acc56de26c98debe43243297'
      )
  ) as e(document_type, version, title, effective_date, audience, content_hash)
  left join public.legal_document_versions v
    on v.document_type = e.document_type
   and v.version = e.version
  where v.id is null
     or v.title is distinct from e.title
     or v.effective_date is distinct from e.effective_date
     or v.audience is distinct from e.audience
     or v.content_hash is distinct from e.content_hash;

  if v_mismatch is not null then
    raise exception
      'LEGAL_HARDEN_SEED_MISMATCH: canonical legal_document_versions differ from expected metadata/hashes (refusing to alter evidence): %',
      v_mismatch;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2) Validate existing legal_acceptances BEFORE adding constraints
--    Raise with counts/details; do not delete or silently fix.
-- -----------------------------------------------------------------------------

do $$
declare
  v_errors text[] := array[]::text[];
  v_n bigint;
  v_sample text;
begin
  select count(*) into v_n
  from public.legal_acceptances la
  where la.document_hash is null
     or la.document_hash !~ '^[a-f0-9]{64}$';
  if v_n > 0 then
    v_errors := v_errors || format('invalid document_hash: %s row(s)', v_n);
  end if;

  select count(*) into v_n
  from public.legal_document_versions v
  where v.content_hash is null
     or v.content_hash !~ '^[a-f0-9]{64}$';
  if v_n > 0 then
    v_errors := v_errors || format('invalid legal_document_versions.content_hash: %s row(s)', v_n);
  end if;

  select count(*) into v_n
  from public.legal_acceptances la
  where char_length(btrim(coalesce(la.accepted_by_name, ''))) = 0;
  if v_n > 0 then
    v_errors := v_errors || format('blank accepted_by_name: %s row(s)', v_n);
  end if;

  select count(*) into v_n
  from public.legal_acceptances la
  where char_length(btrim(coalesce(la.accepted_by_email, ''))) = 0;
  if v_n > 0 then
    v_errors := v_errors || format('blank accepted_by_email: %s row(s)', v_n);
  end if;

  select count(*) into v_n
  from public.legal_acceptances la
  where la.subject_type = 'customer_admin'
    and (
      la.company_id is null
      or la.driver_id is not null
      or la.confirmed_company_authority is not true
    );
  if v_n > 0 then
    select string_agg(la.id::text, ', ' order by la.created_at)
    into v_sample
    from (
      select id, created_at
      from public.legal_acceptances
      where subject_type = 'customer_admin'
        and (
          company_id is null
          or driver_id is not null
          or confirmed_company_authority is not true
        )
      order by created_at
      limit 5
    ) la;
    v_errors := v_errors || format(
      'customer_admin subject_refs invalid: %s row(s); sample ids: %s',
      v_n,
      coalesce(v_sample, '<none>')
    );
  end if;

  select count(*) into v_n
  from public.legal_acceptances la
  where la.subject_type = 'worker'
    and (
      la.company_id is null
      or la.driver_id is null
      or la.confirmed_company_authority is not false
    );
  if v_n > 0 then
    select string_agg(la.id::text, ', ' order by la.created_at)
    into v_sample
    from (
      select id, created_at
      from public.legal_acceptances
      where subject_type = 'worker'
        and (
          company_id is null
          or driver_id is null
          or confirmed_company_authority is not false
        )
      order by created_at
      limit 5
    ) la;
    v_errors := v_errors || format(
      'worker subject_refs invalid: %s row(s); sample ids: %s',
      v_n,
      coalesce(v_sample, '<none>')
    );
  end if;

  select count(*) into v_n
  from public.legal_acceptances la
  where (
    la.document_type in ('customer_terms', 'dpa', 'worker_terms')
    and la.acceptance_action is distinct from 'accepted'
  )
  or (
    la.document_type = 'privacy_policy'
    and la.acceptance_action is distinct from 'acknowledged'
  );
  if v_n > 0 then
    v_errors := v_errors || format('acceptance_action/document_type mismatch: %s row(s)', v_n);
  end if;

  select count(*) into v_n
  from public.legal_acceptances la
  where la.subject_type = 'customer_admin'
    and la.acceptance_source not in (
      'onboarding',
      'trial',
      'subscription',
      'office_login',
      'legal_update'
    );
  if v_n > 0 then
    select string_agg(distinct la.acceptance_source, ', ' order by la.acceptance_source)
    into v_sample
    from public.legal_acceptances la
    where la.subject_type = 'customer_admin'
      and la.acceptance_source not in (
        'onboarding',
        'trial',
        'subscription',
        'office_login',
        'legal_update'
      );
    v_errors := v_errors || format(
      'customer_admin invalid acceptance_source: %s row(s); sources: %s',
      v_n,
      coalesce(v_sample, '<none>')
    );
  end if;

  select count(*) into v_n
  from public.legal_acceptances la
  where la.subject_type = 'worker'
    and la.acceptance_source not in ('worker_first_login', 'legal_update');
  if v_n > 0 then
    select string_agg(distinct la.acceptance_source, ', ' order by la.acceptance_source)
    into v_sample
    from public.legal_acceptances la
    where la.subject_type = 'worker'
      and la.acceptance_source not in ('worker_first_login', 'legal_update');
    v_errors := v_errors || format(
      'worker invalid acceptance_source (original RPC allowed all sources incl. onboarding): %s row(s); sources: %s',
      v_n,
      coalesce(v_sample, '<none>')
    );
  end if;

  select count(*) into v_n
  from (
    select acceptance_batch_id, document_type
    from public.legal_acceptances
    group by acceptance_batch_id, document_type
    having count(*) > 1
  ) dups;
  if v_n > 0 then
    v_errors := v_errors || format(
      'duplicate (acceptance_batch_id, document_type): %s group(s)',
      v_n
    );
  end if;

  if cardinality(v_errors) > 0 then
    raise exception
      'LEGAL_HARDEN_ACCEPTANCE_VALIDATION_FAILED (% issue groups): %',
      cardinality(v_errors),
      array_to_string(v_errors, ' | ');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3) Strengthen legal_document_versions.content_hash check
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'legal_document_versions_content_hash_check'
      and conrelid = 'public.legal_document_versions'::regclass
  ) then
    alter table public.legal_document_versions
      drop constraint legal_document_versions_content_hash_check;
  end if;

  alter table public.legal_document_versions
    add constraint legal_document_versions_content_hash_check check (
      content_hash ~ '^[a-f0-9]{64}$'
    );
end $$;

-- -----------------------------------------------------------------------------
-- 4) Strengthen legal_acceptances constraints + unique (batch, document_type)
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'legal_acceptances_action_for_document_check'
      and conrelid = 'public.legal_acceptances'::regclass
  ) then
    alter table public.legal_acceptances
      drop constraint legal_acceptances_action_for_document_check;
  end if;
  alter table public.legal_acceptances
    add constraint legal_acceptances_action_for_document_check check (
      (
        document_type in ('customer_terms', 'dpa', 'worker_terms')
        and acceptance_action = 'accepted'
      )
      or (
        document_type = 'privacy_policy'
        and acceptance_action = 'acknowledged'
      )
    );

  if exists (
    select 1 from pg_constraint
    where conname = 'legal_acceptances_subject_source_check'
      and conrelid = 'public.legal_acceptances'::regclass
  ) then
    alter table public.legal_acceptances
      drop constraint legal_acceptances_subject_source_check;
  end if;
  alter table public.legal_acceptances
    add constraint legal_acceptances_subject_source_check check (
      (
        subject_type = 'customer_admin'
        and acceptance_source in (
          'onboarding',
          'trial',
          'subscription',
          'office_login',
          'legal_update'
        )
      )
      or (
        subject_type = 'worker'
        and acceptance_source in ('worker_first_login', 'legal_update')
      )
    );

  if exists (
    select 1 from pg_constraint
    where conname = 'legal_acceptances_document_hash_check'
      and conrelid = 'public.legal_acceptances'::regclass
  ) then
    alter table public.legal_acceptances
      drop constraint legal_acceptances_document_hash_check;
  end if;
  alter table public.legal_acceptances
    add constraint legal_acceptances_document_hash_check check (
      document_hash ~ '^[a-f0-9]{64}$'
    );

  if exists (
    select 1 from pg_constraint
    where conname = 'legal_acceptances_accepted_by_name_check'
      and conrelid = 'public.legal_acceptances'::regclass
  ) then
    alter table public.legal_acceptances
      drop constraint legal_acceptances_accepted_by_name_check;
  end if;
  alter table public.legal_acceptances
    add constraint legal_acceptances_accepted_by_name_check check (
      char_length(btrim(accepted_by_name)) > 0
    );

  if exists (
    select 1 from pg_constraint
    where conname = 'legal_acceptances_accepted_by_email_check'
      and conrelid = 'public.legal_acceptances'::regclass
  ) then
    alter table public.legal_acceptances
      drop constraint legal_acceptances_accepted_by_email_check;
  end if;
  alter table public.legal_acceptances
    add constraint legal_acceptances_accepted_by_email_check check (
      char_length(btrim(accepted_by_email)) > 0
    );

  if exists (
    select 1 from pg_constraint
    where conname = 'legal_acceptances_subject_refs_check'
      and conrelid = 'public.legal_acceptances'::regclass
  ) then
    alter table public.legal_acceptances
      drop constraint legal_acceptances_subject_refs_check;
  end if;
  alter table public.legal_acceptances
    add constraint legal_acceptances_subject_refs_check check (
      (
        subject_type = 'customer_admin'
        and company_id is not null
        and driver_id is null
        and confirmed_company_authority = true
      )
      or (
        subject_type = 'worker'
        and company_id is not null
        and driver_id is not null
        and confirmed_company_authority = false
      )
    );

  if not exists (
    select 1 from pg_constraint
    where conname = 'legal_acceptances_batch_document_type_unique'
      and conrelid = 'public.legal_acceptances'::regclass
  ) then
    alter table public.legal_acceptances
      add constraint legal_acceptances_batch_document_type_unique unique (
        acceptance_batch_id,
        document_type
      );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5) Immutability triggers
-- -----------------------------------------------------------------------------

create or replace function public.drevora_legal_acceptances_immutable_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'LEGAL_ACCEPTANCES_IMMUTABLE'
    using errcode = '25006',
          hint = 'legal_acceptances rows cannot be updated or deleted.';
end;
$$;

drop trigger if exists legal_acceptances_immutable_trg on public.legal_acceptances;
create trigger legal_acceptances_immutable_trg
  before update or delete on public.legal_acceptances
  for each row
  execute function public.drevora_legal_acceptances_immutable_guard();

create or replace function public.drevora_legal_document_versions_immutable_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'LEGAL_DOCUMENT_VERSIONS_IMMUTABLE'
      using errcode = '25006',
            hint = 'Published legal_document_versions rows cannot be deleted.';
  end if;

  if old.published_at is not null then
    if new.document_type is distinct from old.document_type
       or new.version is distinct from old.version
       or new.title is distinct from old.title
       or new.effective_date is distinct from old.effective_date
       or new.content_hash is distinct from old.content_hash
       or new.audience is distinct from old.audience
       or new.published_at is distinct from old.published_at
       or new.created_at is distinct from old.created_at
       or new.id is distinct from old.id then
      raise exception 'LEGAL_DOCUMENT_VERSIONS_IMMUTABLE'
        using errcode = '25006',
              hint = 'Published legal document metadata and hashes are immutable (is_current may change).';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists legal_document_versions_immutable_trg on public.legal_document_versions;
create trigger legal_document_versions_immutable_trg
  before update or delete on public.legal_document_versions
  for each row
  execute function public.drevora_legal_document_versions_immutable_guard();

revoke all on function public.drevora_legal_acceptances_immutable_guard() from public;
revoke all on function public.drevora_legal_acceptances_immutable_guard() from anon;
revoke all on function public.drevora_legal_acceptances_immutable_guard() from authenticated;

revoke all on function public.drevora_legal_document_versions_immutable_guard() from public;
revoke all on function public.drevora_legal_document_versions_immutable_guard() from anon;
revoke all on function public.drevora_legal_document_versions_immutable_guard() from authenticated;

-- -----------------------------------------------------------------------------
-- 6) Helpers (Admin role + name resolution + internal helpers)
-- -----------------------------------------------------------------------------

-- Admin-only helper for customer legal ACCEPT.
-- Exact-one active membership, and that membership role must be 'Admin'.
create or replace function public.drevora_auth_user_has_admin_role_for_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_company_id is not null
    and (
      select count(*)::integer
      from public.company_members x
      where x.user_id = auth.uid()
        and x.is_active = true
    ) = 1
    and exists (
      select 1
      from public.company_members cm
      where cm.user_id = auth.uid()
        and cm.is_active = true
        and cm.company_id = p_company_id
        and cm.role = 'Admin'
    );
$$;

comment on function public.drevora_auth_user_has_admin_role_for_company(uuid) is
  'True when auth.uid() has exactly one active membership and that membership role is Admin for the company. Used for customer Terms/DPA acceptance (not status).';

create or replace function public.drevora_company_legal_controller_complete(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and nullif(btrim(coalesce(c.legal_company_name, '')), '') is not null
      and nullif(
        btrim(coalesce(c.business_address_line_1, c.address, '')),
        ''
      ) is not null
      and nullif(btrim(coalesce(c.city, '')), '') is not null
      and nullif(btrim(coalesce(c.postcode, '')), '') is not null
      and nullif(btrim(coalesce(c.country, '')), '') is not null
      and nullif(btrim(coalesce(c.privacy_contact_email, '')), '') is not null
  );
$$;

create or replace function public.drevora_company_legal_entity_snapshot(p_company_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'legal_company_name', c.legal_company_name,
    'business_address_line_1', coalesce(c.business_address_line_1, c.address),
    'business_address_line_2', c.business_address_line_2,
    'city', c.city,
    'county', c.county,
    'postcode', c.postcode,
    'country', c.country,
    'privacy_contact_email', c.privacy_contact_email
  )
  from public.companies c
  where c.id = p_company_id;
$$;

create or replace function public.drevora_resolve_legal_accepted_by_name(
  p_auth_user_id uuid,
  p_driver_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text;
  v_email text;
begin
  if p_auth_user_id is null then
    return null;
  end if;

  select
    coalesce(
      nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name', '')), ''),
      nullif(btrim(coalesce(u.raw_user_meta_data->>'name', '')), '')
    ),
    u.email
  into v_name, v_email
  from auth.users u
  where u.id = p_auth_user_id;

  if v_name is null and p_driver_id is not null then
    select nullif(
      btrim(
        concat_ws(
          ' ',
          nullif(btrim(coalesce(d.first_name, '')), ''),
          nullif(btrim(coalesce(d.last_name, '')), '')
        )
      ),
      ''
    )
    into v_name
    from public.drivers d
    where d.id = p_driver_id;
  end if;

  if v_name is null then
    v_name := nullif(btrim(split_part(coalesce(v_email, ''), '@', 1)), '');
  end if;

  return v_name;
end;
$$;

revoke all on function public.drevora_auth_user_has_admin_role_for_company(uuid) from public;
revoke all on function public.drevora_auth_user_has_admin_role_for_company(uuid) from anon;
revoke all on function public.drevora_auth_user_has_admin_role_for_company(uuid) from authenticated;

revoke all on function public.drevora_company_legal_controller_complete(uuid) from public;
revoke all on function public.drevora_company_legal_controller_complete(uuid) from anon;
revoke all on function public.drevora_company_legal_controller_complete(uuid) from authenticated;

revoke all on function public.drevora_company_legal_entity_snapshot(uuid) from public;
revoke all on function public.drevora_company_legal_entity_snapshot(uuid) from anon;
revoke all on function public.drevora_company_legal_entity_snapshot(uuid) from authenticated;

revoke all on function public.drevora_resolve_legal_accepted_by_name(uuid, uuid) from public;
revoke all on function public.drevora_resolve_legal_accepted_by_name(uuid, uuid) from anon;
revoke all on function public.drevora_resolve_legal_accepted_by_name(uuid, uuid) from authenticated;

-- -----------------------------------------------------------------------------
-- 7) Accept RPCs (CREATE OR REPLACE)
-- -----------------------------------------------------------------------------

create or replace function public.drevora_accept_customer_legal_documents(
  p_company_id uuid,
  p_confirmed_authority boolean,
  p_accept_customer_terms boolean,
  p_accept_dpa boolean,
  p_acknowledge_privacy boolean,
  p_accepted_by_name text, -- deprecated: ignored; name resolved server-side
  p_acceptance_source text,
  p_platform text,
  p_route text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_accepted_by_name text;
  v_batch_id uuid := gen_random_uuid();
  v_accepted_at timestamptz := now();
  v_snapshot jsonb;
  v_terms public.legal_document_versions%rowtype;
  v_dpa public.legal_document_versions%rowtype;
  v_privacy public.legal_document_versions%rowtype;
  v_docs jsonb;
begin
  perform p_accepted_by_name;

  if v_uid is null then
    raise exception 'LEGAL_ACCEPT_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  if p_company_id is null then
    raise exception 'LEGAL_ACCEPT_INVALID'
      using errcode = '22023',
            hint = 'company_id is required.';
  end if;

  if not public.drevora_auth_user_belongs_to_company_id(p_company_id) then
    raise exception 'LEGAL_ACCEPT_FORBIDDEN'
      using errcode = '42501',
            hint = 'Company membership is required.';
  end if;

  if not public.drevora_auth_user_has_admin_role_for_company(p_company_id) then
    raise exception 'LEGAL_ACCEPT_FORBIDDEN'
      using errcode = '42501',
            hint = 'Admin role for this company is required to accept customer legal documents.';
  end if;

  if coalesce(p_confirmed_authority, false) is not true
     or coalesce(p_accept_customer_terms, false) is not true
     or coalesce(p_accept_dpa, false) is not true
     or coalesce(p_acknowledge_privacy, false) is not true then
    raise exception 'LEGAL_ACCEPT_INCOMPLETE'
      using errcode = '22023',
            hint = 'Authority confirmation and all three document acceptances are required.';
  end if;

  if p_acceptance_source is null
     or p_acceptance_source not in (
       'onboarding',
       'trial',
       'subscription',
       'office_login',
       'legal_update'
     ) then
    raise exception 'LEGAL_ACCEPT_INVALID'
      using errcode = '22023',
            hint = 'acceptance_source is invalid for customer acceptance.';
  end if;

  if p_platform is null or p_platform not in ('android', 'web', 'pwa') then
    raise exception 'LEGAL_ACCEPT_INVALID'
      using errcode = '22023',
            hint = 'platform is invalid.';
  end if;

  if not public.drevora_company_legal_controller_complete(p_company_id) then
    raise exception 'LEGAL_ACCEPT_CONTROLLER_INCOMPLETE'
      using errcode = '22023',
            hint = 'Company legal controller details are incomplete.';
  end if;

  select u.email
  into v_email
  from auth.users u
  where u.id = v_uid;

  if nullif(btrim(coalesce(v_email, '')), '') is null then
    raise exception 'LEGAL_ACCEPT_INVALID'
      using errcode = '22023',
            hint = 'Authenticated user email is required.';
  end if;

  v_accepted_by_name := public.drevora_resolve_legal_accepted_by_name(v_uid, null);
  if nullif(btrim(coalesce(v_accepted_by_name, '')), '') is null then
    raise exception 'LEGAL_ACCEPT_INVALID'
      using errcode = '22023',
            hint = 'Unable to resolve accepted_by_name from authenticated user.';
  end if;

  select *
  into v_terms
  from public.legal_document_versions
  where document_type = 'customer_terms'
    and is_current = true;

  if not found then
    raise exception 'LEGAL_ACCEPT_MISSING_CURRENT'
      using errcode = 'P0001',
            hint = 'Current customer_terms version is missing.';
  end if;

  select *
  into v_dpa
  from public.legal_document_versions
  where document_type = 'dpa'
    and is_current = true;

  if not found then
    raise exception 'LEGAL_ACCEPT_MISSING_CURRENT'
      using errcode = 'P0001',
            hint = 'Current dpa version is missing.';
  end if;

  select *
  into v_privacy
  from public.legal_document_versions
  where document_type = 'privacy_policy'
    and is_current = true;

  if not found then
    raise exception 'LEGAL_ACCEPT_MISSING_CURRENT'
      using errcode = 'P0001',
            hint = 'Current privacy_policy version is missing.';
  end if;

  v_snapshot := public.drevora_company_legal_entity_snapshot(p_company_id);

  insert into public.legal_acceptances (
    acceptance_batch_id,
    document_version_id,
    document_type,
    document_version,
    document_hash,
    subject_type,
    company_id,
    driver_id,
    accepted_by_auth_user_id,
    accepted_by_name,
    accepted_by_email,
    confirmed_company_authority,
    acceptance_action,
    acceptance_source,
    platform,
    route,
    user_agent,
    legal_entity_snapshot,
    accepted_at
  ) values
    (
      v_batch_id,
      v_terms.id,
      v_terms.document_type,
      v_terms.version,
      v_terms.content_hash,
      'customer_admin',
      p_company_id,
      null,
      v_uid,
      btrim(v_accepted_by_name),
      btrim(v_email),
      true,
      'accepted',
      p_acceptance_source,
      p_platform,
      p_route,
      p_user_agent,
      v_snapshot,
      v_accepted_at
    ),
    (
      v_batch_id,
      v_dpa.id,
      v_dpa.document_type,
      v_dpa.version,
      v_dpa.content_hash,
      'customer_admin',
      p_company_id,
      null,
      v_uid,
      btrim(v_accepted_by_name),
      btrim(v_email),
      true,
      'accepted',
      p_acceptance_source,
      p_platform,
      p_route,
      p_user_agent,
      v_snapshot,
      v_accepted_at
    ),
    (
      v_batch_id,
      v_privacy.id,
      v_privacy.document_type,
      v_privacy.version,
      v_privacy.content_hash,
      'customer_admin',
      p_company_id,
      null,
      v_uid,
      btrim(v_accepted_by_name),
      btrim(v_email),
      true,
      'acknowledged',
      p_acceptance_source,
      p_platform,
      p_route,
      p_user_agent,
      v_snapshot,
      v_accepted_at
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'document_type', la.document_type,
        'document_version', la.document_version,
        'document_hash', la.document_hash,
        'document_version_id', la.document_version_id,
        'acceptance_action', la.acceptance_action
      )
      order by la.document_type
    ),
    '[]'::jsonb
  )
  into v_docs
  from public.legal_acceptances la
  where la.acceptance_batch_id = v_batch_id;

  return jsonb_build_object(
    'acceptance_batch_id', v_batch_id,
    'accepted_at', v_accepted_at,
    'documents', v_docs
  );
end;
$$;

create or replace function public.drevora_accept_worker_legal_documents(
  p_company_id uuid,
  p_accept_worker_terms boolean,
  p_acknowledge_privacy boolean,
  p_accepted_by_name text, -- deprecated: ignored; name resolved server-side
  p_acceptance_source text,
  p_platform text,
  p_route text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_driver_id uuid := public.drevora_auth_user_driver_id();
  v_email text;
  v_accepted_by_name text;
  v_batch_id uuid := gen_random_uuid();
  v_accepted_at timestamptz := now();
  v_snapshot jsonb;
  v_terms public.legal_document_versions%rowtype;
  v_privacy public.legal_document_versions%rowtype;
  v_docs jsonb;
begin
  perform p_accepted_by_name;

  if v_uid is null then
    raise exception 'LEGAL_ACCEPT_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  if p_company_id is null then
    raise exception 'LEGAL_ACCEPT_INVALID'
      using errcode = '22023',
            hint = 'company_id is required.';
  end if;

  if v_driver_id is null then
    raise exception 'LEGAL_ACCEPT_FORBIDDEN'
      using errcode = '42501',
            hint = 'Worker driver identity is required.';
  end if;

  if not public.drevora_auth_user_belongs_to_company_id(p_company_id) then
    raise exception 'LEGAL_ACCEPT_FORBIDDEN'
      using errcode = '42501',
            hint = 'Company membership is required.';
  end if;

  if not public.drevora_driver_in_company(v_driver_id, p_company_id) then
    raise exception 'LEGAL_ACCEPT_FORBIDDEN'
      using errcode = '42501',
            hint = 'Driver must belong to the company.';
  end if;

  if coalesce(p_accept_worker_terms, false) is not true
     or coalesce(p_acknowledge_privacy, false) is not true then
    raise exception 'LEGAL_ACCEPT_INCOMPLETE'
      using errcode = '22023',
            hint = 'Worker terms acceptance and privacy acknowledgement are required.';
  end if;

  if p_acceptance_source is null
     or p_acceptance_source not in (
       'worker_first_login',
       'legal_update'
     ) then
    raise exception 'LEGAL_ACCEPT_INVALID'
      using errcode = '22023',
            hint = 'acceptance_source is invalid for worker acceptance.';
  end if;

  if p_platform is null or p_platform not in ('android', 'web', 'pwa') then
    raise exception 'LEGAL_ACCEPT_INVALID'
      using errcode = '22023',
            hint = 'platform is invalid.';
  end if;

  select u.email
  into v_email
  from auth.users u
  where u.id = v_uid;

  if nullif(btrim(coalesce(v_email, '')), '') is null then
    raise exception 'LEGAL_ACCEPT_INVALID'
      using errcode = '22023',
            hint = 'Authenticated user email is required.';
  end if;

  v_accepted_by_name := public.drevora_resolve_legal_accepted_by_name(v_uid, v_driver_id);
  if nullif(btrim(coalesce(v_accepted_by_name, '')), '') is null then
    raise exception 'LEGAL_ACCEPT_INVALID'
      using errcode = '22023',
            hint = 'Unable to resolve accepted_by_name from authenticated user/driver.';
  end if;

  select *
  into v_terms
  from public.legal_document_versions
  where document_type = 'worker_terms'
    and is_current = true;

  if not found then
    raise exception 'LEGAL_ACCEPT_MISSING_CURRENT'
      using errcode = 'P0001',
            hint = 'Current worker_terms version is missing.';
  end if;

  select *
  into v_privacy
  from public.legal_document_versions
  where document_type = 'privacy_policy'
    and is_current = true;

  if not found then
    raise exception 'LEGAL_ACCEPT_MISSING_CURRENT'
      using errcode = 'P0001',
            hint = 'Current privacy_policy version is missing.';
  end if;

  v_snapshot := coalesce(
    public.drevora_company_legal_entity_snapshot(p_company_id),
    '{}'::jsonb
  );

  insert into public.legal_acceptances (
    acceptance_batch_id,
    document_version_id,
    document_type,
    document_version,
    document_hash,
    subject_type,
    company_id,
    driver_id,
    accepted_by_auth_user_id,
    accepted_by_name,
    accepted_by_email,
    confirmed_company_authority,
    acceptance_action,
    acceptance_source,
    platform,
    route,
    user_agent,
    legal_entity_snapshot,
    accepted_at
  ) values
    (
      v_batch_id,
      v_terms.id,
      v_terms.document_type,
      v_terms.version,
      v_terms.content_hash,
      'worker',
      p_company_id,
      v_driver_id,
      v_uid,
      btrim(v_accepted_by_name),
      btrim(v_email),
      false,
      'accepted',
      p_acceptance_source,
      p_platform,
      p_route,
      p_user_agent,
      v_snapshot,
      v_accepted_at
    ),
    (
      v_batch_id,
      v_privacy.id,
      v_privacy.document_type,
      v_privacy.version,
      v_privacy.content_hash,
      'worker',
      p_company_id,
      v_driver_id,
      v_uid,
      btrim(v_accepted_by_name),
      btrim(v_email),
      false,
      'acknowledged',
      p_acceptance_source,
      p_platform,
      p_route,
      p_user_agent,
      v_snapshot,
      v_accepted_at
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'document_type', la.document_type,
        'document_version', la.document_version,
        'document_hash', la.document_hash,
        'document_version_id', la.document_version_id,
        'acceptance_action', la.acceptance_action
      )
      order by la.document_type
    ),
    '[]'::jsonb
  )
  into v_docs
  from public.legal_acceptances la
  where la.acceptance_batch_id = v_batch_id;

  return jsonb_build_object(
    'acceptance_batch_id', v_batch_id,
    'accepted_at', v_accepted_at,
    'documents', v_docs
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8) Status RPCs (CREATE OR REPLACE)
-- -----------------------------------------------------------------------------

create or replace function public.drevora_get_customer_legal_status(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'LEGAL_STATUS_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  if p_company_id is null then
    raise exception 'LEGAL_STATUS_INVALID'
      using errcode = '22023',
            hint = 'company_id is required.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'LEGAL_STATUS_FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  select jsonb_build_object(
    'company_id', p_company_id,
    'company_legal_complete', public.drevora_company_legal_controller_complete(p_company_id),
    'missing_legal_fields', (
      select coalesce(jsonb_agg(f order by f), '[]'::jsonb)
      from (
        select unnest(
          array_remove(
            array[
              case when nullif(btrim(coalesce(c.legal_company_name, '')), '') is null
                then 'Legal company name' end,
              case when nullif(btrim(coalesce(c.business_address_line_1, c.address, '')), '') is null
                then 'Business address' end,
              case when nullif(btrim(coalesce(c.city, '')), '') is null
                then 'City' end,
              case when nullif(btrim(coalesce(c.postcode, '')), '') is null
                then 'Postcode' end,
              case when nullif(btrim(coalesce(c.country, '')), '') is null
                then 'Country' end,
              case when nullif(btrim(coalesce(c.privacy_contact_email, '')), '') is null
                then 'Privacy contact email' end
            ],
            null
          )
        ) as f
        from public.companies c
        where c.id = p_company_id
      ) missing
    ),
    'legal_entity', coalesce(
      public.drevora_company_legal_entity_snapshot(p_company_id),
      '{}'::jsonb
    ),
    'documents', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'document_type', cur.document_type,
            'version', cur.version,
            'document_version_id', cur.id,
            'content_hash', cur.content_hash,
            'title', cur.title,
            'effective_date', cur.effective_date,
            'required', true,
            'is_satisfied', (
              latest.document_version_id is not null
              and latest.document_version_id = cur.id
              and latest.document_hash is not distinct from cur.content_hash
              and latest.acceptance_action = case
                when cur.document_type = 'privacy_policy' then 'acknowledged'
                else 'accepted'
              end
              and latest.confirmed_company_authority is true
            ),
            'accepted_at', latest.accepted_at,
            'accepted_by_name', latest.accepted_by_name,
            'accepted_by_email', latest.accepted_by_email,
            'acceptance_batch_id', latest.acceptance_batch_id,
            'acceptance_action', latest.acceptance_action
          )
          order by
            case cur.document_type
              when 'customer_terms' then 1
              when 'dpa' then 2
              when 'privacy_policy' then 3
              else 9
            end
        )
        from public.legal_document_versions cur
        left join lateral (
          select la.document_version_id,
                 la.document_hash,
                 la.accepted_at,
                 la.accepted_by_name,
                 la.accepted_by_email,
                 la.acceptance_batch_id,
                 la.acceptance_action,
                 la.confirmed_company_authority
          from public.legal_acceptances la
          where la.company_id = p_company_id
            and la.subject_type = 'customer_admin'
            and la.document_type = cur.document_type
          order by la.accepted_at desc, la.created_at desc
          limit 1
        ) latest on true
        where cur.is_current = true
          and cur.document_type in ('customer_terms', 'dpa', 'privacy_policy')
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.drevora_get_worker_legal_status(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_driver_id uuid := public.drevora_auth_user_driver_id();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'LEGAL_STATUS_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  if p_company_id is null then
    raise exception 'LEGAL_STATUS_INVALID'
      using errcode = '22023',
            hint = 'company_id is required.';
  end if;

  if v_driver_id is null then
    raise exception 'LEGAL_STATUS_FORBIDDEN'
      using errcode = '42501',
            hint = 'Worker driver identity is required.';
  end if;

  if not public.drevora_auth_user_belongs_to_company_id(p_company_id) then
    raise exception 'LEGAL_STATUS_FORBIDDEN'
      using errcode = '42501',
            hint = 'Company membership is required.';
  end if;

  if not public.drevora_driver_in_company(v_driver_id, p_company_id) then
    raise exception 'LEGAL_STATUS_FORBIDDEN'
      using errcode = '42501',
            hint = 'Driver must belong to the company.';
  end if;

  select jsonb_build_object(
    'company_id', p_company_id,
    'driver_id', v_driver_id,
    'company_privacy_notice', (
      select jsonb_build_object(
        'url', c.worker_privacy_notice_url,
        'content', c.worker_privacy_notice_content,
        'version', c.worker_privacy_notice_version,
        'updated_at', c.worker_privacy_notice_updated_at
      )
      from public.companies c
      where c.id = p_company_id
    ),
    'documents', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'document_type', cur.document_type,
            'version', cur.version,
            'document_version_id', cur.id,
            'content_hash', cur.content_hash,
            'title', cur.title,
            'effective_date', cur.effective_date,
            'required', true,
            'is_satisfied', (
              latest.document_version_id is not null
              and latest.document_version_id = cur.id
              and latest.document_hash is not distinct from cur.content_hash
              and latest.acceptance_action = case
                when cur.document_type = 'privacy_policy' then 'acknowledged'
                else 'accepted'
              end
              and latest.confirmed_company_authority is false
            ),
            'accepted_at', latest.accepted_at,
            'accepted_by_name', latest.accepted_by_name,
            'accepted_by_email', latest.accepted_by_email,
            'acceptance_batch_id', latest.acceptance_batch_id,
            'acceptance_action', latest.acceptance_action
          )
          order by
            case cur.document_type
              when 'worker_terms' then 1
              when 'privacy_policy' then 2
              else 9
            end
        )
        from public.legal_document_versions cur
        left join lateral (
          select la.document_version_id,
                 la.document_hash,
                 la.accepted_at,
                 la.accepted_by_name,
                 la.accepted_by_email,
                 la.acceptance_batch_id,
                 la.acceptance_action,
                 la.confirmed_company_authority
          from public.legal_acceptances la
          where la.company_id = p_company_id
            and la.driver_id = v_driver_id
            and la.subject_type = 'worker'
            and la.document_type = cur.document_type
          order by la.accepted_at desc, la.created_at desc
          limit 1
        ) latest on true
        where cur.is_current = true
          and cur.document_type in ('worker_terms', 'privacy_policy')
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9) RPC grants (public RPCs authenticated-only; helpers revoked)
-- -----------------------------------------------------------------------------

revoke all on function public.drevora_accept_customer_legal_documents(
  uuid, boolean, boolean, boolean, boolean, text, text, text, text, text
) from public;
revoke all on function public.drevora_accept_customer_legal_documents(
  uuid, boolean, boolean, boolean, boolean, text, text, text, text, text
) from anon;
grant execute on function public.drevora_accept_customer_legal_documents(
  uuid, boolean, boolean, boolean, boolean, text, text, text, text, text
) to authenticated;

revoke all on function public.drevora_accept_worker_legal_documents(
  uuid, boolean, boolean, text, text, text, text, text
) from public;
revoke all on function public.drevora_accept_worker_legal_documents(
  uuid, boolean, boolean, text, text, text, text, text
) from anon;
grant execute on function public.drevora_accept_worker_legal_documents(
  uuid, boolean, boolean, text, text, text, text, text
) to authenticated;

revoke all on function public.drevora_get_customer_legal_status(uuid) from public;
revoke all on function public.drevora_get_customer_legal_status(uuid) from anon;
grant execute on function public.drevora_get_customer_legal_status(uuid) to authenticated;

revoke all on function public.drevora_get_worker_legal_status(uuid) from public;
revoke all on function public.drevora_get_worker_legal_status(uuid) from anon;
grant execute on function public.drevora_get_worker_legal_status(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

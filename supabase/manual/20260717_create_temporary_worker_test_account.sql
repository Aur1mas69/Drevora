-- =============================================================================
-- DREVORA — MANUAL / REVIEW ONLY
-- File: supabase/manual/20260717_create_temporary_worker_test_account.sql
-- =============================================================================
-- Temporary Worker test data for Storage / Worker identity checks.
--
-- The Auth user was created manually in Supabase Authentication.
-- This script only links that existing Auth user to:
--   1) one public.drivers Worker row
--   2) one public.company_members membership row (role Driver, active)
--
-- DO NOT:
--   - include this file in production migration execution or db push
--   - run automatically via supabase db push / migrate
--   - modify Auth users, Storage, policies, buckets or helpers from this file
--
-- Cleanup later (correct order):
--   1) delete public.company_members for this user_id
--   2) delete public.drivers for this email / driver id
--   3) delete auth.users for this user_id (Auth UI or controlled Auth admin)
-- =============================================================================

do $$
declare
  c_user_id constant uuid := '0e62d5c5-711e-4fd0-bed7-5628a19fca7a'::uuid;
  c_email constant text := 'auriiuxxx@gmail.com';
  c_company_id constant uuid := '60370bdb-843c-41a8-a751-2326c85f2e85'::uuid;
  c_company_name constant text := 'Jagstransltd';
  c_role constant text := 'Driver';
  c_first_name constant text := 'Temporary';
  c_last_name constant text := 'Worker Test';

  v_auth_email text;
  v_company_name text;
  v_driver_id uuid;
  v_membership_id uuid;
  v_insert_count integer;
  v_driver_count integer;
  v_membership_count integer;
  v_active_membership_count integer;
  v_identity_match_count integer;
  v_role_valid boolean;
begin
  -- ---------------------------------------------------------------------------
  -- Pre-insert guards (fail-closed)
  -- ---------------------------------------------------------------------------

  -- 1) Exact Auth user exists
  select lower(trim(u.email))
  into v_auth_email
  from auth.users u
  where u.id = c_user_id;

  if v_auth_email is null then
    raise exception
      'STOP: Auth user % not found. Create the Auth user manually first; this script does not create Auth users.',
      c_user_id;
  end if;

  -- 2) Normalised Auth email must match
  if v_auth_email <> lower(trim(c_email)) then
    raise exception
      'STOP: Auth user email mismatch. expected %, found %.',
      lower(trim(c_email)),
      v_auth_email;
  end if;

  -- 3) Exact company exists and name is Jagstransltd
  select c.name
  into v_company_name
  from public.companies c
  where c.id = c_company_id;

  if v_company_name is null then
    raise exception
      'STOP: company % not found.',
      c_company_id;
  end if;

  if lower(trim(v_company_name)) <> lower(trim(c_company_name)) then
    raise exception
      'STOP: company name mismatch. expected %, found %.',
      c_company_name,
      v_company_name;
  end if;

  -- 4) No driver already exists with this normalised email
  if exists (
    select 1
    from public.drivers d
    where lower(trim(coalesce(d.email, ''))) = lower(trim(c_email))
  ) then
    raise exception
      'STOP: a public.drivers row already exists for email %.',
      lower(trim(c_email));
  end if;

  -- 5) No company_members row already exists for this user
  if exists (
    select 1
    from public.company_members cm
    where cm.user_id = c_user_id
  ) then
    raise exception
      'STOP: a public.company_members row already exists for user_id %.',
      c_user_id;
  end if;

  -- 6) No conflicting active membership exists for this Auth user
  select count(*)::integer
  into v_active_membership_count
  from public.company_members cm
  where cm.user_id = c_user_id
    and cm.is_active is true;

  if v_active_membership_count <> 0 then
    raise exception
      'STOP: Auth user % already has % active company_members row(s). Exact-one membership is required.',
      c_user_id,
      v_active_membership_count;
  end if;

  -- 7) Role value Driver is valid for both tables
  -- company_members: enforced by company_members_role_check
  -- drivers.role: same vocabulary; default is Driver; no separate enum table
  v_role_valid := c_role = any (
    array[
      'Admin',
      'Driver',
      'Yardman',
      'Cleaner',
      'Supervisor',
      'Mechanic',
      'Transport Manager',
      'Planner',
      'Office Staff',
      'Warehouse',
      'Other'
    ]::text[]
  );

  if not v_role_valid or c_role <> 'Driver' then
    raise exception
      'STOP: role % is not a valid Worker role for this script (required: Driver).',
      c_role;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.company_members'::regclass
      and conname = 'company_members_role_check'
      and pg_get_constraintdef(oid) ilike '%Driver%'
  ) then
    raise exception
      'STOP: company_members_role_check missing or does not allow Driver.';
  end if;

  -- ---------------------------------------------------------------------------
  -- Inserts (exactly one drivers row, then exactly one company_members row)
  -- drivers.id uses default gen_random_uuid(); worker_code left unset so the
  -- existing before-insert trigger may generate it when present.
  -- ---------------------------------------------------------------------------

  insert into public.drivers (
    first_name,
    last_name,
    email,
    company_id,
    company,
    role
  )
  values (
    c_first_name,
    c_last_name,
    c_email,
    c_company_id,
    c_company_name,
    c_role
  )
  returning id into v_driver_id;

  get diagnostics v_insert_count = row_count;
  if v_insert_count <> 1 or v_driver_id is null then
    raise exception
      'STOP: expected exactly 1 public.drivers insert; row_count=% driver_id=%',
      v_insert_count,
      v_driver_id;
  end if;

  insert into public.company_members (
    user_id,
    company_id,
    role,
    is_active
  )
  values (
    c_user_id,
    c_company_id,
    c_role,
    true
  )
  returning id into v_membership_id;

  get diagnostics v_insert_count = row_count;
  if v_insert_count <> 1 or v_membership_id is null then
    raise exception
      'STOP: expected exactly 1 public.company_members insert; row_count=% membership_id=%',
      v_insert_count,
      v_membership_id;
  end if;

  -- ---------------------------------------------------------------------------
  -- Post-insert verification (same transaction; any failure rolls back)
  -- ---------------------------------------------------------------------------

  select count(*)::integer
  into v_driver_count
  from public.drivers d
  where lower(trim(coalesce(d.email, ''))) = lower(trim(c_email))
    and d.company_id = c_company_id;

  if v_driver_count <> 1 then
    raise exception
      'STOP: post-check failed — expected exactly 1 driver for email % in company %; found %.',
      lower(trim(c_email)),
      c_company_id,
      v_driver_count;
  end if;

  select count(*)::integer
  into v_membership_count
  from public.company_members cm
  where cm.user_id = c_user_id;

  select count(*)::integer
  into v_active_membership_count
  from public.company_members cm
  where cm.user_id = c_user_id
    and cm.is_active is true;

  if v_membership_count <> 1 or v_active_membership_count <> 1 then
    raise exception
      'STOP: post-check failed — expected exactly 1 membership and 1 active membership for user %; found total=%, active=%',
      c_user_id,
      v_membership_count,
      v_active_membership_count;
  end if;

  if not exists (
    select 1
    from public.drivers d
    inner join public.company_members cm
      on cm.user_id = c_user_id
     and cm.is_active is true
     and cm.company_id = d.company_id
    where d.id = v_driver_id
      and d.company_id = c_company_id
      and d.role = c_role
      and cm.role = c_role
      and lower(trim(coalesce(d.email, ''))) = lower(trim(c_email))
  ) then
    raise exception
      'STOP: post-check failed — driver/membership company_id or role mismatch (required Driver + same company_id).';
  end if;

  -- Mirror drevora_auth_user_driver_id identity requirements without calling
  -- auth.uid()-bound helpers: exact-one active membership + exact-one email
  -- match for that company.
  select count(*)::integer
  into v_identity_match_count
  from public.drivers d
  where lower(trim(coalesce(d.email, ''))) = lower(trim(c_email))
    and d.company_id is not null
    and coalesce(trim(d.email), '') <> ''
    and d.company_id = c_company_id
    and exists (
      select 1
      from public.company_members cm
      where cm.user_id = c_user_id
        and cm.company_id = d.company_id
        and cm.is_active is true
    )
    and (
      select count(*)::integer
      from public.company_members cm2
      where cm2.user_id = c_user_id
        and cm2.is_active is true
    ) = 1;

  if v_identity_match_count <> 1 then
    raise exception
      'STOP: post-check failed — drevora_auth_user_driver_id identity requirements not met; match_count=% (expected 1).',
      v_identity_match_count;
  end if;

  raise notice
    'OK: temporary Worker linked. driver_id=% membership_id=% user_id=% company_id=% email=% role=%',
    v_driver_id,
    v_membership_id,
    c_user_id,
    c_company_id,
    lower(trim(c_email)),
    c_role;
end $$;

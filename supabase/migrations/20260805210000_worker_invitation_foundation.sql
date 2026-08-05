-- Worker invitation foundation (Admin-created Auth invite + membership + profile link).
-- Idempotent. Does NOT apply Auth invites (Edge Function invite-worker does that).
-- Apply manually on the Supabase project before deploying invite-worker.
--
-- Adds:
--   1) Partial unique index: one active Worker profile per (company_id, lower(email))
--   2) drevora_assert_company_can_add_worker — pre-invite plan/slot check
--   3) drevora_link_invited_worker — atomic Driver membership + drivers row (service_role)

-- -----------------------------------------------------------------------------
-- 1) Active Worker email uniqueness (tenant-scoped)
-- -----------------------------------------------------------------------------
-- Prevents duplicate active Worker profiles for the same email inside one company.
-- Archived rows are excluded so former Workers can be re-invited after archive.
do $$
declare
  v_dup_count integer;
begin
  select count(*)::integer
  into v_dup_count
  from (
    select company_id, lower(btrim(email)) as email_key
    from public.drivers
    where archived_at is null
      and company_id is not null
      and nullif(btrim(email), '') is not null
    group by company_id, lower(btrim(email))
    having count(*) > 1
  ) dups;

  if v_dup_count > 0 then
    raise exception
      'Cannot create drivers_company_active_email_unique_idx: % duplicate active email group(s). Resolve duplicates before applying this migration.',
      v_dup_count;
  end if;
end $$;

create unique index if not exists drivers_company_active_email_unique_idx
  on public.drivers (company_id, lower(btrim(email)))
  where archived_at is null
    and company_id is not null
    and nullif(btrim(email), '') is not null;

comment on index public.drivers_company_active_email_unique_idx is
  'At most one active Worker profile per company email (case-insensitive).';

-- -----------------------------------------------------------------------------
-- 2) Plan / allowance pre-check (same rules as insert trigger)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_assert_company_can_add_worker(
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_code text;
  v_valid_until timestamptz;
  v_limit integer;
  v_active_count integer;
begin
  if p_company_id is null then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Worker company_id is required for plan allowance checks.';
  end if;

  select c.plan_code, c.subscription_valid_until
  into v_plan_code, v_valid_until
  from public.companies c
  where c.id = p_company_id
  for update;

  if not found then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Company not found for Worker plan allowance check.';
  end if;

  if v_valid_until is not null and now() >= v_valid_until then
    raise exception 'SUBSCRIPTION_PLAN_EXPIRED'
      using errcode = 'P0001',
            hint = format(
              'Your trial expired on %s. Existing records remain available. Contact DREVORA to renew your plan.',
              to_char(v_valid_until at time zone 'UTC', 'DD Mon YYYY')
            );
  end if;

  v_limit := public.drevora_active_worker_limit_for_plan(v_plan_code);

  if v_limit is null then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Assign a valid starter/growing/pro plan, or configure a trusted Custom Fleet Worker limit.';
  end if;

  select count(*)::integer
  into v_active_count
  from public.drivers d
  where d.company_id = p_company_id
    and d.archived_at is null;

  if v_active_count >= v_limit then
    raise exception 'WORKER_PLAN_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = format(
              'Active Workers %s / %s. Archive an inactive Worker or change the company plan.',
              v_active_count,
              v_limit
            );
  end if;
end;
$$;

comment on function public.drevora_assert_company_can_add_worker(uuid) is
  'Service-role pre-check: company subscription + active Worker plan allowance before Auth invite.';

revoke all on function public.drevora_assert_company_can_add_worker(uuid) from public;
revoke all on function public.drevora_assert_company_can_add_worker(uuid) from anon;
revoke all on function public.drevora_assert_company_can_add_worker(uuid) from authenticated;
grant execute on function public.drevora_assert_company_can_add_worker(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 3) Atomic membership + Worker profile link for invited Auth users
-- -----------------------------------------------------------------------------
create or replace function public.drevora_link_invited_worker(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_auth_user_id uuid,
  p_email text,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_first_name text := nullif(btrim(coalesce(p_profile ->> 'first_name', '')), '');
  v_last_name text := nullif(btrim(coalesce(p_profile ->> 'last_name', '')), '');
  v_role text := nullif(btrim(coalesce(p_profile ->> 'operational_role', '')), '');
  v_status text := coalesce(nullif(btrim(coalesce(p_profile ->> 'status', '')), ''), 'Off Duty');
  v_phone text := nullif(btrim(coalesce(p_profile ->> 'phone', '')), '');
  v_employment_type text := nullif(btrim(coalesce(p_profile ->> 'employment_type', '')), '');
  v_company_name text;
  v_actor_role text;
  v_membership public.company_members%rowtype;
  v_driver public.drivers%rowtype;
  v_created_membership boolean := false;
  v_reactivated_membership boolean := false;
  v_created_driver boolean := false;
  v_default_vehicle_id uuid := null;
  v_paid_holiday_enabled boolean := null;
  v_annual_paid_holiday_days numeric := null;
  v_bank_holiday_entitlement_days numeric := null;
  v_unpaid_leave_allowed boolean := true;
  v_holiday_entitlement_notes text := null;
  v_licence_categories text[] := null;
  v_driving_licence_expiry date := null;
  v_tacho_card_number text := null;
  v_cpc_expiry date := null;
  v_driver_card_expiry date := null;
  v_medical_expiry date := null;
  v_start_date date := null;
  v_emergency_contact_name text := null;
  v_emergency_contact_phone text := null;
  v_emergency_contact_relationship text := null;
  v_address_line_1 text := null;
  v_address_line_2 text := null;
  v_town_city text := null;
  v_county text := null;
  v_postcode text := null;
  v_country text := null;
  v_other_active integer := 0;
begin
  if p_actor_user_id is null or p_company_id is null or p_auth_user_id is null then
    raise exception 'INVITE_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'actor_user_id, company_id and auth_user_id are required.';
  end if;

  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    raise exception 'INVITE_INVALID_EMAIL'
      using errcode = 'P0001',
            hint = 'A valid Worker email is required.';
  end if;

  if v_first_name is null or v_last_name is null then
    raise exception 'INVITE_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'first_name and last_name are required.';
  end if;

  if v_role is null or v_role not in (
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
  ) then
    raise exception 'INVITE_INVALID_ROLE'
      using errcode = 'P0001',
            hint = 'operational_role must be a known Worker profile role.';
  end if;

  if v_status not in ('Working', 'Off Duty', 'Holiday', 'Suspended') then
    raise exception 'INVITE_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'status must be Working, Off Duty, Holiday, or Suspended.';
  end if;

  -- Caller must be an active Office member of this company (never trust browser company id alone).
  select cm.role
  into v_actor_role
  from public.company_members cm
  where cm.user_id = p_actor_user_id
    and cm.company_id = p_company_id
    and cm.is_active = true;

  if v_actor_role is null or v_actor_role not in (
    'Admin',
    'Transport Manager',
    'Supervisor',
    'Planner',
    'Office Staff'
  ) then
    raise exception 'INVITE_FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only Office membership roles may invite Workers.';
  end if;

  select c.name
  into v_company_name
  from public.companies c
  where c.id = p_company_id;

  if not found then
    raise exception 'INVITE_COMPANY_NOT_FOUND'
      using errcode = 'P0001',
            hint = 'Company was not found.';
  end if;

  v_company_name := nullif(trim(v_company_name), '');

  -- Serialise concurrent invites for this Auth user (two companies racing).
  -- Transaction-scoped advisory lock keyed by invited auth user id.
  perform pg_advisory_xact_lock(
    872014551,
    hashtext(p_auth_user_id::text)
  );

  -- Authoritative: reject active membership in another company before any write.
  select count(*)::integer
  into v_other_active
  from public.company_members cm
  where cm.user_id = p_auth_user_id
    and cm.is_active = true
    and cm.company_id is distinct from p_company_id;

  if v_other_active > 0 then
    raise exception 'USER_ALREADY_LINKED_TO_ANOTHER_COMPANY'
      using errcode = 'P0001',
            hint = 'This Auth user already has an active membership in another company.';
  end if;

  -- Optional profile fields
  if p_profile ? 'default_vehicle_id'
     and nullif(btrim(coalesce(p_profile ->> 'default_vehicle_id', '')), '') is not null then
    begin
      v_default_vehicle_id := (p_profile ->> 'default_vehicle_id')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'INVITE_INVALID_ARGUMENT'
          using errcode = 'P0001',
                hint = 'default_vehicle_id must be a UUID.';
    end;

    if to_regprocedure('public.drevora_vehicle_in_company(uuid,uuid)') is not null
       and not public.drevora_vehicle_in_company(v_default_vehicle_id, p_company_id) then
      raise exception 'INVITE_INVALID_ARGUMENT'
        using errcode = 'P0001',
              hint = 'default_vehicle_id must belong to the same company.';
    end if;
  end if;

  if p_profile ? 'paid_holiday_enabled'
     and p_profile ->> 'paid_holiday_enabled' is not null
     and btrim(p_profile ->> 'paid_holiday_enabled') <> '' then
    v_paid_holiday_enabled := (p_profile ->> 'paid_holiday_enabled')::boolean;
  end if;

  if nullif(btrim(coalesce(p_profile ->> 'annual_paid_holiday_days', '')), '') is not null then
    v_annual_paid_holiday_days := (p_profile ->> 'annual_paid_holiday_days')::numeric;
  end if;

  if nullif(btrim(coalesce(p_profile ->> 'bank_holiday_entitlement_days', '')), '') is not null then
    v_bank_holiday_entitlement_days := (p_profile ->> 'bank_holiday_entitlement_days')::numeric;
  end if;

  if p_profile ? 'unpaid_leave_allowed'
     and p_profile ->> 'unpaid_leave_allowed' is not null
     and btrim(p_profile ->> 'unpaid_leave_allowed') <> '' then
    v_unpaid_leave_allowed := (p_profile ->> 'unpaid_leave_allowed')::boolean;
  end if;

  v_holiday_entitlement_notes := nullif(btrim(coalesce(p_profile ->> 'holiday_entitlement_notes', '')), '');
  v_tacho_card_number := nullif(btrim(coalesce(p_profile ->> 'tacho_card_number', '')), '');
  v_emergency_contact_name := nullif(btrim(coalesce(p_profile ->> 'emergency_contact_name', '')), '');
  v_emergency_contact_phone := nullif(btrim(coalesce(p_profile ->> 'emergency_contact_phone', '')), '');
  v_emergency_contact_relationship := nullif(
    btrim(coalesce(p_profile ->> 'emergency_contact_relationship', '')),
    ''
  );
  v_address_line_1 := nullif(btrim(coalesce(p_profile ->> 'address_line_1', '')), '');
  v_address_line_2 := nullif(btrim(coalesce(p_profile ->> 'address_line_2', '')), '');
  v_town_city := nullif(btrim(coalesce(p_profile ->> 'town_city', '')), '');
  v_county := nullif(btrim(coalesce(p_profile ->> 'county', '')), '');
  v_postcode := nullif(btrim(coalesce(p_profile ->> 'postcode', '')), '');
  v_country := coalesce(
    nullif(btrim(coalesce(p_profile ->> 'country', '')), ''),
    'United Kingdom'
  );

  if p_profile ? 'licence_categories' and jsonb_typeof(p_profile -> 'licence_categories') = 'array' then
    select array_agg(value)
    into v_licence_categories
    from (
      select nullif(btrim(elem), '') as value
      from jsonb_array_elements_text(p_profile -> 'licence_categories') as elem
    ) cleaned
    where value is not null;
  end if;

  if nullif(btrim(coalesce(p_profile ->> 'driving_licence_expiry', '')), '') is not null then
    v_driving_licence_expiry := (p_profile ->> 'driving_licence_expiry')::date;
  end if;
  if nullif(btrim(coalesce(p_profile ->> 'cpc_expiry', '')), '') is not null then
    v_cpc_expiry := (p_profile ->> 'cpc_expiry')::date;
  end if;
  if nullif(btrim(coalesce(p_profile ->> 'driver_card_expiry', '')), '') is not null then
    v_driver_card_expiry := (p_profile ->> 'driver_card_expiry')::date;
  end if;
  if nullif(btrim(coalesce(p_profile ->> 'medical_expiry', '')), '') is not null then
    v_medical_expiry := (p_profile ->> 'medical_expiry')::date;
  end if;
  if nullif(btrim(coalesce(p_profile ->> 'start_date', '')), '') is not null then
    v_start_date := (p_profile ->> 'start_date')::date;
  end if;

  -- Existing active Worker profile with this email in the company.
  select d.*
  into v_driver
  from public.drivers d
  where d.company_id = p_company_id
    and d.archived_at is null
    and lower(btrim(d.email)) = v_email
  limit 1;

  -- Membership for this auth user + company.
  select cm.*
  into v_membership
  from public.company_members cm
  where cm.user_id = p_auth_user_id
    and cm.company_id = p_company_id
  limit 1;

  if v_membership.id is not null then
    if v_membership.is_active
       and v_membership.role = 'Driver'
       and v_driver.id is not null then
      -- Idempotent success: already fully linked.
      return jsonb_build_object(
        'ok', true,
        'code', 'already_linked',
        'membership_id', v_membership.id,
        'driver_id', v_driver.id,
        'worker_code', v_driver.worker_code,
        'created_membership', false,
        'reactivated_membership', false,
        'created_driver', false
      );
    end if;

    if v_membership.is_active and v_membership.role <> 'Driver' then
      raise exception 'INVITE_EMAIL_CONFLICT'
        using errcode = 'P0001',
              hint = 'This Auth user already has a non-Worker membership in this company.';
    end if;

    if not v_membership.is_active or v_membership.role <> 'Driver' then
      update public.company_members
      set
        role = 'Driver',
        is_active = true,
        updated_at = now()
      where id = v_membership.id
      returning * into v_membership;
      v_reactivated_membership := true;
    end if;
  else
    -- No active Driver membership for another user may already cover this email via profile;
    -- still block duplicate active emails when creating a new profile below.
    insert into public.company_members (
      user_id,
      company_id,
      role,
      is_active
    )
    values (
      p_auth_user_id,
      p_company_id,
      'Driver',
      true
    )
    returning * into v_membership;
    v_created_membership := true;
  end if;

  if v_driver.id is null then
    -- Creating a seat: assert allowance then insert (trigger also enforces).
    perform public.drevora_assert_company_can_add_worker(p_company_id);

    insert into public.drivers (
      company_id,
      company,
      email,
      first_name,
      last_name,
      phone,
      role,
      status,
      employment_type,
      paid_holiday_enabled,
      annual_paid_holiday_days,
      bank_holiday_entitlement_days,
      unpaid_leave_allowed,
      holiday_entitlement_notes,
      licence_categories,
      driving_licence_expiry,
      tacho_card_number,
      cpc_expiry,
      driver_card_expiry,
      medical_expiry,
      default_vehicle_id,
      start_date,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      address_line_1,
      address_line_2,
      town_city,
      county,
      postcode,
      country,
      archived_at
    )
    values (
      p_company_id,
      v_company_name,
      v_email,
      v_first_name,
      v_last_name,
      v_phone,
      v_role,
      v_status,
      v_employment_type,
      v_paid_holiday_enabled,
      v_annual_paid_holiday_days,
      v_bank_holiday_entitlement_days,
      v_unpaid_leave_allowed,
      v_holiday_entitlement_notes,
      v_licence_categories,
      v_driving_licence_expiry,
      v_tacho_card_number,
      v_cpc_expiry,
      v_driver_card_expiry,
      v_medical_expiry,
      v_default_vehicle_id,
      v_start_date,
      v_emergency_contact_name,
      v_emergency_contact_phone,
      v_emergency_contact_relationship,
      v_address_line_1,
      v_address_line_2,
      v_town_city,
      v_county,
      v_postcode,
      v_country,
      null
    )
    returning * into v_driver;
    v_created_driver := true;
  else
    -- Keep existing active profile email binding; refresh name/role lightly for invite retries.
    update public.drivers
    set
      first_name = v_first_name,
      last_name = v_last_name,
      role = v_role,
      phone = coalesce(v_phone, phone),
      status = v_status
    where id = v_driver.id
    returning * into v_driver;
  end if;

  -- Safety: never leave an active Worker membership without an active profile.
  if v_membership.is_active is distinct from true
     or v_membership.role is distinct from 'Driver'
     or v_driver.id is null
     or v_driver.archived_at is not null then
    raise exception 'INVITE_PARTIAL_LINK_FAILED'
      using errcode = 'P0001',
            hint = 'Invitation link left an inconsistent membership/profile state.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', case
      when v_created_membership or v_created_driver or v_reactivated_membership then 'linked'
      else 'already_linked'
    end,
    'membership_id', v_membership.id,
    'driver_id', v_driver.id,
    'worker_code', v_driver.worker_code,
    'created_membership', v_created_membership,
    'reactivated_membership', v_reactivated_membership,
    'created_driver', v_created_driver
  );
exception
  when unique_violation then
    raise exception 'INVITE_DUPLICATE_WORKER'
      using errcode = 'P0001',
            hint = 'An active Worker with this email already exists in the company.';
end;
$$;

comment on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) is
  'Service-role: atomically ensure Driver company_members + active drivers row for an invited Auth user.';

revoke all on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) from public;
revoke all on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) from anon;
revoke all on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) from authenticated;
grant execute on function public.drevora_link_invited_worker(uuid, uuid, uuid, text, jsonb) to service_role;

notify pgrst, 'reload schema';

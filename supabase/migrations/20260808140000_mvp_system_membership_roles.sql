-- MVP system membership roles on public.company_members.role
-- Canonical: Admin | Manager | Office | Supervisor | Driver
-- Manager / Office / Supervisor are stored distinctly (never collapsed to Admin)
-- and currently share full Office access with Admin.
-- Legacy Office roles (Transport Manager, Planner, Office Staff) remain valid
-- and keep Office access; they are not rewritten.

-- -----------------------------------------------------------------------------
-- 1) Expand company_members.role CHECK (keep all historical values)
-- -----------------------------------------------------------------------------
alter table public.company_members
  drop constraint if exists company_members_role_check;

alter table public.company_members
  add constraint company_members_role_check check (
    role in (
      -- MVP system roles
      'Admin',
      'Manager',
      'Office',
      'Supervisor',
      'Driver',
      -- Legacy membership / historical values (do not rewrite)
      'Transport Manager',
      'Planner',
      'Office Staff',
      'Yardman',
      'Cleaner',
      'Mechanic',
      'Warehouse',
      'Other'
    )
  );

comment on column public.company_members.role is
  'MVP system roles: Admin, Manager, Office, Supervisor (Office access), Driver (Worker). Legacy values kept for existing rows.';

-- -----------------------------------------------------------------------------
-- 2) Shared Office-role predicate (MVP + legacy)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_is_office_membership_role(p_role text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_role in (
    'Admin',
    'Manager',
    'Office',
    'Supervisor',
    'Transport Manager',
    'Planner',
    'Office Staff'
  );
$$;

comment on function public.drevora_is_office_membership_role(text) is
  'True for MVP Office system roles (Admin/Manager/Office/Supervisor) and legacy Office membership roles. Driver is never included.';

revoke all on function public.drevora_is_office_membership_role(text) from public;
revoke all on function public.drevora_is_office_membership_role(text) from anon;
grant execute on function public.drevora_is_office_membership_role(text) to authenticated;
grant execute on function public.drevora_is_office_membership_role(text) to service_role;

-- -----------------------------------------------------------------------------
-- 3) RLS / auth helpers — Manager / Office / Supervisor = Admin Office access
-- -----------------------------------------------------------------------------
create or replace function public.drevora_auth_user_has_office_role_for_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
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
        and public.drevora_is_office_membership_role(cm.role)
    );
$$;

create or replace function public.drevora_auth_user_has_office_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
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
        and public.drevora_is_office_membership_role(cm.role)
    );
$$;

-- MVP: Customer Terms / DPA accept uses the same Office set (roles stay distinct).
create or replace function public.drevora_auth_user_has_admin_role_for_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.drevora_auth_user_has_office_role_for_company(p_company_id);
$$;

comment on function public.drevora_auth_user_has_office_role_for_company(uuid) is
  'True when auth.uid() has exactly one active Office membership (Admin/Manager/Office/Supervisor or legacy Office roles) for the company.';

comment on function public.drevora_auth_user_has_office_role() is
  'True when auth.uid() has exactly one active Office membership role.';

comment on function public.drevora_auth_user_has_admin_role_for_company(uuid) is
  'MVP: same as Office access for the company (Admin/Manager/Office/Supervisor + legacy). Roles remain stored distinctly for later differentiation.';

-- -----------------------------------------------------------------------------
-- 4) Patch RPC actor allowlists (old list → MVP + legacy)
-- Nested dollar-quotes MUST use distinct tags ($do$ / $roles$), not bare $$.
-- Safe to re-run: skips procs that already include 'Manager' in the allowlist.
-- -----------------------------------------------------------------------------
do $do$
declare
  def text;
  proc_name text;
  proc regprocedure;
  proc_names text[] := array[
    'public.drevora_link_invited_worker(uuid,uuid,uuid,text,jsonb)',
    'public.drevora_finalize_worker_login_email_change(uuid,uuid,uuid,text,text,text)',
    'public.drevora_begin_worker_access_email_send(uuid,uuid,uuid,integer,integer)',
    'public.drevora_finalize_worker_access_email_send(uuid,uuid,uuid,text,text)'
  ];
  new_roles text := $roles$'Admin',
    'Manager',
    'Office',
    'Supervisor',
    'Transport Manager',
    'Planner',
    'Office Staff'$roles$;
begin
  foreach proc_name in array proc_names loop
    proc := to_regprocedure(proc_name);
    if proc is null then
      continue;
    end if;

    def := pg_get_functiondef(proc);

    -- Idempotent: skip when Manager is already in the actor allowlist.
    if position('''Manager''' in def) > 0 then
      continue;
    end if;

    -- Match the legacy Office actor allowlist regardless of whitespace.
    if def !~ '''Admin''[[:space:]]*,[[:space:]]*''Transport Manager''' then
      continue;
    end if;

    def := regexp_replace(
      def,
      '''Admin''[[:space:]]*,[[:space:]]*''Transport Manager''[[:space:]]*,[[:space:]]*''Supervisor''[[:space:]]*,[[:space:]]*''Planner''[[:space:]]*,[[:space:]]*''Office Staff''',
      new_roles,
      'g'
    );

    execute def;
  end loop;
end;
$do$;

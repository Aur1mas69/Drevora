-- Security Advisor hardening — Batch 5A (holiday helpers + single caller
-- body schema-prefix fix).
--
-- Targets (2 helpers):
--   public.drevora_calculate_holiday_day_breakdown(uuid, date, date)
--     -> drevora_private.drevora_calculate_holiday_day_breakdown(uuid, date, date)
--   public.drevora_worker_holiday_leave_type(uuid)
--     -> drevora_private.drevora_worker_holiday_leave_type(uuid)
--
-- Only caller body updated (same-signature CREATE OR REPLACE):
--   public.drevora_enforce_holiday_request_worker_write()
--   Change ONLY:
--     public.drevora_calculate_holiday_day_breakdown(...)
--       -> drevora_private.drevora_calculate_holiday_day_breakdown(...)
--     public.drevora_worker_holiday_leave_type(...)
--       -> drevora_private.drevora_worker_holiday_leave_type(...)
--
-- Advisor finding:
--   authenticated_security_definer_function_executable
--   (2 of the current 35 warnings → expected 35 -> 33 after apply)
--
-- BACKGROUND
--   Canonical helper defs: 20260715210000_enable_full_tenant_rls.sql
--   (SECURITY DEFINER, stable; search_path was still `public` — neither was
--   in the 20260802160000 harden list). Sole live caller is the SECURITY
--   INVOKER trigger function drevora_enforce_holiday_request_worker_write
--   (same migration; never rewritten later). Repo preflight found zero
--   frontend `.rpc()` / Edge callers and zero other function-body callers.
--   Policy deps expected zero — re-asserted live before COMMIT.
--
-- STRATEGY
--   1) Pure ALTER FUNCTION ... SET SCHEMA for both helpers (no helper body
--      rewrite, no DROP). OID / SECURITY DEFINER / volatility preserved.
--   2) Harden search_path to '' + authenticated-only EXECUTE.
--   3) Same-signature CREATE OR REPLACE of the one caller trigger function
--      changing only the two helpers' schema prefixes (4 call sites total).
--      Same-signature REPLACE preserves the trigger function OID; the
--      existing holiday_requests trigger attachment is left untouched.
--
-- SCOPE
--   Touches ONLY these 2 helpers' schema/search_path/privileges and the one
--   caller body listed above. Does NOT touch drevora_is_trusted_tenant_writer,
--   drevora_company_workers_manage_timesheets, any other enforce_* trigger,
--   any RLS policy, or drevora_private schema privileges.
--
-- Wrapped in one explicit transaction. Fails closed on any assertion.
-- Does NOT apply itself — run manually after review.

begin;

-- -----------------------------------------------------------------------------
-- 0) Capture pre-move OIDs (helpers + caller trigger function).
-- -----------------------------------------------------------------------------
create temporary table drevora_batch5a_captured_oids (
  fn_name text primary key,
  oid_before oid not null,
  prorettype_before oid not null,
  prolang_before oid not null,
  provolatile_before "char" not null,
  prosecdef_before boolean not null
) on commit drop;

do $$
declare
  v_breakdown_oid oid;
  v_leave_type_oid oid;
  v_trigger_fn_oid oid;
begin
  v_breakdown_oid := to_regprocedure(
    'public.drevora_calculate_holiday_day_breakdown(uuid,date,date)'
  );
  v_leave_type_oid := to_regprocedure(
    'public.drevora_worker_holiday_leave_type(uuid)'
  );
  v_trigger_fn_oid := to_regprocedure(
    'public.drevora_enforce_holiday_request_worker_write()'
  );

  if v_breakdown_oid is null then
    raise exception
      'MOVE_HOLIDAY_HELPERS_PRECONDITION: public.drevora_calculate_holiday_day_breakdown(uuid,date,date) missing';
  end if;
  if v_leave_type_oid is null then
    raise exception
      'MOVE_HOLIDAY_HELPERS_PRECONDITION: public.drevora_worker_holiday_leave_type(uuid) missing';
  end if;
  if v_trigger_fn_oid is null then
    raise exception
      'MOVE_HOLIDAY_HELPERS_PRECONDITION: public.drevora_enforce_holiday_request_worker_write() missing';
  end if;

  if exists (
    select 1 from pg_depend d
    where d.classid = 'pg_policy'::regclass
      and d.refclassid = 'pg_proc'::regclass
      and d.refobjid in (v_breakdown_oid, v_leave_type_oid)
  ) then
    raise exception
      'MOVE_HOLIDAY_HELPERS_PRECONDITION: at least one holiday helper unexpectedly has a live pg_policy dependency';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and t.tgname = 'drevora_enforce_holiday_request_worker_write'
      and n.nspname = 'public'
      and c.relname = 'holiday_requests'
      and t.tgfoid = v_trigger_fn_oid
  ) then
    raise exception
      'MOVE_HOLIDAY_HELPERS_PRECONDITION: expected trigger drevora_enforce_holiday_request_worker_write on public.holiday_requests bound to the captured function OID';
  end if;

  insert into drevora_batch5a_captured_oids (
    fn_name, oid_before, prorettype_before, prolang_before, provolatile_before, prosecdef_before
  )
  select
    'drevora_calculate_holiday_day_breakdown',
    p.oid,
    p.prorettype,
    p.prolang,
    p.provolatile,
    p.prosecdef
  from pg_proc p
  where p.oid = v_breakdown_oid;

  insert into drevora_batch5a_captured_oids (
    fn_name, oid_before, prorettype_before, prolang_before, provolatile_before, prosecdef_before
  )
  select
    'drevora_worker_holiday_leave_type',
    p.oid,
    p.prorettype,
    p.prolang,
    p.provolatile,
    p.prosecdef
  from pg_proc p
  where p.oid = v_leave_type_oid;

  insert into drevora_batch5a_captured_oids (
    fn_name, oid_before, prorettype_before, prolang_before, provolatile_before, prosecdef_before
  )
  select
    'drevora_enforce_holiday_request_worker_write',
    p.oid,
    p.prorettype,
    p.prolang,
    p.provolatile,
    p.prosecdef
  from pg_proc p
  where p.oid = v_trigger_fn_oid;
end $$;

-- -----------------------------------------------------------------------------
-- 1) Move both helpers — pure ALTER FUNCTION SET SCHEMA, no body change.
-- -----------------------------------------------------------------------------
alter function public.drevora_calculate_holiday_day_breakdown(uuid, date, date)
  set schema drevora_private;

alter function public.drevora_worker_holiday_leave_type(uuid)
  set schema drevora_private;

-- -----------------------------------------------------------------------------
-- 2) Harden search_path + privileges (helpers only).
-- -----------------------------------------------------------------------------
alter function drevora_private.drevora_calculate_holiday_day_breakdown(uuid, date, date)
  set search_path = '';

alter function drevora_private.drevora_worker_holiday_leave_type(uuid)
  set search_path = '';

revoke all on function drevora_private.drevora_calculate_holiday_day_breakdown(uuid, date, date) from public;
revoke all on function drevora_private.drevora_calculate_holiday_day_breakdown(uuid, date, date) from anon;
grant execute on function drevora_private.drevora_calculate_holiday_day_breakdown(uuid, date, date) to authenticated;

revoke all on function drevora_private.drevora_worker_holiday_leave_type(uuid) from public;
revoke all on function drevora_private.drevora_worker_holiday_leave_type(uuid) from anon;
grant execute on function drevora_private.drevora_worker_holiday_leave_type(uuid) to authenticated;

comment on function drevora_private.drevora_calculate_holiday_day_breakdown(uuid, date, date) is
  'SECURITY DEFINER holiday day breakdown from companies.holiday_* settings. Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-10 Batch 5A) — same OID, body untouched, search_path hardened to ''''. EXECUTE: authenticated only. Called only from public.drevora_enforce_holiday_request_worker_write.';

comment on function drevora_private.drevora_worker_holiday_leave_type(uuid) is
  'SECURITY DEFINER Worker leave classification from drivers.paid_holiday_enabled. Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-10 Batch 5A) — same OID, body untouched, search_path hardened to ''''. EXECUTE: authenticated only. Called only from public.drevora_enforce_holiday_request_worker_write.';

-- -----------------------------------------------------------------------------
-- 3) Rewrite ONLY the holiday enforce trigger body — schema prefixes for the
--    two moved helpers. Signature / SECURITY INVOKER / search_path = public /
--    authorization + business logic otherwise unchanged. Same-signature
--    CREATE OR REPLACE preserves the function OID (trigger attachment stays).
-- -----------------------------------------------------------------------------
create or replace function public.drevora_enforce_holiday_request_worker_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_worker_id uuid;
  v_company_id uuid;
  v_leave_type text;
  v_calc record;
begin
  v_company_id := case when tg_op = 'DELETE' then old.company_id else new.company_id end;

  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null then
    raise exception 'DREVORA: Holiday write denied (no exact Worker link / not office).';
  end if;

  if tg_op = 'INSERT' then
    -- Client may supply only: company_id, worker_id, start_date, end_date, reason.
    -- Classification + calculated fields assigned only by trusted DB logic.
    if new.worker_id is distinct from v_worker_id then
      raise exception 'DREVORA: Workers may only create their own Holiday Requests.';
    end if;
    if new.start_date is null or new.end_date is null or new.end_date < new.start_date then
      raise exception 'DREVORA: Holiday Request dates are invalid.';
    end if;

    v_leave_type := drevora_private.drevora_worker_holiday_leave_type(v_worker_id);
    if v_leave_type is null then
      raise exception 'DREVORA: Unable to derive Worker leave type.';
    end if;

    select * into v_calc
    from drevora_private.drevora_calculate_holiday_day_breakdown(
      new.company_id, new.start_date, new.end_date
    );

    new.worker_id := v_worker_id;
    new.status := 'Pending';
    new.manager_note := null;
    new.leave_type := v_leave_type;
    new.is_paid_leave := (v_leave_type = 'paid_holiday');
    new.calendar_days_total := v_calc.calendar_days_total;
    new.holiday_days_deducted := v_calc.holiday_days_deducted;
    new.non_working_days_excluded := v_calc.non_working_days_excluded;
    new.total_days := v_calc.holiday_days_deducted;
    new.updated_at := coalesce(new.updated_at, now());
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.worker_id is distinct from v_worker_id
       or new.worker_id is distinct from v_worker_id
       or new.company_id is distinct from old.company_id
       or new.id is distinct from old.id
       or new.created_at is distinct from old.created_at then
      raise exception 'DREVORA: Workers may not change immutable Holiday Request identity fields.';
    end if;
    if old.status is distinct from 'Pending' then
      raise exception 'DREVORA: Workers may only update Pending Holiday Requests.';
    end if;

    -- Allowlist only: start_date, end_date, reason, status (Pending|Cancelled), updated_at.
    -- Force classification + calculated + manager fields from trusted logic / OLD.
    if new.status is distinct from old.status and new.status is distinct from 'Cancelled' then
      raise exception 'DREVORA: Workers may only cancel Pending Holiday Requests.';
    end if;
    if new.status in ('Approved', 'Rejected') then
      raise exception 'DREVORA: Workers may not approve or reject Holiday Requests.';
    end if;

    v_leave_type := drevora_private.drevora_worker_holiday_leave_type(v_worker_id);
    new.leave_type := v_leave_type;
    new.is_paid_leave := (v_leave_type = 'paid_holiday');
    new.manager_note := old.manager_note;
    new.updated_at := now();

    if new.status = 'Cancelled' then
      new.total_days := old.total_days;
      new.holiday_days_deducted := old.holiday_days_deducted;
      new.calendar_days_total := old.calendar_days_total;
      new.non_working_days_excluded := old.non_working_days_excluded;
      new.start_date := old.start_date;
      new.end_date := old.end_date;
      new.reason := old.reason;
      return new;
    end if;

    select * into v_calc
    from drevora_private.drevora_calculate_holiday_day_breakdown(
      new.company_id, new.start_date, new.end_date
    );
    new.calendar_days_total := v_calc.calendar_days_total;
    new.holiday_days_deducted := v_calc.holiday_days_deducted;
    new.non_working_days_excluded := v_calc.non_working_days_excluded;
    new.total_days := v_calc.holiday_days_deducted;
    return new;
  end if;

  raise exception 'DREVORA: Workers may not delete Holiday Requests.';
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) In-transaction assertions. Any failure rolls back the entire migration.
-- -----------------------------------------------------------------------------
do $$
declare
  v_breakdown_before oid;
  v_leave_type_before oid;
  v_trigger_before oid;
  v_breakdown_after oid;
  v_leave_type_after oid;
  v_trigger_after oid;
  v_breakdown_rettype oid;
  v_search_path text;
  v_src text;
  v_sql_lang oid := (select oid from pg_language where lanname = 'sql');
  v_plpgsql_lang oid := (select oid from pg_language where lanname = 'plpgsql');
begin
  select oid_before, prorettype_before
    into v_breakdown_before, v_breakdown_rettype
  from drevora_batch5a_captured_oids
  where fn_name = 'drevora_calculate_holiday_day_breakdown';

  select oid_before into v_leave_type_before
  from drevora_batch5a_captured_oids
  where fn_name = 'drevora_worker_holiday_leave_type';

  select oid_before into v_trigger_before
  from drevora_batch5a_captured_oids
  where fn_name = 'drevora_enforce_holiday_request_worker_write';

  -- Helpers: public gone, private present, OIDs unchanged.
  if to_regprocedure('public.drevora_calculate_holiday_day_breakdown(uuid,date,date)') is not null then
    raise exception 'MOVE_HOLIDAY_HELPERS_ASSERT: public.drevora_calculate_holiday_day_breakdown still resolves';
  end if;
  if to_regprocedure('public.drevora_worker_holiday_leave_type(uuid)') is not null then
    raise exception 'MOVE_HOLIDAY_HELPERS_ASSERT: public.drevora_worker_holiday_leave_type still resolves';
  end if;

  v_breakdown_after := to_regprocedure(
    'drevora_private.drevora_calculate_holiday_day_breakdown(uuid,date,date)'
  );
  v_leave_type_after := to_regprocedure(
    'drevora_private.drevora_worker_holiday_leave_type(uuid)'
  );
  v_trigger_after := to_regprocedure(
    'public.drevora_enforce_holiday_request_worker_write()'
  );

  if v_breakdown_after is null then
    raise exception 'MOVE_HOLIDAY_HELPERS_ASSERT: drevora_private.drevora_calculate_holiday_day_breakdown missing';
  end if;
  if v_leave_type_after is null then
    raise exception 'MOVE_HOLIDAY_HELPERS_ASSERT: drevora_private.drevora_worker_holiday_leave_type missing';
  end if;
  if v_trigger_after is null then
    raise exception 'MOVE_HOLIDAY_HELPERS_ASSERT: public.drevora_enforce_holiday_request_worker_write missing';
  end if;

  if v_breakdown_after is distinct from v_breakdown_before then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: calculate_holiday_day_breakdown OID changed (before=%, after=%)',
      v_breakdown_before, v_breakdown_after;
  end if;
  if v_leave_type_after is distinct from v_leave_type_before then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: worker_holiday_leave_type OID changed (before=%, after=%)',
      v_leave_type_before, v_leave_type_after;
  end if;
  if v_trigger_after is distinct from v_trigger_before then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: enforce_holiday_request_worker_write OID changed (before=%, after=%) — same-signature REPLACE did not preserve object',
      v_trigger_before, v_trigger_after;
  end if;

  -- Helper SECURITY DEFINER / volatility / language / return type retained.
  if not exists (
    select 1 from pg_proc
    where oid = v_breakdown_after
      and prosecdef
      and provolatile = 's'
      and prolang = v_plpgsql_lang
      and prorettype = v_breakdown_rettype
  ) then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: calculate_holiday_day_breakdown SECURITY DEFINER/volatility/language/return type changed';
  end if;

  if not exists (
    select 1 from pg_proc
    where oid = v_leave_type_after
      and prosecdef
      and provolatile = 's'
      and prolang = v_sql_lang
      and prorettype = 'text'::regtype
  ) then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: worker_holiday_leave_type SECURITY DEFINER/volatility/language/return type changed';
  end if;

  -- Trigger function: still SECURITY INVOKER, returns trigger, search_path public.
  if exists (select 1 from pg_proc where oid = v_trigger_after and prosecdef) then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: enforce_holiday_request_worker_write unexpectedly became SECURITY DEFINER';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid = v_trigger_after
      and prolang = v_plpgsql_lang
      and prorettype = 'trigger'::regtype
  ) then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: enforce_holiday_request_worker_write language/return type changed';
  end if;

  select cfg into v_search_path
  from pg_proc p
  cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
  where p.oid = v_trigger_after
    and cfg like 'search_path=%';
  if v_search_path is distinct from 'search_path=public' then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: enforce_holiday_request_worker_write search_path changed (got %)',
      v_search_path;
  end if;

  -- Helper search_path hardened to empty string.
  for v_search_path in
    select cfg
    from (
      values (v_breakdown_after), (v_leave_type_after)
    ) as t(oid)
    cross join lateral (
      select cfg
      from pg_proc p
      cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
      where p.oid = t.oid
        and cfg like 'search_path=%'
    ) s
  loop
    if v_search_path is distinct from 'search_path=""' then
      raise exception
        'MOVE_HOLIDAY_HELPERS_ASSERT: helper search_path not pinned to empty string (got %)',
        v_search_path;
    end if;
  end loop;

  -- Privileges on helpers.
  if has_function_privilege('public', v_breakdown_after, 'EXECUTE')
     or has_function_privilege('public', v_leave_type_after, 'EXECUTE') then
    raise exception 'MOVE_HOLIDAY_HELPERS_ASSERT: PUBLIC still has EXECUTE on a holiday helper';
  end if;
  if has_function_privilege('anon', v_breakdown_after, 'EXECUTE')
     or has_function_privilege('anon', v_leave_type_after, 'EXECUTE') then
    raise exception 'MOVE_HOLIDAY_HELPERS_ASSERT: anon still has EXECUTE on a holiday helper';
  end if;
  if not has_function_privilege('authenticated', v_breakdown_after, 'EXECUTE')
     or not has_function_privilege('authenticated', v_leave_type_after, 'EXECUTE') then
    raise exception 'MOVE_HOLIDAY_HELPERS_ASSERT: authenticated is missing EXECUTE on a holiday helper';
  end if;

  -- Zero pg_policy deps post-move.
  if exists (
    select 1 from pg_depend d
    where d.classid = 'pg_policy'::regclass
      and d.refclassid = 'pg_proc'::regclass
      and d.refobjid in (v_breakdown_after, v_leave_type_after)
  ) then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: holiday helper unexpectedly has a pg_policy dependency after move';
  end if;

  -- Trigger attachment unchanged (same name, table, function OID).
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and t.tgname = 'drevora_enforce_holiday_request_worker_write'
      and n.nspname = 'public'
      and c.relname = 'holiday_requests'
      and t.tgfoid = v_trigger_after
  ) then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: holiday_requests trigger attachment missing or unbound from preserved function OID';
  end if;

  -- Caller body: required private refs present; stale public helper refs gone.
  select prosrc into v_src from pg_proc where oid = v_trigger_after;

  if v_src not like '%drevora_private.drevora_worker_holiday_leave_type%' then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: trigger body missing drevora_private.drevora_worker_holiday_leave_type';
  end if;
  if v_src not like '%drevora_private.drevora_calculate_holiday_day_breakdown%' then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: trigger body missing drevora_private.drevora_calculate_holiday_day_breakdown';
  end if;
  if v_src like '%public.drevora_worker_holiday_leave_type%' then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: trigger body still contains stale public.drevora_worker_holiday_leave_type';
  end if;
  if v_src like '%public.drevora_calculate_holiday_day_breakdown%' then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: trigger body still contains stale public.drevora_calculate_holiday_day_breakdown';
  end if;

  -- Unrelated public helpers in the same body must remain untouched.
  if v_src not like '%public.drevora_is_trusted_tenant_writer%'
     or v_src not like '%public.drevora_auth_user_has_office_role_for_company%'
     or v_src not like '%public.drevora_auth_user_driver_id%' then
    raise exception
      'MOVE_HOLIDAY_HELPERS_ASSERT: unrelated public.* helper references were unexpectedly altered in the trigger body';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

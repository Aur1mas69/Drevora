-- Publish DREVORA Privacy Policy v0.4 effective 2026-08-14
-- (iOS coverage, Vehicle Check location, mobile permissions).
-- Idempotent. Does NOT mutate published metadata/hashes on existing version rows.
-- Publishes ONLY privacy_policy 0.4.
-- Demotes prior current privacy_policy versions and promotes 0.4.
-- Preserves historical privacy_policy 0.2 and 0.3 rows.
-- Does not change customer_terms, dpa, or worker_terms.

insert into public.legal_document_versions (
  document_type,
  version,
  title,
  effective_date,
  content_hash,
  audience,
  is_current
) values
  (
    'privacy_policy',
    '0.4',
    'DREVORA Privacy Policy',
    date '2026-08-14',
    '34d658d5796236291ccb874451979a439b7dff4a97b41fcc38a2a56d3e3a3373',
    'both',
    false
  )
on conflict (document_type, version) do update set
  title = excluded.title,
  effective_date = excluded.effective_date,
  content_hash = excluded.content_hash,
  audience = excluded.audience
where public.legal_document_versions.published_at is null;

-- Demote previous current privacy_policy versions (keep 0.2 and 0.3 rows).
update public.legal_document_versions
set is_current = false
where is_current = true
  and document_type = 'privacy_policy'
  and version is distinct from '0.4';

-- Promote privacy_policy 0.4 to current.
update public.legal_document_versions
set is_current = true
where document_type = 'privacy_policy'
  and version = '0.4';

-- Validate current privacy_policy 0.4 matches expected hash/date,
-- and that historical 0.3 remains present and is not current.
do $$
declare
  v_mismatch text;
  v_historical text;
begin
  select string_agg(
    format('%s@%s hash=%s date=%s current=%s', e.document_type, e.version, coalesce(v.content_hash, '<missing>'), coalesce(v.effective_date::text, '<missing>'), coalesce(v.is_current::text, '<missing>')),
    '; '
    order by e.document_type
  )
  into v_mismatch
  from (
    values
      ('privacy_policy'::text, '0.4'::text, '34d658d5796236291ccb874451979a439b7dff4a97b41fcc38a2a56d3e3a3373'::text, date '2026-08-14')
  ) as e(document_type, version, content_hash, effective_date)
  left join public.legal_document_versions v
    on v.document_type = e.document_type
   and v.version = e.version
  where v.id is null
     or v.content_hash is distinct from e.content_hash
     or v.effective_date is distinct from e.effective_date
     or v.is_current is distinct from true;

  if v_mismatch is not null then
    raise exception 'legal version publish mismatch: %', v_mismatch;
  end if;

  select string_agg(
    format('privacy_policy@%s current=%s', v.version, v.is_current),
    '; '
    order by v.version
  )
  into v_historical
  from public.legal_document_versions v
  where v.document_type = 'privacy_policy'
    and v.version in ('0.2', '0.3')
    and v.is_current is distinct from false;

  if v_historical is not null then
    raise exception 'historical privacy_policy versions must not remain current: %', v_historical;
  end if;
end
$$;

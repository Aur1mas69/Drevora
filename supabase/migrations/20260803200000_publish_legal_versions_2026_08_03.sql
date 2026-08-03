-- Publish DREVORA legal document versions effective 2026-08-03 (account deletion wording).
-- Idempotent. Does NOT mutate published metadata/hashes on existing version rows.
-- Demotes prior current versions and promotes the new current set.

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
    'customer_terms',
    '0.3',
    'DREVORA Customer Terms & Conditions',
    date '2026-08-03',
    'd36b76b715d4c9c2d1bdf8a6fffa57dbf776052d58e44d8e89a8741762b40582',
    'customer_admin',
    false
  ),
  (
    'dpa',
    '0.3',
    'DREVORA Data Processing Agreement',
    date '2026-08-03',
    '5a97632431127d9584262cf5d476f80e78e4d82022a12bd0633ed3d9d5293aaf',
    'customer_admin',
    false
  ),
  (
    'privacy_policy',
    '0.3',
    'DREVORA Privacy Policy',
    date '2026-08-03',
    'd8f01460b51372cb76f7e075e3fa3895ad84d8abab2bef7d793af375ccf2d04e',
    'both',
    false
  ),
  (
    'worker_terms',
    '0.2',
    'DREVORA Worker Terms of Use',
    date '2026-08-03',
    'ad2dbb1793ee4abc12fb23c77db6ee5a97de9bde2d6e98cb210c753a837bc74d',
    'worker',
    false
  )
on conflict (document_type, version) do update set
  title = excluded.title,
  effective_date = excluded.effective_date,
  content_hash = excluded.content_hash,
  audience = excluded.audience
where public.legal_document_versions.published_at is null;

-- Demote previous current versions for these document types.
update public.legal_document_versions
set is_current = false
where is_current = true
  and document_type in ('customer_terms', 'dpa', 'privacy_policy', 'worker_terms')
  and (document_type, version) not in (
    ('customer_terms', '0.3'),
    ('dpa', '0.3'),
    ('privacy_policy', '0.3'),
    ('worker_terms', '0.2')
  );

-- Promote the 2026-08-03 versions to current.
update public.legal_document_versions
set is_current = true
where (document_type, version) in (
  ('customer_terms', '0.3'),
  ('dpa', '0.3'),
  ('privacy_policy', '0.3'),
  ('worker_terms', '0.2')
);

-- Validate current rows match expected hashes/dates.
do $$
declare
  v_mismatch text;
begin
  select string_agg(
    format('%s@%s hash=%s date=%s current=%s', e.document_type, e.version, coalesce(v.content_hash, '<missing>'), coalesce(v.effective_date::text, '<missing>'), coalesce(v.is_current::text, '<missing>')),
    '; '
    order by e.document_type
  )
  into v_mismatch
  from (
    values
      ('customer_terms'::text, '0.3'::text, 'd36b76b715d4c9c2d1bdf8a6fffa57dbf776052d58e44d8e89a8741762b40582'::text, date '2026-08-03'),
      ('dpa', '0.3', '5a97632431127d9584262cf5d476f80e78e4d82022a12bd0633ed3d9d5293aaf', date '2026-08-03'),
      ('privacy_policy', '0.3', 'd8f01460b51372cb76f7e075e3fa3895ad84d8abab2bef7d793af375ccf2d04e', date '2026-08-03'),
      ('worker_terms', '0.2', 'ad2dbb1793ee4abc12fb23c77db6ee5a97de9bde2d6e98cb210c753a837bc74d', date '2026-08-03')
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
end
$$;

-- Private Supabase Storage bucket for consumable receipt/photo attachments

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consumable-receipts',
  'consumable-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "consumable receipts select" on storage.objects;
create policy "consumable receipts select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'consumable-receipts');

drop policy if exists "consumable receipts insert" on storage.objects;
create policy "consumable receipts insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'consumable-receipts');

drop policy if exists "consumable receipts update" on storage.objects;
create policy "consumable receipts update"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'consumable-receipts');

drop policy if exists "consumable receipts delete" on storage.objects;
create policy "consumable receipts delete"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'consumable-receipts');

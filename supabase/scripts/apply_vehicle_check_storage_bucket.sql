-- Paste into Supabase SQL Editor to create the Vehicle Check storage bucket.
-- Used for:
--   - worker signatures  -> vehicle_checks.signature_url
--   - defect photos      -> vehicle_check_items.photo_url
-- Safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-check-photos',
  'vehicle-check-photos',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vehicle check photos select" on storage.objects;
create policy "vehicle check photos select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'vehicle-check-photos');

drop policy if exists "vehicle check photos insert" on storage.objects;
create policy "vehicle check photos insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'vehicle-check-photos');

drop policy if exists "vehicle check photos update" on storage.objects;
create policy "vehicle check photos update"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'vehicle-check-photos');

drop policy if exists "vehicle check photos delete" on storage.objects;
create policy "vehicle check photos delete"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'vehicle-check-photos');

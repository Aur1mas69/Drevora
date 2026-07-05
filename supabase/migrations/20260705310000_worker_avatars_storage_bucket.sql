-- Public Supabase Storage bucket for Worker profile avatars (public.drivers.avatar_url).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'worker-avatars',
  'worker-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "worker avatars select" on storage.objects;
create policy "worker avatars select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'worker-avatars');

drop policy if exists "worker avatars insert" on storage.objects;
create policy "worker avatars insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'worker-avatars');

drop policy if exists "worker avatars update" on storage.objects;
create policy "worker avatars update"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'worker-avatars');

drop policy if exists "worker avatars delete" on storage.objects;
create policy "worker avatars delete"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'worker-avatars');

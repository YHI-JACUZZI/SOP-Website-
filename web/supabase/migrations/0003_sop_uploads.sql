-- Phase 4: storage for SOPs imported from Word / Scribe.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Run 0001 and 0002 first. Safe to run more than once.

-- A private folder for SOP documents. Each SOP is saved as <SOP ID>.html;
-- replaced versions go under archive/.
insert into storage.buckets (id, name, public)
values ('sop-docs', 'sop-docs', false)
on conflict (id) do nothing;

-- Reading a document follows the same rule as the SOP list. Only admins
-- can read the archive.
drop policy if exists "Read SOP docs you're allowed" on storage.objects;
create policy "Read SOP docs you're allowed" on storage.objects
  for select to authenticated using (
    bucket_id = 'sop-docs'
    and (public.is_admin() or public.can_read_sop(split_part(name, '.', 1)))
  );

drop policy if exists "Admins add SOP docs" on storage.objects;
create policy "Admins add SOP docs" on storage.objects
  for insert to authenticated with check (bucket_id = 'sop-docs' and public.is_admin());

drop policy if exists "Admins replace SOP docs" on storage.objects;
create policy "Admins replace SOP docs" on storage.objects
  for update to authenticated using (bucket_id = 'sop-docs' and public.is_admin());

drop policy if exists "Admins remove SOP docs" on storage.objects;
create policy "Admins remove SOP docs" on storage.objects
  for delete to authenticated using (bucket_id = 'sop-docs' and public.is_admin());

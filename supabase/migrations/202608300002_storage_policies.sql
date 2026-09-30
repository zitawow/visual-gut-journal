-- Visual Gut Journal private Storage policies.
-- Create the buckets through the Supabase Dashboard or Storage API before use:
--   originals-private  (private, image/jpeg|image/png|image/webp, 10 MB)
--   artworks-private   (private, image/jpeg|image/png|image/webp, 15 MB)
--   reports-private    (private, application/pdf, 20 MB)
--
-- Required object path convention:
--   <auth-user-uuid>/<entry-uuid>/<filename>
--
-- Do not add public read policies. Doctor review links must be short-lived signed
-- URLs created by a trusted Edge Function after explicit user confirmation.

-- Authenticated users can upload a new original only into their own top-level
-- folder. Upsert/update is intentionally disabled to avoid silent replacement.
create policy originals_insert_own_folder
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'originals-private'
  and (select auth.uid()) is not null
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Owners can view/download their private assets. This also supports creation of
-- authenticated downloads; it does not make the buckets public.
create policy originals_select_own_folder
on storage.objects for select
to authenticated
using (
  bucket_id = 'originals-private'
  and (select auth.uid()) is not null
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy artworks_select_own_folder
on storage.objects for select
to authenticated
using (
  bucket_id = 'artworks-private'
  and (select auth.uid()) is not null
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy reports_select_own_folder
on storage.objects for select
to authenticated
using (
  bucket_id = 'reports-private'
  and (select auth.uid()) is not null
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- There are deliberately no authenticated UPDATE or DELETE policies.
-- An Edge Function deletes the object through the Storage API, then updates or
-- deletes public.media_assets in the same workflow. This prevents orphaned files
-- and avoids direct SQL writes to storage.objects.

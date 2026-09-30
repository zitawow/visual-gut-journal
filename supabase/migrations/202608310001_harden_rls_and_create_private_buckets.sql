-- Visual Gut Journal / GUTVERSE
-- Post-deployment hardening discovered by remote RLS and advisor checks.

begin;

-- This pre-existing event-trigger function is invoked by its event trigger and
-- does not need to be callable through the exposed API roles.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

-- Keep every health-related object private. The Storage policies require paths
-- in the form <auth-user-uuid>/<entry-uuid>/<filename>.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'originals-private',
    'originals-private',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'artworks-private',
    'artworks-private',
    false,
    15728640,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'reports-private',
    'reports-private',
    false,
    20971520,
    array['application/pdf']::text[]
  )
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;

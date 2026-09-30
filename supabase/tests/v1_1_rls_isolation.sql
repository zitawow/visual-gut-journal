-- Visual Gut Journal v1.1 end-to-end ownership and Storage isolation test.
-- Run only after all three migrations. Every fixture and write is rolled back.

begin;

insert into auth.users (id, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', '{"display_name":"RLS User A"}'),
  ('22222222-2222-4222-8222-222222222222', '{"display_name":"RLS User B"}');

insert into public.journal_entries (
  id, user_id, occurred_at, timezone_name, local_date
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    '2026-08-30T08:00:00+08:00',
    'Asia/Taipei',
    '2026-08-30'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    '2026-08-30T09:00:00+08:00',
    'Asia/Taipei',
    '2026-08-30'
  );

insert into public.journal_contexts (entry_id, user_id, hydration)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'moderate'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'high'
  );

insert into public.stool_analyses (
  id, entry_id, user_id, bristol_type, color, shape, texture,
  confidence, confidence_band, provider, is_current
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    4, 'medium_brown', 'smooth', 'smooth', 0.9000, 'high', 'test-provider', true
  ),
  (
    'b1000000-0000-4000-8000-000000000001',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    6, 'dark_brown', 'mushy', 'soft', 0.8000, 'medium', 'test-provider', true
  );

insert into public.generation_jobs (id, user_id, entry_id, job_type)
values
  (
    'a2000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'analysis'
  ),
  (
    'b2000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'analysis'
  );

insert into public.media_assets (
  id, user_id, entry_id, kind, bucket_id, object_path, mime_type,
  status, retention_policy, retention_requested_at
)
values
  (
    'a3000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'original_capture',
    'originals-private',
    '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/original.jpg',
    'image/jpeg',
    'ready',
    'keep',
    now()
  ),
  (
    'b3000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'original_capture',
    'originals-private',
    '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/original.jpg',
    'image/jpeg',
    'ready',
    'keep',
    now()
  );

-- Temporary buckets make the policy test independent of Dashboard setup.
-- The surrounding transaction ensures missing buckets are not created remotely.
insert into storage.buckets (id, name, public)
values
  ('originals-private', 'originals-private', false),
  ('artworks-private', 'artworks-private', false),
  ('reports-private', 'reports-private', false)
on conflict (id) do nothing;

insert into storage.objects (bucket_id, name)
values
  (
    'originals-private',
    '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/fixture.jpg'
  ),
  (
    'originals-private',
    '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/fixture.jpg'
  );

-- -------------------------------------------------------------------------
-- User A: own reads/writes succeed; User B data is invisible and immutable.
-- -------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

do $test$
declare
  row_total integer;
  changed_rows integer;
begin
  select count(*) into row_total from public.profiles;
  if row_total <> 1 then
    raise exception 'User A must see exactly one profile, got %.', row_total;
  end if;

  select count(*) into row_total from public.journal_entries;
  if row_total <> 1 then
    raise exception 'User A must see exactly one fixture journal entry, got %.', row_total;
  end if;

  select count(*) into row_total from public.stool_analyses;
  if row_total <> 1 then
    raise exception 'User A must see only their own AI analysis, got %.', row_total;
  end if;

  select count(*) into row_total from public.generation_jobs;
  if row_total <> 1 then
    raise exception 'User A must see only their own generation job, got %.', row_total;
  end if;

  select count(*) into row_total from public.media_assets;
  if row_total <> 1 then
    raise exception 'User A must see only their own media metadata, got %.', row_total;
  end if;

  insert into public.journal_entries (
    id, user_id, timezone_name, local_date
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    '11111111-1111-4111-8111-111111111111',
    'Asia/Taipei',
    '2026-08-31'
  );

  insert into public.journal_contexts (entry_id, user_id, stress, extra_context)
  values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    '11111111-1111-4111-8111-111111111111',
    'low',
    '{"coffee":false}'::jsonb
  );

  insert into public.analysis_corrections (
    entry_id, user_id, corrected_bristol_type
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    5
  );

  insert into public.consent_events (
    user_id, consent_type, document_version, action, source_platform
  ) values (
    '11111111-1111-4111-8111-111111111111',
    'ai_analysis',
    'test-v1',
    'accepted',
    'web'
  );

  update public.journal_entries
  set user_confirmed = true
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'User A could not update their own journal entry.';
  end if;

  update public.journal_entries
  set user_confirmed = true
  where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'User A unexpectedly updated User B journal data.';
  end if;

  delete from public.journal_contexts
  where entry_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'User A unexpectedly deleted User B journal context.';
  end if;

  begin
    insert into public.journal_entries (user_id, timezone_name, local_date)
    values (
      '22222222-2222-4222-8222-222222222222',
      'Asia/Taipei',
      '2026-08-31'
    );
    raise exception 'User A unexpectedly inserted User B journal data.';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.stool_analyses (
      entry_id, user_id, bristol_type, color, shape, texture,
      confidence, confidence_band, provider
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      4, 'medium_brown', 'smooth', 'smooth', 0.9000, 'high', 'client-attempt'
    );
    raise exception 'Client unexpectedly inserted an AI analysis.';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.stool_analyses
    set bristol_type = 1
    where id = 'a1000000-0000-4000-8000-000000000001';
    raise exception 'Client unexpectedly updated an AI analysis.';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.journal_entries
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'Client unexpectedly hard-deleted a health record.';
  exception when insufficient_privilege then
    null;
  end;

  insert into storage.objects (bucket_id, name)
  values (
    'originals-private',
    '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/user-a-upload.jpg'
  );

  select count(*) into row_total
  from storage.objects
  where bucket_id = 'originals-private';
  if row_total <> 2 then
    raise exception 'User A Storage visibility expected 2 own objects, got %.', row_total;
  end if;

  begin
    insert into storage.objects (bucket_id, name)
    values (
      'originals-private',
      '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/user-a-cross-upload.jpg'
    );
    raise exception 'User A unexpectedly uploaded into User B folder.';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from storage.objects
    where bucket_id = 'originals-private';
    get diagnostics changed_rows = row_count;
    if changed_rows <> 0 then
      raise exception 'Client unexpectedly deleted a private Storage object.';
    end if;
  exception when insufficient_privilege then
    null;
  end;
end;
$test$;

reset role;

-- -------------------------------------------------------------------------
-- User B: repeat ownership checks in the opposite direction.
-- -------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

do $test$
declare
  row_total integer;
  changed_rows integer;
begin
  select count(*) into row_total from public.profiles;
  if row_total <> 1 then
    raise exception 'User B must see exactly one profile, got %.', row_total;
  end if;

  select count(*) into row_total from public.journal_entries;
  if row_total <> 1 then
    raise exception 'User B must see exactly one fixture journal entry, got %.', row_total;
  end if;

  insert into public.journal_entries (
    id, user_id, timezone_name, local_date
  ) values (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    '22222222-2222-4222-8222-222222222222',
    'Asia/Taipei',
    '2026-08-31'
  );

  insert into public.journal_contexts (entry_id, user_id, hydration)
  values (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    '22222222-2222-4222-8222-222222222222',
    'moderate'
  );

  update public.journal_entries
  set user_confirmed = true
  where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'User B could not update their own journal entry.';
  end if;

  update public.journal_entries
  set user_confirmed = true
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'User B unexpectedly updated User A journal data.';
  end if;

  delete from public.journal_contexts
  where entry_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'User B unexpectedly deleted User A journal context.';
  end if;

  insert into storage.objects (bucket_id, name)
  values (
    'originals-private',
    '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/user-b-upload.jpg'
  );

  select count(*) into row_total
  from storage.objects
  where bucket_id = 'originals-private';
  if row_total <> 2 then
    raise exception 'User B Storage visibility expected 2 own objects, got %.', row_total;
  end if;

  begin
    insert into storage.objects (bucket_id, name)
    values (
      'originals-private',
      '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/user-b-cross-upload.jpg'
    );
    raise exception 'User B unexpectedly uploaded into User A folder.';
  exception when insufficient_privilege then
    null;
  end;
end;
$test$;

reset role;

-- -------------------------------------------------------------------------
-- Privilege surface and anonymous access.
-- -------------------------------------------------------------------------

do $test$
begin
  if has_table_privilege('anon', 'public.journal_entries', 'SELECT')
    or has_table_privilege('anon', 'public.stool_analyses', 'SELECT')
    or has_table_privilege('anon', 'public.media_assets', 'SELECT')
  then
    raise exception 'anon unexpectedly has table privileges for health data.';
  end if;

  if has_table_privilege('authenticated', 'public.stool_analyses', 'INSERT')
    or has_table_privilege('authenticated', 'public.stool_analyses', 'UPDATE')
    or has_table_privilege('authenticated', 'public.media_assets', 'INSERT')
    or has_table_privilege('authenticated', 'public.generation_jobs', 'UPDATE')
    or has_table_privilege('authenticated', 'public.collectibles', 'INSERT')
  then
    raise exception 'authenticated unexpectedly has write access to a backend-only table.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.activate_stool_analysis(uuid)',
    'EXECUTE'
  ) then
    raise exception 'authenticated unexpectedly executes backend-only activation.';
  end if;

  if to_regprocedure('public.rls_auto_enable()') is not null
    and (
      has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
      or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE')
    )
  then
    raise exception 'Exposed roles unexpectedly execute rls_auto_enable().';
  end if;

  if exists (
    select 1
    from storage.buckets
    where id in ('originals-private', 'artworks-private', 'reports-private')
      and public is true
  ) then
    raise exception 'A health Storage bucket is unexpectedly public.';
  end if;

  if has_table_privilege('authenticated', 'public.consent_events', 'UPDATE')
    or has_table_privilege('authenticated', 'public.consent_events', 'DELETE')
    or has_table_privilege('service_role', 'public.consent_events', 'UPDATE')
    or has_table_privilege('service_role', 'public.consent_events', 'DELETE')
  then
    raise exception 'Consent history unexpectedly allows mutation.';
  end if;
end;
$test$;

set local role anon;

do $test$
declare
  row_total integer;
begin
  begin
    select count(*) into row_total from public.journal_entries;
    if row_total <> 0 then
      raise exception 'anon unexpectedly read health data.';
    end if;
  exception when insufficient_privilege then
    null;
  end;

  select count(*) into row_total
  from storage.objects
  where bucket_id = 'originals-private';
  if row_total <> 0 then
    raise exception 'anon unexpectedly read private Storage metadata.';
  end if;
end;
$test$;

reset role;
rollback;

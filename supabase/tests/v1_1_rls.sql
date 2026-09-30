-- Visual Gut Journal v1.1 RLS and effective-analysis smoke test.
-- Run against a disposable/local Supabase database after all three migrations.
-- Every fixture is rolled back.

begin;

insert into auth.users (id, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', '{"display_name":"RLS User A"}'),
  ('22222222-2222-4222-8222-222222222222', '{"display_name":"RLS User B"}');

insert into public.journal_entries (
  id,
  user_id,
  occurred_at,
  timezone_name,
  local_date
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

insert into public.stool_analyses (
  id,
  entry_id,
  user_id,
  bristol_type,
  color,
  shape,
  texture,
  confidence,
  confidence_band,
  provider,
  model_name,
  model_version,
  prompt_version,
  is_current
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    4,
    'medium_brown',
    'smooth',
    'smooth',
    0.9200,
    'high',
    'test-provider',
    'model-a',
    '1.0',
    'prompt-1',
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    3,
    'light_brown',
    'cracked',
    'firm',
    0.8800,
    'high',
    'test-provider',
    'model-b',
    '2.0',
    'prompt-2',
    false
  ),
  (
    'b1000000-0000-4000-8000-000000000001',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    6,
    'dark_brown',
    'mushy',
    'soft',
    0.8100,
    'medium',
    'test-provider',
    'model-a',
    '1.0',
    'prompt-1',
    true
  );

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

insert into public.analysis_corrections (
  entry_id,
  user_id,
  corrected_bristol_type,
  corrected_color
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  5,
  'red'
);

insert into public.consent_events (
  user_id,
  consent_type,
  document_version,
  action,
  source_platform
)
values (
  '11111111-1111-4111-8111-111111111111',
  'ai_analysis',
  '2026-08-30',
  'accepted',
  'web'
);

do $$
declare
  visible_entries integer;
  effective_record record;
begin
  select count(*)
  into visible_entries
  from public.journal_entry_effective_analysis;

  if visible_entries <> 1 then
    raise exception 'Expected exactly one RLS-visible effective analysis, got %.', visible_entries;
  end if;

  select *
  into effective_record
  from public.journal_entry_effective_analysis
  where entry_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  if effective_record.ai_bristol_type <> 4
    or effective_record.corrected_bristol_type <> 5
    or effective_record.effective_bristol_type <> 5
    or effective_record.effective_color <> 'red'
    or effective_record.effective_shape <> 'smooth'
    or effective_record.analysis_source <> 'user_correction'
  then
    raise exception 'Effective analysis did not apply field-level corrections correctly.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.activate_stool_analysis(uuid)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute activate_stool_analysis().';
  end if;

  if has_table_privilege('authenticated', 'public.consent_events', 'UPDATE')
    or has_table_privilege('service_role', 'public.consent_events', 'UPDATE')
  then
    raise exception 'Consent history must not be mutable by authenticated or service_role.';
  end if;
end;
$$;

-- Expected denial: User A cannot create an entry owned by User B.
do $$
begin
  begin
    insert into public.journal_entries (user_id, timezone_name, local_date)
    values (
      '22222222-2222-4222-8222-222222222222',
      'Asia/Taipei',
      '2026-08-30'
    );
    raise exception 'Cross-account journal insert unexpectedly succeeded.';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;

-- Backend activation changes the selected AI result without exposing that write
-- path to the client.
select public.activate_stool_analysis('a1000000-0000-4000-8000-000000000002');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

do $$
declare
  selected_analysis uuid;
  effective_shape text;
begin
  select current_analysis_id, view_result.effective_shape
  into selected_analysis, effective_shape
  from public.journal_entry_effective_analysis as view_result
  where entry_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  if selected_analysis <> 'a1000000-0000-4000-8000-000000000002'
    or effective_shape <> 'cracked'
  then
    raise exception 'Backend current-analysis activation was not reflected by the view.';
  end if;
end;
$$;

reset role;
rollback;

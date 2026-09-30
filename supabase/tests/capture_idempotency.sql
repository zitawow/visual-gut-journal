-- Database contract for capture and initial-job idempotency.
-- Run against a disposable/local database; all fixtures are rolled back.

begin;

insert into auth.users (id, raw_user_meta_data)
values ('33333333-3333-4333-8333-333333333333', '{"display_name":"Idempotency User"}');

insert into public.journal_entries (
  id, user_id, timezone_name, local_date, capture_operation_key, capture_mime_type
) values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  '33333333-3333-4333-8333-333333333333',
  'Asia/Taipei',
  '2026-09-01',
  'capture_20260901_same_operation_001',
  'image/jpeg'
);

do $$
begin
  begin
    insert into public.journal_entries (
      id, user_id, timezone_name, local_date, capture_operation_key, capture_mime_type
    ) values (
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
      '33333333-3333-4333-8333-333333333333',
      'Asia/Taipei',
      '2026-09-01',
      'capture_20260901_same_operation_001',
      'image/jpeg'
    );
    raise exception 'Duplicate capture operation unexpectedly created a second entry.';
  exception when unique_violation then
    null;
  end;
end;
$$;

-- A second intentional capture on the same local date remains valid.
insert into public.journal_entries (
  id, user_id, timezone_name, local_date, capture_operation_key, capture_mime_type
) values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  '33333333-3333-4333-8333-333333333333',
  'Asia/Taipei',
  '2026-09-01',
  'capture_20260901_intentional_second_002',
  'image/jpeg'
);

insert into public.generation_jobs (
  user_id, entry_id, job_type, deduplication_key
) values (
  '33333333-3333-4333-8333-333333333333',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'analysis',
  'initial:cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
);

do $$
begin
  begin
    insert into public.generation_jobs (
      user_id, entry_id, job_type, deduplication_key
    ) values (
      '33333333-3333-4333-8333-333333333333',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      'analysis',
      'initial:cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
    );
    raise exception 'Duplicate initial analysis job unexpectedly succeeded.';
  exception when unique_violation then
    null;
  end;
end;
$$;

rollback;

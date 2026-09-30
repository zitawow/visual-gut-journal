-- P0 beta-gate database contracts for upload lifecycle, usage enforcement,
-- backend-only monitoring, and durable analysis fallback. Run only against an
-- isolated/local database; every fixture and write is rolled back.

begin;

insert into auth.users (id, email, raw_user_meta_data)
values ('44444444-4444-4444-8444-444444444444', 'beta-gate@example.invalid', '{"display_name":"Beta Gate"}');

do $test$
declare
  allowed boolean;
  event_total integer;
begin
  select public.consume_usage_event(
    '44444444-4444-4444-8444-444444444444', 'capture_create', current_date,
    'capture_beta_gate_operation_001', 1
  ) into allowed;
  if allowed is not true then raise exception 'First quota event should be allowed.'; end if;

  select public.consume_usage_event(
    '44444444-4444-4444-8444-444444444444', 'capture_create', current_date,
    'capture_beta_gate_operation_001', 1
  ) into allowed;
  if allowed is not true then raise exception 'Idempotent quota replay should remain allowed.'; end if;

  select public.consume_usage_event(
    '44444444-4444-4444-8444-444444444444', 'capture_create', current_date,
    'capture_beta_gate_operation_002', 1
  ) into allowed;
  if allowed is not false then raise exception 'Quota overflow should be denied.'; end if;

  select count(*) into event_total from public.usage_events
  where user_id = '44444444-4444-4444-8444-444444444444';
  if event_total <> 1 then raise exception 'Quota ledger should contain one logical operation, got %.', event_total; end if;
end;
$test$;

insert into public.journal_entries (
  id, user_id, timezone_name, local_date, capture_operation_key, capture_mime_type,
  capture_upload_status, upload_expires_at
) values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '44444444-4444-4444-8444-444444444444',
  'Asia/Taipei', current_date,
  'capture_beta_gate_expired_upload_01', 'image/jpeg',
  'awaiting_upload', now() - interval '1 minute'
);

do $test$
begin
  begin
    update public.journal_entries
    set capture_upload_status = 'ready'
    where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    raise exception 'Ready upload unexpectedly accepted an expiry timestamp.';
  exception when check_violation then
    null;
  end;
end;
$test$;

insert into public.generation_jobs (
  id, user_id, entry_id, job_type, status, created_at
) values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '44444444-4444-4444-8444-444444444444',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'analysis', 'queued', now() - interval '10 minutes'
);

select public.mark_stale_analysis_jobs_manual_required(interval '5 minutes');

do $test$
declare
  job_status text;
  event_total integer;
begin
  select status into job_status from public.generation_jobs
  where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  if job_status <> 'manual_required' then raise exception 'Stale analysis did not reach manual fallback.'; end if;

  select count(*) into event_total from public.operational_events
  where job_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    and event_type = 'analysis_manual_required';
  if event_total <> 1 then raise exception 'Manual fallback operational event missing.'; end if;
end;
$test$;

set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';

do $test$
begin
  begin
    perform count(*) from public.usage_events;
    raise exception 'Authenticated client unexpectedly read backend usage ledger.';
  exception when insufficient_privilege then null;
  end;

  begin
    perform count(*) from public.operational_events;
    raise exception 'Authenticated client unexpectedly read operational monitoring.';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.consume_usage_event(
      '44444444-4444-4444-8444-444444444444', 'capture_create', current_date,
      'capture_client_bypass_attempt_001', 999
    );
    raise exception 'Authenticated client unexpectedly bypassed backend quota RPC.';
  exception when insufficient_privilege then null;
  end;
end;
$test$;

rollback;

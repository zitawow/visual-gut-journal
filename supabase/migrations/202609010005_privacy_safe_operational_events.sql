-- Minimal privacy-safe monitoring. Events contain workflow identifiers and
-- bounded error codes only; never image URLs/bodies, tokens, notes, or AI payloads.

begin;

create table public.operational_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null,
  user_id uuid references auth.users (id) on delete set null,
  entry_id uuid,
  job_id uuid,
  error_code text,
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint operational_events_type check (event_type in (
    'capture_pipeline_failed',
    'capture_cleanup_failed',
    'analysis_manual_required',
    'usage_limit_reached',
    'private_media_access_failed',
    'account_deletion_failed'
  )),
  constraint operational_events_severity check (severity in ('info', 'warning', 'error')),
  constraint operational_events_error_length check (error_code is null or char_length(error_code) <= 80),
  constraint operational_events_context_object check (jsonb_typeof(context) = 'object')
);

create index operational_events_recent_idx
  on public.operational_events (occurred_at desc, severity, event_type);

alter table public.operational_events enable row level security;
revoke all on table public.operational_events from public, anon, authenticated;
grant select, insert, delete on table public.operational_events to service_role;

create or replace function public.record_analysis_manual_required_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'manual_required' and old.status is distinct from new.status then
    insert into public.operational_events (
      event_type, severity, user_id, entry_id, job_id, error_code
    ) values (
      'analysis_manual_required', 'warning', new.user_id, new.entry_id, new.id, new.error_code
    );
  end if;
  return new;
end;
$$;

create trigger generation_jobs_record_manual_required
after update of status on public.generation_jobs
for each row execute function public.record_analysis_manual_required_event();

create or replace function public.purge_old_operational_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare affected integer;
begin
  delete from public.operational_events where occurred_at < now() - interval '30 days';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.record_analysis_manual_required_event() from public, anon, authenticated;
revoke all on function public.purge_old_operational_events() from public, anon, authenticated;
grant execute on function public.purge_old_operational_events() to service_role;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'operational-events-retention') then
    perform cron.schedule(
      'operational-events-retention',
      '17 3 * * *',
      $purge$select public.purge_old_operational_events();$purge$
    );
  end if;
end;
$$;

commit;

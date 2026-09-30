-- Durable analysis lifecycle for the closed beta.
--
-- Analysis still runs in an Edge Function background task, but the database is
-- the source of truth. A Postgres cron watchdog moves abandoned queued/running
-- jobs to manual_required so the client never waits forever.

begin;

alter table public.generation_jobs
  drop constraint generation_jobs_status;

alter table public.generation_jobs
  add constraint generation_jobs_status check (
    status in ('queued', 'running', 'succeeded', 'failed', 'manual_required', 'cancelled')
  );

create index if not exists generation_jobs_entry_type_created_idx
  on public.generation_jobs (entry_id, job_type, created_at desc)
  where entry_id is not null;

create or replace function public.mark_stale_analysis_jobs_manual_required(
  p_stale_after interval default interval '5 minutes'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if p_stale_after < interval '1 minute' then
    raise exception 'stale interval must be at least one minute';
  end if;

  update public.generation_jobs as job
  set
    status = 'manual_required',
    error_code = 'analysis_stalled',
    error_message = 'Analysis did not reach a terminal state before the safety deadline.',
    next_retry_at = null,
    completed_at = now()
  where job.job_type = 'analysis'
    and job.status in ('queued', 'running')
    and coalesce(job.started_at, job.created_at) < now() - p_stale_after
    and not exists (
      select 1
      from public.stool_analyses as analysis
      where analysis.entry_id = job.entry_id
        and analysis.user_id = job.user_id
        and analysis.is_current is true
        and analysis.result_status = 'succeeded'
    );

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

revoke all on function public.mark_stale_analysis_jobs_manual_required(interval)
  from public, anon, authenticated;
grant execute on function public.mark_stale_analysis_jobs_manual_required(interval)
  to service_role;

comment on function public.mark_stale_analysis_jobs_manual_required(interval) is
  'Trusted watchdog: converts abandoned analysis jobs to manual fallback without touching completed analyses.';

create extension if not exists pg_cron;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'analysis-job-stale-watchdog'
  ) then
    perform cron.schedule(
      'analysis-job-stale-watchdog',
      '*/2 * * * *',
      $watchdog$select public.mark_stale_analysis_jobs_manual_required(interval '5 minutes');$watchdog$
    );
  end if;
end;
$$;

commit;

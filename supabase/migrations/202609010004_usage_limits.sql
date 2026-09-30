-- Atomic, backend-only usage ledger. The idempotency key means a replay of the
-- same logical action is allowed without consuming quota twice.

begin;

create table public.usage_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null,
  window_start date not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint usage_events_metric check (metric in ('capture_create', 'analysis_attempt')),
  constraint usage_events_key_length check (char_length(idempotency_key) between 8 and 160),
  primary key (user_id, metric, window_start, idempotency_key)
);

create index usage_events_window_count_idx
  on public.usage_events (user_id, metric, window_start);

alter table public.usage_events enable row level security;
revoke all on table public.usage_events from public, anon, authenticated;
grant select, insert, delete on table public.usage_events to service_role;

create or replace function public.consume_usage_event(
  p_user_id uuid,
  p_metric text,
  p_window_start date,
  p_idempotency_key text,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_total integer;
begin
  if p_metric not in ('capture_create', 'analysis_attempt')
    or p_limit < 1
    or char_length(p_idempotency_key) not between 8 and 160
  then
    raise exception 'invalid usage event';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_user_id::text || ':' || p_metric || ':' || p_window_start::text,
    0
  ));

  if exists (
    select 1 from public.usage_events
    where user_id = p_user_id
      and metric = p_metric
      and window_start = p_window_start
      and idempotency_key = p_idempotency_key
  ) then
    return true;
  end if;

  select count(*) into current_total
  from public.usage_events
  where user_id = p_user_id
    and metric = p_metric
    and window_start = p_window_start;

  if current_total >= p_limit then return false; end if;

  insert into public.usage_events (user_id, metric, window_start, idempotency_key)
  values (p_user_id, p_metric, p_window_start, p_idempotency_key);
  return true;
end;
$$;

create or replace function public.release_usage_event(
  p_user_id uuid,
  p_metric text,
  p_window_start date,
  p_idempotency_key text
)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.usage_events
  where user_id = p_user_id
    and metric = p_metric
    and window_start = p_window_start
    and idempotency_key = p_idempotency_key;
$$;

revoke all on function public.consume_usage_event(uuid, text, date, text, integer)
  from public, anon, authenticated;
revoke all on function public.release_usage_event(uuid, text, date, text)
  from public, anon, authenticated;
grant execute on function public.consume_usage_event(uuid, text, date, text, integer) to service_role;
grant execute on function public.release_usage_event(uuid, text, date, text) to service_role;

comment on table public.usage_events is
  'Backend-only idempotent usage ledger; contains no image, health classification, or request body.';

commit;

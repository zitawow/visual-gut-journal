-- Visual Gut Journal / GUTVERSE
-- v1.1 architecture optimization.
--
-- This migration preserves the v1 ownership and RLS model while adding:
-- - versioned 1:N stool analyses with one backend-selected current result
-- - typed, multi-field user corrections
-- - original-photo retention metadata
-- - per-document immutable consent events
-- - extensible journal context
-- - queryable AI usage/cost fields
-- - one security-invoker effective-analysis view

begin;

-- ---------------------------------------------------------------------------
-- 1. Versioned stool analyses
-- ---------------------------------------------------------------------------

alter table public.stool_analyses
  drop constraint if exists stool_analyses_entry_id_key;

alter table public.stool_analyses
  add column model_name text,
  add column prompt_version text,
  add column generation_job_id uuid,
  add column result_status text not null default 'succeeded',
  add column is_current boolean not null default false;

alter table public.generation_jobs
  add constraint generation_jobs_id_user_unique unique (id, user_id);

alter table public.stool_analyses
  add constraint stool_analyses_generation_job_owner_fk
    foreign key (generation_job_id, user_id)
    references public.generation_jobs (id, user_id)
    on delete set null (generation_job_id),
  add constraint stool_analyses_result_status
    check (result_status in ('succeeded', 'rejected')),
  add constraint stool_analyses_current_must_be_succeeded
    check (is_current is false or result_status = 'succeeded'),
  add constraint stool_analyses_id_user_unique unique (id, user_id);

-- v1 allowed only one result per entry, so every existing result is current.
update public.stool_analyses
set is_current = true;

create unique index stool_analyses_one_current_per_entry_idx
  on public.stool_analyses (entry_id)
  where is_current is true;

create index stool_analyses_entry_created_idx
  on public.stool_analyses (entry_id, created_at desc);

-- Switching current analysis is a small atomic operation owned by trusted
-- backend code. The journal-entry lock serializes concurrent retries.
create or replace function public.activate_stool_analysis(p_analysis_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_entry_id uuid;
begin
  select analysis.entry_id
  into selected_entry_id
  from public.stool_analyses as analysis
  where analysis.id = p_analysis_id
    and analysis.result_status = 'succeeded';

  if selected_entry_id is null then
    raise exception 'A succeeded stool analysis with id % was not found.', p_analysis_id
      using errcode = 'P0002';
  end if;

  perform 1
  from public.journal_entries as journal_entry
  where journal_entry.id = selected_entry_id
  for update;

  update public.stool_analyses
  set is_current = false
  where entry_id = selected_entry_id
    and is_current is true;

  update public.stool_analyses
  set is_current = true
  where id = p_analysis_id;
end;
$$;

revoke execute on function public.activate_stool_analysis(uuid)
  from public, anon, authenticated;
grant execute on function public.activate_stool_analysis(uuid)
  to service_role;

comment on function public.activate_stool_analysis(uuid) is
  'Atomically selects the effective AI result for one entry; callable only by trusted backend code.';

-- ---------------------------------------------------------------------------
-- 2. Typed, multi-field corrections
-- ---------------------------------------------------------------------------

alter table public.analysis_corrections
  alter column corrected_bristol_type drop not null,
  add column corrected_color text,
  add column corrected_shape text,
  add column corrected_texture text;

alter table public.analysis_corrections
  add constraint analysis_corrections_color check (
    corrected_color is null
    or corrected_color in ('light_brown', 'medium_brown', 'dark_brown', 'yellow', 'green', 'black', 'red', 'clay', 'other')
  ),
  add constraint analysis_corrections_shape check (
    corrected_shape is null
    or corrected_shape in ('pellets', 'lumpy', 'cracked', 'smooth', 'soft_blobs', 'mushy', 'watery', 'uncertain')
  ),
  add constraint analysis_corrections_texture check (
    corrected_texture is null
    or corrected_texture in ('dry', 'firm', 'smooth', 'soft', 'liquid', 'uncertain')
  ),
  add constraint analysis_corrections_has_value check (
    num_nonnulls(
      corrected_bristol_type,
      corrected_color,
      corrected_shape,
      corrected_texture
    ) > 0
  );

comment on table public.analysis_corrections is
  'Append-only typed user corrections. The latest non-null value per field is effective.';

-- ---------------------------------------------------------------------------
-- 3. Original-photo retention metadata
-- ---------------------------------------------------------------------------

alter table public.media_assets
  add column retention_policy text,
  add column retention_requested_at timestamptz,
  add column scheduled_delete_at timestamptz;

update public.media_assets
set retention_policy = 'keep',
    retention_requested_at = created_at
where kind = 'original_capture';

alter table public.media_assets
  add constraint media_assets_original_retention check (
    (
      kind = 'original_capture'
      and retention_policy in ('keep', 'delete_after_analysis', 'delete_after_7_days')
      and retention_requested_at is not null
    )
    or
    (
      kind <> 'original_capture'
      and retention_policy is null
      and retention_requested_at is null
      and scheduled_delete_at is null
    )
  ),
  add constraint media_assets_keep_has_no_schedule check (
    retention_policy is distinct from 'keep'
    or scheduled_delete_at is null
  );

create index media_assets_scheduled_original_deletion_idx
  on public.media_assets (scheduled_delete_at)
  where kind = 'original_capture'
    and status = 'ready'
    and scheduled_delete_at is not null;

comment on column public.media_assets.scheduled_delete_at is
  'Trusted-backend deletion target. Null until processing establishes a safe deletion time.';

-- ---------------------------------------------------------------------------
-- 4. Per-document immutable consent events
-- ---------------------------------------------------------------------------

-- v1 consent rows represented a three-item acceptance bundle. Rebuild the same
-- table name as one immutable event per consent document while preserving data.
alter table public.consent_events rename to consent_events_v1_legacy;
alter index public.consent_events_user_recorded_idx
  rename to consent_events_v1_legacy_user_recorded_idx;

create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type text not null,
  document_version text not null,
  action text not null,
  source_platform text not null,
  app_version text,
  occurred_at timestamptz not null default now(),
  constraint consent_events_type check (
    consent_type in (
      'privacy_policy',
      'sensitive_data_processing',
      'ai_analysis',
      'non_medical_disclaimer'
    )
  ),
  constraint consent_events_action check (action in ('accepted', 'withdrawn')),
  constraint consent_events_platform check (source_platform in ('ios', 'android', 'web')),
  constraint consent_events_document_version_length check (
    char_length(document_version) between 1 and 80
  )
);

insert into public.consent_events (
  user_id,
  consent_type,
  document_version,
  action,
  source_platform,
  app_version,
  occurred_at
)
select
  legacy.user_id,
  expanded.consent_type,
  expanded.document_version,
  legacy.event_type,
  legacy.source_platform,
  legacy.app_version,
  legacy.recorded_at
from public.consent_events_v1_legacy as legacy
cross join lateral (
  values
    ('privacy_policy'::text, legacy.privacy_policy_version),
    ('sensitive_data_processing'::text, legacy.consent_version),
    ('non_medical_disclaimer'::text, legacy.consent_version)
) as expanded(consent_type, document_version);

create index consent_events_user_type_occurred_idx
  on public.consent_events (user_id, consent_type, occurred_at desc);

alter table public.consent_events enable row level security;

revoke all on table public.consent_events from public, anon, authenticated;
grant select, insert on table public.consent_events to authenticated;

create policy consent_events_select_own
on public.consent_events for select
to authenticated
using (user_id = (select auth.uid()));

create policy consent_events_insert_own
on public.consent_events for insert
to authenticated
with check (user_id = (select auth.uid()));

-- Backend code may append and read consent events, but cannot rewrite history.
revoke all on table public.consent_events from service_role;
grant select, insert on table public.consent_events to service_role;

drop table public.consent_events_v1_legacy;

comment on table public.consent_events is
  'Immutable per-document consent acceptance and withdrawal history.';

-- ---------------------------------------------------------------------------
-- 5. Extensible journal context
-- ---------------------------------------------------------------------------

alter table public.journal_contexts
  add column extra_context jsonb not null default '{}'::jsonb,
  add constraint journal_contexts_extra_context_object check (
    jsonb_typeof(extra_context) = 'object'
  ),
  add constraint journal_contexts_extra_context_size check (
    pg_column_size(extra_context) <= 8192
  );

comment on column public.journal_contexts.extra_context is
  'Small, app-validated experimental context fields; stable fields remain typed columns.';

-- ---------------------------------------------------------------------------
-- 6. Queryable generation usage and cost
-- ---------------------------------------------------------------------------

alter table public.generation_jobs
  add column input_units bigint,
  add column output_units bigint,
  add column usage_unit text,
  add column cost_currency character(3);

update public.generation_jobs
set cost_currency = 'USD'
where cost_micros is not null;

alter table public.generation_jobs
  add constraint generation_jobs_input_units check (input_units is null or input_units >= 0),
  add constraint generation_jobs_output_units check (output_units is null or output_units >= 0),
  add constraint generation_jobs_usage_unit_required check (
    (input_units is null and output_units is null)
    or nullif(trim(usage_unit), '') is not null
  ),
  add constraint generation_jobs_currency check (
    (cost_micros is null and cost_currency is null)
    or (cost_micros is not null and cost_currency ~ '^[A-Z]{3}$')
  );

comment on column public.generation_jobs.cost_micros is
  'Exact cost in one-millionth of cost_currency; avoids floating-point accounting errors.';

-- ---------------------------------------------------------------------------
-- 7. One RLS-safe effective analysis layer
-- ---------------------------------------------------------------------------

create view public.journal_entry_effective_analysis
with (security_invoker = true)
as
select
  journal_entry.id as entry_id,
  journal_entry.user_id,
  journal_entry.occurred_at,
  journal_entry.timezone_name,
  journal_entry.local_date,
  current_analysis.id as current_analysis_id,
  current_analysis.provider as model_provider,
  current_analysis.model_name,
  current_analysis.model_version,
  current_analysis.prompt_version,
  current_analysis.analysis_schema_version,
  current_analysis.confidence,
  current_analysis.confidence_band,
  current_analysis.requires_retake,
  current_analysis.bristol_type as ai_bristol_type,
  correction.corrected_bristol_type,
  coalesce(correction.corrected_bristol_type, current_analysis.bristol_type) as effective_bristol_type,
  current_analysis.color as ai_color,
  correction.corrected_color,
  coalesce(correction.corrected_color, current_analysis.color) as effective_color,
  current_analysis.shape as ai_shape,
  correction.corrected_shape,
  coalesce(correction.corrected_shape, current_analysis.shape) as effective_shape,
  current_analysis.texture as ai_texture,
  correction.corrected_texture,
  coalesce(correction.corrected_texture, current_analysis.texture) as effective_texture,
  correction.corrected_bristol_type is not null as has_bristol_correction,
  correction.corrected_color is not null as has_color_correction,
  correction.corrected_shape is not null as has_shape_correction,
  correction.corrected_texture is not null as has_texture_correction,
  num_nonnulls(
    correction.corrected_bristol_type,
    correction.corrected_color,
    correction.corrected_shape,
    correction.corrected_texture
  ) > 0 as has_user_correction,
  case
    when num_nonnulls(
      correction.corrected_bristol_type,
      correction.corrected_color,
      correction.corrected_shape,
      correction.corrected_texture
    ) > 0 then 'user_correction'
    when current_analysis.id is not null then 'ai'
    else 'unavailable'
  end as analysis_source
from public.journal_entries as journal_entry
left join public.stool_analyses as current_analysis
  on current_analysis.entry_id = journal_entry.id
  and current_analysis.user_id = journal_entry.user_id
  and current_analysis.is_current is true
left join lateral (
  select
    (
      array_agg(item.corrected_bristol_type order by item.created_at desc)
      filter (where item.corrected_bristol_type is not null)
    )[1] as corrected_bristol_type,
    (
      array_agg(item.corrected_color order by item.created_at desc)
      filter (where item.corrected_color is not null)
    )[1] as corrected_color,
    (
      array_agg(item.corrected_shape order by item.created_at desc)
      filter (where item.corrected_shape is not null)
    )[1] as corrected_shape,
    (
      array_agg(item.corrected_texture order by item.created_at desc)
      filter (where item.corrected_texture is not null)
    )[1] as corrected_texture
  from public.analysis_corrections as item
  where item.entry_id = journal_entry.id
    and item.user_id = journal_entry.user_id
) as correction on true;

revoke all on table public.journal_entry_effective_analysis
  from public, anon, authenticated;
grant select on table public.journal_entry_effective_analysis
  to authenticated, service_role;

comment on view public.journal_entry_effective_analysis is
  'RLS-safe single source of truth: latest typed user correction per field, otherwise current AI result.';

-- ---------------------------------------------------------------------------
-- Existing schema alignment
-- ---------------------------------------------------------------------------

alter table public.user_milestones
  drop constraint user_milestones_key;

update public.user_milestones
set milestone_key = 'season_of_gut'
where milestone_key = 'season_of_your_gut';

alter table public.user_milestones
  add constraint user_milestones_key check (
    milestone_key in (
      'first_piece',
      'first_gut_mood',
      'weekly_digest',
      'digestive_personality',
      'monthly_gallery',
      'season_of_gut',
      'gut_wrapped'
    )
  );

comment on table public.stool_analyses is
  'Versioned server-produced stool analyses; one successful row per entry may be current.';

commit;

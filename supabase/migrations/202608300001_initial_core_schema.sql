-- Visual Gut Journal / GUTVERSE
-- Core production schema for Supabase Postgres.
--
-- Design rules:
-- 1. auth.users is the identity source of truth. Do not duplicate email here.
-- 2. Every exposed table has RLS enabled and explicit grants.
-- 3. AI output is immutable to the client; user corrections are append-only.
-- 4. Binary files live in private Storage. These tables store paths and metadata only.
-- 5. Hard deletion and Storage cleanup are performed by a trusted server function.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Account profile
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'zh-Hant',
  timezone_name text not null default 'Asia/Taipei',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 80
  )
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, locale, timezone_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'zh-Hant'),
    coalesce(nullif(new.raw_user_meta_data ->> 'timezone_name', ''), 'Asia/Taipei')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Consent is an append-only event log. Withdrawal creates a new event rather
-- than modifying the original acceptance record.
create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  consent_version text not null,
  privacy_policy_version text not null,
  accepted_privacy boolean,
  accepted_sensitive_processing boolean,
  accepted_non_medical_use boolean,
  source_platform text not null,
  app_version text,
  recorded_at timestamptz not null default now(),
  constraint consent_events_event_type check (event_type in ('accepted', 'withdrawn')),
  constraint consent_events_platform check (source_platform in ('ios', 'android', 'web')),
  constraint consent_events_acceptance_is_complete check (
    (event_type = 'accepted'
      and accepted_privacy is true
      and accepted_sensitive_processing is true
      and accepted_non_medical_use is true)
    or
    (event_type = 'withdrawn'
      and accepted_privacy is false
      and accepted_sensitive_processing is false
      and accepted_non_medical_use is false)
  )
);

create index consent_events_user_recorded_idx
  on public.consent_events (user_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Journal and health observations
-- ---------------------------------------------------------------------------

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  timezone_name text not null,
  local_date date not null,
  source text not null default 'capture',
  user_confirmed boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint journal_entries_source check (source in ('capture', 'import')),
  constraint journal_entries_status check (status in ('active', 'pending_deletion')),
  constraint journal_entries_delete_state check (
    (status = 'active' and deleted_at is null)
    or (status = 'pending_deletion' and deleted_at is not null)
  ),
  unique (id, user_id)
);

create index journal_entries_user_occurred_idx
  on public.journal_entries (user_id, occurred_at desc)
  where deleted_at is null;

create index journal_entries_user_local_date_idx
  on public.journal_entries (user_id, local_date desc, occurred_at desc)
  where deleted_at is null;

create trigger journal_entries_set_updated_at
before update on public.journal_entries
for each row execute function public.set_updated_at();

-- The server writes the original AI observation. Authenticated clients can read
-- it but cannot overwrite it.
create table public.stool_analyses (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null unique,
  user_id uuid not null,
  bristol_type smallint not null,
  color text not null,
  shape text not null,
  texture text not null,
  confidence numeric(5, 4) not null,
  confidence_band text not null,
  requires_retake boolean not null default false,
  provider text not null,
  model_version text,
  analysis_schema_version text not null default '1.0',
  latency_ms integer,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint stool_analyses_entry_owner_fk
    foreign key (entry_id, user_id)
    references public.journal_entries (id, user_id)
    on delete cascade,
  constraint stool_analyses_bristol_range check (bristol_type between 1 and 7),
  constraint stool_analyses_color check (
    color in ('light_brown', 'medium_brown', 'dark_brown', 'yellow', 'green', 'black', 'red', 'clay', 'other')
  ),
  constraint stool_analyses_shape check (
    shape in ('pellets', 'lumpy', 'cracked', 'smooth', 'soft_blobs', 'mushy', 'watery', 'uncertain')
  ),
  constraint stool_analyses_texture check (
    texture in ('dry', 'firm', 'smooth', 'soft', 'liquid', 'uncertain')
  ),
  constraint stool_analyses_confidence check (confidence between 0 and 1),
  constraint stool_analyses_confidence_band check (confidence_band in ('high', 'medium', 'low')),
  constraint stool_analyses_latency check (latency_ms is null or latency_ms >= 0),
  constraint stool_analyses_metadata_object check (jsonb_typeof(provider_metadata) = 'object')
);

create index stool_analyses_user_created_idx
  on public.stool_analyses (user_id, created_at desc);

-- User corrections never destroy the AI observation. The latest event is the
-- effective user-confirmed Bristol type.
create table public.analysis_corrections (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  user_id uuid not null,
  corrected_bristol_type smallint not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint analysis_corrections_entry_owner_fk
    foreign key (entry_id, user_id)
    references public.journal_entries (id, user_id)
    on delete cascade,
  constraint analysis_corrections_bristol_range check (corrected_bristol_type between 1 and 7),
  constraint analysis_corrections_reason_length check (reason is null or char_length(reason) <= 300)
);

create index analysis_corrections_entry_created_idx
  on public.analysis_corrections (entry_id, created_at desc);

create table public.journal_contexts (
  entry_id uuid primary key,
  user_id uuid not null,
  hydration text,
  fiber text,
  sleep_hours numeric(4, 2),
  stress text,
  comfort text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_contexts_entry_owner_fk
    foreign key (entry_id, user_id)
    references public.journal_entries (id, user_id)
    on delete cascade,
  constraint journal_contexts_hydration check (hydration is null or hydration in ('low', 'moderate', 'high')),
  constraint journal_contexts_fiber check (fiber is null or fiber in ('low', 'moderate', 'high')),
  constraint journal_contexts_sleep check (sleep_hours is null or sleep_hours between 0 and 24),
  constraint journal_contexts_stress check (stress is null or stress in ('low', 'moderate', 'high')),
  constraint journal_contexts_comfort check (
    comfort is null or comfort in ('comfortable', 'slight_strain', 'urgent')
  ),
  constraint journal_contexts_note_length check (note is null or char_length(note) <= 1000)
);

create trigger journal_contexts_set_updated_at
before update on public.journal_contexts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Private file metadata and collectibles
-- ---------------------------------------------------------------------------

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid,
  kind text not null,
  bucket_id text not null,
  object_path text not null,
  mime_type text not null,
  byte_size bigint,
  width integer,
  height integer,
  sha256 text,
  perceptual_hash text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint media_assets_entry_owner_fk
    foreign key (entry_id, user_id)
    references public.journal_entries (id, user_id)
    on delete cascade,
  constraint media_assets_kind check (
    kind in ('original_capture', 'artwork_base', 'artwork_final', 'doctor_report', 'share_card')
  ),
  constraint media_assets_bucket check (
    bucket_id in ('originals-private', 'artworks-private', 'reports-private')
  ),
  constraint media_assets_status check (status in ('pending', 'ready', 'failed', 'deleted')),
  constraint media_assets_size check (byte_size is null or byte_size >= 0),
  constraint media_assets_width check (width is null or width > 0),
  constraint media_assets_height check (height is null or height > 0),
  constraint media_assets_object_path_not_url check (
    object_path !~* '^(https?|data|file)://'
  ),
  constraint media_assets_delete_state check (
    (status = 'deleted' and deleted_at is not null)
    or (status <> 'deleted' and deleted_at is null)
  ),
  unique (bucket_id, object_path),
  unique (id, user_id)
);

create index media_assets_user_entry_idx
  on public.media_assets (user_id, entry_id, kind, created_at desc);

create unique index media_assets_generated_sha256_unique_idx
  on public.media_assets (sha256)
  where sha256 is not null and kind in ('artwork_base', 'artwork_final');

create table public.collectibles (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null unique,
  user_id uuid not null,
  collection_id text not null default 'GUTVERSE-ORIGINS',
  serial bigint not null,
  display_id text not null,
  generation_id uuid not null default gen_random_uuid(),
  dna_version text not null default '1.0',
  engine_version text not null default '1.0',
  seed bigint not null,
  form text not null,
  palette text not null,
  fluidity numeric(5, 4) not null,
  complexity numeric(5, 4) not null,
  traits jsonb not null,
  render_contract jsonb not null,
  trait_fingerprint text not null,
  prompt_version text not null,
  generation_provider text,
  generation_model text,
  final_asset_id uuid,
  status text not null default 'pending',
  minted_chain text,
  minted_contract_address text,
  minted_token_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collectibles_entry_owner_fk
    foreign key (entry_id, user_id)
    references public.journal_entries (id, user_id)
    on delete cascade,
  constraint collectibles_final_asset_fk
    foreign key (final_asset_id)
    references public.media_assets (id)
    on delete set null,
  constraint collectibles_form check (form in ('mineral', 'ribbon', 'petal', 'liquid')),
  constraint collectibles_palette check (palette in ('clay', 'moss', 'amber')),
  constraint collectibles_fluidity check (fluidity between 0 and 1),
  constraint collectibles_complexity check (complexity between 0 and 1),
  constraint collectibles_status check (
    status in ('pending', 'generating', 'off_chain', 'mint_ready', 'minted', 'failed')
  ),
  constraint collectibles_traits_object check (jsonb_typeof(traits) = 'object'),
  constraint collectibles_render_contract_object check (jsonb_typeof(render_contract) = 'object'),
  constraint collectibles_mint_fields check (
    status <> 'minted'
    or (minted_chain is not null and minted_contract_address is not null and minted_token_id is not null)
  ),
  unique (collection_id, serial),
  unique (display_id),
  unique (generation_id),
  unique (collection_id, dna_version, trait_fingerprint),
  unique (id, user_id)
);

create index collectibles_user_created_idx
  on public.collectibles (user_id, created_at desc);

create trigger collectibles_set_updated_at
before update on public.collectibles
for each row execute function public.set_updated_at();

-- Generation jobs are observable by the owner but written only by trusted
-- backend code. input_payload must reference asset IDs, never contain image data.
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid,
  collectible_id uuid,
  job_type text not null,
  status text not null default 'queued',
  attempt smallint not null default 0,
  max_attempts smallint not null default 3,
  provider text,
  model text,
  prompt_version text,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  cost_micros bigint,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  next_retry_at timestamptz,
  constraint generation_jobs_entry_owner_fk
    foreign key (entry_id, user_id)
    references public.journal_entries (id, user_id)
    on delete cascade,
  constraint generation_jobs_collectible_owner_fk
    foreign key (collectible_id, user_id)
    references public.collectibles (id, user_id)
    on delete cascade,
  constraint generation_jobs_type check (job_type in ('analysis', 'artwork', 'doctor_report', 'share_card')),
  constraint generation_jobs_status check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  constraint generation_jobs_attempts check (
    attempt >= 0 and max_attempts between 1 and 10 and attempt <= max_attempts
  ),
  constraint generation_jobs_cost check (cost_micros is null or cost_micros >= 0),
  constraint generation_jobs_input_object check (jsonb_typeof(input_payload) = 'object'),
  constraint generation_jobs_output_object check (jsonb_typeof(output_payload) = 'object'),
  constraint generation_jobs_error_length check (error_message is null or char_length(error_message) <= 1000)
);

create index generation_jobs_pending_idx
  on public.generation_jobs (status, next_retry_at, created_at)
  where status in ('queued', 'failed');

create index generation_jobs_user_created_idx
  on public.generation_jobs (user_id, created_at desc);

-- Milestones store only the unlock/seen state. Progress is computed from journal
-- entries so counts cannot drift.
create table public.user_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  milestone_key text not null,
  unlocked_at timestamptz not null,
  first_seen_at timestamptz,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_milestones_key check (
    milestone_key in (
      'first_piece',
      'first_gut_mood',
      'weekly_digest',
      'digestive_personality',
      'monthly_gallery',
      'season_of_your_gut',
      'gut_wrapped'
    )
  ),
  constraint user_milestones_snapshot_object check (jsonb_typeof(snapshot) = 'object'),
  unique (user_id, milestone_key)
);

create trigger user_milestones_set_updated_at
before update on public.user_milestones
for each row execute function public.set_updated_at();

-- Requests are processed by an Edge Function. Clients cannot mark their own
-- request as completed.
create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid,
  request_type text not null,
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  failure_reason text,
  constraint privacy_requests_entry_fk
    foreign key (entry_id)
    references public.journal_entries (id)
    on delete set null,
  constraint privacy_requests_type check (
    request_type in ('export_data', 'delete_original', 'delete_entry', 'delete_account')
  ),
  constraint privacy_requests_status check (
    status in ('requested', 'processing', 'completed', 'failed', 'cancelled')
  ),
  constraint privacy_requests_completion_state check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed')
  ),
  constraint privacy_requests_failure_length check (
    failure_reason is null or char_length(failure_reason) <= 1000
  )
);

create index privacy_requests_user_created_idx
  on public.privacy_requests (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.consent_events enable row level security;
alter table public.journal_entries enable row level security;
alter table public.stool_analyses enable row level security;
alter table public.analysis_corrections enable row level security;
alter table public.journal_contexts enable row level security;
alter table public.media_assets enable row level security;
alter table public.collectibles enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.user_milestones enable row level security;
alter table public.privacy_requests enable row level security;

-- Remove broad defaults, then grant only the operations the mobile/web client needs.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.consent_events from anon, authenticated;
revoke all on table public.journal_entries from anon, authenticated;
revoke all on table public.stool_analyses from anon, authenticated;
revoke all on table public.analysis_corrections from anon, authenticated;
revoke all on table public.journal_contexts from anon, authenticated;
revoke all on table public.media_assets from anon, authenticated;
revoke all on table public.collectibles from anon, authenticated;
revoke all on table public.generation_jobs from anon, authenticated;
revoke all on table public.user_milestones from anon, authenticated;
revoke all on table public.privacy_requests from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert on table public.consent_events to authenticated;
grant select, insert, update on table public.journal_entries to authenticated;
grant select on table public.stool_analyses to authenticated;
grant select, insert on table public.analysis_corrections to authenticated;
grant select, insert, update, delete on table public.journal_contexts to authenticated;
grant select on table public.media_assets to authenticated;
grant select on table public.collectibles to authenticated;
grant select on table public.generation_jobs to authenticated;
grant select, insert, update on table public.user_milestones to authenticated;
grant select, insert on table public.privacy_requests to authenticated;

create policy profiles_select_own
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy consent_events_select_own
on public.consent_events for select
to authenticated
using (user_id = (select auth.uid()));

create policy consent_events_insert_own
on public.consent_events for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy journal_entries_select_own_active
on public.journal_entries for select
to authenticated
using (user_id = (select auth.uid()) and deleted_at is null);

create policy journal_entries_insert_own
on public.journal_entries for insert
to authenticated
with check (user_id = (select auth.uid()) and deleted_at is null and status = 'active');

create policy journal_entries_update_own
on public.journal_entries for update
to authenticated
using (user_id = (select auth.uid()) and deleted_at is null)
with check (user_id = (select auth.uid()));

create policy stool_analyses_select_own
on public.stool_analyses for select
to authenticated
using (user_id = (select auth.uid()));

create policy analysis_corrections_select_own
on public.analysis_corrections for select
to authenticated
using (user_id = (select auth.uid()));

create policy analysis_corrections_insert_own
on public.analysis_corrections for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy journal_contexts_select_own
on public.journal_contexts for select
to authenticated
using (user_id = (select auth.uid()));

create policy journal_contexts_insert_own
on public.journal_contexts for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy journal_contexts_update_own
on public.journal_contexts for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy journal_contexts_delete_own
on public.journal_contexts for delete
to authenticated
using (user_id = (select auth.uid()));

create policy media_assets_select_own
on public.media_assets for select
to authenticated
using (user_id = (select auth.uid()));

create policy collectibles_select_own
on public.collectibles for select
to authenticated
using (user_id = (select auth.uid()));

create policy generation_jobs_select_own
on public.generation_jobs for select
to authenticated
using (user_id = (select auth.uid()));

create policy user_milestones_select_own
on public.user_milestones for select
to authenticated
using (user_id = (select auth.uid()));

create policy user_milestones_insert_own
on public.user_milestones for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy user_milestones_update_own
on public.user_milestones for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy privacy_requests_select_own
on public.privacy_requests for select
to authenticated
using (user_id = (select auth.uid()));

create policy privacy_requests_insert_own
on public.privacy_requests for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'requested'
  and (
    entry_id is null
    or exists (
      select 1
      from public.journal_entries as journal_entry
      where journal_entry.id = entry_id
        and journal_entry.user_id = (select auth.uid())
        and journal_entry.deleted_at is null
    )
  )
);

-- Service-role code is the only writer for immutable analysis, file metadata,
-- collectible identity, job state, and request completion.
grant all on table public.profiles to service_role;
grant all on table public.consent_events to service_role;
grant all on table public.journal_entries to service_role;
grant all on table public.stool_analyses to service_role;
grant all on table public.analysis_corrections to service_role;
grant all on table public.journal_contexts to service_role;
grant all on table public.media_assets to service_role;
grant all on table public.collectibles to service_role;
grant all on table public.generation_jobs to service_role;
grant all on table public.user_milestones to service_role;
grant all on table public.privacy_requests to service_role;

comment on table public.profiles is 'Public API-safe account profile linked 1:1 to auth.users.';
comment on table public.consent_events is 'Append-only acceptance and withdrawal history for consent versions.';
comment on table public.journal_entries is 'One bowel movement per row; multiple rows may share the same local_date.';
comment on table public.stool_analyses is 'Immutable server-produced stool analysis; user corrections live separately.';
comment on table public.analysis_corrections is 'Append-only user corrections to the AI Bristol type.';
comment on table public.media_assets is 'Metadata and private Storage paths; never contains image bytes or public URLs.';
comment on table public.collectibles is 'Deterministic GUTVERSE collectible identity and generation contract.';
comment on table public.generation_jobs is 'Server-managed async analysis, artwork, report, and share-card jobs.';
comment on table public.privacy_requests is 'User-initiated export/deletion requests processed by trusted backend code.';

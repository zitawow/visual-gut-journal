-- Idempotency keys make capture creation and initial analysis-job creation safe
-- to repeat across double taps, request retries, and reconnects. Keys are scoped
-- to one owner and do not collapse two intentional captures on the same day.

begin;

alter table public.journal_entries
  add column capture_operation_key text,
  add column capture_mime_type text,
  add constraint journal_entries_capture_operation_key_length check (
    capture_operation_key is null
    or char_length(capture_operation_key) between 20 and 100
  ),
  add constraint journal_entries_capture_mime_type check (
    capture_mime_type is null
    or capture_mime_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  add constraint journal_entries_capture_fields_pair check (
    (capture_operation_key is null and capture_mime_type is null)
    or (capture_operation_key is not null and capture_mime_type is not null)
  ),
  add constraint journal_entries_user_capture_operation_unique
    unique (user_id, capture_operation_key);

alter table public.generation_jobs
  add column deduplication_key text,
  add constraint generation_jobs_deduplication_key_length check (
    deduplication_key is null
    or char_length(deduplication_key) between 8 and 120
  ),
  add constraint generation_jobs_user_type_deduplication_unique
    unique (user_id, job_type, deduplication_key);

comment on column public.journal_entries.capture_operation_key is
  'Opaque per-capture idempotency key supplied by the client and scoped to the authenticated owner.';
comment on column public.generation_jobs.deduplication_key is
  'Trusted-backend key for safely repeating one logical generation request; NULL permits later distinct jobs.';

commit;

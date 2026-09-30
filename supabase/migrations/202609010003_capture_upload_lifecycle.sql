-- Explicit lifecycle for incomplete captures. This is deliberately separate
-- from successful-original retention: only expired, never-finalized uploads are
-- cleanup eligible.

begin;

alter table public.journal_entries
  add column capture_upload_status text not null default 'not_applicable',
  add column upload_expires_at timestamptz,
  add column upload_finalized_at timestamptz,
  add constraint journal_entries_capture_upload_status check (
    capture_upload_status in ('not_applicable', 'awaiting_upload', 'ready', 'failed')
  ),
  add constraint journal_entries_capture_upload_timestamps check (
    (capture_upload_status = 'awaiting_upload' and upload_expires_at is not null and upload_finalized_at is null)
    or (capture_upload_status = 'ready' and upload_expires_at is null)
    or (capture_upload_status in ('not_applicable', 'failed') and upload_expires_at is null)
  );

update public.journal_entries as entry
set
  capture_upload_status = case
    when exists (
      select 1 from public.media_assets as asset
      where asset.entry_id = entry.id
        and asset.user_id = entry.user_id
        and asset.kind = 'original_capture'
        and asset.status = 'ready'
    ) then 'ready'
    else 'awaiting_upload'
  end,
  upload_expires_at = case
    when exists (
      select 1 from public.media_assets as asset
      where asset.entry_id = entry.id
        and asset.user_id = entry.user_id
        and asset.kind = 'original_capture'
        and asset.status = 'ready'
    ) then null
    else now() + interval '1 hour'
  end,
  upload_finalized_at = case
    when exists (
      select 1 from public.media_assets as asset
      where asset.entry_id = entry.id
        and asset.user_id = entry.user_id
        and asset.kind = 'original_capture'
        and asset.status = 'ready'
    ) then now()
    else null
  end
where entry.capture_operation_key is not null;

create index journal_entries_expired_upload_idx
  on public.journal_entries (upload_expires_at, user_id)
  where capture_upload_status = 'awaiting_upload';

comment on column public.journal_entries.capture_upload_status is
  'Lifecycle of the initial private upload only; ready originals are never selected by incomplete-upload cleanup.';

commit;

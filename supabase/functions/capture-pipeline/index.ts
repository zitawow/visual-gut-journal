import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { CURRENT_CONSENT_VERSION, hasCurrentConsent } from '../_shared/consent.ts';
import { validateImageBytes } from '../_shared/image-validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
const allowedRetentionPolicies = ['keep', 'delete_after_analysis', 'delete_after_7_days'] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const operationKeyPattern = /^[a-zA-Z0-9_-]{20,100}$/;
const maxImageBytes = 10 * 1024 * 1024;
const maxImageDimension = 12_000;
const maxImagePixels = 25_000_000;
const dailyCaptureLimit = 10;

type JsonBody = Record<string, unknown>;

function safeErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code.slice(0, 80);
  }
  return 'capture_pipeline_failed';
}

async function recordOperationalEvent(
  admin: ReturnType<typeof createClient>,
  values: { event_type: string; severity: string; user_id: string; entry_id?: string; error_code?: string },
) {
  await admin.from('operational_events').insert(values).then(() => undefined, () => undefined);
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value as T[number]);
}

function localDateForTimezone(date: Date, timezoneName: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezoneName,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return null;
  }
}

async function createUploadTicket({
  admin,
  userId,
  entryId,
  mimeType,
}: {
  admin: ReturnType<typeof createClient>;
  userId: string;
  entryId: string;
  mimeType: typeof allowedMimeTypes[number];
}) {
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const objectPath = `${userId}/${entryId}/original.${extension}`;
  const { data, error } = await admin.storage
    .from('originals-private')
    .createSignedUploadUrl(objectPath, { upsert: true });
  if (error || !data?.token) throw error ?? new Error('Signed upload token was not created.');
  return { entryId, objectPath, uploadToken: data.token };
}

async function cleanupExpiredUploads(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: expired, error } = await admin
    .from('journal_entries')
    .select('id, capture_mime_type')
    .eq('user_id', userId)
    .eq('capture_upload_status', 'awaiting_upload')
    .lt('upload_expires_at', new Date().toISOString())
    .limit(20);
  if (error) throw error;

  let cleaned = 0;
  for (const entry of expired ?? []) {
    const extension = entry.capture_mime_type === 'image/png' ? 'png' : entry.capture_mime_type === 'image/webp' ? 'webp' : 'jpg';
    const objectPath = `${userId}/${entry.id}/original.${extension}`;
    const { error: removeError } = await admin.storage.from('originals-private').remove([objectPath]);
    if (removeError) {
      console.error('capture cleanup failed', { entryId: entry.id, code: 'storage_remove_failed' });
      await recordOperationalEvent(admin, { event_type: 'capture_cleanup_failed', severity: 'error', user_id: userId, entry_id: entry.id, error_code: 'storage_remove_failed' });
      continue;
    }
    const { error: updateError } = await admin.from('journal_entries').update({
      capture_operation_key: null,
      capture_mime_type: null,
      capture_upload_status: 'failed',
      upload_expires_at: null,
      status: 'pending_deletion',
      deleted_at: new Date().toISOString(),
    }).eq('id', entry.id).eq('user_id', userId).eq('capture_upload_status', 'awaiting_upload');
    if (updateError) {
      console.error('capture cleanup failed', { entryId: entry.id, code: 'metadata_update_failed' });
      await recordOperationalEvent(admin, { event_type: 'capture_cleanup_failed', severity: 'error', user_id: userId, entry_id: entry.id, error_code: 'metadata_update_failed' });
      continue;
    }
    cleaned += 1;
  }
  return cleaned;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server_not_configured' }, 500);

  const authorization = request.headers.get('Authorization') ?? '';
  const jwt = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!jwt) return json({ error: 'authentication_required' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !authData.user) return json({ error: 'invalid_session' }, 401);
  const user = authData.user;

  let body: JsonBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  try {
    if (body.action === 'cleanup') {
      const cleaned = await cleanupExpiredUploads(admin, user.id);
      return json({ cleaned });
    }

    if (body.action === 'create') {
      if (!await hasCurrentConsent(admin, user.id)) {
        return json({ error: 'current_consent_required', consentVersion: CURRENT_CONSENT_VERSION }, 409);
      }
      if (!isOneOf(body.mimeType, allowedMimeTypes)) return json({ error: 'unsupported_mime_type' }, 400);
      if (!isOneOf(body.retentionPolicy, allowedRetentionPolicies)) return json({ error: 'invalid_retention_policy' }, 400);
      if (typeof body.timezoneName !== 'string' || body.timezoneName.length > 80) return json({ error: 'invalid_timezone' }, 400);
      if (typeof body.operationKey !== 'string' || !operationKeyPattern.test(body.operationKey)) {
        return json({ error: 'invalid_operation_key' }, 400);
      }
      await cleanupExpiredUploads(admin, user.id);

      const { data: existingEntry, error: existingEntryError } = await admin
        .from('journal_entries')
        .select('id, capture_mime_type')
        .eq('user_id', user.id)
        .eq('capture_operation_key', body.operationKey)
        .is('deleted_at', null)
        .maybeSingle();
      if (existingEntryError) throw existingEntryError;
      if (existingEntry) {
        if (existingEntry.capture_mime_type !== body.mimeType) {
          return json({ error: 'operation_mime_type_mismatch' }, 409);
        }
        const { data: finalizedAsset, error: finalizedAssetError } = await admin
          .from('media_assets')
          .select('id')
          .eq('user_id', user.id)
          .eq('entry_id', existingEntry.id)
          .eq('kind', 'original_capture')
          .eq('status', 'ready')
          .maybeSingle();
        if (finalizedAssetError) throw finalizedAssetError;
        if (finalizedAsset) {
          return json({ entryId: existingEntry.id, alreadyFinalized: true, idempotentReplay: true });
        }
        const ticket = await createUploadTicket({
          admin,
          userId: user.id,
          entryId: existingEntry.id,
          mimeType: body.mimeType,
        });
        return json({ ...ticket, idempotentReplay: true });
      }

      const occurredAt = new Date();
      const localDate = localDateForTimezone(occurredAt, body.timezoneName);
      if (!localDate) return json({ error: 'invalid_timezone' }, 400);

      const usageWindow = occurredAt.toISOString().slice(0, 10);
      const { data: usageAllowed, error: usageError } = await admin.rpc('consume_usage_event', {
        p_user_id: user.id,
        p_metric: 'capture_create',
        p_window_start: usageWindow,
        p_idempotency_key: body.operationKey,
        p_limit: dailyCaptureLimit,
      });
      if (usageError) throw usageError;
      if (!usageAllowed) {
        await recordOperationalEvent(admin, { event_type: 'usage_limit_reached', severity: 'warning', user_id: user.id, error_code: 'capture_daily_limit' });
        return json({ error: 'usage_limit_reached', limit: dailyCaptureLimit, period: 'day' }, 429);
      }

      let entryId = crypto.randomUUID();
      const { error: entryError } = await admin.from('journal_entries').insert({
        id: entryId,
        user_id: user.id,
        occurred_at: occurredAt.toISOString(),
        timezone_name: body.timezoneName,
        local_date: localDate,
        source: 'capture',
        capture_operation_key: body.operationKey,
        capture_mime_type: body.mimeType,
        capture_upload_status: 'awaiting_upload',
        upload_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      if (entryError?.code === '23505') {
        const { data: racedEntry, error: racedEntryError } = await admin
          .from('journal_entries')
          .select('id, capture_mime_type')
          .eq('user_id', user.id)
          .eq('capture_operation_key', body.operationKey)
          .is('deleted_at', null)
          .single();
        if (racedEntryError) throw racedEntryError;
        if (racedEntry.capture_mime_type !== body.mimeType) {
          return json({ error: 'operation_mime_type_mismatch' }, 409);
        }
        entryId = racedEntry.id;
      } else if (entryError) {
        await admin.rpc('release_usage_event', {
          p_user_id: user.id,
          p_metric: 'capture_create',
          p_window_start: usageWindow,
          p_idempotency_key: body.operationKey,
        });
        throw entryError;
      }

      try {
        const ticket = await createUploadTicket({ admin, userId: user.id, entryId, mimeType: body.mimeType });
        return json(ticket);
      } catch (uploadError) {
        await admin.rpc('release_usage_event', {
          p_user_id: user.id,
          p_metric: 'capture_create',
          p_window_start: usageWindow,
          p_idempotency_key: body.operationKey,
        });
        await admin.from('journal_entries').update({
          capture_operation_key: null,
          capture_mime_type: null,
          capture_upload_status: 'failed',
          upload_expires_at: null,
          status: 'pending_deletion',
          deleted_at: new Date().toISOString(),
        }).eq('id', entryId).eq('user_id', user.id);
        throw uploadError;
      }
    }

    if (body.action === 'finalize') {
      if (typeof body.entryId !== 'string' || !uuidPattern.test(body.entryId)) return json({ error: 'invalid_entry_id' }, 400);
      if (typeof body.objectPath !== 'string') return json({ error: 'invalid_object_path' }, 400);
      if (!isOneOf(body.retentionPolicy, allowedRetentionPolicies)) return json({ error: 'invalid_retention_policy' }, 400);
      const expectedPrefix = `${user.id}/${body.entryId}/original.`;
      if (!body.objectPath.startsWith(expectedPrefix) || body.objectPath.includes('..')) return json({ error: 'invalid_object_path' }, 403);

      const { data: entry, error: entryError } = await admin
        .from('journal_entries')
        .select('id, capture_operation_key, occurred_at')
        .eq('id', body.entryId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();
      if (entryError) throw entryError;
      if (!entry) return json({ error: 'entry_not_found' }, 404);

      const releaseCaptureUsage = async () => {
        if (!entry.capture_operation_key) return;
        await admin.rpc('release_usage_event', {
          p_user_id: user.id,
          p_metric: 'capture_create',
          p_window_start: entry.occurred_at.slice(0, 10),
          p_idempotency_key: entry.capture_operation_key,
        });
      };
      const rejectUploadedEntry = async () => {
        await admin.storage.from('originals-private').remove([body.objectPath as string]);
        await admin.from('journal_entries').update({
          capture_operation_key: null,
          capture_mime_type: null,
          capture_upload_status: 'failed',
          upload_expires_at: null,
          status: 'pending_deletion',
          deleted_at: new Date().toISOString(),
        }).eq('id', body.entryId).eq('user_id', user.id);
        await releaseCaptureUsage();
      };

      const pathParts = body.objectPath.split('/');
      const filename = pathParts.pop() ?? '';
      const folder = pathParts.join('/');
      const { data: objects, error: listError } = await admin.storage
        .from('originals-private')
        .list(folder, { limit: 20, search: filename });
      if (listError) throw listError;
      const object = (objects ?? []).find((candidate) => candidate.name === filename);
      if (!object) return json({ error: 'upload_not_found' }, 409);
      const byteSize = typeof object.metadata?.size === 'number' ? object.metadata.size : null;
      if (byteSize !== null && byteSize > maxImageBytes) {
        await rejectUploadedEntry();
        return json({ error: 'image_too_large', maxBytes: maxImageBytes }, 413);
      }

      const { data: downloadedImage, error: downloadError } = await admin.storage.from('originals-private').download(body.objectPath);
      if (downloadError || !downloadedImage) throw new Error('uploaded_image_read_failed');
      const validatedImage = validateImageBytes(new Uint8Array(await downloadedImage.arrayBuffer()));
      if (!validatedImage) {
        await rejectUploadedEntry();
        return json({ error: 'invalid_image_file' }, 415);
      }
      if (validatedImage.width > maxImageDimension || validatedImage.height > maxImageDimension || validatedImage.width * validatedImage.height > maxImagePixels) {
        await rejectUploadedEntry();
        return json({ error: 'image_dimensions_too_large', maxDimension: maxImageDimension, maxPixels: maxImagePixels }, 413);
      }
      const objectMimeType = object.metadata?.mimetype;
      if (isOneOf(objectMimeType, allowedMimeTypes) && objectMimeType !== validatedImage.mimeType) {
        await rejectUploadedEntry();
        return json({ error: 'image_type_mismatch' }, 415);
      }
      const mimeType = validatedImage.mimeType;
      const scheduledDeleteAt = body.retentionPolicy === 'delete_after_7_days'
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data: existingAsset, error: existingAssetError } = await admin
        .from('media_assets')
        .select('id')
        .eq('bucket_id', 'originals-private')
        .eq('object_path', body.objectPath)
        .maybeSingle();
      if (existingAssetError) throw existingAssetError;

      let assetId = existingAsset?.id;
      if (!assetId) {
        const { data: asset, error: assetError } = await admin.from('media_assets').insert({
          user_id: user.id,
          entry_id: body.entryId,
          kind: 'original_capture',
          bucket_id: 'originals-private',
          object_path: body.objectPath,
          mime_type: mimeType,
          byte_size: byteSize,
          width: validatedImage.width,
          height: validatedImage.height,
          status: 'ready',
          retention_policy: body.retentionPolicy,
          retention_requested_at: new Date().toISOString(),
          scheduled_delete_at: scheduledDeleteAt,
        }).select('id').single();
        if (assetError?.code === '23505') {
          const { data: racedAsset, error: racedAssetError } = await admin
            .from('media_assets')
            .select('id')
            .eq('bucket_id', 'originals-private')
            .eq('object_path', body.objectPath)
            .single();
          if (racedAssetError) throw racedAssetError;
          assetId = racedAsset.id;
        } else {
          if (assetError) throw assetError;
          assetId = asset.id;
        }
      }

      const { error: jobError } = await admin.from('generation_jobs').insert({
        user_id: user.id,
        entry_id: body.entryId,
        job_type: 'analysis',
        status: 'queued',
        deduplication_key: `initial:${body.entryId}`,
        input_payload: { original_asset_id: assetId },
      });
      if (jobError && jobError.code !== '23505') throw jobError;

      const { error: finalizeStateError } = await admin.from('journal_entries').update({
        capture_upload_status: 'ready',
        upload_expires_at: null,
        upload_finalized_at: new Date().toISOString(),
      }).eq('id', body.entryId).eq('user_id', user.id).eq('capture_upload_status', 'awaiting_upload');
      if (finalizeStateError) throw finalizeStateError;

      return json({ entryId: body.entryId, status: 'queued' });
    }

    return json({ error: 'unsupported_action' }, 400);
  } catch (error) {
    const code = safeErrorCode(error);
    console.error('capture-pipeline failed', { userId: user.id, action: typeof body.action === 'string' ? body.action : 'unknown', code });
    await recordOperationalEvent(admin, { event_type: 'capture_pipeline_failed', severity: 'error', user_id: user.id, error_code: code });
    return json({ error: 'capture_pipeline_failed' }, 500);
  }
});

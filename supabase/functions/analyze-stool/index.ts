import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { CURRENT_CONSENT_VERSION, hasCurrentConsent } from '../_shared/consent.ts';
import {
  bristolCharacteristics,
  requestRoboflowClassification,
  ROBOFLOW_BRISTOL_MODEL,
  RoboflowInferenceError,
} from '../_shared/roboflow.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxImageBytes = 10 * 1024 * 1024;
const retryableFailureCodes = new Set([
  'original_download_failed',
  'provider_request_failed',
  'provider_timeout',
  'provider_unavailable',
]);
const dailyAnalysisAttemptLimit = 30;

type AdminClient = ReturnType<typeof createClient>;
type OriginalAsset = {
  id: string;
  bucket_id: string;
  object_path: string;
  mime_type: string;
  byte_size: number | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toBase64(bytes: ArrayBuffer) {
  const data = new Uint8Array(bytes);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    binary += String.fromCharCode(...data.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function safeFailure(error: unknown) {
  if (error instanceof RoboflowInferenceError) {
    return { code: error.code, message: error.message };
  }
  return { code: 'analysis_failed', message: 'Stool analysis failed.' };
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function markManualRequired({
  admin,
  entryId,
  userId,
  assetId,
  reason,
}: {
  admin: AdminClient;
  entryId: string;
  userId: string;
  assetId?: string;
  reason: string;
}) {
  const { data: existing } = await admin
    .from('generation_jobs')
    .select('id')
    .eq('entry_id', entryId)
    .eq('user_id', userId)
    .eq('job_type', 'analysis')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await admin.from('generation_jobs').update({
      status: 'manual_required',
      error_code: reason,
      error_message: 'AI analysis requires manual selection.',
      next_retry_at: null,
      completed_at: new Date().toISOString(),
    }).eq('id', existing.id).eq('user_id', userId);
    return existing.id as string;
  }

  const { data: created, error } = await admin.from('generation_jobs').insert({
    user_id: userId,
    entry_id: entryId,
    job_type: 'analysis',
    status: 'manual_required',
    input_payload: assetId ? { original_asset_id: assetId } : {},
    error_code: reason,
    error_message: 'AI analysis requires manual selection.',
    completed_at: new Date().toISOString(),
  }).select('id').single();
  if (error) throw error;
  return created.id as string;
}

async function completeExistingAnalysis(admin: AdminClient, userId: string, jobId: string) {
  const { data: existingAnalysis, error } = await admin
    .from('stool_analyses')
    .select('id, bristol_type, confidence')
    .eq('generation_job_id', jobId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!existingAnalysis) return false;

  const { error: activateError } = await admin.rpc('activate_stool_analysis', { p_analysis_id: existingAnalysis.id });
  if (activateError) throw activateError;
  const { error: jobError } = await admin.from('generation_jobs').update({
    status: 'succeeded',
    output_payload: {
      analysis_id: existingAnalysis.id,
      bristol_type: existingAnalysis.bristol_type,
      confidence: existingAnalysis.confidence,
    },
    completed_at: new Date().toISOString(),
    next_retry_at: null,
    error_code: null,
    error_message: null,
  }).eq('id', jobId).eq('user_id', userId);
  if (jobError) throw jobError;
  return true;
}

async function processAnalysisJob({
  admin,
  userId,
  entryId,
  jobId,
  asset,
}: {
  admin: AdminClient;
  userId: string;
  entryId: string;
  jobId: string;
  asset: OriginalAsset;
}) {
  try {
    if (await completeExistingAnalysis(admin, userId, jobId)) return;
  } catch (error) {
    console.error('analysis recovery failed', { jobId, code: safeFailure(error).code });
  }

  while (true) {
    const { data: job, error: jobError } = await admin
      .from('generation_jobs')
      .select('attempt, max_attempts, status')
      .eq('id', jobId)
      .eq('user_id', userId)
      .maybeSingle();
    if (jobError || !job || job.status !== 'queued') return;

    const attempt = job.attempt + 1;
    if (attempt > job.max_attempts) {
      await markManualRequired({ admin, entryId, userId, assetId: asset.id, reason: 'retry_limit_reached' });
      return;
    }

    const startedAt = new Date();
    const { data: claimed, error: claimError } = await admin.from('generation_jobs').update({
      status: 'running',
      attempt,
      provider: ROBOFLOW_BRISTOL_MODEL.provider,
      model: ROBOFLOW_BRISTOL_MODEL.modelId,
      prompt_version: ROBOFLOW_BRISTOL_MODEL.analysisSchemaVersion,
      started_at: startedAt.toISOString(),
      completed_at: null,
      next_retry_at: null,
      error_code: null,
      error_message: null,
    }).eq('id', jobId).eq('user_id', userId).eq('status', 'queued').select('id').maybeSingle();
    if (claimError || !claimed) return;

    try {
      const { data: usageAllowed, error: usageError } = await admin.rpc('consume_usage_event', {
        p_user_id: userId,
        p_metric: 'analysis_attempt',
        p_window_start: new Date().toISOString().slice(0, 10),
        p_idempotency_key: `analysis:${jobId}:${attempt}`,
        p_limit: dailyAnalysisAttemptLimit,
      });
      if (usageError) throw usageError;
      if (!usageAllowed) {
        throw new RoboflowInferenceError('usage_limit_reached', 'Daily analysis limit reached.');
      }

      const { data: original, error: downloadError } = await admin.storage
        .from('originals-private')
        .download(asset.object_path);
      if (downloadError || !original) {
        throw new RoboflowInferenceError('original_download_failed', 'Private original could not be downloaded.');
      }
      if (original.size > maxImageBytes) {
        throw new RoboflowInferenceError('image_too_large', 'Image exceeds the 10 MB limit.');
      }

      const prediction = await requestRoboflowClassification({
        apiKey: Deno.env.get('ROBOFLOW_API_KEY') ?? '',
        base64Image: toBase64(await original.arrayBuffer()),
      });

      const { data: stillRunning } = await admin
        .from('generation_jobs')
        .select('id')
        .eq('id', jobId)
        .eq('user_id', userId)
        .eq('status', 'running')
        .eq('attempt', attempt)
        .maybeSingle();
      if (!stillRunning) return;

      const characteristics = bristolCharacteristics(prediction.bristolType);
      const latencyMs = Date.now() - startedAt.getTime();
      const { data: analysis, error: analysisError } = await admin.from('stool_analyses').insert({
        entry_id: entryId,
        user_id: userId,
        bristol_type: prediction.bristolType,
        color: 'other',
        shape: characteristics.shape,
        texture: characteristics.texture,
        confidence: prediction.confidence,
        confidence_band: prediction.confidenceBand,
        requires_retake: prediction.requiresRetake,
        provider: ROBOFLOW_BRISTOL_MODEL.provider,
        model_name: ROBOFLOW_BRISTOL_MODEL.project,
        model_version: ROBOFLOW_BRISTOL_MODEL.version,
        analysis_schema_version: ROBOFLOW_BRISTOL_MODEL.analysisSchemaVersion,
        generation_job_id: jobId,
        result_status: 'succeeded',
        is_current: false,
        latency_ms: latencyMs,
        provider_metadata: {
          inference_id: prediction.inferenceId,
          prediction_type: prediction.predictionType,
          top: `Type-${prediction.bristolType}`,
          class_predictions: prediction.predictions,
        },
      }).select('id').single();
      if (analysisError) throw analysisError;

      const { error: activateError } = await admin.rpc('activate_stool_analysis', { p_analysis_id: analysis.id });
      if (activateError) throw activateError;
      const { error: succeededError } = await admin.from('generation_jobs').update({
        status: 'succeeded',
        output_payload: {
          analysis_id: analysis.id,
          bristol_type: prediction.bristolType,
          confidence: prediction.confidence,
        },
        input_units: 1,
        output_units: 1,
        usage_unit: 'image',
        completed_at: new Date().toISOString(),
        next_retry_at: null,
      }).eq('id', jobId).eq('user_id', userId).eq('status', 'running').eq('attempt', attempt);
      if (succeededError) throw succeededError;
      return;
    } catch (error) {
      const failure = safeFailure(error);
      const shouldRetry = retryableFailureCodes.has(failure.code) && attempt < job.max_attempts;
      console.error('analyze-stool attempt failed', { jobId, attempt, code: failure.code, willRetry: shouldRetry });

      if (!shouldRetry) {
        await admin.from('generation_jobs').update({
          status: 'manual_required',
          error_code: failure.code,
          error_message: failure.message.slice(0, 1000),
          next_retry_at: null,
          completed_at: new Date().toISOString(),
        }).eq('id', jobId).eq('user_id', userId).eq('status', 'running').eq('attempt', attempt);
        return;
      }

      const retryDelayMs = 750 * attempt;
      await admin.from('generation_jobs').update({
        status: 'queued',
        error_code: failure.code,
        error_message: failure.message.slice(0, 1000),
        next_retry_at: new Date(Date.now() + retryDelayMs).toISOString(),
      }).eq('id', jobId).eq('user_id', userId).eq('status', 'running').eq('attempt', attempt);
      await delay(retryDelayMs);
    }
  }
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

  if (!await hasCurrentConsent(admin, user.id)) {
    return json({ error: 'current_consent_required', consentVersion: CURRENT_CONSENT_VERSION }, 409);
  }

  let body: { entryId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (typeof body.entryId !== 'string' || !uuidPattern.test(body.entryId)) {
    return json({ error: 'invalid_entry_id' }, 400);
  }
  const entryId = body.entryId;

  try {
    const { data: entry, error: entryError } = await admin
      .from('journal_entries')
      .select('id')
      .eq('id', entryId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (entryError) throw entryError;
    if (!entry) return json({ error: 'entry_not_found' }, 404);

    const { data: currentAnalysis, error: currentAnalysisError } = await admin
      .from('stool_analyses')
      .select('id, bristol_type, confidence')
      .eq('entry_id', entryId)
      .eq('user_id', user.id)
      .eq('is_current', true)
      .maybeSingle();
    if (currentAnalysisError) throw currentAnalysisError;
    if (currentAnalysis) {
      return json({
        entryId,
        status: 'succeeded',
        bristolType: currentAnalysis.bristol_type,
        confidence: currentAnalysis.confidence,
        cached: true,
      });
    }

    const { data: asset, error: assetError } = await admin
      .from('media_assets')
      .select('id, bucket_id, object_path, mime_type, byte_size')
      .eq('entry_id', entryId)
      .eq('user_id', user.id)
      .eq('kind', 'original_capture')
      .eq('status', 'ready')
      .maybeSingle();
    if (assetError) throw assetError;
    if (!asset || asset.bucket_id !== 'originals-private') {
      const jobId = await markManualRequired({ admin, entryId, userId: user.id, reason: 'original_unavailable' });
      return json({ entryId, jobId, status: 'manual_required', reason: 'original_unavailable' });
    }
    if (!allowedMimeTypes.has(asset.mime_type) || (asset.byte_size ?? 0) > maxImageBytes) {
      const jobId = await markManualRequired({ admin, entryId, userId: user.id, assetId: asset.id, reason: 'unsupported_image' });
      return json({ entryId, jobId, status: 'manual_required', reason: 'unsupported_image' });
    }

    const { data: existingJob, error: existingJobError } = await admin
      .from('generation_jobs')
      .select('id, attempt, max_attempts, status, error_code')
      .eq('entry_id', entryId)
      .eq('user_id', user.id)
      .eq('job_type', 'analysis')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingJobError) throw existingJobError;

    if (existingJob?.status === 'manual_required' || existingJob?.status === 'cancelled') {
      return json({ entryId, jobId: existingJob.id, status: 'manual_required', reason: existingJob.error_code ?? 'analysis_unavailable' });
    }
    if (existingJob?.status === 'queued') {
      EdgeRuntime.waitUntil(processAnalysisJob({
        admin,
        userId: user.id,
        entryId,
        jobId: existingJob.id,
        asset: asset as OriginalAsset,
      }));
      return json({ entryId, jobId: existingJob.id, status: 'queued' }, 202);
    }
    if (existingJob?.status === 'running') {
      return json({ entryId, jobId: existingJob.id, status: existingJob.status }, 202);
    }
    if (existingJob?.status === 'succeeded') {
      return json({ entryId, jobId: existingJob.id, status: 'manual_required', reason: 'analysis_result_unavailable' });
    }

    let jobId: string;
    if (existingJob) {
      if (existingJob.attempt >= existingJob.max_attempts) {
        await markManualRequired({ admin, entryId, userId: user.id, assetId: asset.id, reason: 'retry_limit_reached' });
        return json({ entryId, jobId: existingJob.id, status: 'manual_required', reason: 'retry_limit_reached' });
      }
      const { error: requeueError } = await admin.from('generation_jobs').update({
        status: 'queued',
        completed_at: null,
        next_retry_at: null,
      }).eq('id', existingJob.id).eq('user_id', user.id).eq('status', 'failed');
      if (requeueError) throw requeueError;
      jobId = existingJob.id;
    } else {
      const { data: createdJob, error: createdJobError } = await admin
        .from('generation_jobs')
        .insert({
          user_id: user.id,
          entry_id: entryId,
          job_type: 'analysis',
          status: 'queued',
          input_payload: { original_asset_id: asset.id },
        })
        .select('id')
        .single();
      if (createdJobError) throw createdJobError;
      jobId = createdJob.id;
    }

    EdgeRuntime.waitUntil(processAnalysisJob({
      admin,
      userId: user.id,
      entryId,
      jobId,
      asset: asset as OriginalAsset,
    }));

    return json({ entryId, jobId, status: 'queued' }, 202);
  } catch (error) {
    const failure = safeFailure(error);
    console.error('analyze-stool enqueue failed', { entryId, code: failure.code });
    return json({ entryId, status: 'manual_required', reason: failure.code });
  }
});

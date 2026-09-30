import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { createArtworkSpec } from '../services/analysis/provider';
import { getBristolOption } from '../services/bristol';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';
import type {
  AnalysisConfidence,
  ArtworkGenerationContract,
  ArtworkSpec,
  BristolType,
  CollectibleIdentity,
  CollectibleTraits,
  JournalContext,
  JournalEntry,
  StoolColor,
  StoolShape,
  StoolTexture,
  OriginalRetentionPolicy,
} from '../types';

type EffectiveAnalysisRow = Database['public']['Views']['journal_entry_effective_analysis']['Row'];
type JournalRow = Database['public']['Tables']['journal_entries']['Row'];
type ContextRow = Database['public']['Tables']['journal_contexts']['Row'];
type CollectibleRow = Database['public']['Tables']['collectibles']['Row'];
type MediaRow = Database['public']['Tables']['media_assets']['Row'];

const bristolTypes = [1, 2, 3, 4, 5, 6, 7] as const;
const colors = ['light_brown', 'medium_brown', 'dark_brown', 'yellow', 'green', 'black', 'red', 'clay', 'other'] as const;
const shapes = ['pellets', 'lumpy', 'cracked', 'smooth', 'soft_blobs', 'mushy', 'watery', 'uncertain'] as const;
const textures = ['dry', 'firm', 'smooth', 'soft', 'liquid', 'uncertain'] as const;
const confidenceBands = ['high', 'medium', 'low'] as const;
const forms = ['mineral', 'ribbon', 'petal', 'liquid'] as const;
const palettes = ['clay', 'moss', 'amber'] as const;
const consentTypes = [
  'privacy_policy',
  'sensitive_data_processing',
  'ai_analysis',
  'non_medical_disclaimer',
] as const;

type ConsentAction = 'accepted' | 'withdrawn';
type SourcePlatform = 'ios' | 'android' | 'web';

type CaptureUploadTicket = {
  entryId: string;
  objectPath?: string;
  uploadToken?: string;
  alreadyFinalized?: boolean;
};

export class JournalPipelineError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'JournalPipelineError';
  }
}

export type RemoteAnalysisResult = {
  entryId: string;
  jobId?: string;
  status: 'queued' | 'running' | 'succeeded' | 'manual_required';
  bristolType?: BristolType;
  confidence?: number;
  reason?: string;
};

export type RemoteAnalysisQueueItem = {
  entryId: string;
  jobId: string;
  status: 'queued' | 'running' | 'manual_required';
  reason?: string;
};

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function isOneOf<const T extends readonly (string | number)[]>(value: unknown, values: T): value is T[number] {
  return values.includes(value as T[number]);
}

function requiredAnalysis(row: EffectiveAnalysisRow) {
  if (
    !row.entry_id
    || !isOneOf(row.effective_bristol_type, bristolTypes)
  ) return null;

  const bristolType = row.effective_bristol_type as BristolType;
  const bristolOption = getBristolOption(bristolType);
  const hasAiAnalysis = typeof row.current_analysis_id === 'string';
  const hasUserCorrection = row.has_user_correction ?? false;

  const confidenceBand: AnalysisConfidence = isOneOf(row.confidence_band, confidenceBands)
    ? row.confidence_band
    : 'low';

  return {
    bristolType,
    color: isOneOf(row.effective_color, colors) ? row.effective_color as StoolColor : 'other' as const,
    shape: isOneOf(row.effective_shape, shapes) ? row.effective_shape as StoolShape : bristolOption.shape,
    texture: isOneOf(row.effective_texture, textures) ? row.effective_texture as StoolTexture : bristolOption.texture,
    confidence: row.confidence ?? 0,
    confidenceBand,
    requiresRetake: row.requires_retake ?? !hasAiAnalysis,
    provider: row.model_provider ?? 'manual_fallback',
    modelName: row.model_name ?? undefined,
    modelVersion: row.model_version ?? undefined,
    promptVersion: row.prompt_version ?? undefined,
    analysisVersion: row.analysis_schema_version ?? undefined,
    analysisSource: !hasAiAnalysis && hasUserCorrection
      ? 'manual_fallback' as const
      : hasUserCorrection ? 'user_correction' as const : 'ai' as const,
    correctedByUser: hasUserCorrection,
    originalBristolType: hasUserCorrection && isOneOf(row.ai_bristol_type, bristolTypes)
      ? row.ai_bristol_type as BristolType
      : undefined,
  };
}

function mapContext(row: ContextRow | undefined): JournalContext | undefined {
  if (
    !row
    || !isOneOf(row.hydration, ['low', 'moderate', 'high'] as const)
    || !isOneOf(row.fiber, ['low', 'moderate', 'high'] as const)
    || typeof row.sleep_hours !== 'number'
    || !isOneOf(row.stress, ['low', 'moderate', 'high'] as const)
    || !isOneOf(row.comfort, ['comfortable', 'slight_strain', 'urgent'] as const)
  ) return undefined;

  return {
    hydration: row.hydration,
    fiber: row.fiber,
    sleepHours: row.sleep_hours,
    stress: row.stress,
    comfort: row.comfort,
    note: row.note ?? undefined,
    extraContext: row.extra_context as JournalContext['extraContext'],
  };
}

function mapArtwork(row: CollectibleRow | undefined, fallback: ArtworkSpec): ArtworkSpec {
  if (
    !row
    || !isOneOf(row.form, forms)
    || !isOneOf(row.palette, palettes)
    || row.engine_version !== '1.0'
  ) return fallback;

  return {
    engineVersion: '1.0',
    seed: row.seed,
    form: row.form,
    palette: row.palette,
    fluidity: row.fluidity,
    complexity: row.complexity,
  };
}

function mapCollectible(row: CollectibleRow | undefined): CollectibleIdentity | undefined {
  if (!row || row.collection_id !== 'GUTVERSE-ORIGINS' || row.dna_version !== '1.0') return undefined;
  return {
    collectionId: 'GUTVERSE-ORIGINS',
    serial: row.serial,
    displayId: row.display_id,
    generationId: row.generation_id,
    dnaVersion: '1.0',
    traits: row.traits as unknown as CollectibleTraits,
    renderContract: row.render_contract as unknown as ArtworkGenerationContract,
    traitFingerprint: row.trait_fingerprint,
    status: row.status === 'minted' || row.status === 'mint_ready' ? row.status : 'off_chain',
  };
}

async function signedArtworkUrl(asset: MediaRow | undefined) {
  if (!asset || asset.status !== 'ready') return undefined;
  const { data, error } = await requireClient().storage
    .from(asset.bucket_id)
    .createSignedUrl(asset.object_path, 60 * 60);
  if (error) return undefined;
  return data.signedUrl;
}

export async function listRemoteJournalEntries(userId: string): Promise<JournalEntry[]> {
  const client = requireClient();
  const [journalsResult, analysesResult, contextsResult, collectiblesResult, mediaResult] = await Promise.all([
    client.from('journal_entries').select('*').eq('user_id', userId).is('deleted_at', null).order('occurred_at', { ascending: false }),
    client.from('journal_entry_effective_analysis').select('*').eq('user_id', userId).order('occurred_at', { ascending: false }),
    client.from('journal_contexts').select('*').eq('user_id', userId),
    client.from('collectibles').select('*').eq('user_id', userId),
    client.from('media_assets').select('*').eq('user_id', userId).eq('status', 'ready'),
  ]);

  for (const result of [journalsResult, analysesResult, contextsResult, collectiblesResult, mediaResult]) {
    if (result.error) throw result.error;
  }

  const journals = new Map((journalsResult.data ?? []).map((row) => [row.id, row as JournalRow]));
  const contexts = new Map((contextsResult.data ?? []).map((row) => [row.entry_id, row as ContextRow]));
  const collectibles = new Map((collectiblesResult.data ?? []).map((row) => [row.entry_id, row as CollectibleRow]));
  const mediaByEntry = new Map<string, MediaRow[]>();
  for (const asset of mediaResult.data ?? []) {
    if (!asset.entry_id) continue;
    const current = mediaByEntry.get(asset.entry_id) ?? [];
    current.push(asset as MediaRow);
    mediaByEntry.set(asset.entry_id, current);
  }

  const entries: (JournalEntry | null)[] = await Promise.all((analysesResult.data ?? []).map(async (row): Promise<JournalEntry | null> => {
    const analysis = requiredAnalysis(row as EffectiveAnalysisRow);
    if (!analysis || !row.entry_id) return null;
    const journal = journals.get(row.entry_id);
    if (!journal) return null;
    const collectibleRow = collectibles.get(row.entry_id);
    const assets = mediaByEntry.get(row.entry_id) ?? [];
    const artworkAsset = assets.find((asset) => asset.kind === 'artwork_final' && asset.bucket_id === 'artworks-private');
    const originalAsset = assets.find((asset) => asset.kind === 'original_capture' && asset.bucket_id === 'originals-private');
    const fallbackArtwork = createArtworkSpec(analysis, row.entry_id);
    const artwork = mapArtwork(collectibleRow, fallbackArtwork);
    artwork.generatedImageUri = await signedArtworkUrl(artworkAsset);

    return {
      id: row.entry_id,
      createdAt: journal.occurred_at,
      analysis,
      artwork,
      collectible: mapCollectible(collectibleRow),
      originalAsset: originalAsset ? {
        bucketId: 'originals-private',
        objectPath: originalAsset.object_path,
      } : undefined,
      originalImageStatus: originalAsset ? 'cloud_private' as const : 'unavailable' as const,
      userConfirmed: journal.user_confirmed,
      source: journal.source === 'import' ? 'import' as const : 'capture' as const,
      context: mapContext(contexts.get(row.entry_id)),
    } satisfies JournalEntry;
  }));

  return entries
    .filter((entry): entry is JournalEntry => entry !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getRemoteAnalysisQueue(userId: string): Promise<RemoteAnalysisQueueItem[]> {
  const client = requireClient();
  const { data: jobs, error } = await client
    .from('generation_jobs')
    .select('id, entry_id, status, error_code, created_at')
    .eq('user_id', userId)
    .eq('job_type', 'analysis')
    .in('status', ['queued', 'running', 'failed', 'manual_required', 'cancelled'])
    .order('created_at', { ascending: false });
  if (error) throw error;

  const latestByEntry = new Map<string, NonNullable<typeof jobs>[number]>();
  for (const job of jobs ?? []) {
    if (job.entry_id && !latestByEntry.has(job.entry_id)) latestByEntry.set(job.entry_id, job);
  }
  const entryIds = [...latestByEntry.keys()];
  if (entryIds.length === 0) return [];

  const { data: resolved, error: resolvedError } = await client
    .from('journal_entry_effective_analysis')
    .select('entry_id, current_analysis_id, has_user_correction')
    .eq('user_id', userId)
    .in('entry_id', entryIds);
  if (resolvedError) throw resolvedError;
  const resolvedEntryIds = new Set((resolved ?? []).flatMap((row) =>
    row.entry_id && (row.current_analysis_id || row.has_user_correction) ? [row.entry_id] : [],
  ));
  return entryIds.flatMap((entryId) => {
    if (resolvedEntryIds.has(entryId)) return [];
    const job = latestByEntry.get(entryId);
    if (!job) return [];
    const status = job.status === 'queued' || job.status === 'running' ? job.status : 'manual_required';
    return [{
      entryId,
      jobId: job.id,
      status,
      reason: job.error_code ?? undefined,
    } satisfies RemoteAnalysisQueueItem];
  });
}

export async function getRemotePendingAnalysisCount(userId: string) {
  const queue = await getRemoteAnalysisQueue(userId);
  return queue.filter((item) => item.status === 'queued' || item.status === 'running').length;
}

export async function getRemoteJournalSnapshot(userId: string) {
  const [entries, analysisQueue] = await Promise.all([
    listRemoteJournalEntries(userId),
    getRemoteAnalysisQueue(userId),
  ]);
  const pendingAnalysisCount = analysisQueue.filter((item) => item.status !== 'manual_required').length;
  return { entries, analysisQueue, pendingAnalysisCount };
}

export async function confirmRemoteJournalEntry(entryId: string) {
  const { error } = await requireClient()
    .from('journal_entries')
    .update({ user_confirmed: true })
    .eq('id', entryId);
  if (error) throw error;
}

export async function correctRemoteBristolType(entryId: string, userId: string, bristolType: BristolType) {
  const option = getBristolOption(bristolType);
  const client = requireClient();
  const { error } = await client.from('analysis_corrections').insert({
    entry_id: entryId,
    user_id: userId,
    corrected_bristol_type: bristolType,
    corrected_shape: option.shape,
    corrected_texture: option.texture,
  });
  if (error) throw error;
  await confirmRemoteJournalEntry(entryId);
}

export async function createPrivateAssetUrl(bucketId: string, objectPath: string, expiresInSeconds = 5 * 60) {
  const { data, error } = await requireClient().storage
    .from(bucketId)
    .createSignedUrl(objectPath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function requestRemoteOriginalDeletion(entryId: string, userId: string) {
  const { error } = await requireClient().from('privacy_requests').insert({
    entry_id: entryId,
    user_id: userId,
    request_type: 'delete_original',
    status: 'requested',
  });
  if (error) throw error;
}

export async function recordRemoteConsent(
  userId: string,
  documentVersion: string,
  action: ConsentAction,
  sourcePlatform: SourcePlatform,
) {
  const occurredAt = new Date().toISOString();
  const { error } = await requireClient().from('consent_events').insert(
    consentTypes.map((consentType) => ({
      user_id: userId,
      consent_type: consentType,
      document_version: documentVersion,
      action,
      source_platform: sourcePlatform,
      app_version: '1.0.0',
      occurred_at: occurredAt,
    })),
  );
  if (error) throw error;
}

export async function hasCurrentRemoteConsent(userId: string, documentVersion: string) {
  const { data, error } = await requireClient()
    .from('consent_events')
    .select('consent_type, document_version, action, occurred_at')
    .eq('user_id', userId)
    .in('consent_type', [...consentTypes])
    .order('occurred_at', { ascending: false });
  if (error) throw error;

  const latestByType = new Map<string, { action: string; document_version: string }>();
  for (const event of data ?? []) {
    if (!latestByType.has(event.consent_type)) latestByType.set(event.consent_type, event);
  }
  return consentTypes.every((consentType) => {
    const event = latestByType.get(consentType);
    return event?.action === 'accepted' && event.document_version === documentVersion;
  });
}

function requireCaptureTicket(value: unknown): CaptureUploadTicket {
  if (!value || typeof value !== 'object') throw new Error('Upload ticket response is invalid.');
  const candidate = value as Partial<CaptureUploadTicket>;
  if (typeof candidate.entryId !== 'string') throw new Error('Upload ticket response is incomplete.');
  if (candidate.alreadyFinalized === true) return candidate as CaptureUploadTicket;
  if (typeof candidate.objectPath !== 'string' || typeof candidate.uploadToken !== 'string') {
    throw new Error('Upload ticket response is incomplete.');
  }
  return candidate as CaptureUploadTicket;
}

export async function uploadRemoteOriginal(
  imageUri: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
  retentionPolicy: OriginalRetentionPolicy = 'keep',
  operationKey: string,
) {
  const client = requireClient();
  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei';
  const createResult = await client.functions.invoke('capture-pipeline', {
    body: { action: 'create', mimeType, retentionPolicy, timezoneName, operationKey },
  });
  if (createResult.error) {
    const code = typeof createResult.data?.error === 'string' ? createResult.data.error : 'capture_create_failed';
    throw new JournalPipelineError(code);
  }
  const ticket = requireCaptureTicket(createResult.data);
  if (ticket.alreadyFinalized) return { entryId: ticket.entryId };
  if (!ticket.objectPath || !ticket.uploadToken) throw new Error('Upload ticket response is incomplete.');

  const bytes = Platform.OS === 'web'
    ? await (async () => {
        const webUri = imageUri.startsWith('data:') ? imageUri : `data:${mimeType};base64,${imageUri}`;
        const response = await fetch(webUri);
        if (!response.ok) throw new Error('Captured image could not be read for upload.');
        return response.arrayBuffer();
      })()
    : await new File(imageUri).arrayBuffer();
  const { error: uploadError } = await client.storage
    .from('originals-private')
    .uploadToSignedUrl(ticket.objectPath, ticket.uploadToken, bytes, {
      contentType: mimeType,
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const finalizeResult = await client.functions.invoke('capture-pipeline', {
    body: {
      action: 'finalize',
      entryId: ticket.entryId,
      objectPath: ticket.objectPath,
      retentionPolicy,
    },
  });
  if (finalizeResult.error) throw finalizeResult.error;
  return { entryId: ticket.entryId };
}

export async function cleanupRemoteIncompleteUploads() {
  const result = await requireClient().functions.invoke('capture-pipeline', { body: { action: 'cleanup' } });
  if (result.error) throw result.error;
  return typeof result.data?.cleaned === 'number' ? result.data.cleaned : 0;
}

function requireRemoteAnalysisResult(value: unknown): RemoteAnalysisResult {
  if (!value || typeof value !== 'object') throw new Error('AI analysis response is invalid.');
  const candidate = value as Partial<RemoteAnalysisResult>;
  if (
    typeof candidate.entryId !== 'string'
    || !isOneOf(candidate.status, ['queued', 'running', 'succeeded', 'manual_required'] as const)
  ) throw new Error('AI analysis response is incomplete.');
  if (candidate.status === 'succeeded') {
    if (!isOneOf(candidate.bristolType, bristolTypes) || typeof candidate.confidence !== 'number') {
      throw new Error('AI analysis prediction is invalid.');
    }
  }
  return candidate as RemoteAnalysisResult;
}

export async function analyzeRemoteJournalEntry(entryId: string) {
  const result = await requireClient().functions.invoke('analyze-stool', { body: { entryId } });
  if (result.error) throw result.error;
  return requireRemoteAnalysisResult(result.data);
}

export async function getRemoteAnalysisStatus(entryId: string): Promise<RemoteAnalysisResult> {
  const client = requireClient();
  const { data: analysis, error: analysisError } = await client
    .from('journal_entry_effective_analysis')
    .select('entry_id, current_analysis_id, effective_bristol_type, confidence, has_user_correction')
    .eq('entry_id', entryId)
    .maybeSingle();
  if (analysisError) throw analysisError;
  if (
    analysis?.entry_id
    && isOneOf(analysis.effective_bristol_type, bristolTypes)
    && (analysis.current_analysis_id || analysis.has_user_correction)
  ) {
    return {
      entryId,
      status: 'succeeded',
      bristolType: analysis.effective_bristol_type,
      confidence: analysis.confidence ?? 0,
    };
  }

  const { data: job, error: jobError } = await client
    .from('generation_jobs')
    .select('id, status, error_code')
    .eq('entry_id', entryId)
    .eq('job_type', 'analysis')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job) return { entryId, status: 'manual_required', reason: 'analysis_job_unavailable' };
  if (job.status === 'queued' || job.status === 'running') {
    return { entryId, jobId: job.id, status: job.status };
  }
  return {
    entryId,
    jobId: job.id,
    status: 'manual_required',
    reason: job.error_code ?? 'analysis_unavailable',
  };
}

export async function waitForRemoteAnalysis(
  entryId: string,
  { timeoutMs = 45_000, intervalMs = 1_500 }: { timeoutMs?: number; intervalMs?: number } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let latest = await getRemoteAnalysisStatus(entryId);
  while ((latest.status === 'queued' || latest.status === 'running') && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    latest = await getRemoteAnalysisStatus(entryId);
  }
  return latest;
}

export const ROBOFLOW_BRISTOL_MODEL = {
  provider: 'roboflow',
  project: 'bristol-stool-slqqx',
  version: '2',
  modelId: 'bristol-stool-slqqx/2',
  endpoint: 'https://serverless.roboflow.com/bristol-stool-slqqx/2',
  analysisSchemaVersion: 'roboflow-bristol-v1',
} as const;

export type RoboflowBristolPrediction = {
  bristolType: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  confidence: number;
  confidenceBand: 'high' | 'medium' | 'low';
  requiresRetake: boolean;
  predictions: Array<{ className: string; confidence: number }>;
  inferenceId?: string;
  predictionType?: string;
};

type RoboflowClassificationResponse = {
  top?: unknown;
  confidence?: unknown;
  predictions?: unknown;
  inference_id?: unknown;
  prediction_type?: unknown;
};

export class RoboflowInferenceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'RoboflowInferenceError';
  }
}

export function parseBristolClass(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 | 7 | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^type[-_\s]*([1-7])$/i);
  if (!match) return null;
  return Number(match[1]) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

function isConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function responseShape(value: unknown, depth = 0): unknown {
  if (depth >= 3) return Array.isArray(value) ? 'array' : typeof value;
  if (Array.isArray(value)) {
    return { type: 'array', length: value.length, item: value.length ? responseShape(value[0], depth + 1) : null };
  }
  if (!value || typeof value !== 'object') return typeof value;
  return {
    type: 'object',
    fields: Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .slice(0, 30)
      .map(([key, item]) => [key, responseShape(item, depth + 1)])),
  };
}

export function parseRoboflowClassification(payload: unknown): RoboflowBristolPrediction {
  if (!payload || typeof payload !== 'object') {
    throw new RoboflowInferenceError('invalid_response', 'Roboflow returned a non-object response.');
  }

  const response = payload as RoboflowClassificationResponse;
  const parsedPredictions = Array.isArray(response.predictions)
    ? response.predictions.flatMap((candidate) => {
        if (!candidate || typeof candidate !== 'object') return [];
        const row = candidate as { class?: unknown; confidence?: unknown };
        if (typeof row.class !== 'string' || !isConfidence(row.confidence)) return [];
        return [{ className: row.class, confidence: row.confidence }];
      })
    : [];

  const topType = parseBristolClass(response.top);
  const topConfidence = isConfidence(response.confidence) ? response.confidence : null;
  const highestValidPrediction = parsedPredictions
    .filter((candidate) => parseBristolClass(candidate.className) !== null)
    .sort((a, b) => b.confidence - a.confidence)[0];
  const bristolType = topType ?? parseBristolClass(highestValidPrediction?.className);
  const confidence = topType && topConfidence !== null
    ? topConfidence
    : highestValidPrediction?.confidence;

  if (!bristolType || !isConfidence(confidence)) {
    throw new RoboflowInferenceError('invalid_prediction', 'Roboflow did not return a valid Type 1–7 prediction.');
  }

  return {
    bristolType,
    confidence,
    confidenceBand: confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low',
    requiresRetake: confidence < 0.4,
    predictions: parsedPredictions.slice(0, 7),
    inferenceId: typeof response.inference_id === 'string' ? response.inference_id : undefined,
    predictionType: typeof response.prediction_type === 'string' ? response.prediction_type : undefined,
  };
}

export function bristolCharacteristics(type: RoboflowBristolPrediction['bristolType']) {
  const values = {
    1: { shape: 'pellets', texture: 'dry' },
    2: { shape: 'lumpy', texture: 'firm' },
    3: { shape: 'cracked', texture: 'firm' },
    4: { shape: 'smooth', texture: 'smooth' },
    5: { shape: 'soft_blobs', texture: 'soft' },
    6: { shape: 'mushy', texture: 'soft' },
    7: { shape: 'watery', texture: 'liquid' },
  } as const;
  return values[type];
}

export async function requestRoboflowClassification({
  apiKey,
  base64Image,
  timeoutMs = 20_000,
  fetcher = fetch,
}: {
  apiKey: string;
  base64Image: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}) {
  if (!apiKey) throw new RoboflowInferenceError('provider_not_configured', 'Roboflow API key is missing.');
  const endpoint = new URL(ROBOFLOW_BRISTOL_MODEL.endpoint);
  endpoint.searchParams.set('api_key', apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: base64Image,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new RoboflowInferenceError(
        response.status === 401 || response.status === 403 ? 'provider_auth_failed' : 'provider_request_failed',
        `Roboflow returned HTTP ${response.status}.`,
      );
    }
    const payload = await response.json();
    try {
      return parseRoboflowClassification(payload);
    } catch (error) {
      if (error instanceof RoboflowInferenceError && error.code === 'invalid_prediction') {
        // Shape only: no image, API key, predicted class, confidence, or user data.
        console.error('Roboflow invalid response shape', JSON.stringify(responseShape(payload)));
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof RoboflowInferenceError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new RoboflowInferenceError('provider_timeout', 'Roboflow inference timed out.');
    }
    throw new RoboflowInferenceError('provider_unavailable', 'Roboflow inference was unavailable.');
  } finally {
    clearTimeout(timeout);
  }
}

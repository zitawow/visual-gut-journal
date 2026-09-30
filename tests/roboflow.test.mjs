import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  bristolCharacteristics,
  parseBristolClass,
  parseRoboflowClassification,
  requestRoboflowClassification,
  RoboflowInferenceError,
} from '../supabase/functions/_shared/roboflow.ts';

test('maps every Roboflow Type-1 through Type-7 label', () => {
  for (let type = 1; type <= 7; type += 1) {
    assert.equal(parseBristolClass(`Type-${type}`), type);
    assert.equal(parseBristolClass(`type ${type}`), type);
  }
  assert.equal(parseBristolClass('Type-8'), null);
  assert.equal(parseBristolClass('unknown'), null);
});

test('parses top classification and confidence', () => {
  const result = parseRoboflowClassification({
    top: 'Type-4',
    confidence: 0.82,
    inference_id: 'inference-123',
    prediction_type: 'classification',
    predictions: [
      { class: 'Type-4', confidence: 0.82 },
      { class: 'Type-3', confidence: 0.11 },
    ],
  });
  assert.deepEqual(
    { type: result.bristolType, confidence: result.confidence, band: result.confidenceBand },
    { type: 4, confidence: 0.82, band: 'high' },
  );
  assert.equal(result.inferenceId, 'inference-123');
});

test('falls back to the highest valid predictions item', () => {
  const result = parseRoboflowClassification({
    predictions: [
      { class: 'Type-6', confidence: 0.74 },
      { class: 'Type-2', confidence: 0.21 },
    ],
  });
  assert.equal(result.bristolType, 6);
  assert.equal(result.confidence, 0.74);
  assert.equal(result.confidenceBand, 'medium');
});

test('rejects invalid or out-of-range classifications', () => {
  assert.throws(
    () => parseRoboflowClassification({ top: 'Type-9', confidence: 0.9 }),
    (error) => error instanceof RoboflowInferenceError && error.code === 'invalid_prediction',
  );
  assert.throws(
    () => parseRoboflowClassification({ top: 'Type-4', confidence: 82 }),
    (error) => error instanceof RoboflowInferenceError && error.code === 'invalid_prediction',
  );
});

test('maps Type 1-7 to typed shape and texture values', () => {
  assert.deepEqual(bristolCharacteristics(1), { shape: 'pellets', texture: 'dry' });
  assert.deepEqual(bristolCharacteristics(4), { shape: 'smooth', texture: 'smooth' });
  assert.deepEqual(bristolCharacteristics(7), { shape: 'watery', texture: 'liquid' });
});

test('sends base64 to the serverless model and parses response', async () => {
  let captured;
  const result = await requestRoboflowClassification({
    apiKey: 'test-secret-not-real',
    base64Image: 'ZmFrZS1pbWFnZQ==',
    fetcher: async (url, options) => {
      captured = { url: String(url), options };
      return new Response(JSON.stringify({ top: 'Type-5', confidence: 0.71 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  assert.equal(result.bristolType, 5);
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.body, 'ZmFrZS1pbWFnZQ==');
  assert.match(captured.url, /bristol-stool-slqqx\/2\?api_key=/);
});

test('turns timeout into a safe provider_timeout failure', async () => {
  await assert.rejects(
    requestRoboflowClassification({
      apiKey: 'test-secret-not-real',
      base64Image: 'ZmFrZQ==',
      timeoutMs: 5,
      fetcher: (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
    }),
    (error) => error instanceof RoboflowInferenceError && error.code === 'provider_timeout',
  );
});

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  }));
  return nested.flat();
}

test('frontend source contains no Roboflow credential or direct provider call', async () => {
  const files = [
    ...await sourceFiles(fileURLToPath(new URL('../app', import.meta.url))),
    ...await sourceFiles(fileURLToPath(new URL('../src', import.meta.url))),
  ].filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  assert.doesNotMatch(source, /ROBOFLOW_API_KEY/);
  assert.doesNotMatch(source, /serverless\.roboflow\.com/);
  assert.doesNotMatch(source, /EXPO_PUBLIC_ANALYSIS_API_URL/);
});

test('frontend and Edge Functions require the same current consent version', async () => {
  const storeSource = await readFile(fileURLToPath(new URL('../src/store/journal.ts', import.meta.url)), 'utf8');
  const edgeConsentSource = await readFile(fileURLToPath(new URL('../supabase/functions/_shared/consent.ts', import.meta.url)), 'utf8');
  const frontendVersion = storeSource.match(/CONSENT_VERSION = '([^']+)'/)?.[1];
  const edgeVersion = edgeConsentSource.match(/CURRENT_CONSENT_VERSION = '([^']+)'/)?.[1];
  assert.ok(frontendVersion);
  assert.equal(edgeVersion, frontendVersion);
});

test('authenticated Roboflow analysis is protected by the current-consent gate', async () => {
  const analyzerSource = await readFile(fileURLToPath(new URL('../supabase/functions/analyze-stool/index.ts', import.meta.url)), 'utf8');
  assert.match(analyzerSource, /hasCurrentConsent\(admin, user\.id\)/);
  assert.match(analyzerSource, /current_consent_required/);
});

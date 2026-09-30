import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Roboflow and service-role credentials remain server-only', async () => {
  const clientFiles = await Promise.all([
    'app/capture.tsx', 'app/processing.tsx', 'src/data/journalRepository.ts',
    'src/auth/AuthProvider.tsx', 'src/lib/supabase.ts',
  ].map(read));
  const clientSource = clientFiles.join('\n');
  assert.doesNotMatch(clientSource, /ROBOFLOW_API_KEY|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(clientSource, /detect\.roboflow\.com|serverless\.roboflow\.com/);
});

test('account deletion requires backend password verification before admin deletion', async () => {
  const source = await read('supabase/functions/delete-account/index.ts');
  assert.match(source, /signInWithPassword/);
  assert.match(source, /auth\.admin\.deleteUser/);
  assert.ok(source.indexOf('signInWithPassword') < source.indexOf('auth.admin.deleteUser'));
  assert.match(source, /storage\.from\(bucket\)\.remove/);
});

test('native password recovery accepts only a recovery link with both session tokens', async () => {
  const source = await read('src/auth/AuthProvider.tsx');
  assert.match(source, /type !== 'recovery'/);
  assert.match(source, /!accessToken \|\| !refreshToken/);
  assert.match(source, /auth\.setSession/);
});

test('Doctor Review generates private URLs only after fresh authentication', async () => {
  const source = await read('app/doctor-review.tsx');
  assert.match(source, /authenticateAsync|reauthenticate/);
  assert.match(source, /createSignedUrl|resolveOriginalImageUri/);
  assert.match(source, /authenticateAsync[\s\S]*await resolveAllOriginals\(\)/);
  assert.match(source, /reauthenticate\(password\)[\s\S]*await resolveAllOriginals\(\)/);
});

test('successful-original automatic deletion remains deliberately disabled', async () => {
  const backlog = await read('docs/backlog.md');
  assert.match(backlog, /P0\.4 Verified original-photo deletion and retention[\s\S]*Deferred by product decision/);
  const migrations = await read('supabase/migrations/202609010003_capture_upload_lifecycle.sql');
  assert.match(migrations, /only expired, never-finalized uploads/);
  assert.doesNotMatch(migrations, /scheduled_delete_at\s*</);
});

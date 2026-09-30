import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const privateBuckets = ['originals-private', 'artworks-private', 'reports-private'] as const;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !publishableKey) return json({ error: 'server_not_configured' }, 500);

  const authorization = request.headers.get('Authorization') ?? '';
  const jwt = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!jwt) return json({ error: 'authentication_required' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(jwt);
  const user = authData.user;
  if (authError || !user?.email) return json({ error: 'invalid_session' }, 401);

  let password = '';
  try {
    const body = await request.json() as { password?: unknown };
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (password.length < 8 || password.length > 256) return json({ error: 'password_required', message: '請再次輸入正確密碼。' }, 400);

  // A current session is not enough for this destructive action. Verify the password
  // separately and never persist or log it.
  const verifier = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: passwordError } = await verifier.auth.signInWithPassword({ email: user.email, password });
  if (passwordError) return json({ error: 'reauthentication_failed', message: '密碼不正確，帳戶沒有被刪除。' }, 403);

  try {
    const { data: assets, error: assetError } = await admin
      .from('media_assets')
      .select('bucket_id, object_path')
      .eq('user_id', user.id);
    if (assetError) throw new Error('asset_lookup_failed');

    const knownPaths = new Map<string, Set<string>>();
    for (const bucket of privateBuckets) knownPaths.set(bucket, new Set());
    for (const asset of assets ?? []) {
      if (knownPaths.has(asset.bucket_id)) knownPaths.get(asset.bucket_id)?.add(asset.object_path);
    }

    // Incomplete uploads may not have media_assets metadata yet. The entire user's
    // first-level Storage prefix is listed and removed recursively as a second safety net.
    for (const bucket of privateBuckets) {
      const { data: entryFolders, error: listError } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
      if (listError) throw new Error('storage_list_failed');
      for (const folder of entryFolders ?? []) {
        if (folder.id) {
          knownPaths.get(bucket)?.add(`${user.id}/${folder.name}`);
          continue;
        }
        const prefix = `${user.id}/${folder.name}`;
        const { data: files, error: fileListError } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
        if (fileListError) throw new Error('storage_list_failed');
        for (const file of files ?? []) if (file.id) knownPaths.get(bucket)?.add(`${prefix}/${file.name}`);
      }
    }

    for (const bucket of privateBuckets) {
      for (const paths of chunks([...knownPaths.get(bucket) ?? []], 100)) {
        if (paths.length === 0) continue;
        const { error: removeError } = await admin.storage.from(bucket).remove(paths);
        if (removeError) throw new Error('storage_remove_failed');
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);
    if (deleteError) throw new Error('auth_delete_failed');
    return json({ deleted: true });
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 80) : 'account_delete_failed';
    console.error('account delete failed', { userId: user.id, code });
    await admin.from('operational_events').insert({
      event_type: 'account_deletion_failed',
      severity: 'error',
      user_id: user.id,
      error_code: code,
    }).then(() => undefined, () => undefined);
    return json({ error: 'account_delete_failed', message: '帳戶暫時未能完整刪除。你的帳戶仍然保留，請稍後再試。' }, 500);
  }
});

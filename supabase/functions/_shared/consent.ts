import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.4';

export const CURRENT_CONSENT_VERSION = '2026-09-02';

export const CONSENT_TYPES = [
  'privacy_policy',
  'sensitive_data_processing',
  'ai_analysis',
  'non_medical_disclaimer',
] as const;

export async function hasCurrentConsent(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from('consent_events')
    .select('consent_type, document_version, action, occurred_at')
    .eq('user_id', userId)
    .in('consent_type', [...CONSENT_TYPES])
    .order('occurred_at', { ascending: false });
  if (error) throw error;

  const latest = new Map<string, { action: string; document_version: string }>();
  for (const event of data ?? []) {
    if (!latest.has(event.consent_type)) latest.set(event.consent_type, event);
  }

  return CONSENT_TYPES.every((type) => {
    const event = latest.get(type);
    return event?.action === 'accepted' && event.document_version === CURRENT_CONSENT_VERSION;
  });
}

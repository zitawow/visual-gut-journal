import { useEffect } from 'react';
import { AppState } from 'react-native';
import { cleanupRemoteIncompleteUploads, getRemoteJournalSnapshot } from '../data/journalRepository';
import { useJournalStore } from '../store/journal';
import { useAuth } from './AuthProvider';

export function JournalDataBridge() {
  const { status, user } = useAuth();
  const activateRemoteScope = useJournalStore((state) => state.activateRemoteScope);
  const replaceRemoteEntries = useJournalStore((state) => state.replaceRemoteEntries);
  const setRemoteSyncError = useJournalStore((state) => state.setRemoteSyncError);
  const activateLocalScope = useJournalStore((state) => state.activateLocalScope);

  useEffect(() => {
    if (status === 'signed_out' || status === 'unconfigured') {
      activateLocalScope();
      return;
    }
    if (status !== 'signed_in' || !user) return;

    let active = true;
    let refreshing = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    activateRemoteScope(user.id);

    const refresh = async () => {
      if (!active || refreshing) return;
      refreshing = true;
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = null;
      try {
        const { entries, pendingAnalysisCount, analysisQueue } = await getRemoteJournalSnapshot(user.id);
        if (!active) return;
        replaceRemoteEntries(user.id, entries, pendingAnalysisCount, analysisQueue);
        if (analysisQueue.some((item) => item.status === 'queued' || item.status === 'running')) {
          pollTimer = setTimeout(refresh, 2_500);
        }
      } catch (error) {
        if (!active) return;
        setRemoteSyncError(
          user.id,
          error instanceof Error ? error.message : '私人 Journal 暫時無法同步。',
        );
      } finally {
        refreshing = false;
      }
    };

    void cleanupRemoteIncompleteUploads().catch(() => 0).finally(refresh);
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void refresh();
    });

    return () => {
      active = false;
      if (pollTimer) clearTimeout(pollTimer);
      appStateSubscription.remove();
    };
  }, [activateLocalScope, activateRemoteScope, replaceRemoteEntries, setRemoteSyncError, status, user]);

  return null;
}

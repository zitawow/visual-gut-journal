import * as Haptics from 'expo-haptics';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider';
import { Artwork } from '../src/components/Artwork';
import { analyzeRemoteJournalEntry, getRemoteAnalysisStatus, getRemoteJournalSnapshot, JournalPipelineError, uploadRemoteOriginal, waitForRemoteAnalysis, type RemoteAnalysisResult } from '../src/data/journalRepository';
import { analysisProvider, createArtworkSpec } from '../src/services/analysis/provider';
import { preserveOriginalImage } from '../src/services/originals';
import { createCaptureOperationKey } from '../src/services/idempotency';
import { CONSENT_VERSION, useJournalStore } from '../src/store/journal';
import { colors, spacing, typography } from '../src/theme';

const placeholder = { engineVersion: '1.0', seed: 19, form: 'liquid', palette: 'moss', fluidity: .8, complexity: .6 } as const;

export default function ProcessingScreen() {
  const { uri, entryId, operationKey } = useLocalSearchParams<{ uri?: string; entryId?: string; operationKey?: string }>();
  const { status: authStatus, user } = useAuth();
  const hasHydrated = useJournalStore((s) => s.hasHydrated);
  const consent = useJournalStore((s) => s.consent);
  const hasConsent = consent?.version === CONSENT_VERSION;
  const addEntry = useJournalStore((s) => s.addEntry);
  const replaceRemoteEntries = useJournalStore((s) => s.replaceRemoteEntries);
  const pulse = useRef(new Animated.Value(0)).current;
  const [stage, setStage] = useState('正在確認影像品質');

  useEffect(() => {
    if (!hasHydrated || !hasConsent || authStatus === 'loading') return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    animation.start();
    let active = true;
    const stageTimer = setTimeout(() => active && setStage('正在理解形態與質感'), 520);
    const run = async () => {
      try {
        if (authStatus === 'signed_in') {
          if (!user) throw new Error('Authenticated user is unavailable.');
          if (!entryId) {
            if (!uri || uri.startsWith('demo://')) throw new Error('A real capture is required for private upload.');
            if (!operationKey) {
              router.replace({ pathname: '/processing', params: { uri, operationKey: createCaptureOperationKey() } });
              return;
            }
            setStage('正在建立加密私人上載');
            const uploaded = await uploadRemoteOriginal(uri, 'image/jpeg', 'keep', operationKey);
            if (!active) return;
            router.replace({ pathname: '/processing', params: { entryId: uploaded.entryId } });
            return;
          }

          if (!active) return;
          setStage('照片已安全保存，AI 工作已加入安全隊列');
          let analysisResult: RemoteAnalysisResult;
          try {
            analysisResult = await analyzeRemoteJournalEntry(entryId);
          } catch {
            analysisResult = await getRemoteAnalysisStatus(entryId);
          }
          if (!active) return;
          if (analysisResult.status === 'manual_required') {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
            router.replace({ pathname: '/manual-analysis/[id]', params: { id: entryId } });
            return;
          }

          if (analysisResult.status === 'queued' || analysisResult.status === 'running') {
            setStage('AI 正在背景估算；離開 App 也不會遺失這筆紀錄');
            analysisResult = await waitForRemoteAnalysis(entryId);
          }
          if (!active) return;
          if (analysisResult.status === 'manual_required') {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
            router.replace({ pathname: '/manual-analysis/[id]', params: { id: entryId } });
            return;
          }
          if (analysisResult.status === 'queued' || analysisResult.status === 'running') {
            const snapshot = await getRemoteJournalSnapshot(user.id);
            if (!active) return;
            replaceRemoteEntries(user.id, snapshot.entries, snapshot.pendingAnalysisCount, snapshot.analysisQueue);
            router.replace('/?uploadQueued=1');
            return;
          }

          setStage('估算完成，正在準備你的結果');
          try {
            const snapshot = await getRemoteJournalSnapshot(user.id);
            if (!active) return;
            replaceRemoteEntries(user.id, snapshot.entries, snapshot.pendingAnalysisCount, snapshot.analysisQueue);
          } catch {
            // The analysis itself succeeded. A later collection refresh must not
            // be reported as an upload failure or encourage a duplicate capture.
          }
          if (!active) return;
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          router.replace({ pathname: '/result/[id]', params: { id: entryId } });
          return;
        }

        const analysis = await analysisProvider.analyze(uri ?? 'demo://fallback');
        if (!active) return;
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setStage('正在安全保存原圖');
        const original = await preserveOriginalImage(uri, id);
        if (!active) return;
        setStage('正在把資料轉成藝術');
        const entry = {
          id,
          createdAt: new Date().toISOString(),
          analysis,
          artwork: createArtworkSpec(analysis, id),
          originalImageUri: original.uri,
          originalImageStatus: original.status,
          userConfirmed: false,
          source: uri?.startsWith('demo://') ? 'demo' as const : 'capture' as const,
        };
        addEntry(entry);
        await new Promise((resolve) => setTimeout(resolve, 520));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        router.replace(`/result/${id}`);
      } catch (error) {
        if (!active) return;
        const uploadError = error instanceof JournalPipelineError && error.code === 'usage_limit_reached' ? 'limit' : '1';
        router.replace(authStatus === 'signed_in' ? `/?uploadError=${uploadError}` : '/?analysisError=1');
      }
    };
    run();
    return () => { active = false; clearTimeout(stageTimer); animation.stop(); };
  }, [addEntry, authStatus, entryId, hasConsent, hasHydrated, operationKey, pulse, replaceRemoteEntries, uri, user]);

  if (!hasHydrated) return <SafeAreaView style={styles.screen} />;
  if (!hasConsent) return <Redirect href="/consent" />;

  return <SafeAreaView style={styles.screen}>
    <View style={styles.content}>
      <Animated.View style={{ opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [.72, 1] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [.96, 1] }) }] }}><Artwork spec={placeholder} size={270} /></Animated.View>
      <Text style={styles.eyebrow}>ANALYSIS IN PROGRESS</Text><Text style={styles.title}>{stage}</Text>
      <View style={styles.rule}><View style={styles.progress} /></View>
      <Text style={styles.privacy}>原圖會移入 App 私人儲存區並預設隱藏；需要時可從作品背後查看。</Text>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.ink }, content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, eyebrow: { color: colors.peach, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: spacing.xl }, title: { color: colors.cream, fontFamily: typography.display, fontSize: 27, marginTop: 8, textAlign: 'center' }, rule: { height: 2, width: 220, backgroundColor: '#365347', marginTop: spacing.xl }, progress: { width: '72%', height: 2, backgroundColor: colors.peach }, privacy: { color: colors.muted, fontFamily: typography.body, fontSize: 12, textAlign: 'center', lineHeight: 18, maxWidth: 290, marginTop: spacing.lg } });

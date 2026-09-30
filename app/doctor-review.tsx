import * as LocalAuthentication from 'expo-local-authentication';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton, uiStyles } from '../src/components/ui';
import { useAuth } from '../src/auth/AuthProvider';
import { hasStoredOriginal, resolveOriginalImageUri } from '../src/services/originals';
import { useJournalStore } from '../src/store/journal';
import { colors, radius, spacing, typography } from '../src/theme';
import type { StoolColor, StoolShape } from '../src/types';

const shapeLabels: Record<StoolShape, string> = { pellets: '顆粒', lumpy: '結塊', cracked: '表面裂紋', smooth: '平滑流線', soft_blobs: '柔軟分段', mushy: '鬆散', watery: '液態', uncertain: '未能確定' };
const colorLabels: Record<StoolColor, string> = {
  light_brown: '淺棕色', medium_brown: '中棕色', dark_brown: '深棕色',
  yellow: '黃色', green: '綠色', black: '黑色', red: '紅色', clay: '灰白／陶土色', other: '其他',
};

export default function DoctorReviewScreen() {
  const { status: authStatus, reauthenticate } = useAuth();
  const entries = useJournalStore((state) => state.entries);
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [resolvedUris, setResolvedUris] = useState<Record<string, string>>({});
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(Platform.OS === 'web');
  const originals = useMemo(() => entries
    .filter(hasStoredOriginal)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [entries]);
  const unavailableCount = entries.length - originals.length;

  useFocusEffect(useCallback(() => () => {
    setUnlocked(false);
    setResolvedUris({});
    setFailedIds([]);
    setPassword('');
    setUnlockError(null);
  }, []));

  useEffect(() => {
    if (!unlocked) return;
    const timer = setTimeout(() => {
      setUnlocked(false);
      setResolvedUris({});
    }, 2 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [unlocked]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        setUnlocked(false);
        setResolvedUris({});
      }
    });
    return () => subscription.remove();
  }, []);

  const lockAndLeave = () => {
    setUnlocked(false);
    setResolvedUris({});
    router.back();
  };

  const resolveAllOriginals = async () => {
    const results = await Promise.all(originals.map(async (entry) => {
      try {
        return { id: entry.id, uri: await resolveOriginalImageUri(entry, 2 * 60) };
      } catch {
        return { id: entry.id, uri: null };
      }
    }));
    setResolvedUris(Object.fromEntries(results.filter((item): item is { id: string; uri: string } => Boolean(item.uri)).map((item) => [item.id, item.uri])));
    setFailedIds(results.filter((item) => !item.uri).map((item) => item.id));
    setUnlocked(true);
  };

  const unlockAll = async () => {
    if (unlocking) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      if (authStatus !== 'signed_in') throw new Error('請先登入私人帳戶。');
      if (Platform.OS !== 'web' && !requiresPassword) {
        const [hardware, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        if (hardware && enrolled) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: '解鎖 Doctor Review 私人原圖',
            fallbackLabel: '使用裝置密碼',
            disableDeviceFallback: false,
            biometricsSecurityLevel: 'strong',
          });
          if (!result.success) throw new Error('身份確認未完成，原圖仍然鎖定。');
        } else {
          setRequiresPassword(true);
          throw new Error('此裝置未設定生物辨識，請使用帳戶密碼確認。');
        }
      } else {
        if (!password) throw new Error('請輸入帳戶密碼。');
        await reauthenticate(password);
      }
      await resolveAllOriginals();
      setPassword('');
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : '身份確認未完成。');
    } finally {
      setUnlocking(false);
    }
  };

  return <SafeAreaView style={uiStyles.screen}>
    <ScrollView contentContainerStyle={[uiStyles.content, styles.content]} showsVerticalScrollIndicator={false}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={lockAndLeave} style={styles.back}><Text style={styles.backText}>←</Text></Pressable>
        <View style={styles.privatePill}><View style={styles.privateDot} /><Text style={styles.privateText}>{unlocked ? 'SESSION OPEN' : 'LOCKED'}</Text></View>
      </View>

      <View style={styles.heading}>
        <Text style={styles.eyebrow}>ONE UNLOCK · ALL AVAILABLE ORIGINALS</Text>
        <Text style={styles.title}>DOCTOR{`\n`}REVIEW</Text>
        <Text style={styles.subtitle}>給醫生看的應該是清楚的原圖與日期，不是要你在診症時逐張解鎖。</Text>
      </View>

      {!unlocked ? <View style={styles.gateCard}>
        <View style={styles.countRow}>
          <View><Text style={styles.count}>{String(originals.length).padStart(2, '0')}</Text><Text style={styles.countLabel}>ORIGINALS READY</Text></View>
          <Text style={styles.lockMark}>◉</Text>
        </View>
        <Text style={styles.gateTitle}>{originals.length > 0 ? '準備好後，一次顯示全部' : '目前沒有可顯示的正式原圖'}</Text>
        <View style={styles.rules}>
          <Rule number="01" copy="所有可用原圖按日期由新到舊排列" />
          <Rule number="02" copy="不會自動上傳、傳送或分享給任何人" />
          <Rule number="03" copy="離開此頁或切換 App 後自動重新鎖定" />
        </View>
        {unavailableCount > 0 ? <Text style={styles.excluded}>{unavailableCount} 筆示範、已刪除或未保存原圖的紀錄不會顯示。</Text> : null}
        {requiresPassword && originals.length > 0 ? <TextInput
          accessibilityLabel="Doctor Review 帳戶密碼"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setPassword}
          placeholder="輸入帳戶密碼重新確認身份"
          placeholderTextColor="#625B73"
          secureTextEntry
          style={styles.passwordInput}
          value={password}
        /> : null}
        {unlockError ? <Text accessibilityRole="alert" style={styles.unlockError}>{unlockError}</Text> : null}
        {originals.length > 0
          ? <PrimaryButton disabled={unlocking} label={unlocking ? '正在確認身份…' : `${requiresPassword ? '確認密碼' : '使用 Face ID／裝置驗證'} · 顯示 ${originals.length} 張原圖`} onPress={unlockAll} />
          : <PrimaryButton label="建立一筆正式拍攝紀錄" onPress={() => router.push('/capture')} />}
      </View> : <>
        <View style={styles.openBanner}>
          <View><Text style={styles.openEyebrow}>PRIVATE VIEWING SESSION</Text><Text style={styles.openTitle}>{originals.length} 張原圖 · 由新到舊</Text></View>
          <Pressable accessibilityRole="button" onPress={() => { setUnlocked(false); setResolvedUris({}); }} style={styles.hideButton}><Text style={styles.hideButtonText}>HIDE ALL</Text></Pressable>
        </View>

        <View style={styles.records}>
          {originals.map((entry, index) => {
            const date = new Date(entry.createdAt);
            const uri = resolvedUris[entry.id] ?? entry.originalImageUri;
            const failed = failedIds.includes(entry.id) || !uri;
            return <View key={entry.id} style={styles.recordCard}>
              <View style={styles.recordHead}>
                <View><Text style={styles.recordIndex}>RECORD {String(index + 1).padStart(2, '0')}</Text><Text style={styles.recordDate}>{date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</Text></View>
                <Text style={styles.recordTime}>{date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              {failed ? <View style={styles.imageError}><Text style={styles.imageErrorTitle}>這張原圖已無法在目前的瀏覽器工作階段顯示</Text><Text style={styles.imageErrorCopy}>手機 App 內保存的正式原圖不受瀏覽器預覽工作階段限制。</Text></View>
                : <Image accessibilityLabel={`${date.toLocaleDateString('zh-TW')}的原始照片`} onError={() => setFailedIds((ids) => ids.includes(entry.id) ? ids : [...ids, entry.id])} resizeMode="contain" source={{ uri }} style={styles.originalImage} />}
              <View style={styles.metadata}>
                <Metric label="BRISTOL" value={`Type ${entry.analysis.bristolType}`} />
                <Metric label="COLOR" value={colorLabels[entry.analysis.color]} />
                <Metric label="SHAPE" value={shapeLabels[entry.analysis.shape]} />
              </View>
            </View>;
          })}
        </View>
      </>}

      <View style={styles.notice}>
        <Text style={styles.noticeEyebrow}>NOT A MEDICAL DIAGNOSIS</Text>
        <Text style={styles.noticeCopy}>這個畫面只整理你保存的圖片、日期與觀察性分類，方便當面討論；它不提供診斷，也不取代醫生的專業判斷。</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function Rule({ number, copy }: { number: string; copy: string }) {
  return <View style={styles.rule}><Text style={styles.ruleNumber}>{number}</Text><Text style={styles.ruleCopy}>{copy}</Text></View>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, gap: spacing.lg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.ink },
  backText: { color: colors.ink, fontFamily: typography.body, fontSize: 22, fontWeight: '900' },
  privatePill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#40404A' },
  privateDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber },
  privateText: { color: colors.cream, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  heading: { gap: spacing.sm, paddingTop: spacing.sm },
  eyebrow: { color: colors.peach, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: colors.cream, fontFamily: typography.display, fontSize: 66, lineHeight: 55, letterSpacing: -2.5, fontWeight: '900' },
  subtitle: { color: colors.sage, fontFamily: typography.body, fontSize: 15, lineHeight: 22, maxWidth: 620 },
  gateCard: { gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.peach, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.cream },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  count: { color: colors.cream, fontFamily: typography.display, fontSize: 72, lineHeight: 66, fontWeight: '900' },
  countLabel: { color: colors.ink, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  lockMark: { color: colors.ink, fontSize: 42 },
  gateTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 30, lineHeight: 31, fontWeight: '900' },
  rules: { borderTopWidth: 1, borderTopColor: 'rgba(11,11,16,.35)' },
  rule: { flexDirection: 'row', gap: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(11,11,16,.35)' },
  ruleNumber: { color: colors.cream, fontFamily: typography.mono, fontWeight: '900', width: 28 },
  ruleCopy: { flex: 1, color: colors.ink, fontFamily: typography.body, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  excluded: { color: '#20202A', fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  passwordInput: { minHeight: 52, borderRadius: radius.md, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.cream, color: colors.ink, paddingHorizontal: spacing.md, fontFamily: typography.body, fontSize: 15 },
  unlockError: { color: '#57151E', fontFamily: typography.body, fontSize: 12, lineHeight: 18, fontWeight: '800' },
  openBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.amber, borderRadius: radius.md, borderWidth: 2, borderColor: colors.cream },
  openEyebrow: { color: colors.ink, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  openTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 23, fontWeight: '900', marginTop: 3 },
  hideButton: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 15, paddingVertical: 11 },
  hideButtonText: { color: colors.cream, fontFamily: typography.body, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  records: { gap: spacing.lg },
  recordCard: { backgroundColor: colors.cream, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 2, borderColor: colors.cream },
  recordHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: spacing.md },
  recordIndex: { color: colors.peach, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  recordDate: { color: colors.ink, fontFamily: typography.display, fontSize: 27, lineHeight: 29, fontWeight: '900', marginTop: 3 },
  recordTime: { color: colors.ink, fontFamily: typography.mono, fontSize: 11, fontWeight: '900' },
  originalImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#111117' },
  imageError: { minHeight: 230, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, backgroundColor: '#D8D5CE' },
  imageErrorTitle: { color: colors.ink, fontFamily: typography.body, fontWeight: '900', textAlign: 'center' },
  imageErrorCopy: { color: '#55535C', fontFamily: typography.body, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  metadata: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  metric: { flex: 1 },
  metricLabel: { color: '#66636C', fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  metricValue: { color: colors.ink, fontFamily: typography.body, fontSize: 12, fontWeight: '900', marginTop: 4 },
  notice: { gap: spacing.sm, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#3A3A44' },
  noticeEyebrow: { color: colors.amber, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  noticeCopy: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
});

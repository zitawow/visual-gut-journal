import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider';
import { PrimaryButton, uiStyles } from '../src/components/ui';
import { hasCurrentRemoteConsent } from '../src/data/journalRepository';
import { createCaptureOperationKey } from '../src/services/idempotency';
import { CONSENT_VERSION, useJournalStore } from '../src/store/journal';
import { colors, radius, spacing, typography } from '../src/theme';

export default function CaptureScreen() {
  const { status: authStatus, user } = useAuth();
  const hasHydrated = useJournalStore((state) => state.hasHydrated);
  const consent = useJournalStore((state) => state.consent);
  const camera = useRef<CameraView>(null);
  const captureInFlight = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [remoteConsentStatus, setRemoteConsentStatus] = useState<'idle' | 'checking' | 'valid' | 'missing' | 'error'>('idle');
  const leaveCapture = () => router.canGoBack() ? router.back() : router.replace('/');
  const startDemo = () => router.replace({ pathname: '/processing', params: { uri: `demo://${Date.now()}` } });

  const capture = async () => {
    if (!camera.current || !ready || capturing || captureInFlight.current) return;
    captureInFlight.current = true;
    setCapturing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await camera.current.takePictureAsync({ quality: 0.72, base64: false, exif: false, skipProcessing: false });
      if (photo?.uri) router.replace({ pathname: '/processing', params: { uri: photo.uri, operationKey: createCaptureOperationKey() } });
    } finally {
      captureInFlight.current = false;
      setCapturing(false);
    }
  };

  useEffect(() => {
    if (authStatus !== 'signed_in' || !user) {
      setRemoteConsentStatus('idle');
      return;
    }
    let active = true;
    setRemoteConsentStatus('checking');
    hasCurrentRemoteConsent(user.id, CONSENT_VERSION)
      .then((valid) => active && setRemoteConsentStatus(valid ? 'valid' : 'missing'))
      .catch(() => active && setRemoteConsentStatus('error'));
    return () => { active = false; };
  }, [authStatus, user]);

  if (!hasHydrated) return <View style={styles.screen} />;
  if (consent?.version !== CONSENT_VERSION) return <Redirect href="/consent" />;
  if (authStatus === 'signed_in' && remoteConsentStatus === 'missing') return <Redirect href="/consent" />;
  if (authStatus === 'signed_in' && (remoteConsentStatus === 'checking' || remoteConsentStatus === 'idle')) return <SafeAreaView style={uiStyles.screen}><View style={styles.permission}><Text style={uiStyles.h1}>正在確認你的 Consent。</Text><Text style={uiStyles.body}>正式拍攝前會先確認目前版本的 Privacy、敏感資料處理、AI 分析與非醫療聲明都已保存。</Text></View></SafeAreaView>;
  if (authStatus === 'signed_in' && remoteConsentStatus === 'error') return <SafeAreaView style={uiStyles.screen}><View style={styles.permission}><Text style={uiStyles.h1}>暫時無法確認 Consent。</Text><Text style={uiStyles.body}>為了避免在未確認同意狀態下上載敏感照片，拍攝暫時停止。請檢查網路後再試。</Text><PrimaryButton label="返回" onPress={leaveCapture} /></View></SafeAreaView>;

  if (!permission?.granted) return <SafeAreaView style={uiStyles.screen}><View style={styles.permission}><Text style={uiStyles.h1}>相機只為這一刻打開。</Text><Text style={uiStyles.body}>照片不會寫入相簿；完成分析後，原圖會保存在 App 私人區並預設隱藏。</Text><PrimaryButton label="允許使用相機" onPress={requestPermission} /><PrimaryButton label="先用 Demo 體驗" inverse onPress={startDemo} /><Text accessibilityRole="button" onPress={leaveCapture} style={styles.textLink}>暫時不要</Text></View></SafeAreaView>;

  return <View style={styles.screen}>
    <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" mode="picture" active onCameraReady={() => setReady(true)} />
    <View style={styles.shade} />
    <SafeAreaView style={styles.overlay}>
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="關閉相機" onPress={leaveCapture}><Text style={styles.close}>×</Text></Pressable><View style={styles.privatePill}><Text style={styles.privateText}>PRIVATE CAPTURE</Text></View></View>
      <View style={styles.guide}><View style={styles.cornerTL} /><View style={styles.cornerBR} /><Text style={styles.guideTitle}>把主體放在框內</Text><Text style={styles.guideCopy}>保持光線充足，避免紙巾遮住主要形態。</Text></View>
      <View style={styles.controls}>
        <Text style={styles.microcopy}>原圖不進 Camera Roll · 只保存在 App 內</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="拍攝" disabled={!ready || capturing} onPress={capture} style={({ pressed }) => [styles.shutterOuter, pressed && { transform: [{ scale: .94 }] }]}><View style={styles.shutterInner} /></Pressable>
        {authStatus === 'signed_in' ? null : <Pressable accessibilityRole="button" onPress={startDemo}><Text style={styles.demo}>使用 Demo 影像</Text></Pressable>}
      </View>
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07100D' }, shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,13,10,.2)' },
  overlay: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'space-between' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, close: { color: colors.white, fontSize: 38, fontWeight: '200' },
  privatePill: { backgroundColor: 'rgba(18,37,30,.78)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }, privateText: { color: colors.sage, fontSize: 10, letterSpacing: 1.5, fontWeight: '800' },
  guide: { height: '48%', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  cornerTL: { position: 'absolute', left: -2, top: -2, width: 48, height: 48, borderLeftWidth: 4, borderTopWidth: 4, borderColor: colors.peach, borderTopLeftRadius: radius.md },
  cornerBR: { position: 'absolute', right: -2, bottom: -2, width: 48, height: 48, borderRightWidth: 4, borderBottomWidth: 4, borderColor: colors.peach, borderBottomRightRadius: radius.md },
  guideTitle: { color: colors.white, fontFamily: typography.display, fontSize: 25 }, guideCopy: { color: colors.cream, fontFamily: typography.body, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  controls: { alignItems: 'center', paddingBottom: spacing.lg, gap: 14 }, microcopy: { color: colors.cream, fontSize: 12, fontFamily: typography.body },
  shutterOuter: { width: 82, height: 82, borderRadius: 41, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }, shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.cream },
  demo: { color: colors.peach, fontFamily: typography.body, fontSize: 13, fontWeight: '700' },
  permission: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.lg }, textLink: { color: colors.muted, textAlign: 'center', padding: spacing.sm },
});

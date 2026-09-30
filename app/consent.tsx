import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider';
import { Artwork } from '../src/components/Artwork';
import { Eyebrow, PrimaryButton, uiStyles } from '../src/components/ui';
import { recordRemoteConsent } from '../src/data/journalRepository';
import { CONSENT_VERSION, useJournalStore } from '../src/store/journal';
import { colors, radius, spacing, typography } from '../src/theme';

const consentArt = { engineVersion: '1.0', seed: 87, form: 'petal', palette: 'moss', fluidity: .5, complexity: .7 } as const;

type ConsentChoice = 'privacy' | 'processing' | 'medical';

export default function ConsentScreen() {
  const { user } = useAuth();
  const acceptConsent = useJournalStore((state) => state.acceptConsent);
  const [choices, setChoices] = useState<Record<ConsentChoice, boolean>>({ privacy: false, processing: false, medical: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = Object.values(choices).every(Boolean);
  const toggle = (choice: ConsentChoice) => setChoices((current) => ({ ...current, [choice]: !current[choice] }));
  const accept = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (user) {
        const sourcePlatform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
        await recordRemoteConsent(user.id, CONSENT_VERSION, 'accepted', sourcePlatform);
      }
      acceptConsent();
      router.replace('/');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '同意紀錄暫時無法安全保存，請再試一次。');
    } finally {
      setSubmitting(false);
    }
  };

  return <SafeAreaView style={uiStyles.screen}>
    <ScrollView contentContainerStyle={[uiStyles.content, styles.content]} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.art}><Artwork spec={consentArt} size={132} /></View>
        <View style={styles.heroCopy}><Eyebrow>Before your first piece</Eyebrow><Text style={styles.title}>你的資料，{`\n`}由你決定。</Text></View>
      </View>
      <Text style={uiStyles.body}>糞便影像與腸道紀錄屬於敏感健康資料。請先了解資料如何被處理，再決定是否開始。</Text>

      <View style={styles.choices}>
        <ConsentRow checked={choices.privacy} onPress={() => toggle('privacy')} title="我已閱讀 Privacy Policy" body="我理解會保存哪些資料、保存在哪裡，以及如何刪除或撤回同意。" />
        <ConsentRow checked={choices.processing} onPress={() => toggle('processing')} title="我同意處理敏感影像與健康紀錄" body={user ? '登入後拍攝的原圖會由受保護的後端傳送至 Roboflow Hosted Inference，僅用於估算 Bristol Type 1–7；App 不會接觸 Roboflow API key。' : 'Public Demo 只使用模擬資料，不會把真實健康影像傳送至 Roboflow。'} />
        <ConsentRow checked={choices.medical} onPress={() => toggle('medical')} title="我理解這不是醫療診斷" body="AI 分類與趨勢只供自我觀察，不能取代醫師、檢查、診斷或治療建議。" />
      </View>

      <View style={styles.notice}><Text style={styles.noticeEyebrow}>IMPORTANT</Text><Text style={styles.noticeTitle}>有嚴重、持續或令你擔心的症狀時，請尋求合格醫療專業人員協助。</Text></View>
      {error ? <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
      <PrimaryButton label={submitting ? '正在安全保存同意紀錄…' : '同意並繼續'} disabled={!ready || submitting} onPress={accept} />
      <Pressable accessibilityRole="button" onPress={() => router.push('/privacy')}><Text style={styles.policyLink}>閱讀完整 Privacy Policy →</Text></Pressable>
      <Text style={styles.version}>Consent version {CONSENT_VERSION} · {user ? '每份同意文件會保存為不可改寫的帳戶紀錄' : 'Demo 選擇只保存在目前裝置'}</Text>
    </ScrollView>
  </SafeAreaView>;
}

function ConsentRow({ checked, onPress, title, body }: { checked: boolean; onPress: () => void; title: string; body: string }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={({ pressed }) => [styles.choice, checked && styles.choiceChecked, pressed && styles.pressed]}>
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}><Text style={styles.checkmark}>{checked ? '✓' : ''}</Text></View>
    <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>{title}</Text><Text style={styles.choiceBody}>{body}</Text></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, gap: spacing.lg },
  hero: { minHeight: 178, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: radius.lg, backgroundColor: '#203D33', borderWidth: 1, borderColor: '#3A5A4D' },
  art: { width: 148, marginLeft: -8 },
  heroCopy: { flex: 1, paddingRight: spacing.md, gap: spacing.sm },
  title: { color: colors.cream, fontFamily: typography.display, fontSize: 31, lineHeight: 36 },
  choices: { gap: spacing.sm },
  choice: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: '#192F28', borderWidth: 1, borderColor: '#31493F' },
  choiceChecked: { backgroundColor: '#244338', borderColor: colors.peach },
  checkbox: { width: 27, height: 27, borderRadius: 9, borderWidth: 1, borderColor: '#708079', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: colors.peach, borderColor: colors.peach },
  checkmark: { color: colors.ink, fontWeight: '900', fontSize: 15 },
  choiceCopy: { flex: 1, gap: 4 },
  choiceTitle: { color: colors.cream, fontFamily: typography.body, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  choiceBody: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  notice: { borderLeftWidth: 3, borderLeftColor: colors.amber, paddingLeft: spacing.md, gap: 4 },
  noticeEyebrow: { color: colors.amber, fontFamily: typography.body, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  noticeTitle: { color: colors.sage, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  policyLink: { color: colors.peach, fontFamily: typography.body, fontWeight: '800', textAlign: 'center', paddingVertical: spacing.xs },
  errorBox: { padding: spacing.md, borderRadius: radius.sm, backgroundColor: '#3A2025', borderWidth: 1, borderColor: colors.danger },
  errorText: { color: colors.cream, fontFamily: typography.body, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  version: { color: colors.muted, fontFamily: typography.body, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  pressed: { opacity: .8, transform: [{ scale: .992 }] },
});

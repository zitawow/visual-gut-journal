import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider';
import { Eyebrow, PrimaryButton, uiStyles } from '../src/components/ui';
import { recordRemoteConsent } from '../src/data/journalRepository';
import { CONSENT_VERSION, useJournalStore } from '../src/store/journal';
import { colors, radius, spacing, typography } from '../src/theme';

const sections = [
  { number: '01', title: '我們處理的資料', body: '你主動拍攝的原始影像、拍攝時間、Bristol Type、顏色、形態、質感、AI 信心度、你確認或修改的結果，以及由這些資料生成的藝術作品。' },
  { number: '02', title: 'Roboflow AI 分析', body: '登入後正式拍攝時，受保護的 Supabase Edge Function 會從 Private Storage 讀取原圖，傳送至 Roboflow Hosted Inference（bristol-stool-slqqx/2），只用於估算 Bristol Type 1–7。Roboflow 的回傳資料只保存分類、信心度及模型 metadata；Public Demo 不傳送真實健康影像。' },
  { number: '03', title: '原圖如何保存', body: '登入後的正式拍攝會使用短效上載憑證寫入帳戶專屬的 Private Storage，不進 Camera Roll，也不使用公開網址。原圖平時隱藏；只有你主動查看時才建立短效存取連結。Public Demo 不包含真實健康影像。' },
  { number: '04', title: '目前的保存方式', body: '這個 Beta 版本會把成功上載的原圖保留在帳戶專屬的 Private Storage。分析後刪除及七天後刪除只在資料結構中預留，尚未啟用，不會假裝已經自動執行。未完成或過期的上載可由後端清理，避免留下無人管理的檔案。' },
  { number: '05', title: '你的選擇', body: '你可以不提供照片、使用 Demo 體驗、查看或隱藏原圖、送出逐張原圖刪除要求、永久刪除整個帳戶，以及隨時撤回後續處理同意。逐張刪除要求在後端刪除流程正式啟用前只會顯示為待處理；帳戶刪除則會再次驗證密碼並由後端移除帳戶及私人檔案。' },
];

export default function PrivacyScreen() {
  const { user } = useAuth();
  const consent = useJournalStore((state) => state.consent);
  const withdrawConsent = useJournalStore((state) => state.withdrawConsent);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const withdraw = async () => {
    if (withdrawing) return;
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      if (user) {
        const sourcePlatform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
        await recordRemoteConsent(user.id, CONSENT_VERSION, 'withdrawn', sourcePlatform);
      }
      withdrawConsent();
      router.replace('/consent');
    } catch (nextError) {
      setWithdrawError(nextError instanceof Error ? nextError.message : '撤回紀錄暫時無法安全保存，請再試一次。');
    } finally {
      setWithdrawing(false);
    }
  };

  return <SafeAreaView style={uiStyles.screen}>
    <ScrollView contentContainerStyle={[uiStyles.content, styles.content]} showsVerticalScrollIndicator={false}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/')}><Text style={styles.back}>← 返回</Text></Pressable>
      <Eyebrow>Privacy center · MVP</Eyebrow>
      <Text style={uiStyles.h1}>Privacy Policy</Text>
      <Text style={uiStyles.body}>我們把「最少資料、清楚選擇、使用者可刪除」當作產品功能，而不是藏在頁尾的小字。</Text>

      <View style={styles.statusCard}>
        <View><Text style={styles.statusLabel}>THIS BUILD</Text><Text style={styles.statusTitle}>{user ? 'Protected Roboflow analysis' : 'Public Demo / sample data'}</Text></View>
        <Text style={styles.statusBody}>{user ? '正式拍攝經後端分析，Roboflow key 不會放在 App。結果是視覺估算，不是醫療診斷。' : '目前只顯示模擬資料，不會把真實健康影像傳送至 Roboflow。'}</Text>
      </View>

      <View style={styles.sections}>{sections.map((section) => <View key={section.number} style={styles.section}>
        <Text style={styles.number}>{section.number}</Text><View style={styles.sectionCopy}><Text style={styles.sectionTitle}>{section.title}</Text><Text style={styles.sectionBody}>{section.body}</Text></View>
      </View>)}</View>

      <View style={styles.medical}>
        <Text style={styles.medicalEyebrow}>NON-MEDICAL DIAGNOSTIC NOTICE</Text>
        <Text style={styles.medicalTitle}>這是一款 wellness 日誌，不是醫療器材或診斷服務。</Text>
        <Text style={styles.medicalBody}>AI 結果可能不準確，也不能排除疾病。不要根據本 App 延誤、開始、停止或改變任何治療。有嚴重、持續、惡化或令你擔心的症狀時，請聯絡合格醫療專業人員；緊急情況請使用所在地的緊急服務。</Text>
      </View>

      <View style={styles.consentCard}>
        <Text style={styles.consentTitle}>Consent status</Text>
        <Text style={styles.consentBody}>{consent ? `已同意版本 ${consent.version}\n${new Date(consent.acceptedAt).toLocaleString('zh-TW')}` : '尚未同意處理敏感影像與健康紀錄。'}</Text>
        {consent ? !confirmWithdraw ? <PrimaryButton label="撤回後續處理同意" inverse onPress={() => setConfirmWithdraw(true)} /> : <View style={styles.confirmBox}>
          <Text style={styles.confirmTitle}>撤回後將不能新增紀錄</Text><Text style={styles.sectionBody}>既有資料不會被自動刪除。你可以稍後再次閱讀並同意。</Text>
          {withdrawError ? <Text accessibilityRole="alert" style={styles.withdrawError}>{withdrawError}</Text> : null}
          <PrimaryButton disabled={withdrawing} label={withdrawing ? '正在保存撤回紀錄…' : '確認撤回'} onPress={withdraw} />
          <Text onPress={() => setConfirmWithdraw(false)} style={styles.cancel}>取消</Text>
        </View> : null}
      </View>

      <View style={styles.releaseNote}><Text style={styles.releaseTitle}>上架前必要事項</Text><Text style={styles.releaseBody}>此為 MVP 版政策。送交 TestFlight／App Store 前，需完成 Roboflow 的資料處理條款、處理地區、保存期限與刪除安排之法律審閱，並依實際公司主體與營運地區提供公開 Privacy Policy URL 及有效聯絡方式。</Text></View>
      <Text style={styles.footer}>Effective 2026-09-02 · Consent {CONSENT_VERSION}</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.sm, gap: spacing.lg },
  back: { color: colors.sage, fontFamily: typography.body, paddingVertical: spacing.sm },
  statusCard: { backgroundColor: colors.peach, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  statusLabel: { color: colors.ink, fontFamily: typography.body, fontWeight: '900', fontSize: 9, letterSpacing: 1.5 },
  statusTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 24, marginTop: 5 },
  statusBody: { color: '#49362E', fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  sections: { borderTopWidth: 1, borderTopColor: '#395247' },
  section: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: '#31483F' },
  number: { color: colors.peach, fontFamily: typography.display, fontSize: 22, width: 36 },
  sectionCopy: { flex: 1, gap: spacing.xs },
  sectionTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 20 },
  sectionBody: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  medical: { backgroundColor: '#3D3324', borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: '#6A5938', gap: spacing.sm },
  medicalEyebrow: { color: colors.amber, fontFamily: typography.body, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  medicalTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 23, lineHeight: 29 },
  medicalBody: { color: '#D8CBB0', fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  consentCard: { backgroundColor: '#203D33', borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: '#3E5E51' },
  consentTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 22 },
  consentBody: { color: colors.sage, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  confirmBox: { backgroundColor: '#3D2A24', borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  confirmTitle: { color: colors.cream, fontFamily: typography.body, fontWeight: '800' },
  cancel: { color: colors.cream, textAlign: 'center', fontFamily: typography.body, paddingVertical: spacing.xs },
  withdrawError: { color: '#FFB7AD', fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  releaseNote: { borderLeftWidth: 2, borderLeftColor: colors.muted, paddingLeft: spacing.md, gap: 5 },
  releaseTitle: { color: colors.sage, fontFamily: typography.body, fontWeight: '800', fontSize: 13 },
  releaseBody: { color: colors.muted, fontFamily: typography.body, fontSize: 11, lineHeight: 17 },
  footer: { color: colors.muted, fontFamily: typography.body, fontSize: 10, textAlign: 'center' },
});

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { Artwork } from '../../src/components/Artwork';
import { Eyebrow, Pill, PrimaryButton, uiStyles } from '../../src/components/ui';
import { getMilestoneStatuses } from '../../src/services/milestones';
import { getCollectibleLabel } from '../../src/services/collectibles';
import { requestRemoteOriginalDeletion } from '../../src/data/journalRepository';
import { hasStoredOriginal, permanentlyDeleteOriginalImage, resolveOriginalImageUri } from '../../src/services/originals';
import { BRISTOL_OPTIONS, getBristolOption, type BristolType } from '../../src/services/bristol';
import { useJournalStore } from '../../src/store/journal';
import { colors, radius, spacing, typography } from '../../src/theme';
import type { StoolColor, StoolTexture } from '../../src/types';

const textureLabels: Record<StoolTexture, string> = { dry: '偏乾', firm: '結實', smooth: '光滑', soft: '柔軟', liquid: '水狀', uncertain: '未能確定' };
const colorLabels: Record<StoolColor, string> = {
  light_brown: '淺棕色', medium_brown: '中棕色', dark_brown: '深棕色',
  yellow: '黃色', green: '綠色', black: '黑色', red: '紅色', clay: '灰白／陶土色', other: '未分析',
};
const levelLabels = { low: '低', moderate: '中等', high: '高' };
const comfortLabels = { comfortable: '自然舒適', slight_strain: '稍微費力', urgent: '較急迫' };

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useJournalStore((s) => s.entries.find((item) => item.id === id));
  const entries = useJournalStore((s) => s.entries);
  const seenMilestoneIds = useJournalStore((s) => s.seenMilestoneIds ?? []);
  const confirm = useJournalStore((s) => s.confirmEntry);
  const updateBristolType = useJournalStore((s) => s.updateBristolType);
  const markOriginalDeleted = useJournalStore((s) => s.markOriginalDeleted);
  const { user } = useAuth();
  const [showOriginal, setShowOriginal] = useState(false);
  const [revealedOriginalUri, setRevealedOriginalUri] = useState<string | null>(null);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [originalError, setOriginalError] = useState<string | null>(null);
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingType, setPendingType] = useState<BristolType | null>(null);
  const [savingChoice, setSavingChoice] = useState(false);
  const [choiceError, setChoiceError] = useState<string | null>(null);

  if (!entry) return null;
  const healthy = entry.analysis.bristolType >= 3 && entry.analysis.bristolType <= 5;
  const entryDate = new Date(entry.createdAt);
  const entryDateLabel = `${entryDate.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })} · ${entryDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
  const originalStatus = entry.originalImageStatus ?? (entry.photoDeleted ? 'deleted' : 'unavailable');
  const hasOriginal = hasStoredOriginal(entry);
  const unseenMilestone = getMilestoneStatuses(entries).find((milestone) => milestone.unlocked && !seenMilestoneIds.includes(milestone.id));
  const currentForm = getBristolOption(entry.analysis.bristolType);
  const pendingForm = pendingType ? getBristolOption(pendingType) : currentForm;

  const deleteOriginal = async () => {
    if (deleting) return;
    setDeleting(true);
    setOriginalError(null);
    try {
      if (entry.originalAsset) {
        if (!user) throw new Error('請先登入再提出刪除要求。');
        await requestRemoteOriginalDeletion(entry.id, user.id);
        setDeletionRequested(true);
      } else if (entry.originalImageUri) {
        const deleted = await permanentlyDeleteOriginalImage(entry.originalImageUri);
        if (!deleted) throw new Error('原圖暫時無法刪除，請稍後再試。');
        markOriginalDeleted(entry.id);
      }
      setShowOriginal(false);
      setRevealedOriginalUri(null);
      setConfirmDelete(false);
    } catch (error) {
      setOriginalError(error instanceof Error ? error.message : '暫時無法處理原圖。');
    } finally {
      setDeleting(false);
    }
  };

  const toggleOriginal = async () => {
    if (showOriginal) {
      setShowOriginal(false);
      setRevealedOriginalUri(null);
      return;
    }
    setLoadingOriginal(true);
    setOriginalError(null);
    try {
      setRevealedOriginalUri(await resolveOriginalImageUri(entry));
      setShowOriginal(true);
      setConfirmDelete(false);
    } catch (error) {
      setOriginalError(error instanceof Error ? error.message : '原圖暫時無法顯示。');
    } finally {
      setLoadingOriginal(false);
    }
  };

  const confirmEstimate = async () => {
    if (savingChoice) return;
    setSavingChoice(true);
    setChoiceError(null);
    try {
      await confirm(entry.id);
    } catch (error) {
      setChoiceError(error instanceof Error ? error.message : '暫時無法儲存確認。');
    } finally {
      setSavingChoice(false);
    }
  };

  const saveFormCorrection = async () => {
    if (!pendingType || savingChoice) return;
    setSavingChoice(true);
    setChoiceError(null);
    try {
      await updateBristolType(entry.id, pendingType);
      setPendingType(null);
    } catch (error) {
      setChoiceError(error instanceof Error ? error.message : '暫時無法儲存修正。');
    } finally {
      setSavingChoice(false);
    }
  };

  return <SafeAreaView style={uiStyles.screen}>
    <ScrollView contentContainerStyle={[uiStyles.content, styles.content]} showsVerticalScrollIndicator={false}>
      <View style={styles.top}><Eyebrow>{entry.source === 'sample' ? `Sample · ${entryDateLabel}` : `Entry · ${entryDateLabel}`}</Eyebrow><Pill tone={healthy ? 'sage' : 'amber'}>{healthy ? '一般健康範圍' : '值得留意'}</Pill></View>
      <Text style={uiStyles.h1}>你的身體，留下了這件作品。</Text>
      <View style={styles.artCard}><Artwork spec={entry.artwork} serial={entry.collectible?.serial} size={300} /><Text style={styles.number}>{getCollectibleLabel(entry)}</Text><Text style={styles.uniqueProof}>1 / 1 · DNA {entry.collectible?.traitFingerprint.slice(0, 8).toUpperCase() ?? 'LEGACY'}</Text></View>
      <View style={styles.metrics}>
        <View style={styles.metricMain}><Text style={styles.metricLabel}>形態 FORM</Text><Text style={styles.metricValue}>{currentForm.title}</Text><Text style={styles.metricReference}>Bristol {entry.analysis.bristolType}</Text></View>
        <View><Text style={styles.metricLabel}>質感</Text><Text style={styles.metricValue}>{textureLabels[entry.analysis.texture]}</Text></View>
        <View><Text style={styles.metricLabel}>COLOR</Text><Text style={styles.metricValue}>{colorLabels[entry.analysis.color]}</Text></View>
      </View>
      <View style={styles.confidence}>
        <Text style={styles.confidenceEyebrow}>{entry.analysis.analysisSource === 'manual_fallback' ? 'MANUAL SELECTION' : 'AI VISUAL ESTIMATE'}</Text>
        <Text style={styles.confidenceTitle}>{entry.analysis.analysisSource === 'manual_fallback'
          ? `你選擇了 Bristol Type ${entry.analysis.bristolType}`
          : entry.analysis.correctedByUser
            ? `已由你修正 · Bristol Type ${entry.analysis.bristolType}`
            : `Bristol Type ${entry.analysis.bristolType} · Confidence ${Math.round(entry.analysis.confidence * 100)}%`}</Text>
        <Text style={uiStyles.muted}>{entry.analysis.analysisSource === 'manual_fallback'
          ? 'AI 未能完成有效估算；這次結果來自你的手動選擇。'
          : `不用記 Bristol 數字。只要確認「${currentForm.title}」是否最接近你看到的形態。`}</Text>
        <Text style={styles.estimateDisclaimer}>AI estimate — not a medical diagnosis.</Text>
      </View>
      {entry.context ? <View style={styles.contextCard}>
        <View style={styles.contextHeading}><Text style={styles.contextEyebrow}>{entry.source === 'sample' ? 'COMPLETE SAMPLE CONTEXT' : 'VISIT CONTEXT'}</Text><Text style={styles.contextDate}>{entryDateLabel}</Text></View>
        <View style={styles.contextGrid}>
          <ContextMetric label="HYDRATION" value={levelLabels[entry.context.hydration]} />
          <ContextMetric label="FIBER" value={levelLabels[entry.context.fiber]} />
          <ContextMetric label="SLEEP" value={`${entry.context.sleepHours} 小時`} />
          <ContextMetric label="STRESS" value={levelLabels[entry.context.stress]} />
        </View>
        <Text style={styles.comfort}>排便感受 · {comfortLabels[entry.context.comfort]}</Text>
        {entry.context.note ? <Text style={styles.contextNote}>「{entry.context.note}」</Text> : null}
      </View> : null}
      <PrimaryButton label={entry.userConfirmed ? '已確認 Looks right ✓' : savingChoice ? '正在儲存…' : '看起來正確 Looks right'} disabled={entry.userConfirmed || savingChoice} onPress={confirmEstimate} />
      <Pressable accessibilityRole="button" accessibilityLabel="修改這次形態" onPress={() => setPendingType(entry.analysis.bristolType)} style={({ pressed }) => [styles.changeButton, pressed && styles.changeButtonPressed]}>
        <View><Text style={styles.changeEyebrow}>NOT QUITE RIGHT?</Text><Text style={styles.changeTitle}>更改 Change</Text></View><Text style={styles.changeArrow}>↗</Text>
      </Pressable>
      {choiceError ? <Text style={styles.choiceError}>{choiceError}</Text> : null}

      {unseenMilestone ? <View style={styles.unlockCard}>
        <View><Text style={styles.unlockEyebrow}>NEW REVEAL · CHAPTER {String(unseenMilestone.order).padStart(2, '0')}</Text><Text style={styles.unlockTitle}>{unseenMilestone.title}</Text></View>
        <Text style={styles.unlockCopy}>{unseenMilestone.description}</Text>
        <PrimaryButton label={`揭曉 ${unseenMilestone.title} →`} onPress={() => router.push({ pathname: '/milestone/[id]', params: { id: unseenMilestone.id } })} />
      </View> : null}

      <View style={styles.originalPanel}>
        <View style={styles.originalHeading}><Text style={styles.originalIcon}>◉</Text><View style={styles.originalCopy}><Text style={styles.originalTitle}>原圖安全地留在作品背後</Text><Text style={uiStyles.muted}>平時不顯示；需要判斷時，可以在你面前打開給醫生查看。</Text></View></View>

        {deletionRequested ? <View style={styles.originalNotice}><Text style={styles.noticeTitle}>刪除要求已送出</Text><Text style={uiStyles.muted}>要求目前列為待處理；逐張原圖的後端刪除流程尚未啟用，因此原圖仍安全保留在 Private Storage。你也可以在 Account 永久刪除整個帳戶與全部私人檔案。</Text></View> : hasOriginal ? <>
          <PrimaryButton disabled={loadingOriginal} label={loadingOriginal ? '正在建立安全查看連結…' : showOriginal ? '隱藏原圖' : '查看原圖（敏感內容）'} inverse onPress={toggleOriginal} />
          {showOriginal && revealedOriginalUri ? <View style={styles.originalReveal}>
            <Image accessibilityLabel="本次紀錄的原始照片" source={{ uri: revealedOriginalUri }} resizeMode="contain" style={styles.originalImage} />
            <Text style={styles.sensitiveNote}>原圖只在這個畫面顯示。請留意身邊是否有其他人。</Text>
            {!confirmDelete ? <Text onPress={() => setConfirmDelete(true)} style={styles.deleteLink}>永久刪除這張原圖</Text> : <View style={styles.deleteConfirm}>
              <Text style={styles.deleteTitle}>刪除後無法復原</Text>
              <Text style={uiStyles.muted}>藝術作品與分析仍會保留，但原圖將無法再提供醫生查看。</Text>
              <PrimaryButton label={deleting ? '正在刪除…' : '確認永久刪除'} disabled={deleting} onPress={deleteOriginal} />
              <Text onPress={() => setConfirmDelete(false)} style={styles.cancelDelete}>取消</Text>
            </View>}
          </View> : null}
          {originalError ? <Text style={styles.originalError}>{originalError}</Text> : null}
        </> : originalStatus === 'demo' ? <View style={styles.originalNotice}><Text style={styles.noticeTitle}>Demo 沒有真實原圖</Text><Text style={uiStyles.muted}>示範資料不包含敏感照片；使用相機完成的正式紀錄才會出現在 Doctor Review。</Text></View>
          : originalStatus === 'deleted' ? <View style={styles.originalNotice}><Text style={styles.noticeTitle}>原圖已永久刪除</Text><Text style={uiStyles.muted}>分析資料與藝術作品仍然保留。</Text></View>
            : <View style={styles.originalWarning}><Text style={styles.noticeTitle}>原圖未能保存</Text><Text style={uiStyles.muted}>本次仍保留分析與作品；正式版會在拍攝後立即驗證保存狀態。</Text></View>}

        <View style={styles.doctorShortcut}>
          <Text style={styles.doctorEyebrow}>FOR AN APPOINTMENT</Text>
          <Text style={styles.doctorTitle}>一次查看全部原圖與日期</Text>
          <Text style={styles.doctorBody}>只需確認一次，不必逐張解鎖。離開頁面後會自動重新鎖定。</Text>
          <PrimaryButton label="OPEN DOCTOR REVIEW  →" inverse onPress={() => router.push('/doctor-review')} />
        </View>
      </View>

      <View style={styles.medicalNotice}><Text style={styles.medicalEyebrow}>NOT A MEDICAL DIAGNOSIS</Text><Text style={styles.medicalCopy}>AI 分類與趨勢可能不準確，不能取代醫師判斷。若症狀嚴重、持續、惡化或令你擔心，請尋求合格醫療專業人員協助。</Text><Text accessibilityRole="button" onPress={() => router.push('/privacy')} style={styles.medicalLink}>Privacy & medical notice →</Text></View>

      <PrimaryButton label="回到 Journal" inverse onPress={() => router.replace('/')} />
    </ScrollView>

    <Modal animationType="slide" onRequestClose={() => setPendingType(null)} transparent visible={pendingType !== null}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="關閉形態選擇" accessibilityRole="button" onPress={() => setPendingType(null)} style={StyleSheet.absoluteFill} />
        <View style={styles.formSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>FORM CHECK · 01—07</Text><Text style={styles.sheetTitle}>選一個最接近的形態</Text></View><Pressable accessibilityLabel="關閉" accessibilityRole="button" onPress={() => setPendingType(null)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View>
          <Text style={styles.sheetIntro}>不用認識 Bristol 數字。以下只使用簡化輪廓與日常描述，不顯示真實照片。</Text>
          <ScrollView contentContainerStyle={styles.optionList} showsVerticalScrollIndicator={false} style={styles.optionScroll}>
            {BRISTOL_OPTIONS.map((option) => {
              const selected = pendingType === option.type;
              return <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${option.title}，${option.description}，Bristol ${option.type}`}
                key={option.type}
                onPress={() => setPendingType(option.type)}
                style={({ pressed }) => [styles.formOption, selected && styles.formOptionSelected, pressed && styles.formOptionPressed]}
              >
                <View style={[styles.typeNumber, selected && styles.typeNumberSelected]}><Text style={[styles.typeNumberText, selected && styles.typeNumberTextSelected]}>{String(option.type).padStart(2, '0')}</Text></View>
                <FormMark type={option.type} selected={selected} />
                <View style={styles.optionCopy}><View style={styles.optionTitleRow}><Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{option.title}</Text><Text style={styles.optionGroup}>{option.group}</Text></View><Text style={styles.optionDescription}>{option.description}</Text></View>
                <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
              </Pressable>;
            })}
          </ScrollView>
          <View style={styles.sheetFooter}><Text style={styles.selectionSummary}>目前選擇 · {pendingForm.title} / Bristol {pendingForm.type}</Text><PrimaryButton disabled={savingChoice} label={savingChoice ? '正在儲存…' : `使用「${pendingForm.title}」`} onPress={saveFormCorrection} /></View>
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

function ContextMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.contextMetric}><Text style={styles.contextLabel}>{label}</Text><Text style={styles.contextValue}>{value}</Text></View>;
}

function FormMark({ type, selected }: { type: BristolType; selected: boolean }) {
  const markColor = selected ? colors.ink : colors.peach;
  if (type === 1) return <View style={styles.formMark}>{[0, 1, 2, 3].map((item) => <View key={item} style={[styles.markDot, { backgroundColor: markColor }]} />)}</View>;
  if (type === 2) return <View style={styles.formMark}>{[18, 23, 16].map((width, index) => <View key={`${width}-${index}`} style={[styles.markBlock, { backgroundColor: markColor, width }]} />)}</View>;
  if (type === 3) return <View style={styles.formMark}><View style={[styles.markLong, { backgroundColor: markColor }]} /><View style={[styles.markNotch, { backgroundColor: selected ? colors.moss : colors.ink }]} /></View>;
  if (type === 4) return <View style={styles.formMark}><View style={[styles.markSmooth, { backgroundColor: markColor }]} /></View>;
  if (type === 5) return <View style={styles.formMark}>{[0, 1, 2].map((item) => <View key={item} style={[styles.markSoft, { backgroundColor: markColor }]} />)}</View>;
  if (type === 6) return <View style={styles.formMark}>{[20, 13, 18].map((width, index) => <View key={`${width}-${index}`} style={[styles.markLoose, { backgroundColor: markColor, width }]} />)}</View>;
  return <View style={styles.formMark}><Text style={[styles.markWave, { color: markColor }]}>≈</Text></View>;
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, gap: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  artCard: { backgroundColor: colors.forest, borderRadius: radius.lg, alignItems: 'center', paddingVertical: spacing.sm, overflow: 'hidden' },
  number: { color: colors.muted, fontFamily: typography.body, fontSize: 10, letterSpacing: 1.4, marginBottom: spacing.md },
  uniqueProof: { color: colors.amber, fontFamily: typography.mono, fontSize: 8, letterSpacing: 1, marginTop: -10, marginBottom: spacing.md },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#395247', paddingVertical: spacing.md },
  metricMain: { maxWidth: '42%' },
  metricLabel: { color: colors.peach, fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  metricValue: { color: colors.cream, fontFamily: typography.display, fontSize: 17, marginTop: 6 },
  metricReference: { color: colors.muted, fontFamily: typography.mono, fontSize: 8, letterSpacing: .8, marginTop: 3 },
  confidence: { gap: 4 },
  confidenceEyebrow: { color: colors.peach, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  confidenceTitle: { color: colors.cream, fontFamily: typography.body, fontWeight: '700' },
  estimateDisclaimer: { color: colors.amber, fontFamily: typography.body, fontSize: 11, fontWeight: '800', marginTop: 4 },
  choiceError: { color: '#FFB7AD', fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  contextCard: { gap: spacing.md, padding: spacing.lg, backgroundColor: '#1A352C', borderRadius: radius.md, borderWidth: 1, borderColor: '#3B5B4E' },
  contextHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contextEyebrow: { color: colors.peach, fontFamily: typography.body, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  contextDate: { color: colors.muted, fontFamily: typography.body, fontSize: 10 },
  contextGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  contextMetric: { width: '50%' },
  contextLabel: { color: colors.muted, fontFamily: typography.body, fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  contextValue: { color: colors.cream, fontFamily: typography.display, fontSize: 17, marginTop: 4 },
  comfort: { color: colors.sage, fontFamily: typography.body, fontSize: 12 },
  contextNote: { color: colors.cream, fontFamily: typography.display, fontSize: 16, lineHeight: 23, borderTopWidth: 1, borderTopColor: '#3A574B', paddingTop: spacing.md },
  changeButton: { minHeight: 72, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: '#4B5680', backgroundColor: '#20243A', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  changeButtonPressed: { opacity: .76, transform: [{ scale: .99 }] },
  changeEyebrow: { color: colors.peach, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  changeTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 20, marginTop: 4 },
  changeArrow: { color: colors.moss, fontSize: 24, fontWeight: '900' },
  unlockCard: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: '#F0D2BC', borderWidth: 1, borderColor: colors.peach },
  unlockEyebrow: { color: '#745040', fontFamily: typography.body, fontWeight: '900', fontSize: 9, letterSpacing: 1.4 },
  unlockTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 28, marginTop: 5 },
  unlockCopy: { color: '#5D493E', fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  originalPanel: { gap: spacing.md, backgroundColor: '#213B32', borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: '#3B5A4D' },
  originalHeading: { flexDirection: 'row', gap: spacing.sm },
  originalIcon: { color: colors.moss, fontSize: 22 },
  originalCopy: { flex: 1 },
  originalTitle: { color: colors.cream, fontFamily: typography.body, fontWeight: '800', marginBottom: 3 },
  originalReveal: { gap: spacing.sm },
  originalImage: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.sm, backgroundColor: '#0A1511' },
  sensitiveNote: { color: colors.amber, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  deleteLink: { color: colors.danger, fontFamily: typography.body, fontWeight: '700', textAlign: 'center', paddingVertical: spacing.sm },
  deleteConfirm: { gap: spacing.sm, backgroundColor: '#402A24', borderRadius: radius.sm, padding: spacing.md },
  deleteTitle: { color: colors.cream, fontFamily: typography.body, fontWeight: '800' },
  cancelDelete: { color: colors.cream, fontFamily: typography.body, textAlign: 'center', paddingVertical: spacing.xs },
  originalNotice: { backgroundColor: '#172E26', borderRadius: radius.sm, padding: spacing.md, gap: 4 },
  originalWarning: { backgroundColor: '#4A3527', borderRadius: radius.sm, padding: spacing.md, gap: 4 },
  originalError: { color: '#FFB7AD', fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  noticeTitle: { color: colors.cream, fontFamily: typography.body, fontWeight: '800' },
  doctorShortcut: { gap: spacing.sm, backgroundColor: colors.moss, borderRadius: radius.md, padding: spacing.md, borderWidth: 2, borderColor: colors.cream },
  doctorEyebrow: { color: colors.ink, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  doctorTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 24, lineHeight: 25, fontWeight: '900' },
  doctorBody: { color: colors.ink, fontFamily: typography.body, fontSize: 14, lineHeight: 20, fontWeight: '900' },
  medicalNotice: { gap: 7, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#4D4A35' },
  medicalEyebrow: { color: colors.amber, fontFamily: typography.body, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  medicalCopy: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  medicalLink: { color: colors.peach, fontFamily: typography.body, fontSize: 12, fontWeight: '800', paddingTop: 2 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(5, 5, 9, .84)', justifyContent: 'flex-end' },
  formSheet: { maxHeight: '91%', backgroundColor: '#F1EEE7', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, borderWidth: 2, borderBottomWidth: 0, borderColor: colors.ink },
  sheetHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: '#B6B1A8', alignSelf: 'center', marginBottom: spacing.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  sheetEyebrow: { color: '#506EF0', fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 29, lineHeight: 31, marginTop: 4 },
  closeButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.ink, fontFamily: typography.body, fontSize: 24, lineHeight: 26 },
  sheetIntro: { color: '#615F5A', fontFamily: typography.body, fontSize: 12, lineHeight: 18, marginTop: spacing.sm, marginBottom: spacing.md, maxWidth: 330 },
  optionScroll: { flexShrink: 1 },
  optionList: { gap: spacing.sm, paddingBottom: spacing.md },
  formOption: { minHeight: 82, borderRadius: radius.md, borderWidth: 2, borderColor: '#C8C3BB', backgroundColor: '#FAF8F3', padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  formOptionSelected: { backgroundColor: colors.moss, borderColor: colors.ink },
  formOptionPressed: { transform: [{ scale: .99 }] },
  typeNumber: { width: 35, height: 35, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  typeNumberSelected: { backgroundColor: colors.ink },
  typeNumberText: { color: colors.cream, fontFamily: typography.mono, fontSize: 10, fontWeight: '900' },
  typeNumberTextSelected: { color: colors.moss },
  formMark: { width: 54, minHeight: 34, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 3 },
  markDot: { width: 9, height: 9, borderRadius: 5 },
  markBlock: { height: 10, borderRadius: 5 },
  markLong: { width: 46, height: 13, borderRadius: 7 },
  markNotch: { position: 'absolute', width: 2, height: 9, transform: [{ rotate: '-18deg' }] },
  markSmooth: { width: 49, height: 15, borderRadius: 8 },
  markSoft: { width: 14, height: 14, borderRadius: 7 },
  markLoose: { height: 8, borderRadius: 4, transform: [{ rotate: '-8deg' }] },
  markWave: { fontFamily: typography.display, fontSize: 42, lineHeight: 36, fontWeight: '900' },
  optionCopy: { flex: 1 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  optionTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  optionTitleSelected: { fontWeight: '900' },
  optionGroup: { color: '#595852', fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  optionDescription: { color: '#66635D', fontFamily: typography.body, fontSize: 10, lineHeight: 15, marginTop: 3 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#AAA59D', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.ink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
  sheetFooter: { borderTopWidth: 1, borderTopColor: '#CAC5BC', paddingTop: spacing.sm, gap: spacing.sm },
  selectionSummary: { color: '#55524D', fontFamily: typography.mono, fontSize: 9, fontWeight: '800', letterSpacing: .7, textAlign: 'center' },
});

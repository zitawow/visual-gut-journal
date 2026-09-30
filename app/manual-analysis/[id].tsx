import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { Eyebrow, PrimaryButton, uiStyles } from '../../src/components/ui';
import { correctRemoteBristolType, getRemoteJournalSnapshot } from '../../src/data/journalRepository';
import { BRISTOL_OPTIONS, getBristolOption, type BristolType } from '../../src/services/bristol';
import { useJournalStore } from '../../src/store/journal';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function ManualAnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, user } = useAuth();
  const replaceRemoteEntries = useJournalStore((state) => state.replaceRemoteEntries);
  const [selectedType, setSelectedType] = useState<BristolType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'signed_out' || status === 'unconfigured') return <Redirect href="/auth" />;
  if (status !== 'signed_in' || !user || !id) return <SafeAreaView style={uiStyles.screen} />;

  const selected = selectedType ? getBristolOption(selectedType) : null;
  const save = async () => {
    if (!selectedType || saving) return;
    setSaving(true);
    setError(null);
    try {
      await correctRemoteBristolType(id, user.id, selectedType);
      const snapshot = await getRemoteJournalSnapshot(user.id);
      replaceRemoteEntries(user.id, snapshot.entries, snapshot.pendingAnalysisCount, snapshot.analysisQueue);
      router.replace({ pathname: '/result/[id]', params: { id } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '暫時無法儲存，請稍後再試。');
    } finally {
      setSaving(false);
    }
  };

  return <SafeAreaView style={uiStyles.screen}>
    <ScrollView contentContainerStyle={[uiStyles.content, styles.content]} showsVerticalScrollIndicator={false}>
      <Eyebrow>AI FALLBACK · YOUR ENTRY IS SAFE</Eyebrow>
      <Text style={uiStyles.h1}>AI 暫時未能判斷。{`\n`}由你選擇最接近的形態。</Text>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>照片與紀錄已安全保存</Text>
        <Text style={styles.noticeBody}>Roboflow 可能逾時、暫時無法連線，或沒有回傳有效的 Type 1–7。這不會令本次紀錄失效。</Text>
      </View>
      <Text style={styles.guide}>不用認識 Bristol 數字。以下使用簡化輪廓與日常描述，不顯示真實照片。</Text>

      <View accessibilityRole="radiogroup" style={styles.options}>
        {BRISTOL_OPTIONS.map((option) => {
          const isSelected = selectedType === option.type;
          return <Pressable
            accessibilityLabel={`${option.title}，${option.description}，Bristol Type ${option.type}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            key={option.type}
            onPress={() => setSelectedType(option.type)}
            style={({ pressed }) => [styles.option, isSelected && styles.optionSelected, pressed && styles.optionPressed]}
          >
            <View style={[styles.typeBadge, isSelected && styles.typeBadgeSelected]}><Text style={[styles.typeBadgeText, isSelected && styles.typeBadgeTextSelected]}>{String(option.type).padStart(2, '0')}</Text></View>
            <AbstractForm type={option.type} selected={isSelected} />
            <View style={styles.optionCopy}>
              <View style={styles.optionHeading}><Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>{option.title}</Text><Text style={styles.optionGroup}>{option.group}</Text></View>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>
            <View style={[styles.radio, isSelected && styles.radioSelected]}>{isSelected ? <View style={styles.radioDot} /> : null}</View>
          </Pressable>;
        })}
      </View>

      {selected ? <View style={styles.selection}><Text style={styles.selectionLabel}>YOUR SELECTION</Text><Text style={styles.selectionValue}>Bristol Type {selected.type} · {selected.title}</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton disabled={!selectedType || saving} label={saving ? '正在儲存…' : '確認並儲存'} onPress={save} />
      <Text style={styles.disclaimer}>AI estimate — not a medical diagnosis. 手動選擇也不能取代醫師判斷。</Text>
    </ScrollView>
  </SafeAreaView>;
}

function AbstractForm({ type, selected }: { type: BristolType; selected: boolean }) {
  const color = selected ? colors.ink : colors.peach;
  if (type === 1) return <View style={styles.form}>{[0, 1, 2, 3].map((item) => <View key={item} style={[styles.dot, { backgroundColor: color }]} />)}</View>;
  if (type === 2) return <View style={styles.form}>{[19, 24, 17].map((width, index) => <View key={`${width}-${index}`} style={[styles.block, { width, backgroundColor: color }]} />)}</View>;
  if (type === 3) return <View style={styles.form}><View style={[styles.long, { backgroundColor: color }]} /><View style={[styles.notch, { backgroundColor: selected ? colors.moss : colors.ink }]} /></View>;
  if (type === 4) return <View style={styles.form}><View style={[styles.smooth, { backgroundColor: color }]} /></View>;
  if (type === 5) return <View style={styles.form}>{[0, 1, 2].map((item) => <View key={item} style={[styles.soft, { backgroundColor: color }]} />)}</View>;
  if (type === 6) return <View style={styles.form}>{[21, 14, 19].map((width, index) => <View key={`${width}-${index}`} style={[styles.loose, { width, backgroundColor: color }]} />)}</View>;
  return <View style={styles.form}><Text style={[styles.wave, { color }]}>≈</Text></View>;
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.lg },
  notice: { backgroundColor: '#1B3A30', borderWidth: 1, borderColor: '#416555', borderRadius: radius.md, padding: spacing.md, gap: 6 },
  noticeTitle: { color: colors.cream, fontFamily: typography.body, fontSize: 15, fontWeight: '900' },
  noticeBody: { color: colors.sage, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  guide: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  options: { gap: spacing.sm },
  option: { minHeight: 86, borderRadius: radius.md, borderWidth: 2, borderColor: '#4A4C58', backgroundColor: '#171820', padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  optionSelected: { backgroundColor: colors.moss, borderColor: colors.cream },
  optionPressed: { transform: [{ scale: .99 }] },
  typeBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  typeBadgeSelected: { backgroundColor: colors.ink },
  typeBadgeText: { color: colors.ink, fontFamily: typography.mono, fontSize: 10, fontWeight: '900' },
  typeBadgeTextSelected: { color: colors.moss },
  form: { width: 55, minHeight: 36, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 3 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  block: { height: 10, borderRadius: 5 },
  long: { width: 46, height: 13, borderRadius: 7 },
  notch: { position: 'absolute', width: 2, height: 9, transform: [{ rotate: '-18deg' }] },
  smooth: { width: 49, height: 15, borderRadius: 8 },
  soft: { width: 14, height: 14, borderRadius: 7 },
  loose: { height: 8, borderRadius: 4, transform: [{ rotate: '-8deg' }] },
  wave: { fontFamily: typography.display, fontSize: 42, lineHeight: 36, fontWeight: '900' },
  optionCopy: { flex: 1 },
  optionHeading: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  optionTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 18 },
  optionTitleSelected: { color: colors.ink },
  optionGroup: { color: colors.peach, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  optionDescription: { color: colors.muted, fontFamily: typography.body, fontSize: 10, lineHeight: 15, marginTop: 3 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#777986', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.ink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
  selection: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#4B4D59', paddingVertical: spacing.md, gap: 5 },
  selectionLabel: { color: colors.peach, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  selectionValue: { color: colors.cream, fontFamily: typography.display, fontSize: 20 },
  error: { color: '#FFB7AD', fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  disclaimer: { color: colors.muted, fontFamily: typography.body, fontSize: 11, lineHeight: 17, textAlign: 'center' },
});

import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Artwork } from '../../src/components/Artwork';
import { Eyebrow, PrimaryButton, uiStyles } from '../../src/components/ui';
import { getVisitNumbers, groupEntriesByLocalDay } from '../../src/services/journalTimeline';
import { getMilestoneEntries, getMilestoneReflection, getMilestoneStatuses, isMilestoneId, type MilestoneId } from '../../src/services/milestones';
import { useJournalStore } from '../../src/store/journal';
import { colors, radius, spacing, typography } from '../../src/theme';

const fallbackArt = { engineVersion: '1.0', seed: 88, form: 'ribbon', palette: 'amber', fluidity: .52, complexity: .68 } as const;
const pieceColors = ['#5C7CFF', '#B88CFF', '#FF9B70', '#D9FF4F', '#6EE7D8'];

type ChapterDesign = {
  gradient: readonly [string, string, string];
  heroLabel: string;
  heroNote: string;
  collectionEyebrow: string;
  collectionTitle: string;
};

const chapterDesigns: Record<MilestoneId, ChapterDesign> = {
  first_piece: {
    gradient: ['#5C7CFF', '#765CF2', '#B88CFF'],
    heroLabel: 'THE BEGINNING',
    heroNote: 'One moment. One beginning.',
    collectionEyebrow: 'ORIGIN PIECE',
    collectionTitle: 'The piece that started it all',
  },
  first_gut_mood: {
    gradient: ['#B88CFF', '#D69CFF', '#FF9B70'],
    heroLabel: 'FIRST TRIO',
    heroNote: 'Three pieces become a mood.',
    collectionEyebrow: 'THE FIRST THREE',
    collectionTitle: 'Pieces behind your first mood',
  },
  weekly_digest: {
    gradient: ['#FF9B70', '#FF7C6B', '#FF8FB3'],
    heroLabel: '7-DAY PULSE',
    heroNote: 'A week is a rhythm, not a score.',
    collectionEyebrow: 'THIS 7-DAY WINDOW',
    collectionTitle: 'Your week in pieces',
  },
  monthly_gallery: {
    gradient: ['#D9FF4F', '#ADE75D', '#6EE7D8'],
    heroLabel: 'MONTHLY DROP',
    heroNote: 'A month becomes one portrait.',
    collectionEyebrow: 'MONTH IN FORM',
    collectionTitle: 'The month behind this portrait',
  },
  digestive_personality: {
    gradient: ['#F6F3EC', '#BBD0FF', '#5C7CFF'],
    heroLabel: 'BASELINE FORMING',
    heroNote: 'Ten signals begin to feel personal.',
    collectionEyebrow: 'FIRST TEN SIGNALS',
    collectionTitle: 'Pieces behind your early baseline',
  },
  season_of_gut: {
    gradient: ['#6EE7D8', '#41C7AC', '#5C7CFF'],
    heroLabel: '90-DAY SHIFT',
    heroNote: 'Your body has seasons, too.',
    collectionEyebrow: 'SEASONAL ARCHIVE',
    collectionTitle: 'The season behind this shift',
  },
  gut_wrapped: {
    gradient: ['#FF8FB3', '#B88CFF', '#5C7CFF'],
    heroLabel: 'YEAR IN FORM',
    heroNote: 'A year becomes a world of its own.',
    collectionEyebrow: 'ANNUAL ARCHIVE',
    collectionTitle: 'Your year of Gut Creatures',
  },
};

function formatDateRange(entries: ReturnType<typeof getMilestoneEntries>) {
  if (entries.length === 0) return 'NO PIECES YET';
  const format = (value: string) => new Date(value).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
  if (entries.length === 1) return format(entries[0].createdAt).toUpperCase();
  const dayGroups = groupEntriesByLocalDay(entries);
  if (dayGroups.length === 1) return `${format(entries[0].createdAt)} · ${entries.length} VISITS`.toUpperCase();
  return `${format(entries[0].createdAt)} — ${format(entries.at(-1)!.createdAt)}`.toUpperCase();
}

export default function MilestoneRevealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entries = useJournalStore((state) => state.entries);
  const markMilestoneSeen = useJournalStore((state) => state.markMilestoneSeen);
  const reveal = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);
  const validId = isMilestoneId(id) ? id : 'first_piece';
  const milestone = getMilestoneStatuses(entries).find((item) => item.id === validId)!;
  const relevantEntries = getMilestoneEntries(validId, entries);
  const visibleEntries = expanded ? relevantEntries : relevantEntries.slice(0, 3);
  const reflection = getMilestoneReflection(validId, entries);
  const visitNumbers = useMemo(() => getVisitNumbers(entries), [entries]);
  const chapter = chapterDesigns[validId];
  const representative = relevantEntries.at(-1) ?? entries[0];

  useEffect(() => {
    setExpanded(false);
    reveal.setValue(0);
    if (isMilestoneId(id) && milestone.unlocked) markMilestoneSeen(id);
    const animation = Animated.timing(reveal, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [id, markMilestoneSeen, milestone.unlocked, reveal]);

  if (!isMilestoneId(id)) return null;

  return <SafeAreaView style={uiStyles.screen}>
    <ScrollView contentContainerStyle={[uiStyles.content, styles.content]} showsVerticalScrollIndicator={false}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/milestones')} style={styles.backBubble}><Text style={styles.back}>←</Text></Pressable>
        <Text style={styles.navTitle}>GUTVERSE™ / REVEAL {String(milestone.order).padStart(2, '0')}</Text>
        <View style={styles.navState}><Text style={styles.navStateText}>{milestone.unlocked ? 'OPEN' : 'LOCKED'}</Text></View>
      </View>

      <Animated.View style={{ opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
        <View style={styles.revealCard}>
          <LinearGradient colors={milestone.unlocked ? chapter.gradient : ['#292934', '#1B1B23', '#111117']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={[styles.chapterGhost, !milestone.unlocked && styles.chapterGhostLocked]}>{String(milestone.order).padStart(2, '0')}</Text>
          <View style={styles.heroTop}><Text style={[styles.heroEyebrow, !milestone.unlocked && styles.heroCopyLocked]}>{milestone.unlocked ? chapter.heroLabel : 'STILL COLLECTING'}</Text><Text style={[styles.chapter, !milestone.unlocked && styles.heroCopyLocked]}>CHAPTER {String(milestone.order).padStart(2, '0')}</Text></View>
          <View style={styles.artStage}><Artwork spec={representative?.artwork ?? fallbackArt} serial={representative?.collectible?.serial} size={285} /></View>
          <View style={styles.heroBottom}>
            <View style={styles.heroCopy}><Text style={[styles.milestoneName, !milestone.unlocked && styles.milestoneNameLocked]}>{milestone.title}</Text><Text style={[styles.heroNote, !milestone.unlocked && styles.heroCopyLocked]}>{milestone.unlocked ? chapter.heroNote : milestone.requirement}</Text></View>
            <View style={[styles.pieceDisc, !milestone.unlocked && styles.pieceDiscLocked]}><Text style={[styles.pieceDiscValue, !milestone.unlocked && styles.pieceDiscValueLocked]}>{relevantEntries.length}</Text><Text style={[styles.pieceDiscLabel, !milestone.unlocked && styles.pieceDiscValueLocked]}>PIECES</Text></View>
          </View>
        </View>
      </Animated.View>

      {milestone.unlocked ? <>
        <View style={styles.reflection}>
          <Eyebrow>{reflection.eyebrow}</Eyebrow>
          <Text style={styles.reflectionTitle}>{reflection.title}</Text>
          <Text style={styles.reflectionBody}>{reflection.body}</Text>
        </View>

        <View style={styles.stats}>
          {reflection.usesDayBalance ? <>
            <View style={[styles.stat, styles.statHalf, styles.statBlue]}><Text style={styles.statValue}>{reflection.count}</Text><Text style={styles.statLabel}>PIECES READ</Text></View>
            <View style={[styles.stat, styles.statHalf, styles.statLilac]}><Text style={styles.statValue}>{reflection.activeDays}</Text><Text style={styles.statLabel}>ACTIVE DAYS</Text></View>
            <View style={[styles.stat, styles.statHalf, styles.statLime]}><Text style={styles.statValue}>{reflection.averageVisitsPerActiveDay}</Text><Text style={styles.statLabel}>VISITS / ACTIVE DAY</Text></View>
            <View style={[styles.stat, styles.statHalf, styles.statCoral]}><Text style={styles.statValue}>{reflection.average}</Text><Text style={styles.statLabel}>DAILY AVG. BRISTOL</Text></View>
          </> : <>
            <View style={[styles.stat, styles.statThird, styles.statBlue]}><Text style={styles.statValue}>{reflection.count}</Text><Text style={styles.statLabel}>PIECES READ</Text></View>
            <View style={[styles.stat, styles.statThird, styles.statLilac]}><Text style={styles.statValue}>{reflection.average}</Text><Text style={styles.statLabel}>AVG. BRISTOL</Text></View>
            <View style={[styles.stat, styles.statThird, styles.statLime]}><Text style={styles.statValue}>{reflection.healthyShare}%</Text><Text style={styles.statLabel}>USUAL RANGE</Text></View>
          </>}
        </View>

        {relevantEntries.length > 0 ? <View style={styles.collection}>
          <View style={styles.collectionHeader}><View style={styles.collectionHeading}><Eyebrow>{chapter.collectionEyebrow}</Eyebrow><Text style={styles.collectionTitle}>{chapter.collectionTitle}</Text></View><Text style={styles.range}>{formatDateRange(relevantEntries)}</Text></View>
          <View style={styles.artGrid}>{visibleEntries.map((entry, index) => {
            const createdAt = new Date(entry.createdAt);
            const visitNumber = visitNumbers.get(entry.id) ?? 1;
            return <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${createdAt.toLocaleDateString('zh-TW')}第 ${visitNumber} 次紀錄，${createdAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}，Bristol Type ${entry.analysis.bristolType}`}
            key={entry.id}
            onPress={() => router.push(`/result/${entry.id}`)}
            style={({ pressed }) => [styles.miniArt, relevantEntries.length === 1 && styles.miniArtWide, { backgroundColor: pieceColors[index % pieceColors.length] }, pressed && styles.miniArtPressed]}
          >
            <View style={styles.pieceTop}><Text style={styles.pieceSerial}>#{String(index + 1).padStart(2, '0')}</Text><Text style={styles.pieceUnique}>1 / 1</Text></View>
            <Artwork spec={entry.artwork} serial={entry.collectible?.serial} size={relevantEntries.length === 1 ? 220 : 150} />
            <View style={styles.pieceMeta}><View><Text style={styles.pieceDate}>{createdAt.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}</Text><Text style={styles.pieceVisit}>V{String(visitNumber).padStart(2, '0')} · {createdAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</Text></View><View style={styles.typeBubble}><Text style={styles.typeText}>T{entry.analysis.bristolType}</Text></View></View>
          </Pressable>;
          })}</View>
          {relevantEntries.length > 3 ? <Pressable accessibilityRole="button" accessibilityLabel={expanded ? '收起作品' : `查看全部 ${relevantEntries.length} 件作品`} onPress={() => setExpanded((value) => !value)} style={({ pressed }) => [styles.viewMore, pressed && styles.viewMorePressed]}><Text style={styles.viewMoreText}>{expanded ? 'SHOW LESS ↑' : `VIEW ALL ${relevantEntries.length} PIECES ↓`}</Text></Pressable> : null}
        </View> : null}
      </> : <View style={styles.lockedCard}>
        <Text style={styles.lockedLabel}>CHAPTER IN PROGRESS</Text>
        <Text style={styles.lockedTitle}>This reveal is still taking shape.</Text>
        <Text style={styles.lockedBody}>{milestone.requirement}</Text>
        <View style={styles.track}><View style={[styles.fill, { width: `${milestone.progress * 100}%` }]} /></View>
        <View style={styles.lockedProgressRow}><Text style={styles.progressLabel}>{milestone.progressLabel}</Text><Text style={styles.keepCollecting}>KEEP COLLECTING</Text></View>
      </View>}

      <View style={styles.reflect}><Text style={styles.reflectLabel}>REFLECT / NOT COMPARE</Text><Text style={styles.reflectText}>這是由你自己的紀錄形成的觀察，不與其他人比較，也不是醫療診斷。</Text></View>
      <PrimaryButton label="CONTINUE COLLECTING  ↗" onPress={() => router.replace('/')} />
      <Text style={styles.footerWord}>{chapter.heroLabel}</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, gap: spacing.lg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBubble: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.amber, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  navTitle: { color: colors.cream, fontFamily: typography.body, fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  navState: { backgroundColor: colors.cream, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  navStateText: { color: colors.ink, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  revealCard: { minHeight: 525, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.cream, padding: spacing.lg, overflow: 'hidden' },
  chapterGhost: { position: 'absolute', right: -14, top: 70, color: 'rgba(11,11,16,.10)', fontFamily: typography.display, fontSize: 230, lineHeight: 230, fontWeight: '900', letterSpacing: -12 },
  chapterGhostLocked: { color: 'rgba(246,243,236,.035)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', zIndex: 2 },
  heroEyebrow: { color: colors.ink, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  chapter: { color: colors.ink, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  heroCopyLocked: { color: colors.muted },
  artStage: { flex: 1, minHeight: 340, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  heroBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md, zIndex: 2 },
  heroCopy: { flex: 1, gap: 4 },
  milestoneName: { color: colors.ink, fontFamily: typography.display, fontSize: 39, lineHeight: 39, fontWeight: '900', letterSpacing: -1.1 },
  milestoneNameLocked: { color: colors.cream },
  heroNote: { color: 'rgba(11,11,16,.72)', fontFamily: typography.body, fontSize: 12, fontWeight: '700' },
  pieceDisc: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.amber, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '7deg' }] },
  pieceDiscLocked: { backgroundColor: 'transparent', borderColor: '#50505C' },
  pieceDiscValue: { color: colors.ink, fontFamily: typography.display, fontSize: 29, lineHeight: 28, fontWeight: '900' },
  pieceDiscLabel: { color: colors.ink, fontFamily: typography.body, fontSize: 7, fontWeight: '900', letterSpacing: .8 },
  pieceDiscValueLocked: { color: colors.muted },
  reflection: { gap: spacing.sm, paddingTop: spacing.md },
  reflectionTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 38, lineHeight: 40, fontWeight: '900', letterSpacing: -1.1, maxWidth: 680 },
  reflectionBody: { color: colors.sage, fontFamily: typography.body, fontSize: 15, lineHeight: 23, maxWidth: 680 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { minHeight: 112, borderRadius: radius.md, borderWidth: 2, borderColor: colors.ink, padding: spacing.md, justifyContent: 'space-between' },
  statThird: { flex: 1 },
  statHalf: { width: '48.5%' },
  statBlue: { backgroundColor: colors.peach },
  statLilac: { backgroundColor: colors.lilac },
  statLime: { backgroundColor: colors.amber },
  statCoral: { backgroundColor: colors.coral },
  statValue: { color: colors.ink, fontFamily: typography.display, fontSize: 35, lineHeight: 35, fontWeight: '900' },
  statLabel: { color: colors.ink, fontFamily: typography.body, fontWeight: '900', fontSize: 8, letterSpacing: .8 },
  collection: { gap: spacing.md, marginTop: spacing.md },
  collectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.md },
  collectionHeading: { flex: 1, gap: 4 },
  collectionTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 31, lineHeight: 32, fontWeight: '900', letterSpacing: -.7 },
  range: { color: colors.amber, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: .7, paddingBottom: 4 },
  artGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  miniArt: { width: '48.5%', minHeight: 230, borderRadius: radius.md, borderWidth: 2, borderColor: colors.cream, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 10 },
  miniArtWide: { width: '100%', minHeight: 310 },
  miniArtPressed: { opacity: .84, transform: [{ scale: .985 }] },
  pieceTop: { position: 'absolute', left: 11, right: 11, top: 10, zIndex: 2, flexDirection: 'row', justifyContent: 'space-between' },
  pieceSerial: { color: colors.ink, fontFamily: typography.mono, fontSize: 8, fontWeight: '900' },
  pieceUnique: { color: colors.ink, fontFamily: typography.mono, fontSize: 8, fontWeight: '900' },
  pieceMeta: { position: 'absolute', left: 11, right: 11, bottom: 10, zIndex: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pieceDate: { color: colors.ink, fontFamily: typography.display, fontSize: 17, fontWeight: '900' },
  pieceVisit: { color: colors.ink, fontFamily: typography.mono, fontSize: 7, fontWeight: '900', marginTop: 1 },
  typeBubble: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  typeText: { color: colors.cream, fontFamily: typography.mono, fontSize: 9, fontWeight: '900' },
  viewMore: { minHeight: 52, borderRadius: radius.pill, backgroundColor: colors.cream, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', shadowColor: colors.peach, shadowOffset: { width: 4, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  viewMorePressed: { opacity: .86, transform: [{ translateX: 3 }, { translateY: 4 }] },
  viewMoreText: { color: colors.ink, fontFamily: typography.body, fontSize: 11, fontWeight: '900', letterSpacing: .8 },
  lockedCard: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.forest, borderWidth: 1.5, borderColor: '#3A3A46', gap: spacing.md },
  lockedLabel: { color: colors.peach, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  lockedTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 31, lineHeight: 32, fontWeight: '900' },
  lockedBody: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  track: { height: 10, borderRadius: 7, borderWidth: 1.5, borderColor: '#444450', overflow: 'hidden', backgroundColor: '#24242D' },
  fill: { height: 10, borderRadius: 7, backgroundColor: colors.peach, minWidth: 2 },
  lockedProgressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: colors.muted, fontFamily: typography.mono, fontSize: 8 },
  keepCollecting: { color: colors.peach, fontFamily: typography.body, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  reflect: { backgroundColor: colors.cream, borderRadius: radius.md, borderWidth: 2, borderColor: colors.ink, padding: spacing.lg, gap: 7 },
  reflectLabel: { color: colors.peach, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  reflectText: { color: colors.ink, fontFamily: typography.body, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  footerWord: { color: '#1D1D25', fontFamily: typography.display, fontSize: 72, lineHeight: 74, fontWeight: '900', letterSpacing: -3, textAlign: 'center', marginTop: spacing.sm },
});

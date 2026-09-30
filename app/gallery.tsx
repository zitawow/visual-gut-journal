import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Artwork } from '../src/components/Artwork';
import { Eyebrow, uiStyles } from '../src/components/ui';
import { getVisitNumbers, groupEntriesByLocalDay } from '../src/services/journalTimeline';
import { useJournalStore } from '../src/store/journal';
import { colors, radius, spacing, typography } from '../src/theme';

const cardColors = ['#5C7CFF', '#F6F3EC', '#B88CFF', '#FF9B70', '#D9FF4F'];

export default function GalleryScreen() {
  const entries = useJournalStore((s) => s.entries);
  const { dayGroups, visitNumbers, pieceIndexById } = useMemo(() => ({
    dayGroups: groupEntriesByLocalDay(entries),
    visitNumbers: getVisitNumbers(entries),
    pieceIndexById: new Map(entries.map((entry, index) => [entry.id, index])),
  }), [entries]);
  return <SafeAreaView style={uiStyles.screen}>
    <ScrollView contentContainerStyle={[uiStyles.content, styles.content]} showsVerticalScrollIndicator={false}>
      <View style={styles.nav}><Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.backBubble}><Text style={styles.back}>←</Text></Pressable><Text style={styles.navTitle}>GUTVERSE™ / COLLECTION</Text><Text style={styles.navCount}>{entries.length.toString().padStart(2, '0')}</Text></View>

      <View style={styles.ticker}><Text numberOfLines={1} style={styles.tickerText}>PRIVATE CREATURES · BODY-GENERATED · NEVER BORING · ONE ENTRY / ONE PIECE ·</Text></View>

      <View style={styles.hero}>
        <Eyebrow>YOUR PRIVATE COLLECTION</Eyebrow>
        <Text style={styles.mega}>MEET YOUR{`\n`}<Text style={styles.megaBlue}>GUT CREW.</Text></Text>
        <Text style={styles.lede}>一次紀錄，一隻生物。同一天的每次排便都會獨立留下；時間久了，它們會組成你的個人宇宙。</Text>
      </View>

      <View style={styles.dropCard}>
        <View><Text style={styles.dropLabel}>CURRENT DROP</Text><Text style={styles.dropTitle}>AUGUST{`\n`}CREATURES</Text></View>
        <View style={styles.countDisc}><Text style={styles.count}>{entries.length}</Text><Text style={styles.countLabel}>PIECES</Text></View>
        <Text style={styles.dropGhost}>01</Text>
      </View>

      {entries.length === 0 ? <View style={styles.empty}><Text style={styles.emptyFace}>•́ ᴖ •̀</Text><Text style={styles.emptyTitle}>NO CREATURES YET</Text><Text style={styles.emptyBody}>完成第一筆紀錄，讓你的第一隻 Gut Creature 出生。</Text></View> : <View style={styles.timeline}>{dayGroups.map((group) => <View key={group.key} style={styles.dayGroup}>
        <View style={styles.dayHeader}>
          <View><Text style={styles.dayEyebrow}>DAILY DROP</Text><Text style={styles.dayTitle}>{formatDayTitle(group.date)}</Text></View>
          <View style={styles.visitCount}><Text style={styles.visitCountValue}>{String(group.entries.length).padStart(2, '0')}</Text><Text style={styles.visitCountLabel}>{group.entries.length === 1 ? 'VISIT' : 'VISITS'}</Text></View>
        </View>
        <View style={styles.grid}>{group.entries.map((entry) => {
          const index = pieceIndexById.get(entry.id) ?? 0;
          const pieceNo = entry.collectible?.serial ?? entries.length - index;
          const visitNo = visitNumbers.get(entry.id) ?? 1;
          const wide = index % 5 === 0;
          const createdAt = new Date(entry.createdAt);
          return <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${entry.source === 'sample' ? '示範作品，' : ''}${createdAt.toLocaleDateString('zh-TW')}第 ${visitNo} 次紀錄，${createdAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}，Bristol Type ${entry.analysis.bristolType}`}
            key={entry.id}
            onPress={() => router.push(`/result/${entry.id}`)}
            style={({ pressed }) => [styles.item, wide && styles.itemWide, { backgroundColor: cardColors[index % cardColors.length] }, pressed && styles.itemPressed]}
          >
            <View style={styles.itemTop}><Text style={styles.serial}>VGJ #{pieceNo.toString().padStart(3, '0')}</Text>{entry.source === 'sample' ? <Text style={styles.sample}>SAMPLE</Text> : <Text style={styles.unique}>1 / 1</Text>}</View>
            <Text style={styles.cardGhost}>{entry.analysis.bristolType}</Text>
            <Artwork spec={entry.artwork} serial={entry.collectible?.serial} size={wide ? 230 : 154} />
            <View style={styles.itemMeta}><View><Text style={styles.creatureName}>VISIT {String(visitNo).padStart(2, '0')}</Text><Text style={styles.date}>{createdAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</Text></View><View style={styles.typeBubble}><Text style={styles.type}>T{entry.analysis.bristolType}</Text></View></View>
          </Pressable>;
        })}</View>
      </View>)}</View>}

      <View style={styles.footer}><Text style={styles.footerTop}>COLLECT → REVEAL → REFLECT</Text><Text style={styles.footerWord}>GUTVERSE</Text><Text style={styles.footerSmall}>PRIVATE BY DESIGN · WELLNESS JOURNAL ONLY</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

function formatDayTitle(date: Date) {
  const now = new Date();
  const isToday = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  const formatted = date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  return isToday ? `TODAY · ${formatted}` : formatted;
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, gap: spacing.lg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBubble: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.amber, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  navTitle: { color: colors.cream, fontFamily: typography.body, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  navCount: { color: colors.ink, backgroundColor: colors.cream, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, fontFamily: typography.mono, fontSize: 10, fontWeight: '900' },
  ticker: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#30303A', paddingVertical: 10, overflow: 'hidden' },
  tickerText: { color: colors.amber, fontFamily: typography.mono, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  hero: { gap: spacing.md, paddingTop: spacing.md },
  mega: { color: colors.cream, fontFamily: typography.display, fontSize: 60, lineHeight: 53, letterSpacing: -2.8, fontWeight: '900' },
  megaBlue: { color: colors.peach },
  lede: { color: colors.sage, fontFamily: typography.body, fontSize: 14, lineHeight: 21, maxWidth: 560 },
  dropCard: { minHeight: 210, borderRadius: radius.lg, backgroundColor: colors.lilac, borderWidth: 2, borderColor: colors.cream, overflow: 'hidden', padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropLabel: { color: colors.ink, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  dropTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 36, lineHeight: 34, fontWeight: '900', letterSpacing: -1, marginTop: 14 },
  countDisc: { width: 94, height: 94, borderRadius: 47, backgroundColor: colors.amber, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', zIndex: 2, transform: [{ rotate: '8deg' }] },
  count: { color: colors.ink, fontFamily: typography.display, fontSize: 37, lineHeight: 36, fontWeight: '900' },
  countLabel: { color: colors.ink, fontFamily: typography.body, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  dropGhost: { position: 'absolute', right: -18, bottom: -52, color: 'rgba(11,11,16,.1)', fontFamily: typography.display, fontSize: 180, lineHeight: 180, fontWeight: '900' },
  timeline: { gap: spacing.xl },
  dayGroup: { gap: spacing.md },
  dayHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: '#3A3A44' },
  dayEyebrow: { color: colors.peach, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  dayTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 27, lineHeight: 29, fontWeight: '900', marginTop: 3 },
  visitCount: { minWidth: 62, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 4 },
  visitCountValue: { color: colors.amber, fontFamily: typography.display, fontSize: 30, lineHeight: 30, fontWeight: '900' },
  visitCountLabel: { color: colors.muted, fontFamily: typography.mono, fontSize: 7, fontWeight: '900', letterSpacing: .6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: { width: '48.5%', minHeight: 245, borderRadius: radius.md, borderWidth: 2, borderColor: colors.cream, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 10 },
  itemWide: { width: '100%', minHeight: 330 },
  itemPressed: { opacity: .84, transform: [{ scale: .985 }] },
  itemTop: { position: 'absolute', zIndex: 3, left: 11, right: 11, top: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serial: { color: colors.ink, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: .5 },
  sample: { color: colors.ink, backgroundColor: colors.cream, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 4, fontFamily: typography.body, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  unique: { color: colors.ink, fontFamily: typography.mono, fontSize: 8, fontWeight: '900' },
  cardGhost: { position: 'absolute', color: 'rgba(11,11,16,.09)', fontFamily: typography.display, fontSize: 160, lineHeight: 160, fontWeight: '900' },
  itemMeta: { position: 'absolute', zIndex: 3, left: 11, right: 11, bottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  creatureName: { color: colors.ink, fontFamily: typography.body, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  date: { color: colors.ink, fontFamily: typography.display, fontSize: 17, lineHeight: 18, fontWeight: '900' },
  typeBubble: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  type: { color: colors.cream, fontFamily: typography.mono, fontSize: 10, fontWeight: '900' },
  empty: { minHeight: 250, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#4A4A57', alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyFace: { color: colors.amber, fontFamily: typography.mono, fontSize: 30 },
  emptyTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 28, fontWeight: '900' },
  emptyBody: { color: colors.muted, fontFamily: typography.body, textAlign: 'center', lineHeight: 21 },
  footer: { alignItems: 'center', borderTopWidth: 1, borderColor: '#30303A', paddingTop: spacing.xl, overflow: 'hidden' },
  footerTop: { color: colors.amber, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  footerWord: { color: '#1D1D25', fontFamily: typography.display, fontSize: 76, lineHeight: 80, fontWeight: '900', letterSpacing: -4 },
  footerSmall: { color: colors.muted, fontFamily: typography.mono, fontSize: 8, letterSpacing: 1 },
});

import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MonthlyProgressCard } from '../src/components/MonthlyProgressCard';
import { Eyebrow, uiStyles } from '../src/components/ui';
import { getMilestoneStatuses } from '../src/services/milestones';
import { useJournalStore } from '../src/store/journal';
import { colors, radius, spacing, typography } from '../src/theme';

const revealColors = ['#5C7CFF', '#B88CFF', '#FF9B70', '#D9FF4F', '#F6F3EC', '#6EE7D8', '#FF8FB3'];

export default function MilestonesScreen() {
  const entries = useJournalStore((state) => state.entries);
  const seen = useJournalStore((state) => state.seenMilestoneIds ?? []);
  const milestones = getMilestoneStatuses(entries);
  const unlockedCount = milestones.filter((milestone) => milestone.unlocked).length;

  return <SafeAreaView style={uiStyles.screen}>
    <ScrollView contentContainerStyle={[uiStyles.content, styles.content]} showsVerticalScrollIndicator={false}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.backBubble}><Text style={styles.back}>←</Text></Pressable>
        <Text style={styles.navTitle}>GUTVERSE™ / REVEALS</Text>
        <View style={styles.navCount}><Text style={styles.navCountText}>{unlockedCount}/{milestones.length}</Text></View>
      </View>

      <View style={styles.ticker}><Text numberOfLines={1} style={styles.tickerText}>NO STREAKS · NO RANKINGS · YOUR BODY / YOUR PACE · KEEP UNFOLDING ·</Text></View>

      <View style={styles.hero}>
        <Eyebrow>YOUR COLLECTION PATH · SEASON 01</Eyebrow>
        <Text style={styles.mega}>COLLECT.{`\n`}<Text style={styles.megaBlue}>REVEAL.</Text>{`\n`}REFLECT.</Text>
        <View style={styles.heroCopyRow}>
          <Text style={styles.heroCopy}>不需要連續簽到，也沒有排行榜。每一段時間，都揭曉一個更完整的你。</Text>
          <View style={styles.revealDisc}><Text style={styles.revealDiscValue}>{unlockedCount}</Text><Text style={styles.revealDiscLabel}>OPEN</Text></View>
        </View>
      </View>

      <MonthlyProgressCard entries={entries} />

      <View style={styles.pathHeader}>
        <View><Eyebrow>YOUR UNFOLDING STORY</Eyebrow><Text style={styles.pathTitle}>THE REVEALS</Text></View>
        <Text style={styles.pathCount}>07 CHAPTERS</Text>
      </View>

      <View style={styles.path}>
        {milestones.map((milestone, index) => {
          const isNew = milestone.unlocked && !seen.includes(milestone.id);
          const cardColor = milestone.unlocked ? revealColors[index] : colors.forest;
          return <Pressable
            accessibilityRole={milestone.unlocked ? 'button' : undefined}
            accessibilityLabel={`${milestone.title}, ${milestone.unlocked ? '已解鎖' : '尚未解鎖'}`}
            disabled={!milestone.unlocked}
            key={milestone.id}
            onPress={() => router.push({ pathname: '/milestone/[id]', params: { id: milestone.id } })}
            style={({ pressed }) => [styles.milestone, { backgroundColor: cardColor }, milestone.unlocked && styles.unlocked, isNew && styles.newMilestone, pressed && styles.pressed]}
          >
            <Text style={[styles.ghostNumber, milestone.unlocked ? styles.ghostUnlocked : styles.ghostLocked]}>{String(index + 1).padStart(2, '0')}</Text>

            <View style={styles.milestoneTop}>
              <View style={[styles.revealTag, milestone.unlocked ? styles.revealTagOpen : styles.revealTagLocked]}><Text style={[styles.revealTagText, !milestone.unlocked && styles.revealTagTextLocked]}>REVEAL {String(index + 1).padStart(2, '0')}</Text></View>
              {isNew ? <Text style={styles.newLabel}>NEW DROP</Text> : <Text style={[styles.statusLabel, milestone.unlocked ? styles.statusOpen : styles.statusLocked]}>{milestone.unlocked ? 'UNLOCKED ✓' : 'LOCKED'}</Text>}
            </View>

            <View style={styles.milestoneBody}>
              <Text style={[styles.timing, milestone.unlocked ? styles.copyOpen : styles.copyLocked]}>{milestone.timing}</Text>
              <Text style={[styles.milestoneTitle, milestone.unlocked ? styles.titleOpen : styles.titleLocked]}>{milestone.title}</Text>
              <Text style={[styles.description, milestone.unlocked ? styles.descriptionOpen : styles.copyLocked]}>{milestone.description}</Text>
            </View>

            <View style={styles.progressBlock}>
              <View style={[styles.progressTrack, milestone.unlocked ? styles.trackOpen : styles.trackLocked]}><View style={[styles.progressFill, milestone.unlocked ? styles.fillOpen : styles.fillLocked, { width: `${milestone.progress * 100}%` }]} /></View>
              <View style={styles.progressRow}><Text style={[styles.progressLabel, milestone.unlocked ? styles.copyOpen : styles.copyLocked]}>{milestone.progressLabel}</Text><Text style={[styles.state, milestone.unlocked ? styles.stateOpen : styles.stateLocked]}>{milestone.unlocked ? 'VIEW REVEAL ↗' : 'KEEP COLLECTING'}</Text></View>
            </View>
          </Pressable>;
        })}
      </View>

      <View style={styles.noteCard}><Text style={styles.noteLabel}>A QUIET REMINDER</Text><Text style={styles.note}>Milestones 是觀察與反思，不代表醫療結論。紀錄越完整，你的個人基線才越有意義。</Text></View>
      <Text style={styles.footerWord}>UNFOLD</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, gap: spacing.lg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBubble: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.amber, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  navTitle: { color: colors.cream, fontFamily: typography.body, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  navCount: { minWidth: 48, backgroundColor: colors.cream, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7, alignItems: 'center' },
  navCountText: { color: colors.ink, fontFamily: typography.mono, fontSize: 9, fontWeight: '900' },
  ticker: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#30303A', paddingVertical: 10, overflow: 'hidden' },
  tickerText: { color: colors.amber, fontFamily: typography.mono, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  hero: { gap: spacing.md, paddingTop: spacing.md },
  mega: { color: colors.cream, fontFamily: typography.display, fontSize: 60, lineHeight: 52, letterSpacing: -2.8, fontWeight: '900' },
  megaBlue: { color: colors.peach },
  heroCopyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroCopy: { flex: 1, color: colors.sage, fontFamily: typography.body, fontSize: 15, lineHeight: 23, maxWidth: 560 },
  revealDisc: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.coral, borderWidth: 2, borderColor: colors.cream, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '8deg' }] },
  revealDiscValue: { color: colors.ink, fontFamily: typography.display, fontSize: 30, lineHeight: 29, fontWeight: '900' },
  revealDiscLabel: { color: colors.ink, fontFamily: typography.body, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  pathHeader: { marginTop: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  pathTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 44, lineHeight: 44, fontWeight: '900', letterSpacing: -1.4, marginTop: 3 },
  pathCount: { color: colors.amber, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, paddingBottom: 6 },
  path: { gap: spacing.md },
  milestone: { minHeight: 240, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 2, borderColor: '#3A3A46', overflow: 'hidden', justifyContent: 'space-between', gap: spacing.md },
  unlocked: { borderColor: colors.cream, shadowColor: colors.peach, shadowOffset: { width: 5, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  newMilestone: { borderColor: colors.amber, shadowColor: colors.amber },
  pressed: { opacity: .86, transform: [{ translateX: 3 }, { translateY: 4 }] },
  ghostNumber: { position: 'absolute', right: -10, bottom: -42, fontFamily: typography.display, fontSize: 174, lineHeight: 174, fontWeight: '900' },
  ghostUnlocked: { color: 'rgba(11,11,16,.09)' },
  ghostLocked: { color: 'rgba(246,243,236,.035)' },
  milestoneTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 },
  revealTag: { borderRadius: radius.pill, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 6 },
  revealTagOpen: { backgroundColor: colors.ink, borderColor: colors.ink },
  revealTagLocked: { backgroundColor: 'transparent', borderColor: '#555563' },
  revealTagText: { color: colors.cream, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  revealTagTextLocked: { color: colors.muted },
  newLabel: { color: colors.ink, backgroundColor: colors.amber, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.ink, paddingHorizontal: 9, paddingVertical: 5, fontFamily: typography.body, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  statusLabel: { fontFamily: typography.body, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  statusOpen: { color: colors.ink },
  statusLocked: { color: colors.muted },
  milestoneBody: { gap: 5, zIndex: 2 },
  timing: { fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  milestoneTitle: { fontFamily: typography.display, fontSize: 31, lineHeight: 32, fontWeight: '900', letterSpacing: -.6, maxWidth: '86%' },
  titleOpen: { color: colors.ink },
  titleLocked: { color: colors.cream },
  description: { fontFamily: typography.body, fontSize: 12, lineHeight: 18, maxWidth: '76%' },
  descriptionOpen: { color: 'rgba(11,11,16,.72)', fontWeight: '700' },
  copyOpen: { color: colors.ink },
  copyLocked: { color: colors.muted },
  progressBlock: { gap: 8, zIndex: 2 },
  progressTrack: { height: 10, borderRadius: 8, borderWidth: 1.5, overflow: 'hidden' },
  trackOpen: { borderColor: colors.ink, backgroundColor: 'rgba(11,11,16,.14)' },
  trackLocked: { borderColor: '#41414D', backgroundColor: '#23232C' },
  progressFill: { height: 10, minWidth: 2 },
  fillOpen: { backgroundColor: colors.amber },
  fillLocked: { backgroundColor: colors.peach },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { flex: 1, fontFamily: typography.mono, fontSize: 8 },
  state: { fontFamily: typography.body, fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  stateOpen: { color: colors.ink },
  stateLocked: { color: colors.peach },
  noteCard: { backgroundColor: colors.cream, borderRadius: radius.md, borderWidth: 2, borderColor: colors.ink, padding: spacing.lg, gap: spacing.sm },
  noteLabel: { color: colors.peach, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  note: { color: colors.ink, fontFamily: typography.body, fontSize: 12, lineHeight: 19, fontWeight: '700' },
  footerWord: { color: '#1D1D25', fontFamily: typography.display, fontSize: 80, lineHeight: 82, fontWeight: '900', letterSpacing: -4, textAlign: 'center', marginTop: spacing.sm },
});

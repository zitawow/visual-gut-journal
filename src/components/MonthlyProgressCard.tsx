import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { JournalEntry } from '../types';
import { getCurrentMonthProgress, getMilestoneStatuses } from '../services/milestones';
import { colors, radius, spacing, typography } from '../theme';

export function MonthlyProgressCard({ entries, onPress }: { entries: JournalEntry[]; onPress?: () => void }) {
  const monthly = getCurrentMonthProgress(entries);
  const nextMilestone = getMilestoneStatuses(entries).find((milestone) => !milestone.unlocked);

  return <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`收藏進度，${monthly.count} of ${monthly.target} pieces`} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}>
    <LinearGradient colors={[colors.peach, '#816BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <View style={styles.orbitOne} /><View style={styles.orbitTwo} />
    <View style={styles.top}><Text style={styles.eyebrow}>MONTHLY DROP · {monthly.month.toUpperCase()}</Text><View style={styles.arrowBubble}><Text style={styles.arrow}>↗</Text></View></View>
    <Text style={styles.title}>UNLOCK YOUR{`\n`}GUT MOOD</Text>
    <Text style={styles.count}><Text style={styles.countStrong}>{monthly.count}</Text> / {monthly.target} pieces collected</Text>
    <View style={styles.track}><View style={[styles.fill, { width: `${monthly.progress * 100}%` }]} /></View>
    <Text style={styles.reveal}>{monthly.ready ? `Your ${monthly.month} Gut Personality is ready.` : `Collect ${monthly.remaining} more to reveal your ${monthly.month} Gut Personality.`}</Text>
    {nextMilestone ? <Text style={styles.next}>Next milestone · {nextMilestone.title}</Text> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { minHeight: 252, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.ink, padding: spacing.lg, overflow: 'hidden', justifyContent: 'space-between', shadowColor: colors.amber, shadowOffset: { width: 6, height: 7 }, shadowOpacity: 1, shadowRadius: 0, elevation: 5 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  orbitOne: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 2, borderColor: 'rgba(11,11,16,.18)', right: -62, top: -68 },
  orbitTwo: { position: 'absolute', width: 118, height: 118, borderRadius: 59, backgroundColor: 'rgba(246,243,236,.13)', right: 18, top: 36 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: colors.cream, fontFamily: typography.body, fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
  arrowBubble: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.amber, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  arrow: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  title: { color: colors.cream, fontFamily: typography.display, fontSize: 34, lineHeight: 32, letterSpacing: -1.2, fontWeight: '900', maxWidth: 280 },
  count: { color: colors.cream, fontFamily: typography.body, fontSize: 12, fontWeight: '700' },
  countStrong: { color: colors.amber, fontFamily: typography.display, fontSize: 25, fontWeight: '900' },
  track: { height: 10, borderRadius: 7, overflow: 'hidden', borderWidth: 2, borderColor: colors.ink, backgroundColor: 'rgba(255,255,255,.24)' },
  fill: { height: 10, borderRadius: 7, backgroundColor: colors.amber, minWidth: 3 },
  reveal: { color: colors.ink, fontFamily: typography.body, fontSize: 13, lineHeight: 19, fontWeight: '700', maxWidth: 290 },
  next: { color: 'rgba(11,11,16,.68)', fontFamily: typography.body, fontSize: 10, letterSpacing: .5, fontWeight: '700' },
});

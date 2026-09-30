import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

export function PrimaryButton({ label, onPress, inverse = false, disabled = false }: { label: string; onPress: () => void; inverse?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, inverse && styles.buttonInverse, disabled && styles.disabled, pressed && styles.pressed]}>
    <Text style={[styles.buttonText, inverse && styles.buttonTextInverse]}>{label}</Text>
  </Pressable>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Pill({ children, tone = 'sage' }: { children: ReactNode; tone?: 'sage' | 'amber' | 'peach' }) {
  const backgroundColor = tone === 'amber' ? colors.amber : tone === 'peach' ? colors.coral : colors.cream;
  return <View style={[styles.pill, { backgroundColor }]}><Text style={styles.pillText}>{children}</Text></View>;
}

export const uiStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.cream, fontFamily: typography.display, fontSize: 50, lineHeight: 51, letterSpacing: -1.8, fontWeight: '900' },
  h1: { color: colors.cream, fontFamily: typography.display, fontSize: 38, lineHeight: 39, letterSpacing: -1.1, fontWeight: '900' },
  h2: { color: colors.cream, fontFamily: typography.display, fontSize: 28, lineHeight: 30, fontWeight: '900' },
  body: { color: colors.sage, fontFamily: typography.body, fontSize: 16, lineHeight: 24 },
  muted: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 18 },
  card: { backgroundColor: colors.forest, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: '#343440' },
});

const styles = StyleSheet.create({
  button: { minHeight: 58, backgroundColor: colors.amber, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, shadowColor: colors.peach, shadowOffset: { width: 4, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  buttonInverse: { backgroundColor: colors.cream },
  buttonText: { color: colors.ink, fontFamily: typography.body, fontSize: 15, fontWeight: '900', letterSpacing: .2 },
  buttonTextInverse: { color: colors.ink },
  pressed: { opacity: 0.86, transform: [{ translateX: 3 }, { translateY: 4 }] },
  disabled: { opacity: 0.4 },
  eyebrow: { color: colors.peach, fontFamily: typography.body, fontSize: 10, fontWeight: '900', letterSpacing: 2.2, textTransform: 'uppercase' },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.ink, paddingHorizontal: 12, paddingVertical: 7 },
  pillText: { color: colors.ink, fontFamily: typography.body, fontSize: 11, fontWeight: '900' },
});

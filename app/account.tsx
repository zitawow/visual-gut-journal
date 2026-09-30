import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider';
import { Eyebrow, PrimaryButton, uiStyles } from '../src/components/ui';
import { colors, radius, spacing, typography } from '../src/theme';
import { useJournalStore } from '../src/store/journal';

export default function AccountScreen() {
  const { status, user, signOut, deleteAccount } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleting, setDeleting] = useState(false);
  const remoteSyncStatus = useJournalStore((state) => state.remoteSyncStatus);
  const remoteSyncError = useJournalStore((state) => state.remoteSyncError);
  const remotePendingAnalysisCount = useJournalStore((state) => state.remotePendingAnalysisCount);

  useEffect(() => {
    if (status === 'signed_out' || status === 'unconfigured') router.replace('/auth');
  }, [status]);

  const handleSignOut = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await signOut();
      router.replace('/');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '登出暫時未完成，請再試一次。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deletePhrase.trim().toUpperCase() !== 'DELETE') {
      setError('請輸入 DELETE 確認永久刪除帳戶。');
      return;
    }
    if (!deletePassword) {
      setError('請再次輸入密碼確認身份。');
      return;
    }
    try {
      setDeleting(true);
      setError(null);
      await deleteAccount(deletePassword);
      router.replace('/auth');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '帳戶暫時未能刪除，你的資料仍然保留。');
    } finally {
      setDeleting(false);
    }
  };

  if (status !== 'signed_in' || !user) {
    return <SafeAreaView style={[uiStyles.screen, styles.center]}><ActivityIndicator color={colors.amber} size="large" /></SafeAreaView>;
  }

  const displayName = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null;

  return <SafeAreaView style={uiStyles.screen}>
    <ScrollView contentContainerStyle={[uiStyles.content, styles.content]} showsVerticalScrollIndicator={false}>
      <View style={styles.topline}>
        <View style={styles.brand}><View style={styles.brandMark}><Text style={styles.brandFace}>•ᴗ•</Text></View><Text style={styles.brandName}>GUTVERSE™</Text></View>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/')}><Text style={styles.backLink}>MY COLLECTION ↗</Text></Pressable>
      </View>

      <View style={styles.heading}>
        <Eyebrow>YOUR PRIVATE ACCOUNT</Eyebrow>
        <Text style={styles.title}>HEY,{`\n`}{displayName?.toUpperCase() || 'COLLECTOR'}.</Text>
        <Text style={styles.subtitle}>你的 Journal、Gallery 與原圖都只屬於這個帳戶。你可以在不同裝置登入，繼續同一段身體故事。</Text>
      </View>

      <View style={styles.identityCard}>
        <View><Text style={styles.cardLabel}>SIGNED IN AS</Text><Text style={styles.email}>{user.email}</Text></View>
        <View style={styles.statusPill}><View style={styles.statusDot} /><Text style={styles.statusText}>SESSION ACTIVE</Text></View>
      </View>

      <View style={styles.nextCard}>
        <Text style={styles.nextCode}>PRIVATE COLLECTION / {remoteSyncStatus.toUpperCase()}</Text>
        <Text style={styles.nextTitle}>{remoteSyncStatus === 'error' ? '你的收藏暫時無法同步' : '你的私人收藏已連線'}</Text>
        <Text style={styles.nextBody}>{remoteSyncStatus === 'error' ? remoteSyncError : remotePendingAnalysisCount > 0 ? `${remotePendingAnalysisCount} 筆新紀錄正在等待分析；完成後會自動出現在你的 Gallery。` : '所有已完成的作品與紀錄都已同步。'}</Text>
      </View>

      {error ? <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
      <PrimaryButton label="OPEN MY COLLECTION  ↗" onPress={() => router.replace('/')} />
      <Pressable accessibilityRole="button" onPress={() => router.push('/privacy')}><Text style={styles.privacyLink}>PRIVACY & CONSENT →</Text></Pressable>
      <PrimaryButton inverse disabled={submitting} label={submitting ? 'SIGNING OUT…' : 'SIGN OUT'} onPress={handleSignOut} />

      <View style={styles.dangerCard}>
        <Text style={styles.dangerCode}>DANGER ZONE / PERMANENT</Text>
        <Text style={styles.dangerTitle}>刪除帳戶與全部私人資料</Text>
        <Text style={styles.dangerBody}>這會永久移除帳戶、Journal、分析、修正、作品，以及 Private Storage 內屬於你的檔案。完成後無法復原。</Text>
        {!showDeleteAccount ? <Pressable accessibilityRole="button" onPress={() => setShowDeleteAccount(true)}><Text style={styles.deleteLink}>我想永久刪除帳戶 →</Text></Pressable> : <View style={styles.deleteForm}>
          <Text style={styles.inputLabel}>再次輸入密碼</Text>
          <TextInput accessibilityLabel="再次輸入密碼" autoCapitalize="none" autoComplete="current-password" onChangeText={setDeletePassword} placeholder="••••••••" placeholderTextColor="#7A6965" secureTextEntry selectionColor={colors.danger} style={styles.input} value={deletePassword} />
          <Text style={styles.inputLabel}>輸入 DELETE 確認</Text>
          <TextInput accessibilityLabel="輸入 DELETE 確認" autoCapitalize="characters" onChangeText={setDeletePhrase} placeholder="DELETE" placeholderTextColor="#7A6965" selectionColor={colors.danger} style={styles.input} value={deletePhrase} />
          <Pressable accessibilityRole="button" disabled={deleting} onPress={handleDeleteAccount} style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}><Text style={styles.deleteButtonText}>{deleting ? '正在安全刪除…' : '永久刪除帳戶'}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={deleting} onPress={() => { setShowDeleteAccount(false); setDeletePassword(''); setDeletePhrase(''); setError(null); }}><Text style={styles.cancelDelete}>取消</Text></Pressable>
        </View>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, paddingTop: spacing.md, gap: spacing.xl },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.amber, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] },
  brandFace: { color: colors.ink, fontFamily: typography.mono, fontSize: 11, fontWeight: '900' },
  brandName: { color: colors.cream, fontFamily: typography.body, fontSize: 13, fontWeight: '900' },
  backLink: { color: colors.amber, fontFamily: typography.body, fontSize: 10, fontWeight: '900', letterSpacing: .8, paddingVertical: 10 },
  heading: { gap: spacing.md, paddingTop: spacing.lg },
  title: { color: colors.cream, fontFamily: typography.display, fontSize: 62, lineHeight: 55, fontWeight: '900', letterSpacing: -2.6 },
  subtitle: { maxWidth: 620, color: colors.sage, fontFamily: typography.body, fontSize: 15, lineHeight: 22 },
  identityCard: { gap: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.peach, borderWidth: 2, borderColor: colors.cream },
  cardLabel: { color: colors.ink, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginBottom: 5 },
  email: { color: colors.ink, fontFamily: typography.display, fontSize: 28, lineHeight: 30, fontWeight: '900' },
  statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.ink },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber },
  statusText: { color: colors.cream, fontFamily: typography.mono, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  nextCard: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.forest, borderWidth: 1, borderColor: '#343440' },
  nextCode: { color: colors.amber, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  nextTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 30, lineHeight: 32, fontWeight: '900' },
  nextBody: { maxWidth: 620, color: colors.sage, fontFamily: typography.body, fontSize: 14, lineHeight: 21 },
  privacyLink: { color: colors.peach, fontFamily: typography.body, fontSize: 12, fontWeight: '900', textAlign: 'center', paddingVertical: spacing.xs },
  errorBox: { padding: 12, borderRadius: radius.sm, backgroundColor: '#3A2025', borderWidth: 1, borderColor: colors.danger },
  errorText: { color: colors.cream, fontFamily: typography.body, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  dangerCard: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: '#301F22', borderWidth: 1, borderColor: '#6E383E' },
  dangerCode: { color: '#FF9F9F', fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  dangerTitle: { color: colors.cream, fontFamily: typography.display, fontSize: 26, lineHeight: 29, fontWeight: '900' },
  dangerBody: { color: '#D6BFC0', fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  deleteLink: { color: '#FF9F9F', fontFamily: typography.body, fontSize: 12, lineHeight: 18, fontWeight: '900', paddingVertical: spacing.xs },
  deleteForm: { gap: spacing.sm, paddingTop: spacing.xs },
  inputLabel: { color: colors.cream, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  input: { minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: '#744349', backgroundColor: colors.ink, color: colors.cream, fontFamily: typography.body, fontSize: 16 },
  deleteButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.danger, marginTop: spacing.xs },
  deleteButtonDisabled: { opacity: .55 },
  deleteButtonText: { color: colors.cream, fontFamily: typography.body, fontSize: 13, fontWeight: '900' },
  cancelDelete: { color: colors.sage, fontFamily: typography.body, fontSize: 12, fontWeight: '800', textAlign: 'center', paddingVertical: spacing.xs },
});

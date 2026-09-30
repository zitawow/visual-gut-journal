import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider';
import { Eyebrow, PrimaryButton, uiStyles } from '../src/components/ui';
import { colors, radius, spacing, typography } from '../src/theme';

export default function ResetPasswordScreen() {
  const { status, updatePassword, completeRecoveryUrl } = useAuth();
  const recoveryUrl = Linking.useURL();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || !recoveryUrl || status === 'signed_in') return;
    let active = true;
    completeRecoveryUrl(recoveryUrl).catch(() => {
      if (active) setLinkError('重設連結無效或已過期。請回到登入頁重新寄送。');
    });
    return () => { active = false; };
  }, [completeRecoveryUrl, recoveryUrl, status]);

  const submit = async () => {
    setError(null);
    if (password.length < 8) {
      setError('新密碼至少需要 8 個字元。');
      return;
    }
    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致。');
      return;
    }
    try {
      setSubmitting(true);
      await updatePassword(password);
      setComplete(true);
      setPassword('');
      setConfirmPassword('');
    } catch {
      setError('重設連結可能已過期。請回到登入頁重新寄送。');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return <SafeAreaView style={[uiStyles.screen, styles.center]}><ActivityIndicator color={colors.amber} size="large" /></SafeAreaView>;
  }

  return <SafeAreaView style={uiStyles.screen}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={[uiStyles.content, styles.content]} keyboardShouldPersistTaps="handled">
        <Eyebrow>PRIVATE ACCOUNT RECOVERY</Eyebrow>
        <Text style={styles.title}>{complete ? 'PASSWORD\nUPDATED.' : 'CHOOSE A\nNEW PASSWORD.'}</Text>
        <View style={styles.card}>
          {complete ? <>
            <Text style={styles.body}>密碼已更新。你可以回到私人收藏繼續使用。</Text>
            <PrimaryButton label="OPEN MY COLLECTION  ↗" onPress={() => router.replace('/')} />
          </> : status !== 'signed_in' ? <>
            <Text style={styles.body}>{linkError ?? '正在安全開啟重設連結…'}</Text>
            {!linkError ? <ActivityIndicator color={colors.amber} /> : null}
            <PrimaryButton label="BACK TO SIGN IN" onPress={() => router.replace('/auth')} />
          </> : <>
            <Text style={styles.label}>新密碼（至少 8 個字元）</Text>
            <TextInput accessibilityLabel="新密碼" autoCapitalize="none" autoComplete="new-password" onChangeText={setPassword} placeholder="••••••••" placeholderTextColor="#6F6D77" secureTextEntry selectionColor={colors.amber} style={styles.input} value={password} />
            <Text style={styles.label}>再次輸入新密碼</Text>
            <TextInput accessibilityLabel="再次輸入新密碼" autoCapitalize="none" autoComplete="new-password" onChangeText={setConfirmPassword} onSubmitEditing={submit} placeholder="••••••••" placeholderTextColor="#6F6D77" returnKeyType="go" secureTextEntry selectionColor={colors.amber} style={styles.input} value={confirmPassword} />
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <PrimaryButton disabled={submitting} label={submitting ? 'UPDATING…' : 'UPDATE PASSWORD'} onPress={submit} />
          </>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.lg },
  title: { color: colors.cream, fontFamily: typography.display, fontSize: 54, lineHeight: 50, fontWeight: '900', letterSpacing: -2 },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.forest, borderWidth: 1, borderColor: '#343440' },
  body: { color: colors.sage, fontFamily: typography.body, fontSize: 14, lineHeight: 21 },
  label: { color: colors.peach, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  input: { minHeight: 54, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: '#464650', backgroundColor: colors.ink, color: colors.cream, fontFamily: typography.body, fontSize: 16 },
  error: { color: '#FFB7AD', fontFamily: typography.body, fontSize: 12, lineHeight: 18, fontWeight: '700' },
});

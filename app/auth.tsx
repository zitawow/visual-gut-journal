import { router } from 'expo-router';
import { type ComponentProps, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider';
import { Eyebrow, PrimaryButton, uiStyles } from '../src/components/ui';
import { hasCurrentRemoteConsent } from '../src/data/journalRepository';
import { CONSENT_VERSION, useJournalStore } from '../src/store/journal';
import { colors, radius, spacing, typography } from '../src/theme';

type AuthMode = 'sign_in' | 'sign_up';

function humanizeAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : '登入暫時未完成，請稍後再試。';
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Email 或密碼不正確。';
  if (normalized.includes('email not confirmed')) return '請先到 Email 完成確認，再回來登入。';
  if (normalized.includes('already registered')) return '這個 Email 已經註冊，請直接登入。';
  if (normalized.includes('password')) return '密碼至少需要 8 個字元。';
  return message;
}

export default function AuthScreen() {
  const { status, user, signIn, signUp, requestPasswordReset } = useAuth();
  const acceptConsent = useJournalStore((state) => state.acceptConsent);
  const withdrawConsent = useJournalStore((state) => state.withdrawConsent);
  const [mode, setMode] = useState<AuthMode>('sign_in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'signed_in' || !user) return;

    let active = true;
    hasCurrentRemoteConsent(user.id, CONSENT_VERSION)
      .then((hasConsent) => {
        if (!active) return;
        if (hasConsent) {
          acceptConsent();
          router.replace('/');
          return;
        }
        withdrawConsent();
        router.replace('/consent');
      })
      .catch(() => {
        if (!active) return;
        withdrawConsent();
        router.replace('/consent');
      });

    return () => {
      active = false;
    };
  }, [acceptConsent, status, user, withdrawConsent]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  };

  const submit = async () => {
    setError(null);
    setMessage(null);

    if (!email.trim() || !password) {
      setError('請輸入 Email 和密碼。');
      return;
    }
    if (password.length < 8) {
      setError('密碼至少需要 8 個字元。');
      return;
    }
    if (mode === 'sign_up' && !displayName.trim()) {
      setError('請輸入你想在 App 內使用的名稱。');
      return;
    }

    try {
      setSubmitting(true);
      if (mode === 'sign_in') {
        await signIn(email, password);
      } else {
        const result = await signUp({ email, password, displayName });
        if (result.needsEmailConfirmation) {
          setMessage('帳戶已建立。請打開 Email 完成確認，然後回來登入。');
          setMode('sign_in');
          setPassword('');
        }
      }
    } catch (nextError) {
      setError(humanizeAuthError(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  const sendPasswordReset = async () => {
    setError(null);
    setMessage(null);
    if (!email.trim()) {
      setError('請先輸入你的 Email。');
      return;
    }
    try {
      setSubmitting(true);
      await requestPasswordReset(email);
      setMessage('如果這個 Email 已註冊，你會收到一封重設密碼郵件。請檢查收件匣及垃圾郵件。');
    } catch {
      setMessage('如果這個 Email 已註冊，你會收到一封重設密碼郵件。請稍後檢查收件匣。');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading' || status === 'signed_in') {
    return <SafeAreaView style={[uiStyles.screen, styles.center]}><ActivityIndicator color={colors.amber} size="large" /></SafeAreaView>;
  }

  return <SafeAreaView style={uiStyles.screen}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={[uiStyles.content, styles.content]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topline}>
          <View style={styles.brand}><View style={styles.brandMark}><Text style={styles.brandFace}>•ᴗ•</Text></View><Text style={styles.brandName}>GUTVERSE™</Text></View>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')}><Text style={styles.backLink}>PUBLIC DEMO ↗</Text></Pressable>
        </View>

        <View style={styles.heading}>
          <Eyebrow>YOUR PRIVATE COLLECTION</Eyebrow>
          <Text style={styles.title}>{mode === 'sign_in' ? 'WELCOME\nBACK.' : 'START YOUR\nPRIVATE STORY.'}</Text>
          <Text style={styles.subtitle}>{mode === 'sign_in' ? '登入後，每一筆紀錄只屬於你的帳戶。' : '建立帳戶，準備把私人紀錄安全同步到不同裝置。'}</Text>
        </View>

        {status === 'unconfigured' ? <View style={styles.setupCard}>
          <Text style={styles.setupCode}>BACKEND / NOT CONNECTED</Text>
          <Text style={styles.setupTitle}>登入畫面已準備好</Text>
          <Text style={styles.setupBody}>加入 Supabase Project URL 與 Publishable key 後即可測試真實註冊和登入。公開 Demo 仍然可以正常使用。</Text>
          <View style={styles.codeBox}><Text style={styles.codeText}>EXPO_PUBLIC_SUPABASE_URL{`\n`}EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY</Text></View>
        </View> : <View style={styles.formCard}>
          <View style={styles.tabs}>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'sign_in' }} onPress={() => switchMode('sign_in')} style={[styles.tab, mode === 'sign_in' && styles.tabActive]}><Text style={[styles.tabText, mode === 'sign_in' && styles.tabTextActive]}>登入</Text></Pressable>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'sign_up' }} onPress={() => switchMode('sign_up')} style={[styles.tab, mode === 'sign_up' && styles.tabActive]}><Text style={[styles.tabText, mode === 'sign_up' && styles.tabTextActive]}>建立帳戶</Text></Pressable>
          </View>

          {mode === 'sign_up' ? <Field label="APP 內顯示名稱" value={displayName} onChangeText={setDisplayName} placeholder="例如 Zita" autoCapitalize="words" returnKeyType="next" /> : null}
          <Field label="EMAIL" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" returnKeyType="next" />
          <Field label="密碼（至少 8 個字元）" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry autoCapitalize="none" autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'} returnKeyType="go" onSubmitEditing={submit} />

          {mode === 'sign_in' ? <Pressable accessibilityRole="button" disabled={submitting} onPress={sendPasswordReset}><Text style={styles.forgotLink}>忘記密碼？寄送安全重設連結 →</Text></Pressable> : null}

          {error ? <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          {message ? <View accessibilityRole="alert" style={styles.messageBox}><Text style={styles.messageText}>{message}</Text></View> : null}

          <PrimaryButton disabled={submitting} label={submitting ? 'CONNECTING…' : mode === 'sign_in' ? 'ENTER MY COLLECTION  ↗' : 'CREATE PRIVATE ACCOUNT  ↗'} onPress={submit} />
          <Text style={styles.finePrint}>登入後只會顯示你的私人 Journal 與 Gallery；Public Demo 的示範資料不會混入你的帳戶。</Text>
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

type FieldProps = ComponentProps<typeof TextInput> & { label: string };

function Field({ label, ...props }: FieldProps) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor="#6F6D77" selectionColor={colors.amber} style={styles.input} />
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, paddingTop: spacing.md, gap: spacing.xl },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.amber, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] },
  brandFace: { color: colors.ink, fontFamily: typography.mono, fontSize: 11, fontWeight: '900' },
  brandName: { color: colors.cream, fontFamily: typography.body, fontSize: 13, fontWeight: '900' },
  backLink: { color: colors.amber, fontFamily: typography.body, fontSize: 10, fontWeight: '900', letterSpacing: .8, paddingVertical: 10 },
  heading: { gap: spacing.md, paddingTop: spacing.lg },
  title: { color: colors.cream, fontFamily: typography.display, fontSize: 58, lineHeight: 52, fontWeight: '900', letterSpacing: -2.4 },
  subtitle: { maxWidth: 560, color: colors.sage, fontFamily: typography.body, fontSize: 15, lineHeight: 22 },
  setupCard: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.peach, borderWidth: 2, borderColor: colors.cream },
  setupCode: { color: colors.ink, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  setupTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 32, lineHeight: 34, fontWeight: '900' },
  setupBody: { maxWidth: 600, color: colors.ink, fontFamily: typography.body, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  codeBox: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.ink },
  codeText: { color: colors.amber, fontFamily: typography.mono, fontSize: 10, lineHeight: 18, fontWeight: '700' },
  formCard: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.forest, borderWidth: 1, borderColor: '#343440' },
  tabs: { flexDirection: 'row', backgroundColor: colors.ink, borderRadius: radius.pill, padding: 4 },
  tab: { flex: 1, minHeight: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.cream },
  tabText: { color: colors.muted, fontFamily: typography.body, fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: colors.ink },
  field: { gap: 7 },
  label: { color: colors.peach, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  input: { minHeight: 54, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: '#464650', backgroundColor: colors.ink, color: colors.cream, fontFamily: typography.body, fontSize: 16 },
  errorBox: { padding: 12, borderRadius: radius.sm, backgroundColor: '#3A2025', borderWidth: 1, borderColor: colors.danger },
  errorText: { color: colors.cream, fontFamily: typography.body, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  messageBox: { padding: 12, borderRadius: radius.sm, backgroundColor: '#25341E', borderWidth: 1, borderColor: colors.amber },
  messageText: { color: colors.cream, fontFamily: typography.body, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  finePrint: { color: colors.muted, fontFamily: typography.body, fontSize: 10, lineHeight: 15, textAlign: 'center', paddingHorizontal: spacing.sm },
  forgotLink: { color: colors.peach, fontFamily: typography.body, fontSize: 12, lineHeight: 18, fontWeight: '800', textAlign: 'right', paddingVertical: spacing.xs },
});

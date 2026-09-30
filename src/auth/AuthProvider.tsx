import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type AuthStatus = 'unconfigured' | 'loading' | 'signed_out' | 'signed_in';

type SignUpInput = {
  email: string;
  password: string;
  displayName: string;
};

type SignUpResult = {
  needsEmailConfirmation: boolean;
};

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  reauthenticate: (password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  completeRecoveryUrl: (url: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase 尚未連接。請先加入 Project URL 與 Publishable key。');
  }
  return supabase;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'unconfigured');

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setSession(null);
        setStatus('signed_out');
        return;
      }
      setSession(data.session);
      setStatus(data.session ? 'signed_in' : 'signed_out');
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setStatus(nextSession ? 'signed_in' : 'signed_out');
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || Platform.OS === 'web') return;
    const client = supabase;

    if (AppState.currentState === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });

    return () => {
      subscription.remove();
      client.auth.stopAutoRefresh();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await requireClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async ({ email, password, displayName }: SignUpInput) => {
    const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei';
    const { data, error } = await requireClient().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim(),
          locale: 'zh-Hant',
          timezone_name: timezoneName,
        },
      },
    });
    if (error) throw error;
    return { needsEmailConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await requireClient().auth.signOut();
    if (error) throw error;
  }, []);

  const reauthenticate = useCallback(async (password: string) => {
    const email = session?.user.email;
    if (!email) throw new Error('目前帳戶沒有可用的登入電郵。');
    const { error } = await requireClient().auth.signInWithPassword({ email, password });
    if (error) throw new Error('密碼不正確，Doctor Review 仍然鎖定。');
  }, [session?.user.email]);

  const requestPasswordReset = useCallback(async (email: string) => {
    const redirectTo = Platform.OS === 'web'
      ? `${globalThis.location?.origin ?? ''}/reset-password`
      : Linking.createURL('/reset-password');
    const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await requireClient().auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const completeRecoveryUrl = useCallback(async (url: string) => {
    if (Platform.OS === 'web') return;
    const parameterText = url.includes('#') ? url.slice(url.indexOf('#') + 1) : url.split('?')[1] ?? '';
    const parameters = new URLSearchParams(parameterText);
    const accessToken = parameters.get('access_token');
    const refreshToken = parameters.get('refresh_token');
    const type = parameters.get('type');
    if (type !== 'recovery' || !accessToken || !refreshToken) {
      throw new Error('重設連結無效或已過期。');
    }
    const { error } = await requireClient().auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    const client = requireClient();
    const { error } = await client.functions.invoke('delete-account', {
      body: { password },
    });
    if (error) {
      const response = error && typeof error === 'object' && 'context' in error
        ? (error as { context?: Response }).context
        : undefined;
      let message = '帳戶暫時未能刪除。你的資料仍然保留，請稍後再試。';
      if (response) {
        try {
          const body = await response.clone().json() as { message?: string };
          if (body.message) message = body.message;
        } catch {
          // Keep the privacy-safe fallback message.
        }
      }
      throw new Error(message);
    }
    await client.auth.signOut({ scope: 'local' });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    user: session?.user ?? null,
    signIn,
    signUp,
    signOut,
    reauthenticate,
    requestPasswordReset,
    updatePassword,
    completeRecoveryUrl,
    deleteAccount,
  }), [completeRecoveryUrl, deleteAccount, reauthenticate, requestPasswordReset, session, signIn, signOut, signUp, status, updatePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

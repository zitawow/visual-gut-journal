import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth/AuthProvider';
import { JournalDataBridge } from '../src/auth/JournalDataBridge';
import { colors } from '../src/theme';

export default function RootLayout() {
  return <SafeAreaProvider>
    <AuthProvider>
      <JournalDataBridge />
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink }, animation: 'fade_from_bottom' }} />
    </AuthProvider>
  </SafeAreaProvider>;
}

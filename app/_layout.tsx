import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../lib/auth';
import { registerForPushNotifications } from '../lib/push';
import { Analytics } from '@vercel/analytics/react';

function RootNavigation() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/groups');
    }
  }, [session, loading, segments]);

  useEffect(() => {
    if (session) registerForPushNotifications(session.user.id);
  }, [session]);

  if (loading) return null;
  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootNavigation />
        <StatusBar style="auto" />
        {Platform.OS === 'web' && <Analytics />}
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

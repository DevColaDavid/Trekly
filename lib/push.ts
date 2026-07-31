import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Push doesn't work in a plain web build, and getExpoPushTokenAsync needs an
// EAS project id (none configured yet — run `eas init` to add one). Until
// then this just no-ops instead of throwing, so it's safe to call eagerly.
export async function registerForPushNotifications(userId: string) {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;
  if (status !== 'granted') {
    const { status: requested } = await Notifications.requestPermissionsAsync();
    status = requested;
  }
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('[push] no EAS project id configured — run `eas init` to enable push notifications');
    return;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').upsert({ user_id: userId, token }, { onConflict: 'user_id,token' });
  } catch (err) {
    console.warn('[push] failed to register push token', err);
  }
}

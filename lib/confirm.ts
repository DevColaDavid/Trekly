import { Alert, Platform } from 'react-native';

// Alert.alert doesn't render anything on web (react-native-web has no
// implementation), so a confirm dialog wrapped in it silently never fires.
// window.confirm is the web-native equivalent.
export function confirmAction(title: string, message: string | undefined, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message ? `${title}\n\n${message}` : title)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

export function confirmDelete(title: string, message: string | undefined, onConfirm: () => void) {
  confirmAction(title, message, 'Delete', onConfirm);
}

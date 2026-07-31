import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Provider } from '@supabase/supabase-js';
import { useAuth } from '../lib/auth';
import { colors, spacing } from '../lib/theme';
import Button from './ui/Button';

export default function OAuthButtons({ onError }: { onError: (message: string) => void }) {
  const { signInWithProvider } = useAuth();
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);

  const handlePress = async (provider: Provider) => {
    setBusyProvider(provider);
    const err = await signInWithProvider(provider);
    setBusyProvider(null);
    if (err) onError(err);
  };

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>
      <Button
        label="Continue with Google"
        variant="secondary"
        onPress={() => handlePress('google')}
        loading={busyProvider === 'google'}
        disabled={busyProvider !== null && busyProvider !== 'google'}
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xs },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
});

import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { colors, spacing } from '../../lib/theme';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import OAuthButtons from '../../components/OAuthButtons';

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    const err = await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Trekly</Text>
      <Text style={styles.eyebrow}>Welcome back</Text>
      <Text style={styles.title}>Sign in</Text>
      <View style={styles.form}>
        <Input
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button label="Sign in" onPress={onSubmit} loading={busy} fullWidth />
        <OAuthButtons onError={setError} />
      </View>
      <Link href="/sign-up" style={styles.link}>
        No account? Sign up
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  brand: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4, marginBottom: spacing.lg },
  eyebrow: { fontSize: 13, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  link: { color: colors.primary, textAlign: 'center', marginTop: spacing.xl, fontWeight: '600' },
});

import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { colors, spacing } from '../../lib/theme';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import OAuthButtons from '../../components/OAuthButtons';

export default function SignUp() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    const err = await signUp(email.trim(), password, displayName.trim());
    setBusy(false);
    if (err) setError(err);
    else setDone(true);
  };

  if (done) {
    return (
      <View style={styles.container}>
        <Text style={styles.brand}>Trekly</Text>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>Confirm your address, then sign in.</Text>
        <Link href="/sign-in" style={styles.link}>
          Back to sign in
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Trekly</Text>
      <Text style={styles.eyebrow}>Get started</Text>
      <Text style={styles.title}>Create account</Text>
      <View style={styles.form}>
        <Input placeholder="Display name" value={displayName} onChangeText={setDisplayName} />
        <Input
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button label="Sign up" onPress={onSubmit} loading={busy} fullWidth />
        <OAuthButtons onError={setError} />
      </View>
      <Link href="/sign-in" style={styles.link}>
        Already have an account? Sign in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  brand: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4, marginBottom: spacing.lg },
  eyebrow: { fontSize: 13, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: spacing.xl },
  body: { fontSize: 15, color: colors.textMuted, marginTop: 4 },
  form: { gap: spacing.md },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  link: { color: colors.primary, textAlign: 'center', marginTop: spacing.xl, fontWeight: '600' },
});

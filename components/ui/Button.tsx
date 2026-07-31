import { Pressable, Text, ActivityIndicator, StyleSheet, type PressableProps } from 'react-native';
import { colors, radius, spacing } from '../../lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = PressableProps & {
  label: string;
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
};

export default function Button({ label, variant = 'primary', fullWidth, loading, style, disabled, ...rest }: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? '#fff' : colors.primary} />
      ) : (
        <Text style={[styles.label, variantTextStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  label: { fontSize: 15, fontWeight: '700' },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceAlt },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.dangerSoft },
});

const variantTextStyles = StyleSheet.create({
  primary: { color: '#fff' },
  secondary: { color: colors.text },
  ghost: { color: colors.primary },
  danger: { color: colors.danger },
});

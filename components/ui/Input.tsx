import { TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from '../../lib/theme';

export default function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.textFaint} {...props} style={[styles.input, props.style]} />;
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
});

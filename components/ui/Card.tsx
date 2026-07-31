import { View, StyleSheet, type ViewProps } from 'react-native';
import { colors, radius, shadow, spacing } from '../../lib/theme';

export default function Card(props: ViewProps) {
  return <View {...props} style={[styles.card, props.style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
});

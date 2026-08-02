import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import DatePickerGrid from './DatePickerGrid';
import { colors, radius, shadow, spacing } from '../lib/theme';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
};

export default function DatePickerField({ value, onChange, label = 'Date' }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>
          {isNaN(value.getTime())
            ? 'Select date'
            : value.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
        <Text style={styles.triggerIcon}>📅</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.popover} onPress={(e) => e.stopPropagation()}>
            <DatePickerGrid
              value={value}
              onChange={(d) => {
                onChange(d);
                setOpen(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  triggerText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  triggerIcon: { fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,16,36,0.35)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  popover: { borderRadius: radius.lg, ...shadow.popover },
});

import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import TimePickerGrid from './TimePickerGrid';
import { colors, radius, shadow, spacing } from '../lib/theme';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
};

export default function TimePickerField({ value, onChange, label = 'Time' }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>
          {isNaN(value.getTime()) ? 'Select time' : value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </Text>
        <Text style={styles.triggerIcon}>🕐</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.popover} onPress={(e) => e.stopPropagation()}>
            <View style={styles.popoverInner}>
              <TimePickerGrid value={value} onChange={onChange} />
              <Pressable style={styles.doneButton} onPress={() => setOpen(false)}>
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </View>
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
  popoverInner: { borderRadius: radius.lg, overflow: 'hidden' },
  doneButton: { backgroundColor: '#22232E', paddingVertical: 12, alignItems: 'center' },
  doneButtonText: { color: 'white', fontWeight: '700', fontSize: 14 },
});

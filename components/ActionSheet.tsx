import { Modal, Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, shadow, spacing } from '../lib/theme';

type Action = { label: string; onPress: () => void; destructive?: boolean };

type Props = {
  visible: boolean;
  onClose: () => void;
  actions: Action[];
};

export default function ActionSheet({ visible, onClose, actions }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {actions.map((a, i) => (
            <Pressable
              key={i}
              style={[styles.row, i < actions.length - 1 && styles.rowBorder]}
              onPress={() => {
                onClose();
                a.onPress();
              }}
            >
              <Text style={[styles.rowText, a.destructive && styles.rowTextDestructive]}>{a.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.cancelRow} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,16,36,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
    ...shadow.popover,
  },
  row: { paddingVertical: 16, alignItems: 'center' },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowTextDestructive: { color: colors.danger },
  cancelRow: { paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
  cancelText: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
});

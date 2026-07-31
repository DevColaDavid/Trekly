import { Modal, Pressable, View, Text, StyleSheet, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { colors, radius, shadow, spacing } from '../lib/theme';
import DatePickerField from './DatePickerField';
import TimePickerField from './TimePickerField';
import Button from './ui/Button';
import Input from './ui/Input';

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

type Props = {
  visible: boolean;
  isEditing: boolean;
  title: string;
  onTitleChange: (v: string) => void;
  location: string;
  onLocationChange: (v: string) => void;
  date: Date;
  onDateChange: (d: Date) => void;
  time: Date;
  onTimeChange: (d: Date) => void;
  allDay: boolean;
  onAllDayChange: (v: boolean) => void;
  endTime: Date;
  onEndTimeChange: (d: Date) => void;
  recurrence: Recurrence;
  onRecurrenceChange: (r: Recurrence) => void;
  recurrenceCount: string;
  onRecurrenceCountChange: (v: string) => void;
  error: string | null;
  saving: boolean;
  accentColor: string;
  onSave: () => void;
  onClose: () => void;
  onDelete?: () => void;
};

export default function EventFormModal({
  visible,
  isEditing,
  title,
  onTitleChange,
  location,
  onLocationChange,
  date,
  onDateChange,
  time,
  onTimeChange,
  allDay,
  onAllDayChange,
  endTime,
  onEndTimeChange,
  recurrence,
  onRecurrenceChange,
  recurrenceCount,
  onRecurrenceCountChange,
  error,
  saving,
  accentColor,
  onSave,
  onClose,
  onDelete,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdropTouchable} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.heading}>{isEditing ? 'Edit event' : 'New event'}</Text>

          <Text style={styles.fieldLabel}>Title</Text>
          <Input placeholder="Event title" value={title} onChangeText={onTitleChange} autoFocus />

          <Text style={styles.fieldLabel}>Location</Text>
          <Input placeholder="Address or place name (optional)" value={location} onChangeText={onLocationChange} />

          <View style={styles.allDayRow}>
            <Text style={styles.fieldLabel}>All day</Text>
            <Switch value={allDay} onValueChange={onAllDayChange} trackColor={{ true: accentColor }} />
          </View>

          <View style={styles.dateTimeRow}>
            <View style={styles.flex1}>
              <DatePickerField value={date} onChange={onDateChange} />
            </View>
            {!allDay && (
              <View style={styles.flex1}>
                <TimePickerField label="Start" value={time} onChange={onTimeChange} />
              </View>
            )}
          </View>

          {!allDay && (
            <View style={styles.dateTimeRow}>
              <View style={styles.flex1}>
                <TimePickerField label="End" value={endTime} onChange={onEndTimeChange} />
              </View>
            </View>
          )}

          {!isEditing && (
            <>
              <Text style={styles.fieldLabel}>Repeats</Text>
              <View style={styles.recurrenceRow}>
                {RECURRENCE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.recurrenceButton, recurrence === opt.value && { backgroundColor: accentColor }]}
                    onPress={() => onRecurrenceChange(opt.value)}
                  >
                    <Text style={[styles.recurrenceButtonText, recurrence === opt.value && styles.recurrenceButtonTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {recurrence !== 'none' && (
                <>
                  <Text style={styles.fieldLabel}>Number of occurrences</Text>
                  <Input value={recurrenceCount} onChangeText={onRecurrenceCountChange} keyboardType="number-pad" />
                </>
              )}
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          {isEditing && onDelete && (
            <Button label="Delete event" variant="danger" onPress={onDelete} disabled={saving} fullWidth />
          )}

          <View style={styles.buttonRow}>
            <Button label="Cancel" variant="secondary" style={styles.flex1} onPress={onClose} disabled={saving} />
            <Button
              label={isEditing ? 'Save changes' : 'Create event'}
              style={[styles.flex1, { backgroundColor: accentColor }]}
              onPress={onSave}
              loading={saving}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,16,36,0.4)', justifyContent: 'flex-end' },
  backdropTouchable: { ...StyleSheet.absoluteFill },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    ...shadow.popover,
  },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.xs },
  heading: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing.xs },
  dateTimeRow: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  allDayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  recurrenceRow: { flexDirection: 'row', gap: spacing.xs },
  recurrenceButton: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center' },
  recurrenceButtonText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  recurrenceButtonTextActive: { color: '#fff' },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});

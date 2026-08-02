import { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { getMonthGrid, isSameDay, formatDateInput, parseDateInput, WEEKDAY_LABELS, MONTH_LABELS } from '../lib/calendarMath';
import { radius, spacing } from '../lib/theme';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
};

export default function DatePickerGrid({ value, onChange }: Props) {
  const safeValue = isNaN(value.getTime()) ? new Date() : value;
  const [viewYear, setViewYear] = useState(safeValue.getFullYear());
  const [viewMonth, setViewMonth] = useState(safeValue.getMonth());
  const [typedText, setTypedText] = useState(formatDateInput(safeValue));
  const [typedError, setTypedError] = useState(false);
  const weeks = getMonthGrid(viewYear, viewMonth);
  const today = new Date();

  const commitTyped = () => {
    const parsed = parseDateInput(typedText, safeValue);
    if (!parsed) {
      setTypedError(true);
      return;
    }
    setTypedError(false);
    setViewYear(parsed.getFullYear());
    setViewMonth(parsed.getMonth());
    onChange(parsed);
  };

  useEffect(() => {
    if (isNaN(value.getTime())) {
      onChange(safeValue);
      return;
    }
    setTypedText(formatDateInput(value));
    setTypedError(false);
  }, [value]);

  const goPrev = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };
  const goNext = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {MONTH_LABELS[viewMonth]} {viewYear}
        </Text>
        <View style={styles.navRow}>
          <Pressable style={styles.navButton} onPress={goPrev} hitSlop={8}>
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>
          <Pressable style={styles.navButton} onPress={goNext} hitSlop={8}>
            <Text style={styles.navArrow}>›</Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        style={[styles.typedInput, typedError && styles.typedInputError]}
        value={typedText}
        onChangeText={(t) => { setTypedText(t); setTypedError(false); }}
        onBlur={commitTyped}
        onSubmitEditing={commitTyped}
        placeholder="MM/DD/YYYY or Aug 17"
        placeholderTextColor="#7A7C8A"
        keyboardType="numbers-and-punctuation"
      />

      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((w) => (
          <Text key={w} style={styles.weekdayLabel}>{w[0]}</Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.dayCell} />;
            const selected = isSameDay(day, value);
            const isToday = isSameDay(day, today);
            return (
              <Pressable key={di} style={styles.dayCell} onPress={() => onChange(day)}>
                <View style={[styles.dayCircle, selected && styles.dayCircleSelected]}>
                  <Text style={[styles.dayText, selected && styles.dayTextSelected, isToday && !selected && styles.dayTextToday]}>
                    {day.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#16171F', borderRadius: radius.lg, padding: spacing.md, width: 280 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, paddingHorizontal: 2 },
  headerText: { color: 'white', fontSize: 15, fontWeight: '700' },
  navRow: { flexDirection: 'row', gap: 4 },
  navButton: { width: 24, height: 24, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: '#22232E' },
  navArrow: { color: 'white', fontSize: 15, fontWeight: '600' },
  typedInput: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: '#22232E',
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typedInputError: { borderColor: '#F87171' },
  weekRow: { flexDirection: 'row' },
  weekdayLabel: { flex: 1, color: '#7A7C8A', fontSize: 11, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: '82%', aspectRatio: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: 'white' },
  dayText: { color: 'white', fontSize: 13 },
  dayTextSelected: { color: '#16171F', fontWeight: '700' },
  dayTextToday: { color: '#818CF8' },
});

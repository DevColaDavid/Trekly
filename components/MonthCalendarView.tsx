import { View, Text, Pressable, StyleSheet } from 'react-native';
import { getMonthGrid, isSameDay, toDateKey, WEEKDAY_LABELS } from '../lib/calendarMath';
import { colorForString, colors, radius, shadow, spacing } from '../lib/theme';
import type { EventRow } from '../lib/types';

type Props = {
  viewYear: number;
  viewMonth: number;
  eventsByDay: Record<string, EventRow[]>;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onEventPress: (event: EventRow) => void;
};

const MAX_CHIPS_PER_DAY = 2;

export default function MonthCalendarView({ viewYear, viewMonth, eventsByDay, selectedDate, onSelectDate, onEventPress }: Props) {
  const weeks = getMonthGrid(viewYear, viewMonth);
  const today = new Date();

  return (
    <View style={styles.container}>
      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((w) => (
          <Text key={w} style={styles.weekdayLabel}>{w}</Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.dayCell} />;
            const dayEvents = eventsByDay[toDateKey(day)] ?? [];
            const selected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, today);
            return (
              <Pressable
                key={di}
                style={[styles.dayCell, selected && styles.dayCellSelected]}
                onPress={() => onSelectDate(day)}
              >
                <View style={[styles.dayNumberWrap, isToday && !selected && styles.dayNumberWrapToday]}>
                  <Text style={[styles.dayNumber, isToday && styles.dayNumberToday, selected && styles.dayNumberSelected]}>
                    {day.getDate()}
                  </Text>
                </View>
                <View style={styles.chipStack}>
                  {dayEvents.slice(0, MAX_CHIPS_PER_DAY).map((e) => {
                    const c = colorForString(e.id);
                    return (
                      <Pressable key={e.id} style={[styles.chip, { backgroundColor: c.bg }]} onPress={() => onEventPress(e)}>
                        <Text style={[styles.chipText, { color: c.text }]} numberOfLines={1}>{e.title}</Text>
                      </Pressable>
                    );
                  })}
                  {dayEvents.length > MAX_CHIPS_PER_DAY && (
                    <Text style={styles.overflowText}>+{dayEvents.length - MAX_CHIPS_PER_DAY}</Text>
                  )}
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
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  weekRow: { flexDirection: 'row' },
  weekdayLabel: { flex: 1, color: colors.textFaint, fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  dayCell: {
    flex: 1,
    minHeight: 68,
    borderRadius: radius.sm,
    padding: 3,
    gap: 2,
  },
  dayCellSelected: { backgroundColor: colors.primarySoft },
  dayNumberWrap: { width: 20, height: 20, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dayNumberWrapToday: { backgroundColor: colors.primary },
  dayNumber: { fontSize: 12, fontWeight: '700', color: colors.text },
  dayNumberToday: { color: '#fff' },
  dayNumberSelected: { color: colors.primaryText },
  chipStack: { gap: 2, marginTop: 1 },
  chip: { borderRadius: 5, paddingHorizontal: 4, paddingVertical: 2 },
  chipText: { fontSize: 10, fontWeight: '600' },
  overflowText: { fontSize: 10, color: colors.textFaint, fontWeight: '600', paddingLeft: 2 },
});

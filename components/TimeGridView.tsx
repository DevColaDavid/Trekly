import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { layoutDayEvents } from '../lib/calendarLayout';
import { toDateKey, isSameDay } from '../lib/calendarMath';
import { colorForString, colors, radius, spacing } from '../lib/theme';
import type { EventRow } from '../lib/types';

const HOUR_HEIGHT = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number) {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

type Props = {
  days: Date[];
  eventsByDay: Record<string, EventRow[]>;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onSlotPress: (date: Date) => void;
  onEventPress: (event: EventRow) => void;
};

// Rounds a raw pixel offset in the grid to the nearest 30-minute slot and
// returns the resulting Date for that day.
function slotDateFromOffset(day: Date, offsetY: number): Date {
  const rawMinutes = (offsetY / HOUR_HEIGHT) * 60;
  const rounded = Math.max(0, Math.round(rawMinutes / 30) * 30);
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  d.setMinutes(rounded);
  return d;
}

export default function TimeGridView({ days, eventsByDay, selectedDate, onSelectDate, onSlotPress, onEventPress }: Props) {
  const today = new Date();

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.gutter} />
        {days.map((day) => {
          const selected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          return (
            <Pressable key={day.toISOString()} style={styles.headerCell} onPress={() => onSelectDate(day)}>
              <Text style={styles.headerWeekday}>{day.toLocaleDateString(undefined, { weekday: 'short' })}</Text>
              <View style={[styles.headerDateWrap, selected && styles.headerDateWrapSelected, isToday && !selected && styles.headerDateWrapToday]}>
                <Text style={[styles.headerDate, (selected || isToday) && styles.headerDateActive]}>{day.getDate()}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.gridRow}>
          <View style={styles.gutter}>
            {HOURS.map((h) => (
              <View key={h} style={styles.hourLabelSlot}>
                <Text style={styles.hourLabel}>{formatHour(h)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.daysRow}>
            {days.map((day) => {
              const dayEvents = eventsByDay[toDateKey(day)] ?? [];
              const positioned = layoutDayEvents(dayEvents, new Date(day.getFullYear(), day.getMonth(), day.getDate()));
              return (
                <Pressable
                  key={day.toISOString()}
                  style={styles.dayColumn}
                  onPress={(e) => onSlotPress(slotDateFromOffset(day, e.nativeEvent.locationY))}
                >
                  {HOURS.map((h) => (
                    <View key={h} style={styles.hourLine} />
                  ))}
                  {positioned.map(({ event, column, columnCount, startMinutes, durationMinutes }) => {
                    const c = colorForString(event.id);
                    const widthPct = 100 / columnCount;
                    return (
                      <Pressable
                        key={event.id}
                        onPress={() => onEventPress(event)}
                        style={[
                          styles.eventBlock,
                          {
                            top: (startMinutes / 60) * HOUR_HEIGHT,
                            height: (durationMinutes / 60) * HOUR_HEIGHT - 2,
                            left: `${column * widthPct}%`,
                            width: `${widthPct}%`,
                            backgroundColor: c.bg,
                          },
                        ]}
                      >
                        <Text style={[styles.eventBlockTitle, { color: c.text }]} numberOfLines={2}>
                          {event.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const GUTTER_WIDTH = 44;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  gutter: { width: GUTTER_WIDTH },
  headerCell: { flex: 1, alignItems: 'center', gap: 4 },
  headerWeekday: { fontSize: 11, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase' },
  headerDateWrap: { width: 26, height: 26, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  headerDateWrapSelected: { backgroundColor: colors.primary },
  headerDateWrapToday: { backgroundColor: colors.primarySoft },
  headerDate: { fontSize: 14, fontWeight: '700', color: colors.text },
  headerDateActive: { color: '#fff' },
  scroll: { maxHeight: 480 },
  gridRow: { flexDirection: 'row' },
  hourLabelSlot: { height: HOUR_HEIGHT, alignItems: 'flex-end', paddingRight: 6 },
  hourLabel: { fontSize: 10, color: colors.textFaint, fontWeight: '600', marginTop: -6 },
  daysRow: { flex: 1, flexDirection: 'row' },
  dayColumn: { flex: 1, position: 'relative', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  hourLine: { height: HOUR_HEIGHT, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  eventBlock: { position: 'absolute', borderRadius: 4, padding: 3, overflow: 'hidden' },
  eventBlockTitle: { fontSize: 10, fontWeight: '700' },
});

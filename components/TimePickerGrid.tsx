import { View, Text, Pressable, StyleSheet } from 'react-native';
import { radius, spacing } from '../lib/theme';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
};

const MINUTE_STEP = 5;

function withTime(base: Date, hours: number, minutes: number) {
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export default function TimePickerGrid({ value, onChange }: Props) {
  const hours24 = value.getHours();
  const minutes = value.getMinutes();
  const isPM = hours24 >= 12;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  const bumpHour = (delta: number) => {
    const next = (hours24 + delta + 24) % 24;
    onChange(withTime(value, next, minutes));
  };
  const bumpMinute = (delta: number) => {
    let next = minutes + delta;
    let hourDelta = 0;
    if (next >= 60) { next -= 60; hourDelta = 1; }
    if (next < 0) { next += 60; hourDelta = -1; }
    onChange(withTime(value, (hours24 + hourDelta + 24) % 24, next));
  };
  const togglePeriod = () => {
    const next = isPM ? hours24 - 12 : hours24 + 12;
    onChange(withTime(value, (next + 24) % 24, minutes));
  };

  return (
    <View style={styles.card}>
      <Text style={styles.headerText}>Time</Text>
      <View style={styles.row}>
        <View style={styles.column}>
          <Pressable style={styles.stepButton} onPress={() => bumpHour(1)} hitSlop={8}>
            <Text style={styles.stepArrow}>▲</Text>
          </Pressable>
          <Text style={styles.value}>{String(hours12).padStart(2, '0')}</Text>
          <Pressable style={styles.stepButton} onPress={() => bumpHour(-1)} hitSlop={8}>
            <Text style={styles.stepArrow}>▼</Text>
          </Pressable>
        </View>

        <Text style={styles.colon}>:</Text>

        <View style={styles.column}>
          <Pressable style={styles.stepButton} onPress={() => bumpMinute(MINUTE_STEP)} hitSlop={8}>
            <Text style={styles.stepArrow}>▲</Text>
          </Pressable>
          <Text style={styles.value}>{String(minutes).padStart(2, '0')}</Text>
          <Pressable style={styles.stepButton} onPress={() => bumpMinute(-MINUTE_STEP)} hitSlop={8}>
            <Text style={styles.stepArrow}>▼</Text>
          </Pressable>
        </View>

        <Pressable style={styles.periodToggle} onPress={togglePeriod}>
          <Text style={[styles.periodText, !isPM && styles.periodTextActive]}>AM</Text>
          <Text style={[styles.periodText, isPM && styles.periodTextActive]}>PM</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#16171F', borderRadius: radius.lg, padding: spacing.lg, width: 260, alignItems: 'center' },
  headerText: { color: 'white', fontSize: 15, fontWeight: '700', marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  column: { alignItems: 'center', gap: 4 },
  stepButton: { width: 36, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: '#22232E' },
  stepArrow: { color: '#C7C9D9', fontSize: 12 },
  value: { color: 'white', fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'], width: 56, textAlign: 'center' },
  colon: { color: 'white', fontSize: 26, fontWeight: '800', marginTop: -12 },
  periodToggle: { marginLeft: spacing.sm, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: '#22232E' },
  periodText: { color: '#7A7C8A', fontSize: 12, fontWeight: '700', paddingVertical: 6, paddingHorizontal: 10, textAlign: 'center' },
  periodTextActive: { color: '#16171F', backgroundColor: 'white' },
});

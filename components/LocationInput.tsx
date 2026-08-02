import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius, shadow, spacing } from '../lib/theme';
import Input from './ui/Input';

type Suggestion = { id: string; label: string; lat: number; lng: number };

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSelectPlace?: (place: { label: string; lat: number; lng: number }) => void;
};

export default function LocationInput({ value, onChange, onSelectPlace }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickedRef = useRef(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (pickedRef.current) {
      pickedRef.current = false;
      return;
    }
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(value)}`,
          { headers: { Accept: 'application/json' } }
        );
        const data = await res.json();
        setSuggestions(
          (data as any[]).map((d) => ({ id: `${d.place_id}`, label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }))
        );
      } catch {
        // ponytail: silent fail on lookup, typed text still works as location
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const pick = (s: Suggestion) => {
    pickedRef.current = true;
    setSuggestions([]);
    onChange(s.label);
    onSelectPlace?.({ label: s.label, lat: s.lat, lng: s.lng });
  };

  return (
    <View>
      <Input
        placeholder="Search address or place name (optional)"
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {focused && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((item) => (
            <Pressable key={item.id} style={styles.row} onPress={() => pick(item)}>
              <Text style={styles.rowText} numberOfLines={2}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.popover,
  },
  row: { paddingVertical: 10, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { fontSize: 13, color: colors.text },
});

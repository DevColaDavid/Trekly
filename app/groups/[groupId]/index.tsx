import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, ScrollView, Linking } from 'react-native';
import { useFocusEffect, useGlobalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { useGroup } from '../../../lib/groupContext';
import { confirmDelete } from '../../../lib/confirm';
import { toDateKey, MONTH_LABELS } from '../../../lib/calendarMath';
import { startOfWeek, addDays } from '../../../lib/calendarLayout';
import { colorForString, colors, radius, spacing } from '../../../lib/theme';
import MonthCalendarView from '../../../components/MonthCalendarView';
import TimeGridView from '../../../components/TimeGridView';
import EventFormModal from '../../../components/EventFormModal';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import type { EventRow, RsvpStatus } from '../../../lib/types';

type ViewMode = 'month' | 'week' | 'day';

export default function Calendar() {
  const { groupId } = useGlobalSearchParams<{ groupId: string }>();
  const { session } = useAuth();
  const { isAdmin, accentColor } = useGroup();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvps, setRsvps] = useState<Record<string, RsvpStatus>>({});
  const [rsvpPending, setRsvpPending] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const viewYear = selectedDate.getFullYear();
  const viewMonth = selectedDate.getMonth();

  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [formDate, setFormDate] = useState(new Date());
  const [formTime, setFormTime] = useState(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session || !groupId) return;
    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .eq('group_id', groupId)
      .order('start_time', { ascending: true });
    if (eventData) setEvents(eventData as EventRow[]);

    const { data: rsvpData } = await supabase
      .from('event_rsvps')
      .select('event_id, status')
      .eq('user_id', session.user.id);
    if (rsvpData) {
      const map: Record<string, RsvpStatus> = {};
      for (const r of rsvpData) map[r.event_id] = r.status as RsvpStatus;
      setRsvps(map);
    }
    setLoading(false);
  }, [groupId, session]);

  // groupId can be undefined on the first render (route param hydration on
  // web) — useFocusEffect alone won't re-run once it resolves, since focus
  // hasn't changed. A plain effect keyed on `load` catches that transition.
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const eventsByDay = useMemo(() => {
    const map: Record<string, EventRow[]> = {};
    for (const e of events) {
      const key = toDateKey(new Date(e.start_time));
      (map[key] ??= []).push(e);
    }
    return map;
  }, [events]);

  const selectedDayEvents = eventsByDay[toDateKey(selectedDate)] ?? [];

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const periodLabel = useMemo(() => {
    if (viewMode === 'month') return `${MONTH_LABELS[viewMonth]} ${viewYear}`;
    if (viewMode === 'day') {
      return selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }
    const start = weekDays[0];
    const end = weekDays[6];
    const sameMonth = start.getMonth() === end.getMonth();
    const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endLabel = end.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
    return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
  }, [viewMode, viewMonth, viewYear, selectedDate, weekDays]);

  const goPrev = () => {
    if (viewMode === 'month') setSelectedDate(new Date(viewYear, viewMonth - 1, 1));
    else if (viewMode === 'week') setSelectedDate((d) => addDays(d, -7));
    else setSelectedDate((d) => addDays(d, -1));
  };
  const goNext = () => {
    if (viewMode === 'month') setSelectedDate(new Date(viewYear, viewMonth + 1, 1));
    else if (viewMode === 'week') setSelectedDate((d) => addDays(d, 7));
    else setSelectedDate((d) => addDays(d, 1));
  };

  const openCreateForm = (at?: Date) => {
    setEditingEvent(null);
    setTitle('');
    setLocation('');
    setFormDate(at ?? selectedDate);
    if (at) setFormTime(at);
    setShowForm(true);
    setError(null);
  };

  const openEditForm = (item: EventRow) => {
    setEditingEvent(item);
    setTitle(item.title);
    setLocation(item.location ?? '');
    setFormDate(new Date(item.start_time));
    setFormTime(new Date(item.start_time));
    setShowForm(true);
    setError(null);
  };

  const saveEvent = async () => {
    if (!session || !groupId) return;
    setError(null);
    if (!title.trim()) {
      setError('Title required');
      return;
    }
    setSaving(true);
    const start = new Date(formDate);
    start.setHours(formTime.getHours(), formTime.getMinutes(), 0, 0);
    const { error } = editingEvent
      ? await supabase
          .from('events')
          .update({ title: title.trim(), location: location.trim() || null, start_time: start.toISOString() })
          .eq('id', editingEvent.id)
      : await supabase.from('events').insert({
          group_id: groupId,
          title: title.trim(),
          location: location.trim() || null,
          start_time: start.toISOString(),
          created_by: session.user.id,
        });
    setSaving(false);
    if (error) setError(error.message);
    else {
      setTitle('');
      setLocation('');
      setEditingEvent(null);
      setShowForm(false);
      load();
    }
  };

  const handleMonthDayPress = (day: Date) => {
    setSelectedDate(day);
    if (!(eventsByDay[toDateKey(day)]?.length)) openCreateForm(day);
  };

  const handleEventPress = (item: EventRow) => {
    const canManage = item.created_by === session?.user.id || isAdmin;
    if (canManage) openEditForm(item);
    else setSelectedDate(new Date(item.start_time));
  };

  const openInMaps = (location: string) => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`);
  };

  const deleteEvent = (item: EventRow) => {
    confirmDelete('Delete event?', item.title, async () => {
      const { error } = await supabase.from('events').delete().eq('id', item.id);
      if (error) setError(error.message);
      else load();
    });
  };

  const rsvp = async (eventId: string, status: RsvpStatus) => {
    if (!session) return;
    const previous = rsvps[eventId];
    setRsvps((prev) => ({ ...prev, [eventId]: status }));
    setRsvpPending((prev) => ({ ...prev, [eventId]: true }));
    const { error } = await supabase
      .from('event_rsvps')
      .upsert({ event_id: eventId, user_id: session.user.id, status }, { onConflict: 'event_id,user_id' });
    setRsvpPending((prev) => ({ ...prev, [eventId]: false }));
    if (error) {
      setRsvps((prev) => ({ ...prev, [eventId]: previous as RsvpStatus }));
      setError(error.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Calendar</Text>
          {loading && <ActivityIndicator size="small" color={colors.textMuted} />}
        </View>
        <Button label="+ Add Event" onPress={() => openCreateForm()} style={{ backgroundColor: accentColor }} />
      </View>

      <View style={styles.periodBar}>
        <View style={styles.periodNavRow}>
          <Pressable style={styles.navButton} onPress={goPrev} hitSlop={8}>
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>
          <Text style={styles.periodLabel}>{periodLabel}</Text>
          <Pressable style={styles.navButton} onPress={goNext} hitSlop={8}>
            <Text style={styles.navArrow}>›</Text>
          </Pressable>
        </View>
        <View style={styles.modeSwitcher}>
          {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
            <Pressable
              key={mode}
              style={[styles.modeButton, viewMode === mode && { backgroundColor: accentColor }]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[styles.modeButtonText, viewMode === mode && styles.modeButtonTextActive]}>
                {mode[0].toUpperCase() + mode.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {viewMode === 'month' && (
        <MonthCalendarView
          viewYear={viewYear}
          viewMonth={viewMonth}
          eventsByDay={eventsByDay}
          selectedDate={selectedDate}
          onSelectDate={handleMonthDayPress}
          onEventPress={handleEventPress}
        />
      )}
      {(viewMode === 'week' || viewMode === 'day') && (
        <TimeGridView
          days={viewMode === 'week' ? weekDays : [selectedDate]}
          eventsByDay={eventsByDay}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onSlotPress={openCreateForm}
          onEventPress={handleEventPress}
        />
      )}

      <EventFormModal
        visible={showForm}
        isEditing={!!editingEvent}
        title={title}
        onTitleChange={setTitle}
        location={location}
        onLocationChange={setLocation}
        date={formDate}
        onDateChange={setFormDate}
        time={formTime}
        onTimeChange={setFormTime}
        error={error}
        saving={saving}
        accentColor={accentColor}
        onSave={saveEvent}
        onClose={() => { setShowForm(false); setEditingEvent(null); setError(null); }}
      />

      <View style={styles.agenda}>
        <Text style={styles.agendaTitle}>
          {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        {selectedDayEvents.length === 0 && <Text style={styles.empty}>No events this day.</Text>}
        {selectedDayEvents.map((item) => {
          const c = colorForString(item.id);
          const canManage = item.created_by === session?.user.id || isAdmin;
          return (
            <Card key={item.id} style={styles.eventRow}>
              <View style={styles.eventHeaderRow}>
                <View style={[styles.eventDot, { backgroundColor: c.text }]} />
                <Text style={styles.eventTitle}>{item.title}</Text>
                {canManage && (
                  <View style={styles.manageRow}>
                    <Pressable onPress={() => openEditForm(item)} hitSlop={6}>
                      <Text style={styles.manageLink}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => deleteEvent(item)} hitSlop={6}>
                      <Text style={styles.manageLinkDanger}>Delete</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              <Text style={styles.eventTime}>
                {new Date(item.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </Text>
              {item.location && (
                <Pressable onPress={() => openInMaps(item.location!)}>
                  <Text style={styles.eventLocation}>📍 {item.location}</Text>
                </Pressable>
              )}
              <View style={styles.rsvpRow}>
                {(['going', 'maybe', 'no'] as RsvpStatus[]).map((s) => {
                  const active = rsvps[item.id] === s;
                  return (
                    <Pressable
                      key={s}
                      style={[
                        styles.rsvpButton,
                        active && { backgroundColor: accentColor, borderColor: accentColor },
                        rsvpPending[item.id] && styles.rsvpButtonPending,
                      ]}
                      onPress={() => rsvp(item.id, s)}
                      disabled={rsvpPending[item.id]}
                    >
                      <Text style={active ? styles.rsvpTextActive : styles.rsvpText}>{s}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  periodBar: { gap: spacing.sm },
  periodNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  navButton: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  navArrow: { fontSize: 16, fontWeight: '700', color: colors.text },
  periodLabel: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.2, minWidth: 160, textAlign: 'center' },
  modeSwitcher: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 3, alignSelf: 'center' },
  modeButton: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: radius.sm },
  modeButtonText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  modeButtonTextActive: { color: '#fff' },
  agenda: { gap: spacing.sm },
  agendaTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 2 },
  empty: { color: colors.textMuted, paddingVertical: 12 },
  eventRow: { gap: 6 },
  eventHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventDot: { width: 8, height: 8, borderRadius: radius.pill },
  eventTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  manageRow: { flexDirection: 'row', gap: 12 },
  manageLink: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  manageLinkDanger: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  eventTime: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  eventLocation: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  rsvpRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  rsvpButton: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 12 },
  rsvpButtonPending: { opacity: 0.5 },
  rsvpText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  rsvpTextActive: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

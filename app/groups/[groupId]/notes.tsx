import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect, useGlobalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { useGroup } from '../../../lib/groupContext';
import { confirmDelete } from '../../../lib/confirm';
import { colorForString, colors, spacing } from '../../../lib/theme';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Card from '../../../components/ui/Card';
import type { ChecklistItem, Note } from '../../../lib/types';

const makeItemId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function Notes() {
  const { groupId } = useGlobalSearchParams<{ groupId: string }>();
  const { session } = useAuth();
  const { isAdmin, accentColor } = useGroup();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [draftChecklist, setDraftChecklist] = useState<ChecklistItem[]>([]);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setError(null);
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('group_id', groupId)
      .order('updated_at', { ascending: false });
    if (error) setError(error.message);
    else if (data) setNotes(data as unknown as Note[]);
    setLoading(false);
  }, [groupId]);

  // groupId can be undefined on the first render (route param hydration on
  // web) — useFocusEffect alone won't re-run once it resolves, since focus
  // hasn't changed. A plain effect keyed on `load` catches that transition.
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startEdit = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title);
    setBody(note.body);
    setDraftChecklist(note.checklist ?? []);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingNote(null);
    setTitle('');
    setBody('');
    setDraftChecklist([]);
    setNewItemLabel('');
    setError(null);
  };

  const addDraftItem = () => {
    if (!newItemLabel.trim()) return;
    setDraftChecklist((prev) => [...prev, { id: makeItemId(), label: newItemLabel.trim(), checked: false }]);
    setNewItemLabel('');
  };

  const removeDraftItem = (id: string) => setDraftChecklist((prev) => prev.filter((i) => i.id !== id));

  const saveNote = async () => {
    if (!session || !groupId) return;
    setError(null);
    if (!title.trim()) {
      setError('Title required');
      return;
    }
    setSaving(true);
    const { error } = editingNote
      ? await supabase
          .from('notes')
          .update({ title: title.trim(), body: body.trim(), checklist: draftChecklist, updated_at: new Date().toISOString() })
          .eq('id', editingNote.id)
      : await supabase
          .from('notes')
          .insert({ group_id: groupId, title: title.trim(), body: body.trim(), checklist: draftChecklist, created_by: session.user.id });
    setSaving(false);
    if (error) setError(error.message);
    else {
      cancelEdit();
      load();
    }
  };

  const deleteNote = (note: Note) => {
    confirmDelete('Delete note?', note.title, async () => {
      const previous = notes;
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      const { error } = await supabase.from('notes').delete().eq('id', note.id);
      if (error) {
        setNotes(previous);
        setError(error.message);
      }
    });
  };

  const toggleChecklistItem = async (note: Note, itemId: string) => {
    const nextChecklist = note.checklist.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i));
    const previous = notes;
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, checklist: nextChecklist } : n)));
    const { error } = await supabase
      .from('notes')
      .update({ checklist: nextChecklist, updated_at: new Date().toISOString() })
      .eq('id', note.id);
    if (error) {
      setNotes(previous);
      setError(error.message);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.empty} color={colors.primary} />
          ) : (
            <Text style={styles.empty}>No notes yet.</Text>
          )
        }
        renderItem={({ item }) => {
          const c = colorForString(item.id);
          const canManage = item.created_by === session?.user.id || isAdmin;
          return (
            <Card style={styles.noteCard}>
              <View style={[styles.stripe, { backgroundColor: c.text }]} />
              <View style={styles.flex1}>
                <View style={styles.noteTitleRow}>
                  <Text style={styles.noteTitle}>{item.title}</Text>
                  {canManage && (
                    <View style={styles.manageRow}>
                      <Pressable onPress={() => startEdit(item)} hitSlop={6}>
                        <Text style={styles.manageLink}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => deleteNote(item)} hitSlop={6}>
                        <Text style={styles.manageLinkDanger}>Delete</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
                {!!item.body && <Text style={styles.noteBody}>{item.body}</Text>}
                {item.checklist?.length > 0 && (
                  <View style={styles.checklist}>
                    {item.checklist.map((ci) => (
                      <Pressable
                        key={ci.id}
                        style={styles.checklistRow}
                        onPress={() => canManage && toggleChecklistItem(item, ci.id)}
                        disabled={!canManage}
                      >
                        <Text style={[styles.checkbox, ci.checked && { color: accentColor }]}>{ci.checked ? '☑' : '☐'}</Text>
                        <Text style={[styles.checklistLabel, ci.checked && styles.checklistLabelChecked]}>{ci.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </Card>
          );
        }}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Card style={styles.form}>
        {editingNote && (
          <View style={styles.editingBanner}>
            <Text style={styles.editingBannerText}>Editing note</Text>
            <Pressable onPress={cancelEdit}>
              <Text style={styles.manageLinkDanger}>Cancel</Text>
            </Pressable>
          </View>
        )}
        <Input placeholder="Title" value={title} onChangeText={setTitle} />
        <Input
          style={styles.multiline}
          placeholder="Note body (itinerary, details, etc.)"
          value={body}
          onChangeText={setBody}
          multiline
        />

        <Text style={styles.checklistLabelHeader}>Checklist (packing list, to-dos)</Text>
        {draftChecklist.map((ci) => (
          <View key={ci.id} style={styles.draftItemRow}>
            <Text style={styles.checklistLabel}>{ci.label}</Text>
            <Pressable onPress={() => removeDraftItem(ci.id)} hitSlop={6}>
              <Text style={styles.manageLinkDanger}>Remove</Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.row}>
          <Input
            style={styles.flex1}
            placeholder="Add item"
            value={newItemLabel}
            onChangeText={setNewItemLabel}
            onSubmitEditing={addDraftItem}
          />
          <Button label="+ Add" variant="secondary" onPress={addDraftItem} />
        </View>

        <Button
          label={editingNote ? 'Save changes' : 'Add note'}
          onPress={saveNote}
          loading={saving}
          style={{ backgroundColor: accentColor }}
          fullWidth
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  listContent: { gap: spacing.sm },
  empty: { color: colors.textMuted, paddingVertical: 20 },
  noteCard: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch', paddingVertical: spacing.md },
  stripe: { width: 4, borderRadius: 2 },
  flex1: { flex: 1, gap: 3 },
  noteTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  manageRow: { flexDirection: 'row', gap: 12 },
  manageLink: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  manageLinkDanger: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  noteBody: { color: colors.textMuted, fontSize: 14 },
  checklist: { marginTop: 6, gap: 4 },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { fontSize: 16, color: colors.textFaint },
  checklistLabel: { fontSize: 14, color: colors.text },
  checklistLabelChecked: { color: colors.textFaint, textDecorationLine: 'line-through' },
  checklistLabelHeader: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing.xs },
  draftItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  form: { gap: spacing.sm },
  editingBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editingBannerText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});

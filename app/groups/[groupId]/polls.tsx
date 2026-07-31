import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect, useGlobalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { useGroup } from '../../../lib/groupContext';
import { confirmDelete } from '../../../lib/confirm';
import { colors, radius, spacing } from '../../../lib/theme';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Card from '../../../components/ui/Card';
import type { Poll, PollOption } from '../../../lib/types';

type PollWithOptions = Poll & {
  options: (PollOption & { voteCount: number })[];
  myVote: string | null;
};

export default function Polls() {
  const { groupId } = useGlobalSearchParams<{ groupId: string }>();
  const { session } = useAuth();
  const { isAdmin, accentColor } = useGroup();
  const [polls, setPolls] = useState<PollWithOptions[]>([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [optionInputs, setOptionInputs] = useState(['', '']);
  const [error, setError] = useState<string | null>(null);
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [editingPoll, setEditingPoll] = useState<PollWithOptions | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editOptionLabels, setEditOptionLabels] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    if (!session || !groupId) return;
    setError(null);
    const { data: pollRows, error: pollErr } = await supabase
      .from('polls')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (pollErr) setError(pollErr.message);
    if (!pollRows || pollRows.length === 0) {
      setPolls([]);
      setLoading(false);
      return;
    }
    const pollIds = pollRows.map((p) => p.id);
    const { data: optionRows, error: optErr } = await supabase.from('poll_options').select('*').in('poll_id', pollIds);
    const { data: voteRows, error: voteErr } = await supabase.from('poll_votes').select('*').in('poll_id', pollIds);
    if (optErr) setError(optErr.message);
    if (voteErr) setError(voteErr.message);

    const merged: PollWithOptions[] = pollRows.map((p) => {
      const options = (optionRows ?? [])
        .filter((o) => o.poll_id === p.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((o) => ({
          ...o,
          voteCount: (voteRows ?? []).filter((v) => v.option_id === o.id).length,
        }));
      const myVote = (voteRows ?? []).find((v) => v.poll_id === p.id && v.user_id === session.user.id)?.option_id ?? null;
      return { ...p, options, myVote };
    });
    setPolls(merged);
    setLoading(false);
  }, [groupId, session]);

  // groupId can be undefined on the first render (route param hydration on
  // web) — useFocusEffect alone won't re-run once it resolves, since focus
  // hasn't changed. A plain effect keyed on `load` catches that transition.
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addOptionInput = () => setOptionInputs((prev) => [...prev, '']);
  const updateOptionInput = (i: number, value: string) =>
    setOptionInputs((prev) => prev.map((v, idx) => (idx === i ? value : v)));

  const createPoll = async () => {
    if (!session || !groupId) return;
    setError(null);
    const cleanOptions = optionInputs.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2) {
      setError('Question and at least 2 options required');
      return;
    }
    setCreatingPoll(true);
    const { data: poll, error: pollErr } = await supabase
      .from('polls')
      .insert({ group_id: groupId, question: question.trim(), created_by: session.user.id })
      .select()
      .single();
    if (pollErr || !poll) {
      setCreatingPoll(false);
      setError(pollErr?.message ?? 'Failed to create poll');
      return;
    }
    const { error: optErr } = await supabase.from('poll_options').insert(
      cleanOptions.map((label, i) => ({ poll_id: poll.id, label, sort_order: i }))
    );
    setCreatingPoll(false);
    if (optErr) setError(optErr.message);
    else {
      setQuestion('');
      setOptionInputs(['', '']);
      load();
    }
  };

  const openEditPoll = (poll: PollWithOptions) => {
    setEditingPoll(poll);
    setEditQuestion(poll.question);
    setEditOptionLabels(poll.options.map((o) => o.label));
    setError(null);
  };

  const cancelEditPoll = () => {
    setEditingPoll(null);
    setError(null);
  };

  // ponytail: rename-only — options can't be added or removed after
  // creation, since removing one would cascade-delete its votes. Add
  // add/remove support (guarded on voteCount === 0) if that's ever needed.
  const saveEditPoll = async () => {
    if (!editingPoll) return;
    if (!editQuestion.trim() || editOptionLabels.some((l) => !l.trim())) {
      setError('Question and all option labels required');
      return;
    }
    setSavingEdit(true);
    setError(null);
    const { error: qErr } = await supabase.from('polls').update({ question: editQuestion.trim() }).eq('id', editingPoll.id);
    if (qErr) {
      setSavingEdit(false);
      setError(qErr.message);
      return;
    }
    for (let i = 0; i < editingPoll.options.length; i++) {
      const opt = editingPoll.options[i];
      const label = editOptionLabels[i].trim();
      if (label !== opt.label) {
        const { error: optErr } = await supabase.from('poll_options').update({ label }).eq('id', opt.id);
        if (optErr) {
          setSavingEdit(false);
          setError(optErr.message);
          return;
        }
      }
    }
    setSavingEdit(false);
    setEditingPoll(null);
    load();
  };

  const vote = async (pollId: string, optionId: string) => {
    if (!session) return;
    const previous = polls;
    setPolls((prev) =>
      prev.map((p) => {
        if (p.id !== pollId) return p;
        const previousVote = p.myVote;
        if (previousVote === optionId) return p;
        const options = p.options.map((o) => {
          if (o.id === optionId) return { ...o, voteCount: o.voteCount + 1 };
          if (o.id === previousVote) return { ...o, voteCount: Math.max(0, o.voteCount - 1) };
          return o;
        });
        return { ...p, options, myVote: optionId };
      })
    );
    const { error } = await supabase
      .from('poll_votes')
      .upsert({ poll_id: pollId, option_id: optionId, user_id: session.user.id }, { onConflict: 'poll_id,user_id' });
    if (error) {
      setPolls(previous);
      setError(error.message);
    }
  };

  const deletePoll = (poll: PollWithOptions) => {
    confirmDelete('Delete poll?', poll.question, async () => {
      const previous = polls;
      setPolls((prev) => prev.filter((p) => p.id !== poll.id));
      const { error } = await supabase.from('polls').delete().eq('id', poll.id);
      if (error) {
        setPolls(previous);
        setError(error.message);
      }
    });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={polls}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.empty} color={colors.primary} />
          ) : (
            <Text style={styles.empty}>No polls yet.</Text>
          )
        }
        renderItem={({ item }) => {
          const total = item.options.reduce((sum, o) => sum + o.voteCount, 0);
          const canManage = item.created_by === session?.user.id || isAdmin;

          if (editingPoll?.id === item.id) {
            return (
              <Card style={styles.pollCard}>
                <Input placeholder="Poll question" value={editQuestion} onChangeText={setEditQuestion} />
                {editOptionLabels.map((label, i) => (
                  <Input
                    key={item.options[i].id}
                    placeholder={`Option ${i + 1}`}
                    value={label}
                    onChangeText={(text) => setEditOptionLabels((prev) => prev.map((v, idx) => (idx === i ? text : v)))}
                  />
                ))}
                {error && <Text style={styles.error}>{error}</Text>}
                <View style={styles.editButtonRow}>
                  <Button label="Cancel" variant="secondary" style={styles.flex1} onPress={cancelEditPoll} disabled={savingEdit} />
                  <Button label="Save" style={[styles.flex1, { backgroundColor: accentColor }]} onPress={saveEditPoll} loading={savingEdit} />
                </View>
              </Card>
            );
          }

          return (
            <Card style={styles.pollCard}>
              <View style={styles.questionRow}>
                <Text style={styles.question}>{item.question}</Text>
                {canManage && (
                  <View style={styles.manageRow}>
                    <Pressable onPress={() => openEditPoll(item)} hitSlop={6}>
                      <Text style={styles.manageLink}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => deletePoll(item)} hitSlop={6}>
                      <Text style={styles.manageLinkDanger}>Delete</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              {item.options.map((o) => {
                const pct = total > 0 ? Math.round((o.voteCount / total) * 100) : 0;
                const mine = item.myVote === o.id;
                return (
                  <Pressable key={o.id} style={styles.optionRow} onPress={() => vote(item.id, o.id)}>
                    <View style={styles.optionTopRow}>
                      <Text style={[styles.optionLabel, mine && { color: accentColor }]}>{o.label}</Text>
                      <Text style={styles.optionMeta}>{o.voteCount} · {pct}%</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${pct}%` }, mine && { backgroundColor: accentColor }]} />
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          );
        }}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Card style={styles.form}>
        <Input placeholder="Poll question" value={question} onChangeText={setQuestion} />
        {optionInputs.map((v, i) => (
          <Input key={i} placeholder={`Option ${i + 1}`} value={v} onChangeText={(text) => updateOptionInput(i, text)} />
        ))}
        <Pressable onPress={addOptionInput}>
          <Text style={styles.addOption}>+ add option</Text>
        </Pressable>
        <Button
          label="Create poll"
          onPress={createPoll}
          loading={creatingPoll}
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
  pollCard: { gap: 10 },
  questionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  question: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2, flex: 1 },
  manageRow: { flexDirection: 'row', gap: 12 },
  manageLink: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  manageLinkDanger: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  editButtonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  flex1: { flex: 1 },
  optionRow: { gap: 5 },
  optionTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  optionLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  optionMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  barTrack: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.textFaint, borderRadius: radius.pill },
  form: { gap: spacing.sm },
  addOption: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});

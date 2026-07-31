import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { Expense, ExpenseSplit, GroupMember } from '../../../lib/types';

export default function Expenses() {
  const { groupId } = useGlobalSearchParams<{ groupId: string }>();
  const { session } = useAuth();
  const { isAdmin, accentColor } = useGroup();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setError(null);
    const [{ data: memberData, error: memberErr }, { data: expenseData, error: expenseErr }] = await Promise.all([
      supabase.from('group_members').select('*, profiles(display_name)').eq('group_id', groupId),
      supabase
        .from('expenses')
        // expense_splits also links expenses<->profiles (many-to-many via
        // user_id), so the FK must be named or PostgREST 300s as ambiguous.
        .select('*, profiles!expenses_paid_by_fkey(display_name)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false }),
    ]);
    if (memberErr) setError(memberErr.message);
    else if (memberData) setMembers(memberData as unknown as GroupMember[]);
    if (expenseErr) setError(expenseErr.message);
    else if (expenseData) {
      setExpenses(expenseData as unknown as Expense[]);
      const expenseIds = expenseData.map((e) => e.id);
      if (expenseIds.length > 0) {
        const { data: splitData, error: splitErr } = await supabase
          .from('expense_splits')
          .select('*, profiles(display_name)')
          .in('expense_id', expenseIds);
        if (splitErr) setError(splitErr.message);
        else if (splitData) setSplits(splitData as unknown as ExpenseSplit[]);
      } else {
        setSplits([]);
      }
    }
    setLoading(false);
  }, [groupId]);

  // groupId can be undefined on the first render (route param hydration on
  // web) — useFocusEffect alone won't re-run once it resolves, since focus
  // hasn't changed. A plain effect keyed on `load` catches that transition.
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const balances = useMemo(() => {
    const paid: Record<string, number> = {};
    const owed: Record<string, number> = {};
    const names: Record<string, string> = {};
    for (const e of expenses) {
      paid[e.paid_by] = (paid[e.paid_by] ?? 0) + Number(e.amount);
      if (e.profiles?.display_name) names[e.paid_by] = e.profiles.display_name;
    }
    for (const s of splits) {
      owed[s.user_id] = (owed[s.user_id] ?? 0) + Number(s.share);
      if (s.profiles?.display_name) names[s.user_id] = s.profiles.display_name;
    }

    const memberList: { member: GroupMember; net: number; left: boolean }[] = members.map((m) => ({
      member: m,
      net: Math.round(((paid[m.user_id] ?? 0) - (owed[m.user_id] ?? 0)) * 100) / 100,
      left: false,
    }));

    // Members who left the group after paying or owing into an expense
    // still hold that balance historically — surface them separately so the
    // total keeps reconciling instead of the money silently disappearing.
    const memberIds = new Set(members.map((m) => m.user_id));
    const departedIds = new Set([...Object.keys(paid), ...Object.keys(owed)].filter((id) => !memberIds.has(id)));
    for (const id of departedIds) {
      memberList.push({
        member: { group_id: groupId ?? '', user_id: id, role: 'member', joined_at: '', profiles: { display_name: names[id] ?? 'Former member' } },
        net: Math.round(((paid[id] ?? 0) - (owed[id] ?? 0)) * 100) / 100,
        left: true,
      });
    }

    return memberList;
  }, [members, expenses, splits, groupId]);

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setDescription(expense.description);
    setAmount(String(expense.amount));
    setError(null);
  };

  const cancelEditExpense = () => {
    setEditingExpense(null);
    setDescription('');
    setAmount('');
    setError(null);
  };

  const saveExpense = async () => {
    if (!session || !groupId) return;
    setError(null);
    const amountNum = Number(amount);
    if (!description.trim() || !amountNum || amountNum <= 0) {
      setError('Description and a valid amount required');
      return;
    }
    if (members.length === 0) return;
    setSaving(true);

    const payerId = editingExpense?.paid_by ?? session.user.id;
    // equal split, remainder cent(s) go to the payer so shares always sum to the total
    const baseShare = Math.floor((amountNum / members.length) * 100) / 100;
    const remainder = Math.round((amountNum - baseShare * members.length) * 100) / 100;
    const shareRows = (expenseId: string) =>
      members.map((m) => ({
        expense_id: expenseId,
        user_id: m.user_id,
        share: m.user_id === payerId ? baseShare + remainder : baseShare,
      }));

    if (editingExpense) {
      const { error: updateErr } = await supabase
        .from('expenses')
        .update({ description: description.trim(), amount: amountNum })
        .eq('id', editingExpense.id);
      if (updateErr) {
        setSaving(false);
        setError(updateErr.message);
        return;
      }
      // splits are recomputed from scratch since amount/membership may have
      // changed since the expense was created
      await supabase.from('expense_splits').delete().eq('expense_id', editingExpense.id);
      const { error: splitErr } = await supabase.from('expense_splits').insert(shareRows(editingExpense.id));
      setSaving(false);
      if (splitErr) setError(splitErr.message);
      else {
        cancelEditExpense();
        load();
      }
      return;
    }

    const { data: expense, error: expenseErr } = await supabase
      .from('expenses')
      .insert({ group_id: groupId, description: description.trim(), amount: amountNum, paid_by: session.user.id })
      .select()
      .single();
    if (expenseErr || !expense) {
      setSaving(false);
      setError(expenseErr?.message ?? 'Failed to add expense');
      return;
    }

    const { error: splitErr } = await supabase.from('expense_splits').insert(shareRows(expense.id));
    setSaving(false);
    if (splitErr) setError(splitErr.message);
    else {
      setDescription('');
      setAmount('');
      load();
    }
  };

  const deleteExpense = (expense: Expense) => {
    confirmDelete('Delete expense?', `${expense.description} — $${Number(expense.amount).toFixed(2)}`, async () => {
      const { error } = await supabase.from('expenses').delete().eq('id', expense.id);
      if (error) setError(error.message);
      else load();
    });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={expenses}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          members.length > 0 ? (
            <Card style={styles.balanceCard}>
              <Text style={styles.sectionLabel}>Balances</Text>
              {balances.map(({ member, net, left }) => (
                <View key={member.user_id} style={styles.balanceRow}>
                  <Text style={styles.balanceName}>
                    {member.profiles?.display_name ?? '…'}
                    {member.user_id === session?.user.id ? ' (you)' : ''}
                    {left ? ' (left)' : ''}
                  </Text>
                  <Text style={[styles.balanceAmount, net > 0 ? styles.balancePositive : net < 0 ? styles.balanceNegative : styles.balanceZero]}>
                    {net > 0 ? `+$${net.toFixed(2)}` : net < 0 ? `-$${Math.abs(net).toFixed(2)}` : '$0.00'}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.empty} color={colors.primary} />
          ) : (
            <Text style={styles.empty}>No expenses yet.</Text>
          )
        }
        renderItem={({ item }) => {
          const canManage = item.paid_by === session?.user.id || isAdmin;
          return (
            <Card style={styles.expenseCard}>
              <View style={styles.expenseTopRow}>
                <Text style={styles.expenseDescription}>{item.description}</Text>
                <Text style={styles.expenseAmount}>${Number(item.amount).toFixed(2)}</Text>
              </View>
              <View style={styles.expenseTopRow}>
                <Text style={styles.expensePaidBy}>Paid by {item.profiles?.display_name ?? '…'}</Text>
                {canManage && (
                  <View style={styles.manageRow}>
                    <Pressable onPress={() => openEditExpense(item)} hitSlop={6}>
                      <Text style={styles.manageLink}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => deleteExpense(item)} hitSlop={6}>
                      <Text style={styles.manageLinkDanger}>Delete</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </Card>
          );
        }}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Card style={styles.form}>
        <Input placeholder="What was it for?" value={description} onChangeText={setDescription} />
        <Input placeholder="Amount ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Text style={styles.hint}>Splits equally among all {members.length} member{members.length === 1 ? '' : 's'}.</Text>
        <View style={styles.row}>
          {editingExpense && (
            <Button label="Cancel" variant="secondary" style={styles.flex1} onPress={cancelEditExpense} disabled={saving} />
          )}
          <Button
            label={editingExpense ? 'Save changes' : 'Add expense'}
            onPress={saveExpense}
            loading={saving}
            style={[styles.flex1, { backgroundColor: accentColor }]}
            fullWidth={!editingExpense}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  listContent: { gap: spacing.sm },
  empty: { color: colors.textMuted, paddingVertical: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  balanceCard: { gap: 6, marginBottom: spacing.sm },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  balanceName: { fontSize: 14, color: colors.text, fontWeight: '600' },
  balanceAmount: { fontSize: 14, fontWeight: '800' },
  balancePositive: { color: colors.success },
  balanceNegative: { color: colors.danger },
  balanceZero: { color: colors.textFaint },
  expenseCard: { gap: 4 },
  expenseTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expenseDescription: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  expenseAmount: { fontSize: 15, fontWeight: '800', color: colors.text },
  expensePaidBy: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  manageRow: { flexDirection: 'row', gap: 12 },
  manageLink: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  manageLinkDanger: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  form: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  hint: { fontSize: 12, color: colors.textFaint },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});

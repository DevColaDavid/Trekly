import { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { colorForString, colors, radius, spacing } from '../../lib/theme';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import type { Group } from '../../lib/types';

export default function Groups() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('groups')
      .select('*, group_members!inner(user_id)')
      .eq('group_members.user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setGroups(data as unknown as Group[]);
    setLoading(false);
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const createGroup = async () => {
    if (!session || !newGroupName.trim()) return;
    setError(null);
    setCreating(true);
    const { data: group, error } = await supabase
      .from('groups')
      .insert({ name: newGroupName.trim(), created_by: session.user.id })
      .select()
      .single();
    if (!error && group) {
      // belt-and-suspenders: don't rely solely on the on_group_created DB
      // trigger to add the creator to group_members. onConflict makes this
      // a no-op if the trigger already did it.
      await supabase
        .from('group_members')
        .upsert({ group_id: group.id, user_id: session.user.id, role: 'owner' }, { onConflict: 'group_id,user_id' });
    }
    setCreating(false);
    if (error) setError(error.message);
    else {
      setNewGroupName('');
      load();
    }
  };

  const joinGroup = async () => {
    if (!session || !inviteCode.trim()) return;
    setError(null);
    setJoining(true);
    const { data: group, error: findErr } = await supabase
      .from('groups')
      .select('id')
      .eq('invite_code', inviteCode.trim())
      .single();
    if (findErr || !group) {
      setJoining(false);
      setError('Invite code not found');
      return;
    }
    const { error: joinErr } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: session.user.id });
    setJoining(false);
    if (joinErr) setError(joinErr.message);
    else {
      setInviteCode('');
      load();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Your circles</Text>
          <Text style={styles.title}>Groups</Text>
        </View>
        <Pressable onPress={signOut} hitSlop={8}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.empty} color={colors.primary} />
          ) : (
            <Text style={styles.empty}>No groups yet. Create or join one below.</Text>
          )
        }
        renderItem={({ item }) => {
          const c = colorForString(item.id);
          return (
            <Pressable onPress={() => router.push(`/groups/${item.id}`)}>
              <Card style={styles.groupRow}>
                <View style={[styles.groupBadge, { backgroundColor: c.bg }]}>
                  <Text style={[styles.groupBadgeText, { color: c.text }]}>{item.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.groupName}>{item.name}</Text>
                  <Text style={styles.inviteCode}>invite code · {item.invite_code}</Text>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Card style={styles.formCard}>
        <View style={styles.row}>
          <Input style={styles.flex1} placeholder="New group name" value={newGroupName} onChangeText={setNewGroupName} />
          <Button label="Create" onPress={createGroup} loading={creating} />
        </View>
        <View style={styles.row}>
          <Input
            style={styles.flex1}
            placeholder="Invite code"
            autoCapitalize="none"
            value={inviteCode}
            onChangeText={setInviteCode}
          />
          <Button label="Join" variant="secondary" onPress={joinGroup} loading={joining} />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 40 },
  eyebrow: { fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  signOut: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  listContent: { gap: spacing.sm, paddingVertical: 4 },
  empty: { color: colors.textMuted, paddingVertical: 20 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  groupBadge: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  groupBadgeText: { fontSize: 16, fontWeight: '800' },
  flex1: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: '700', color: colors.text },
  inviteCode: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  formCard: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});

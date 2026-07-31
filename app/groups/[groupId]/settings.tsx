import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect, useGlobalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { useGroup } from '../../../lib/groupContext';
import { confirmAction } from '../../../lib/confirm';
import { colors, radius, spacing } from '../../../lib/theme';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Card from '../../../components/ui/Card';
import type { GroupMember, GroupRole } from '../../../lib/types';

const COLOR_SWATCHES = ['#4F46E5', '#16A34A', '#DC2626', '#D97706', '#0EA5E9', '#DB2777', '#7C3AED', '#0F766E'];

export default function GroupSettings() {
  const { groupId } = useGlobalSearchParams<{ groupId: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const { group, isAdmin, isOwner, accentColor, refresh } = useGroup();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (group) setName(group.name);
  }, [group?.id, group?.name]);

  const loadMembers = useCallback(async () => {
    if (!groupId) return;
    const { data } = await supabase
      .from('group_members')
      .select('*, profiles(display_name)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });
    if (data) setMembers(data as unknown as GroupMember[]);
  }, [groupId]);

  useFocusEffect(useCallback(() => { loadMembers(); }, [loadMembers]));

  const saveName = async () => {
    if (!groupId || !name.trim()) return;
    setSavingName(true);
    setError(null);
    const { error } = await supabase.from('groups').update({ name: name.trim() }).eq('id', groupId);
    setSavingName(false);
    if (error) setError(error.message);
    else refresh();
  };

  const setColor = async (color: string) => {
    if (!groupId) return;
    const { error } = await supabase.from('groups').update({ theme_color: color }).eq('id', groupId);
    if (error) setError(error.message);
    else refresh();
  };

  const changeRole = async (member: GroupMember, newRole: GroupRole) => {
    const { error } = await supabase
      .from('group_members')
      .update({ role: newRole })
      .eq('group_id', member.group_id)
      .eq('user_id', member.user_id);
    if (error) setError(error.message);
    else loadMembers();
  };

  const removeMember = (member: GroupMember) => {
    confirmAction('Remove member?', member.profiles?.display_name ?? 'This member', 'Remove', async () => {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', member.group_id)
        .eq('user_id', member.user_id);
      if (error) setError(error.message);
      else loadMembers();
    });
  };

  const transferOwnership = (member: GroupMember) => {
    confirmAction(
      'Transfer ownership?',
      `${member.profiles?.display_name ?? 'This member'} will become the owner. You'll become an admin.`,
      'Transfer',
      async () => {
        const { error } = await supabase.rpc('transfer_group_ownership', {
          target_group: member.group_id,
          new_owner: member.user_id,
        });
        if (error) setError(error.message);
        else {
          refresh();
          loadMembers();
        }
      }
    );
  };

  const leaveGroup = () => {
    if (isOwner) {
      setError('Transfer ownership to another member before you can leave.');
      return;
    }
    confirmAction('Leave group?', group?.name, 'Leave', async () => {
      if (!groupId || !session) return;
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', session.user.id);
      if (error) setError(error.message);
      else router.replace('/groups');
    });
  };

  const deleteGroup = () => {
    confirmAction(
      'Delete this group?',
      `This permanently deletes "${group?.name}" and everything in it — events, chat, polls, notes, expenses — for every member. This can't be undone.`,
      'Delete',
      async () => {
        if (!groupId) return;
        const { error } = await supabase.from('groups').delete().eq('id', groupId);
        if (error) setError(error.message);
        else router.replace('/groups');
      }
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>Name</Text>
        {isAdmin ? (
          <View style={styles.row}>
            <Input style={styles.flex1} value={name} onChangeText={setName} />
            <Button label="Save" onPress={saveName} loading={savingName} style={{ backgroundColor: accentColor }} />
          </View>
        ) : (
          <Text style={styles.readOnlyValue}>{group?.name}</Text>
        )}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>Invite code</Text>
        <Text style={styles.readOnlyValue}>{group?.invite_code}</Text>
      </Card>

      {isAdmin && (
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Theme color</Text>
          <View style={styles.swatchRow}>
            {COLOR_SWATCHES.map((c) => (
              <Pressable
                key={c}
                style={[styles.swatch, { backgroundColor: c }, group?.theme_color === c && styles.swatchActive]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>
        </Card>
      )}

      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>Members</Text>
        {members.map((m) => {
          const isSelf = m.user_id === session?.user.id;
          return (
            <View key={m.user_id} style={styles.memberRow}>
              <View style={styles.flex1}>
                <Text style={styles.memberName}>
                  {m.profiles?.display_name ?? '…'}
                  {isSelf ? ' (you)' : ''}
                </Text>
                <Text style={styles.memberRole}>{m.role}</Text>
              </View>
              {!isSelf && m.role !== 'owner' && (
                <View style={styles.memberActions}>
                  {isOwner && (
                    <>
                      <Pressable onPress={() => changeRole(m, m.role === 'admin' ? 'member' : 'admin')} hitSlop={6}>
                        <Text style={styles.manageLink}>{m.role === 'admin' ? 'Revoke admin' : 'Make admin'}</Text>
                      </Pressable>
                      <Pressable onPress={() => transferOwnership(m)} hitSlop={6}>
                        <Text style={styles.manageLink}>Make owner</Text>
                      </Pressable>
                    </>
                  )}
                  {isAdmin && (
                    <Pressable onPress={() => removeMember(m)} hitSlop={6}>
                      <Text style={styles.manageLinkDanger}>Remove</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </Card>

      {error && <Text style={styles.error}>{error}</Text>}

      <Button label="Leave group" variant="danger" onPress={leaveGroup} fullWidth />
      {isOwner && <Button label="Delete group" variant="danger" onPress={deleteGroup} fullWidth />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  section: { gap: spacing.sm },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  readOnlyValue: { fontSize: 15, color: colors.text, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  flex1: { flex: 1 },
  swatchRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  swatch: { width: 36, height: 36, borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.text },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.sm },
  memberName: { fontSize: 15, fontWeight: '700', color: colors.text },
  memberRole: { fontSize: 12, color: colors.textMuted, fontWeight: '600', textTransform: 'capitalize' },
  memberActions: { flexDirection: 'row', gap: 12 },
  manageLink: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  manageLinkDanger: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});

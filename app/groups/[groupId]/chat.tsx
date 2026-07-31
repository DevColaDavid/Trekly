import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useGlobalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { useGroup } from '../../../lib/groupContext';
import { colors, radius, spacing } from '../../../lib/theme';
import Input from '../../../components/ui/Input';
import ActionSheet from '../../../components/ActionSheet';
import type { Message } from '../../../lib/types';

export default function Chat() {
  const { groupId } = useGlobalSearchParams<{ groupId: string }>();
  const { session } = useAuth();
  const { isAdmin, accentColor } = useGroup();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeMessage, setActiveMessage] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    if (!groupId) return;
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(display_name)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as unknown as Message[]);
    setLoading(false);
  }, [groupId]);

  // groupId can be undefined on the first render (route param hydration on
  // web) — useFocusEffect alone won't re-run once it resolves, since focus
  // hasn't changed. A plain effect keyed on `load` catches that transition.
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`messages:${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const { data } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', payload.new.user_id)
            .single();
          setMessages((prev) => {
            // drop the optimistic temp bubble this confirms, so it isn't duplicated
            const withoutTemp = prev.filter(
              (m) => !(m.id.startsWith('temp-') && m.user_id === payload.new.user_id && m.body === payload.new.body)
            );
            return [...withoutTemp, { ...(payload.new as Message), profiles: data }];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? { ...m, ...(payload.new as Message) } : m)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  const send = async () => {
    if (!session || !groupId || !body.trim()) return;
    setError(null);
    const text = body.trim();

    if (editingId) {
      setBody('');
      const id = editingId;
      setEditingId(null);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body: text, edited_at: new Date().toISOString() } : m)));
      const { error } = await supabase
        .from('messages')
        .update({ body: text, edited_at: new Date().toISOString() })
        .eq('id', id);
      if (error) setError(error.message);
      return;
    }

    setBody('');
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        group_id: groupId,
        user_id: session.user.id,
        body: text,
        created_at: new Date().toISOString(),
        edited_at: null,
        profiles: null,
      },
    ]);

    const { error } = await supabase.from('messages').insert({ group_id: groupId, user_id: session.user.id, body: text });
    if (error) {
      setError(error.message);
      setBody(text);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const deleteMessage = async (id: string) => {
    const previous = messages;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) {
      setMessages(previous);
      setError(error.message);
    }
  };

  const openMenu = (item: Message) => {
    const isOwn = item.user_id === session?.user.id;
    if (!isOwn && !isAdmin) return;
    setActiveMessage(item);
  };

  const activeMessageIsOwn = activeMessage?.user_id === session?.user.id;
  const sheetActions = activeMessage
    ? [
        ...(activeMessageIsOwn
          ? [{ label: 'Edit', onPress: () => { setEditingId(activeMessage.id); setBody(activeMessage.body); } }]
          : []),
        { label: 'Delete', destructive: true, onPress: () => deleteMessage(activeMessage.id) },
      ]
    : [];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isOwn = item.user_id === session?.user.id;
          const pending = item.id.startsWith('temp-');
          const canManage = isOwn || isAdmin;
          return (
            <Pressable
              style={[styles.messageRow, isOwn && styles.messageRowOwn, pending && styles.messageRowPending]}
              onLongPress={() => openMenu(item)}
            >
              {!isOwn && <Text style={styles.sender}>{item.profiles?.display_name ?? '…'}</Text>}
              <View style={styles.bubbleRow}>
                {isOwn && canManage && (
                  <Pressable onPress={() => openMenu(item)} hitSlop={8}>
                    <Text style={styles.moreDots}>⋯</Text>
                  </Pressable>
                )}
                <View style={[styles.bubble, isOwn && { backgroundColor: accentColor }, !isOwn && styles.bubbleOther]}>
                  <Text style={isOwn ? styles.bubbleTextOwn : styles.bubbleText}>{item.body}</Text>
                </View>
                {!isOwn && canManage && (
                  <Pressable onPress={() => openMenu(item)} hitSlop={8}>
                    <Text style={styles.moreDots}>⋯</Text>
                  </Pressable>
                )}
              </View>
              {item.edited_at && <Text style={styles.editedTag}>edited</Text>}
            </Pressable>
          );
        }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={loading ? <ActivityIndicator style={styles.loadingIndicator} color={colors.primary} /> : null}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {editingId && (
        <View style={styles.editingBanner}>
          <Text style={styles.editingBannerText}>Editing message</Text>
          <Pressable onPress={() => { setEditingId(null); setBody(''); }}>
            <Text style={styles.editingBannerCancel}>Cancel</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.inputRow}>
        <Input style={styles.flex1} placeholder="Message" value={body} onChangeText={setBody} onSubmitEditing={send} />
        <Pressable style={[styles.sendButton, { backgroundColor: accentColor }]} onPress={send}>
          <Text style={styles.sendButtonText}>{editingId ? 'Save' : 'Send'}</Text>
        </Pressable>
      </View>
      <ActionSheet visible={!!activeMessage} onClose={() => setActiveMessage(null)} actions={sheetActions} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.lg, gap: 10 },
  messageRow: { alignItems: 'flex-start', maxWidth: '78%' },
  messageRowOwn: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  messageRowPending: { opacity: 0.5 },
  loadingIndicator: { marginTop: spacing.xl },
  sender: { fontSize: 11, color: colors.textMuted, fontWeight: '700', marginBottom: 3, marginLeft: 4 },
  bubbleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  moreDots: { fontSize: 16, color: colors.textFaint, fontWeight: '700', paddingHorizontal: 2 },
  bubble: { borderRadius: radius.lg, paddingVertical: 9, paddingHorizontal: 13 },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  bubbleText: { color: colors.text, fontSize: 15 },
  bubbleTextOwn: { color: '#fff', fontSize: 15 },
  editedTag: { fontSize: 10, color: colors.textFaint, marginTop: 2, marginHorizontal: 4 },
  error: { color: colors.danger, fontSize: 12, fontWeight: '600', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  editingBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 6, backgroundColor: colors.surfaceAlt },
  editingBannerText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  editingBannerCancel: { fontSize: 12, color: colors.danger, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  flex1: { flex: 1 },
  sendButton: { borderRadius: radius.md, justifyContent: 'center', paddingHorizontal: spacing.lg },
  sendButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

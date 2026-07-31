import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { colors } from './theme';
import type { Group, GroupRole } from './types';

type GroupContextValue = {
  group: Group | null;
  role: GroupRole | null;
  loading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  accentColor: string;
  refresh: () => Promise<void>;
};

const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupProvider({ groupId, children }: { groupId: string; children: ReactNode }) {
  const { session } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [role, setRole] = useState<GroupRole | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session || !groupId) return;
    const [{ data: groupData }, { data: memberData }] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase.from('group_members').select('role').eq('group_id', groupId).eq('user_id', session.user.id).single(),
    ]);
    if (groupData) setGroup(groupData as Group);
    if (memberData) setRole(memberData.role as GroupRole);
    setLoading(false);
  }, [groupId, session]);

  useEffect(() => { refresh(); }, [refresh]);

  const value: GroupContextValue = {
    group,
    role,
    loading,
    isAdmin: role === 'owner' || role === 'admin',
    isOwner: role === 'owner',
    accentColor: group?.theme_color || colors.primary,
    refresh,
  };

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroup() {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error('useGroup must be used within GroupProvider');
  return ctx;
}

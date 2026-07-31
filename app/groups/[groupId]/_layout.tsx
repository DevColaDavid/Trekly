import { Tabs, useGlobalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { colors } from '../../../lib/theme';
import { GroupProvider, useGroup } from '../../../lib/groupContext';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

function BackButton() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push('/groups')} hitSlop={10} style={{ paddingHorizontal: 12 }}>
      <Text style={{ fontSize: 22, color: colors.text }}>‹</Text>
    </Pressable>
  );
}

function GroupTabs() {
  const { accentColor } = useGroup();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text, fontWeight: '800' },
        headerLeft: () => <BackButton />,
        tabBarActiveTintColor: accentColor,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Calendar', tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Chat', tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} /> }}
      />
      <Tabs.Screen
        name="polls"
        options={{ title: 'Polls', tabBarIcon: ({ focused }) => <TabIcon emoji="🗳️" focused={focused} /> }}
      />
      <Tabs.Screen
        name="notes"
        options={{ title: 'Notes', tabBarIcon: ({ focused }) => <TabIcon emoji="📝" focused={focused} /> }}
      />
      <Tabs.Screen
        name="expenses"
        options={{ title: 'Expenses', tabBarIcon: ({ focused }) => <TabIcon emoji="💵" focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} /> }}
      />
    </Tabs>
  );
}

export default function GroupTabsLayout() {
  const { groupId } = useGlobalSearchParams<{ groupId: string }>();
  if (!groupId) return null;
  return (
    <GroupProvider groupId={groupId}>
      <GroupTabs />
    </GroupProvider>
  );
}

export type GroupRole = 'owner' | 'admin' | 'member';

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  theme_color: string;
  created_by: string;
  created_at: string;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  profiles?: { display_name: string } | null;
};

export type EventRow = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  created_by: string;
  created_at: string;
};

export type NotificationPrefs = {
  user_id: string;
  group_id: string;
  mute_chat: boolean;
  mute_events: boolean;
  mute_polls: boolean;
};

export type RsvpStatus = 'going' | 'maybe' | 'no';

export type Message = {
  id: string;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  profiles?: { display_name: string } | null;
};

export type Poll = {
  id: string;
  group_id: string;
  question: string;
  created_by: string;
  closes_at: string | null;
  created_at: string;
};

export type PollOption = {
  id: string;
  poll_id: string;
  label: string;
  sort_order: number;
};

export type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

export type Note = {
  id: string;
  group_id: string;
  title: string;
  body: string;
  checklist: ChecklistItem[];
  created_by: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  paid_by: string;
  created_at: string;
  profiles?: { display_name: string } | null;
};

export type ExpenseSplit = {
  expense_id: string;
  user_id: string;
  share: number;
  profiles?: { display_name: string } | null;
};

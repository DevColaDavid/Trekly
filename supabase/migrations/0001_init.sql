-- Schema for group calendar / chat / polls / notes app.
-- Run against a Supabase project: supabase db push  (or paste into SQL editor)

create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- groups ----------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- security-definer helper so RLS policies below don't recurse on group_members
create function public.is_group_member(target_group uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group and user_id = auth.uid()
  );
$$;

create function public.handle_new_group()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- ---------- events ----------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  description text,
  location text,
  start_time timestamptz not null,
  end_time timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'no')),
  responded_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ---------- chat ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- polls ----------
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  question text not null,
  created_by uuid not null references public.profiles(id),
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);

create table public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- ---------- notes ----------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  body text not null default '',
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.messages enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.notes enable row level security;

create policy "profiles readable by anyone authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles editable by owner" on public.profiles
  for update using (id = auth.uid());

create policy "groups readable by members" on public.groups
  for select using (public.is_group_member(id));
create policy "groups insertable by creator" on public.groups
  for insert with check (created_by = auth.uid());

create policy "group_members readable by members" on public.group_members
  for select using (public.is_group_member(group_id));
create policy "group_members self-join" on public.group_members
  for insert with check (user_id = auth.uid());
create policy "group_members self-leave" on public.group_members
  for delete using (user_id = auth.uid());

create policy "events readable by group members" on public.events
  for select using (public.is_group_member(group_id));
create policy "events writable by group members" on public.events
  for insert with check (public.is_group_member(group_id) and created_by = auth.uid());
create policy "events updatable by creator" on public.events
  for update using (created_by = auth.uid());
create policy "events deletable by creator" on public.events
  for delete using (created_by = auth.uid());

create policy "rsvps readable by group members" on public.event_rsvps
  for select using (exists (
    select 1 from public.events e where e.id = event_id and public.is_group_member(e.group_id)
  ));
create policy "rsvps writable by self" on public.event_rsvps
  for insert with check (user_id = auth.uid());
create policy "rsvps updatable by self" on public.event_rsvps
  for update using (user_id = auth.uid());

create policy "messages readable by group members" on public.messages
  for select using (public.is_group_member(group_id));
create policy "messages writable by group members" on public.messages
  for insert with check (public.is_group_member(group_id) and user_id = auth.uid());

create policy "polls readable by group members" on public.polls
  for select using (public.is_group_member(group_id));
create policy "polls writable by group members" on public.polls
  for insert with check (public.is_group_member(group_id) and created_by = auth.uid());

create policy "poll_options readable by group members" on public.poll_options
  for select using (exists (
    select 1 from public.polls p where p.id = poll_id and public.is_group_member(p.group_id)
  ));
create policy "poll_options writable by poll creator" on public.poll_options
  for insert with check (exists (
    select 1 from public.polls p where p.id = poll_id and p.created_by = auth.uid()
  ));

create policy "poll_votes readable by group members" on public.poll_votes
  for select using (exists (
    select 1 from public.polls p where p.id = poll_id and public.is_group_member(p.group_id)
  ));
create policy "poll_votes writable by self" on public.poll_votes
  for insert with check (user_id = auth.uid());
create policy "poll_votes updatable by self" on public.poll_votes
  for update using (user_id = auth.uid());
create policy "poll_votes deletable by self" on public.poll_votes
  for delete using (user_id = auth.uid());

create policy "notes readable by group members" on public.notes
  for select using (public.is_group_member(group_id));
create policy "notes writable by group members" on public.notes
  for insert with check (public.is_group_member(group_id) and created_by = auth.uid());
create policy "notes updatable by group members" on public.notes
  for update using (public.is_group_member(group_id));

-- realtime: enable for chat + live rsvp/vote updates
alter publication supabase_realtime add table public.messages, public.events, public.event_rsvps, public.poll_votes, public.notes;

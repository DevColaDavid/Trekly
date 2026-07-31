-- Nukes everything this app created in the public schema and rebuilds from
-- scratch (0001_init.sql + 0002_auto_enable_rls.sql + 0003_roles_and_editing.sql
-- + 0004_push_notification_triggers.sql, unchanged). Does NOT touch
-- auth.users — existing logins survive, their data doesn't. Paste this whole
-- file into the Supabase SQL editor and run once.
--
-- NOTE: the send-push edge function must already be deployed separately
-- (supabase/functions/send-push) — this script only wires the DB side.

-- ==================== drop ====================
drop trigger if exists on_auth_user_created on auth.users;
drop event trigger if exists ensure_rls;

drop table if exists public.push_tokens cascade;
drop table if exists public.expense_splits cascade;
drop table if exists public.expenses cascade;
drop table if exists public.notes cascade;
drop table if exists public.poll_votes cascade;
drop table if exists public.poll_options cascade;
drop table if exists public.polls cascade;
drop table if exists public.messages cascade;
drop table if exists public.event_rsvps cascade;
drop table if exists public.events cascade;
drop table if exists public.group_members cascade;
drop table if exists public.groups cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.handle_new_group() cascade;
drop function if exists public.is_group_member(uuid) cascade;
drop function if exists public.is_group_admin(uuid) cascade;
drop function if exists public.is_group_owner(uuid) cascade;
drop function if exists public.transfer_group_ownership(uuid, uuid) cascade;
drop function if exists public.notify_group(uuid, text, text, uuid) cascade;
drop function if exists public.on_message_insert_notify() cascade;
drop function if exists public.on_event_insert_notify() cascade;
drop function if exists public.on_poll_insert_notify() cascade;
drop function if exists rls_auto_enable() cascade;

-- ==================== rebuild: 0001_init.sql ====================
create extension if not exists "pgcrypto";

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

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  theme_color text not null default '#4F46E5',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

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

create function public.is_group_admin(target_group uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create function public.is_group_owner(target_group uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group and user_id = auth.uid() and role = 'owner'
  );
$$;

revoke execute on function public.is_group_admin(uuid) from public, anon;
grant execute on function public.is_group_admin(uuid) to authenticated;
revoke execute on function public.is_group_owner(uuid) from public, anon;
grant execute on function public.is_group_owner(uuid) to authenticated;

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

create function public.transfer_group_ownership(target_group uuid, new_owner uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.group_members
    where group_id = target_group and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'only the current owner can transfer ownership';
  end if;
  if not exists (
    select 1 from public.group_members where group_id = target_group and user_id = new_owner
  ) then
    raise exception 'target user is not a member of this group';
  end if;

  update public.group_members set role = 'admin' where group_id = target_group and user_id = auth.uid();
  update public.group_members set role = 'owner' where group_id = target_group and user_id = new_owner;
  update public.groups set created_by = new_owner where id = target_group;
end;
$$;

revoke execute on function public.transfer_group_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_group_ownership(uuid, uuid) to authenticated;

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

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

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

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  body text not null default '',
  checklist jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);

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
-- also readable by the creator directly (not just via group_members): the
-- membership row is added by an AFTER INSERT trigger, and Postgres checks
-- RETURNING visibility before that trigger's effects are visible within the
-- same statement — without this, `.insert().select()` on groups 403s.
create policy "groups readable by creator" on public.groups
  for select using (created_by = auth.uid());
create policy "groups insertable by creator" on public.groups
  for insert with check (created_by = auth.uid());
create policy "groups updatable by admin" on public.groups
  for update using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy "groups deletable by owner" on public.groups
  for delete using (public.is_group_owner(id));

create policy "group_members readable by members" on public.group_members
  for select using (public.is_group_member(group_id));
create policy "group_members self-join" on public.group_members
  for insert with check (user_id = auth.uid());
create policy "group_members self-leave" on public.group_members
  for delete using (user_id = auth.uid());
create policy "group_members role updatable by owner" on public.group_members
  for update using (public.is_group_owner(group_id))
  with check (public.is_group_owner(group_id) and role in ('member', 'admin'));
create policy "group_members removable by admin" on public.group_members
  for delete using (public.is_group_admin(group_id) and role <> 'owner');

create policy "events readable by group members" on public.events
  for select using (public.is_group_member(group_id));
create policy "events writable by group members" on public.events
  for insert with check (public.is_group_member(group_id) and created_by = auth.uid());
create policy "events updatable by creator" on public.events
  for update using (created_by = auth.uid());
create policy "events deletable by creator or admin" on public.events
  for delete using (created_by = auth.uid() or public.is_group_admin(group_id));

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
create policy "messages editable by author" on public.messages
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "messages deletable by author or admin" on public.messages
  for delete using (user_id = auth.uid() or public.is_group_admin(group_id));

create policy "polls readable by group members" on public.polls
  for select using (public.is_group_member(group_id));
create policy "polls writable by group members" on public.polls
  for insert with check (public.is_group_member(group_id) and created_by = auth.uid());
create policy "polls deletable by creator or admin" on public.polls
  for delete using (created_by = auth.uid() or public.is_group_admin(group_id));

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
create policy "notes editable by author" on public.notes
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "notes deletable by author or admin" on public.notes
  for delete using (created_by = auth.uid() or public.is_group_admin(group_id));

alter publication supabase_realtime add table public.messages, public.events, public.event_rsvps, public.poll_votes, public.notes;

-- ==================== rebuild: 0002_auto_enable_rls.sql ====================
create or replace function rls_auto_enable()
returns event_trigger
language plpgsql
security definer set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name = 'public' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (schema %)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$$;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function rls_auto_enable();

-- ==================== rebuild: expenses + push_tokens ====================
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null check (amount > 0),
  paid_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.expense_splits (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  share numeric(10,2) not null check (share >= 0),
  primary key (expense_id, user_id)
);

alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;

create policy "expenses readable by group members" on public.expenses
  for select using (public.is_group_member(group_id));
create policy "expenses writable by group members" on public.expenses
  for insert with check (public.is_group_member(group_id) and paid_by = auth.uid());
create policy "expenses editable by payer or admin" on public.expenses
  for update using (paid_by = auth.uid() or public.is_group_admin(group_id))
  with check (paid_by = auth.uid() or public.is_group_admin(group_id));
create policy "expenses deletable by payer or admin" on public.expenses
  for delete using (paid_by = auth.uid() or public.is_group_admin(group_id));

create policy "expense_splits readable by group members" on public.expense_splits
  for select using (exists (
    select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id)
  ));
create policy "expense_splits writable by expense payer" on public.expense_splits
  for insert with check (exists (
    select 1 from public.expenses e where e.id = expense_id and e.paid_by = auth.uid()
  ));
create policy "expense_splits deletable by expense payer or admin" on public.expense_splits
  for delete using (exists (
    select 1 from public.expenses e where e.id = expense_id and (e.paid_by = auth.uid() or public.is_group_admin(e.group_id))
  ));

alter publication supabase_realtime add table public.expenses, public.expense_splits;

create table public.push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table public.push_tokens enable row level security;

create policy "push_tokens manageable by owner" on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ==================== rebuild: 0004_push_notification_triggers.sql ====================
-- ponytail: auth between this trigger and the edge function is a hardcoded
-- shared secret (no secrets-manager was available at deploy time). Upgrade
-- path: move both sides to Supabase Vault + an edge function secret.
create extension if not exists pg_net;

create function public.notify_group(target_group uuid, notif_title text, notif_body text, exclude_user uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://bkripfdrimleegazhvoh.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', '6d8bd667d3689cc2a586341e1c15335cb8b2c19a4a36e0da'),
    body := jsonb_build_object('group_id', target_group, 'title', notif_title, 'body', notif_body, 'exclude_user_id', exclude_user)
  );
end;
$$;

revoke execute on function public.notify_group(uuid, text, text, uuid) from public, anon, authenticated;

create function public.on_message_insert_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  sender_name text;
begin
  select display_name into sender_name from public.profiles where id = new.user_id;
  perform public.notify_group(new.group_id, coalesce(sender_name, 'Someone') || ' sent a message', left(new.body, 100), new.user_id);
  return new;
end;
$$;

create trigger on_message_insert_notify
  after insert on public.messages
  for each row execute function public.on_message_insert_notify();

create function public.on_event_insert_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notify_group(new.group_id, 'New event: ' || new.title, to_char(new.start_time, 'Mon DD, HH12:MI AM'), new.created_by);
  return new;
end;
$$;

create trigger on_event_insert_notify
  after insert on public.events
  for each row execute function public.on_event_insert_notify();

create function public.on_poll_insert_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notify_group(new.group_id, 'New poll', new.question, new.created_by);
  return new;
end;
$$;

create trigger on_poll_insert_notify
  after insert on public.polls
  for each row execute function public.on_poll_insert_notify();

-- ==================== backfill existing auth users ====================
-- users who signed up before this rebuild have no profiles row (trigger
-- didn't exist yet) — without this, their next group/event insert 403s on
-- the created_by fk the same way it did before.
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

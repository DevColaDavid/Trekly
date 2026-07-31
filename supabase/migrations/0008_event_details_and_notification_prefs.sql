-- Feature: all-day events.
alter table public.events add column if not exists all_day boolean not null default false;

-- Feature: per-group, per-category push mute (chat / events / polls).
create table if not exists public.notification_prefs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  mute_chat boolean not null default false,
  mute_events boolean not null default false,
  mute_polls boolean not null default false,
  primary key (user_id, group_id)
);

alter table public.notification_prefs enable row level security;

drop policy if exists "notification_prefs manageable by self" on public.notification_prefs;
create policy "notification_prefs manageable by self" on public.notification_prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notify_group grows a `category` argument so the edge function can filter
-- out members who muted that category. Appended with a default so this
-- replace is compatible with the existing 4-arg signature.
create or replace function public.notify_group(
  target_group uuid,
  notif_title text,
  notif_body text,
  exclude_user uuid,
  category text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://bkripfdrimleegazhvoh.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', '6d8bd667d3689cc2a586341e1c15335cb8b2c19a4a36e0da'),
    body := jsonb_build_object(
      'group_id', target_group,
      'title', notif_title,
      'body', notif_body,
      'exclude_user_id', exclude_user,
      'category', category
    )
  );
end;
$$;

create or replace function public.on_message_insert_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  sender_name text;
begin
  select display_name into sender_name from public.profiles where id = new.user_id;
  perform public.notify_group(new.group_id, coalesce(sender_name, 'Someone') || ' sent a message', left(new.body, 100), new.user_id, 'chat');
  return new;
end;
$$;

create or replace function public.on_event_insert_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notify_group(new.group_id, 'New event: ' || new.title, to_char(new.start_time, 'Mon DD, HH12:MI AM'), new.created_by, 'events');
  return new;
end;
$$;

create or replace function public.on_poll_insert_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notify_group(new.group_id, 'New poll', new.question, new.created_by, 'polls');
  return new;
end;
$$;
